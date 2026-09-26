# journey / art：吉祥物与横版城市

journey（角色漫游）风格的美术部件。全部用 SVG / React 代码画，是本项目自己的原创设计，不含任何外部素材。

画法约定（v0.2.1 起「剪纸分层」皮肤）：扁平平涂；统一墨色描边（角色 5、近景建筑 4、中景不描边），颜色取 `../tokens.json` 默认主题的 `ink`，和 UI 元件同一支笔；令牌里没有时用石油蓝 `#15384A`；圆线头；不做渐变和纹理。

- **剪纸分层**：远景 / 中景 / 近景 / 角色各是一张纸，每张在身后那层上投一道往右下错开的硬边纸影（`PAPER_SHADOW`，越近错得越多、越深；夜里减弱）。影子由 `World.tsx` 与 `Mascot` 里的 SVG 滤镜统一加，画单个部件时不用自己画。
- **天空是叠起来的色纸**：五张上沿带缓波浪的色纸从上往下叠，每张上沿一条亮纸边；太阳是三层实色纸圆片，月亮是剪出来的月牙；云是「圆头长条 + 三个圆包」下面垫一张错开的深一号纸。
- **造型剪圆**：楼身上两角剪圆、平顶是圆头压条、尖顶改成子弹头、门是拱门；窗是在墙上剪出来的洞——不描边，洞的上沿和左沿露一道纸厚影子。
- 中景低饱和、不描边，天然退后；远景是两张淡色剪纸（圆顶楼群 + 山包树冠）。

## 吉祥物「橘团」

一只圆滚滚的小熊猫崽：暖橘色大圆头 + 奶白口鼻和眉斑 + 橙色泪痕纹，圆三角耳，深栗色四肢，带三道环纹的大尾巴，脖子上一条翡翠绿条纹围巾（两条飘带随速度飘），脚踩一块钴蓝悬浮滑板（上翘板头、板面一道芥末黄条、两只推进舱喷火、尾鳍插一面芥末黄小旗、板头有前灯）。

识别要点：尾巴环纹 + 翡翠绿围巾 + 钴蓝滑板。平时不戴眼镜，只有 `study` 姿态戴一副钴蓝方框眼镜。

部件：尾巴 / 腿 / 身体 / 围巾（颈圈、结、两条飘带）/ 耳朵 / 腮毛 / 头 / 眉斑（兼做眉毛）/ 眼 / 鼻 / 嘴 / 腮红 / 手臂（上臂 + 前臂 + 爪，两段可弯）/ 道具（写字板）/ 眼镜。

### 姿态 `pose`

| pose | 动作 | 自带表情 / 特效 |
|---|---|---|
| `cruise` | 巡航：站在滑板上身体前倾，手臂随呼吸轻摆 | smile |
| `excited` | 兴奋：双手举过头顶，原地蹦 | excited / sparkle |
| `surprised` | 惊讶：双手举到脸旁，身体后仰 | surprised |
| `think` | 思考：一只手托下巴，歪头 | thinking / question |
| `wave` | 挥手：右手举起左右摆 | happy |
| `study` | 戴眼镜研究：戴眼镜、一手抱写字板、一手推眼镜 | focused |
| `startled` | 被吓一跳：先压扁再蹦起，双手甩高，尾巴炸毛 | shock / exclaim |
| `spin` | 开心转圈：平伸双手原地转（会转到背面） | happy / sparkle |
| `point` | 指向前方 | smile |
| `cheer` | 欢呼：双拳举高 | proud / sparkle |
| `squeeze` | 压扁挤过窄缝 | shock / sweat |
| `dizzy` | 眩晕：歪头、耳朵耷拉、头顶转星星 | dizzy / dizzy |

一次性动作（`startled` 的跳、`spin` 的转）按 `poseT`（进入该姿态后的秒数）演：`startled` 约 0.5 秒落回，`spin` 0.8 秒转一圈。

### 表情 `expr`

`smile` 微笑（猫嘴）· `happy` 眯眼张嘴笑 · `excited` 星星眼 · `surprised` 圆眼 O 嘴 · `shock` 白眼小瞳孔大张嘴 · `thinking` 眼往上看、一边眉挑起 · `focused` 半眯眼抿嘴 · `wink` 眨一只眼 · `dizzy` 螺旋眼 · `proud` 闭眼得意笑

