---
name: brewreel
description: BrewReel (精酿) — make a vertical product promo video (1080x1920, 15–45s, for TikTok/Douyin/Shipinhao/Xiaohongshu). Use when the user wants a product promo, a marketing short, an app intro video, a feature-demo clip, a launch teaser, or a live-selling intro. Supports six industries (software, food, ecommerce, education, beauty, travel) and both Chinese and English. You only write one storyboard JSON file (storyboard.json); shots are drawn by ready-made components, a validator blocks rule and compliance violations, and one command renders the finished video with original music and sound effects (optional MiniMax voice-over).
license: Apache-2.0
metadata:
  version: 0.5.0
---

# BrewReel (精酿): Product Promo Video

You do exactly two things: **pick shots** and **fill in text**. Don't write code, don't edit anything under `template/`, `scripts/`, or `industries/`, don't write coordinates, frame numbers, or color values.

Below, `<SKILL>` = the folder this file lives in. Run commands with Node 22 / Python 3.10. 需要中文文档或做中文视频 → 改读 `<SKILL>/SKILL.md`。

## Workflow

0. **Pick a style** (`meta.style`; leave it out for `cards`). Decide what kind of product this is, then read `<SKILL>/styles/<style>/STYLE.en.md` and `recipes.md`:

   | Style | Status | Fits |
   |---|---|---|
   | `cards` (default) | ready | single-benefit products, how-it-works flows, UI demos, physical stores; all six industries |
   | `quiz` | ready | products with a common misconception that can become a multiple-choice question (foreign phrases, misunderstood features, dishes with misleading names). Templates in `styles/quiz/recipes.md`, samples in `styles/quiz/examples/`. `meta.theme` is `sage-pine`, `rice-soy` or `ash-teal` (omitted: food gets `rice-soy`, everything else `sage-pine`); `phraseTitle.params.voice` picks the voice `exam` / `chat` / `show` (omitted: chosen by industry), which sets the fixed lines (question tag, replay title, stamp, comment prompt); any of them can be overridden in its shot. Write your own question and comment prompt instead of copying stock lines from similar videos (Q14 warns); clip lines must not give the answer away |
   | `journey` | available | products with many clear categories (content platforms, feature-rich software, multi-category stores, course catalogs, a sightseeing route). One district per category / feature / stop; templates and per-beat fields in `styles/journey/recipes.md`, examples in `styles/journey/examples/`. Default `meta.aspect: "4:5"`, `9:16` also works; pick the backdrop with `opening.params.skyline` (`modern` / `street` / `oldtown`; old-town travel must use `oldtown`) and district props that match the content; the opening kicker names the route or the highlights (e.g. "5 stops on this line") rather than a stock "tour X in one go" line (J18 warns); themes `post-green` (default) / `plum-ticket`; prices, times and totals must be copied from `meta.facts` |

   - When unsure, use `cards` and don't write `meta.style`. Styles in development are blocked by validation.
   - `meta.aspect`: `9:16` (default, 1080x1920) or `4:5` (1080x1350). `cards` supports 9:16 only; leave it out.
   - Steps 1–12 below describe `cards`. With another style, its `recipes.md` decides the shots and fields; industry compliance, `meta.facts`, the Don't list and the render command stay the same.
   - **Style shots keep every field inside `params`**; the top level of a shot is only `type`, `dur` and `params`. Example (journey): `{"type": "district", "dur": 4, "params": {"category": "Budget alerts", "title": "Three days before month end, a nudge", "scene": "phone"}}`. `meta.theme` is the cards palette; other styles follow their own recipes. Drop optional fields such as `cta` entirely when unused instead of writing an empty string.
1. **Set the industry and language.**
   - `meta.industry`: `software` (default) / `food` / `ecommerce` (physical goods) / `education` / `beauty` / `travel` (travel & lodging). Pick the wrong industry and both the allowed shots and the compliance rules will be wrong.
   - `meta.lang`: `zh` (default) / `en`. Set `en` when the video needs English captions or the audience is English-speaking (usage details in step 5).
   - Industry other than software → **read `<SKILL>/industries/<industry>/recipe.en.md` first** (`recipe.md` for the Chinese version): it has this industry's recommended shot combos, `brief-template.en.md` (what to ask the client for), and `test-brief.md` / `expected.md` (worked examples of what gets blocked and why). Skipping this step makes it easy to write content that gets blocked later.
