# Changelog

[中文 → CHANGELOG.md](CHANGELOG.md)

## v0.10.0 · 2026-10-06 · Style factory: one sentence makes a new AI B-roll style

Also: the README front page is reorganized (both workflows side by side, a three-step quick start, details moved into docs), in Chinese and English.

### New: style factory

- `node scripts/broll/new-style.mjs`: one sentence drafts an AI B-roll style under `broll/styles/_drafts/<id>/`, generates references, scores them, picks, and makes one still. Without `--yes` it only prints the requests it would send. A video trial needs both `--video` and `--yes`, and it prints the credit and list-price line before the real call. The vision check is only the first screen; a person looks last.
- `node scripts/broll/approve-style.mjs <id>`: a person runs this after the review page. It publishes the draft into `broll/styles/<id>/`. An AI assistant must not run it. Status is `stable` when a video trial was made and passed, otherwise `experimental`.
- Style directories whose names start with `_` are not part of the style menu. See [docs/style-factory.en.md](docs/style-factory.en.md).

## v0.9.0 · 2026-10-05 · Drop in one talking-head video, get explainer shots

A big update to talking-head B-roll (experimental): a talk video alone is now enough, with free motion clips and several AI clip styles. Promo videos work and look exactly as before. `broll.json` files written for v0.8 still run as version 1, and clips already generated are not paid for again; changing a file to version 2 changes the prompt and the request, so AI clips already generated are generated and paid for again.

### New: one command
- `node scripts/talk.mjs <project> --out <dir-outside-the-repo>`: transcribe → a cheap model writes `broll.json` → render. Steps already done are skipped, so you can keep running the same command. It never runs `approve.mjs`.

### New: local transcription
- Only `talk.mp4` is needed in the project folder. Transcription runs on your machine with the SenseVoice model (through sherpa-onnx), with no network and no cost. The first run downloads a model of about 240 MB, tried from ModelScope, HuggingFace and hf-mirror in that order, with resume and a sha256 check. An existing `talk.srt` is never overwritten.
- With a DeepSeek key, a proofreading pass runs by default: the model only returns "change this character to that one" patches, the script decides from the pronunciation whether to apply each, and changes touching numbers, negations or opposites are only suggested. The record goes to `talk.fixes.txt`. `--no-fix` turns it off. Proper nouns go in `talk.terms.txt` or `--terms`.
- Splitting or merging cues after `broll.json` is written is stopped by validation (the cue ids would shift).
- No cloud transcription in this release.

