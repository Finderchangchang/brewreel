import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {judgeBgmRun, judgePythonProbe, probePythonBgm, skippedByFlag} from '../lib/bgm.mjs';
import {
  REQUIRED_FONTS,
  exitCode,
  formatReport,
  judgeApiKey,
  judgeBrowser,
  judgeDeps,
  judgeDir,
  judgeDisk,
  judgeFfmpeg,
  judgeFonts,
  judgeNode,
  judgePython,
  parseNodeVersion,
} from './doctor-checks.mjs';
import {defaultDataDir, defaultOutDir, isInsideRepo, resolveDataDir, resolveOutDir, showPath} from './paths.mjs';

const pass = (label) => console.log(`✓ ${label}`);

const nodeOld = judgeNode('v16.20.2');
assert.equal(nodeOld.ok, false);
assert.match(nodeOld.fix, /20 LTS/);
assert.equal(judgeNode('v18.0.0').ok, true);
assert.equal(judgeNode(process.versions.node).ok, true);
assert.equal(judgeNode('not-a-version').ok, false);
assert.deepEqual(parseNodeVersion('v22.22.2'), [22, 22, 2]);
pass('Node 版本');

assert.equal(judgeDeps({cli: true, remotion: true, react: true, typescript: true, lock: true, linked: false}).ok, true);
assert.equal(judgeDeps({cli: false, remotion: true, react: true, typescript: true, lock: true, linked: false}).ok, false);
assert.match(judgeDeps({cli: true, remotion: true, react: true, typescript: true, lock: true, linked: true}).fix, /链接/);
assert.match(judgeDeps({cli: true, remotion: true, react: true, typescript: true, lock: false, linked: false}).fix, /package-lock/);
pass('template 依赖');

assert.equal(judgeFonts(REQUIRED_FONTS).ok, true);
const missingFont = judgeFonts(REQUIRED_FONTS.filter((name) => name !== 'CascadiaMono.ttf'));
assert.equal(missingFont.ok, false);
assert.match(missingFont.detail, /CascadiaMono\.ttf/);
pass('字体');

assert.equal(judgeBrowser({skipped: false, code: 0, timedOut: false}).ok, true);
assert.equal(judgeBrowser({skipped: false, code: 1, timedOut: false}).ok, false);
assert.match(judgeBrowser({skipped: false, code: 1, timedOut: true}).fix, /上网/);
assert.match(judgeBrowser({skipped: true, code: 1, timedOut: false}).fix, /npm ci/);
pass('浏览器');

assert.equal(judgeFfmpeg({skipped: false, code: 0, output: 'ffmpeg version 6.0'}).ok, true);
assert.equal(judgeFfmpeg({skipped: false, code: 0, output: 'hello'}).ok, false);
assert.equal(judgeFfmpeg({skipped: false, code: 1, output: 'ffmpeg version 6.0'}).ok, false);
assert.match(judgeFfmpeg({skipped: true, code: 1, output: ''}).fix, /npm ci/);
pass('ffmpeg');

const noPython = judgePythonProbe({error: 'spawn python ENOENT', status: null});
assert.equal(noPython.ok, false);
assert.equal(noPython.kind, 'no-python');
assert.match(noPython.message, /不是静音交付/);
assert.match(noPython.message, /requirements\.txt/);
const noDeps = judgePythonProbe({status: 1, stderr: "ModuleNotFoundError: No module named 'numpy'"});
assert.equal(noDeps.kind, 'no-deps');
assert.match(judgePython(noDeps).fix, /可选项/);
assert.equal(judgePython(noPython).required, false);
assert.equal(judgePython({ok: true, kind: 'ready'}).ok, true);
const silent = judgeBgmRun({status: 1, error: 'spawn python ENOENT', fileExists: false}, {hasVoice: false});
assert.match(silent.message, /无声画面/);
assert.doesNotMatch(silent.message, /配音仍在/);
const generated = judgeBgmRun({status: 0, fileExists: true});
assert.equal(generated.ok, true);
const leakedPath = ['C', ':', '\\', 'Users', '\\', 'someone', '\\', 'Temp', '\\', 'bgm-x'].join('');
const leaked = judgeBgmRun({status: 1, stderr: `failed at ${leakedPath}`, fileExists: false});
assert.equal(leaked.message.includes(leakedPath), false);
assert.match(leaked.message, /本地路径/);
assert.match(skippedByFlag(true), /--no-bgm/);
const missingBin = probePythonBgm('python-does-not-exist-t12');
assert.equal(missingBin.kind, 'no-python');
pass('配乐可选项');

const fakeKey = ['sk', 'do-not-print-this-value'].join('-');
assert.throws(() => judgeApiKey('MINIMAX_API_KEY', fakeKey), TypeError);
const setKey = judgeApiKey('DEEPSEEK_API_KEY', true);
const missingKey = judgeApiKey('MINIMAX_API_KEY', false);
assert.equal(setKey.ok, true);
assert.equal(missingKey.ok, false);
assert.equal(missingKey.required, true);
assert.doesNotMatch(JSON.stringify(setKey) + formatReport([setKey, missingKey]), /sk-do-not-print/);
assert.match(formatReport([setKey]), /已设置（内容不显示）/);
assert.match(formatReport([missingKey]), /未设置/);
pass('密钥只说有没有');

const cwd = path.join(os.tmpdir(), 'brewreel-user');
const root = path.join(cwd, 'app');
assert.equal(defaultDataDir(cwd), path.resolve(cwd, '..', 'brewreel-studio-data'));
assert.equal(defaultOutDir(cwd), path.resolve(cwd, '..', 'brewreel-studio-out'));
assert.equal(resolveDataDir(undefined, {LESSON_DATA_DIR: 'my-data'}, cwd), path.resolve(cwd, 'my-data'));
assert.equal(resolveOutDir('films', {}, cwd), path.resolve(cwd, 'films'));
assert.equal(isInsideRepo(path.join(root, 'out'), root), true);
assert.equal(isInsideRepo(path.resolve(root, '..', 'brewreel-studio-out'), root), false);
assert.equal(showPath(path.resolve(cwd, '..', 'brewreel-studio-out'), cwd).includes('brewreel-studio-out'), true);
assert.equal(judgeDir({id: 'data-dir', title: '数据目录', shown: '..\\brewreel-studio-data', writable: true, inside: false}).ok, true);
assert.equal(judgeDir({id: 'out-dir', title: '出片目录', shown: 'out', writable: true, inside: true}).ok, false);
assert.equal(judgeDir({id: 'out-dir', title: '出片目录', shown: 'out', writable: false, inside: false}).ok, false);
pass('目录跟着工作目录');

assert.equal(judgeDisk([{label: '出片目录', bytes: 2 * 1024 ** 3}]).ok, true);
assert.equal(judgeDisk([{label: '出片目录', bytes: 200 * 1024 ** 2}]).ok, false);
assert.equal(judgeDisk([{label: '出片目录', bytes: Number.NaN}]).ok, false);
pass('磁盘空间');

const requiredFail = [judgeNode('v18.0.0'), missingKey];
assert.equal(exitCode(requiredFail), 1);
const optionalFail = [judgeNode('v18.0.0'), judgePython(noPython)];
assert.equal(exitCode(optionalFail), 0);
assert.match(formatReport(optionalFail), /必需项都通过/);
assert.match(formatReport(requiredFail), /有必需项没通过/);
pass('退出码');

console.log('test-doctor：通过');
