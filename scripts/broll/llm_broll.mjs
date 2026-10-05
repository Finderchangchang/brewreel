#!/usr/bin/env node
// 无 agent：口播项目 → 便宜模型写 broll.json → validate.mjs 报错原文回喂。
// 连第一次在内最多 3 轮。第 3 轮仍不过就停，退出码 1，最后一版和报错留在项目目录。
//   node scripts/broll/llm_broll.mjs <项目目录> [--style wood-blocks] [--budget 20] [--captions add|none|burned] [--max-ai 2]
//                                    [--lang auto|zh|en] [--terms "精酿,BrewReel"] [--no-fix] [--dry-run]
// 没有 talk.srt 但有 talk.mp4：先自动转写（本地 SenseVoice，见 transcribe.mjs）；已有 talk.srt 永不覆盖。
// --max-ai：AI 生成画面最多几段（默认 2），其余要配画面的句子用免费的动效画面或留脸。
// --dry-run：只打印拼好的提示和估算 token，不调接口，不读密钥，不转写。
// 写出的 broll.json 校验通过后，记下当时的分句（.brewreel/cues.lock.json）：之后再拆句、并句，validate 会拦。
// 环境变量（只有真正调用时才读）：
//   LLM_API_KEY（没有再读 DEEPSEEK_API_KEY）
//   LLM_BASE_URL  默认 https://api.deepseek.com
//   LLM_MODEL     默认 deepseek-flash
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CUES_LOCK_NAME, cuesLockOf} from './asr/lock.mjs';
import {callLlm, estTokens, extractJson, readLlmEnv, redact} from './llm-client.mjs';
import {probeMedia} from './media.mjs';
import {describeTemplates, isMotion} from './motion.mjs';
import {defaultStyleId, isExperimental, styleMenu} from './prompt.mjs';
import {ROOT} from './root.mjs';
import {parseSrt} from './srt.mjs';
import {LANGS, transcribeProject} from './transcribe.mjs';
import {loadStyles} from './validate.mjs';

const MAX_ROUNDS = 3;
export const DEFAULT_MAX_AI = 2;
const SKILL_FILE = path.join(ROOT, 'broll', 'SKILL-broll.md');
const LIST_CUES = path.join(ROOT, 'scripts', 'broll', 'list-cues.mjs');
const VALIDATE = path.join(ROOT, 'scripts', 'broll', 'validate.mjs');

const FIELD_TABLE = `顶层只写这些字段：

| 字段 | 写什么 |
|---|---|
| version | 固定 2 |
| style | 主风格，照「这次必须遵守」写 |
| styleAlt | 副风格。可以不写；要写只能从风格清单的「可选副风格」里挑一个 |
| thread | 可以不写。一句不超过 20 字的主线，只给人看，不进画面 |
| provider | placeholder |
| quality | 768P |
| budgetYuan | 数字，单位元 |
| captions | add、none 或 burned |
| keepFace | 必须露脸的句子号，例如 ["c5"] |
| clips | 片段数组，1 到 12 段 |

每一段都写：

| 字段 | 写什么 |
|---|---|
| id | b01、b02，按顺序 |
| from / to | 句子号。一段可以盖连续的几句。不要比清单里的句子多 |
| source | motion（免费动效画面）或 ai（AI 生成画面） |
| mode | full、pip 或 split。split 只给竖版 |
| job | 按选择表写 |
| plain | 这段画面在干嘛。不超过 20 字。不进画面 |

source 是 motion 的段另外只写：

| 字段 | 写什么 |
|---|---|
| template | keyword、checklist、steps、counter、compare，按选择表挑 |
| slots | 按模板表写。每个字从句子清单里原样复制 |

动效段不写 place、subject、camera、action、end、beats、look、link。

source 是 ai 的段另外写：

| 字段 | 写什么 |
|---|---|
| place | 只写地点，例如「桌面」「小仓库」。不超过 12 字。不写材质 |
| subject | 只写「机器人」或「机器人和某样东西」。不超过 12 字。不写颜色、不写材质 |
| camera | 风格清单里这个风格的镜头之一 |
| action + end | 一个动作和结束画面。action 不超过 24 字，end 不超过 16 字 |
| beats | 2 到 4 拍，每拍有 action 和 end。和 action、end 二选一 |
| look | main（主风格）或 alt（副风格）。不写就是 main |
| link | new 或 continue（接着上一段的结束画面）。不写就是 new |

不要写 file。不要写毫秒、秒数、比例、分辨率、提示词、参考图、模型名。`;

