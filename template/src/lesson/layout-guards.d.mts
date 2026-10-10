export const CASE_LABEL: string;
export const SAYING_LAW_RE: RegExp;
export const DOCUMENT_BRANDS: readonly string[];
export const BASIS_RE: RegExp;
export function basisCitations(text: string): {book: string; number: string}[];
export function sayingLawHit(text: string): string;
export function documentBrandHit(text: string): string;
export function collectStrings(value: unknown, out?: string[]): string[];
