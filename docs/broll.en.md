# Talking-head B-roll (experimental)

[← Back to README](../README.en.md) · [中文](broll.md)

Add explanatory pictures to a real talking-head video. There are two kinds:

- **Motion clips**: free. Five card types (keyword, checklist, steps, counter, compare). Every word on the card is copied from what the speaker said, and it lights up as the word is spoken.
- **AI clips**: small scenes generated with MiniMax H3. They cost money and a person must review them. Styles: wood blocks, clay stop-motion, layered paper, ink sketch, all with the same robot.

The model only writes `broll.json`: which lines get a picture, and which kind. Scripts handle timing, cost, generation and the final cut.

## Who it is for

Authors who already have a talking-head video and want a picture on the lines that explain a step, a number, a comparison or an object. The opening, the ending and lines about personal feelings stay on the face.

## One command

Install the dependencies first ([Install and get started](quickstart.en.md); `npm install` in `template`). If you are upgrading from v0.8, run `npm install` in `template` again to get the transcription component.

Make a project folder, rename the talk to `talk.mp4`, put it in, then:

```
node scripts/talk.mjs <project> --out <dir-outside-the-repo>
```

It runs three steps and skips the ones already done, so you can keep running the same command:

1. **Transcribe**: without `talk.srt`, it transcribes the talk on your machine. The first run downloads a speech model of about 240 MB, once. An existing `talk.srt` is never overwritten.
2. **Write `broll.json`**: a cheap model writes it; set `DEEPSEEK_API_KEY` (or `LLM_API_KEY`) first. If validation fails, the error text goes back to the model, at most 3 rounds. An existing `broll.json` is kept; `--rewrite-broll` rewrites it.
3. **Render**: motion clips are drawn for real; AI clips start as solid-color stand-ins, at no cost.

After the first run, open `video.mp4` and the contact sheet `sheet.png` in the output folder and check the pacing. By default there are at most 2 AI clips; the other lines that need a picture get motion clips or keep the face. To change the cap, add something like `--max-ai 1` together with `--rewrite-broll`.

To fix the captions before going further, run only the transcription, edit `talk.srt`, then run the command above.

```
node scripts/broll/transcribe.mjs <project>
```

No DeepSeek key? Ask an AI coding assistant to write `broll.json` by [`broll/SKILL-broll.en.md`](../broll/SKILL-broll.en.md), put it in the project folder, and run the same command. A full v2 example is [`examples/talk/motion/broll.json`](../examples/talk/motion/broll.json).

### Really generating AI clips

When the stand-in version looks right, switch to MiniMax H3. Set `MINIMAX_API_KEY` first.

```
node scripts/talk.mjs <project> --out <dir-outside-the-repo> --provider minimax-h3 --dry-run
node scripts/talk.mjs <project> --out <dir-outside-the-repo> --provider minimax-h3 --yes
```

The first command only prints the estimate and spends nothing. Run the second after you agree. A person must watch the review page and approve it before the final render (see "Review gate" below). `--dry-run` and `--yes` only affect the render step; the first two steps are skipped when done.

### Common options

| Option | What it does |
|---|---|
| `--out <dir>` | Output folder. Required, must be outside the repo |
| `--provider placeholder\|local\|minimax-h3` | Where AI clips come from. Defaults to `broll.json` (the cheap model writes `placeholder`) |
| `--dry-run` | Validate, plan and estimate only; no generation |
| `--yes` | Agree to spend money and really generate |
| `--draft` | Render a draft before review; AI clips are marked 「B-roll 未审」 (not reviewed) |
| `--style <id>` | Main style used when writing `broll.json`, default `wood-blocks` |
| `--max-ai <n>` | Most AI clips when writing `broll.json`, default 2 |
| `--budget <yuan>` | Budget written into `broll.json`, default 20 |
| `--captions add\|none\|burned` | Captions, default `add` |
| `--lang auto\|zh\|en\|yue\|ja\|ko` | Transcription language, default `auto` |
| `--terms "word1,word2"` | Proper nouns, to help the proofreading pass |
| `--no-fix` | Skip the DeepSeek proofreading pass after transcription |
| `--rewrite-broll` | Rewrite `broll.json` even if it exists |
| `--only b03` | Redo only this AI clip |
| `--concurrency <1–12>` | How many clips to submit at once, default 3 |
| `--force-redo` | Needed for the third redo of the same clip |

