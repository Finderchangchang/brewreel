<div align="center">

<img src="docs/images/logo.png" width="150" alt="BrewReel · 精酿" />

# BrewReel · 精酿

**Brew great promo reels with low-cost models: write a product brief, let the AI pick the shots and write the copy, and render a vertical promo video with one command.**

[![Stars](https://img.shields.io/github/stars/Finderchangchang/brewreel?style=flat-square&logo=github&label=Stars)](https://github.com/Finderchangchang/brewreel/stargazers)
[![Forks](https://img.shields.io/github/forks/Finderchangchang/brewreel?style=flat-square&logo=github&label=Forks)](https://github.com/Finderchangchang/brewreel/forks)
[![Version](https://img.shields.io/badge/version-v0.5.0-1f6feb?style=flat-square)](CHANGELOG.en.md)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4D6BFE?style=flat-square)](#use-it-in-deepseek-harness)
[![Remotion](https://img.shields.io/badge/Remotion-4.0-0B84F3?style=flat-square)](https://www.remotion.dev)
[![License](https://img.shields.io/github/license/Finderchangchang/brewreel?style=flat-square)](LICENSE)

[Website](https://brewreel.com) · [Demo video](https://github.com/Finderchangchang/brewreel/releases/download/v0.3.0/demo-5MB.mp4) · [Releases](https://github.com/Finderchangchang/brewreel/releases) · [Changelog](CHANGELOG.en.md) · [Use it in DeepSeek Harness](#use-it-in-deepseek-harness) · [Sister project: Jev chat assistant](https://github.com/jev-chat/jev-chat-jarvis) · [中文](README.md)

<sub>Formerly promo-video-skill / Distill Video (蒸馏视频); old links redirect automatically.</sub>

</div>

## ❤️ Sponsors

> Want to appear here? Add me on WeChat: **jskjkf007**, and include the note "BrewReel 商务合作" (BrewReel business) in your request.

## Screenshots

Everything below is an actual render. The storyboards are all in the repo, and the products and numbers are fictional. The [demo video](https://github.com/Finderchangchang/brewreel/releases/download/v0.3.0/demo-5MB.mp4) (attached to v0.3.0, about 5 MB) shows actual renders of all three recipes.

**Three recipes**

<table align="center">
<tr><td align="center"><img src="docs/images/style-cards.png" width="760" alt="cards style" /><br/><sub><b>cards</b> (default, 9:16): gradient background, a centered white card and bold outlined captions, one point per shot</sub></td></tr>
<tr><td align="center"><img src="docs/images/style-quiz.png" width="760" alt="quiz style" /><br/><sub><b>quiz</b> (9:16): circle a common misconception in red pen → ask one multiple-choice question → reveal → a dictionary card explains it</sub></td></tr>
<tr><td align="center"><img src="docs/images/style-journey.png" width="760" alt="journey style" /><br/><sub><b>journey</b> (4:5 / 9:16): an original mascot crosses a paper-cut city in one take, one postcard per stop for each category</sub></td></tr>
</table>

**Six industries** (each image shows frame 0, the cover, on the left and one frame from the middle on the right)

<table align="center">
<tr>
<td align="center"><img src="docs/images/ledger.png" width="260" alt="Software: budgeting" /><br/><sub>Software · budgeting (ledger)</sub></td>
<td align="center"><img src="docs/images/food.png" width="260" alt="Food: item launch" /><br/><sub>Food · item launch (food)</sub></td>
<td align="center"><img src="docs/images/ecommerce.png" width="260" alt="Ecommerce: physical goods" /><br/><sub>Ecommerce · physical goods (ecommerce)</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/images/education.png" width="260" alt="Education: adult vocational course" /><br/><sub>Education · adult vocational course (education)</sub></td>
<td align="center"><img src="docs/images/beauty.png" width="260" alt="Beauty: no real photos" /><br/><sub>Beauty · no real photos (beauty)</sub></td>
<td align="center"><img src="docs/images/travel.png" width="260" alt="Travel: lodging" /><br/><sub>Travel · lodging (travel)</sub></td>
</tr>
</table>

<details>
<summary>More samples: relationship chat app, meeting notes, English captions</summary>

<table align="center">
<tr>
<td align="center"><img src="docs/images/jev.png" width="260" alt="Software: relationship chat" /><br/><sub>Software · relationship chat (jev)</sub></td>
<td align="center"><img src="docs/images/meeting.png" width="260" alt="Software: meeting notes" /><br/><sub>Software · meeting notes (meeting)</sub></td>
<td align="center"><img src="docs/images/en-focus.png" width="260" alt="English captions" /><br/><sub>English captions (en-focus)</sub></td>
</tr>
</table>

</details>

These 9 storyboards are in `examples/` (all in the cards recipe); the quiz and journey samples are in `styles/quiz/examples/` and `styles/journey/examples/`. Every one passes validation and renders with `make.mjs` as-is.

## Why BrewReel

- **The cheap model only does what it's good at.** It writes one `storyboard.json`: pick shots, fill in text. No code, no coordinates. Layout, motion and pacing live in ready-made components.
- **A strong model tunes the recipe first.** Each style is first made right by a strong model, then written down as components and validation rules. The cheap model follows the recipe, and the recipe holds the quality bar.
- **Compliance red lines are checked first.** Dozens of built-in checks cover ad-law superlatives, compliance rules for six industries, line-wrap problems and safe areas, and every error says what to fix.
- **One command renders the video.** Validate → music → render → contact sheet → check frames, fully automated. A video with a ✗ in its self-check is not delivered.
- **Music is synthesized on the spot, so there are no copyright issues.** It hits the shot cuts, and loudness is normalized to -16 LUFS.
- **Chinese and English.** Captions can be Chinese or English; English videos are scanned every half beat, and any Chinese character on screen blocks delivery.
- **Open source, commercial use allowed.** Apache-2.0, just credit the source. Rendered videos don't require attribution.

## Platform support

| Way to use it | Status | Notes |
|---|---|---|
| AI coding assistants that read `SKILL.md`: Claude Code, Codex, opencode and others | ✅ Ready | Install the repo as a skill; the assistant follows `SKILL.md` to write the storyboard, validate and render |
| DeepSeek Harness plugin `dsh-brewreel` | ⚠️ Published on npm | 7 tools validate, render and verify; not yet tested against a real DeepSeek model |
| Agent-free script `scripts/llm_make.py` | ✅ Ready | Calls an OpenAI-compatible endpoint (DeepSeek by default): brief in, video out, validator errors fed back automatically |

| Environment | Requirement |
|---|---|
| OS | Windows (x64 only) / macOS ≥ 15 / Linux (glibc ≥ 2.35, plus shared libs like `libnss3` / `libgbm` / `libasound2`; Alpine and NixOS are not supported) |
| Node.js | ≥ 18 (20 LTS or newer recommended; this repo is tested on Node 22); the DeepSeek Harness plugin needs 22.x from 22.19, or 24+ |
| Python | 3.10+; the music script needs `numpy` / `scipy`, `llm_make.py` uses only the standard library |
| First download | A few hundred MB of render dependencies, plus about 110 MB for Chrome Headless Shell |

Output is 1080×1920 (journey defaults to 1080×1350), 30 fps, with music and sound effects.

## Quick start

**1. Install dependencies.**

```bash
git clone https://github.com/Finderchangchang/brewreel.git
cd brewreel/template && npm install && npx remotion browser ensure
cd .. && pip install numpy scipy
```

`npm install` installs the rendering engine (the lockfile includes Remotion compositor packages for 7 platforms, so switching platforms just works); `npx remotion browser ensure` downloads Chrome Headless Shell once, for headless rendering.

**2. Run a sample to check the setup.**

```bash
node scripts/validate.mjs examples/en-focus.json
node scripts/make.mjs examples/en-focus.json --out ../brewreel-out/en-focus
```

If the first command passes, your setup is good. The second renders the video in a few minutes; the last terminal line is `交付：<mp4 path>` ("delivered"). The output folder holds `video.mp4`, the contact sheet `sheet.png`, check frames in `check/`, `report.txt` and the delivery manifest `manifest.json`. `--out` must not point inside the repo.

**3. Let the AI write the storyboard.** Pick one:

- **As a skill**: clone the whole repo into `~/.claude/skills/brewreel/` (Claude Code) or `~/.agents/skills/brewreel/` (a common convention), or point your tool's own skill-install command at this repository. Then hand the assistant a brief (template: [`brief-template.md`](brief-template.md); English templates per industry are in `industries/<id>/brief-template.en.md`) and let it follow `SKILL.md`.
- **Headless script**: no agent needed; see ["Running it with a cheap model"](#running-it-with-a-cheap-model) below.
- **DeepSeek Harness**: with the plugin installed the model validates and renders through tools; see ["Use it in DeepSeek Harness"](#use-it-in-deepseek-harness).

### Running it with a cheap model

`scripts/llm_make.py` calls an OpenAI-compatible endpoint directly: brief in, video out, with validator errors fed back to the model verbatim on retry (up to 3 times).

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

On Windows PowerShell use `$env:LLM_API_KEY="..."` instead of `export`. All of the values above are placeholders; swap in your own key, and never commit a key or paste one into an issue. You may also put these variables into your AI assistant's own global config (e.g. `~/.claude/settings.json`); that's optional, and this repo never changes any global config for you. With `--dry-run` it calls no API and reads no key; it only writes out the assembled prompt and estimates its token count.

### Use it in DeepSeek Harness

This repository ships a DeepSeek Harness (dsh) plugin in [`integrations/deepseek-harness/`](integrations/deepseek-harness/README.en.md), package name `dsh-brewreel` (formerly `dsh-distill-video`; to upgrade from it, see "Upgrading from dsh-distill-video" in the plugin README). With it installed, the model writes the storyboard by following the skill, and validates, renders and verifies through the plugin's tools instead of assembling `node scripts/…` commands. Rendering runs in the background with progress, and the plugin restricts output paths and the environment variables child processes receive.

It needs **dsh 0.1.7-rc.2 or later** within 0.1.x. dsh's `latest` tag on npm still points to the older 0.1.5-rc.3, so pin the version when installing. You also need Node.js 22.x from 22.19, or 24 and later, plus pnpm (`dsh plugin` installs plugins through pnpm). Install from npm:

```bash
npm install -g @deepseek-ai/dsh@0.1.7-rc.2 pnpm    # if dsh is not installed yet
dsh plugin --profile web add dsh-brewreel
dsh web
```

`web` can be any profile name; if the profile is already running, restart it for the change to apply. On first use, ask the model to "check the video plugin environment": it calls doctor, and after you agree, calls setup to install the render dependencies (a few hundred MB, plus about 110 MB for Chrome Headless Shell). To use unreleased code from the repository, clone it and run `dsh plugin --profile web add ./brewreel/integrations/deepseek-harness` from the folder that contains the clone. The plugin has not yet been tested against a real DeepSeek model; please open an issue if you hit problems.

<details>
<summary><b>The 7 tools, license note and security notes</b></summary>

- `brewreel_doctor` checks the environment, `brewreel_setup` installs dependencies and the browser, `brewreel_catalog` lists styles, industries and color themes, `brewreel_guide` reads the skill and the style, industry and shot docs, `brewreel_validate` validates a storyboard and says how to fix each problem, `brewreel_render` renders in the background, and `brewreel_verify` checks that a video still matches the current storyboard.
- License note: the plugin and the skill are Apache-2.0, but the rendering engine Remotion is not open source: **for-profit organizations with 4 or more people must purchase Remotion's Company License** (see ["Copyright and license"](#copyright-and-license) and `THIRD_PARTY_LICENSES.md`). The plugin does not change that.
- Render child processes do not go through dsh's shell sandbox; they run with the current user's permissions.
- Configuration, security notes and troubleshooting are in the plugin's [README](integrations/deepseek-harness/README.en.md).

</details>

## Features

### Three recipes

A storyboard picks its recipe with `meta.style`; without it you get the default `cards`. Each recipe is a "style pack" with its own design tokens, shot components, validation rules and narrative templates: docs, rules and examples live in `styles/<id>/`, code in `template/src/styles/<id>/`.

| Recipe | Aspect | Fits |
|---|---|---|
| `cards` (default) | 9:16 | A single selling point, a how-it-works flow, UI demos, physical products and stores, price lists |
| `quiz` | 9:16 | A common misconception that can be framed as one multiple-choice question with exactly one right answer ("What does X actually mean?") |
| `journey` | 4:5 (default) / 9:16 | 4–6 clear categories, features or stops worth touring along one route |

How to choose: one multiple-choice question → `quiz`; 4–6 categories to tour → `journey`; everything else → `cards`, i.e. leave it out. `quiz` only supports 9:16. Its own shots (question, reveal, meaning card, etc.) can only be used in `quiz` and do not mix with the 18 `cards` shots; validation blocks a storyboard that mixes them.

```json
{ "meta": { "style": "quiz", "industry": "software", "lang": "zh" }, "shots": [ ... ] }
```

<details>
<summary><b>What each recipe looks like</b></summary>

**`cards`** (default, ready, 9:16): gradient background, a centered white card and bold outlined captions, one point per shot. Fits a single selling point, a how-it-works flow, UI demos, physical products and stores. Its 18 shots and samples for all six industries are in `examples/`.

**`quiz`** (ready, 9:16): the skin is a "marked answer sheet": dot-grid paper with a vermilion margin line, a deep primary plus an amber highlighter and a vermilion marking pen, monospaced labels, and cards with small radii and solid hard shadows. Three palettes (`sage-pine` grey-green paper + pine, the default; `rice-soy` rice paper + soy brown, the food default; `ash-teal` grey paper + deep teal) and three voices (`phraseTitle.params.voice`: `exam`, `chat`, `show`). Two original characters, one short and one tall: a host in headphones (the ear cup lights up and sends out sound waves when it clicks) and a buddy in a backwards cap. The beat is: circle a common misconception in red pen → an A/B/C question on an answer sheet with a stopwatch counting 3 → reveal with a check mark → a dictionary card flips in (the misreading struck through with a wavy line, numbered meanings) → replay the clip and stamp it → a short scene acting it out → a comment prompt → a stamp wipe that lands on the closing card. Fits products with a common misconception that can be framed as one multiple-choice question: what a foreign phrase really means, a software feature people often misread (e.g. "Archive = deleted?"), or why a dish is made the way it is. See [`styles/quiz/`](styles/quiz/README.md); templates and length limits are in `styles/quiz/recipes.md` (Chinese); five sample storyboards are in `styles/quiz/examples/`.

**`journey`** (ready, 4:5 by default, 9:16 supported): the skin is "travel stationery" on a "layered paper-cut" city. Our own mascot, a red-panda cub on a hover board, crosses the city in one continuous take (far, middle and near layers and the character are each a sheet of paper with a hard offset paper shadow). It opens on split-flap station letters; a full-width ticket across the top shows the route, the stops and the current stop; each stop throws in an airmail-bordered postcard with a representative title, which is then "posted" into that stop on the ticket. Palette: postal green + neon lime + graphite outlines (`post-green`; `plum-ticket` is a wine-red alternative). One district per content category, three backdrops (modern city, low-rise street, or an old town with white walls, tile roofs and a stone bridge) and 14 district types picked by content (crossing, postbox, ticket check, photo booth, bus stop, night platform, phone, home, cafe, market, city gate, stone bridge, teahouse, lanterns), each with its own station- or mail-themed gag; the sky goes from day to night, and at the last stop the ticket from the top slides to the centre and unfolds, gets a hole punched in its stub and flips over to show the product name and slogan; at most one number, printed on the front beside the finish flag. Fits products with many clear categories: channels of a content platform, features of an app, stops on a sightseeing route. See [`styles/journey/`](styles/journey/README.md); per-beat fields and length limits are in `styles/journey/recipes.md` (Chinese); three sample storyboards are in `styles/journey/examples/`.

</details>

### Voice-over (MiniMax)

Write `meta.voice` in the storyboard and one `vo` line (narration) per shot, and the video comes out with a voice-over. Without them you get a video with no voice, exactly as before.

- **The voice is the timeline**: `make.mjs` first has MiniMax text-to-speech read each line and gets per-word timing, then sets each shot with narration to "0.15 s + narration + 0.35 s", aligned to the beat. The cheap model doesn't have to work out durations.
- **Word-by-word subtitles**: subtitles light up word by word with the voice, in all three recipes. You can also show the whole line at once (`line`) or skip narration subtitles (`off`). In `cards`, a shot with `vo` and no `caption` gets its subtitle from the narration.
- **Music makes room**: the background music ducks by about 10 dB under speech and comes back after.
- **Cached to save money**: the same line (same voice, speed, emotion and text) is synthesized only once and cached in the user folder `~/.cache/brewreel/tts` (change it with the `BREWREEL_TTS_CACHE` environment variable). Changing visuals or re-rendering costs nothing more; `manifest.json` records the characters billed for the run.
- **Preview without a key**: add `--voice-provider mock` when rendering to check rhythm with an offline placeholder voice (not a deliverable); add `--no-voice` for a version without narration.
- **Keys**: read only from the `MINIMAX_API_KEY` environment variable (plus `MINIMAX_GROUP_ID` and `MINIMAX_BASE_URL` when needed), never written to any file or log.

How to write it, recommended voices and length limits are in the "Voice-over" section of `SKILL.en.md`; each recipe has a sample storyboard with voice-over (`styles/*/examples/*voice*.json`).

### Six industry packs

| `meta.industry` | Description |
|---|---|
| `software` (default) | Apps, SaaS, tools |
| `food` | Restaurants, stores, single-item launches |
| `ecommerce` | Physical goods |
| `education` | Adult vocational training (not K12) |
| `beauty` | Non-medical beauty services |
| `travel` | Tourism, lodging, homestays |

`meta.lang`: `zh` (default, Chinese captions) / `en` (English captions).

- 11 general-purpose shots plus 7 industry shots (real photo, price card, store card, review card, before/after, fact sheet, credential card). `shots.en.md` is the parameter reference for all 18 shots; `docs/shots/*.en.md` has one detailed doc per shot.
- Each industry pack has compliance rules, a recommended shot structure, a brief template for merchants and a regression-test brief.
- **Not supported** (the compliance rules don't cover these, so results aren't guaranteed compliant even if you force them): medical aesthetics, prescription drugs / medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco.

<details>
<summary><b>Adding a new industry</b></summary>

Each industry lives under `industries/<id>/`:

```
industries/<id>/
  rules.json            Compliance rules (enabledShots, checks, mediaPolicy, etc.), merged with industries/_base/rules.json
  recipe.md             Recommended shot structure and writing notes (required reading before writing a storyboard)
  recipe.en.md          English version
  brief-template.md     The brief template to hand to a merchant
  brief-template.en.md  English version
  test-brief.md         One full sample brief
  expected.md           Which rules that sample brief should trigger (used for regression tests)
```

Copy an existing industry folder and rename it, fill in `rules.json` following the field documentation in `industries/_base/rules.json`, write `recipe.md` describing which shots this industry should use and its common compliance pitfalls, then write a `test-brief.md` + `expected.md` and run `node scripts/test-rules.mjs` to confirm the rules actually fire.

</details>

### Validation and compliance

The rules in `scripts/validate.mjs` are compiled from publicly available advertising-law superlative-word lists and public platform rules, in three tiers:

- **error (block)**: must be fixed, or `make.mjs` refuses to render.
- **warning (warn)**: recommended to fix, not enforced.
- **human review**: things a machine can't judge (e.g. "is this photo actually authorized", "is this review genuine"), listed as a checklist for the publisher to confirm after rendering.

It also checks line wrapping, safe areas, fields written in the wrong place, and whether numbers on screen have a source (`meta.facts`); pass `--brief <brief>` when rendering and it checks that every number and quote in the facts comes from the brief. **These rules are for self-checking only and are not legal advice**; see ["Copyright and license"](#copyright-and-license).

### Originality check and recipe crafting

Just as homebrewers share recipes, the project welcomes three ways to play:

- **Use**: brew with an existing recipe.
- **Remix (reskin)**: `node scripts/gen-styles.mjs --new <id>` scaffolds a new style; copy over the shots and `tokens.json` you want to keep from the source style, then change palette, fonts and characters. For a color-only variant, editing `themes` in `tokens.json` is enough.
- **Create (craft a recipe)**: follow the six-step process in [`distill/`](distill/README.en.md) to break down a reference video: extract frames and find cuts (`scripts/extract-frames.mjs`) → nine-layer breakdown + signature list → replicate (local only, never committed) → **redesign** → componentize → cheap-model test → review. `distill/prompts/` has a ready-to-use prompt for each step, and `styles/_template/` is the blank template for a new style. `quiz` and `journey` were made this way, with a quiz-style short video and a character-journey short video as their references.

**Redesign + originality check is a required step**, for remixes and new styles alike. We want a style of the same genre, not a one-to-one copy.

<details>
<summary><b>What the originality check requires</b></summary>

- **The skeleton may stay**: narrative structure, rhythm, motion techniques, camera language and layout principles belong to the genre and anyone can use them.
- **The skin must be redone**: palette, type treatment, character design and character colors, signature details, fixed copy lines, and branded endings.
- **Prove the distance with numbers**: run `node scripts/check-originality.mjs --style <id> --ref <reference tokens.json> --signatures <signatures.md>` (keep the reference tokens and signature list outside the repo). Theme chromatic colors must be at least ΔE2000 20 from every reference chromatic color, backgrounds at least 8, the primary + accent pair must not match any reference pair, outlines must differ, no color may be copied, and every signature item needs a `Replaced with: …` (or `已替换为：…`) or `Removed` entry in `styles/<id>/originality.md`.
- **Review scores confusability** from 1 to 10 and only ≤ 3 passes: someone who knows the reference should see at a glance that it is not the same maker.
- In v0.2.1 `quiz` and `journey` went through this step and replaced the v0.2.0 skin wholesale; see each style's `originality.md` for the item-by-item record.

Reference videos and their stills, extracted frames, characters, brand names, URLs, film clips and palette tokens never go into the repo. Keep the raw breakdown and the signature list outside the repo; the repo only holds breakdown text you wrote, characters and scenes you drew, and sample content you wrote. Steps and the PR checklist: [CONTRIBUTING.en.md](CONTRIBUTING.en.md).

</details>

### Render QA and the delivery manifest

`node scripts/make.mjs <storyboard> --out <dir>` runs the whole chain: validate → machine self-check → copy assets → music → render (with layout and Chinese-character probes) → contact sheet + check frames → `manifest.json`.

- **A ✗ means no delivery**: if the machine self-check, text layout, layout check, the Chinese-character scan for English videos, or the blank-frame check (more than 95% of the screen one color for more than 6 frames in a row) has any ✗, the video is renamed `video.rejected.mp4` and kept only so a person can see what broke.
- **Check frames on the beat that matters**: for one-take recipes like journey, the check frame is taken on the beat set by the shot spec's `checkBeat`, when the content card has settled; its title and category name must be visible.
- **Delivery manifest**: on success it writes `manifest.json` with the storyboard's sha256, the video's sha256 / duration / size, the generation time and every check's result; the last terminal line is `交付：<mp4 path>` ("delivered"). No such line means no video.
- **Verify a video**: `--verify` checks that the video in a folder still matches the current storyboard; if the storyboard changed, render again.
- **Concurrency**: several instances can run at once; the render step queues automatically, and a lock held by a dead process is reclaimed.
- Keep test output outside the repo with `--round <round>`.

## FAQ

<details>
<summary><b>Where does the background music come from?</b></summary>

`scripts/make_bgm.py` synthesizes it on the spot with numpy / scipy: instruments, harmony, melody, mixing and mastering are all in the script, with no external sample library. `make.mjs` passes it the start time of every shot; each shot is one section, and its writing is picked by position and mood (hook, tension, lift, groove, peak, ending). Notes land on whole or half beats, and every shot change gets a cymbal or a fill, so the music follows the cuts. Loudness is normalized to -16 LUFS with ffmpeg's ebur128 (approximated by RMS if ffmpeg can't be found).

Because it is synthesized on the spot, there are no copyright issues. When you publish on a platform such as Douyin, you can also swap in music from the platform's own library: render a silent version with `--no-bgm`, then add music on the platform.

</details>

<details>
<summary><b>Is there a voice-over?</b></summary>

Yes, since v0.5.0, through MiniMax text-to-speech. Write `meta.voice` and a `vo` per shot, set the `MINIMAX_API_KEY` environment variable, and render. Shot lengths follow the narration, subtitles light up word by word, and the music ducks under speech. Without a key, add `--voice-provider mock` to preview the rhythm with a placeholder voice. Without `meta.voice` there is no voice-over, as before. When you publish with an AI voice, tick the platform's AI-generated content declaration as it requires.

</details>

<details>
<summary><b>Why illustrations instead of real footage?</b></summary>

The project does not generate images that look like "real photography". Without merchant material, the video falls back to components and simple line-drawn illustrations and labels them clearly, rather than passing them off as real photos. With the merchant's real photos (store, finished product, price list), use the real-photo shots; the result is far more convincing. Whether a photo is authorized goes on the human-review list.

</details>

<details>
<summary><b>Can I publish the video as rendered?</b></summary>

Not yet recommended. Treat the video as a first draft: watch the whole thing, fix awkward copy and repeated selling points, then publish. For industry videos, check every price, condition, date, opening hour and distance on screen against the brief, one by one. See ["Known limitations"](#known-limitations) for test results.

</details>

<details>
<summary><b>Does it cost anything?</b></summary>

The project is free and open source. Model calls use your own API key and are billed by the provider for what you use; the project handles no money. Rendering runs on your own computer. The rendering engine Remotion charges for-profit organizations with 4 or more people; see the next question.

</details>

<details>
<summary><b>Does Remotion need a license? What about upgrading to 5.0?</b></summary>

Remotion is source-available, not open source: free for individuals, for-profit companies with 3 or fewer people, and non-profits (including commercial use); **for-profit organizations with 4 or more people must purchase Remotion's Company License**, see <https://www.remotion.dev/license>. This repo's Apache-2.0 license does not change Remotion's own license terms; details in `THIRD_PARTY_LICENSES.md`.

This repo pins `remotion` / `@remotion/cli` to `4.0.529`. After upgrading to 5.0, Remotion's free tier requires passing a `licenseKey` in config (individuals / companies with ≤3 people / non-profits use `"free-license"`); see the [Remotion license page](https://www.remotion.dev/license). Read `THIRD_PARTY_LICENSES.md` before upgrading.

</details>

<details>
<summary><b>Anything to watch for on Windows?</b></summary>

- x64 only.
- Set environment variables the PowerShell way, `$env:LLM_API_KEY="..."`, not `export`.
- `--props` fails with "neither valid JSON": the Windows shell mangles quotes inside JSON strings, so storyboards are always passed as a file path (`--props=./storyboard.json`), never as an inline JSON string. `make.mjs` / `llm_make.py` already do it the file-path way.
- `make.mjs` calls `python` on Windows and `python3` on macOS / Linux; if yours lives elsewhere, point the `PYTHON` environment variable at it.

</details>

<details>
<summary><b>Do I need a system ffmpeg?</b></summary>

No. The contact sheet `sheet.png` is rendered by Remotion's `Sheet` composition (one frame per second of the video, tiled as thumbnails, each labelled with its time and shot number). The check frames `check/*.png` are extracted from the video with Remotion's bundled ffmpeg, and any frame that can't be extracted is rendered as a Remotion still instead. If you set `FFMPEG=/path/to/ffmpeg`, the sheet is tiled with its `tile` filter first and falls back to the `Sheet` composition if that fails. A missing sheet never affects `video.mp4`; the terminal prints the reason.

</details>

<details>
<summary><b>A platform's compositor package is missing from the lockfile after <code>npm install</code>?</b></summary>

`package-lock.json` should contain 7 `@remotion/compositor-*` platform packages (win32-x64-msvc / darwin-arm64 / darwin-x64 / linux-x64-gnu / linux-x64-musl / linux-arm64-gnu / linux-arm64-musl). If the one for your platform is missing, delete `template/node_modules` and `template/package-lock.json` and re-run `npm install` on the target platform (a known npm optional-dependency quirk: a lockfile generated on one platform doesn't always include every platform).

</details>

<details>
<summary><b>Chrome Headless Shell fails to download?</b></summary>

`npx remotion browser ensure` may not be able to reach Google's download endpoint from some networks. Download it manually and point to a local Chrome / Chromium install with `--browser-executable` (rendering results may differ slightly between Chrome versions).

</details>

<details>
<summary><b>Why the name "BrewReel" (精酿, "craft brew")?</b></summary>

Good beer comes from a good recipe, even with ordinary ingredients. A strong model first gets a video style right; its layout, motion, pacing and rules are then written down as a "recipe": ready-made components plus a validator. A low-cost model like DeepSeek is the ordinary ingredient: it follows the recipe, fills in a storyboard, and brews a video at the same level. The docs use the same words throughout: style pack = recipe, deriving a style from a reference video = crafting a recipe, rendering = brewing. Paths and fields such as `styles/`, `meta.style` and `distill/` keep their original names.

</details>

## How it works

```
Product brief
  → pick a recipe: meta.style = cards / quiz / journey, meta.industry = an industry pack
  → the cheap model writes storyboard.json (pick shots, fill in text; no code, no coordinates)
  → validate.mjs (hard rules + ad-law / industry compliance; the report goes back to the model)
  → brew with make.mjs (music → render → contact sheet → check frames → delivery manifest)
  → human pre-publish check ("Pre-publish checklist" in SKILL.md)
```

- **Brief**: the merchant, or you, fills in a product brief; the generic template is [`brief-template.md`](brief-template.md), and each industry has its own `industries/<id>/brief-template.en.md`.
- **Pick a recipe**: choose the recipe and industry pack by content and put them in the storyboard's `meta`.
- **Write the storyboard**: the model reads `SKILL.md` (the instructions for AI assistants; English version `SKILL.en.md`), the recipe's `recipes.md` and the industry's `recipe.md`, and outputs one JSON file.
- **Validate**: `node scripts/validate.mjs storyboard.json` produces a report that names the shot and field to fix and how; `llm_make.py` and the plugin feed the report back to the model verbatim.
- **Brew**: `make.mjs` renders in one command and refuses delivery if any self-check has a ✗; see ["Render QA and the delivery manifest"](#render-qa-and-the-delivery-manifest).
- **Human check**: delivery comes with a pre-publish checklist of things a machine can't judge (photo authorization, genuine reviews, price conditions and so on) for the publisher to confirm.

<details>
<summary><b>Directory structure</b></summary>

```
brewreel/
  SKILL.md / SKILL.en.md      The instructions an AI assistant reads (how to pick shots, fill fields, follow the flow)
  README.md / README.en.md    This file
  LICENSE / NOTICE / THIRD_PARTY_LICENSES.md
  shots.md / shots.en.md      Parameter reference for all 18 shots
  brief-template.md           Generic brief template
  docs/
    shots/                    Detailed per-shot docs (18 shots × 2 languages)
    images/                   The logo and example images used in the READMEs
  industries/                 The six industry packs
  scripts/
    validate.mjs              Validation entry point
    make.mjs                  One-command render
    llm_make.py               Headless mode: brief → storyboard → video
    make_bgm.py               Parametric original background music
    build_docs.mjs            Generates shots.md / shots.en.md from spec.json files
    privacy-scan.mjs          Pre-publish privacy self-check
    check-originality.mjs     Originality check: color difference from the reference (CIEDE2000) + signature-by-signature record
    checks/ lib/              Rule implementations
  template/                   The Remotion rendering project
    src/shots/                18 shared shot components + parameter specs (used by cards)
    src/styles/               Per-recipe manifest, design tokens and shots; registry.gen.ts is generated by scripts/gen-styles.mjs
    src/core/                 Fonts, themes, animation, layout helpers
    src/illust/               Industry fallback illustrations
    public/                   Fonts, sound effects, sample assets
  examples/                   9 ready-to-render storyboard samples (six industries + English + two generic samples, all cards)
  styles/                     Recipes (style packs): nine-layer spec, narrative templates, rules, examples; _template/ scaffolds a new style
  distill/                    Recipe crafting and reusable prompts (breakdown → replicate → redesign → componentize → test → review)
  CONTRIBUTING.en.md          How to contribute (use / remix / create, PR checklist)
  integrations/
    deepseek-harness/         DeepSeek Harness plugin dsh-brewreel (7 tools)
  tests/
    validate/                 Positive/negative regression tests for the validator
    rules/                    Regression tests for each industry's rules (4 cases each)
    originality/              Unit tests for the originality check (color difference, rules, signature records)
```

</details>

## Known limitations

- **Still a preview**: testing and bug-fixing are ongoing. **We don't yet recommend publishing a video as rendered, without human edits.**
- **Cheap-model results are not yet "fine to publish as is"**: in the latest round a small model played the cheap model, got only the brief and `SKILL.md`, and wrote the storyboard from scratch, validated and rendered, 9 videos in all. None reached 7, the score we set as "fine to publish as is". Software/tool videos scored 5–6 overall and 7–8 on compliance; industry videos 4–5 on both, losing most points on cross-field factual problems.
- **quiz / journey not re-tested after the fixes**: each recipe was tested with 3 videos and the problems the review listed were fixed, and the sample storyboards passed validation and delivery checks again; but the cheap model has not re-run a scored round, so the published scores are still from before the fixes. Nobody has listened to journey's music and sound effects yet.
- **Voice-over not yet tested with a real key**: the MiniMax client follows the official docs and is unit-tested against recorded fake responses, and the whole pipeline runs end to end with the placeholder (mock) voice; nobody has yet checked the real voices or billing.
- **Illustrations only without real photos**: with no merchant photos, the visuals come from components and illustrations, which hurts industry videos most.
- **The DeepSeek Harness plugin has not been tested against a real DeepSeek model yet**.
- **Not supported**: medical aesthetics, prescription drugs / medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco.

**Main remaining problems** (issues with concrete counter-examples are welcome):

1. **Price conditions can be bypassed by deleting facts.** Checks on price conditions, date ranges and surcharges only apply to what the model itself put in `meta.facts`. If the model deletes those facts, nothing checks the prices on screen. In testing this lost a holiday price and surcharge amounts, promotion dates, a validity period, and one paid add-on. `--brief` checks that the facts come from the brief, but not that the brief's price conditions made it onto the screen.
2. **Components can silently drop data.** For example, the mockApp dashboard shows only as many rows as fit, and ignores an unsupported `done` field; validation reports neither.
3. **Truthfulness of locations and illustrations.** The model still invents claims like "a 3-minute walk", and the store card adds a "navigation estimate" line on its own. Validation does not yet fully catch an illustration captioned as "our own work", an illustration that doesn't match its label (e.g. a mountain labelled as a bathroom), or real data labelled as sample data.
4. **Template feel.** Different videos often share the same cover, default line chart, white end card and bottom decoration, with only the text and colours changed.
5. **Copy quality is not checked automatically.** Nothing catches a word cut in half, awkward phrasing, English grammar or sentence-case errors, the same selling points repeated three times in one video, or contradictions such as "three taps" vs "one-tap". Hype words without digits (e.g. "doubled", "everyone loves it") also get through.
6. **The core action isn't required on screen.** For a tool, an action like "tap Start" may end up shown as an unrelated screen, and validation doesn't check this.
7. **Layout.** Brand-colour numbers on dark themes can have too little contrast. Some panels leave their lower half empty when there is little content. Overlapping photo callouts are only caught after the render, which wastes several minutes. A priceCard filled to capacity scales down to 0.8, and some small text drops below 26px.
8. **Coverage of English and asset checks.** The industry compliance word lists are written for Chinese, so English copy is checked less thoroughly. Assets are only checked at the file level (the same image, renamed copies, a screenshot passed off as a photo). Whether two photos show the same customer, or whether consent was obtained, can only go on the human-review list.

**Recommended use**: treat the video as a first draft and watch the whole thing before you edit and publish; passing validation alone is not enough. For industry videos, use the merchant's real photos where possible and pass `--brief <brief>` when rendering; before delivery, check every price, condition, date, opening hour and distance on screen against the brief. Keep test output outside the repo with `--round`.

<details>
<summary><b>Test method and results by round</b></summary>

**How it was tested**: earlier rounds used a DeepSeek-class cheap model to write storyboards in bulk. The latest round (before the v0.2.0 release) used a small Claude Haiku-class model as the "cheap model": it got only the brief and `SKILL.md`, and had to write the storyboard from scratch, run validation and render. That produced 9 videos: 4 software/tool videos (a chat-assistant app, a tool for publishing WeChat Official Account articles, a data Q&A tool, and a focus timer with English subtitles) and 5 industry videos (one each for food, ecommerce, education, beauty and travel). **No real merchant photos were used** anywhere; the visuals come from the components and the illustration fallback. A person reviewed every video frame by frame, scored it out of 10 for "overall" and "compliance", and checked the storyboard against the brief line by line.

**Results of this round**: none of the 9 reached 7.

- Software/tool videos: overall 5–6, compliance 7–8. The best one scored 6 and demonstrates the whole feature: chat → analysis → suggested replies → insert.
- Industry videos: overall 4–5, compliance 4–5. Most points were lost on cross-field factual problems (items 1 and 3 above).
- Last round's serious defects mostly did not come back: no Chinese characters on screen in the English video (94 sampled frames), speed claims were blocked, the same image can no longer serve as before and after, the price-card component no longer drops items, route labels now show the destination, and videos with a ✗ in the layout check are refused delivery.
- Delivery: the model delivered a video by itself in 5 of the 9 runs. In 2 runs the model quit while its render was still queued, 1 render was interrupted halfway, and 1 run was blocked by a `make.mjs` bug: with `--brief`, make passed the file path instead of the brief text, so every number was reported as "not found in the brief". That bug is fixed. Two more changes followed: `make.mjs` refuses an `--out` inside the repo, and `SKILL.md` tells the model not to stop until it has seen the `交付：` ("delivered") line.

**Testing the quiz recipe**: a cheap model read only `SKILL.md` and the docs in `styles/quiz/`, then wrote 3 storyboards from scratch and rendered them: a foreign phrase, a software-feature quiz and a food quiz. A person scored each out of 10 for "style" (how well it matches the style) and "overall". Results before the fixes:

| Storyboard | Style | Overall |
|---|---|---|
| Foreign phrase (phrase) | 7 | 6 |
| Software-feature quiz (app-feature) | 6 | 4 |
| Food quiz (food-guess) | 6 | 4 |

The QA review listed 10 problems. Items 1–9 are fixed; item 10 is only partly done. Main changes:

- **Spoiling the answer before the question**: new check Q10. The hook's context line, every line of the film clip, and the subtitle bar on the quiz card may not contain the correct option, the "=" lines of the meaning card, or the numbers in them. Re-run on those 3 storyboards, all 3 are now blocked.
- **Subtitle bar on the quiz card**: by default it shows only the half of the clip's last line that contains the key phrase; `quizLine` lets you write it yourself (≤12 characters, no answer). The software and food templates now say "show the feature or dish name, not the effect".
- **Solid-color blank frames**: `make.mjs` adds a blank-frame check. If more than 95% of the screen is one color for more than 6 frames in a row, the video is not delivered.
- Also added Q11–Q13: in a quantity question every option must be a quantity; UI mockups (screen / phone) must include the real on-screen text; a clip requires the replay beat (`replay`).

After the fixes, all 5 sample storyboards in `styles/quiz/examples/` were re-validated and rendered: `make.mjs` exited 0 each time, the last line was always `交付：…` ("delivered"), and both the layout check and the blank-frame check passed.

**Testing the journey recipe**: same method as quiz. A cheap model read only `SKILL.md` and the docs in `styles/journey/`, then wrote 3 storyboards from scratch and rendered them: a software feature tour (app-tour), a content-platform channel tour (content-site) and a sightseeing route (city-walk). A person scored each out of 10 for "style" and "overall". Results before the fixes:

| Storyboard | Style | Overall |
|---|---|---|
| Software feature tour (app-tour) | 5.5 | 4 |
| Content-platform channel tour (content-site) | 7 | 5.5 |
| Sightseeing route (city-walk) | 5 | 3.5 |

None of the three reached 7. The QA review listed 10 problems and all 10 were addressed; item 10 (colours) is only partly done: the review asked for a softer palette overall, but the style spec forbids copying the reference video's colours, so the palette was only partly softened. Main changes:

- **Props that didn't match the subject** (item 1): a new backdrop option, `opening.params.skyline`: `modern` city (default) / `street` (low-rise lanes) / `oldtown` (white walls, tile roofs, a stone bridge over a canal), plus new districts such as market, city gate, stone bridge, teahouse and lanterns. Validation now blocks an old-town subject that doesn't use `oldtown`, and districts whose props don't fit the backdrop (e.g. a postbox street in the old town).
- **The per-stop content card was never checked**: in a one-take film the content card (a billboard at the time, a postcard since v0.2.1) folds away mid-shot, and the check frame used to be taken at the end of the shot, where it is already gone. `make.mjs` now takes the check frame on the beat set by the shot spec's `checkBeat`, when the card has settled. The card title and category name must be visible on that frame (`mustShow`), and another district's category name in the same frame also counts as an error; either one refuses delivery.
- **Numbers without a source**: prices and opening hours on screen must be copied from `meta.facts`, and the number in the hook must be either the district count or backed by the facts. When a promo word appears, the error now names the word and first says to delete it, asking for dates only if the promotion is real; a promotion date in a notice that isn't in the facts is blocked too (the model used to invent a date to get past validation).
- **Copy warnings**: a category name cut off mid-word, a hook like "5 ledger streets" that doesn't read, a long title with no pause, and an end card with only a slogan (no number and no way to get the product) each raise a warning.
- **Fields in the wrong place**: fields that belong in `params` but were written at the top level of a shot now produce one merged error with the correct shape, instead of one error per field.

After the fixes, the 3 sample storyboards in `styles/journey/examples/` (a podcast platform at 4:5, a notes app at 9:16, an old-town route at 9:16) were re-validated and rendered; all passed validation and `make.mjs`'s delivery checks.

</details>

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

## ☕ Buy me a coffee

If BrewReel saved you an evening of video editing, feel free to buy me a coffee. Every recipe here was brewed on a lot of coffee: keep the cup filled and the next recipe comes sooner. If a new style suddenly shows up in the repo one day, this cup probably helped 😄

<p align="center">
  <img src="docs/images/contact/wechat-donate-v3.png" width="260" alt="WeChat appreciation QR code (name hidden)" />
</p>

<p align="center"><sub>Only if it's easy for you, no pressure. A Star, an issue, or showing me a video you brewed makes me just as happy.</sub></p>
