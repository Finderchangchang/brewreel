# Changelog

[中文 → CHANGELOG.md](CHANGELOG.md)

## v0.3.0 · 2026-09-27 · A DeepSeek Harness plugin and a new journey ending

Old storyboards: only `journey` needs a look. `finale`'s `stats` now allows at most 1 item instead of 2; a storyboard with two numbers is blocked by validation ("cut it to 1 item"), so delete one. The `bye` field is kept and still accepted, but the ending no longer has a goodbye bubble. Other styles and fields are unchanged.

### New: DeepSeek Harness plugin `dsh-distill-video`
- Lives in `integrations/deepseek-harness/`, plugin version 0.1.0. Needs dsh 0.1.7-rc.2 or later within 0.1.x, Node.js 22.19+ or 24+, and pnpm.
- Native integration: the plugin registers this skill with dsh, so the model writes storyboards by the skill, plus 7 tools: `distill_video_catalog` lists styles, industries and palettes; `distill_video_guide` reads the skill and the style / industry / shot docs; `distill_video_validate` validates a storyboard and suggests fixes; `distill_video_render` renders in the background with progress; `distill_video_verify` checks that a finished video still matches the current storyboard; `distill_video_doctor` checks the environment; `distill_video_setup` installs the render dependencies and browser in one step (only called after the user agrees).
- Safety boundaries: it only writes to the output folder inside the session workspace (default `promo/<name>/`), resolving real paths before comparing so symlinks cannot escape; it runs no arbitrary commands, only the fixed scripts in the skill, all with `shell: false`; child processes get an allowlisted environment, so the DeepSeek key and other credentials never reach them. The render subprocess does not go through dsh's shell sandbox, and the README says so.
- Install from the GitHub repository folder (`dsh plugin --profile web add ./promo-video-skill/integrations/deepseek-harness`); see the new "Use it in DeepSeek Harness" section in the README. The npm package is not published yet.
- At pack time the `skill/` snapshot takes only committed repository files, and `skill/.distill-source.json` records the skill version, commit and file hashes. `scripts/privacy-scan.mjs` exempts its own copy inside the snapshot and skips `.tgz` / `.gz` as binary.
- Both READMEs gain a "Three ways to use it" paragraph (skill / the headless `llm_make.py` script / the dsh plugin).

