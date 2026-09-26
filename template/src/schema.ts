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
export type ThemeName = 'warm-emotion' | 'tech-dark' | 'fresh-light' | 'business-blue' | 'festival-red' | 'mono-premium';

/** 行业（决定读哪个 industries/<name>/rules.json；默认 software，即第一阶段的软件产品片） */
export type IndustryName = 'software' | 'food' | 'ecommerce' | 'education' | 'beauty' | 'travel';

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
  | 'features' // 2–4 个卖点卡
  | 'steps' // 1-2-3 流程
  | 'quickList' // 快切列表
  | 'endCard'; // 片尾

export type Meta = {
  /** 片名（只用于文件名和日志，不上画面） */
  title: string;
  /** 产品名（片尾 endCard.params.brand 必须和它一字不差，≤10 字） */
  product: string;
  /** 节拍速度，默认 120（一拍 0.5 秒）。允许 90–150 */
  bpm?: number;
  /** 主题预设名 */
  theme: ThemeName;
  /** 品牌色，#RRGGBB。只替换主题的「强调色」（按钮、我方气泡、图标、进度条） */
  brandColor?: string;
  /** 角落常驻免责小字，≤16 字，如「演示场景，对话为模拟」 */
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
  /** 行业（决定读哪个 industries/<name>/rules.json 校验；不写按 software 处理，第一阶段的软件产品片不受影响 */
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
};

export type Storyboard = {
  meta: Meta;
  shots: Shot[];
  /** 以下由 make.mjs 自动填写，模型不要写 */
  bgm?: string; // public 下的配乐路径，如 _run/<id>/bgm.wav
};
