# quiz style · nine-layer spec

> Status: **stable**. Values live in `template/src/styles/quiz/tokens.json`; this page is the anonymized summary of our breakdown.
> Based on a quiz-style short video (9:16, about 46 s, promoting a phrase-learning product). No reference footage, stills, characters, brand names, URLs or film clips are in this repo. Characters, scenes and sample content are our own. The Chinese `STYLE.md` has the same content with a few more tables.
> Teacher demo: we rebuilt a 46 s film with our own phrase ("no big deal") following the beat table below and compared it frame by frame with the reference contact sheet (structure, rhythm, layout and motion match; palette and characters are ours).

Core idea: **let the viewer guess wrong once, then explain why.** It is not about languages: anything with a common misconception that fits a multiple-choice question works (a foreign phrase, a misunderstood button, a dish with a misleading name).

## 1. Basics

| Item | Reference (measured) | Ours |
|---|---|---|
| Aspect | 9:16, 1080×1920 | Same; 9:16 only |
| Length | 45.8 s, 14 segments, 3.3 s each on average | 30–50 s, 5–8 shots (enforced by `rules.json`) |
| Tempo | About 128 BPM (0.467 s per beat); countdown ticks 0.46 / 0.48 s apart | 128 BPM, 0.469 s per beat; always write `beats` |
| Voice-over | Almost continuous; on-screen text lights up with the voice | Without TTS, text lights up at fixed rates: narration 6, question 9, meaning 8 characters per second |
| Cuts | Only 3 hard cuts (10.8 / 20.3 / 26.4 s); everything else is in-page change | Same: fixed page, elements pop in, four transitions |
| Vertical use | y130–1500, bottom 420 px empty | y260–1340: media card 840×473 (x120–960), text stays in x150–930 |

## 2. Structure

Guess → reveal → explain → practice → interact. A misconception hooks the viewer in the first 2 s, the reveal comes at 18–19 s, and after the reveal three scene changes (full-color meaning card, replay, two-character scene) keep it moving.

| Segment | Reference (s) | Purpose | Our shot (beats) | Teacher demo (s) |
|---|---|---|---|---|
| 1–2 | 0.0–6.3 | Misconception hook + context: at frame 0 the phrase and "= misconception ?" are laid out as ghost text and the media card is in place; words light up, the ? block turns highlight, the mascot peeks over the card, the context line lights up, a play button pops | `phraseTitle` (12–13) | 0.0–6.1 |
| 3 | 6.3–10.8 | Evidence clip: the scene plays inside the card; speaker / line / translation under the card; keyword turns primary with a marker sweep | `clip` (10) | 6.1–10.8 |
| 4–7 | 10.8–20.3 | Layout jump to the question; options A/B/C pop in; 3-2-1 countdown; reveal (correct = highlight + check, wrong = gray + cross) | `quiz` (19–20) | 10.8–20.2, reveal at 18.3 |
| 8 | 20.3–26.3 | Hard cut to a full primary-color meaning card: word → ≠ misconception (struck through) → = meaning → phrase → = meaning 2 | `meaningCard` (12–13) | 20.2–26.3 |
| 9 | 26.3–29.7 | Replay: rewind badge, replay, "got it" sticker, mascot's bulb lights up with hearts | `replay` (7–8, optional) | 26.3–29.5 |
| 10 | 29.7–37.4 | Transfer to daily life: two characters ask and answer, keyword marker, a hop at the end | `duoScene` (14–16, optional) | 29.5–37.0 |
| 11 | 37.4–40.4 | Comment prompt: big question + big A B C + fake comment box typing; the send button grows into a full-screen circle | `commentCta` (7, optional) | 37.0–40.3 |
| 12–14 | 40.4–45.8 | Circle shrinks to a dot → two-line slogan → product name flies in + button + both characters → logo lock for 1 s | `brandEnd` (10–12) | 40.3–45.9 |

Something changes about every 0.5 s. Shortest version (5 shots, about 30 s): `phraseTitle → quiz → meaningCard → commentCta → brandEnd`.

## 3. Visual system

**Palette** (14 colors per theme in `tokens.json` → `themes`):

