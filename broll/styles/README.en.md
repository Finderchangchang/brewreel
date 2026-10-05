# Style packs

[中文](README.md)

Style packs decide the material and drawing style of AI B-roll (every clip whose `source` is not `motion`). One folder per style:

```
broll/styles/<id>/
  style.json        description, allowed jobs and camera moves, allowed second styles, reference list and image prompts
  refs/             reference images (image 1 = character, image 2 = material), made by maintainers and shipped with the repo
  refs/README.md    notes for this style's references
```

The robot's shape and colours are not in the style pack. They live in `broll/character.json` and are shared by every style. A style only decides what the robot is made of and what it stands on.

## Styles

| id | Name | Status | Jobs | Camera | References |
|---|---|---|---|---|---|
| `wood-blocks` | Wood blocks (shown as "积木风") | default main style | all 7 | all 7 | made |
| `clay-stopmotion` | Clay stop-motion | usable | demonstrate, ground, evoke, connect | no orbit, no top-down | made |
| `paper-layers` | Layered paper | usable | explain, ground, compare, connect | static, slow-push, pan-left, pan-right only | made |
| `ink-sketch` | Ink sketch (experimental) | experimental, not default | explain, compare, quantify, connect | static, slow-push, pan-left, pan-right only | not made yet (the robot keeps getting an antenna) |
| `brick-diorama` | Plastic bricks (experimental) | experimental, not default | all 7 | all 7 | `ref-3.jpg` (has studs) |

`brick-diorama` is the v0.8 style. All 5 clips generated with it had studs, and its reference image has studs too, so it is marked experimental: validation warns about it and it cannot be used as another style's second style. It stays so that version 1 `broll.json` files keep working. Its `look`, `forbid`, `negative`, `camera` and `references` fields are kept exactly as in v0.8 (changing them would change old projects' request hashes and trigger paid regeneration); version 2 reads `lookV2` and `forbidV2`. To retire it, move the whole folder away. Other styles are not affected; old files that name `brick-diorama` will fail validation with "no such style".

`ink-sketch` is experimental in v0.9: in two rounds of image-01 every hand-drawn robot came out with an antenna on its head, which does not match the shared character (round, smooth head), so this release ships no references for it. It only works for stand-in previews with `provider: placeholder`, validation warns about it, and it cannot be another style's second style. The known issue and the next step (use the `wood-blocks` character image as the reference for the line drawing) are in [`ink-sketch/refs/README.md`](ink-sketch/refs/README.md).

Styles without references can still be laid out and previewed with `provider: placeholder`. For real generation (`minimax-h3`) a maintainer must make the references first; otherwise the scripts stop before submitting, say which image is missing and what to do next, and nothing is charged.

## style.json fields

| Field | Meaning |
|---|---|
| `id` | same as the folder name |
| `name` / `nameEn` | display name |
| `status` | `default` (the default main style, exactly one), `stable`, `experimental` |
| `default` | `true` only for the `default` style |
| `summary` / `summaryEn` | one line "good for …", goes into the style list given to the cheap model |
| `look` | material and drawing style, positive wording only |
| `character` | what the robot is made of in this style (Chinese, goes into the video prompt) |
| `characterEn` | same in English, used for reference images |
| `ground` | floor or background |
| `forbid` | only bans text, letters, numbers, logos, real people and voices |
| `camera` | Chinese wording of each camera move |
| `cameras` | allowed camera moves |
| `jobs` | jobs this style is good for |
| `pairsWith` | ids allowed as the second style |
| `materialWords` | this style's material words. None may appear in `place` or `subject`, and none may appear in the actions of a clip in another style |
| `refs` | reference list, in the order of image 1, image 2: `file`, `role`, `aspect`, `prompt` (English image prompt; `{character}` becomes this style's robot plus the shared shape and colours), optional `subjectFrom` |
| `promptExpansion` | Prompt expansion mode: `disabled`, `balanced`, `quality`, or omit it. H3 does not accept `extra` (tested against the real API on 2026-10-05: sending it gets a 400), so for now the value is only checked, never sent |
| `note` | optional note for maintainers (why a style is experimental, which fields must not change); never goes into prompts |
| `freezeNoise` | noise tolerance of the freeze check. White or flat backgrounds need a smaller value (`0.0005`); default `0.003` |
| `motionTheme` | colours and finish of motion clips in the same video: `{"look": "wood", "bg": "#F3E8D6", …}`. `look` is `wood` (wood-grain table + painted wooden blocks), `clay` (fine grain + clay lumps), `paper` (paper fibre + layered coloured paper) or `ink` (dot-grid paper + ink doodles) and sets the background texture, decorative shapes and card finish; colours are optional, keys `bg` `bg2` `card` `edge` `ink` `sub` `accent` `cool` `warm` `good` `muted` (`#RRGGBB`), defaults come from the look. Only shapes and textures are added; every word still comes from the speech |

## Prompt rules

1. Write only what you want to see. The video model has no negative prompt, so "no studs" reads as "studs".
2. The final prompt must not contain: 凸点, stud, 乐高 (LEGO), 拼搭, 颗粒, 人仔 (English is case-insensitive; `studless` counts). The scripts check this last and refuse to submit.
3. `forbid` only bans text, letters, numbers, logos, real people and voices.
4. No brands, titles or character names (see `broll/banned-words.json`). For clay, stay away from famous clay-animation characters; the robot has no mouth.

## Making references (maintainers)

Two images per style: image 1 is the robot, front view, full body; image 2 is an empty scene without characters (shows the material).

```bash
# 1. See the requests that would be sent (free, no key needed)
node scripts/broll/make-style-refs.mjs --style wood-blocks --dry-run
# 2. Two candidates per image (4 images, 0.1 yuan at list price)
node scripts/broll/make-style-refs.mjs --style wood-blocks --n 2 --yes
# 3. Rename the chosen ones to refs/character.jpg and refs/material.jpg, delete the rest
# 4. Redo a single image
node scripts/broll/make-style-refs.mjs --style wood-blocks --only refs/material.jpg --yes
```

Pick only images where no surface has round studs, the robot's head top is smooth and both hands are solid balls, there is no text, and both images look like the same world. If none pass, change the `prompt` and try again.

Existing images are never overwritten; at most 4 images per run; without `--yes` the script only quotes the price (exit code 3).

## Adding a style

1. Copy an existing folder and change `id` and the fields.
2. Run `node tests/broll/styles.mjs`. It checks required fields, jobs and camera moves, `pairsWith`, and leak words in prompts and image prompts.
3. Make the references and pick them by eye before committing. Test a new style once with a small paid run (one 4-second clip) before documenting it.