2. **Read the brief.** Understand it against the matching `brief-template.en.md` sections; if "product name / one-line pitch / pain-point scenario / core action / 2–4 selling points" are missing, ask first — never invent data or features.
   - `meta.product` copies the brief's product name verbatim; the whole video (hook pill, end-card brand) uses only this one name, and the end card's `brand` must match it exactly.
   - `meta.action`: **required**, one sentence — "what the user does → what the product gives back" (e.g. "snap a receipt photo → amount and category filled in automatically"). It never appears on screen. A demo shot (chat/phone/mockApp/photoShot) must show this action in its on-screen text; validation checks for the overlap.
   - If the brief gives a "how to get it," copy it verbatim into `meta.cta`, and the end card's `cta` copies that; if the brief says "none," leave both unset. **Never invent** something like "search for X in the app store."
   - Don't put a feature into selling points or the end card if the brief never mentioned it.
   - If the brief gives "numbers and sources," copy each one into `meta.facts`, formatted as `[{"id":"f1","text":"…verbatim…","source":"…"}]` (**not a plain string array**):
     - `source` is **required**: copy the source the brief gives ("2026-09 price list", "admin stats through August"). If the brief names no source, write `"source not given in brief"`. Never invent a source or a fact.
     - `quote` is optional: the brief's original sentence, copied word for word.
     - Any on-screen number with a unit (duration, percentage, multiplier, headcount, money) must have the same number in `meta.facts`, or it's an error. If the brief gives no number, write a qualitative statement.
     - A shot's `params.refs: ["f1"]` ties a claim (like "made fresh", compare's stat/level, a meter reading) to a fact entry.
   - **Keep sample data apart from result claims** (validation blocks this):
     - A fact whose text or source says "sample / demo / simulated / fictional" (示例 / 演示 / 模拟 / 虚构) is sample data and **can't back a result claim**. Result claims = compare stat/level, counter numbers, a meter moving "for the better", percentages/multipliers in captions or selling points, time or money after "save / cut / boost".
     - When the UI can only show sample numbers (no real data in the brief): set `"demoData": true` in meta and put "Demo screens, sample data" in `meta.disclaimer`. Sample numbers may only appear in demo UI (mockApp/phone/chat/priceCard) and in price terms.
     - No result data in the brief → compare the process only (items like "3 fewer steps", "no app switching"), no stat numbers, no level, no counter.
     - Speed claims ("in seconds", "instantly", "zero wait") need a real fact with a time in seconds. A call to action like "try it now" doesn't count.
   - **Qualifiers travel with the number** (validation blocks this): when an on-screen number matches a fact, the conditions attached to it in that fact must appear in the same shot (caption, card, or bottom notice):
     - Copy date ranges as written: if the fact says "Sun–Thu 328", the screen says "Sun–Thu", not "weekdays" or "Mon–Thu".
     - Coupon / member price, "from N", add-on fees with amounts, promotion dates, booking required, not valid on holidays: keep every one. Example: "29.9 after coupon" can't become "final price 29.9".
     - If the fact says "keeps warm 6 hours", the screen can't say "keeps warm all day"; if the fact has a fixed checkout time, the screen can't say "flexible checkout".
   - **The whole video should only use one number for the same duration claim**: if counter says 3 minutes, nothing else can say "instant" or "3 seconds"; if the hook says "half a day," counter's old value has to be half a day too — validation blocks mismatches. Within one `compare` side, `stat` and `items` can't contradict each other either (e.g. the left side saying both "5 minutes" and "three days").
   - To override the default 15–45s total-duration range (e.g. an industry-recommended structure that needs 27s+), set `meta.durationRange: [15, 60]` (a two-element array).
   - For a persistent small-print notice at the bottom (e.g. "limited-time offer, see the deal page for terms"), use `meta.notices`: a string array, up to 3 entries, merged into one line at the bottom. A notice must not repeat `meta.disclaimer` (both saying "demo" counts as a repeat; validation blocks it).
3. **Create a folder and list your assets**: `promo/<english-slug>/`, with the storyboard at `promo/<english-slug>/storyboard.json`. Copy any screenshots/recordings/logo/photos the user gave you into the same folder.
   - Every file used by a photo shot (`photoShot`, `beforeAfter`, `storeCard.photo`) must be listed in `meta.assets`:
     `"assets": [{"src": "photos/dish.jpg", "source": "merchant"}]`. `source` is one of `merchant` (real photo from the business) / `illustration` / `screenshot` (software screenshot).
   - A screenshot can't go into photoShot; an illustration can't be labelled as a real photo. Files under 2KB, with a short side under 300px, the repo's own sample images, and anything under `_dev/` count as placeholders and are blocked.
   - `beforeAfter` needs **two different photos of the same customer**: both listed as `merchant`, `kind` set to `customer-before` / `customer-after`, and the same `pair` value (e.g. `"A"`). The same image twice, or a renamed copy, is blocked.
   - **The business has no usable photos**: write photoShot media as `{"source": "drawn", "tag": "示意", "illust": "<illustration id>"}`. Validation lets it through and lists it for human review. Don't say "real photo" or "customer consent", and don't set consent. It is only blocked when the business supplied photos and the video uses none of them.
4. **Pick a theme** (`meta.theme`):
   - Emotional, social, lifestyle → `warm-emotion`
   - Developer, AI, hardcore tooling → `tech-dark`
   - Health, learning, budgeting, lightweight tools → `fresh-light`
   - Office, B2B, productivity → `business-blue`
   - Holiday, promotion, launch → `festival-red`
   - Premium, minimal, design-forward → `mono-premium`
   If there's a brand color, set `meta.brandColor` (#RRGGBB) — it only swaps the accent color.
