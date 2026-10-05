# Features

[← Back to README](../README.en.md) · [中文](features.md)


## Three recipes

A storyboard picks its recipe with `meta.style`; without it you get the default `cards`. Each recipe is a "style pack" with its own design tokens, shot components, validation rules and narrative templates: docs, rules and examples live in `styles/<id>/`, code in `template/src/styles/<id>/`.

| Recipe | Aspect | Fits |
|---|---|---|
| `cards` (default) | 9:16 | A single selling point, a how-it-works flow, UI demos, physical products and stores, price lists |
| `quiz` | 9:16 | A common misconception that can be framed as one multiple-choice question with exactly one right answer ("What does X actually mean?") |
| `journey` | 4:5 (default) / 9:16 | 4–6 clear categories, features or stops worth touring along one route |

How to choose: one multiple-choice question → `quiz`; 4–6 categories to tour → `journey`; everything else → `cards`, i.e. leave it out. `quiz` only supports 9:16. Its own shots (question, reveal, meaning card, etc.) can only be used in `quiz` and do not mix with the 19 `cards` shots; validation blocks a storyboard that mixes them.

```json
{ "meta": { "style": "quiz", "industry": "software", "lang": "zh" }, "shots": [ ... ] }
```

<details>
<summary><b>What each recipe looks like</b></summary>

**`cards`** (default, ready, 9:16): gradient background, a centered white card and bold outlined captions, one point per shot. Fits a single selling point, a how-it-works flow, UI demos, physical products and stores. Its 19 shots and samples for all six industries are in `examples/`. The six default themes keep the outlined captions: `warm-emotion`, `tech-dark`, `fresh-light`, `business-blue`, `festival-red`, `mono-premium`. Twelve optional palettes are listed in [`styles/cards/THEMES.md`](../styles/cards/THEMES.md).

**`quiz`** (ready, 9:16): the skin is a "marked answer sheet": dot-grid paper with a vermilion margin line, a deep primary plus an amber highlighter and a vermilion marking pen, monospaced labels, and cards with small radii and solid hard shadows. Three palettes (`sage-pine` grey-green paper + pine, the default; `rice-soy` rice paper + soy brown, the food default; `ash-teal` grey paper + deep teal) and three voices (`phraseTitle.params.voice`: `exam`, `chat`, `show`). Two original characters, one short and one tall: a host in headphones (the ear cup lights up and sends out sound waves when it clicks) and a buddy in a backwards cap. The beat is: circle a common misconception in red pen → an A/B/C question on an answer sheet with a stopwatch counting 3 → reveal with a check mark → a dictionary card flips in (the misreading struck through with a wavy line, numbered meanings) → replay the clip and stamp it → a short scene acting it out → a comment prompt → a stamp wipe that lands on the closing card. Fits products with a common misconception that can be framed as one multiple-choice question: what a foreign phrase really means, a software feature people often misread (e.g. "Archive = deleted?"), or why a dish is made the way it is. See [`styles/quiz/`](../styles/quiz/README.md); templates and length limits are in `styles/quiz/recipes.md` (Chinese); five sample storyboards are in `styles/quiz/examples/`.

**`journey`** (ready, 4:5 by default, 9:16 supported): the skin is "travel stationery" on a "layered paper-cut" city. Our own mascot, a red-panda cub on a hover board, crosses the city in one continuous take (far, middle and near layers and the character are each a sheet of paper with a hard offset paper shadow). It opens on split-flap station letters; a full-width ticket across the top shows the route, the stops and the current stop; each stop throws in an airmail-bordered postcard with a representative title, which is then "posted" into that stop on the ticket. Palette: postal green + neon lime + graphite outlines (`post-green`; `plum-ticket` is a wine-red alternative). One district per content category, three backdrops (modern city, low-rise street, or an old town with white walls, tile roofs and a stone bridge) and 14 district types picked by content (crossing, postbox, ticket check, photo booth, bus stop, night platform, phone, home, cafe, market, city gate, stone bridge, teahouse, lanterns), each with its own station- or mail-themed gag; the sky goes from day to night, and at the last stop the ticket from the top slides to the centre and unfolds, gets a hole punched in its stub and flips over to show the product name and slogan; at most one number, printed on the front beside the finish flag. Fits products with many clear categories: channels of a content platform, features of an app, stops on a sightseeing route. See [`styles/journey/`](../styles/journey/README.md); per-beat fields and length limits are in `styles/journey/recipes.md` (Chinese); three sample storyboards are in `styles/journey/examples/`.

