# 真人视频导入（P1 技术样片）

现阶段用一支已经录好声音的本地 MP4，按页指定取用的片段和逐句时间，再用现有 `lesson.json` 出片。不会调用生成讲稿、在线配音或自动转写接口。讲稿文字必须与实际口播一致；时间映射由制作人员核对。

## 拍摄和素材

- 建议 1080p、30fps，时长 45–60 秒，稳定胸像、干净原声，画面和声音在同一个 MP4 中。横屏更易与课件合成；竖屏会按实际宽高比显示在画中画区域。
- 本次三页样片可录三段，每段约 15 秒，段间留约 2 秒，便于标出源片的起止时间。
- 请使用已获授权的人像和声音。测试图形与不同音调只验证导入、同步和渲染，不代表真人口型或画质效果。
- 目前仅接受本机 MP4；URL、网络共享路径、无音轨视频会被拒绝。源片放在输出目录之外，路径相对 `lesson.json` 所在文件夹解析，也可写本机绝对路径。

## 在现有讲稿中添加映射

在 `lesson.json` 的 `meta` 中增加 `presenter`。`segments` 按整个讲稿的页序排列，从 0 开始，每页一个。`startMs/endMs` 是源 MP4 中的绝对毫秒；每个 `sentences` 的时间是**该页片段内**的相对毫秒，并与该页 `narration` 逐句对应。
所有时间值用整数毫秒；各页源片段按时间递增且不交叠，句子在本页内按时间递增且不交叠。

```json
{
  "meta": {
    "presenter": {
      "kind": "video",
      "src": "presenter.mp4",
      "layout": "pip",
      "segments": [
        {"pageIndex": 0, "startMs": 0, "endMs": 14000,
         "sentences": [{"startMs": 0, "endMs": 6800}, {"startMs": 7200, "endMs": 13600}]},
        {"pageIndex": 1, "startMs": 16000, "endMs": 30000, "layout": "full",
         "sentences": [{"startMs": 300, "endMs": 7200}, {"startMs": 7600, "endMs": 13700}]},
        {"pageIndex": 2, "startMs": 32000, "endMs": 46000, "layout": "hidden",
         "sentences": [{"startMs": 100, "endMs": 13800}]}
      ]
    }
  }
}
```

`layout` 可为 `pip`（右下角画中画，默认）、`full`（以真人为主画面）、`hidden`（只用原声，不显示人像）。逐页可以覆盖默认布局。`hidden` 仍从同一源片提取并播放原声。

句子时间只确定讲稿每句话、卡片揭示和字幕的起止。句内字的时间由现有时间轴插值估计，**不是逐字 ASR 对齐**。每页保留现有的 400 ms 前留白和 800 ms 后留白，因此页间会插入停顿。源片剪点与 30fps 画面边界会有不超过约一帧的量化差异；字幕和音轨要通过样片逐段听看复核。

## 出技术对照样片

从仓库根目录执行；将 `lesson.json` 和授权的 `presenter.mp4` 放到仓库外同一个项目目录（或按 `src` 指定相对位置）。

```powershell
node scripts/lesson/validate-lesson.mjs ..\brewreel-studio-out\presenter-tech\lesson.json
node scripts/lesson/review-sheet.mjs ..\brewreel-studio-out\presenter-tech\lesson.json --out ..\brewreel-studio-out\presenter-tech\review
node scripts/lesson/make-lesson.mjs ..\brewreel-studio-out\presenter-tech\lesson.json --out ..\brewreel-studio-out\presenter-tech\video --no-bgm
```

第三条命令直接使用已确认的 `lesson.json`，不会重新生成大纲或讲稿。真人模式不接受 `--voice-provider`。输出中有 `video.mp4`、`subtitles.srt`、`timeline.json`、`sheet.png`、检查帧与 `manifest.json`；`manifest.presenter` 记录源片哈希、时间来源和缓存命中。原视频会规范化成 30fps MP4，按页从同一视频抽取 WAV；画面中的真人视频静音，声音只从 WAV 播放一次。缓存按源片 SHA-256、片段区间和转换参数区分，重渲相同映射不会重新抽音。

## 当前边界

- P1 仅支持 `meta.domain: "tech"`。法律领域真人片会直接拒绝；以后须把真人素材与律师复审记录绑定，不能沿用旧讲稿的占位审核。
- 不做自动转写、自动找剪点、口型修正或抠像。需要人工核对讲稿与口播内容及逐句时间。
- 若只是改版式或重渲已确认稿，直接重复 `make-lesson.mjs` 命令。不要运行 `studio.mjs`，因为它会重新调用模型生成大纲与讲稿。