### New: motion clips
- Clips with `"source": "motion"` in `broll.json` are motion clips with five templates: `keyword`, `checklist`, `steps`, `counter`, `compare`.
- The layout is redrawn for the talking-head frame and fills the free area (what is left after the platform bars, captions and the picture-in-picture circle) instead of a small card on a large empty background: the keyword takes about 80% of the width and wraps to two lines when long, and the key phrase gets a highlighter stroke and one small grow; checklist, steps, counter and compare cards and text are much larger.
- Colours and finish follow the main style so they sit well next to the AI clips (`motionTheme` in a style's `style.json` is now `{"look": …, colours…}`): wood blocks get a warm wood table, off-white cards and blue-grey and warm-orange wooden blocks; clay stop-motion warm pastels; layered paper off-white paper with a few coloured sheets; ink sketch (experimental) white paper and ink lines. The background has a faint texture and slowly drifting shapes; only shapes and textures are added, every word still comes from the speech.
- Layout modes: motion clips default to `split` (`pip` on a horizontal talk) so the speaker stays on screen; `keyword` in `full` is rejected and `full` is only for a `checklist` / `steps` with 3 or more items, with the fix in the error. The `llm_broll` prompt and examples and the `SKILL-broll` choice table follow.
- Transitions no longer cross-fade (which showed two faces): there is one picture of the speaker that shrinks to the bottom in `split` while the card slides down from the top, or into the circle at the bottom right in `pip`; the exit plays backwards. The `split` divider gets a thin theme-colour line and a soft shadow, and the speaker crop moves down a little. Motion clips use a larger circle (about 250 px on a 720-wide talk) with the face zoomed in a little, a card-coloured ring and a shadow.
- Motion clip polish: `pip` / `full` lay out for the tall area, the keyword's key phrase gets its own full-width line and wraps to two larger lines in a tall area, checklist and steps rows and text grow with the area; items not yet said are no longer drawn as dashed or grey placeholders; decorations stay outside a margin around the text and captions and never peek out behind the circle; a `keyword` clip's caption keeps only the words the big text does not show; the compare verdict is larger and the old card is opaque and struck through; money amounts with an old price flip instead of rolling and confetti only flies out from behind the card; check badges follow the style's colours, and ink sketch uses only black, white and yellow; layered paper and clay stop-motion backgrounds get paper fibres, fingerprints and mottling that survive video encoding.
- Text on a card must be consecutive words from the spoken sentence, checked character by character; a negation right before a quote must be included; numbers only go through `counter`'s `say` / `from` and must come from the sentence.
- Free, no ledger, no review, no "AI-generated" badge. With the transcription cache, words appear at their real spoken times.
- A v2 example is in `examples/talk/motion`.

### New: several AI clip styles
- New styles: `wood-blocks` (the new default, still called 「积木风」 in Chinese, now wooden blocks), `clay-stopmotion` and `paper-layers` are the three regular styles, with reference images in the repo. `ink-sketch` (ink sketch) is experimental: in two rounds of reference images the robot always got an antenna on its head, which does not match the shared character, so this release ships no reference images for it; it only works as a `placeholder` preview and cannot be a second style. The old `brick-diorama` is now marked experimental and not the default; validation warns that it shows studs. Old projects still work.
- One shared robot for the whole film; its shape and colors are in `broll/character.json`, and a style only decides its material.
- `broll.json` version 2: top-level `style` plus an optional second style `styleAlt` and a storyline `thread`; AI clips add `look` (main / second style) and `link` (open on the previous clip's end frame). At most two styles per film, the second style on no more than half the AI clips, and the first AI clip in the main style.
- Prompt v2: describes only what should be seen; after assembly it is checked for words that steer the picture the wrong way, and is not submitted if any are found.
- Reference images: `make-style-refs.mjs --style <style id>`. If a style has no reference images, real generation stops before submitting (exit code 2, nothing spent) and offers three fixes: switch style, use motion clips, or preview with stand-ins first.

### Changed
- `llm_broll`: writes at most 2 AI clips by default (`--max-ai` changes it) and prefers motion clips or the face for the rest; writes version 2; the prompt carries a selection table, a style list and an example per template; transcribes first when there is no `talk.srt`.
- `validate`: adds `--max-ai`; a sentence that states a number but uses an AI clip is an error, with the `counter` version suggested.
- Automatic conversion of the talk: HEVC, variable frame rate, mono, rotation flags, odd sizes and non-integer frame rates from phones are converted to H.264 with a constant frame rate in the project's `.brewreel/` before rendering; the original is untouched.
- Price display: the estimate also gives the total seconds of AI video. MiniMax subscription keys (starting with `sk-cp-`) cannot pay as you go; H3 video is paid in credits, so the estimate adds 「约 N 积分」 (about N credits; 768P estimated at about 70 credits per second, the MiniMax console is the authority). The budget gate still works in yuan.
- Review page: one row per motion clip listing its on-screen text; AI clips show the style name; the top strip puts each AI clip's middle frame side by side. The approval binds only the AI part, so editing motion clips needs no new review, and v0.8 approvals are still accepted.
- `manifest.json` records where the captions came from (transcribed / edited / supplied), the transcription model, whether the talk was converted, and each clip's source and style.
- Dependencies: `template` adds `sherpa-onnx-node` 1.13.8 and `pinyin-pro`. When upgrading from v0.8, run `npm install` in `template` again. Talking-head B-roll needs a full ffmpeg: the install command now includes `pip install imageio-ffmpeg` (the slim build bundled with Remotion lacks filters); `talk.mjs` and `make-talk` check it at the start and stop with exit code 2.
- `talk.mjs`: when it stops it prints the full next command, without the one-time flags `--rewrite-broll`, `--only` and `--force-redo`; `--rewrite-broll` cannot be combined with `--yes`. `--rewrite-broll` replaces `broll.json` only after it validates and keeps the old one as `broll.json.bak-<time>`. A failed call to the cheap model's API (offline, wrong key, no balance) gets its own exit code 4 and a plain explanation.
- Rendering: when the talk, captions, plan, generated clips and render code are unchanged, the video is not rendered again.
- Words the proofreading pass was unsure about and nobody has checked are never put on a motion card; the command reminds you at the end.

### Fixed
- The `pip` circle's diameter and margin were fixed pixel values, so the circle looked too big in smaller videos; they now scale with the frame size.
- `split` captions only reserved one line, so two-line captions pushed down onto the face; the space now grows with the number of lines.
- `pip` captions that did not fit left of the circle left a single character on its own line; slightly long lines now shrink the font a little, and if that is not enough the whole clip moves its captions above the circle.
- Stand-ins first, then real generation in the same output folder: stand-in ledger entries no longer count as paid, so the first real generation does not use up a redo; running again without `--provider minimax-h3` no longer replaces paid clips with stand-ins (it stops with exit code 2).
- The MiniMax H3 request no longer carries `extra`: tested against the real API on 2026-10-05, H3 does not accept that field (400, 2013 "param 'extra' incompatible with model MiniMax-H3"), so every submission with it failed. A style's `promptExpansion` is now only checked, never sent; the request is the same as in v0.8.
- Proofreading fixed 他 / 它 inconsistently: the same talk run twice once changed the 他 that referred to the software into 它 and once changed nothing. Pronouns are now their own category: every 他 and 她 in the transcript is listed for the model one by one, and the model has to say what it refers to and whether it is a person; the ones that refer to things become 它, the ones that refer to people stay, and `talk.fixes.txt` records what each refers to. It all happens in the same request, with no extra call. Patches that change a pronoun into 他 or 她 are only suggested. The format example in the prompt used to match a real talk and the model copied it; it is now made-up content. Three real DeepSeek runs on the same clip in a row fixed both 他 every time.
- A clip rejected by the API before generation (a bad parameter or similar; the ledger says `submit_failed`): both at the time and on the next run, the message now says nothing was generated and nothing was charged, and prints the full command that redoes only this clip (with `--only`; when you ran `talk.mjs`, it is that `talk.mjs` command). It is still not redone automatically.

### Known limitations
- The ink sketch style `ink-sketch` is experimental and has no reference images yet: it only works as a `placeholder` preview, and real generation with it stops before submitting.
- One wood-blocks clip was generated through the real API and none of its 8 sampled frames shows studs; clay stop-motion and layered paper have not been generated for real yet. Generated pictures may still occasionally show bricks with round studs; check the review page before publishing.
- Each AI clip is generated on its own; the shared character and `link` keep clips closer but do not guarantee a match.
- Motion cards copy the transcript, so transcription mistakes show up on screen.
- English transcription was tested only with synthetic speech; transcription on macOS is not tested.
- The DeepSeek Harness plugin still does not include talking-head B-roll.

## v0.8.0 · 2026-10-05 · Talking-head B-roll (experimental)

Adds brick-style explainer shots on top of an existing talking-head video. Promo videos work and look exactly as before.

### New: talking-head B-roll (experimental)
- Put the talking-head `talk.mp4` and its `talk.srt` in a project folder. The model only writes `broll.json`: which lines get a shot, what is in it, the action and the end frame. Timing, prompts and cost are computed by scripts.
- Three layouts: `full` covers the frame, `pip` shrinks the speaker into a round window at the bottom right, `split` stacks shot over speaker in vertical videos. Captions: already burned in (`burned`), added by us (`add`), or none (`none`).
- Shot sources: `placeholder` (free, for checking pacing), `local` (your own screen recordings or footage), `minimax-h3` (generated with MiniMax H3, about CNY 0.5 per second at 768P; check MiniMax's site for current prices).
- Cost is estimated before anything is spent; it stops if over budget or without `--yes`. Re-running after an interruption only queries, never resubmits; each shot can be redone at most twice.
- Generated shots must be reviewed on the review page and approved with `approve.mjs` before a final render; AI assistants must not approve on a person's behalf. An "AI-generated" tag shows while a shot is on screen.
- Cheap models can write it directly: `node scripts/broll/llm_broll.mjs <project>` feeds validation errors back verbatim, up to 3 rounds. Tested 3 times with deepseek-flash: 2 passed in one round, 1 in the third.
- One style for now: brick diorama with smooth-top blocks and a single round-headed, round-handed light blue-grey brick robot. Brand and trademark words in any field are blocked by validation.
- See `docs/broll.en.md`; instructions for AI assistants are in `broll/SKILL-broll.en.md`. The shot-selection method is adapted from vidmuse-video-creator (MIT), rewritten without copying its text or assets.

### Known limitations
- Experimental: tested on a synthetic talking-head clip and a few real generated shots; no full sample with a real speaker yet.
- Each shot is generated independently, so the character's look and colors can drift; generated shots occasionally still show studded or lettered bricks. Always check the review page before publishing.
- Text inside generated shots is unreliable; use the promo layout shots for exact text.
- No automatic transcription; export captions yourself from an editor such as CapCut.
- The DeepSeek Harness plugin does not include this feature yet; npm stays at `dsh-brewreel@0.5.0`.

## v0.7.0 · 2026-10-03 · Data-chart shot and 12 optional palettes

Old storyboards need no changes and render the same (pixel-identical when there is no brand color, or when the brand color is already clear enough). The chart shot and the new palettes come from PR #2 by @opc8838-hub. Thank you.

### New: `dataChart` shot
- One shot tells one piece of data: a title, a one-line takeaway, up to 3 key numbers, the chart, notes and the source. Chart types: `bar`, `line`, `dot`, `stacked`, `donut`.
- Every number must appear in the cited `meta.facts` text, and the source is shown at the bottom of the card. Sample data needs `meta.demoData` and a note in the disclaimer.
- Validation blocks data that would draw a misleading chart: a stacked category missing a segment, two lines with different time points, more than 6 rows, a donut with more than 5 slices, labels over 12 characters, and so on.
- Works on dark themes and in English videos; with more rows the chart shrinks instead of covering the key numbers and notes.
- See `docs/shots/dataChart.en.md`.

### New: 12 optional palettes
- `studio-cream-blue`, `studio-neon`, `studio-pink-green`, `studio-blue-orange`, `studio-red-black`, `studio-purple-yellow`, `studio-cyan`, `studio-lime-purple`, `studio-indigo`, `studio-graphite`, `coral-pop`, `mint-pop`. Set one in `meta.theme`.
- Captions in the new palettes have no outline and the emphasized words change color; there is no decorative pattern at the bottom. The original 6 themes are unchanged and remain the default.
- The full list is in `styles/cards/THEMES.md`; `node scripts/test-themes.mjs` checks text contrast for the new palettes.

### Fixes
- Render lock: if a crashed render left a lock file that can't be deleted (held by antivirus, for example), the next render used to hang silently; it now stops at the queue timeout and says why.
- Brand color: when `meta.brandColor` is too close to the card, prices, icons and text painted on the card are lightened or darkened (hue unchanged), and fills such as buttons are adjusted the same way; validation prints a note.

### DeepSeek Harness plugin 0.5.0
- Ships the skill snapshot for this release (0.4.0 never reached npm, so it goes straight to 0.5.0). Still supports dsh 0.1.x only (0.1.7-rc.2 and later).

## v0.6.0 · 2026-10-02 · Steadier scripts: recipe-specific guidance, no render on a failed read-through, sharper spoiler check

Old storyboards need no changes. The default script model changes from `deepseek-chat` to `deepseek-flash` (DeepSeek's current model name).

### Script writing (llm_make)
- With a recipe chosen, the model only gets that recipe's guide and examples, not the cards recipe's shot catalog and sample; cards-only rules (such as "at least one product-demo shot") only appear for cards. With no recipe chosen, cards is used.
- Common brief formats now set the recipe: `配方：quiz`, `- 配方：quiz`, `**配方**：quiz`, a heading followed by the value, and the Chinese names; an unrecognized value prints a warning. Available recipes are read from `styles/*/style.json` instead of a hard-coded list.
- A storyboard written in the wrong recipe is sent back for a rewrite.
- Read-through problems that can't be fixed now **block rendering** (including when a fix breaks validation and the old draft is restored, and when the read-through call fails); pass `--skip-readthrough-gate` to render anyway. Timeouts and dropped connections are retried, and `llm_log.json` is always written, including the model used.

### Validation
- Quiz spoiler check: voice-over that names the correct answer on its own before the reveal is blocked; reading all options, as the recipe guide recommends, is not.

### Safety
- The npm plugin snapshot copies only files tracked by git, so ignored files (such as a `.env` holding keys) never ship; a privacy scan runs before packing.
- The privacy scan now catches keys with dashes (such as `sk-cp-…`), `XXX_API_KEY=value`, escaped Windows paths in JSON and Chinese paths; the denylist is case-insensitive.

### Tests
- Every bundled example (including `styles/*/examples/`) is validated on each run; new unit tests for the script writer (`python scripts/test-llm-make.py`) and the privacy scan; plugin tests no longer depend on local environment variables.

### DeepSeek Harness plugin 0.4.0
- Ships this version's skill snapshot. dsh's default npm version is now 0.2.0-rc.2; the plugin has not been tested on 0.2 yet and supports 0.1.x (0.1.7-rc.2 and later) for now.

## v0.5.1 · 2026-09-27 · Two more voice providers: Alibaba Cloud and Volcengine; MiniMax tested for real

Old storyboards need no changes, and neither do v0.5.0 voice-over storyboards (Chinese films without a `voiceId` now default to a male announcer instead of the female newsreader; to keep the old voice, write `"voiceId": "Chinese (Mandarin)_News_Anchor"`).

### New: Alibaba Cloud and Volcengine voice-over
- `meta.voice.provider` now also takes `aliyun` (Alibaba Cloud Model Studio CosyVoice) and `volcengine` (Volcengine Doubao speech). They work like `minimax`: set the environment variable, write a `vo` per shot, and the render gets voice-over, word-by-word subtitles and music ducking.
- **Alibaba Cloud**: `DASHSCOPE_API_KEY`; optional `DASHSCOPE_WORKSPACE_ID` (Model Studio workspace host), `DASHSCOPE_REGION` (default cn-beijing), `DASHSCOPE_TTS_URL` (full endpoint). Uses SSE streaming for per-character timestamps (`word_timestamp_enabled`). Default model `cosyvoice-v3-flash`, default voice `longsanshu_v3` (steady male) / English `loongabby_v3`.
- **Volcengine**: `VOLCENGINE_TTS_API_KEY` (new console), or the legacy `VOLCENGINE_TTS_APP_ID` + `VOLCENGINE_TTS_ACCESS_TOKEN`; optional `VOLCENGINE_TTS_BASE_URL`. Uses the V3 one-way SSE stream with per-character timestamps (`enable_subtitle` for 2.0, `enable_timestamp` for 1.0; seconds converted to milliseconds). `meta.voice.model` is the resource ID, default `seed-tts-2.0`; default voice `zh_male_guanggaojieshuo_uranus_bigtts` (ad narrator) / English `en_male_alex_uranus_bigtts`.
- `emotion` is MiniMax-only; the other two warn and ignore it. When `--voice-provider` switches to a different provider, the storyboard's `voiceId` / `model` / `emotion` are dropped in favor of that provider's defaults.
- No new dependencies (Node's built-in fetch reads the SSE). Rate limits, timeouts and 5xx are retried with exponential backoff; auth and parameter errors are not. Errors say in Chinese and English whether it's auth, rate limit, quota or parameters, with the key redacted.
- DeepSeek Harness plugin: the render process also receives these two providers' variables (four `DASHSCOPE_*`, four `VOLCENGINE_TTS_*`); validate, doctor and setup still never see them.

### Changes
- The default Chinese voice is now MiniMax's male announcer `Chinese (Mandarin)_Male_Announcer` (checked against the real API).
- Custom endpoints (`MINIMAX_BASE_URL` etc.) must be https; http is rejected so the key is never sent in clear text.
- The quiz voice-over sample's 4th line is shorter: with the real voice it took 7.08 s, over meaningCard's limit, and was blocked on the first real run.

### MiniMax tested with a real key (after v0.5.0)
- All three recipes' voice-over samples were rendered through the real API; per-character timestamps come straight from the API, and subtitles, shot timing and ducking all work. About 390 characters billed for the three.
- Real voices read about 4 Chinese characters per second, slower than the 5 per second validation assumes; plan narration at about 4 per second.

### Not done yet
- Alibaba Cloud and Volcengine have not been tested with a real key: built from the official docs and unit-tested against SSE fake responses modeled on them. Where the timestamps sit in the events and whether the default voices work will be confirmed on the first real call (the raw timestamps are saved as `<hash>.subtitle.json` in the cache folder for checking).

### Other
- 11 new voice-over unit tests (request shape, audio chunk joining, timestamps, error classes, missing key, http endpoints for both providers), 36 in total.
- Version 0.5.1; plugin 0.3.0.

## v0.5.0 · 2026-09-27 · Voice-over: MiniMax speech + word-synced subtitles

Old storyboards: no changes needed. A storyboard without `meta.voice` gets no voice-over, and its shot lengths, subtitles and music are exactly as before (sampled frames from four sample storyboards match v0.4.0 pixel for pixel).

### New: voice-over (optional)
- Write `meta.voice` in the storyboard (`provider`: `minimax` / `mock`; optional `voiceId`, `speed` 0.5–2, `emotion`, `model`, `subtitles`: `karaoke` / `line` / `off`) and one `vo` line per shot (narration, `{}` for emphasis allowed), and the video comes out with a voice-over. How to write it, recommended voices and length limits are in the "Voice-over" section of `SKILL.en.md`.
- **The voice is the timeline**: before rendering, `make.mjs` synthesizes each line and gets per-word timing, then sets every shot with narration to "0.15 s + narration + 0.35 s", rounded up to a whole beat (never shorter than that shot type's minimum), validates again with the new lengths and schedules from there. `dur` / `beats` only count for shots without `vo`. The result is written to `voice.json` in the output folder and passed to Remotion as `props.voice`.
- **Word-by-word subtitles in all three recipes**: subtitles light up word by word with the voice and page automatically; each line starts on a whole frame, and the voice and subtitles share that start. In `cards`, a shot with `vo` and no `caption` gets its subtitle from the narration; `hook` still needs a `caption` (the cover title), and `endCard` is read out without subtitles. `quiz` and `journey` show the narration on their own subtitle bars.
- **Music ducking**: the music drops about 10 dB under speech (0.12 s attack, 0.3 s release), baked into `bgm.wav`.
- **Caching and billing notes**: audio and timing are cached by (provider, model, voice, speed, emotion, text), by default in the user folder `~/.cache/brewreel/tts`, or wherever `BREWREEL_TTS_CACHE` points. Changing visuals or re-rendering doesn't synthesize or bill again. The report lists how many lines were synthesized and how many came from the cache; `voice.billedCharacters` in `manifest.json` is the characters billed for the run.
- **Mock preview**: the `mock` provider is offline and needs no key; it makes a soft syllable-pulse placeholder voice from the character count and punctuation, with matching timing, so the whole pipeline runs without a key. Add `--voice-provider mock` when rendering to switch to it for one run (the storyboard is untouched), or `--no-voice` for a version without narration. A mock render is for checking rhythm only and is not a deliverable.
- **Needs `MINIMAX_API_KEY`**: the key is read only from the environment (plus `MINIMAX_GROUP_ID` and `MINIMAX_BASE_URL` when needed; global accounts set `MINIMAX_BASE_URL=https://api.minimax.io`). It is only sent to MiniMax in the request header, never written to the storyboard, `voice.json`, `manifest.json` or logs, and it is scrubbed from error messages. Without a key, validate only warns.
- **Exit codes**: narration longer than the shot's maximum length → 1 (cut words or split the shot); no key, auth failure, rate-limit retries used up, or no network → 2.

### Validation
- `meta.voice` accepts only the six fields above, and a wrong value comes with a fix. `vo` is checked against 5 Chinese characters or 3 English words per second; at render time the real voice length is checked again, and if it is too long the run stops and says how many characters that shot can take.
- `vo` goes through the same text checks as subtitles: advertising-law superlatives, absolute claims, typos, and numbers that must be found in `meta.facts`.
- A warning when shots have `vo` but there is no `meta.voice`, or when voice-over is on but no shot has `vo`; a top-level `voice` is flagged with a hint to move it into `meta`.
- Six new validation cases (`tests/validate/voice-*.json`) and voice unit tests in `scripts/test-tts.mjs` (MiniMax is tested against recorded fake responses, offline).

### Samples and the headless script
- A sample storyboard with voice-over for each recipe: `styles/cards/examples/voice-reminder.json`, `styles/quiz/examples/software-archive-voice.json`, `styles/journey/examples/software-notes-voice.json`.
- `llm_make.py` gains `--voice minimax|mock`, which has the model write `meta.voice` and a `vo` per shot; without it there is no voice-over, as before.

### DeepSeek Harness plugin 0.3.0
- Whitelist change: the render process (`make.mjs`) also gets four fixed environment variables, `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`, `MINIMAX_BASE_URL` and `BREWREEL_TTS_CACHE`. The validate, doctor and setup processes never see them, no other key is passed, and `envPassthrough` cannot add one. The safety tests cover this.

### Not there yet
- Not tested with a real MiniMax key: the client follows the official docs and is unit-tested only against recorded fake responses. The real voices, billing and the actual fields of the timing data are unchecked (if per-word timing can't be parsed it falls back to sentence level, then to an estimate from the character count).
- The finished audio runs about 42 ms (about 1.3 frames) behind the picture, from AAC encoder priming. The v0.4.0 music already had it, and it is generally not noticeable.

### Other
- Version bumped to 0.5.0; Apache-2.0, the compliance fine print, the privacy scan and author attribution are unchanged.

## v0.4.0 · 2026-09-27 · Renamed to BrewReel (精酿)

Old storyboards: no changes needed. Styles, fields, shots and script commands are all the same; this release only changes the name. The only things to act on are the skill install folder (optional) and the DeepSeek Harness plugin, see "Migration" below.

### The new name
- The project is renamed from Distill Video (蒸馏视频) / promo-video-skill to **精酿 · BrewReel**. Tagline: "Brew great promo reels with low-cost models" (Chinese: 「便宜模型，也能酿出好片」).
- Why "BrewReel" (精酿, "craft brew"): good beer comes from a good recipe, even with ordinary ingredients. A strong model first turns a style into a "recipe" (ready-made components + validation rules); a low-cost model like DeepSeek follows the recipe to fill in a storyboard and gets a video at the same level. The docs now use matching terms: a style pack = a recipe, extracting a style from a reference video = crafting a recipe, rendering a video = brewing. Paths and fields such as `styles/`, `meta.style` and `distill/` are unchanged.
- The website brewreel.com is being prepared and won't open until it launches.
- The GitHub repository is renamed from `Finderchangchang/promo-video-skill` to `Finderchangchang/brewreel`; the old address redirects automatically. Existing clones keep pulling without changes; to update, run `git remote set-url origin https://github.com/Finderchangchang/brewreel.git`.

### Migration
- Skill name: the `name` in SKILL.md changes from `promo-video-skill` to `brewreel`. If you installed it as a skill, consider renaming the folder to `~/.claude/skills/brewreel/` or `~/.agents/skills/brewreel/`.
- The DeepSeek Harness plugin moves to 0.2.0 **with breaking changes**:
  - Package `dsh-distill-video` becomes `dsh-brewreel`; the 7 tools `distill_video_*` become `brewreel_*` with the same suffixes (doctor / setup / catalog / guide / validate / render / verify), and **the old tool names are no longer registered**; the registered skill name is `brewreel`; the plugin line's `id` in `cordis.patch.yml` changes from `distill-video` to `brewreel`.
  - What you need to change: old tool names in approval policies (`tools/pre-execute`), prompts and scripts; if your profile overrides the plugin, change its `id` to `brewreel`.
  - Upgrade steps: `dsh plugin --profile web remove dsh-distill-video` → install `dsh-brewreel` → restart the profile.
  - Kept compatible automatically: the old output-folder marker `.distill-video-out.json` is still recognized, so existing output folders keep working; if only the old runtime folder `~/.dsh/distill-video/` exists it is reused, so downloaded dependencies and Chrome are not fetched again (renaming the template package does not count as a dependency change); the old environment variable `DISTILL_SYNC_ALLOW_DIRTY` still works, the new name is `BREWREEL_SYNC_ALLOW_DIRTY`.
  - Full mapping table: "Upgrading from dsh-distill-video" in the plugin README.
- The template package `promo-video-template` is renamed to `brewreel-template`; dependencies are unchanged.

### Other
- README, SKILL, CONTRIBUTING, the `distill/` docs and the plugin README use the new name and terms.
- Version is now 0.4.0; Apache-2.0, the compliance fine print, the privacy scan and author attribution are unchanged. The older entries below keep the name used at the time.

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
