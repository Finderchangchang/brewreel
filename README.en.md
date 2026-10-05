<div align="center">

<img src="docs/images/logo.png" width="150" alt="BrewReel · 精酿" />

# BrewReel · 精酿

**Brew great promo reels with low-cost models: write a product brief, let the AI pick the shots and write the copy, and render a vertical promo video with one command.**

[![Version](https://img.shields.io/badge/version-v0.8.0-1f6feb?style=flat-square)](CHANGELOG.en.md)
[![Stars](https://img.shields.io/github/stars/Finderchangchang/brewreel?style=flat-square&logo=github&label=Stars)](https://github.com/Finderchangchang/brewreel/stargazers)
[![License](https://img.shields.io/github/license/Finderchangchang/brewreel?style=flat-square)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4D6BFE?style=flat-square)](#use-it-in-deepseek-harness)

<img src="docs/images/readme-hero.gif" width="720" alt="BrewReel demo" />

[Website](https://brewreel.com/en.html) · [Quick start](#quick-start) · [Demo video](https://github.com/Finderchangchang/brewreel/releases/download/v0.3.0/demo-5MB.mp4) · [First video guide](https://brewreel.com/guides/first-promo-video.en.html) · [中文](README.md)

<sub>Formerly promo-video-skill / Distill Video (蒸馏视频); old links redirect automatically.</sub>

</div>

## Quick start

You need Node.js 18+ and Python 3.10+; on Windows, x64 only.

**1. Install dependencies.**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy imageio-ffmpeg
```

**2. Run a sample to check the setup.**

```bash
node scripts/validate.mjs examples/en-focus.json
node scripts/make.mjs examples/en-focus.json --out ../brewreel-out/en-focus
```

Rendering takes a few minutes; the last terminal line is `交付：<mp4 path>` ("delivered"). `--out` must not point inside the repo.

**3. Let the AI write the storyboard.** Clone the whole repo into `~/.claude/skills/brewreel/` (Claude Code) or `~/.agents/skills/brewreel/`, hand the assistant a brief (template: [`brief-template.md`](brief-template.md); English templates per industry are in `industries/<id>/brief-template.en.md`) and let it follow `SKILL.md`. No agent needed if you prefer: `python scripts/llm_make.py path/to/brief.md` calls an OpenAI-compatible API such as DeepSeek directly.

Environment variables, the platform support table and system requirements are in [Install and get started](docs/quickstart.en.md).

### Use it in DeepSeek Harness

This repository ships a DeepSeek Harness plugin, `dsh-brewreel`; the model validates, renders and verifies through the plugin's tools. It needs dsh 0.1.7-rc.2 or later within 0.1.x:

```bash
npm install -g @deepseek-ai/dsh@0.1.7-rc.2 pnpm    # if dsh is not installed yet
dsh plugin --profile web add dsh-brewreel
dsh web
```

The plugin has not yet been tested against a real DeepSeek model. The 7 tools, security notes and the license note are in [Install and get started](docs/quickstart.en.md#use-it-in-deepseek-harness).

## What it does

<table align="center">
<tr>
<td align="center"><img src="docs/images/style-cards.png" width="260" alt="cards recipe" /><br/><sub><b>cards</b> (default)</sub></td>
<td align="center"><img src="docs/images/style-quiz.png" width="260" alt="quiz recipe" /><br/><sub><b>quiz</b></sub></td>
<td align="center"><img src="docs/images/style-journey.png" width="260" alt="journey recipe" /><br/><sub><b>journey</b></sub></td>
</tr>
</table>

- **Three recipes**: pick `cards` (default), `quiz` or `journey` with `meta.style` in the storyboard. One multiple-choice question → `quiz`; 4–6 categories to tour → `journey`; everything else → `cards`.
- **Six industry packs**: software, food, physical goods, adult vocational training, non-medical beauty, travel and lodging, each with compliance rules, a recommended shot structure and a brief template.
- **Voice-over**: MiniMax, Alibaba Cloud or Volcengine. Shot durations follow the narration, subtitles light up word by word, and the music ducks under speech.
- **Data chart shot**: 5 chart types (bar, line, dot, stacked, donut); every value on the chart must appear in the cited fact. See [`docs/shots/dataChart.en.md`](docs/shots/dataChart.en.md).
- **18 themes**: 6 default themes for cards plus 12 optional palettes; existing storyboards render unchanged unless you pick one. See [`styles/cards/THEMES.md`](styles/cards/THEMES.md).
- **Validation and compliance**: dozens of checks for ad-law superlatives, industry rules, line wrapping, safe areas and number sources. A video with a ✗ in its self-check is not delivered.
- **Music and captions**: music is synthesized on the spot and hits the shot cuts, so there are no copyright issues; captions can be Chinese or English.
- **Talking-head B-roll (experimental)**: drop in a real talking-head video and one command, `node scripts/talk.mjs`, transcribes it locally, picks the lines and adds pictures. Two kinds: free motion cards (keyword, checklist, steps, counter, compare; every word copied from the speech) and, by default, at most 2 AI-generated clips (wood blocks and three other styles; cost is estimated first and a person reviews them; in this release the four styles have no reference images yet, so AI clips are stand-in previews only, while motion clips render normally). Local transcription uses the SenseVoice model (FunAudioLLM / Alibaba Tongyi Lab). See [Talking-head B-roll](docs/broll.en.md).

<p align="center"><img src="docs/images/chart.png" width="720" alt="Data chart shot" /></p>
<p align="center"><img src="docs/images/themes.png" width="720" alt="12 optional palettes" /></p>

Details for each item are in [Features](docs/features.en.md); screenshots of the six industries and more samples are in [Screenshots](docs/gallery.en.md).

## Why BrewReel

- **The cheap model only does what it's good at.** It writes one `storyboard.json`: pick shots, fill in text. No code, no coordinates. Layout, motion and pacing live in ready-made components.
- **A strong model tunes the recipe first.** Each style is first made right by a strong model, then written down as components and validation rules. The cheap model follows the recipe, and the recipe holds the quality bar.
- **Compliance red lines are checked first.** Every error says which shot and field to fix; validate → music → render → check frames runs as one command.
- **Open source, commercial use allowed.** Apache-2.0, just credit the source. Rendered videos don't require attribution.

## Docs

- [Install and get started](docs/quickstart.en.md): platform support, system requirements, full install, running it with a cheap model, the DeepSeek Harness plugin
- [Features](docs/features.en.md): three recipes, voice-over, industry packs, validation and compliance, recipe crafting and the originality check, render QA
- [Screenshots](docs/gallery.en.md): real renders of the three recipes, six industries and more samples
- [How it works](docs/how-it-works.en.md): the flow from brief to video, directory structure
- [Talking-head B-roll](docs/broll.en.md): motion cards and AI clips on a real talking-head video (experimental): one command, transcription, price, review
- [FAQ](docs/faq.en.md): music, voice-over, Remotion licensing, Windows, ffmpeg, download failures and more
- [Known limitations](docs/limitations.en.md): test scores, open problems, test method and results by round
- [First video guide](https://brewreel.com/guides/first-promo-video.en.html) · [Product brief template](https://brewreel.com/guides/product-brief.en.html) (website)
- [Changelog](CHANGELOG.en.md) · [Releases](https://github.com/Finderchangchang/brewreel/releases) · [Contributing](CONTRIBUTING.en.md)

## Known limitations

- **Still a preview**: we don't yet recommend publishing a video as rendered, without human edits. Treat it as a first draft: watch it through, edit, then publish.
- **Cheap-model results are not yet "fine to publish as is"**: in the latest round none of 9 videos reached 7, losing most points on cross-field factual problems (price conditions, made-up distances) and copy quality.
- **Some integrations not yet tested for real**: Alibaba Cloud and Volcengine voice-over have not been run with a real key; the DeepSeek Harness plugin has not been tested against a real DeepSeek model.
- **Illustrations only without real photos**; not supported: medical aesthetics, prescription drugs / medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco.

The full list, test method and results by round are in [Known limitations](docs/limitations.en.md).

## Community / feature requests

**For contact, please send a private message to our WeChat Official Account.** Partnerships, sponsorship and feedback all go there. There is no dedicated BrewReel chat group yet.

<p align="center"><img src="docs/images/contact/wechat-mp.png" width="180" alt="WeChat Official Account QR code" /></p>

**Bug reports go to [GitHub Issues](https://github.com/Finderchangchang/brewreel/issues)**: validation rules that block too much or too little, render errors, frames that look wrong. Attaching the storyboard JSON and the error output helps most (never paste an API key).

We want to hear real needs: what product do you want a video for? Which recipe or industry is missing? Which compliance rule got in your way? Message the Official Account or open an issue.

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
- The fonts Noto Sans SC and Cascadia Mono are licensed under the SIL Open Font License 1.1; the full license text ships alongside each font under `template/public/fonts/`.

**Scope of use**: the rules in `industries/` and the validation scripts are compiled from public regulations and platform rules for self-checking only. They **are not legal advice** and are not guaranteed to cover every platform's latest rules. Whether published content is compliant is governed by the latest rules from regulators and platforms at the time; the publisher is solely responsible.

## ❤️ Sponsors

> Want to appear here? Add me on WeChat: **jskjkf007**, and include the note "BrewReel 商务合作" (BrewReel business) in your request.

## ☕ Buy me a coffee

If BrewReel saved you an evening of video editing, feel free to buy me a coffee. Every recipe here was brewed on a lot of coffee: keep the cup filled and the next recipe comes sooner. If a new style suddenly shows up in the repo one day, this cup probably helped 😄

<p align="center">
  <img src="docs/images/contact/wechat-donate-v3.png" width="260" alt="WeChat appreciation QR code (name hidden)" />
</p>

<p align="center"><sub>Only if it's easy for you, no pressure. A Star, an issue, or showing me a video you brewed makes me just as happy.</sub></p>