</details>

## Voice-over (MiniMax / Alibaba Cloud / Volcengine)

Write `meta.voice` in the storyboard and one `vo` line (narration) per shot, and the video comes out with a voice-over. Without them you get a video with no voice, exactly as before.

- **Three providers**: set `meta.voice.provider` to `minimax` (MiniMax), `aliyun` (Alibaba Cloud Model Studio CosyVoice) or `volcengine` (Volcengine Doubao speech); each defaults to a male announcer voice, and voices can be changed. MiniMax has been rendered with a real key; Alibaba Cloud and Volcengine follow the official docs and are tested with fake responses, **not yet with a real key**.
- **The voice is the timeline**: `make.mjs` first has text-to-speech read each line and gets per-word timing, then sets each shot with narration to "0.15 s + narration + 0.35 s", aligned to the beat. The cheap model doesn't have to work out durations.
- **Word-by-word subtitles**: subtitles light up word by word with the voice, in all three recipes. You can also show the whole line at once (`line`) or skip narration subtitles (`off`). In `cards`, a shot with `vo` and no `caption` gets its subtitle from the narration.
- **Music makes room**: the background music ducks by about 10 dB under speech and comes back after.
- **Cached to save money**: the same line (same voice, speed, emotion and text) is synthesized only once and cached in the user folder `~/.cache/brewreel/tts` (change it with the `BREWREEL_TTS_CACHE` environment variable). Changing visuals or re-rendering costs nothing more; `manifest.json` records the characters billed for the run.
- **Preview without a key**: add `--voice-provider mock` when rendering to check rhythm with an offline placeholder voice (not a deliverable); add `--no-voice` for a version without narration.
- **Keys**: read only from environment variables, never written to any file or log: `MINIMAX_API_KEY` for MiniMax, `DASHSCOPE_API_KEY` for Alibaba Cloud, `VOLCENGINE_TTS_API_KEY` (or the legacy `VOLCENGINE_TTS_APP_ID` + `VOLCENGINE_TTS_ACCESS_TOKEN`) for Volcengine; optional hosts and workspace IDs are in `SKILL.en.md`. Custom endpoints must be https.

Which provider to pick, how to write it, recommended voices and length limits are in the "Voice-over" section of `SKILL.en.md`; each recipe has a sample storyboard with voice-over (`styles/*/examples/*voice*.json`).

## Six industry packs

| `meta.industry` | Description |
|---|---|
| `software` (default) | Apps, SaaS, tools |
| `food` | Restaurants, stores, single-item launches |
| `ecommerce` | Physical goods |
| `education` | Adult vocational training (not K12) |
| `beauty` | Non-medical beauty services |
| `travel` | Tourism, lodging, homestays |

`meta.lang`: `zh` (default, Chinese captions) / `en` (English captions).

- 12 general-purpose shots plus 7 industry shots (real photo, price card, store card, review card, before/after, fact sheet, credential card). `shots.en.md` is the parameter reference for all 19 shots; `docs/shots/*.en.md` has one detailed doc per shot.
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

## Talking-head B-roll

Use this (experimental) when a real talking-head video needs explanatory pictures on the lines about a step, a number or a comparison. Put only `talk.mp4` in a project folder and run one command, `node scripts/talk.mjs <project> --out <dir-outside-the-repo>`: it transcribes the talk on your machine, a cheap model writes `broll.json`, and scripts compute timing, price, generation and the final cut.

Two kinds of picture. Motion clips are free: five card types (keyword, checklist, steps, counter, compare) whose words are all copied from the speech and checked character by character. AI clips are generated with MiniMax H3, at most 2 per film by default, in wood blocks (the default), clay stop-motion, layered paper or ink sketch, with the same robot throughout; cost is estimated before anything is spent, and a person approves them on the review page.

Three placements: `full` covers the frame, `pip` keeps the face in a circle at the bottom right, `split` puts the picture on the top 60% and the face on the bottom 40% (vertical only). Captions can be added, omitted, or already burned into the talk (burned captions require `split`). Steps, price and limits: [`docs/broll.en.md`](broll.en.md).

## Validation and compliance

The rules in `scripts/validate.mjs` are compiled from publicly available advertising-law superlative-word lists and public platform rules, in three tiers:

