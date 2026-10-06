# Style factory

[← Back to README](../README.en.md) · [中文](style-factory.md)

One sentence describes an AI B-roll style. The script writes `style.json`, generates reference images, scores them, picks one of each, and makes one still. A person looks at the review page at the end and decides whether the pack is published.

The vision check is only the first screen. It gets things wrong. A person looks last.

## One command

Print the requests that would be sent (no network, no charge, exit 0):

```
node scripts/broll/new-style.mjs --id demo-watercolor --name 水彩绘本 --desc "水彩晕染、纸纹、柔和暖色"
```

Then run it for real (DeepSeek writes the pack, MiniMax looks at images, image-01 generates them):

```
node scripts/broll/new-style.mjs --id demo-watercolor --name 水彩绘本 --desc "水彩晕染、纸纹、柔和暖色" --yes
```

Optional flags:

| Flag | What it does |
|---|---|
| `--from <image>` | Describe that image as material, palette and light, then hand the text to the writer. The image itself is not copied into the pack. |
| `--n 3` | Candidates per reference image. 1 to 4, default 3. |
| `--retries 1` | If every candidate of one image is `fail`, rewrite only that image's prompt and generate again. Default 1, max 3. A `pass` or an `unsure` does not trigger a rewrite. |
| `--video` | Also make a 4-second 768P video trial. It is submitted only together with `--yes`. The script writes "submitting" first, then saves the task id as soon as it comes back. A later run that finds a task id only queries or downloads. |
| `--video-redo` | Use this only after a failed task, or after a submit whose result was never confirmed and a person has checked that it is safe to send again. This spends about 280 credits again. Without it, a failed task is not redone, and an unconfirmed submit is not sent again. |
| `--human-ok` | This only decides whether to start a new submit. If a reference is "needs a person", the video is not submitted. This flag lifts only that block. If a task id is already saved, a run without this flag still continues the query and does not clear the task id. |
| `--batch <list.json>` | A JSON array. Each item has `id`, `name`, `desc`, and optionally `from`. One failure does not stop the rest. |
| `--max-video 3` | With `--batch --video`. At most this many videos, default 3. The total is printed first. Over the cap, it stops. |
| `--state-reset` | Use this only after a person has checked. It is required when the draft still has `state.json.bad-*`, or when state is empty or missing `stages` while generated images or a video are already there. The script renames each bad file to `.checked-<time>` and then continues. Without it, image generation and video submit are refused. |

`id` is lowercase letters and hyphens, and must not start with an underscore. A style that is already published is not overwritten. One draft runs in only one process at a time: the run exclusively creates `run.lock` and writes the pid and the start time. If that pid is still alive, the new run exits and says this style is already running in another process. A lock whose pid is gone is removed and the run continues. The lock is released on a normal finish, on an error, and on Ctrl+C.

## Stages

Drafts live in `broll/styles/_drafts/<id>/`. Directories whose names start with `_` are not part of the style menu. A stage that already finished is skipped on the next run. Changing `--desc` does not rewrite the draft; delete that draft directory first.

