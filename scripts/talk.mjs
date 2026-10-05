#!/usr/bin/env node
// 一条命令做口播配画面：转写 → 便宜模型写 broll.json → make-talk 出片。
//   node scripts/talk.mjs <项目目录> --out <仓库外目录> [--budget 20] [--provider placeholder|local|minimax-h3] [--yes] [--draft]
//        [--style wood-blocks] [--max-ai 2] [--captions add|none|burned] [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--no-fix]
//        [--rewrite-broll] [--dry-run] [--only b01] [--concurrency 3] [--force-redo] [--keep] [--allow-in-repo]
// 项目目录里只放 talk.mp4 就行。前两步做过就跳过，出片每次重做（输入都没变时直接用上次的成片）：一直重复跑同一条命令即可。
//   第 1/3 步 转写：已有 talk.srt 就跳过（永不覆盖你改过的字幕）。
//   第 2/3 步 写 broll.json：已有就跳过；加 --rewrite-broll 才重写（要 DEEPSEEK_API_KEY 或 LLM_API_KEY；旧的先备份）。
//   第 3/3 步 make-talk：参数原样透传。预算闸门、--yes、审片关卡全部照旧。
// 这条命令永远不跑 approve：审片必须人自己看、人自己批准。
// --rewrite-broll、--only、--force-redo 是一次性的：提示「下一条命令」时会去掉它们（再带着跑会重写方案、重做付费段）。
// --rewrite-broll 不能和 --yes 一起用：新方案的估价还没人看过。
// 退出码沿用 make-talk（0 交付 / 1 校验没过 / 2 参数或缺东西 / 3 超预算或没加 --yes / 4 失败 / 5 还没审片）。
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {doubtText, openDoubts} from './broll/asr/doubts.mjs';
import {isPaidEntry, loadLedger} from './broll/ledger.mjs';
import {ffmpegCheck, ffmpegHelp} from './broll/media.mjs';
import {ROOT} from './broll/root.mjs';
import {parseSrt} from './broll/srt.mjs';
import {LANGS, transcribeProject} from './broll/transcribe.mjs';

