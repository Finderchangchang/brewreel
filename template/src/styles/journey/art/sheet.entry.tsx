// ============================================================
// journey / art 总览图的独立入口（只给美术自检出图用，不进正式合成）。用法见同目录 README.md「总览图」：
//   cd template
//   npx remotion still src/styles/journey/art/sheet.entry.tsx JourneyArt <仓库外>/mascot.png --props='{"part":"mascot"}'
// ============================================================
import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {ensureFont} from '../../../core/font';
import {ArtSheet, ArtSheetProps, artSheetSize} from './ArtSheet';

ensureFont();

const Root: React.FC = () => (
  <Composition
    id="JourneyArt"
    component={ArtSheet as unknown as React.FC<Record<string, unknown>>}
    fps={30}
    width={2160}
    height={2130}
    durationInFrames={90}
    defaultProps={{part: 'mascot'} as Record<string, unknown>}
    calculateMetadata={({props}) => artSheetSize(props as ArtSheetProps)}
  />
);

registerRoot(Root);