`--style`, `--max-ai`, `--budget` and `--captions` are only used when `broll.json` is written. If it already exists, edit the file, or add `--rewrite-broll`.

## Step by step

The one command chains these steps. To run them one at a time:

```
node scripts/broll/transcribe.mjs <project> [--lang auto] [--terms "word1,word2"] [--no-fix] [--force]
node scripts/broll/list-cues.mjs <project>
node scripts/broll/llm_broll.mjs <project> [--style wood-blocks] [--budget 20] [--captions add] [--max-ai 2] [--dry-run]
node scripts/broll/validate.mjs <project> [--max-ai 2]
node scripts/make-talk.mjs <project> --out <dir-outside-the-repo> [--dry-run] [--provider minimax-h3] [--yes] [--draft]
node scripts/broll/review-sheet.mjs <project> --out <dir-outside-the-repo>
node scripts/broll/approve.mjs <project> --out <dir-outside-the-repo>
```

`llm_broll.mjs --dry-run` only prints the assembled prompt and a token estimate; it calls nothing. `make-talk.mjs` does not transcribe: without `talk.srt` it stops and tells you to transcribe first.

## Two kinds of picture

| | Motion clip | AI clip |
|---|---|---|
| Written as | `"source": "motion"` | `"source": "ai"` or no `source` |
| Cost | Free | Per second, see "Price" |
| Text on screen | Copied from the speech, checked character by character | None (text inside generated pictures is unreliable) |
| Review | Not needed | A person watches and approves |
| Badge | None | 「AI 生成画面」 (AI-generated) in a corner while on screen |
| Length per clip | 1.8–12 seconds | 2.5–12 seconds |

### The five motion cards

| Template | Use it for | On screen |
|---|---|---|
| `keyword` | A line the viewer should remember | Big keyword text that lights up word by word |
| `checklist` | Two to four things | A list; each item appears and gets a tick as it is said |
| `steps` | An order of steps | A step flow; each step lights up as it is said |
| `counter` | One exact number | A rolling number that lands when the number is said |
| `compare` | Before and after, or two ways | Two columns; the side said later wins |

The words on a card must be consecutive words from the speech, not reworded; a number to show goes in `counter`, and only if the speaker really said it. So **transcription mistakes show up on screen as is**: check `talk.srt` before rendering and fix typos there. Card colors follow the main style.

### AI clip styles

| Style | Name | Fits |
|---|---|---|
| `wood-blocks` | Wood blocks (default, 「积木风」) | Anything; best for steps, amounts, showing one object |
| `clay-stopmotion` | Clay stop-motion | Doing things by hand, places, mood |
| `paper-layers` | Layered paper | Explaining, places, comparisons |
| `ink-sketch` | Ink sketch | Explaining, comparisons, amounts; best as the second style |
| `brick-diorama` | Plastic bricks (experimental) | Experimental, not the default; its output shows studs; not recommended |

The AI clips of one film use at most two styles: the main `style` and an optional second `styleAlt` (only one the main style pairs with). The robot's shape and colors live in `broll/character.json` and are shared by every style; a style only decides what the robot is made of. Which jobs and cameras each style allows, and whether its reference images exist yet: [`broll/styles/README.en.md`](../broll/styles/README.en.md).

If a style has no reference images yet, real generation with it stops before submitting (exit code 2, nothing spent) and says which style to switch to, or to use motion clips instead. Previews with `placeholder` are not affected.

## Three placements

