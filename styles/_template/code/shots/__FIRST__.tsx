import React from 'react';
import {useGeometry} from '../../../core/aspect';
import {pop} from '../../../core/anim';
import type {ShotProps} from '../../../core/types';
import {useStylePalette, useStyleTokens} from '../../context';

type P = {title: string};

// 第 0 帧就要有内容（pop 从 t=0 开始，第一帧已经可见一部分）；位置只用 useGeometry() 的安全区，不写死 1920
const Opening: React.FC<ShotProps<P>> = ({params, t}) => {
  const geo = useGeometry();
  const tk = useStyleTokens();
  const pal = useStylePalette();
  const p = 0.4 + 0.6 * pop(t, 0);
  return (
    <div style={{position: 'absolute', left: geo.card.x0, top: geo.safe.y0, width: geo.card.x1 - geo.card.x0, fontSize: tk.type?.display ?? 120, fontWeight: 900, color: pal.ink, transform: `scale(${p})`, transformOrigin: '0 0'}}>
      {params.title}
    </div>
  );
};
export default Opening;