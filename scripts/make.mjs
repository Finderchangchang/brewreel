#!/usr/bin/env node
// ============================================================
// 一条命令出片：校验 → 复制素材 → 配乐 → 渲染 → 拼图 + 检查帧
//   node scripts/make.mjs <storyboard.json> (--out <目录> | --round <轮次> [--slug <片名>]) [--stills 0,1.5,6] [--no-bgm] [--keep]
//     --out      输出目录（一个目录放一份分镜，否则输出会互相覆盖）
//     --round    测试用：产物统一放到 tests/<轮次>/<片名>/（片名默认取 storyboard 所在目录名，文件名不是 storyboard.json 时取文件名）
//                --out 和 --round 必须给一个，不再默认写到 storyboard 旁边，也不要自己按秒生成时间戳目录
//     --stills   只渲染这些时间点（秒）的单帧到 <out>/check/，不出整片（镜头自测用，快）
//     --no-bgm   不生成配乐（静音）
//     --keep     保留 template/public/_run/<id>/（调试用）
// 并发：可以同时开多个实例。Remotion 渲染/出单帧这一步用 template/.render.lock 串行（打印「排队中」），
//       校验、素材复制、配乐、拼图各自并行；每个实例的素材目录 _run/<id> 和输出目录互不干扰。
// 输出：video.mp4、sheet.png（每秒一帧拼图）、check/00-frame0.png + 每镜结束前 0.45 秒的全尺寸帧（动画已演完）、props.json、report.txt、
//       layout.json（检查帧上每个文字块的包围盒；report.txt 末尾「布局自查」写裁切 / 相交 / 出界）
// ============================================================
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAPTION, TEMPLATE, captionSegments, formatReport, loadSpecs, parseFile, validate} from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// ffmpeg 解析：优先 FFMPEG 环境变量 → 其次 PATH 里的系统 ffmpeg（滤镜齐全）→ 最后退回 Remotion 自带的精简版
// （通过 `npx remotion ffmpeg` 调用；这个精简版只编译了少数滤镜，不含 tile/pad，见下面 sheet.png 那步的兜底）。
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const resolveSystemFfmpeg = () => {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], {encoding: 'utf8'});
  if (probe.status === 0) {
    const first = (probe.stdout || '').split(/\r?\n/).find((l) => l.trim());
    return first ? first.trim() : null;
  }
  return null;
};
const FFMPEG_BIN = process.env.FFMPEG || resolveSystemFfmpeg();
const LOCK = path.join(TEMPLATE, '.render.lock');
// Windows 的 python.org 安装默认叫 python；macOS/Linux 通常只有 python3。PYTHON 环境变量可覆盖。
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const t0 = Date.now();
const log = (...a) => console.log(`[make ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- 参数 ----------------
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const VALUED = ['--out', '--stills', '--round', '--slug'];
const sbFile = argv.find((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
if (!sbFile) {
  console.log('用法：node scripts/make.mjs <storyboard.json> (--out <目录> | --round <轮次> [--slug <片名>]) [--stills 0,1.5] [--no-bgm] [--keep]');
  process.exit(2);
}
const sbPath = path.resolve(sbFile);
const round = opt('--round');
if (!opt('--out') && !round) {
  console.log('缺少输出位置：正式出片用 --out <目录>；测试用 --round <轮次>（产物放 tests/<轮次>/<片名>/，同一轮的几支片子放同一个轮次目录，不要按秒生成时间戳目录）');
  process.exit(2);
}
const slugOf = () => {
  const b = path.basename(sbPath, path.extname(sbPath));
  const raw = opt('--slug') ?? (b.toLowerCase() === 'storyboard' ? path.basename(path.dirname(sbPath)) : b);
  return raw.replace(/[^A-Za-z0-9_.-]/g, '_') || 'video';
};
const outDir = path.resolve(opt('--out') ?? path.join(ROOT, 'tests', String(round).replace(/[^A-Za-z0-9_.-]/g, '_'), slugOf()));
const stills = opt('--stills')
  ?.split(',')
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isFinite(x) && x >= 0);
const noBgm = argv.includes('--no-bgm');
const keep = argv.includes('--keep');

// ---------------- 1. 校验 ----------------
const parsed = parseFile(sbPath);
const r = parsed.error ? {errors: [parsed.error], warnings: [], slots: [], total: 0, beat: 0.5, assets: []} : validate(parsed.sb, {baseDir: path.dirname(sbPath)});
r.sb = parsed.sb;
const report = formatReport(r, sbFile);
console.log(report);
if (r.errors.length) process.exit(1);
fs.mkdirSync(path.join(outDir, 'check'), {recursive: true});
log(`输出目录：${outDir}`);

// ---------------- 1b. 机器自查（不靠模型自评；结果写进 report.txt） ----------------
const machineCheck = (sb0) => {
  const lines = [];
  const ok = (cond, good, bad) => lines.push(cond ? `  ✓ ${good}` : `  ✗ ${bad}`);
  // 画面文字里的反斜杠（字面 \n 等转义残留）
  const bs = [];
  const walk = (v, w) => {
    if (typeof v === 'string') {
      if (/\\/.test(v) && !/(^|\.)(src|logo|bgm)$/.test(w)) bs.push(`${w}「${v.slice(0, 16)}」`);
    } else if (Array.isArray(v)) v.forEach((x, k) => walk(x, `${w}[${k}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'note') walk(x, w ? `${w}.${k}` : k);
  };
  walk(sb0, '');
  ok(!bs.length, '画面文字里没有反斜杠（封面没有字面 \\n）', `画面文字里有反斜杠：${bs.join('；')}`);
  // 产品名 / CTA 一致
  const end = (sb0.shots ?? []).find((s) => s.type === 'endCard');
  if (end) {
    ok(end.params?.brand === sb0.meta?.product, `片尾产品名 = meta.product（${sb0.meta?.product}）`, `片尾产品名「${end.params?.brand}」≠ meta.product「${sb0.meta?.product}」`);
    ok((end.params?.cta ?? '') === (sb0.meta?.cta ?? ''), end.params?.cta ? `片尾获取方式 = meta.cta（${sb0.meta.cta}）` : '片尾没放获取方式（简报没给）', `片尾 cta「${end.params?.cta ?? ''}」≠ meta.cta「${sb0.meta?.cta ?? ''}」`);
  }
  // 字幕最长停留
  let longest = {d: 0, text: ''};
  r.slots.forEach((s, i) => {
    const c = sb0.shots[i]?.caption;
    const caps = Array.isArray(c) ? c : typeof c === 'string' ? [c] : [];
    captionSegments(s.start, s.dur, Math.max(1, caps.length), r.beat).forEach(([a, b], k) => {
      if (caps[k] && b - a > longest.d) longest = {d: b - a, text: caps[k]};
    });
  });
  ok(longest.d <= CAPTION.maxHold + 1e-6, `单句字幕最长停 ${longest.d.toFixed(1)} 秒（≤${CAPTION.maxHold}）`, `「${longest.text.replace(/\n/g, '⏎')}」停 ${longest.d.toFixed(1)} 秒`);
  // 片尾图标光圈 vs 免责胶囊（几何常量与 core/safe.ts DISCLAIMER_Y、shots/endCard.tsx 一致）
  if (end && sb0.meta?.disclaimer) {
    const discBottom = 216 + Math.round(26 * 1.3 + 8);
    const haloTop = Math.round(306 + 85 - (85 + 20) * 1.12);
    ok(haloTop - discBottom >= 8, `片尾图标光圈（y≥${haloTop}）和免责胶囊（y≤${discBottom}）不相碰`, `片尾图标光圈顶 y=${haloTop} 贴着免责胶囊底 y=${discBottom}`);
  }
  return lines;
};
const mc = machineCheck(parsed.sb);

