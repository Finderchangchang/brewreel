import type React from 'react';
import type {Geometry} from '../core/safe';
import type {Slot} from '../core/timeline';
import type {ShotModule, ShotSpec} from '../core/types';
import type {Storyboard} from '../schema';

// ============================================================
// 风格包接口（写新风格的人只需要看这个文件 + styles/_template/README.md）。
//
// 一个风格 = 两个文件夹：
//   styles/<id>/                 给人和模型看：STYLE.md、recipes.md、rules.json、checks.mjs（可选）、examples/
//   template/src/styles/<id>/    代码：style.json（清单）、tokens.json（设计令牌）、index.ts、shots/<type>.tsx + .spec.json
// 注册：node scripts/gen-styles.mjs（扫描 template/src/styles/*/style.json，生成 registry.gen.ts 和各风格的 shots/index.gen.ts）
// ============================================================

/** template/src/styles/<id>/style.json：风格清单。校验（scripts/lib/styles.mjs）和渲染都读它 */
export type StyleManifest = {
  id: string;
  name: {zh: string; en: string};
  /** 一句话：适合什么产品（SKILL.md 选风格时给模型看） */
  summary: {zh: string; en: string};
  /** stable = 可交付；draft / skeleton = 开发中，校验会拦（设环境变量 PROMO_DEV_STYLES=1 才放行，给风格负责人自测） */
  status: 'stable' | 'draft' | 'skeleton';
  /** 默认画幅（meta.aspect 不写时用它） */
  defaultAspect: string;
  /** 本风格支持的画幅（core/aspects.json 里的名字） */
  aspects: string[];
  /** 默认节拍（meta.bpm 不写时用它） */
  bpm: number;
  /** 可复用的公共镜头（template/src/shots/ 里的类型）："*" = 全部；[] = 一个不用。公共镜头只按 9:16 设计，别的画幅不能用 */
  commonShots: string[] | '*';
  /** 第 1 镜必须是哪种镜头（第 0 帧要有钩子）；null = 不限制 */
  firstShot: string | null;
  /** 最后一镜必须是哪种镜头；null = 不限制 */
  lastShot: string | null;
  /** cards = 用全局字幕带（caption 字段画在 y260–540）；none = 本风格自己排字，镜头的 caption 一律不许写 */
  captionLayer: 'cards' | 'none';
  /** 是否要求至少一镜演示 meta.action；demoShots 列出本风格里算「演示」的专属镜头 */
  requireDemo?: boolean;
  demoShots?: string[];
  /** 本风格的配色方案名（tokens.json 的 themes 键）；meta.theme 从这里选，不写用 defaultTheme。cards 风格用 core/themes.json */
  themes?: string[];
  defaultTheme?: string;
  /** 负责人（GitHub 用户名），给 PR 评审找人用 */
  owners?: string[];
};

export type ShotEntry = {mod: ShotModule; spec: ShotSpec};

/** 整片渲染器 / 背景层 / 覆盖层拿到的东西 */
export type FilmProps = {
  sb: Storyboard;
  /** 排好的镜头（开始/时长/情绪，秒） */
  slots: Slot[];
  /** 一拍秒数 */
  beat: number;
  /** 当前画幅几何（宽高、安全区） */
  geo: Geometry;
};

export type StyleDef = {
  manifest: StyleManifest;
  /** 设计令牌（色板、字体、字号层级、间距、动效预设、节奏）。组件用 useStyleTokens() 取 */
  tokens: Record<string, any>;
  /** 本风格专属镜头（shots/index.gen.ts 生成的 SHOTS） */
  shots: Record<string, ShotEntry>;
  /** 可选：整片渲染器（一镜到底的风格用它自己画全片；不给就逐镜 Sequence + 默认推出转场） */
  Film?: React.FC<FilmProps>;
  /** 可选：垫在镜头下面的背景层（全片常驻） */
  Background?: React.FC<FilmProps>;
  /** 可选：盖在镜头上面的层（本风格自己的字幕系统、HUD、转场） */
  Overlay?: React.FC<FilmProps>;
  /** 可选：复用公共镜头时，给它们用的 cards 主题（base = core/themes.json 的名字，override 覆盖个别颜色） */
  cardsTheme?: {base: string; override?: Record<string, unknown>};
};

export const defineStyle = (d: StyleDef): StyleDef => d;
