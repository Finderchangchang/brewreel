<div align="center">

<img src="docs/images/logo.png" width="120" alt="BrewReel · 精酿" />

# BrewReel · 精酿

**Even a cheap model can produce a usable video: give it the material, and one command renders the file.**

[![Version](https://img.shields.io/badge/version-v0.14.0-1f6feb?style=flat-square)](CHANGELOG.en.md) [![Stars](https://img.shields.io/github/stars/Finderchangchang/brewreel?style=flat-square&logo=github&label=Stars)](https://github.com/Finderchangchang/brewreel/stargazers) [![License](https://img.shields.io/github/license/Finderchangchang/brewreel?style=flat-square)](LICENSE) [![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4D6BFE?style=flat-square)](#use-it-in-deepseek-harness)

[Why BrewReel](#why-brewreel) · [Quick start](#quick-start) · [Promo videos](#promo-videos) · [Talking-head B-roll](#talking-head-b-roll) · [Lesson video](#lesson-video) · [Docs](#docs) · [中文](README.md)

<img src="docs/images/readme-modes.en.png" width="860" alt="Promo, talking-head B-roll, and lesson video" />

**Promo**: a product brief → a vertical promo (9:16)
**Talking-head B-roll**: a talk, `talk.mp4` → the talk with pictures (motion cards / AI clips)
**Lesson**: a script or a brief → a 16:9 lesson (a vertical cut is optional)
<sub>Formerly promo-video-skill / Distill Video (蒸馏视频); old links redirect automatically.</sub>

</div>

## Why BrewReel

**The cheap model only fills in a form. It does not write code.** A promo fills in `storyboard.json`, a talk fills in `broll.json`, a lesson fills in `lesson.json`: pick a layout, fill in the words. That is why a cheap model such as DeepSeek can still produce a video that passes the checks.

**Compliance and the quality checks run first.** Advertising-law wording, industry rules, where a number came from, layout, and motion that freezes: if one check fails, the video is not delivered.

**Open source, commercial use allowed.** Apache-2.0. Credit the source when you distribute it. Rendered videos do not require attribution.

## Quick start

**Install the dependencies.**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy imageio-ffmpeg
```

**Promo** (`examples/ledger.json`)

```bash
node scripts/validate.mjs examples/ledger.json
node scripts/make.mjs examples/ledger.json --out ../brewreel-out/ledger
```

Validation runs first, then the render, which takes a few minutes. The last line is `交付：<mp4 path>` ("delivered"). `--out` must not point inside the repo. This sample's captions are Chinese.

**Talking-head B-roll**

```bash
node scripts/talk.mjs path/to/project --out ../brewreel-out/talk
```

Put `talk.mp4` in the project folder. Transcription runs on your machine. Motion cards are drawn for real. AI clips start as stand-ins and cost nothing.

**Lesson** (`examples/lesson/mascot-demo.json`, mock voice)

```bash
node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-out/first-lesson --voice-provider mock --no-bgm
```

Mock voice is for layout and pacing, and it does not bill a voice provider. On success the last line starts with `交付：`.

You need Node.js 18+ and Python 3.10+. On Windows, x64 only. Platforms, environment variables and the full write-up are in [Install and get started](docs/quickstart.en.md).

## Promo videos

<p align="center"><img src="docs/images/readme-hero.gif" width="720" alt="cards, data chart, quiz and journey" /></p>

**You give**: a product brief.

**You get**: a vertical promo (9:16; `journey` defaults to 4:5).

**One command**: `node scripts/make.mjs examples/ledger.json --out ../brewreel-out/ledger`

- 3 recipes: `cards` (the default, 9:16), `quiz` (9:16), `journey` (4:5 by default, 9:16 also works).
- 6 industries: software, food, physical goods, adult vocational training, non-medical beauty, travel and lodging. Each pack has advertising-law and industry rules. Not supported: medical aesthetics, prescription drugs / medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco.
- Voice-over can be MiniMax, Alibaba Cloud or Volcengine. Shot lengths follow the narration, subtitles light up word by word, and the music ducks under speech.
- Data charts: bar, line, dot, stacked and donut. Every number on the chart must appear in the cited fact. See [dataChart](docs/shots/dataChart.en.md).
- A video with a ✗ in its self-check is not delivered. Music is synthesized on the shot cuts. Captions can be Chinese or English. cards has 6 default themes and 12 optional ones: [palettes](styles/cards/THEMES.md).

Details → [Features](docs/features.en.md)

## Talking-head B-roll

<p align="center"><img src="docs/images/talk-intro.png" width="720" alt="Talking-head B-roll diagram, no real person on screen" /></p>

<p align="center"><a href="https://github.com/Finderchangchang/brewreel/releases/download/v0.9.0/brewreel-v0.9.0-talk-demo.mp4">Watch the demo</a></p>

**You give**: a talk, `talk.mp4`.

**You get**: the talk with pictures. Motion cards are free. AI clips are estimated first, then a person approves them.

**One command**: `node scripts/talk.mjs path/to/project --out ../brewreel-out/talk`

- Transcription runs locally with SenseVoice (FunAudioLLM / Alibaba Tongyi Lab), via sherpa-onnx. An existing `talk.srt` is never overwritten.
- Five motion cards: keyword, checklist, steps, counter, compare. The words must be copied from the speech, and the script checks them character by character. These cards do not cost money.
- Cards follow the main style's colours by default. Add `--motion-look cutpaper-meadow` or `cutpaper-dusk` for a cut-paper look: paper grain and hand-cut cards that toss up on a key word and land. Still free. See [Motion looks](docs/motion-looks.en.md).
- AI clips use MiniMax H3. The whole video shares one robot, described in `broll/character.json`: wood blocks (`wood-blocks`, the default), clay stop-motion (`clay-stopmotion`) and layered paper (`paper-layers`). Ink sketch (`ink-sketch`) only works as a stand-in preview. At most 2 AI clips by default.

**Style factory.** One sentence describes an AI-picture style. The script writes the config, generates reference images, scores them and makes one still. The vision check gets things wrong. A person looks last. That person runs `node scripts/broll/approve-style.mjs <id>`. An AI assistant must not run it. Pull requests that bring back an approved style are welcome. See [Style factory](docs/style-factory.en.md).

**Cost and a person's approval**: for AI clips, `--provider minimax-h3 --dry-run` only prints the estimate. Add `--yes` to generate. The final video needs a person to run `node scripts/broll/approve.mjs <project> --out <dir-outside-the-repo>`. `talk.mjs` never runs it. Only a person can run the approve command.

Details → [Talking-head B-roll](docs/broll.en.md)

## Lesson video

<p align="center"><img src="docs/images/lesson-layouts.webp" width="720" alt="Four lesson layouts: statute card, compare, flow, big number" /></p>

**You give**: a script, `lesson.json`, or a brief.

**You get**: a 16:9 lesson. Vertical clips and covers are optional.

**One command**: `node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-out/first-lesson --voice-provider mock --no-bgm`

- 20 layouts and 4 themes: `paper` (the legal-education default), `lecture` (the default otherwise), `product`, and `editorial` (hand-picked only, not for legal education).
- A presenter and a brand frame are optional. The preset cartoons are free. A lesson renders with no brand written in.
- Run the same output directory again after you edit one page. Unchanged pages are reused.
- A legal-education lesson does not render without a valid review record. A tech lesson does not require one. An AI assistant cannot sign the review.
- Domain packs: `tech` for a technical lesson, `legal` for legal education. Legal quotes are filled only from the checked Civil Code corpus.

**Cost and a person's approval**: building a character from a photo needs that person's consent. The photo is sent to MiniMax for recognition, and that costs money. Do not run it unless someone asked for it this time. An unconfirmed character cannot be used in a final video. Only a person can confirm it.

Details → [Lesson video](docs/lesson.en.md)

## Let an AI assistant do it

For Claude Code, put the repo at `~/.claude/skills/brewreel/`. For Codex and the others, put it at `~/.agents/skills/brewreel/`. Say what you want. The top of the skill routes the request to a promo, talking-head B-roll, or a lesson.

- **Change something in one sentence**: `node scripts/revise.mjs <storyboard/lesson/broll.json> "slow down shot 3, open with a question"`. A low-cost model changes only what you asked, validates it, and renders stills of the changed promo shots first. See [quickstart](docs/quickstart.en.md).
- **Tweaks**: `meta.tweak` in a promo storyboard sets pace, text size and heading font; any shot can take a background image. See [features](docs/features.en.md).
- **Custom shots for strong models**: Codex or Claude Code can write one promo shot as their own animation (`custom`); the text still comes from the storyboard and validation still runs. Low-cost models should not use it. See [custom shots](docs/custom-shot.en.md).

### Use it in DeepSeek Harness

The repo ships a plugin, `dsh-brewreel`. Seven tools validate, render and check promo videos. The registered skill also routes the other jobs: talking-head B-roll writes `broll.json` and runs `scripts/talk.mjs`; the style factory reads `docs/style-factory.md` and runs `scripts/broll/new-style.mjs`; a lesson reads `lesson/SKILL-lesson.md` and runs `scripts/lesson/make-lesson.mjs`. Those three do not go through the seven tools. Install and version requirements: [Install and get started](docs/quickstart.en.md#use-it-in-deepseek-harness).

## Docs

| Doc | What it covers |
|---|---|
| [Install and get started](docs/quickstart.en.md) | Platforms, setup, the talk command, the style factory, DeepSeek Harness |
| [Features](docs/features.en.md) | Recipes, voice-over, industries, validation |
| [Talking-head B-roll](docs/broll.en.md) | One talk, with motion cards or AI clips |
| [Style factory](docs/style-factory.en.md) | One sentence drafts an AI-picture style; a person approves it |
| [Lesson video](docs/lesson.en.md) | An explainer, a course, legal education, or a tutorial |
| [Motion looks](docs/motion-looks.en.md) | Cut-paper and other looks for motion cards |
| [Screenshots](docs/gallery.en.md) | Frames from the three promo recipes |
| [How it works](docs/how-it-works.en.md) | From a brief to a delivered file |
| [FAQ](docs/faq.en.md) | Music, setup, and problems while rendering |
| [Known limitations](docs/limitations.en.md) | Why a render is still a draft, and how it was tested |
| [Changelog](CHANGELOG.en.md) | What changed in each version · [Releases](https://github.com/Finderchangchang/brewreel/releases) |
| [Contributing](CONTRIBUTING.en.md) | How to send a promo recipe |

Website: [First video guide](https://brewreel.com/guides/first-promo-video.en.html) · [Product brief template](https://brewreel.com/guides/product-brief.en.html). The general template in the repo: [brief-template.md](brief-template.md).

## Known limitations

- **Still a preview.** We do not recommend publishing a video as rendered, without a person editing it. Treat it as a first draft: watch it, edit, then publish.
- **Some integrations have not been run for real.** Alibaba Cloud and Volcengine voice-over have not been run with a real key. The DeepSeek Harness plugin has not been tested against a real DeepSeek model. MiniMax voice-over has been rendered with a real key.
- **Illustrations only, if you have no live photos.** Not supported: medical aesthetics, prescription drugs / medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco.

The test method and the open problems are in [Known limitations](docs/limitations.en.md).

## Community / feature requests

**For contact, please send a private message to our WeChat Official Account.** Partnerships, sponsorship and feedback all go there. There is no dedicated BrewReel chat group yet.

<p align="center"><img src="docs/images/contact/wechat-mp.png" width="180" alt="WeChat Official Account QR code" /></p>

**Bug reports go to [GitHub Issues](https://github.com/Finderchangchang/brewreel/issues)**: validation rules that block too much or too little, render errors, frames that look wrong. Attaching the storyboard JSON and the error output helps most (never paste an API key).

We want to hear real needs: what product do you want a video for? Which recipe or industry is missing? Which compliance rule got in your way? Message the Official Account or open an issue.

## ❤️ Sponsors

> Want to appear here? Add me on WeChat: **jskjkf007**, and include the note "BrewReel 商务合作" (BrewReel business) in your request.

## ☕ Buy me a coffee

If BrewReel saved you an evening of video editing, feel free to buy me a coffee. Every recipe here was brewed on a lot of coffee: keep the cup filled and the next recipe comes sooner. If a new style suddenly shows up in the repo one day, this cup probably helped 😄

<p align="center">
  <img src="docs/images/contact/wechat-donate-v3.png" width="260" alt="WeChat appreciation QR code (name hidden)" />
</p>

<p align="center"><sub>Only if it's easy for you, no pressure. A Star, an issue, or showing me a video you brewed makes me just as happy.</sub></p>

## Sister projects

Open-source projects by the same author, under the [jev-chat](https://github.com/jev-chat) organization:

- [Jev chat assistant (Jev 聊天助手)](https://github.com/jev-chat/jev-chat-jarvis): a "conversation co-pilot" on your phone. In supported chat apps it helps you read the other person, suggests replies and fills them into the input box; whether to send is up to you.
- [Jev chat assistant for macOS](https://github.com/jev-chat/jev-chat-jarvis-mac): a floating window that reads WeChat message intent: it looks at the screen, a local small model judges intent and risk, then it drafts reply candidates. Read-only.
- [Jev chat assistant for Windows](https://github.com/jev-chat/jev-chat-windows): a reply helper that sits beside WeChat for Windows 4.x: window screenshot + local offline OCR, 3 candidates filled in with one click, and sending is always manual.

## Copyright and license

Copyright © 2026 Finderchangchang. The code is released under the [Apache-2.0](LICENSE) license; see also [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

- **Commercial use is allowed**: individuals and companies may use, modify and redistribute it, or build it into their own products, with no fee and no prior permission.
- **Credit the source**: under Section 4 of Apache-2.0, if you distribute this project, a modified version, or a product that includes it, keep `LICENSE` and carry the attribution in `NOTICE` in your own NOTICE file, documentation or product UI. Suggested wording: `Based on BrewReel (精酿, https://github.com/Finderchangchang/brewreel)`.
- Don't use the names "BrewReel" or "精酿" or the brewreel.com domain to imply that your work is made or endorsed by the original author.
- **Videos rendered with this project do not require attribution.**
- **Remotion is not open source**: for-profit organizations with 4 or more people must purchase Remotion's Company License, and this repo's Apache-2.0 license doesn't change that; see <https://www.remotion.dev/license>.
- The fonts Noto Sans SC and Cascadia Mono, and the lesson fonts BrewReel Serif and BrewReel Kai (subsets of Noto Serif SC and LXGW WenKai), are licensed under the SIL Open Font License 1.1. The full license text ships with the fonts under `template/public/fonts/`.

**Scope of use**: the rules in `industries/` and the validation scripts are compiled from public regulations and platform rules for self-checking only. They **are not legal advice** and are not guaranteed to cover every platform's latest rules. Whether published content is compliant is governed by the latest rules from regulators and platforms at the time; the publisher is solely responsible.

## Acknowledgements

- The talking-head B-roll idea comes from [erduo1998-cell/vidmuse-video-creator](https://github.com/erduo1998-cell/vidmuse-video-creator): our way of reading the captions and picking lines for explainer shots is a rewrite of its method.
- Local transcription uses [SenseVoice](https://github.com/FunAudioLLM/SenseVoice) (FunAudioLLM / Alibaba Tongyi Lab), run with [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).
- Videos are composed with [Remotion](https://www.remotion.dev/).
- Three v0.12 changes borrow ideas from [alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion): route the request at the top of the skill, list what not to pick next to each choice, and use frame differences to catch motion that freezes or flickers. Ideas only; the code is our own.
- Licenses: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
