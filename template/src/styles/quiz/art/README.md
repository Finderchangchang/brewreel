# quiz / art：角色与情景小剧场

quiz（答题互动）风格的美术部件。全部用 SVG / React 代码画，是本项目自己的原创设计，不含任何外部素材。
颜色全部从当前主题（`../tokens.json` 的 `themes`）取，换主题或二创换配色，角色和场景会自动跟着变。

画法约定（和风格规格一致）：平涂、无渐变、统一墨色描边（角色 600 高时线宽 6，缩放后等比）、圆线头、五官极简（点眼 + 小嘴 + 短眉）、地面一个浅色椭圆影。

## 角色

| id | 定位 | 识别特征 |
|---|---|---|
| `host` | 主讲人 | 齐刘海波波头；发箍上一根小灯泡天线（状态道具：没想通 = 灯灭，懂了 = 灯亮 + 放光）；白衬衫圆领 + 主色背带裙（胸前口袋、亮色纽扣）；白袜 + 玛丽珍鞋；浅肤色 |
| `buddy` | 搭档 | 个子更高；主色毛线帽 + 亮色绒球（帽檐罗纹）；小麦肤色、粗短眉、小鼻子；亮色卫衣（帽兜、抽绳、袋鼠兜、罗纹下摆和袖口）；深色直筒裤；白色运动鞋 |

两个角色靠「主色裙 vs 亮色卫衣」互补区分，身高差也拉开了轮廓。

### 姿态 `pose`

`stand` 站立 · `talk` 说话（手掌摊开向前，嘴动时手跟着轻摆）· `point` 平指（朝面向方向）· `pointUp` 上指（「我知道了」）· `peace` 比耶（另一只手叉腰）· `think` 思考（手托下巴，另一只手托肘）· `surprised` 惊讶（双手举到脸旁）· `cheer` 欢呼（双手举高）· `wave` 挥手（传 `t` 自动摆）· `shrug` 摊手

点头不是姿态，是叠加量：`nod`（0..1），任何姿态都能点头。

### 表情 `expr`

`neutral` 中性 · `happy` 开心（弯眼、咧嘴）· `surprised` 惊讶（大眼、O 嘴、挑眉）· `thinking` 思考（眼往上看、一边眉挑起、抿嘴）· `wink` 眨一只眼 · `oops` 尴尬（八字眉、波浪嘴）· `smug` 得意（压眉、歪嘴笑）

每个表情自带头部角度和腮红强度。嘴型开合另外叠加：`mouth`（0..1），说话时逐帧传 `mouthAt(t, 开口秒, 闭口秒)`。

### 头顶特效 `fx`

`hearts` 冒心 · `surprise` 惊讶放射线 · `think` 思考气泡（循环）· `sweat` 汗滴 · `sparkle` 闪光 · `question` 问号。`fxT` = 特效开始后的秒数。

### 接口

```tsx
import {Character, Avatar, mouthAt, nodAt, hopAt} from '../art';

// HTML 层：(x, y) = 脚底中心的像素坐标，size = 身高像素
<Character who="host" x={330} y={1300} size={560} t={t}
  pose="talk" expr="happy" mouth={mouthAt(t, 0.4, 2.2)}
  facing="right" nod={nodAt(t, 2.4)} bulb={t > 3 ? 1 : 0}
  hop={hopAt(t, 3)} scale={1} shadow
  fx="hearts" fxT={t - 3} />

// 圆形头像（评论框）
<Avatar who="buddy" size={110} expr="happy" />
```

| prop | 类型 | 说明 |
|---|---|---|
| `who` | `'host' \| 'buddy'` | 必填 |
| `pose` | 见上 | 默认 `stand` |
| `expr` | 见上 | 默认 `neutral` |
| `mouth` | 0..1 | 嘴张开程度，0 = 用表情自带嘴型 |
| `t` | 秒 | 驱动眨眼、呼吸、挥手；不传就完全静止 |
| `facing` | `'right' \| 'left'` | 默认朝右（3/4 侧脸），朝左整体镜像 |
| `nod` | 0..1 | 点头量，用 `nodAt(t, t0, 次数)` |
| `tilt` | 度 | 额外歪头 |
| `bulb` | 0..1 | 灯泡亮度，只对 host 有效 |
| `fx` / `fxT` | 见上 / 秒 | 头顶特效 |
| `x` `y` `size` | px | 仅 `Character`：脚底中心和身高 |
| `hop` | 角色单位 | 仅 `Character`：离地高度（`hopAt(t, t0)`），影子会跟着缩 |
| `scale` | 0..1 | 仅 `Character`：以脚底为锚点放大进场 |
| `shadow` | bool | 仅 `Character`：地面影，默认有 |

要放进别的 `<svg>` 时用 `CharacterG`（同样的 props，不带 x/y/size），它的坐标系：脚底中心 = (0, 600)，头顶约 y=20，灯泡 / 绒球到 y≈-60。

### 探头

