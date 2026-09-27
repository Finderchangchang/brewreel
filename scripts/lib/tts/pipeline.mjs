// ============================================================
// make.mjs 的「配音」步骤（在分镜校验之后、配乐之前）：
//   1. 每个写了 vo 的镜头合成一句旁白（先查缓存），拿到音频和字级时间戳
//   2. 音频放进 template/public/_run/<id>/voice/（真接口的 mp3 先解码成 wav、统一响度）
//   3. 镜头时长改成「前留白 + 旁白 + 后留白」向上取整拍，不小于 spec 最小值；超过 spec 最大值报错
//   4. 产出 voice.json（作为 props.voice 传给 Remotion）和 manifest 里的配音记录
// 没写 meta.voice 的分镜不会走到这里，行为和以前完全一样。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import {PROVIDERS, cacheDirOf, synthesizeCached, voiceConfigOf} from './index.mjs';
import {TtsError} from './minimax.mjs';
import {markHot, paginate, plainOf, spokenUnits} from './timing.mjs';
import {decodeWav, encodeWav, wavInfo} from './wav.mjs';

/** 旁白前留白 / 后留白（秒） */
export const LEAD_SEC = 0.15;
export const TAIL_SEC = 0.35;
/** 配乐闪避：人声段整体压低 db，起 attackMs、落 releaseMs */
export const DUCK = {db: -10, attackMs: 120, releaseMs: 300};
/** 人声统一到的响度（有效段 RMS，dBFS）和峰值上限。-15：配乐在 Remotion 里按 0.3 音量播（约 -26 LUFS），
 *  人声放到这里，成片整体约 -16 LUFS（mock 实测），人声段比压低后的配乐高 20 dB 以上；峰值上限保证不削波 */
export const VOICE_RMS_DB = -15;
const VOICE_PEAK_DB = -1.5;

/** 这一镜有没有旁白 */
export const voOf = (shot) => (typeof shot?.vo === 'string' && plainOf(shot.vo).trim() ? shot.vo.trim() : null);

/** 16-bit WAV 的有效段 RMS 拉到 VOICE_RMS_DB（峰值不超过 VOICE_PEAK_DB）。返回新 Buffer；读不了返回原样 */
export const normalizeWav = (buf) => {
  const d = decodeWav(buf);
  if (!d) return buf;
  const x = d.samples;
  const win = Math.max(1, Math.round(d.sampleRate * 0.05));
  let sum = 0;
  let cnt = 0;
  let peak = 0;
  for (let i = 0; i < x.length; i += win) {
    let e = 0;
    const end = Math.min(x.length, i + win);
    for (let k = i; k < end; k++) {
      e += x[k] * x[k];
      peak = Math.max(peak, Math.abs(x[k]));
    }
    e /= end - i;
    if (e > 10 ** (-50 / 10)) (sum += e), cnt++; // 只量有声音的 50ms 窗
  }
  if (!cnt || peak <= 0) return buf;
  const rmsDb = 10 * Math.log10(sum / cnt);
  let g = 10 ** ((VOICE_RMS_DB - rmsDb) / 20);
  g = Math.min(g, 10 ** (VOICE_PEAK_DB / 20) / peak);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * g;
  return encodeWav(y, d.sampleRate);
};

const errOf = (i, type, zh, fix) => ({where: `第 ${i + 1} 镜（${type}）vo`, problem: zh, fix});

/**
 * @param {{sb: any, specs: Record<string, any>, beat: number, schedule: (sb: any, specs: any) => {start: number, dur: number, end: number}[],
 *          runDir: string, runRel: string, log?: (s: string) => void, env?: any, fetch?: any, sleep?: any, cacheDir?: string,
 *          decode?: (inFile: string, outWav: string) => boolean, minIntervalMs?: number, captionLayer?: string}} o
 *   sb：要交给 Remotion 的那份分镜（会被改写：有旁白的镜头 dur 改成配音时长，beats 删掉）
 *   decode：把 mp3 等解码成 16-bit wav 的函数（make.mjs 用 Remotion 自带的 ffmpeg）；不给就原样用 mp3
 * @returns {Promise<{ok: true, voice: any, manifest: any, changes: {i: number, from: number, to: number}[]} |
 *                   {ok: false, kind: 'invalid'|'usage', message: string, messageEn: string, errors?: {where: string, problem: string, fix: string}[]}>}
 */
