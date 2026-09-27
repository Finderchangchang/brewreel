// @ts-check
// Plugin wiring, independent of dsh imports: index.js passes in defineTool, tests pass in a stub.
import fs from 'node:fs';
import path from 'node:path';
import {normalizeConfig} from './config.js';
import {Semaphore} from './run.js';
import {findSkillSource, isStaged, PLUGIN_DIR, planRuntime, readSourceInfo, stageSkill} from './skill-root.js';
import {buildSkillRegistration, parseFrontmatter} from './skill.js';
import {createToolSpecs} from './tools.js';
import {StuckTracker} from './validate.js';

export const PLUGIN_NAME = 'distill-video';

export function pluginVersion() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'package.json'), 'utf8')).version);
  } catch {
    return '0.0.0';
  }
}

/**
 * Build the runtime context shared by all tools.
 * @param {any} rawConfig
 * @param {{pluginDir?: string, getJobs?: () => any, logger?: any}} [o]
 */
export function createRuntime(rawConfig, {pluginDir = PLUGIN_DIR, getJobs = () => undefined, logger} = {}) {
  const cfg = normalizeConfig(rawConfig);
  const source = findSkillSource({skillRoot: cfg.skillRoot, pluginDir});
  const plan = planRuntime(source, cfg);
  const sourceInfo = source.mode === 'bundled' ? readSourceInfo(source.root) : null;
  let skillVersion = sourceInfo?.skillVersion ?? null;
  if (!skillVersion && source.mode !== 'missing') {
    try {
      skillVersion = parseFrontmatter(fs.readFileSync(path.join(source.root, 'SKILL.md'), 'utf8')).data.metadata?.version ?? null;
    } catch {}
  }
  return {
    cfg,
    lang: cfg.skillLang,
    pluginVersion: pluginVersion(),
    skillVersion,
    source,
    plan,
    sourceInfo,
    tracker: new StuckTracker(),
    semaphore: new Semaphore(cfg.maxConcurrentRenders),
    getJobs,
    logger,
    skillRegistered: false,
  };
}

/**
 * @param {any} ctx Cordis context (needs ctx.tools; ctx.skills / ctx.jobs are optional)
 * @param {any} rawConfig
 * @param {{defineTool: (spec: any) => any, pluginDir?: string}} deps
 */
export function applyPlugin(ctx, rawConfig, {defineTool, pluginDir}) {
  const logger = ctx.logger ?? console;
  const rt = createRuntime(rawConfig, {
    pluginDir,
    logger,
    getJobs: () => {
      try {
        return typeof ctx.get === 'function' ? ctx.get('jobs') : ctx.jobs;
      } catch {
        return undefined;
      }
    },
  });
  if (rt.source.mode === 'missing') logger.warn?.(`distill-video: ${rt.source.error}; tools will report how to fix it`);

  // Stage a bundled / stageCheckout copy in the background (a local file copy, no download).
  // Scheduled through ctx.effect when available, so an unload / HMR reload before it fires cancels it.
  if (rt.plan.staged && rt.source.mode !== 'missing' && !isStaged(rt.plan.runtimeRoot)) {
    const schedule = () => {
      const timer = setTimeout(() => {
        try {
          const r = stageSkill(rt.source, rt.plan);
          logger.info?.(`distill-video: ${r.detail}`);
        } catch (e) {
          logger.warn?.(`distill-video: staging failed (${/** @type {any} */ (e)?.message ?? e}); distill_video_setup can retry`);
        }
      }, 0);
      return () => clearTimeout(timer);
    };
    if (typeof ctx.effect === 'function') ctx.effect(schedule);
    else schedule();
  }

  for (const spec of createToolSpecs(rt)) {
    ctx.tools.register(
      defineTool({
        name: spec.name,
        description: spec.description,
        parameters: spec.parameters,
        output: {schema: {type: 'json'}, render: spec.render},
        ...(spec.readOnly ? {isConcurrencySafe: () => true} : {}),
        execute: spec.execute,
      }),
    );
  }

  if (rt.cfg.registerSkill && rt.source.mode !== 'missing') {
    const registration = buildSkillRegistration({
      sourceRoot: rt.source.root,
      runtimeRoot: rt.plan.runtimeRoot,
      lang: rt.lang,
      pluginVersion: rt.pluginVersion,
      sourceInfo: rt.sourceInfo,
    });
    /** @param {any} c */
    const register = (c) => {
      const dispose = c.skills.register(registration);
      rt.skillRegistered = true;
      if (typeof c.effect === 'function') {
        c.effect(() => () => {
          rt.skillRegistered = false;
        });
      }
      return dispose;
    };
    if (typeof ctx.inject === 'function') ctx.inject(['skills'], register);
    else if (ctx.skills) register(ctx);
  }
  logger.info?.(`distill-video ${rt.pluginVersion}: skill ${rt.source.mode} at ${rt.source.root}; runtime ${rt.plan.runtimeRoot}`);
  return rt;
}