// ---------------- 1c. 文字排版报告：模拟换行，报出会断词的行 / 明显超宽的行 ----------------
// 和 template/src/core/fit.ts 的 glueBreaks() 同一套「中文按 Intl.Segmenter 分词、词内不断行」的判断
// 规则，但 Node 不能直接 import 这个 .ts 文件（没有 ts-node/tsx），这里复刻一份最小逻辑。
// 改分词/标点规则要同步改 fit.ts 那边的注释里也提了这件事。
const isWideCp = (cp) =>
  (cp >= 0x2e80 && cp <= 0x9fff) ||
  (cp >= 0xac00 && cp <= 0xd7af) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xff60) ||
  (cp >= 0xffe0 && cp <= 0xffe6) ||
  (cp >= 0x3000 && cp <= 0x303f) ||
  cp === 0x201c || cp === 0x201d || cp === 0x2018 || cp === 0x2019 || cp === 0x2026 || cp === 0x00b7;
const isIdeographCp = (cp) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);
const charUnitsOf = (s) => Array.from(String(s).replace(/[{}]/g, '')).reduce((n, ch) => n + (isWideCp(ch.codePointAt(0)) ? 1 : 0.5), 0);
let zhSegmenter;
const getZhSegmenter = () => {
  try {
    return (zhSegmenter ??= new Intl.Segmenter('zh', {granularity: 'word'}));
  } catch {
    return undefined;
  }
};
// 安全区文字行宽 780px、正文字号下限 40px（SHOT_API §4/§5）折算出的「一行大约能放几个字」，
// 用来近似判断一行是不是长到会触发换行——不是逐镜头像素级校验，只是诊断用的粗略阈值
const LINE_UNITS = 780 / 40;
const reportTextWrap = (sb0, specs) => {
  const lines = [];
  const seg = getZhSegmenter();
  const addField = (loc, val, fmt) => {
    if (typeof val !== 'string' || !val) return;
    if (fmt === 'note' || fmt === 'asset' || fmt === 'icon' || fmt === 'illust' || fmt === 'color') return;
    for (const raw of val.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const units = charUnitsOf(line);
      if (units > LINE_UNITS * 2.2) {
        lines.push(`  ✗ 超宽：${loc}「${line.slice(0, 22)}${line.length > 22 ? '…' : ''}」约 ${units.toFixed(1)} 字，正文下限 40px 也装不下一行`);
        continue;
      }
      if (units <= LINE_UNITS || !seg) continue;
      const words = Array.from(seg.segment(line.replace(/[{}]/g, ''))).map((s) => s.segment);
      const risky = words.filter((w) => {
        const cs = Array.from(w);
        return cs.length >= 2 && cs.some((c) => isIdeographCp(c.codePointAt(0)));
      });
      if (risky.length) lines.push(`  ! 可能断词：${loc}「${line}」超一行宽度且含多字词「${risky.slice(0, 3).join('、')}」——渲染它的组件要用 core/fit.ts 的 glueBreaks() 保护词边界，否则可能被从词中间拆到下一行`);
    }
  };
  addField('meta.disclaimer', sb0.meta?.disclaimer);
  (sb0.meta?.notices ?? []).forEach((n, i) => addField(`meta.notices[${i}]`, n));
  const walkParam = (val, schema, loc) => {
    if (!schema || val == null) return;
    if (schema.type === 'string') return addField(loc, val, schema.format);
    if (schema.type === 'array' && Array.isArray(val)) val.forEach((v, k) => walkParam(v, schema.items, `${loc}[${k}]`));
    else if (schema.type === 'object' && val && typeof val === 'object') for (const [k, v] of Object.entries(val)) walkParam(v, schema.properties?.[k], `${loc}.${k}`);
  };
  (sb0.shots ?? []).forEach((shot, i) => {
    const tag = `${i + 1}-${shot.type}`;
    const caps = Array.isArray(shot.caption) ? shot.caption : typeof shot.caption === 'string' ? [shot.caption] : [];
    caps.forEach((c, k) => addField(`${tag}.caption[${k}]`, c, 'caption'));
    const spec = specs[shot.type];
    if (spec) for (const [k, v] of Object.entries(shot.params || {})) walkParam(v, spec.params?.properties?.[k], `${tag}.params.${k}`);
  });
  return lines.length ? [...new Set(lines)] : ['  ✓ 没发现明显会断词或超宽的行'];
};
const specsForReport = loadSpecs();
const tw = reportTextWrap(parsed.sb, specsForReport);

