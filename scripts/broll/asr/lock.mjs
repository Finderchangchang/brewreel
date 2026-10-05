// 分句锁：broll.json 的 from/to 只认句子号，写完 broll.json 后再拆句、并句，句子号就错位了。
// llm_broll 写出 broll.json 后存一份 .brewreel/cues.lock.json（句数 + 每句起止毫秒），validate 时比一下。
// 只改字不算变化；句数变了、或任何一句起止时间差超过 1 毫秒，才算分句变了。纯函数。

export const CUES_LOCK_NAME = 'cues.lock.json';

/** parseSrt 的结果 → 锁内容 {count, spans:[[startMs,endMs],...]} */
export const cuesLockOf = (cues) => ({count: cues.length, spans: cues.map((c) => [c.startMs, c.endMs])});

/**
 * 比较锁和现在的字幕。
 * @returns {{ok: true} | {ok: false, where: string, problem: string, fix: string}}
 */
export const compareCuesLock = (lock, cues, toleranceMs = 1) => {
  const fix = '只改字没关系；拆句、并句要重跑 llm_broll 重写 broll.json，或者把 talk.srt 的分句改回去';
  if (!lock || !Array.isArray(lock.spans)) return {ok: true};
  if (lock.count !== cues.length || lock.spans.length !== cues.length) {
    return {ok: false, where: 'talk.srt', problem: `写完 broll.json 后 talk.srt 的分句变了：原来 ${lock.count} 句，现在 ${cues.length} 句`, fix};
  }
  for (let i = 0; i < cues.length; i++) {
    const [a, b] = lock.spans[i];
    if (Math.abs(a - cues[i].startMs) > toleranceMs || Math.abs(b - cues[i].endMs) > toleranceMs) {
      return {ok: false, where: `talk.srt 第 ${i + 1} 句（c${i + 1}）`, problem: '写完 broll.json 后这一句的起止时间变了', fix};
    }
  }
  return {ok: true};
};
