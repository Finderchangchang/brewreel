#!/usr/bin/env node
// ============================================================
// 配音管线自测：不联网、不要 key。
//   node scripts/test-tts.mjs
// 覆盖：分词 / 时间戳估算 / 字幕时间戳解析；mock 合成与缓存；MiniMax 用「录制式假响应」（假 fetch）覆盖
// 成功（hex / URL 两种音频）、限流重试、鉴权失败、超长文本、没 key、网络错误；阿里云 / 火山引擎用照官方文档造的 SSE 假响应覆盖
// 请求形状、分片音频拼接、字级时间戳、报错分类；make 的配音步骤（改镜头时长、voice.json）；
// make_bgm.py 的配乐闪避（人声段压低约 10 dB）。临时文件都写系统临时目录，跑完删掉。
// ============================================================
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSpecs, schedule, validate} from './validate.mjs';
import {cacheDirOf, cacheKey, synthesizeCached, voiceConfigOf} from './lib/tts/index.mjs';
import * as aliyun from './lib/tts/aliyun.mjs';
import {checkVoiceMeta} from './lib/tts/checks.mjs';
import {_resetThrottle, parseSSE} from './lib/tts/http.mjs';
import * as minimax from './lib/tts/minimax.mjs';
import * as mock from './lib/tts/mock.mjs';
import * as volcengine from './lib/tts/volcengine.mjs';
import {DUCK, LEAD_SEC, TAIL_SEC, VOICE_RMS_DB, normalizeWav, runVoiceStep, voiceIntervals} from './lib/tts/pipeline.mjs';
import {estimateWords, flattenSubtitle, markHot, paginate, tokenize, wordsFromSubtitle} from './lib/tts/timing.mjs';
import {decodeWav, encodeWav, mp3DurationMs, wavInfo} from './lib/tts/wav.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'brewreel-tts-test-'));
const FAKE_KEY = 'fake-minimax-key-for-tests-0000';
const tests = [];
const test = (name, fn) => tests.push({name, fn});

// ---------------- 录制式假响应 ----------------
/** 一个最小的「MP3」：n 帧 MPEG1 Layer III 128kbps 32kHz 单声道（帧头合法，帧体是 0），每帧 36 毫秒 */
const fakeMp3 = (frames = 10) => {
  const frame = Buffer.alloc(576);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x98;
  frame[3] = 0xc4;
  return Buffer.concat(Array.from({length: frames}, () => frame));
};
/** MiniMax T2A v2 成功响应（字段照官方文档）。audio 默认是 hex */
const okBody = ({audio = fakeMp3(40).toString('hex'), length = 1440, fmt = 'mp3', subtitle = 'https://files.example.invalid/sub/abc.json', chars = 7} = {}) => ({
  data: {audio, status: 2, subtitle_file: subtitle},
  extra_info: {audio_length: length, audio_sample_rate: 32000, audio_size: audio.length / 2, bitrate: 128000, word_count: chars, invisible_character_ratio: 0, usage_characters: chars, audio_format: fmt, audio_channel: 1},
  trace_id: 'trace-0001',
  base_resp: {status_code: 0, status_msg: 'success'},
});
const errBody = (code, msg) => ({trace_id: 'trace-err', base_resp: {status_code: code, status_msg: msg}});
/** 字级字幕文件（每句里带 timestamped_words） */
const SUB_WORDS = [
  {
    text: '欢迎使用精酿。',
    time_begin: 60,
    time_end: 1380,
    text_begin: 0,
    text_end: 7,
    timestamped_words: [
      {word: '欢', time_begin: 60, time_end: 250},
      {word: '迎', time_begin: 250, time_end: 440},
      {word: '使', time_begin: 440, time_end: 630},
      {word: '用', time_begin: 630, time_end: 820},
      {word: '精', time_begin: 820, time_end: 1010},
      {word: '酿', time_begin: 1010, time_end: 1380},
    ],
  },
];
const SUB_SENTENCES = [
  {text: '写一句话，', time_begin: 0, time_end: 900},
  {text: '片子就出来了。', time_begin: 1100, time_end: 2300},
];

/** 假 fetch：按顺序吐出 responses，记下每次请求（url / method / headers / body） */
const fakeFetch = (responses) => {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({url: String(url), method: init.method ?? 'GET', headers: {...(init.headers ?? {})}, body: init.body ? JSON.parse(init.body) : null});
    const r = responses.shift();
    if (!r) throw new Error('no more fake responses');
    if (r.throw) throw new Error(r.throw);
    const status = r.status ?? 200;
    const payload = r.json !== undefined ? JSON.stringify(r.json) : r.bytes ?? r.text ?? '';
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(payload),
      text: async () => String(payload),
      arrayBuffer: async () => {
        const b = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      },
    };
  };
  fn.calls = calls;
  return fn;
};
const noSleep = () => {
  const waits = [];
  const fn = async (ms) => void waits.push(ms);
  fn.waits = waits;
  return fn;
};
const mm = (text, extra = {}) => {
  minimax._resetThrottle();
  return minimax.synthesize(text, {outBase: path.join(TMP, `mm-${Math.random().toString(36).slice(2)}`), env: {MINIMAX_API_KEY: FAKE_KEY}, minIntervalMs: 0, ...extra});
};
const rejects = async (p, check) => {
  try {
    await p;
  } catch (e) {
    check(e);
    return;
  }
  assert.fail('应该抛错但没有');
};

// ---------------- 分词 / 时间戳 ----------------
test('分词：切片顺序拼起来等于原文；汉字一个一个，英文单词和数字各算一个', () => {
  const s = '「精酿」让 AI 写分镜，3 秒出图！Try it.';
  const t = tokenize(s, 'zh');
  assert.equal(t.map((x) => x.text).join(''), s);
  assert.ok(t.some((x) => x.text.startsWith('AI')));
  assert.ok(t.find((x) => x.text.startsWith('3')));
  assert.equal(t[0].text, '「精');
  const en = tokenize('Write one line. Get a video!', 'en');
  assert.deepEqual(en.map((x) => x.text.trim()), ['Write', 'one', 'line.', 'Get', 'a', 'video!']);
  assert.ok(en[2].pause > en[0].pause, '句号后面的停顿比词间长');
});

