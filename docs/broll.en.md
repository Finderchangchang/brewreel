# Talking-head B-roll

Add explanatory pictures to a real talking-head video. The pictures are a brick miniature. The model only writes `broll.json`. Scripts handle timing, cost, generation and the final cut.

## Who it is for

Authors who already have a talking-head video and want a picture on the lines that explain a step, an object or a comparison. The opening, the ending and lines about personal feelings stay on the face.

## Three steps

Put `talk.mp4` and `talk.srt` in a project folder. The script does not transcribe. Export the captions yourself.

1. List the lines.

```
node scripts/broll/list-cues.mjs <project>
```

2. Write `broll.json`. An assistant follows `broll/SKILL-broll.en.md`, or a cheap model writes it:

```
node scripts/broll/llm_broll.mjs <project> --style brick-diorama --budget 20 --captions add
```

If validation fails, the error text goes back to the model. At most 3 rounds. If it still fails, the script stops and leaves the last draft and the errors in the project folder.

3. Render. Read the estimate first. `--out` must be outside the repo.

```
node scripts/make-talk.mjs <project> --out <dir-outside-the-repo> --dry-run
node scripts/make-talk.mjs <project> --out <dir-outside-the-repo> --yes
```

`placeholder` is free and does not need `--yes`. `minimax-h3` needs the estimate first, then `--yes`.

## Three placements

| mode | Picture |
|---|---|
| full | B-roll fills the frame |
| pip | The face stays in a circle at the bottom right |
| split | B-roll on the top 60%, face on the bottom 40%. Vertical only |

## Captions

| captions | Meaning |
|---|---|
| add | Burn `talk.srt` onto the finished video |
| none | No captions |
| burned | The talk already has burned-in captions. Only `split`, so they are not covered again |

Check frames are the pictures to look at. After render, `check/` has the start, middle and end of each clip. `review.html` puts those three frames on the same row as the spoken line.

## Price

The price list, not the API receipt. The receipt has no amount. MiniMax's own site is the source of truth.

- 768P: 0.5 yuan per second
- 2K: 0.8 yuan per second
- Reference stills: 0.025 yuan each
- One minute of talk with 6–8 clips is about 12–20 yuan

The script rounds the window up to whole seconds and clamps it to 4–15 seconds.

## Review gate

A finished `minimax-h3` video needs a person to look at every clip.

1. `node scripts/broll/review-sheet.mjs <project> --out <dir-outside-the-repo>`
2. Open `review.html` in that folder
3. The person runs `node scripts/broll/approve.mjs <project> --out <dir-outside-the-repo>`
4. Run the same `make-talk` command again for the finished video

An AI assistant must not run approve for the person. To see the cut before review, add `--draft`. While B-roll is on screen, the corner says the clip is not reviewed.

`placeholder` and `local` are free and skip review.

## Known limits

- Each clip is generated on its own, so the robot's shape can drift.
- Text inside a generated picture is unreliable. Do not ask for writing on screen.
- Only the brick look is supported. Block tops are smooth.
- There is no automatic transcription. Export `talk.srt` yourself.
