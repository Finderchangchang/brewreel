# 写一个镜头需要知道的一切

读完这一页就能动手。参考实现：`src/shots/hook.tsx`、`chat.tsx`、`endCard.tsx`（质量标尺）。

## 1. 你只改这三个文件

| 文件 | 内容 |
|---|---|
| `template/src/shots/<type>.tsx` | 组件（`export default`），可选导出 `sfx()` |
| `template/src/shots/<type>.spec.json` | 规格：参数、时长范围、音效、示例。**注册表和校验都读它，是唯一来源** |
| `docs/shots/<type>.md` | 给模型看的镜头说明（何时用、参数怎么写、好/坏例子） |

不要改 `src/shots/index.ts`（11 个已经注册好）、`src/core/*`、`scripts/*`。缺公共能力就在交接里提，别自己在 core 里加。

## 2. 组件签名

```tsx
import type {ShotProps, SfxCue} from '../core/types';
type P = {value: number; label: string /* …与 spec.params 对应 */};

const Meter: React.FC<ShotProps<P>> = ({params, t, dur, beat, index, isLast, mood, meta}) => { … };
export default Meter;

// 可选：音效跟参数走时导出（例如每行一个 pop）。不导出就用 spec.sfx
export const sfx = (p: P, ctx: {dur: number; beat: number}): SfxCue[] => [{at: 0.3, kind: 'swish', vol: 0.22}];
```

- `t`：**镜头内秒数**，0 = 本镜开始。所有动画都用 `t` 算，不要用 `useCurrentFrame()` 自己换算。
- `dur`：本镜时长（秒，已吸附整拍）。本镜结束后还有 4 帧退场尾巴（`t > dur`），外层统一做「4 帧内淡出 + 下移」（`exit: none` 不退场）；下一镜在旧镜淡出一半（第 2 帧）后才显形，第 4 帧完全出来，两镜的卡片不会叠在一起。你不用管。
- 布局自查：make.mjs 渲染时会量出每个文字块的包围盒（`src/core/probe.tsx`），报告「文字被容器裁切 / 两块字相交 / 出了 x150–930」。写镜头时别让文字靠 `overflow: hidden` 被截断，内容多了要自己减行或缩字号。
- `beat`：一拍的秒数（120 BPM = 0.5）。**关键动作落整拍**：`at = beat * n`。
- `params`：已过校验。可选字段自己给默认值，但别信任它一定合理（空数组、超长都可能在自测时出现）。
- `meta.logo`：已是 public 下路径，直接 `staticFile(meta.logo)`。
- 组件返回一个 `position:absolute; inset:0` 的层，自己按安全区摆元素。

## 3. 取色：只用 `useTheme()`

```tsx
const th = useTheme();
th.card / th.cardAlt / th.cardText / th.cardSub / th.cardMuted / th.line   // 卡片
th.accent / th.accentText / th.accentSoft / th.accentLine                 // 强调色（brandColor 会替换它）
th.hot                                                                     // 字幕强调黄（不随品牌变）
th.onBg / th.onBgSub                                                       // 直接放在渐变背景上的字
th.good / th.warn / th.bad                                                 // 语气色；toneColor(th, 'bad')
th.bubbleOther / th.bubbleOtherText / th.shadow / th.dark
alpha('#RRGGBB', 0.2)  mixHex(a, b, p)                                    // 工具
```

6 套主题里有两套是**深色卡片**（tech-dark、mono-premium）：不要写死 `#fff` 卡片、`#111` 字。改完用 `--props='{"type":"<type>","theme":"tech-dark"}'` 看一眼。

## 4. 安全区（`core/safe.ts`）

```
y 0–205     只放背景          y ≈216  免责小字（全局层）
y 260–540   字幕带（全局层画字幕，镜头别放东西；hook/endCard 例外）
y 560–1340  主体区 = 你的地盘   MAIN = {x0:150, x1:930, y0:560, y1:1340}
y 1340 以下  只放背景/装饰
关键内容 x 180–900（SAFE），卡片外框可放宽到 150–930（CARD），内边距 ≥30
文字行宽 ≤780；以 x=540 左右对称
```

## 5. 字号底线

- 气泡/正文 **≥40px**，面板里的字 **≥34px**，任何字 **≥26px**。
- 放不下时用 `fitLine(text, maxW, max, min)` / `fitSize(text, maxW, max, min)` 自动缩（汉字 1em、拉丁 0.55em 估算），**不要**缩到底线以下；字数上限写进 spec 的 `maxLen`，让校验去拦。

## 6. 动画（`core/anim.ts`）

| 函数 | 用途 |
|---|---|
| `pop(t, t0, damping, stiffness)` | 弹簧 0→1。卡片 (14,170)、气泡 (11,220)、大字 (16,170)、仪表指针 (16,70) |
| `easeOut / easeIn / ease(t, t0, dur)` | 缓动 0→1 |
| `rise(p)` `grow(p)` `slide(p)` | 把进度变成入场样式（上浮/放大/侧滑） |
| `bump(t, t0)` | 鼓一下 0→1→0（数字落定、按钮按下） |
| `kick(t, t0)` | 衰减抖动（冲击） |
| `float(t, phase, amp)` | 常驻漂浮（装饰） |
| `typewriter(text, t, t0, charSec)` | 打字机 |
| `settleAt(t0, damping, stiffness)` | 弹簧落定时刻 → 用来对齐 `thud` 音效 |
| `fitTimeline(plannedEnd, dur)` | 内容多、时长短时的整体压缩系数（见 chat.tsx 的 `plan()`） |

节奏习惯：入场 0–1 拍内完成；之后每拍一个新信息；最后留 ≥0.5 秒静止给观众读。**第一个元素 0.1 秒内就要出现**，不要有空镜。

