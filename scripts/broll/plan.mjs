import fs from 'node:fs';
import path from 'node:path';
import {sha256File, sha256Text, stableString} from './hash.mjs';
import {buildPrompt} from './prompt.mjs';
import {clipCost, rateOf} from './prices.mjs';
import {aspectOf, framesFor, genSecOf, secText, windowOf} from './time.mjs';

const cueNo = (id) => Number(String(id).slice(1));

/**
 * 把已经通过校验的 broll.json 换成计划：毫秒窗口、生成秒数、费用、提示词、请求哈希。
 * 模型不写这些，全部由这里算。
 */
export const buildPlan = ({doc, cues, media, style, projectDir}) => {
  const byId = new Map(cues.map((c) => [c.id, c]));
  const aspect = aspectOf(media.width, media.height);
  const rate = rateOf(doc.provider, doc.quality);
  const clips = doc.clips.map((clip) => {
    const from = byId.get(clip.from);
    const to = byId.get(clip.to);
    const win = windowOf(from, to, media.durationMs);
    const genSec = genSecOf(win.durationMs);
    const frames = framesFor(win.durationMs, 30);
    const covered = cues.filter((c) => cueNo(c.id) >= cueNo(clip.from) && cueNo(c.id) <= cueNo(clip.to));
    const sentence = covered.map((c) => c.text.replace(/\s+/g, ' ').trim()).join(' ');
    const prompt = buildPrompt({style, clip, genSec});
    let sourceSha256 = null;
    if (doc.provider === 'local' && clip.file && projectDir) {
      const abs = path.resolve(projectDir, clip.file);
      if (fs.existsSync(abs)) sourceSha256 = sha256File(abs);
    }
    const request = {
      style: doc.style,
      provider: doc.provider,
      quality: doc.quality,
      aspect,
      width: media.width,
      height: media.height,
      genSec,
      prompt,
      sourceSha256,
    };
    return {
      id: clip.id,
      from: clip.from,
      to: clip.to,
      mode: clip.mode,
      job: clip.job,
      plain: clip.plain,
      place: clip.place,
      subject: clip.subject,
      camera: clip.camera,
      action: clip.action ?? null,
      end: clip.end ?? null,
      beats: clip.beats ?? null,
      file: clip.file ?? null,
      sentence,
      windowMs: [win.startMs, win.endMs],
      windowSec: Number(secText(win.durationMs)),
      genSec,
      frames,
      costYuan: clipCost(doc.provider, doc.quality, genSec),
      prompt,
      promptHash: sha256Text(prompt),
      requestHash: sha256Text(stableString(request)),
    };
  });
  const totalYuan = Math.round(clips.reduce((a, c) => a + c.costYuan, 0) * 100) / 100;
  return {
    version: 1,
    style: doc.style,
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
    clips,
  };
};

export const writePlan = (file, plan) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  return file;
};
