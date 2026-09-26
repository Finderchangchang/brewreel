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

This is an early preview. It has been tested by generating storyboards in bulk with a cheap model (DeepSeek-class) across all six industries plus English, then scoring the results by hand and fixing issues in priority order over several rounds. **Current average quality**: the hard, machine-checked rules (the errors/warnings `validate.mjs` catches) are fairly reliable by now, but **content quality** — whether the copy actually fits the product, whether numbers are invented, whether the video is visually engaging — still depends on how well the underlying model does on a given run. A human pass before publishing is still necessary; passing validation is not a green light to publish unreviewed.

Known gaps (as currently understood; issues with concrete counter-examples are welcome):

- **The Chinese-character check for English videos covers on-screen text only.** Hard-coded strings in the components now all switch language (`node scripts/check-i18n.mjs` finds none), and when rendering, one frame every half beat is scanned for Han characters anywhere on screen; any hit blocks delivery. The industry compliance rules, however, still work from Chinese word lists, so compliance checks on English copy are thinner than on Chinese copy.
- **Number checks depend on facts and the brief.** Cross-field problems such as speed claims, sample data used as results, and a number that lost its date range or coupon condition are now blocked. Without `--brief`, validation can only check that the screen matches the facts, not that the facts were really copied from the brief; one price split across two facts, or a condition missing from the fact itself, also goes unnoticed.
- **compare scale direction**: when both sides have a `level`, validation checks that the `tone: good` side comes out ahead. It reads `higherIs` first and otherwise guesses from the meterLabel wording; when it can't tell, it only warns.
- **Asset checks work at the file level.** The same image twice, a renamed copy, placeholders, a screenshot passed off as a real photo, and an illustration labelled as real are blocked. Whether two different photos show the same customer, or whether consent was really obtained, can only go on the human-review list.
- **Template feel**: the hook no longer draws a fixed icon ring, the end card has three layouts picked by product name, and the lower third now has a theme-based decoration layer. Videos in the same industry can still end up with similar structures; there is no enforced diversity.
- **`make.mjs` now gates delivery.** Any ✗ in the layout check, the English Han scan, the machine self-check, or the text-layout report makes make exit with 3 and renames the video `video.rejected.mp4`; it is not a delivery. In an extreme case (a priceCard crammed with 6 prices, 6 included items and every kind of term) the card scales down to 0.8 and some small text drops below 26px; validation does not catch this yet.

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
    src/shots/                 18 shot components + parameter specs
    src/core/                  Fonts, themes, animation, layout helpers
    src/illust/                Industry fallback illustrations
    public/                    Fonts, sound effects, sample assets
  examples/                   9 ready-to-render storyboard samples (six industries + English + two generic samples)
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
