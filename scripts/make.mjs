#!/usr/bin/env node
// ============================================================
// 一条命令出片：校验 → 机器自查 → 复制素材 → 配音 → 配乐 → 渲染（带布局 / 汉字探针）→ 拼图 + 检查帧 → manifest.json
//   node scripts/make.mjs <storyboard.json> (--out <目录> | --round <轮次> [--slug <片名>]) [--stills 0,1.5,6] [--no-bgm] [--no-voice] [--voice-provider mock] [--keep] [--queue-timeout 20]
//   node scripts/make.mjs <storyboard.json> (--out <目录> | --round ...) --verify     核对目录里的成片是否还对应这份分镜
//     --out      输出目录（一个目录放一份分镜，否则输出会互相覆盖）。不许落在仓库里（promo/ 除外），否则退出码 2；
//                人工确认过可加 --allow-in-repo
//     --brief    简报文件路径：逐条核对 meta.facts 的数字 / quote 是否出自简报（文件不存在直接退出码 2）
//     --round    测试用：产物放到【仓库外】<仓库同级>/promo-video-skill-tests/<轮次>/<片名>/（设 PROMO_TEST_DIR 可换根目录）；
//                片名默认取 storyboard 所在目录名，文件名不是 storyboard.json 时取文件名。开跑第一行会打印实际输出目录。
//                --out 和 --round 必须给一个；不要自己按秒生成时间戳目录
//     --stills   只渲染这些时间点（秒）的单帧到 <out>/check/，不出整片（镜头自测用，快；不是交付）
//     --no-bgm   不生成配乐（静音）
//     --no-voice 分镜写了 meta.voice 也不配音（镜头时长按分镜、没有旁白和旁白字幕），临时出无配音版用
//     --voice-provider <minimax|aliyun|volcengine|mock>  这一次出片临时换配音提供者，不改分镜文件（换到别家时分镜里的
//                voiceId / model / emotion 不带过去，用那家的默认值）。没有 key 时用 --voice-provider mock
//                预览节奏（不联网的占位音，时间轴和字幕照常；分镜没写 meta.voice 时忽略）
//     --keep     保留 template/public/_run/<id>/（调试用）
//
// 配音（分镜写了 meta.voice 且有镜头写了 vo 时才有这一步；老分镜行为不变）：
//   每句旁白先合成（scripts/lib/tts/，按 provider+model+voiceId+speed+emotion+text 缓存在仓库和输出目录之外，
//   默认 ~/.cache/brewreel/tts，BREWREEL_TTS_CACHE 可改）→ 有旁白的镜头时长改成「0.15 秒 + 旁白 + 0.35 秒」向上取整拍
//   → 按新时长再校验一遍 → voice.json 作为 props.voice 传给 Remotion，配乐在人声处自动压低（闪避做进 bgm.wav）。
//   key 只从环境变量读，不写进任何文件和日志：MiniMax = MINIMAX_API_KEY（MINIMAX_BASE_URL / MINIMAX_GROUP_ID 可选）；
//   阿里云 = DASHSCOPE_API_KEY（DASHSCOPE_WORKSPACE_ID / DASHSCOPE_REGION / DASHSCOPE_TTS_URL 可选）；
//   火山引擎 = VOLCENGINE_TTS_API_KEY 或 VOLCENGINE_TTS_APP_ID + VOLCENGINE_TTS_ACCESS_TOKEN（VOLCENGINE_TTS_BASE_URL 可选）。
//   配音失败：旁白比镜头最长时长还长 → 退出码 1；没 key / 鉴权失败 / 限流重试用完 / 网络不通 → 退出码 2（改配置或稍后再跑，
//   想先看效果加 --voice-provider mock，或加 --no-voice）
//     --queue-timeout <分钟>  渲染排队最多等多久（默认 20），超时写「未出片：渲染排队超时」，退出码 5
//     --accept-layout         仅供人工复核后放行版式 ✗（manifest 里记 acceptedByHuman），模型 / 自动测试不许用
//
// 交付规则（模型和测试脚本都按这个判断成没成）：
//   - 开跑先清掉输出目录里上一次 make 的产物（video.mp4、sheet.png、check/*.png、layout.json、report.txt、manifest.json…），别的文件不动
//   - 机器自查 / 文字排版 / 布局自查 / 英文片汉字扫描 / 空帧检查（成片逐帧：整屏 95% 以上一个颜色连续超过 6 帧），任何一项有 ✗ 都不交付：退出码 3，打印「未通过，不能交付」，
//     成片改名 video.rejected.mp4、拼图改名 sheet.rejected.png（留着给人看哪里坏了）
//   - 成功时写 manifest.json（分镜 sha256、mp4 sha256 / 时长 / 大小、生成时间、各项检查结论），
//     stdout 最后一行「交付：<mp4 路径>」，report.txt 最后一行「成片：OK <mp4 路径>」；失败时 report.txt 最后一行「成片：无（原因）」。
//     报告里的 mp4 路径只能抄这两行或 manifest.json；没有「交付：」这一行就是没出片。
// 退出码：0 交付 / 1 分镜校验没过 / 2 参数错 / 3 有 ✗ 不能交付 / 4 渲染失败或没出 mp4 / 5 渲染排队超时 / 6 内部错误 / 130 被中断
// 并发：可以同时开多个实例。Remotion 这一步用 template/.render.lock 串行（打印「排队中」和剩余等待时间）；
//       锁里记 pid + 心跳，持锁进程死了或心跳停 15 分钟会被自动回收。
// 拼图 sheet.png 用 Remotion 的 Sheet 合成出（不需要系统 ffmpeg）；设了 FFMPEG 环境变量时先用 ffmpeg 的 tile 滤镜拼，失败再退回 Sheet。
// ============================================================
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TEMPLATE, formatReport, loadSpecs, parseFile, schedule, validate} from './validate.mjs';
import {PROVIDER_IDS, voiceConfigOf} from './lib/tts/index.mjs';
import {runVoiceStep, voiceIntervals, voOf} from './lib/tts/pipeline.mjs';
import {clearStaleOutputs, mp4Duration, sha256Of, verifyDelivery, writeManifest} from './lib/delivery.mjs';
import {blankRuns} from './lib/blank-check.mjs';
import {layoutCheck, parseProbeLog} from './lib/layout-check.mjs';
import {hasCross, machineCheck, reportTextWrap} from './lib/precheck.mjs';
import {QueueTimeoutError, acquireRenderLock, pidAlive} from './lib/render-lock.mjs';
import {DEFAULT_STYLE, aspectOf, bpmOf, geometryOf, loadStyle, specsForStyle, styleIdOf} from './lib/styles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const LOCK = path.join(TEMPLATE, '.render.lock');
const FPS = 30;
// Windows 的 python.org 安装默认叫 python；macOS/Linux 通常只有 python3。PYTHON 环境变量可覆盖。
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const EXIT = {OK: 0, INVALID: 1, USAGE: 2, REJECTED: 3, RENDER: 4, QUEUE: 5, INTERNAL: 6, INTERRUPTED: 130};

