#!/usr/bin/env node
// 一条命令做口播配画面：转写 → 便宜模型写 broll.json → make-talk 出片。
//   node scripts/talk.mjs <项目目录> --out <仓库外目录> [--budget 20] [--provider placeholder|local|minimax-h3] [--yes] [--draft]
//        [--style wood-blocks] [--max-ai 2] [--captions add|none|burned] [--lang auto|zh|en] [--terms "词1,词2"] [--no-fix]
//        [--rewrite-broll] [--dry-run] [--only b01] [--concurrency 3] [--force-redo] [--keep] [--allow-in-repo]
// 项目目录里只放 talk.mp4 就行。每一步做过就跳过：一直重复跑同一条命令即可。
//   第 1/3 步 转写：已有 talk.srt 就跳过（永不覆盖你改过的字幕）。
//   第 2/3 步 写 broll.json：已有就跳过；加 --rewrite-broll 才重写（要 DEEPSEEK_API_KEY 或 LLM_API_KEY）。
//   第 3/3 步 make-talk：参数原样透传。预算闸门、--yes、审片关卡全部照旧。
// 这条命令永远不跑 approve：审片必须人自己看、人自己批准。
// 退出码沿用 make-talk（0 交付 / 1 校验没过 / 2 参数或缺东西 / 3 超预算或没加 --yes / 4 失败 / 5 还没审片）。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT} from './broll/root.mjs';
import {LANGS, transcribeProject} from './broll/transcribe.mjs';

const LLM_BROLL = path.join(ROOT, 'scripts', 'broll', 'llm_broll.mjs');
const MAKE_TALK = path.join(ROOT, 'scripts', 'make-talk.mjs');
const USAGE = [
  '用法：node scripts/talk.mjs <项目目录> --out <仓库外目录> [--budget 20] [--provider placeholder|minimax-h3] [--yes] [--draft]',
  '      [--style wood-blocks] [--max-ai 2] [--captions add|none|burned] [--lang auto|zh|en] [--terms "词1,词2"] [--no-fix]',
  '      [--rewrite-broll] [--dry-run] [--only b01] [--concurrency 3] [--force-redo]',
].join('\n');

/** 带值的参数：去哪一步。 */
export const VALUE_FLAGS = {
  '--out': 'make',
  '--provider': 'make',
  '--only': 'make',
  '--concurrency': 'make',
  '--budget': 'llm',
  '--style': 'llm',
  '--max-ai': 'llm',
  '--captions': 'llm',
  '--lang': 'asr',
  '--terms': 'asr',
};
/** 开关：去哪一步。 */
export const SWITCHES = {
  '--yes': 'make',
  '--draft': 'make',
  '--dry-run': 'make',
  '--force-redo': 'make',
  '--keep': 'make',
  '--allow-in-repo': 'make',
  '--no-fix': 'asr',
  '--rewrite-broll': 'self',
};

/** 解析参数。返回 {dir, values, switches, makeArgs, llmArgs} 或 {error}。 */
export const parseTalkArgs = (argv) => {
  const values = {};
  const switches = new Set();
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') return {help: true};
    if (VALUE_FLAGS[a]) {
      const v = argv[i + 1];
      if (v == null || v.startsWith('--')) return {error: `${a} 后面要有值`};
      values[a] = v;
      i += 1;
      continue;
    }
    if (SWITCHES[a]) {
      switches.add(a);
      continue;
    }
    if (a.startsWith('--')) return {error: `不认识的参数 ${a}`};
    positionals.push(a);
  }
  if (positionals.length !== 1) return {error: positionals.length ? '只能给一个项目目录' : ''};
  if (!values['--out']) return {error: '要写 --out <仓库外目录>'};
  if (values['--lang'] && !LANGS.includes(values['--lang'])) return {error: `--lang 只能是 ${LANGS.join('、')}`};
  const dir = path.resolve(positionals[0]);
  const makeArgs = [dir];
  const llmArgs = [dir];
  for (const [k, v] of Object.entries(values)) {
    if (VALUE_FLAGS[k] === 'make') makeArgs.push(k, k === '--out' ? path.resolve(v) : v);
    if (VALUE_FLAGS[k] === 'llm') llmArgs.push(k, v);
  }
  for (const s of switches) if (SWITCHES[s] === 'make') makeArgs.push(s);
  return {dir, values, switches, makeArgs, llmArgs};
};

const inRepo = (p) => {
  const rel = path.relative(ROOT, p);
  const inside = !rel.startsWith('..') && !path.isAbsolute(rel);
  const promo = inside && (rel === 'promo' || rel.startsWith(`promo${path.sep}`));
  return inside && !promo;
};

