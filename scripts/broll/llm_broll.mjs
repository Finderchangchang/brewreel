#!/usr/bin/env node
// 无 agent：口播项目 → 便宜模型写 broll.json → validate.mjs 报错原文回喂。
// 连第一次在内最多 3 轮。第 3 轮仍不过就停，退出码 1，最后一版和报错留在项目目录。
//   node scripts/broll/llm_broll.mjs <项目目录> [--style brick-diorama] [--budget 20] [--captions add|none|burned] [--dry-run]
// --dry-run：只打印拼好的提示和估算 token，不调接口，不读密钥。
// 环境变量（只有真正调用时才读）：
//   LLM_API_KEY（没有再读 DEEPSEEK_API_KEY）
//   LLM_BASE_URL  默认 https://api.deepseek.com
//   LLM_MODEL     默认 deepseek-flash
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {probeMedia} from './media.mjs';
import {ROOT} from './root.mjs';
import {loadStyles} from './validate.mjs';

const MAX_ROUNDS = 3;
const SKILL_FILE = path.join(ROOT, 'broll', 'SKILL-broll.md');
const LIST_CUES = path.join(ROOT, 'scripts', 'broll', 'list-cues.mjs');
const VALIDATE = path.join(ROOT, 'scripts', 'broll', 'validate.mjs');
const SECRET_RE = /bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}/gi;

const FIELD_TABLE = `顶层只写这些字段：

| 字段 | 写什么 |
|---|---|
| version | 固定 1 |
| style | brick-diorama |
| provider | placeholder |
| quality | 768P |
| budgetYuan | 数字，单位元 |
| captions | add、none 或 burned |
| keepFace | 必须露脸的句子号，例如 ["c5"] |
| clips | 片段数组，1 到 12 段 |

每一段只写这些字段：

| 字段 | 写什么 |
|---|---|
| id | b01、b02，按顺序 |
| from / to | 句子号。一段可以盖连续的几句。不要比清单里的句子多 |
| mode | full、pip 或 split。split 只给竖版 |
| job | demonstrate、explain、ground、compare、quantify、evoke、connect |
| plain | 这句在画面上做什么。不超过 20 字。不进提示词 |
| place | 地点。不超过 12 字 |
| subject | 谁。不超过 12 字。全片同一个机器人 |
| camera | static、slow-push、pull-back、pan-left、pan-right、orbit、top-down |
| action + end | 一个动作和结束状态。action 不超过 24 字，end 不超过 16 字 |
| beats | 2 到 4 拍，每拍有 action 和 end。和 action、end 二选一 |

不要写 file。不要写毫秒、秒数、比例、分辨率、提示词、参考图、模型名。`;

const EXAMPLE_1 = `{
  "version": 1,
  "style": "brick-diorama",
  "provider": "placeholder",
  "quality": "768P",
  "budgetYuan": 20,
  "captions": "add",
  "keepFace": ["c5"],
  "clips": [
    {
      "id": "b01",
      "from": "c3",
      "to": "c4",
      "mode": "pip",
      "job": "explain",
      "plain": "先把步骤摊开",
      "place": "积木工作台",
      "subject": "浅蓝灰积木机器人",
      "action": "把方块在桌上一字排开",
      "end": "方块排成整齐一行",
      "camera": "static"
    }
  ]
}`;

const EXAMPLE_2 = `{
  "version": 1,
  "style": "brick-diorama",
  "provider": "placeholder",
  "quality": "768P",
  "budgetYuan": 20,
  "captions": "add",
  "keepFace": ["c6"],
  "clips": [
    {
      "id": "b01",
      "from": "c2",
      "to": "c2",
      "mode": "full",
      "job": "demonstrate",
      "plain": "动手改一个文件",
      "place": "积木小桌",
      "subject": "浅蓝灰积木机器人",
      "beats": [
        {"action": "拿起一块方块放到桌上", "end": "方块放在桌面中央"},
        {"action": "再把一块方块靠上去", "end": "两块方块靠在一起"}
      ],
      "camera": "slow-push"
    },
    {
      "id": "b02",
      "from": "c8",
      "to": "c9",
      "mode": "split",
      "job": "compare",
      "plain": "对照计划看有没有跑偏",
      "place": "两张积木桌",
      "subject": "浅蓝灰积木机器人",
      "action": "看向左边的乱方块再看向右边的齐方块",
      "end": "机器人站在整齐的那一桌前",
      "camera": "pan-right"
    }
  ]
}`;

const usage = () => {
  console.log('用法：node scripts/broll/llm_broll.mjs <项目目录> [--style brick-diorama] [--budget 20] [--captions add|none|burned] [--dry-run]');
};

const redact = (text) => String(text ?? '').replace(SECRET_RE, (m) => (m.toLowerCase().startsWith('bearer') ? 'Bearer [redacted]' : 'sk-[redacted]'));

const estTokens = (text) => {
  const cjk = [...text].filter((ch) => {
    const c = ch.codePointAt(0);
    return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f);
  }).length;
  return Math.round(cjk * 0.7 + (text.length - cjk) / 3.5);
};