test('估算字级时间：单调、落在给定区间里，标点处有停顿', () => {
  const w = estimateWords('写一句话，片子就出来了。', 100, 2600, 'zh');
  assert.equal(w.length, 10);
  for (let k = 1; k < w.length; k++) assert.ok(w[k].startMs >= w[k - 1].endMs);
  assert.ok(w[0].startMs >= 100 && w[w.length - 1].endMs <= 2600);
  assert.ok(w[4].startMs - w[3].endMs > 50, '逗号后面留了停顿');
});

test('字幕 JSON：字级（timestamped_words）→ char 粒度，时间来自接口', () => {
  const r = wordsFromSubtitle('欢迎使用精酿。', 'zh', 1440, SUB_WORDS);
  assert.equal(r.granularity, 'char');
  assert.equal(r.words.length, 6);
  assert.equal(r.words[0].startMs, 60);
  assert.equal(r.words[5].endMs, 1380);
  assert.equal(r.words[5].text, '酿。');
});

test('字幕 JSON：只有句级 → 句内按字数与标点估算（sentence-interp）', () => {
  const r = wordsFromSubtitle('写一句话，片子就出来了。', 'zh', 2400, SUB_SENTENCES);
  assert.equal(r.granularity, 'sentence-interp');
  assert.equal(r.words.length, 10);
  assert.ok(r.words[4].startMs >= 1100, '第二句从 1100 毫秒开始');
  assert.ok(r.words[3].endMs <= 900);
});

test('字幕 JSON：秒为单位自动换算；字段名不认识 / 没有字幕 → 整句估算', () => {
  const f = flattenSubtitle([{text: '你', start: 0.1, end: 0.5}, {text: '好', start: 0.5, end: 0.9}], 2000);
  assert.equal(f.sentences.length, 0, '每条都是单字 → 当成字级');
  assert.equal(f.words[1].b, 500, '秒换算成毫秒');
  const g = flattenSubtitle({subtitles: [{text: '你好', begin_time: 0.1, end_time: 0.9}, {text: '世界', begin_time: 1.0, end_time: 1.8}]}, 2000);
  assert.equal(g.sentences.length, 2);
  assert.equal(g.sentences[1].b, 1000);
  const r = wordsFromSubtitle('你好，世界', 'zh', 2000, {foo: 1});
  assert.equal(r.granularity, 'sentence-interp');
  assert.equal(r.words.length, 4);
  assert.equal(wordsFromSubtitle('你好', 'zh', 800, null).words.length, 2);
});

test('强调与分页：{} 标成 hot；每页不超过 2 行、每行不超过 12 字，页文字带 {} 可直接上屏', () => {
  const vo = '下班前五分钟，报表还没做完，老板又在群里催了，{精酿}帮你一条命令出片。';
  const plain = vo.replace(/[{}]/g, '');
  const words = markHot(vo, estimateWords(plain, 0, 6000, 'zh'));
  assert.deepEqual(words.filter((w) => w.hot).map((w) => w.text), ['精', '酿']);
  const pages = paginate(words, {lang: 'zh'});
  assert.ok(pages.length >= 2);
  for (const p of pages) {
    const lines = p.text.split('\n');
    assert.ok(lines.length <= 2, `页「${p.text}」超过 2 行`);
    for (const l of lines) assert.ok(Array.from(l.replace(/[{}]/g, '')).length <= 12, `行「${l}」超过 12 字`);
  }
  assert.ok(pages.some((p) => p.text.includes('{精酿}')));
  assert.equal(pages[0].from, 0);
  assert.equal(pages[pages.length - 1].to, words.length);
});

test('WAV / MP3 时长读取', () => {
  const wav = encodeWav(new Float32Array(16000), 32000);
  assert.equal(Math.round(wavInfo(wav).durMs), 500);
  assert.equal(Math.round(mp3DurationMs(fakeMp3(10))), 360);
});

// ---------------- mock 合成 + 缓存 ----------------
test('mock：生成可听的占位音，时间戳和音频对齐，结果确定', async () => {
  const a = await mock.synthesize('写一句话，片子就出来了。', {outBase: path.join(TMP, 'mock-a'), lang: 'zh'});
  const b = await mock.synthesize('写一句话，片子就出来了。', {outBase: path.join(TMP, 'mock-b'), lang: 'zh'});
  assert.equal(a.granularity, 'char');
  assert.equal(Math.round(wavInfo(a.audioPath).durMs), a.durMs);
  assert.ok(a.words[a.words.length - 1].endMs <= a.durMs);
  assert.ok(fs.readFileSync(a.audioPath).equals(fs.readFileSync(b.audioPath)), '同一句话同样参数，音频逐字节一样');
  const d = decodeWav(fs.readFileSync(a.audioPath));
  const peak = d.samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  assert.ok(peak > 0.1 && peak < 0.9, `音量正常（峰值 ${peak.toFixed(2)}）`);
  const fast = await mock.synthesize('写一句话，片子就出来了。', {outBase: path.join(TMP, 'mock-fast'), lang: 'zh', speed: 1.5});
  assert.ok(fast.durMs < a.durMs * 0.75, 'speed 1.5 明显更短');
});

test('缓存：同样参数第二次命中，改 speed / 文字就重新合成；缓存目录可用环境变量改', async () => {
  const cacheDir = path.join(TMP, 'cache');
  const cfg = voiceConfigOf({voice: {provider: 'mock'}});
  const r1 = await synthesizeCached('第一次合成。', cfg, {cacheDir});
  const r2 = await synthesizeCached('第一次合成。', cfg, {cacheDir});
  assert.equal(r1.cacheHit, false);
  assert.equal(r2.cacheHit, true);
  assert.equal(r1.key, r2.key);
  assert.deepEqual(r2.words, r1.words);
  assert.ok(fs.existsSync(r2.audioPath));
  const r3 = await synthesizeCached('第一次合成。', {...cfg, speed: 1.2}, {cacheDir});
  assert.equal(r3.cacheHit, false);
  assert.notEqual(cacheKey(cfg, '甲'), cacheKey({...cfg, voiceId: 'x'}, '甲'));
  assert.notEqual(cacheKey(cfg, '甲'), cacheKey({...cfg, emotion: 'calm'}, '甲'));
  assert.equal(cacheDirOf({BREWREEL_TTS_CACHE: path.join(TMP, 'x')}), path.join(TMP, 'x'));
  assert.equal(cacheDirOf({XDG_CACHE_HOME: path.join(TMP, 'xdg')}), path.join(TMP, 'xdg', 'brewreel', 'tts'));
  assert.equal(cacheDirOf({}), path.join(os.homedir(), '.cache', 'brewreel', 'tts'));
});

