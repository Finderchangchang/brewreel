export const VERTICAL: {
  canvas: {w: number; h: number};
  safe: {x: number; y: number; right: number; bottom: number};
  subtitle: {x: number; y: number; w: number; h: number};
  subtitleMinPx: number;
  subtitleMaxChars: number;
  cartoonH: number;
  circleD: number;
  hookFrames: number;
  hookH: number;
  hookFont: number;
  labelH: number;
  sampleH: number;
};

export function verticalSubtitleMaxChars(): number;
export type VerticalPlaceOptions = {
  sampleReview?: boolean;
  topReserve?: number;
  showLabel?: boolean;
  showHook?: boolean;
  hookLines?: number;
  layout?: string;
  frame?: number;
  fps?: number;
  hookBottom?: number;
  pageFrame?: number;
  prevLayout?: string;
  subtitle?: {x: number; y: number; width?: number; height?: number; w?: number; h?: number};
};
export function verticalSubtitleBox(content?: {x: number; y: number; width?: number; height?: number; w?: number; h?: number} | null): {x: number; y: number; width: number; height: number};
export function verticalPresenterBox(kind?: string, options?: VerticalPlaceOptions): {x: number; y: number; w: number; h: number; radius: number; shape: string; eyeY: number} | null;
export function headerHeight(options?: VerticalPlaceOptions): number;
export function verticalContentBox(layout?: string, presenterKind?: string, options?: VerticalPlaceOptions): {x: number; y: number; width: number; height: number; area: number};
export function verticalChromeBoxes(options?: {sampleReview?: boolean; showLabel?: boolean; showHook?: boolean; hookLines?: number}): Record<string, {x: number; y: number; w: number; h: number}>;
export function chromeTopReserve(options?: {sampleReview?: boolean; showLabel?: boolean; showHook?: boolean; hookLines?: number}): number;
export function verticalNoteBox(anchor?: {x: number; y: number; shape?: string} | null): {x: number; y: number; w: number; h: number} | null;
