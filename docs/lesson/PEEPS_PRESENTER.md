# Open Peeps 讲解员

卡通讲解员是 Open Peeps 半身，不加外框。人物整体水平镜像，脸和手朝左。线条用当前风格的 `ink`。人物底色保持 Open Peeps 原来的白色，不用风格的 `surface`。`skin` 可以写成 `#RRGGBB` 留在 look 里，识别和校验照旧，**肤色暂不生效**。四套风格不再各自规定卡通外框。

react-peeps 是 MIT，Open Peeps 线稿是 CC0。源码在 `template/src/vendor/react-peeps/`，不安装进 `template/node_modules`。

## 摆放

画布 1920×1080。几何只写在 `template/src/lesson/presenter-place.mjs`。

卡通站在右下角，没有底色、圆角、描边、阴影。脚底贴字幕带上沿 y=860，右边距 80。默认高 380，宽按 850:1200。截图页和代码页高 300。人物不进入 x≤1480 的版心，也不进入字幕带（y 864–972，x 528–1392）。

真人用圆形小窗。直径 280，right 80 / bottom 108，也就是 x 1560–1840、y 692–972。描边固定 1px，颜色和阴影用该风格的 `pipBorder` / `pipShadow`（杂志的阴影 token 是 `none`，圆窗就不加阴影）。画面裁切让眼睛约在圆的上 40%（`object-position: center 40%`）。截图页和代码页直径 220。

开场钩子和章节页仍可按片里的 `layout: full` 放大：竖拍原片用并排大窗 540×720（x 1300，y 100，圆角 20 的矩形），横拍原片全屏且不加框。从大窗缩回圆形用 600ms。放大只在稿子把该页标成 `full` 时发生。

便签气泡在人物或圆窗的左上方，宽 230。左缘不小于 1480，底不进入字幕带。

竖版几何不写在 `presenter-place.mjs`。画面坐标在 `scripts/lesson/vertical-layout.mjs`，`scripts/lesson/vertical.mjs` 再导出，并负责切片和封面文字。卡通平时高 300，宽仍按 850:1200，右缘对齐 x=900，脚底对齐 y=1340，脸朝左。钩子出现的前 1.5 秒高 420、在安全区里水平居中、站在钩子下方，再用 0.4 秒缩放移动到右下角。截图、代码、对比页高 220，换页用 0.3 秒过渡。真人不用横版的并排大窗或全屏，圆窗直径开头 360、平时 240、这三页 200，位置规则和卡通相同。两者都落在 x=180–900、y=260–1340，不盖住内容。字幕放不下时人物再缩到 220。便签贴在人物左缘外侧、与头顶齐平，不出安全区；左侧不够 220px 时气泡变窄，不盖住正文。

## 形象和风格、领域无关

`meta.presenter` 可以选择画谁。旧稿只写 `meta.mascot` 时自动换成卡通，不报错。

```json
{
  "kind": "cartoon",
  "look": {
    "preset": "male",
    "hair": "ShortVolumed",
    "accessory": "GlassRound",
    "facialHair": "None",
    "outfit": "darkSweater",
    "skin": "#E0B090"
  }
}
```

`kind` 是 `cartoon`、`real` 或 `none`。`real` 是真人圆形小窗，旧稿里的 `video` 同样表示真人，并且仍要带本地 MP4 和逐页 `segments`。`none` 不画讲解员。

`preset` 只是一组默认值。写了的单项覆盖预设。任何组合都能用在任何风格、任何领域。

| preset | 发型 | 饰品 | 胡子 | 衣服族 |
| --- | --- | --- | --- | --- |
| `male`，同 `peep-mentor` | `ShortVolumed` | `GlassRound` | `None` | `darkSweater` |
| `female`，同 `peep-counsel` | `Bun` | `GlassButterflyOutline` | `None` | `blackTee` |
| `peep-teacher` | `MediumBangs` | `None` | `None` | `whiteShirt` |

不写 `look`、也不写旧的角色 id 时，legal 用 `female`，其他领域用 `male`。这只是默认值。

`hair`、`accessory`、`facialHair` 必须是 react-peeps 选项表里的名字，校验失败时用中文列出全部可选值。`outfit` 只能是三个衣服族：`darkSweater`、`blackTee`、`whiteShirt`。旧名 `sweater`、`tee`、`shirt` 仍指向同一族。换手势不会换到族外的衣服。

旧 `meta.mascot.id` 仍可用：`mentor` / `default` → `peep-mentor`，`counsel` → `peep-counsel`，`buddy` → `peep-teacher`。`meta.mascot.palette` 仍可填写，不参与这套线稿上色。

生成流水线的 brief 可以带同样的 `presenter`，`generate-lesson.mjs` 原样写进 `lesson.json`。

## 三个命名预设

