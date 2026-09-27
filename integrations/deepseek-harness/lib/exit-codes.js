// @ts-check
// make.mjs exit codes (see the header comment of scripts/make.mjs) → status, meaning and next step.

/** @typedef {'zh' | 'en'} Lang */

/** @type {Record<string, {status: string, zh: string, en: string, nextZh: string, nextEn: string}>} */
const TABLE = {
  0: {status: 'delivered', zh: '可交付', en: 'deliverable', nextZh: '把 video.path 和 sheet 交给用户，附发布前自查清单，humanReview 条目逐条让用户确认', nextEn: 'Hand video.path and the sheet to the user with the pre-publish checklist; list every humanReview item for the user to confirm'},
  1: {status: 'invalid', zh: '分镜校验没过，没有渲染', en: 'storyboard validation failed; nothing was rendered', nextZh: '按 validation.errors 的 fix 逐条改 storyboard.json，再调 distill_video_validate', nextEn: 'Fix storyboard.json item by item following validation.errors, then call distill_video_validate again'},
  2: {status: 'usage', zh: '参数错', en: 'bad arguments', nextZh: '不要原样重试；把错误原文给用户看', nextEn: 'Do not retry as is; show the error text to the user'},
  3: {status: 'rejected', zh: '机器自查 / 排版 / 布局 / 汉字 / 空帧有 ✗，不能交付', en: 'a machine / layout / Han-character / blank-frame check failed; not deliverable', nextZh: '看 failures：删条目或缩短文字，回到 distill_video_validate，再出片；rejectedPreview 只给人看哪里坏了', nextEn: 'Read failures: remove items or shorten text, validate again, then render; rejectedPreview only shows what broke'},
  4: {status: 'render-failed', zh: '渲染失败或成片时长不对', en: 'render failed or the video duration is wrong', nextZh: '调 distill_video_doctor；常见原因是 Chrome Headless Shell 缺失或内存不足', nextEn: 'Call distill_video_doctor; usual causes are a missing Chrome Headless Shell or low memory'},
  5: {status: 'queue-timeout', zh: '渲染排队超时', en: 'timed out waiting for the render lock', nextZh: '等别的渲染结束再试，或调大 queueTimeoutMin', nextEn: 'Retry after the other render finishes, or raise queueTimeoutMin'},
  6: {status: 'internal', zh: 'make.mjs 内部错误', en: 'internal error in make.mjs', nextZh: '把 report.txt 给用户，建议到仓库提 issue', nextEn: 'Give report.txt to the user and suggest opening an issue on the repository'},
  130: {status: 'interrupted', zh: '被中断', en: 'interrupted', nextZh: '用户取消了；需要时再重跑', nextEn: 'Cancelled; run again if needed'},
};

const KILLED = {status: 'killed', zh: '插件超时或任务被取消，进程已终止', en: 'plugin timeout or cancelled; the process tree was terminated', nextZh: '说明原因，由用户决定是否重跑', nextEn: 'Explain why and let the user decide whether to run again'};

/**
 * @param {number | null} code
 * @param {{stills?: boolean, lang?: Lang, killed?: boolean}} [o]
 */
export function describeExit(code, {stills = false, lang = 'zh', killed = false} = {}) {
  const row = killed || code === null || TABLE[code] === undefined ? KILLED : TABLE[code];
  let status = row.status;
  let meaning = lang === 'en' ? row.en : row.zh;
  let nextStep = lang === 'en' ? row.nextEn : row.nextZh;
  if (!killed && code === 0 && stills) {
    status = 'stills';
    meaning = lang === 'en' ? 'stills only — not a deliverable video' : '只出了单帧，不是成片';
    nextStep = lang === 'en' ? 'Use the frames in checkFrames to self-check; render without stills to get the video' : '单帧只用于自查；去掉 stills 再出片才是成片';
  }
  return {status, exitMeaning: meaning, nextStep};
}

export const EXIT_CODES = Object.keys(TABLE).map(Number);
