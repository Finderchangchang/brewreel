# Known limitations

[← Back to README](../README.en.md) · [中文](limitations.md)


- **Still a preview**: testing and bug-fixing are ongoing. **We don't yet recommend publishing a video as rendered, without human edits.**
- **Cheap-model results are not yet "fine to publish as is"**: in the latest round a small model played the cheap model, got only the brief and `SKILL.md`, and wrote the storyboard from scratch, validated and rendered, 9 videos in all. None reached 7, the score we set as "fine to publish as is". Software/tool videos scored 5–6 overall and 7–8 on compliance; industry videos 4–5 on both, losing most points on cross-field factual problems.
- **quiz / journey not re-tested after the fixes**: each recipe was tested with 3 videos and the problems the review listed were fixed, and the sample storyboards passed validation and delivery checks again; but the cheap model has not re-run a scored round, so the published scores are still from before the fixes. Nobody has listened to journey's music and sound effects yet.
- **Alibaba Cloud and Volcengine voice-over not yet tested with a real key**: both follow the official docs and are unit-tested against fake responses built from them; where the timestamps sit in the stream and whether the default voices work will be confirmed on the first real call. MiniMax has been rendered with a real key for all three recipes.
- **Real voices read slower than the estimate**: validation assumes 5 Chinese characters per second, while MiniMax's real voices measured about 4 per second, so a long line that passes validation can still be blocked at render time (it tells you how many characters to cut in which shot). Plan narration at about 4 characters per second.
- **Illustrations only without real photos**: with no merchant photos, the visuals come from components and illustrations, which hurts industry videos most.
- **The DeepSeek Harness plugin has not been tested against a real DeepSeek model yet**.
- **Not supported**: medical aesthetics, prescription drugs / medicine, K12 academic tutoring, dietary-supplement efficacy claims, tobacco.

**Main remaining problems** (issues with concrete counter-examples are welcome):

1. **Price conditions can be bypassed by deleting facts.** Checks on price conditions, date ranges and surcharges only apply to what the model itself put in `meta.facts`. If the model deletes those facts, nothing checks the prices on screen. In testing this lost a holiday price and surcharge amounts, promotion dates, a validity period, and one paid add-on. `--brief` checks that the facts come from the brief, but not that the brief's price conditions made it onto the screen.
2. **Components can silently drop data.** For example, the mockApp dashboard shows only as many rows as fit, and ignores an unsupported `done` field; validation reports neither.
3. **Truthfulness of locations and illustrations.** The model still invents claims like "a 3-minute walk", and the store card adds a "navigation estimate" line on its own. Validation does not yet fully catch an illustration captioned as "our own work", an illustration that doesn't match its label (e.g. a mountain labelled as a bathroom), or real data labelled as sample data.
4. **Template feel.** Different videos often share the same cover, default line chart, white end card and bottom decoration, with only the text and colours changed.
5. **Copy quality is not checked automatically.** Nothing catches a word cut in half, awkward phrasing, English grammar or sentence-case errors, the same selling points repeated three times in one video, or contradictions such as "three taps" vs "one-tap". Hype words without digits (e.g. "doubled", "everyone loves it") also get through.
6. **The core action isn't required on screen.** For a tool, an action like "tap Start" may end up shown as an unrelated screen, and validation doesn't check this.
7. **Layout.** Brand-colour numbers on dark themes can have too little contrast. Some panels leave their lower half empty when there is little content. Overlapping photo callouts are only caught after the render, which wastes several minutes. A priceCard filled to capacity scales down to 0.8, and some small text drops below 26px.
8. **Coverage of English and asset checks.** The industry compliance word lists are written for Chinese, so English copy is checked less thoroughly. Assets are only checked at the file level (the same image, renamed copies, a screenshot passed off as a photo). Whether two photos show the same customer, or whether consent was obtained, can only go on the human-review list.

**Recommended use**: treat the video as a first draft and watch the whole thing before you edit and publish; passing validation alone is not enough. For industry videos, use the merchant's real photos where possible and pass `--brief <brief>` when rendering; before delivery, check every price, condition, date, opening hour and distance on screen against the brief. Keep test output outside the repo with `--round`.

<details>
<summary><b>Test method and results by round</b></summary>

**How it was tested**: earlier rounds used a DeepSeek-class cheap model to write storyboards in bulk. The latest round (before the v0.2.0 release) used a small Claude Haiku-class model as the "cheap model": it got only the brief and `SKILL.md`, and had to write the storyboard from scratch, run validation and render. That produced 9 videos: 4 software/tool videos (a chat-assistant app, a tool for publishing WeChat Official Account articles, a data Q&A tool, and a focus timer with English subtitles) and 5 industry videos (one each for food, ecommerce, education, beauty and travel). **No real merchant photos were used** anywhere; the visuals come from the components and the illustration fallback. A person reviewed every video frame by frame, scored it out of 10 for "overall" and "compliance", and checked the storyboard against the brief line by line.

**Results of this round**: none of the 9 reached 7.

