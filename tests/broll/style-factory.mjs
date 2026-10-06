#!/usr/bin/env node
// 风格工厂：写配置回喂、看图打分、挑图、试拍、断点、闸门、批量、批准。假服务器，不花钱。
//   node tests/broll/style-factory.mjs
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {SECOND_OPINION_MARK, callVision, classifyResembles, hardFails, judgeImage, judgeSecondOpinion, mergeChecklist, parseChecklist, realObjectNames, reconcileChecklist, secondOpinionPrompt, softScore, suspectedKeys, verdictOf} from '../../scripts/broll/judge.mjs';
import {loadStyles} from '../../scripts/broll/validate.mjs';
import {summarizeCalibration} from '../../scripts/broll/judge-calibrate.mjs';
import {scanRoot} from '../../scripts/privacy-scan.mjs';
import {parseApproveArgs} from '../../scripts/broll/approve-style.mjs';
import {approveStyle, approveTestRootOk, pickOf, runBatch, runNewStyle, styleProblems} from '../../scripts/broll/style-factory.mjs';
import {loadCharacter, readStyles} from '../../scripts/broll/prompt.mjs';
import {ROOT} from '../../scripts/broll/root.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
let passed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed += 1;
  else failures.push(detail ? `${name}：${detail}` : name);
};
const approveInTest = (args) => {
  const prev = process.env.BREWREEL_APPROVE_TEST;
  process.env.BREWREEL_APPROVE_TEST = '1';
  try {
    return approveStyle(args);
  } finally {
    if (prev === undefined) delete process.env.BREWREEL_APPROVE_TEST;
    else process.env.BREWREEL_APPROVE_TEST = prev;
  }
};
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

const goodStyle = (id, name = '水彩绘本') => ({
  id,
  name,
  nameEn: 'Watercolor',
  status: 'experimental',
  default: false,
  summary: '水彩晕染的小场景，适合讲一件事',
  summaryEn: 'a soft watercolor scene',
  look: '水彩晕染的纸面小世界，看得到纸纹，柔和暖色，侧面来的光。',
  character: '角色是一个水彩涂出来的玩具机器人，颜色是哑光的',
  characterEn: 'a toy robot painted in soft watercolor',
  ground: '地面是一整张暖白色的水彩纸',
  forbid: '画面里没有文字、字母、数字、商标和真实人物，没有人声对白。',
  camera: {static: '镜头固定不动', 'slow-push': '镜头缓慢推近'},
  cameras: ['static', 'slow-push'],
  jobs: ['demonstrate', 'explain', 'ground'],
  pairsWith: [],
  materialWords: ['水彩', '纸纹'],
  refs: [
    {
      file: 'refs/character.jpg',
      role: '角色',
      aspect: '1:1',
      prompt: 'Macro photograph, front view, full body: {character} It stands alone on warm white watercolor paper. The top of the head is one smooth round dome. Each hand is one solid round ball. Soft warm light. Nothing is written anywhere in the image.',
    },
    {
      file: 'refs/material.jpg',
      role: '材质',
      aspect: '16:9',
      prompt: 'Macro photograph of an empty miniature scene on warm white watercolor paper: a cup, a box and a small lamp, soft washes of warm color, visible paper grain. No characters in the scene. Soft warm light. Nothing is written anywhere in the image.',
    },
  ],
  promptExpansion: 'disabled',
  freezeNoise: 0.0005,
  motionTheme: {look: 'paper'},
});

const judgeBody = (kind, over = {}) => ({
  text: {value: false, reason: '画面里没有字'},
  studs: {value: false, seen: '表面平整', reason: '没有砖面圆点'},
  ip: {value: false, like: '', reason: '不像知名作品'},
  characters: {value: kind === 'material' ? 0 : 1, reason: kind === 'material' ? '没有角色' : '只有一个机器人'},
  antenna: {value: false, seen: '头顶是光滑圆顶', reason: '没有小零件'},
  mouth: {value: false, seen: '只有两只眼睛，下半部分光滑', reason: '没有嘴'},
  roundHead: {value: true, reason: '圆头'},
  glowEyes: {value: true, reason: '眼睛发光'},
  ballHands: {value: true, reason: '圆球手'},
  chestPanel: {value: true, reason: '胸口方板'},
  colors: {body: true, eyes: true, reason: '浅蓝灰和暖橙'},
  objects: {value: 4, names: ['杯子', '盒子', '灯'], reason: '三件东西'},
  sameCharacter: {value: true, reason: '是那只圆头机器人'},
  clarity: {value: 4, reason: '清楚'},
  composition: {value: 4, reason: '居中'},
  shape: {value: 4, reason: '形状对'},
  ...over,
});

const chat = (content) => ({choices: [{message: {content: typeof content === 'string' ? content : JSON.stringify(content)}}], usage: {}});

const startServer = (handler) =>
  new Promise((resolve) => {
    const calls = [];
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        calls.push({method: req.method, url: req.url, body});
        const done = handler({url: req.url, body, method: req.method, calls});
        if (done?.drop) {
          res.destroy();
          return;
        }
        if (done?.bin) {
          res.writeHead(200, {'Content-Type': 'image/jpeg'});
          res.end(done.bin);
          return;
        }
        const payload = done?.json ?? {ok: true};
        const code = done?.status ?? 200;
        res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify(payload));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({server, port: server.address().port, calls, close: () => new Promise((r) => server.close(() => r()))}));
  });

const envFor = (port) => ({
  MINIMAX_API_KEY: 'test-key-factory',
  MINIMAX_BASE_URL: `http://127.0.0.1:${port}`,
  DEEPSEEK_API_KEY: 'test-deepseek',
  LLM_API_KEY: '',
  LLM_BASE_URL: `http://127.0.0.1:${port}/llm`,
  LLM_MODEL: 'deepseek-flash',
  BREWREEL_VISION_MODEL: 'MiniMax-M3',
});

const prepRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brewreel-approve-test-'));
  fs.mkdirSync(path.join(root, 'broll'), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'broll', 'character.json'), path.join(root, 'broll', 'character.json'));
  fs.copyFileSync(path.join(ROOT, 'broll', 'banned-words.json'), path.join(root, 'broll', 'banned-words.json'));
  fs.mkdirSync(path.join(root, 'broll', 'styles'), {recursive: true});
  return root;
};

const kindOf = (body) => {
  const m = String(body).match(/kind=([a-z]+)/);
  return m ? m[1] : '';
};

const secondClear = (kind) => {
  if (kind === 'character') {
    return {
      head: {where: '头顶是光滑圆顶，正上方没有凸出', answer: '没有'},
      face: {where: '眼睛以下是一整块光滑的脸', answer: '没有'},
      text: {where: '画面任何位置都没有字', answer: '没有'},
      resembles: '无',
    };
  }
  if (kind === 'material') {
    return {
      objects: {where: '桌上有杯子、盒子和灯', names: ['杯子', '盒子', '灯']},
      text: {where: '画面里没有字', answer: '没有'},
      studs: {where: '表面没有成排的小圆点', answer: '没有'},
      resembles: '无',
    };
  }
  return {
    text: {where: '画面里没有字', answer: '没有'},
    bumps: {where: '表面没有成排的圆形凸起', answer: '没有'},
    same: {where: '圆头、暖橙眼睛、圆球手，还是同一只', answer: '没有'},
    resembles: '无',
  };
};
const isSecond = (body) => String(body).includes(SECOND_OPINION_MARK);
const judgeReply = (body, fallbackKind = 'frame') => {
  const kind = kindOf(body) || fallbackKind;
  return chat(isSecond(body) ? secondClear(kind) : judgeBody(kind));
};

