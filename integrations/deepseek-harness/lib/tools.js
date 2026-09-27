// @ts-check
// The 7 tool specs as plain objects (no dsh import), so they can be unit-tested with a fake context.
// index.js wraps each one with dsh-tools' defineTool.
import {buildCatalog, GUIDE_PARTS, GUIDE_TOPICS, GuideError, readGuideFile, resolveGuide} from './catalog.js';
import {depsReady, runDoctor, runSetup} from './doctor.js';
import {allowedRoots} from './paths.js';
import {executeRender, executeVerify, planRender, renderResultText} from './render.js';
import {isStaged} from './skill-root.js';
import {TOOL_NAMES} from './skill.js';
import {renderValidateText, runValidate} from './validate.js';

export {TOOL_NAMES};

/** Canonical JSON: drops undefined, turns NaN/Infinity into null. @param {any} v */
export const toJson = (v) => JSON.parse(JSON.stringify(v ?? null));

/** @param {string} s @param {number} max */
export const clip = (s, max) => (s.length > max ? `${s.slice(0, max - 40)}\n…（truncated ${s.length - max + 40} chars）` : s);

/** Session workspace, taken the same way dsh's own file-search tools do. @param {any} exec */
export const workspaceOf = (exec) => exec?.agent?.session?.header?.cwd ?? process.cwd();

/**
 * @param {any} rt runtime context built by plugin.js
 */
