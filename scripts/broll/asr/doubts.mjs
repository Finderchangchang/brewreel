// 转写校对留下的「拿不准」：模型说某几个字拿不准（doubt），或者建议改字但脚本没敢自动改（只提示）。
// 这些字还没人核对过，不该做成全屏大字的动效卡片（「花钱之后」可能是「花钱之前」，意思正好相反）。
// transcribe.mjs 把它们连同当时那一句的原文记进 .brewreel/transcribe.json 的 doubts；
// 读的时候，那一句的字被用户改过就算核对过了（不管改成什么），没动过就还算拿不准。纯读文件，不加载识别模型。
import fs from 'node:fs';
import path from 'node:path';

const flat = (s) => String(s ?? '').replace(/\s+/g, '');

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
};

/**
 * 校对的 hints → 要记下来的拿不准（只留原句里真有那几个字的）。
 * @param {Array<{cue: string, kind: 'fix'|'doubt', text?: string, from?: string, to?: string, why?: string}>} hints
 * @param {Array<{id: string, text: string}>} cues 最终写进 talk.srt 的句子
 * @returns {Array<{cue: string, frag: string, to: string|null, why: string, cueText: string}>}
 */
export const doubtsFromHints = (hints, cues) => {
  const byId = new Map((cues ?? []).map((c) => [c.id, c]));
  const out = [];
  for (const h of hints ?? []) {
    const c = byId.get(h?.cue);
    if (!c) continue;
    const frag = String((h.kind === 'doubt' ? h.text : h.from) ?? '').trim();
    if (!frag || !flat(c.text).includes(flat(frag))) continue;
    out.push({cue: c.id, frag, to: h.kind === 'doubt' ? null : String(h.to ?? '') || null, why: String(h.why ?? ''), cueText: flat(c.text)});
  }
  return out;
};

/**
 * 现在还拿不准的字：那一句的原文和转写时一样（用户没动过）。没转写过、没有记录：返回 []。
 * @param {string} dir 项目目录
 * @param {Array<{id: string, text: string}>} cues 现在 talk.srt 里的句子
 * @returns {Array<{cue: string, frag: string, to: string|null, why: string}>}
 */
export const openDoubts = (dir, cues) => {
  const meta = readJson(path.join(dir, '.brewreel', 'transcribe.json'));
  const list = Array.isArray(meta?.doubts) ? meta.doubts : [];
  const byId = new Map((cues ?? []).map((c) => [c.id, c]));
  return list
    .filter((d) => d && typeof d.cue === 'string' && typeof d.frag === 'string' && d.frag)
    .filter((d) => {
      const c = byId.get(d.cue);
      return c && flat(c.text) === d.cueText && flat(c.text).includes(flat(d.frag));
    })
    .map(({cue, frag, to, why}) => ({cue, frag, to: to ?? null, why: why ?? ''}));
};

/** 一条拿不准，写成人话：c6「之后」拿不准（上下文像之前）/ c3「他」可能是「它」（读音不同） */
export const doubtText = (d) => (d.to ? `${d.cue}「${d.frag}」可能是「${d.to}」${d.why ? `（${d.why}）` : ''}` : `${d.cue}「${d.frag}」拿不准${d.why ? `（${d.why}）` : ''}`);
