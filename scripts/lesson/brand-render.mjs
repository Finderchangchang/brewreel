// 品牌包装的纯计算：片头署名、片尾页、指纹里要钉住的字段。不读盘。

export const BRAND_TAIL_MS = 4000;
export const DEFAULT_TIP = '扫码咨询 · 下期见';
export const LEGAL_DISCLAIMER_ZH = '本视频为一般性法律知识介绍，不构成针对具体案件的法律意见。';
export const LEGAL_DISCLAIMER_EN = 'This video is general legal information and is not legal advice for a specific matter.';
export const OPENING_AI_ZH = 'AI 辅助生成';
export const OPENING_AI_EN = 'AI-assisted';
export const TEST_REVIEW_ZH = '内部测试 · 未经律师审核';
export const TEST_REVIEW_EN = 'Internal test · not reviewed by a lawyer';

export function seriesLine(column, episode, lang = 'zh') {
  const name = String(column ?? '').trim();
  if (!episode) return name;
  return lang === 'en' ? `${name} · Episode ${episode}` : `${name} · 第 ${episode} 期`;
}

/** 审核律师只从审稿记录取。测试审稿不写律师名。没有记录时只留 AI 标识。 */
export function openingCredit({review, lang = 'zh'} = {}) {
  const ai = lang === 'en' ? OPENING_AI_EN : OPENING_AI_ZH;
  if (review?.test) return {ai, extra: lang === 'en' ? TEST_REVIEW_EN : TEST_REVIEW_ZH};
  const name = String(review?.ok ? review.review?.reviewer ?? '' : '').trim();
  if (!name) return {ai, extra: ''};
  return {ai, extra: lang === 'en' ? `Reviewed by ${name}` : `审核律师：${name}`};
}

export function disclaimerFor(domain, lang = 'zh') {
  if (domain === 'legal') return lang === 'en' ? LEGAL_DISCLAIMER_EN : LEGAL_DISCLAIMER_ZH;
  return lang === 'en' ? 'For general information.' : '内容仅供参考。';
}

export function resolveLawyer(lawyers, spec) {
  const list = Array.isArray(lawyers) ? lawyers : [];
  if (!list.length) {
    if (spec == null || spec === '') return null;
    throw new Error('品牌档案里没有律师，讲稿不能指定 meta.lawyer');
  }
  if (spec == null || spec === '') return list[0];
  if (typeof spec === 'number' || (typeof spec === 'string' && /^[1-9]\d*$/.test(spec.trim()))) {
    const n = Number(spec);
    if (!Number.isInteger(n) || n < 1 || n > list.length) throw new Error(`律师序号 ${n} 超出档案（共 ${list.length} 位，从 1 开始）`);
    return list[n - 1];
  }
  const name = String(spec).trim();
  const found = list.find((item) => item.name === name);
  if (!found) throw new Error(`档案里没有律师「${name}」`);
  return found;
}

/** 讲解员第一次出现的内容页。封面和品牌尾页不算。 */
export function nameBarPageOf(timeline, lawyer) {
  if (!lawyer) return null;
  const page = (timeline?.pages ?? []).find((item) => item.layout !== 'cover' && item.layout !== 'brandEnd');
  return page ? page.index : null;
}

export function lastRecapIndex(timeline) {
  const pages = timeline?.pages ?? [];
  let found = null;
  for (const page of pages) if (page.layout === 'recap') found = page.index;
  return found;
}

/**
 * 没有 recap 时，在时间轴末尾加 4 秒无旁白的品牌尾页。
 * 配乐时长跟着总时长走；字幕不加；最后一章的结束时间拉到尾页结束。
 */
export function appendBrandTail(timeline, lessonTitle) {
  const recapIndex = lastRecapIndex(timeline);
  if (recapIndex != null) return {timeline, added: false, recapIndex};
  const pages = timeline?.pages ?? [];
  if (!pages.length) throw new Error('没有页面，不能加品牌尾页');
  const fps = timeline.fps || 30;
  const frames = Math.round((BRAND_TAIL_MS / 1000) * fps);
  const last = pages[pages.length - 1];
  const startFrame = last.endFrame;
  const page = {
    index: last.index + 1,
    chapterIndex: last.chapterIndex,
    chapterTitle: last.chapterTitle,
    pageInChapter: (last.pageInChapter ?? 0) + 1,
    layout: 'brandEnd',
    title: String(lessonTitle ?? last.title ?? ''),
    subtitle: null,
    smallText: null,
    items: [],
    fields: {},
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
  const chapters = (timeline.chapters ?? []).map((chapter, index, list) => (
    index === list.length - 1 ? {...chapter, endFrame: page.endFrame, endMs: page.endMs} : chapter
  ));
  const totalFrames = page.endFrame;
  return {
    timeline: {
      ...timeline,
      pages: [...pages, page],
      chapters,
      totalFrames,
      durationMs: totalFrames * 1000 / fps,
    },
    added: true,
    recapIndex: null,
  };
}

/** 进页面指纹的品牌快照。不带本次渲染的临时路径，避免每次都算成新页面。 */
export function brandFingerprint(brand) {
  if (!brand) return null;
  return {
    id: brand.id,
    logoSha256: brand.logoSha256,
    qrSha256: brand.qrSha256 ?? null,
    firm: brand.firm,
    english: brand.english || '',
    column: brand.column,
    primary: brand.primary,
    secondary: brand.secondary || '',
    episode: brand.episode ?? null,
    tip: brand.tip,
    series: brand.series,
    lawyer: brand.lawyer ?? null,
    openingAi: brand.openingAi,
    openingExtra: brand.openingExtra || '',
    disclaimer: brand.disclaimer,
    recapIndex: brand.recapIndex ?? null,
    nameBarPage: brand.nameBarPage ?? null,
  };
}