// ---------------- MiniMax（录制式假响应） ----------------
test('MiniMax 成功（hex 音频 + 字级字幕文件）：请求体照文档，字幕下载不带鉴权头', async () => {
  const f = fakeFetch([{json: okBody()}, {json: SUB_WORDS}]);
  const r = await mm('欢迎使用精酿。', {fetch: f, voiceId: 'Chinese (Mandarin)_News_Anchor', speed: 1.1, emotion: 'calm', model: 'speech-2.8-turbo'});
  const [call, sub] = f.calls;
  assert.equal(call.url, 'https://api.minimaxi.com/v1/t2a_v2');
  assert.equal(call.method, 'POST');
  assert.equal(call.headers.Authorization, `Bearer ${FAKE_KEY}`);
  assert.equal(call.body.model, 'speech-2.8-turbo');
  assert.equal(call.body.text, '欢迎使用精酿。');
  assert.equal(call.body.stream, false);
  assert.deepEqual(call.body.voice_setting, {voice_id: 'Chinese (Mandarin)_News_Anchor', speed: 1.1, vol: 1, pitch: 0, emotion: 'calm'});
  assert.equal(call.body.output_format, 'hex');
  assert.equal(call.body.subtitle_enable, true);
  assert.equal(call.body.subtitle_type, 'word');
  assert.equal(sub.url, 'https://files.example.invalid/sub/abc.json');
  assert.equal(sub.headers.Authorization, undefined, '下载字幕文件不能带 key');
  assert.equal(r.durMs, 1440);
  assert.equal(r.granularity, 'char');
  assert.equal(r.words[0].startMs, 60);
  assert.equal(r.usageCharacters, 7);
  assert.ok(fs.readFileSync(r.audioPath).equals(fakeMp3(40)));
  assert.ok(fs.existsSync(r.audioPath.replace(/\.mp3$/, '.subtitle.json')), '原始字幕 JSON 留了一份，方便核对真实结构');
});

test('MiniMax 成功（URL 音频、没有字幕文件）：下载音频不带鉴权头，字级按字数估算', async () => {
  const f = fakeFetch([{json: okBody({audio: 'https://files.example.invalid/a.mp3', subtitle: '', length: 0})}, {bytes: fakeMp3(25)}]);
  const r = await mm('写一句话。', {fetch: f});
  assert.equal(f.calls[1].url, 'https://files.example.invalid/a.mp3');
  assert.equal(f.calls[1].headers.Authorization, undefined);
  assert.equal(Math.round(r.durMs), 900, '没给 audio_length 就按 mp3 帧算');
  assert.equal(r.granularity, 'sentence-interp');
  assert.equal(r.words.length, 4);
});

test('MiniMax 限流（1002、HTTP 429）：指数退避重试后成功', async () => {
  const sleep = noSleep();
  const f = fakeFetch([{json: errBody(1002, 'rate limit')}, {status: 429, text: 'too many requests'}, {json: okBody({subtitle: ''})}]);
  const r = await mm('欢迎使用精酿。', {fetch: f, sleep});
  assert.equal(f.calls.length, 3);
  assert.ok(r.durMs > 0);
  const backoff = sleep.waits.filter((ms) => ms >= 1000);
  assert.equal(backoff.length, 2);
  assert.ok(backoff[1] > backoff[0], '第二次等得更久');
});

test('MiniMax 限流重试用完：报 RATE_LIMIT，中英文说明', async () => {
  const f = fakeFetch(Array.from({length: 3}, () => ({json: errBody(1039, 'tpm limit')})));
  await rejects(mm('欢迎。', {fetch: f, sleep: noSleep(), maxRetries: 2}), (e) => {
    assert.equal(e.code, 'RATE_LIMIT');
    assert.equal(f.calls.length, 3);
    assert.match(e.message, /限流/);
    assert.match(e.message, /rate limit/);
  });
});

test('MiniMax 鉴权失败（1004）：不重试，报错里没有 key，给出域名提示', async () => {
  const f = fakeFetch([{json: errBody(1004, `invalid api key ${FAKE_KEY}`)}]);
  await rejects(mm('欢迎。', {fetch: f, sleep: noSleep()}), (e) => {
    assert.equal(e.code, 'AUTH');
    assert.equal(f.calls.length, 1);
    assert.ok(!e.message.includes(FAKE_KEY), '报错里不能出现 key');
    assert.match(e.message, /MINIMAX_BASE_URL/);
  });
  const f401 = fakeFetch([{status: 401, text: `Bearer ${FAKE_KEY} rejected`}]);
  await rejects(mm('欢迎。', {fetch: f401, sleep: noSleep()}), (e) => {
    assert.equal(e.code, 'AUTH');
    assert.ok(!e.message.includes(FAKE_KEY));
  });
});

test('MiniMax 超长文本（≥10000 字）：本地直接拦，不发请求', async () => {
  const f = fakeFetch([]);
  await rejects(mm('长'.repeat(10000), {fetch: f}), (e) => {
    assert.equal(e.code, 'TOO_LONG');
    assert.equal(f.calls.length, 0);
  });
});

test('MiniMax 没 key：不发请求，提示先用 mock 预览', async () => {
  const f = fakeFetch([]);
  minimax._resetThrottle();
  await rejects(minimax.synthesize('欢迎。', {outBase: path.join(TMP, 'nokey'), env: {}, fetch: f}), (e) => {
    assert.equal(e.code, 'NO_KEY');
    assert.match(e.message, /mock/);
    assert.equal(f.calls.length, 0);
  });
});