1. **Draft.** DeepSeek writes `style.json` from the sentence. It must pass the existing `lintStyle` and the IP / banned-word check. The error text is fed back, up to 3 rounds. `pairsWith` stays empty until a person sets it. Prompts say what to see: the character prompt says the crown is a smooth dome, not "no antenna".
2. **References.** image-01 makes the character image and the material image, `--n` candidates each.
3. **Pick.** Each candidate is scored as `pass`, `fail`, or `unsure`. The pick is the highest soft score among `pass`. If there is no `pass`, the highest soft score among `unsure` is picked and the review page marks it in yellow as 需要人看 (a person needs to look). Only when every candidate is `fail` is that prompt rewritten and generated again, up to `--retries`. If it still fails, the run stops with exit code 1 and the report says where it stuck.
4. **Still.** One image of the robot pushing a block to the middle of the table, scored with the frame rules. A `fail` or an `unsure` means do not spend money on video. Without `--video`, a still that did not pass still hands the draft over for a person to look at, and the exit code is 0.
5. **Video** (optional). H3, 4 seconds, 768P, fixed action "push one block to the middle of the table". One frame every 0.5 seconds, 8 frames. One `fail` or `unsure` frame fails the clip. The video is not submitted when the still did not pass, or when a reference needs a person, this run has no `--human-ok`, and no task id is saved yet. `--human-ok` only decides whether to start a new submit. It does not lift any other block, and it does not clear a saved task id. ffmpeg is checked before any submit. Before submit, `state.json` video is `{status:'submitting', at}`. When the API returns a task id, it is written at once as `{status:'submitted', taskId}` and printed. Any later `--video` run that finds a task id only queries or downloads. Leaving off `--human-ok` does not overwrite or clear that task id. If `clip.mp4` is already there, it only extracts frames. A rerun that sees `submitting` and no task id does not submit again: exit code 2, and it says the last submit was not confirmed and may already have been charged. Check the video task list in the MiniMax console, and pass `--video-redo` only after confirming it did not go through. If polling times out or the task is still generating, state stays `submitted` with the task id, exit code 3, and the message says to run the same command later to keep querying, without submitting again. Only an explicit server failure is recorded as failed. A failed task is not redone unless you pass `--video-redo` (another ~280 credits). A corrupt `state.json` is not treated as a fresh start: the bad file is renamed to `state.json.bad-<time>`, exit code 2, and the message gives that backup path. No paid submit happens. If a `state.json.bad-*` file is still in the draft, or state is `{}` or missing `stages` while images or a video are already there, the next run still refuses and names the backup or those files. Continue only with `--state-reset` after a person has checked. A definite server refusal (insufficient balance, auth failure, or HTTP 4xx) clears the submit mark and says why (recharge when the balance is short); run the same command again. A dropped connection, a timeout, or a 5xx keeps `submitting`. Before writing "submitting", the script reads the disk again and stops if a video status is already there. With `--video`, a failed video is exit code 1.

## What costs money

| Call | When | Gate |
|---|---|---|
| DeepSeek writes or rewrites | Draft, and a rewrite after a failed pick | `--yes`. Key: `DEEPSEEK_API_KEY` (or `LLM_API_KEY`) |
| MiniMax vision | Describe a reference, score candidates and frames | `--yes`. Subscription quota. Key: `MINIMAX_API_KEY` |
| image-01 | Reference candidates and the still | `--yes`. Plan quota. List price 0.025 yuan per image |
| H3 video | 4 seconds at 768P | Both `--video` and `--yes`. Before the real call it prints "约 280 积分 / 按价目表约 2 元" (about 280 credits / about 2 yuan at list price). A batch also prints the total, and stops above `--max-video` (default 3) |

Without `--yes` the script only prints the request: no key, and images are shortened to a byte count.

Vision is `POST <base>/v1/chat/completions` with `Authorization: Bearer $MINIMAX_API_KEY` and a jpeg base64 data URL. The default base is `https://api.minimaxi.com`. `MINIMAX_BASE_URL` can override it (https only; localhost is allowed for a local fake server). The default model is `MiniMax-M3`. `BREWREEL_VISION_MODEL` can override it.

## How a picture is judged

The model returns one JSON checklist. Every item has a one-sentence reason. The script decides one of three verdicts. It does not trust a model summary. Temperature is 0.

- **pass**: every required field was answered, the first round has no hard fail, every second-opinion item is「没有」, and `resembles` is「无」.
- **fail**: an answered field on the first round is a hard fail. A hard fail stops the questions; missing other fields does not change this. A second-opinion「有」, or a `resembles` that hits the list, is also a fail.
- **unsure**: required fields are still missing after the follow-up questions. The reason says which fields the model did not answer (这几项模型没回答：…). A second-opinion item that is not「有」 or「没有」, or JSON that is still broken after one retry, is also `unsure`. A specific `resembles` name that is not on the list is `unsure` too. This is not a hard fail and it is not a pass.