const LLM_BROLL = path.join(ROOT, 'scripts', 'broll', 'llm_broll.mjs');
const MAKE_TALK = path.join(ROOT, 'scripts', 'make-talk.mjs');
const USAGE = [
  '用法：node scripts/talk.mjs <项目目录> --out <仓库外目录> [--budget 20] [--provider placeholder|minimax-h3] [--yes] [--draft]',
  '      [--style wood-blocks] [--max-ai 2] [--captions add|none|burned] [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--no-fix]',
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
/** 只该这一次生效的参数：「再跑同一条命令」时要去掉（带着 --rewrite-broll 会重写一份没看过估价的方案，带着 --only 每次都重做那一段、重新花钱）。 */
export const ONE_SHOT = new Set(['--rewrite-broll', '--only', '--force-redo']);

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
  if (switches.has('--rewrite-broll') && switches.has('--yes')) {
    return {error: '--rewrite-broll 和 --yes 不能一起用：重写出来的是一份新方案，它的估价还没人看过。先去掉 --yes 跑一次看估价，用户确认后，去掉 --rewrite-broll、加上 --yes 再跑。'};
  }
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

const quote = (s) => (/[\s"]/.test(s) ? `"${String(s).replace(/"/g, '\\"')}"` : s);

/**
 * 下一条该跑的命令：带上这次的参数，去掉一次性的（ONE_SHOT）和 drop 里的，addYes 时补上 --yes。
 * @param {string[]} argv 这次的参数（不含 node 和脚本名）
 * @param {{addYes?: boolean, drop?: string[]}} [opts]
 */
export const nextCommand = (argv, {addYes = false, drop = []} = {}) => {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (ONE_SHOT.has(a) || drop.includes(a)) {
      if (VALUE_FLAGS[a]) i += 1;
      continue;
    }
    out.push(a);
  }
  if (addYes && !out.includes('--yes')) out.push('--yes');
  return `node scripts/talk.mjs ${out.map(quote).join(' ')}`;
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

/** 还没核对的转写疑点（读不到字幕就当没有）。 */
const doubtsOf = (dir) => {
  try {
    return openDoubts(dir, parseSrt(fs.readFileSync(path.join(dir, 'talk.srt'), 'utf8')));
  } catch {
    return [];
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  const p = parseTalkArgs(argv);
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
  // 出片要完整版 ffmpeg：开头就查，不要等转写完、调完模型才在第 3 步失败
  const ff = ffmpegCheck();
  if (!ff.ok) {
    if (!switches.has('--dry-run')) {
      console.log(ffmpegHelp(ff));
      return 2;
    }
    console.log(`提醒：真出片时会停下。\n${ffmpegHelp(ff)}`);
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
      console.log('  可以打开 talk.srt 改错字；不要拆句、并句。拿不准的字不会被做成动效卡片。');
    }
  }

  // 第 2/3 步：写 broll.json
  const rewrite = switches.has('--rewrite-broll');
  const hadJson = fs.existsSync(json);
  if (hadJson && !rewrite) {
    console.log('第 2/3 步 写 broll.json：已有，跳过（要重写加 --rewrite-broll）');
    const ignored = ['--budget', '--style', '--max-ai', '--captions'].filter((k) => values[k]);
    if (ignored.length) console.log(`  ${ignored.join('、')} 只在写 broll.json 时用，这次没用上；要用就加 --rewrite-broll，或直接改 broll.json`);
  } else {
    if (rewrite && hadJson) {
      const ledger = loadLedger(path.join(out, 'ledger.json'));
      const paid = Object.entries(ledger.clips).filter(([, e]) => isPaidEntry(e)).map(([id]) => id);
      if (paid.length) console.log(`  注意：输出目录里已经有 ${paid.length} 段付费生成的 AI 画面（${paid.join('、')}）。重写后对不上的段要重新生成、重新花钱；这一次不会生成，先出估价。`);
    }
    console.log(`第 2/3 步 写 broll.json：请便宜模型写${rewrite && hadJson ? '（--rewrite-broll：通过校验才替换，旧的先备份成 broll.json.bak-<时间>）' : ''}…`);
    const code = runStep(LLM_BROLL, p.llmArgs);
    if (code !== 0) {
      if (code === 4) console.log('DeepSeek 接口调用失败（原因见上面）：检查 DEEPSEEK_API_KEY（或 LLM_API_KEY）、账户余额和网络，再跑同一条命令。');
      else if (code === 2) console.log('broll.json 没写成（原因见上面）。没有 LLM key 的话：设置 DEEPSEEK_API_KEY 再跑同一条命令，或照 broll/SKILL-broll.md 自己写 broll.json 放进项目目录。');
      else if (hadJson) console.log(`重写没通过校验：原来的 broll.json 没动，模型最后一版在 broll.llm-draft.json。可以再试一次：${nextCommand(argv)} --rewrite-broll；或者照上面「怎么改」改好 broll.llm-draft.json，再改名成 broll.json。`);
      else console.log(`broll.json 没通过校验，最后一版留在 broll.json。照上面「怎么改」改 broll.json 再跑同一条命令；不想手改，就加 --rewrite-broll 让模型按现在的字幕重写：${nextCommand(argv)} --rewrite-broll`);
      return code;
    }
  }

  // 第 3/3 步：make-talk
  console.log('第 3/3 步 出片（make-talk）…');
  const code = runStep(MAKE_TALK, p.makeArgs);
  if (code === 1) {
    console.log('broll.json 没通过校验（常见原因：改过 talk.srt 的字以后，动效卡片上的字和字幕对不上了）。照上面「怎么改」改 broll.json 再跑同一条命令；');
    console.log(`不想手改，就让模型按现在的字幕重写（重写后先看估价，别带 --yes）：${nextCommand(argv, {drop: ['--yes']})} --rewrite-broll`);
  }
  if (code === 3) {
    if (switches.has('--yes')) console.log('上面是超预算或重做次数到顶的说明：按上面说的改，再跑。');
    else console.log(`上面是估价（超预算的话先按上面说的改）。用户确认后跑：${nextCommand(argv, {addYes: true})}\n做过的步骤会跳过，已生成的片段不会重新花钱。`);
  }
  if (code === 5) {
    console.log(`AI 画面还没审：node scripts/broll/review-sheet.mjs "${dir}" --out "${out}"，把 review.html 交给用户看。`);
    console.log(`人看完后自己跑 approve.mjs，再跑：${nextCommand(argv)}`);
    console.log('这条命令不跑 approve，AI 助手也不许替人跑。');
  }
  if (code === 0 || code === 5) {
    if (values['--only']) console.log(`这次只重做了 ${values['--only']}。下次跑别再带 --only：它每次都会让这一段重新生成、重新花钱。`);
    if (rewrite) console.log('broll.json 已按现在的字幕重写。下次跑去掉 --rewrite-broll。');
  }
  const doubts = [0, 3, 5].includes(code) ? doubtsOf(dir) : [];
  if (doubts.length) {
    console.log(`字幕里还有 ${doubts.length} 处转写拿不准、还没核对：${doubts.map(doubtText).join('；')}。`);
    console.log('听一下原片：错了就改 talk.srt 再跑（broll.json 要按新字重写就加 --rewrite-broll）；核对过没错就不用管。');
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