- **error (block)**: must be fixed, or `make.mjs` refuses to render.
- **warning (warn)**: recommended to fix, not enforced.
- **human review**: things a machine can't judge (e.g. "is this photo actually authorized", "is this review genuine"), listed as a checklist for the publisher to confirm after rendering.

It also checks line wrapping, safe areas, fields written in the wrong place, and whether numbers on screen have a source (`meta.facts`); pass `--brief <brief>` when rendering and it checks that every number and quote in the facts comes from the brief. **These rules are for self-checking only and are not legal advice**; see ["Copyright and license"](../README.en.md#copyright-and-license).

## Originality check and recipe crafting

Just as homebrewers share recipes, the project welcomes three ways to play:

- **Use**: brew with an existing recipe.
- **Remix (reskin)**: `node scripts/gen-styles.mjs --new <id>` scaffolds a new style; copy over the shots and `tokens.json` you want to keep from the source style, then change palette, fonts and characters. For a color-only variant, editing `themes` in `tokens.json` is enough.
- **Create (craft a recipe)**: follow the six-step process in [`distill/`](../distill/README.en.md) to break down a reference video: extract frames and find cuts (`scripts/extract-frames.mjs`) → nine-layer breakdown + signature list → replicate (local only, never committed) → **redesign** → componentize → cheap-model test → review. `distill/prompts/` has a ready-to-use prompt for each step, and `styles/_template/` is the blank template for a new style. `quiz` and `journey` were made this way, with a quiz-style short video and a character-journey short video as their references.

**Redesign + originality check is a required step**, for remixes and new styles alike. We want a style of the same genre, not a one-to-one copy.

<details>
<summary><b>What the originality check requires</b></summary>

- **The skeleton may stay**: narrative structure, rhythm, motion techniques, camera language and layout principles belong to the genre and anyone can use them.
- **The skin must be redone**: palette, type treatment, character design and character colors, signature details, fixed copy lines, and branded endings.
- **Prove the distance with numbers**: run `node scripts/check-originality.mjs --style <id> --ref <reference tokens.json> --signatures <signatures.md>` (keep the reference tokens and signature list outside the repo). Theme chromatic colors must be at least ΔE2000 20 from every reference chromatic color, backgrounds at least 8, the primary + accent pair must not match any reference pair, outlines must differ, no color may be copied, and every signature item needs a `Replaced with: …` (or `已替换为：…`) or `Removed` entry in `styles/<id>/originality.md`.
- **Review scores confusability** from 1 to 10 and only ≤ 3 passes: someone who knows the reference should see at a glance that it is not the same maker.
- In v0.2.1 `quiz` and `journey` went through this step and replaced the v0.2.0 skin wholesale; see each style's `originality.md` for the item-by-item record.

Reference videos and their stills, extracted frames, characters, brand names, URLs, film clips and palette tokens never go into the repo. Keep the raw breakdown and the signature list outside the repo; the repo only holds breakdown text you wrote, characters and scenes you drew, and sample content you wrote. Steps and the PR checklist: [CONTRIBUTING.en.md](../CONTRIBUTING.en.md).

</details>

## Render QA and the delivery manifest

`node scripts/make.mjs <storyboard> --out <dir>` runs the whole chain: validate → machine self-check → copy assets → music → render (with layout and Chinese-character probes) → contact sheet + check frames → `manifest.json`.

- **A ✗ means no delivery**: if the machine self-check, text layout, layout check, the Chinese-character scan for English videos, or the blank-frame check (more than 95% of the screen one color for more than 6 frames in a row) has any ✗, the video is renamed `video.rejected.mp4` and kept only so a person can see what broke.
- **Check frames on the beat that matters**: for one-take recipes like journey, the check frame is taken on the beat set by the shot spec's `checkBeat`, when the content card has settled; its title and category name must be visible.
- **Delivery manifest**: on success it writes `manifest.json` with the storyboard's sha256, the video's sha256 / duration / size, the generation time and every check's result; the last terminal line is `交付：<mp4 path>` ("delivered"). No such line means no video.
- **Verify a video**: `--verify` checks that the video in a folder still matches the current storyboard; if the storyboard changed, render again.
- **Concurrency**: several instances can run at once; the render step queues automatically, and a lock held by a dead process is reclaimed.
- Keep test output outside the repo with `--round <round>`.