export function createToolSpecs(rt) {
  const en = () => rt.lang === 'en';
  /** @param {string} zh @param {string} e */
  const L = (zh, e) => (en() ? e : zh);
  /** @param {any} value */
  const jsonText = (value) => [{type: 'text', text: clip(JSON.stringify(value, null, 1), rt.cfg.maxResultChars)}];
  const requireSource = () => {
    if (rt.source.mode === 'missing') throw new Error(`${rt.source.error}. ${L('调 brewreel_doctor 看怎么修', 'Call brewreel_doctor for the fix')}`);
  };
  /** @param {any} exec */
  const rootsOf = (exec) => allowedRoots({workspace: workspaceOf(exec), outputRoot: rt.cfg.outputRoot, extraWriteRoots: rt.cfg.extraWriteRoots});
  const needsSetup = () => (rt.plan.staged && !isStaged(rt.plan.runtimeRoot)) || !depsReady(rt.plan.runtimeRoot);

  /**
   * Start `work` as a dsh background job when possible; otherwise run it in the foreground.
   * @param {any} exec
   * @param {boolean} background
   * @param {string} label
   * @param {(o: {signal: AbortSignal, onLine: (l: string) => void, onProgress: (p: string) => void}) => Promise<any>} work
   * @param {(r: any) => {status: 'completed' | 'failed' | 'killed', detail: string}} outcome
   * @param {Record<string, any>} extra fields for the background handle
   */
  const maybeBackground = async (exec, background, label, work, outcome, extra = {}) => {
    const jobs = background ? rt.getJobs() : undefined;
    /** @type {string | undefined} */
    let refused;
    if (background && jobs) {
      if (exec.signal?.aborted) throw new Error('cancelled');
      /** @type {any} */
      let jobId;
      try {
        jobId = jobs.start({
        kind: 'brewreel',
        label,
        ...(exec.agent?.id !== undefined ? {owner: exec.agent.id} : {}),
        outputLimitBytes: 64 * 1024,
        run: (/** @type {any} */ job) => {
          const controller = new AbortController();
          const done = (async () => {
            try {
              const r = await work({
                signal: controller.signal,
                onLine: (l) => job.append(`${l}\n`),
                onProgress: (p) => job.updateProgress(p),
              });
              const o = outcome(r);
              return {...o, result: clip(JSON.stringify(toJson(r), null, 1), rt.cfg.maxResultChars)};
            } catch (e) {
              return {status: controller.signal.aborted ? 'killed' : 'failed', detail: String(/** @type {any} */ (e)?.message ?? e)};
            }
          })();
          return {cancel: (/** @type {string | undefined} */ reason) => controller.abort(reason), done};
        },
        });
      } catch (e) {
        // admission refused (no job controller for this caller, job limit …): run in the foreground instead
        refused = String(/** @type {any} */ (e)?.message ?? e);
        rt.logger?.warn?.(`brewreel: background job refused, running in the foreground: ${refused}`);
      }
      if (jobId !== undefined) return {kind: 'background', jobId: String(jobId), ...extra};
    }
    const r = await work({signal: exec.signal, onLine: () => {}, onProgress: () => {}});
    if (!background) return r;
    return {...r, note: refused ? L(`后台任务被拒绝（${refused}），已改为前台运行`, `background job refused (${refused}); ran in the foreground`) : L('没有加载 jobs 服务，已改为前台运行', 'jobs service not loaded; ran in the foreground')};
  };

  return [
    {
      name: TOOL_NAMES.doctor,
      description: 'Check whether BrewReel (vertical promo videos from a storyboard JSON) is ready to render: skill files, Node, Remotion dependencies, Chrome Headless Shell, optional Python/numpy/scipy for music. Read-only; downloads nothing. Call it first, and whenever another brewreel tool says the environment is not ready.',
      parameters: {deep: {type: 'boolean', description: 'Also run the shot-spec self-test (a few seconds).'}},
      readOnly: true,
      /** @param {{deep?: boolean}} args @param {any} exec */
      async execute(args, exec) {
        return toJson(await runDoctor(rt, {deep: !!args.deep, workspace: workspaceOf(exec), signal: exec.signal}));
      },
      /** @param {any} _a @param {any} v */
      render: (_a, v) => [{type: 'text', text: clip(`${v.ready ? 'READY' : 'NOT READY'} — ${v.nextStep}\n${JSON.stringify(v, null, 1)}`, rt.cfg.maxResultChars)}],
    },
    {
      name: TOOL_NAMES.setup,
      description: 'One-time setup for BrewReel: copy the skill into the runtime folder (stage), install the Remotion template dependencies with npm ci (deps) and download Chrome Headless Shell (browser). Downloads several hundred MB from npm and Google — ask the user before calling. Runs fixed commands only; Python packages are never installed (doctor prints the command for the user).',
      parameters: {
        steps: {type: 'array', items: {type: 'string', enum: ['stage', 'deps', 'browser']}, description: 'Subset of steps; default all three. Finished steps are skipped.'},
        run_in_background: {type: 'boolean', description: 'Run as a background job (default true); follow with job_output.'},
      },
      readOnly: false,
      /** @param {{steps?: string[], run_in_background?: boolean}} args @param {any} exec */
      async execute(args, exec) {
        requireSource();
        const bg = args.run_in_background ?? true;
        const r = await maybeBackground(
          exec,
          bg,
          'brewreel setup',
          async (o) => {
            const s = await runSetup(rt, {steps: args.steps, ...o});
            return {...s, doctor: await runDoctor(rt, {workspace: workspaceOf(exec), signal: o.signal})};
          },
          (s) => ({status: s.ok ? 'completed' : 'failed', detail: s.steps.map((/** @type {any} */ x) => `${x.id}:${x.status}`).join(' ')}),
          {hint: L('用 job_output 看进度；完成后 result 里有每一步的结果和 doctor', 'Follow with job_output; the result lists each step and a fresh doctor report')},
        );
        return toJson(r);
      },
      render: (/** @type {any} */ _a, /** @type {any} */ v) => jsonText(v),
    },
    {
      name: TOOL_NAMES.catalog,
      description: 'List BrewReel styles (cards / quiz / journey …: what each fits, aspects, themes, shots, docs, examples), industries (enabled shots, how the core action is shown) and cards color themes. Read-only.',
      parameters: {
        lang: {type: 'string', enum: ['zh', 'en'], description: 'Language of names and summaries.'},
        includeDev: {type: 'boolean', description: 'Also list styles still in development (the validator blocks them).'},
      },
      readOnly: true,
      /** @param {{lang?: 'zh' | 'en', includeDev?: boolean}} args */
      async execute(args) {
        requireSource();
        return toJson(buildCatalog(rt.plan.runtimeRoot && isStaged(rt.plan.runtimeRoot) ? rt.plan.runtimeRoot : rt.source.root, {includeDev: !!args.includeDev, lang: args.lang ?? rt.lang}));
      },
      render: (/** @type {any} */ _a, /** @type {any} */ v) => jsonText(v),
    },
    {
      name: TOOL_NAMES.guide,
      description: 'Read BrewReel documentation: the SKILL instructions, a style\'s STYLE.md / recipes.md, an industry\'s recipe / brief template, one shot\'s notes, or an example storyboard. Without id it lists the valid ids. Examples show format only — copying their captions or numbers triggers validator warnings.',
      parameters: {
        topic: {type: 'string', required: true, enum: GUIDE_TOPICS, description: 'What to read.'},
        id: {type: 'string', description: 'Style / industry / shot id; for an example "<style>/<name>" or a root example name such as "ledger".'},
        part: {type: 'string', enum: GUIDE_PARTS, description: 'style: style | recipes (default) | readme | rules; industry: recipe (default) | brief-template | test-brief | expected | rules.'},
        lang: {type: 'string', enum: ['zh', 'en'], description: 'Prefer the English file when one exists.'},
        offset: {type: 'integer', description: 'Continue from this character offset (nextOffset of the previous call).'},
        maxChars: {type: 'integer', description: 'Characters to return (default 12000).'},
      },
      readOnly: true,
      /** @param {{topic: string, id?: string, part?: string, lang?: 'zh' | 'en', offset?: number, maxChars?: number}} args */
      async execute(args) {
        requireSource();
        const root = rt.plan.runtimeRoot && isStaged(rt.plan.runtimeRoot) ? rt.plan.runtimeRoot : rt.source.root;
        const max = Math.min(Math.max(500, args.maxChars ?? 12000), rt.cfg.maxResultChars - 500);
        if (args.offset !== undefined && (!Number.isInteger(args.offset) || args.offset < 0)) throw new GuideError('offset must be a non-negative integer');
        const g = resolveGuide(root, {topic: args.topic, id: args.id, part: args.part, lang: args.lang ?? rt.lang});
        if ('choices' in g) return toJson({topic: args.topic, choices: g.choices, hint: L('再调一次，带上 id', 'Call again with one of these ids')});
        const f = readGuideFile(root, g.rel, {offset: args.offset ?? 0, maxChars: max});
        return toJson({path: g.rel, lang: g.langServed, ...(g.fallback ? {note: 'no English version; served Chinese'} : {}), ...f, related: g.related.slice(0, 12)});
      },
      /** @param {any} a @param {any} v */
      render: (a, v) => {
        if (v.choices) return [{type: 'text', text: `${a.topic}: ${v.choices.join(', ')}\n${v.hint}`}];
        const head = `# ${v.path} (${v.lang}${v.note ? `; ${v.note}` : ''})${v.truncated ? ` — ${L('未完，续读用', 'truncated, continue with')} offset ${v.nextOffset}` : ''}`;
        const warn = a.topic === 'example' ? `\n${L('（样例只看格式，字幕和参数照抄会被校验提醒）', '(Examples show format only; copied captions and parameters trigger validator warnings.)')}` : '';
        return [{type: 'text', text: `${head}${warn}\n\n${v.content}${v.related?.length ? `\n\n${L('相关', 'related')}: ${v.related.join(', ')}` : ''}`}];
      },
    },
    {
      name: TOOL_NAMES.validate,
      description: 'Validate a BrewReel storyboard.json (and, with brief, check that facts and quotes come from the brief). Returns errors (must fix), warnings (fix if possible) and human items (list for the user; do not edit for them), each with where / problem / fix. Replaces "node scripts/validate.mjs". Read-only.',
      parameters: {
        storyboard: {type: 'string', required: true, description: 'Path to storyboard.json, relative to the workspace (e.g. promo/my-app/storyboard.json) or absolute.'},
        brief: {type: 'string', description: 'Path to the brief file (e.g. promo/my-app/brief.md). Must exist when given.'},
      },
      readOnly: true,
      /** @param {{storyboard: string, brief?: string}} args @param {any} exec */
      async execute(args, exec) {
        requireSource();
        if (rt.plan.staged && !isStaged(rt.plan.runtimeRoot)) throw new Error(L(`运行目录还没准备好：先调 ${TOOL_NAMES.setup}（steps: ["stage"]，不联网）`, `The runtime folder is not staged yet: call ${TOOL_NAMES.setup} with steps ["stage"] (no download)`));
        return toJson(await runValidate({runtimeRoot: rt.plan.runtimeRoot, roots: rootsOf(exec), tracker: rt.tracker, lang: rt.lang, signal: exec.signal}, args));
      },
      render: (/** @type {any} */ _a, /** @type {any} */ v) => [{type: 'text', text: clip(renderValidateText(v, rt.lang), rt.cfg.maxResultChars)}],
    },
    {
      name: TOOL_NAMES.render,
      description: 'Render a BrewReel storyboard into video.mp4 (validate → machine checks → music → Remotion render → layout / blank-frame checks → manifest). Takes about 3–10 minutes; runs as a background job by default (follow with job_output). Deliver only result.video.path — it is present only when every check passed. stills renders single frames for a quick look and is never a deliverable. Replaces "node scripts/make.mjs".',
      parameters: {
        storyboard: {type: 'string', required: true, description: 'Path to storyboard.json (workspace-relative or absolute).'},
        brief: {type: 'string', description: 'Brief file; facts and quotes are checked against it.'},
        outDir: {type: 'string', description: 'Output folder, one per video. Default: the storyboard\'s folder. Must be inside the workspace and not the workspace or output root itself.'},
        stills: {type: 'array', items: {type: 'number'}, description: 'Only render frames at these seconds into check/ (preview, not a deliverable).'},
        bgm: {type: 'boolean', description: 'Generate background music (default from config).'},
        queueTimeoutMin: {type: 'integer', description: 'Minutes to wait for the render lock (1–120).'},
        run_in_background: {type: 'boolean', description: 'Run as a background job (default from config: true).'},
      },
      readOnly: false,
      /** @param {any} args @param {any} exec */
      async execute(args, exec) {
        requireSource();
        const plan = planRender(args, {runtimeRoot: rt.plan.runtimeRoot, roots: rootsOf(exec), cfg: rt.cfg});
        const setupFirst = needsSetup();
        if (setupFirst && !rt.cfg.autoSetup) {
          throw new Error(L(
            `渲染依赖还没装好：先调 ${TOOL_NAMES.doctor}，征得用户同意后调 ${TOOL_NAMES.setup}（会下载几百 MB），再出片`,
            `Render dependencies are not installed: call ${TOOL_NAMES.doctor}, then — after the user agrees — ${TOOL_NAMES.setup} (downloads several hundred MB), then render again`,
          ));
        }
        const bg = args.run_in_background ?? rt.cfg.renderInBackground;
        const r = await maybeBackground(
          exec,
          bg,
          `brewreel render ${plan.outDir}`,
          async ({signal, onLine, onProgress}) => {
            const release = await rt.semaphore.acquire(signal);
            try {
              if (setupFirst) {
                onProgress(L('先安装依赖', 'installing dependencies first'));
                const s = await runSetup(rt, {signal, onLine, onProgress});
                if (!s.ok) return {status: 'setup-failed', exitCode: null, exitMeaning: 'setup failed', delivered: false, video: null, setup: s, nextStep: L(`调 ${TOOL_NAMES.doctor} 看哪一步失败`, `Call ${TOOL_NAMES.doctor} to see which step failed`)};
              }
              return await executeRender(rt, plan, {signal, onLine, onProgress});
            } finally {
              release();
            }
          },
          (res) => ({
            status: res.exitCode === 0 ? 'completed' : res.status === 'killed' || res.status === 'interrupted' ? 'killed' : 'failed',
            detail: `exit code: ${res.exitCode ?? 'none'} (${res.exitMeaning})`,
          }),
          {outDir: plan.outDir, hint: L('用 job_output 看进度；完成后结果在任务的 result 里', 'Follow with job_output; the final JSON is in the job result')},
        );
        return toJson(r);
      },
      render: (/** @type {any} */ _a, /** @type {any} */ v) => [{type: 'text', text: clip(`${renderResultText(v, rt.lang)}\n\n${JSON.stringify(v, null, 1)}`, rt.cfg.maxResultChars)}],
    },
    {
      name: TOOL_NAMES.verify,
      description: 'Check that the video in an output folder still matches the current storyboard (hashes in manifest.json). Run before delivering if the storyboard might have changed. Read-only.',
      parameters: {
        storyboard: {type: 'string', required: true, description: 'Path to storyboard.json.'},
        outDir: {type: 'string', description: 'Output folder; default the storyboard\'s folder.'},
      },
      readOnly: true,
      /** @param {{storyboard: string, outDir?: string}} args @param {any} exec */
      async execute(args, exec) {
        requireSource();
        const plan = planRender(args, {runtimeRoot: rt.plan.runtimeRoot, roots: rootsOf(exec), cfg: rt.cfg, verify: true});
        return toJson(await executeVerify({...rt, signal: exec.signal}, plan));
      },
      render: (/** @type {any} */ _a, /** @type {any} */ v) => [{type: 'text', text: clip(`${v.ok ? 'OK' : 'MISMATCH'}\n${v.lines.join('\n')}\n${v.nextStep}`, rt.cfg.maxResultChars)}],
    },
  ];
}