const fullReport = `${report}\n机器自查（make.mjs 自动做，不靠模型自评）：\n${mc.join('\n')}\n文字排版报告（模拟换行，按安全区行宽 780px / 正文下限 40px 粗估，不是逐镜头像素级校验）：\n${tw.join('\n')}`;
console.log(`机器自查：\n${mc.join('\n')}`);
console.log(`文字排版报告：\n${tw.join('\n')}`);
fs.writeFileSync(path.join(outDir, 'report.txt'), fullReport + '\n', 'utf8');

// ---------------- 2. 素材复制到 template/public/_run/<id>/ ----------------
const base = path.basename(sbPath, path.extname(sbPath)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 24) || 'sb';
const id = `${base}-${Date.now().toString(36)}-${process.pid}`;
const runDir = path.join(TEMPLATE, 'public', '_run', id);
fs.mkdirSync(runDir, {recursive: true});
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

const cleanup = () => {
  if (!keep) fs.rmSync(runDir, {recursive: true, force: true});
};

// ---------------- 3. 配乐 ----------------
const bgmScript = path.join(ROOT, 'scripts', 'make_bgm.py');
if (!noBgm && !stills && fs.existsSync(bgmScript)) {
  const bgmOut = path.join(runDir, 'bgm.wav');
  const specs = loadSpecs();
  const args = [
    bgmScript,
    '--duration', r.total.toFixed(3),
    '--bpm', String(sb.meta.bpm || 120),
    '--theme', sb.meta.theme,
    '--cues', JSON.stringify(r.slots.map((s) => Number(s.start.toFixed(3)))),
    '--moods', JSON.stringify(sb.shots.map((s) => (typeof s.mood === 'number' ? s.mood : specs[s.type]?.mood ?? 0.5))),
    '--types', JSON.stringify(r.slots.map((s) => s.type)),
    '--out', bgmOut,
  ];
  log('生成配乐…');
  const p = spawnSync(PY, args, {cwd: ROOT, encoding: 'utf8', env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'}});
  if (p.status === 0 && fs.existsSync(bgmOut)) {
    sb.bgm = `_run/${id}/bgm.wav`;
    fs.copyFileSync(bgmOut, path.join(outDir, 'bgm.wav'));
    log('配乐 OK');
  } else log(`配乐失败，改为静音：${(p.stderr || p.error?.message || '').trim().split('\n').slice(-3).join(' | ')}`);
} else if (!stills) log(noBgm ? '按 --no-bgm 静音' : '没有 scripts/make_bgm.py，静音');

// 检查帧时间点：第 0 帧 + 每镜「结束前 0.45 秒」（此时本镜动画已演完、还没开始退场）
const checkTimes = [0, ...r.slots.map((s) => Math.max(s.start + s.dur / 2, s.end - 0.45))];
const lastFrame = Math.round(r.total * 30) - 1;
const frameOf = (sec) => Math.min(Math.round(sec * 30), lastFrame);
sb.__probe = (stills ?? checkTimes).map(frameOf);
const propsPath = path.join(outDir, 'props.json');
fs.writeFileSync(propsPath, JSON.stringify(sb, null, 2), 'utf8');
// 存一份「模型实际写的那份分镜」（未经素材路径重写、不带 __probe/bgm），方便复核时对照——
// 之前只有 props.json（内部重写版），复核者常常对不上模型到底改了什么（round4 修复）
fs.writeFileSync(path.join(outDir, 'storyboard.json'), JSON.stringify(parsed.sb, null, 2), 'utf8');

// ---------------- 4. 渲染（锁文件串行） ----------------
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
const acquire = async () => {
  let lastMsg = 0;
  for (;;) {
    try {
      const fd = fs.openSync(LOCK, 'wx');
      fs.writeSync(fd, JSON.stringify({pid: process.pid, id, at: Date.now()}));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let info = {};
      try {
        info = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
      } catch {}
      const stale = (info.pid && !alive(info.pid)) || (info.at && Date.now() - info.at > 40 * 60 * 1000);
      if (stale) {
        log(`清掉失效的锁（${info.id ?? '?'}）`);
        fs.rmSync(LOCK, {force: true});
        continue;
      }
      if (Date.now() - lastMsg > 15000) {
        log(`排队中：等待 ${info.id ?? '另一个任务'} 渲染完成…`);
        lastMsg = Date.now();
      }
      await sleep(2000);
    }
  }
};
let locked = false;
const release = () => {
  if (!locked) return;
  locked = false;
  try {
    const info = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    if (info.pid === process.pid) fs.rmSync(LOCK, {force: true});
  } catch {}
};
process.on('exit', release);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
  release();
  cleanup();
  process.exit(130);
});