export async function runVoiceStep(o) {
  const {sb, specs, beat, schedule, runDir, runRel} = o;
  const log = o.log ?? (() => {});
  const cfg = voiceConfigOf(sb.meta);
  if (!cfg) return {ok: false, kind: 'usage', message: '没有 meta.voice', messageEn: 'meta.voice is missing'};
  const cacheDir = o.cacheDir ?? cacheDirOf(o.env);
  const voiceDir = path.join(runDir, 'voice');
  fs.mkdirSync(voiceDir, {recursive: true});
  const before = schedule(sb, specs);
  const lines = [];
  const errors = [];
  for (let i = 0; i < sb.shots.length; i++) {
    const shot = sb.shots[i];
    const vo = voOf(shot);
    if (!vo) continue;
    const plain = plainOf(vo).trim();
    let r;
    try {
      r = await synthesizeCached(plain, cfg, {cacheDir, env: o.env, fetch: o.fetch, sleep: o.sleep, log, minIntervalMs: o.minIntervalMs});
    } catch (e) {
      if (e instanceof TtsError) {
        const storyIssue = ['TOO_LONG', 'BAD_TEXT', 'EMPTY'].includes(e.code);
        return {
          ok: false,
          kind: storyIssue ? 'invalid' : 'usage',
          message: `第 ${i + 1} 镜配音失败：${e.zh}${e.hint ? `（${e.hint}）` : ''}`,
          messageEn: `voice-over for shot ${i + 1} failed: ${e.en}${e.hintEn ? ` (${e.hintEn})` : ''}`,
        };
      }
      throw e;
    }
    // 播放用的文件：统一响度后的 wav（缓存成 <key>.norm<目标响度>.wav，改了 VOICE_RMS_DB 不会误用旧结果）。
    // wav（mock）直接处理；mp3 等先解码，解码不了就原样用
    let playFile = r.audioPath;
    let durMs = r.durMs;
    if (r.ext === 'wav' || o.decode) {
      const norm = path.join(cacheDir, `${r.key}.norm${-VOICE_RMS_DB}.wav`);
      if (!fs.existsSync(norm)) {
        const tmp = `${norm}.tmp-${process.pid}.wav`;
        try {
          if (r.ext === 'wav') fs.writeFileSync(tmp, normalizeWav(fs.readFileSync(r.audioPath)));
          else if (o.decode(r.audioPath, tmp) && fs.existsSync(tmp)) fs.writeFileSync(tmp, normalizeWav(fs.readFileSync(tmp)));
          if (fs.existsSync(tmp) && wavInfo(tmp)) fs.renameSync(tmp, norm);
        } catch {}
        try {
          fs.rmSync(tmp, {force: true});
        } catch {}
      }
      if (fs.existsSync(norm)) {
        playFile = norm;
        durMs = Math.round(wavInfo(norm)?.durMs ?? durMs);
      } else log(`⚠ 第 ${i + 1} 镜：旁白解码失败，直接用原始 ${r.ext}（响度没统一）`);
    }
    const name = `${String(i + 1).padStart(2, '0')}-${r.key.slice(0, 10)}${path.extname(playFile)}`;
    fs.copyFileSync(playFile, path.join(voiceDir, name));
    // 时长：前留白 + 旁白 + 后留白，向上取整拍（排程器只认整拍：半拍会被四舍五入进位，所以直接取整拍）
    const spec = specs[shot.type] ?? {dur: {min: 1, max: 60, default: 3}};
    const need = LEAD_SEC + durMs / 1000 + TAIL_SEC;
    // spec 最小值也要向上取到整拍：quiz 一拍 0.46875 秒，brandEnd 最短 3.8 秒 → 至少 9 拍（4.22 秒），
    // 直接用 3.8 会被排程器吸附成 8 拍 3.75 秒，反而短于最小值
    const dur = Math.max(Math.ceil(spec.dur.min / beat - 1e-6), Math.ceil(need / beat - 1e-6)) * beat;
    if (dur > spec.dur.max + 1e-6) {
      const units = spokenUnits(plain, cfg.lang);
      const fit = Math.max(1, Math.floor((units * (spec.dur.max - LEAD_SEC - TAIL_SEC)) / (durMs / 1000)));
      errors.push(
        errOf(i, shot.type, `旁白念完要 ${(durMs / 1000).toFixed(2)} 秒，加前后留白 ${need.toFixed(2)} 秒，超过 ${shot.type} 这一镜最长 ${spec.dur.max} 秒`,
          `把这句拆到两镜（每镜一句），或缩短到约 ${fit} ${cfg.lang === 'en' ? '个音节' : '字'}以内；也可以把 meta.voice.speed 调快一点（不超过 1.2）`),
      );
    }
    lines.push({i, type: shot.type, vo, plain, r, durMs, dur, src: `${runRel}/voice/${name}`});
  }
  if (errors.length)
    return {
      ok: false,
      kind: 'invalid',
      errors,
      message: `${errors.length} 镜旁白比镜头最长时长还长：${errors[0].where}：${errors[0].problem}`,
      messageEn: `${errors.length} narration line(s) are longer than their shot allows`,
    };
  const changes = [];
  for (const l of lines) {
    const from = before[l.i]?.dur;
    sb.shots[l.i].dur = Number(l.dur.toFixed(6));
    delete sb.shots[l.i].beats;
    changes.push({i: l.i, from, to: l.dur});
  }
  const slots = schedule(sb, specs);
  const total = slots.length ? slots[slots.length - 1].end : 0;
  const lineMax = cfg.lang === 'en' ? 22 : 12;
  const voice = {
    provider: cfg.provider,
    voiceId: cfg.voiceId,
    model: cfg.model,
    speed: cfg.speed,
    emotion: cfg.emotion,
    lang: cfg.lang,
    subtitles: cfg.subtitles,
    totalMs: Math.round(total * 1000),
    voiceMs: lines.reduce((a, l) => a + l.durMs, 0),
    // baked：make_bgm.py 已经把闪避做进 bgm.wav 了（make.mjs 配乐成功后改成 true）；为 true 时组件不要再压 bgm 音量
    duck: {...DUCK, baked: false},
    lines: lines.map((l) => {
      const words = markHot(l.vo, l.r.words);
      // subtitle = 这一句上不上旁白字幕，和画面组件（template/src/core/voice.tsx）同一个判断：
      //   cards（及 captionLayer=cards 的风格）走全局字幕带：这一镜写了 caption（照旧显示 caption，旁白只念）、
      //     或镜头本身不出字幕（endCard 这类 caption: none）时为 false；
      //   quiz / journey（captionLayer: none）在自己的画面里画旁白字幕条，每句都画，只看 subtitles 是不是 off
      const band = !o.captionLayer || o.captionLayer === 'cards';
      const cap = sb.shots[l.i].caption;
      const written = Array.isArray(cap) ? cap.some((x) => typeof x === 'string' && x.length > 0) : typeof cap === 'string' && cap.length > 0;
      const hasCaption = band && (written || specs[l.type]?.caption === 'none');
      return {
        shot: l.i,
        text: l.vo,
        src: l.src,
        startMs: Math.round(LEAD_SEC * 1000),
        durMs: l.durMs,
        words,
        granularity: l.r.granularity,
        // 以下是约定之外的便利字段
        shotStartMs: Math.round(slots[l.i].start * 1000),
        absStartMs: Math.round((slots[l.i].start + LEAD_SEC) * 1000),
        subtitle: cfg.subtitles !== 'off' && !hasCaption,
        pages: paginate(words, {lang: cfg.lang, lineMax}),
      };
    }),
  };
  const manifest = {
    provider: cfg.provider,
    voiceId: cfg.voiceId,
    model: cfg.model,
    speed: cfg.speed,
    emotion: cfg.emotion,
    subtitles: cfg.subtitles,
    cacheDir,
    lines: lines.map((l) => ({shot: l.i + 1, type: l.type, chars: Array.from(l.plain).length, durMs: l.durMs, cacheHit: l.r.cacheHit, granularity: l.r.granularity, shotDur: {from: before[l.i]?.dur, to: l.dur}})),
    synthesized: lines.filter((l) => !l.r.cacheHit).length,
    cacheHits: lines.filter((l) => l.r.cacheHit).length,
    billedCharacters: lines.reduce((a, l) => a + (l.r.cacheHit ? 0 : l.r.usageCharacters || 0), 0),
    totalSec: Number(total.toFixed(3)),
  };
  return {ok: true, voice, manifest, changes, slots, total};
}

/** 人声区间（整片秒）：给 make_bgm.py 做闪避 */
export const voiceIntervals = (voice) =>
  (voice?.lines ?? []).map((l) => [Number((l.absStartMs / 1000).toFixed(3)), Number(((l.absStartMs + l.durMs) / 1000).toFixed(3))]);

export {PROVIDERS};
