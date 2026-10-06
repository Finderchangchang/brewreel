# Motion looks

中文：[motion-looks.md](motion-looks.md)

A motion look is how a talk-motion card is drawn: ground, anchor, small tags, texture, entrance. It is not an AI-clip style pack. A style pack (`broll/styles/<id>/style.json`) decides the generated picture. The `motionTheme` object inside it only says which look to use when the film does not name one.

## Which exist

| Name | Drawing |
|---|---|
| `wood` | Warm wood table, block cards |
| `clay` | Warm pastels, soft clay cards |
| `paper` | Off-white paper, layered sheets |
| `ink` | White paper, ink line |
| `cutpaper-meadow` | Cut-paper collage, grey-green ground |
| `cutpaper-dusk` | Cut-paper collage, grey-violet ground |

`wood`, `clay`, `paper` and `ink` use the original cards. The two `cutpaper-*` looks use the cut-paper stage, and all five templates (keyword, checklist, steps, counter, compare) are laid out again on that stage.

## How to choose

- Omit it and the film uses the `motionTheme` object in the main style's `style.json`. Old `broll.json` files stay as they are.
- On version 2, top-level `motionTheme` in `broll.json` is a name from the table. It changes this film only, not the style pack, and it uses that look's default colours.
- `node scripts/broll/llm_broll.mjs <project> --motion-look <name>` writes the name at the top level and sets version to 2.

## Building a look from the shared parts

The parts live in `template/src/talk/motion/kit/`. They do not know a palette. Any look can call them. Skin values (colours, this look's rest angle) live in `LOOK_DEFAULTS` in `template/src/talk/motion/palette.ts`.

Cutpaper is the worked example. The order is:

1. Add the name to the look list in both `palette.ts` and `scripts/broll/motion.mjs`, and fill all 11 colour keys. The two lists have to match.
2. Run `threeColor`: one ground, one accent used only on the anchor, one dark. Scrap colours are separate and do not reuse the accent. Ground and accent have to stay apart.
3. Write the new look as tokens and run `scripts/check-originality.mjs` against the reference tokens and the signature list, both outside the repo. If it fails, change the colours. Do not bend the part's parameters to sneak a colour through.
4. The stage paints its own ground. Do not reuse another look's card. Lay `PaperGrain` on the ground, under the type, without blurring the cut edge. `Confetti` only on a paper ground, colours taken from this look's scraps, gone before the clip hands off. Blur only the scraps that are still moving.
5. The anchor is a `CutShape`. The seed picks the side count and the rough edge. The rest angle belongs to the look and stays inside the range the part allows. The shadow uses the part's shared offset, and its colour is the ground darkened.
6. An independent entrance uses `settle()`: one toss, one angle overshoot, then a stop. When the next clip is the same look and the gap is short enough, ask `anchorRelay` first. If it connects, the card starts from the previous clip's final pose and does not toss again. If it does not, each clip enters on its own.
7. The five templates change layout only. Words still come from the slots. The anchor carries the main fact (the keyword line, the counter's number, compare's later column, the current checklist or steps item). Everything else is a small tag. Frame 0 already has words on the anchor. There is no extra eyebrow line.
8. Branch on the look name in `MotionLayer` and render the new stage. Safe area, caption clearance, the round face window and the split regions still come from the existing frame. Motion clips do not get an "AI generated" badge.

Do not lower the type-size floor or the caption and window clearance in a new look. Timing still follows the word-level speech marks.
