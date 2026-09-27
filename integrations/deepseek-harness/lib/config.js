// @ts-check
// Plugin configuration: defaults, the Schemastery schema (built from the host's schemastery instance),
// and a dependency-free normalizer used by tests and by tools at call time.

export const SECRET_ENV_RE = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|AUTH|COOKIE|CREDENTIAL/i;

/** @typedef {typeof DEFAULTS} DistillConfig */
export const DEFAULTS = Object.freeze({
  skillRoot: '',
  stageCheckout: false,
  runtimeDir: '',
  outputRoot: 'promo',
  /** @type {string[]} */
  extraWriteRoots: [],
  renderInBackground: true,
  maxConcurrentRenders: 1,
  renderTimeoutMin: 30,
  queueTimeoutMin: 20,
  bgm: true,
  autoSetup: false,
  npmRegistry: '',
  python: '',
  ffmpeg: '',
  registerSkill: true,
  /** @type {'zh' | 'en'} */
  skillLang: 'zh',
  maxResultChars: 16000,
  /** @type {string[]} */
  envPassthrough: [],
});

/**
 * Validate the cross-field and content rules the schema DSL cannot express. Throws with a fix hint.
 * @param {Partial<DistillConfig>} raw
 * @returns {DistillConfig}
 */
export function normalizeConfig(raw = {}) {
  /** @type {any} */
  const c = {...DEFAULTS, ...Object.fromEntries(Object.entries(raw ?? {}).filter(([, v]) => v !== undefined))};
  c.extraWriteRoots = [...(c.extraWriteRoots ?? [])];
  c.envPassthrough = [...(c.envPassthrough ?? [])];
  for (const name of c.envPassthrough) {
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`distill-video: envPassthrough entry ${JSON.stringify(name)} is not an environment variable name`);
    }
    if (SECRET_ENV_RE.test(name)) {
      throw new Error(`distill-video: envPassthrough refuses "${name}" — variables that look like credentials (KEY/TOKEN/SECRET/PASSWORD/AUTH/COOKIE) are never passed to render processes`);
    }
  }
  if (c.npmRegistry && !/^https:\/\/[^\s]+$/.test(c.npmRegistry)) {
    throw new Error(`distill-video: npmRegistry must be an https:// URL, got ${JSON.stringify(c.npmRegistry)}`);
  }
  if (!Number.isInteger(c.maxConcurrentRenders) || c.maxConcurrentRenders < 1 || c.maxConcurrentRenders > 4) {
    throw new Error('distill-video: maxConcurrentRenders must be an integer between 1 and 4');
  }
  for (const k of ['renderTimeoutMin', 'queueTimeoutMin']) {
    if (!(typeof c[k] === 'number' && c[k] > 0 && c[k] <= 240)) throw new Error(`distill-video: ${k} must be a number of minutes in (0, 240]`);
  }
  if (!Number.isInteger(c.maxResultChars) || c.maxResultChars < 2000) throw new Error('distill-video: maxResultChars must be an integer >= 2000');
  if (c.skillLang !== 'zh' && c.skillLang !== 'en') throw new Error('distill-video: skillLang must be "zh" or "en"');
  if (typeof c.outputRoot !== 'string' || !c.outputRoot.trim()) throw new Error('distill-video: outputRoot must be a non-empty path');
  return c;
}

/**
 * Build the Config schema with the host's Schemastery (a peer dependency, so the Web settings form
 * and --dump-config-schema see the same instance dsh uses).
 * @param {any} Schema - default export of @deepseek-ai/schemastery
 */
export function createConfigSchema(Schema) {
  const d = DEFAULTS;
  const envList = Schema.array(Schema.string()).default([]).description('Extra environment variable names passed to render processes. Names that look like credentials (KEY / TOKEN / SECRET / PASSWORD / AUTH / COOKIE) are rejected.');
  const guardedEnv = typeof Schema.transform === 'function'
    ? Schema.transform(envList, (/** @type {string[]} */ v) => normalizeConfig({envPassthrough: v}).envPassthrough)
    : envList;
  return Schema.object({
    skillRoot: Schema.string().default(d.skillRoot).description('Path to a Distill Video checkout. Empty = auto-detect (the checkout two levels up, then the bundled snapshot).'),
    stageCheckout: Schema.boolean().default(d.stageCheckout).description('Copy a checkout into the runtime directory before running, instead of rendering inside the checkout.'),
    runtimeDir: Schema.string().default(d.runtimeDir).description('Where the staged skill, node_modules and Chrome Headless Shell live. Empty = $DSH_HOME/distill-video (~/.dsh/distill-video).'),
    outputRoot: Schema.string().default(d.outputRoot).description('Output root, relative to the session workspace.'),
    extraWriteRoots: Schema.array(Schema.string()).default([]).description('Extra absolute directories the tools may read storyboards from and write videos to.'),
    renderInBackground: Schema.boolean().default(d.renderInBackground).description('Run distill_video_render as a background job by default.'),
    maxConcurrentRenders: Schema.number().min(1).max(4).step(1).default(d.maxConcurrentRenders).description('How many render processes this plugin runs at once.'),
    renderTimeoutMin: Schema.number().min(1).max(240).default(d.renderTimeoutMin).description('Hard timeout for one render, in minutes; the process tree is killed after it.'),
    queueTimeoutMin: Schema.number().min(1).max(120).default(d.queueTimeoutMin).description('How long a render may wait for the render lock, in minutes.'),
    bgm: Schema.boolean().default(d.bgm).description('Generate background music by default (needs Python with numpy and scipy; silent otherwise).'),
    autoSetup: Schema.boolean().default(d.autoSetup).description('Let a render run setup (downloads several hundred MB) when dependencies are missing. Off by default so the user decides.'),
    npmRegistry: Schema.string().default(d.npmRegistry).description('npm registry used by setup, e.g. a mirror. Must be an https:// URL.'),
    python: Schema.string().default(d.python).description('Python executable for music generation. Empty = python (Windows) / python3.'),
    ffmpeg: Schema.string().default(d.ffmpeg).description('Optional ffmpeg executable for contact sheets and blank-frame checks.'),
    registerSkill: Schema.boolean().default(d.registerSkill).description('Register the Distill Video skill (instructions) in addition to the tools.'),
    skillLang: Schema.union(['zh', 'en']).default(d.skillLang).description('Which SKILL file to register; also the language of tool results.'),
    maxResultChars: Schema.number().min(2000).step(1).default(d.maxResultChars).description('Upper bound on the text one tool result hands to the model.'),
    envPassthrough: guardedEnv,
  });
}
