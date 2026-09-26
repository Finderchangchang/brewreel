# quiz / art：角色与情景小剧场

quiz（答题互动）风格的美术部件。全部用 SVG / React 代码画，是本项目自己的原创设计，不含任何外部素材。
配色分两层：描边、底色、白卡取当前主题（`../tokens.json` 的 `themes`）；衣服、道具、小剧场的家具和灯用「人设色」（`colors.ts` 的 `CAST`：暖橙 / 墨绿 / 奶白 / 沙色 / 琥珀，墨绿和琥珀与默认主题 sage-pine 的 primary / highlight 同值）。角色是我们自己的形象，换主题不换衣服；某个主题想给角色换装，在主题里写 `castWarm` / `castDeep` / `castLight` / `castSand` / `castGlow` 覆盖即可。

画法约定（和风格规格一致）：平涂、无渐变、统一墨色描边（角色 600 高时线宽 6，缩放后等比）、圆线头、五官极简（点眼 + 小嘴 + 短眉）、地面一个浅色椭圆影。

## 角色

| id | 定位 | 识别特征 |
|---|---|---|
| `host` | 主讲人 | 矮个大头（约 3.6 头身）；栗色侧分斜刘海短发 + 低马尾（暖橙发圈）；**头戴式耳机 = 状态道具**（没想通 = 耳罩灯灭，懂了 = 耳罩亮琥珀色 + 往外冒三道声波）；暖橙运动夹克（奶白拉链、袖子一道奶白条、墨绿罗纹立领 / 袖口 / 下摆、琥珀星星徽章）；墨绿短裤；奶白条纹袜 + 墨绿厚底鞋；眼尾一根上翘睫毛 |
| `buddy` | 搭档 | 高个宽肩；**反戴棒球帽**（墨绿帽身、暖橙帽檐朝后、前额露出调节扣开口）；深棕肤色、粗眉、两颊雀斑；墨绿圆领毛衣（胸前一道暖橙宽条夹两根奶白细线、奶白罗纹领口和袖口）；沙色工装裤（侧袋、卷边）；暖橙高帮鞋 |

两个角色靠「暖橙夹克 + 墨绿短裤」和「墨绿毛衣 + 沙色长裤」互补区分；耳机和反戴帽让头部轮廓一眼分开，身高差和体型（矮圆 vs 高宽）也拉开了轮廓。

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
  facing="right" nod={nodAt(t, 2.4)} bulb={t > 3 ? 1 : 0}   // bulb：主讲人耳机亮灯（沿用旧名）
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
| `bulb` | 0..1 | 状态道具亮度：主讲人耳机亮灯（懂了 = 1），只对 host 有效。沿用 v0.2.0 的字段名，调用方不用改 |
| `fx` / `fxT` | 见上 / 秒 | 头顶特效 |
| `x` `y` `size` | px | 仅 `Character`：脚底中心和身高 |
| `hop` | 角色单位 | 仅 `Character`：离地高度（`hopAt(t, t0)`），影子会跟着缩 |
| `scale` | 0..1 | 仅 `Character`：以脚底为锚点放大进场 |
| `shadow` | bool | 仅 `Character`：地面影，默认有 |

要放进别的 `<svg>` 时用 `CharacterG`（同样的 props，不带 x/y/size），它的坐标系：脚底中心 = (0, 600)，主讲人耳机顶约 y=8，搭档帽顶约 y=-22（反戴的帽檐往后伸到 x≈-140）；亮灯声波往后脑方向伸到 x≈-140。

### 探头

```tsx
// 画在媒体卡「之后」（DOM 顺序在后）；它会把 edgeY 以下裁掉，两只手扒在卡片边上
<PeekCharacter who="host" x={820} edgeY={cardTop} size={420} t={t} at={0.2}
  show="bust" grip facing="left" expr="neutral" hideAt={5.8} />
```

升起 0.17 秒（easeOutBack，带回弹），`hideAt` 起 0.15 秒缩回。`show="head"` 只露头。

## 情景小剧场（替代影视片段）

题目里的「片段」不能用影视素材，默认用代码画的小剧场：两个角色在场景里把那句话演出来，说话的人嘴动、听的人点头，镜头在全景和说话人近景之间切。

