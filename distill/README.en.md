# Style distillation: turning a reference video into a reusable style pack

中文：[README.md](README.md)

Goal: take a good-looking short video and turn its **method** (never its assets) into a spec and components, so a cheap model can produce films of similar quality by filling in fields. Five steps, each with a reusable prompt that any AI coding assistant can follow. The prompts in `prompts/` are written in Chinese; they are plain step lists and translate directly.

| Step | Output | Prompt | Who |
|---|---|---|---|
| 1. Breakdown | Nine-layer breakdown, beat table, token draft (kept outside the repo) | `prompts/01-breakdown.md` | Strong model, using measurements from `scripts/extract-frames.mjs` |
| 2. Teacher replica | A hand-built film "in the style" using only our own assets, to find what really matters | `prompts/02-replicate.md` | Strong model |
| 3. Componentize | Tokens, shots and specs in `template/src/styles/<id>/`; docs and rules in `styles/<id>/` | `prompts/03-componentize.md` | Strong model |
| 4. Cheap-model test | A cheap model reads only the docs, writes 3 storyboards and renders them; log its mistakes | the normal `SKILL.en.md` flow | Cheap model |
| 5. Review and fix | Score against the reference, list problems, fix rules and components | `prompts/04-review.md` | Another model or a person |

Measurements for step 1:

```
node scripts/extract-frames.mjs <reference video> --out <folder outside the repo> --fps 4 --audio
```

Output: `info.json` (duration, size, fps, scene cuts, biggest changes), `frames/`, `contact.html`, `cuts/`, `audio.wav`; plus `contact.jpg` when `FFMPEG` points to a full ffmpeg build.

**Copyright, at every step**: reference videos, stills, frames, characters, brand names, URLs and film clips stay outside the repo. The repo holds only our own notes, our own drawings and our own sample content. Docs say "based on a <genre> short video" and never name the other brand. List the other brand's assets under "assets to avoid" with our replacements.

**Done when**: a cheap model can write passing storyboards from `SKILL.en.md` + `STYLE.en.md` + `recipes.md`; frame 0 has content and a hook; font floors and safe areas hold; next to the reference the quality is comparable but it is clearly not the same brand; and it is easy to tell apart from the existing styles.