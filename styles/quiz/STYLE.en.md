# quiz style · nine-layer spec

> Status: **stable**. Values live in `template/src/styles/quiz/tokens.json`. The Chinese `STYLE.md` has the same content with a few more tables.
> The skeleton (guess → reveal → explain → practice → interact, the rhythm, motion techniques and transitions) comes from our breakdown of a quiz-style short video; these are shared conventions of the genre.
> The skin (palette, type scale, component shapes, how the character enters, stock phrases, the ending) was redesigned in v0.2.1 as **"graded paper"**; the item-by-item record is in [`originality.md`](originality.md).
> No reference footage, stills, characters, brand names, URLs or film clips are in this repo.

Core idea: **let the viewer guess wrong once, then explain why.** Anything with a common misconception that fits a multiple-choice question works (a foreign phrase, a misunderstood button, a dish with a misleading name).

The skin in one line: **a dot-grid answer sheet that a teacher marks up with a vermilion pen.** The doubtful reading gets circled in red, the answer is revealed on an answer sheet, the meaning is a dictionary card lying on a desk, and "got it" is a stamped seal.

## 1. Basics

| Item | Our spec |
|---|---|
| Aspect | 9:16, 1080×1920 only |
| Length | 30–50 s, 5–8 shots (`rules.json`) |
| Tempo | 128 BPM, one beat 0.469 s; durations are written in `beats` |
| Voice-over | Without TTS, text lights up at fixed rates: narration 6 chars/s, question 9, meaning 8 |
| Cuts | The page stays put; elements pop and four transitions do the rest |
| Content area | y260–1340: media card 840×473 (x120–960), text within x150–930 |

## 2. Story structure

Skeleton: guess → reveal → explain → practice → interact. A misconception hooks in the first 2 s, the reveal lands around 17–18 s (options and countdown hold attention), and three scene changes carry the second half: the dictionary card on the desk, the replay, and the two-character scene.

| # | Role | Shot (beats) | On screen |
|---|---|---|---|
| 1 | Misconception hook + context | `phraseTitle` (12–13) | Frame 0 already shows the question tag, the big phrase in the primary color, "= guess" as 60% ghost text, the media card and the first 4 characters of the context line; the guess fills in → a vermilion pen circles it and flicks out a handwritten "?" → the presenter window irises open on the right edge of the card → context lights up → play button |
| 2 | Evidence clip | `clip` (10) | Same layout, the card plays; below it a left-aligned quote block: mono speaker tag / line / translation, keyword in primary with an amber marker sweep |
| 3 | Question → options → countdown → reveal | `quiz` (19–20) | Layout jump; answer-sheet rows (oval bubble + option) pop in; a stopwatch counts 3-2-1 on the card; reveal: the right row turns primary with an amber handwritten tick, wrong rows fade to gray with a small vermilion cross |
| 4 | Meaning | `meaningCard` (12–13) | Hard cut to a primary-colored desk with a paper dictionary card that flips flat: headword → the wrong reading (red cross, scribbled out with a zigzag) → senses ① ② → "▸ related form"; an "Ex." strip at the bottom holds the original line |
| 5 | Replay | `replay` (7–8, optional) | Loop arrow + replay title; the timecode chip counts backwards while the clip rewinds, then replays; an amber bookmark label "= meaning" + quote block; a vermilion seal marks the "= meaning" label at its right end, with sparks (no presenter in this shot) |
| 6 | Transfer to real life | `duoScene` (14–16, optional) | Two characters, question and answer in square bubbles with hard shadows, keyword marker, a hop at the end |
| 7 | Hand in your answer | `commentCta` (7, optional) | Big question + answer sheet (a pencil fills in the trap bubble) + hint line + mock comment box + amber sticky-note comments; the submit key grows into a vermilion seal that fills the screen |
| 8 | Report-card ending | `brandEnd` (10–12) | The seal spins and shrinks onto the brand card's corner; red tick + badge + two-line slogan (left-aligned) + brand card + ticket-shaped button + two characters, held to the last frame |

Density: about one change every 0.5 s. Shortest cut (5 shots, ~30 s): `phraseTitle → quiz → meaningCard → commentCta → brandEnd`.

## 3. Visual system

**Base**: flat paper color + 36 px dot grid (ink at 13%) + a vermilion margin line at x118 (40%), always on (`parts/paper.tsx`). Cards use small radii (14–20) and a solid offset shadow (6–14 px to the bottom right), never a soft blur.

**Palette** (three themes in `tokens.json` → `themes`):

