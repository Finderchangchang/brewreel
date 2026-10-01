#!/usr/bin/env node
// 隐私扫描新规则的正反例。样本在运行时拼出来，源码里不放能被扫中的密钥或盘符路径。
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scanText} from './privacy-scan.mjs';

const none = [];
const named = (hits, name) => hits.filter((h) => h.rule === name);

test('带短横的 sk key 命中，太短的不命中', () => {
  const key = 'sk-' + 'cp-' + 'abcdEFGH1234ijklMNOP';
  const hits = scanText('mem', `token ${key} end`, none);
  assert.ok(named(hits, 'OpenAI 风格 key').some((h) => h.match === key));
  const short = 'sk-' + 'short';
  const miss = scanText('mem', `token ${short} end`, none);
  assert.equal(named(miss, 'OpenAI 风格 key').length, 0);
});

test('API_KEY 赋值命中，光写名字或值太短不命中', () => {
  const line = 'MINIMAX_' + 'API_KEY=' + 'abcdefgh';
  const hits = scanText('mem', line, none);
  assert.equal(named(hits, '环境变量 key 赋值').length, 1);
  const bare = scanText('mem', 'docs mention API_KEY only', none);
  assert.equal(named(bare, '环境变量 key 赋值').length, 0);
  const short = scanText('mem', 'MINIMAX_' + 'API_KEY=' + 'abc', none);
  assert.equal(named(short, '环境变量 key 赋值').length, 0);
  const quoted = scanText('mem', 'MINIMAX_' + 'API_KEY=' + "'dummyval'", none);
  assert.equal(named(quoted, '环境变量 key 赋值').length, 0);
  const colon = scanText('mem', 'MINIMAX_' + 'API_KEY: ' + "'dummyval'", none);
  assert.equal(named(colon, '环境变量 key 赋值').length, 0);
});

test('JSON 转义的 Windows 路径和中文路径命中，没有斜杠的盘符不命中', () => {
  const drive = 'H';
  const escaped = drive + ':' + '\\'.repeat(2) + '助理！！' + '\\'.repeat(2) + 'notes.md';
  const chinese = drive + ':' + '\\' + '助理！！' + '\\' + 'notes.md';
  const escHits = scanText('mem', '{"p":"' + escaped + '"}', none);
  assert.ok(named(escHits, '本机路径-Windows').length >= 1, escaped);
  const zhHits = scanText('mem', chinese, none);
  assert.ok(named(zhHits, '本机路径-Windows').length >= 1);
  const neg = scanText('mem', drive + ':' + ' noslash', none);
  assert.equal(named(neg, '本机路径-Windows').length, 0);
  const words = scanText('mem', '助理！！' + '\\' + 'notes.md', none);
  assert.equal(named(words, '本机路径-Windows').length, 0);
});

test('禁词黑名单不区分大小写，别的词不命中', () => {
  const rules = [{name: 'denylist: DenylistProbe', re: new RegExp('DenylistProbe', 'gi')}];
  const hits = scanText('mem', 'xx denylistprobe yy', rules);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].match.toLowerCase(), 'denylistprobe');
  const miss = scanText('mem', 'xx otherword yy', rules);
  assert.equal(miss.length, 0);
});
