---
name: brewreel-lesson
description: Lesson video. Use when the user wants an explainer, a course, a legal-education video, or a landscape tutorial. Write only lesson.json or a brief, then run make-lesson. Do not sign a review. Do not build a character from a photo unless the user asks.
license: Apache-2.0
---

# Lesson video

You are making a 16:9 landscape lesson. The program draws the picture, the voice, and the subtitles. You ask what is missing, write `lesson.json` or a brief, and run the commands below. Do not write `storyboard.json`. Do not edit `template/` or `scripts/`.

`<SKILL>` is the repo root (the folder that contains `SKILL.md`). Run every command from that folder. For Chinese, read `<SKILL>/lesson/SKILL-lesson.md`. The human-facing write-up is `<SKILL>/docs/lesson.en.md`.

## What the user gave you

| What they gave | What you do |
|---|---|
| A `lesson.json` already | Validate it, then render |
| A brief (topic, points, audience, length, domain, sources) | Generate `lesson.json`, then validate and render |
| Only a spoken request | Write a brief first. If a field is missing, ask. Do not invent it |

The brief is UTF-8 JSON. On Chinese Windows, do not write the file with `echo >`.

## Write the brief

Stop and ask if any of these is missing.

1. `title`: the topic.
2. `points`: at least `minutes` × 2 items. A 3-minute lesson needs at least 6. Ask for more. Do not invent a point to fill the list.
3. `audience`.
4. `minutes`: an integer from 1 to 8. The finished video must land between 30 seconds and 8 minutes.
5. `domain`: `tech`, `legal`, or `news` (a news or current-events recap). A legal lesson is not a tech lesson, and a news recap is not a legal lesson.
6. `sources`. A tech lesson needs a doc or a command source. A legal lesson needs the statute name and the article number. A news lesson needs the outlet and the date, and every item in `meta.facts` needs a `source`. If the user did not give them, stop.
7. Presenter: a preset cartoon, a hand-edited cartoon, a real video, or a cartoon built from a photo. Pick one. To show nobody, see Presenter below. The photo path is at the end. Do not run it yourself.

```json
{
  "domain": "tech",
  "lang": "zh",
  "title": "topic",
  "audience": "who it is for",
  "minutes": 3,
  "points": ["point one", "point two"],
  "sources": ["source, in the user's words"],
  "facts": []
}
```

For a legal lesson set `domain` to `legal`. Do not put statute text in the brief. The program fills quote pages only from the checked Civil Code corpus. If the article number is not in that corpus, tell the user it cannot be inserted. Do not write the article yourself.

For a news recap set `domain` to `news`. Also set `meta.asOf` (the cutoff date and time) and `meta.facts`, where each fact has `text` and `source`. The program adds a silent end page: "Compiled from public reports as of <asOf>. This is not a conclusion." The quote layout does not draw the Law badge. Judgment words (造假, 抹黑, 黑幕, 实锤, 造谣, 诬陷, 带节奏, 甩锅) on screen or in narration are a warning, not a block. A `compare` page warns when one side is more than 1.5 times as long as the other. When a source is over the character limit, news and tech say to keep the outlet and the date. Legal says to keep the statute name and the article number.

Samples: `<SKILL>/examples/lesson/briefs/what-is-codex.json`, `<SKILL>/examples/lesson/briefs/iou-basics.json`.

## Generate lesson.json from a brief

If there is no key, or you are only checking the command, add `--mock-llm`. That does not call the network. Do not call DeepSeek yourself.

```text
node <SKILL>/scripts/lesson/generate-lesson.mjs --brief <SKILL>/examples/lesson/briefs/what-is-codex.json --out <dir outside the repo>/tech --mock-llm <SKILL>/scripts/lesson/fixtures/what-is-codex
```

Success: exit 0, and a line that starts `lesson.json 已生成并通过校验`. The script is `lesson.json` inside `--out`.

Failure: exit 2 means the brief failed. Ask the user about each line under `brief 校验失败`. Exit 1 means generation or validation failed. Keep the error text. Do not hand-edit a statute to force a pass.