| mode | Picture |
|---|---|
| full | The picture fills the frame |
| pip | The face stays in a circle at the bottom right; the circle scales with the frame size |
| split | Picture on the top 60%, face on the bottom 40%. Vertical only |

## Captions

| captions | Meaning |
|---|---|
| add | Draw `talk.srt` onto the finished video |
| none | No captions |
| burned | The talk already has burned-in captions. Only `split`, so they are not covered again |

With `full` and `pip`, captions sit in the lower quarter of the frame. With `split`, they sit just above the divider, and two-line captions move up as a block so they never cover the face.

## Transcription

- It uses the SenseVoice speech model on your machine (run through sherpa-onnx). No network after the download, no cost. The model is about 240 MB the first time, tried from ModelScope, HuggingFace and hf-mirror in that order; downloads resume, and files whose sha256 does not match are rejected.
- The model sits in a global cache shared by all projects: `%LOCALAPPDATA%\brewreel\asr` on Windows, `~/.cache/brewreel/asr` on macOS / Linux. `BREWREEL_ASR_DIR` changes the cache folder; `BREWREEL_ASR_MODEL_DIR` points to a folder you downloaded yourself (with `model.int8.onnx` and `tokens.txt`), and nothing is downloaded.
- On Windows, the first load after the download takes about 30 seconds longer.
- The language is detected automatically. If Mandarin is detected as Cantonese or Japanese, re-run with `node scripts/broll/transcribe.mjs <project> --lang zh --force`.
- With `DEEPSEEK_API_KEY` (or `LLM_API_KEY`), a cheap model proofreads the transcript: it only returns "change this character to that one" patches, and the script decides from the pronunciation whether to apply each one. Changes that touch numbers, negations or opposites are only suggested, never applied. What changed and which lines you should listen to again are in `talk.fixes.txt`. `--no-fix` skips this pass.
- Proper nouns (product names, people's names) go in `talk.terms.txt` in the project folder, one per line, or in `--terms "word1,word2"`.
- An existing `talk.srt` is never overwritten. `--force` re-transcribes: the old file is renamed to `talk.srt.bak-<time>`, and the same video is not recognized again.
- Fix typos in `talk.srt` freely, but once `broll.json` is written **do not split or merge cues**: the cue ids would shift. The script records the cues at that point; if they change, validation stops you and asks you to rewrite `broll.json`.
- The transcription cache, the cue record and the converted talk live in `.brewreel/` in the project folder. You can delete it and still render; the motion cards then estimate word timings, and the cue check goes away.

If you already have captions, put them in as `talk.srt` (an SRT exported from an editor such as CapCut) and nothing is transcribed.

## Automatic conversion of the talk

Phone videos often use HEVC, a variable frame rate, mono audio, a rotation flag or a non-integer frame rate such as 29.97. Before rendering, the script converts the talk to H.264 with a constant frame rate and stereo audio, stores that copy in `.brewreel/` in the project folder, and leaves the original untouched. Later runs reuse the copy. A talk that is already H.264 with a constant frame rate is used as is.

## Price

Only AI clips cost money; motion clips and stand-ins are free. An estimate is always printed first: above `budgetYuan` it stops; under budget it still needs `--yes`. The estimate also prints the total seconds of AI video.

MiniMax has two kinds of key, charged differently:

| | Pay-as-you-go key | Subscription key (starts with `sk-cp-`) |
|---|---|---|
| How it is charged | Per second from your balance | No pay-as-you-go. H3 video is not in the plan's quota; it is paid in credits |
| Price | 768P 0.5 yuan/s, 2K 0.8 yuan/s | 768P about 70 credits/s (measured 2026-10); 2K not measured |
| Estimate shows | 「AI 视频共 N 秒，按价目表 X 元」 (N seconds, X yuan) | An extra 「约 N 积分（订阅 key，从积分扣，以 MiniMax 后台为准）」 (about N credits, from your credits; the MiniMax console is the authority) |
| Budget gate | Stops in yuan | Also stops in yuan (from the price table); credits are an extra line |

- The price table lives in the script; the API receipt has no amount. MiniMax's site and console are the source of truth.
- Generated length per clip is the window rounded up and clamped to 4–15 seconds. By default there are at most 2 AI clips of at most 12 seconds each: at 768P the AI clips of one film cost about 2–12 yuan, or about 280–1680 credits with a subscription key.
- Style reference stills (image-01) cost 0.025 yuan each. The maintainer makes them and ships them in the repo; users do not need to.

## Review gate

A final `minimax-h3` video needs a person to look at every AI clip.

1. `node scripts/broll/review-sheet.mjs <project> --out <dir-outside-the-repo>`
2. Open `review.html` in that folder. One row per clip: the spoken line, style, prompt, start / middle / end frames, cost. The strip at the top puts the middle frame of every AI clip side by side, so you can see whether the robot and the material stay consistent. Motion clips are marked 「动效，不用审」 (motion, no review needed) and list their on-screen text.
3. The person runs `node scripts/broll/approve.mjs <project> --out <dir-outside-the-repo>`
4. Run the same command again for the final video

An AI assistant must not run approve for the person, and `talk.mjs` never runs it. The approval binds the AI part of `broll.json` and the sha256 of each generated clip; changing either needs a new review, while editing only motion clips does not. To see the cut before review, add `--draft`: while an AI clip is on screen, the top right says 「B-roll 未审」 (not reviewed).

`placeholder` and `local` are free and skip review.

If a run is interrupted, run it again with the same `--out`: clips already submitted are only queried, never submitted or paid for twice.

## What the output folder holds

| File | Contents |
|---|---|
| `video.mp4` | The finished video |
| `sheet.png` | Contact sheet of check frames around, at the start, middle and end of each clip |
| `check/` | The check frames themselves |
| `broll.plan.json` | The plan: each clip's window, source, style and cost |
| `manifest.json` | Delivery record: style, money spent, whether the captions were transcribed or supplied, whether the talk was converted |
| `ledger.json` | Ledger (AI clips only): task id, actual seconds, cost |
| `review.html` / `broll.review.json` | Review page and approval record |

## Known limits

- **Experimental**: not yet used on many real talking-head videos. Treat the result as a first cut and watch the whole video before publishing.
- **Studs may still show up now and then**: the new styles' prompts describe only what should be seen and never mention studs, but the video model occasionally still draws bricks with round studs. Check frame by frame on the review page. `brick-diorama` shows studs reliably and is kept only for old projects.
- **The four new styles have no reference images yet**: a style without them cannot really generate and only works with `placeholder`. The maintainer makes them and ships them in the repo.
- **Each AI clip is generated on its own**: the shared character, reference images and `link: continue` keep clips closer, but shape and colors can still differ; clips are not guaranteed to match.
- **At most two styles of AI clip per film**: one main style plus one second style, not a different style per clip.
- **Text inside generated pictures is unreliable**: for exact words, use a motion clip.
- **Motion cards copy the transcript**: transcription mistakes show up on screen; check `talk.srt` before rendering.
- **English transcription was tested only with synthetic speech**: not with real English speakers or accents. In an English talk, numbers must be digits to make a counter card.
- **Transcription is not tested on macOS**, nor on Linux or a clean Windows without the VC++ runtime. The two download sources other than ModelScope were not tested on a real machine.
- **Background music under the speech** hides the pauses, so cue splitting and timing get less accurate.
- **10-bit HDR phone videos** only get their pixel format converted, without tone mapping, so colors may look washed out.
- **The 2K credit price for subscription keys is not measured**; the estimate only says to check the console.
- **Cheap models writing v2 `broll.json` and the proofreading pass** have not yet been tested at scale with DeepSeek.
- The DeepSeek Harness plugin does not include this feature in this version.
