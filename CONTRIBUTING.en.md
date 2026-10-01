# Contributing

中文：[CONTRIBUTING.md](CONTRIBUTING.md)

The core of 精酿 · BrewReel is the **style pack**, which we call a "recipe": one visual style = design tokens + a set of shot components + validation rules + narrative templates. A cheap model only writes the storyboard JSON; the style pack makes it look good and keeps it safe. Three levels of contribution:

| Level | What you do | What you change |
|---|---|---|
| **Use** | Make films for your product with an existing style | Nothing; follow `SKILL.en.md` |
| **Remix** | Copy a style pack and change palette, fonts, characters, rhythm | `tokens.json`, character components and `STYLE.md` in your new style folder |
| **Create** | Break down a reference video with the shared template and craft a new recipe (a new style) | Two new folders plus one command to register; see `distill/` |

## Anatomy of a style pack

```
styles/<id>/                       for humans and models
  STYLE.md / STYLE.en.md           nine-layer spec
  recipes.md                       narrative templates: which shot on which beat, which fields the model fills
  rules.json                       declarative rules (duration, shot count, required shots, order, max counts)
  checks.mjs                       optional cross-field rules
  examples/                        storyboards that validate and render
  README.md                        a short blurb
template/src/styles/<id>/          code
  style.json                       manifest: status, default aspect, aspects, bpm, first/last shot, reusable common shots, palettes
  tokens.json                      design tokens
  index.ts                         export default defineStyle({...}); optional Film / Background / Overlay
  shots/<type>.tsx + .spec.json    style-specific shots (the spec is also used by the validator)
```

A storyboard opts in with `"meta": {"style": "<id>", "aspect": "9:16" | "4:5"}`; without it the default `cards` style is used.

## Remix

1. `node scripts/gen-styles.mjs --new <id> --name <Chinese name> --name-en <English name>` creates a blank style (status: draft).
2. Copy the shots and `tokens.json` you want from the source style and change the tokens. Components read values only through `useStyleTokens()` / `useStylePalette()`.
3. Draw your own characters and scenes (SVG / CSS). Do not trace anyone else's characters.
4. Explain in `STYLE.md` how it differs from the source and what it fits.
5. Prove it moved away from the source: `node scripts/check-originality.mjs --style <new id> --ref template/src/styles/<source>/tokens.json` (use `template/src/core/themes.json` when the source is cards), and fill in `styles/<new id>/originality.md`.
6. Go through the PR checklist below.

## Create: craft a new recipe from a reference video

Full process and reusable prompts: [`distill/`](distill/README.en.md) (breakdown → replica, to learn the skeleton and never published → **redesign (reskin)** → componentize → cheap-model test → review and fix). The rule: the skeleton (structure, rhythm, motion techniques, camera language, layout principles) may be learned; the skin (palette, type treatment, characters, signature details, stock phrases, branded ending) must be our own — same genre, but anyone who knows the reference can tell it is not the same brand.

1. `node scripts/extract-frames.mjs <reference> --out <folder outside the repo> --audio`, then write the nine-layer breakdown with `distill/prompts/01-breakdown.md`, plus a numbered signature list `signatures.md` (both outside the repo).
2. `node scripts/gen-styles.mjs --new <id>` creates a draft; build a replica with `distill/prompts/02-replicate.md` to understand the skeleton. The replica stays local and is never committed.
3. Redesign with `distill/prompts/redesign.md`: replace every piece of skin, record each one in `styles/<id>/originality.md`, and run `node scripts/check-originality.mjs --style <id> --ref <outside>/tokens.json --signatures <outside>/signatures.md` until it passes.
4. Put the **anonymized** findings into `styles/<id>/STYLE.md` and numbers into `tokens.json`; one `shots/<type>.tsx + .spec.json` per component, a one-take style writes a `Film`. Run `node scripts/gen-styles.mjs` after adding shots.
5. Write `rules.json` and `checks.mjs` from layer 9 of the breakdown.
6. Let an average model read only `SKILL.en.md` plus your `STYLE.en.md` / `recipes.md`, write storyboards, render them, and fix the rules and docs where it goes wrong.
7. Get a review with `distill/prompts/04-review.md`; the confusability score (1–10) must be ≤ 3.
8. Set `status` to `stable` when it passes.

## Copyright and privacy (hard rules)

- Reference videos, their stills and frames, characters, brand names, URLs and film clips never go into the repo; neither do the reference `tokens.json` and the original signature list.
- Docs say "based on a quiz-style short video" and never name the other brand. List the brand assets to avoid, with our replacements, in `STYLE.md`; record each signature detail, described abstractly, in `originality.md`.
- No one-to-one copies: palette, type treatment, characters, signature details, stock phrases and the ending are all rebuilt (criteria and checks in `distill/README.en.md`).
- No local paths, internal product names or API keys in the repo.
- New fonts must allow redistribution (e.g. OFL) and be added to `THIRD_PARTY_LICENSES.md`.

## PR checklist

- [ ] `node scripts/privacy-scan.mjs` passes
- [ ] No third-party brands, characters, film clips or reference frames; characters and scenes are our own
- [ ] `node scripts/gen-styles.mjs --check` passes
- [ ] `cd template && npx tsc -p .` has zero errors
- [ ] `node scripts/validate.mjs --specs`, `node scripts/test-validate.mjs`, `node scripts/test-rules.mjs` all pass
- [ ] Every storyboard example validates, including `examples/` and `styles/*/examples/` (if you touched shared code, render at least one cards film)
- [ ] New style: at least one storyboard in `styles/<id>/examples/` renders; frame 0 has content and a hook; font sizes ≥ 40 body / 34 panel / 26 minimum; key content inside the safe area (`template/src/core/aspects.json`)
- [ ] New style, remix, or changed palette / characters: the originality check passes — `node scripts/check-originality.mjs --style <id> --ref <reference tokens.json (outside the repo) or the source style's tokens.json> [--signatures <signature list outside the repo>]`; `styles/<id>/originality.md` is complete (skeleton kept, skin rebuilt, a "Replaced with" line for every signature item, check results, confusability ≤ 3)
- [ ] Touched `scripts/check-originality.mjs` or `scripts/lib/color.mjs`: `node tests/originality/originality.test.mjs` passes
- [ ] Docs in both languages (`STYLE.md` + `STYLE.en.md`; `SKILL.md` changes mirrored in `SKILL.en.md`)
- [ ] No test or render output committed (`make.mjs --out` points outside the repo)

Author: 柳伟杰 / Liu Weijie (Finderchangchang). Licensed under Apache-2.0; contributions are accepted under the same license.
