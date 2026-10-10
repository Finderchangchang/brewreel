// 把 look 画成预览：照片缩略图加三个姿势。姿势沿用 cast 里的衣服族，脸朝左，和成片一致。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {PEEP_FILL, poseLook, resolveLook} from '../../template/src/lesson/mascot/cast.mjs';
import {mouthGeometry} from '../../template/src/lesson/mascot/motion.mjs';
import {LIKENESS_LIMIT, readPhoto} from './presenter-vision.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'template/package.json'));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const Peep = require(path.join(ROOT, 'template/src/vendor/react-peeps/peeps/index.js')).default;

const INK = '#24211C';
const PREVIEW_POSES = {
  sweater: [['explain', '讲解'], ['point', '指向'], ['check', '勾选']],
  tee: [['explain', '讲解'], ['warn', '提醒'], ['point', '指向']],
  shirt: [['explain', '讲解'], ['check', '勾选'], ['affirm', '肯定']],
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/gu, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

export function previewPoses(look) {
  const family = resolveLook(look).family;
  return PREVIEW_POSES[family] || PREVIEW_POSES.sweater;
}

export function peepSvg(look, pose) {
  const resolved = resolveLook(look);
  const piece = poseLook(resolved.family, pose);
  const svg = renderToStaticMarkup(React.createElement(Peep, {
    viewBox: {x: 0, y: 0, width: 850, height: 1200},
    strokeColor: INK,
    backgroundColor: PEEP_FILL,
    hair: resolved.hair,
    accessory: resolved.accessory,
    facialHair: resolved.facialHair,
    body: piece.body,
    face: 'SmileNM',
  }));
  const mouth = mouthGeometry(0);
  const smile = `<path d="${mouth.d}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  return svg.replace('</svg>', `${smile}</svg>`).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
}

export function previewHtml({look, photoDataUrl}) {
  const resolved = resolveLook(look);
  const poses = previewPoses(look).map(([pose, label]) => {
    return `<figure class="pose"><div class="stage">${peepSvg(look, pose)}</div><figcaption>${esc(label)}</figcaption></figure>`;
  }).join('');
  const photo = photoDataUrl
    ? `<figure class="photo"><img src="${photoDataUrl}" alt="照片缩略图"><figcaption>照片</figcaption></figure>`
    : '';
  const fields = ['preset', 'hair', 'accessory', 'facialHair', 'outfit', 'skin']
    .filter((key) => resolved[key])
    .map((key) => `${key}=${resolved[key]}`)
    .join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#F3F0E8;color:#24211C;font-family:"Microsoft YaHei",sans-serif}
    .page{width:1400px;height:780px;box-sizing:border-box;padding:28px 32px 24px}
    h1{margin:0 0 8px;font-size:28px}
    .limit{margin:0 0 18px;font-size:16px;line-height:1.45}
    .row{display:flex;gap:20px;align-items:flex-end}
    figure{margin:0}
    .photo{width:260px;display:flex;flex-direction:column;align-items:center}
    .photo img{width:240px;height:320px;object-fit:contain;background:#fff}
    .poses{display:flex;gap:8px}
    .pose{width:340px;display:flex;flex-direction:column;align-items:center}
    .stage{width:280px;height:396px;overflow:hidden}
    .stage svg{width:280px;height:396px;display:block;transform:scaleX(-1)}
    figcaption{height:36px;font-size:18px;font-weight:700}
    .meta{margin-top:8px;font-size:16px}
  </style></head><body><div class="page">
    <h1>卡通讲解员预览</h1>
    <p class="limit">${esc(LIKENESS_LIMIT)}</p>
    <div class="row">${photo}<div class="poses">${poses}</div></div>
    <p class="meta">${esc(fields)}</p>
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

export function writePreviewPng({look, photoPath, pngPath}) {
  const photoDataUrl = photoPath ? readPhoto(photoPath).dataUrl : '';
  const html = previewHtml({look, photoDataUrl});
  const dir = path.dirname(pngPath);
  fs.mkdirSync(dir, {recursive: true});
  const htmlPath = path.join(dir, `.${path.basename(pngPath, path.extname(pngPath))}.html`);
  const profile = path.join(dir, `.${path.basename(pngPath, path.extname(pngPath))}-browser`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  try {
    const browsers = browserCandidates();
    if (!browsers.length) throw new Error('没有找到 Chrome 或 Edge，装一个之后才能出预览图');
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
        '--window-size=1400,780',
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
    throw new Error(`预览图生成失败（浏览器退出码 ${lastStatus}）`);
  } finally {
    fs.rmSync(htmlPath, {force: true});
    fs.rmSync(profile, {recursive: true, force: true});
  }
}