| Name | Default `blue-lime` | Food default `cream-tomato` | Meaning |
|---|---|---|---|
| bg | `#F4F2EA` | `#F4EFE4` | Background, about 80% of the film |
| ink | `#15203B` | `#1E1B18` | The only dark color: titles, outlines, check marks |
| primary | `#3B57DB` | `#CF4520` | **Keyword**; full-screen meaning card; send button; answer letter |
| highlight | `#D3F56F` | `#FFD95A` | **Correct / answer**: ? block, correct option, countdown, marker, sticker, button |
| wrong / cross | `#A4A8AE` / `#CDB5A6` | same | **Wrong**: gray text + warm-gray ×, never red |

One saturated primary, one highlight, one dark; no gradients; the full-color card appears once per film.

**Picking a theme**: `meta.theme` is `blue-lime` (blue + lime) or `cream-tomato` (cream, tomato, butter yellow). When it is omitted the industry decides (`tokens.industryThemes`): `food` gets the warm `cream-tomato`, everything else (learning, software, ...) gets `blue-lime`. Blue + lime is where this style gets its recognizability; the values are our own, not copied from the reference.

**Type sizes** (9:16, px; the reference's 22–26 px labels are raised to our 28 px floor): countdown 280, meaning word 180, hook phrase 150 (auto-shrinks to fit, min 90), product name 150, ABC 128; "= misconception" 88; meaning lines, CTA question, slogan 80; question 68; context 60; options 54; subtitles and bubbles 50; narration 46; comment 44; translation 40; pill 34; eyebrow 30; speaker and footnote 28. Heavy weight (900) for Latin and CJK, Latin tracking -2.5%. Emphasis is only primary color, a highlight marker under the lower 40% of the glyphs (1.5 s sweep), or a strike-through.

**Grid**: questions and titles are left-aligned (left margin 150; the reference uses 76 but our text area is x150–930); subtitles, translations and slogans are centered. Eyebrow y270 → title y306 → media card at y600 (hook) or y384 (question) → subtitles or options under the card → nothing below y1340. Option cards: 108 high, 20 apart, 4 px stroke, radius 26, letter circle 72; with 4 options they shrink proportionally to stay above y1340.

**Illustration**: flat fills, one dark outline (6 px at 600 px height, scaled), round caps, no gradients or highlights, only a pale ellipse shadow; about 4.3 heads tall. Both characters are ours (`template/src/styles/quiz/art/`): the host (bob haircut, headband with a small bulb antenna; **bulb on = got it**) and the buddy (beanie + hoodie). All colors come from the current theme.

## 4. Camera

The page never pans, zooms or parallaxes; it looks like an app screen on a fixed camera. Real camera work happens only inside the media card: the mini-scene cuts between wide and speaker close-up with a slow push (for lines ≥1.2 s), and rewinds for the replay.

Four transitions (`tokens.transitions`, applied by `film.tsx`): **jump** (1-frame layout cut, same card moves, everything else leaves, with a swish) into `quiz`; **cut** (1 frame; the first word and the example card are already on the full-color card at frame 0, no empty hold) into `meaningCard`, `clip`, `brandEnd`; **dim** (3-frame darkened dissolve) into `replay`; **pushUp** (0.2 s page slide, easeInOutCubic) into `duoScene` and `commentCta`. Plus one cross-shot circle wipe: the send button grows to fill the screen (0.1 s), the next shot holds it for 1 frame and shrinks it to a dot in 0.24 s (ease-out, content shows within 2–3 frames) over an end card that is already in place, so no more than 4 frames are a single flat color. After rendering, `make.mjs` scans every frame: 95%+ of the screen in one color for more than 6 frames is a blank-frame failure and the film is not delivered.

## 5. Motion (measured frame by frame, 29.97 fps, ±1 frame)

Ghost text: subtitles under the card are laid out at 16% opacity at frame 0; the hook must be readable at frame 0 (phrase solid, "= misconception" line at ≥60% via `motion.hookGhost`, first 4 characters of the context already lit). It lights up 0.37 s per Latin word / 0.1 s per CJK character, 2-frame fade. Typing: narration 6, question 9, meaning 8, comment box 7 characters/s. Mascot peek 0.17 s easeOutBack. Option pop 0.27 s, 0 → 1.05 → 1, 3 beats apart (sound 0.08 s early). Countdown one beat per number, 0.13 s from 1.35 to 1. Reveal: 1-frame state change, correct option bumps to 1.03 over 0.2 s, marks in 0.1 s; the reveal lands on a whole beat at least 1.5 s before the shot ends. Strike-through starts 0.1 s after the text, draws in 0.13 s. Marker 1.5 s. Sticker stamp 0.13 s, 1.3 → 1, -8°. Hearts 0.4 s, rise 120 px. Characters scale in from their feet, 0.2 s, 0.2 → 1, 0.1 s apart. Bubbles 0.13 s, 0.6 → 1 anchored at the tail; the answer is ghosted first. Hop 0.2 s, bulb lights at the top. Product name flies in from the right in 0.13 s with motion blur. End: everything enters within 0.5 s and then holds; in the last second the button bounces once and hearts rise. No fade-out: the CTA (`meta.cta`) stays to the last frame.

Entrances bounce, state changes are 1-frame cuts, transitions stay under 0.2 s (except the circle wipe). Countdown and reveal are on the beat; everything else follows the text.

## 6. Components

Shots (`template/src/styles/quiz/shots/`; fields and limits in each `.spec.json`; how to fill them in `recipes.md`):

| Shot | Required | Shows |
|---|---|---|
| `phraseTitle` (first) | `phrase` ≤6, `guess` ≤6 | Eyebrow, big phrase, "= guess ?", media card, peek, context, play button |
| `clip` | `lines` 1–2 (`text` ≤20) | Hook title stays, scene plays, three-layer subtitles |
| `quiz` | `question` ≤12, `options` 2–4 ≤8, `answer` | Question, options, countdown, reveal |
| `meaningCard` | `rows` 3–5 (word / neq / eq, ≤8) | Full primary-color meaning card |
| `replay` | none | Replay, rewind, sticker |
| `duoScene` | `context` ≤14, `ask` ≤16, `reply` ≤10 | Two characters, question and answer |
| `commentCta` | `question` ≤12 | Big ABC, fake comment box, 2–3 other people's comments popping in (`comments`, optional), circle wipe |
| `brandEnd` (last) | `slogan` two lines ≤16 | Slogan, logo card (780 wide), CTA button, characters; holds to the end |

Length units: one CJK character = 1, one Latin letter or digit = 0.5 (so `phrase` ≤6 is about 12 Latin letters; "no big deal" counts 5.5).

Parts: `kit.tsx` (ghost/typing text with word-safe CJK line breaks, keyword, marker, strike-through, ? block, check/cross, sticker, hearts, pill), `media.tsx` (media card, play button, rewind badge, burned-in subtitle bar, countdown, subtitle stack, hook header), `cast.tsx` (the only bridge to `art/`: characters, avatar, peek, mini-scene).

What goes in the media card: `office` / `cafe` / `street` / `home` / `classroom` (our characters act the line out; default `office`), `screen` (a product UI sketch whose 2–4 rows of real text come from `screenItems`; required for software, otherwise it is gray placeholder bars, too close to the "empty screen recording" anti-pattern), `phone` (a phone demo: finger holds the talk button → waveform → release → list rows appear one by one; to avoid spoilers the hook is idle, clip and quiz only show the hold with "?" rows, and the replay plays the result), or `media` (user-owned screenshot or video registered in `meta.assets`, shown inside the rounded card with a subtitle bar, never as a blown-up screen recording).

## 7. Sound

Light music at about 128 BPM: sparse bed, drums enter on the reveal (the reference adds about +15 dB of low end), a drop-out late in the meaning card, a closing chord. Each shot's `sfx()` uses the same timetable as its visuals: hook tick / pop / pu / tap; clip ding on the keyword; quiz swish, one pop per option, three ticks + whoosh, ding + thud on the reveal; meaning card thud / pop / swish; replay swish / pu / whoosh / thud + bell; duo scene swish / pop ×2 / pu + bell; comment prompt swish / pop / tick ×3 / whoosh; end card whoosh / pop / swish / pu / bell. The biggest musical change sits on the reveal.

## 8. Fixed vs variable

**Fixed**: palette and color meaning, ghost text and reading rates, grid, motion values, the four transitions, shot order, character design, sound mapping.

**The model fills** (everything else is derived; per-shot fields and limits in `recipes.md`): `meta.product` / `cta` / `action` / `industry` (+ optional `theme`); `phraseTitle.phrase` + `guess` (+ `context`, `scene`, `screenItems`); `clip.lines` + `key` (**only name the phrase / feature / dish; never say the answer or its effect**); `quiz.question` + `options` + `answer`; `meaningCard.rows`; `duoScene.context` + `ask` + `reply` + `key`; `commentCta.question`; `brandEnd.slogan` (+ `badge`, and `button` when `meta.cta` is longer than 14; it must be a few key words of `meta.cta`).

**Derived**: the clip reuses the hook title and scene; the question card's subtitle bar is only the half of the clip's last line that contains `key` (or `quiz.quizLine`, ≤12, no answer); `screenItems` is written once and reused; the replay reuses the clip line, keyword and first "=" row; the comment prompt takes letters and answer from the quiz and pre-fills "I picked <trap letter>…"; the end card uses `meta.product` and `meta.cta`.

## 9. Rules (all enforced)

Declarative (`styles/quiz/rules.json`): 30–50 s; 5–8 shots; `phraseTitle`, `quiz`, `meaningCard`, `brandEnd` required; each shot type at most once; fixed order; first shot `phraseTitle`, last `brandEnd` (`style.json`). Field level (`.spec.json`): required fields, length limits, item counts, `scene` enum, duration range.

Cross-field (`styles/quiz/checks.mjs`, every error comes with a fix): Q1 2–4 unique options, valid `answer`; Q2 the hook's `guess` must be one of the options verbatim (the trap) and not the answer; Q3 wrong options carry no Arabic digits, numbers only in the correct option and only from `meta.facts`; Q4 every `key` is a substring of its line (same case); Q5 the clip `key` matches the hook phrase (warning); Q6 meaning card starts with a word row, exactly one ≠ row, at least one = row, ≠ row matches the guess (warning); Q7 `commentCta.letters` / `answer`, if written, match the quiz, and `brandEnd` follows `commentCta` (warning); Q8 the end card has a product name and a call to action (`meta.cta` or `brandEnd.button`, ≤14; a `button` must match `meta.cta`); Q9 6–8 s from question to reveal (write 17–21 beats; warning); Q10 no spoilers before the reveal: the hook context, every clip line (`text` and `zh`) and the quiz subtitle bar must not contain the correct option, any "=" row of the meaning card (substring, or half of it after stripping punctuation) or the numbers in them; Q11 quantity questions ("how many hours / how much / how many times") need every option to be a quantity (wrong ones in Chinese numerals, the right one from `meta.facts`); Q12 `scene: screen` / `phone` needs `screenItems`, and `industry: software` must have them; Q13 a clip without a replay gets a warning.

Industry rules still apply (`industries/<id>/rules.json`). Note that the reference CTA wording "which one did you pick *first*" contains 第一, which the advertising-law superlative rule blocks in Chinese; use 「你刚才猜的哪个？」.

## Evidence without film clips

1. Our own illustrated mini-scene (default): our characters say the line inside the card.
2. Product UI sketch (`scene: "screen"`) or a screenshot, inside the rounded card with a subtitle bar and sticker.
3. User-supplied video, rights declared by the user, registered in `meta.assets`.

## Reference assets we avoid

The reference's product name, URL, logo, top brand chip, the "dot in the URL" end card, its mascots and their state prop, the film clips and their titles and characters. Mechanisms (ghost text, peek, countdown, full-color meaning card, circle wipe) are reused; all words and drawings are ours, and our end card shows the product name, never a URL.

## Good fit / poor fit

- Good: anything with a common misconception that makes a multiple-choice question: foreign phrases, misunderstood features ("archive = delete?", "backlink = duplicate?"), dishes with misleading names, counter-intuitive facts.
- Poor: no question-worthy misconception, or you only want to list features or prices (use `cards`); showing a whole world or several categories (use `journey`).
