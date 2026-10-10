// 新闻片尾，以及技术课可选的免责页。无旁白，加在时间轴最后（品牌尾页之后）。
export const DISCLAIMER_MS = 4500;

export function newsDisclaimerText(meta) {
  const asOf = String(meta?.asOf ?? '').trim();
  if (meta?.lang === 'en') return `Compiled from public reports as of ${asOf}. This is not a conclusion.`;
  return `据公开报道整理，截至${asOf}，不构成任何结论`;
}

export function techDisclaimerText(meta) {
  if (typeof meta?.disclaimer === 'string' && meta.disclaimer.trim()) return meta.disclaimer.trim();
  if (meta?.disclaimerTail === true) {
    return meta?.lang === 'en' ? 'For general information. This is not professional advice.' : '内容仅供参考，不构成专业意见。';
  }
  return '';
}

export function disclaimerBodyFor(meta) {
  if (meta?.domain === 'news') return newsDisclaimerText(meta);
  if (meta?.domain === 'tech') return techDisclaimerText(meta);
  return '';
}

function silentPage(timeline, {title, body}) {
  const pages = timeline?.pages ?? [];
  if (!pages.length) throw new Error('没有页面，不能加免责页');
  const fps = timeline.fps || 30;
  const frames = Math.round((DISCLAIMER_MS / 1000) * fps);
  const last = pages[pages.length - 1];
  const startFrame = last.endFrame;
  return {
    index: last.index + 1,
    chapterIndex: last.chapterIndex,
    chapterTitle: last.chapterTitle,
    pageInChapter: (last.pageInChapter ?? 0) + 1,
    layout: 'disclaimer',
    title,
    subtitle: null,
    smallText: null,
    items: [],
    fields: {body},
    narration: [],
    pose: [],
    audio: '',
    audioStartFrame: startFrame,
    audioDurationMs: 0,
    startFrame,
    endFrame: startFrame + frames,
    durationFrames: frames,
    startMs: startFrame * 1000 / fps,
    endMs: (startFrame + frames) * 1000 / fps,
    sentences: [],
    revealTargets: [],
  };
}

/** 新闻必加。技术课只在写了 meta.disclaimer 或 meta.disclaimerTail 时加。普法仍走原有片尾条，不加这一页。 */
export function appendDisclaimerPage(timeline, meta) {
  const body = disclaimerBodyFor(meta);
  if (!body) return {timeline, added: false, body: ''};
  const title = meta?.lang === 'en' ? 'Note' : '资料说明';
  const page = silentPage(timeline, {title, body});
  const chapters = (timeline.chapters ?? []).map((chapter, index, list) => (
    index === list.length - 1 ? {...chapter, endFrame: page.endFrame, endMs: page.endMs} : chapter
  ));
  const fps = timeline.fps || 30;
  return {
    timeline: {
      ...timeline,
      pages: [...(timeline.pages ?? []), page],
      chapters,
      totalFrames: page.endFrame,
      durationMs: page.endFrame * 1000 / fps,
    },
    added: true,
    body,
  };
}