5. **Pick 5–9 shots** (shot docs in `<SKILL>/shots.en.md`, an 18-shot overview table is at the top; with quiz / journey use that style's shots and keep their fields inside `params`, see step 0). `hook` must be shot 1 (2–3s), `endCard` must be the last shot (4s).
   **At least one shot must demonstrate the core action** (the `meta.action` from step 2). The allowed shots depend on the industry; validation blocks the video otherwise:
   - **software, education (UI products)**: `chat` with messages + panel (question → answer); or `mockApp` with `input` (what the user typed/asked) + a result (dashboard's `stat`, editor's `items`/`done`); use `phone` if you have a screenshot.
     - A messaging/reply product needs chat (or a real phone screenshot); a product that isn't about chatting must not be shown as a chat.
     - `mockApp kind:"form"` is only for products that really are forms; don't use a form in place of the core action.
     - A mockApp dashboard's `input` and `stat.label` must match as question and answer ("new merchants in Guangzhou last month" → stat "New merchants, Guangzhou, last month"); items can't be filler words like "data" or "info".
   - **food, ecommerce, beauty, travel (physical goods / stores)**: **no mockApp** (no made-up ordering or booking screens). Use at least one `photoShot` (real or illustrated fallback) or `beforeAfter`, plus steps / priceCard.
   `meta.industry` determines which shots you're allowed to use (see `enabledShots` in `industries/<industry>/rules.json`, or just read recipe.en.md) — picking a shot that's not open for this industry is a validation error. 7 industry shots (all closed by default for software):
   - `photoShot` real photos/short clips (dishes, products, work, rooms, common areas, kitchen)
   - `priceCard` price list; `storeCard` location/map/booking; `reviewCard` a real customer review (quoted verbatim, never rewritten to sound more impressive)
   - `factSheet` spec sheet / unboxing list / course syllabus / exam info / color swatches; `credCard` credentials/honors card
   - `beforeAfter` before/after wipe slider (**beauty industry only**, requires `consent:true` + `retouched:false`)
   Choose the shots in between based on the product — **don't force a fixed template**, `features` selling-point cards aren't mandatory. Two hard requirements (validation flags these):
   - **At least one middle shot from {compare, steps, phone, meter}**;
   - **Don't use quickList and counter together** (using both makes the video collapse into the same hook → quickList → mockApp → counter → endCard template everyone else uses).
   For the software industry, some combos to start from and adapt (other industries: follow the recommended structure in `industries/<industry>/recipe.en.md` directly):
   - **Consumer emotional/social** (chat, feelings, companionship): hook(bubble) → chat demo (written as 2–3 caption lines) → meter or compare on "how much this line of text really weighs" → quickList quick-cut → endCard
   - **Productivity tool** (writing, budgeting, publishing, editing): hook(stat) → compare "before vs. now" → mockApp editor/form demoing "input → result" → steps on how to use it → endCard; or hook → quickList on the hassle → mockApp → steps → endCard
   - **B2B data/office** (reports, meetings, CRM): hook(icon or split) → phone with callouts, or mockApp dashboard with `input` ("ask a question → get numbers") → compare on how the process differs → steps → endCard; only use counter if the brief actually gave you a duration number (and if so, drop quickList)
   - Vary the hook `visual` across a batch: bubble for one painful message, stat for a real number, illust for a place or an object, split for pain vs. product. When compare has `level`, the `tone: good` side must come out ahead on that scale (set `higherIs` to say whether higher is better or worse).
   Total runtime of 20–30s is ideal (15–45 allowed, or your custom `meta.durationRange`). Don't repeat the same shot type back to back. Don't let `mood` jump more than 0.5 between adjacent shots (insert a transitional shot instead), or the background will cut jarringly.
6. **Write captions** (each shot's `caption`): one line of thought per shot, big bold TikTok-style text, **spoken to the viewer, never a description of what the screen is doing** (❌ "Cards pop in one by one, explaining what it can do" — that's a stage direction, not a caption).
   - English: measured in raw Latin characters against a scaled line budget (roughly 1.8× the Chinese character limit) — exact numbers are in each shot's own doc (`docs/shots/<type>.en.md`). Still at most 2 lines, break with `\n`.
   - Wrap the 2–5 most important characters/words in `{}` for the accent color; at most one `{}` span per caption.
   - hook's caption is the cover headline — the user's pain point or a counter-intuitive question.
   - endCard never has a caption; its headline goes in `params.slogan`.
   - **No single caption line should stay on screen more than 5s.** For a shot longer than 5s (like an 8–10s chat), make `caption` a 2–3 item array, split evenly across the beats:
     `"caption": ["Before you hit send,\n{they just want to know you care}", "Pick one and fill it in,\n{sending it is up to you}"]`
   - The caption should speak to the user's situation or what the product changes for them, and connect to the shots before and after it — how things animate on screen is the component's job, don't narrate it. Any word in quotes in the caption must have actually appeared on screen in this shot or an earlier one (validation checks this).
   - If a caption states a count ("these 4 lines," "3 replies"), it must match the actual number of items in that shot (validation checks this).
   - Avoid stock phrases ("Three things, {it...}", "just these 3 steps", "does this ever happen to you...") — don't copy captions/params from the examples, shots.en.md, or the specs either; validation flags both and, for stock phrases, gives you a fill-in-the-blank template. Examples are for format reference only.
   - Don't duplicate words for padding, don't chop a word down to hit a length limit, avoid the common misspellings in the typo list, and rewrite the whole sentence when it's over the limit rather than trimming individual characters.
   - Avoid absolute claims ("handles everything," "completely clear," "100% safe," "guaranteed") — the product usually can't back these up; validation flags them, use a more grounded phrase instead.
   - Line breaks are a single `\n`; use quotation marks, not double quotes `"`, inside caption text.
   - Don't start items or points with ✓ • · - or "1.": the component draws icons and numbers. Don't leave a single word alone on the last line, and don't break a line after a function word like your / the / to.
7. **Set `mood`** (0–1): pain point/tension 0.8–1, turning point 0.5, product and selling points 0–0.3, end card 0. Background color and music follow it.
8. **Write storyboard.json**, format shown in the full example at the end. Duration is `dur` (seconds), in multiples of 0.5.
   **The file must be UTF-8.** On Chinese Windows the system default is GBK: write UTF-8 directly with your editor/file tool; in PowerShell use `[IO.File]::WriteAllText($p, $json, [Text.UTF8Encoding]::new($false))`; in Python use `open(p, "w", encoding="utf-8")`. Don't use `echo >` or Windows PowerShell 5.1's `Out-File` for non-ASCII text.
   `chat`'s `panel.replies` are what the product suggests **"me"** sends to the other person — write them from me's point of view (if I said I have to work overtime, the suggested reply can't be "stop working overtime and spend time with me" — that's the other person's voice). Don't set `typing` when there's a `panel`.
9. **Validate**, fix every reported issue, repeat until it passes. If the brief is a file, add `--brief` so validation checks that the numbers and quotes in facts really are in the brief:
   ```
   node <SKILL>/scripts/validate.mjs promo/<name>/storyboard.json --brief promo/<name>/brief.md
   ```
   The error format is "Shot N (type) field: problem → how to fix," follow the fix instructions. Results come in three tiers:
   - **Errors**: must fix — the video won't render until these are clear.
   - **Warnings**: fix them when you reasonably can (copy quality, structure not looking too template-like); it's OK to render with warnings left, but be ready to explain to the user why you left them.
   - **Human review**: things validation can't judge on its own (like "is this review quoted exactly, with no changes" or "does this credential really come from the brief") — **don't edit the storyboard for these**, list them for the user verbatim so they can confirm.
10. **Render** (2–4 minutes, music is generated automatically; if another video is rendering, this one queues and prints its place every 15 seconds):
    ```
    node <SKILL>/scripts/make.mjs promo/<name>/storyboard.json --out promo/<name> --brief promo/<name>/brief.md
    ```
    - `--out` is required. While testing use `--round <round-name>` instead: output goes **outside the repo** to `promo-video-skill-tests/<round-name>/<slug>/` (next to the repo folder). Use the same round name for videos made together, **never invent a timestamp-based folder**, and never write test output into the repo. If `--out` points inside the repo (other than `promo/`), make stops with exit code 2; use `--round`, or an absolute path outside the repo.
    - **Don't stop before make does**: queueing plus rendering can outlast your per-command time limit. If it would, run make in the background and check `manifest.json` in the output folder about every 30 seconds until `status` appears (only `delivered` counts). Until you have seen the `交付：` line, do not write a delivery report and do not end the task.
    - Output: `video.mp4`, `sheet.png` (one frame per second, tiled), `check/` (frame 0 + a full-size frame near the end of every shot), `report.txt`, `layout.json`, `manifest.json` (sha256 of storyboard and video, duration, every check result). The previous run's copies of these files are cleared first.
    - To preview a few frames without a full render: add `--stills 0,3.5,8` (seconds). This is not a delivery.
    - With `meta.voice` (voice-over), make synthesizes the narration first and retimes shots to the voice — see "Voice-over" below. Without `MINIMAX_API_KEY` add `--voice-provider mock` to check rhythm (placeholder voice, not a deliverable), or `--no-voice` for a version without narration.
    - **Only the last line counts**: on success the last line is `交付：<mp4 path>` ("delivered"). The path you give the user **must be copied from that line**. No such line means the run failed; never hand over some other mp4.
    - Exit codes: 0 deliverable / 1 validation failed / 2 bad arguments / 3 a ✗ in the layout or Han-character check (the video is renamed `video.rejected.mp4`, only for seeing what broke) / 4 render failed or wrong duration / 5 queue timeout / 6 internal error / 130 interrupted.
11. **Read `report.txt`**: **any single ✗** in "machine self-check," "text-layout report," or "layout self-check" means the video can't be delivered (make exits with 3). The layout check measures every text block after rendering: clipped by a card, two text blocks overlapping, key text outside x180–900, and for English videos any Chinese character on screen (one probe frame every half beat). A ✗ usually means a field has too much text: trim items or shorten the copy, then go back to step 9. Once everything is ✓, check `sheet.png` and `check/` against the checklist below.
12. **Deliver**: before delivering you can run `node <SKILL>/scripts/make.mjs promo/<name>/storyboard.json --out promo/<name> --verify` to confirm the video still matches the current storyboard (after an edit it reports that they differ and you must re-run make). Hand the user the mp4 path from make's last line and the `sheet.png` path, plus a "pre-publish checklist" (below) — copy step 9's "human review" items into it verbatim, one by one, and let the user confirm each — don't decide for them.

## Voice-over (optional)

Turn it on only when the user wants narration / voice-over. Without `meta.voice` the film has no voice, exactly as before. With it, **the voice is the timeline**: make synthesizes each line first, gets per-word timing, then sets every shot that has a `vo` to "0.15 s + narration + 0.35 s", rounded up to a whole beat (never shorter than that shot type's minimum). The `dur` / `beats` you write only count for shots without `vo`. Subtitles light up word by word with the voice, and the music ducks by about 10 dB under speech.

1. **`meta.voice`** (only these 6 fields; anything else is an error):
   | Field | How |
   |---|---|
   | `provider` | Required. `minimax` = natural voice (rendering needs the `MINIMAX_API_KEY` environment variable); `mock` = offline placeholder tone for checking rhythm only |
   | `voiceId` | Voice; the English default is `English_expressive_narrator`. Write it explicitly for English films. See the picks below |
   | `speed` | 0.5–2, default 1. Ads usually 1–1.15; if a line doesn't fit, cut words or split the shot instead of speeding up |
   | `emotion` | Optional: `calm` / `fluent` / `happy` / `sad` / `angry` / `fearful` / `disgusted` / `surprised` / `whisper`. Leave it out for the voice's default; `calm` or `fluent` suit ads |
   | `model` | Usually leave out (default `speech-2.8-hd`) |
   | `subtitles` | `karaoke` (default, word-by-word highlight) / `line` (whole line) / `off` (voice only, no voice subtitles) |
2. **`vo` on each shot** (the one line spoken over that shot):
   - **Conversational**: short spoken sentences with a clear subject, as if telling a friend. Don't read out on-screen lists; no "as you can see".
   - **One line per shot**, one idea, no line breaks (subtitles are paged by the voice). Not every shot needs one: shots without `vo` play for their `dur` with music as usual.
   - **Length follows time**: plan about 2.5 words per second (Chinese: 4–5 characters per second), so at most ≈ (the shot type's max seconds − 0.5) × 2.5 words. cards limits: hook (max 4 s) ≈ 8 words, compare / steps / features (7 s) ≈ 16 words, mockApp / phone (8 s) ≈ 18 words, endCard (6 s) ≈ 13 words; quiz / journey: see their `recipes.md`. Validation blocks above 3 words/s (5 characters/s in Chinese); make checks again against the real audio and stops with "shot N fits about M words" if it's too long.
   - **Numbers need a source**: `vo` goes through the same checks as captions — numbers with units must appear in `meta.facts`; superlatives, absolute claims, typos and speed claims are blocked. Keep spoken numbers identical to the ones on screen.
   - `{}` highlight: as in captions, at most 1 per line (per 24 characters); shown in the accent color in the subtitle.
   - **Who shows subtitles**: in cards, a shot with `vo` and no `caption` gets subtitles generated from `vo`; a shot with a `caption` keeps showing the caption and the voice just reads — **the hook must keep its `caption`** (it's the cover title); `endCard` is voiced without subtitles. quiz / journey show the narration in their own subtitle strip.
   - The last line should say the product name (exactly `meta.product`).
3. **Suggested voices** (MiniMax system voices; the MiniMax console list is authoritative — preview before first use):
   - English films: `English_expressive_narrator` (default)
   - Chinese films: `Chinese (Mandarin)_News_Anchor` (default, steady newsreader: B2B, office, tools), `female-shaonv` (young female: consumer, lifestyle), `male-qn-qingse` (young male, casual: quizzes, recommendations), `presenter_female` (presenter: explainers, education)
4. **Preview without a key**: add `--voice-provider mock` to make (offline placeholder voice; timeline, word-by-word subtitles and ducking all work, the storyboard stays unchanged), or `--no-voice` for a version without narration. **A mock render is for checking rhythm only and is not a deliverable** — say so explicitly at delivery ("placeholder voice; set the key and re-run for the real voice"). Without a key, validate only warns.
5. **Cost**: MiniMax bills per character of narration (see MiniMax's pricing page). Each line (same provider, model, voice, speed, emotion and text) is synthesized once and cached in the user folder `~/.cache/brewreel/tts` (override with `BREWREEL_TTS_CACHE`), so changing visuals or captions and re-rendering costs nothing; only a changed `vo` or voice is synthesized again. `manifest.json` → `voice.billedCharacters` shows what this run billed.
6. **Keys**: read only from the environment variable `MINIMAX_API_KEY` (plus `MINIMAX_GROUP_ID`, `MINIMAX_BASE_URL` if needed). Never put the key in the storyboard, the brief, command-line arguments or any file, and never print it.
7. **Voice exit codes**: narration longer than the shot allows → 1 (cut words or split the shot); no key, auth failure, rate-limit retries exhausted, network down → 2 (have the user set the key or retry later; preview with `--voice-provider mock`).

## Self-check list (look at the frame sheet, write a conclusion for each line against the actual image — don't just tick boxes)

- Frame 0 already has the big headline + main visual — not blank or half-drawn; the cover has no `\n` or backslash artifacts
- Every shot has one animated focal element (a needle, a number, a card, a chat bubble) — not a static image; not just "a picture zooming in and out" to fake motion
- Captions never cover the main subject, never get clipped, and never break a word across two lines; the caption matches what's on screen, and the story connects from shot to shot
- Captions are spoken to the viewer, not stage directions (no sentence like "cards pop in one by one" describing the animation itself)
- The core action is genuinely demonstrated (you can see "input/question → result"), not just a finished panel sitting there
- Background color tracks the mood: pain points lean red, selling points and the end card lean cool
- The end card's product name matches `meta.product`; the CTA is either the brief's exact wording or absent; no URLs or QR codes
- **Numbers are self-consistent**: do the before/after math yourself (30 minutes vs. 5 seconds shouldn't be followed by a conclusion claiming "saves 25 minutes")
- Every on-screen number can be traced back to `meta.facts`
- No misspellings, no words chopped down to hit a length limit ("auto-upload" can't become "auto-up"), no absolute claims

## Pre-publish checklist (hand this to the user at delivery — this is not just for your own read-through)

1. **List every "human review" item in full**: copy step 9's `human` list verbatim for the user — don't decide on their behalf that "it's probably fine." Common ones: whether `reviewCard`/`credCard` quotes match the brief word-for-word, whether a platform's rules have changed recently, whether industry-specific credentials/licenses are all in place.
2. Is `meta.industry` actually correct? (Getting it wrong means both the allowed shots and the compliance rules are wrong.)
3. For anything involving a real person on camera, a customer review, or a before/after photo — has written consent actually been obtained? (Fields like `consent`/`retouched` only require you to *state* this; actually obtaining consent is the user's responsibility, not something validation can verify.)
4. Does the platform this will be published to (Douyin/Shipinhao/Xiaohongshu/overseas) match `meta.platform`, and have that platform's specific rules (e.g. no price captions on shopping-cart videos) been confirmed?
5. For bilingual projects: has a native English speaker actually read the English captions? The machine only checks length and banned words — it can't catch awkward phrasing.

## Hard rules (validation blocks these)

- Shot 1 must be `hook`; `endCard` goes last
- Total runtime 15–45s (or your custom `meta.durationRange`); each shot type has its own duration range (see shots.en.md)
- Every field has a character limit — go over it by **rewriting the whole line shorter**, not by chopping individual characters, and not by switching to a different language
- Only fields, enum values, and icon names listed in shots.en.md are allowed; a typo or extra field is an error
- At least one shot must demonstrate `meta.action` (see step 5); no caption line stays on screen more than 5s
- End card's `brand` = `meta.product`; end card's `cta` = `meta.cta` (leave both unset if the brief gave none)
- On-screen text can't contain a literal backslash (writing `\\n` in the JSON shows up as literal characters on screen)
- Nothing on screen may show: a URL, a QR code, "scan the code," an @handle, "account: name," "follow/search for account X." Your own product's category name (e.g. a tool for formatting "official accounts" posts) doesn't count as traffic-diversion — add the word to `meta.allowWords`, **don't rename the product just to pass validation**
- No absolute/superlative advertising terms: best, #1, only, first, exclusive, top-tier, absolute, 100%, guaranteed, unmatched... Only add one to `meta.allowWords` if you actually have evidence for it
- Any number with a unit (duration/percentage/multiplier/headcount/money) must have the same number appear in `meta.facts`, or it's always an error — no invented figures; every fact needs a `source`
- Sample data (a fact marked sample/demo/simulated/fictional) can't back a result claim; sample numbers in demo UI need `meta.demoData: true` plus a disclaimer that says demo/sample
- When a number matches a fact, the fact's date range, coupon condition, "from", add-on amounts and promotion dates must be on screen too (same shot or notices)
- Files used by photo shots must be listed in `meta.assets` with their source; beforeAfter needs two different real photos of the same customer
- Physical-goods/store industries (food/ecommerce/beauty/travel) can't use mockApp; software/education must demo the core action in a UI (chat/phone/mockApp)
- Industry rules come in three tiers: **block is always enforced** (e.g. medical-aesthetic efficacy claims, a struck-through price with no stated basis, a real review missing its date); **warn flags but doesn't stop you**; **human can't be judged by validation, list it for the user at delivery** (see item 1 of the pre-publish checklist above)
- Asset paths are relative to the folder holding storyboard.json, and the file must exist; screenshots support png/jpg/webp, recordings support mp4

## Don't

- Don't edit anything under `template/`, `scripts/`, or `industries/`; don't write coordinates, pixels, frame numbers, CSS
- Don't invent data or sources the user never gave you; every on-screen number must trace back to `meta.facts`. Without real data: skip result shots (counter, compare with numbers, a meter moving "for the better"), and declare sample numbers in demo UI with `demoData`
- Don't use the same image as before and after, and don't call an illustration or a screenshot a real photo
- Don't show a third-party app's name, logo, or brand color (like a specific chat app's green bubble); refer to people as "them," "a coworker," "a customer"
- Don't use real names, phone numbers, or account handles
- Don't set the `bgm` field yourself (make.mjs fills it in automatically); don't write a top-level `voice` either (voice settings go in `meta.voice`, spoken lines in each shot's `vo`)
- Don't personally adjudicate a gray-area compliance question (like "does this phrase count as medical language") — if validation blocks it, fix it; if validation lets it through but you're not sure, add it to "human review" for the user rather than deciding it's "probably fine" yourself

## Common errors and fixes

| Error | Fix |
|---|---|
| Line N is over the character limit | Shorten it, or break it into two lines with `\n` at a natural pause |
| 2 `{}` emphasis spans used | Keep only the single most important one |
| `{}` not balanced | Every `{` needs a matching `}`, and it can't span a line break |
| Contains an absolute-claim word like "best" | Replace with something verifiable: "fastest" → "results in 3 seconds" |
| Shot 1 must be hook | Add a hook shot at the very front |
| endCard can't have a caption | Remove `caption`; put the big text in `params.slogan` instead |
| Unrecognized extra field | Check the "available fields" list in the error message and fix the spelling (e.g. mockApp uses `kind`, not `variant`) |
| No icon named "xx" | Pick one from the icon list at the top of shots.en.md |
| Total runtime must be 15–45s | Add/remove a shot, or change a `dur` |
| Asset file not found | Check the path — it's relative to the folder holding storyboard.json |
| JSON parse failed at line N | Check that line for a missing comma, a trailing comma, or a `"` inside caption text (use quotation marks instead) |
| This line has to stay on screen for Ns | Make `caption` a 2–3 item array, or split this shot into two |
| No shot in the whole video demonstrates the core action | Add a chat (question → panel answer) or mockApp (input + result) |
| End card's product name doesn't match meta.product | Make `brand` match `meta.product` exactly |
| `cta` is set but meta.cta is empty | If the brief has a "how to get it," put it in meta.cta and copy it; otherwise remove `cta` |
| Literal \n found in text | JSON line breaks should be a single backslash |
| vo: narration has N words, this shot is at most M s, needs X words/s | Cut words, or split the line across two shots (one line each); don't raise `speed` |
| Voice-over failed: narration takes N s, longer than this shot's max M s | Shorten to the suggested length, or split the shot |
| No MINIMAX_API_KEY in this environment (warning) | Have the user set the environment variable before rendering; preview with `--voice-provider mock` |
| Voice settings belong in meta.voice | Move the top-level `voice` into `meta`; spoken lines go in `vo` |
| Contains a platform name (warning) | Your own product's category term: add it to `meta.allowWords`; if it's traffic-diversion, remove it |
| Missing required field meta.action | Write one sentence: "what the user does → what the product gives back" |
| Number not found in meta.facts | If the brief gave this number, copy it verbatim into `meta.facts` (as `{"id":"f1","text":"…","source":"…"}`); if not, replace the specific number with a qualitative statement |
| meta.facts[N].source missing | Copy the source from the brief; if it names none, write `"source not given in brief"` |
| Comes from a fact marked sample/demo, but demo data isn't declared | Set `"demoData": true` in meta and put "Demo screens, sample data" in the disclaimer |
| Only in a fact you marked as sample/demo | That's a result claim sample data can't back: drop the number, compare the process only; replace counter with steps or compare |
| level (8 vs 2) … no such score in meta.facts | Remove both sides' level and meterLabel; put the difference in items |
| The scale points the wrong way | Make the `tone: good` side win on that scale, or set `higherIs` / reword meterLabel |
| Reading N has no basis | A judgement the product shows in a demo → `demoData: true`; a result or score → copy the number into facts and add refs, or drop the shot |
| Qualifier dropped (the fact's date range is missing) | Copy the fact's date range or condition into the same shot word for word; don't rewrite it as "weekdays" / "weekend" |
| Price needs a condition in the brief | Put the condition in the same line, e.g. "29.9 after coupon"; if it doesn't fit, don't quote the price there |
| Physical/store industry, mockApp is a made-up app screen | Remove mockApp; show the core action with photoShot (real or illustrated) + steps |
| Asset not listed / before and after are the same file | List every file's source in `meta.assets`; use two different photos of the same customer, or switch to steps |
| "Made fresh"-type claim needs evidence | Point `refs` at the brief's fact; if the shot has no refs field, drop the claim |
| Caption contains shot-direction wording (like "cards pop in one by one") | Captions are spoken to the viewer, not editing notes — rewrite from the viewer's point of view |
| "登陆" is a typo — should be "登录" (Chinese-only check) | Applies to Chinese text only |
| Absolute claim like "completely clear" | Use a more grounded phrase, e.g. "the key info is visible" |
| Industry "XX" doesn't allow shot "YY" | Swap in a shot that's actually open for this industry, or double-check that `meta.industry` is set correctly |
| [B-xxx] hit an industry compliance rule | Follow the "how to fix" text in the error; only consider `meta.allowWords` if you truly have evidence (it only works for warn-level rules — block-level rules must be removed, no exceptions) |

## When there's no real screenshot

Prefer the `mockApp` shot (it animates). If you really need to show "tap here on the phone," render mockApp to a still image first and feed that into `phone`:
```
cd <SKILL>/template
npx remotion still src/index.ts Screen <absolute-path-to-storyboard-folder>/screen.png --frame=145 --props=<absolute-path-to-storyboard-folder>/screen-props.json
```
`screen-props.json` should contain `{"type":"mockApp","theme":"<theme>","dur":5,"params":{...mockApp's params...}}` — see `<SKILL>/examples/_src/screen-props.json` for reference. Then the phone shot's `"src"` points at `screen.png`, and set `meta.disclaimer` to something like "Demo screen, simulated content."

## More examples (structurally different — pick by "type of product," don't copy the captions)

All 9 examples pass validation and render as-is; the products and numbers are fictional:
- `<SKILL>/examples/jev.json`: consumer/emotional, software (chat demo with 2 caption lines → compare → gauge → quick-cut list → end card; the gauge reading is a demo judgement, so `demoData` is set)
- `<SKILL>/examples/ledger.json`: productivity tool, software (pain-point quick-cut → process-only compare → mockApp snapping a receipt → budget reading → end card; no real result data, so no counter)
- `<SKILL>/examples/meeting.json`: B2B office tool, software (screenshot with callouts → to-do list → before/after compare → steps → end card)
- `<SKILL>/examples/en-focus.json`: a `meta.lang: "en"` example — the full example below
- `<SKILL>/examples/food.json`, `ecommerce.json`, `education.json`, `beauty.json`, `travel.json`: one per industry (Chinese captions). beauty shows the no-photo fallback; travel shows date ranges copied from facts; ecommerce shows a coupon price with its condition
- Voice-over examples (one `vo` per shot, `provider` set to `minimax`; without a key render with `--voice-provider mock`, or change the provider to `mock` to preview; Chinese narration): `<SKILL>/styles/cards/examples/voice-reminder.json` (cards), `<SKILL>/styles/quiz/examples/software-archive-voice.json` (quiz), `<SKILL>/styles/journey/examples/software-notes-voice.json` (journey)
- For the other industries (food/ecommerce/education/beauty/travel), see `industries/<industry>/test-brief.md` + `expected.md`: test-brief is a sample client brief, and expected.md spells out exactly what a storyboard written from that brief would get blocked for, and why. Read both before your first video in a new industry.

## Full example (examples/en-focus.json, passes validation as-is)

```json
{
  "meta": {
    "title": "FocusPilot promo (English demo, fictional app)",
    "product": "FocusPilot",
    "theme": "fresh-light",
    "lang": "en",
    "disclaimer": "Demo screens, sample data",
    "demoData": true,
    "action": "Tap start → it blocks distracting apps",
    "cta": "Try it free"
  },
  "shots": [
    {
      "type": "hook",
      "dur": 2.5,
      "caption": "Meant to focus,\n{hours slipped away}",
      "mood": 0.85,
      "params": {"visual": "icon", "icon": "clock", "text": "Where did the day go?", "badge": "Start a focus block", "tone": "warn"}
    },
    {
      "type": "mockApp",
      "dur": 4,
      "caption": "Hit start,\n{it blocks the rest}",
      "mood": 0.5,
      "params": {
        "kind": "dashboard",
        "title": "Focus Today",
        "input": "How's my focus today?",
        "stat": {"value": "3", "label": "Sessions done"},
        "items": [
          {"icon": "bell", "text": "Apps blocked", "value": "6", "tone": "good"},
          {"icon": "clock", "text": "Deep work", "value": "25m", "tone": "neutral"}
        ],
        "highlight": 0
      },
      "note": "core action: tap start -> distracting apps get blocked for the session"
    },
    {
      "type": "quickList",
      "dur": 3.5,
      "caption": "Not every app\n{deserves your focus}",
      "mood": 0.5,
      "params": {
        "title": "What gets muted",
        "items": [
          {"text": "Social feed", "tag": "Muted", "tone": "bad"},
          {"text": "Video app", "tag": "Muted", "tone": "bad"},
          {"text": "Deep work", "tag": "Open", "tone": "good"},
          {"text": "Messages", "tag": "Later", "tone": "warn"}
        ]
      }
    },
    {
      "type": "meter",
      "dur": 3,
      "caption": "One tap,\n{a calmer afternoon}",
      "mood": 0.4,
      "params": {"value": 8, "max": 10, "label": "Focus score", "style": "gauge", "higherIs": "good", "word": "Great", "note": "Based on this session"}
    },
    {
      "type": "endCard",
      "dur": 4,
      "mood": 0,
      "params": {
        "brand": "FocusPilot",
        "slogan": "Less scrolling,\n{more finishing}",
        "points": ["Blocks distracting apps", "One tap to start"],
        "cta": "Try it free",
        "icon": "clock"
      }
    }
  ]
}
```