const extractJson = (text) => {
  let t = String(text ?? '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
};

const writeText = (file, text) => {
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
};

const readLlmEnv = () => {
  const key = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  const base = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.LLM_MODEL || 'deepseek-flash';
  return {key, base, model};
};

const parseArgs = (argv) => {
  const flags = {style: '', budget: '', captions: '', dryRun: false};
  const positionals = [];
  const takes = new Set(['--style', '--budget', '--captions']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      flags.dryRun = true;
      continue;
    }
    if (takes.has(a)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) return {error: `${a} 后面要有值`};
      flags[a.slice(2)] = value;
      i += 1;
      continue;
    }
    if (a.startsWith('--')) return {error: `不认识的参数 ${a}`};
    positionals.push(a);
  }
  if (positionals.length !== 1) return {error: ''};
  return {flags, dir: path.resolve(positionals[0])};
};

const mediaLine = (dir) => {
  const talk = path.join(dir, 'talk.mp4');
  if (!fs.existsSync(talk)) return '还没有 talk.mp4。split 只给竖版。';
  try {
    const media = probeMedia(talk);
    const vertical = media.height > media.width;
    return `画面 ${media.width}×${media.height}，时长 ${(media.durationMs / 1000).toFixed(2)} 秒。${vertical ? '竖版，可以用 split。' : '横版，不要用 split。'}`;
  } catch (e) {
    return `读 talk.mp4 失败：${e.message}`;
  }
};

const buildMessages = ({skill, cuesText, picture, flags}) => {
  const style = flags.style || 'brick-diorama';
  const budget = flags.budget || '20';
  const captions = flags.captions || 'add';
  const user = [
    '下面是写法。照它写，不要写它禁止的东西。',
    '',
    skill.trim(),
    '',
    '## 这次的句子清单',
    '',
    cuesText.trim(),
    '',
    picture,
    '',
    '## 字段表',
    '',
    FIELD_TABLE,
    '',
    '## 正确示例 1',
    '',
    '示例只说明字段怎么填。句子号不要照抄，改成上面清单里的句子号。',
    '',
    EXAMPLE_1,
    '',
    '## 正确示例 2',
    '',
    EXAMPLE_2,
    '',
    '## 这次必须遵守',
    '',
    `- style 写 ${style}`,
    `- provider 写 placeholder`,
    `- quality 写 768P`,
    `- budgetYuan 写 ${budget}`,
    `- captions 写 ${captions}`,
    '- subject 每一段都写「浅蓝灰积木机器人」',
    '- 选需要画面才能看懂的句子。开场第一句、最后一句、讲自己感受的句子留脸，放进 keepFace，不要盖住',
    '- 通常 4 到 6 段。一段对应的句子要够长（窗口至少 2.5 秒，不超过 12 秒）。两段之间至少空开一句真人。总长不超过全片 60%',
    '- 不要写阿拉伯数字、百分号、引号、凸点、颗粒、stud、minifigure、品牌词',
    '- plain 不超过 20 字，place 和 subject 不超过 12 字，action 不超过 24 字，end 不超过 16 字。字数不含空格',
    '- 动作要么写 action 和 end，要么写 2 到 4 拍 beats，不要两个都写',
    captions === 'burned' ? '- captions 是 burned，每一段的 mode 只能写 split' : '- captions 不是 burned，full、pip、split 都可以',
    '',
    '只输出一个 JSON 对象。不要 Markdown，不要解释。',
  ].join('\n');
  return [
    {role: 'system', content: '你只输出一个 JSON 对象，为口播视频写 broll.json。不要输出解释，不要输出 Markdown。'},
    {role: 'user', content: user},
  ];
};

