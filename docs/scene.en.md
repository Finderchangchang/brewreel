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

Examples that can render as they are: `examples/scene/a-fresh.json`, `examples/scene/b-editorial.json`, `examples/scene/c-techbrief.json`, `examples/scene/d-cutpaper.json`, `examples/scene/e-impressionist.json`, `examples/scene/f-mural.json`.

## Relation to the old format

The old storyboard is still the regular promo path. `scene.json` is an experimental entrance on that same path, not a new row in the routing table. The old command is `scripts/make.mjs`. The new one is `scripts/scene/make-scene.mjs`.

## Known limits

- Experimental. Passing validation and geometry is not the regular delivery bar.
- `quiz` and `journey` are not split into this format.
- A screen without voice uses beats. A screen with voice uses word times only. The two sources are not stored on one timing object.
- Karaoke stays in the bottom band. Overlapping a title, kicker, evidence card, number, or item fails the check. It is not moved to the top.
