# promo-video-skill

[中文版 → README.md](README.md)

Author: **Liu Weijie (柳伟杰)** — GitHub [@Finderchangchang](https://github.com/Finderchangchang). If you redistribute, fork or use this commercially, please keep `LICENSE` and `NOTICE` and credit the source.

> **Early preview**: testing and bug-fixing are still ongoing. Issues about false-positive rules, rendering problems and general feedback are very welcome.

One line: a skill for AI coding assistants (Claude Code / Codex / opencode…) that standardizes "write a storyboard → get a vertical promo video." A cheap model only writes one `storyboard.json`; fixed Remotion components draw the frames; a validator blocks hard rules and industry-compliance red lines; one command renders the final video (1080×1920, with original music and sound effects).

## 30-second overview

1. You (or the AI) turn a merchant brief into `storyboard.json` (pick shots, fill in text — no code, no coordinates).
2. `node scripts/validate.mjs storyboard.json` validates it: hard rules and ad-law / industry compliance red lines are caught with a report you can act on.
3. `node scripts/make.mjs storyboard.json --out <dir>` renders in one command: music → render → contact sheet → check frames, fully automated.

## Examples

Each image shows frame 0 (the cover) on the left and one frame from the middle on the right. The storyboards are in `examples/`; the products and numbers are fictional, and every one passes validation and renders with `make.mjs` as-is.

| Software · relationship chat (jev) | Software · budgeting (ledger) | Software · meeting notes (meeting) |
| --- | --- | --- |
| ![jev](docs/images/jev.png) | ![ledger](docs/images/ledger.png) | ![meeting](docs/images/meeting.png) |
| **English captions (en-focus)** | **Food launch (food)** | **Physical goods (ecommerce)** |
| ![en-focus](docs/images/en-focus.png) | ![food](docs/images/food.png) | ![ecommerce](docs/images/ecommerce.png) |
| **Education course (education)** | **Beauty, no real photos (beauty)** | **Travel & lodging (travel)** |
| ![education](docs/images/education.png) | ![beauty](docs/images/beauty.png) | ![travel](docs/images/travel.png) |

## What it does and doesn't do

**Does**: vertical promo videos for six industries — software products, food & beverage, physical-goods ecommerce, adult vocational education, beauty (non-medical), and travel/lodging; Chinese or English captions; 11 general-purpose shots plus 7 industry shots (real photo, price card, store card, review card, before/after, fact sheet, credential card); dozens of built-in checks covering ad-law superlatives, industry compliance red lines, line-wrap/orphan-word issues, and safe-area layout.

**Does not** (these categories aren't covered by the compliance rules, so results aren't guaranteed compliant even if you force them):
- Medical aesthetics, prescription drugs/medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco
- Generating images that look like "real photography" of a product — when there's no real material, the video falls back to simple line-drawn illustrations and labels them clearly, rather than pretending to be a real photo

## Supported industries and languages

| `meta.industry` | Description |
| --- | --- |
| `software` (default) | Apps, SaaS, tools |
| `food` | Restaurants, single-item launches |
| `ecommerce` | Physical goods |
| `education` | Adult vocational training (not K12) |
| `beauty` | Non-medical beauty services |
| `travel` | Tourism, lodging, homestays |

`meta.lang`: `zh` (default, Chinese captions) / `en` (English captions).

## Installation

### Requirements

| Item | Requirement |
| --- | --- |
| Node.js | ≥ 18 (20 LTS or newer recommended; this repo is tested on Node 22) |
| Python | 3.10+ (for the music-generation script; needs `numpy`/`scipy`) |
| OS | Windows (x64 only) / macOS ≥ 15 / Linux (glibc ≥ 2.35, plus shared libs like `libnss3`/`libgbm`/`libasound2`; Alpine and nixOS are not supported) |

### Three commands

```bash
git clone https://github.com/Finderchangchang/promo-video-skill.git
cd promo-video-skill/template && npm install && npx remotion browser ensure
cd .. && node scripts/validate.mjs examples/en-focus.json
```

The first command installs the rendering-engine dependencies (including Remotion compositor packages for 7 platforms — optional, but kept in the lockfile so switching platforms just works); the second additionally downloads a Chrome Headless Shell (~110MB, used for headless rendering); the third validates one of the bundled example storyboards — if it passes, your setup is good.

You can also install it as a skill for your AI coding assistant (if it has a skill manager): manually clone the whole repo into `~/.claude/skills/promo-video-skill/` (Claude Code) or `~/.agents/skills/promo-video-skill/` (a common convention), or point your tool's own skill-install command at this repository's URL.

## Workflow

```
Brief
  → storyboard.json (pick shots, fill in text)
  → node scripts/validate.mjs (hard rules + industry compliance; the report tells you what to fix)
  → node scripts/make.mjs (music → render → contact sheet → check frames)
  → pre-publish human checklist (see "Pre-publish checklist" in SKILL.md)
```

For the full workflow and every field's meaning, see `SKILL.md` (this is what the AI assistant reads to write a storyboard). `shots.en.md` is the parameter reference for all 18 shots; `docs/shots/*.en.md` has one detailed doc per shot.

## Running it with a cheap model (DeepSeek example)

`scripts/llm_make.py` is a headless script that doesn't need an agent loop — it calls an OpenAI-compatible endpoint directly: brief in, video out, with validator errors automatically fed back to the model on retry.

```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic   # only needed if wiring DeepSeek into Claude Code
export ANTHROPIC_AUTH_TOKEN=<your DeepSeek API key>
export ANTHROPIC_MODEL=deepseek-flash[1m]

# or call the headless script directly, without going through Claude Code:
export LLM_API_KEY=<your DeepSeek API key>
export LLM_BASE_URL=https://api.deepseek.com
export LLM_MODEL=deepseek-chat
python scripts/llm_make.py path/to/brief.md
```

On Windows PowerShell use `$env:LLM_API_KEY="..."` instead of `export`. All of the values above are placeholders — swap in your own key, and never commit a key or paste one into an issue. You may also put these variables into your AI assistant's own global config (e.g. `~/.claude/settings.json`) — that's an optional convenience this repo mentions but never does for you.

## Styles

A storyboard picks its look with `meta.style`; without it you get the default `cards` style. Each style is a "style pack" with its own design tokens, shot components, validation rules and narrative templates: docs, rules and examples live in `styles/<id>/`, code in `template/src/styles/<id>/`.

**`cards`** (default, ready, 9:16): gradient background, a centered white card and bold outlined captions, one point per shot. Fits a single selling point, a how-it-works flow, UI demos, physical products and stores. Its 18 shots and samples for all six industries are in `examples/`.

![cards style preview](docs/images/style-cards.png)

**`quiz`** (ready, 9:16): off-white background, blue plus neon lime, left-aligned heavy type and flat-illustrated characters. The beat is: state a common misconception → ask an A/B/C question with a 3-second countdown → reveal with a check mark → full-screen meaning card (≠ the old reading / = the right meaning) → a short scene acting it out → a comment prompt. Fits products with a common misconception that can be framed as one multiple-choice question: what a foreign phrase really means, a software feature people often misread (e.g. "Archive = deleted?"), or why a dish is made the way it is. See [`styles/quiz/`](styles/quiz/README.md); templates and length limits are in `styles/quiz/recipes.md` (Chinese); five sample storyboards are in `styles/quiz/examples/`.

![quiz style preview](docs/images/style-quiz.png)

`journey` (a mascot travels through an illustrated city in one continuous shot, one district per content category, 4:5) is still in development; validation blocks it for now.

**Choosing `meta.style`**:
- The product has a point people commonly get wrong, it can be asked as "What do you think X means?", and there is exactly one right answer → `quiz`.
- Everything else (selling points, flows, UI demos, stores and physical products, price lists) → `cards`, i.e. leave it out.
- `quiz` only supports 9:16. Its own shots (question, reveal, meaning card, etc.) can only be used in `quiz`, and it does not mix with the 18 `cards` shots; validation blocks a storyboard that mixes them.

```json
{ "meta": { "style": "quiz", "industry": "software", "lang": "zh" }, "shots": [ ... ] }
```

## Contributing a new style: remix and create

- **Use**: make films with an existing style.
- **Remix (reskin)**: `node scripts/gen-styles.mjs --new <id>` scaffolds a new style; copy over the shots and `tokens.json` you want to keep from the source style, then change palette, fonts and characters. For a color-only variant, editing `themes` in `tokens.json` is enough.
- **Create (distill)**: follow the shared process in [`distill/`](distill/README.en.md) to break down a reference video: `scripts/extract-frames.mjs` extracts frames and finds cuts → nine-layer breakdown → replicate → componentize → cheap-model test → review and fix, ending in a new style. `distill/prompts/` has a ready-to-use prompt for each step, and `styles/_template/` is the blank template for a new style. `quiz` was made this way, with a quiz-style short video as the reference.

Reference videos and their stills, extracted frames, characters, brand names, URLs and film clips never go into the repo. Keep the raw breakdown outside the repo; the repo only holds breakdown text you wrote, characters and scenes you drew, and sample content you wrote. Steps and the PR checklist: [CONTRIBUTING.en.md](CONTRIBUTING.en.md).

## Industry packs: adding a new industry

Each industry lives under `industries/<id>/`:

```
industries/<id>/
  rules.json             Compliance rules (enabledShots, checks, mediaPolicy, etc.), merged with industries/_base/rules.json
  recipe.md               Recommended shot structure and writing notes (required reading before writing a storyboard)
  recipe.en.md             English version
  brief-template.md        The brief template to hand to a merchant
  brief-template.en.md      English version
  test-brief.md             One full sample brief
  expected.md                Which rules that sample brief should trigger (used for regression tests)
```

To add an industry: copy an existing industry folder and rename it, fill in `rules.json` following the field documentation in `industries/_base/rules.json`, write `recipe.md` describing which shots this industry should use and its common compliance pitfalls, then write a `test-brief.md` + `expected.md` and run `node scripts/test-rules.mjs` to confirm the rules actually fire.

## Validation rules and disclaimer

The rules in `scripts/validate.mjs` are compiled from publicly available advertising-law superlative-word lists and public platform rules, in three tiers:
- **error (block)**: must be fixed, or `make.mjs` refuses to render
- **warning (warn)**: recommended to fix, not enforced
- **human review**: things a machine can't judge (e.g. "is this photo actually authorized", "is this review genuine") — listed as a checklist for the publisher to confirm after rendering

**These rules are for self-checking only, are not legal advice, and are not guaranteed to cover every platform's latest rules.** Whether published content is compliant is governed by the latest rules from regulators and platforms at the time; the publisher is solely responsible. Known rule edge cases and unverified items are tracked in this project's internal dev notes (not shipped in this repo) — please file an issue with any false positive or missed case you hit in practice.

## Testing status / known limitations

This is an early preview. **We don't yet recommend publishing a video as rendered, without human edits.**

**How it was tested**: earlier rounds used a DeepSeek-class cheap model to write storyboards in bulk. The latest round (just before this release) used a small Claude Haiku-class model as the "cheap model": it got only the brief and `SKILL.md`, and had to write the storyboard from scratch, run validation and render. That produced 9 videos: 4 software/tool videos (a chat-assistant app, a tool for publishing WeChat Official Account articles, a data Q&A tool, and a focus timer with English subtitles) and 5 industry videos (one each for food, ecommerce, education, beauty and travel). **No real merchant photos were used** anywhere; the visuals come from the components and the illustration fallback. A person reviewed every video frame by frame, scored it out of 10 for "overall" and "compliance", and checked the storyboard against the brief line by line.

**Results of this round**: none of the 9 reached 7, the score we set as "fine to publish as is".
- Software/tool videos: overall 5–6, compliance 7–8. The best one scored 6 and demonstrates the whole feature: chat → analysis → suggested replies → insert.
- Industry videos: overall 4–5, compliance 4–5. Most points were lost on cross-field factual problems (items 1 and 3 below).
- Last round's serious defects mostly did not come back: no Chinese characters on screen in the English video (94 sampled frames), speed claims were blocked, the same image can no longer serve as before and after, the price-card component no longer drops items, route labels now show the destination, and videos with a ✗ in the layout check are refused delivery.
- Delivery: the model delivered a video by itself in 5 of the 9 runs. In 2 runs the model quit while its render was still queued, 1 render was interrupted halfway, and 1 run was blocked by a `make.mjs` bug: with `--brief`, make passed the file path instead of the brief text, so every number was reported as "not found in the brief". That bug is fixed in this release. This release also makes `make.mjs` refuse an `--out` inside the repo, and `SKILL.md` now tells the model not to stop until it has seen the `交付：` ("delivered") line.

**Testing the quiz style** (new in this release): a cheap model read only `SKILL.md` and the docs in `styles/quiz/`, then wrote 3 storyboards from scratch and rendered them: a foreign phrase, a software-feature quiz and a food quiz. A person scored each out of 10 for "style" (how well it matches the style) and "overall". Results before the fixes:

| Storyboard | Style | Overall |
|---|---|---|
| Foreign phrase (phrase) | 7 | 6 |
| Software-feature quiz (app-feature) | 6 | 4 |
| Food quiz (food-guess) | 6 | 4 |

The QA review listed 10 problems. Items 1–9 are fixed; item 10 is only partly done. Main changes:
- **Spoiling the answer before the question**: new check Q10. The hook's context line, every line of the film clip, and the subtitle bar on the quiz card may not contain the correct option, the "=" lines of the meaning card, or the numbers in them. Re-run on those 3 storyboards, all 3 are now blocked.
- **Subtitle bar on the quiz card**: by default it shows only the half of the clip's last line that contains the key phrase; `quizLine` lets you write it yourself (≤12 characters, no answer). The software and food templates now say "show the feature or dish name, not the effect".
- **Solid-color blank frames**: `make.mjs` adds a blank-frame check. If more than 95% of the screen is one color for more than 6 frames in a row, the video is not delivered.
- Also added Q11–Q13: in a quantity question every option must be a quantity; UI mockups (screen / phone) must include the real on-screen text; a film clip requires the "listen again" beat.

After the fixes, all 5 sample storyboards in `styles/quiz/examples/` were re-validated and rendered: `make.mjs` exited 0 each time, the last line was always `交付：…` ("delivered"), and both the layout check and the blank-frame check passed. The cheap model has not yet re-run a scored round after the fixes, so the scores above are still from before them.

**Main remaining limitations** (issues with concrete counter-examples are welcome):

1. **Price conditions can be bypassed by deleting facts.** Checks on price conditions, date ranges and surcharges only apply to what the model itself put in `meta.facts`. If the model deletes those facts, nothing checks the prices on screen. In testing this lost a holiday price and surcharge amounts, promotion dates, a validity period, and one paid add-on. `--brief` checks that the facts come from the brief, but not that the brief's price conditions made it onto the screen.
2. **Components can silently drop data.** For example, the mockApp dashboard shows only as many rows as fit, and ignores an unsupported `done` field; validation reports neither.
3. **Truthfulness of locations and illustrations.** The model still invents claims like "a 3-minute walk", and the store card adds a "navigation estimate" line on its own. Validation does not yet fully catch an illustration captioned as "our own work", an illustration that doesn't match its label (e.g. a mountain labelled as a bathroom), or real data labelled as sample data.
4. **Template feel.** Different videos often share the same cover, default line chart, white end card and bottom decoration, with only the text and colours changed.
5. **Copy quality is not checked automatically.** Nothing catches a word cut in half, awkward phrasing, English grammar or sentence-case errors, the same selling points repeated three times in one video, or contradictions such as "three taps" vs "one-tap". Hype words without digits (e.g. "doubled", "everyone loves it") also get through.
6. **The core action isn't required on screen.** For a tool, an action like "tap Start" may end up shown as an unrelated screen, and validation doesn't check this.
7. **Layout.** Brand-colour numbers on dark themes can have too little contrast. Some panels leave their lower half empty when there is little content. Overlapping photo callouts are only caught after the render, which wastes several minutes. A priceCard filled to capacity scales down to 0.8, and some small text drops below 26px.
8. **Coverage of English and asset checks.** The industry compliance word lists are written for Chinese, so English copy is checked less thoroughly. Assets are only checked at the file level (the same image, renamed copies, a screenshot passed off as a photo). Whether two photos show the same customer, or whether consent was obtained, can only go on the human-review list.

**Recommended use**:
- Treat the video as a first draft: watch the whole thing, fix awkward copy and repeated selling points, then publish. Passing validation alone is not enough.
- For industry videos, use the merchant's real photos where possible (store, finished product, price list), and pass `--brief <brief>` when rendering. Before delivery, check every price, condition, date, opening hour and distance on screen against the brief, one by one.
- Keep test output outside the repo with `--round`.

## Directory structure

```
promo-video-skill/
  SKILL.md / SKILL.en.md      The instructions an AI assistant reads (how to pick shots, fill fields, follow the flow)
  README.md / README.en.md    This file
  LICENSE / NOTICE / THIRD_PARTY_LICENSES.md
  shots.md / shots.en.md      Parameter reference for all 18 shots
  brief-template.md           Generic brief template
  docs/
    shots/                    Detailed per-shot docs (18 shots × 2 languages)
    images/                   Example preview images used in the READMEs
  industries/                 The six industry packs (see above)
  scripts/
    validate.mjs              Validation entry point
    make.mjs                  One-command render
    llm_make.py                Headless mode: brief → storyboard → video
    make_bgm.py                  Parametric original background music
    build_docs.mjs                Generates shots.md / shots.en.md from spec.json files
    privacy-scan.mjs              Pre-publish privacy self-check
    checks/ lib/                   Rule implementations
  template/                   The Remotion rendering project
    src/shots/                 18 shared shot components + parameter specs (used by cards)
    src/styles/                per-style manifest, design tokens and shots; registry.gen.ts is generated by scripts/gen-styles.mjs
    src/core/                  Fonts, themes, animation, layout helpers
    src/illust/                Industry fallback illustrations
    public/                    Fonts, sound effects, sample assets
  examples/                   9 ready-to-render storyboard samples (six industries + English + two generic samples, all cards style)
  styles/                     style packs: nine-layer spec, narrative templates, rules, examples; _template/ scaffolds a new style
  distill/                    style distillation process and reusable prompts
  CONTRIBUTING.en.md          how to contribute (use / remix / create, PR checklist)
  tests/
    validate/                  Positive/negative regression tests for the validator
    rules/                     Regression tests for each industry's rules (4 cases each)
```

## FAQ

**What should I watch for when Remotion 5.0 ships?**
This repo pins `remotion` / `@remotion/cli` to `4.0.529`. After upgrading to 5.0, Remotion's free tier requires passing a `licenseKey` in config (individuals / companies with ≤3 people / non-profits use `"free-license"`) — see the [Remotion license page](https://www.remotion.dev/license). Read `THIRD_PARTY_LICENSES.md` before upgrading.

**A platform's compositor package is missing from the lockfile after `npm install`?**
`package-lock.json` should contain 7 `@remotion/compositor-*` platform packages (win32-x64-msvc / darwin-arm64 / darwin-x64 / linux-x64-gnu / linux-x64-musl / linux-arm64-gnu / linux-arm64-musl). If the one for your platform is missing, delete `template/node_modules` and `template/package-lock.json` and re-run `npm install` on the target platform (this is a known npm optional-dependency resolution quirk — a lockfile generated on one platform doesn't always include every platform).

**Chrome Headless Shell fails to download?**
`npx remotion browser ensure` may not be able to reach Google's download endpoint from some networks. Download it manually and point to a local Chrome/Chromium install with `--browser-executable` (rendering results may differ slightly between Chrome versions).

**`--props` fails with "neither valid JSON" on Windows?**
The Windows shell mangles quotes inside JSON strings, so storyboards are always passed as a file path (`--props=./storyboard.json`), never as an inline JSON string on the command line. `make.mjs`/`llm_make.py` already do this the file-path way.

**Do I need a system ffmpeg?**
No. The contact sheet `sheet.png` is rendered by Remotion's `Sheet` composition (one frame per second of the video, tiled as thumbnails, each labelled with its time and shot number). The review frames `check/*.png` are extracted from the video with Remotion's bundled ffmpeg, and any frame that can't be extracted is rendered as a Remotion still instead. If you set `FFMPEG=/path/to/ffmpeg`, the sheet is tiled with its `tile` filter first and falls back to the `Sheet` composition if that fails. A missing sheet never affects `video.mp4`; the terminal prints the reason.

## License

This repository's code is released under the **Apache-2.0** license — see `LICENSE`. Copyright holder: Liu Weijie (柳伟杰, Finderchangchang). **Commercial use is free.** Under Section 4 of Apache-2.0, if you redistribute this code, a modified version, or a product that includes it, you must keep `LICENSE` and carry the attribution in `NOTICE` (i.e. credit "promo-video-skill by Liu Weijie") in your own NOTICE file, documentation or product UI. Videos rendered with this tool do not require attribution.

This repo depends on [Remotion](https://www.remotion.dev) as its rendering engine. Remotion is **source-available, not open source**: free for individuals, for-profit companies with 3 or fewer people, and non-profits (including commercial use); **for-profit organizations with 4 or more people must purchase Remotion's Company License** — see <https://www.remotion.dev/license>. This repo's Apache-2.0 license does not change Remotion's own license terms; details in `THIRD_PARTY_LICENSES.md`.

The fonts Noto Sans SC and Cascadia Mono are licensed under the SIL Open Font License 1.1; the full license text ships alongside each font under `template/public/fonts/`.

Videos rendered with this project do not require attribution back to this project.
