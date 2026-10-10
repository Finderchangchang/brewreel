export function titleSpans(text: string, options?: {subtitle?: boolean; mergeLatin?: boolean; glueCjkSingles?: boolean; glueModels?: boolean}): {text: string; start: number; end: number}[];
export function titleLines(text: string, options?: {forceTwo?: boolean; maxEm?: number; maxLines?: number; subtitle?: boolean}): string[];
export function fitHookLines(text: string, maxEm: number, maxLines?: number): string[];
export function coverTitleLayout(text: string, options?: {width?: number; minPx?: number; maxPx?: number; maxLines?: number}): {lines: string[]; size: number; em: number};
export function protectBreaks(text: string, options?: {subtitle?: boolean}): string;
export function titleAtoms(text: string): string[];
export function emWidth(text: string): number;
export const WORD_JOINER: string;
