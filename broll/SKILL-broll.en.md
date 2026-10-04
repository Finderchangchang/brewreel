# Talk plus B-roll (for the assistant)

The user supplies `talk.mp4` and `talk.srt`. You only write `broll.json`. The scripts compute time, cost, generation, and the final cut. Do not compute milliseconds. Do not compute seconds.

Run one command per step, the command written below. On failure, follow the printed "怎么改" line, edit, and run the same command again.

**Do not run `approve.mjs` for the user.** A person watches the review sheet and approves it.

## Steps

1. List the sentences.

```
node scripts/broll/list-cues.mjs <project>
```

2. Write `<project>/broll.json` using the rules below. Use the cue ids from that command (`c1`, `c2`). Do not write milliseconds.

3. Validate.

```
node scripts/broll/validate.mjs <project>
```

Continue only when the exit code is 0.

4. Print the estimate. This does not generate.

```
node scripts/make-talk.mjs <project> --out <folder outside the repo> --dry-run
```

Show the user the printed 估价明细. `--out` must be outside the repo.

5. Wait for the user to confirm. Add `--yes` only after they agree.

6. Generate. Same command, same `--out`.

```
node scripts/make-talk.mjs <project> --out <folder outside the repo> --yes
```

When `provider` is `minimax-h3`, this submits jobs. Without `--yes` it stops with exit code 3.

7. Build the review sheet.

```
node scripts/broll/review-sheet.mjs <project> --out <folder outside the repo>
```

Open `review.html` in that folder. One row per clip: original sentence, plain, prompt, start / mid / end frames, cost, status.

8. Wait. The user runs this themselves after watching:

```
node scripts/broll/approve.mjs <project> --out <folder outside the repo>
```

That writes `broll.review.json`. It binds the sha256 of `broll.json` and of each `clips/*.mp4`. If either changes, the approval is void and the user must review again. Do not run this command.

9. Render the final video. Same command, same `--out`. Clips already in the ledger are not submitted again.

```
node scripts/make-talk.mjs <project> --out <folder outside the repo> --yes
```

## Providers

- `placeholder`: solid-color stand-in. Free. No review. No `--yes`.
- `local`: the user's own file. Set `file` to a video inside the project. Free. No review.
- `minimax-h3`: real generation. Style reference images must exist. Stop if the estimate is above `budgetYuan`. Even under budget, `--yes` is required. A final render needs every clip approved.

If the reference images are missing, estimate first, then generate. Existing images are not overwritten.

```
node scripts/broll/make-style-refs.mjs
node scripts/broll/make-style-refs.mjs --yes
```

## Which sentences get B-roll

Cover a sentence only when the viewer needs a picture to understand it. Leave the face on screen for the opening, the ending, personal stories, and emotion.

Never cover `c1`, the last cue, or any id in `keepFace`. Leave at least 1 second of face between clips. B-roll must stay at or under 60% of the talk. The script checks this. Do not compute milliseconds. Use the cue ids from `list-cues`.

| job | Use it when |
|---|---|
| demonstrate | The sentence is a hands-on step |
| explain | The sentence is a process that needs the steps shown |
| ground | The sentence names a concrete place or object |
| compare | The sentence contrasts two states. No writing in the picture |
| quantify | The sentence is about how many or how big. Show it with blocks. No digits in the prompt |
| evoke | Product mood only. Not the speaker's feelings |
| connect | A transition between two concrete things |

Leave the face on screen when the sentence has any of these: 我觉得, 我当时, 说实话, 后悔, 我记得, 我以为. The script warns and does not block. You still remove those clips.

## Fields

Top level, only these:

| Field | Write |
|---|---|
| version | Always `1` |
| style | Only `brick-diorama` for now |
| provider | `placeholder`, `local`, or `minimax-h3` |
| quality | `768P` or `2K` |
| budgetYuan | Budget in yuan |
| captions | `add`, `none`, or `burned` |
| keepFace | Cue ids that must stay on the face, for example `["c5"]` |
| clips | The clip array |