场景 `scene`：`office` 办公室（软件 / 办公类）· `cafe` 咖啡店（餐饮）· `street` 街景（门店 / 出行）· `home` 客厅（生活）· `classroom` 教室（教育，黑板上有两球下落的小实验）。都带很轻的环境动效（云飘、灯晃、图表跳、植物摆），第 0 帧就是完整画面。墙和地板跟主题底色走，家具、布艺、灯、植物用人设色，和角色是一套（换主题不会变成别家的配色）。

```tsx
<SceneClip scene="office" w={780} h={439} t={t}
  lines={[
    {who: 'buddy', at: 0.3, dur: 1.8},                  // 说话：默认 talk 姿势 + 嘴动
    {who: 'host', at: 2.4, dur: 1.4, expr: 'happy'},
  ]}
  events={[
    {who: 'host', at: 0, pose: 'think', expr: 'thinking', fx: 'think'},
    {who: 'host', at: 3.9, pose: 'peace', expr: 'wink', bulb: true, fx: 'hearts', hop: true},   // bulb：耳机亮灯
    {who: 'buddy', at: 3.9, pose: 'surprised', expr: 'surprised', fx: 'surprise'},
  ]}
  cast={{host: {x: 560, facing: 'right'}, buddy: {x: 1060, facing: 'left'}}}
  camera="auto" />
```

- 舞台是 1600×900，按 cover 铺满 `w×h`。角色默认站位 host x=560 朝右、buddy x=1060 朝左。
- `camera`：`auto`（默认，全景开场；≥1.2 秒的台词开口 0.15 秒后切说话人近景，台词之间回全景，每个镜头都慢推）· `wide` 固定全景 · `push` 全景慢推。
- `events` 里换姿势 / 表情但没给新 `fx` 时，旧特效会收掉。
- 倒放（回放镜头的倒带）：把 t 反着传进来就行，所有东西都是 t 的纯函数。
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
| `Character.tsx` | 角色部件（头、后发 / 刘海 / 马尾、耳机、棒球帽、眼、眉、嘴、腮红、雀斑、身体、手臂、手、腿、鞋）、`Character` / `CharacterG` / `Avatar` / `Bulb`（独立灯泡图标，角色本身不再戴） |
| `rig.ts` | 部件坐标、两段式手臂 IK、姿态表 `POSE_DEFS`、表情表 `FACES` |
| `fx.tsx` | 头顶特效、`Heart`、`Sparkle` |
| `scenes.tsx` | 五个场景背景 |
| `theater.tsx` | `SceneClip`、`MediaClip`、`PeekCharacter`、`performAt` |
| `motion.ts` | `mouthAt`、`blinkAt`、`nodAt`、`hopAt`、`breathe`、`backOut`、`waveAt` |
| `colors.ts` | 主题色 + 人设色 `CAST` → 角色 / 场景配色（`useArtPalette`） |

加姿态：在 `rig.ts` 的 `POSES` 和 `POSE_DEFS` 各加一项（手的目标位置按「右臂坐标系」写，左臂自动镜像）。加表情：`EXPRS` + `FACES`。加场景：`scenes.tsx` 写一个组件，登记到 `SCENES` 和 `SceneBackdrop`。

## English summary

Original code-drawn cast for the quiz style: `host` (short and round, side-swept chestnut hair with a low ponytail, over-ear headphones as the state prop: the ear cup lights up amber and sends out sound waves on "got it" (still driven by the `bulb` prop), orange track jacket, pine-green shorts, striped socks) and `buddy` (tall, backwards cap, freckles, pine-green sweater with an orange chest band, sand cargo pants, orange high-tops). 10 poses, 7 expressions, lip-sync via `mouth` (use `mouthAt`), nod via `nod`, 6 head FX, `Avatar` for comment boxes, `PeekCharacter` for peeking over a card edge. `SceneClip` replaces film clips with a code-drawn mini scene (office / cafe / street / home / classroom) with auto camera cuts; `MediaClip` also accepts user-owned video or image `src`. Outlines and backgrounds follow the active theme; clothes, props and scene furniture use the fixed cast palette in `colors.ts` (`CAST`: orange / pine green / cream / sand / amber), overridable per theme with `castWarm` / `castDeep` / `castLight` / `castSand` / `castGlow`.
