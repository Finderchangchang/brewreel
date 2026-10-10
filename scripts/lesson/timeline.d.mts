export function subtitleScreenAtFrame(
  timeline: {fps: number; subtitles: {pageIndex: number; startMs: number; endMs: number; text: string; fontPx?: number}[]},
  frame: number,
): {pageIndex: number; startMs: number; endMs: number; text: string; fontPx?: number} | null;
export function mapExplicitSentences(
  sentences: {text: string}[],
  timings: {startMs: number; endMs: number}[],
  durMs: number,
): {index: number; text: string; charStart: number; charEnd: number; startMs: number; endMs: number; chars: {text: string; startMs: number; endMs: number}[]}[];
export const STAGE: {standard: StageBox; wide: StageBox; side: StageBox};
export function contentBox(layout: string, page?: Record<string, unknown>): {x: number; y: number; width: number; height: number; area: number};
export function revealProgress(page: {sentences?: {reveal: number | null; revealAtMs: number | null}[]; durationFrames: number}, reveal: number, frame: number, fallbackAtEnd?: boolean): number;
export function visibleTargets(page: {layout?: string; fields?: Record<string, unknown>; revealTargets?: string[]; sentences?: {reveal: number | null; revealAtMs: number | null}[]; durationFrames: number}, frame: number): boolean[];
export function layoutRegions(): {stage: StageBox; wide: StageBox; side: StageBox; title: {y: number; height: number}; body: {y: number; height: number}};
type StageBox = {x: number; y: number; width: number; height: number};