test('MiniMax 网络错误 / 服务端错误会重试；参数错（2013）不重试', async () => {
  const f = fakeFetch([{throw: 'ECONNRESET'}, {status: 502, text: 'bad gateway'}, {json: okBody({subtitle: ''})}]);
  const r = await mm('欢迎。', {fetch: f, sleep: noSleep()});
  assert.ok(r.durMs > 0);
  assert.equal(f.calls.length, 3);
  const f2 = fakeFetch([{json: errBody(2013, 'invalid voice_id')}]);
  await rejects(mm('欢迎。', {fetch: f2, sleep: noSleep()}), (e) => {
    assert.equal(e.code, 'BAD_PARAMS');
    assert.equal(f2.calls.length, 1);
    assert.match(e.message, /voiceId/);
  });
});

test('MiniMax 接口地址：host / host/v1 / 完整路径都行，GroupId 可选', () => {
  assert.equal(minimax.endpointOf({}), 'https://api.minimaxi.com/v1/t2a_v2');
  assert.equal(minimax.endpointOf({MINIMAX_BASE_URL: 'https://api.minimax.io/'}), 'https://api.minimax.io/v1/t2a_v2');
  assert.equal(minimax.endpointOf({MINIMAX_BASE_URL: 'https://api.minimax.io/v1'}), 'https://api.minimax.io/v1/t2a_v2');
  assert.equal(minimax.endpointOf({MINIMAX_BASE_URL: 'api-uw.minimax.io/v1/t2a_v2'}), 'https://api-uw.minimax.io/v1/t2a_v2');
  assert.equal(minimax.endpointOf({MINIMAX_GROUP_ID: 'g 1'}), 'https://api.minimaxi.com/v1/t2a_v2?GroupId=g%201');
  assert.throws(() => minimax.endpointOf({MINIMAX_BASE_URL: 'http://api.minimax.io'}), (e) => e.code === 'INSECURE_URL');
});

test('默认音色：中文是播报男声', () => {
  assert.equal(minimax.DEFAULT_VOICE.zh, 'Chinese (Mandarin)_Male_Announcer');
});

// ---------------- 阿里云 / 火山引擎（SSE 假响应，字段照官方文档） ----------------
const FAKE_DS = 'fake-dashscope-key-0000';
const FAKE_VOLC = 'fake-volc-key-0000';
const b64 = (buf) => buf.toString('base64');
const sse = (events) => events.map(([ev, data]) => `event:${ev}\ndata:${JSON.stringify(data)}\n`).join('\n');
const MP3_A = fakeMp3(20);
const MP3_B = fakeMp3(20);
const WORDS_MS = [['欢', 60, 250], ['迎', 250, 440], ['使', 440, 630], ['用', 630, 820], ['精', 820, 1010], ['酿。', 1010, 1380]];
const aly = (text, extra = {}) => {
  _resetThrottle();
  return aliyun.synthesize(text, {outBase: path.join(TMP, `aly-${Math.random().toString(36).slice(2)}`), env: {DASHSCOPE_API_KEY: FAKE_DS}, minIntervalMs: 0, ...extra});
};
const volc = (text, extra = {}) => {
  _resetThrottle();
  return volcengine.synthesize(text, {outBase: path.join(TMP, `volc-${Math.random().toString(36).slice(2)}`), env: {VOLCENGINE_TTS_API_KEY: FAKE_VOLC}, minIntervalMs: 0, ...extra});
};
const alyOk = () =>
  sse([
    ['result', {request_id: 'r1', output: {audio: {data: b64(MP3_A)}}}],
    ['result', {request_id: 'r1', output: {type: 'sentence-end', sentence: {index: 0, words: WORDS_MS.map(([t, b, e], i) => ({text: t, begin_index: i, end_index: i + 1, begin_time: b, end_time: e}))}, audio: {data: b64(MP3_B)}}, usage: {characters: 7}}],
  ]);
const volcOk = () =>
  sse([
    ['352', {code: 0, message: '', data: b64(MP3_A)}],
    ['351', {code: 0, message: '', data: null, sentence: {text: '欢迎使用精酿。', words: WORDS_MS.map(([t, b, e]) => ({word: t, startTime: b / 1000, endTime: e / 1000, confidence: 0.9}))}}],
    ['352', {code: 0, message: '', data: b64(MP3_B)}],
    ['152', {code: 20000000, message: 'OK', data: null, usage: {text_words: 7}}],
  ]);

test('SSE 解析：event/data 分块、JSON 自动解析；整段 JSON 当一个事件', () => {
  const ev = parseSSE('event: 352\ndata: {"a":1}\n\n: 注释\nevent:x\ndata:plain\n\n');
  assert.deepEqual(ev, [{event: '352', data: {a: 1}}, {event: 'x', data: 'plain'}]);
  assert.deepEqual(parseSSE('{"code":"InvalidApiKey"}'), [{event: '', data: {code: 'InvalidApiKey'}}]);
});

