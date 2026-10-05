import fs from 'node:fs';
import path from 'node:path';
import {sha256File, sha256Text, stableString} from './hash.mjs';

export const reviewFile = (outDir) => path.join(outDir, 'broll.review.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));

/**
 * broll.json 去掉动效段之后的哈希。动效段不花钱、不审片：改了动效里的字，不该让已经审过的付费片段作废。
 * 解析不了（不是 JSON）就退回整文件的哈希，照样能发现「改过了」。
 */
export const brollAiSha256 = (jsonPath) => {
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, '');
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return sha256Text(raw);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return sha256Text(raw);
  const clips = Array.isArray(doc.clips) ? doc.clips.filter((c) => !(c && typeof c === 'object' && c.source === 'motion')) : doc.clips;
  return sha256Text(stableString({...doc, clips}));
};

/** 人看完审片页后写入。绑定 broll.json（去掉动效段）和每段 AI 片段的 sha256，改了就失效。clipIds 只放 AI 画面段。 */
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
    version: 2,
    approvedAt: new Date().toISOString(),
    brollSha256: sha256File(jsonPath),
    brollAiSha256: brollAiSha256(jsonPath),
    clips,
  };
  const dest = reviewFile(outDir);
  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(dest, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return dest;
};

/**
 * 正式片要用的检查。通过返回 {ok:true}。clipIds 只放 AI 画面段（动效段不审）。
 * 缺文件、broll.json 的 AI 部分变了、片段文件变了，都是 {ok:false, reason}。
 * v0.8 写的 broll.review.json 只有 brollSha256（整文件），照样认。
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
  const same = rev.brollAiSha256 ? rev.brollAiSha256 === brollAiSha256(jsonPath) : rev.brollSha256 === sha256File(jsonPath);
  if (!same) return {ok: false, reason: 'broll.json 里 AI 画面的部分已改，审片作废'};
  for (const id of clipIds) {
    const got = rev.clips?.[id];
    const abs = path.join(outDir, 'clips', `${id}.mp4`);
    if (!got?.sha256) return {ok: false, reason: `${id} 没有审片记录`};
    if (!fs.existsSync(abs)) return {ok: false, reason: `${id} 的片段不在`};
    if (sha256File(abs) !== got.sha256) return {ok: false, reason: `${id} 的片段已变，审片作废`};
  }
  return {ok: true, review: rev};
};
