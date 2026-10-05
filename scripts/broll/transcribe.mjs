#!/usr/bin/env node
// 本地转写：talk.mp4 → talk.srt（SenseVoice，sherpa-onnx-node，免费、不联网，只有第一次要下载约 240MB 模型）。
//   node scripts/broll/transcribe.mjs <项目目录> [--lang auto|zh|en] [--terms "精酿,BrewReel"] [--no-fix] [--force] [--engine local]
// 已有 talk.srt 且没加 --force：什么都不动，退出 0（不会覆盖你改过的字幕）。
// --force：旧的 talk.srt 先改名为 talk.srt.bak-<时间>；同一个视频复用缓存里的逐字时间，只重新切句和校对。
// 有 LLM_API_KEY / DEEPSEEK_API_KEY 且没加 --no-fix：便宜模型只交改字补丁，脚本按拼音规则决定改不改，记录写进 talk.fixes.txt。
// talk.terms.txt（可选）：一行一个专有名词，和 --terms 合并。
// 退出码：0 成功（或已有 talk.srt）/ 2 参数错、缺 talk.mp4 / 4 转写失败（组件、模型、解码出错）
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectSilences, extractWav, sha256Stream} from './asr/audio.mjs';
import {cuesFromAsr, layoutText, toSrt} from './asr/cues.mjs';
import {formatFixesTxt, runFix} from './asr/fix.mjs';
import {DEFAULT_MODEL, MODELS, ensureModel} from './asr/models.mjs';
import {AsrRuntimeError, recognizeWav} from './asr/sensevoice.mjs';
import {sha256Text} from './hash.mjs';
import {callLlm, hasLlmKey, readLlmEnv} from './llm-client.mjs';
import {probeMedia} from './media.mjs';
import {parseSrt} from './srt.mjs';

export const LANGS = ['auto', 'zh', 'en', 'yue', 'ja', 'ko'];
export const ENGINES = ['local'];
const LANG_NAME = {zh: '中文', en: '英文', yue: '粤语', ja: '日语', ko: '韩语'};
const SELF = fileURLToPath(import.meta.url);
const CACHE_VERSION = 1;

const usage = () =>
  '用法：node scripts/broll/transcribe.mjs <项目目录> [--lang auto|zh|en] [--terms "精酿,BrewReel"] [--no-fix] [--force] [--engine local]';

