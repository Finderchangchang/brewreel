import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

export type LessonSheetProps = {images: string[]};
export const lessonSheetSize = (p: LessonSheetProps) => ({width: 1920, height: Math.max(1, Math.ceil(p.images.length / 8)) * 135});
export const LessonSheet: React.FC<LessonSheetProps> = ({images}) => (
  <AbsoluteFill style={{display: 'grid', gridTemplateColumns: 'repeat(8, 240px)', gridAutoRows: '135px', background: '#fff'}}>
    {images.map((src, i) => <Img key={`${i}-${src}`} src={staticFile(src)} style={{width: 240, height: 135, objectFit: 'cover'}} />)}
  </AbsoluteFill>
);
