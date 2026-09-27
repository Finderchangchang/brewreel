// @ts-check
// Read SKILL.md / SKILL.en.md, put a DeepSeek Harness preamble in front of the body, and build the
// ctx.skills.register() payload. The repository's files are never modified.
import fs from 'node:fs';
import path from 'node:path';

export const TOOL_NAMES = Object.freeze({
  doctor: 'brewreel_doctor',
  setup: 'brewreel_setup',
  catalog: 'brewreel_catalog',
  guide: 'brewreel_guide',
  validate: 'brewreel_validate',
  render: 'brewreel_render',
  verify: 'brewreel_verify',
});

/**
 * Minimal frontmatter reader for the agentskills header used by SKILL.md (flat keys plus one nested
 * `metadata:` block). Values are single-line scalars.
 * @param {string} text
 */
export function parseFrontmatter(text) {
  const src = text.replace(/^﻿/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return {data: /** @type {Record<string, any>} */ ({}), body: src};
  /** @type {Record<string, any>} */
  const data = {};
  /** @type {Record<string, any> | null} */
  let nested = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = /^(\s*)([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, indent, key, raw] = kv;
    const value = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
    if (indent.length === 0) {
      if (value === '') {
        nested = {};
        data[key] = nested;
      } else {
        nested = null;
        data[key] = value;
      }
    } else if (nested) nested[key] = value;
  }
  return {data, body: src.slice(m[0].length)};
}

/**
 * Model-facing preamble placed before the SKILL body.
 * @param {'zh' | 'en'} lang
 * @param {string} runtimeRoot
 */
export function buildPreamble(lang, runtimeRoot) {
  const T = TOOL_NAMES;
  if (lang === 'en') {
    return [
      '[Using this skill inside DeepSeek Harness]',
      `- Below, <SKILL> = ${runtimeRoot}. It is reference material: do not modify files there.`,
      `- To see the styles and industries, call ${T.catalog}. To read a style's STYLE.md / recipes.md, an industry's recipe / brief template, a shot's notes or an example, call ${T.guide} (you may also read the files relative to the base directory).`,
      '- Write storyboard.json and brief.md under promo/<english-slug>/ in the workspace, UTF-8.',
      `- Step 9 (validate): call ${T.validate} instead of node scripts/validate.mjs.`,
      `- Step 10 (render): call ${T.render} instead of node scripts/make.mjs. It runs in the background by default; follow it with job_output. The only deliverable mp4 path is video.path in its result.`,
      `- Step 12 (verify): call ${T.verify}.`,
      '- Ignore --round (testing only) and the --out placement rules in the text below: the tools manage output folders.',
      `- If a tool reports that the environment is not ready: call ${T.doctor}, then — after the user agrees — ${T.setup} (downloads several hundred MB).`,
      '',
    ].join('\n');
  }
  return [
    '【在 DeepSeek Harness 里使用本 skill】',
    `- 下文 <SKILL> = ${runtimeRoot}。这是参考资料目录，不要修改里面的文件。`,
    `- 看有哪些风格、行业：调 ${T.catalog}；读某个风格的 STYLE.md / recipes.md、行业的 recipe.md / brief-template.md、镜头说明、样例：调 ${T.guide}（也可以按上面的基目录直接读文件）。`,
    '- 分镜 storyboard.json 和简报 brief.md 写在工作区 promo/<片名英文>/ 下，文件用 UTF-8。',
    `- 第 9 步校验：调 ${T.validate}，代替 node scripts/validate.mjs。`,
    `- 第 10 步出片：调 ${T.render}，代替 node scripts/make.mjs。它默认在后台跑，用 job_output 看进度；交付给用户的 mp4 路径只认结果里的 video.path。`,
    `- 第 12 步核对：调 ${T.verify}。`,
    '- 忽略正文里的 --round（测试用）和 --out 落点规则，输出目录由工具管理。',
    `- 工具报「环境没装好」：先调 ${T.doctor}，再征得用户同意后调 ${T.setup}（会下载几百 MB 依赖）。`,
    '',
  ].join('\n');
}

/**
 * @param {{sourceRoot: string, runtimeRoot: string, lang: 'zh' | 'en', pluginVersion: string, sourceInfo?: any}} o
 */
export function buildSkillRegistration({sourceRoot, runtimeRoot, lang, pluginVersion, sourceInfo}) {
  const file = lang === 'en' && fs.existsSync(path.join(sourceRoot, 'SKILL.en.md')) ? 'SKILL.en.md' : 'SKILL.md';
  const {data, body} = parseFrontmatter(fs.readFileSync(path.join(sourceRoot, file), 'utf8'));
  const name = String(data.name || 'brewreel');
  const description = String(data.description || 'BrewReel: vertical promo videos from a storyboard JSON.');
  const skillVersion = String(data.metadata?.version ?? sourceInfo?.skillVersion ?? '');
  return {
    name,
    description,
    content: `${buildPreamble(lang, runtimeRoot)}\n${body.replace(/^\s+/, '')}`,
    path: path.join(runtimeRoot, file),
    source: 'runtime',
    resourceBase: {kind: /** @type {const} */ ('directory'), path: runtimeRoot},
    metadata: {
      plugin: 'dsh-brewreel',
      pluginVersion,
      skillVersion,
      ...(sourceInfo?.repoCommit ? {repoCommit: sourceInfo.repoCommit} : {}),
      ...(data.license ? {license: String(data.license)} : {}),
    },
  };
}