const t0 = Date.now();
const startedAt = new Date().toISOString();
const log = (...a) => console.log(`[make ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s]`, ...a);

// ---------------- 参数 ----------------
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const VALUED = ['--out', '--stills', '--round', '--slug', '--queue-timeout', '--brief', '--voice-provider'];
const USAGE = '用法：node scripts/make.mjs <storyboard.json> (--out <目录> | --round <轮次> [--slug <片名>]) [--stills 0,1.5] [--no-bgm] [--no-voice] [--voice-provider mock] [--keep] [--queue-timeout 20] [--verify]';
const sbFile = argv.find((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
if (!sbFile) {
  console.log(USAGE);
  process.exit(EXIT.USAGE);
}
const sbPath = path.resolve(sbFile);
if (!fs.existsSync(sbPath)) {
  console.log(`找不到分镜文件：${sbPath}\n${USAGE}`);
  process.exit(EXIT.USAGE);
}
const round = opt('--round');
if (!opt('--out') && !round) {
  console.log('缺少输出位置：正式出片用 --out <目录>；测试用 --round <轮次>（产物放仓库外的 promo-video-skill-tests/<轮次>/<片名>/，同一轮的几支片子放同一个轮次目录，不要按秒生成时间戳目录）');
  process.exit(EXIT.USAGE);
}
const slugOf = () => {
  const b = path.basename(sbPath, path.extname(sbPath));
  const raw = opt('--slug') ?? (b.toLowerCase() === 'storyboard' ? path.basename(path.dirname(sbPath)) : b);
  return raw.replace(/[^A-Za-z0-9_.-]/g, '_') || 'video';
};
// 测试产物一律放仓库外，不进开源树
const TESTS_ROOT = process.env.PROMO_TEST_DIR ? path.resolve(process.env.PROMO_TEST_DIR) : path.resolve(ROOT, '..', 'promo-video-skill-tests');
const outDir = path.resolve(opt('--out') ?? path.join(TESTS_ROOT, String(round).replace(/[^A-Za-z0-9_.-]/g, '_'), slugOf()));
const stills = opt('--stills')
  ?.split(',')
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isFinite(x) && x >= 0);
// --brief 传的是简报文件路径；validate() 要的是简报原文，这里读出来再传（读不到就直接停，不静默跳过核对）
let briefText;
if (opt('--brief')) {
  const briefPath = path.resolve(opt('--brief'));
  if (!fs.existsSync(briefPath)) {
    console.log(`--brief 指定的简报文件不存在：${briefPath}\n${USAGE}`);
    process.exit(EXIT.USAGE);
  }
  briefText = fs.readFileSync(briefPath, 'utf8').replace(/^﻿/, '');
}
// 输出目录不许落在仓库里（仓库已公开，一次 git add -A 就会把 mp4 带上去）。
// 例外：已被 .gitignore 忽略的 promo/；人手动确认过可加 --allow-in-repo。
{
  const rel = path.relative(ROOT, outDir);
  const inRepo = !rel.startsWith('..') && !path.isAbsolute(rel);
  const inPromo = inRepo && (rel === 'promo' || rel.startsWith(`promo${path.sep}`));
  if (inRepo && !inPromo && !argv.includes('--allow-in-repo')) {
    console.log(`输出目录在仓库里面：${outDir}\n测试 / 渲染产物请放仓库外：--out 给仓库外的绝对路径，或用 --round <轮次>（默认放仓库外的 promo-video-skill-tests/）。确需放仓库内请加 --allow-in-repo。\nOutput folder is inside the repo; pass an absolute --out outside it, or use --round.`);
    process.exit(EXIT.USAGE);
  }
}
if (opt('--stills') !== undefined && !stills?.length) {
  console.log(`--stills 要给秒数，逗号分隔，如 --stills 0,1.5,6\n${USAGE}`);
  process.exit(EXIT.USAGE);
}
const noBgm = argv.includes('--no-bgm');
const noVoice = argv.includes('--no-voice');
const voiceProvider = opt('--voice-provider');
if (voiceProvider !== undefined && !PROVIDER_IDS.includes(voiceProvider)) {
  console.log(`--voice-provider 只能是 ${PROVIDER_IDS.join(' / ')}（没有 key 时用 mock 预览）\n${USAGE}`);
  process.exit(EXIT.USAGE);
}
const keep = argv.includes('--keep');
const acceptLayout = argv.includes('--accept-layout');
const queueMin = Number(opt('--queue-timeout') ?? 20);
if (!Number.isFinite(queueMin) || queueMin <= 0) {
  console.log(`--queue-timeout 要给正数（分钟）\n${USAGE}`);
  process.exit(EXIT.USAGE);
}

// ---------------- --verify：只核对，不出片 ----------------
if (argv.includes('--verify')) {
  const v = verifyDelivery(outDir, sbPath);
  console.log(`核对 ${outDir}：\n${v.lines.join('\n')}`);
  console.log(v.ok ? '核对通过：成片对应当前分镜，可以交付' : '✗ 成片和分镜不一致或没有可交付的成片，请重跑 make');
  process.exit(v.ok ? EXIT.OK : EXIT.REJECTED);
}

// ---------------- 0. 输出目录：建好、清掉上一次的产物 ----------------
const reportFile = path.join(outDir, 'report.txt');
const videoPath = path.join(outDir, 'video.mp4');
const checkDir = path.join(outDir, 'check');
let sbSha = null;
try {
  sbSha = sha256Of(fs.readFileSync(sbPath));
  fs.mkdirSync(checkDir, {recursive: true});
  const removed = clearStaleOutputs(outDir, [sbPath]);
  // 上一次配音留下的 voice.json（只删 make 自己写的那种）
  try {
    const vj = path.join(outDir, 'voice.json');
    if (fs.existsSync(vj) && /"lines"/.test(fs.readFileSync(vj, 'utf8')) && /"provider"/.test(fs.readFileSync(vj, 'utf8'))) fs.rmSync(vj, {force: true});
  } catch {}
  log(`输出目录：${outDir}${removed.length ? `（已清掉上一次的产物 ${removed.length} 个）` : ''}`);
} catch (e) {
  console.error(`未出片：输出目录准备失败——${e.message}\nNot delivered: could not prepare the output folder (${e.message})`);
  process.exit(EXIT.INTERNAL);
}

// 顺手清掉 template/public/_run 里崩掉的旧任务留下的素材目录（目录名末尾是 pid；进程已不在且超过 2 小时）
try {
  const runRoot = path.join(TEMPLATE, 'public', '_run');
  for (const d of fs.existsSync(runRoot) ? fs.readdirSync(runRoot) : []) {
    const pid = Number(/-(\d+)$/.exec(d)?.[1]);
    const abs = path.join(runRoot, d);
    if (pid && !pidAlive(pid) && Date.now() - fs.statSync(abs).mtimeMs > 2 * 3600 * 1000) fs.rmSync(abs, {recursive: true, force: true});
  }
} catch {}

// ---------------- 收尾：所有出口都走这里（报告最后一行 + manifest + 退出码） ----------------
const state = {runDir: null, lock: null, child: null, finishing: false, video: null, sheet: null, checkFrames: [], checks: {}, voice: null};
const cleanupRun = () => {
  if (state.runDir && !keep) {
    try {
      fs.rmSync(state.runDir, {recursive: true, force: true});
    } catch {}
  }
};
const finish = (status, code, reason = null, reasonEn = null) => {
  if (state.finishing) process.exit(code);
  state.finishing = true;
  try {
    state.child?.kill();
  } catch {}
  state.lock?.release();
  cleanupRun();
  const delivered = status === 'delivered';
  // 只有交付的成片叫 video.mp4；失败时留下的半成品 / 时长不对的成片改名，免得被当成交付物引用
  if (!delivered && fs.existsSync(videoPath)) {
    try {
      fs.renameSync(videoPath, path.join(outDir, 'video.rejected.mp4'));
      if (state.video?.path === videoPath) state.video.path = path.join(outDir, 'video.rejected.mp4');
    } catch {}
  }
  const manifest = {
    status,
    exitCode: code,
    reason,
    storyboard: {source: sbPath, sha256: sbSha, copy: fs.existsSync(path.join(outDir, 'storyboard.json')) ? path.join(outDir, 'storyboard.json') : null},
    video: state.video,
    sheet: state.sheet,
    checkFrames: state.checkFrames,
    checks: state.checks,
    // 配音记录：provider / voiceId / 各句时长 / 缓存命中 / 计费字符数（不含任何密钥）；没配音时为 null
    voice: state.voice,
    outDir,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  let manifestPath = null;
  try {
    manifestPath = writeManifest(outDir, manifest);
  } catch {}
  const last = delivered ? `成片：OK ${state.video.path}` : `成片：无（${reason}）`;
  try {
    fs.appendFileSync(reportFile, `${manifestPath ? `交付清单：${manifestPath}\n` : ''}${last}\n`, 'utf8');
  } catch {}
  if (delivered) {
    log(`完成：
  成片     ${state.video.path}（${state.video.durationSec?.toFixed(2) ?? '?'} 秒）
  拼图     ${state.sheet ?? '（没生成，见上面的提示）'}
  检查帧   ${checkDir}
  交付清单 ${manifestPath}`);
    console.log(`交付：${state.video.path}`);
  } else if (status === 'stills') {
    console.log(`单帧：${checkDir}（--stills 只出单帧，不是成片，不能交付）`);
  } else {
    console.log(`${status === 'rejected' ? '未通过，不能交付' : '未出片'}：${reason}${reasonEn ? `\nNot delivered: ${reasonEn}` : ''}`);
    if (manifestPath) console.log(`（详情见 ${reportFile}；状态记在 ${manifestPath}）`);
  }
  process.exit(code);
};
process.on('uncaughtException', (e) => finish('failed', EXIT.INTERNAL, `内部错误：${e?.message ?? e}`, `internal error: ${e?.message ?? e}`));
process.on('unhandledRejection', (e) => finish('failed', EXIT.INTERNAL, `内部错误：${e?.message ?? e}`, `internal error: ${e?.message ?? e}`));
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  try {
    process.on(sig, () => finish('failed', EXIT.INTERRUPTED, `被中断（${sig}）`, `interrupted (${sig})`));
  } catch {}
}
process.on('exit', () => state.lock?.release());

// ---------------- 1. 校验 ----------------
const parsed = parseFile(sbPath);
// --voice-provider：只换这一次出片的配音提供者（分镜文件不动；缓存键含 provider，mock 和真接口的音频不会串）
if (voiceProvider && !parsed.error) {
  const mv = parsed.sb?.meta?.voice;
  if (mv && typeof mv === 'object' && !Array.isArray(mv)) {
    if (mv.provider !== voiceProvider) log(`按 --voice-provider 临时改用 ${voiceProvider} 配音（分镜里写的是 ${mv.provider ?? '（没写）'}）`);
    if (mv.provider !== voiceProvider) {
      // 各家的模型名、音色 id 互不通用；情绪只有 MiniMax 认。换家就用那家的默认值
      delete mv.model;
      if (voiceProvider !== 'mock') delete mv.voiceId;
      if (voiceProvider !== 'minimax') delete mv.emotion;
    }
    mv.provider = voiceProvider;
  } else log('--voice-provider 被忽略：分镜没写 meta.voice（不配音）');
}
const r = parsed.error ? {errors: [parsed.error], warnings: [], slots: [], total: 0, beat: 0.5, assets: []} : validate(parsed.sb, {baseDir: path.dirname(sbPath), brief: briefText});
r.sb = parsed.sb;
const report = formatReport(r, sbFile);
console.log(report);
fs.writeFileSync(reportFile, report + '\n', 'utf8');
state.checks.validate = {errors: r.errors.length, warnings: r.warnings.length, human: r.human?.length ?? 0};
if (r.errors.length) finish('failed', EXIT.INVALID, `分镜校验没过（${r.errors.length} 个错误，见 report.txt 开头）`, `storyboard validation failed (${r.errors.length} errors)`);
const lang = parsed.sb.meta?.lang === 'en' ? 'en' : 'zh';

// ---------------- 1b. 机器自查 + 文字排版（不靠模型自评） ----------------
// 风格 / 画幅：cards（默认）用公共镜头，和改造前一样；其他风格用专属镜头 + 允许复用的公共镜头
const styleId = styleIdOf(parsed.sb.meta);
const specs = styleId === DEFAULT_STYLE ? loadSpecs() : specsForStyle(loadStyle(styleId), loadSpecs());
const geo = geometryOf(aspectOf(parsed.sb.meta));
if (styleId !== DEFAULT_STYLE) log(`风格 ${styleId}，画幅 ${aspectOf(parsed.sb.meta)}（${geo.w}x${geo.h}）`);
const mc = machineCheck(parsed.sb, r);
const tw = reportTextWrap(parsed.sb, specs);
fs.appendFileSync(reportFile, `机器自查（make.mjs 自动做，不靠模型自评）：\n${mc.join('\n')}\n文字排版报告（模拟换行，按安全区行宽 780px / 正文下限 40px 粗估，不是逐镜头像素级校验）：\n${tw.join('\n')}\n`, 'utf8');
console.log(`机器自查：\n${mc.join('\n')}`);
console.log(`文字排版报告：\n${tw.join('\n')}`);
const preBad = [...mc, ...tw].filter((l) => /^\s*✗/.test(l)).map((l) => l.trim().replace(/^✗\s*/, ''));
state.checks.machine = {ok: !hasCross(mc), issues: mc.filter((l) => /^\s*✗/.test(l)).map((l) => l.trim())};
state.checks.textWrap = {ok: !hasCross(tw), issues: tw.filter((l) => /^\s*✗/.test(l)).map((l) => l.trim())};
if (preBad.length && !stills && !acceptLayout) {
  finish('rejected', EXIT.REJECTED, `机器自查 / 文字排版有 ${preBad.length} 处 ✗，没有渲染：${preBad.slice(0, 3).join('；')}`, `${preBad.length} pre-render check(s) failed; nothing was rendered`);
}

// ---------------- 2. 素材复制到 template/public/_run/<id>/ ----------------
const base = path.basename(sbPath, path.extname(sbPath)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 24) || 'sb';
const id = `${base}-${Date.now().toString(36)}-${process.pid}`;
const runDir = path.join(TEMPLATE, 'public', '_run', id);
fs.mkdirSync(runDir, {recursive: true});
state.runDir = runDir;
const sb = JSON.parse(JSON.stringify(parsed.sb));
const map = new Map();
r.assets.forEach((a, k) => {
  if (map.has(a.rel)) return;
  const name = `${k}-${path.basename(a.abs).replace(/[^A-Za-z0-9._-]/g, '_')}`;
  fs.copyFileSync(a.abs, path.join(runDir, name));
  map.set(a.rel, `_run/${id}/${name}`);
});
const rewrite = (v) => {
  if (typeof v === 'string') return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map(rewrite);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)]));
  return v;
};
sb.shots = rewrite(sb.shots);
if (sb.meta.logo) sb.meta.logo = map.get(sb.meta.logo) ?? sb.meta.logo;
log(`素材 ${map.size} 个 → template/public/_run/${id}/`);