// ───────── 纯规则 ─────────
{
  const character = loadCharacter(ROOT);
  const ipWords = readJson(path.join(ROOT, 'broll', 'banned-words.json')).groups.ip;
  const ok = goodStyle('demo-ok');
  check('合格草稿过 lint 和 IP', styleProblems(ok, 'demo-ok', {character, styles: {}, ipWords}).length === 0, styleProblems(ok, 'demo-ok', {character, styles: {}, ipWords}).join('\n'));
  const ip = goodStyle('demo-ip');
  ip.look = '皮克斯一样的柔光小世界';
  check('IP 词拦截皮克斯', styleProblems(ip, 'demo-ip', {character, styles: {}, ipWords}).some((p) => p.includes('皮克斯')));
  const antenna = goodStyle('demo-ant');
  antenna.refs[0].prompt += ' no antenna on the head';
  check('出图提示写了 antenna 被拦', styleProblems(antenna, 'demo-ant', {character, styles: {}, ipWords}).some((p) => /antenna/i.test(p)));
  check('禁用词分组里有 judge 的 IP', ['乐高', 'Minecraft', '吉卜力', '皮克斯', '迪士尼', 'Aardman', '小羊肖恩', '纪念碑谷'].every((w) => ipWords.includes(w)));

  const pass = judgeBody('character');
  check('无硬伤', hardFails('character', pass).length === 0, JSON.stringify(hardFails('character', pass)));
  check('有嘴是硬伤', hardFails('character', {...pass, mouth: {value: true, seen: '眼睛下面有一条弧线', reason: '有微笑'}}).some((h) => h.code === 'mouth'));
  check('角色数不是 1', hardFails('character', {...pass, characters: {value: 2, reason: '两个'}}).some((h) => h.code === 'characters'));
  check('材质图有角色', hardFails('material', judgeBody('material', {characters: {value: 1, reason: '有一个'}})).some((h) => h.code === 'characters'));
  check('材质图几乎空白', hardFails('material', judgeBody('material', {objects: {value: 1, names: ['线'], reason: '几乎没有'}})).some((h) => h.code === 'blank'));
  check('抽帧角色不一致', hardFails('frame', judgeBody('frame', {sameCharacter: {value: false, reason: '变成了人仔'}})).some((h) => h.code === 'sameCharacter'));
  check('有字是硬伤', hardFails('frame', judgeBody('frame', {text: {value: true, reason: '角上有字'}})).some((h) => h.code === 'text'));
  const ear = reconcileChecklist('character', {...pass, antenna: {value: true, seen: '头顶是光滑圆顶，两侧有耳朵', reason: '有耳朵'}});
  check('布尔值 true 不会被改成 false', hardFails('character', ear).some((h) => h.code === 'antenna'), JSON.stringify(hardFails('character', ear)));
  const earFalse = reconcileChecklist('character', {...pass, antenna: {value: false, seen: '头顶是光滑圆顶，两侧有耳朵', reason: '没有天线'}});
  check('侧面耳朵且布尔值 false 不是天线', hardFails('character', earFalse).every((h) => h.code !== 'antenna') && verdictOf('character', earFalse) === 'pass', JSON.stringify({hard: hardFails('character', earFalse), verdict: verdictOf('character', earFalse)}));
  const knob = reconcileChecklist('character', {...pass, antenna: {value: true, seen: '头顶正中有一个小圆钮', reason: '有钮'}});
  check('头顶小圆钮仍是天线', hardFails('character', knob).some((h) => h.code === 'antenna'));
  const stains = reconcileChecklist('material', judgeBody('material', {objects: {value: 5, names: ['污渍', '一条线', '色块'], reason: '几块痕迹'}}));
  check('污渍不算物件', verdictOf('material', stains) !== 'pass' && realObjectNames(stains.objects.names).length === 0, JSON.stringify({verdict: verdictOf('material', stains), objects: stains.objects}));
  const hills = reconcileChecklist('material', judgeBody('material', {
    studs: {value: false, seen: '只有纸艺剪裁的层叠山丘和一个纸片小房子', reason: '没有凸点'},
    objects: {value: 2, names: ['house', 'sun'], reason: '只有房子和太阳，共 2 个'},
  }));
  check('不从别的字段捞物件名', hardFails('material', hills).some((h) => h.code === 'blank'), JSON.stringify(hardFails('material', hills)));
  const sketch = reconcileChecklist('material', judgeBody('material', {
    text: {value: false, reason: '画面基本空白，只有几根淡淡的铅笔线条'},
    studs: {value: false, seen: '只有细线画的杯子、盒子和山丘轮廓', reason: '没有凸点'},
    objects: {value: 2, names: ['cup', 'box'], reason: '只有轮廓'},
  }));
  check('空白草图的轮廓不算物件', hardFails('material', sketch).some((h) => h.code === 'blank'), JSON.stringify(hardFails('material', sketch)));
  const loose = `<think>先看一眼</think>{"text":{"value":false,"reason":"没有字"},\n{"studs":{"value":false,"seen":"顶面平整","reason":"没有凸点"},\n{"ip":{"value":false,"like":"","reason":"不像"},\n{"characters":false,\n{"objects":{"names":["杯子","盒子","灯","拱门"],"reason":"四件"},\n{"clarity":{"value":4,"reason":"清楚"},\n{"composition":{"value":4,"reason":"居中"},\n{"shape":{"value":4,"reason":"像样"}`;
  const repaired = parseChecklist(loose);
  check('拆开的 JSON 能拼回去', !repaired.error && repaired.parsed.characters.value === 0 && repaired.parsed.objects.value === 4, repaired.error || JSON.stringify(repaired.parsed.objects));
  const closedBits = '{"text":{"value":false,"reason":"没有字"}}, {"studs":{"value":false,"seen":"顶面平整","reason":"没有凸点"}}, {"ip":{"value":false,"like":"","reason":"不像"}}, {"mouth":{"value":false,"seen":"下半部分光滑","reason":"没有嘴"}}, {"antenna":{"value":false,"seen":"光滑圆顶","reason":"没有"}}, {"characters":{"value":1,"reason":"一个"}}';
  const closedParsed = parseChecklist(closedBits);
  check('各自闭合的 JSON 碎片能拼回去', !closedParsed.error && closedParsed.parsed.text && closedParsed.parsed.studs && closedParsed.parsed.antenna && closedParsed.parsed.characters.value === 1, closedParsed.error || Object.keys(closedParsed.parsed || {}).join(','));
  let protoThrew = '';
  let protoMerged = null;
  try {
    protoMerged = mergeChecklist({}, JSON.parse('{"__proto__":{"value":1},"mouth":{"value":false,"seen":"下半部分光滑","reason":"没有嘴"}}'));
  } catch (e) {
    protoThrew = e.message;
  }
  check('__proto__ 不会让合并崩掉', !protoThrew && protoMerged?.mouth?.value === false, protoThrew || JSON.stringify(protoMerged?.mouth));
  const pole = reconcileChecklist('character', {...pass, antenna: {value: true, seen: '头顶是圆顶，正中央一根细杆，杆顶一个小球', reason: '有杆'}});
  check('描述里的细杆不会把 true 改成 false', hardFails('character', pole).some((h) => h.code === 'antenna'));
  const mouthLie = reconcileChecklist('character', {...pass, mouth: {value: false, seen: '眼睛下面有一条弧线嘴', reason: '布尔值说没有'}});
  const studsLie = reconcileChecklist('frame', judgeBody('frame', {studs: {value: false, seen: '方块顶面一排排小圆柱凸点', reason: '布尔值说没有'}}));
  const textLie = reconcileChecklist('frame', judgeBody('frame', {text: {value: false, reason: '右下角有 Samsung 字样和中文角标'}}));
  check(
    '描述可疑不再拿掉布尔值',
    mouthLie.mouth.value === false && verdictOf('character', mouthLie) === 'pass' && suspectedKeys('character', mouthLie).includes('mouth') &&
      studsLie.studs.value === false && verdictOf('frame', studsLie) === 'pass' && suspectedKeys('frame', studsLie).includes('studs') &&
      textLie.text.value === false && verdictOf('frame', textLie) === 'pass' && suspectedKeys('frame', textLie).includes('text'),
    JSON.stringify({mouth: mouthLie.mouth, studs: suspectedKeys('frame', studsLie), text: suspectedKeys('frame', textLie)}),
  );
  const likeLego = reconcileChecklist('material', judgeBody('material', {ip: {value: false, like: '乐高', reason: '像乐高'}}));
  check('自由文本里的品牌名不是 IP 硬伤', hardFails('material', likeLego).every((h) => h.code !== 'ip') && verdictOf('material', likeLego) === 'pass', JSON.stringify(hardFails('material', likeLego)));
  const denialReasons = [
    '不具备乐高，不具备Minecraft，不具备吉卜力，不具备皮克斯，不具备迪士尼，不具备Aardman，不具备纪念碑谷',
    '不像乐高，也非 Minecraft',
    '没有乐高、吉卜力、像素方块的特征',
    '没有乐高人仔或凸点砖、Minecraft像素方块、吉卜力/皮克斯/迪士尼角色、Aardman/小羊肖恩黏土，也没有纪念碑谷的几何错觉风格。',
    '只是普通木质和漆面方块，不符合乐高/Minecraft/吉卜力/皮克斯/迪士尼/Aardman/纪念碑谷的任何一种风格',
    '区别于乐高',
    'Unlike LEGO',
    '像乐高积木但没有人仔',
    '是吉卜力',
  ];
  const denialHits = denialReasons.filter((reason) => {
    const row = reconcileChecklist('character', {...pass, ip: {value: false, like: reason, reason}});
    return hardFails('character', row).some((h) => h.code === 'ip') || verdictOf('character', row) !== 'pass';
  });
  check('理由和 like 里的否定名单不再扫成 IP', denialHits.length === 0, denialHits.join(' | '));
  const ipTrue = reconcileChecklist('character', {...pass, ip: {value: true, like: '乐高', reason: '像乐高'}});
  check('第一轮 ip=true 是硬伤', hardFails('character', ipTrue).some((h) => h.code === 'ip') && verdictOf('character', ipTrue) === 'fail');
  const denied = reconcileChecklist('material', judgeBody('material', {objects: {value: 0, names: [], reason: '画面里没有房子、太阳、月亮、拱门、杯子、盒子、灯，是一张空白纸'}}));
  check('否定清单不会把物件抬高', denied.objects.value === 0 && hardFails('material', denied).some((h) => h.code === 'blank'), JSON.stringify(denied.objects));
  const noNames = reconcileChecklist('material', judgeBody('material', {objects: {value: 4, reason: '杯子、盒子、灯、植物'}}));
  check('没给 names 不当成 0 个物件', noNames.objects.value == null && verdictOf('material', noNames) === 'unsure' && !hardFails('material', noNames).some((h) => h.code === 'blank'), JSON.stringify({value: noNames.objects.value, verdict: verdictOf('material', noNames)}));
  const lined = reconcileChecklist('material', judgeBody('material', {objects: {value: 1, names: ['线条杯子', '线条盒子', '线条灯', '线条花盆'], reason: '四件'}}));
  check('名字里带线条仍算物件，但和 value 矛盾时不放行', realObjectNames(lined.objects.names).length === 4 && verdictOf('material', lined) === 'unsure', JSON.stringify(lined.objects));
  const agreed = reconcileChecklist('material', judgeBody('material', {objects: {value: 4, names: ['线条杯子', '线条盒子', '线条灯', '线条花盆'], reason: '四件'}}));
  check('名字和 value 都不少于 3 时仍放行', agreed.objects.value === 4 && verdictOf('material', agreed) === 'pass', JSON.stringify(agreed.objects));
  const lowNames = reconcileChecklist('material', judgeBody('material', {objects: {value: 0, names: ['杯子', '盒子', '灯'], reason: '画面是空白纸'}}));
  check('value 小于 3 但名字不少于 3 是 unsure', verdictOf('material', lowNames) === 'unsure' && lowNames.objects.value == null, JSON.stringify(lowNames.objects));
  const highValue = reconcileChecklist('material', judgeBody('material', {objects: {value: 5, names: ['杯子', '盒子'], reason: '两件'}}));
  check('value 不少于 3 但名字少于 3 是 unsure', verdictOf('material', highValue) === 'unsure' && highValue.objects.value == null, JSON.stringify(highValue.objects));
  const genericNames = reconcileChecklist('material', judgeBody('material', {objects: {value: 3, names: ['东西', '物体', '形状', '图案', '元素', 'object', 'item', 'shape'], reason: '泛名'}}));
  check('泛名不计数，凑不满 3 个不放行', realObjectNames(genericNames.objects.names).length === 0 && verdictOf('material', genericNames) !== 'pass', JSON.stringify(genericNames.objects));
  const dupNames = reconcileChecklist('material', judgeBody('material', {objects: {value: 3, names: ['杯子', '杯子', '杯子'], reason: '三个杯子'}}));
  check('第一轮重复名字先去重再计数', realObjectNames(['杯子', '杯子', '杯子']).length === 1 && dupNames.objects.value == null && verdictOf('material', dupNames) === 'unsure', JSON.stringify(dupNames.objects));
  const paperNames = reconcileChecklist('material', judgeBody('material', {objects: {value: 3, names: ['纸', '白纸', '桌面'], reason: '三张都是空白的纸'}}));
  check('纸和白纸不算物件，桌面单独一个不够 3 个', realObjectNames(['纸', '白纸', '桌面']).join(',') === '桌面' && paperNames.objects.value == null && verdictOf('material', paperNames) === 'unsure', JSON.stringify(paperNames.objects));
  const textLeaks = ['墙上有数字 7', '右下角有一个 logo', '角落有品牌标志', '左上角有品牌名 Nike', '画面里有一行文本', '底部有签名', '底部有字幕条', '桌上有英文单词'];
  const studsLeaks = ['方块顶面有一排排小圆柱', '顶面有成排的小圆点', '顶面凸起的小圆粒', 'a stud on top of each block', '顶面有规则的颗粒', '顶面有一圈圆形凸起'];
  const mouthLeaks = ['眼睛下方有一道小缝', '眼睛下面有一条横线', '眼睛下面有一条细缝但不是嘴', '眼睛下面有一条弧线嘴没有表情', '脸的下半部分有一个小圆点', '眼睛下面有一个很小的口', 'a tiny smile under the eyes'];
  const antennaLeaks = ['头顶顶着一个小球', '头顶有一根小杆', '头顶有一个小圆球', '头顶中间有一颗小圆钉', '头顶有一根天线但不是很明显', '头顶有触角', '头顶有一个比头窄的小圆片', 'a small ball on a stick on top of the head', '头顶有不是很明显的天线'];
  const missed = [];
  for (const text of textLeaks) {
    const row = reconcileChecklist('character', {...pass, text: {value: false, reason: text}});
    if (verdictOf('character', row) !== 'pass' || !suspectedKeys('character', row).includes('text')) missed.push(text);
  }
  for (const seen of studsLeaks) {
    const row = reconcileChecklist('material', judgeBody('material', {studs: {value: false, seen, reason: '布尔值说没有'}}));
    if (verdictOf('material', row) !== 'pass' || !suspectedKeys('material', row).includes('studs')) missed.push(seen);
  }
  for (const seen of mouthLeaks) {
    const row = reconcileChecklist('character', {...pass, mouth: {value: false, seen, reason: '布尔值说没有'}});
    if (verdictOf('character', row) !== 'pass' || !suspectedKeys('character', row).includes('mouth')) missed.push(seen);
  }
  for (const seen of antennaLeaks) {
    const row = reconcileChecklist('character', {...pass, antenna: {value: false, seen, reason: '布尔值说没有'}});
    if (verdictOf('character', row) !== 'pass' || !suspectedKeys('character', row).includes('antenna')) missed.push(seen);
  }
  check('漏网说法只进入追问名单，不再直接判死', missed.length === 0, missed.join(' | '));
  const clearSecond = (over = {}) => ({...secondClear('character'), ...over});
  const hitLego = judgeSecondOpinion('character', clearSecond({resembles: '乐高'}));
  check('resembles 命中名单是 ip 硬伤', hitLego.verdict === 'fail' && hitLego.code === 'ip' && hitLego.fails.some((item) => item.code === 'ip'), JSON.stringify(hitLego));
  const hitContains = judgeSecondOpinion('character', clearSecond({resembles: '很像 LEGO 积木'}));
  check('resembles 包含名单上的名字是 ip 硬伤', hitContains.verdict === 'fail' && hitContains.code === 'ip', JSON.stringify(hitContains));
  const hitSentence = judgeSecondOpinion('material', {...secondClear('material'), resembles: '没有乐高'});
  check('resembles 写成没有乐高仍算命中', hitSentence.verdict === 'fail' && hitSentence.code === 'ip', JSON.stringify(hitSentence));
  const outside = judgeSecondOpinion('character', clearSecond({resembles: '海绵宝宝'}));
  check('resembles 名单外的具体名字是 unsure', outside.verdict === 'unsure' && outside.reason.includes('海绵宝宝'), JSON.stringify(outside));
  const noneOk = ['无', '没有', 'none', 'None.', '无。'].map((name) => judgeSecondOpinion('frame', {...secondClear('frame'), resembles: name}));
  check('resembles 写无、none、没有不影响', noneOk.every((row) => row.verdict === 'pass'), noneOk.map((row) => row.verdict).join(','));
  const vagueName = judgeSecondOpinion('character', clearSecond({resembles: '不知道'}));
  const missingName = judgeSecondOpinion('character', (() => {
    const row = clearSecond();
    delete row.resembles;
    return row;
  })());
  check('resembles 含糊或没写是 unsure', vagueName.verdict === 'unsure' && missingName.verdict === 'unsure' && classifyResembles({resembles: '海绵宝宝'}).kind === 'specific', JSON.stringify({vague: vagueName.reason, missing: missingName.reason}));
  check('专项追问所有 kind 都问 resembles', ['character', 'material', 'frame'].every((kind) => {
    const prompt = secondOpinionPrompt(kind);
    return prompt.includes('resembles') && prompt.includes('只写一个名字') && prompt.includes('写「无」');
  }));
  const half = summarizeCalibration([
    {file: 'a.jpg', human: 'fail', judge: 'unsure', hard: [], humanReasons: ['mouth']},
    {file: 'b.jpg', human: 'fail', judge: 'unsure', hard: [], humanReasons: ['antenna']},
    {file: 'c.jpg', human: 'pass', judge: 'pass', hard: []},
  ]);
  check('人标 fail 里 unsure 超过 25% 汇总结论无效', half.invalid === true && half.conclusion === '无效：模型没答完的太多' && half.humanFailUnsure === 2, JSON.stringify({invalid: half.invalid, conclusion: half.conclusion, humanFailUnsure: half.humanFailUnsure}));
  const holeRows = [];
  for (let i = 0; i < 12; i++) holeRows.push({file: `f${i}.jpg`, human: 'fail', judge: i === 0 ? 'fail' : 'unsure', hard: i === 0 ? ['mouth'] : [], humanReasons: ['mouth']});
  for (let i = 0; i < 12; i++) holeRows.push({file: `p${i}.jpg`, human: 'pass', judge: 'pass', hard: []});
  const hole = summarizeCalibration(holeRows);
  check('人标 fail 里 unsure 没到全部行数一半也判无效', hole.invalid === true && hole.conclusion === '无效：模型没答完的太多' && hole.humanFailUnsure === 11 && hole.humanFail === 1 && hole.recall === 1, JSON.stringify({invalid: hole.invalid, humanFail: hole.humanFail, humanFailUnsure: hole.humanFailUnsure, recall: hole.recall}));
  const quarter = summarizeCalibration([
    {file: 'a.jpg', human: 'fail', judge: 'unsure', hard: [], humanReasons: ['mouth']},
    {file: 'b.jpg', human: 'fail', judge: 'fail', hard: ['mouth'], humanReasons: ['mouth']},
    {file: 'c.jpg', human: 'fail', judge: 'fail', hard: ['mouth'], humanReasons: ['mouth']},
    {file: 'd.jpg', human: 'fail', judge: 'fail', hard: ['mouth'], humanReasons: ['mouth']},
  ]);
  check('人标 fail 里 unsure 正好 25% 仍有效', quarter.invalid === false && quarter.humanFailUnsure === 1 && quarter.conclusion === '', JSON.stringify({invalid: quarter.invalid, humanFailUnsure: quarter.humanFailUnsure}));
  const rootArg = ['D:', 'tmp'].join('\\');
  check('approve 不带 --root 也能解析 id', parseApproveArgs(['demo-ok']).id === 'demo-ok');
  check('approve id 在 --root 前面', parseApproveArgs(['demo-ok', '--root', rootArg]).id === 'demo-ok' && parseApproveArgs(['demo-ok', '--root', rootArg]).root === rootArg);
  check('approve id 在 --root 后面', parseApproveArgs(['--root', rootArg, 'demo-ok']).id === 'demo-ok');
  const badFile = goodStyle('demo-file');
  badFile.refs[0].file = 'refs/hero.jpg';
  badFile.refs[1].file = 'art/scene.jpg';
  check('refs 文件名必须是固定的两张', styleProblems(badFile, 'demo-file', {character, styles: {}, ipWords}).some((p) => p.includes('refs/character.jpg')));
  const swapped = goodStyle('demo-order');
  swapped.refs.reverse();
  check('refs 顺序必须先角色后材质', styleProblems(swapped, 'demo-order', {character, styles: {}, ipWords}).some((p) => p.includes('refs/character.jpg')));
  const badRole = goodStyle('demo-role');
  badRole.refs[0].role = '人物';
  badRole.refs[1].aspect = '4:3';
  check('refs 的 role 和 aspect 必须对', styleProblems(badRole, 'demo-role', {character, styles: {}, ipWords}).some((p) => p.includes('角色') && p.includes('1:1')));
  const escapeStyle = goodStyle('demo-escape');
  escapeStyle.refs[0].file = '../../escape-test/char.jpg';
  check('refs 拒绝跑出草稿目录', styleProblems(escapeStyle, 'demo-escape', {character, styles: {}, ipWords}).some((p) => p.includes('refs/character.jpg')));
}

