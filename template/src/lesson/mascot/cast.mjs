/** 讲解员姿势的唯一映射。换手势不能跨衣服族；族外动作用该族站姿、表情和头顶图标。 */

export const POSES = ['explain', 'point', 'check', 'warn', 'think', 'affirm', 'cheer', 'wave'];

export const FAMILIES = {
  sweater: ['SweaterDotsPlain', 'PointingUpPlain', 'PaperPlain'],
  tee: ['ShirtFilled', 'ArmsCrossed', 'Whatever'],
  shirt: ['ButtonShirt', 'Coffee', 'Geek'],
};

/** Open Peeps 原来的白色。skin 记在 look 里，这一版不拿来填色。 */
export const PEEP_FILL = '#FFFFFF';

export const OUTFITS = ['sweater', 'tee', 'shirt'];

/** 对外的衣服族名字。旧名 sweater / tee / shirt 仍指向同一族。 */
export const OUTFIT_FAMILY = {
  darkSweater: 'sweater',
  blackTee: 'tee',
  whiteShirt: 'shirt',
  sweater: 'sweater',
  tee: 'tee',
  shirt: 'shirt',
};

export const OUTFIT_NAMES = ['darkSweater', 'blackTee', 'whiteShirt'];

export const LEGACY_IDS = {
  default: 'peep-mentor',
  mentor: 'peep-mentor',
  counsel: 'peep-counsel',
  buddy: 'peep-teacher',
};

/** preset 只是一组默认值。用户写了的单项覆盖预设。 */
export const PRESETS = {
  male: {hair: 'ShortVolumed', accessory: 'GlassRound', facialHair: 'None', outfit: 'darkSweater'},
  female: {hair: 'Bun', accessory: 'GlassButterflyOutline', facialHair: 'None', outfit: 'blackTee'},
  'peep-mentor': {hair: 'ShortVolumed', accessory: 'GlassRound', facialHair: 'None', outfit: 'darkSweater'},
  'peep-counsel': {hair: 'Bun', accessory: 'GlassButterflyOutline', facialHair: 'None', outfit: 'blackTee'},
  'peep-teacher': {hair: 'MediumBangs', accessory: 'None', facialHair: 'None', outfit: 'whiteShirt'},
};

export const PRESET_NAMES = Object.keys(PRESETS);

const ID_TO_PRESET = {
  'peep-mentor': 'peep-mentor',
  mentor: 'peep-mentor',
  default: 'peep-mentor',
  'peep-counsel': 'peep-counsel',
  counsel: 'peep-counsel',
  'peep-teacher': 'peep-teacher',
  buddy: 'peep-teacher',
};

export function defaultPreset(domain) {
  return domain === 'legal' ? 'female' : 'male';
}

export const CAST = {
  'peep-mentor': {family: 'sweater', hair: 'ShortVolumed', accessory: 'GlassRound', facialHair: 'None', label: '男讲师'},
  'peep-counsel': {family: 'tee', hair: 'Bun', accessory: 'GlassButterflyOutline', facialHair: 'None', label: '女律师'},
  'peep-teacher': {family: 'shirt', hair: 'MediumBangs', accessory: 'None', facialHair: 'None', label: '老师'},
};

/** face：日常 SmileNM，严肃和思考 CalmNM。icon：none | warn | think | check | cheer */
const sweater = {
  explain: {body: 'SweaterDotsPlain', face: 'SmileNM', icon: 'none'},
  point: {body: 'PointingUpPlain', face: 'SmileNM', icon: 'none'},
  check: {body: 'PaperPlain', face: 'SmileNM', icon: 'check'},
  warn: {body: 'PointingUpPlain', face: 'CalmNM', icon: 'warn'},
  think: {body: 'SweaterDotsPlain', face: 'CalmNM', icon: 'think'},
  affirm: {body: 'SweaterDotsPlain', face: 'SmileNM', icon: 'check'},
  cheer: {body: 'SweaterDotsPlain', face: 'SmileNM', icon: 'cheer'},
  wave: {body: 'PointingUpPlain', face: 'SmileNM', icon: 'none'},
};

const tee = {
  explain: {body: 'Whatever', face: 'SmileNM', icon: 'none'},
  point: {body: 'ShirtFilled', face: 'SmileNM', icon: 'none'},
  check: {body: 'ShirtFilled', face: 'SmileNM', icon: 'check'},
  warn: {body: 'ArmsCrossed', face: 'CalmNM', icon: 'warn'},
  think: {body: 'ShirtFilled', face: 'CalmNM', icon: 'think'},
  affirm: {body: 'Whatever', face: 'SmileNM', icon: 'check'},
  cheer: {body: 'ShirtFilled', face: 'SmileNM', icon: 'cheer'},
  wave: {body: 'ShirtFilled', face: 'SmileNM', icon: 'none'},
};

