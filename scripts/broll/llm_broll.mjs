#!/usr/bin/env node
// 无 agent：口播项目 → 便宜模型写 broll.json → validate.mjs 报错原文回喂。
// 连第一次在内最多 3 轮。每一轮先写到 broll.llm-draft.json 再校验，通过了才换成 broll.json（原来有的先备份成 broll.json.bak-<时间>）。
// 3 轮都不过：项目里原来没有 broll.json，就把最后一版留成 broll.json（照「怎么改」手改）；原来有，就不动它，最后一版留在 broll.llm-draft.json。
//   node scripts/broll/llm_broll.mjs <项目目录> [--style wood-blocks] [--budget 20] [--captions add|none|burned] [--max-ai 2]
//                                    [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--no-fix] [--dry-run]
// 退出码：0 写好 / 1 3 轮都没通过校验 / 2 参数错、缺文件、没有 key、横版原片加 burned / 4 接口调用失败（断网、key 不对、余额不足）
// 顶层的 style、provider、quality、budgetYuan、captions 按命令行定死：模型写别的值，这里直接改回来再校验（没写 --motion-look 时 version 不动）。
// --motion-look 把外观名字写进顶层 motionTheme，并把 version 改成 2。不调这个参数时老文件行为不变。
// 转写时拿不准、还没人核对的字（.brewreel/transcribe.json 的 doubts）会在提示里点名，校验时不许它们上动效卡片。
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
import {doubtText, openDoubts} from './asr/doubts.mjs';
import {CUES_LOCK_NAME, cuesLockOf} from './asr/lock.mjs';
import {callLlm, estTokens, explainLlmError, extractJson, readLlmEnv, redact} from './llm-client.mjs';
import {probeMedia} from './media.mjs';
import {MOTION_LOOKS, describeTemplates, isMotion} from './motion.mjs';
import {defaultStyleId, isExperimental, styleMenu} from './prompt.mjs';
import {ROOT} from './root.mjs';
import {parseSrt} from './srt.mjs';
import {LANGS, transcribeProject} from './transcribe.mjs';
import {loadStyles} from './validate.mjs';

const MAX_ROUNDS = 3;
export const DRAFT_NAME = 'broll.llm-draft.json';
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
| mode | full、pip 或 split。split 只给竖版。动效段默认 split（横版 pip），keyword 不许 full |
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

const CHOOSE_TABLE = `| 句子在干嘛 | job | source | template | mode |
|---|---|---|---|---|
| 报一个确定的数（钱、时长、个数、倍数），原句里有这个数 | quantify | motion | counter | split 或 pip |
| 列两到四样东西 | list | motion | checklist | split 或 pip；3 条以上才可以 full |
| 讲先后（先…再…最后） | explain 或 demonstrate | motion | steps | split 或 pip；3 条以上才可以 full |
| 前后、两种做法对比，原句先说旧的、后说新的（先说新的别用 compare） | compare | motion | compare | split 或 pip |
| 一句要观众记住的话、一个关键词 | stress | motion | keyword | split 或 pip，不许 full |
| 点一个地方或物件、只给气氛、动手做事、把两件事连起来 | ground、evoke、demonstrate、connect | ai | 不写 template，用风格 | full、pip 或 split |

动效段默认写 split（上 60% 放画面、下 40% 露脸），横版原片写 pip：说话的人要留在画面里。同一个模板全片最多用 2 次，相邻两段动效画面不要用同一个模板。开场句、收尾句、讲自己感受的句子留脸。`;

const pickFirst = (list, allowed) => list.find((x) => (allowed ?? []).includes(x));

/**
 * 示例跟着这次的主风格写：job、镜头都挑主风格允许的，副风格挑能做对比的那个。
 * 也跟着这次的限制走：--max-ai 0 时示例里没有 AI 段、--max-ai 1 时只有一段；横版不出现 split；burned 只用 split。
 * 动效段一律写 split（横版 pip），留着说话的人；full 只在 AI 段的示例里出现。
 */