## 7. 零件（`core/kit.tsx`）与图标（`core/icons.tsx`）

`Card` `Pill` `Bubble` `Avatar` `IconDisc` `BigText`（带 {} 强调的描边大字）`Sweep`（扫光）`TapRipple`（点击圈）`glyph()`。
图标：`<Icon name="check" size={48} color={th.accent} />`，名单见 `core/icons.json`（28 个中性线条图标）。**不用 emoji，不画第三方 logo。**
spec 里图标字段写 `"format": "icon"`，校验会查名单。

## 8. spec.json 字段

```jsonc
{
  "type": "meter",
  "purpose": "一句话用途（模型靠它选镜头）",
  "tips": ["什么时候用", "怎么写好"],
  "dur": {"default": 3, "min": 2, "max": 6},     // 秒
  "mood": 0.7,                                    // 默认情绪
  "caption": "optional",                          // required / optional / none
  "exit": "push",                                 // push 向左推出 / fade 淡出 / none
  "params": {                                     // JSON Schema 子集
    "type": "object", "required": ["value"],
    "properties": {
      "label": {"type": "string", "maxLen": 8, "minLen": 1, "description": "…"},   // maxLen：汉字 1、拉丁 0.5
      "style": {"type": "string", "enum": ["gauge", "ring"]},
      "icon":  {"type": "string", "format": "icon"},
      "src":   {"type": "string", "format": "asset", "accept": ["png", "jpg", "mp4"]},
      "slogan":{"type": "string", "format": "caption", "maxLines": 2, "lineMax": 9},  // 允许 {} 和 \n
      "items": {"type": "array", "minItems": 2, "maxItems": 4, "items": {…}},
      "value": {"type": "number", "minimum": 0, "maximum": 100}
    }
  },
  "sfx": [{"at": 0.3, "kind": "swish", "vol": 0.22}],   // 相对本镜秒数；导出 sfx() 时以函数为准
  "example": {"caption": "…", "mood": 0.7, "dur": 3, "params": {…}}   // ShotLab 自测和文档都用
}
```

- 普通文字字段不允许 `{}` 和换行；要强调/换行就用 `"format": "caption"`。
- 所有文字字段都会被扫网址/二维码/账号和《广告法》极限词，示例里别写。
- 未在 `properties` 里声明的字段会被当成错误（防拼写错），加字段要先加到 spec。
- 音效可选：`pop tap thud whoosh swish ding tick puff ka pu dong bell crunch`（`public/sfx/*.wav`）。默认音量 pop .28、tap .18、thud .45，别叠太满：同一拍最多一个重音。

## 9. 快速自测

```powershell
cd <仓库根目录>
node scripts/validate.mjs --specs                       # spec 结构 + 示例是否合规

cd template
# props 一律先写进 json 文件再传路径（pwsh 7 里 --props='{\"type\":...}' 会被 Remotion 报「neither valid JSON」）
#   ..\tests\<你>\lab-meter.json 内容：{"type":"meter"}            ← 不给 params 就用 spec.example
#   ..\tests\<你>\lab-meter-dark.json：{"type":"meter","theme":"tech-dark"}
npx remotion still src/index.ts ShotLab ..\tests\<你>\meter-45.png --frame=45 --props=..\tests\<你>\lab-meter.json

# 要反复出很多帧时：先打包一次（约 10 秒），之后对打包目录出帧，每帧省掉重新打包
npx remotion bundle src/index.ts --out-dir ..\tests\<你>\bundle
npx remotion still ..\tests\<你>\bundle ShotLab ..\tests\<你>\m-30.png --frame=30 --props=..\tests\<你>\lab-meter.json
# 参考脚本：tests\_dev\phone-mock\stills.ps1（多帧拼成一条横图）

# Screen 合成：把一个镜头（通常 mockApp）渲成干净的「App 截图」（无字幕/免责/音效），给 phone 镜头当示意素材
npx remotion still src/index.ts Screen ..\examples\assets\x-screen.png --frame=145 --props=..\examples\_src\screen-props.json
```

- ShotLab / Screen 的 props：`{type, theme?, brandColor?, params?, caption?, dur?, mood?}`，不给 params 就用 spec.example。
- 多人同时跑报缓存/锁错误时加 `--bundle-cache=false`。
- 测试素材放 `template/public/`，路径直接写文件名（已有 `sample-screen.png`）。
- 整片验收：写一份分镜 → `node scripts/make.mjs tests\<你>\x.json --out tests\<你>\x`，看 `sheet.png` 和 `check/`。只要几帧：`--stills 0.5,2,3.5`。
- 别同时开多个整片渲染（8 核）；make.mjs 会自动排队。

## 10. 质量底线（真实反馈教训）

- v1 被评「丑得离谱、太素」：米白底 + 放大录屏来回动 + 黑字；「图片太大没信息增量、只是图片来回动、不显专业」。
- 认可的方向：**模拟场景 + 一个会动的主角元素**（仪表、数字、点击、飞入）+ 随情绪变化的渐变底 + 抖音式大字 + 音效卡点。
- 每个镜头都要有一个「会动的主角」，而且它的动作要传达信息（数值落定、状态变色、点中高亮），不是装饰性晃动。
- 卡片化、白/深色卡片 + 阴影，信息密度够；不要大面积空白，也不要塞满小字。
- 中性界面：不出现任何第三方 App 的 logo、标志色（如某聊天软件的绿气泡）、网址、二维码、账号名。
- 全部元素只用主题色；在 6 套主题下都要好看（至少自测 warm-emotion + tech-dark）。
- 交付前用 ShotLab 出 3 帧（入场中 / 主角动作落定 / 结束前）自己看一遍。
