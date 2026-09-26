// ============================================================
// 渲染锁（make.mjs 用）：同一时刻只让一个 Remotion 渲染跑，其余排队。
//   锁文件内容：{pid, id, at（拿锁时间）, hb（心跳时间）}，持锁期间每 20 秒刷新一次 hb。
//   自动回收：持锁进程已经不在了，或心跳超过 staleMs（默认 15 分钟）没更新 → 当失效锁删掉，继续。
//   排队上限：等了 timeoutMs（默认 20 分钟）还没轮到 → 抛 QueueTimeoutError，由调用方写报告、按约定退出码退出。
//   Windows 上删文件有「待删除」状态，openSync('wx') 可能报 EPERM/EBUSY/EACCES，这些都当作「锁还在」重试，不崩。
// ============================================================
import fs from 'node:fs';

export class QueueTimeoutError extends Error {
  constructor(info, waitedMs) {
    super(`等了 ${fmtDur(waitedMs)}，前面的任务（${info?.id ?? '未知'}，pid ${info?.pid ?? '?'}）还没渲染完`);
    this.name = 'QueueTimeoutError';
    this.holder = info;
  }
}

export const pidAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

const readLock = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`;
};

/**
 * 拿锁。成功返回 {release()}；排队超时抛 QueueTimeoutError。
 * @param {{file: string, id: string, log?: (...a: any[]) => void, timeoutMs?: number, staleMs?: number, pollMs?: number, heartbeatMs?: number}} o
 */
export const acquireRenderLock = async ({file, id, log = console.log, timeoutMs = 20 * 60 * 1000, staleMs = 15 * 60 * 1000, pollMs = 2000, heartbeatMs = 20 * 1000}) => {
  const started = Date.now();
  let lastMsg = 0;
  let unreadable = 0;
  for (;;) {
    let fd;
    try {
      fd = fs.openSync(file, 'wx');
    } catch (e) {
      if (!['EEXIST', 'EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw new Error(`没法创建渲染锁 ${file}：${e.code || e.message}`);
    }
    if (fd !== undefined) {
      const now = Date.now();
      fs.writeSync(fd, JSON.stringify({pid: process.pid, id, at: now, hb: now}));
      fs.closeSync(fd);
      const beat = setInterval(() => {
        const cur = readLock(file);
        if (cur?.pid !== process.pid) return;
        try {
          fs.writeFileSync(file, JSON.stringify({...cur, hb: Date.now()}));
        } catch {}
      }, heartbeatMs);
      beat.unref();
      let held = true;
      return {
        release() {
          if (!held) return;
          held = false;
          clearInterval(beat);
          const cur = readLock(file);
          if (cur?.pid === process.pid) {
            try {
              fs.rmSync(file, {force: true});
            } catch {}
          }
        },
      };
    }
    // 锁在别人手里：看看是不是失效锁
    const info = readLock(file);
    if (!info) {
      // 刚被创建还没写完，或 Windows 待删除状态：连续 10 次读不出来（约 20 秒）才当坏锁删掉
      if (++unreadable >= 10) {
        log('渲染锁文件读不出内容，当作坏锁删掉');
        try {
          fs.rmSync(file, {force: true});
        } catch {}
        unreadable = 0;
        continue;
      }
    } else {
      unreadable = 0;
      const last = Number(info.hb ?? info.at ?? 0);
      const dead = !pidAlive(Number(info.pid));
      const silent = last > 0 && Date.now() - last > staleMs;
      if (dead || silent) {
        // 删之前再读一次：别的排队者可能刚回收完并拿到了新锁，只删「还是那把旧锁」的情况
        const again = readLock(file);
        if (again && again.pid === info.pid && again.at === info.at) {
          log(`回收失效的渲染锁（${info.id ?? '?'}，pid ${info.pid ?? '?'}：${dead ? '进程已经不在了' : `心跳停了 ${fmtDur(Date.now() - last)}`}）`);
          try {
            fs.rmSync(file, {force: true});
          } catch {}
        }
        continue;
      }
    }
    const waited = Date.now() - started;
    if (waited >= timeoutMs) throw new QueueTimeoutError(info, waited);
    if (Date.now() - lastMsg >= 15000) {
      const busy = info?.at ? `，它已经渲染了 ${fmtDur(Date.now() - info.at)}` : '';
      log(`排队中：前面是 ${info?.id ?? '另一个任务'}（pid ${info?.pid ?? '?'}${busy}）；已等 ${fmtDur(waited)}，最多再等 ${fmtDur(timeoutMs - waited)}`);
      lastMsg = Date.now();
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
};
