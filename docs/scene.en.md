# Scene format (experimental)

The model writes the meaning. The engine computes the look. What a screen says, which words to emphasize, which layout, which style, and which motion character go in `scene.json`. Positions, type size, and entrance times are computed from the prototype, the glyph count, and the voice timing, then checked against the safe area, the type floor, and contrast.

This version is experimental. `quiz` and `journey` do not use it; keep their existing storyboards. `storyboard.json`, `lesson.json`, and `broll.json` still render with the current commands, unchanged.

![Opening frames of the three styles](images/scene-compare.png)

## Six axes

| Axis | Who writes it | What |
|---|---|---|
| Content unit | Model | The role and the copy: claim, points, compare, screenshot, number, end |
| Layout prototype | Model names it, engine places it | `hero`, `stack`, `grid`, `split`, `sequence`, `media`, `chart`, `end`, `board` |
| Style | Model names it | Color, radius, weight, texture. See Styles below |
| Motion | Model names the character | `crisp`, `bounce`, `soft`, `paper`, `push` |
| Time | Engine | Word starts when there is voice timing; beats when there is not. The two sources are not mixed on one screen |
| Hard constraints | Engine | Safe area, type floor, contrast at least 4.5, main copy already on frame 0 |

Do not write coordinates, pixels, frame numbers, or milliseconds. `when` is a contiguous phrase from the narration, not a time in seconds.

## Layout prototypes

| Name | Use |
|---|---|
| `hero` | One claim, or one big number |
| `stack` | Points stacked vertically |
| `grid` | Up to 4 points |
| `split` | Left and right |
| `sequence` | Ordered steps |
| `media` | One picture plus callouts. A screenshot board uses `board` |
| `chart` | At least two numbers that appear in the cited fact |
| `board` | Info board: kicker, judgment, evidence or a big number |
| `end` | Brand and one line |

Roles and layouts are not a free mix. A screenshot is `role: "media"` and `layout: "board"`. A big number is `role: "number"`. Its `text` is digits plus a unit, at most 6 glyphs, and it must be a contiguous piece of the cited fact.

## Styles

The six used in the examples:

| Name | Product | Look |
|---|---|---|
| `fresh-light` | `promo` | A. Gradient, rounded cards |
| `editorial` | `lesson` | B. Magazine. Radius 0, heavy type |
| `techbrief` | `promo` | Info board. The judgment sits on the stage; evidence and items stay on cards. Pair it with `push` |
| `cutpaper-collage` | `promo` | A whole cut-paper collage. One color card changes shape from scene to scene, with no fades. Pair it with `crisp`. Fits one object walking through the film (a ticket, old clothes, a place). Does not fit tutorials, dashboards, data compares, live people, or a chain of sentences |
| `impressionist` | `promo` | Water in short strokes across the whole frame, with hanging branches, an arch, lilies, and flecks of light. Type sits on a flatter stretch of water, behind a small mist that fades out. Pair it with `soft`. Fits culture, art, festivals, and mood. Does not fit a data-heavy explanation |
| `mural` | `promo` | An old wall painting. Every register stays filled: reeds, birds, a sun disk, profile figures, and pattern columns. Type sits on an inscription band only as wide as the line. Pair it with `soft`. Fits culture, art, festivals, and mood. Does not fit a data-heavy explanation |

Other promo themes are the names in `template/src/core/themes.json`, plus `techbrief`, `cutpaper-collage`, `impressionist`, and `mural`. Lesson styles are the names in `template/src/lesson/style-tokens.json`; the example uses `editorial`.

Do not pair `editorial` with `bounce`. Do not pair a promo style with `paper`. `paper` is the talking-head paper character.

`cutpaper-collage` may set `relay` to `card`, `patch`, `guide`, `tumble`, `postcard`, or `window`. Omit it and the layout picks one. The model still writes no coordinates and no seconds. A `src` on a screen is cropped into the garment; omit it for a flat silhouette.

## Motion characters

`crisp` is clean, `bounce` overshoots, `soft` eases, `paper` is a sheet, `push` enters from below. The character only picks the entrance curve and the lead. It does not pick the copy.

## Commands

Render a `scene.json`:

```
node scripts/scene/make-scene.mjs <scene.json> --out <directory outside the repo> [--style name] [--motion name] [--voice-provider minimax|aliyun|volcengine|mock] [--no-voice] [--no-bgm]
```

Convert an old storyboard or lesson file:

```
node scripts/scene/from-legacy.mjs <storyboard.json|lesson.json> --out <scene.json> [--skip-unsupported]
```

From a brief to a film (write the scene, then render):

```
node scripts/scene/brief-to-video.mjs <brief.md|json> --out <directory outside the repo> [--assets <asset-list.json>]
```

If any screen has narration, pass `--voice-provider` or `--no-voice`. Otherwise the command stops. Without that provider's key, use `--voice-provider mock` to check rhythm. Mock is offline, unbilled, a placeholder tone, and not a delivery. Keys are read only from the environment. They are not printed and must not be written into a file.

Voice is synthesized from each screen's `narration`. Per-word times set that screen's length. Subtitles stay in the bottom band (on 9:16 the band ends at y=1340, above the platform bar, and it is never moved to the top). They light up word by word and have no plate. Words already on screen as a title, judgment, number, or item are removed; a sentence that is entirely on screen gets no subtitle. Music reuses the existing score and ducks under speech. If a check fails, the file is renamed to `video.rejected.mp4`.

