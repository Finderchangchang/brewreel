import raw from './style-tokens.json';

export type LessonStyleId = 'paper' | 'lecture' | 'product' | 'editorial';
export type LessonTokens = typeof raw.paper;
export const lessonThemes: Record<LessonStyleId, LessonTokens> = raw;
export type LessonTheme = LessonStyleId;
