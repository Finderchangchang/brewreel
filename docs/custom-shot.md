# 强模型的自由镜头

便宜模型不要用 custom。便宜模型继续只挑镜头、填文字。

这一节给会写代码的模型（Codex、Claude Code 这类）。模板镜头保住下限，也封住了上限。你想自己画一镜时，用 `custom`：分镜里只留这一镜的文字和数字，画面写在片子目录的组件里。

只在本地技能模式开放。DeepSeek 插件看到 `custom` 会直接拒绝，原话是：自由镜头只能在本地用，插件里不运行模型自己写的代码。

## 什么时候用

- 现有镜头做不到你要的那一下动作，而且你能自己写 React。
- 只要换一句文案、改一个已有字段，不要用 custom，继续填表。

## 分镜

和 `storyboard.json` 同级建 `shots/名字.tsx`。不要把组件放进 `template/`。

```json
{
  "type": "custom",
  "dur": 4,
  "caption": "先留这一句，\n{少一步}",
  "mood": 0.4,
  "component": "shots/keyword-toss.tsx",
  "slots": {"keyword": "少一步"}
}
```

- `component` 只能是 `shots/` 加文件名，后缀 `.tsx`。不要写 `..` 或绝对路径。
- `slots` 放这一镜要上屏的文字和数字。可以嵌套，最多 4 层。
- `params` 不要写。写了也不会传给组件。
- 字幕、广告法、带单位的数字、slots 里的纯数字，和别的镜头走同一套校验。效果数字（`from` / `to` / `value` / `percent` / `delta`）必须在 `meta.facts` 里有真来源，标了示例的 fact 不算。

## 组件拿到什么

```tsx
import {CutShape, FONT, fitLine, toss, type CustomShotProps} from '../../custom-api';

export default function KeywordToss({slots, theme, geo, t, dur, frame, fps, frames, lang, beat, index}: CustomShotProps) {
  const word = typeof slots.keyword === 'string' ? slots.keyword : '';
  const pose = toss(520).at(t);
  return (
    <div style={{position: 'absolute', left: geo.safe.x0 + 40, top: geo.safe.y0 + 200}}>
      <CutShape seed={1} w={520} h={220} fill={theme.card}>
        <div style={{fontFamily: FONT, fontSize: fitLine(word, 400, 72, 40), color: theme.cardText}}>{word}</div>
      </CutShape>
    </div>
  );
}
```

`props`：

| 字段 | 是什么 |
|---|---|
| `slots` | 分镜里写的文字和数字 |
| `theme` | 当前主题令牌（`card`、`cardText`、`accent`、`accentInk`、`line` …） |
| `geo` | 画幅几何：`safe`、`card`、`cap` |
| `frame` / `fps` / `t` / `dur` / `frames` | 镜头内帧号、帧率、秒、时长、总帧数 |
| `lang` | `zh` 或 `en` |
| `beat` | 一拍多少秒 |
| `index` | 镜头下标，从 0 起 |

`../../custom-api` 在出片拷贝之后才指向 `template/src/shots/custom-api.ts`。作者就按这个相对路径写。

可以从 `custom-api` 拿到：

- 字体 `FONT` / `SERIF` / `MONO`，`fitLine` / `fitSize`
- 安全区 `SAFE` / `CARD` / `CAP` / `MAIN`，`geometryOf`
- `useTheme`、`alpha`、`mixHex`、`toneColor`、`moodColors`
- 纸纹 `PaperGrain`、手剪形状 `CutShape`、纸屑 `Confetti`
- `toss` / `entrance` / `leave`、`floatMotion`、`settle`、`shadowByHeight`

另外只允许 `import` `react`、`remotion`，或同目录的 `./` 辅助文件。不要直接去引 `template/src/core` 或别的正式镜头。

## 字为什么必须放 slots

广告法、数字出处、字数校验只看分镜，看不到你写进 JSX 的句子。出片前会扫组件源码：JSX 和字符串里的中文、英文句子（两个以上单词）、直接渲染的数字（`{12}`、标签文本里的数字）都报错，带文件和行号。改法是挪进 slots。

坐标、`style` 里的数字、`seed` / `opacity` / `width` 这类属性、函数体里的计算，不算写死的文案。

## 怎么出片

和普通片子同一条命令。Remotion 只打包 `template/src`，所以出片时会：

1. 先扫 `shots/*.tsx`。有写死的字就停下，不渲染。
2. 拿到渲染锁之后，把 `shots/*.tsx` 拷到 `template/src/shots/_custom/<片子哈希>/`（这个目录在 `.gitignore` 里）。
3. 生成注册表，跑 `tsc --noEmit`。类型错误按原来的文件和行号报，不进渲染。
4. 渲染。组件抛错、字超出安全区、整屏空帧，都算到具体那一镜。动效停死用口播那套帧差（只量主体区）再查一遍。
5. 出片结束把拷贝删掉，注册表还原成空的。

样例：`examples/custom/storyboard.json`（关键词抛起落定 + 一条自己画的数字条）。

## 常见报错

| 报错 | 原因 |
|---|---|
| `shots/某.tsx:12:3` 写死了文字，怎么改：挪进 slots | JSX 或字符串里有中文 / 英文句子 |
| `第 N 镜（custom）shots/某.tsx(10,7): error TS…` | 类型不对。看这一行，不要改 template |
| `第 N 镜（custom）shots/某.tsx:8：boom` | 渲染时组件抛错。行号在文件里 |
| `第 N 镜（custom）…出了 x150–930（组件 shots/某.tsx:9）` | 字画出了安全区 |
| `第 N 镜（custom）…动效停死` | 这一镜有 0.4 秒几乎不动。加持续的位移，不要只靠很小的浮动 |
| `自由镜头只能在本地用，插件里不运行模型自己写的代码` | 在插件里用了 custom。改回本地跑，或换成模板镜头 |
