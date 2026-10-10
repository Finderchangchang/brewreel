// 角色卡：一张静态 PNG（8 个动作 + 张嘴 / 闭嘴 / 眨眼）和一段 3 秒 MP4。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {PEEP_FILL, poseLook, resolveLook, POSES} from '../../template/src/lesson/mascot/cast.mjs';
import {cssPx, iconMarkup, pieceFill, pieceMarkup, placeMarks} from '../../template/src/lesson/mascot/icon-place.mjs';
import {mouthGeometry} from '../../template/src/lesson/mascot/motion.mjs';
import {acquireRenderLock, QueueTimeoutError} from '../lib/render-lock.mjs';
import {POSE_LABELS, CARD_FRAMES, CARD_FPS} from './character-clip.mjs';
import {readJsonResource} from './read-json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = path.join(ROOT, 'template');
const REMOTION = path.join(TEMPLATE, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const require = createRequire(path.join(ROOT, 'template/package.json'));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const Peep = require(path.join(ROOT, 'template/src/vendor/react-peeps/peeps/index.js')).default;
const TOKENS = readJsonResource(path.join(ROOT, 'template/src/lesson/style-tokens.json'));

const THEME_LABEL = {paper: '卷宗', lecture: '讲台', product: '产品', editorial: '杂志'};
const CARD_W = 2200;
const CARD_H = 1120;
const PAD_X = 40;
const PAD_TOP = 36;
const PAD_BOTTOM = 28;
const TITLE_H = 48;
const SUB_MARGIN_TOP = 8;
const SUB_LINE = 26;
const SUB_MARGIN_BOTTOM = 18;
const POSE_STAGE = {w: 230, h: 324};
const STATE_STAGE = {w: 280, h: 360};
const POSE_FIG = {w: 250, gap: 12, captionH: 36};
const STATE_FIG = {w: 340, gap: 36, captionH: 36, marginTop: 22};
const FOOT_MARGIN = 8;
const FOOT_H = 29;

function rowOf(count, fig, stage, y, labelOf) {
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const figX = PAD_X + index * (fig.w + fig.gap);
    const stageX = figX + (fig.w - stage.w) / 2;
    items.push({
      label: labelOf(index),
      stage: {x: stageX, y, w: stage.w, h: stage.h},
      caption: {x: figX, y: y + stage.h, w: fig.w, h: fig.captionH},
    });
  }
  return items;
}