Only drop `--mock-llm` when the user explicitly asks for a real draft and `DEEPSEEK_API_KEY` is already set. Do not write the key into a file, a command argument, or the chat.

For the legal sample, use `examples/lesson/briefs/iou-basics.json` and `--mock-llm scripts/lesson/fixtures/iou-basics`.

## Write or edit lesson.json

When the user wants to change something already written, run `node <SKILL>/scripts/revise.mjs <lesson.json> "one sentence"` first. Do not rewrite the whole file.

The top level is `meta` and `chapters`. `meta.format` is `lesson`. `meta.domain` is `tech`, `legal`, or `news`. `meta.lang` is `zh` or `en`. Each page has `layout`, `title`, and `narration`. Layout names are in `<SKILL>/docs/lesson.en.md`. Samples: `<SKILL>/examples/lesson/sample-tech.json`, `<SKILL>/examples/lesson/mascot-demo.json`. A tech lesson can add an optional disclaimer page with a non-empty `meta.disclaimer`, or with `meta.disclaimerTail` set to `true`. A news lesson does not write that page itself.

`meta.theme` can be omitted. When it is omitted, a legal lesson uses `paper`, a lesson whose screenshot and code pages are at least 30% uses `product`, and everything else uses `lecture`. To force one, write `paper`, `lecture`, `product`, or `editorial`. `editorial` is not allowed for a legal lesson.

Validate:

```text
node <SKILL>/scripts/lesson/validate-lesson.mjs <lesson.json>
```

Fix each error until it passes. Do not invent a source or a statute to get past validation.

## Render

`--out` must be outside the repo. If you omit it, the video goes to `brewreel-studio-out` next to the current working directory. A sample uses mock voice and does not spend money on speech. Without a `交付：` line, it is not a delivery.

```text
node <SKILL>/scripts/lesson/make-lesson.mjs <lesson.json> --out <dir outside the repo> --voice-provider mock --no-bgm
```

Success: exit 0, and a line `交付：` followed by the `video.mp4` path. Give the user only that path. The same folder also has `sheet.png` (the frame sheet), `subtitles.srt`, `chapters.txt`, `manifest.json`, and `lock.json`.

Do not hand over `video.rejected.mp4`.

| Exit | Meaning |
|---|---|
| 0 | There is a `交付：` line |
| 1 | The script, the review, the character, or the duration failed |
| 2 | A bad argument, or one page of voice failed |
| 3 | The blank-frame check failed. Do not deliver |
| 4 | Render failed, or the duration does not match |

For a real voice, change `--voice-provider mock` to `minimax` (`aliyun` and `volcengine` also work) and drop `--no-bgm` (the libraries in `requirements.txt` must be installed; otherwise the log says this video has no music). That spends money on speech. Keep mock unless the user asked for a real voice.

Check the machine:

```text
node <SKILL>/scripts/lesson/doctor.mjs
```

On success the last line contains `结果：必需项都通过。` Optional Python music can fail and the video can still render.

## Vertical clips and covers

Off by default. Add the switches to the same render command: `--vertical` for vertical clips, `--covers` for three covers. Write both when you want both.

Vertical files are in `vertical/`: `clip-01.mp4`, `clip-01.cover.png`, `clip-01.publish.txt`. Covers are in `covers/`: `cover-16x9.png`, `cover-9x16.png`, `cover-3x4.png`.

The `交付：` line is still the landscape `video.mp4`. A legal lesson still needs a review record first.

## Change one page, rerender that page

After you edit `lesson.json`, run `make-lesson` again with the **same** `--out`. The program checks a cache per page. An unchanged page logs `第 N 页：复用`. A changed page logs `第 N 页：重渲`. The previous page fades out at the start of the next page, so the next page may rerender too. Do not pick a new output directory, or every page renders again.

If the output folder already has `lock.json` and the engine version changed, the program stops. Add `--accept-engine-change` only when the user agrees to rerender the whole video with the new engine.

## A legal lesson must be reviewed first