Without a DeepSeek key, the one-shot command says so and points at `make-scene.mjs`.

One-sentence revise:

```
node scripts/revise.mjs <scene.json> "one sentence"
```

You can change on-screen copy, emphasis, the layout name, the style name, the motion-character name, density, and the collage relay name. You cannot change asset paths, fact text, role, aspect, or coordinates. The edit is checked again, including geometry.

The prompt for a cheap model is the `prompt` export in `scripts/scene/deepseek-layouts.mjs`. Do not rewrite it.

Examples that can render as they are: `examples/scene/a-fresh.json`, `examples/scene/b-editorial.json`, `examples/scene/c-techbrief.json`, `examples/scene/d-cutpaper.json`, `examples/scene/e-impressionist.json`, `examples/scene/f-mural.json`, plus `examples/scene/wide-promo.json` (16:9), `examples/scene/lesson-presenter.json` (lesson with a presenter), and `examples/scene/talk-scene-broll.json` (a talk clip whose template is `scene`).

## Relation to the old format

The old storyboard is still the regular promo path. `scene.json` is an experimental entrance on that same path, not a new row in the routing table. The old command is `scripts/make.mjs`. The new one is `scripts/scene/make-scene.mjs`.

## Migrating from an old storyboard

Old storyboards keep rendering. This round only adds. It does not delete old components, and it does not rename `SHOT_TYPES`, `lessonLayouts`, or the five talk templates.

The preset table is `template/src/scene/presets.json`. Each row is the old name, the content role, the layout prototype (one of nine, or “not expandable”), the default style source, the default motion character, the exit, and how the old component differs. It covers the 19 promo shots, the 20 lesson layouts, the 5 talk templates, plus `quiz` and `journey` as not expandable. A new shot that is missing from the table fails `node tests/scene/run.mjs`.

Convert an old file:

```
node scripts/scene/from-legacy.mjs <storyboard.json|lesson.json> --out <scene.json>
```

Unsupported shots stop the command and are listed. Pass `--skip-unsupported` to skip them. Copy, facts, and asset paths are left unchanged.

This round converts promo `features`, `steps`, `quickList`, `compare`, `counter`, a text-only `hook` (`visual=icon`), and `endCard`; lesson `steps`, `points`, `compare`, and `bignumber`. The result must pass `validateScene` and the geometry audit. Render with `make-scene.mjs`.

Converted films are plainer than the old components for now: no sequential spotlight, no step dot and tick, no stamps or price chips, no VS badge or verdict pill, no selling-point chips on the end card. Use the converter to try the new path; old storyboards still look better through `scripts/make.mjs`.

Still on the old components: `quiz` and `journey` (whole-film flows, not expandable); `chat`, `phone`, `mockApp`, `dataChart`, `meter`, and `photoShot` (media frames, charts, and gauges are outside this round’s prototypes); and later migrations such as `priceCard`, `factSheet`, and `credCard`. The five talk templates stay as they are. The old `counter` still computes a drop percentage; the new engine does not.

## Landscape, lesson, and talk

`aspect` may be `9:16` or `16:9`. When it is omitted, promo and talk default to `9:16`, and `product: "lesson"` defaults to `16:9`. `4:5` is still rejected.

Landscape is 1920×1080. The layout probe scales measurements by the real composition width, so the safe-zone, overlap, and clip checks use 1920×1080 pixels. The content box is the lesson stage: x 120–1800, y 300–880. The corner x≥1600 and y≥810 stays clear for a presenter; layout clips that corner to x 1580. The caption band is the lesson subtitle: x 260–1540, y 900–1016, below the content box and clear of the avatar (the circle starts at x 1614). Promo `aspects.json` has no 16:9, so landscape reuses the lesson box instead of inventing one.

On 16:9, `split` is left and right. `grid` uses two columns for two items, one over two for three, and 2×2 for four. `media` gives the image 62% of the content width and puts the words on the right. `board` keeps the evidence band as the tall one. Font floors stay with the product: promo body 40, lesson landscape body 44 and title 64.

After `product: "lesson"`, `style` may be a lesson theme (`paper`, `lecture`, `product`, `editorial`). `presenter.kind` is `cartoon`, `real`, `video`, or `none`, using the lesson presenter. Layout stays out of the presenter corner. The opening 90 frames show the lesson AIGC badge. A legal disclaimer appears only when `domain` is `legal`.

A talk clip can use `"template": "scene"`. `slots.title` and `slots.items` are still quotes from the spoken line. The card uses the talk palette and sits in the B-roll free rectangle. `keyword`, `checklist`, `steps`, `counter`, and `compare` are unchanged.

A compare screen (`role: "compare"`, `layout: "split"`, with `left` and `right`) is two labeled groups with a rule between them. Portrait stacks the groups. Landscape places them side by side.

## Known limits

- Experimental. Passing validation and geometry is not the regular delivery bar.
- `quiz` and `journey` are not split into this format.
- A screen without voice uses beats. A screen with voice uses word times only. The two sources are not stored on one timing object.
- Karaoke stays in the caption band (portrait bottom y=1340, landscape the lesson subtitle above). Overlapping a title, kicker, evidence card, number, or item fails the check. It is not moved to the top.
- A talk `scene` clip is one title-and-items screen. It does not embed a whole `scene.json`. A real presenter needs a local mp4. The example uses the cartoon.
- Existing `lesson.json` files and the original five talk templates do not read these fields.