每个表情 = 左右眼型 + 嘴型 + 眉斑位移/旋转 + 腮红强度（`EXPR_SPECS`）。说话时传 `talk`（0..1）让嘴张合。`dot`/`look`/`half` 眼会自动眨（约 3.1 秒一次）。

### 头顶特效 `fx`

`sweat` 汗滴 · `exclaim` 红色感叹号 · `question` 黄色问号 · `sparkle` 闪光 · `dizzy` 转圈星星 · `smoke` 冒烟 · `none`。不传就用姿态自带的。特效不跟着镜像，文字形状不会反。

另有 `sooty`（满脸黑灰）和 `glasses`（任何姿态都能戴眼镜）。**风格剧情里不用 `sooty`、`dizzy` 姿态 / 螺旋眼**：被烟熏黑、末站故障转圈眼是参考片的招牌反应（`styles/journey/originality.md` S12），`parts/rider.tsx` 的表情表里没有它们，美术库只留着当素材。

### 接口

```tsx
import {Mascot, MascotG, SpeedLines} from '../art';

// HTML 层：(x, y) = 滑板面（脚底）中心的屏幕像素，size = 角色身高像素（不含滑板，滑板再往下约 0.2 × size）
<SpeedLines x={mx} y={my} t={t} amount={0.9} size={260} />
<Mascot x={mx} y={my} size={260} t={t}
  pose="startled" poseT={t - gagAt} expr="shock"
  facing="right" vehicle="hoverboard" speed={0.9}
  night={nightOf(sky)} talk={0} squash={0} fx="exclaim" sooty={false} />
```

| prop | 类型 | 说明 |
|---|---|---|
| `pose` | 见上 | 默认 `cruise` |
| `expr` | 见上 | 覆盖姿态自带表情 |
| `t` | 秒 | 驱动眨眼、呼吸、飘带、尾巴、喷口、挥手；不传就静止 |
| `poseT` | 秒 | 进入当前姿态后的秒数，驱动一次性动作；不传用 `t` |
| `facing` | `'right' \| 'left'` | 默认朝右（视线 = 运动方向），朝左整体镜像 |
| `vehicle` | `'hoverboard' \| 'none'` | 默认滑板；`none` 只画角色（落版、头像） |
| `speed` | 0..1 | 速度感：飘带角度和摆幅、喷口长度 |
| `night` | 0..1 | 喷口变薄荷色辉光、滑板前灯打光（传 `nightOf(天色)`） |
| `talk` | 0..1 | 嘴张开程度，0 = 用表情自带嘴型 |
| `squash` | 数 | 额外压扁（正）/ 拉长（负），做 1–2 帧 squash |
| `fx` | 见上 | 头顶特效 |
| `sooty` / `glasses` | bool | 黑灰脸 / 眼镜 |
| `colors` | `{mascot?, board?}` | 单次覆盖颜色（二创换皮优先改令牌，见下） |
| `x` `y` `size` | px | 仅 `Mascot` |

放进别的 `<svg>` 用 `MascotG`（同样的 props，不带 x/y/size）。局部坐标：脚底 = (0, 0)，耳尖 ≈ y -300，滑板在 y 0..60，喷口到 y ≈ 110；画布范围 `MASCOT_BOX`（x -300..360，y -440..150）。

## 横版城市

一次画出五层，按相机做视差：

| 层 | 内容 | 视差倍率 |
|---|---|---|
| 天空 | 五张波浪边色纸叠成 + 纸圆片太阳 / 剪纸月牙 + 星星 + 剪纸云 | 云 0.18 |
| 远景 | 两张淡色剪纸：圆顶楼群 + 山包树冠（可无限平铺），夜里零星窗灯 | 0.12 |
| 中景 | 每个街区一段淡色塔楼（不描边）+ 主题剪影：发布=水塔、工具=冒烟烟囱、创意=转动摩天轮、数据=卫星天线、全球=电视塔、资料=钟楼 | 0.55 |
| 近景 | 街区地标 + 房子 + 路灯、树、长椅、串旗 | 1.0 |
| 街面 | 人行道（地砖缝）+ 路缘 + 柏油路（黄色虚线）；9:16 下方多出的地方是路缘 + 草地 | 1.0 |

### 天色