Required fields depend on the kind. A character image needs text, studs, ip, mouth, antenna and characters. A material image needs text, studs, ip, characters and objects. A frame needs text, studs, ip and sameCharacter. Clarity, composition and shape are soft-score fields, not required.

Invalid JSON is retried once as a whole. A thinking trace is stripped, and a checklist split into several JSON pieces is joined back into one. Missing required fields get a follow-up, at most twice. The follow-up names the gap: 上次没回答这几项：…，只补答这几项，其余不变. The new answers are merged into the first result. Fields that were already answered stay as they were. If an answered field is already a hard fail, there is no follow-up. Still missing after two follow-ups stays `unsure`, and there is no second opinion. If the second opinion itself is not JSON, it is retried once; still broken is `unsure`.

Hard fails (only when that field was answered; any one of them is `fail`):

- Any image: letters, digits, Chinese characters or a trademark; rows of round studs on a surface; a clear look of LEGO, Minecraft, Ghibli, Pixar, Disney, Aardman / Shaun the Sheep, or Monument Valley.
- Character image: a mouth; a narrow antenna, knob or bolt on the crown; not exactly one character.
- Material image: any character; fewer than 3 nameable objects (almost blank).
- Frame: the character is not the shared robot.

The soft score adds only fields the model answered. A missing field adds nothing and subtracts nothing. The pick is the highest soft score among `pass`. If there is no `pass`, it is the highest among `unsure`, and the review page shows a yellow 需要人看 bar. `report.json` then has `needsHuman: true`. Only an all-`fail` set rewrites the prompt.

Ears on the sides are not an antenna, a loose sphere is not a stud, and a clay pit is not a mouth: that is in the prompt to the model. The script does not turn a model `true` into `false`. Words such as 文字 or 凸点 in the description no longer make the verdict `unsure`, and they no longer strip the boolean. They only decide which extra items the second opinion asks. A negation counts only when it sits within 6 characters before the hard-fail word. "不是很明显" (not very obvious) is not a negation. A word covered by that window is not added to the second opinion.

IP is not scanned out of free text such as `reason` or `like`. `ip.value: true` on the first checklist is a hard fail, and it is not asked again. When the first round has no hard fail and every required field is present, the script always asks once more (a second opinion). The description does not have to look clean first. A first round that is already `fail` is not asked again. Required fields that are still missing after two follow-ups stay `unsure`, and they are not asked again either.

The follow-up asks the model to say what is at that place, then to answer「有」 or「没有」. A character image is always asked three things: a part on top of the dome that is narrower than the head (the dome itself does not count), any line or opening below the eyes, any writing. A material image is always asked three things: nameable objects, any writing, rows of dots or small cylinders. A frame is always asked three things: any writing, rows of round bumps, and whether the character has turned into a different robot. `resembles` is always asked too, plus any key the first-round description made suspicious and the fixed list did not already cover. A clear「有」 on any of those is that hard fail. Every item「没有」 and `resembles` of「无」 is `pass`. A vague answer, or JSON that is still broken after one retry, is `unsure`.

Every kind is asked which known brand, toy, game, animation or work the image most resembles. The field is `resembles`: one name, or「无」 if it resembles none. 「无」, `none` and「没有」 do not change the verdict. Any other answer is matched exactly or by containment against `groups.ip` in `broll/banned-words.json`. A hit is an IP hard fail. A specific name that is not on the list is `unsure` for a person, and the reason says what the model said it resembles. A vague answer is `unsure` too.

