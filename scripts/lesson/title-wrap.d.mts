export function titleLines(text: string, options?: {forceTwo?: boolean; maxEm?: number; maxLines?: number}): string[];
export function fitHookLines(text: string, maxEm: number, maxLines?: number): string[];
export function coverTitleLayout(text: string, options?: {width?: number; minPx?: number; maxPx?: number; maxLines?: number}): {lines: string[]; size: number; em: number};
export function protectBreaks(text: string): string;
export function titleAtoms(text: string): string[];
export function emWidth(text: string): number;
export const WORD_JOINER: string;
