// ============================================================
// 分镜 JSON 格式（storyboard.json）—— 便宜模型只写这一份文件
//
// 原则：模型只做「选择」和「填字」。
//   - 不写坐标、不算帧、不排音效、不写代码。
//   - 每镜的开始时间、转场、音效卡点，由排程器（core/timeline.ts）和各镜头的
//     spec.json 自动算出来。
//   - 所有规则由 scripts/validate.mjs 拦截，报错会写清「第几镜 哪个字段 / 问题 / 怎么改」。
//
// 最小例子：
// {
//   "meta": {"title": "Jev 宣传片", "product": "Jev 聊天助手", "theme": "warm-emotion"},
//   "shots": [
//     {"type": "hook", "dur": 3, "caption": "对象说{“你不懂我”}，\n你怎么回？", "mood": 0.85,
//      "params": {"visual": "bubble", "text": "你根本就不懂我", "sub": "危险信号", "badge": "AI 先帮你看一眼"}},
//     ...,
//     {"type": "endCard", "dur": 4, "mood": 0, "params": {"brand": "Jev 聊天助手", "slogan": "回消息之前，\n{先看懂对方}"}}
//   ]
// }
// ============================================================

/** 主题预设名（颜色定义在 core/themes.json） */
export type ThemeName = keyof typeof import('./core/themes.json');

/** 行业（决定读哪个 industries/<name>/rules.json；默认 software，即第一阶段的软件产品片） */
export type IndustryName = 'software' | 'food' | 'ecommerce' | 'education' | 'beauty' | 'travel' | 'general';

/** 字幕/文档语言。lang=en 时字幕出英文，文档给中英两版 */
export type Lang = 'zh' | 'en';

/** 发布平台（决定 cta 预设值、平台专属规则覆盖层）。generic = 不挂具体平台 */
export type Platform = 'douyin' | 'shipinhao' | 'generic';

/** 一条事实/数据来源：id 给 refs 字段指认，text 是原话（照抄简报，不能自己编） */
export type Fact = {
  id: string;
  text: string;
  /** 简报里写的来源（必填），如「2026-09 价目表」；简报没写就写「简报未注明来源」，不许自己编 */
  source: string;
  /** 可选：简报里的原句，逐字照抄（传了 --brief 时会核对） */
  quote?: string;
};

/**
 * 素材清单的一条（meta.assets）：photoShot、beforeAfter、storeCard.photo 用到的每个文件都要登记。
 * source：merchant = 商家实拍；illustration = 插画/示意；screenshot = 软件截图（不能放进 photoShot）。
 * kind / pair：beforeAfter 的两张要登记为 merchant，kind 分别是 customer-before / customer-after，pair 相同。
 */
export type AssetEntry = {
  src: string;
  source: 'merchant' | 'illustration' | 'screenshot';
  kind?: string;
  pair?: string;
};

/** 镜头类型（每种对应 src/shots/<type>.tsx + <type>.spec.json） */
export type ShotType =
  | 'hook' // 首帧钩子（必须是第 1 镜）
  | 'chat' // 模拟聊天
  | 'phone' // 手机框 + 真截图/录屏 + 圈注
  | 'mockApp' // 没截图时的模拟界面
  | 'meter' // 仪表 / 评分
  | 'compare' // 左右或前后对比
  | 'counter' // 大数字滚动
  | 'dataChart' // 数据叙事：结论、KPI、图表、旁注与来源
  | 'features' // 2–4 个卖点卡
  | 'steps' // 1-2-3 流程
  | 'quickList' // 快切列表
  | 'endCard' // 片尾
  | 'custom'; // 自由镜头。便宜模型不要用 custom。只有本地强模型自己写组件时才用，见 docs/custom-shot.md