// ---------------- 2b. 配音：先合成旁白、拿时间戳，再按声音定镜头时长（没写 meta.voice 的分镜跳过，行为不变） ----------------
let voice = null;
{
  const vcfg = voiceConfigOf(parsed.sb.meta);
  const voShots = parsed.sb.shots.filter((s) => voOf(s)).length;
  if (vcfg && voShots && noVoice) {
    log('按 --no-voice 不配音：镜头时长按分镜，没有旁白');
    state.checks.voice = {skipped: true, reason: '--no-voice'};
  } else if (vcfg && voShots) {
    log(`配音（${vcfg.provider}，音色 ${vcfg.voiceId}，${voShots} 句）…`);
    // 真接口给的 mp3 解码成 wav 再统一响度：用 Remotion 自带的 ffmpeg（设了 FFMPEG 就用它）
    const decode = (inFile, outWav) => {
      const a = ['-y', '-hide_banner', '-loglevel', 'error', '-i', inFile, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', outWav];
      const p = process.env.FFMPEG ? spawnSync(process.env.FFMPEG, a, {encoding: 'utf8'}) : spawnSync(process.execPath, [REMOTION, 'ffmpeg', ...a], {cwd: TEMPLATE, encoding: 'utf8'});
      return p.status === 0;
    };
    const vr = await runVoiceStep({sb, specs, beat: r.beat, schedule, runDir, runRel: `_run/${id}`, log, decode, captionLayer: styleId === DEFAULT_STYLE ? 'cards' : loadStyle(styleId)?.manifest?.captionLayer});
    if (!vr.ok) {
      const lines = (vr.errors ?? []).map((e, k) => `${k + 1}. ${e.where}：${e.problem}\n   → 怎么改：${e.fix}`);
      if (lines.length) console.log(`配音后镜头时长不合规：\n${lines.join('\n')}`);
      fs.appendFileSync(reportFile, `配音：未通过\n${lines.length ? lines.join('\n') : `  ✗ ${vr.message}`}\n`, 'utf8');
      state.checks.voice = {ok: false, issues: lines.length ? (vr.errors ?? []).map((e) => `${e.where}：${e.problem}`) : [vr.message]};
      finish('failed', vr.kind === 'invalid' ? EXIT.INVALID : EXIT.USAGE, vr.message, vr.messageEn);
    }
    // 按配音后的时长再校验一遍（总时长范围、字幕停留、单镜占比…），只看这一步新冒出来的问题
    const sbCheck = JSON.parse(JSON.stringify(parsed.sb));
    for (const c of vr.changes) {
      sbCheck.shots[c.i].dur = sb.shots[c.i].dur;
      delete sbCheck.shots[c.i].beats;
    }
    const r2 = validate(sbCheck, {baseDir: path.dirname(sbPath), brief: briefText});
    const seen = new Set(r.warnings.map((w) => `${w.where}|${w.problem}`));
    const ESTIMATE = /按常见语速估算/;
    const newWarn = r2.warnings.filter((w) => !seen.has(`${w.where}|${w.problem}`) && !ESTIMATE.test(w.problem));
    const changed = vr.changes.map((c) => `第 ${c.i + 1} 镜 ${c.from.toFixed(2)}→${c.to.toFixed(2)} 秒`);
    const hits = vr.manifest.cacheHits;
    const vLines = [
      `  ✓ ${vr.voice.lines.length} 句旁白（${vcfg.provider} / ${vcfg.voiceId} / 语速 ${vcfg.speed}），合成 ${vr.manifest.synthesized} 句、缓存命中 ${hits} 句${vr.manifest.billedCharacters ? `，本次计费 ${vr.manifest.billedCharacters} 字符` : ''}`,
      `  ✓ 镜头时长按旁白改写：${changed.join('；')}；全片 ${r.total.toFixed(2)} → ${r2.total.toFixed(2)} 秒`,
      ...vr.voice.lines.map((l) => `    第 ${l.shot + 1} 镜：旁白 ${(l.durMs / 1000).toFixed(2)} 秒（${l.granularity === 'sentence-interp' ? '字级时间按字数估算' : l.granularity === 'char' ? '逐字时间戳' : '逐词时间戳'}${l.subtitle ? `；${vcfg.subtitles === 'karaoke' ? '逐字字幕' : '整句字幕'}` : vcfg.subtitles === 'off' ? '；subtitles: off，不出旁白字幕' : '；不出旁白字幕：这一镜写了 caption 或是片尾，旁白只念'}）`),
      ...r2.errors.map((e) => `  ✗ ${e.where}：${e.problem}（${e.fix}）`),
      ...newWarn.map((w) => `  ! ${w.where}：${w.problem}（${w.fix}）`),
    ];
    console.log(`配音：\n${vLines.join('\n')}`);
    fs.appendFileSync(reportFile, `配音（镜头时长由旁白决定）：\n${vLines.join('\n')}\n`, 'utf8');
    state.voice = vr.manifest;
    if (r2.errors.length) {
      state.checks.voice = {ok: false, issues: r2.errors.map((e) => `${e.where}：${e.problem}`)};
      finish('failed', EXIT.INVALID, `配音后镜头时长变了，按新时长校验没过（${r2.errors.length} 个错误）：${r2.errors[0].where}：${r2.errors[0].problem}`, `storyboard fails validation after voice-over timing (${r2.errors.length} errors)`);
    }
    state.checks.voice = {ok: true, lines: vr.voice.lines.length, synthesized: vr.manifest.synthesized, cacheHits: hits};
    r.slots = r2.slots;
    r.total = r2.total;
    voice = vr.voice;
    sb.voice = voice;
  }
}

// ---------------- 3. 配乐 ----------------
const bgmScript = path.join(ROOT, 'scripts', 'make_bgm.py');
if (!noBgm && !stills && fs.existsSync(bgmScript)) {
  const bgmOut = path.join(runDir, 'bgm.wav');
  const args = [
    bgmScript,
    '--duration', r.total.toFixed(3),
    '--bpm', String(bpmOf(sb.meta)),
    '--theme', sb.meta.theme || 'warm-emotion',
    '--cues', JSON.stringify(r.slots.map((s) => Number(s.start.toFixed(3)))),
    '--moods', JSON.stringify(sb.shots.map((s) => (typeof s.mood === 'number' ? s.mood : specs[s.type]?.mood ?? 0.5))),
    '--types', JSON.stringify(r.slots.map((s) => s.type)),
    '--out', bgmOut,
  ];
  // 配乐闪避：人声区间交给 make_bgm.py，在母带之后把人声段整体压低（做进 bgm.wav，Remotion 不再另压）
  if (voice?.lines?.length)
    args.push('--voice', JSON.stringify(voiceIntervals(voice)), '--duck-db', String(voice.duck.db), '--duck-attack', String(voice.duck.attackMs / 1000), '--duck-release', String(voice.duck.releaseMs / 1000));
  log('生成配乐…');
  const p = spawnSync(PY, args, {cwd: ROOT, encoding: 'utf8', env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}});
  if (p.status === 0 && fs.existsSync(bgmOut)) {
    sb.bgm = `_run/${id}/bgm.wav`;
    fs.copyFileSync(bgmOut, path.join(outDir, 'bgm.wav'));
    if (voice) {
      voice.duck.baked = /闪避/.test(p.stdout || '');
      if (state.voice) state.voice.bgmDucked = voice.duck.baked;
    }
    log(`配乐 OK${voice ? (voice.duck.baked ? `（人声处压低 ${-voice.duck.db} dB）` : '（⚠ 配乐脚本没做闪避）') : ''}`);
  } else log(`配乐失败，改为静音：${(p.stderr || p.error?.message || '').trim().split('\n').slice(-3).join(' | ')}`);
} else if (!stills) log(noBgm ? '按 --no-bgm 静音' : '没有 scripts/make_bgm.py，静音');
if (voice) fs.writeFileSync(path.join(outDir, 'voice.json'), JSON.stringify(voice, null, 1), 'utf8');

