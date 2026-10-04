import {beatSpans, fmtSec} from './time.mjs';

/**
 * 提示词 = 风格固定描述 + 地点/主体/动作（或按生成秒数切开的 beats）+ 运镜 + 固定禁用句。
 * plain 不进提示词。
 */
export const buildPrompt = ({style, clip, genSec}) => {
  const parts = [];
  if (style?.look) parts.push(style.look.endsWith('。') ? style.look : `${style.look}。`);
  parts.push(`地点：${clip.place}。`);
  parts.push(`主体：${clip.subject}。`);
  if (Array.isArray(clip.beats) && clip.beats.length) {
    const spans = beatSpans(genSec, clip.beats.length);
    const body = clip.beats
      .map((b, i) => `${fmtSec(spans[i][0])}–${fmtSec(spans[i][1])} 秒：${b.action}，结束画面：${b.end}`)
      .join('；');
    parts.push(`${body}。`);
  } else {
    parts.push(`动作：${clip.action}。结束画面：${clip.end}。`);
  }
  const cam = style?.camera?.[clip.camera] || clip.camera;
  parts.push(`${cam}。`);
  if (style?.forbid) parts.push(style.forbid.endsWith('。') ? style.forbid : `${style.forbid}。`);
  return parts.join('');
};
