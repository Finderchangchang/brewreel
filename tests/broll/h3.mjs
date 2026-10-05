// MiniMax H3 的假服务器测试。不联网。
import {spawn, spawnSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractDeliveryFrames} from '../../scripts/broll/frames.mjs';
import {generateClips, holdMessage, mapPool, redoCommandOf, shellArg} from '../../scripts/broll/generate.mjs';
import {decidePaid, nextRedoCount, REDO_LIMIT} from '../../scripts/broll/ledger.mjs';
import {ffmpeg, ffmpegPath} from '../../scripts/broll/media.mjs';
import {createH3Client, resolveBase} from '../../scripts/broll/providers/minimax-h3.mjs';
import {checkReview} from '../../scripts/broll/review.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SECRET = 'unit-test-key';

const send = (res, status, obj) => {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {'Content-Type': 'application/json', 'Content-Length': body.length});
  res.end(body);
};

const succeeded = (url) => ({
  task: {
    status: 'succeeded',
    created_at: 1000,
    updated_at: 1139,
    resolution: '768P',
    duration: 5,
    ratio: '9:16',
    usage: {output_seconds: 5, input_image_count: 1, total_seconds: 5},
    content: {url},
  },
});

const startServer = (handler) =>
  new Promise((resolve) => {
    const state = {posts: 0, queries: 0, downloads: 0};
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const auth = req.headers.authorization || '';
      if (req.method !== 'GET' || !url.pathname.startsWith('/dl/')) {
        if (auth !== `Bearer ${SECRET}`) {
          send(res, 401, {base_resp: {status_code: 1004, status_msg: 'auth'}});
          return;
        }
      }
      if (req.method === 'POST' && url.pathname === '/v2/video_generation') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        state.posts += 1;
        state.lastBody = Buffer.concat(chunks).length;
        handler.onSubmit(req, res, state);
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith('/v2/query/video_generation/')) {
        state.queries += 1;
        handler.onQuery(req, res, decodeURIComponent(url.pathname.split('/').pop()), state);
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith('/dl/')) {
        state.downloads += 1;
        handler.onDownload(req, res, state);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        state,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });

const clientOf = (base, extra = {}) =>
  createH3Client({
    baseUrl: base,
    env: {MINIMAX_API_KEY: SECRET, MINIMAX_BASE_URL: base},
    pollMs: 1,
    timeoutMs: 5000,
    sleep: extra.sleep ?? (async () => {}),
    log: extra.log ?? (() => {}),
  });

const planOf = (ids, over = {}) => ({
  version: 1,
  quality: '768P',
  aspect: '9:16',
  width: 180,
  height: 320,
  fps: 30,
  priceYuanPerSec: 0.5,
  totalYuan: ids.length * 2.5,
  clips: ids.map((id) => ({
    id,
    plain: '测试画面',
    sentence: '测试原句',
    prompt: '积木机器人把方块摆好。',
    windowMs: [0, 1000],
    windowSec: 1,
    genSec: 5,
    costYuan: 2.5,
    requestHash: `hash-${id}`,
    mode: 'full',
    ...over,
  })),
});

const doc = {provider: 'minimax-h3', style: 'brick-diorama', quality: '768P'};

const scrub = (text) => String(text ?? '').split(SECRET).join('***');

const makeMp4 = (file) => {
  const r = ffmpeg([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x285AC8:s=180x320:r=30:d=2',
    '-vf',
    "format=rgb24,geq=r='clip(40+80*sin(2*PI*T),0,255)':g=90:b=200,format=yuv420p",
    '-frames:v',
    '50',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'ultrafast',
    file,
  ]);
  if (r.status !== 0 || !fs.existsSync(file)) throw new Error(scrub(r.stderr || r.stdout || '素材失败'));
  return fs.readFileSync(file);
};

const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

