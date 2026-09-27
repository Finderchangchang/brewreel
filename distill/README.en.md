# Crafting a recipe: turning a reference video into a reusable style pack

中文：[README.md](README.md)

In 精酿 · BrewReel a style pack is a "recipe", and this process of drawing a new style out of a reference video is "crafting a recipe" (earlier versions called it style distillation, hence the folder name `distill/`).

Goal: learn a good short video's **method** (structure, rhythm, motion, camera, layout) without taking its **look** (palette, characters, signature details, stock phrases, branded ending), then turn the method into components so a cheap model can produce films of similar quality by filling in fields.

The bar in one line: **same genre, but anyone who knows the reference can tell at a glance it is not the same brand.** Quality must not drop because of the reskin.

Six steps, each with a reusable prompt that any AI coding assistant can follow. The prompts in `prompts/` are written in Chinese; they are plain step lists and translate directly.

| Step | Output | Prompt | Who |
|---|---|---|---|
| 1. Breakdown | Nine-layer breakdown, beat table, token draft and a numbered **signature list** `signatures.md` (all kept outside the repo) | `prompts/01-breakdown.md` | Strong model, using measurements from `scripts/extract-frames.mjs` |
| 2. Replica (to learn the skeleton; never published) | A film "in the style" that shows what really drives the look; **not committed, not published** | `prompts/02-replicate.md` | Strong model |
| 3. **Redesign (reskin)** | Palette, type treatment, characters, signature details, stock phrases and ending all replaced with our own; `styles/<id>/originality.md`; `check-originality` passes | `prompts/redesign.md` | Strong model |
| 4. Componentize | Tokens, shots and specs in `template/src/styles/<id>/`; docs and rules in `styles/<id>/` | `prompts/03-componentize.md` | Strong model |
| 5. Cheap-model test | A cheap model reads only the docs, writes 3 storyboards and renders them; log its mistakes | the normal `SKILL.en.md` flow | Cheap model |
| 6. Review and fix | Score against the reference, including **confusability** (1–10, must be ≤ 3), list problems, fix rules and components | `prompts/04-review.md` | Another model or a person |

Step 2 is for understanding: it may run the skeleton on the measured values first. Step 3 is for making it ours: every palette choice, layout detail and placeholder character from the replica is replaced. Do not start step 4 before step 3 passes, and never set `status` to `stable` before it does.

## Skeleton vs skin

Test: **if you swap it out, can viewers still tell which brand this is?** Yes → skin, must be replaced. No, it only says "this kind of video" → skeleton, may stay.

| Layer | Includes | What to do |
|---|---|---|
| Skeleton (genre) | Narrative structure, segment order, rhythm (BPM, beats per segment), motion techniques (overshoot entrances, hard-cut states, word-by-word reveal, parallax, slow-down as close-up), camera language (one take, page push-up, zoom-out into a frame), layout principles (safe areas, hierarchy, a "one primary + one accent + one dark" palette structure), interaction mechanics (countdown before the reveal, asking viewers to answer) | Keep; document in `STYLE.md` |
| Skin (look) | Concrete colors (background, primary + accent pair, outline, prop and category colors), type treatment (weight contrast, outline and shadow, the exact emphasis style), characters (shape, costume colors, props, transformations), signature details (a small shape always in the same spot, a mascot that always enters the same way, a marker of a fixed shape), stock phrases (the question, replay and call-to-action lines used in every episode), branded ending (end-card layout, URL / logo animation, how the stat card appears) | Rebuild; record each item in `originality.md` |

Examples (described abstractly):

| In the reference | Skeleton or skin | What we can do |
|---|---|---|
| Three-beat countdown before the reveal | Skeleton (mechanic) | Keep the countdown; design its look ourselves (progress ring, filling grid, hourglass) instead of a big number in the same color and spot |
| Keywords in the primary color, answers in the accent | Skeleton (palette structure) | Keep the structure; pick our own pair, ΔE00 ≥ 20 from every reference color |
| A question-mark block of a fixed shape and color next to the title | Skin (signature detail) | Drop it or use a different device (hand-drawn wave, stamp, bracket note) |
| A mascot peeking out from a corner | Skin (signature detail and entrance) | Show characters only in story shots, or enter differently (slide up from the bottom, hang on the quiz board) |
| Full-screen primary card with strike-through to reject a wrong reading | "Reject a wrong reading" is skeleton; the full-screen card with strike-through is skin | Use a flip card, a stamp or a comparison table |
| The same question / replay / comment call-to-action line every episode | Skin (stock phrase) | Write 2–3 lines of our own and rotate them in `recipes.md` |
| Each district shows an object with sample content | Skeleton | Keep; choose our own object (shop sign, balloon banner, window display, bus ad) rather than the same elevated billboard with bulbs |
| A fixed HUD: brand pill top left, category pill top right, progress dots | "Show progress" is skeleton; this exact set and placement is skin | Move and restyle it (route bar at the bottom, mileage badge, chapter stickers) |
| The whole scene zooms into an interface frame with a stat card at the end | "End on the product" is skeleton; this zoom + stat card combo is skin | End differently: land in a phone screen, fold the map into an icon, open a booklet |
| A mascot + a vehicle + a set of expressions | Skeleton (character structure) | Keep the structure; draw our own shape, colors and props |

Measurements for step 1:

```
node scripts/extract-frames.mjs <reference video> --out <folder outside the repo> --fps 4 --audio
```

Output: `info.json` (duration, size, fps, scene cuts, biggest changes), `frames/`, `contact.html`, `cuts/`, `audio.wav`; plus `contact.jpg` when `FFMPEG` points to a full ffmpeg build.

## The measurable check in step 3

```
node scripts/check-originality.mjs --style <id> --ref <outside>/tokens.json --signatures <outside>/signatures.md
```

It compares the style's `tokens.json` with the reference `tokens.json` using CIEDE2000 (ΔE00) and exits with code 1 if any rule fails:

1. Every chromatic color in every theme (CIELCh chroma C* ≥ 12) is ≥ 20 from every chromatic reference color.
2. Backgrounds are ≥ 8 from every reference background.
3. The primary + accent pair must not sit within 25 of any two reference colors at the same time (passing one by one is not enough).
4. Near-black / near-white neutrals skip rule 1, but the outline color must not equal the reference outline.
5. Colors outside the themes (prop colors, category colors, character palettes added with `--extra`) within 3 of a reference color count as copied; within 20 they are only listed, or fail with `--strict`.
6. With `--signatures`, every item in the signature list needs a `已替换为：…` / `Replaced with: …` line (or `已删除` / `Removed` for items dropped entirely) in `styles/<id>/originality.md`.

Useful flags: `--suggest` proposes the nearest passing color for each failure; `--extra <file>` also scans colors hard-coded in character or scene code; `--svg <path outside the repo>` writes a swatch sheet.
The script only checks colors and whether the record is complete. Whether characters, layout or phrasing still look alike is judged by the confusability score in step 6.

**Copyright, at every step**: reference videos, stills, frames, characters, brand names, URLs, film clips, the reference `tokens.json` and the original signature list stay outside the repo. The repo holds only our own notes, our own drawings and our own sample content. Docs say "based on a <genre> short video" and never name the other brand. List the other brand's assets and signature details as a numbered signature list, then record a replacement for each one during the redesign.

**Done when**: a cheap model can write passing storyboards from `SKILL.en.md` + `STYLE.en.md` + `recipes.md`; frame 0 has content and a hook; font floors and safe areas hold; `check-originality` passes and `originality.md` is complete; next to the reference the quality is comparable with a confusability score ≤ 3; and it is easy to tell apart from the existing styles.
