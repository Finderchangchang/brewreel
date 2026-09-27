// Shared test fixtures: a fake skill root whose make.mjs / validate.mjs follow instructions written in
// the storyboard, a stub defineTool, and a fake Cordis context.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PLUGIN_DIR, '..', '..');

export function tmpDir(prefix = 'dv-test-') {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

const FAKE_MAKE = `
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const sbPath = argv[0];
const out = opt('--out');
const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
const f = sb.fake ?? {};
fs.mkdirSync(path.join(out, 'check'), {recursive: true});
fs.writeFileSync(path.join(out, 'argv.json'), JSON.stringify({argv, env: Object.keys(process.env)}));
if (argv.includes('--verify')) {
  const m = fs.existsSync(path.join(out, 'manifest.json'));
  console.log('核对 ' + out + '：');
  console.log(m ? '核对通过：成片对应当前分镜，可以交付' : '✗ 成片和分镜不一致或没有可交付的成片，请重跑 make');
  process.exit(m && !f.verifyFail ? 0 : 3);
}
const log = (s) => console.log('[make   0s] ' + s);
log('输出目录：' + out);
for (const l of f.lines ?? []) log(l);
const finish = () => {
  const code = f.code ?? 0;
  const stills = opt('--stills');
  if (stills) {
    for (const s of stills.split(',')) fs.writeFileSync(path.join(out, 'check', 'still-' + s + '.png'), 'png');
    console.log('单帧：' + path.join(out, 'check'));
    process.exit(code);
  }
  if (code === 0) {
    const video = path.join(out, 'video.mp4');
    fs.writeFileSync(video, 'fake mp4 ' + Date.now());
    const sha = crypto.createHash('sha256').update(fs.readFileSync(video)).digest('hex');
    fs.writeFileSync(path.join(out, 'sheet.png'), 'png');
    fs.writeFileSync(path.join(out, 'report.txt'), '成片：OK ' + video + '\\n');
    const manifest = {status: 'delivered', exitCode: 0, storyboard: {source: sbPath, copy: null}, video: {path: video, sha256: f.badSha ? 'x' : sha, bytes: 10, durationSec: 24.5}, sheet: path.join(out, 'sheet.png'), checks: {machine: {ok: true, issues: []}, layout: {ok: true}}};
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
    console.log(f.noDeliveryLine ? 'done' : '交付：' + video);
    process.exit(0);
  }
  if (code === 3) {
    fs.writeFileSync(path.join(out, 'video.rejected.mp4'), 'bad');
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({status: 'rejected', exitCode: 3, checks: {layout: {ok: false, issues: ['✗ 第 2 镜 字幕出界']}}}));
    console.log('  ✗ 第 2 镜 字幕出界');
  }
  console.log('未出片：code ' + code);
  process.exit(code);
};
if (f.sleepMs) {
  let n = 0;
  const t = setInterval(() => { n += 10; log('渲染中… 已用 ' + n + ' 秒（' + n + '/700 帧）'); }, 200);
  setTimeout(() => { clearInterval(t); finish(); }, f.sleepMs);
} else finish();
`;

const FAKE_VALIDATE = `
import fs from 'node:fs';
const argv = process.argv.slice(2);
const sb = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
const errors = sb.fake?.errors ?? [];
console.log(JSON.stringify({ok: !errors.length, errors, warnings: [], human: sb.fake?.human ?? [], total: 24.5, slots: [{i: 0, type: 'hook', start: 0, dur: 2.5, end: 2.5}]}, null, 2));
process.exit(errors.length ? 1 : 0);
`;

/** A fake skill root that looks installed (remotion cli + chrome present). */
export function fakeSkillRoot() {
  const root = tmpDir('dv-skill-');
  const w = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
    fs.writeFileSync(path.join(root, rel), text);
  };
  w('SKILL.md', '---\nname: promo-video-skill\ndescription: fake skill for tests\nmetadata:\n  version: 9.9.9\n---\n\n# Body\n');
  w('scripts/make.mjs', FAKE_MAKE);
  w('scripts/validate.mjs', FAKE_VALIDATE);
  w('template/node_modules/@remotion/cli/remotion-cli.js', '');
  w('template/node_modules/.remotion/chrome-headless-shell/marker', 'x');
  return root;
}

/** Write a storyboard with fake-make instructions into <ws>/promo/<name>/storyboard.json. */
export function writeStoryboard(ws, name, fake = {}) {
  const dir = path.join(ws, 'promo', name);
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'storyboard.json');
  fs.writeFileSync(file, JSON.stringify({meta: {title: name}, shots: [], fake}));
  return file;
}

export const stubDefineTool = (spec) => ({...spec, defined: true});

export function fakeJobs() {
  const started = [];
  return {
    started,
    start(spec) {
      const id = `${spec.kind}-${started.length + 1}`;
      const rec = {id, spec, output: [], progress: [], outcome: null};
      const hooks = spec.run({id, append: (t) => rec.output.push(t), updateProgress: (p) => rec.progress.push(p)});
      rec.hooks = hooks;
      rec.done = hooks.done.then((o) => (rec.outcome = o));
      started.push(rec);
      return id;
    },
  };
}

export function fakeCtx({jobs, skills = true} = {}) {
  const tools = [];
  const skillRegs = [];
  const ctx = {
    tools: {register: (t) => (tools.push(t), () => {})},
    logger: {info() {}, warn() {}},
    get: (name) => (name === 'jobs' ? jobs : undefined),
    inject: skills ? (deps, cb) => cb({skills: {register: (s) => (skillRegs.push(s), () => {})}, effect() {}}) : undefined,
  };
  return {ctx, tools, skillRegs};
}

export const execIn = (ws, signal = new AbortController().signal) => ({signal, agent: {id: 'session-1', session: {header: {cwd: ws}}}});

export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
