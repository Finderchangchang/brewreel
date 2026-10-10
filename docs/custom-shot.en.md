# Free shots for strong models

Cheap models must not use `custom`. 便宜模型不要用 custom. Keep picking a shot type and filling in text.

This page is for models that can write code. A `custom` shot is one scene whose picture you draw yourself. The storyboard only holds the words and numbers for that scene. The component lives next to `storyboard.json`, never inside `template/`.

It is local skill mode only. The DeepSeek plugin rejects `custom` with: 自由镜头只能在本地用，插件里不运行模型自己写的代码.

## When to use it

Use it when no built-in shot can do the motion, and you can write the React yourself. If you only need to change a sentence or a field that already exists, do not use `custom`.

## Storyboard

```json
{
  "type": "custom",
  "dur": 4,
  "component": "shots/keyword-toss.tsx",
  "slots": {"keyword": "少一步"}
}
```

- `component` is `shots/<name>.tsx` only. No `..`, no absolute path.
- `slots` is every word and number that appears on screen. Nesting maxes out at 4 levels.
- Do not put copy in `params`. Params are not passed to the component.
- Captions, ad-law words, numbers with units, and bare numbers inside `slots` go through the same checks as other shots. Effect numbers (`from`, `to`, `value`, `percent`, `delta`) need a real `meta.facts` entry. A fact you marked as a sample does not count.

## What the component receives

Import from `../../custom-api`. That relative path is correct after the render step copies the file.

Props: `slots`, `theme` (card, cardText, accent, accentInk, line, …), `geo` (safe, card, cap), `frame`, `fps`, `t`, `dur`, `frames`, `lang`, `beat`, `index`.

Allowed imports: `react`, `remotion`, `../../custom-api`, and a `./` helper in the same `shots/` folder.

`custom-api` re-exports fonts, `fitLine` / `fitSize`, safe-area geometry, `useTheme`, and the talk motion kit: `PaperGrain`, `CutShape`, `Confetti`, `toss`, `entrance`, `leave`, `floatMotion`, `settle`, `shadowByHeight`.

## Why words have to live in slots

Ad-law, number provenance, and length checks only see the storyboard. Before render, the source is scanned. Hard-coded Chinese, an English sentence (two or more words), or a number rendered as JSX (`{12}`, or digits in JSX text) is an error with file and line. The fix is: move it into `slots`.

Numbers that are coordinates, `style` values, or allow-listed attributes (`seed`, `opacity`, `width`, …) are fine. So are numbers used only as math in the function body.

## How a render packages it

Remotion bundles `template/src` only. On render the pipeline:

1. Scans `shots/*.tsx`. Hard-coded copy stops the run before render.
2. After the render lock, copies `shots/*.tsx` to `template/src/shots/_custom/<film hash>/` (gitignored).
3. Writes a registry and runs `tsc --noEmit`. A type error is reported at the original file and line. No render.
4. Renders. A thrown error, text outside the safe area, or a run of blank frames is attributed to that shot. The freeze check from the talk motion checker runs on the main rect of each free shot.
5. Deletes the copy and restores the empty registry.

Example: `examples/custom/storyboard.json` (a cut-paper keyword toss, and a hand-drawn growing bar).

## Errors you will see

| Message | Meaning |
|---|---|
| `shots/name.tsx:12:3` … 挪进 slots | Chinese, an English sentence, or a rendered number is hard-coded |
| `第 N 镜（custom）shots/name.tsx(10,7): error TS…` | TypeScript failed at that line |
| `第 N 镜（custom）shots/name.tsx:8：…` | The component threw during render |
| `出了 x150–930（组件 shots/name.tsx:9）` | Text left the safe area |
| `动效停死` | A 0.4s window barely moved. Keep a real motion going; a tiny float is not enough |
| `自由镜头只能在本地用，插件里不运行模型自己写的代码` | `custom` was used inside the plugin |
