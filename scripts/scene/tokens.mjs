// 从现有文件读令牌。不新造颜色，三族不合成一个文件。
// 圆角、字重、阴影、质感如果源文件里没有，记在这一族自己的槽里，并写明出处。
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LOOK_DEFAULTS, MOTION_LOOKS} from '../../template/src/talk/motion/palette.ts';
import {TOKEN_ROLES} from '../../template/src/scene/types.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

const themes = readJson('template/src/core/themes.json');
const lessonTokens = readJson('template/src/lesson/style-tokens.json');

export const PROMO_STYLES = Object.keys(themes);
export const LESSON_STYLES = Object.keys(lessonTokens);
export const TALK_STYLES = [...MOTION_LOOKS];

/** surface 家族补槽。themes.json 没有圆角和字重。数值搬自现有组件，不新造色。 */
const SURFACE_CHROME = {
  radius: 36,
  weight: 900,
  radiusFrom: 'template/src/shots/features.tsx RADIUS',
  weightFrom: 'template/src/shots/features.tsx 标题 fontWeight 900',
};

/**
 * material 家族补槽。颜色在 palette.ts。圆角上限来自 parts.tsx 的 Card。
 * 纸片阴影是 parts.tsx paper 分支的 boxShadow，原样搬过来。
 */
const MATERIAL_CHROME = {
  wood: {radius: 30, weight: 900, shadow: '0 14px 30px rgba(74,50,24,0.17)', texture: 'wood'},
  clay: {radius: 46, weight: 900, shadow: '0 12px 26px rgba(140,74,64,0.20)', texture: 'clay'},
  paper: {radius: 12, weight: 900, shadow: '0 10px 22px rgba(58,48,32,0.14)', texture: 'paper'},
  ink: {radius: 16, weight: 900, shadow: '8px 8px 0 #221F1C', texture: 'ink'},
  'cutpaper-meadow': {radius: 3, weight: 900, shadow: 'none', texture: 'cutpaper'},
  'cutpaper-dusk': {radius: 3, weight: 900, shadow: 'none', texture: 'cutpaper'},
};

const extraReaders = [];
const EXTRA_STYLES = {promo: ['techbrief', 'cutpaper-collage', 'impressionist', 'mural'], lesson: [], talk: []};

/** T12b 之后加新风格时注册到这里，不必改三份旧文件。 */
export function registerStyleReader(reader) {
  extraReaders.push(reader);
}

export function themeIsDark(style) {
  return themes[style]?.dark === true;
}

export function stylesFor(product) {
  const extra = EXTRA_STYLES[product] ?? [];
  if (product === 'promo') return PROMO_STYLES.concat(extra);
  if (product === 'lesson') return LESSON_STYLES.concat(extra);
  if (product === 'talk') return TALK_STYLES.concat(extra);
  return [];
}

function hexOf(value, fallback) {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function surfaceRoles(style) {
  const theme = themes[style];
  if (!theme) return null;
  const bg = hexOf(theme.bgTop?.[0], '#FFFFFF');
  return {
    family: 'surface',
    product: 'promo',
    id: style,
    source: 'template/src/core/themes.json',
    chromeFrom: SURFACE_CHROME,
    roles: {
      bg,
      surface: theme.card,
      ink: theme.cardText,
      muted: theme.cardSub,
      accent: theme.accent,
      line: hexOf(theme.line, theme.cardAlt || '#E6EEF1'),
      radius: SURFACE_CHROME.radius,
      weight: SURFACE_CHROME.weight,
      shadow: theme.shadow,
      texture: theme.ambient?.pattern || 'gradient',
    },
    extra: {bgTop: theme.bgTop, bgBot: theme.bgBot, dark: theme.dark === true, good: theme.good, warn: theme.warn, bad: theme.bad},
  };
}

function lessonRoles(style) {
  const token = lessonTokens[style];
  if (!token) return null;
  return {
    family: 'lesson',
    product: 'lesson',
    id: style,
    source: 'template/src/lesson/style-tokens.json',
    roles: {
      bg: token.bg,
      surface: token.surface,
      ink: token.ink,
      muted: token.muted,
      accent: token.accent,
      line: token.line,
      radius: token.radius,
      weight: token.headingWeight,
      shadow: token.cardShadow,
      texture: token.texture,
    },
    extra: {good: token.ok, warn: token.warn, bad: token.alert, fontHeading: token.fontHeading, fontBody: token.fontBody, fontNumber: token.fontNumber},
  };
}

function materialRoles(style) {
  const colors = LOOK_DEFAULTS[style];
  const chrome = MATERIAL_CHROME[style];
  if (!colors || !chrome) return null;
  return {
    family: 'material',
    product: 'talk',
    id: style,
    source: 'template/src/talk/motion/palette.ts',
    chromeFrom: chrome,
    roles: {
      bg: colors.bg,
      surface: colors.card,
      ink: colors.ink,
      muted: colors.sub,
      accent: colors.accent,
      line: colors.edge,
      radius: chrome.radius,
      weight: chrome.weight,
      shadow: chrome.shadow,
      texture: chrome.texture,
    },
    extra: {good: colors.good, warm: colors.warm, cool: colors.cool},
  };
}

const READERS = {promo: surfaceRoles, lesson: lessonRoles, talk: materialRoles};

export function loadStyle(product, style) {
  const built = READERS[product]?.(style);
  if (built) return built;
  for (const reader of extraReaders) {
    const found = reader(product, style);
    if (found) return found;
  }
  return null;
}

export function loadPreset(name) {
  if (name === 'A') return loadStyle('promo', 'fresh-light');
  if (name === 'B') return loadStyle('lesson', 'editorial');
  if (name === 'C') return loadStyle('talk', 'paper');
  return null;
}

function techbriefReader(product, style) {
  if (product !== 'promo' || style !== 'techbrief') return null;
  const doc = readJson('template/src/scene/styles/techbrief.json');
  return {
    family: 'scene',
    product: 'promo',
    id: 'techbrief',
    source: 'template/src/scene/styles/techbrief.json',
    roles: doc.roles,
    extra: doc.extra,
  };
}

registerStyleReader(techbriefReader);

function cutpaperCollageReader(product, style) {
  if (product !== 'promo' || style !== 'cutpaper-collage') return null;
  const doc = readJson('template/src/scene/styles/cutpaper-collage.json');
  return {
    family: 'scene',
    product: 'promo',
    id: 'cutpaper-collage',
    source: 'template/src/scene/styles/cutpaper-collage.json',
    roles: doc.roles,
    extra: {palette: doc.palette},
  };
}

registerStyleReader(cutpaperCollageReader);

function artStyleReader(product, style) {
  if (product !== 'promo' || (style !== 'impressionist' && style !== 'mural')) return null;
  const doc = readJson(`template/src/scene/styles/${style}.json`);
  return {
    family: 'scene',
    product: 'promo',
    id: style,
    source: `template/src/scene/styles/${style}.json`,
    roles: doc.roles,
    extra: doc.extra,
  };
}

registerStyleReader(artStyleReader);

export function missingRoles(roles) {
  return TOKEN_ROLES.filter((key) => roles?.[key] === undefined || roles?.[key] === null || roles?.[key] === '');
}
