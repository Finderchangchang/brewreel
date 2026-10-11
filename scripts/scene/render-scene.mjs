#!/usr/bin/env node
// node scripts/scene/render-scene.mjs <scene.json> --out <仓库外目录> [--style 名字] [--motion 性格] [--product 产品] [--scale 1]
// 先校验，再渲 Scene。不进 make / make-lesson / talk。浏览器复用 template 里已有的那份。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {blankRuns} from '../lib/blank-check.mjs';
import {layoutCheck, parseProbeLog} from '../lib/layout-check.mjs';
import {ensureTemplateBrowser, withBrowserExecutable} from '../lib/remotion-browser.mjs';
import {acquireRenderLock} from '../lib/render-lock.mjs';
import {auditPlan, checkFrames, prepareScene, protoScene} from '../../template/src/scene/prepare.ts';
import {sceneFrame} from './geom.mjs';
import {loadStyle, stylesFor} from './tokens.mjs';
import {formatReport, validateScene} from './validate-scene.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = path.join(ROOT, 'template');
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const LOCK = path.join(TEMPLATE, '.render.lock');

function argsOf(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = 'true';
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return {positional, flags};
}

function familiesOf(style) {
  return ['promo', 'lesson', 'talk'].filter((product) => stylesFor(product).includes(style));
}

function outsideRepo(dir) {
  const rel = path.relative(ROOT, path.resolve(dir));
  return rel.startsWith('..') || path.isAbsolute(rel);
}

