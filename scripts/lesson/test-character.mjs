import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CARD_FPS, CARD_FRAMES, cardFrameState} from './character-clip.mjs';
import {cardHtml} from './character-card.mjs';
import {
  assertReady,
  bindLessonCharacter,
  characterManifestEntry,
  createCharacterFile,
  createRecord,
  lookFromPreset,
  resolveCharacterVersion,
  updateCharacter,
  validateCharacter,
} from './character-store.mjs';
import {validateLesson} from './validate-lesson.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'character-'));
const script = path.join(ROOT, 'scripts', 'lesson', 'character.mjs');
const make = path.join(ROOT, 'scripts', 'lesson', 'make-lesson.mjs');
const now = '2026-10-02T00:00:00.000Z';
const later = '2026-10-02T01:00:00.000Z';

const run = (args) => spawnSync(process.execPath, [script, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 30_000,
  windowsHide: true,
  env: {...process.env, MINIMAX_API_KEY: '', VISION_API_KEY: '', VISION_BASE_URL: ''},
});

const rejected = run(['create', '--client', 'demo', '--name', '照片角色', '--id', 'pic', '--photo', 'missing.jpg', '--data-dir', tmp]);
assert.notEqual(rejected.status, 0);
assert.match(rejected.stderr, /授权人/);
assert.doesNotMatch(rejected.stderr, /找不到照片/);
assert.throws(
  () => createRecord({client: 'demo', id: 'pic', name: '照片角色', look: lookFromPreset('male'), source: 'photo', consentBy: '', now}),
  /授权人/,
);

const male = lookFromPreset('male');
const female = lookFromPreset('female');
const file = path.join(tmp, 'characters', 'acme', 'host', 'character.json');
let record = createCharacterFile(file, {
  client: 'acme', id: 'host', name: '甲', look: male, theme: 'lecture', source: 'preset', now,
});
assert.equal(record.version, 1);
assert.equal(record.approvedAt, null);
const approved = {...record, approvedAt: now, updatedAt: now};
fs.writeFileSync(file, `${JSON.stringify(approved, null, 2)}\n`, 'utf8');
record = updateCharacter(approved, {look: female}, later);
fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
assert.equal(record.version, 2);
assert.equal(record.history.length, 1);
assert.equal(record.history[0].version, 1);
assert.equal(record.history[0].look.hair, male.hair);
assert.equal(record.history[0].approvedAt, now);
assert.equal(record.approvedAt, null);
assert.equal(record.look.hair, female.hair);

const latest = resolveCharacterVersion(record, null);
const pinned = resolveCharacterVersion(record, 1);
assert.equal(latest.version, 2);
assert.equal(latest.pinned, false);
assert.equal(pinned.version, 1);
assert.equal(assertReady(record, latest, false).ok, false);
assert.match(assertReady(record, latest, false).message, /角色卡/);
assert.match(assertReady(record, latest, false).message, /客户确认/);
assert.equal(assertReady(record, latest, true).watermark, true);
assert.equal(assertReady(record, pinned, false).ok, true);

const lesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'lesson', 'sample-tech.json'), 'utf8'));
lesson.meta.presenter = {kind: 'cartoon', character: 'acme/host@1'};
const pinnedBind = bindLessonCharacter(lesson, {dataDir: tmp, draft: false});
assert.equal(pinnedBind.manifest.id, 'acme/host');
assert.equal(pinnedBind.manifest.version, 1);
assert.match(pinnedBind.manifest.consent.summary, /预设形象/);
assert.match(pinnedBind.manifest.consent.summary, /授权人/);
lesson.meta.presenter.character = 'acme/host';
assert.throws(() => bindLessonCharacter(lesson, {dataDir: tmp, draft: false}), /客户确认/);
record.approvedAt = later;
const current = characterManifestEntry(record, resolveCharacterVersion(record, null));
assert.equal(current.version, 2);
assert.equal(current.id, 'acme/host');
assert.equal(current.consent.source, 'preset');

const rawFile = path.join(tmp, 'characters', 'acme', 'raw', 'character.json');
createCharacterFile(rawFile, {
  client: 'acme', id: 'raw', name: '未确认', look: male, theme: 'lecture', source: 'preset', now,
});
const blockedLesson = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'lesson', 'mascot-demo.json'), 'utf8'));
blockedLesson.meta.presenter = {kind: 'cartoon', character: 'acme/raw'};
const lessonPath = path.join(tmp, 'lesson.json');
const outDir = path.join(tmp, 'out');
fs.writeFileSync(lessonPath, JSON.stringify(blockedLesson));
const blocked = spawnSync(process.execPath, [make, lessonPath, '--out', outDir, '--no-bgm', '--data-dir', tmp], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 30_000,
  windowsHide: true,
});
assert.notEqual(blocked.status, 0);
assert.match(blocked.stderr, /客户确认/);
assert.match(blocked.stderr, /角色卡/);
assert.equal(fs.existsSync(path.join(outDir, 'video.mp4')), false);

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'lesson', 'sample-tech.json'), 'utf8'));
assert.equal(validateLesson({...sample, meta: {...sample.meta, presenter: {kind: 'cartoon', character: 'demo/host'}}}).ok, true);
assert.match(validateLesson({...sample, meta: {...sample.meta, presenter: {kind: 'cartoon', character: 'demo/host', look: {preset: 'male'}}}}).errors.join('\n'), /不要再写 look/);
assert.match(validateLesson({...sample, meta: {...sample.meta, presenter: {kind: 'cartoon', character: 'Demo/Host'}}}).errors.join('\n'), /客户id/);
const photoConsent = createRecord({client: 'demo', id: 'host', name: '甲', look: male, source: 'preset', now});
photoConsent.consent = {...photoConsent.consent, source: 'photo', grantedBy: '  ', photoFile: 'photo.png'};
assert.match(validateCharacter(photoConsent).join('\n'), /授权人/);

const html = cardHtml({name: '甲', version: 1, theme: 'lecture', look: male});
assert.match(html, /#E9ECE7/);
assert.match(html, /scaleX\(-1\)/);
for (const label of ['讲解', '指向', '勾选', '提醒', '思考', '肯定', '加油', '挥手', '张嘴', '闭嘴', '眨眼']) {
  assert.match(html, new RegExp(label));
}
assert.equal(CARD_FRAMES / CARD_FPS, 3);
let blinkRuns = 0;
let blinking = false;
let mouthOpen = false;
for (let frame = 0; frame < CARD_FRAMES; frame += 1) {
  const state = cardFrameState(frame);
  if (state.blink === 1 && !blinking) blinkRuns += 1;
  blinking = state.blink === 1;
  if (state.mouth >= 0.1) mouthOpen = true;
}
assert.equal(blinkRuns, 1);
assert.equal(mouthOpen, true);
assert.equal(cardFrameState(0).pose, 'explain');
assert.ok(cardFrameState(0).mouth < 0.1);
assert.equal(cardFrameState(CARD_FRAMES - 1).pose, 'point');
assert.equal(cardFrameState(CARD_FRAMES - 1).progress, 1);
assert.ok(cardFrameState(CARD_FRAMES - 1).mouth < 0.1);

console.log('test-character：照片缺授权人被拒、未确认角色正式出片被拒、版本递增、manifest 记录角色版本');