```tsx
// 画在媒体卡「之后」（DOM 顺序在后）；它会把 edgeY 以下裁掉，两只手扒在卡片边上
<PeekCharacter who="host" x={820} edgeY={cardTop} size={420} t={t} at={0.2}
  show="bust" grip facing="left" expr="neutral" hideAt={5.8} />
```

升起 0.17 秒（easeOutBack，带回弹），`hideAt` 起 0.15 秒缩回。`show="head"` 只露头。

## 情景小剧场（替代影视片段）

题目里的「片段」不能用影视素材，默认用代码画的小剧场：两个角色在场景里把那句话演出来，说话的人嘴动、听的人点头，镜头在全景和说话人近景之间切。

场景 `scene`：`office` 办公室（软件 / 办公类）· `cafe` 咖啡店（餐饮）· `street` 街景（门店 / 出行）· `home` 客厅（生活）· `classroom` 教室（教育，黑板上有两球下落的小实验）。都带很轻的环境动效（云飘、灯晃、图表跳、植物摆），第 0 帧就是完整画面。

```tsx
<SceneClip scene="office" w={780} h={439} t={t}
  lines={[
    {who: 'buddy', at: 0.3, dur: 1.8},                  // 说话：默认 talk 姿势 + 嘴动
    {who: 'host', at: 2.4, dur: 1.4, expr: 'happy'},
  ]}
  events={[
    {who: 'host', at: 0, pose: 'think', expr: 'thinking', fx: 'think'},
    {who: 'host', at: 3.9, pose: 'peace', expr: 'wink', bulb: true, fx: 'hearts', hop: true},
    {who: 'buddy', at: 3.9, pose: 'surprised', expr: 'surprised', fx: 'surprise'},
  ]}
  cast={{host: {x: 560, facing: 'right'}, buddy: {x: 1060, facing: 'left'}}}
  camera="auto" />
```

- 舞台是 1600×900，按 cover 铺满 `w×h`。角色默认站位 host x=560 朝右、buddy x=1060 朝左。
- `camera`：`auto`（默认，全景开场；≥1.2 秒的台词开口 0.15 秒后切说话人近景，台词之间回全景，每个镜头都慢推）· `wide` 固定全景 · `push` 全景慢推。
- `events` 里换姿势 / 表情但没给新 `fx` 时，旧特效会收掉。
- 倒放（「再听一遍」的倒带）：把 t 反着传进来就行，所有东西都是 t 的纯函数。
- `performAt(who, t, lines, events)` 单独导出，镜头作者可以用它驱动舞台外的 `Character`（比如卡片外探头的角色跟着剧场里的台词张嘴）。

### 用户自备素材

```tsx
<MediaClip media={{kind: 'scene', scene: 'cafe', lines: [...]}} w={780} h={439} t={t} />
<MediaClip media={{kind: 'video', src: '_run/<id>/clip.mp4', trimStart: 3, trimEnd: 7.5, keepAudio: true}} w={780} h={439} t={t} />
<MediaClip media={{kind: 'image', src: '_run/<id>/shot.png'}} w={780} h={439} t={t} />
```

`src` 是 `public/` 下的相对路径，或 http(s) 地址。视频 / 图片的版权由使用者声明；图片会轻微推近，避免死图。

## 文件

| 文件 | 内容 |
|---|---|
| `Character.tsx` | 角色部件（头、后发 / 刘海 / 帽子、眼、眉、嘴、腮红、身体、手臂、手、腿、鞋）、`Character` / `CharacterG` / `Avatar` / `Bulb` |
| `rig.ts` | 部件坐标、两段式手臂 IK、姿态表 `POSE_DEFS`、表情表 `FACES` |
| `fx.tsx` | 头顶特效、`Heart`、`Sparkle` |
| `scenes.tsx` | 五个场景背景 |
| `theater.tsx` | `SceneClip`、`MediaClip`、`PeekCharacter`、`performAt` |
| `motion.ts` | `mouthAt`、`blinkAt`、`nodAt`、`hopAt`、`breathe`、`backOut`、`waveAt` |
| `colors.ts` | 主题色 → 角色 / 场景配色（`useArtPalette`） |

加姿态：在 `rig.ts` 的 `POSES` 和 `POSE_DEFS` 各加一项（手的目标位置按「右臂坐标系」写，左臂自动镜像）。加表情：`EXPRS` + `FACES`。加场景：`scenes.tsx` 写一个组件，登记到 `SCENES` 和 `SceneBackdrop`。

## English summary

Original code-drawn cast for the quiz style: `host` (bob haircut, headband with a light-bulb antenna that lights up on "got it", pinafore dress) and `buddy` (beanie with pom-pom, hoodie, sneakers). 10 poses, 7 expressions, lip-sync via `mouth` (use `mouthAt`), nod via `nod`, 6 head FX, `Avatar` for comment boxes, `PeekCharacter` for peeking over a card edge. `SceneClip` replaces film clips with a code-drawn mini scene (office / cafe / street / home / classroom) with auto camera cuts; `MediaClip` also accepts user-owned video or image `src`. All colors come from the active theme in `tokens.json`.