const printDryRun = (messages) => {
  const text = messages.map((m) => `##### ${m.role} #####\n${m.content}`).join('\n\n');
  const system = estTokens(messages[0].content);
  const user = estTokens(messages[1].content);
  console.log(text);
  console.log('');
  console.log(`[dry-run] 共 ${text.length} 字符，估算约 ${system + user} 输入 token（system ${system} + user ${user}）`);
  console.log(`[dry-run] 最多 ${MAX_ROUNDS} 轮。未调用任何接口。`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const callLlm = async (messages, cfg) => {
  const url = cfg.base.replace(/\/+$/, '') + '/chat/completions';
  const body = JSON.stringify({
    model: cfg.model,
    messages,
    temperature: 0.7,
    response_format: {type: 'json_object'},
  });
  let last = '接口调用失败';
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${cfg.key}`},
        body,
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      last = redact(`接口调用失败：${e?.name || 'Error'}: ${e?.message || e}`);
      if (attempt < 2) {
        console.log('  网络中断，3 秒后重试…');
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
    const raw = await res.text();
    if (res.status === 429 || res.status >= 500) {
      last = redact(`接口报错 HTTP ${res.status}：${raw.slice(0, 300)}`);
      if (attempt < 2) {
        console.log(`  接口 HTTP ${res.status}，3 秒后重试…`);
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
    if (!res.ok) throw new Error(redact(`接口报错 HTTP ${res.status}：${raw.slice(0, 300)}`));
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('接口返回不是 JSON');
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('接口返回里没有 message.content');
    const usage = data.usage && typeof data.usage === 'object' ? data.usage : {};
    return {content, usage};
  }
  throw new Error(last);
};

const runValidate = (dir) => {
  const r = spawnSync(process.execPath, [VALIDATE, dir], {cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  const report = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return {code: r.status ?? 1, report};
};

const summarize = (doc) => {
  const clips = Array.isArray(doc?.clips) ? doc.clips : [];
  const lines = clips.map((c) => `${c.id || '?'} ${c.from || '?'}–${c.to || '?'} ${c.job || '?'} ${c.mode || '?'}`);
  const jobs = {};
  const modes = {};
  for (const c of clips) {
    jobs[c.job] = (jobs[c.job] || 0) + 1;
    modes[c.mode] = (modes[c.mode] || 0) + 1;
  }
  return {lines, jobs, modes};
};

const writeLog = (dir, model, entries) => {
  writeText(path.join(dir, 'llm_log.json'), JSON.stringify({model: model || '', entries}, null, 2));
};

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error != null) {
    if (parsed.error) console.log(parsed.error);
    usage();
    return 2;
  }
  const {flags, dir} = parsed;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.log(`找不到项目目录 ${dir}`);
    return 2;
  }
  const srt = path.join(dir, 'talk.srt');
  const talk = path.join(dir, 'talk.mp4');
  if (!fs.existsSync(srt)) {
    console.log('项目目录缺少 talk.srt。');
    return 2;
  }
  if (flags.style) {
    const styles = loadStyles();
    if (!styles[flags.style]) {
      console.log(`没有叫 ${flags.style} 的风格预设。现在只有 ${Object.keys(styles).join('、') || '（空）'}。`);
      return 2;
    }
  }
  if (flags.budget && !/^\d+(\.\d+)?$/.test(flags.budget)) {
    console.log('--budget 要是一个非负数字，单位元。');
    return 2;
  }
  if (flags.captions && !['add', 'none', 'burned'].includes(flags.captions)) {
    console.log('--captions 只能是 add、none 或 burned。');
    return 2;
  }
  const listed = spawnSync(process.execPath, [LIST_CUES, dir], {cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  if (listed.status !== 0) {
    console.log((listed.stdout || listed.stderr || '列句子失败').trim());
    return listed.status || 1;
  }
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  let messages = buildMessages({skill, cuesText: listed.stdout, picture: mediaLine(dir), flags});

  if (flags.dryRun) {
    printDryRun(messages);
    return 0;
  }

  if (!fs.existsSync(talk)) {
    console.log('项目目录缺少 talk.mp4。');
    return 2;
  }
  const cfg = readLlmEnv();
  if (!cfg.key) {
    console.log('没有找到 LLM_API_KEY / DEEPSEEK_API_KEY 环境变量。先设置再运行，或用 --dry-run 只看提示。');
    return 2;
  }
  console.log(`模型 ${cfg.model} @ ${cfg.base}`);

  const jsonPath = path.join(dir, 'broll.json');
  const errPath = path.join(dir, 'broll.llm-error.txt');
  const log = [];
  let lastReport = '';
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      console.log(`第 ${round} 轮：请模型写 broll.json…`);
      const {content, usage} = await callLlm(messages, cfg);
      const raw = extractJson(content);
      let pretty = raw;
      let doc = null;
      try {
        doc = JSON.parse(raw);
        pretty = JSON.stringify(doc, null, 2);
      } catch {
        doc = null;
      }
      writeText(jsonPath, pretty);
      const checked = runValidate(dir);
      lastReport = checked.report;
      log.push({round, usage, exitCode: checked.code, report: checked.report});
      if (checked.code === 0) {
        fs.rmSync(errPath, {force: true});
        writeLog(dir, cfg.model, log);
        const sum = summarize(doc);
        console.log(`校验通过：第 ${round} 轮`);
        console.log(`选中：${sum.lines.join('；') || '（没有片段）'}`);
        console.log(`job：${JSON.stringify(sum.jobs)}`);
        console.log(`mode：${JSON.stringify(sum.modes)}`);
        console.log('禁用词：没有触发');
        return 0;
      }
      console.log(checked.report);
      if (round === MAX_ROUNDS) break;
      messages = messages.concat([
        {role: 'assistant', content: raw},
        {role: 'user', content: `校验未通过。下面是校验脚本的原文，请逐条按「怎么改」修改，其余能用的内容保持不变。只输出完整的新 JSON。\n\n${checked.report}`},
      ]);
    }
  } catch (e) {
    const msg = redact(e?.message || e);
    console.log(msg);
    log.push({error: msg});
    writeText(errPath, lastReport ? `${lastReport}\n\n${msg}` : msg);
    writeLog(dir, cfg.model, log);
    return 1;
  }
  writeText(errPath, lastReport || '校验未通过');
  writeLog(dir, cfg.model, log);
  console.log(`重试后仍未通过。最后一版在 ${jsonPath}，报错在 ${errPath}`);
  return 1;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.log(redact(e?.message || e));
      process.exit(1);
    },
  );
}
