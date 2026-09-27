// @ts-check
// brewreel_validate: run the skill's validate.mjs --json, add the plugin's asset-path rule, and
// track errors that survive several rounds so a cheap model stops looping.
import fs from 'node:fs';
import path from 'node:path';
import {assertArgPath, assertReadable, assetEscapes, PathRuleError, resolveUserPath} from './paths.js';
import {cleanEnv, runProcess} from './run.js';

const STUCK_ROUNDS = 3;
const LIST_CAP = 30;

/**
 * Resolve and check storyboard / brief paths.
 * @param {{storyboard: string, brief?: string}} args
 * @param {ReturnType<typeof import('./paths.js').allowedRoots>} roots
 */
export function resolveInputs(args, roots) {
  const storyboard = resolveUserPath(args.storyboard, roots.workspace, 'storyboard');
  assertReadable(storyboard, roots, 'storyboard');
  if (!fs.existsSync(storyboard) || !fs.statSync(storyboard).isFile()) throw new PathRuleError(`storyboard not found: ${storyboard} (relative paths resolve against the workspace ${roots.workspace}; write the file first, e.g. promo/<name>/storyboard.json)`);
  /** @type {string | undefined} */
  let brief;
  if (args.brief !== undefined && args.brief !== '') {
    brief = resolveUserPath(args.brief, roots.workspace, 'brief');
    assertReadable(brief, roots, 'brief');
    if (!fs.existsSync(brief) || !fs.statSync(brief).isFile()) throw new PathRuleError(`brief file not found: ${brief} (write the brief first, or omit the brief argument)`);
  }
  return {storyboard, brief};
}

/** @param {any} e */
const item = (e) => ({where: String(e?.where ?? ''), problem: String(e?.problem ?? ''), fix: String(e?.fix ?? '')});

/**
 * Spawn validate.mjs --json and parse it.
 * @param {{runtimeRoot: string, storyboard: string, brief?: string, signal?: AbortSignal, timeoutMs?: number}} o
 */
export async function spawnValidate({runtimeRoot, storyboard, brief, signal, timeoutMs = 60_000}) {
  const args = [path.join(runtimeRoot, 'scripts', 'validate.mjs'), assertArgPath(storyboard), '--json'];
  if (brief) args.push('--brief', assertArgPath(brief));
  const r = await runProcess({cmd: process.execPath, args, cwd: runtimeRoot, env: cleanEnv(), timeoutMs, signal});
  if (r.aborted) throw new Error('validation cancelled');
  if (r.timedOut) throw new Error(`validate.mjs timed out after ${Math.round(timeoutMs / 1000)}s`);
  if (r.spawnError) throw new Error(`could not start validate.mjs: ${r.spawnError}`);
  if (r.code === 2) throw new Error(`validate.mjs rejected the arguments: ${(r.stdout + r.stderr).trim().slice(-800)}`);
  const start = r.stdout.indexOf('{');
  try {
    return JSON.parse(r.stdout.slice(start));
  } catch {
    throw new Error(`validate.mjs exited with ${r.code} and printed no JSON: ${(r.stdout + r.stderr).trim().slice(-800)}`);
  }
}

/** Per-storyboard memory of which errors survived how many consecutive rounds. */
export class StuckTracker {
  constructor() {
    /** @type {Map<string, Map<string, number>>} */
    this.byFile = new Map();
  }
  /**
   * @param {string} file
   * @param {{where: string, problem: string}[]} errors
   */
  observe(file, errors) {
    const key = process.platform === 'win32' ? file.toLowerCase() : file;
    const prev = this.byFile.get(key) ?? new Map();
    const next = new Map();
    const stuck = [];
    for (const e of errors) {
      const k = `${e.where}\u0000${e.problem}`;
      const seen = (prev.get(k) ?? 0) + 1;
      next.set(k, seen);
      if (seen >= STUCK_ROUNDS) stuck.push({where: e.where, problem: e.problem, seen});
    }
    this.byFile.set(key, next);
    return stuck;
  }
}

/**
 * @param {{runtimeRoot: string, roots: ReturnType<typeof import('./paths.js').allowedRoots>, tracker: StuckTracker, lang: 'zh' | 'en', signal?: AbortSignal}} rt
 * @param {{storyboard: string, brief?: string}} args
 */