// ---------------- 探针帧 ----------------
// 检查帧：第 0 帧 + 每镜「结束前 0.45 秒」（此时本镜动画已演完、还没开始退场）——版式在这些帧上判。
// 镜头 spec 写了 checkBeat 的，改抽「本镜第 checkBeat 拍」：一镜到底的风格里主要信息在镜中间就收起了
// （journey 每站的明信片在镜头中段就寄出收起，镜尾那一帧上根本没有它），要在它停稳的时刻查
const lastFrame = Math.max(0, Math.round(r.total * FPS) - 1);
const frameOf = (sec) => Math.min(Math.round(sec * FPS), lastFrame);
const checkSecOf = (s) => {
  const cb = specs[s.type]?.checkBeat;
  if (typeof cb === 'number' && cb > 0) return Math.min(s.end - 0.1, s.start + cb * r.beat);
  return Math.max(s.start + s.dur / 2, s.end - 0.45);
};
const checkTimes = [0, ...r.slots.map(checkSecOf)];
const checkFrames = stills ? stills.map(frameOf) : checkTimes.map(frameOf);
// 英文片的汉字扫描：每半拍一帧（覆盖每一拍）+ 每镜 25% / 50% / 75%，组件在任何一拍冒出的写死中文都能抓到
const hanFrames = new Set(checkFrames);
if (lang === 'en' && !stills) {
  const step = r.beat / 2;
  for (let t = 0; t < r.total - 1e-6; t += step) hanFrames.add(frameOf(t));
  for (const s of r.slots) for (const f of [0.25, 0.5, 0.75]) hanFrames.add(frameOf(s.start + s.dur * f));
}
sb.__probe = [...hanFrames].sort((a, b) => a - b);
const propsPath = path.join(outDir, 'props.json');
fs.writeFileSync(propsPath, JSON.stringify(sb, null, 2), 'utf8');
// 存一份「模型实际写的那份分镜」（未经素材路径重写、不带 __probe/bgm），方便复核时对照
if (path.resolve(path.join(outDir, 'storyboard.json')).toLowerCase() !== sbPath.toLowerCase()) fs.writeFileSync(path.join(outDir, 'storyboard.json'), JSON.stringify(parsed.sb, null, 2), 'utf8');
// 不带探针的一份（拼图 / 补检查帧用，放 _run 里，跑完删）
const plainSb = {...sb};
delete plainSb.__probe;
const plainPropsPath = path.join(runDir, 'props-plain.json');
fs.writeFileSync(plainPropsPath, JSON.stringify(plainSb), 'utf8');