// 布局探针的页面日志只有 --log=verbose 才会转出来；verbose 输出很多，只在失败时打印其中的报错行
const remotion = (args) => {
  const run = (extra) => spawnSync(process.execPath, [REMOTION, ...args, ...extra], {cwd: TEMPLATE, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024});
  let p = run(['--log=verbose']);
  if (p.status !== 0 && /cache|lock|EBUSY|EPERM/i.test(p.stderr + p.stdout)) {
    log('打包缓存冲突，关掉缓存重试…');
    p = run(['--log=verbose', '--bundle-cache=false']);
  }
  if (p.status !== 0) {
    const all = ((p.stderr || '') + (p.stdout || '')).split('\n').filter((l) => !/__LAYOUT__|INFO:CONSOLE/.test(l));
    const errs = all.filter((l) => /error|Error|错误|failed|Failed/.test(l));
    console.error((errs.length ? errs : all).slice(-60).join('\n'));
    throw new Error('Remotion 失败');
  }
  return p;
};

const videoPath = path.join(outDir, 'video.mp4');
const probeLogs = [];
await acquire();
locked = true;
try {
  if (stills) {
    for (const s of stills) {
      const fr = frameOf(s);
      const png = path.join(outDir, 'check', `still-${s.toFixed(2)}s.png`);
      log(`出单帧 ${s}s（第 ${fr} 帧）…`);
      const p = remotion(['still', 'src/index.ts', 'Promo', png, `--frame=${fr}`, `--props=${propsPath}`]);
      probeLogs.push((p.stderr || '') + (p.stdout || ''));
    }
  } else {
    log(`渲染整片 ${r.total.toFixed(1)} 秒…`);
    const p = remotion(['render', 'src/index.ts', 'Promo', videoPath, `--props=${propsPath}`, '--codec=h264']);
    probeLogs.push((p.stderr || '') + (p.stdout || ''));
    log('渲染完成');
  }
} catch (e) {
  release();
  cleanup();
  console.error(String(e.message || e));
  process.exit(1);
}
release();
cleanup();

