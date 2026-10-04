import fs from 'node:fs';
import path from 'node:path';
import {sha256File} from './hash.mjs';

export const reviewFile = (outDir) => path.join(outDir, 'broll.review.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

/** 人看完审片页后写入。绑定 broll.json 和每段成片片段的 sha256，改了就失效。 */
export const writeApproval = ({projectDir, outDir, clipIds}) => {
  const jsonPath = path.join(projectDir, 'broll.json');
  if (!fs.existsSync(jsonPath)) throw new Error('项目目录里没有 broll.json。');
  const clips = {};
  for (const id of clipIds) {
    const rel = `clips/${id}.mp4`;
    const abs = path.join(outDir, rel);
    if (!fs.existsSync(abs)) throw new Error(`还没有 ${rel}。先生成，再审，再批准。`);
    clips[id] = {file: rel.replace(/\\/g, '/'), sha256: sha256File(abs)};
  }
  const doc = {
    version: 1,
    approvedAt: new Date().toISOString(),
    brollSha256: sha256File(jsonPath),
    clips,
  };
  const dest = reviewFile(outDir);
  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(dest, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return dest;
};

/**
 * 正式片要用的检查。通过返回 {ok:true}。
 * 缺文件、broll.json 变了、片段文件变了，都是 {ok:false, reason}。
 */
export const checkReview = ({projectDir, outDir, clipIds}) => {
  const file = reviewFile(outDir);
  if (!fs.existsSync(file)) return {ok: false, reason: '没有 broll.review.json'};
  let rev;
  try {
    rev = readJson(file);
  } catch {
    return {ok: false, reason: 'broll.review.json 解析失败'};
  }
  const jsonPath = path.join(projectDir, 'broll.json');
  if (!fs.existsSync(jsonPath)) return {ok: false, reason: '项目目录里没有 broll.json'};
  if (rev.brollSha256 !== sha256File(jsonPath)) return {ok: false, reason: 'broll.json 已改，审片作废'};
  for (const id of clipIds) {
    const got = rev.clips?.[id];
    const abs = path.join(outDir, 'clips', `${id}.mp4`);
    if (!got?.sha256) return {ok: false, reason: `${id} 没有审片记录`};
    if (!fs.existsSync(abs)) return {ok: false, reason: `${id} 的片段不在`};
    if (sha256File(abs) !== got.sha256) return {ok: false, reason: `${id} 的片段已变，审片作废`};
  }
  return {ok: true, review: rev};
};