const shirt = {
  explain: {body: 'ButtonShirt', face: 'SmileNM', icon: 'none'},
  point: {body: 'ButtonShirt', face: 'SmileNM', icon: 'none'},
  check: {body: 'Geek', face: 'SmileNM', icon: 'check'},
  warn: {body: 'ButtonShirt', face: 'CalmNM', icon: 'warn'},
  think: {body: 'Geek', face: 'CalmNM', icon: 'think'},
  affirm: {body: 'Coffee', face: 'SmileNM', icon: 'check'},
  cheer: {body: 'ButtonShirt', face: 'SmileNM', icon: 'cheer'},
  wave: {body: 'ButtonShirt', face: 'SmileNM', icon: 'none'},
};

export const POSE_LOOK = {sweater, tee, shirt};

/**
 * 850×1200 viewBox 里的嘴心。半身头的位移与身体无关；
 * 若某个身体的 Smile / SmileNM 差分不一致，把该身体记在这里。
 */
export const MOUTH_ANCHOR = {
  default: {cx: 545, cy: 411},
};

export function mouthAnchor(body) {
  return MOUTH_ANCHOR[body] ?? MOUTH_ANCHOR.default;
}

export const FRAME = {
  card: {x: 0, y: 0, width: 850, height: 1200},
  circle: {x: 90, y: -50, width: 720, height: 720},
  // 圆形头像用整身 viewBox，再由外圈裁掉头肩。不要改 circle，图标测试还在用它。
  bust: {x: 0, y: 0, width: 850, height: 1200},
};

export function resolveMascotId(id) {
  if (id == null || id === '') return 'peep-mentor';
  if (CAST[id]) return id;
  return LEGACY_IDS[id] ?? null;
}

function presetOf(wardrobe, domain) {
  if (wardrobe?.preset && PRESETS[wardrobe.preset]) return wardrobe.preset;
  if (wardrobe?.id && ID_TO_PRESET[wardrobe.id]) return ID_TO_PRESET[wardrobe.id];
  if (wardrobe?.id && PRESETS[wardrobe.id]) return wardrobe.id;
  return defaultPreset(domain);
}

export function resolveLook(wardrobe, domain) {
  const presetName = presetOf(wardrobe, domain);
  const preset = PRESETS[presetName] || PRESETS.male;
  const outfitName = wardrobe?.outfit && OUTFIT_FAMILY[wardrobe.outfit] ? wardrobe.outfit : preset.outfit;
  const family = OUTFIT_FAMILY[outfitName] || 'sweater';
  const id = resolveMascotId(wardrobe?.id)
    || (presetName === 'female' || presetName === 'peep-counsel' ? 'peep-counsel' : presetName === 'peep-teacher' ? 'peep-teacher' : 'peep-mentor');
  return {
    id,
    preset: presetName,
    family,
    outfit: outfitName,
    hair: wardrobe?.hair || preset.hair,
    accessory: wardrobe?.accessory || preset.accessory,
    facialHair: wardrobe?.facialHair || preset.facialHair,
    skin: wardrobe?.skin || null,
  };
}

/**
 * 旧 meta.mascot 自动换成卡通讲解员。
 * kind real / video 返回 null（画真人窗，不画卡通）。
 * kind none，或旧稿 enabled:false，返回 null。
 * 不写 look、也不写角色 id 时，legal 用 female，其他用 male。
 */
export function resolveCartoonWardrobe(meta) {
  const presenter = meta?.presenter;
  const mascot = meta?.mascot && typeof meta.mascot === 'object' ? meta.mascot : null;
  const kind = presenter?.kind;
  if (kind === 'real' || kind === 'video' || kind === 'none') return null;
  if (!presenter && mascot?.enabled === false) return null;
  const parts = (value) => ({
    hair: value?.hair,
    accessory: value?.accessory,
    facialHair: value?.facialHair,
    outfit: value?.outfit,
    skin: value?.skin,
  });
  let source;
  if (kind === 'cartoon' && presenter.look && typeof presenter.look === 'object') {
    source = {preset: presenter.look.preset || defaultPreset(meta?.domain), ...parts(presenter.look)};
  } else if (kind === 'cartoon') {
    source = {preset: (mascot?.id && ID_TO_PRESET[mascot.id]) || defaultPreset(meta?.domain), ...parts(mascot)};
  } else {
    source = {id: mascot?.id, ...parts(mascot)};
    if (!source.id) source.preset = defaultPreset(meta?.domain);
  }
  const resolved = resolveLook(source, meta?.domain);
  const wardrobe = {
    enabled: true,
    preset: resolved.preset,
    hair: resolved.hair,
    accessory: resolved.accessory,
    facialHair: resolved.facialHair,
    outfit: resolved.outfit,
    ...(resolved.skin ? {skin: resolved.skin} : {}),
  };
  if (Array.isArray(mascot?.pageOverrides)) wardrobe.pageOverrides = mascot.pageOverrides;
  return wardrobe;
}

export function poseLook(family, pose) {
  const table = POSE_LOOK[family] ?? POSE_LOOK.sweater;
  return table[pose] ?? table.explain;
}
