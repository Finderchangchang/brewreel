// 艺术背景。每帧用同一套种子画进画布，Remotion 等这一笔画完再截。
import React, {useLayoutEffect, useRef} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {paintArt, type ArtBand} from './art-raster.ts';

export const ArtFilm: React.FC<{style: string; bands?: ArtBand[]}> = ({style, bands}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const bandKey = (bands ?? []).map((band) => `${band.role}:${band.x}:${band.y}:${band.w}:${band.h}`).join(';');
  const handle = delayRender(`art-${style}-${frame}`);
  useLayoutEffect(() => {
    try {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const pixels = paintArt(style, width, height, frame / Math.max(1, fps), bands);
        const copy = new Uint8ClampedArray(pixels);
        ctx.putImageData(new ImageData(copy, width, height), 0, 0);
      }
    } finally {
      continueRender(handle);
    }
  }, [style, frame, fps, width, height, handle, bandKey, bands]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      data-probe-skip
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};
