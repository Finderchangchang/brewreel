// ============================================================
// 镜头注册表（12 个软件通用镜头 + 7 个共享行业镜头；见 docs/dev/industry-design.md 第 1 节）。
// 每个镜头 = <type>.tsx（default 导出组件，可选导出 sfx()）+ <type>.spec.json（单一来源，validate.mjs 也读）。
// 写新镜头只改自己的两个文件，加完了在这里补一行 import + 一行 REG 注册（新镜头不多，改这里没关系）。
// ============================================================
import type {ShotModule, ShotSpec} from '../core/types';

import * as hook from './hook';
import hookSpec from './hook.spec.json';
import * as chat from './chat';
import chatSpec from './chat.spec.json';
import * as phone from './phone';
import phoneSpec from './phone.spec.json';
import * as mockApp from './mockApp';
import mockAppSpec from './mockApp.spec.json';
import * as meter from './meter';
import meterSpec from './meter.spec.json';
import * as compare from './compare';
import compareSpec from './compare.spec.json';
import * as counter from './counter';
import counterSpec from './counter.spec.json';
import * as dataChart from './dataChart';
import dataChartSpec from './dataChart.spec.json';
import * as features from './features';
import featuresSpec from './features.spec.json';
import * as steps from './steps';
import stepsSpec from './steps.spec.json';
import * as quickList from './quickList';
import quickListSpec from './quickList.spec.json';
import * as endCard from './endCard';
import endCardSpec from './endCard.spec.json';
// 行业扩展（2026-09，第二阶段）：7 个共享新镜头，先是占位实现，spec 是草稿（docs/dev/industry-design.md 第 1 节）
import * as photoShot from './photoShot';
import photoShotSpec from './photoShot.spec.json';
import * as priceCard from './priceCard';
import priceCardSpec from './priceCard.spec.json';
import * as storeCard from './storeCard';
import storeCardSpec from './storeCard.spec.json';
import * as reviewCard from './reviewCard';
import reviewCardSpec from './reviewCard.spec.json';
import * as factSheet from './factSheet';
import factSheetSpec from './factSheet.spec.json';
import * as credCard from './credCard';
import credCardSpec from './credCard.spec.json';
import * as beforeAfter from './beforeAfter';
import beforeAfterSpec from './beforeAfter.spec.json';

const REG: Record<string, {mod: ShotModule; spec: ShotSpec}> = {
  hook: {mod: hook as ShotModule, spec: hookSpec as unknown as ShotSpec},
  chat: {mod: chat as ShotModule, spec: chatSpec as unknown as ShotSpec},
  phone: {mod: phone as ShotModule, spec: phoneSpec as unknown as ShotSpec},
  mockApp: {mod: mockApp as ShotModule, spec: mockAppSpec as unknown as ShotSpec},
  meter: {mod: meter as ShotModule, spec: meterSpec as unknown as ShotSpec},
  compare: {mod: compare as ShotModule, spec: compareSpec as unknown as ShotSpec},
  counter: {mod: counter as ShotModule, spec: counterSpec as unknown as ShotSpec},
  dataChart: {mod: dataChart as ShotModule, spec: dataChartSpec as unknown as ShotSpec},
  features: {mod: features as ShotModule, spec: featuresSpec as unknown as ShotSpec},
  steps: {mod: steps as ShotModule, spec: stepsSpec as unknown as ShotSpec},
  quickList: {mod: quickList as ShotModule, spec: quickListSpec as unknown as ShotSpec},
  endCard: {mod: endCard as ShotModule, spec: endCardSpec as unknown as ShotSpec},
  photoShot: {mod: photoShot as ShotModule, spec: photoShotSpec as unknown as ShotSpec},
  priceCard: {mod: priceCard as ShotModule, spec: priceCardSpec as unknown as ShotSpec},
  storeCard: {mod: storeCard as ShotModule, spec: storeCardSpec as unknown as ShotSpec},
  reviewCard: {mod: reviewCard as ShotModule, spec: reviewCardSpec as unknown as ShotSpec},
  factSheet: {mod: factSheet as ShotModule, spec: factSheetSpec as unknown as ShotSpec},
  credCard: {mod: credCard as ShotModule, spec: credCardSpec as unknown as ShotSpec},
  beforeAfter: {mod: beforeAfter as ShotModule, spec: beforeAfterSpec as unknown as ShotSpec},
};

export const SHOT_TYPES = Object.keys(REG);
export const moduleOf = (type: string): ShotModule | undefined => REG[type]?.mod;
export const specOf = (type: string): ShotSpec | undefined => REG[type]?.spec;