/** "精酿,BrewReel" / ["精酿"] → 去重后的数组。逗号、顿号、分号、换行都算分隔。 */
export const parseTerms = (v) => {
  const list = Array.isArray(v) ? v : String(v ?? '').split(/[,，、;；\n]+/);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const t = String(raw ?? '').trim();
    if (!t || t.length > 40 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
};

/** 项目目录里的 talk.terms.txt：一行一个，# 开头是注释。 */
export const readTermsFile = (dir) => {
  const p = path.join(dir, 'talk.terms.txt');
  if (!fs.existsSync(p)) return [];
  const lines = fs
    .readFileSync(p, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim());
  return parseTerms(lines);
};

export const asrCachePath = (dir, sha, model, lang) => path.join(dir, '.brewreel', `asr-${sha.slice(0, 16)}-${model}-${lang}.json`);

const stampOf = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const backupSrt = (srtPath, now) => {
  let bak = `${srtPath}.bak-${stampOf(now)}`;
  for (let i = 2; fs.existsSync(bak); i++) bak = `${srtPath}.bak-${stampOf(now)}-${i}`;
  fs.renameSync(srtPath, bak);
  return bak;
};

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

const validAsr = (j) => j && Array.isArray(j.tokens) && Array.isArray(j.times) && j.tokens.length === j.times.length && j.tokens.length > 0;

/** 转写记录：.brewreel/transcribe.json。make-talk 用它判断 talk.srt 是自动转写的还是用户自己放的。 */
export const transcribeMetaPath = (dir) => path.join(dir, '.brewreel', 'transcribe.json');
export const readTranscribeMeta = (dir) => readJson(transcribeMetaPath(dir));

/**
 * talk.srt 的来源：'auto' 自动转写、没改过 / 'auto-edited' 自动转写后用户改过 / 'user' 用户自己放的 / 'none' 没有 talk.srt。
 */
export const srtSourceOf = (dir) => {
  const srt = path.join(dir, 'talk.srt');
  if (!fs.existsSync(srt)) return 'none';
  const meta = readTranscribeMeta(dir);
  if (!meta?.srtSha256) return 'user';
  return sha256Text(fs.readFileSync(srt, 'utf8')) === meta.srtSha256 ? 'auto' : 'auto-edited';
};

const relaunchArgs = (dir, o) => {
  const a = [SELF, dir, '--lang', o.lang, '--engine', o.engine];
  if (o.terms.length) a.push('--terms', o.terms.join(','));
  if (!o.fix) a.push('--no-fix');
  if (o.force) a.push('--force');
  return a;
};

const fail = (exitCode, message) => ({ok: false, exitCode, message});

/**
 * 转写一个项目目录。不会调 process.exit，失败返回 {ok:false, exitCode, message}。
 * @param {string} dir 项目目录（里面有 talk.mp4）
 * @param {{lang?: string, terms?: string|string[], fix?: boolean, force?: boolean, engine?: string, model?: string,
 *          log?: (s: string) => void, env?: object, llm?: (messages: Array) => Promise<{content: string}>, llmModel?: string,
 *          fetchImpl?: typeof fetch, now?: () => Date}} [opts]
 * @returns {Promise<object>} 见文件末尾的说明
 */
export const transcribeProject = async (dir, opts = {}) => {
  const log = opts.log || console.log;
  const env = opts.env || process.env;
  const o = {
    lang: opts.lang || 'auto',
    engine: opts.engine || 'local',
    model: opts.model || DEFAULT_MODEL,
    fix: opts.fix !== false,
    force: Boolean(opts.force),
    terms: parseTerms(opts.terms ?? []),
  };
  const now = opts.now || (() => new Date());
  dir = path.resolve(String(dir || ''));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return fail(2, `找不到项目目录 ${dir}`);
  if (!LANGS.includes(o.lang)) return fail(2, `--lang 只能是 ${LANGS.join('、')}（一般用 auto；普通话被认成粤语、日语时用 zh）。`);
  if (!ENGINES.includes(o.engine)) return fail(2, `--engine 现在只有 local（本地 SenseVoice）。`);
  if (!MODELS[o.model]) return fail(2, `没有叫 ${o.model} 的转写模型。现在只有 ${Object.keys(MODELS).join('、')}。`);

  const srtPath = path.join(dir, 'talk.srt');
  const fixesPath = path.join(dir, 'talk.fixes.txt');
  if (fs.existsSync(srtPath) && !o.force) {
    return {ok: true, status: 'kept', srtPath, message: '已有 talk.srt，不会覆盖你改过的字幕；要重转加 --force。'};
  }
  const talk = path.join(dir, 'talk.mp4');
  if (!fs.existsSync(talk)) return fail(2, '项目目录缺少 talk.mp4。把口播视频改名为 talk.mp4 放进项目目录；或者自己放一个 talk.srt。');
  const terms = parseTerms([...o.terms, ...readTermsFile(dir)]);

  const cacheDir = path.join(dir, '.brewreel');
  fs.mkdirSync(cacheDir, {recursive: true});
  log('转写 1/3：读视频…');
  const sha = await sha256Stream(talk);
  const cachePath = asrCachePath(dir, sha, o.model, o.lang);
  const warnings = [];
  let asr = readJson(cachePath);
  let cacheHit = validAsr(asr);
  if (cacheHit) {
    log(`  用缓存里的逐字时间（${path.basename(cachePath)}），不重新识别`);
  } else {
    asr = null;
    let media = null;
    try {
      media = probeMedia(talk);
    } catch {
      media = null; // 读不到也不拦，交给 ffmpeg 抽音频时报错
    }
    if (media && !media.hasAudio) return fail(4, 'talk.mp4 里没有声音轨道。检查剪辑软件的导出设置（要带音频），或者自己放一个 talk.srt。');
    if (media && media.durationSec > 600) {
      log(`  视频 ${(media.durationSec / 60).toFixed(1)} 分钟，转写预计约 ${Math.round(media.durationSec * 0.1 + 6)} 秒`);
    }
    const wav = path.join(os.tmpdir(), `brewreel-asr-${sha.slice(0, 16)}-${process.pid}.wav`);
    try {
      log('转写 2/3：抽音频、找停顿…');
      try {
        extractWav(talk, wav);
      } catch (e) {
        return fail(4, e.message);
      }
      const wavSec = Math.max(0, (fs.statSync(wav).size - 44) / 32000);
      const silences = detectSilences(wav, wavSec);
      let files;
      try {
        files = await ensureModel(o.model, {env, log, fetchImpl: opts.fetchImpl});
      } catch (e) {
        return fail(4, e.message);
      }
      log('转写 3/3：本地识别（SenseVoice）…');
      let rec;
      try {
        rec = recognizeWav({wavPath: wav, silences, files, lang: o.lang, log});
      } catch (e) {
        if (e instanceof AsrRuntimeError && e.code === 'NEED_LIBPATH' && !env.BREWREEL_ASR_RELAUNCHED) {
          // mac / Linux：原生库要在进程启动时就设好库路径，只能带着环境变量重新启动一次自己
          log(`  设置 ${e.libVar} 后重新启动一次转写…`);
          const childEnv = {...env, [e.libVar]: [e.libDir, env[e.libVar]].filter(Boolean).join(path.delimiter), BREWREEL_ASR_RELAUNCHED: '1'};
          const r = spawnSync(process.execPath, relaunchArgs(dir, o), {env: childEnv, stdio: 'inherit'});
          if (r.status === 0 && fs.existsSync(srtPath)) return {ok: true, status: 'written', relaunched: true, srtPath, fixesPath};
          return fail(r.status || 4, `重新启动后转写仍然失败。${e.message}也可以自己放一个 talk.srt。`);
        }
        return fail(4, e instanceof AsrRuntimeError ? e.message : `转写失败：${e?.message || e}。可以自己放一个 talk.srt。`);
      }
      if (!rec.tokens.some((t) => String(t).trim())) {
        return fail(4, '一个字都没识别出来。检查视频音量（是不是静音、声音太小或全是背景音乐），或者自己放一个 talk.srt。');
      }
      asr = {
        version: CACHE_VERSION,
        engine: o.engine,
        model: o.model,
        lang: o.lang,
        detected: rec.detected,
        chunkLangs: rec.chunkLangs,
        audioSec: rec.audioSec,
        chunks: rec.chunks,
        breaks: rec.breaks,
        silences,
        tokens: rec.tokens,
        times: rec.times,
      };
      fs.writeFileSync(cachePath, JSON.stringify(asr), 'utf8');
    } finally {
      fs.rmSync(wav, {force: true});
    }
  }

  const odd = [...new Set([asr.detected, ...(asr.chunkLangs || [])])].filter((l) => ['ja', 'ko', 'yue'].includes(l));
  if (o.lang === 'auto' && odd.length) {
    warnings.push(`识别出的语种里有${odd.map((l) => LANG_NAME[l]).join('、')}。如果说的是普通话，加 --lang zh --force 重跑。`);
  }
  const {mode, cues: raw} = cuesFromAsr(asr, {lang: o.lang});
  if (!raw.length) return fail(4, '识别结果切不出句子。检查视频音量，或者自己放一个 talk.srt。');
  if (raw.some((c) => /[0-9]/.test(c.text))) warnings.push('字幕里有阿拉伯数字（识别器会把「三块五」这类说法转成数字），看一眼对不对。');

  // 校对层
  let fix;
  if (!o.fix) fix = {status: 'off', cues: raw, applied: [], hints: []};
  else if (!opts.llm && !hasLlmKey(env)) fix = {status: 'nokey', cues: raw, applied: [], hints: []};
  else {
    const cfg = opts.llm ? {model: opts.llmModel || 'test'} : readLlmEnv(env);
    const llm = opts.llm || ((messages) => callLlm(messages, cfg, {temperature: 0, timeoutMs: 90_000, log}));
    log(`校对：请 ${cfg.model} 找听错的字（只收补丁，脚本按读音决定改不改）…`);
    fix = await runFix({cues: raw, terms, cacheDir, llm, model: cfg.model, log});
    fix.model = cfg.model;
  }

  const finalCues = fix.cues.map((c) => ({...c, text: layoutText(c.text, mode)}));
  const srtText = toSrt(finalCues);
  let back;
  try {
    back = parseSrt(srtText);
  } catch (e) {
    return fail(4, `生成的字幕读不回来（${e.message}）。这是脚本的错，请把 .brewreel/ 里的 asr-*.json 发给维护者。`);
  }
  if (back.length !== finalCues.length) return fail(4, '生成的字幕句数对不上。这是脚本的错，请把 .brewreel/ 里的 asr-*.json 发给维护者。');

  const backupPath = fs.existsSync(srtPath) ? backupSrt(srtPath, now()) : null;
  fs.writeFileSync(srtPath, srtText, 'utf8');
  fs.writeFileSync(fixesPath, formatFixesTxt({fix, notes: warnings}), 'utf8');
  const meta = {
    version: 1,
    engine: o.engine,
    model: o.model,
    lang: o.lang,
    detected: asr.detected,
    mode,
    cues: finalCues.length,
    srtSha256: sha256Text(srtText),
    talkSha256: sha,
    cache: path.basename(cachePath),
    fix: {status: fix.status, model: fix.model || '', applied: fix.applied.length, hints: fix.hints.length},
    at: now().toISOString(),
  };
  fs.writeFileSync(transcribeMetaPath(dir), JSON.stringify(meta, null, 2), 'utf8');
  return {
    ok: true,
    status: 'written',
    srtPath,
    fixesPath,
    backupPath,
    cachePath,
    cacheHit,
    model: o.model,
    lang: o.lang,
    detected: asr.detected || '',
    mode,
    cueCount: finalCues.length,
    audioSec: asr.audioSec,
    terms,
    fix: {status: fix.status, model: fix.model || '', reason: fix.reason || '', applied: fix.applied, hints: fix.hints},
    warnings,
  };
};

export const parseArgs = (argv) => {
  const o = {lang: 'auto', terms: '', fix: true, force: false, engine: 'local'};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-fix') o.fix = false;
    else if (a === '--force') o.force = true;
    else if (a === '--lang' || a === '--terms' || a === '--engine') {
      const v = argv[i + 1];
      if (v == null || v.startsWith('--')) return {error: `${a} 后面要有值`};
      o[a.slice(2)] = v;
      i += 1;
    } else if (a === '-h' || a === '--help') return {help: true};
    else if (a.startsWith('--')) return {error: `不认识的参数 ${a}`};
    else pos.push(a);
  }
  if (pos.length !== 1) return {error: pos.length ? '只能给一个项目目录' : ''};
  return {dir: pos[0], opts: o};
};