| Name | Default `sage-pine` | Food default `rice-soy` | `ash-teal` | Meaning |
|---|---|---|---|---|
| bg | `#CFDCCD` sage paper | `#D9CEC6` rice paper | `#D3D6DA` ash paper | Background |
| card | `#FBFAF3` | `#FCF8F1` | `#FBFBF8` | Cards, bubbles, answer sheet |
| ink | `#1B1F1C` | `#23201C` | `#1C1F22` | The only dark: text, outlines, hard shadows |
| primary | `#1F5C48` pine | `#7A3B1E` soy | `#0F5C5C` deep teal | **Keyword / correct**: keyword text, correct row, meaning desk, ticket button |
| highlight | `#F4A81C` amber | `#F2B531` | `#F4A81C` | **Marker**: keyword strokes, filled bubble, sticky notes, tick on primary |
| pen | `#CC2F45` vermilion | same | same | **Grading pen**: doubt circle, crosses, zigzag strike, seals, margin line |
| wrong | `#858F88` | `#958C86` | `#899096` | Unselected / struck-out gray |

Rule: fixed roles (primary = right, amber = look here, vermilion = the teacher's pen), no gradient fills; the full-screen primary desk appears once and always has a paper card on it.

**Theme choice**: `meta.theme` is `sage-pine`, `rice-soy` or `ash-teal`. When omitted, `food` gets `rice-soy` and everything else gets `sage-pine` (`tokens.industryThemes`). Color distances to the reference palette are in `originality.md`.

**Type scale** (px at 9:16, roughly ×1.25 steps: 44 → 56 → 70 → 88 → 110 → 138):

| Level | Use | Size |
|---|---|---|
| Display | Hook phrase / headword / stopwatch digit / product name | 138 (auto-shrinks, min 88) / 132 / 150 / 110 |
| Large | "= guess" line, related form, CTA question, slogan | 70 / 88 / 70 / 70 |
| Medium | Question / sense line / context / option | 64 / 60 / 56 / 50 |
| Body | Subtitle & bubble / narration / comment / note & translation | 46 / 44 / 42 / 40 |
| Labels | Bookmark label / small heading / tag, speaker, footnote | 34 / 30 / 28 |

Type: Noto Sans SC at 800 (not 900), Latin tracking -1%; **every label is monospaced** (question tag, speaker, timecode, answer-sheet letters, stopwatch digits; `PMono`, +8% tracking). Three kinds of emphasis only: primary color (keyword), the slanted amber marker (lower 38% of the x-height, swept left to right), and the vermilion grading pen (circle, cross, zigzag).

**Grid**: everything left-aligned from x150; only the stopwatch and the seals are centered. Vertical: platform notice (y216) → tag y284 (at least 24 px below the notice) → title y344 → media card y632 (hook) or y404 (question) → quote block or answer rows, content down to y1340; below y1340 sits the platform's button area, so the paper only carries footer props there (a dashed page line, a strip of tape, three index tabs on the right edge, a folded corner) and no information. Answer rows are 104 high, 22 apart, 4 px outline, radius 14, 84×58 oval bubble; four options are scaled to fit above y1340. The presenter window is 128 px wide and appears only in the hook shot, left of the context line under the card (center x≈230); the context line moves right to make room.

**Illustration**: flat fills, one ink outline, round caps, no gradients. The two characters live in `template/src/styles/quiz/art/`, one short and one tall: the host is about 3.6 heads tall with chestnut side-swept hair, a low ponytail and over-ear headphones, in an orange track jacket and pine-green shorts; the buddy is tall and broad, in a backwards cap, a pine-green sweater with an orange chest band and sand cargo pants. Clothes use a fixed character palette (`CAST` in `art/colors.ts`), so switching themes does not change them, while outlines and backgrounds follow the theme; a theme can set `castWarm` / `castDeep` / `castLight` / `castSand` / `castGlow` to redress them. "Got it" = the ear cup lights up amber and sends out three sound-wave arcs (driven by the `bulb` prop, 0..1).

## 4. Camera

The page never pans, zooms or parallaxes; it is an answer sheet fixed on a desk. The only "camera" is inside the media card: the mini theater cuts between wide and speaker close-ups with a slow push (lines ≥ 1.2 s), and rewinds during the replay.

Four transitions only (`tokens.transitions`, handled by `film.tsx`):

| Transition | Length | Used for |
|---|---|---|
| jump | 1 frame; the same card jumps to a new position, everything else clears, with a swish | into `quiz` |
| cut | 1 frame; the dictionary card and headword are already on the desk (no empty color frame) | into `meaningCard`, `clip`, `brandEnd` |
| dim | 3 frames | into `replay` |
| pushUp | 0.2 s, easeInOutCubic | into `duoScene`, `commentCta` |

Plus one cross-shot **seal wipe**: the comment box's submit key grows into a rounded vermilion seal that spins to fill the screen in 0.1 s; the next shot holds it for 1 frame, then spins and shrinks it for 0.26 s onto the brand card's corner, revealing the finished layout underneath. Never more than 4 frames of solid color; `make.mjs` checks every frame for blank runs.

## 5. Motion

| Action | Timing | Notes |
|---|---|---|
| Ghost-text fill | Latin 0.37 s per word, CJK 0.1 s per character, 2-frame fade | Hook readable at frame 0 |
| Type-on | narration 6, question 9, meaning 8, comment box 7 chars/s | Untyped characters keep their space |
| Doubt circle | 0.32 s open hand-drawn loop + handwritten "?" (0.2 s) | Around "= guess" |
| Presenter window | Iris opens in 0.24 s (0 → 1.08 → 1), primary ring draws clockwise | Hook shot only: sits left of the context line under the card as its speaker mark; talks |
| Option pop | 0.27 s, 0 → 1.05 → 1, 3 beats apart | SFX 0.08 s early |
| Stopwatch | One digit per beat, 0.13 s 1.25 → 1; the amber ring empties within the beat | Over the card |
| Reveal | 1-frame state switch; correct row bumps to 1.03 in 0.2 s; tick / cross drawn in 0.14 s | On a whole beat ≥ 1.5 s before the end |
| Card flip | 0.28 s, rotateY 26° → 0 with a little overshoot | Card visible at frame 0 |
| Zigzag strike | Starts 0.1 s after the text, revealed left to right in 0.18 s | Vermilion, not a straight line |
| Marker | 1.5 s sweep (0.6 s for the first sense) | Slanted stroke |
| Stamp | 0.14 s, 1.35 → 1, -7° | Low thud |
| Sparks | 0.45 s, rise 110 px, 5 four-point stars | Amber and vermilion |
| Pencil fill | 0.45 s hatching fills the oval | Trap bubble in the comment shot |
| Character scale-in | 0.2 s, 0.2 → 1 from the feet, 0.1 s apart | |
| Bubble | 0.13 s, 0.6 → 1 from the tail tip; answers go ghost → solid | |
| Ending | Everything in within 0.5 s, then held; last second: ticket button bumps, sparks, no fade | CTA stays to the last frame |

## 6. Components

Shots (`template/src/styles/quiz/shots/`; fields and limits in each `.spec.json`, how to fill them in `recipes.md`):

| Shot | Required | On screen |
|---|---|---|
| `phraseTitle` (first) | `phrase` ≤6, `guess` ≤6 | Tag + phrase + circled "= guess" + media card + presenter + context + play; `voice` picks the film's phrasing |
| `clip` | `lines` 1–2 (`text` ≤20) | Hook header kept, card plays, quote block |
| `quiz` | `question` ≤12, `options` 2–4 ≤8, `answer` | Question, answer rows, stopwatch, graded reveal |
| `meaningCard` | `rows` 3–5 (word / neq / eq, ≤8) | Primary desk + dictionary card |
| `replay` | all optional | Replay title + rewinding timecode + seal |
| `duoScene` | `context` ≤14, `ask` ≤16, `reply` ≤10 | Two characters, question and answer |
| `commentCta` | `question` ≤12 | Answer sheet + hint + mock comment box + sticky notes + seal wipe |
| `brandEnd` (last) | `slogan` two lines ≤16 | Report card: badge, slogan, brand card with seal, ticket button, two characters |

Length counts CJK as 1 and Latin letters as ½.

Parts (`parts/`): `kit.tsx` ghost / type-on text, marker, grading pen (`PenCircle`, `Scribble`, `Mark`), `Seal`, `Sparks`, `TagRow`, `Label`, `cardStyle`, `useVoice`; `media.tsx` media card, play button, `TimecodeChip`, `CaptionTag`, `Countdown` (stopwatch), `SubStack` (quote block), `HookHeader`; `cast.tsx` characters, avatars, `Presenter`, mini-theater (shots get characters only from here); `paper.tsx` paper background.

Media card content (`scene` / `media`): `office` / `cafe` / `street` / `home` / `classroom` mini theater (default `office`); `screen` product-UI mock with 2–4 real lines in `screenItems` (required for software); `phone` press-and-hold demo (result only shown in `replay`); `media` for user-owned images or video registered in `meta.assets`.

## 7. Sound

- Light music around 128 BPM: sparse pad at first, drums enter on the reveal, a drop-out late in the meaning card, a closing chord.
- Each shot's `sfx()` shares its timeline with the picture:

| Shot | SFX | Picture |
|---|---|---|
| phraseTitle | tick / swish / pop / tap | guess line / pen circle / presenter / play |
| clip | ding | keyword lights up |
| quiz | swish / pop × options / tick × 3 + whoosh / ding + thud | jump / options / countdown / reveal |
| meaningCard | thud + swish / pop / swish | desk + flip / each row / zigzag |
| replay | swish / whoosh / thud + bell | dissolve / rewind / stamp |
| duoScene | swish / pop × 2 / pu + bell | push / two bubbles / hop |
| commentCta | swish / pop / tick × 4 / whoosh | push / bubbles / pencil and typing / seal wipe |
| brandEnd | whoosh / pop / swish / thud / pu / bell | seal shrink / brand card / name / seal lands / characters / lock |

## 8. Fixed vs. variable

**Fixed**: palette roles, paper, ghost-text mechanics and rates, grid, motion values, the four transitions, shot order, character design, SFX mapping.

**Filled in by the model** (details in `recipes.md`): `meta.product` / `cta` / `action` / `industry` / `theme`; `phraseTitle.phrase` + `guess` (+ `voice`), `context`, `scene`, `screenItems`; `clip.lines` + `key` (never give the answer away); `quiz.question` + `options` + `answer`; `meaningCard.rows`; `duoScene.context` + `ask` + `reply` + `key`; `commentCta.question`; `brandEnd.slogan` (+ `badge`).

**Stock phrases come from a voice** (`tokens.voices`, chosen by `phraseTitle.voice`; default by industry: education `exam`, food `chat`, software `show`):

| Slot | `exam` | `chat` | `show` |
|---|---|---|---|
| Question tag | Q.01 | Quick one | Challenge |
| Replay title | Run it back | Slow it down | Replay |
| Seal | PASS | AHA | GOT IT |
| Card tag / example strip | Entry / Ex. | Meaning / Said | Feature / Seen |
| Answer-sheet header | Answer sheet | Your pick | Lock one in |
| Comment hint | Put your letter in the comments | Tell us your guess below | Lock your pick in the comments |
| Prefill | A, final answer | I guessed A | Going with A |
| Sticky notes | B, easy / Wrote A too | B! / Thought it was A too | B, no doubt / Team A here |
| Ending badge | Question cleared | Now you know | Challenge cleared |

(Chinese films use the Chinese set listed in `STYLE.md`.) Every slot can be overridden in its shot (`phraseTitle.tag`, `replay.title` / `sticker`, `meaningCard.label`, `commentCta.hint` / `prefill` / `comments`, `brandEnd.badge`).

**Derived automatically**: the clip reuses the hook header and scene; the quiz caption tag is the half of the clip's last line that contains `key` (or `quiz.quizLine`); `screenItems` is written once; replay reuses clip and meaningCard; the comment shot reuses the quiz letters and answer; the ending uses `meta.product` and `meta.cta`.

## 9. Rules (all enforced)

Declarative (`styles/quiz/rules.json`): 30–50 s; 5–8 shots; `phraseTitle`, `quiz`, `meaningCard`, `brandEnd` required; each shot type at most once; fixed order `phraseTitle → clip → quiz → meaningCard → replay → duoScene → commentCta → brandEnd`.

Field-level (`.spec.json`): required fields, length limits, option and row counts, `scene` / `voice` enums, duration ranges.

Cross-field (`styles/quiz/checks.mjs`, every message comes with a fix): Q1 2–4 unique options and a valid `answer`; Q2 `guess` must be one of the options and not the answer; Q3 no digits in wrong options; Q4 `key` must be a substring of its line; Q5 clip key vs. hook phrase (warning); Q6 meaning-card structure; Q7 comment shot matches the quiz and is followed by `brandEnd`; Q8 product name and a call to action on the ending; Q9 question-to-reveal 6–8 s (warning); Q10 no spoilers before the reveal; Q11 quantity questions need quantity options; Q12 `screenItems` for `screen` / `phone` and for software; Q13 `clip` without `replay` (warning); Q14 stock-phrase warning when a question, replay title, seal, hint, prefill or badge uses one of the overused genre lines — write your own or drop the field and use the voice default.

Industry compliance still applies (`industries/<industry>/rules.json`).

## Must avoid

The reference's product name, URL, logo, top brand chip, URL ending, its pair of mascots and their state prop, film clips and their titles or character names, and its signature details and stock lines (replacements recorded in `originality.md`). Our ending shows the product name and a call to action, never a URL.

## Fits / doesn't fit

- Fits: a product with a common misconception that makes a multiple-choice question: foreign phrases, misunderstood features ("Archive = deleted?"), dishes with misleading names, counter-intuitive facts.
- Doesn't fit: nothing to quiz, or you just want to list features or prices (use `cards`); a whole world or many categories (use `journey`).
