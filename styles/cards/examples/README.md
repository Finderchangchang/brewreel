cards 风格的样例放在仓库根目录 `examples/`（9 份，都能直接通过校验并出片）。

本目录另有一份配音样例：`voice-reminder.json`（「记得住」一句话建日程，5 镜约 22 秒）。每镜一句 `vo`：hook 保留 `caption` 当封面、旁白只念；compare / mockApp / steps 不写 `caption`，字幕由 `vo` 逐字生成；endCard 只念不出字幕。`meta.voice.provider` 写的是 `minimax`，出片要环境变量 `MINIMAX_API_KEY`；**没有 key 时用 `--voice-provider mock` 或把 provider 改成 `mock` 预览**（占位音只看节奏，不能交付）：

```
node scripts/make.mjs styles/cards/examples/voice-reminder.json --out <仓库外目录> --voice-provider mock
```
