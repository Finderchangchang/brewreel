# Lesson video

A landscape 16:9 lesson. The program draws the picture, the voice, and the subtitles. You write a `lesson.json`, or you write a brief and generate the script. The cheap-model steps are in [lesson/SKILL-lesson.en.md](../lesson/SKILL-lesson.en.md). The longer pages under `docs/lesson/` are in Chinese.

## What it can do

- **Twenty layouts.** The list is below. The brand end card is added by the program. It is not a layout you write.
- **Four themes.** `paper` (卷宗, the legal default), `lecture` (讲台, the default otherwise), `product` (chosen automatically when screenshot and code pages are at least 30%), `editorial` (杂志, manual only, not allowed for a legal lesson).
- **A presenter.** Preset cartoons do not cost money. You can also hand-edit a look, import a real video, or build a cartoon from a photo. A real video is tech lessons only. Turn it off with `meta.presenter.kind: "none"` or `meta.mascot.enabled: false`. Both leave the cartoon off the picture, and the manifest records `none`.
- **Brand framing.** An opener, a corner mark, and a name bar are optional. A lesson still renders without them.
- **Vertical clips and covers.** Off by default. Add `--vertical`, `--covers`, or both to the render command.
- **Change one page, rerender that page.** Run again with the same output directory. Unchanged pages are reused. A changed page rerenders. The fade from the previous page can also rerender the next page.
- **Review.** A legal lesson does not render without a valid review record. A tech lesson does not require one. An AI assistant must not sign it.
- **Domain packs.** `tech` for a technical lesson, `legal` for legal education, `news` for a news or current-events recap. Legal quotes are filled only from the checked Civil Code corpus. A news lesson needs a source on every fact, and the program adds a disclaimer page at the end.
- **A character from a photo.** The person must agree, and it spends MiniMax money. Do not run it unless they ask in this turn.

## Three steps

Run these from the repo root. The output directory must be outside the repo.

**1. See whether this machine has the required pieces.**

```bash
node scripts/lesson/doctor.mjs
```

Continue when the last line contains `结果：必需项都通过。` Python music is optional. Without it the video still renders, and the log says there is no background music.

**2. Validate a sample that is already in the repo.**

```bash
node scripts/lesson/validate-lesson.mjs examples/lesson/mascot-demo.json
```

Render only after this prints no errors.

**3. Render with mock voice.** This does not spend money on speech.

```bash
node scripts/lesson/make-lesson.mjs examples/lesson/mascot-demo.json --out ../brewreel-studio-out/first-lesson --voice-provider mock --no-bgm
```

Success is a line `交付：` followed by the `video.mp4` path. The same folder has `sheet.png`, a frame sheet. Without `交付：`, it is not a delivery.

## Layouts

Each page has `layout`, `title`, and `narration`. Field limits are in `template/src/lesson/layouts/<layout>.spec.json`. Canvas, safe area, and type sizes are in [layout rules](lesson/LAYOUT_RULES.md) (Chinese).

| Layout | What it holds |
|---|---|
| `cover` | Title card |
| `chapter` | Chapter card |
| `steps` | Steps |
| `quote` | A quotation. A legal page names the article number; the corpus fills the text. Only `legal` draws the Law badge. News and tech draw a quotation mark |
| `compare` | Two columns |
| `question` | A question and its choices |
| `flow` | A flow |
| `recap` | A recap |
| `screenshot` | A screenshot and callouts |
| `code` | Code |
| `points` | Points |
| `statement` | One statement |
| `timeline` | A timeline |
| `checklist` | A checklist |
| `bignumber` | One large number |
| `saying` | One saying |
| `levels` | Levels |
| `case` | A case |
| `document` | A document |
| `table` | A table |

## News recap

Set `meta.domain` to `news`. Also set:

- `meta.asOf`: the cutoff, for example `2026-10-10 19:30（北京时间）`.
- `meta.facts`: an array. Each item is an object with `text` and `source` (outlet and date).

The program adds a silent end page. In Chinese it says 「据公开报道整理，截至 <asOf>，不构成任何结论」. In English it says “Compiled from public reports as of <asOf>. This is not a conclusion.” Do not write that page in the script.

Judgment words (造假, 抹黑, 黑幕, 实锤, 造谣, 诬陷, 带节奏, 甩锅) on screen or in narration are a warning. A `compare` page warns when one side is more than 1.5 times as long as the other. An over-long source on a news or tech page says to keep the outlet and the date, not the legal-education wording.

A tech lesson does not get this page unless `meta.disclaimer` is a non-empty string, or `meta.disclaimerTail` is `true`.

## More pages

These are in Chinese:

- [Install](lesson/INSTALL.md)
- [Layout rules](lesson/LAYOUT_RULES.md)
- [The explicit mark and AIGC metadata](lesson/AIGC_LABEL.md)
- [Brand files](lesson/BRAND.md)
- [Character files](lesson/CHARACTERS.md)
- [Cartoon presenter](lesson/PEEPS_PRESENTER.md)
- [A character from a photo](lesson/PRESENTER_FROM_PHOTO.md)
- [Import a real video](lesson/PRESENTER_IMPORT.md)

Character and brand files default to `brewreel-data` next to the current directory. If that folder does not exist yet and the old folder `brewreel-studio-data` does, the program still reads the old folder. When both exist, it uses the new one. Do not put those files in the repo.

## Known limits

- **The legal samples are fiction and have not been reviewed by a lawyer.** They show the commands and the layouts. They are not legal advice, and they are not a reviewed video.
- **A character from a photo costs money.** The photo is sent to MiniMax for recognition. Preset cartoons do not cost money.
- **The two lesson fonts are subsets.** `NotoSerifSC-VF.ttf` and `LXGWWenKai-Regular.ttf` keep GB 2312 hanzi, ASCII, common punctuation, and fullwidth symbols. A character outside that set can be missing. The subset family names are BrewReel Serif and BrewReel Kai. The license texts are in `template/public/fonts/`.
- **Duration** must be between 30 seconds and 8 minutes.
- **Remotion is not open source**: for-profit organizations with 4 or more people must purchase Remotion's Company License, and this repo's Apache-2.0 license doesn't change that; see <https://www.remotion.dev/license>.