一个进度 `p` 管全部：0 白天「薄荷晴空」（青蓝到薄荷、海玻璃绿远景）→ 0.35 午后「柠檬午后」（地平线柠檬黄、鼠尾草远景）→ 0.62 黄昏「橘子汽水」（上青蓝下琥珀橘、太阳落低变大）→ 0.82 蓝调「深海」（深海蓝到青绿）→ 1 夜晚「石油蓝」（石油蓝、月牙、星星、琥珀窗灯、柑橘薄荷霓虹）。建筑色用 `lit(颜色, p)` 自动套琥珀暖光和石油蓝夜色；`nightOf(p)` 控制窗灯（约六成亮）、路灯光锥、招牌仰射灯、霓虹。`skyForDistrict(第几个街区, 街区数)` 给出默认走向：前面白天到午后，倒数第二个街区进黄昏，最后一个街区是夜晚。

### 主题街区（`DistrictKind`，十四个）

| kind | 主色 | 地标（近景） | 笑点参数 `gagT` |
|---|---|---|---|
| `docs` 资料/文档 | 芥末 | 文件柜大楼（四个抽屉 + 标签卡，顶层抽屉冒出文件夹，柜顶盆栽）、三本竖立的活页夹楼、文件夹招牌资料馆、纸箱 | — |
| `post` 发布/寄出 | 钴蓝 | 邮局（拱窗、钟楼）、一座圆顶邮筒楼（投信口、信封标） | 投信口挡板翻开 → 楼身一抖（吐出的邮票贴纸在 `parts/props.tsx` 里画） |
| `tools` 工具/工厂 | 苔绿 | 工具箱大楼（提手、锁扣）、锯齿屋顶车间 + 扳手招牌、塔吊吊箱子、传送带上的箱子 | 吊箱猛晃后衰减 |
| `creative` 创意/设计 | 橘子 | 铅笔塔、溢出四色颜料的油漆桶楼、画架、调色板招牌楼 | —（颜料滴会缓慢伸缩） |
| `data` 数据/资料 | 石油青 | 柱状图楼群 + 折线、楼顶一块圆形饼图牌、量杯楼（液面晃、冒泡）、服务器塔（指示灯闪） | 四根柱子依次长高 |
| `global` 夜景街 | 翡翠 | 转动的地球仪、屋顶对话框招牌（两块写 `words`＝分镜里这一站的类别名和标签，另两块画星星、爱心；夜里像灯箱一样亮暖光，不闪）、串旗 | — |
| `phone` 手机 | 天青 | 手机形大楼（屏幕是列表界面）、小票招牌店、平板楼（柱状图） | 扫描线扫过屏幕，第一行打勾 |
| `home` 住家 | 杏橙 | 带阳台的公寓楼、心形圆窗小房子、栅栏、信箱、晾衣绳 | 公寓窗户一扇扇亮灯、信箱小旗竖起 |
| `cafe` 咖啡馆 | 焦糖 | 屋顶大咖啡杯（冒热气）、条纹遮阳篷、户外桌椅、小黑板、面包房（屋顶可颂） | — |
| `market` 集市 | 金盏橙 | 四个条纹布篷摊位（水果、蔬菜、糕点、小物）、一串小灯泡 | — |
| `gate` 城门 | 砖红 | 城墙 + 拱门 + 两层城楼 + 旗 | — |
| `bridge` 石桥 | 湖蓝 | 三孔石拱桥跨河、垂柳、乌篷船慢慢划过 | — |
| `teahouse` 茶馆 | 茶绿 | 两层木楼、格窗、茶杯布幌、晾着的蓝染布、茶桌 | — |
| `lantern` 灯会 | 大红 | 牌楼、一串串红灯笼、摊位、大灯笼架 | 灯笼从左到右依次亮透 |

`phone / home / cafe / market` 在 `everyday.tsx`，`gate / bridge / teahouse / lantern` 在 `oldtown.tsx`。道具只画「这一类内容」的通用样子，不画某一家产品的专属栏目。

### 天际线 `skyline`