if (process.argv[2] === '--worker') {
  const base = process.argv[3];
  const outDir = process.argv[4];
  const ref = process.argv[5];
  const {generateClips: run} = await import('../../scripts/broll/generate.mjs');
  const plan = JSON.parse(fs.readFileSync(path.join(outDir, 'broll.plan.json'), 'utf8'));
  const client = clientOf(base);
  await run({
    doc,
    plan,
    outDir,
    projectDir: outDir,
    concurrency: 1,
    client,
    references: [ref],
    haltAfterSubmits: Number(process.env.BROLL_HALT_AFTER || 0),
    log: (line) => console.log(line),
  });
  process.exit(0);
}

export const h3Tests = async ({check, runNode, ROOT, DEMO}) => {
  let insecure = '';
  try {
    resolveBase({MINIMAX_BASE_URL: 'http://example.com'});
  } catch (e) {
    insecure = e.message;
  }
  check('非本机 http 被拒绝', insecure.includes('https'));
  check('本机 http 给测试用', resolveBase({}, 'http://127.0.0.1:9') === 'http://127.0.0.1:9');

  const logs = [];
  let noKey = '';
  try {
    await createH3Client({env: {}, baseUrl: 'http://127.0.0.1:9', log: (s) => logs.push(s)}).submit({prompt: 'x', refs: [], resolution: '768P', duration: 5, ratio: '9:16'});
  } catch (e) {
    noKey = e.message;
  }
  check('没有密钥就停', noKey.includes('MINIMAX_API_KEY') && !noKey.includes(SECRET));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-h3-'));
  const mp4 = makeMp4(path.join(tmp, 'src.mp4'));
  const ref = path.join(tmp, 'ref.png');
  fs.writeFileSync(ref, png1);

  const runGen = async (srv, plan, outDir, opt = {}) => {
    if (!srv.state.base) srv.state.base = srv.base;
    const lines = [];
    const client = clientOf(srv.base, {log: (s) => lines.push(s), sleep: opt.sleep});
    try {
      const ledger = await generateClips({
        doc,
        plan,
        outDir,
        projectDir: outDir,
        concurrency: opt.concurrency ?? 1,
        only: opt.only ?? null,
        forceRedo: !!opt.forceRedo,
        client,
        references: [ref],
        log: (s) => lines.push(s),
      });
      return {ledger, lines, error: null};
    } catch (e) {
      return {ledger: null, lines, error: e};
    }
  };

  // 排队然后成功
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `q-${state.posts}`});
      },
      onQuery(_req, res, id) {
        if (srv.state.queries < 3) send(res, 200, {task: {status: 'processing'}});
        else send(res, 200, succeeded(`${srv.base}/dl/${id}`));
      },
      onDownload(_req, res) {
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': mp4.length});
        res.end(mp4);
      },
    });
    srv.state.base = srv.base;
    const outDir = path.join(tmp, 'queue');
    const got = await runGen(srv, planOf(['b01']), outDir);
    check('排队后成功', !got.error && got.ledger.clips.b01.status === 'checked' && got.ledger.clips.b01.taskId === 'q-1' && srv.state.posts === 1 && srv.state.queries >= 3, scrub(got.error?.message));
    check('账本记秒数和价目表', got.ledger?.clips.b01.outputSeconds === 5 && got.ledger?.clips.b01.costYuan === 2.5 && got.ledger?.clips.b01.requestHash === 'hash-b01');
    check('日志有 task id 且没有密钥', got.lines.join('\n').includes('q-1') && !got.lines.join('\n').includes(SECRET));
    await srv.close();
  }

  // 生成失败，不自动重做
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `f-${state.posts}`});
      },
      onQuery(_req, res) {
        send(res, 200, {task: {status: 'failed', error: {type: 'generation_error', message: 'decode failed'}}});
      },
      onDownload(_req, res) {
        res.writeHead(500);
        res.end();
      },
    });
    const outDir = path.join(tmp, 'fail');
    const first = await runGen(srv, planOf(['b01']), outDir);
    const second = await runGen(srv, planOf(['b01']), outDir);
    check('失败不自动重做', first.error && srv.state.posts === 1 && second.error && /不自动重做/.test(second.error.message) && srv.state.posts === 1, scrub(`${first.error?.message} / ${second.error?.message}`));
    await srv.close();
  }

  // 提交前就被接口 4xx 拒绝（参数错误，2026-10-05 真接口遇到过 2013 extra）：没生成、没扣费；重跑不自动重做，给出完整的重跑命令
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        if (state.posts === 1) send(res, 400, {base_resp: {status_code: 2013, status_msg: "invalid params, param 'extra' incompatible with model MiniMax-H3"}});
        else send(res, 200, {task_id: `p-${state.posts}`});
      },
      onQuery(_req, res, id) {
        send(res, 200, succeeded(`${srv.base}/dl/${id}`));
      },
      onDownload(_req, res) {
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': mp4.length});
        res.end(mp4);
      },
    });
    srv.state.base = srv.base;
    const outDir = path.join(tmp, 'param');
    const want = redoCommandOf({projectDir: outDir, outDir, id: 'b01', provider: 'minimax-h3'});
    const first = await runGen(srv, planOf(['b01']), outDir);
    const led1 = JSON.parse(fs.readFileSync(path.join(outDir, 'ledger.json'), 'utf8')).clips.b01;
    check('参数错误：账本记成 submit_failed，没有 task id', first.error && led1.status === 'submit_failed' && !led1.taskId && led1.error?.code === 'API' && srv.state.posts === 1, scrub(JSON.stringify(led1)));
    check('参数错误：当场说清没生成、没扣费，并给出重跑命令', /这次没有生成、没有扣费/.test(first.error?.message) && first.error.message.includes('2013') && first.error.message.trim().endsWith(want), scrub(first.error?.message));
    const second = await runGen(srv, planOf(['b01']), outDir);
    const msg = second.error?.message || '';
    check('参数错误：重跑不自动重做、不再提交', second.error && /不自动重做/.test(msg) && srv.state.posts === 1, scrub(msg));
    check('参数错误：重跑提示写清这次没有生成、没有扣费', msg.includes('这次没有生成、没有扣费') && msg.includes('2013'), scrub(msg));
    const cmd = msg.split(/\r?\n/).pop().trim();
    check(
      '参数错误：最后一行是可复制的完整命令',
      cmd === want && cmd.startsWith('node scripts/make-talk.mjs ') && cmd.includes(`--out ${shellArg(outDir)}`) && cmd.includes('--provider minimax-h3') && cmd.endsWith('--yes --only b01'),
      scrub(cmd),
    );
    const third = await runGen(srv, planOf(['b01']), outDir, {only: 'b01'});
    check('参数错误：照命令加 --only 才重新提交', !third.error && srv.state.posts === 2 && third.ledger.clips.b01.status === 'checked' && third.ledger.clips.b01.taskId === 'p-2', scrub(third.error?.message));
    await srv.close();
  }

  // 重跑命令的拼法和说明的分支（不联网）
  {
    const talkCmd = 'node scripts/talk.mjs "D:/my proj" --out D:/out --provider minimax-h3 --yes';
    check('重跑命令：从 talk.mjs 来的就在那条后面加 --only', redoCommandOf({talkCmd, projectDir: 'x', outDir: 'y', id: 'b02'}) === `${talkCmd} --only b02`);
    const absProj = path.join(tmp, 'my proj');
    const absOut = path.join(tmp, 'out');
    const got = redoCommandOf({argv: ['rel', '--out', 'o', '--provider', 'minimax-h3', '--yes', '--only', 'b01', '--force-redo', '--concurrency', '2'], projectDir: absProj, outDir: absOut, id: 'b03'});
    check(
      '重跑命令：直接跑 make-talk 的按这次参数拼，路径换成绝对路径，去掉 --only / --force-redo',
      got === `node scripts/make-talk.mjs "${absProj}" --out ${shellArg(absOut)} --provider minimax-h3 --yes --concurrency 2 --only b03`,
      got,
    );
    check('重跑命令：原来没写 --yes 的补上', redoCommandOf({argv: ['p', '--out', 'o'], projectDir: 'P', outDir: 'O', id: 'b01'}) === 'node scripts/make-talk.mjs P --out O --yes --only b01');
    const server = holdMessage('b01', {status: 'submit_failed', taskId: null, error: {code: 'SERVER', message: '服务暂时出错（500）：x'}}, 'CMD');
    check('说明：5xx 不打「没扣费」的包票', !server.includes('没有扣费') && server.includes('MiniMax 后台') && server.endsWith('CMD'), server);
    const paid = holdMessage('b01', {status: 'failed', taskId: 't-1', error: {code: 'FAILED', message: '生成失败：decode failed。不自动重做。'}}, 'CMD');
    check('说明：生成过的段写明重做会重新计费', !paid.includes('没有扣费') && paid.includes('重新计费') && paid.endsWith('CMD'), paid);
  }

  // 审核拦截
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `m-${state.posts}`});
      },
      onQuery(_req, res) {
        send(res, 200, {task: {status: 'failed', error: {type: 'content_filter', message: 'input image sensitive'}}});
      },
      onDownload(_req, res) {
        res.writeHead(500);
        res.end();
      },
    });
    const outDir = path.join(tmp, 'mod');
    const got = await runGen(srv, planOf(['b01']), outDir);
    const ledger = JSON.parse(fs.readFileSync(path.join(outDir, 'ledger.json'), 'utf8'));
    check('审核拦截停下并记原因', got.error && ledger.clips.b01.status === 'moderation' && /内容审核拦截/.test(ledger.clips.b01.error.message) && srv.state.posts === 1, scrub(got.error?.message));
    await srv.close();
  }

  // 查询 429 退避，提交只有一次
  {
    const delays = [];
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `r-${state.posts}`});
      },
      onQuery(_req, res, id) {
        if (srv.state.queries < 3) send(res, 429, {base_resp: {status_code: 1002, status_msg: 'rate limit'}});
        else send(res, 200, succeeded(`${srv.base}/dl/${id}`));
      },
      onDownload(_req, res) {
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': mp4.length});
        res.end(mp4);
      },
    });
    srv.state.base = srv.base;
    const outDir = path.join(tmp, 'rate');
    const got = await runGen(srv, planOf(['b01']), outDir, {sleep: async (ms) => delays.push(ms)});
    check('429 退避后查成功', !got.error && srv.state.posts === 1 && delays.length >= 2 && delays[1] >= delays[0], scrub(got.error?.message || delays.join(',')));
    await srv.close();
  }

  // 提交 429 / 5xx 不重试
  {
    const srv = await startServer({
      onSubmit(_req, res) {
        const status = srv.state.posts === 1 ? 429 : 500;
        send(res, status, {base_resp: {status_code: status === 429 ? 1002 : 1000, status_msg: 'nope'}});
      },
      onQuery(_req, res) {
        send(res, 500, {base_resp: {status_code: 1000, status_msg: 'no'}});
      },
      onDownload(_req, res) {
        res.writeHead(500);
        res.end();
      },
    });
    const outDir = path.join(tmp, 'submit-fail');
    const first = await runGen(srv, planOf(['b01']), outDir);
    check('提交 429 不重试', first.error && /提交不重试/.test(first.error.message) && srv.state.posts === 1, scrub(first.error?.message));
    await srv.close();
  }

  // 链接过期，重新查询，不重新生成
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `e-${state.posts}`});
      },
      onQuery(_req, res, id) {
        send(res, 200, succeeded(`${srv.base}/dl/${id}`));
      },
      onDownload(_req, res) {
        if (srv.state.downloads === 1) {
          res.writeHead(403);
          res.end('gone');
          return;
        }
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': mp4.length});
        res.end(mp4);
      },
    });
    srv.state.base = srv.base;
    const outDir = path.join(tmp, 'expire');
    const got = await runGen(srv, planOf(['b01']), outDir);
    check('链接过期重新查询', !got.error && srv.state.posts === 1 && srv.state.downloads >= 2 && srv.state.queries >= 2 && /不重新生成/.test(got.lines.join('\n')), scrub(got.error?.message));
    await srv.close();
  }

  // 余额不足：后面的段不再提交
  {
    const srv = await startServer({
      onSubmit(_req, res) {
        send(res, 402, {base_resp: {status_code: 1008, status_msg: 'insufficient balance'}});
      },
      onQuery(_req, res) {
        send(res, 200, {task: {status: 'processing'}});
      },
      onDownload(_req, res) {
        res.writeHead(500);
        res.end();
      },
    });
    const outDir = path.join(tmp, 'balance');
    const got = await runGen(srv, planOf(['b01', 'b02']), outDir, {concurrency: 1});
    check('余额不足就停', got.error && got.error.code === 'BALANCE' && srv.state.posts === 1, scrub(`${got.error?.code} posts=${srv.state.posts}`));
    await srv.close();
  }

  // 鉴权失败不重试
  {
    const srv = await startServer({
      onSubmit(_req, res) {
        send(res, 401, {base_resp: {status_code: 1004, status_msg: 'bad key'}});
      },
      onQuery(_req, res) {
        send(res, 401, {base_resp: {status_code: 1004, status_msg: 'bad key'}});
      },
      onDownload(_req, res) {
        res.writeHead(401);
        res.end();
      },
    });
    const bare = createH3Client({baseUrl: srv.base, env: {MINIMAX_API_KEY: SECRET}, pollMs: 1, sleep: async () => {}});
    let msg = '';
    try {
      await bare.submit({prompt: 'x', refs: [ref], resolution: '768P', duration: 5, ratio: '9:16'});
    } catch (e) {
      msg = e.message;
    }
    check('401 不重试', msg.includes('鉴权失败') && srv.state.posts === 1 && !msg.includes(SECRET), scrub(msg));
    await srv.close();
  }

  // 重做次数
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `d-${state.posts}`});
      },
      onQuery(_req, res, id) {
        send(res, 200, succeeded(`${srv.base}/dl/${id}`));
      },
      onDownload(_req, res) {
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': mp4.length});
        res.end(mp4);
      },
    });
    srv.state.base = srv.base;
    const outDir = path.join(tmp, 'redo');
    const plan = planOf(['b01']);
    const first = await runGen(srv, plan, outDir);
    const again = await runGen(srv, plan, outDir);
    const redo1 = await runGen(srv, plan, outDir, {only: 'b01'});
    const redo2 = await runGen(srv, plan, outDir, {only: 'b01'});
    const blocked = await runGen(srv, plan, outDir, {only: 'b01'});
    const forced = await runGen(srv, plan, outDir, {only: 'b01', forceRedo: true});
    const joined = [...redo1.lines, ...forced.lines].join('\n');
    check(
      '重做两次后要 force',
      !first.error && again.lines.some((l) => l.includes('复用')) && srv.state.posts === 4 && blocked.error && blocked.error.code === 'REDO_LIMIT' && /force-redo/.test(blocked.error.message) && /第 3 次重做，已加 --force-redo/.test(joined),
      scrub(`${first.error?.message || ''} / ${blocked.error?.message || ''} / posts=${srv.state.posts} / ${joined}`),
    );
    check('重做上限常量', REDO_LIMIT === 2 && redo2.ledger?.clips.b01.redoCount === 2 && forced.ledger?.clips.b01.redoCount === 3);
    await srv.close();
  }

  // 状态机：有 task id 只查
  check('飞行中只查', decidePaid({requestHash: 'old', taskId: 't', status: 'submitted'}, 'new', {redo: true}) === 'query');
  check('结果不明不重提', decidePaid({requestHash: 'h', status: 'submit_unknown'}, 'h') === 'stuck');
  check('失败默认停', decidePaid({requestHash: 'h', status: 'failed', taskId: 't'}, 'h') === 'hold');
  let limited = '';
  try {
    nextRedoCount({redoCount: 2}, {id: 'b03'});
  } catch (e) {
    limited = e.message;
  }
  check('第 3 次重做被拦住', /b03/.test(limited) && /force-redo/.test(limited));

  // 中断后续跑
  {
    const srv = await startServer({
      onSubmit(_req, res, state) {
        send(res, 200, {task_id: `k-${state.posts}`});
      },
      onQuery(_req, res, id) {
        send(res, 200, succeeded(`${srv.base}/dl/${id}`));
      },
      onDownload(_req, res) {
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': mp4.length});
        res.end(mp4);
      },
    });
    const outDir = path.join(tmp, 'kill');
    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, 'broll.plan.json'), JSON.stringify(planOf(['b01', 'b02', 'b03'])), 'utf8');
    const spawnWorker = (halt) => {
      const child = spawn(process.execPath, [path.join(HERE, 'h3.mjs'), '--worker', srv.base, outDir, ref], {
        cwd: ROOT,
        env: {...process.env, MINIMAX_API_KEY: SECRET, MINIMAX_BASE_URL: srv.base, BROLL_HALT_AFTER: halt ? '2' : ''},
        windowsHide: true,
      });
      let text = '';
      child.stdout.on('data', (buf) => {
        text += buf.toString('utf8');
      });
      child.stderr.on('data', (buf) => {
        text += buf.toString('utf8');
      });
      return {child, text: () => text};
    };
    const waitExit = (child) =>
      new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve(child.exitCode);
          return;
        }
        child.once('exit', (code) => resolve(code));
      });
    const first = spawnWorker(true);
    const firstExit = waitExit(first.child);
    const ledgerPath = path.join(outDir, 'ledger.json');
    const countIds = () => {
      if (!fs.existsSync(ledgerPath)) return 0;
      try {
        const j = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
        return Object.values(j.clips || {}).filter((c) => c.taskId).length;
      } catch {
        return 0;
      }
    };
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (countIds() >= 2) break;
      if (first.child.exitCode !== null || first.child.signalCode !== null) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const stopChild = (child) => {
      try {
        child.kill();
      } catch {
        /* 已经退出 */
      }
      if (process.platform === 'win32' && child.pid && child.exitCode === null) {
        spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], {windowsHide: true, stdio: 'ignore'});
      }
    };
    stopChild(first.child);
    await Promise.race([firstExit, new Promise((r) => setTimeout(r, 5000))]);
    const seen = countIds() >= 2;
    const mid = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const second = spawnWorker(false);
    const code = await Promise.race([waitExit(second.child), new Promise((r) => setTimeout(() => r('timeout'), 60000))]);
    if (code === 'timeout') stopChild(second.child);
    const log2 = scrub(second.text());
    const end = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const submits = (log2.match(/提交 b0/g) || []).length;
    const proofDir = path.resolve(ROOT, '..', 'broll-b2');
    fs.mkdirSync(proofDir, {recursive: true});
    const proof = `第一次（提交两段后杀掉）：\n${scrub(first.text()).trim()}\n\n第二次（只查不重提）：\n${log2.trim()}\n`;
    fs.writeFileSync(path.join(proofDir, 'interrupt-log.txt'), proof, 'utf8');
    console.log(proof.trim());
    check(
      '杀掉后续跑不重提',
      seen && code === 0 && mid.clips.b01.taskId === end.clips.b01.taskId && mid.clips.b02.taskId === end.clips.b02.taskId && srv.state.posts === 3 && /只查不重提/.test(log2) && submits === 1,
      `seen=${seen} code=${code} posts=${srv.state.posts} submits=${submits}\n第一次：\n${scrub(first.text()).slice(-500)}\n第二次：\n${log2.slice(-800)}`,
    );
    await srv.close();
  }

  // 预算闸门和 --yes
  const paid = fs.mkdtempSync(path.join(os.tmpdir(), 'broll-paid-'));
  fs.copyFileSync(path.join(DEMO, 'talk.mp4'), path.join(paid, 'talk.mp4'));
  fs.copyFileSync(path.join(DEMO, 'talk.srt'), path.join(paid, 'talk.srt'));
  const baseDoc = JSON.parse(fs.readFileSync(path.join(DEMO, 'broll.json'), 'utf8'));
  fs.writeFileSync(path.join(paid, 'broll.json'), JSON.stringify({...baseDoc, provider: 'minimax-h3', budgetYuan: 1}), 'utf8');
  const overDir = path.join(tmp, 'over');
  const over = runNode(['scripts/make-talk.mjs', paid, '--out', overDir]);
  check('超预算退出 3', over.status === 3 && over.stdout.includes('超过预算') && over.stdout.includes('2.5') && !fs.existsSync(path.join(overDir, 'video.mp4')), scrub(over.stdout));
  fs.writeFileSync(path.join(paid, 'broll.json'), JSON.stringify({...baseDoc, provider: 'minimax-h3', budgetYuan: 20}), 'utf8');
  const noYesDir = path.join(tmp, 'noyes');
  const noYes = runNode(['scripts/make-talk.mjs', paid, '--out', noYesDir]);
  check('没加 --yes 就停', noYes.status === 3 && noYes.stdout.includes('--yes') && noYes.stdout.includes('合计') && noYes.stdout.includes('b01') && noYes.stdout.includes('b02') && !fs.existsSync(path.join(noYesDir, 'video.mp4')), scrub(noYes.stdout));
  const dryDir = path.join(tmp, 'dry-h3');
  const dry = runNode(['scripts/make-talk.mjs', paid, '--out', dryDir, '--dry-run']);
  check('dry-run 只估价', dry.status === 0 && dry.stdout.includes('估价明细') && dry.stdout.includes('不生成') && !fs.existsSync(path.join(dryDir, 'video.mp4')), scrub(dry.stdout));

  // 审片哈希
  const project = path.join(tmp, 'proj');
  const reviewed = path.join(tmp, 'reviewed');
  fs.mkdirSync(project, {recursive: true});
  fs.mkdirSync(path.join(reviewed, 'clips'), {recursive: true});
  fs.writeFileSync(path.join(project, 'broll.json'), '{"version":1,"note":"a"}\n', 'utf8');
  fs.writeFileSync(path.join(reviewed, 'clips', 'b01.mp4'), 'clip-v1', 'utf8');
  fs.writeFileSync(
    path.join(reviewed, 'broll.plan.json'),
    JSON.stringify({clips: [{id: 'b01', sentence: '先把要做的事列出来', plain: '先列计划', prompt: '积木机器人排队', costYuan: 2.5}]}),
    'utf8',
  );
  const sheet = runNode(['scripts/broll/review-sheet.mjs', project, '--out', reviewed]);
  const html = fs.existsSync(path.join(reviewed, 'review.html')) ? fs.readFileSync(path.join(reviewed, 'review.html'), 'utf8') : '';
  check('审片页', sheet.status === 0 && html.includes('先把要做的事列出来') && html.includes('先列计划') && html.includes('积木机器人排队') && html.includes('不许替人运行 approve'), scrub(sheet.stdout));
  const approved = runNode(['scripts/broll/approve.mjs', project, '--out', reviewed]);
  check('approve 写入', approved.status === 0 && fs.existsSync(path.join(reviewed, 'broll.review.json')), scrub(approved.stdout));
  const fresh = checkReview({projectDir: project, outDir: reviewed, clipIds: ['b01']});
  fs.writeFileSync(path.join(reviewed, 'clips', 'b01.mp4'), 'clip-v2', 'utf8');
  const staleClip = checkReview({projectDir: project, outDir: reviewed, clipIds: ['b01']});
  fs.writeFileSync(path.join(reviewed, 'clips', 'b01.mp4'), 'clip-v1', 'utf8');
  fs.writeFileSync(path.join(project, 'broll.json'), '{"version":1,"note":"b"}\n', 'utf8');
  const staleJson = checkReview({projectDir: project, outDir: reviewed, clipIds: ['b01']});
  check('审片哈希没变就有效', fresh.ok === true, fresh.reason || '');
  check('片段变了审片失效', staleClip.ok === false && /已变/.test(staleClip.reason), staleClip.reason);
  check('broll.json 变了审片失效', staleJson.ok === false && /broll.json/.test(staleJson.reason), staleJson.reason);

  // 检查帧来自成片
  const splitVid = path.join(tmp, 'split.mp4');
  const made = ffmpeg([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x202020:s=180x320:r=30:d=2',
    '-vf',
    "format=rgb24,geq=r='if(lt(Y,192),220,20)':g='if(lt(Y,192),30,40)':b='if(lt(Y,192),30,220)',format=yuv420p",
    '-frames:v',
    '50',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'ultrafast',
    splitVid,
  ]);
  check('分屏素材', made.status === 0);
  const frameDir = path.join(tmp, 'frames');
  extractDeliveryFrames({video: splitVid, clips: [{id: 'b01', windowMs: [400, 1600]}], durationSec: 1.6, fps: 30, checkDir: frameDir});
  const raw = readRaw(path.join(frameDir, 'b01-mid.png'));
  const top = raw ? px(raw, 20, 40, 180) : null;
  const bot = raw ? px(raw, 20, 280, 180) : null;
  check('检查帧来自成片', top && top[0] > 150 && bot && bot[2] > 150 && bot[0] < 80, `${top} / ${bot}`);

  let maxInFlight = 0;
  let nowIn = 0;
  await mapPool([1, 2, 3, 4], 2, async () => {
    nowIn += 1;
    maxInFlight = Math.max(maxInFlight, nowIn);
    await new Promise((r) => setTimeout(r, 30));
    nowIn -= 1;
  });
  check('并发不超过上限', maxInFlight <= 2 && maxInFlight >= 1, String(maxInFlight));

  const longUrl = `https://cdn.example/img/${'a'.repeat(500)}`;
  const imgSrv = await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if ((req.headers.authorization || '') !== `Bearer ${SECRET}`) {
        send(res, 401, {base_resp: {status_code: 1004, status_msg: 'auth'}});
        return;
      }
      send(res, 200, {base_resp: {status_code: 0, status_msg: 'success'}, data: {image_urls: [longUrl]}});
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
  const imgPort = imgSrv.address().port;
  const imgClient = createH3Client({
    baseUrl: `http://127.0.0.1:${imgPort}`,
    env: {MINIMAX_API_KEY: SECRET},
    pollMs: 1,
    sleep: async () => {},
  });
  let imgGot = '';
  try {
    imgGot = await imgClient.image({prompt: 'x', aspect: '16:9'});
  } catch (e) {
    imgGot = e.message;
  }
  check('长响应不被截断', imgGot === longUrl, scrub(imgGot).slice(0, 160));
  await new Promise((done) => imgSrv.close(done));

  fs.rmSync(tmp, {recursive: true, force: true});
  fs.rmSync(paid, {recursive: true, force: true});
};

const readRaw = (file) => {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], {
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 180 * 320 * 3) return null;
  return r.stdout;
};

const px = (buf, x, y, width) => {
  const i = (y * width + x) * 3;
  return [buf[i], buf[i + 1], buf[i + 2]];
};
