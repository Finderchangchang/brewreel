import type React from 'react';
import type {Meta, IndustryName, Fact} from '../schema';

// ============================================================
// 镜头接口（写镜头的人只需要看这个文件 + SHOT_API.md）
// ============================================================

/** 镜头组件收到的 props */
export type ShotProps<P = Record<string, any>> = {
  /** 分镜里的 params（已通过校验；可选字段可能缺省，组件自己给默认值） */
  params: P;
  /** 镜头内时间（秒），0 = 本镜开始。本镜结束后还有 0.35 秒退场尾巴（t > dur），由外层做推出动画 */
  t: number;
  /** 本镜时长（秒，已吸附到整拍） */
  dur: number;
  /** 一拍的秒数（120 BPM = 0.5） */
  beat: number;
  /** 第几镜（0 起） */
  index: number;
  /** 是否最后一镜 */
  isLast: boolean;
  /** 本镜字幕（全局层已经画了，镜头一般不用管） */
  caption?: string | string[];
  /** 本镜情绪 0..1 */
  mood: number;
  /** 片子的 meta（logo 已改写成 public 下可直接 staticFile 的路径） */
  meta: Meta;
};

/** 音效卡点（相对本镜开始的秒数） */
export type SfxCue = {at: number; kind: string; vol?: number};

/** 算音效时拿到的上下文 */
export type SfxCtx = {dur: number; beat: number};

/** JSON Schema 风格的参数描述（validate.mjs 支持的子集） */
export type ParamSchema = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description?: string;
  /** 字符串：最大字数（汉字 1、拉丁半个） */
  maxLen?: number;
  /** 字符串：最少字数 */
  minLen?: number;
  /**
   * 字符串格式：asset = 素材文件路径；icon = 图标名（core/icons.json，28 个中性线条图标）；
   * illust = 行业插画名（"<industry>/<name>"，见 template/src/illust/names.json，steps/features/quickList 挂插画兜底时用）；
   * color = #RRGGBB；caption = 可含 {} 和 \n 的强调文字；
   * note = 不上屏的说明字段（如 evidence、素材来源描述）：只查字数，不扫网址/极限词，不限制 {} 和换行，也不用于「照抄样例」比对
   */
  format?: 'asset' | 'icon' | 'illust' | 'color' | 'caption' | 'note';
  /** asset 允许的扩展名 */
  accept?: string[];
  /** caption 格式的最大行数 */
  maxLines?: number;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  properties?: Record<string, ParamSchema>;
  required?: string[];
  items?: ParamSchema;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
};

/** <type>.spec.json 的结构（注册表和校验共用的单一来源） */
export type ShotSpec = {
  type: string;
  /** 用途一句话（给模型选镜头用） */
  purpose: string;
  /** 什么时候用、怎么写好（给模型看的提示） */
  tips?: string[];
  /** 时长（秒）：默认 / 最小 / 最大 */
  dur: {default: number; min: number; max: number};
  /** 默认情绪 */
  mood?: number;
  /** 字幕：required 必填 / optional 可选 / none 不许写 */
  caption: 'required' | 'optional' | 'none';
  /** 退场方式：push 向左推出（默认）/ fade 淡出 / none 不退场（片尾） */
  exit?: 'push' | 'fade' | 'none';
  /** params 描述 */
  params: ParamSchema;
  /** 静态音效卡点（镜头模块导出 sfx() 时以函数为准） */
  sfx: SfxCue[];
  /** 示例（ShotLab 自测和文档都用它） */
  example: {
    caption?: string | string[];
    mood?: number;
    dur?: number;
    params: Record<string, unknown>;
    /** 这个镜头只在某些行业开放时，自检（--specs）用这个行业身份跑示例；缺省 software */
    industry?: IndustryName;
    /** 镜头示例所需的数据来源及演示标记（供 spec 自检正确验证来源） */
    facts?: Fact[];
    demoData?: boolean;
    disclaimer?: string;
  };
};

/** 镜头模块：src/shots/<type>.tsx 的导出 */
export type ShotModule = {
  default: React.FC<ShotProps<any>>;
  /** 可选：按参数动态生成音效（例如每条消息一个 pop）。不导出则用 spec.sfx */
  sfx?: (params: any, ctx: SfxCtx) => SfxCue[];
};