`CityWorld` 的 `skyline` 换整套背景层：`modern`（默认，上面那套）/ `street`（远景和中景压低到 2–4 层，其余同 modern）/ `oldtown`（`OldFar` 远山 + 宝塔 + 远处屋檐，`OldMid` 淡色白墙群 + 马头墙，填充段 `OldFiller` 白墙黛瓦民居 + 垂柳，街面 `OldStreet` 石板路，9:16 下方是河道）。古城配色在 `palette.ts` 的 `OLD`。古城部件也能单独用：`OldHouse`（白墙黛瓦，可带马头墙、灯笼）、`TileRoof`（两端起翘的黛瓦屋顶）、`Lantern`（红灯笼，`on` 控制亮度）、`Willow`（垂柳）。

街区颜色在 `palette.ts` 的 `DISTRICT`（`main / deep / mid / accent`）。每个街区宽 `DISTRICT_W` = 2200 世界像素（近景层）；街区之外（片头、片尾）自动铺通用房子。

### 接口

```tsx
import {CityWorld, layoutCity, toScreen, sceneScale, districtAt, skyForDistrict, nightOf} from '../art';

const layout = layoutCity(['docs', 'post', 'tools', 'creative', 'data', 'global'], {introW: 900, outroW: 1600});
// layout.districts[i].x0 = 第 i 个街区的世界 x 起点；layout.end = 世界总长

<CityWorld w={geo.w} h={geo.h} horizonY={horizon} camX={camX} t={t} layout={layout}
  scale={sceneScale(geo.h)}             // 4:5 → 0.78，9:16 → 1.1
  sky={p}                               // 不传就按 skyForDistrict 自动
  parallax={{far: 0.12, mid: 0.55}}     // 可用 tokens.camera.parallax
  gags={{1: t - rocketAt, 4: t - chartAt}}   // 第 i 个街区的笑点秒数
  skyline="modern" />                       // modern / street / oldtown

// 前景件（招牌、角色）画在它上面，位置换算：
const sx = toScreen(worldX, camX, geo.w, 1);      // 近景层
const bx = toScreen(worldX, camX, geo.w, 0.55);   // 中景层（跟着世界走的招牌、路牌放这一层）
```

`camX` = 画面左边缘对应的世界 x（近景层）。中景、远景以画面中线为支点：屏幕 x = w/2 + (世界 x − camX − w/2) × 倍率。`districtAt(layout, camX, w * 0.35)` = 角色所在位置是第几个街区（带小数），给类别 HUD 和天色用。

单独用部件：`Sky`、`FarSkyline`、`DistrictMid`、`DISTRICT_NEAR[kind]`、`FillerNear`、`House`（屋顶 flat/gable/arc/saw/step，窗 grid/arch/round/band/tall，可带条纹遮阳篷）、`Tower`、`StreetLamp`、`Tree`、`Bush`、`Bench`、`Bunting`、`Street`。近景件局部坐标：地面线 y = 0，往上为负。

## 带字招牌（HTML 层）

| 组件 | 外形 | 主要 props |
|---|---|---|
| `WaySign` | 路牌：指向右边的箭头牌 + 立柱，可带副牌（第几站） | `x`（立柱中心）、`groundY`、`label`、`color`、`height`=170（箭头中心离地）、`size`=52、`badge` |

字号默认值都不低于底线（正文 40 / 面板 34 / 最小 26）。

## 换皮（二创）

颜色优先从令牌读：在 `../tokens.json` 里加一个 `art` 键即可覆盖，不用改代码：

```json
"art": {
  "mascot": {"fur": "#8FB8FF", "scarf": "#FF5A4E"},
  "board": {"deck": "#2DAA5F"},
  "district": {"docs": {"main": "#5B6CFF"}}
}
```

可覆盖的键见 `palette.ts` 的 `MASCOT`、`BOARD`、`DISTRICT`。

## 总览图

`ArtSheet.tsx` + `sheet.entry.tsx` 是只给美术自检用的独立入口（不进正式合成）。在 template 目录：

```
npx remotion still src/styles/journey/art/sheet.entry.tsx JourneyArt <仓库外>/mascot.png --frame=24 --props=<仓库外>/p.json
```

`p.json` 写 `{"part":"mascot"}`（12 个姿态 + 10 个表情）、`{"part":"city"}`（14 个主题街区两列排，天色把白天 / 午后 / 黄昏 / 蓝调 / 夜都过一遍）或 `{"part":"frames"}`（拼好的示意帧：3 张 4:5 + 4 张 9:16）。输出一律放仓库外。
