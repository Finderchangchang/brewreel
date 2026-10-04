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
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
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