// ---------------- 4. Remotion（异步子进程：排队心跳、进度提示不被卡住） ----------------
const runRemotion = (args) =>
  new Promise((resolve) => {
    const probeLines = [];
    const tail = [];
    let buf = '';
    let progress = '';
    const eat = (chunk) => {
      buf += chunk;
      const parts = buf.split(/\r?\n|\r/);
      buf = parts.pop() ?? '';
      for (const l of parts) {
        if (l.includes('__LAYOUT__')) probeLines.push(l);
        else if (l.trim()) {
          tail.push(l);
          if (tail.length > 300) tail.shift();
          const m = /Rendered\s+(\d+)\s*\/\s*(\d+)/i.exec(l);
          if (m) progress = `${m[1]}/${m[2]} 帧`;
        }
      }
    };
    let p;
    try {
      p = spawn(process.execPath, [REMOTION, ...args], {cwd: TEMPLATE, windowsHide: true});
    } catch (e) {
      resolve({status: -1, probe: '', tail: [String(e.message)], progress: () => ''});
      return;
    }
    state.child = p;
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', eat);
    p.stderr.on('data', eat);
    const done = (status, extra) => {
      state.child = null;
      if (buf) eat('\n');
      if (extra) tail.push(extra);
      resolve({status, probe: probeLines.join('\n'), tail});
    };
    p.on('error', (e) => done(-1, e.message));
    p.on('close', (code) => done(code ?? -1));
    runRemotion.progress = () => progress;
  });