const CHOOSE_TABLE = `| 句子在干嘛 | job | source | template |
|---|---|---|---|
| 报一个确定的数（钱、时长、个数、倍数），原句里有这个数 | quantify | motion | counter |
| 列两到四样东西 | list | motion | checklist |
| 讲先后（先…再…最后） | explain 或 demonstrate | motion | steps |
| 前后、两种做法对比，原句两边都说了 | compare | motion | compare |
| 一句要观众记住的话、一个关键词 | stress | motion | keyword |
| 点一个地方或物件、只给气氛、动手做事、把两件事连起来 | ground、evoke、demonstrate、connect | ai | 不写 template，用风格 |

同一个模板全片最多用 2 次，相邻两段动效画面不要用同一个模板。开场句、收尾句、讲自己感受的句子留脸。`;

const pickFirst = (list, allowed) => list.find((x) => (allowed ?? []).includes(x));

/** 示例跟着这次的主风格写：job、镜头都挑主风格允许的，副风格挑能做对比的那个。 */
const examplesOf = (styles, styleId, captions) => {
  const main = styles[styleId] ?? {};
  const job = pickFirst(['demonstrate', 'explain', 'ground', 'connect'], main.jobs) ?? 'connect';
  const cam = pickFirst(['slow-push', 'static', 'pan-right'], main.cameras) ?? 'static';
  const alt = (main.pairsWith ?? []).find((id) => styles[id] && !isExperimental(styles[id]) && (styles[id].jobs ?? []).includes('compare') && (styles[id].cameras ?? []).includes('pan-right'));
  const modeA = captions === 'burned' ? 'split' : 'full';
  const modeB = captions === 'burned' ? 'split' : 'pip';
  const top = (extra = {}) => ({version: 2, style: styleId, ...extra, provider: 'placeholder', quality: '768P', budgetYuan: 20, captions: captions || 'add'});
  const ex1 = {
    ...top(),
    keepFace: ['c5'],
    clips: [
      {id: 'b01', from: 'c3', to: 'c4', source: 'motion', mode: modeA, job: 'explain', template: 'steps', plain: '先列再做', slots: {items: ['要做的事列出来', '一步一步做完']}},
      {id: 'b02', from: 'c6', to: 'c7', source: 'ai', mode: 'split', job, plain: '旧的换成新的', place: '小仓库', subject: '机器人', action: '从架子上取下旧方块换上新方块', end: '架子变得整整齐齐', camera: cam},
    ],
  };
  const ex1Note = '（假设 c3 是「先把要做的事列出来」，c4 是「再一步一步做完」，c6 是「把旧的换成新的」，c7 是「架子就整齐了」）';
  const ex2 = {
    ...top(alt ? {styleAlt: alt, thread: '机器人把乱方块搭成一座桥'} : {thread: '机器人把乱方块搭成一座桥'}),
    keepFace: ['c5'],
    clips: [
      {
        id: 'b01',
        from: 'c2',
        to: 'c2',
        source: 'ai',
        mode: modeB,
        job,
        plain: '动手搭第一块',
        place: '桌面',
        subject: '机器人',
        beats: [
          {action: '拿起一块方块放到桌上', end: '方块放在桌面中央'},
          {action: '再把一块方块靠上去', end: '两块方块靠在一起'},
        ],
        camera: cam,
      },
      {id: 'b02', from: 'c4', to: 'c4', source: 'motion', mode: modeA, job: 'quantify', template: 'counter', plain: '只用二十五秒', slots: {say: '二十五秒', label: '整条视频'}},
      {
        id: 'b03',
        from: 'c6',
        to: 'c7',
        source: 'ai',
        mode: 'split',
        job: alt ? 'compare' : job,
        ...(alt ? {look: 'alt'} : {}),
        plain: '两种做法对照',
        place: '两张桌子',
        subject: '机器人',
        action: '看向左边的乱方块再看向右边的齐方块',
        end: '机器人站在整齐的那一桌前',
        camera: alt ? 'pan-right' : cam,
      },
    ],
  };
  const ex2Note = `（假设 c2 是「先动手搭第一块」，c4 是「整条视频只用了二十五秒」，c6、c7 在比两种做法）${alt ? `。b03 用副风格 ${alt}：写 "look":"alt"，顶层写 "styleAlt":"${alt}"` : ''}`;
  return {ex1: JSON.stringify(ex1, null, 2), ex1Note, ex2: JSON.stringify(ex2, null, 2), ex2Note};
};

const usage = () => {
  console.log('用法：node scripts/broll/llm_broll.mjs <项目目录> [--style wood-blocks] [--budget 20] [--captions add|none|burned] [--max-ai 2] [--lang auto|zh|en] [--terms "词1,词2"] [--no-fix] [--dry-run]');
};

const writeText = (file, text) => {
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
};

