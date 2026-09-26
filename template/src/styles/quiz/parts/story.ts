import {createContext, useContext} from 'react';
import type {Shot} from '../../../schema';

// ============================================================
// 整片上下文（QuizFilm 提供）：后面的镜头能读到前面镜头的参数，便宜模型少填字段
// （片段卡沿用钩子标题；揭晓、再听一遍、评论区沿用选项、答案、台词）。ShotLab 单镜自测时只有这一镜。
// ============================================================
export type Story = {shots: Shot[]; index: number};
export const StoryCtx = createContext<Story>({shots: [], index: 0});

/** 本片里第一个某类镜头的 params（没有返回 undefined） */
export const useStoryParams = <T = Record<string, any>,>(type: string): T | undefined => {
  const s = useContext(StoryCtx);
  return s.shots.find((x) => x.type === type)?.params as T | undefined;
};
/** 上一镜的类型 */
export const usePrevType = () => {
  const s = useContext(StoryCtx);
  return s.index > 0 ? s.shots[s.index - 1]?.type : undefined;
};
/** 界面示意的文字（scene=screen / phone）：本镜写了用本镜的，否则取全片第一个写了 screenItems 的镜头 */
export const useScreenItems = (own?: unknown): string[] | undefined => {
  const s = useContext(StoryCtx);
  const ok = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string');
  if (ok(own)) return own;
  for (const x of s.shots) {
    const it = (x.params as Record<string, unknown> | undefined)?.screenItems;
    if (ok(it)) return it;
  }
  return undefined;
};