const remotion = async (args, label) => {
  const tStart = Date.now();
  const tick = setInterval(() => {
    const pr = runRemotion.progress?.();
    log(`${label}中… 已用 ${Math.round((Date.now() - tStart) / 1000)} 秒${pr ? `（${pr}）` : ''}`);
  }, 30000);
  try {
    let p = await runRemotion([...args, '--log=verbose']);
    if (p.status !== 0 && /cache|lock|EBUSY|EPERM/i.test(p.tail.join('\n'))) {
      log('打包缓存冲突，关掉缓存重试…');
      p = await runRemotion([...args, '--log=verbose', '--bundle-cache=false']);
    }
    if (p.status !== 0) {
      const all = p.tail.filter((l) => !/INFO:CONSOLE/.test(l));
      const errs = all.filter((l) => /error|Error|错误|failed|Failed/.test(l));
      const e = new Error(`Remotion ${label}失败（退出码 ${p.status}）`);
      e.detail = (errs.length ? errs : all).slice(-40).join('\n');
      throw e;
    }
    return p.probe;
  } finally {
    clearInterval(tick);
  }
};

const renderFail = (e) => {
  if (e?.detail) console.error(e.detail);
  const first = String(e?.detail ?? '').split('\n').filter(Boolean).slice(-1)[0] ?? '';
  finish('failed', EXIT.RENDER, `${e?.message ?? e}${first ? `：${first.slice(0, 200)}` : ''}`, `Remotion render failed: ${first.slice(0, 200) || e?.message}`);
};

try {
  state.lock = await acquireRenderLock({file: LOCK, id, log, timeoutMs: queueMin * 60 * 1000});
} catch (e) {
  if (e instanceof QueueTimeoutError) finish('failed', EXIT.QUEUE, `渲染排队超时：${e.message}。等前面的任务跑完再重跑，或加 --queue-timeout 40 多等一会儿`, `render queue timed out after ${queueMin} min`);
  finish('failed', EXIT.INTERNAL, `拿不到渲染锁：${e.message}`, `could not take the render lock: ${e.message}`);
}
log('拿到渲染锁');