### `journey` gets a new ending, "ticket check at the terminus"
- Replaces v0.2.1's stamp card (a brand-card end slate): the ticket that sits at the top for the whole film slides to the centre and unfolds into a full ticket (the whole route travelled) → a punch clips a hole in its stub → the ticket flips over, and the back carries only "Terminus", the product name, the slogan and how to get it, vertically centred. No category colour chips, confetti or goodbye bubble.
- At most one number: printed on the front of the ticket above the finish flag as the running total for the trip (e.g. "1200 episodes"), typed out left to right by the ticket printer before the flip, with no count-up; the source note sits under it, and a dashed line connects it to the finish flag.
- After the flip lands, the mascot crouches and shoots off the right edge on the board (nose up, speed lines) and does not come back; in the 5-second ending the last ~1.9 s show only the ticket.
- Light: the grey-teal haze is gone. The edges are darkened (buildings and window lights keep their colour) and a warm glow sits behind the ticket, using the window-light yellow already in the art palette (no new colour); the ticket is the brightest thing in frame.
- Timeline: 0 s the ticket slides down and the city turns to night → 0.6 s the total is typed out → 1.25 s punch → 1.65 s flip → 2.2 s slogan → 2.35 s the mascot exits. Sound follows: swish for the ticket slide, tick ×2 for the total, tap for the punch, swish for the flip, ding when the back lands, whoosh for the exit.
- Fixes: the empty stretch after the dimming before the ending (dimming and the ticket's slide now start together); the edge-on frames of the flip now show an outlined paper edge instead of nothing; the crowded top third of the 4:5 opening: only the 4:5 sky layout changed (`layout["4:5"].sky`), moving the sun and clouds below the split-flap title so the top third holds just the disclaimer, the kicker and the title.
- Examples `content-podcast` and `software-notes` now use one number; the preview image `docs/images/style-journey.png` is redone; `originality.md` records this version's originality check (minimum colour difference from the reference palette 21.6, signature items 8/8) and the review (confusability 2).

### Other
- Version bumped to 0.3.0; compliance labels, privacy scan and author attribution unchanged.
## v0.2.1 · 2026-09-26 · Same genre, not the same maker

Why: in v0.2.0, `quiz` and `journey` were too close to their reference videos in color and layout. The palettes were nearly the reference swatches, and the info-layer layout, signature details and stock lines were largely copied. They are now the same genre with a design of our own: only the genre skeleton is kept (narrative structure, rhythm, motion techniques, camera language, layout principles), and the whole skin (palette, characters, signature details, stock lines, ending) is redone. "Redesign + originality check" is now a required step of distillation for any contributed style.

Old storyboards: the field structure is unchanged (`quiz` only gains an optional `voice`). Two things may need editing: if you set `meta.theme`, switch to a new theme name; in `journey`, rename any of the six old scene ids listed below.

### `quiz` gets a "marked answer sheet" skin
- Palette: `blue-lime` / `cream-tomato` are gone, replaced by `sage-pine` (default, grey-green answer paper + pine), `rice-soy` (food default, rice paper + soy brown) and `ash-teal` (grey paper + deep teal), all sharing an amber highlighter and a vermilion marking pen. Dot-grid paper with a vermilion margin line, small-radius cards with solid hard shadows, monospaced labels, left-aligned throughout.
- Components: the misconception is circled in red pen (instead of a question-mark block next to the title), options sit on an answer sheet with a stopwatch countdown, the meaning is a dictionary card that flips in (instead of a full-screen primary-color card), a replay timecode chip, stamps, and a stamp wipe that lands on the closing card (no URL). The presenter no longer peeks from behind a card: in the hook shot a round presenter window sits left of the context line under the card as its speaker mark, and the clip and replay shots leave it out. After the replay, the seal marks the "= meaning" label instead of the media card's lower-right corner. Below y1340 the paper carries text-free footer props, and the question tag moves down to sit 24 px under the platform notice.
- New characters: one short, one tall — a host in headphones (the ear cup lights up and sends sound waves when it clicks) and a buddy in a backwards cap, dressed from a fixed character palette (orange / pine / sand / amber).
- Stock lines: `phraseTitle.params.voice` adds three voices (`exam` / `chat` / `show`, Chinese and English); no reference line is hard-coded any more. New check Q14 warns when a storyboard copies stock lines from similar videos.

### `journey` gets a "travel stationery + layered paper-cut" skin
- Palette: `day-city` / `mint-town` are gone, replaced by `post-green` (default, postal green + neon lime + graphite outlines) and `plum-ticket` (wine red + moss). Prop colors in `tokens.json` are now slots filled from the art palette instead of per-stop hard-coded values.
- Info layer and ending: the top-left/top-right pills + progress dots → one full-width ticket (route, stops, current stop); a billboard per district → an airmail postcard that is tossed in and then "posted"; the outlined hook numerals → split-flap letters; zooming into a browser with stat cards → stopping at the terminus with a stamp card, one stamp per stop and an "ARRIVED" seal.
- City art: redone as layered paper-cut (per-layer paper shadows, a five-sheet sky, windows cut as holes); districts, sky and mascot colors all re-picked; outlines read the theme's `ink`.
- Gag library redone around stations and mail, with renamed scene ids: `crossing` (limbo under a crossing gate), `postbox` (a stamp sticker lands on the board), `punch` (a ticket gets punched), `booth` (a photo-booth strip, no screen flash), `hitch` (a hedgehog hops on for a ride), `platform` (platform lamps light up, last stop) replace `stack` / `launch` / `factory` / `studio` / `observatory` / `neon`; in the old town, `gate` now stamps a travel pass and `bridge` has a leaping koi. The neon postcard, glitch effect, neon sign component and the sooty / spiral-eye expressions are gone; the start pad is a station platform; sound words sit in a scalloped postmark badge instead of a spiky burst. **Old storyboards using those six scene ids must be renamed**; validation lists the valid values.
- Ending: stats move from a side-by-side "N │ M" row to a "stamps k/n" badge plus two stacked lines; the default goodbye is "Next ride soon!"; the mascot lands at the stamp card's lower-right corner.
- Copy: sound words and bubble lines rewritten; new check J18 warns on a stock "tour X in one go" kicker.

### New: originality check
- `scripts/check-originality.mjs` compares against the reference's `tokens.json` (kept outside the repo) using CIEDE2000: theme chromatic colors ≥ 20, backgrounds ≥ 8, the primary + accent pair must not match a reference pair, outlines must differ, no copied colors. `--signatures` checks that every signature item has a replacement record in `styles/<id>/originality.md`; `--extra` also checks colors hard-coded in code.
- `distill/` now has six steps: breakdown (plus a signature list) → replicate (local only) → **redesign** → componentize → cheap-model test → review (new confusability score 1–10, ≤ 3 to pass); new prompt `distill/prompts/redesign.md`.
- `styles/_template/originality.md`: the originality record template, copied by `gen-styles --new`; `quiz` and `journey` each ship a filled-in record.
- The PR checklist in `CONTRIBUTING.en.md` now requires a passing originality check and a completed `originality.md`.
- `tests/originality/`: unit tests for the color-difference math (Sharma 2005 reference pairs) and the rules.

### Other
- Compliance labels, privacy scan and author attribution unchanged; fixed one hard-coded Chinese string flagged by `check-i18n`.

## v0.2.0 · 2026-09-26 · Three styles, and distillable

The project is now named **Distill Video (蒸馏视频)**.

### New: multiple styles
- Pick a style with `meta.style` in the storyboard. Each style is a self-contained "style pack" (design tokens, its own shots, validation rules, narrative recipes, examples).
- **`quiz`**: raise a common misconception → A/B/C question → 3-second countdown → reveal with a tick → full-screen meaning card → a short scene acting it out → comment-section prompt. Two original characters; without film footage, a code-drawn "mini scene" plays the clip.
- **`journey`**: our original mascot rides a hover board through a flat-illustrated city in one continuous shot, one district per category, day turning into night, ending by zooming into the product UI. Three backdrops (modern city / low-rise streets / old town) and 14 district types.
- The original look is now the `cards` style; existing storyboards need no changes.
- Aspect ratios 9:16 and 4:5.

### New: open distillation — remix and contribute
- `distill/`: decompose a reference video into nine structured layers (basics, narrative, visuals, camera, motion, components, sound, variable slots, rules), then replicate, componentize, test with a low-cost model, review and fix. Prompts for every step are in `distill/prompts/`.
- `scripts/extract-frames.mjs`: frame extraction, overview sheets, cut detection.
- `styles/_template/` and `scripts/gen-styles.mjs --new <id>`: scaffolding for new styles.
- `CONTRIBUTING.md`: rules and a PR checklist for using a style, reskinning one, or distilling a new one.

### Sturdier rendering
- Layout problems (clipping, leaving the safe zone, mid-word line breaks, Chinese text in English videos, blank full-screen frames) now fail the render instead of delivering.
- Every render writes a `manifest.json` bound to the storyboard hash; `--verify` checks the video still matches the storyboard.
- The render queue lock recovers automatically; contact sheets no longer need a system ffmpeg.
- Test output always goes outside the repo.

### Stricter content checks
- Performance numbers must come from the brief; unsupported speed claims ("results in seconds") are blocked.
- Price conditions (weekend price, after-coupon price, surcharges, validity dates) can't be dropped, and a number's qualifiers must appear with it on screen.
- Asset honesty: the same image can't be both "before" and "after"; images not registered as the merchant's own photos can't be labelled "real photo" or "unretouched".
- `quiz`: spoiling the answer before the question is blocked.
- `journey`: district props that don't fit the subject (e.g. glass towers in an old town) are blocked.

### Better looking
- The bottom third of the frame is no longer empty; covers change composition with the content.
- Price cards show every item, maps label every destination; without photos, a full-card illustration is used.
- Hard-coded Chinese removed from components in English videos.

### Other
- License changed to **Apache-2.0**: free for commercial use; redistribution must keep the attribution in NOTICE.

## v0.1.0 · 2026-09-26 · First preview

- A low-cost model only writes `storyboard.json`; Remotion components render a 1080×1920 vertical promo video with one command, including original music and sound effects.
- 18 shots; six industry packs (software, food, e-commerce, adult vocational training, beauty, travel) with built-in advertising-law and industry-compliance checks.
- Bilingual docs, English captions supported.
