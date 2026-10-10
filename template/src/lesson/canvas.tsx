import React from 'react';

export type PresenterKind = 'cartoon' | 'real' | 'none';
export type BrandLawyerView = {name: string; title: string; department: string; firmLine: string};
export type LessonBrandView = {
  id: string;
  firm: string;
  english: string;
  column: string;
  logo: string;
  primary: string;
  secondary: string | null;
  episode: number | null;
  tip: string;
  qr: string | null;
  lawyer: BrandLawyerView | null;
  series: string;
  openingAi: string;
  openingExtra: string;
  disclaimer: string;
  recapIndex: number | null;
  nameBarPage: number | null;
};
export type BrandColors = {accent?: string; deco?: string};
export type LessonCanvas = {
  orientation: 'horizontal' | 'vertical';
  presenter: PresenterKind;
  sampleReview: boolean;
  topReserve?: number;
  hookTitle?: string;
  clipFrame?: number;
  fps?: number;
  showHook?: boolean;
  hookBottom?: number;
  pageLayout?: string;
  pageFrame?: number;
  prevLayout?: string;
  brand?: LessonBrandView | null;
  brandColors?: BrandColors | null;
  brandBug?: boolean;
  brandRecapIndex?: number | null;
  nameBarPage?: number | null;
  pageIndex?: number | null;
};

const Ctx = React.createContext<LessonCanvas>({orientation: 'horizontal', presenter: 'cartoon', sampleReview: false});

export const CanvasProvider: React.FC<{value: LessonCanvas; children: React.ReactNode}> = ({value, children}) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useCanvas = () => React.useContext(Ctx);
export const useOrientation = () => useCanvas().orientation;
