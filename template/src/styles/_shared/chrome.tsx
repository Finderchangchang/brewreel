import React from 'react';
import type {Meta} from '../../schema';
import type {ShotLike} from '../../core/demo-shots';
import {Disclaimer, Notices} from '../../core/layers';

// ============================================================
// 合规小字层（非 cards 风格）：免责小字 + 底部提示条。
// 样式和 cards 共用 layers.tsx 的 Disclaimer / Notices：跟当前主题或风格令牌取色，贴在安全区左上，
// 有演示镜头时免责小字只跟那些镜头走。demoData 的「演示画面」提示靠它上屏，风格不能省。
// ============================================================
export const StyleChrome: React.FC<{meta: Meta; slots: {start: number; end: number; shot: ShotLike}[]}> = ({meta, slots}) => (
  <>
    <Disclaimer text={meta?.disclaimer} lang={meta?.lang} slots={slots} />
    <Notices items={meta?.notices} lang={meta?.lang} disclaimer={meta?.disclaimer} />
  </>
);