export type Meta = {
  /** 片名（只用于文件名和日志，不上画面） */
  title: string;
  /** 产品名（片尾 endCard.params.brand 必须和它一字不差，≤10 字） */
  product: string;
  /** 节拍速度，默认 120（一拍 0.5 秒）。允许 90–150 */
  bpm?: number;
  /** 主题预设名（cards 风格：core/themes.json 的 6 套；其他风格：该风格 style.json 的 themes，可不写） */
  theme: ThemeName | (string & {});
  /** 视觉风格（template/src/styles/<id>/ + styles/<id>/），不写 = "cards"（渐变底 + 卡片 + 描边大字幕） */
  style?: string;
  /** 画幅：9:16（1080x1920）/ 4:5（1080x1350）。不写用风格默认；cards 只支持 9:16 */
  aspect?: '9:16' | '4:5';
  /** 品牌色，#RRGGBB。只替换主题的「强调色」（按钮、我方气泡、图标、进度条） */
  brandColor?: string;
  /** 免责小字，≤16 字，如「演示场景，对话为模拟」。有演示镜头时只出现在那些镜头上，否则全片显示 */
  disclaimer?: string;
  /** logo 图片路径（相对 storyboard.json 所在目录），png/jpg/webp，建议透明底方图 */
  logo?: string;
  /** 获取方式：原样照抄简报「获取方式」那一栏（≤12 字）；endCard.params.cta 必须等于它。简报没写就不填，片尾也不放 cta */
  cta?: string;
  /** 《广告法》极限词 / 平台品类词豁免清单：确有依据时把词写进来（如产品本身做公众号排版就写「公众号」），校验就不再拦它 */
  allowWords?: string[];
  /**
   * 简报「数字和来源」栏，每条一个 id + 原话。画面上的数字、sub 里的来源、credCard.creds 等只能来自这里；
   * 镜头用 params.refs（字符串数组）按 id 引用某条，校验查 id 存不存在、内容有没有照抄。
   * 2026-09 起从纯字符串数组改成 {id,text}[]（给 refs 一个可指认的 id）；旧的纯字符串数组分镜要迁移。
   */
  facts?: Fact[];
  /** 行业（决定读哪个 industries/<name>/rules.json 校验；不写按 software 处理。general 只跑 _base 通用广告法，不是第七个行业包，见 SKILL.md「产品不在六个行业里」） */
  industry?: IndustryName;
  /** 字幕/文档语言；不写按 zh 处理。lang=en 时字幕出英文，其余文案仍按 industry 的中文规则核对（先出片，翻译校验后补） */
  lang?: Lang;
  /** 发布平台；不写按 generic 处理。决定 cta 预设值和平台专属规则覆盖层（industries/<industry>/rules.json 的 platform 段） */
  platform?: Platform;
  /** 底部常驻提示条（如「以团购详情页为准」），和 disclaimer 分开显示；不写就不显示。哪些是必备提示语由行业规则的 requiredNotices 决定 */
  notices?: string[];
  /** 核心动作一句话（简报第 5 栏「用户做什么 → 产品给出什么」），给校验和行业规则核对「有没有演示到」用，不上画面 */
  action?: string;
  /** 总时长允许范围 [min, max]（秒），覆盖默认的 15–45 秒；不写就用默认范围 */
  durationRange?: [number, number];
  /** 行业子品类（如 food 的 "hotpot"），决定 industries/<industry>/rules.json 的 sub 层覆盖规则是否生效；不写就不叠加子层 */
  subCategory?: string;
  /** 是否挂了团购/优惠链接（抖音团购、视频号小商店等），决定 mediaPolicy/compareHasBasis 等按 when 条件生效的规则；不写按 false 处理 */
  attachDeal?: boolean;
  /** 界面里的数字是示例（简报没给真数据）。写 true 时 disclaimer 必须带「演示/示例」；示例数字只能出现在演示界面和价格条款里，不能当效果说法 */
  demoData?: boolean;
  /** 素材清单：照片/截图/插画文件各自的来源，见 AssetEntry */
  assets?: AssetEntry[];
  /** 配音。不写 = 不配音（和以前完全一样）；写了之后各镜的 vo（旁白）会被合成、按声音定镜头时长，见 VoiceSetting */
  voice?: VoiceSetting;
  /** 可选微调。不写时排程、字号、字体和现在完全一样，见 Tweak */
  tweak?: Tweak;
};