const probeLogs = [];
try {
  if (stills) {
    for (const s of stills) {
      const fr = frameOf(s);
      const png = path.join(checkDir, `still-${s.toFixed(2)}s.png`);
      log(`出单帧 ${s}s（第 ${fr} 帧）…`);
      probeLogs.push(await remotion(['still', 'src/index.ts', 'Promo', png, `--frame=${fr}`, `--props=${propsPath}`], '出单帧'));
      if (fs.existsSync(png)) state.checkFrames.push(png);
    }
  } else {
    log(`渲染整片 ${r.total.toFixed(1)} 秒${lang === 'en' ? `（英文片：${sb.__probe.length} 个探针帧扫汉字，每半拍一帧）` : ''}…`);
    probeLogs.push(await remotion(['render', 'src/index.ts', 'Promo', videoPath, `--props=${propsPath}`, '--codec=h264'], '渲染'));
    log('渲染完成');
  }
} catch (e) {
  renderFail(e);
}
if (!stills && (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 1024)) {
  finish('failed', EXIT.RENDER, `Remotion 说渲染完了，但 ${videoPath} 不存在或是空文件`, 'Remotion exited but video.mp4 is missing or empty');
}

// ---------------- 4b. 布局 / 汉字自查：渲染时探针打出的文字包围盒 ----------------
const probed = parseProbeLog(probeLogs.join('\n'));
// mustShow：镜头 spec 声明「检查帧上必须看得见」的字段（journey 的明信片标题和类别名），看不见就是空卡或错过了时刻
const mustShow = r.slots.map((s) => ({i: s.i, frame: frameOf(checkSecOf(s)), fields: Array.isArray(specs[s.type]?.mustShow) ? specs[s.type].mustShow : []})).filter((x) => x.fields.length);
const lc = layoutCheck({frames: probed, slots: r.slots, sb: parsed.sb, checkFrames, fps: FPS, geo: styleId === DEFAULT_STYLE ? null : geo, mustShow});
fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify([...probed.values()].filter((o) => checkFrames.includes(o.frame)), null, 1), 'utf8');
const missingProbe = [...new Set(checkFrames)].filter((f) => !probed.has(f));
const layoutLines = [];
if (!lc.checked) layoutLines.push('  ✗ 没收到布局探针数据（layout.json 为空）：版式没法自查，不能交付。重跑一次；还不行就是 Remotion 没把页面日志转出来（需要 --log=verbose）');
else if (missingProbe.length) layoutLines.push(`  ✗ ${missingProbe.length} 个检查帧没收到探针数据（第 ${missingProbe.join('、')} 帧），这些时刻的版式没查到`);
for (const x of lc.errors) layoutLines.push(`  ✗ ${x}`);
for (const x of lc.layoutIssues) layoutLines.push(`  ✗ ${x}`);
if (lc.checked && !lc.layoutIssues.length && !lc.errors.length && !missingProbe.length)
  layoutLines.push(styleId === DEFAULT_STYLE
    ? `  ✓ ${lc.checked} 个检查帧：文字没有被容器裁切、没有互相压住、字幕/片尾大字都在 x180–900 内，其余卡片内容都在 x150–930 内`
    : `  ✓ ${lc.checked} 个检查帧：文字没有被容器裁切、没有互相压住、都在 x${geo.card.x0}–${geo.card.x1} 内（${aspectOf(parsed.sb.meta)} 画幅）`);
const hanLines = [];
if (lang === 'en') {
  if (lc.hanIssues.length) for (const x of lc.hanIssues) hanLines.push(`  ✗ ${x}`);
  else if (lc.scanned) hanLines.push(`  ✓ 扫了 ${lc.scanned} 个探针帧（${stills ? '只扫 --stills 给的帧' : '每半拍一帧，覆盖每一拍'}），画面 DOM 里没有任何汉字`);
  else hanLines.push('  ✗ 没收到探针数据，汉字没扫到');
}
fs.appendFileSync(reportFile, `布局自查（渲染时量出每个文字块的位置，不靠看图）：\n${layoutLines.join('\n')}\n${hanLines.length ? `英文片汉字扫描（组件写死的中文也算）：\n${hanLines.join('\n')}\n` : ''}`, 'utf8');
console.log(`布局自查：\n${layoutLines.join('\n')}`);
if (hanLines.length) console.log(`英文片汉字扫描：\n${hanLines.join('\n')}`);
const layoutBad = layoutLines.filter((l) => /^\s*✗/.test(l));
const hanBad = hanLines.filter((l) => /^\s*✗/.test(l));
state.checks.layout = {ok: !layoutBad.length, checkedFrames: lc.checked, issues: layoutBad.map((l) => l.trim()), acceptedByHuman: acceptLayout && layoutBad.length > 0};
state.checks.han = lang === 'en' ? {ok: !hanBad.length, scannedFrames: lc.scanned, coverage: stills ? 'stills only' : 'every half beat + 25/50/75% of every shot', issues: hanBad.map((l) => l.trim())} : {skipped: true, reason: 'meta.lang 不是 en'};
const blocking = [...layoutBad, ...hanBad].map((l) => l.trim().replace(/^✗\s*/, ''));
const rejected = blocking.length > 0 && !acceptLayout;

if (stills) finish('stills', rejected ? EXIT.REJECTED : EXIT.OK, rejected ? `单帧版式有 ${blocking.length} 处 ✗` : null);

