# Changelog

[中文 → CHANGELOG.md](CHANGELOG.md)

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