Material objects are counted only from `objects.names`: at least 3. A line, an outline, a water stain, a speck, or a generic name such as 东西, 物体, 形状, 图案, 元素, object, item or shape does not count. If `value` and the count of real names disagree about whether there are 3, the result is `unsure`, not a pass. That is a structural mismatch, not a guess from keywords. Missing `names` gets a follow-up. Still missing after that is `unsure`, not zero objects and not a pass. A clean `false` on the follow-up no longer locks the first description's suspicion. The second opinion looks at the picture and answers that itself. If the model splits the checklist into several JSON pieces, the script joins them back into one.

## The review page

Each finished or stopped run writes two files:

- `broll/styles/_drafts/<id>/review.html`: a local file. The top line is the conclusion and the next command. If the pick is `unsure`, a yellow bar at the top says 需要人看. Below that, every candidate's thumbnail, hard fails, soft score, reasons, which one was picked, the still, and video frames if a video was made.
- `broll/styles/_drafts/<id>/report.json`: the same conclusion as data. If the pick is `unsure`, `needsHuman` is true and `attention` is 需要人看.

The page does not approve the style. It says the next command can only be run by a person.

## A person approves

After reading the page, a person runs this in a terminal:

```
node scripts/broll/approve-style.mjs <id>
```

**An AI assistant must not run this command.** The docs, the usage text and the run output all say so. If stdin is not a terminal, the command refuses.

It prints the conclusion and the hard-fail summary from `review.html`, then asks you to type the id. A report that has an error is not approved. If the draft needs a person, you also type `yes`. It then copies `style.json` and the two chosen references into `broll/styles/<id>/`. `refs` must be `refs/character.jpg` and `refs/material.jpg`; anything else is refused. If a video trial was made and passed, `status` is `stable`; otherwise it is `experimental`. `refs/README.md` records where the images came from and a short score summary. An existing directory with the same id is not overwritten. The draft stays.

A new style enters the style menu by the existing rule: the directory contains `style.json`. The `broll.json` format does not change.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Requests were only printed, or the draft is waiting for a person (no video was asked for, or the video passed) |
| 1 | References could not be picked; or `--video` was set and the video did not pass; or a batch had a failure |
| 2 | Bad arguments, the draft failed 3 rounds, a key is missing, this id is already published, `state.json` is corrupt or looks wiped and `--state-reset` was not set, this style is already running in another process, the last video submit was not confirmed, the last video failed and `--video-redo` was not set, or the server explicitly refused the submit (for example, insufficient balance) |
| 3 | The video is still generating. The task id stays. Run the same command later to keep querying. It will not submit again |
| 4 | The API failed |

## Known limits of the vision check

Hard-fail words in the description are no longer handed to a person by themselves, and a `true` is not turned into `false`. A first-round boolean `true` is the hard fail. A `false` whose description still has an unnegated hard-fail word adds that item to the second opinion, and the model answers 有 or 没有 while looking at the picture. IP uses the first-round `ip.value` and whether the second-opinion `resembles` hits the list. Brand names in the reason text are not scanned. Typical mistakes:

- Ears on the sides of the head, or a paper disc about as wide as the head, called an antenna.
- A faint curve of a mouth missed; the other way, a speck or a fingerprint called a mouth.
- Stains and a single line on a nearly empty page counted as objects. If the model leaves a required field out of the JSON, the script asks again. Still missing after that is `unsure`, not a hard fail.
- A loose wooden sphere called a stud on a brick.
- "A robot plus blocks" called LEGO. Plain wooden blocks are not.
- Subtitles and badges burned into a finished film counted as text. That call is right, but do not use delivery frames as style references.

To measure it:

```
node scripts/broll/judge-calibrate.mjs <labels.json> --yes
```

Without `--yes` it only prints how many images and the maximum number of requests, and does not call the API. With `--yes` it calls the vision API for real (subscription quota). It starts with a two-line probe (one image, "what is in the picture"). If the model name is wrong it tries the next candidate and continues. The key is not printed and not written into the report. If more than half the rows are `unsure`, the summary says the run is invalid because too many answers were unfinished.