const runStep = (script, args) => {
  const r = spawnSync(process.execPath, [script, ...args], {cwd: ROOT, stdio: 'inherit', windowsHide: true});
  return r.status ?? 1;
};

const main = async () => {
  const p = parseTalkArgs(process.argv.slice(2));
  if (p.help) {
    console.log(USAGE);
    return 0;
  }
  if (p.error != null) {
    if (p.error) console.log(p.error);
    console.log(USAGE);
    return 2;
  }
  const {dir, values, switches} = p;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.log(`找不到项目目录 ${dir}`);
    return 2;
  }
  const out = path.resolve(values['--out']);
  if (inRepo(out) && !switches.has('--allow-in-repo')) {
    console.log(`输出目录在仓库里面：${out}\n--out 给仓库外的绝对路径。`);
    return 2;
  }
  const srt = path.join(dir, 'talk.srt');
  const json = path.join(dir, 'broll.json');

  // 第 1/3 步：转写
  if (fs.existsSync(srt)) {
    console.log('第 1/3 步 转写：已有 talk.srt，跳过（不会覆盖你改过的字幕；要重转跑 transcribe.mjs --force）');
  } else {
    console.log('第 1/3 步 转写：没有 talk.srt，本地转写（第一次会下载约 240MB 模型）…');
    const t = await transcribeProject(dir, {lang: values['--lang'] || 'auto', terms: values['--terms'] || '', fix: !switches.has('--no-fix')});
    if (!t.ok) {
      console.log(t.message);
      return t.exitCode;
    }
    if (t.status === 'written' && !t.relaunched) {
      const f = t.fix;
      const fixText = f.status === 'done' || f.status === 'cached' ? `校对自动改 ${f.applied.length} 处、只提示 ${f.hints.length} 处（见 talk.fixes.txt）` : f.status === 'nokey' ? '没有 LLM key，没做校对' : f.status === 'off' ? '没做校对（--no-fix）' : `校对没做成（${f.reason}）`;
      console.log(`  写好 talk.srt：${t.cueCount} 句，${fixText}`);
      for (const h of f.hints ?? []) {
        if (h.kind === 'doubt') console.log(`  请听一下原片 ${h.cue}：「${h.text}」拿不准（${h.why}）`);
        else console.log(`  请听一下原片 ${h.cue}：「${h.from}」可能是「${h.to}」（${h.why}）`);
      }
      for (const w of t.warnings ?? []) console.log(`  提醒：${w}`);
      console.log('  可以打开 talk.srt 改错字；不要拆句、并句。');
    }
  }

  // 第 2/3 步：写 broll.json
  if (fs.existsSync(json) && !switches.has('--rewrite-broll')) {
    console.log('第 2/3 步 写 broll.json：已有，跳过（要重写加 --rewrite-broll）');
    const ignored = ['--budget', '--style', '--max-ai', '--captions'].filter((k) => values[k]);
    if (ignored.length) console.log(`  ${ignored.join('、')} 只在写 broll.json 时用，这次没用上；要用就加 --rewrite-broll，或直接改 broll.json`);
  } else {
    console.log(`第 2/3 步 写 broll.json：请便宜模型写${switches.has('--rewrite-broll') && fs.existsSync(json) ? '（--rewrite-broll，覆盖旧的）' : ''}…`);
    const code = runStep(LLM_BROLL, p.llmArgs);
    if (code !== 0) {
      if (code === 2) console.log('broll.json 没写成。没有 LLM key 的话：设置 DEEPSEEK_API_KEY 再跑同一条命令，或照 broll/SKILL-broll.md 自己写 broll.json 放进项目目录。');
      else console.log('broll.json 没通过校验。按上面「怎么改」改 broll.json，再跑同一条命令（已有的 broll.json 不会被覆盖）。');
      return code;
    }
  }

  // 第 3/3 步：make-talk
  console.log('第 3/3 步 出片（make-talk）…');
  const code = runStep(MAKE_TALK, p.makeArgs);
  if (code === 3) console.log('上面是估价。用户确认后加 --yes 再跑同一条命令；做过的步骤会跳过，已生成的片段不会重新花钱。');
  if (code === 5) {
    console.log(`AI 画面还没审：node scripts/broll/review-sheet.mjs "${dir}" --out "${out}"，把 review.html 交给用户看。`);
    console.log('人看完后自己跑 approve.mjs，再跑同一条命令出正式片。这条命令不跑 approve，AI 助手也不许替人跑。');
  }
  return code;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.log(e?.message || String(e));
      process.exit(4);
    },
  );
}