const main = async () => {
  const p = parseArgs(process.argv.slice(2));
  if (p.help) {
    console.log(usage());
    return 0;
  }
  if (p.error != null) {
    if (p.error) console.log(p.error);
    console.log(usage());
    return 2;
  }
  const t0 = Date.now();
  const r = await transcribeProject(p.dir, p.opts);
  if (!r.ok) {
    console.log(r.message);
    return r.exitCode;
  }
  if (r.status === 'kept') {
    console.log(r.message);
    return 0;
  }
  if (r.relaunched) return 0;
  const dirShown = path.dirname(r.srtPath);
  console.log(`写好 talk.srt：${r.cueCount} 句，${(r.audioSec || 0).toFixed(1)} 秒音频，语种 ${LANG_NAME[r.detected] || r.detected || '未知'}（用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒${r.cacheHit ? '，用了缓存' : ''}）`);
  if (r.backupPath) console.log(`旧字幕已改名为 ${path.basename(r.backupPath)}`);
  const f = r.fix;
  if (f.status === 'done' || f.status === 'cached') console.log(`校对：自动改 ${f.applied.length} 处，只提示 ${f.hints.length} 处（详见 talk.fixes.txt）`);
  else if (f.status === 'skipped') console.log(`校对没做成，字幕是原始转写，可以自己改 talk.srt（${f.reason}）`);
  else if (f.status === 'nokey') console.log('没有 LLM_API_KEY / DEEPSEEK_API_KEY，没做校对。字幕是原始转写，可以自己改 talk.srt。');
  for (const h of f.hints) {
    if (h.kind === 'doubt') console.log(`  请听一下原片 ${h.cue}：「${h.text}」拿不准（${h.why}）`);
    else console.log(`  请听一下原片 ${h.cue}：「${h.from}」可能是「${h.to}」（${h.why}）`);
  }
  for (const w of r.warnings) console.log(`提醒：${w}`);
  console.log('可以打开 talk.srt 改错字；不要拆句、并句（句子号会错位）。');
  console.log(`下一步：node scripts/broll/llm_broll.mjs "${dirShown}"（或一条命令 node scripts/talk.mjs "${dirShown}" --out <输出目录>）`);
  return 0;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SELF;
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.log(`转写失败：${e?.message || e}`);
      process.exit(4);
    },
  );
}

// transcribeProject 的返回：
//   {ok:false, exitCode:2|4, message}
//   {ok:true, status:'kept', srtPath, message}                         已有 talk.srt，没动
//   {ok:true, status:'written', relaunched:true, srtPath, fixesPath}     mac/Linux 重启子进程转写成功（细节已由子进程打印）
//   {ok:true, status:'written', srtPath, fixesPath, backupPath|null, cachePath, cacheHit, model, lang, detected, mode,
//    cueCount, audioSec, terms, fix:{status:'done'|'cached'|'skipped'|'off'|'nokey', model, reason, applied[], hints[]}, warnings[]}