// ───────── judge JSON 重试 ─────────
{
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    const content = n === 1 ? '这不是 JSON' : n === 2 ? JSON.stringify(judgeBody('character')) : JSON.stringify(secondClear('character'));
    return {ok: true, status: 200, text: async () => JSON.stringify(chat(content))};
  };
  const judged = await judgeImage({
    file: path.join(HERE, '..', '..', 'broll', 'styles', 'wood-blocks', 'refs', 'character.jpg'),
    kind: 'character',
    env: {MINIMAX_API_KEY: 'test-key-factory', MINIMAX_BASE_URL: 'http://127.0.0.1:9', BREWREEL_VISION_MODEL: 'MiniMax-M3'},
    fetchImpl,
    log: () => {},
  });
  check('非法 JSON 重试一次后通过', n === 3 && judged.pass && judged.attempts === 3 && judged.secondOpinions === 1, JSON.stringify({n, pass: judged.pass, attempts: judged.attempts, second: judged.secondOpinions, hard: judged.hard}));
}

// ───────── 缺字段：补问、三档、挑图、校准汇总 ─────────
{
  const picture = path.join(HERE, '..', '..', 'broll', 'styles', 'wood-blocks', 'refs', 'character.jpg');
  const judgeEnv = {MINIMAX_API_KEY: 'test-key-factory', MINIMAX_BASE_URL: 'http://127.0.0.1:9', BREWREEL_VISION_MODEL: 'MiniMax-M3'};
  const dropped = judgeBody('character');
  delete dropped.ip;
  delete dropped.mouth;
  delete dropped.antenna;
  delete dropped.characters;
  check('缺字段不是硬伤', hardFails('character', dropped).length === 0 && verdictOf('character', dropped) === 'unsure', JSON.stringify(hardFails('character', dropped)));
  const fullSoft = softScore('character', judgeBody('character'));
  const noClarity = judgeBody('character');
  delete noClarity.clarity;
  check('缺的软分不加不扣', softScore('character', noClarity) === fullSoft - 4, `${fullSoft} → ${softScore('character', noClarity)}`);

  const visionFetch = (contents) => {
    const prompts = [];
    let calls = 0;
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(init.body);
      prompts.push(body.messages[0].content.find((part) => part.type === 'text').text);
      const content = contents[Math.min(calls, contents.length - 1)];
      calls += 1;
      return {ok: true, status: 200, text: async () => JSON.stringify(chat(content))};
    };
    return {fetchImpl, prompts, count: () => calls};
  };
  const runJudgeKind = (kind, contents) => {
    const client = visionFetch(contents);
    return judgeImage({file: picture, kind, env: judgeEnv, fetchImpl: client.fetchImpl, log: () => {}}).then((judged) => ({judged, ...client}));
  };
  const runJudge = (contents) => runJudgeKind('character', contents);

  const missingMouth = judgeBody('character');
  delete missingMouth.mouth;
  const filled = await runJudge([
    missingMouth,
    {mouth: {value: false, seen: '只有两只眼睛，下半部分光滑', reason: '没有嘴'}, text: {value: true, reason: '有字'}},
    secondClear('character'),
  ]);
  check(
    '缺字段补问一次补齐后通过',
    filled.count() === 3 && filled.judged.verdict === 'pass' && filled.judged.pass && filled.judged.followups === 1 && filled.judged.secondOpinions === 1 && filled.judged.parsed.text.value === false && filled.judged.parsed.mouth.value === false,
    JSON.stringify({n: filled.count(), verdict: filled.judged.verdict, followups: filled.judged.followups, second: filled.judged.secondOpinions, text: filled.judged.parsed.text?.value, mouth: filled.judged.parsed.mouth?.value}),
  );
  check('补问点名缺的项', filled.prompts[1].includes('上次没回答这几项：mouth') && filled.prompts[1].includes('只补答这几项，其余不变'), filled.prompts[1].slice(-180));

  const missingAntenna = judgeBody('character');
  delete missingAntenna.antenna;
  const stillMissing = await runJudge([missingAntenna, missingAntenna, missingAntenna]);
  check(
    '补问两次仍缺是 unsure',
    stillMissing.count() === 3 && stillMissing.judged.verdict === 'unsure' && stillMissing.judged.followups === 2 && stillMissing.judged.pass === false && stillMissing.judged.hard.length === 0 && stillMissing.judged.reasons.some((line) => line.includes('这几项模型没回答：antenna')),
    JSON.stringify({n: stillMissing.count(), verdict: stillMissing.judged.verdict, followups: stillMissing.judged.followups, hard: stillMissing.judged.hard, reasons: stillMissing.judged.reasons.slice(0, 2)}),
  );

  const hurt = judgeBody('character', {mouth: {value: true, seen: '眼睛下面有一条弧线', reason: '有微笑'}});
  delete hurt.antenna;
  const hurtRun = await runJudge([hurt, judgeBody('character')]);
  check(
    '缺字段但已有硬伤是 fail',
    hurtRun.count() === 1 && hurtRun.judged.verdict === 'fail' && hurtRun.judged.followups === 0 && hurtRun.judged.secondOpinions === 0 && hurtRun.judged.hard.some((item) => item.code === 'mouth') && hurtRun.judged.hard.every((item) => item.code !== 'antenna'),
    JSON.stringify({n: hurtRun.count(), verdict: hurtRun.judged.verdict, followups: hurtRun.judged.followups, hard: hurtRun.judged.hard}),
  );

  const suspectedPass = await runJudge([
    judgeBody('character', {studs: {value: false, seen: '方块顶面有一排排小圆柱', reason: '布尔值说没有'}}),
    {...secondClear('character'), studs: {where: '顶面平整，没有成排小圆柱', answer: '没有'}},
  ]);
  check(
    '描述可疑的键被加进追问',
    suspectedPass.count() === 2 && suspectedPass.judged.secondOpinions === 1 && suspectedPass.prompts[1].includes('"studs"') && suspectedPass.prompts[1].includes('小圆点') && !secondOpinionPrompt('character').includes('"studs"'),
    suspectedPass.prompts[1].slice(0, 400),
  );
  check(
    '描述可疑但追问答没有 → pass',
    suspectedPass.judged.verdict === 'pass' && suspectedPass.judged.pass === true && suspectedPass.judged.hard.length === 0,
    JSON.stringify({verdict: suspectedPass.judged.verdict, hard: suspectedPass.judged.hard, n: suspectedPass.count()}),
  );
  const suspectedYes = await runJudge([
    judgeBody('character', {studs: {value: false, seen: '顶面有成排的小圆点', reason: '布尔值说没有'}}),
    {...secondClear('character'), studs: {where: '顶面有一排小圆点', answer: '有'}},
  ]);
  check(
    '追问可疑项答有就是硬伤',
    suspectedYes.judged.verdict === 'fail' && suspectedYes.judged.secondOpinions === 1 && suspectedYes.judged.hard.some((item) => item.code === 'studs'),
    JSON.stringify({verdict: suspectedYes.judged.verdict, hard: suspectedYes.judged.hard}),
  );
  const ipFirst = await runJudge([judgeBody('character', {ip: {value: true, like: '乐高', reason: '像乐高'}})]);
  check(
    '第一轮 ip=true 不追问直接 fail',
    ipFirst.count() === 1 && ipFirst.judged.verdict === 'fail' && ipFirst.judged.secondOpinions === 0 && ipFirst.judged.hard.some((item) => item.code === 'ip'),
    JSON.stringify({n: ipFirst.count(), verdict: ipFirst.judged.verdict, second: ipFirst.judged.secondOpinions, hard: ipFirst.judged.hard}),
  );
  const resembleHit = await runJudge([judgeBody('character'), {...secondClear('character'), resembles: '吉卜力'}]);
  check(
    '第二意见 resembles 命中名单是 fail',
    resembleHit.count() === 2 && resembleHit.judged.verdict === 'fail' && resembleHit.judged.secondOpinions === 1 && resembleHit.judged.hard.some((item) => item.code === 'ip'),
    JSON.stringify({n: resembleHit.count(), verdict: resembleHit.judged.verdict, hard: resembleHit.judged.hard}),
  );
  const resembleOther = await runJudge([judgeBody('character'), {...secondClear('character'), resembles: '海绵宝宝'}]);
  check(
    '第二意见名单外名字是 unsure 并写出像谁',
    resembleOther.judged.verdict === 'unsure' && resembleOther.judged.secondOpinions === 1 && resembleOther.judged.reasons.some((line) => line.includes('海绵宝宝')),
    JSON.stringify({verdict: resembleOther.judged.verdict, reasons: resembleOther.judged.reasons.slice(0, 2)}),
  );
  const resembleNone = await runJudge([judgeBody('character', {ip: {value: false, like: '乐高', reason: '没有乐高、吉卜力的特征'}}), secondClear('character')]);
  check(
    '自由文本点名乐高不影响，resembles 为无仍可通过',
    resembleNone.count() === 2 && resembleNone.judged.verdict === 'pass' && resembleNone.judged.hard.every((item) => item.code !== 'ip'),
    JSON.stringify({n: resembleNone.count(), verdict: resembleNone.judged.verdict, hard: resembleNone.judged.hard}),
  );

  const mustAsk = await runJudge([judgeBody('character'), secondClear('character')]);
  check(
    '第一轮无硬伤必追问',
    mustAsk.count() === 2 && mustAsk.judged.secondOpinions === 1 && mustAsk.judged.verdict === 'pass' && mustAsk.prompts[1].includes(SECOND_OPINION_MARK) && mustAsk.prompts[1].includes('先在 where'),
    JSON.stringify({n: mustAsk.count(), verdict: mustAsk.judged.verdict, second: mustAsk.judged.secondOpinions}),
  );
  const secondHit = await runJudge([
    judgeBody('character'),
    {head: {where: '头顶正中有一根杆', answer: '有'}, face: {where: '眼睛以下光滑', answer: '没有'}, text: {where: '没有字', answer: '没有'}, resembles: '无'},
  ]);
  check(
    '追问答有就是硬伤',
    secondHit.count() === 2 && secondHit.judged.verdict === 'fail' && secondHit.judged.secondOpinions === 1 && secondHit.judged.hard.some((item) => item.code === 'antenna') && secondHit.prompts[1].includes(SECOND_OPINION_MARK),
    JSON.stringify({n: secondHit.count(), verdict: secondHit.judged.verdict, second: secondHit.judged.secondOpinions, hard: secondHit.judged.hard}),
  );
  const secondVague = await runJudge([judgeBody('character'), {head: {where: '', answer: '有'}, face: {where: '眼睛以下光滑', answer: '可能有'}, text: {where: '没有字', answer: '没有'}, resembles: '无'}]);
  check('追问含糊是 unsure', secondVague.judged.verdict === 'unsure' && secondVague.judged.secondOpinions === 1, JSON.stringify({verdict: secondVague.judged.verdict, second: secondVague.judged.secondOpinions, reasons: secondVague.judged.reasons.slice(0, 2)}));
  const secondBadJson = await runJudge([judgeBody('character'), '这不是 JSON', '还是坏的']);
  check(
    '追问 JSON 坏了重试一次仍坏是 unsure',
    secondBadJson.count() === 3 && secondBadJson.judged.verdict === 'unsure' && secondBadJson.judged.secondOpinions === 1,
    JSON.stringify({n: secondBadJson.count(), verdict: secondBadJson.judged.verdict, second: secondBadJson.judged.secondOpinions}),
  );
  const otherRobot = judgeSecondOpinion('frame', {...secondClear('frame'), same: {where: '头变成了方块，还多了一张嘴', answer: '有'}});
  check('抽帧追问答有换成另一只是硬伤', otherRobot.verdict === 'fail' && otherRobot.fails.some((item) => item.code === 'sameCharacter'), JSON.stringify(otherRobot));
  const secondMaterial = await runJudgeKind('material', [
    judgeBody('material'),
    {objects: {where: '桌上三件', names: ['杯子', '盒子', '灯']}, text: {where: '没有字', answer: '没有'}, studs: {where: '表面平整', answer: '没有'}, resembles: '无'},
  ]);
  check('材质追问的物件清单本身不是硬伤', secondMaterial.judged.verdict === 'pass' && secondMaterial.judged.secondOpinions === 1, JSON.stringify({verdict: secondMaterial.judged.verdict, hard: secondMaterial.judged.hard}));
  const secondBadList = await runJudgeKind('material', [
    judgeBody('material'),
    {objects: {where: '说不清'}, text: {where: '没有字', answer: '没有'}, studs: {where: '表面平整', answer: '没有'}},
  ]);
  check('材质追问的 names 不是数组是 unsure', secondBadList.judged.verdict === 'unsure', JSON.stringify({verdict: secondBadList.judged.verdict}));
  const blankSecond = async (title, names, where) => {
    const row = await runJudgeKind('material', [
      judgeBody('material'),
      {objects: {where, names}, text: {where: '没有字', answer: '没有'}, studs: {where: '表面平整', answer: '没有'}, resembles: '无'},
    ]);
    check(title, row.judged.verdict === 'fail' && row.judged.hard.some((item) => item.code === 'blank'), JSON.stringify({verdict: row.judged.verdict, hard: row.judged.hard}));
  };
  await blankSecond('第二意见 names 为空数组是 blank', [], '几乎空白');
  await blankSecond('第二意见 names 只有线条是 blank', ['线条'], '只有线条');
  await blankSecond('第二意见三个杯子去重后不足 3 个是 blank', ['杯子', '杯子', '杯子'], '三个杯子');
  await blankSecond('第二意见纸、白纸、桌面去泛名后不足 3 个是 blank', ['纸', '白纸', '桌面'], '三张都是空白的纸');

  const passRow = {file: 'b.jpg', verdict: 'pass', pass: true, hard: [], soft: 3};
  const unsureRow = {file: 'a.jpg', verdict: 'unsure', pass: false, hard: [], soft: 18, missing: ['antenna']};
  check('挑图 pass 优先于 unsure', pickOf([unsureRow, passRow])?.file === 'b.jpg');
  const unsureLow = {file: 'c.jpg', verdict: 'unsure', soft: 4, missing: ['mouth']};
  const unsureHigh = {file: 'd.jpg', verdict: 'unsure', soft: 9, missing: ['mouth']};
  const unsurePick = pickOf([unsureLow, unsureHigh]);
  check('全 unsure 选软分高的', unsurePick?.file === 'd.jpg' && unsurePick?.verdict === 'unsure');
  check('全 fail 不选', pickOf([{file: 'e.jpg', verdict: 'fail', pass: false, hard: [{code: 'mouth'}], soft: 10}]) == null);

  const stats = summarizeCalibration([
    {file: 'a.jpg', human: 'fail', judge: 'fail', hard: ['mouth'], humanReasons: ['mouth'], followups: 0},
    {file: 'b.jpg', human: 'fail', judge: 'unsure', hard: [], humanReasons: ['antenna'], followups: 2},
    {file: 'c.jpg', human: 'pass', judge: 'unsure', best: true, hard: [], followups: 2},
    {file: 'd.jpg', human: 'pass', judge: 'fail', hard: ['text'], followups: 0},
    {file: 'e.jpg', human: 'pass', judge: 'pass', best: true, hard: [], followups: 1},
  ]);
  check('unsure 不进硬伤召回', stats.humanFail === 1 && stats.recalled === 1 && stats.recall === 1, JSON.stringify(stats));
  check('unsure 不算误杀也不算 best 误杀', stats.falseKill === 1 && stats.bestKill === 0 && stats.falseKillFiles[0] === 'd.jpg');
  check('校准汇总单列 unsure', stats.unsure === 2 && stats.unsureFiles.includes('b.jpg') && stats.unsureFiles.includes('c.jpg') && stats.followups === 5 && stats.humanFailUnsure === 1, JSON.stringify({unsure: stats.unsure, files: stats.unsureFiles, followups: stats.followups, humanFailUnsure: stats.humanFailUnsure}));

  const root = prepRoot();
  let rewrites = 0;
  const server = await startServer(({url, body}) => {
    if (url.startsWith('/file/')) return {bin: jpg};
    if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${server.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
    if (url.includes('/v1/chat/completions')) {
      if (isSecond(body)) return {json: chat(secondClear(kindOf(body) || 'frame'))};
      if (kindOf(body) === 'character') {
        const partial = judgeBody('character');
        delete partial.antenna;
        delete partial.mouth;
        return {json: chat(partial)};
      }
      return {json: judgeReply(body)};
    }
    if (url.includes('/llm/chat/completions')) {
      if (body.includes('你改一条英文出图提示')) rewrites += 1;
      const id = (body.match(/id：([a-z0-9-]+)/) || [])[1] || 'demo-unsure';
      return {json: chat(goodStyle(id))};
    }
    return {status: 404, json: {}};
  });
  const unsureRun = await runNewStyle({root, env: envFor(server.port), log: () => {}, yes: true, id: 'demo-unsure', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', n: 1, retries: 1, retryDelayMs: 0, pollMs: 1, sleep: async () => {}});
  const unsureReport = readJson(path.join(root, 'broll', 'styles', '_drafts', 'demo-unsure', 'report.json'));
  const unsureHtml = fs.readFileSync(path.join(root, 'broll', 'styles', '_drafts', 'demo-unsure', 'review.html'), 'utf8');
  check(
    '全 unsure 时选中并在汇总页标需要人看',
    unsureRun.exitCode === 0 &&
      rewrites === 0 &&
      unsureReport.needsHuman === true &&
      unsureReport.attention === '需要人看' &&
      String(unsureReport.conclusion).includes('需要人看') &&
      unsureReport.character?.picked === 'refs/character.jpg' &&
      unsureReport.character?.needsHuman === true &&
      unsureReport.character.rows[0].verdict === 'unsure' &&
      unsureHtml.includes('class="alert"') &&
      unsureHtml.includes('需要人看') &&
      unsureHtml.includes('#f5c518'),
    `${unsureRun.exitCode} ${unsureRun.error || unsureRun.conclusion} rewrites=${rewrites} picked=${unsureReport.character?.picked} verdict=${unsureReport.character?.rows?.[0]?.verdict}`,
  );
  await server.close();
  fs.rmSync(root, {recursive: true, force: true});
}

// ───────── 假服务器上的工厂 ─────────
{
  const root = prepRoot();
  const logs = [];
  const log = (s) => logs.push(String(s));
  let drafts = 0;
  const server = await startServer(({url, body}) => {
    if (url.startsWith('/file/')) return {bin: jpg};
    if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${server.port}/file/a.jpg`]}, base_resp: {status_code: 0, status_msg: 'success'}}};
    if (url.includes('/v2/video_generation') && !url.includes('/query/')) return {json: {task_id: 'task-1', base_resp: {status_code: 0, status_msg: 'success'}}};
    if (url.includes('/v2/query/')) return {json: {task: {status: 'succeeded', content: {url: `http://127.0.0.1:${server.port}/file/v.mp4`}, duration: 4}, base_resp: {status_code: 0}}};
    if (url.includes('/v1/chat/completions')) return {json: judgeReply(body)};
    if (url.includes('/llm/chat/completions')) {
      drafts += 1;
      const id = (body.match(/id：([a-z0-9-]+)/) || [])[1] || 'demo-ok';
      if (drafts === 1) return {json: chat(goodStyle(id, '水彩绘本'))};
      return {json: chat({prompt: `${goodStyle(id).refs[0].prompt} Soft paper grain.`})};
    }
    return {status: 404, json: {error: 'no'}};
  });
  const env = envFor(server.port);
  const common = {root, env, log, yes: true, n: 1, retries: 1, retryDelayMs: 0, pollMs: 1, sleep: async () => {}};

  const badRoot = prepRoot();
  let badDrafts = 0;
  const badServer = await startServer(({url}) => {
    if (url.includes('/llm/chat/completions')) {
      badDrafts += 1;
      return {json: chat({look: '只有一句'})};
    }
    return {status: 404, json: {error: 'no'}};
  });
  let badError = '';
  try {
    await runNewStyle({root: badRoot, env: envFor(badServer.port), log: () => {}, yes: true, id: 'demo-bad', name: '坏例子', desc: '说不清', n: 1, retries: 0, retryDelayMs: 0});
  } catch (e) {
    badError = e.message;
  }
  check('写配置回喂 3 轮后停下', badDrafts === 3 && badError.includes('3 轮'), `calls=${badDrafts} ${badError}`);
  await badServer.close();

  const ipRoot = prepRoot();
  let ipBodies = [];
  const ipServer = await startServer(({url, body}) => {
    if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${ipServer.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
    if (url.startsWith('/file/')) return {bin: jpg};
    if (url.includes('/v1/chat/completions')) return {json: judgeReply(body)};
    if (url.includes('/llm/chat/completions')) {
      ipBodies.push(body);
      const id = (body.match(/id：([a-z0-9-]+)/) || [])[1] || 'demo-ip2';
      if (ipBodies.length === 1) {
        const bad = goodStyle(id);
        bad.look = '皮克斯一样的柔光';
        return {json: chat(bad)};
      }
      return {json: chat(goodStyle(id))};
    }
    return {status: 404, json: {}};
  });
  const ipRun = await runNewStyle({root: ipRoot, env: envFor(ipServer.port), log: () => {}, yes: true, id: 'demo-ip2', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', n: 1, retries: 0, retryDelayMs: 0, pollMs: 1, sleep: async () => {}});
  check('IP 词回喂后第二轮通过', ipRun.exitCode === 0 && ipBodies.length === 2 && ipBodies[1].includes('皮克斯'), `exit=${ipRun.exitCode} rounds=${ipBodies.length} ${ipRun.error || ''}`);
  await ipServer.close();

  let characterJudges = 0;
  const retryServer = await startServer(({url, body}) => {
    if (url.startsWith('/file/')) return {bin: jpg};
    if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${retryServer.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
    if (url.includes('/v1/chat/completions')) {
      if (isSecond(body)) return {json: chat(secondClear(kindOf(body) || 'frame'))};
      const kind = kindOf(body);
      if (kind === 'character') {
        characterJudges += 1;
        if (characterJudges <= 2) return {json: chat(judgeBody('character', {antenna: {value: true, seen: '头顶正中有一个小圆钮', reason: '有钮'}}))};
      }
      return {json: chat(judgeBody(kind))};
    }
    if (url.includes('/llm/chat/completions')) {
      const id = (body.match(/id：([a-z0-9-]+)/) || [])[1] || 'demo-retry';
      if (body.includes('你改一条英文出图提示')) return {json: chat({prompt: `${goodStyle(id).refs[0].prompt} Soft paper grain.`})};
      return {json: chat(goodStyle(id))};
    }
    return {status: 404, json: {}};
  });
  const retryRoot = prepRoot();
  const retry = await runNewStyle({root: retryRoot, env: envFor(retryServer.port), log: () => {}, yes: true, id: 'demo-retry', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', n: 2, retries: 1, retryDelayMs: 0, pollMs: 1, sleep: async () => {}});
  const retryReport = readJson(path.join(retryRoot, 'broll', 'styles', '_drafts', 'demo-retry', 'report.json'));
  check('有硬伤就改提示再出一轮并挑过的', retry.exitCode === 0 && String(retryReport.character?.picked).includes('.r2.'), `${retry.exitCode} ${retryReport.character?.picked} ${retry.error || ''}`);
  check('重出的提示写回 style.json', readJson(path.join(retryRoot, 'broll', 'styles', '_drafts', 'demo-retry', 'style.json')).refs[0].prompt.includes('Soft paper grain.'));
  await retryServer.close();

  const framesMade = [];
  const video = await runNewStyle({
    ...common,
    id: 'demo-video',
    name: '水彩绘本',
    desc: '水彩晕染、纸纹、柔和暖色',
    video: true,
    extractFrames: ({outDir}) => {
      fs.mkdirSync(outDir, {recursive: true});
      const files = [];
      for (let i = 0; i < 8; i++) {
        const dest = path.join(outDir, `f${String(i).padStart(2, '0')}.jpg`);
        fs.writeFileSync(dest, jpg);
        files.push(dest);
      }
      framesMade.push(files.length);
      return files;
    },
  });
  const videoCalls = server.calls.map((c) => c.url);
  check('视频试拍走假 H3 并抽 8 帧', video.exitCode === 0 && video.videoPass === true && videoCalls.some((u) => u.includes('/v2/video_generation')) && framesMade[0] === 8, `${video.exitCode} ${video.conclusion} ${videoCalls.filter((u) => u.includes('/v2/')).join(',')}`);
  check('真调视频前打印积分和价目', logs.some((l) => l.includes('约 280 积分 / 按价目表约 2 元')));
  const before = server.calls.length;
  const again = await runNewStyle({...common, id: 'demo-video', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', video: true, extractFrames: () => []});
  check('断点续跑不重复调用', again.exitCode === 0 && server.calls.length === before, `新增 ${server.calls.length - before} 次 ${again.error || again.conclusion}`);
  const approved = approveInTest({root, id: 'demo-video', log: () => {}});
  const published = readJson(path.join(approved.dest, 'style.json'));
  check('批准后 status=stable 且参考图就位', published.status === 'stable' && published.default === false && fs.existsSync(path.join(approved.dest, 'refs', 'character.jpg')) && fs.existsSync(path.join(approved.dest, 'refs', 'material.jpg')));
  check('参考图说明写了打分', fs.readFileSync(path.join(approved.dest, 'refs', 'README.md'), 'utf8').includes('角色'));

  fs.mkdirSync(path.join(root, 'broll', 'styles', '_hidden'), {recursive: true});
  fs.writeFileSync(path.join(root, 'broll', 'styles', '_hidden', 'style.json'), '{"id":"_hidden"}', 'utf8');
  fs.mkdirSync(path.join(root, 'broll', 'styles', '_drafts', 'ghost'), {recursive: true});
  fs.writeFileSync(path.join(root, 'broll', 'styles', '_drafts', 'ghost', 'style.json'), '{"id":"ghost"}', 'utf8');
  const loaded = Object.keys(loadStyles(root));
  const read = Object.keys(readStyles(root));
  check('loadStyles 忽略下划线目录', loaded.includes('demo-video') && !loaded.includes('_hidden') && !loaded.includes('_drafts') && !loaded.includes('ghost'), loaded.join(','));
  check('readStyles 同样忽略', read.includes('demo-video') && !read.some((id) => id.startsWith('_')), read.join(','));

  await server.close();
  fs.rmSync(root, {recursive: true, force: true});
  fs.rmSync(badRoot, {recursive: true, force: true});
  fs.rmSync(ipRoot, {recursive: true, force: true});
  fs.rmSync(retryRoot, {recursive: true, force: true});
}

// ───────── 闸门、批量、命令行 ─────────
{
  const root = prepRoot();
  let called = 0;
  const fetchImpl = async () => {
    called += 1;
    throw new Error('不该发请求');
  };
  const logs = [];
  const dry = await runNewStyle({
    root,
    id: 'demo-watercolor',
    name: '水彩绘本',
    desc: '水彩晕染、纸纹、柔和暖色',
    yes: false,
    video: false,
    env: {LLM_BASE_URL: 'https://api.deepseek.com', LLM_MODEL: 'deepseek-flash', MINIMAX_BASE_URL: 'https://api.minimaxi.com'},
    fetchImpl,
    log: (s) => logs.push(String(s)),
  });
  const text = logs.join('\n');
  check('没有 --yes 只打印请求', dry.exitCode === 0 && called === 0 && text.includes('POST') && text.includes('水彩晕染、纸纹、柔和暖色') && text.includes('没有发送') && text.includes('AI 助手不许替人运行 approve-style'), text.slice(0, 400));
  const videoLogs = [];
  const dryVideo = await runNewStyle({
    root,
    id: 'demo-watercolor',
    name: '水彩绘本',
    desc: '水彩晕染、纸纹、柔和暖色',
    yes: false,
    video: true,
    env: {LLM_BASE_URL: 'https://api.deepseek.com', LLM_MODEL: 'deepseek-flash', MINIMAX_BASE_URL: 'https://api.minimaxi.com'},
    fetchImpl,
    log: (s) => videoLogs.push(String(s)),
  });
  check('--video 但没有 --yes 不提交并报价', dryVideo.exitCode === 0 && called === 0 && videoLogs.join('\n').includes('约 280 积分 / 按价目表约 2 元'), videoLogs.join('\n').slice(0, 300));

  const server = await startServer(({url, body}) => {
    if (url.startsWith('/file/')) return {bin: jpg};
    if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${server.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
    if (url.includes('/v2/video_generation')) return {json: {task_id: 'should-not', base_resp: {status_code: 0}}};
    if (url.includes('/v1/chat/completions')) return {json: judgeReply(body)};
    if (url.includes('/llm/chat/completions')) {
      const id = (body.match(/id：([a-z0-9-]+)/) || [])[1] || 'demo-novideo';
      return {json: chat(goodStyle(id))};
    }
    return {status: 404, json: {}};
  });
  const noVideo = await runNewStyle({root, env: envFor(server.port), log: () => {}, yes: true, video: false, id: 'demo-novideo', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', n: 1, retries: 0, retryDelayMs: 0});
  check('有 --yes 没有 --video 不调 H3', noVideo.exitCode === 0 && server.calls.every((c) => !c.url.includes('/v2/video_generation')), server.calls.map((c) => c.url).join(','));
  const quiet = approveInTest({root, id: 'demo-novideo', log: () => {}});
  check('没做视频试拍则 experimental', readJson(path.join(quiet.dest, 'style.json')).status === 'experimental');
  let second = '';
  try {
    approveInTest({root, id: 'demo-novideo', log: () => {}});
  } catch (e) {
    second = e.message;
  }
  check('不覆盖已发布风格', second.includes('已经在了'));

  const batch = await runBatch({
    file: (() => {
      const p = path.join(root, 'batch.json');
      fs.writeFileSync(p, JSON.stringify([
        {id: 'BAD ID', name: '坏', desc: '缺格式'},
        {id: 'demo-batch', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色'},
      ]), 'utf8');
      return p;
    })(),
    root,
    env: envFor(server.port),
    log: () => {},
    yes: true,
    n: 1,
    retries: 0,
    retryDelayMs: 0,
  });
  check('批量一项失败不影响下一项', batch.exitCode === 1 && batch.rows[0].exitCode !== 0 && batch.rows[1].exitCode === 0 && fs.existsSync(path.join(root, 'broll', 'styles', '_drafts', 'demo-batch', 'review.html')), JSON.stringify(batch.rows.map((r) => [r.id, r.exitCode, r.conclusion])));
  await server.close();

  const script = path.join(ROOT, 'scripts', 'broll', 'new-style.mjs');
  const cliEnv = {...process.env, MINIMAX_BASE_URL: 'http://127.0.0.1:9'};
  delete cliEnv.MINIMAX_API_KEY;
  delete cliEnv.DEEPSEEK_API_KEY;
  delete cliEnv.LLM_API_KEY;
  const cli = spawnSync(process.execPath, [script, '--id', 'demo-watercolor', '--name', '水彩绘本', '--desc', '水彩晕染、纸纹、柔和暖色', '--root', root], {cwd: ROOT, env: cliEnv, encoding: 'utf8'});
  const cliOut = `${cli.stdout || ''}${cli.stderr || ''}`;
  check('命令行不加 --yes 退出 0', cli.status === 0 && cliOut.includes('POST') && cliOut.includes('/chat/completions') && cliOut.includes('没有发送') && cliOut.includes('AI 助手不许替人运行'), cliOut.slice(0, 500));
  const cliVideo = spawnSync(process.execPath, [script, '--id', 'demo-watercolor', '--name', '水彩绘本', '--desc', '水彩晕染、纸纹、柔和暖色', '--video', '--root', root], {cwd: ROOT, env: cliEnv, encoding: 'utf8'});
  const cliVideoOut = `${cliVideo.stdout || ''}${cliVideo.stderr || ''}`;
  check('命令行 --video 无 --yes 印出积分', cliVideo.status === 0 && cliVideoOut.includes('约 280 积分 / 按价目表约 2 元'), cliVideoOut.slice(0, 300));
  check('命令行试跑没有往仓库写草稿', !fs.existsSync(path.join(ROOT, 'broll', 'styles', '_drafts', 'demo-watercolor')));

  fs.rmSync(root, {recursive: true, force: true});
}

// ───────── T1c：闸门、续跑、打码、批准命令行 ─────────
{
  const picture = path.join(HERE, '..', '..', 'broll', 'styles', 'wood-blocks', 'refs', 'character.jpg');
  const dotted = 'secret.with.dots.KEY99';
  let redacted = '';
  try {
    await callVision({
      env: {MINIMAX_API_KEY: dotted, MINIMAX_BASE_URL: 'http://127.0.0.1:9'},
      model: 'MiniMax-M3',
      body: {},
      fetchImpl: async () => ({ok: false, status: 400, text: async () => JSON.stringify({error: {message: `bad ${dotted} and sk-not-a-real-key`}})}),
    });
  } catch (e) {
    redacted = `${e.message} ${e.body || ''}`;
  }
  check('看图报错先按 key 原文打码', redacted && !redacted.includes(dotted) && redacted.includes('***'), redacted.slice(0, 300));

  const bare = 'plainkey-not-sk-ABCDEFGH';
  let bareMsg = '';
  try {
    await callVision({
      env: {MINIMAX_API_KEY: bare, MINIMAX_BASE_URL: 'http://127.0.0.1:9'},
      model: 'MiniMax-M3',
      body: {},
      fetchImpl: async () => ({ok: false, status: 400, text: async () => JSON.stringify({error: {message: `echo ${bare}`}})}),
    });
  } catch (e) {
    bareMsg = e.message;
  }
  check('非 sk- 的 key 也不会进看图报错', bareMsg && !bareMsg.includes(bare), bareMsg.slice(0, 200));

  const nameMiss = judgeBody('material');
  delete nameMiss.objects.names;
  let nameCalls = 0;
  const nameJudged = await judgeImage({
    file: picture,
    kind: 'material',
    env: {MINIMAX_API_KEY: 'test-key-factory', MINIMAX_BASE_URL: 'http://127.0.0.1:9', BREWREEL_VISION_MODEL: 'MiniMax-M3'},
    fetchImpl: async () => {
      nameCalls += 1;
      return {ok: true, status: 200, text: async () => JSON.stringify(chat(nameMiss))};
    },
    log: () => {},
  });
  check('没给 names 补问后仍没有是 unsure', nameCalls === 3 && nameJudged.verdict === 'unsure' && nameJudged.hard.every((h) => h.code !== 'blank'), JSON.stringify({n: nameCalls, verdict: nameJudged.verdict, hard: nameJudged.hard, missing: nameJudged.missing}));

  const submitsOf = (calls) => calls.filter((c) => c.url.includes('/v2/video_generation') && !c.url.includes('/query/')).length;
  const videoServer = async (mode) => {
    const holder = {};
    holder.server = await startServer(({url, body}) => {
      if (url.startsWith('/file/')) {
        if (mode === 'bad-file' && url.includes('/v.mp4')) return {bin: Buffer.from('not-a-video')};
        return {bin: jpg};
      }
      if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${holder.server.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
      if (url.includes('/v2/video_generation') && !url.includes('/query/')) return {json: {task_id: 'task-1', base_resp: {status_code: 0}}};
      if (url.includes('/query/')) {
        if (mode === 'query-500') return {status: 500, json: {base_resp: {status_code: 1000, status_msg: 'down'}}};
        if (mode === 'failed') return {json: {task: {status: 'failed'}, base_resp: {status_code: 0}}};
        return {json: {task: {status: 'succeeded', content: {url: `http://127.0.0.1:${holder.server.port}/file/v.mp4`}, duration: 4}, base_resp: {status_code: 0}}};
      }
      if (url.includes('/v1/chat/completions')) return {json: judgeReply(body)};
      if (url.includes('/llm/chat/completions')) return {json: chat(goodStyle('demo-pay', '水彩绘本'))};
      return {status: 404, json: {}};
    });
    return holder.server;
  };

  const payRoot = prepRoot();
  const payServer = await videoServer('query-500');
  const payCommon = {root: payRoot, env: envFor(payServer.port), log: () => {}, yes: true, video: true, n: 1, retries: 0, retryDelayMs: 0, pollMs: 1, sleep: async () => {}, id: 'demo-pay', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', extractFrames: () => []};
  let payErr = '';
  try {
    await runNewStyle(payCommon);
  } catch (e) {
    payErr = e.message;
  }
  const payState = readJson(path.join(payRoot, 'broll', 'styles', '_drafts', 'demo-pay', 'state.json'));
  try {
    await runNewStyle(payCommon);
  } catch {
    /* 查询还是失败 */
  }
  check('查询一直 500 重跑不再 submit', submitsOf(payServer.calls) === 1 && payState.stages.video.taskId === 'task-1' && payState.stages.video.status === 'submitted' && payErr.includes('task id'), `submits=${submitsOf(payServer.calls)} state=${JSON.stringify(payState.stages.video)} ${payErr}`);
  await payServer.close();

  const badRoot = prepRoot();
  const badServer = await videoServer('bad-file');
  const badCommon = {
    ...payCommon,
    root: badRoot,
    env: envFor(badServer.port),
    id: 'demo-badfile',
    extractFrames: ({video}) => {
      throw new Error(`Error opening input file ${video}`);
    },
  };
  try {
    await runNewStyle(badCommon);
  } catch {
    /* 抽帧失败 */
  }
  try {
    await runNewStyle(badCommon);
  } catch {
    /* 再抽一次，仍然不提交 */
  }
  const badReport = fs.readFileSync(path.join(badRoot, 'broll', 'styles', '_drafts', 'demo-badfile', 'report.json'), 'utf8');
  const driveInText = new RegExp('[A-Za-z]:' + '\\\\');
  const accountName = ['Admin', 'istrator'].join('');
  check('下载坏文件后重跑不再 submit', submitsOf(badServer.calls) === 1 && fs.existsSync(path.join(badRoot, 'broll', 'styles', '_drafts', 'demo-badfile', 'video', 'clip.mp4')), `submits=${submitsOf(badServer.calls)}`);
  check('report 里的绝对路径改成相对草稿目录', !driveInText.test(badReport) && !badReport.includes(accountName), badReport.slice(0, 400));
  await badServer.close();

  const failRoot = prepRoot();
  const failServer = await videoServer('failed');
  const failCommon = {...payCommon, root: failRoot, env: envFor(failServer.port), id: 'demo-failed', extractFrames: () => []};
  let failErr = '';
  try {
    await runNewStyle(failCommon);
  } catch (e) {
    failErr = e.message;
  }
  try {
    await runNewStyle(failCommon);
  } catch (e) {
    failErr = e.message;
  }
  check('status=failed 重跑不再 submit', submitsOf(failServer.calls) === 1 && failErr.includes('--video-redo') && failErr.includes('280'), `submits=${submitsOf(failServer.calls)} ${failErr}`);
  const redoLogs = [];
  try {
    await runNewStyle({...failCommon, videoRedo: true, log: (s) => redoLogs.push(String(s)), extractFrames: ({outDir}) => {
      fs.mkdirSync(outDir, {recursive: true});
      return Array.from({length: 8}, (_, i) => {
        const dest = path.join(outDir, `f${i}.jpg`);
        fs.writeFileSync(dest, jpg);
        return dest;
      });
    }});
  } catch (e) {
    redoLogs.push(e.message);
  }
  check('--video-redo 才重新提交并写明还要花钱', submitsOf(failServer.calls) === 2 && redoLogs.some((l) => l.includes('--video-redo') && l.includes('280')), redoLogs.join('\n').slice(0, 400));
  await failServer.close();

  const ffRoot = prepRoot();
  const ffServer = await videoServer('ok');
  let ffErr = '';
  try {
    await runNewStyle({...payCommon, root: ffRoot, env: envFor(ffServer.port), id: 'demo-ff', ffmpegReady: () => false});
  } catch (e) {
    ffErr = e.message;
  }
  check('缺 ffmpeg 在提交前退出', ffErr.includes('ffmpeg') && submitsOf(ffServer.calls) === 0, `submits=${submitsOf(ffServer.calls)} ${ffErr}`);
  await ffServer.close();

  const humanRoot = prepRoot();
  let humanSubmits = 0;
  const humanServer = await startServer(({url, body}) => {
    if (url.startsWith('/file/')) return {bin: jpg};
    if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${humanServer.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
    if (url.includes('/v2/video_generation') && !url.includes('/query/')) {
      humanSubmits += 1;
      return {json: {task_id: 'task-h', base_resp: {status_code: 0}}};
    }
    if (url.includes('/query/')) return {json: {task: {status: 'succeeded', content: {url: `http://127.0.0.1:${humanServer.port}/file/v.mp4`}, duration: 4}, base_resp: {status_code: 0}}};
    if (url.includes('/v1/chat/completions')) {
      if (isSecond(body)) return {json: chat(secondClear(kindOf(body) || 'frame'))};
      const kind = kindOf(body);
      if (kind === 'character') {
        const partial = judgeBody('character');
        delete partial.antenna;
        delete partial.mouth;
        return {json: chat(partial)};
      }
      return {json: judgeReply(body)};
    }
    if (url.includes('/llm/chat/completions')) return {json: chat(goodStyle('demo-human'))};
    return {status: 404, json: {}};
  });
  const humanCommon = {root: humanRoot, env: envFor(humanServer.port), log: () => {}, yes: true, video: true, n: 1, retries: 0, retryDelayMs: 0, pollMs: 1, sleep: async () => {}, id: 'demo-human', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', extractFrames: ({outDir}) => {
    fs.mkdirSync(outDir, {recursive: true});
    return Array.from({length: 8}, (_, i) => {
      const dest = path.join(outDir, `f${i}.jpg`);
      fs.writeFileSync(dest, jpg);
      return dest;
    });
  }};
  const humanRun = await runNewStyle(humanCommon);
  const humanReport = readJson(path.join(humanRoot, 'broll', 'styles', '_drafts', 'demo-human', 'report.json'));
  check('参考图 unsure 不提交视频', humanSubmits === 0 && humanReport.needsHuman === true && humanReport.video?.skipped === '参考图有项目模型没答完，需要人看', JSON.stringify({submits: humanSubmits, skipped: humanReport.video?.skipped, exit: humanRun.exitCode}));
  const humanLater = await runNewStyle({...humanCommon, humanOk: true});
  check('--human-ok 才允许提交视频', humanSubmits === 1 && humanLater.videoPass === true, `submits=${humanSubmits} ${humanLater.conclusion} ${humanLater.error || ''}`);
  let humanApprove = '';
  try {
    approveInTest({root: humanRoot, id: 'demo-human', log: () => {}});
  } catch (e) {
    humanApprove = e.message;
  }
  check('needsHuman 没输入 yes 不批准', humanApprove.includes('yes'), humanApprove);
  await humanServer.close();

  const keyRoot = prepRoot();
  const fromFile = path.join(keyRoot, 'from.jpg');
  fs.writeFileSync(fromFile, jpg);
  let keyCalls = 0;
  let keyErr = '';
  const keyEnv = envFor(9);
  delete keyEnv.DEEPSEEK_API_KEY;
  delete keyEnv.LLM_API_KEY;
  try {
    await runNewStyle({root: keyRoot, env: keyEnv, log: () => {}, yes: true, id: 'demo-nokey', name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色', from: fromFile, n: 1, retries: 0, fetchImpl: async () => {
      keyCalls += 1;
      return {ok: false, status: 500, text: async () => 'no'};
    }});
  } catch (e) {
    keyErr = e.message;
  }
  check('缺 DeepSeek key 在发请求前退出', keyCalls === 0 && keyErr.includes('DEEPSEEK_API_KEY'), `calls=${keyCalls} ${keyErr}`);

  const batchRoot = prepRoot();
  const batchFile = path.join(batchRoot, 'batch.json');
  fs.writeFileSync(batchFile, JSON.stringify([1, 2, 3, 4].map((n) => ({id: `demo-b${n}`, name: '水彩绘本', desc: '水彩晕染、纸纹、柔和暖色'}))), 'utf8');
  const batchLogs = [];
  let batchErr = '';
  let batchCalls = 0;
  try {
    await runBatch({
      file: batchFile,
      root: batchRoot,
      env: envFor(9),
      yes: true,
      video: true,
      n: 1,
      retries: 0,
      log: (s) => batchLogs.push(String(s)),
      fetchImpl: async () => {
        batchCalls += 1;
        return {ok: false, status: 500, text: async () => 'no'};
      },
    });
  } catch (e) {
    batchErr = e.message;
  }
  check('批量视频开跑前打印合计并按 --max-video 停下', batchErr.includes('超过 --max-video') && batchLogs.some((l) => l.includes('4 项') && l.includes('合计')) && batchCalls === 0, `${batchErr} ${batchLogs.join(' | ')}`);

  const approveRoot = prepRoot();
  const plant = (id, extra = {}) => {
    const dir = path.join(approveRoot, 'broll', 'styles', '_drafts', id);
    fs.mkdirSync(path.join(dir, 'selected'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'selected', 'character.jpg'), jpg);
    fs.writeFileSync(path.join(dir, 'selected', 'material.jpg'), jpg);
    const style = goodStyle(id);
    if (extra.files) {
      style.refs[0].file = extra.files[0];
      style.refs[1].file = extra.files[1];
    }
    fs.writeFileSync(path.join(dir, 'style.json'), JSON.stringify(style), 'utf8');
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({id, conclusion: extra.conclusion || '等人审', needsHuman: !!extra.needsHuman, error: extra.error || undefined, character: {picked: 'refs/character.jpg', rows: []}, material: {picked: 'refs/material.jpg', rows: []}}), 'utf8');
    fs.writeFileSync(path.join(dir, 'review.html'), '<p>结论：等人审</p>', 'utf8');
  };
  plant('demo-cli');
  const approveScript = path.join(ROOT, 'scripts', 'broll', 'approve-style.mjs');
  const denied = spawnSync(process.execPath, [approveScript, 'demo-cli', '--root', approveRoot], {encoding: 'utf8'});
  check('非 TTY 拒绝 approve', denied.status === 2 && `${denied.stdout || ''}${denied.stderr || ''}`.includes('这一步只能人在终端里自己跑'), `${denied.status} ${denied.stdout}`);
  const allowed = spawnSync(process.execPath, [approveScript, 'demo-cli', '--root', approveRoot], {encoding: 'utf8', env: {...process.env, BREWREEL_APPROVE_TEST: '1'}});
  check('测试变量放行且 id 在 --root 前能批准', allowed.status === 0 && fs.existsSync(path.join(approveRoot, 'broll', 'styles', 'demo-cli', 'style.json')), `${allowed.status} ${allowed.stdout}`);
  plant('demo-cli2');
  const flipped = spawnSync(process.execPath, [approveScript, '--root', approveRoot, 'demo-cli2'], {encoding: 'utf8', env: {...process.env, BREWREEL_APPROVE_TEST: '1'}});
  check('测试变量放行且 id 在 --root 后能批准', flipped.status === 0 && fs.existsSync(path.join(approveRoot, 'broll', 'styles', 'demo-cli2', 'style.json')), `${flipped.status} ${flipped.stdout}`);
  plant('demo-err', {error: '写到一半崩了'});
  const errored = spawnSync(process.execPath, [approveScript, 'demo-err', '--root', approveRoot], {encoding: 'utf8', env: {...process.env, BREWREEL_APPROVE_TEST: '1'}});
  check('report 有 error 不批准', errored.status === 2 && `${errored.stdout || ''}`.includes('报错了') && !fs.existsSync(path.join(approveRoot, 'broll', 'styles', 'demo-err')), `${errored.status} ${errored.stdout}`);
  plant('demo-badrefs', {files: ['refs/robot.jpg', 'art/scene.jpg']});
  const badRefs = spawnSync(process.execPath, [approveScript, 'demo-badrefs', '--root', approveRoot], {encoding: 'utf8', env: {...process.env, BREWREEL_APPROVE_TEST: '1'}});
  check('approve 前核对 refs 文件名', badRefs.status === 2 && `${badRefs.stdout || ''}`.includes('refs/character.jpg'), `${badRefs.status} ${badRefs.stdout}`);

  const labelsFile = path.join(HERE, 'fixtures', 'calibration-labels.json');
  const cal = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'broll', 'judge-calibrate.mjs'), labelsFile], {
    encoding: 'utf8',
    cwd: ROOT,
    env: {...process.env, MINIMAX_API_KEY: '', MINIMAX_BASE_URL: 'http://127.0.0.1:9'},
  });
  const calOut = `${cal.stdout || ''}${cal.stderr || ''}`;
  check('校准没有 --yes 不调接口', cal.status === 0 && calOut.includes('没有 --yes') && calOut.includes('标注 2 张') && !calOut.includes('连通性'), calOut.slice(0, 300));

  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-privacy-'));
  try {
    const leak = ['C:', 'Users', ['Admin', 'istrator'].join(''), ['App', 'Data'].join(''), 'leak'].join('\\\\');
    fs.mkdirSync(path.join(probe, 'broll', 'styles', '_drafts'), {recursive: true});
    fs.mkdirSync(path.join(probe, 'docs', '_drafts'), {recursive: true});
    fs.writeFileSync(path.join(probe, 'broll', 'styles', '_drafts', 'report.json'), `${leak}\n`, 'utf8');
    const skipped = scanRoot(probe, {denylistRules: []});
    check('privacy-scan 只跳过 broll/styles/_drafts', skipped.length === 0, JSON.stringify(skipped));
    fs.writeFileSync(path.join(probe, 'docs', '_drafts', 'note.txt'), `${leak}\n`, 'utf8');
    const hitFiles = scanRoot(probe, {denylistRules: []}).map((hit) => hit.file.split(/[/\\]/).join('/'));
    check('别处的 _drafts 照扫', hitFiles.some((file) => file.includes('docs/_drafts')) && hitFiles.every((file) => !file.includes('broll/styles/_drafts')), hitFiles.join(','));
  } finally {
    fs.rmSync(probe, {recursive: true, force: true});
  }

  const gateCode = `import {approveStyle} from './scripts/broll/style-factory.mjs';
try {
  approveStyle({root: process.env.BREWREEL_GATE_ROOT, id: 'no-such-style', log: () => {}});
  console.log('NO_THROW');
} catch (e) {
  console.log(e.message);
}`;
  const gateOn = (root, envOn, extra = {}) => {
    const env = {...process.env, ...extra, BREWREEL_GATE_ROOT: root};
    if (envOn) env.BREWREEL_APPROVE_TEST = '1';
    else delete env.BREWREEL_APPROVE_TEST;
    return spawnSync(process.execPath, ['--input-type=module', '-e', gateCode], {encoding: 'utf8', cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe']});
  };
  const gateReal = gateOn(ROOT, true);
  check('approveStyle 指向真仓库一律拒绝', `${gateReal.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateReal.status} ${gateReal.stdout} ${gateReal.stderr}`);
  const gateTmp = gateOn(approveRoot, true);
  check('approveStyle 测试绕过只在测试标记目录生效', `${gateTmp.stdout || ''}`.includes('没有草稿') && !`${gateTmp.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateTmp.stdout} ${gateTmp.stderr}`);
  const gateNoEnv = gateOn(approveRoot, false);
  check('approveStyle 非 TTY 且没有测试变量就拒绝', `${gateNoEnv.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateNoEnv.stdout} ${gateNoEnv.stderr}`);
  const unmarked = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-not-approve-'));
  const gateUnmarked = gateOn(unmarked, true, {TEMP: unmarked, TMP: unmarked});
  check('approve 没有测试标记，TEMP 改到别处也拒绝', `${gateUnmarked.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateUnmarked.stdout} ${gateUnmarked.stderr}`);
  const marked = fs.mkdtempSync(path.join(os.tmpdir(), 'brewreel-approve-test-'));
  const gateMarked = gateOn(marked, true, {TEMP: unmarked, TMP: unmarked});
  check('测试标记目录不看 TEMP，TEMP 指到别的目录也放行', `${gateMarked.stdout || ''}`.includes('没有草稿') && !`${gateMarked.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateMarked.stdout} ${gateMarked.stderr}`);
  const gateChild = gateOn(path.join(ROOT, 'docs'), true);
  check('approve 指向仓库子目录拒绝', `${gateChild.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateChild.stdout} ${gateChild.stderr}`);
  const gateParent = gateOn(path.dirname(ROOT), true);
  check('approve 指向仓库上级目录拒绝', `${gateParent.stdout || ''}`.includes('这一步只能人在终端里自己跑') && approveTestRootOk(path.dirname(ROOT)) === false && approveTestRootOk(ROOT) === false && approveTestRootOk(marked) === true, `${gateParent.stdout}`);
  const insideName = path.join(ROOT, 'brewreel-approve-test-inside');
  fs.mkdirSync(insideName, {recursive: true});
  try {
    const gateInside = gateOn(insideName, true);
    check('仓库里的测试标记目录也拒绝', `${gateInside.stdout || ''}`.includes('这一步只能人在终端里自己跑') && approveTestRootOk(insideName) === false, `${gateInside.stdout} ${gateInside.stderr}`);
  } finally {
    fs.rmSync(insideName, {recursive: true, force: true});
  }
  const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brewreel-approve-link-'));
  const linkDir = path.join(linkRoot, 'brewreel-approve-test-repo');
  const linkedRepo = spawnSync('cmd', ['/c', 'mklink', '/J', linkDir, ROOT], {encoding: 'utf8'});
  if (linkedRepo.status === 0) {
    const gateLink = gateOn(linkDir, true, {TEMP: linkRoot, TMP: linkRoot});
    check('测试标记联接指向仓库根也拒绝', `${gateLink.stdout || ''}`.includes('这一步只能人在终端里自己跑'), `${gateLink.stdout} ${gateLink.stderr}`);
    spawnSync('cmd', ['/c', 'rmdir', linkDir], {encoding: 'utf8'});
  } else {
    check('测试标记联接指向仓库根也拒绝', false, linkedRepo.stdout || linkedRepo.stderr || 'mklink 失败');
  }
  fs.rmSync(unmarked, {recursive: true, force: true});
  fs.rmSync(marked, {recursive: true, force: true});
  fs.rmSync(linkRoot, {recursive: true, force: true});

  const link = path.join(os.tmpdir(), `msr-link-${process.pid}`);
  const linked = spawnSync('cmd', ['/c', 'mklink', '/J', link, ROOT], {encoding: 'utf8'});
  if (linked.status === 0) {
    const dry = spawnSync(process.execPath, [path.join(link, 'scripts', 'broll', 'make-style-refs.mjs'), '--dry-run', '--style', 'ink-sketch', '--only', 'refs/character.jpg'], {
      encoding: 'utf8',
      cwd: ROOT,
      env: {...process.env, MINIMAX_API_KEY: '', MINIMAX_BASE_URL: 'http://127.0.0.1:9'},
    });
    const dryOut = `${dry.stdout || ''}${dry.stderr || ''}`;
    check('目录联接运行 make-style-refs 有 dry-run 输出', dry.status === 0 && dryOut.includes('dry-run') && dryOut.includes('POST'), dryOut.slice(0, 300));
    const calLink = spawnSync(process.execPath, [path.join(link, 'scripts', 'broll', 'judge-calibrate.mjs'), path.join(link, 'tests', 'broll', 'fixtures', 'calibration-labels.json')], {
      encoding: 'utf8',
      cwd: ROOT,
      env: {...process.env, MINIMAX_API_KEY: '', MINIMAX_BASE_URL: 'http://127.0.0.1:9'},
    });
    const calLinkOut = `${calLink.stdout || ''}${calLink.stderr || ''}`;
    check('目录联接运行 judge-calibrate 有张数输出', calLink.status === 0 && calLinkOut.includes('标注 2 张') && calLinkOut.includes('没有 --yes'), calLinkOut.slice(0, 300));
    spawnSync('cmd', ['/c', 'rmdir', link], {encoding: 'utf8'});
  } else {
    check('目录联接运行 make-style-refs 有 dry-run 输出', false, linked.stdout || linked.stderr || 'mklink 失败');
    check('目录联接运行 judge-calibrate 有张数输出', false, 'mklink 失败');
  }

  fs.rmSync(payRoot, {recursive: true, force: true});
  fs.rmSync(badRoot, {recursive: true, force: true});
  fs.rmSync(failRoot, {recursive: true, force: true});
  fs.rmSync(ffRoot, {recursive: true, force: true});
  fs.rmSync(humanRoot, {recursive: true, force: true});
  fs.rmSync(keyRoot, {recursive: true, force: true});
  fs.rmSync(batchRoot, {recursive: true, force: true});
  fs.rmSync(approveRoot, {recursive: true, force: true});
}

// ───────── T1d：一次付费只提交一次 ─────────
{
  const submitsOf = (calls) => calls.filter((c) => c.url.includes('/v2/video_generation') && !c.url.includes('/query/')).length;
  const frames = ({outDir}) => {
    fs.mkdirSync(outDir, {recursive: true});
    return Array.from({length: 8}, (_, i) => {
      const dest = path.join(outDir, `f${i}.jpg`);
      fs.writeFileSync(dest, jpg);
      return dest;
    });
  };
  const open = async (mode) => {
    const holder = {};
    let submits = 0;
    holder.server = await startServer(({url, body}) => {
      if (url.startsWith('/file/')) return {bin: jpg};
      if (url.includes('/v1/image_generation')) return {json: {data: {image_urls: [`http://127.0.0.1:${holder.server.port}/file/a.jpg`]}, base_resp: {status_code: 0}}};
      if (url.includes('/v2/video_generation') && !url.includes('/query/')) {
        submits += 1;
        if (mode === 'drop' && submits === 1) return {drop: true};
        if (mode === 'balance' && submits === 1) return {json: {base_resp: {status_code: 1008, status_msg: 'insufficient balance'}}};
        if (mode === 'auth' && submits === 1) return {status: 401, json: {base_resp: {status_code: 1004, status_msg: 'login fail'}}};
        if (mode === 'http500') return {status: 500, json: {base_resp: {status_code: 1000, status_msg: 'down'}}};
        if (mode === 'http400' && submits === 1) return {status: 400, json: {base_resp: {status_code: 2013, status_msg: 'bad request'}}};
        return {json: {task_id: 'task-pay', base_resp: {status_code: 0}}};
      }
      if (url.includes('/query/')) {
        if (mode === 'timeout') return {json: {task: {status: 'processing'}, base_resp: {status_code: 0}}};
        if (mode === 'cancelled') return {json: {task: {status: 'cancelled'}, base_resp: {status_code: 0}}};
        if (mode === 'human-500') return {status: 500, json: {base_resp: {status_code: 1000, status_msg: 'down'}}};
        return {json: {task: {status: 'succeeded', content: {url: `http://127.0.0.1:${holder.server.port}/file/v.mp4`}, duration: 4}, base_resp: {status_code: 0}}};
      }
      if (url.includes('/v1/chat/completions')) {
        if (isSecond(body)) return {json: chat(secondClear(kindOf(body) || 'frame'))};
        if (mode === 'human-500' && kindOf(body) === 'character') {
          const partial = judgeBody('character');
          delete partial.antenna;
          delete partial.mouth;
          return {json: chat(partial)};
        }
        return {json: judgeReply(body)};
      }
      if (url.includes('/llm/chat/completions')) return {json: chat(goodStyle('demo-once'))};
      return {status: 404, json: {}};
    });
    return holder.server;
  };
  const once = (root, server, extra = {}) => ({
    root,
    env: envFor(server.port),
    log: () => {},
    yes: true,
    video: true,
    n: 1,
    retries: 0,
    retryDelayMs: 0,
    pollMs: 1,
    sleep: async () => {},
    id: 'demo-once',
    name: '水彩绘本',
    desc: '水彩晕染、纸纹、柔和暖色',
    extractFrames: frames,
    ...extra,
  });
  const runCatch = async (args) => {
    try {
      const result = await runNewStyle(args);
      return {result, error: null};
    } catch (error) {
      return {result: null, error};
    }
  };
  const STUCK = '上次提交没有确认结果，可能已经扣费。先去 MiniMax 后台看视频任务列表；确认没有提交成功再加 --video-redo。';
  const WAIT = '任务还在生成，稍后再跑同一条命令继续查询，不会重新提交';
  const stateOf = (root) => readJson(path.join(root, 'broll', 'styles', '_drafts', 'demo-once', 'state.json'));

  const timeoutRoot = prepRoot();
  const timeoutServer = await open('timeout');
  const firstTimeout = await runCatch(once(timeoutRoot, timeoutServer, {timeoutMs: 0}));
  const secondTimeout = await runCatch(once(timeoutRoot, timeoutServer, {timeoutMs: 0}));
  const timeoutState = stateOf(timeoutRoot);
  check(
    '轮询超时保持 submitted，重跑不重新提交',
    submitsOf(timeoutServer.calls) === 1 && firstTimeout.error?.exitCode === 3 && secondTimeout.error?.exitCode === 3 && firstTimeout.error.message === WAIT && secondTimeout.error.message === WAIT && timeoutState.stages.video.status === 'submitted' && timeoutState.stages.video.taskId === 'task-pay',
    `submits=${submitsOf(timeoutServer.calls)} exit=${firstTimeout.error?.exitCode}/${secondTimeout.error?.exitCode} ${secondTimeout.error?.message} ${JSON.stringify(timeoutState.stages?.video)}`,
  );
  await timeoutServer.close();

  const dropRoot = prepRoot();
  const dropServer = await open('drop');
  const dropped = await runCatch(once(dropRoot, dropServer));
  const dropState = stateOf(dropRoot);
  const droppedAgain = await runCatch(once(dropRoot, dropServer));
  check(
    '提交没有确认结果就停住，重跑不自动再交',
    submitsOf(dropServer.calls) === 1 && dropState.stages.video.status === 'submitting' && !dropState.stages.video.taskId && droppedAgain.error?.exitCode === 2 && droppedAgain.error.message === STUCK && String(dropped.error?.message || '').includes(STUCK),
    `submits=${submitsOf(dropServer.calls)} ${dropped.error?.message} / ${droppedAgain.error?.message} ${JSON.stringify(dropState.stages?.video)}`,
  );
  const redone = await runCatch(once(dropRoot, dropServer, {videoRedo: true}));
  check('--video-redo 才允许把没确认的提交再交一次', submitsOf(dropServer.calls) === 2 && redone.error?.message !== STUCK, `submits=${submitsOf(dropServer.calls)} ${redone.error?.message || redone.result?.conclusion}`);
  await dropServer.close();

  const cancelRoot = prepRoot();
  const cancelServer = await open('cancelled');
  const cancelled = await runCatch(once(cancelRoot, cancelServer));
  const cancelState = stateOf(cancelRoot);
  const cancelAgain = await runCatch(once(cancelRoot, cancelServer));
  check(
    '服务端 cancelled 才是失败，重跑不重新提交',
    submitsOf(cancelServer.calls) === 1 && cancelled.error?.exitCode === 4 && cancelState.stages.video.status === 'failed' && cancelState.stages.video.taskId === 'task-pay' && cancelAgain.error?.exitCode === 2 && cancelAgain.error.message.includes('--video-redo'),
    `submits=${submitsOf(cancelServer.calls)} ${cancelled.error?.message} / ${cancelAgain.error?.message} ${JSON.stringify(cancelState.stages?.video)}`,
  );
  await cancelServer.close();

  const humanRoot = prepRoot();
  const humanServer = await open('human-500');
  const blocked = await runCatch(once(humanRoot, humanServer));
  const released = await runCatch(once(humanRoot, humanServer, {humanOk: true}));
  const kept = stateOf(humanRoot);
  const without = await runCatch(once(humanRoot, humanServer));
  const withAgain = await runCatch(once(humanRoot, humanServer, {humanOk: true}));
  const stillKept = stateOf(humanRoot);
  check(
    '没有 --human-ok 也不清已有 task id，只继续查',
    submitsOf(humanServer.calls) === 1 && kept.stages.video.taskId === 'task-pay' && stillKept.stages.video.taskId === 'task-pay' && stillKept.stages.video.status === 'submitted' && String(without.error?.message || '').includes('task id') && String(withAgain.error?.message || '').includes('不会重新提交'),
    `submits=${submitsOf(humanServer.calls)} blocked=${blocked.error?.message || blocked.result?.conclusion} released=${released.error?.message} ${JSON.stringify(stillKept.stages?.video)}`,
  );
  await humanServer.close();

  const corruptRoot = prepRoot();
  const corruptServer = await open('human-500');
  await runCatch(once(corruptRoot, corruptServer, {humanOk: true}));
  const beforeCorrupt = submitsOf(corruptServer.calls);
  fs.writeFileSync(path.join(corruptRoot, 'broll', 'styles', '_drafts', 'demo-once', 'state.json'), '{', 'utf8');
  const corrupt = await runCatch(once(corruptRoot, corruptServer, {humanOk: true}));
  const backups = fs.readdirSync(path.join(corruptRoot, 'broll', 'styles', '_drafts', 'demo-once')).filter((name) => name.startsWith('state.json.bad-'));
  check(
    'state.json 损坏不提交，先改名备份',
    beforeCorrupt === 1 && submitsOf(corruptServer.calls) === 1 && corrupt.error?.exitCode === 2 && corrupt.error.message.includes('损坏') && corrupt.error.message.includes('不会提交') && backups.length === 1 && corrupt.error.message.includes(backups[0]),
    `submits=${submitsOf(corruptServer.calls)} ${corrupt.error?.message} backups=${backups.join(',')}`,
  );
  await corruptServer.close();

  const plantedRoot = prepRoot();
  const plantedServer = await open('timeout');
  const plantedDraft = path.join(plantedRoot, 'broll', 'styles', '_drafts', 'demo-once');
  fs.mkdirSync(plantedDraft, {recursive: true});
  fs.writeFileSync(path.join(plantedDraft, 'state.json'), '{', 'utf8');
  const planted = await runCatch(once(plantedRoot, plantedServer, {timeoutMs: 0}));
  const plantedBackups = fs.readdirSync(plantedDraft).filter((name) => name.startsWith('state.json.bad-'));
  check(
    '损坏的 state 不当成全新开始',
    submitsOf(plantedServer.calls) === 0 && planted.error?.exitCode === 2 && planted.error.message.includes('损坏') && planted.error.message.includes('不会提交') && plantedBackups.length === 1,
    `submits=${submitsOf(plantedServer.calls)} ${planted.error?.message}`,
  );
  await plantedServer.close();

  const balanceRoot = prepRoot();
  const balanceServer = await open('balance');
  const balanceFirst = await runCatch(once(balanceRoot, balanceServer));
  const balanceState = stateOf(balanceRoot);
  const balanceSecond = await runCatch(once(balanceRoot, balanceServer));
  check(
    '余额不足 1008 清掉提交标记，充值后直接重跑',
    submitsOf(balanceServer.calls) === 2 && balanceFirst.error?.exitCode === 2 && balanceFirst.error.message.includes('余额不足') && balanceFirst.error.message.includes('充值') && !balanceFirst.error.message.includes('可能已经扣费') && balanceState.stages.video == null && balanceSecond.result?.exitCode === 0,
    `submits=${submitsOf(balanceServer.calls)} ${balanceFirst.error?.message} state=${JSON.stringify(balanceState.stages?.video)} second=${balanceSecond.error?.message || balanceSecond.result?.conclusion}`,
  );
  await balanceServer.close();

  const authRoot = prepRoot();
  const authServer = await open('auth');
  const authFirst = await runCatch(once(authRoot, authServer));
  const authState = stateOf(authRoot);
  const authSecond = await runCatch(once(authRoot, authServer));
  check(
    'HTTP 401 鉴权失败清掉提交标记，改好后直接重跑',
    submitsOf(authServer.calls) === 2 && authFirst.error?.exitCode === 2 && authFirst.error.message.includes('鉴权失败') && !authFirst.error.message.includes('可能已经扣费') && authState.stages.video == null && authSecond.result?.exitCode === 0,
    `submits=${submitsOf(authServer.calls)} ${authFirst.error?.message} state=${JSON.stringify(authState.stages?.video)}`,
  );
  await authServer.close();

  const http400Root = prepRoot();
  const http400Server = await open('http400');
  const http400First = await runCatch(once(http400Root, http400Server));
  const http400State = stateOf(http400Root);
  check(
    'HTTP 400 明确拒绝清掉提交标记',
    submitsOf(http400Server.calls) === 1 && http400First.error?.exitCode === 2 && http400First.error.message.includes('提交被拒绝') && !http400First.error.message.includes('可能已经扣费') && http400State.stages.video == null,
    `submits=${submitsOf(http400Server.calls)} ${http400First.error?.message} state=${JSON.stringify(http400State.stages?.video)}`,
  );
  await http400Server.close();

  const server500Root = prepRoot();
  const server500 = await open('http500');
  const server500First = await runCatch(once(server500Root, server500));
  const server500State = stateOf(server500Root);
  const server500Again = await runCatch(once(server500Root, server500));
  check(
    'HTTP 500 仍保留 submitting，重跑不自动再交',
    submitsOf(server500.calls) === 1 && server500First.error?.exitCode === 2 && server500First.error.message.includes(STUCK) && server500State.stages.video.status === 'submitting' && server500Again.error?.exitCode === 2 && server500Again.error.message === STUCK,
    `submits=${submitsOf(server500.calls)} ${server500First.error?.message} / ${server500Again.error?.message} ${JSON.stringify(server500State.stages?.video)}`,
  );
  await server500.close();

  const aliveRoot = prepRoot();
  const aliveServer = await open('ok');
  const aliveDraft = path.join(aliveRoot, 'broll', 'styles', '_drafts', 'demo-once');
  fs.mkdirSync(aliveDraft, {recursive: true});
  const aliveLock = path.join(aliveDraft, 'run.lock');
  fs.writeFileSync(aliveLock, `${JSON.stringify({pid: process.pid, at: '2026-10-06T00:00:00.000Z'})}\n`, 'utf8');
  const alive = await runCatch(once(aliveRoot, aliveServer));
  check(
    '活着的 run.lock 拒绝第二个进程',
    alive.error?.exitCode === 2 && alive.error.message.includes('另一个进程') && submitsOf(aliveServer.calls) === 0 && fs.existsSync(aliveLock),
    `submits=${submitsOf(aliveServer.calls)} ${alive.error?.message} lock=${fs.existsSync(aliveLock)}`,
  );
  await aliveServer.close();

  const staleRoot = prepRoot();
  const staleServer = await open('ok');
  const staleDraft = path.join(staleRoot, 'broll', 'styles', '_drafts', 'demo-once');
  fs.mkdirSync(staleDraft, {recursive: true});
  fs.writeFileSync(path.join(staleDraft, 'run.lock'), `${JSON.stringify({pid: 2147483646, at: '2026-10-06T00:00:00.000Z'})}\n`, 'utf8');
  const stale = await runCatch(once(staleRoot, staleServer));
  check(
    '死掉的 run.lock 清掉后继续，结束时放开锁',
    stale.result?.exitCode === 0 && submitsOf(staleServer.calls) === 1 && !fs.existsSync(path.join(staleDraft, 'run.lock')),
    `submits=${submitsOf(staleServer.calls)} ${stale.error?.message || stale.result?.conclusion} lock=${fs.existsSync(path.join(staleDraft, 'run.lock'))}`,
  );
  await staleServer.close();

  const errRoot = prepRoot();
  const errEnv = envFor(9);
  delete errEnv.DEEPSEEK_API_KEY;
  delete errEnv.LLM_API_KEY;
  let errExit = null;
  try {
    await runNewStyle(once(errRoot, {port: 9}, {env: errEnv, video: false}));
  } catch (error) {
    errExit = error;
  }
  const errLock = path.join(errRoot, 'broll', 'styles', '_drafts', 'demo-once', 'run.lock');
  check('出错退出会放开 run.lock', errExit?.message?.includes('DEEPSEEK_API_KEY') && !fs.existsSync(errLock), `${errExit?.message} lock=${fs.existsSync(errLock)}`);

  const diskRoot = prepRoot();
  const diskServer = await open('ok');
  let diskInjected = false;
  const disked = await runCatch(once(diskRoot, diskServer, {
    ffmpegReady: () => {
      if (!diskInjected) {
        diskInjected = true;
        const file = path.join(diskRoot, 'broll', 'styles', '_drafts', 'demo-once', 'state.json');
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        saved.stages.video = {status: 'submitted', taskId: 'task-other', at: '2026-10-06T00:00:00.000Z', done: false};
        fs.writeFileSync(file, JSON.stringify(saved), 'utf8');
      }
      return true;
    },
  }));
  check(
    '写 submitting 前磁盘已有视频状态就停',
    submitsOf(diskServer.calls) === 0 && disked.error?.exitCode === 2 && disked.error.message.includes('磁盘上已经有视频状态'),
    `submits=${submitsOf(diskServer.calls)} ${disked.error?.message || disked.result?.conclusion}`,
  );
  await diskServer.close();

  const againRoot = prepRoot();
  const againServer = await open('ok');
  await runCatch(once(againRoot, againServer));
  const againDraft = path.join(againRoot, 'broll', 'styles', '_drafts', 'demo-once');
  const submitsBeforeBreak = submitsOf(againServer.calls);
  fs.writeFileSync(path.join(againDraft, 'state.json'), '{', 'utf8');
  const broke = await runCatch(once(againRoot, againServer));
  const badName = fs.readdirSync(againDraft).find((name) => name.startsWith('state.json.bad-') && !name.includes('.checked-'));
  const callsAtRefuse = againServer.calls.length;
  const secondBreak = await runCatch(once(againRoot, againServer));
  check(
    '坏 state 被拒后再跑不再出图也不提交',
    submitsBeforeBreak === 1 && broke.error?.exitCode === 2 && badName && secondBreak.error?.exitCode === 2 && secondBreak.error.message.includes(badName) && secondBreak.error.message.includes('--state-reset') && submitsOf(againServer.calls) === 1 && againServer.calls.length === callsAtRefuse,
    `submits=${submitsOf(againServer.calls)} broke=${broke.error?.message} second=${secondBreak.error?.message} calls=${againServer.calls.length - callsAtRefuse}`,
  );
  const reset = await runCatch(once(againRoot, againServer, {stateReset: true}));
  const checked = fs.readdirSync(againDraft).filter((name) => name.includes('.checked-'));
  const stillBad = fs.readdirSync(againDraft).filter((name) => name.startsWith('state.json.bad-') && !name.includes('.checked-'));
  check(
    '--state-reset 把 bad 备份改名后才继续',
    stillBad.length === 0 && checked.length === 1 && reset.result?.exitCode === 0 && submitsOf(againServer.calls) === 1,
    `submits=${submitsOf(againServer.calls)} checked=${checked.join(',')} ${reset.error?.message || reset.result?.conclusion}`,
  );
  await againServer.close();

  const emptyRoot = prepRoot();
  const emptyServer = await open('ok');
  const emptyDraft = path.join(emptyRoot, 'broll', 'styles', '_drafts', 'demo-once');
  fs.mkdirSync(path.join(emptyDraft, 'still'), {recursive: true});
  fs.writeFileSync(path.join(emptyDraft, 'still', '1.jpg'), jpg);
  fs.writeFileSync(path.join(emptyDraft, 'state.json'), '{}\n', 'utf8');
  const emptied = await runCatch(once(emptyRoot, emptyServer));
  check(
    '空 state 但已有出图按疑似被清空拒绝',
    submitsOf(emptyServer.calls) === 0 && emptied.error?.exitCode === 2 && emptied.error.message.includes('空对象') && emptied.error.message.includes('疑似被清空') && emptied.error.message.includes('--state-reset') && emptyServer.calls.length === 0,
    `submits=${submitsOf(emptyServer.calls)} calls=${emptyServer.calls.length} ${emptied.error?.message}`,
  );
  const emptyReset = await runCatch(once(emptyRoot, emptyServer, {stateReset: true}));
  check(
    '--state-reset 允许疑似被清空的草稿继续',
    emptyServer.calls.length > 0 && !String(emptyReset.error?.message || '').includes('疑似被清空'),
    `calls=${emptyServer.calls.length} ${emptyReset.error?.message || emptyReset.result?.conclusion}`,
  );
  await emptyServer.close();

  const noStageRoot = prepRoot();
  const noStageServer = await open('ok');
  const noStageDraft = path.join(noStageRoot, 'broll', 'styles', '_drafts', 'demo-once');
  fs.mkdirSync(path.join(noStageDraft, 'video'), {recursive: true});
  fs.writeFileSync(path.join(noStageDraft, 'video', 'clip.mp4'), jpg);
  fs.writeFileSync(path.join(noStageDraft, 'state.json'), '{"id":"demo-once"}\n', 'utf8');
  const noStage = await runCatch(once(noStageRoot, noStageServer));
  check(
    '缺 stages 但已有视频按疑似被清空拒绝',
    submitsOf(noStageServer.calls) === 0 && noStage.error?.exitCode === 2 && noStage.error.message.includes('缺 stages') && noStage.error.message.includes('--state-reset') && noStageServer.calls.length === 0,
    `submits=${submitsOf(noStageServer.calls)} ${noStage.error?.message}`,
  );
  await noStageServer.close();

  const cliResetRoot = prepRoot();
  const cliResetDraft = path.join(cliResetRoot, 'broll', 'styles', '_drafts', 'demo-cli-reset');
  fs.mkdirSync(cliResetDraft, {recursive: true});
  fs.writeFileSync(path.join(cliResetDraft, 'state.json.bad-old'), '{', 'utf8');
  const cliReset = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'broll', 'new-style.mjs'), '--id', 'demo-cli-reset', '--name', '水彩绘本', '--desc', '水彩晕染、纸纹、柔和暖色', '--yes', '--root', cliResetRoot], {
    encoding: 'utf8',
    cwd: ROOT,
    env: {...process.env, MINIMAX_API_KEY: 'k', DEEPSEEK_API_KEY: 'k', MINIMAX_BASE_URL: 'http://127.0.0.1:9', LLM_BASE_URL: 'http://127.0.0.1:9/llm', LLM_MODEL: 'x'},
  });
  check('命令行没加 --state-reset 会指出坏备份', cliReset.status === 2 && `${cliReset.stdout || ''}`.includes('state.json.bad-old') && `${cliReset.stdout || ''}`.includes('--state-reset'), `${cliReset.status} ${cliReset.stdout}`);

  const factoryUrl = pathToFileURL(path.join(ROOT, 'scripts', 'broll', 'style-factory.mjs')).href;
  const hangScript = path.join(os.tmpdir(), `brewreel-lock-hang-${process.pid}.mjs`);
  fs.writeFileSync(hangScript, `import {runNewStyle} from ${JSON.stringify(factoryUrl)};
const root = process.argv[2];
const id = process.argv[3] || 'demo-once';
const keepAlive = setInterval(() => {}, 1000);
try {
  await runNewStyle({
    root,
    id,
    name: '水彩绘本',
    desc: '水彩晕染、纸纹、柔和暖色',
    yes: true,
    n: 1,
    retries: 0,
    env: {MINIMAX_API_KEY: 'k', DEEPSEEK_API_KEY: 'k', MINIMAX_BASE_URL: 'http://127.0.0.1:9', LLM_BASE_URL: 'http://127.0.0.1:9/llm', LLM_MODEL: 'x'},
    log: () => {},
    fetchImpl: () => new Promise(() => {}),
  });
  console.log('DONE');
} catch (error) {
  console.log(error.message);
  process.exitCode = error.exitCode || 1;
} finally {
  clearInterval(keepAlive);
}
`, 'utf8');
  const sigScript = path.join(os.tmpdir(), `brewreel-lock-sigint-${process.pid}.mjs`);
  const sigRoot = prepRoot();
  const sigLock = path.join(sigRoot, 'broll', 'styles', '_drafts', 'demo-lock', 'run.lock');
  fs.writeFileSync(sigScript, `import fs from 'node:fs';
import {runNewStyle} from ${JSON.stringify(factoryUrl)};
const root = process.argv[2];
const lock = process.argv[3];
const timer = setInterval(() => {
  if (fs.existsSync(lock)) {
    clearInterval(timer);
    process.emit('SIGINT');
  }
}, 20);
await runNewStyle({
  root,
  id: 'demo-lock',
  name: '水彩绘本',
  desc: '水彩晕染、纸纹、柔和暖色',
  yes: true,
  n: 1,
  retries: 0,
  env: {MINIMAX_API_KEY: 'k', DEEPSEEK_API_KEY: 'k', MINIMAX_BASE_URL: 'http://127.0.0.1:9', LLM_BASE_URL: 'http://127.0.0.1:9/llm', LLM_MODEL: 'x'},
  log: () => {},
  fetchImpl: () => new Promise(() => {}),
});
`, 'utf8');
  const sig = spawnSync(process.execPath, [sigScript, sigRoot, sigLock], {encoding: 'utf8', cwd: ROOT, timeout: 15000});
  check('SIGINT 会放开 run.lock', sig.status === 130 && !fs.existsSync(sigLock), `status=${sig.status} lock=${fs.existsSync(sigLock)} ${sig.stdout} ${sig.stderr}`);

  const concRoot = prepRoot();
  const concLock = path.join(concRoot, 'broll', 'styles', '_drafts', 'demo-once', 'run.lock');
  const childA = spawn(process.execPath, [hangScript, concRoot, 'demo-once'], {cwd: ROOT, stdio: 'ignore', windowsHide: true, detached: true});
  childA.unref();
  const lockHeld = () => {
    try {
      const pid = Number(JSON.parse(fs.readFileSync(concLock, 'utf8')).pid);
      if (!Number.isInteger(pid) || pid <= 0) return false;
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const concStart = Date.now();
  while (!lockHeld() && Date.now() - concStart < 10000) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const childB = spawnSync(process.execPath, [hangScript, concRoot, 'demo-once'], {encoding: 'utf8', cwd: ROOT, timeout: 15000});
  check(
    '两个进程同时跑，第二个退出且不提交',
    fs.existsSync(concLock) && childB.status === 2 && `${childB.stdout || ''}`.includes('另一个进程'),
    `lock=${fs.existsSync(concLock)} status=${childB.status} ${childB.stdout} ${childB.stderr}`,
  );
  spawnSync('taskkill', ['/PID', String(childA.pid), '/F', '/T'], {encoding: 'utf8', windowsHide: true});
  await Promise.race([
    new Promise((resolve) => {
      if (childA.exitCode != null || childA.signalCode != null) resolve();
      else childA.once('exit', resolve);
    }),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  const crashServer = await open('ok');
  const crashed = await runCatch(once(concRoot, crashServer));
  check(
    '进程被强杀后的残留锁，下次清掉再继续',
    crashed.result?.exitCode === 0 && submitsOf(crashServer.calls) === 1 && !fs.existsSync(concLock),
    `submits=${submitsOf(crashServer.calls)} ${crashed.error?.message || crashed.result?.conclusion} lock=${fs.existsSync(concLock)}`,
  );
  await crashServer.close();
  fs.rmSync(hangScript, {force: true});
  fs.rmSync(sigScript, {force: true});

  fs.rmSync(timeoutRoot, {recursive: true, force: true});
  fs.rmSync(dropRoot, {recursive: true, force: true});
  fs.rmSync(cancelRoot, {recursive: true, force: true});
  fs.rmSync(humanRoot, {recursive: true, force: true});
  fs.rmSync(corruptRoot, {recursive: true, force: true});
  fs.rmSync(plantedRoot, {recursive: true, force: true});
  fs.rmSync(balanceRoot, {recursive: true, force: true});
  fs.rmSync(authRoot, {recursive: true, force: true});
  fs.rmSync(http400Root, {recursive: true, force: true});
  fs.rmSync(server500Root, {recursive: true, force: true});
  fs.rmSync(aliveRoot, {recursive: true, force: true});
  fs.rmSync(staleRoot, {recursive: true, force: true});
  fs.rmSync(errRoot, {recursive: true, force: true});
  fs.rmSync(diskRoot, {recursive: true, force: true});
  fs.rmSync(againRoot, {recursive: true, force: true});
  fs.rmSync(emptyRoot, {recursive: true, force: true});
  fs.rmSync(noStageRoot, {recursive: true, force: true});
  fs.rmSync(cliResetRoot, {recursive: true, force: true});
  fs.rmSync(sigRoot, {recursive: true, force: true});
  fs.rmSync(concRoot, {recursive: true, force: true});
}

if (failures.length) {
  console.log(`失败 ${failures.length}，通过 ${passed}`);
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`风格工厂测试全部通过 ${passed}`);