A tech lesson does not require a review. Without a valid review record, `make-lesson` refuses a legal lesson. That is correct. Do not add a flag to skip it.

Build the review page, give `review.html` to the user, and stop. A lawyer reads it page by page.

```text
node <SKILL>/scripts/lesson/review-sheet.mjs <lesson.json> --out <dir outside the repo>
```

Success: exit 0, and a line that starts `审稿 HTML 已生成`.

Do not run `sign-review.mjs`. Do not write `.review.json` yourself. The lawyer signs on their own computer:

```text
node <SKILL>/scripts/lesson/sign-review.mjs <lesson.json> --reviewer <name> --license <license number>
```

Empty, 无, 测试, none, and `-` are not valid license numbers. An internal sample uses `--test`. The video is marked `内部样片 · 未经律师审核` and is not a lawyer-reviewed video. The user runs that command. You do not sign it for them.

If the script changes, the old signature is void and the review starts over.

## Presenter

To turn the presenter off, use either of these. Both leave the cartoon off the picture, and the delivery manifest records `{"kind":"none"}`:

- `meta.presenter.kind` is `"none"`
- or `meta.mascot.enabled` is `false`

`none` is a real value. Any other word, such as `off`, fails validation. The message says the kind must be `cartoon`, `real`, or `none`.

Preset cartoons do not cost money. Character files default to `brewreel-data` next to the current working directory (`LESSON_DATA_DIR` or `--data-dir` can change that). If `brewreel-data` does not exist yet and the old folder `brewreel-studio-data` does, the program still reads the old folder. Do not put these files in the repo.

The command's client id is the archive id. Use lowercase letters, digits, and hyphens.

```text
node <SKILL>/scripts/lesson/character.mjs create --client <archive-id> --name <name> --id <character-id> --preset female --data-dir <data dir outside the repo>
node <SKILL>/scripts/lesson/character.mjs card <archive-id>/<character-id> --out <dir outside the repo> --data-dir <data dir outside the repo>
```

Give the user `card.png` and `card.mp4`. Run approve only after the user explicitly confirms:

```text
node <SKILL>/scripts/lesson/character.mjs approve <archive-id>/<character-id> --data-dir <data dir outside the repo>
```

In the script, write `archive-id/character-id`. A character that is not confirmed is refused on a final render. Add `--draft` only for a preview. The picture says `角色未确认` and is not a final video.

For a male presenter, change `--preset female` to `--preset male`.

Real video: set `meta.presenter.kind` to `real`, `src` to a local mp4, and `segments` to a start and end on each page. This is tech lessons only (`meta.domain` is `tech`). A legal lesson cannot use a real video. Do not pass `--voice-provider`; the source audio is used. Put the source file outside this `--out`. Details: `<SKILL>/docs/lesson/PRESENTER_IMPORT.md`.

## A character from a photo

Use a photo of the person, or a photo they have already allowed. If there is no named person who agreed, do not do it.

This sends the photo to MiniMax for recognition and **costs money**. Unless the user explicitly asks in this turn, do not run `character.mjs create` with `--photo`, and do not run `presenter-from-photo.mjs`.

After the user asks and names who agreed, give them this command to run (or run it only after they confirm again):

```text
node <SKILL>/scripts/lesson/character.mjs create --client <archive-id> --name <name> --id <character-id> --photo <photo> --consent-by <name of the person who agreed> --data-dir <data dir outside the repo>
```

Without `--consent-by`, the program refuses.

## Brand

A firm opener, a corner mark, and a name bar are optional. A lesson with no brand still renders. The commands are in `<SKILL>/docs/lesson/BRAND.md`. Those files also live in the data directory, not in the repo.

## Do not

- Do not invent facts, numbers, sources, or statute text.
- Do not sign a review for someone, and do not write `.review.json` yourself.
- Do not build a character from a photo on your own, and do not call MiniMax or DeepSeek on your own.
- Do not turn off the opening `AI生成合成` mark. Do not edit the mark component.
- Do not write a key into a file, a command argument, or the chat.