export const parseArgs = (argv) => {
  const flags = {style: '', budget: '', captions: '', 'max-ai': '', lang: '', terms: '', dryRun: false, noFix: false};
  const positionals = [];
  const takes = new Set(['--style', '--budget', '--captions', '--max-ai', '--lang', '--terms']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      flags.dryRun = true;
      continue;
    }
    if (a === '--no-fix') {
      flags.noFix = true;
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

/**
 * 拼给便宜模型的提示。styles 是全部风格包；flags.style 不写就用默认主风格（wood-blocks）。
 * @returns {{role: string, content: string}[]}
 */
export const buildMessages = ({skill, cuesText, picture, flags, styles}) => {
  const style = flags.style || defaultStyleId(styles);
  const budget = flags.budget || '20';
  const captions = flags.captions || 'add';
  const maxAi = flags['max-ai'] === '' || flags['max-ai'] == null ? DEFAULT_MAX_AI : Number(flags['max-ai']);
  const ex = examplesOf(styles, style, captions);
  const aiRule =
    maxAi === 0
      ? '- 这次不要 AI 画面：每一段都写 "source":"motion"，不合适做动效的句子留脸'
      : `- AI 画面（source 写 ai）最多 ${maxAi} 段，只给最需要画面才看得懂的句子。其余要配画面的句子优先用动效画面（source 写 motion），不合适就留脸`;
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
    '## 选择表：每句先定 source 和 template',
    '',
    CHOOSE_TABLE,
    '',
    '## 动效模板（source 是 motion 时用）',
    '',
    describeTemplates(),
    '',
    '## 风格清单（source 是 ai 时用）',
    '',
    ...styleMenu(styles, style),
    '',
    '## 正确示例 1',
    '',
    `示例只说明字段怎么填。句子号和 slots 里的字不要照抄，改成上面清单里的句子号和原句里的字。${ex.ex1Note}`,
    '',
    ex.ex1,
    '',
    '## 正确示例 2',
    '',
    ex.ex2Note,
    '',
    ex.ex2,
    '',
    '想让一段 AI 画面接着上一段 AI 画面的结束画面：两段在 clips 里挨着、look 一样，后一段写 "link":"continue"。不接就不写 link。',
    '',
    '## 这次必须遵守',
    '',
    '- version 写 2',
    `- style 写 ${style}`,
    `- provider 写 placeholder`,
    `- quality 写 768P`,
    `- budgetYuan 写 ${budget}`,
    `- captions 写 ${captions}`,
    aiRule,
    '- 动效段 slots 里的每个字都从句子清单里原样复制（连着的几个字），不许改写、不许换同义词、不许补字，原句里没有的数字不许写',
    '- 数字只写在 counter 的 say 和 from 里，连同单位照抄原句的写法，不要换成阿拉伯数字。约数（七八块）、「第几」、口语简写（一万二）不要用 counter，改用 keyword 或留脸',
    '- 一段只选一个模板。同一个模板全片最多 2 次，相邻两段动效画面不要用同一个模板',
    '- AI 段：subject 只写「机器人」或「机器人和某样东西」，不写颜色和材质；place 只写地点，比如「桌面」「小仓库」',
    '- AI 段的 place、subject、action、end 里不要写阿拉伯数字、百分号、引号、品牌和玩具名',
    '- 副风格可以不用；要用最多一个，只给讲道理、做对比的 AI 段；第一段 AI 画面用主风格',
    '- 选需要画面才能看懂的句子。开场第一句、最后一句、讲自己感受的句子留脸，放进 keepFace，不要盖住',
    '- 通常 3 到 6 段。动效段窗口至少 1.8 秒，AI 段至少 2.5 秒，都不超过 12 秒。两段之间至少空开一句真人。总长不超过全片 60%',
    '- plain 不超过 20 字，place 和 subject 不超过 12 字，action 不超过 24 字，end 不超过 16 字。字数不含空格',
    '- AI 段的动作要么写 action 和 end，要么写 2 到 4 拍 beats，不要两个都写',
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

const runValidate = (dir, maxAi) => {
  const r = spawnSync(process.execPath, [VALIDATE, dir, '--max-ai', String(maxAi)], {cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  const report = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return {code: r.status ?? 1, report};
};

const summarize = (doc) => {
  const clips = Array.isArray(doc?.clips) ? doc.clips : [];
  const lines = clips.map((c) => `${c.id || '?'} ${c.from || '?'}–${c.to || '?'} ${isMotion(c) ? `动效 ${c.template || '?'}` : `AI${c.look === 'alt' ? '（副风格）' : ''}`} ${c.job || '?'} ${c.mode || '?'}`);
  const jobs = {};
  const modes = {};
  for (const c of clips) {
    jobs[c.job] = (jobs[c.job] || 0) + 1;
    modes[c.mode] = (modes[c.mode] || 0) + 1;
  }
  const ai = clips.filter((c) => c && typeof c === 'object' && !isMotion(c)).length;
  return {lines, jobs, modes, ai, motion: clips.length - ai};
};

const writeLog = (dir, model, entries) => {
  writeText(path.join(dir, 'llm_log.json'), JSON.stringify({model: model || '', entries}, null, 2));
};

const lockPath = (dir) => path.join(dir, '.brewreel', CUES_LOCK_NAME);

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
  if (flags.budget && !/^\d+(\.\d+)?$/.test(flags.budget)) {
    console.log('--budget 要是一个非负数字，单位元。');
    return 2;
  }
  if (flags.captions && !['add', 'none', 'burned'].includes(flags.captions)) {
    console.log('--captions 只能是 add、none 或 burned。');
    return 2;
  }
  if (flags['max-ai'] && !/^\d+$/.test(flags['max-ai'])) {
    console.log('--max-ai 要是一个不小于 0 的整数（AI 生成画面最多几段，默认 2）。');
    return 2;
  }
  if (flags.lang && !LANGS.includes(flags.lang)) {
    console.log(`--lang 只能是 ${LANGS.join('、')}。`);
    return 2;
  }
  const maxAi = flags['max-ai'] ? Number(flags['max-ai']) : DEFAULT_MAX_AI;
  const styles = loadStyles();
  if (flags.style && !styles[flags.style]) {
    console.log(`没有叫 ${flags.style} 的风格预设。现在有 ${Object.keys(styles).join('、') || '（空）'}。`);
    return 2;
  }
  const srt = path.join(dir, 'talk.srt');
  const talk = path.join(dir, 'talk.mp4');
  if (!fs.existsSync(srt)) {
    if (flags.dryRun) {
      console.log('还没有 talk.srt。dry-run 不转写：先跑 node scripts/broll/transcribe.mjs <项目目录>，或去掉 --dry-run（会先自动转写）。');
      return 2;
    }
    if (!fs.existsSync(talk)) {
      console.log('项目目录缺少 talk.mp4。把口播视频改名为 talk.mp4 放进项目目录（有字幕的话也可以放 talk.srt）。');
      return 2;
    }
    console.log('没有 talk.srt，先自动转写…');
    const t = await transcribeProject(dir, {lang: flags.lang || 'auto', terms: flags.terms || '', fix: !flags.noFix});
    if (!t.ok) {
      console.log(t.message);
      return t.exitCode;
    }
    if (t.status === 'written' && !t.relaunched) {
      console.log(`写好 talk.srt：${t.cueCount} 句（校对：${t.fix.status === 'done' || t.fix.status === 'cached' ? `自动改 ${t.fix.applied.length} 处，只提示 ${t.fix.hints.length} 处，详见 talk.fixes.txt` : '没做'}）`);
      for (const w of t.warnings ?? []) console.log(`提醒：${w}`);
    }
  }
  const listed = spawnSync(process.execPath, [LIST_CUES, dir], {cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  if (listed.status !== 0) {
    console.log((listed.stdout || listed.stderr || '列句子失败').trim());
    return listed.status || 1;
  }
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  let messages = buildMessages({skill, cuesText: listed.stdout, picture: mediaLine(dir), flags, styles});

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
    console.log('没有找到 LLM_API_KEY / DEEPSEEK_API_KEY 环境变量。先设置再运行，或用 --dry-run 只看提示；也可以照 broll/SKILL-broll.md 自己写 broll.json。');
    return 2;
  }
  console.log(`模型 ${cfg.model} @ ${cfg.base}`);

  const jsonPath = path.join(dir, 'broll.json');
  const errPath = path.join(dir, 'broll.llm-error.txt');
  // 要按现在的字幕重写 broll.json：上一次的分句锁作废
  fs.rmSync(lockPath(dir), {force: true});
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
      const checked = runValidate(dir, maxAi);
      lastReport = checked.report;
      log.push({round, usage, exitCode: checked.code, report: checked.report});
      if (checked.code === 0) {
        fs.rmSync(errPath, {force: true});
        writeLog(dir, cfg.model, log);
        // 记下这一版 broll.json 对应的分句：之后拆句、并句会被 validate 拦下
        fs.mkdirSync(path.dirname(lockPath(dir)), {recursive: true});
        writeText(lockPath(dir), JSON.stringify(cuesLockOf(parseSrt(fs.readFileSync(srt, 'utf8')))));
        const sum = summarize(doc);
        console.log(`校验通过：第 ${round} 轮`);
        console.log(`选中：${sum.lines.join('；') || '（没有片段）'}`);
        console.log(`AI 画面 ${sum.ai} 段，动效画面 ${sum.motion} 段`);
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