/** 整片微调。每一项都可以不写。不写 meta.tweak 时，出片和没这个字段时逐像素一致。 */
export type Tweak = {
  /** 整体节奏。slow 拍长 ×1.15，normal 不乘（和不写一样），fast ×0.88。镜头最短、最长时长照样生效 */
  pace?: 'slow' | 'normal' | 'fast';
  /** 字幕带、片尾大字、hook 主视觉大字的缩放，0.9–1.15。不写或 1 等于不缩放 */
  textScale?: number;
  /** 标题和大字的字体。sans = Noto Sans SC（默认，和不写一样），serif = BrewReel Serif，kai = BrewReel Kai */
  headingFont?: 'sans' | 'serif' | 'kai';
};

/** 配音提供者：minimax = MiniMax（要环境变量 MINIMAX_API_KEY）；aliyun = 阿里云百炼 CosyVoice（要 DASHSCOPE_API_KEY）；
 *  volcengine = 火山引擎豆包语音（要 VOLCENGINE_TTS_API_KEY）；mock = 不联网的占位音（按字数生成音节脉冲，先听节奏用） */
export type VoiceProvider = 'minimax' | 'aliyun' | 'volcengine' | 'mock';
/** 旁白字幕：karaoke = 逐字高亮；line = 整句（分页）出现；off = 不出旁白字幕（只念） */
export type SubtitleMode = 'karaoke' | 'line' | 'off';
export type VoiceEmotion = 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm' | 'fluent' | 'whisper';

/** meta.voice：模型只写这几项，其余由 make.mjs 算 */
export type VoiceSetting = {
  provider: VoiceProvider;
  /** 音色 id；不写用默认（中文「Chinese (Mandarin)_Male_Announcer」） */
  voiceId?: string;
  /** 语速 0.5–2，默认 1；广告旁白一般 1–1.15 */
  speed?: number;
  /** 情绪；不写用音色默认。广告旁白建议 calm / fluent */
  emotion?: VoiceEmotion;
  /** 模型，默认 speech-2.8-hd（turbo 便宜约四成） */
  model?: string;
  /** 旁白字幕，默认 karaoke。镜头自己写了 caption 时照旧显示 caption，旁白只念 */
  subtitles?: SubtitleMode;
};

