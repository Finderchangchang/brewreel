export const TIMELINE_FRAME: {readonly width: number; readonly height: number; readonly reserveX: number; readonly reserveY: number};

export type TimelineBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  font: number;
  text: string;
};

export type TimelineNodeBox = TimelineBox & {index: number; cx: number; cy: number};

export type TimelineBar = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone: 'alert' | 'accent';
  labelBox: (TimelineBox) | null;
  index: number;
};

export type TimelineCaptionBox = TimelineBox & {icon: string; index: number};

export type TimelineFrameLayout = {
  frame: {width: number; height: number; reserveX: number; reserveY: number};
  scale: number;
  blockHeight: number;
  offsetY: number;
  quoteTop: number;
  nodes: TimelineNodeBox[];
  bars: TimelineBar[];
  captions: TimelineCaptionBox[];
  writtenCaptions: number;
};

export function timelineFrameLayout(input?: {
  nodes?: Array<string | {label?: string}>;
  segments?: Array<{label?: string; tone?: string}>;
  captions?: Array<{text?: string; icon?: string}>;
  hasQuote?: boolean;
  width?: number;
  height?: number;
}): TimelineFrameLayout;

export function timelineClipIssues(layout: TimelineFrameLayout): string[];
