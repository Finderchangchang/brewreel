import fs from 'node:fs';
import path from 'node:path';

export const emptyLedger = () => ({version: 1, clips: {}});

export const loadLedger = (file) => {
  if (!file || !fs.existsSync(file)) return emptyLedger();
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (!j || typeof j !== 'object' || !j.clips || typeof j.clips !== 'object') return emptyLedger();
    return {version: 1, clips: j.clips};
  } catch {
    return emptyLedger();
  }
};

export const saveLedger = (file, ledger) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.rmSync(file, {force: true});
    fs.renameSync(tmp, file);
  }
};

/** 付费来源每段最多重做这么多次。再重做要 --force-redo。第一次生成不算重做。 */
export const REDO_LIMIT = 2;

const IN_FLIGHT = new Set(['submitted', 'succeeded', 'timeout']);
const HOLD = new Set(['failed', 'submit_failed', 'moderation', 'cancelled', 'auth', 'balance']);

/**
 * minimax-h3 用这一份。有 task id 且还在排队、生成、下载或超时：只查不重提。
 * 上次提交结果不明：stuck，不重提。失败过：hold，除非这次明确要重做。
 */
export const decidePaid = (entry, requestHash, opt = {}) => {
  const redo = !!opt.redo;
  if (entry && (entry.status === 'submitting' || entry.status === 'submit_unknown')) return 'stuck';
  if (entry?.taskId && IN_FLIGHT.has(entry.status)) return 'query';
  const spent = entry && (entry.taskId || entry.redoCount || entry.status === 'checked' || entry.status === 'approved' || entry.status === 'downloaded' || HOLD.has(entry.status));
  if (!entry || entry.requestHash !== requestHash) return spent ? 'redo' : 'submit';
  if (entry.status === 'checked' || entry.status === 'approved') return redo ? 'redo' : 'reuse';
  if (entry.status === 'downloaded') return redo ? 'redo' : 'check';
  if (HOLD.has(entry.status)) return redo ? 'redo' : 'hold';
  if (entry.taskId) return 'query';
  return 'submit';
};

/** 重做次数 +1。超过 REDO_LIMIT 且没 force 就抛错，退出码 3。 */
export const nextRedoCount = (entry, {force = false, id = '这段', log = () => {}} = {}) => {
  const done = Number(entry?.redoCount) || 0;
  const next = done + 1;
  if (next > REDO_LIMIT && !force) {
    const err = new Error(`${id} 已经重做 ${done} 次。第 ${next} 次要加 --force-redo。`);
    err.code = 'REDO_LIMIT';
    err.exitCode = 3;
    throw err;
  }
  if (next > REDO_LIMIT && force) log(`${id} 第 ${next} 次重做，已加 --force-redo`);
  else log(`${id} 第 ${next} 次重做`);
  return next;
};

/**
 * planned → submitted → succeeded → downloaded → checked → approved。
 * 哈希变了必须重新提交。有 task id 且还没检查完：只查不重提。
 * downloaded 接着检查；checked / approved 且哈希没变：直接复用。
 */
export const decide = (entry, requestHash) => {
  if (!entry || entry.requestHash !== requestHash) return 'submit';
  if (entry.status === 'checked' || entry.status === 'approved') return 'reuse';
  if (entry.status === 'downloaded') return 'check';
  if (entry.taskId) return 'query';
  return 'submit';
};

const now = () => new Date().toISOString();

/**
 * 同步素材走一步。ops.submit 只有 action 为 submit 时才会被调用。
 * query：不分配新 task id。check：不重新生成。reuse：什么都不做。
 */
export const resumeClip = (entry, requestHash, ops) => {
  const action = decide(entry, requestHash);
  if (action === 'reuse') return {entry, action, submitted: false};
  if (action === 'query') {
    const q = ops.query(entry);
    let next = {...entry, status: q.status ?? entry.status, file: q.file ?? entry.file ?? null, updatedAt: now()};
    if (next.file && (next.status === 'submitted' || next.status === 'succeeded' || next.status === 'downloaded')) {
      const c = ops.check(next);
      next = {...next, status: 'checked', file: c.file ?? next.file, check: c.meta ?? null, updatedAt: now()};
    }
    return {entry: next, action, submitted: false};
  }
  if (action === 'check') {
    const c = ops.check(entry);
    return {
      entry: {...entry, status: 'checked', file: c.file ?? entry.file, check: c.meta ?? null, updatedAt: now()},
      action,
      submitted: false,
    };
  }
  const s = ops.submit();
  const created = {
    requestHash,
    taskId: s.taskId,
    provider: s.provider,
    status: 'downloaded',
    file: s.file,
    updatedAt: now(),
  };
  const c = ops.check(created);
  return {
    entry: {...created, status: 'checked', file: c.file ?? created.file, check: c.meta ?? null, updatedAt: now()},
    action: 'submit',
    submitted: true,
  };
};

export const markApproved = (entry, at = now()) => ({...entry, status: 'approved', updatedAt: at});