function ffmpegExe() {
  const ran = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {encoding: 'utf8'});
  const exe = String(ran.stdout || '').trim();
  if (ran.status !== 0 || !exe || !fs.existsSync(exe)) throw new Error('找不到 imageio_ffmpeg 的 ffmpeg');
  return exe;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function embedImages(plan) {
  const next = structuredClone(plan);
  for (const screen of next.screens) {
    const src = screen.imageSrc;
    if (!src || String(src).startsWith('data:')) continue;
    const abs = path.isAbsolute(src) ? src : path.resolve(ROOT, src);
    if (!fs.existsSync(abs)) {
      console.error(`找不到画面素材 ${src}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    if (buf.length >= 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0) screen.imageAspect = w / h;
    }
    screen.imageSrc = `data:${mime};base64,${buf.toString('base64')}`;
  }
  return next;
}

function shotList(plan) {
  const frames = [
    {name: 'shot-1.png', frame: Math.min(6, plan.durationFrames - 1), label: '0.2s'},
    {name: 'shot-2.png', frame: Math.min(Math.round(1.7 * plan.fps), plan.durationFrames - 1), label: '1.7s'},
  ];
  for (let i = 1; i < Math.min(3, plan.screens.length); i++) {
    const screen = plan.screens[i];
    const frame = Math.min(plan.durationFrames - 1, screen.startFrame + Math.round(0.35 * plan.fps));
    frames.push({name: `shot-${frames.length + 1}.png`, frame, label: `${(frame / plan.fps).toFixed(2)}s`});
  }
  const seen = new Set();
  return frames.filter((shot) => (seen.has(shot.frame) ? false : seen.add(shot.frame)));
}

function extractPng(ffmpeg, video, frame, dest) {
  const ran = spawnSync(ffmpeg, ['-y', '-i', video, '-vf', `select=eq(n\\,${frame})`, '-vsync', '0', '-frames:v', '1', dest], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (ran.status !== 0 || !fs.existsSync(dest)) {
    throw new Error(`抽帧 ${frame} 失败：${(ran.stderr || '').slice(-400)}`);
  }
}

function frame0Issue(probes, plan) {
  const hit = probes.get(0);
  if (!hit || hit.error) return hit?.error ? `第 0 帧探针出错 ${hit.error}` : '没有第 0 帧探针';
  const text = plan.screens[0]?.blocks[0]?.text || '';
  const needle = text.replace(/\s/g, '').slice(0, 6);
  const block = (hit.blocks || []).find((item) => String(item.text || '').replace(/\s/g, '').includes(needle));
  if (!block) return `第 0 帧安全区内看不到主文案「${text.slice(0, 12)}」`;
  const [x0, y0, x1, y1] = block.tx || [block.x0, block.y0, block.x1, block.y1];
  const safe = plan.screens[0]?.safe ?? plan.safe;
  if (x0 < safe.x - 12 || x1 > safe.x + safe.w + 12 || y0 < safe.y - 30 || y1 > safe.y + safe.h + 30) {
    return `第 0 帧主文案出了安全区（x ${x0}–${x1}，y ${y0}–${y1}）`;
  }
  return '';
}

async function main() {
  const {positional, flags} = argsOf(process.argv.slice(2));
  const scenePath = positional[0];
  const outDir = flags.out;
  if (!scenePath || !outDir) {
    console.error('用法: node scripts/scene/render-scene.mjs <scene.json> --out <目录> [--style 名字] [--motion 性格] [--product promo|lesson|talk] [--scale 1]');
    process.exit(2);
  }
  if (!outsideRepo(outDir)) {
    console.error('输出目录要在仓库外面');
    process.exit(2);
  }
  const scale = Number(flags.scale || 1);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
    console.error('--scale 取 0 到 1');
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  const collapsed = protoScene(raw);
  let product = flags.product || collapsed.product;
  let style = flags.style || collapsed.style;
  const motion = flags.motion || collapsed.motion;
  if (flags.style) {
    const families = familiesOf(flags.style);
    if (flags.product) {
      if (!families.includes(flags.product)) {
        console.error(`风格 ${flags.style} 不属于 ${flags.product}`);
        process.exit(1);
      }
      product = flags.product;
    } else if (families.includes(collapsed.product)) {
      product = collapsed.product;
    } else if (families.length === 1) {
      product = families[0];
    } else {
      console.error(`风格 ${flags.style} 在 ${families.join('、')} 里都有，请加 --product`);
      process.exit(1);
    }
    style = flags.style;
  }
  const scene = {...collapsed, product, style, ...(motion ? {motion} : {})};
  const result = validateScene(scene);
  console.log(formatReport(result, scenePath));
  if (!result.ok) process.exit(1);
  const token = loadStyle(result.scene.product, result.scene.style);
  if (!token) {
    console.error(`读不到风格 ${result.scene.product}/${result.scene.style}`);
    process.exit(1);
  }
  const frame = sceneFrame(result.scene.product, result.scene.aspect);
  const plan = prepareScene({scene: result.scene, roles: token.roles, extra: token.extra, frame});
  const issues = auditPlan(plan);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exit(1);
  }
  const probe = checkFrames(plan);
  fs.mkdirSync(outDir, {recursive: true});
  writeJson(path.join(outDir, 'scene.used.json'), result.scene);
  writeJson(path.join(outDir, 'plan.json'), plan);
  const propsPath = path.join(outDir, 'props.json');
  writeJson(propsPath, {plan: embedImages(plan), __probe: probe});
  console.log(`准备完成 ${plan.width}×${plan.height} ${plan.durationSec.toFixed(2)}s ${plan.durationFrames} 帧 ${plan.style} ${plan.motion}`);

  const browser = ensureTemplateBrowser({templateDir: TEMPLATE, log: console.log});
  const videoPath = path.join(outDir, 'video.mp4');
  const logPath = path.join(outDir, 'render.log');
  const renderArgs = withBrowserExecutable([
    REMOTION,
    'render',
    'src/index.ts',
    'Scene',
    videoPath,
    `--props=${propsPath}`,
    '--codec=h264',
    '--overwrite',
    '--log=verbose',
    '--scale',
    String(scale),
  ], browser);
  const lock = await acquireRenderLock({file: LOCK, id: `scene-${plan.style}`, log: console.log});
  let ran;
  try {
    const logFd = fs.openSync(logPath, 'w');
    try {
      ran = spawnSync(process.execPath, renderArgs, {
        cwd: TEMPLATE,
        stdio: ['ignore', logFd, logFd],
        windowsHide: true,
        timeout: 420000,
      });
    } finally {
      fs.closeSync(logFd);
    }
  } finally {
    lock.release();
  }
  if (!ran || ran.status !== 0 || !fs.existsSync(videoPath)) {
    const tail = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-30).join('\n') : '';
    console.error(`渲染失败（退出码 ${ran?.status ?? '无'}）`);
    if (tail) console.error(tail);
    process.exit(1);
  }

  const log = fs.readFileSync(logPath, 'utf8');
  const probes = parseProbeLog(log);
  const slots = plan.screens.map((screen, index) => ({
    i: index,
    type: screen.layout,
    start: screen.start,
    end: screen.start + screen.duration,
  }));
  const sb = {
    meta: {lang: 'zh'},
    shots: plan.screens.map((screen) => ({
      type: screen.layout,
      params: {title: screen.blocks[0]?.text || '', items: screen.blocks.map((block) => block.text)},
    })),
  };
  const layout = layoutCheck({
    frames: probes,
    slots,
    sb,
    checkFrames: probe,
    fps: plan.fps,
    geo: {w: plan.width, h: plan.height, card: {x0: plan.safe.x, x1: plan.safe.x + plan.safe.w}},
    mustShow: [{i: 0, frame: 0, fields: ['params.title']}],
  });
  const safeIssue = frame0Issue(probes, plan);
  const ffmpeg = ffmpegExe();
  const blank = blankRuns({
    video: videoPath,
    fps: plan.fps,
    cmd: (bits) => [ffmpeg, '-hide_banner', '-loglevel', 'error', ...bits],
  });
  const shots = shotList(plan);
  for (const shot of shots) extractPng(ffmpeg, videoPath, shot.frame, path.join(outDir, shot.name));
  const manifest = {
    style: plan.style,
    motion: plan.motion,
    product: plan.product,
    aspect: plan.aspect,
    width: plan.width,
    height: plan.height,
    scale,
    fps: plan.fps,
    durationSec: plan.durationSec,
    video: 'video.mp4',
    shots,
    contrast: plan.contrast,
    paint: plan.paint,
    radius: plan.roles.radius,
    weight: plan.roles.weight,
    shadow: plan.roles.shadow,
    texture: plan.roles.texture,
    checks: {
      probeFrames: probes.size,
      layoutIssues: layout.layoutIssues,
      layoutErrors: layout.errors,
      frame0: safeIssue,
      blankOk: blank.ok && !blank.error,
      blankError: blank.error || '',
      blankRuns: blank.runs,
      audit: issues,
    },
  };
  writeJson(path.join(outDir, 'manifest.json'), manifest);
  const failed = [];
  if (layout.layoutIssues.length || layout.errors.length) failed.push(`版式 ${layout.layoutIssues.length + layout.errors.length} 条`);
  if (safeIssue) failed.push(safeIssue);
  if (!blank.ok || blank.error) failed.push(blank.error ? `空帧检查没跑成：${blank.error}` : `空帧 ${blank.runs.length} 段`);
  if (!probes.size) failed.push('没有布局探针');
  if (failed.length) {
    console.error(failed.join('\n'));
    for (const line of layout.layoutIssues.slice(0, 8)) console.error(line);
    process.exit(1);
  }
  console.log(`完成 ${videoPath}`);
  console.log(`探针 ${probes.size} 帧，版式通过，空帧通过，对比度已写入 manifest`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