// ---------------- 以下由 make.mjs 生成（voice.json，作为 props.voice 传进来），模型不要写 ----------------
/** 一个念读单位：中文一个汉字、拉丁一个词。text 是旁白（去掉 {}）的连续切片，含后面粘着的标点和空格，顺序拼起来就是整句 */
export type VoiceWord = {
  text: string;
  /** 相对这句音频开头的毫秒（镜头内时间 = line.startMs + startMs） */
  startMs: number;
  endMs: number;
  /** 在 vo 的 {} 里（强调） */
  hot?: boolean;
};
/** 字幕的一页（最多 2 行，每行 ≤12 个汉字 / 英文 ≤22 字符），text 带 {} 和 \n，可以直接交给字幕组件；时间同 VoiceWord */
export type VoicePage = {text: string; from: number; to: number; startMs: number; endMs: number};
export type VoiceLine = {
  /** 镜头下标（从 0 数） */
  shot: number;
  /** 旁白原文（含 {} 强调） */
  text: string;
  /** public 下的音频路径，staticFile(src) */
  src: string;
  /** 相对镜头起点的开口时间（毫秒，固定前留白 150） */
  startMs: number;
  /** 音频时长（毫秒） */
  durMs: number;
  words: VoiceWord[];
  /** 时间戳来源：char / word = 接口（或 mock）给的逐字 / 逐词时间；sentence-interp = 只有句级，字级按字数与标点估算 */
  granularity: 'char' | 'word' | 'sentence-interp';
  /** 以下为便利字段：镜头起点、开口时刻（相对整片，毫秒） */
  shotStartMs?: number;
  absStartMs?: number;
  /** 这一句要不要出旁白字幕：meta.voice.subtitles 为 off 时一律 false；cards 字幕带（及 captionLayer=cards 的风格）
   *  另外在这一镜写了 caption、或镜头本身 caption:none（endCard）时为 false；quiz / journey 自己画字幕条，其余都是 true */
  subtitle?: boolean;
  pages?: VoicePage[];
};
export type VoiceTrack = {
  provider: VoiceProvider;
  voiceId: string;
  model?: string;
  speed?: number;
  emotion?: VoiceEmotion | null;
  lang?: Lang;
  subtitles?: SubtitleMode;
  /** 配音改写镜头时长之后的整片时长（毫秒） */
  totalMs: number;
  /** 所有旁白加起来的时长（毫秒） */
  voiceMs?: number;
  /** 配乐闪避参数。baked = true：make_bgm.py 已经把闪避做进 bgm.wav，组件不要再压 bgm 音量；false 时组件可以按这组参数自己压 */
  duck: {db: number; attackMs: number; releaseMs: number; baked?: boolean};
  lines: VoiceLine[];
};

export type Shot = {
  /** 镜头类型 */
  type: ShotType;
  /** 时长（秒）。和 beats 二选一；都不写就用该镜头 spec 的默认时长。会自动吸附到整拍 */
  dur?: number;
  /** 时长（拍）。120 BPM 时 1 拍 = 0.5 秒 */
  beats?: number;
  /**
   * 抖音式大字幕。{} 里的字用强调色（每条最多 1 处）；\n 换行；最多 2 行，每行 ≤12 个汉字（拉丁字母算半个）。
   * hook 必填（就是封面大标题）；endCard 不要写（片尾大字写在 params.slogan）。
   * 长镜头（同一句会停超过 5 秒）写成 2–3 句的数组，按拍平分这一镜，如 ["先别急着发…", "挑一条填进输入框…"]。
   */
  caption?: string | string[];
  /** 情绪 0..1：0 = 平静/正向（冷色），0.5 = 留神，1 = 紧张/痛点（暖红）。背景渐变随它过渡 */
  mood?: number;
  /** 镜头参数，字段见 shots.md / 各 <type>.spec.json */
  params: Record<string, unknown>;
  /** 给人看的备注，不上画面 */
  note?: string;
  /**
   * 自由镜头（type=custom）的组件，相对 storyboard.json：`shots/名字.tsx`。
   * 文件放在片子目录，不放进 template/。便宜模型不要用 custom。
   */
  component?: string;
  /** 自由镜头上屏的文字和数字。组件里不能写死句子，只能读这里 */
  slots?: Record<string, unknown>;
  /**
   * 旁白（配音时念的话，meta.voice 开了才生效）。可含 {} 强调；不写 caption 时旁白字幕由它自动生成。
   * 写了 vo 的镜头时长由配音决定（前后留白后取整拍），dur / beats 会被 make.mjs 改写。
   */
  vo?: string;
  /**
   * 这一镜的背景图，相对 storyboard.json 所在目录的 png/jpg/webp。
   * 出片时盖在渐变上面并压暗，保证字看得清。没在 meta.assets 登记为 merchant 时，画面文字不能写「实拍」。
   */
  bg?: string;
};

export type Storyboard = {
  meta: Meta;
  shots: Shot[];
  /** 以下由 make.mjs 自动填写，模型不要写 */
  bgm?: string; // public 下的配乐路径，如 _run/<id>/bgm.wav
  voice?: VoiceTrack; // 配音轨（voice.json）；没配音时没有这个字段
};
