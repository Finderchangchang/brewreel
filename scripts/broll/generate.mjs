import fs from 'node:fs';
import path from 'node:path';
import {checkClip} from './check-clip.mjs';
import {decidePaid, loadLedger, nextRedoCount, resumeClip, saveLedger} from './ledger.mjs';
import {clipCost} from './prices.mjs';
import {prepareLocal} from './providers/local.mjs';
import {renderPlaceholder} from './providers/placeholder.mjs';
import {createH3Client, taskFailure} from './providers/minimax-h3.mjs';
import {framesFor} from './time.mjs';

const now = () => new Date().toISOString();

/** 有限并发。worker 抛错后不再领新任务；已经在跑的会跑完。 */
export const mapPool = async (items, limit, worker) => {
  const list = [...items];
  let cursor = 0;
  let active = 0;
  let stop = false;
  const errors = [];
  if (!list.length) return;
  await new Promise((resolve) => {
    const pump = () => {
      if (stop && active === 0) return resolve();
      while (!stop && active < limit && cursor < list.length) {
        const item = list[cursor];
        cursor += 1;
        active += 1;
        Promise.resolve()
          .then(() => worker(item))
          .catch((e) => {
            errors.push(e);
            stop = true;
          })
          .finally(() => {
            active -= 1;
            if ((stop || cursor >= list.length) && active === 0) resolve();
            else pump();
          });
      }
      if (cursor >= list.length && active === 0) resolve();
    };
    pump();
  });
  if (errors.length) throw errors[0];
};