/** 角色卡上每个格子和标签的页面坐标。测试用来确认人不被裁、标签不叠。 */
export function cardLayout() {
  const posesY = PAD_TOP + TITLE_H + SUB_MARGIN_TOP + SUB_LINE + SUB_MARGIN_BOTTOM;
  const poses = rowOf(POSES.length, POSE_FIG, POSE_STAGE, posesY, (index) => POSES[index]);
  const statesY = posesY + POSE_STAGE.h + POSE_FIG.captionH + STATE_FIG.marginTop;
  const stateLabels = ['张嘴', '闭嘴', '眨眼'];
  const states = rowOf(stateLabels.length, STATE_FIG, STATE_STAGE, statesY, (index) => stateLabels[index]);
  const footY = statesY + STATE_STAGE.h + STATE_FIG.captionH + FOOT_MARGIN;
  return {
    width: CARD_W,
    height: CARD_H,
    poses,
    states,
    foot: {x: PAD_X, y: footY, w: CARD_W - PAD_X * 2, h: FOOT_H},
  };
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/gu, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

function markDiv(box, inner) {
  return `<div class="mark" style="left:${cssPx(box.x)}px;top:${cssPx(box.y)}px;width:${cssPx(box.w)}px;height:${cssPx(box.h)}px">${inner}</div>`;
}

function marksHtml(kind, ink, stageW, stageH) {
  const placed = placeMarks(stageW, stageH, 'card', kind, 0);
  if (kind === 'cheer') return placed.pieces.map((box, index) => markDiv(box, pieceMarkup(pieceFill(index, ink)))).join('');
  if (!placed.icon) return '';
  return markDiv(placed.icon, iconMarkup(kind, ink));
}

export function peepSvg(look, pose, {mouth = 0, blink = false, ink} = {}) {
  const resolved = resolveLook(look);
  const piece = poseLook(resolved.family, pose);
  const svg = renderToStaticMarkup(React.createElement(Peep, {
    viewBox: {x: 0, y: 0, width: 850, height: 1200},
    strokeColor: ink,
    backgroundColor: PEEP_FILL,
    hair: resolved.hair,
    accessory: resolved.accessory,
    facialHair: resolved.facialHair,
    body: piece.body,
    face: blink ? 'EyesClosed' : piece.face,
  }));
  const shape = mouthGeometry(blink ? 0 : mouth);
  const path = shape.open
    ? `<path d="${shape.d}" fill="${ink}"/>`
    : `<path d="${shape.d}" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>`;
  const drawn = svg.replace('</svg>', `${path}</svg>`);
  return drawn.replace('<svg ', '<svg class="peep" xmlns="http://www.w3.org/2000/svg" ');
}

function figure(look, pose, label, {mouth = 0, blink = false, ink, wide = false} = {}) {
  const piece = poseLook(resolveLook(look).family, pose);
  const stage = wide ? STATE_STAGE : POSE_STAGE;
  const mark = blink ? '' : marksHtml(piece.icon, ink, stage.w, stage.h);
  return `<figure class="${wide ? 'state' : 'pose'}" data-pose="${esc(pose)}"><div class="stage">${mark}${peepSvg(look, pose, {mouth, blink, ink})}</div><figcaption>${esc(label)}</figcaption></figure>`;
}

export function cardHtml({name, version, theme, look}) {
  const t = TOKENS[theme] ?? TOKENS.lecture;
  const ink = t.ink;
  const poses = POSES.map((pose) => figure(look, pose, POSE_LABELS[pose], {ink})).join('');
  const states = [
    figure(look, 'explain', '张嘴', {mouth: 1, ink, wide: true}),
    figure(look, 'explain', '闭嘴', {mouth: 0, ink, wide: true}),
    figure(look, 'explain', '眨眼', {blink: true, ink, wide: true}),
  ].join('');
  const themeLabel = THEME_LABEL[theme] || theme;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:${t.bg};color:${ink};font-family:"Microsoft YaHei","Noto Sans SC",sans-serif}
    .page{width:${CARD_W}px;height:${CARD_H}px;box-sizing:border-box;padding:${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px}
    h1{margin:0;font-size:40px;line-height:${TITLE_H}px;height:${TITLE_H}px}
    .sub{margin:${SUB_MARGIN_TOP}px 0 ${SUB_MARGIN_BOTTOM}px;font-size:22px;line-height:${SUB_LINE}px;height:${SUB_LINE}px;color:${t.muted}}
    .poses,.states{display:flex;align-items:flex-end}
    .poses{gap:${POSE_FIG.gap}px}
    .states{gap:${STATE_FIG.gap}px;margin-top:${STATE_FIG.marginTop}px}
    figure{margin:0}
    .pose{width:${POSE_FIG.w}px}
    .state{width:${STATE_FIG.w}px}
    .stage{position:relative;margin:0 auto;overflow:hidden}
    .pose .stage{width:${POSE_STAGE.w}px;height:${POSE_STAGE.h}px}
    .state .stage{width:${STATE_STAGE.w}px;height:${STATE_STAGE.h}px}
    .stage svg.peep{width:100%;height:100%;display:block;transform:scaleX(-1);transform-origin:50% 100%}
    .mark{position:absolute;z-index:2;pointer-events:none}
    .mark svg{width:100%;height:100%;display:block}
    figcaption{height:${POSE_FIG.captionH}px;line-height:${POSE_FIG.captionH}px;text-align:center;font-size:22px;font-weight:700}
    .foot{margin:${FOOT_MARGIN}px 0 0;font-size:20px;line-height:${FOOT_H}px;height:${FOOT_H}px;color:${t.muted}}
  </style></head><body><div class="page">
    <h1>${esc(name)} · 角色卡</h1>
    <p class="sub">版本 ${esc(version)} · 默认风格 ${esc(themeLabel)} · 脸朝左</p>
    <div class="poses">${poses}</div>
    <div class="states">${states}</div>
    <p class="foot">这是特征像，不是照片。换手势只在这一套衣服里。嘴是张开和闭上，不是对着每个字做口型。确认这张卡之后，才能用在正式成片里。</p>
  </div></body></html>`;
}

function browserCandidates() {
  const fromEnv = String(process.env.PRESENTER_BROWSER ?? '').trim();
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const rels = [
    ['Google', 'Chrome', 'Application', 'chrome.exe'],
    ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
  ];
  const found = [];
  if (fromEnv && fs.existsSync(fromEnv)) found.push(fromEnv);
  for (const root of roots) {
    for (const rel of rels) {
      const full = path.join(root, ...rel);
      if (fs.existsSync(full) && !found.includes(full)) found.push(full);
    }
  }
  return found;
}

function isPng(file) {
  if (!fs.existsSync(file)) return false;
  const buf = fs.readFileSync(file);
  return buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
}

export function writeCardPng({record, pngPath}) {
  const html = cardHtml({name: record.name, version: record.version, theme: record.defaultTheme, look: record.look});
  const dir = path.dirname(pngPath);
  fs.mkdirSync(dir, {recursive: true});
  const htmlPath = path.join(dir, '.character-card.html');
  const profile = path.join(dir, '.character-card-browser');
  fs.writeFileSync(htmlPath, html, 'utf8');
  try {
    const browsers = browserCandidates();
    if (!browsers.length) throw new Error('没有找到 Chrome 或 Edge，装一个之后才能出角色卡');
    fs.rmSync(profile, {recursive: true, force: true});
    fs.mkdirSync(profile, {recursive: true});
    let lastStatus = 1;
    for (const browser of browsers) {
      const shot = path.join(profile, 'shot.png');
      const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--allow-file-access-from-files',
        `--user-data-dir=${profile}`,
        `--window-size=${CARD_W},${CARD_H}`,
        `--screenshot=${shot}`,
        pathToFileURL(htmlPath).href,
      ];
      const run = spawnSync(browser, args, {cwd: profile, timeout: 40_000, windowsHide: true});
      lastStatus = run.status ?? 1;
      const fallback = path.join(profile, 'screenshot.png');
      const produced = isPng(shot) ? shot : isPng(fallback) ? fallback : null;
      if (produced) {
        fs.copyFileSync(produced, pngPath);
        return pngPath;
      }
    }
    throw new Error(`角色卡图片生成失败（浏览器退出码 ${lastStatus}）`);
  } finally {
    fs.rmSync(htmlPath, {force: true});
    fs.rmSync(profile, {recursive: true, force: true});
  }
}

export async function writeCardMp4({record, mp4Path}) {
  fs.mkdirSync(path.dirname(mp4Path), {recursive: true});
  const propsPath = path.join(path.dirname(mp4Path), '.character-card-props.json');
  const props = {look: record.look, theme: record.defaultTheme, name: record.name};
  fs.writeFileSync(propsPath, JSON.stringify(props), 'utf8');
  const lock = await acquireRenderLock({file: path.join(TEMPLATE, '.render.lock'), id: `character-card-${process.pid}`, log: () => {}, timeoutMs: 20 * 60 * 1000});
  try {
    const run = spawnSync(process.execPath, [REMOTION, 'render', 'src/index.ts', 'CharacterCard', mp4Path, `--props=${propsPath}`, '--codec=h264'], {
      cwd: TEMPLATE,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (run.status !== 0 || !fs.existsSync(mp4Path) || fs.statSync(mp4Path).size < 1024) {
      const tail = String(run.stderr || run.stdout || run.error || '').trim().split(/\r?\n/).slice(-8).join('\n');
      throw new Error(`角色卡动画生成失败（退出码 ${run.status ?? -1}）\n${tail}`);
    }
    return mp4Path;
  } catch (error) {
    if (error instanceof QueueTimeoutError) throw new Error(error.message);
    throw error;
  } finally {
    lock.release();
    fs.rmSync(propsPath, {force: true});
  }
}

export const CARD_SIZE = {width: CARD_W, height: CARD_H, frames: CARD_FRAMES, fps: CARD_FPS};