Each clip:

| Field | Write |
|---|---|
| id | `b01`, `b02`, in order |
| from / to | Cue ids. One clip may cover several cues in a row |
| mode | `full` fills the frame. `pip` is a circle at the bottom right. `split` is B-roll on the top 60% and the face on the bottom 40%. `split` is vertical only |
| job | One of the seven jobs above |
| plain | What the picture shows. At most 20 Chinese characters. Not part of the prompt |
| place | At most 12 characters |
| subject | At most 12 characters. The same robot for the whole film |
| camera | `static` `slow-push` `pull-back` `pan-left` `pan-right` `orbit` `top-down` |
| action + end | One action and the end state |
| beats | 2 to 4 beats. Each beat has `action` and `end`. Do not also set `action` |
| file | Only for `local`. A video inside the project |

Do not write: milliseconds, generated seconds, aspect ratio, resolution, the long style description, a full prompt, reference images, a model name, digits, quotes, or brand words.

When `captions` is `burned`, the only legal mode is `split`. `full` and `pip` would cover captions already burned into the talk.

Caption position is fixed by the template. `full` and `pip` sit in the lower quarter of the frame. `split` sits just above the divider, on the bottom of the B-roll, not over the face.

## Resume

If a command stops, run it again with the same `--out`. A clip that already has a task id is queried. It is not submitted again.

Redo one clip:

```
node scripts/make-talk.mjs <project> --out <folder outside the repo> --only b03 --yes
```

Each clip may be redone twice. The third redo needs `--force-redo`, and the log says so.

```
node scripts/make-talk.mjs <project> --out <folder outside the repo> --only b03 --yes --force-redo
```

Submit several clips together with `--concurrency 3`. 3 is the default.

## Draft

Use `--draft` to see a composite before review. It applies only to `minimax-h3`. While B-roll is on screen, the top right says 「B-roll 未审」. `manifest.json` has `draft: true`.

```
node scripts/make-talk.mjs <project> --out <folder outside the repo> --yes --draft
```

`placeholder` and `local` do not need review. Do not pass `--draft` for them.

## Cost

Use the price table. The API receipt has no money amount.

- 768P: 0.5 yuan per second
- 2K: 0.8 yuan per second
- Reference image: 0.025 yuan each, at most 4
- The script rounds the window up and clamps generated length to 4–15 seconds. Do not compute it.
- The ledger stores the actual output seconds. Cost = price × actual seconds.

## Exit codes

| Code | Meaning | What you do |
|---|---|---|
| 0 | Delivered | Hand the output folder to the user |
| 1 | Validation failed | Follow 怎么改, edit `broll.json`, run validate again |
| 2 | Bad args, output folder inside the repo, missing key, URL is not https, or no reference images | Follow the printed line. Do not invent a different command |
| 3 | Over budget, missing `--yes`, or redo limit | Cut clips or raise `budgetYuan`. If `--yes` is missing, wait for the user. If the redo limit is hit, tell the user. Do not add `--force-redo` yourself |
| 4 | Generate, check, or render failed | Report the reason. Do not submit again on your own |
| 5 | Not reviewed | Run review-sheet and give the page to the user. Do not run approve. Add `--draft` only if the user asked for a draft |

## Common errors

- Auth failure: stop. Ask the user to check `MINIMAX_API_KEY` and that the key and the host are the same region. Do not retry. Do not write the key into a file or a log.
- Insufficient balance: stop. Do not submit again. Write it in the report.
- Content moderation: stop. Tell the user the reason. Change the copy only after they decide to redo. Do not retry on your own.
- Submit result unknown: stop. Do not submit again. Ask the user to check.
- A task id already exists: run the same command again. The script queries and does not resubmit.
- Download failed: run the same command again. The script fetches a new URL. It does not regenerate.
- Over 30 minutes: the task id is kept. Run the same command again. Query only.
- Black frames or a frozen frame: that clip failed the check. Tell the user. Do not redo it on your own.
- Output folder is inside the repo: point `--out` outside the repo.