const relTo = (outDir, file) => {
  if (!file) return file;
  if (!path.isAbsolute(file)) return file.split(path.sep).join('/');
  const rel = path.relative(outDir, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return file;
  return rel.split(path.sep).join('/');
};

const statusOf = (e) => {
  if (e.code === 'AUTH') return 'auth';
  if (e.code === 'BALANCE') return 'balance';
  if (e.code === 'MODERATION') return 'moderation';
  if (e.code === 'SUBMIT_UNKNOWN') return 'submit_unknown';
  if (e.code === 'FAILED') return 'failed';
  return 'submit_failed';
};

/**
 * 按账本把计划里的片段生成到 outDir/clips。
 * placeholder / local 走原来的同步状态机。minimax-h3 提交成功立刻落盘 task id。
 */
export const generateClips = async ({
  doc,
  plan,
  outDir,
  projectDir,
  only = null,
  forceRedo = false,
  concurrency = 3,
  client = null,
  references = null,
  log = console.log,
  haltAfterSubmits = 0,
  pollMs,
  timeoutMs,
  sleep,
}) => {
  const ledgerPath = path.join(outDir, 'ledger.json');
  const ledger = loadLedger(ledgerPath);
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(() => saveLedger(ledgerPath, ledger));
    return writeChain;
  };
  const clipDir = path.join(outDir, 'clips');
  const rawDir = path.join(outDir, 'raw');
  const checkDir = path.join(outDir, 'check');
  fs.mkdirSync(clipDir, {recursive: true});
  fs.mkdirSync(rawDir, {recursive: true});
  fs.mkdirSync(checkDir, {recursive: true});
  const preset = doc.provider === 'placeholder' ? 'ultrafast' : 'veryfast';
  const selected = only ? plan.clips.filter((c) => c.id === only) : plan.clips;
  if (only && !selected.length) {
    const err = new Error(`--only ${only} 不在这份计划里。先看 broll.plan.json 里的 id。`);
    err.exitCode = 2;
    throw err;
  }

  const h3 = doc.provider === 'minimax-h3' ? client ?? createH3Client({pollMs, timeoutMs, sleep, log}) : null;
  const refs = references ?? [];

  let submittedNow = 0;
  const runOne = async (clip) => {
    const prev = ledger.clips[clip.id] ?? null;
    if (!h3) {
      const ops = {
        submit() {
          if (doc.provider === 'placeholder') {
            const dest = path.join(rawDir, `${clip.id}.mp4`);
            renderPlaceholder({
              id: clip.id,
              plain: clip.plain,
              sentence: clip.sentence,
              width: plan.width,
              height: plan.height,
              frames: framesFor(clip.windowMs[1] - clip.windowMs[0], 30),
              dest,
            });
            log(`生成 ${clip.id}（占位片，${clip.genSec} 秒）`);
            return {taskId: `placeholder-${clip.id}-${clip.requestHash.slice(0, 8)}`, provider: doc.provider, file: relTo(outDir, dest)};
          }
          const got = prepareLocal({file: clip.file, projectDir, windowSec: clip.windowSec});
          log(`采用本地文件 ${clip.id}`);
          return {taskId: `local-${clip.id}-${clip.requestHash.slice(0, 8)}`, provider: doc.provider, file: got.abs};
        },
        query(entry) {
          const abs = path.isAbsolute(entry.file || '') ? entry.file : path.resolve(outDir, entry.file || '');
          if (entry.file && fs.existsSync(abs)) return {status: 'downloaded', file: entry.file};
          return {status: 'submitted'};
        },
        check(entry) {
          return runCheck(clip, entry);
        },
      };
      const step = await resumeClip(prev, clip.requestHash, ops);
      if (!step.entry.generatedAt) step.entry.generatedAt = step.entry.updatedAt;
      ledger.clips[clip.id] = step.entry;
      await persist();
      if (step.action === 'reuse') log(`复用 ${clip.id}（请求没变，不重新生成）`);
      return;
    }

    let action = decidePaid(prev, clip.requestHash, {redo: only === clip.id});
    if (action === 'stuck') {
      const err = new Error(`${clip.id} 上次提交结果不明（${prev.status}），不重提。请人工核对后再说。`);
      err.exitCode = 4;
      throw err;
    }
    if (action === 'hold') {
      const why = prev.error?.message || prev.status;
      const err = new Error(`${clip.id} 上次是 ${prev.status}：${why}。不自动重做。要重做这一段，加 --only ${clip.id}`);
      err.exitCode = 4;
      throw err;
    }
    if (action === 'reuse') {
      log(`复用 ${clip.id}（请求没变，不重新生成）`);
      return;
    }
    if ((action === 'redo' || action === 'submit') && !refs.length) {
      const err = new Error('风格预设没有参考图。先跑 node scripts/broll/make-style-refs.mjs --yes');
      err.exitCode = 2;
      throw err;
    }
    if (action === 'redo') {
      const redoCount = nextRedoCount(prev, {force: forceRedo, id: clip.id, log});
      const entry = {
        requestHash: clip.requestHash,
        provider: doc.provider,
        status: 'submitting',
        taskId: null,
        file: null,
        redoCount,
        estimateYuan: clip.costYuan,
        genSec: clip.genSec,
        quality: plan.quality,
        updatedAt: now(),
      };
      ledger.clips[clip.id] = entry;
      await persist();
      await submitPaid(clip, entry);
      return;
    }
    if (action === 'submit') {
      const entry = {
        requestHash: clip.requestHash,
        provider: doc.provider,
        status: 'submitting',
        taskId: null,
        file: null,
        redoCount: 0,
        estimateYuan: clip.costYuan,
        genSec: clip.genSec,
        quality: plan.quality,
        updatedAt: now(),
      };
      ledger.clips[clip.id] = entry;
      await persist();
      await submitPaid(clip, entry);
      return;
    }
    if (action === 'query') {
      log(`续跑 ${clip.id}，task id ${prev.taskId}，只查不重提`);
      await finishPaid(clip, prev);
      return;
    }
    if (action === 'check') {
      const checked = runCheck(clip, prev);
      ledger.clips[clip.id] = {...prev, ...checked, status: 'checked', updatedAt: now()};
      await persist();
    }
  };

  const runCheck = (clip, entry) => {
    const src = path.isAbsolute(entry.file || '') ? entry.file : path.resolve(outDir, entry.file || '');
    const dest = path.join(clipDir, `${clip.id}.mp4`);
    const done = checkClip({
      src,
      dest,
      frames: framesFor(clip.windowMs[1] - clip.windowMs[0], 30),
      width: plan.width,
      height: plan.height,
      frameDir: checkDir,
      id: clip.id,
      preset,
      crf: 18,
    });
    if (done.meta.black > 0) throw Object.assign(new Error(`${clip.id} 有黑帧（${done.meta.black} 段）。换一段画面，或检查源文件是不是黑的。`), {exitCode: 4});
    if (done.meta.freeze > 0) throw Object.assign(new Error(`${clip.id} 有静帧（${done.meta.freeze} 段）。画面要有变化。`), {exitCode: 4});
    log(`检查 ${clip.id}：${done.meta.durationSec.toFixed(2)} 秒，黑帧 0，静帧 0`);
    const meta = {black: done.meta.black, freeze: done.meta.freeze, durationSec: done.meta.durationSec};
    return {file: relTo(outDir, dest), meta, check: meta, generatedAt: entry.generatedAt ?? now()};
  };

  const submitPaid = async (clip, entry) => {
    let taskId;
    try {
      taskId = await h3.submit({
        prompt: `参考所附参考图的材质和机器人造型。${clip.prompt}`,
        refs,
        resolution: plan.quality,
        duration: clip.genSec,
        ratio: plan.aspect,
      });
    } catch (e) {
      entry.status = statusOf(e);
      entry.error = {code: e.code || 'API', message: e.message};
      entry.updatedAt = now();
      ledger.clips[clip.id] = entry;
      await persist();
      if (!e.exitCode) e.exitCode = 4;
      throw e;
    }
    entry.taskId = taskId;
    entry.status = 'submitted';
    entry.submittedAt = now();
    entry.updatedAt = entry.submittedAt;
    entry.error = null;
    ledger.clips[clip.id] = entry;
    await persist();
    log(`提交 ${clip.id}，task id ${taskId}`);
    submittedNow += 1;
    if (haltAfterSubmits && submittedNow >= haltAfterSubmits) {
      log(`已提交 ${submittedNow} 段，停在这里`);
      await new Promise(() => {});
    }
    await finishPaid(clip, entry);
  };

  const finishPaid = async (clip, entry) => {
    let task;
    try {
      task = await h3.poll(entry.taskId, entry.submittedAt || entry.updatedAt);
    } catch (e) {
      entry.updatedAt = now();
      ledger.clips[clip.id] = entry;
      await persist();
      const err = new Error(`${clip.id} 查询失败：${e.message}。task id ${entry.taskId} 已保留，再跑同一条命令会继续查，不会重新提交。`);
      err.exitCode = 4;
      throw err;
    }
    if (task.status === 'timeout') {
      entry.status = 'timeout';
      entry.updatedAt = now();
      ledger.clips[clip.id] = entry;
      await persist();
      const err = new Error(`${clip.id} 超过 30 分钟。task id ${entry.taskId} 已保留，再跑会继续查，不会重新提交。`);
      err.exitCode = 4;
      throw err;
    }
    if (task.status === 'failed' || task.status === 'cancelled') {
      const fail = taskFailure(task, '');
      entry.status = fail.code === 'MODERATION' ? 'moderation' : task.status === 'cancelled' ? 'cancelled' : 'failed';
      entry.error = {code: fail.code, message: fail.message};
      entry.updatedAt = now();
      ledger.clips[clip.id] = entry;
      await persist();
      fail.exitCode = 4;
      throw fail;
    }
    entry.status = 'succeeded';
    entry.outputSeconds = Number(task.outputSeconds ?? clip.genSec);
    entry.costYuan = clipCost(doc.provider, plan.quality, entry.outputSeconds);
    entry.elapsedSec = task.elapsedSec ?? null;
    entry.usage = {output_seconds: task.outputSeconds ?? null, input_image_count: task.inputImageCount ?? null};
    entry.updatedAt = now();
    ledger.clips[clip.id] = entry;
    await persist();
    const raw = path.join(rawDir, `${clip.id}.mp4`);
    let bytes;
    try {
      bytes = await h3.download(entry.taskId, raw, task.url);
    } catch (e) {
      entry.updatedAt = now();
      ledger.clips[clip.id] = entry;
      await persist();
      const err = new Error(`${clip.id} 下载失败：${e.message}。task id ${entry.taskId} 还在，再跑会重新查询新链接，不会重新生成。`);
      err.exitCode = 4;
      throw err;
    }
    entry.status = 'downloaded';
    entry.file = relTo(outDir, raw);
    entry.bytes = bytes;
    entry.generatedAt = entry.generatedAt ?? now();
    entry.updatedAt = now();
    ledger.clips[clip.id] = entry;
    await persist();
    const spent = task.elapsedSec != null ? `，服务器耗时 ${task.elapsedSec} 秒` : '';
    log(`${clip.id} 完成${spent}，计费 ${entry.outputSeconds} 秒，按价目表 ${entry.costYuan} 元`);
    const checked = runCheck(clip, entry);
    ledger.clips[clip.id] = {...entry, ...checked, status: 'checked', updatedAt: now()};
    await persist();
  };

  try {
    await mapPool(selected, Math.max(1, concurrency), runOne);
  } catch (e) {
    await persist();
    throw e;
  }
  return ledger;
};