export async function runValidate(rt, args) {
  const {storyboard, brief} = resolveInputs(args, rt.roots);
  const raw = await spawnValidate({runtimeRoot: rt.runtimeRoot, storyboard, brief, signal: rt.signal});
  const errors = (raw.errors ?? []).map(item);
  // plugin rule: assets must stay inside the storyboard folder / workspace
  try {
    const sb = JSON.parse(fs.readFileSync(storyboard, 'utf8').replace(/^﻿/, ''));
    errors.push(...assetEscapes(sb, path.dirname(storyboard), rt.roots));
  } catch {}
  const warnings = (raw.warnings ?? []).map(item);
  const human = (raw.human ?? []).map(item);
  const stuck = rt.tracker.observe(storyboard, errors);
  const ok = errors.length === 0;
  const en = rt.lang === 'en';
  let nextStep;
  if (stuck.length) nextStep = en ? 'The same error survived 3 rounds of edits: stop, show the user the exact error text and ask how to proceed' : '同一条改了 3 次还在：停下来，把报错原文给用户看、问用户怎么定';
  else if (!ok) nextStep = en ? 'Fix storyboard.json item by item following each fix, then call this tool again' : '按 errors 的 fix 逐条改 storyboard.json，改完再调本工具';
  else nextStep = en ? 'call brewreel_render; keep the human items for the delivery checklist' : '调 brewreel_render 出片；human 条目留着交付时原样列给用户';
  return {
    ok,
    storyboard,
    briefChecked: !!brief,
    counts: {errors: errors.length, warnings: warnings.length, human: human.length},
    errors,
    warnings: warnings.slice(0, LIST_CAP),
    human: human.slice(0, LIST_CAP),
    ...(warnings.length > LIST_CAP ? {warningsOmitted: warnings.length - LIST_CAP} : {}),
    ...(human.length > LIST_CAP ? {humanOmitted: human.length - LIST_CAP} : {}),
    total: typeof raw.total === 'number' ? raw.total : 0,
    slots: Array.isArray(raw.slots) ? raw.slots : [],
    stuck,
    nextStep,
  };
}

/**
 * Model-facing text in the repository's formatReport style.
 * @param {Awaited<ReturnType<typeof runValidate>>} v
 * @param {'zh' | 'en'} lang
 */
export function renderValidateText(v, lang) {
  const en = lang === 'en';
  const out = [];
  if (v.ok) out.push(en ? `Validation passed: ${v.slots.length} shots, ${v.total}s total.` : `校验通过：${v.slots.length} 镜，共 ${v.total} 秒。`);
  else out.push(en ? `Validation failed: ${v.errors.length} error(s) — must fix:` : `校验未通过：${v.errors.length} 个问题（必须改）：`);
  v.errors.forEach((e, k) => out.push(`${k + 1}. ${e.where}${en ? ': ' : '：'}${e.problem}\n   → ${en ? 'fix' : '怎么改'}${en ? ': ' : '：'}${e.fix}`));
  if (v.warnings.length) {
    out.push(en ? `Warnings ${v.counts.warnings} (fix if you can; otherwise be able to explain why to the user):` : `提醒 ${v.counts.warnings} 条（尽量改，改不动要能跟用户说清为什么）：`);
    v.warnings.forEach((e) => out.push(`  - ${e.where}${en ? ': ' : '：'}${e.problem}（${e.fix}）`));
  }
  if (v.human.length) {
    out.push(en ? `Human review ${v.counts.human} (do not edit for these; list them for the user as is):` : `需人工复核 ${v.counts.human} 条（不改分镜，原样列给用户）：`);
    v.human.forEach((e) => out.push(`  - ${e.where}${en ? ': ' : '：'}${e.problem}（${e.fix}）`));
  }
  if (v.stuck.length) out.push((en ? 'STUCK: ' : '卡住了：') + v.stuck.map((s) => `${s.where} × ${s.seen}`).join('; '));
  out.push((en ? 'Next: ' : '下一步：') + v.nextStep);
  return out.join('\n');
}