// ---------------- 5. 拼图 + 检查帧（仍在锁里：_run 素材还在，Remotion 补帧不和别人抢） ----------------
const findFfmpeg = () => {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const p = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], {encoding: 'utf8'});
  return p.status === 0 ? (p.stdout || '').split(/\r?\n/).find((l) => l.trim())?.trim() ?? null : null;
};
const FF = findFfmpeg();
const ff = (args, bin = FF) =>
  bin
    ? spawnSync(bin, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {encoding: 'utf8'})
    : spawnSync(process.execPath, [REMOTION, 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', ...args], {cwd: TEMPLATE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});

const sheetPath = path.join(outDir, rejected ? 'sheet.rejected.png' : 'sheet.png');
const sheetFrames = Array.from({length: Math.max(1, Math.ceil(r.total))}, (_, k) => frameOf(k + 0.5));
let sheetOk = false;
if (process.env.FFMPEG) {
  const cols = 10;
  const rows = Math.max(1, Math.ceil(r.total / cols));
  const th = Math.round((270 * geo.h) / geo.w); // 9:16 → 480（和原来一样），4:5 → 338
  const res = ff(['-ss', '0.5', '-i', videoPath, '-vf', `fps=1,scale=270:${th},pad=280:${th + 10}:5:5:white,tile=${cols}x${rows}`, '-frames:v', '1', sheetPath], process.env.FFMPEG);
  sheetOk = res.status === 0 && fs.existsSync(sheetPath);
  if (!sheetOk) log('FFMPEG 拼图失败，改用 Remotion 的 Sheet 合成');
}
if (!sheetOk) {
  const sheetProps = path.join(runDir, 'sheet-props.json');
  fs.writeFileSync(sheetProps, JSON.stringify({storyboard: plainSb, frames: sheetFrames, cols: 10}), 'utf8');
  log(`拼图（Remotion Sheet，${sheetFrames.length} 格）…`);
  try {
    await remotion(['still', 'src/index.ts', 'Sheet', sheetPath, `--props=${sheetProps}`], '拼图');
    sheetOk = fs.existsSync(sheetPath);
  } catch (e) {
    log(`⚠ 拼图 sheet.png 没生成：${e.message}${e.detail ? `\n${e.detail.split('\n').slice(-5).join('\n')}` : ''}（不影响成片和检查帧）`);
  }
}
state.sheet = sheetOk ? sheetPath : null;

// 检查帧：先从成片里抽（和观众看到的一致），抽不出来的用 Remotion 单帧补
const wanted = [{name: '00-frame0.png', sec: 0, frame: 0}];
for (const s of r.slots) {
  const mid = checkSecOf(s);
  wanted.push({name: `${String(s.i + 1).padStart(2, '0')}-${s.type}-${mid.toFixed(1)}s.png`, sec: mid, frame: frameOf(mid)});
}
const missing = [];
for (const w of wanted) {
  const png = path.join(checkDir, w.name);
  ff(w.sec > 0 ? ['-ss', w.sec.toFixed(3), '-i', videoPath, '-frames:v', '1', png] : ['-i', videoPath, '-frames:v', '1', png]);
  if (!fs.existsSync(png) || fs.statSync(png).size < 1024) missing.push(w);
}
for (const w of missing) {
  const png = path.join(checkDir, w.name);
  try {
    await remotion(['still', 'src/index.ts', 'Promo', png, `--frame=${w.frame}`, `--props=${plainPropsPath}`], '补检查帧');
  } catch (e) {
    log(`⚠ 检查帧 ${w.name} 没生成：${e.message}`);
  }
}
state.checkFrames = wanted.map((w) => path.join(checkDir, w.name)).filter((p) => fs.existsSync(p));
if (state.checkFrames.length < wanted.length) log(`⚠ 检查帧只生成了 ${state.checkFrames.length}/${wanted.length} 张`);

// 空帧检查：整屏 95% 以上一个颜色、连续超过 6 帧（转场停在纯色上、落版只剩一个小点）算 ✗
const blank = blankRuns({
  video: videoPath,
  fps: FPS,
  cwd: TEMPLATE,
  cmd: (a) => (FF ? [FF, '-hide_banner', '-loglevel', 'error', ...a] : [process.execPath, REMOTION, 'ffmpeg', '-hide_banner', '-loglevel', 'error', ...a]),
});
if (blank.error) log(`⚠ 空帧检查没跑成（${blank.error.trim().split('\n').pop()}），跳过`);
const blankBad = blank.runs.map((b) => `✗ ${b.from.toFixed(2)}–${b.to.toFixed(2)} 秒：连续 ${b.frames} 帧整屏 ${Math.round(b.ratio * 100)}% 是同一个颜色 ${b.color}（空帧）。转场别停在纯色上，这段时间里让下一镜的内容已经在画面上`);
state.checks.blank = {ok: !blankBad.length, scannedFrames: blank.frames, issues: blankBad.map((l) => l.trim()), acceptedByHuman: acceptLayout && blankBad.length > 0};
for (const b of blankBad) log(b);
state.lock.release();
state.lock = null;
cleanupRun();

// ---------------- 6. 成片和分镜绑定：哈希 + 时长 ----------------
const dur = mp4Duration(videoPath);
const blockingAll = [...blocking, ...blankBad.map((l) => l.trim().replace(/^✗\s*/, ''))];
const rejectedAll = blockingAll.length > 0 && !acceptLayout;
const finalVideo = rejectedAll ? path.join(outDir, 'video.rejected.mp4') : videoPath;
if (rejectedAll) fs.renameSync(videoPath, finalVideo);
if (rejectedAll && !rejected && state.sheet && fs.existsSync(state.sheet)) {
  const rs = path.join(outDir, 'sheet.rejected.png');
  fs.renameSync(state.sheet, rs);
  state.sheet = rs;
}
state.video = {path: finalVideo, sha256: sha256Of(finalVideo), bytes: fs.statSync(finalVideo).size, durationSec: dur, expectedSec: Number(r.total.toFixed(3))};
if (dur == null) log('⚠ 读不出 mp4 时长（moov/mvhd），manifest 里时长留空');
else if (Math.abs(dur - r.total) > 0.5) {
  finish('failed', EXIT.RENDER, `成片时长 ${dur.toFixed(2)} 秒和分镜 ${r.total.toFixed(2)} 秒对不上，渲染可能被截断，请重跑`, `video duration ${dur.toFixed(2)}s does not match storyboard ${r.total.toFixed(2)}s`);
}
if (rejectedAll) {
  console.log(`版式 / 汉字 / 空帧自查有 ${blockingAll.length} 处 ✗（成片已改名 ${path.basename(finalVideo)}，只给人看哪里坏了，不能交付）：`);
  for (const b of blockingAll.slice(0, 12)) console.log(`  ✗ ${b}`);
  finish('rejected', EXIT.REJECTED, `版式 / 汉字 / 空帧自查有 ${blockingAll.length} 处 ✗：${blockingAll[0]}`, `${blockingAll.length} layout/Han/blank-frame check(s) failed; see report.txt`);
}
if (acceptLayout && blockingAll.length) log(`⚠ 按 --accept-layout 人工放行 ${blockingAll.length} 处 ✗（manifest 里记为 acceptedByHuman）`);
finish('delivered', EXIT.OK);