| id | 谁 | 衣服族 | 默认发型 | 默认饰品 | 旧 id |
| --- | --- | --- | --- | --- | --- |
| `peep-mentor` | 男讲师 | 深色毛衣 `darkSweater` | `ShortVolumed` | `GlassRound` | `mentor`、`default` |
| `peep-counsel` | 女律师 | 黑 T `blackTee` | `Bun` | `GlassButterflyOutline` | `counsel` |
| `peep-teacher` | 老师 | 白衬衫 `whiteShirt` | `MediumBangs` | `None` | `buddy` |

## 姿势

每个半身姿势的手臂和衣服是同一组线。换手势就等于换衣服，所以一个角色只待在自己的族里。族外的动作用该族站姿，加上表情和头顶图标（⚠、?、✓、纸屑）。

脸默认 `SmileNM`。提醒和思考用 `CalmNM`。这两种脸都不带嘴，嘴画在 SVG 上。映射只定义在 `template/src/lesson/mascot/cast.mjs`。

### 深色毛衣族 `sweater`

站姿 `SweaterDotsPlain`，举手 `PointingUpPlain`，拿文件 `PaperPlain`。这三件是原件去掉白色花纹后的变体。原件 `SweaterDots` 和 `Paper` 是白点，`PointingUp` 是白色波浪，换手势会看成换衣服。变体只删花纹镂空，轮廓、手、袖口和手里的纸还在。黑 T、白衬衫两族对过一遍，三套身体都是净色，没有这种花纹差，仍用原件。

| pose | 身体 | 脸 | 图标 |
| --- | --- | --- | --- |
| explain | SweaterDotsPlain | SmileNM | 无 |
| point | PointingUpPlain | SmileNM | 无 |
| check | PaperPlain | SmileNM | ✓ |
| warn | PointingUpPlain | CalmNM | ⚠ |
| think | SweaterDotsPlain | CalmNM | ? |
| affirm | SweaterDotsPlain | SmileNM | ✓ |
| cheer | SweaterDotsPlain | SmileNM | 纸屑 |
| wave | PointingUpPlain | SmileNM | 无 |

这一族没有单独的挥手，`wave` 和 `point` 都用举手。

### 黑 T 族 `tee`

站姿 `ShirtFilled`，抱臂 `ArmsCrossed`，摊手 `Whatever`。

| pose | 身体 | 脸 | 图标 |
| --- | --- | --- | --- |
| explain | Whatever | SmileNM | 无 |
| point | ShirtFilled | SmileNM | 无 |
| check | ShirtFilled | SmileNM | ✓ |
| warn | ArmsCrossed | CalmNM | ⚠ |
| think | ShirtFilled | CalmNM | ? |
| affirm | Whatever | SmileNM | ✓ |
| cheer | ShirtFilled | SmileNM | 纸屑 |
| wave | ShirtFilled | SmileNM | 无 |

没有指向用的手臂。`point` 和 `wave` 都是站姿，靠朝向内容的镜像来读。

### 白衬衫族 `shirt`

站姿 `ButtonShirt`，端杯 `Coffee`，用电脑 `Geek`。

| pose | 身体 | 脸 | 图标 |
| --- | --- | --- | --- |
| explain | ButtonShirt | SmileNM | 无 |
| point | ButtonShirt | SmileNM | 无 |
| check | Geek | SmileNM | ✓ |
| warn | ButtonShirt | CalmNM | ⚠ |
| think | Geek | CalmNM | ? |
| affirm | Coffee | SmileNM | ✓ |
| cheer | ButtonShirt | SmileNM | 纸屑 |
| wave | ButtonShirt | SmileNM | 无 |

没有指向用的手臂。`explain`、`point`、`wave` 都是站姿。

## 动作

- 换姿势只在一句旁白开头，300ms 交叉淡入淡出，淡的过程里整体略缩 3%。
- 嘴在 850×1200 的 viewBox 里。半身的头不跟身体走。把 `Smile` 和 `SmileNM` 渲成位图做差，九个族内身体加上 `Explaining` 的差分完全一样，嘴带水平中心约 545。嘴心记一处：`(545, 411)`，在 `MOUTH_ANCHOR.default`。
- 卡通用整张 viewBox `0 0 850 1200`，不裁成圆。圆形 viewBox `90 -50 720 720` 只留给还需要头肩特写的场合，成片卡通不再用它。
- 闭嘴是一条微笑弧。张嘴是上唇略平、下唇圆的 D，宽 52–68、下唇深 8–32。幅度低于 0.1 时画弧。
- 有字的时刻按这个字的时间开合，幅度用字序号做稳定伪随机。标点和空隙闭嘴。句尾 120ms 收到 0。
- 眨眼用 `EyesClosed`，130ms，每 3–5 秒一次，只发生在没有发声字符的时刻。
- 呼吸是整体上下 ±3px，再加极轻的缩放，周期 3.2 秒。
- 四套风格的卡通都是同一高度的无框半身。真人圆窗才裁到头肩。