// ---------------- 4b. 布局自查：渲染时探针打出的文字包围盒 → 裁切 / 相交 / 出界 ----------------
const layoutCheck = (logText) => {
  const frames = new Map();
  for (const m of logText.matchAll(/__LAYOUT__(\{.*?\})__END__/g)) {
    try {
      const o = JSON.parse(m[1]);
      frames.set(o.frame, o);
    } catch {}
  }
  const issues = [];
  const slotOf = (fr) => {
    const sec = fr / 30;
    return r.slots.find((x) => sec >= x.start - 1e-6 && sec < x.end - 1e-6) ?? r.slots[r.slots.length - 1];
  };
  const at = (fr) => {
    const s = slotOf(fr);
    return `${(fr / 30).toFixed(1)}s 第 ${s.i + 1} 镜（${s.type}）`;
  };
  const q = (b) => `「${b.text.slice(0, 12)}」`;
  const lang = r.sb?.meta?.lang === 'en' ? 'en' : 'zh';
  const HAN_RE = /[㐀-鿿]/;
  for (const [fr, o] of [...frames.entries()].sort((a, b) => a[0] - b[0])) {
    if (o.error) {
      issues.push(`${at(fr)}：探针出错 ${o.error}`);
      continue;
    }
    const vis = [];
    const slot = slotOf(fr);
    for (const b of o.blocks ?? []) {
      const [x0, y0, x1, y1] = b.tx;
      const c = b.clip;
      if (c && (x1 <= c[0] || x0 >= c[2] || y1 <= c[1] || y0 >= c[3])) continue; // 整块在裁切框外 = 看不见
      if (x1 <= 0 || x0 >= 1080 || y1 <= 0 || y0 >= 1920) continue;
      vis.push(b);
      // 裁切：底边 / 左右被容器切掉（顶边切掉多是聊天记录上滚，属正常）
      if (c) {
        const cut = [];
        if (y1 > c[3] + 3) cut.push(`底边切掉 ${Math.round(y1 - c[3])}px`);
        if (x1 > c[2] + 3) cut.push(`右边切掉 ${Math.round(x1 - c[2])}px`);
        if (x0 < c[0] - 3) cut.push(`左边切掉 ${Math.round(c[0] - x0)}px`);
        if (cut.length) issues.push(`${at(fr)}：文字${q(b)}被容器裁切（${cut.join('，')}）`);
      }
      // 全局字幕带（y260–540）和 endCard 的大字（brand/slogan/points）算"关键内容"，按 SAFE 的 x180–900 核对；
      // 其余卡片内容仍按 CARD 的 x150–930（round4 修复：之前所有文字统一用 150–930，比字幕/片尾该守的 180–900 松）
      const isKeyContent = (y0 >= 245 && y1 <= 555) || slot?.type === 'endCard';
      const [lo, hi] = isKeyContent ? [178, 902] : [148, 932];
      if (x0 < lo || x1 > hi) issues.push(`${at(fr)}：文字${q(b)}出了 x${isKeyContent ? 180 : 150}–${isKeyContent ? 900 : 930}（x ${x0}–${x1}）`);
      // 英文视频画面上不该有中文字（含组件写死的字符串，探针量到的是渲染后的真实文字，能抓到 storyboard 之外的硬编码）
      if (lang === 'en' && HAN_RE.test(b.text)) issues.push(`${at(fr)}：英文视频（meta.lang: "en"）画面上出现中文字${q(b)}`);
    }
    for (let i = 0; i < vis.length; i++)
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i];
        const b = vis[j];
        if (a.anc.includes(b.id) || b.anc.includes(a.id)) continue;
        const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ix <= 4 || iy <= 4) continue;
        const area = (z) => Math.max(1, (z.x1 - z.x0) * (z.y1 - z.y0));
        if (ix * iy < 300 || ix * iy < 0.08 * Math.min(area(a), area(b))) continue;
        issues.push(`${at(fr)}：文字${q(a)}和${q(b)}相交（重叠 ${ix}×${iy}px）`);
      }
  }
  return {frames: [...frames.values()], issues: [...new Set(issues)]};
};
const lc = layoutCheck(probeLogs.join('\n'));
fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(lc.frames, null, 1), 'utf8');
const layoutLines = !lc.frames.length
  ? ['  ? 没收到布局探针数据（layout.json 为空），这一项没查']
  : lc.issues.length
    ? lc.issues.map((x) => `  ✗ ${x}`)
    : [`  ✓ ${lc.frames.length} 个检查帧：文字没有被容器裁切、没有互相压住、字幕/片尾大字都在 x180–900 内，其余卡片内容都在 x150–930 内`];