test('阿里云成功：SSE 请求头、请求体照文档；base64 分片拼成整段 mp3，字级时间戳（毫秒）', async () => {
  const f = fakeFetch([{text: alyOk()}]);
  const r = await aly('欢迎使用精酿。', {fetch: f, speed: 1.1});
  const [call] = f.calls;
  assert.equal(call.url, 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer');
  assert.equal(call.headers.Authorization, `Bearer ${FAKE_DS}`);
  assert.equal(call.headers['X-DashScope-SSE'], 'enable');
  assert.equal(call.body.model, 'cosyvoice-v3-flash');
  assert.equal(call.body.input.voice, 'longsanshu_v3', '默认中文男声');
  assert.equal(call.body.input.rate, 1.1);
  assert.equal(call.body.input.word_timestamp_enabled, true);
  assert.ok(fs.readFileSync(r.audioPath).equals(Buffer.concat([MP3_A, MP3_B])));
  assert.equal(r.durMs, 1440);
  assert.equal(r.granularity, 'char');
  assert.equal(r.words[0].startMs, 60);
  assert.equal(r.usageCharacters, 7);
  assert.ok(fs.existsSync(r.audioPath.replace(/\.mp3$/, '.subtitle.json')));
});

test('阿里云地址：业务空间域名、完整地址覆盖；http 被拒', () => {
  assert.equal(aliyun.endpointOf({DASHSCOPE_WORKSPACE_ID: 'ws-123'}), 'https://ws-123.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer');
  assert.equal(aliyun.endpointOf({DASHSCOPE_WORKSPACE_ID: 'ws-123', DASHSCOPE_REGION: 'ap-southeast-1'}), 'https://ws-123.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer');
  assert.equal(aliyun.endpointOf({DASHSCOPE_TTS_URL: 'https://x.example/tts/'}), 'https://x.example/tts');
  assert.throws(() => aliyun.endpointOf({DASHSCOPE_TTS_URL: 'http://x.example/tts'}), (e) => e.code === 'INSECURE_URL');
  assert.throws(() => aliyun.endpointOf({DASHSCOPE_WORKSPACE_ID: 'a.evil.com/x'}), (e) => e.code === 'BAD_PARAMS');
});

test('阿里云只给音频 URL：下载不带鉴权头，没有时间戳就按字数估算', async () => {
  const f = fakeFetch([{text: sse([['result', {output: {audio: {data: '', url: 'https://files.example.invalid/a.mp3'}}, usage: {characters: 5}}]])}, {bytes: fakeMp3(25)}]);
  const r = await aly('写一句话。', {fetch: f});
  assert.equal(f.calls[1].url, 'https://files.example.invalid/a.mp3');
  assert.equal(f.calls[1].headers.Authorization, undefined);
  assert.equal(r.granularity, 'sentence-interp');
  assert.equal(Math.round(r.durMs), 900);
});

test('阿里云报错：鉴权失败不重试且不带 key；限流重试后成功；SSE 里的参数错不重试；额度用完', async () => {
  const f401 = fakeFetch([{status: 401, json: {code: 'InvalidApiKey', message: `Invalid API-key provided: ${FAKE_DS}`}}]);
  await rejects(aly('欢迎。', {fetch: f401, sleep: noSleep()}), (e) => {
    assert.equal(e.code, 'AUTH');
    assert.equal(f401.calls.length, 1);
    assert.ok(!e.message.includes(FAKE_DS));
    assert.match(e.message, /DASHSCOPE_API_KEY/);
  });
  const f429 = fakeFetch([{status: 429, json: {code: 'Throttling.RateQuota', message: 'Requests throttling triggered'}}, {text: alyOk()}]);
  const r = await aly('欢迎使用精酿。', {fetch: f429, sleep: noSleep()});
  assert.equal(f429.calls.length, 2);
  assert.ok(r.durMs > 0);
  const fbad = fakeFetch([{text: sse([['error', {code: 'InvalidParameter', message: 'voice not found', request_id: 'r2'}]])}]);
  await rejects(aly('欢迎。', {fetch: fbad, sleep: noSleep()}), (e) => {
    assert.equal(e.code, 'BAD_PARAMS');
    assert.equal(fbad.calls.length, 1);
  });
  const fq = fakeFetch([{status: 429, json: {code: 'Throttling.AllocationQuota', message: 'Allocated quota exceeded'}}]);
  await rejects(aly('欢迎。', {fetch: fq, sleep: noSleep()}), (e) => assert.equal(e.code, 'QUOTA'));
});

test('阿里云 / 火山引擎没 key：不发请求，提示先用 mock 预览', async () => {
  const f = fakeFetch([]);
  await rejects(aly('欢迎。', {fetch: f, env: {}}), (e) => {
    assert.equal(e.code, 'NO_KEY');
    assert.match(e.message, /DASHSCOPE_API_KEY/);
    assert.match(e.message, /mock/);
  });
  await rejects(volc('欢迎。', {fetch: f, env: {VOLCENGINE_TTS_APP_ID: 'only-app-id'}}), (e) => {
    assert.equal(e.code, 'NO_KEY');
    assert.match(e.message, /VOLCENGINE_TTS_API_KEY/);
  });
  assert.equal(f.calls.length, 0);
});

test('火山引擎成功：V3 SSE 请求头、请求体照文档；352 音频分片拼接，351 时间戳秒换毫秒', async () => {
  const f = fakeFetch([{text: volcOk()}]);
  const r = await volc('欢迎使用精酿。', {fetch: f, speed: 1.1});
  const [call] = f.calls;
  assert.equal(call.url, 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse');
  assert.equal(call.headers['X-Api-Key'], FAKE_VOLC);
  assert.equal(call.headers['X-Api-Resource-Id'], 'seed-tts-2.0');
  assert.ok(call.headers['X-Api-Request-Id']);
  assert.equal(call.body.req_params.text, '欢迎使用精酿。');
  assert.equal(call.body.req_params.speaker, 'zh_male_guanggaojieshuo_uranus_bigtts', '默认中文男声');
  assert.equal(call.body.req_params.audio_params.speech_rate, 10);
  assert.equal(call.body.req_params.audio_params.enable_subtitle, true, '2.0 用 enable_subtitle');
  assert.equal(call.body.req_params.audio_params.enable_timestamp, undefined);
  assert.ok(fs.readFileSync(r.audioPath).equals(Buffer.concat([MP3_A, MP3_B])));
  assert.equal(r.durMs, 1440);
  assert.equal(r.granularity, 'char');
  assert.equal(r.words[0].startMs, 60);
  assert.equal(r.words.at(-1).endMs, 1380);
  assert.equal(r.usageCharacters, 7);
});

test('火山引擎：1.0 资源用 enable_timestamp；旧版鉴权走 APP ID + Access Token；语速换算', async () => {
  const f = fakeFetch([{text: volcOk()}]);
  await volc('欢迎使用精酿。', {fetch: f, model: 'seed-tts-1.0', voiceId: 'zh_male_example_moon_bigtts', env: {VOLCENGINE_TTS_APP_ID: 'app1', VOLCENGINE_TTS_ACCESS_TOKEN: FAKE_VOLC}});
  const [call] = f.calls;
  assert.equal(call.headers['X-Api-Resource-Id'], 'seed-tts-1.0');
  assert.equal(call.headers['X-Api-App-Id'], 'app1');
  assert.equal(call.headers['X-Api-Access-Key'], FAKE_VOLC);
  assert.equal(call.headers['X-Api-Key'], undefined);
  assert.equal(call.body.req_params.audio_params.enable_timestamp, true);
  assert.equal(call.body.req_params.audio_params.enable_subtitle, undefined);
  assert.equal(volcengine.speechRateOf(0.5), -50);
  assert.equal(volcengine.speechRateOf(2), 100);
  assert.equal(volcengine.speechRateOf(1), 0);
});

test('火山引擎报错：音色没授权（45000000）不重试且不带 key；并发超限重试后成功；试用额度用完；http 地址被拒', async () => {
  const fa = fakeFetch([{text: sse([['152', {code: 45000000, message: `speaker permission denied ${FAKE_VOLC}`, data: null}]])}]);
  await rejects(volc('欢迎。', {fetch: fa, sleep: noSleep()}), (e) => {
    assert.equal(e.code, 'AUTH');
    assert.equal(fa.calls.length, 1);
    assert.ok(!e.message.includes(FAKE_VOLC));
  });
  const fr = fakeFetch([{text: sse([['152', {code: 45000292, message: 'quota exceeded for types: concurrency', data: null}]])}, {text: volcOk()}]);
  const r = await volc('欢迎使用精酿。', {fetch: fr, sleep: noSleep()});
  assert.equal(fr.calls.length, 2);
  assert.ok(r.durMs > 0);
  const fl = fakeFetch([{text: sse([['152', {code: 45000292, message: 'quota exceeded for types: xxx_lifetime', data: null}]])}]);
  await rejects(volc('欢迎。', {fetch: fl, sleep: noSleep()}), (e) => assert.equal(e.code, 'QUOTA'));
  const f401 = fakeFetch([{status: 401, text: 'unauthorized'}]);
  await rejects(volc('欢迎。', {fetch: f401, sleep: noSleep()}), (e) => assert.equal(e.code, 'AUTH'));
  assert.throws(() => volcengine.endpointOf({VOLCENGINE_TTS_BASE_URL: 'http://openspeech.bytedance.com/x'}), (e) => e.code === 'INSECURE_URL');
});

test('三家的默认值：voiceConfigOf 按 provider 取默认音色和模型；情绪只给 MiniMax', () => {
  const a = voiceConfigOf({voice: {provider: 'aliyun', emotion: 'calm'}});
  assert.equal(a.voiceId, 'longsanshu_v3');
  assert.equal(a.model, 'cosyvoice-v3-flash');
  assert.equal(a.emotion, null);
  const v = voiceConfigOf({lang: 'en', voice: {provider: 'volcengine'}});
  assert.equal(v.voiceId, 'en_male_alex_uranus_bigtts');
  assert.equal(v.model, 'seed-tts-2.0');
  assert.equal(voiceConfigOf({voice: {provider: 'minimax', emotion: 'calm'}}).emotion, 'calm');
  assert.notEqual(cacheKey(a, '你好'), cacheKey({...a, provider: 'volcengine'}, '你好'), '缓存键含 provider');
});

test('校验：缺 key 按 provider 提醒对应变量；阿里云 / 火山引擎写 emotion 只提醒', () => {
  const run = (v, env = {}) => {
    const errs = [];
    const warns = [];
    checkVoiceMeta(v, {lang: 'zh', env, err: (w, p) => errs.push(`${w}:${p}`), warn: (w, p) => warns.push(`${w}:${p}`)});
    return {errs, warns};
  };
  const a = run({provider: 'aliyun', emotion: 'calm'});
  assert.equal(a.errs.length, 0);
  assert.ok(a.warns.some((w) => /DASHSCOPE_API_KEY/.test(w)));
  assert.ok(a.warns.some((w) => /emotion/.test(w)));
  assert.equal(run({provider: 'aliyun'}, {DASHSCOPE_API_KEY: 'x'}).warns.length, 0);
  const v = run({provider: 'volcengine', model: 'seed-tts-9'}, {VOLCENGINE_TTS_APP_ID: 'a', VOLCENGINE_TTS_ACCESS_TOKEN: 't'});
  assert.ok(!v.warns.some((w) => /VOLCENGINE_TTS_API_KEY/.test(w)), 'APP_ID + ACCESS_TOKEN 也算有 key');
  assert.ok(v.warns.some((w) => /seed-tts-9/.test(w)));
  assert.ok(run({provider: 'volcengine'}).warns.some((w) => /VOLCENGINE_TTS_API_KEY/.test(w)));
});

// ---------------- make 的配音步骤 ----------------
const sampleSb = (voice, extra = {}) => ({
  meta: {title: '配音自测', product: '示例', theme: 'tech-dark', action: '输入一句话，自动生成排版好的图', voice},
  shots: [
    {type: 'hook', dur: 2.5, caption: '排版排到半夜，\n{到底怎么办}', vo: '排版排到半夜，{到底怎么办}？', params: {visual: 'icon', icon: 'sparkle'}},
    {type: 'mockApp', beats: 8, vo: '写一段文案，点一下生成，排好版的图就出来了。', params: {kind: 'editor', title: '生成', input: '写一段文案', button: '生成', items: [{text: '结果一'}, {text: '结果二'}], done: '已生成'}},
    {type: 'steps', dur: 5, caption: '打开工具选一下，\n{排版自动搞定}', params: {items: [{title: '打开工具'}, {title: '点生成'}, {title: '拿结果'}]}},
    {type: 'endCard', dur: 4, vo: '示例，关键信息看得到。', params: {brand: '示例', slogan: '关键信息\n{看得到}'}},
    ...(extra.shots ?? []),
  ],
});

test('配音步骤（mock 全流程）：镜头时长按旁白改写、voice.json 符合约定、音频放进 _run/<id>/voice/', async () => {
  const specs = loadSpecs();
  const sb = sampleSb({provider: 'mock', subtitles: 'karaoke'});
  const runDir = path.join(TMP, 'run1');
  const vr = await runVoiceStep({sb, specs, beat: 0.5, schedule, runDir, runRel: '_run/test-1', cacheDir: path.join(TMP, 'cache')});
  assert.equal(vr.ok, true, vr.message);
  const v = vr.voice;
  for (const k of ['provider', 'voiceId', 'totalMs', 'duck', 'lines']) assert.ok(k in v, `voice.json 缺 ${k}`);
  assert.deepEqual({db: v.duck.db, attackMs: v.duck.attackMs, releaseMs: v.duck.releaseMs}, DUCK);
  assert.equal(v.lines.length, 3);
  for (const l of v.lines) {
    for (const k of ['shot', 'text', 'src', 'startMs', 'durMs', 'words', 'granularity']) assert.ok(k in l, `line 缺 ${k}`);
    assert.match(l.src, /^_run\/test-1\/voice\/\d\d-[0-9a-f]{10}\.wav$/);
    assert.ok(fs.existsSync(path.join(runDir, 'voice', path.basename(l.src))));
    assert.equal(l.startMs, LEAD_SEC * 1000);
    assert.ok(l.words.every((w) => w.startMs >= 0 && w.endMs <= l.durMs + 1));
    const dur = sb.shots[l.shot].dur;
    const need = LEAD_SEC + l.durMs / 1000 + TAIL_SEC;
    assert.ok(dur + 1e-9 >= need, '镜头时长够念完 + 留白');
    assert.ok(dur - need < 0.5 + 1e-9 || dur === specs[sb.shots[l.shot].type].dur.min, '只向上取到整拍（或 spec 最小值）');
    assert.equal(Math.round(dur / 0.5) * 0.5, dur, '整拍');
  }
  assert.equal(sb.shots[1].beats, undefined, '改写时长后删掉 beats');
  assert.equal(v.lines[1].text, sb.shots[1].vo);
  // 字幕：写了 caption 的镜头不出旁白字幕；endCard（caption: none）不出；没写 caption 的出
  assert.deepEqual(v.lines.map((l) => l.subtitle), [false, true, false]);
  assert.ok(v.lines[0].words.some((w) => w.hot));
  // 整片时长和按新时长排程的一致；人声区间给配乐闪避
  const slots = schedule(sb, specs);
  assert.equal(v.totalMs, Math.round(slots[slots.length - 1].end * 1000));
  const iv = voiceIntervals(v);
  assert.equal(iv.length, 3);
  assert.ok(Math.abs(iv[1][0] - (slots[1].start + LEAD_SEC)) < 0.002);
  // 老分镜（不写 meta.voice）：不会进这一步
  assert.equal(voiceConfigOf({}), null);
  // 改写后的分镜按新时长校验仍然通过
  const r2 = validate(JSON.parse(JSON.stringify(sb)), {baseDir: ROOT});
  assert.deepEqual(r2.errors.map((e) => e.problem), []);
  // 第二次跑：全部缓存命中
  const vr2 = await runVoiceStep({sb: sampleSb({provider: 'mock'}), specs, beat: 0.5, schedule, runDir: path.join(TMP, 'run2'), runRel: '_run/test-2', cacheDir: path.join(TMP, 'cache')});
  assert.equal(vr2.manifest.cacheHits, 3);
  assert.equal(vr2.manifest.synthesized, 0);
  // quiz / journey（captionLayer: none）自己画字幕条：每句都 subtitle = true；subtitles: off 时一律 false
  const vr3 = await runVoiceStep({sb: sampleSb({provider: 'mock'}), specs, beat: 0.5, schedule, runDir: path.join(TMP, 'run2b'), runRel: '_run/test-2b', cacheDir: path.join(TMP, 'cache'), captionLayer: 'none'});
  assert.deepEqual(vr3.voice.lines.map((l) => l.subtitle), [true, true, true]);
  const vr4 = await runVoiceStep({sb: sampleSb({provider: 'mock', subtitles: 'off'}), specs, beat: 0.5, schedule, runDir: path.join(TMP, 'run2c'), runRel: '_run/test-2c', cacheDir: path.join(TMP, 'cache'), captionLayer: 'none'});
  assert.deepEqual(vr4.voice.lines.map((l) => l.subtitle), [false, false, false]);
});

test('配音步骤：旁白比这一镜最长时长还长 → 报错（退出码 1 那一类），告诉在哪一镜、怎么改', async () => {
  const sb = sampleSb({provider: 'mock'});
  sb.shots[0].vo = '排版这件事情真的太麻烦了，每天都要花很多时间对齐图片和文字，改来改去还是不满意。';
  const vr = await runVoiceStep({sb, specs: loadSpecs(), beat: 0.5, schedule, runDir: path.join(TMP, 'run3'), runRel: '_run/t3', cacheDir: path.join(TMP, 'cache')});
  assert.equal(vr.ok, false);
  assert.equal(vr.kind, 'invalid');
  assert.match(vr.errors[0].where, /第 1 镜（hook）vo/);
  assert.match(vr.errors[0].fix, /拆到两镜/);
});

test('配音步骤：spec 最短时长不在整拍上时向上取整拍（quiz 一拍 0.46875 秒，最短 3.8 秒 → 9 拍，不能落成 8 拍 3.75 秒）', async () => {
  const specs = {...loadSpecs()};
  specs.endCard = {...specs.endCard, dur: {min: 3.8, max: 6.5, default: 4.6875}};
  const sb = sampleSb({provider: 'mock'});
  const stub = (s) => {
    let t = 0;
    return s.shots.map((x) => {
      const d = x.dur ?? 3;
      const o = {type: x.type, start: t, dur: d, end: t + d};
      t += d;
      return o;
    });
  };
  const vr = await runVoiceStep({sb, specs, beat: 0.46875, schedule: stub, runDir: path.join(TMP, 'run-grid'), runRel: '_run/grid', cacheDir: path.join(TMP, 'cache')});
  assert.equal(vr.ok, true, vr.message);
  const d = sb.shots[3].dur;
  assert.ok(d + 1e-9 >= 3.8, `片尾 ${d} 秒不能短于 3.8`);
  assert.ok(Math.abs(d / 0.46875 - Math.round(d / 0.46875)) < 1e-6, '整拍');
  assert.ok(Math.abs(d - 9 * 0.46875) < 1e-6);
});

test('配音步骤（minimax 假响应）：mp3 解码成 wav 并统一响度；没 key 时给 usage 类错误', async () => {
  const specs = loadSpecs();
  const sb = sampleSb({provider: 'minimax', voiceId: 'Chinese (Mandarin)_News_Anchor'});
  const responses = [];
  for (let k = 0; k < 3; k++) responses.push({json: okBody({length: 1800, subtitle: ''})});
  // decode：把「mp3」变成一段 1.8 秒的安静 wav（模拟 ffmpeg 解码），检查响度被拉到统一水平
  const decode = (inFile, outWav) => {
    const n = 32000 * 1.8;
    const x = new Float32Array(n).map((_, i) => 0.02 * Math.sin((2 * Math.PI * 220 * i) / 32000));
    fs.writeFileSync(outWav, encodeWav(x, 32000));
    return true;
  };
  minimax._resetThrottle();
  const vr = await runVoiceStep({sb, specs, beat: 0.5, schedule, runDir: path.join(TMP, 'run4'), runRel: '_run/t4', cacheDir: path.join(TMP, 'cache-mm'), env: {MINIMAX_API_KEY: FAKE_KEY}, fetch: fakeFetch(responses), sleep: noSleep(), decode, minIntervalMs: 0});
  assert.equal(vr.ok, true, vr.message);
  assert.equal(vr.manifest.billedCharacters, 21);
  const l = vr.voice.lines[1];
  assert.match(l.src, /\.wav$/);
  const d = decodeWav(fs.readFileSync(path.join(TMP, 'run4', 'voice', path.basename(l.src))));
  const rms = Math.sqrt(d.samples.reduce((a, x) => a + x * x, 0) / d.samples.length);
  assert.ok(Math.abs(20 * Math.log10(rms) - VOICE_RMS_DB) < 1.5, `响度统一到约 ${VOICE_RMS_DB} dBFS（实际 ${(20 * Math.log10(rms)).toFixed(1)}）`);
  assert.ok(!JSON.stringify(vr.manifest).includes(FAKE_KEY) && !JSON.stringify(vr.voice).includes(FAKE_KEY), 'manifest / voice.json 里没有 key');
  const nokey = await runVoiceStep({sb: sampleSb({provider: 'minimax', voiceId: 'x-other'}), specs, beat: 0.5, schedule, runDir: path.join(TMP, 'run5'), runRel: '_run/t5', cacheDir: path.join(TMP, 'cache-mm'), env: {}});
  assert.equal(nokey.ok, false);
  assert.equal(nokey.kind, 'usage');
  assert.match(nokey.message, /MINIMAX_API_KEY/);
  assert.match(nokey.message, /mock/);
});

test('响度统一：峰值不超过 -1.5 dBFS', () => {
  const x = new Float32Array(32000).map((_, i) => (i % 400 < 5 ? 0.9 : 0.001));
  const d = decodeWav(normalizeWav(encodeWav(x, 32000)));
  const peak = d.samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(20 * Math.log10(peak) <= -1.4);
});

// ---------------- 配乐闪避（make_bgm.py） ----------------
test('配乐闪避：人声段整体压低约 10 dB，人声外音量不变', () => {
  const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const probe = spawnSync(PY, ['-c', 'import numpy, scipy'], {encoding: 'utf8'});
  if (probe.status !== 0) return 'skip：没有 Python + numpy/scipy';
  const run = (extra, out) =>
    spawnSync(PY, [path.join(ROOT, 'scripts', 'make_bgm.py'), '--duration', '8', '--bpm', '120', '--cues', '[0,4]', '--out', out, ...extra], {
      encoding: 'utf8',
      // FFMPEG 指向不存在的程序：跳过 ffmpeg 响度测量（按 RMS 近似），两次结果可逐点比较
      env: {...process.env, FFMPEG: path.join(TMP, 'no-ffmpeg'), PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'},
    });
  const a = path.join(TMP, 'bgm-plain.wav');
  const b = path.join(TMP, 'bgm-duck.wav');
  const p1 = run([], a);
  assert.equal(p1.status, 0, p1.stderr);
  const p2 = run(['--voice', '[[2.0,4.0],[4.2,5.0]]', '--duck-db', '-10'], b);
  assert.equal(p2.status, 0, p2.stderr);
  assert.match(p2.stdout, /闪避：2 段人声（合并成 1 段），压低 10\.0 dB/);
  const A = decodeWav(fs.readFileSync(a));
  const B = decodeWav(fs.readFileSync(b));
  const rmsDb = (s, t0, t1) => {
    let e = 0;
    const i0 = Math.round(t0 * A.sampleRate);
    const i1 = Math.round(t1 * A.sampleRate);
    for (let i = i0; i < i1; i++) e += s[i] * s[i];
    return 10 * Math.log10(e / (i1 - i0) + 1e-20);
  };
  const inside = rmsDb(B.samples, 2.3, 4.8) - rmsDb(A.samples, 2.3, 4.8);
  const outside = rmsDb(B.samples, 0.2, 1.7) - rmsDb(A.samples, 0.2, 1.7);
  const after = rmsDb(B.samples, 5.5, 7) - rmsDb(A.samples, 5.5, 7);
  assert.ok(Math.abs(inside + 10) < 0.6, `人声段压低约 10 dB（实际 ${inside.toFixed(2)}）`);
  assert.ok(Math.abs(outside) < 0.3, `人声前不变（实际 ${outside.toFixed(2)}）`);
  assert.ok(Math.abs(after) < 0.3, `人声结束 0.3 秒后恢复（实际 ${after.toFixed(2)}）`);
});

// ---------------- 跑 ----------------
let pass = 0;
let fail = 0;
let skip = 0;
for (const t of tests) {
  try {
    const r = await t.fn();
    if (typeof r === 'string' && r.startsWith('skip')) {
      skip++;
      console.log(`[SKIP] ${t.name}（${r}）`);
    } else pass++;
  } catch (e) {
    fail++;
    console.log(`[FAIL] ${t.name}\n  ${String(e?.stack ?? e).split('\n').slice(0, 6).join('\n  ')}`);
  }
}
try {
  fs.rmSync(TMP, {recursive: true, force: true});
} catch {}
console.log(`配音自测：${tests.length} 条，通过 ${pass}，失败 ${fail}${skip ? `，跳过 ${skip}` : ''}`);
process.exit(fail ? 1 : 0);