const examplesOf = (styles, styleId, captions, maxAi = DEFAULT_MAX_AI, vertical = null) => {
  const main = styles[styleId] ?? {};
  const job = pickFirst(['demonstrate', 'explain', 'ground', 'connect'], main.jobs) ?? 'connect';
  const cam = pickFirst(['slow-push', 'static', 'pan-right'], main.cameras) ?? 'static';
  const alt = maxAi >= 2 ? (main.pairsWith ?? []).find((id) => styles[id] && !isExperimental(styles[id]) && (styles[id].jobs ?? []).includes('compare') && (styles[id].cameras ?? []).includes('pan-right')) : undefined;
  const modeA = captions === 'burned' ? 'split' : 'full';
  const modeB = captions === 'burned' ? 'split' : 'pip';
  const modeS = captions === 'burned' || vertical !== false ? 'split' : 'pip';
  const top = (extra = {}) => ({version: 2, style: styleId, ...extra, provider: 'placeholder', quality: '768P', budgetYuan: 20, captions: captions || 'add'});
  const ex1 = {
    ...top(),
    keepFace: ['c5'],
    clips: [
      {id: 'b01', from: 'c3', to: 'c4', source: 'motion', mode: modeS, job: 'explain', template: 'steps', plain: '先列再做', slots: {items: ['要做的事列出来', '一步一步做完']}},
      maxAi > 0
        ? {id: 'b02', from: 'c6', to: 'c7', source: 'ai', mode: modeA, job, plain: '旧的换成新的', place: '小仓库', subject: '机器人', action: '从架子上取下旧方块换上新方块', end: '架子变得整整齐齐', camera: cam}
        : {id: 'b02', from: 'c6', to: 'c6', source: 'motion', mode: modeS, job: 'stress', template: 'keyword', plain: '旧的换成新的', slots: {text: '把旧的换成新的', hot: '新的'}},
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
      {id: 'b02', from: 'c4', to: 'c4', source: 'motion', mode: modeS, job: 'quantify', template: 'counter', plain: '只用二十五秒', slots: {say: '二十五秒', label: '整条视频'}},
      {
        id: 'b03',
        from: 'c6',
        to: 'c7',
        source: 'ai',
        mode: modeS,
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
  // --max-ai 1：示例 2 只留一段 AI；--max-ai 0：不给示例 2（它是讲 AI 段怎么接、怎么用副风格的）
  if (maxAi < 2) ex2.clips = ex2.clips.filter((c) => c.id !== 'b03');
  const ex2Note = `（假设 c2 是「先动手搭第一块」，c4 是「整条视频只用了二十五秒」${maxAi >= 2 ? '，c6、c7 在比两种做法' : ''}）${alt ? `。b03 用副风格 ${alt}：写 "look":"alt"，顶层写 "styleAlt":"${alt}"` : ''}`;
  return {ex1: JSON.stringify(ex1, null, 2), ex1Note, ex2: maxAi > 0 ? JSON.stringify(ex2, null, 2) : null, ex2Note};
};

const usage = () => {
  console.log('用法：node scripts/broll/llm_broll.mjs <项目目录> [--style wood-blocks] [--budget 20] [--captions add|none|burned] [--max-ai 2] [--lang auto|zh|en|yue|ja|ko] [--terms "词1,词2"] [--motion-look wood|clay|paper|ink|cutpaper-meadow|cutpaper-dusk] [--no-fix] [--dry-run]');
};

const writeText = (file, text) => {
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
};

export const parseArgs = (argv) => {
  const flags = {style: '', budget: '', captions: '', 'max-ai': '', lang: '', terms: '', 'motion-look': '', dryRun: false, noFix: false};
  const positionals = [];
  const takes = new Set(['--style', '--budget', '--captions', '--max-ai', '--lang', '--terms', '--motion-look']);
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

/** 原片的画面朝向和给模型看的那一句。vertical：true 竖版 / false 横版 / null 读不到 */
const mediaInfo = (dir) => {
  const talk = path.join(dir, 'talk.mp4');
  if (!fs.existsSync(talk)) return {vertical: null, line: '还没有 talk.mp4。split 只给竖版。'};
  try {
    const media = probeMedia(talk);
    const vertical = media.height > media.width;
    return {vertical, width: media.width, height: media.height, line: `画面 ${media.width}×${media.height}，时长 ${(media.durationMs / 1000).toFixed(2)} 秒。${vertical ? '竖版，可以用 split。' : '横版，mode 只写 full 或 pip，不要用 split。'}`};
  } catch (e) {
    return {vertical: null, line: `读 talk.mp4 失败：${e.message}`};
  }
};

/**
 * 顶层这几个字段由命令行定死：模型写了别的值就改回来（不然它会照报错把 captions 改成 add 混过校验，出片叠两层字幕）。
 * motionLook 有值时写入 motionTheme，并把 version 改成 2。不传时 version 保持模型写的（或原来的）。
 */
export const forceTop = (doc, {style, budget, captions, motionLook} = {}) => {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return {doc, changed: []};
  const want = {style, provider: 'placeholder', quality: '768P', budgetYuan: Number(budget), captions};
  if (motionLook) want.motionTheme = motionLook;
  const changed = Object.keys(want).filter((k) => doc[k] !== want[k]);
  const rest = Object.fromEntries(Object.entries(doc).filter(([k]) => !(k in want) && k !== 'version'));
  if (motionLook) {
    if (doc.version !== 2) changed.push('version');
    return {doc: {version: 2, ...want, ...rest}, changed};
  }
  return {doc: {...('version' in doc ? {version: doc.version} : {}), ...want, ...rest}, changed};
};

/**
 * 拼给便宜模型的提示。styles 是全部风格包；flags.style 不写就用默认主风格（wood-blocks）。
 * @returns {{role: string, content: string}[]}
 */
export const buildMessages = ({skill, cuesText, picture, flags, styles, doubts = [], vertical = null}) => {
  const style = flags.style || defaultStyleId(styles);
  const budget = flags.budget || '20';
  const captions = flags.captions || 'add';
  const maxAi = flags['max-ai'] === '' || flags['max-ai'] == null ? DEFAULT_MAX_AI : Number(flags['max-ai']);
  const ex = examplesOf(styles, style, captions, maxAi, vertical);
  const doubtBlock = doubts.length
    ? [
        '',
        '## 转写拿不准的字',
        '',
        '下面这几处是自动转写时拿不准、还没人核对的字。这几个字不要放进动效画面的 slots（卡片上的大字一旦是错字，意思可能正好说反）。这几句可以留脸、用 AI 画面，或者只摘这句里别的字：',
        ...doubts.map((d) => `- ${doubtText(d)}`),
      ]
    : [];
  const modeRule =
    captions === 'burned'
      ? '- captions 是 burned，每一段的 mode 只能写 split'
      : vertical === false
        ? '- 原片是横版：mode 只写 full 或 pip，不要写 split。动效段写 pip（keyword 不许 full；full 只给 3 条以上的 checklist、steps）'
        : '- captions 不是 burned，full、pip、split 都可以（split 只给竖版）。动效段默认写 split，keyword 不许 full，full 只给 3 条以上的 checklist、steps';
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
    ...doubtBlock,
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
    ...(ex.ex2
      ? [
          '## 正确示例 2',
          '',
          ex.ex2Note,
          '',
          ex.ex2,
          '',
          '想让一段 AI 画面接着上一段 AI 画面的结束画面：两段在 clips 里挨着、look 一样，后一段写 "link":"continue"。不接就不写 link。',
          '',
        ]
      : []),
    '## 这次必须遵守',
    '',
    '- version 写 2',
    ...(flags['motion-look'] ? [`- motionTheme 写 ${flags['motion-look']}（这一支片子的动效外观，不写就跟着主风格）`] : []),
    `- style 写 ${style}`,
    `- provider 写 placeholder`,
    `- quality 写 768P`,
    `- budgetYuan 写 ${budget}`,
    `- captions 写 ${captions}`,
    aiRule,
    '- 动效段 slots 里的每个字都从句子清单里原样复制（连着的几个字），不许改写、不许换同义词、不许补字，原句里没有的数字不许写',
    '- 数字只写在 counter 的 say 和 from 里，连同单位照抄原句的写法，不要换成阿拉伯数字。约数（七八块）、「第几」、口语简写（一万二）不要用 counter，改用 keyword 或留脸',
    '- 一段只选一个模板。同一个模板全片最多 2 次，相邻两段动效画面不要用同一个模板',
    ...(doubts.length ? ['- 「转写拿不准的字」里列的那几个字不要上动效卡片'] : []),
    '- AI 段：subject 只写「机器人」或「机器人和某样东西」，不写颜色和材质；place 只写地点，比如「桌面」「小仓库」',
    '- AI 段的 place、subject、action、end 里不要写阿拉伯数字、百分号、引号、品牌和玩具名',
    '- 副风格可以不用；要用最多一个，只给讲道理、做对比的 AI 段；第一段 AI 画面用主风格',
    '- 选需要画面才能看懂的句子。开场第一句、最后一句、讲自己感受的句子留脸，放进 keepFace，不要盖住',
    '- 通常 3 到 6 段。动效段窗口至少 1.8 秒，AI 段至少 2.5 秒，都不超过 12 秒。两段之间至少空开一句真人。总长不超过全片 60%',
    '- plain 不超过 20 字，place 和 subject 不超过 12 字，action 不超过 24 字，end 不超过 16 字。字数不含空格',
    '- AI 段的动作要么写 action 和 end，要么写 2 到 4 拍 beats，不要两个都写',
    modeRule,
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

/** 校验草稿：不比旧的分句锁（按现在的字幕重写），转写拿不准的字上卡片算错误。 */
const runValidate = (dir, maxAi) => {
  const r = spawnSync(process.execPath, [VALIDATE, dir, '--max-ai', String(maxAi), '--json', DRAFT_NAME, '--no-lock', '--doubt-error'], {cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
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

const stampOf = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** 旧的 broll.json 改名留底：broll.json.bak-<时间>（同一秒重名就加 -2、-3）。返回备份的文件名。 */
export const backupJson = (jsonPath, now = new Date()) => {
  let bak = `${jsonPath}.bak-${stampOf(now)}`;
  for (let i = 2; fs.existsSync(bak); i++) bak = `${jsonPath}.bak-${stampOf(now)}-${i}`;
  fs.copyFileSync(jsonPath, bak);
  return path.basename(bak);
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
  // 外观名字写错就停。放在读字幕和调模型之前，不转写、不联网。
  if (flags['motion-look'] && !MOTION_LOOKS.includes(flags['motion-look'])) {
    console.log(`--motion-look 只能是 ${MOTION_LOOKS.join('、')}。`);
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
  // 横版原片已经烧了字幕：full、pip 会盖住字幕，split 只给竖版，没有能写的 mode。先拦，不要白转写、白调模型
  const media = mediaInfo(dir);
  if ((flags.captions || 'add') === 'burned' && media.vertical === false) {
    console.log(`原片是横版（${media.width}×${media.height}），已经烧了字幕（--captions burned）：这一版不支持。full、pip 会盖住原片字幕，split 只给竖版。\n→ 怎么改：换成 --captions none（B-roll 那几秒会盖住原片字幕），或者用竖版原片。`);
    return 2;
  }
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
  let doubts = [];
  try {
    doubts = openDoubts(dir, parseSrt(fs.readFileSync(srt, 'utf8')));
  } catch {
    doubts = [];
  }
  const skill = fs.readFileSync(SKILL_FILE, 'utf8');
  let messages = buildMessages({skill, cuesText: listed.stdout, picture: media.line, flags, styles, doubts, vertical: media.vertical});

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
    console.log(`没有找到 LLM_API_KEY / DEEPSEEK_API_KEY 环境变量，先设置再运行。想只看拼好的提示（不调接口）：node scripts/broll/llm_broll.mjs "${dir}" --dry-run；也可以照 broll/SKILL-broll.md 自己写 broll.json。`);
    return 2;
  }
  console.log(`模型 ${cfg.model} @ ${cfg.base}`);

  const jsonPath = path.join(dir, 'broll.json');
  const draftPath = path.join(dir, DRAFT_NAME);
  const errPath = path.join(dir, 'broll.llm-error.txt');
  const hadJson = fs.existsSync(jsonPath);
  const top = {style: flags.style || defaultStyleId(styles), budget: flags.budget || '20', captions: flags.captions || 'add', motionLook: flags['motion-look'] || ''};
  fs.rmSync(draftPath, {force: true});
  const log = [];
  let lastReport = '';
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      console.log(`第 ${round} 轮：请模型写 broll.json…`);
      const {content, usage} = await callLlm(messages, cfg);
      const raw = extractJson(content);
      let pretty = raw;
      let doc = null;
      let forced = [];
      try {
        ({doc, changed: forced} = forceTop(JSON.parse(raw), top));
        pretty = JSON.stringify(doc, null, 2);
      } catch {
        doc = null;
      }
      if (forced.length) console.log(`  顶层 ${forced.join('、')} 按命令行改回来了`);
      // 先写草稿再校验：校验没过不碰原来的 broll.json
      writeText(draftPath, pretty);
      const checked = runValidate(dir, maxAi);
      lastReport = checked.report;
      log.push({round, usage, exitCode: checked.code, forced, report: checked.report});
      if (checked.code === 0) {
        fs.rmSync(errPath, {force: true});
        const bak = hadJson ? backupJson(jsonPath) : null;
        fs.renameSync(draftPath, jsonPath);
        writeLog(dir, cfg.model, log);
        // 记下这一版 broll.json 对应的分句：之后拆句、并句会被 validate 拦下（新的 broll.json 落地以后才换锁）
        fs.mkdirSync(path.dirname(lockPath(dir)), {recursive: true});
        writeText(lockPath(dir), JSON.stringify(cuesLockOf(parseSrt(fs.readFileSync(srt, 'utf8')))));
        const sum = summarize(doc);
        console.log(`校验通过：第 ${round} 轮${bak ? `（原来的 broll.json 备份成了 ${bak}）` : ''}`);
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
        {role: 'assistant', content: pretty},
        {role: 'user', content: `校验未通过。下面是校验脚本的原文，请逐条按「怎么改」修改，其余能用的内容保持不变。只输出完整的新 JSON。\n\n${checked.report}`},
      ]);
    }
  } catch (e) {
    const msg = redact(e?.message || e);
    console.log(msg);
    console.log(`→ ${explainLlmError(msg)}。${hadJson ? '原来的 broll.json 没动。' : ''}`);
    log.push({error: msg});
    writeText(errPath, lastReport ? `${lastReport}\n\n${msg}` : msg);
    writeLog(dir, cfg.model, log);
    return 4;
  }
  writeText(errPath, lastReport || '校验未通过');
  writeLog(dir, cfg.model, log);
  if (hadJson) {
    console.log(`重试后仍未通过。原来的 broll.json 没动；模型最后一版在 ${draftPath}，报错在 ${errPath}`);
  } else {
    // 原来没有 broll.json：把最后一版留成 broll.json，照「怎么改」手改就能接着跑。旧的分句锁（如果有）对不上这一版，删掉
    fs.renameSync(draftPath, jsonPath);
    fs.rmSync(lockPath(dir), {force: true});
    console.log(`重试后仍未通过。最后一版在 ${jsonPath}，报错在 ${errPath}`);
  }
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
