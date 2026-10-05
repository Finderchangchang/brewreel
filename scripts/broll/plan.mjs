import fs from 'node:fs';
import path from 'node:path';
import {freezeNoiseOf} from './check-clip.mjs';
import {sha256File, sha256Text, stableString} from './hash.mjs';
import {isMotion, validateMotionClip} from './motion.mjs';
import {buildPrompt, buildPromptV2, clipRefs, hashFieldsV2, isV2, loadCharacter, prevForContinue} from './prompt.mjs';
import {clipCost, rateOf} from './prices.mjs';
import {ROOT} from './root.mjs';
import {aspectOf, framesFor, genSecOf, secText, windowOf} from './time.mjs';

const cueNo = (id) => Number(String(id).slice(1));

/**
 * 把已经通过校验的 broll.json 换成计划：毫秒窗口、生成秒数、费用、提示词、请求哈希。
 * 模型不写这些，全部由这里算。
 * - 动效段（source:"motion"）：费用 0，不生成、没有提示词和请求哈希；带上 motion 计划（上屏字、marks），合成时直接画。
 * - AI 段 version 1：提示词和请求哈希和 v0.8 一个字都不差（改了老账本会重新花钱）。
 * - AI 段 version 2：按 look 选风格和参考图，提示词 v2；请求哈希加上风格 id、扩写模式、参考图、continue 时上一段的结尾。
 * @param {{doc: object, cues: object[], media: object, style?: object, styles?: object, character?: object, projectDir?: string,
 *   tokens?: {text: string, startMs: number}[]}} p  style 是 doc.style 的风格包（v1 用）；styles 是全部风格包（v2 用）
 */
export const buildPlan = ({doc, cues, media, style, styles = null, character = null, projectDir, tokens = []}) => {
  const byId = new Map(cues.map((c) => [c.id, c]));
  const aspect = aspectOf(media.width, media.height);
  const rate = rateOf(doc.provider, doc.quality);
  const v2 = isV2(doc);
  const allStyles = styles ?? (style ? {[doc.style]: style} : {});
  const mainStyle = style ?? allStyles[doc.style];
  const role = v2 && doc.clips.some((c) => !isMotion(c)) ? character ?? loadCharacter() : character;
  const clips = doc.clips.map((clip) => {
    const from = byId.get(clip.from);
    const to = byId.get(clip.to);
    const win = windowOf(from, to, media.durationMs);
    const frames = framesFor(win.durationMs, 30);
    const covered = cues.filter((c) => cueNo(c.id) >= cueNo(clip.from) && cueNo(c.id) <= cueNo(clip.to));
    const sentence = covered.map((c) => c.text.replace(/\s+/g, ' ').trim()).join(' ');
    const base = {id: clip.id, from: clip.from, to: clip.to, mode: clip.mode, job: clip.job, plain: clip.plain, sentence, windowMs: [win.startMs, win.endMs], windowSec: Number(secText(win.durationMs)), frames};

    if (isMotion(clip)) {
      const checked = validateMotionClip(clip, cues, {durationMs: media.durationMs, tokens});
      if (!checked.plan) {
        const first = checked.errors[0];
        throw new Error(`${clip.id} 是动效画面，但没通过校验${first ? `：${first.where}：${first.problem}` : ''}。先跑 node scripts/broll/validate.mjs 按「怎么改」改好。`);
      }
      return {
        ...base,
        source: 'motion',
        template: clip.template,
        slots: clip.slots,
        genSec: 0,
        costYuan: 0,
        prompt: null,
        promptHash: null,
        requestHash: null,
        motion: checked.plan,
      };
    }

    const genSec = genSecOf(win.durationMs);
    let sourceSha256 = null;
    if (doc.provider === 'local' && clip.file && projectDir) {
      const abs = path.resolve(projectDir, clip.file);
      if (fs.existsSync(abs)) sourceSha256 = sha256File(abs);
    }
    let prompt;
    let request;
    let extra;
    if (v2) {
      const prev = prevForContinue(doc, clip);
      const built = buildPromptV2({doc, clip, prev, genSec, styles: allStyles, character: role});
      if (built.leaked.length) {
        throw new Error(`${clip.id}：拼好的提示词里有「${built.leaked.join('」「')}」，会把画面往带凸点的玩具积木上带。先跑 node scripts/broll/validate.mjs 按「怎么改」改好。`);
      }
      prompt = built.prompt;
      const fields = hashFieldsV2({doc, clip, prev, styles: allStyles});
      request = {style: doc.style, provider: doc.provider, quality: doc.quality, aspect, width: media.width, height: media.height, genSec, prompt, sourceSha256, ...fields};
      extra = {
        styleId: fields.styleId,
        look: fields.look,
        link: fields.link,
        refs: clipRefs({doc, clip, styles: allStyles}).map((r) => r.abs),
        promptExpansion: fields.promptExpansion,
        freezeNoise: freezeNoiseOf(allStyles[fields.styleId]),
      };
    } else {
      prompt = buildPrompt({style: mainStyle, clip, genSec});
      const styleDir = path.join(ROOT, 'broll', 'styles', doc.style);
      const refList = Array.isArray(mainStyle?.references) ? mainStyle.references : [];
      const referenceSha256 = refList.map((rel) => {
        const abs = path.join(styleDir, rel);
        return fs.existsSync(abs) ? sha256File(abs) : `missing:${rel}`;
      });
      // 这个对象的字段和 v0.8 一样，一个都不能加：老账本靠它判断「请求没变、不重新花钱」
      request = {style: doc.style, provider: doc.provider, quality: doc.quality, aspect, width: media.width, height: media.height, genSec, prompt, sourceSha256, referenceSha256};
      extra = {
        styleId: doc.style,
        look: 'main',
        link: 'new',
        refs: refList.map((rel) => path.join(styleDir, rel)).filter((abs) => fs.existsSync(abs)),
        promptExpansion: null,
        freezeNoise: freezeNoiseOf(mainStyle),
      };
    }
    return {
      ...base,
      source: 'ai',
      place: clip.place,
      subject: clip.subject,
      camera: clip.camera,
      action: clip.action ?? null,
      end: clip.end ?? null,
      beats: clip.beats ?? null,
      file: clip.file ?? null,
      genSec,
      costYuan: clipCost(doc.provider, doc.quality, genSec),
      prompt,
      promptHash: sha256Text(prompt),
      requestHash: sha256Text(stableString(request)),
      ...extra,
    };
  });
  const ai = clips.filter((c) => c.source !== 'motion');
  const totalYuan = Math.round(ai.reduce((a, c) => a + c.costYuan, 0) * 100) / 100;
  return {
    version: 2,
    docVersion: doc.version,
    style: doc.style,
    styleAlt: doc.styleAlt ?? null,
    thread: doc.thread ?? null,
    provider: doc.provider,
    quality: doc.quality,
    captions: doc.captions,
    budgetYuan: doc.budgetYuan,
    aspect,
    width: media.width,
    height: media.height,
    fps: media.fps,
    durationMs: media.durationMs,
    priceYuanPerSec: rate,
    totalYuan,
    aiCount: ai.length,
    motionCount: clips.length - ai.length,
    aiGenSec: ai.reduce((a, c) => a + c.genSec, 0),
    clips,
  };
};

/** 只要 AI 画面段（要生成、要审片、要花钱的那些）。 */
export const aiClipsOf = (plan) => (plan?.clips ?? []).filter((c) => c.source !== 'motion');

export const writePlan = (file, plan) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  return file;
};