fs.appendFileSync(path.join(outDir, 'report.txt'), `布局自查（渲染时量出每个文字块的位置，不靠看图）：\n${layoutLines.join('\n')}\n`, 'utf8');
console.log(`布局自查：\n${layoutLines.join('\n')}`);

if (stills) {
  log(`完成：单帧在 ${path.join(outDir, 'check')}`);
  process.exit(0);
}

// ---------------- 5. 拼图 + 检查帧（并行安全，只读 video.mp4） ----------------
const ff = (args) =>
  FFMPEG_BIN
    ? spawnSync(FFMPEG_BIN, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {encoding: 'utf8'})
    : spawnSync(process.execPath, [REMOTION, 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', ...args], {
        cwd: TEMPLATE,
        encoding: 'utf8',
        maxBuffer: 512 * 1024 * 1024,
      });
const cols = 10;
const rows = Math.max(1, Math.ceil(r.total / cols));
const sheetResult = ff([
  '-ss', '0.5', '-i', videoPath,
  '-vf', `fps=1,scale=270:480,pad=280:490:5:5:white,tile=${cols}x${rows}`,
  '-frames:v', '1', path.join(outDir, 'sheet.png'),
]);
if (sheetResult.status !== 0 || !fs.existsSync(path.join(outDir, 'sheet.png'))) {
  log(
    '⚠ 拼图 sheet.png 生成失败：tile/pad 滤镜不在当前 ffmpeg 里（Remotion 自带的精简版 ffmpeg 只编译了少数滤镜）。' +
      '装一个完整版系统 ffmpeg 并设 FFMPEG 环境变量指向它即可修复；不影响成片 video.mp4 和检查帧 check/*.png。',
  );
}
for (const f of fs.readdirSync(path.join(outDir, 'check'))) if (f.endsWith('.png')) fs.rmSync(path.join(outDir, 'check', f));
ff(['-i', videoPath, '-frames:v', '1', path.join(outDir, 'check', '00-frame0.png')]);
for (const s of r.slots) {
  // 取「结束前 0.45 秒」：此时本镜动画已演完、还没开始退场（中点常卡在卡片刚要弹出的过渡瞬间）
  const mid = Math.max(s.start + s.dur / 2, s.end - 0.45);
  const name = `${String(s.i + 1).padStart(2, '0')}-${s.type}-${mid.toFixed(1)}s.png`;
  ff(['-ss', mid.toFixed(3), '-i', videoPath, '-frames:v', '1', path.join(outDir, 'check', name)]);
}
log(`完成：
  成片   ${videoPath}
  拼图   ${path.join(outDir, 'sheet.png')}（每秒一帧，取 x.5 秒）
  检查帧 ${path.join(outDir, 'check')}`);