- Software/tool videos: overall 5–6, compliance 7–8. The best one scored 6 and demonstrates the whole feature: chat → analysis → suggested replies → insert.
- Industry videos: overall 4–5, compliance 4–5. Most points were lost on cross-field factual problems (items 1 and 3 above).
- Last round's serious defects mostly did not come back: no Chinese characters on screen in the English video (94 sampled frames), speed claims were blocked, the same image can no longer serve as before and after, the price-card component no longer drops items, route labels now show the destination, and videos with a ✗ in the layout check are refused delivery.
- Delivery: the model delivered a video by itself in 5 of the 9 runs. In 2 runs the model quit while its render was still queued, 1 render was interrupted halfway, and 1 run was blocked by a `make.mjs` bug: with `--brief`, make passed the file path instead of the brief text, so every number was reported as "not found in the brief". That bug is fixed. Two more changes followed: `make.mjs` refuses an `--out` inside the repo, and `SKILL.md` tells the model not to stop until it has seen the `交付：` ("delivered") line.

**Testing the quiz recipe**: a cheap model read only `SKILL.md` and the docs in `styles/quiz/`, then wrote 3 storyboards from scratch and rendered them: a foreign phrase, a software-feature quiz and a food quiz. A person scored each out of 10 for "style" (how well it matches the style) and "overall". Results before the fixes:

| Storyboard | Style | Overall |
|---|---|---|
| Foreign phrase (phrase) | 7 | 6 |
| Software-feature quiz (app-feature) | 6 | 4 |
| Food quiz (food-guess) | 6 | 4 |

The QA review listed 10 problems. Items 1–9 are fixed; item 10 is only partly done. Main changes:

- **Spoiling the answer before the question**: new check Q10. The hook's context line, every line of the film clip, and the subtitle bar on the quiz card may not contain the correct option, the "=" lines of the meaning card, or the numbers in them. Re-run on those 3 storyboards, all 3 are now blocked.
- **Subtitle bar on the quiz card**: by default it shows only the half of the clip's last line that contains the key phrase; `quizLine` lets you write it yourself (≤12 characters, no answer). The software and food templates now say "show the feature or dish name, not the effect".
- **Solid-color blank frames**: `make.mjs` adds a blank-frame check. If more than 95% of the screen is one color for more than 6 frames in a row, the video is not delivered.
- Also added Q11–Q13: in a quantity question every option must be a quantity; UI mockups (screen / phone) must include the real on-screen text; a clip requires the replay beat (`replay`).

After the fixes, all 5 sample storyboards in `styles/quiz/examples/` were re-validated and rendered: `make.mjs` exited 0 each time, the last line was always `交付：…` ("delivered"), and both the layout check and the blank-frame check passed.

**Testing the journey recipe**: same method as quiz. A cheap model read only `SKILL.md` and the docs in `styles/journey/`, then wrote 3 storyboards from scratch and rendered them: a software feature tour (app-tour), a content-platform channel tour (content-site) and a sightseeing route (city-walk). A person scored each out of 10 for "style" and "overall". Results before the fixes:

| Storyboard | Style | Overall |
|---|---|---|
| Software feature tour (app-tour) | 5.5 | 4 |
| Content-platform channel tour (content-site) | 7 | 5.5 |
| Sightseeing route (city-walk) | 5 | 3.5 |

None of the three reached 7. The QA review listed 10 problems and all 10 were addressed; item 10 (colours) is only partly done: the review asked for a softer palette overall, but the style spec forbids copying the reference video's colours, so the palette was only partly softened. Main changes:

- **Props that didn't match the subject** (item 1): a new backdrop option, `opening.params.skyline`: `modern` city (default) / `street` (low-rise lanes) / `oldtown` (white walls, tile roofs, a stone bridge over a canal), plus new districts such as market, city gate, stone bridge, teahouse and lanterns. Validation now blocks an old-town subject that doesn't use `oldtown`, and districts whose props don't fit the backdrop (e.g. a postbox street in the old town).
- **The per-stop content card was never checked**: in a one-take film the content card (a billboard at the time, a postcard since v0.2.1) folds away mid-shot, and the check frame used to be taken at the end of the shot, where it is already gone. `make.mjs` now takes the check frame on the beat set by the shot spec's `checkBeat`, when the card has settled. The card title and category name must be visible on that frame (`mustShow`), and another district's category name in the same frame also counts as an error; either one refuses delivery.
- **Numbers without a source**: prices and opening hours on screen must be copied from `meta.facts`, and the number in the hook must be either the district count or backed by the facts. When a promo word appears, the error now names the word and first says to delete it, asking for dates only if the promotion is real; a promotion date in a notice that isn't in the facts is blocked too (the model used to invent a date to get past validation).
- **Copy warnings**: a category name cut off mid-word, a hook like "5 ledger streets" that doesn't read, a long title with no pause, and an end card with only a slogan (no number and no way to get the product) each raise a warning.
- **Fields in the wrong place**: fields that belong in `params` but were written at the top level of a shot now produce one merged error with the correct shape, instead of one error per field.

After the fixes, the 3 sample storyboards in `styles/journey/examples/` (a podcast platform at 4:5, a notes app at 9:16, an old-town route at 9:16) were re-validated and rendered; all passed validation and `make.mjs`'s delivery checks.

</details>
