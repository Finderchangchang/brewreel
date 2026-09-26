---
name: promo-video-skill
description: Make a vertical product promo video (1080x1920, 15–45s, for TikTok/Douyin/Shipinhao/Xiaohongshu). Use when the user wants a product promo, a marketing short, an app intro video, a feature-demo clip, a launch teaser, or a live-selling intro. Supports six industries (software, food, ecommerce, education, beauty, travel) and both Chinese and English. You only write one storyboard JSON file (storyboard.json); shots are drawn by ready-made components, a validator blocks rule and compliance violations, and one command renders the finished video with original music and sound effects.
license: Apache-2.0
metadata:
  version: 0.1.0
---

# Product Promo Video (promo-video)

You do exactly two things: **pick shots** and **fill in text**. Don't write code, don't edit anything under `template/`, `scripts/`, or `industries/`, don't write coordinates, frame numbers, or color values.

Below, `<SKILL>` = the folder this file lives in. Run commands with Node 22 / Python 3.10. 需要中文文档或做中文视频 → 改读 `<SKILL>/SKILL.md`。

## Workflow

1. **Set the industry and language.**
   - `meta.industry`: `software` (default) / `food` / `ecommerce` (physical goods) / `education` / `beauty` / `travel` (travel & lodging). Pick the wrong industry and both the allowed shots and the compliance rules will be wrong.
   - `meta.lang`: `zh` (default) / `en`. Set `en` when the video needs English captions or the audience is English-speaking (usage details in step 5).
   - Industry other than software → **read `<SKILL>/industries/<industry>/recipe.en.md` first** (`recipe.md` for the Chinese version): it has this industry's recommended shot combos, `brief-template.en.md` (what to ask the client for), and `test-brief.md` / `expected.md` (worked examples of what gets blocked and why). Skipping this step makes it easy to write content that gets blocked later.
2. **Read the brief.** Understand it against the matching `brief-template.en.md` sections; if "product name / one-line pitch / pain-point scenario / core action / 2–4 selling points" are missing, ask first — never invent data or features.
   - `meta.product` copies the brief's product name verbatim; the whole video (hook pill, end-card brand) uses only this one name, and the end card's `brand` must match it exactly.
   - `meta.action`: **required**, one sentence — "what the user does → what the product gives back" (e.g. "snap a receipt photo → amount and category filled in automatically"). It never appears on screen. A demo shot (chat/phone/mockApp/photoShot) must show this action in its on-screen text; validation checks for the overlap.
   - If the brief gives a "how to get it," copy it verbatim into `meta.cta`, and the end card's `cta` copies that; if the brief says "none," leave both unset. **Never invent** something like "search for X in the app store."
   - Don't put a feature into selling points or the end card if the brief never mentioned it.
   - If the brief gives "numbers and sources," copy each one into `meta.facts`, formatted as `[{"id":"f1","text":"…verbatim…"}]` (**not a plain string array**). Any on-screen number with a unit (duration, percentage, multiplier, headcount, money) must have the same number appear somewhere in `meta.facts`, or it's an error, not a warning — if the brief really gives no number, write a qualitative statement instead of inventing one. A shot's `params.refs: ["f1"]` can tie a specific claim (like "made fresh") to a fact entry, for industry rules to check against.
   - **The whole video should only use one number for the same duration claim**: if counter says 3 minutes, nothing else can say "instant" or "3 seconds"; if the hook says "half a day," counter's old value has to be half a day too — validation blocks mismatches. Within one `compare` side, `stat` and `items` can't contradict each other either (e.g. the left side saying both "5 minutes" and "three days").
   - To override the default 15–45s total-duration range (e.g. an industry-recommended structure that needs 27s+), set `meta.durationRange: [15, 60]` (a two-element array).
   - For a persistent small-print notice at the bottom (e.g. "limited-time offer, see the deal page for terms"), use `meta.notices`: a string array, up to 3 entries, merged into one line at the bottom.
3. **Create a folder**: `promo/<english-slug>/`, with the storyboard at `promo/<english-slug>/storyboard.json`. Copy any screenshots/recordings/logo the user gave you into the same folder.
4. **Pick a theme** (`meta.theme`):
   - Emotional, social, lifestyle → `warm-emotion`
   - Developer, AI, hardcore tooling → `tech-dark`
   - Health, learning, budgeting, lightweight tools → `fresh-light`
   - Office, B2B, productivity → `business-blue`
   - Holiday, promotion, launch → `festival-red`
   - Premium, minimal, design-forward → `mono-premium`
   If there's a brand color, set `meta.brandColor` (#RRGGBB) — it only swaps the accent color.
5. **Pick 5–9 shots** (shot docs in `<SKILL>/shots.en.md`, an 18-shot overview table is at the top). `hook` must be shot 1 (2–3s), `endCard` must be the last shot (4s).
   **At least one shot must demonstrate the core action** (the `meta.action` from step 2) — validation blocks the video otherwise:
   `chat` with messages + panel (question → answer); or `mockApp` with `input` (what the user typed/asked) + a result (dashboard's `stat`, editor's `items`/`done`); use `phone` if you have a screenshot.
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
   - **B2B data/office** (reports, meetings, CRM): hook(icon) → phone with callouts, or mockApp dashboard with `input` ("ask a question → get numbers") → compare or meter on the payoff → steps → endCard; only use counter if the brief actually gave you a duration number (and if so, drop quickList)
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
7. **Set `mood`** (0–1): pain point/tension 0.8–1, turning point 0.5, product and selling points 0–0.3, end card 0. Background color and music follow it.
8. **Write storyboard.json**, format shown in the full example at the end. Duration is `dur` (seconds), in multiples of 0.5.
   **The file must be UTF-8.** On Chinese Windows the system default is GBK: write UTF-8 directly with your editor/file tool; in PowerShell use `[IO.File]::WriteAllText($p, $json, [Text.UTF8Encoding]::new($false))`; in Python use `open(p, "w", encoding="utf-8")`. Don't use `echo >` or Windows PowerShell 5.1's `Out-File` for non-ASCII text.
   `chat`'s `panel.replies` are what the product suggests **"me"** sends to the other person — write them from me's point of view (if I said I have to work overtime, the suggested reply can't be "stop working overtime and spend time with me" — that's the other person's voice). Don't set `typing` when there's a `panel`.
9. **Validate**, fix every reported issue, repeat until it passes:
   ```
   node <SKILL>/scripts/validate.mjs promo/<name>/storyboard.json
   ```
   The error format is "Shot N (type) field: problem → how to fix," follow the fix instructions. Results come in three tiers:
   - **Errors**: must fix — the video won't render until these are clear.
   - **Warnings**: fix them when you reasonably can (copy quality, structure not looking too template-like); it's OK to render with warnings left, but be ready to explain to the user why you left them.
   - **Human review**: things validation can't judge on its own (like "is this review quoted exactly, with no changes" or "does this credential really come from the brief") — **don't edit the storyboard for these**, list them for the user verbatim so they can confirm.
10. **Render** (about 2 minutes, music is generated automatically):
    ```
    node <SKILL>/scripts/make.mjs promo/<name>/storyboard.json --out promo/<name>
    ```
    `--out` is required (use `--round <round-name>` instead while testing — output always lands under `tests/<round-name>/<slug>/`, use the same round name for videos made together in one batch, **never invent a timestamp-based folder yourself**).
    Output: `video.mp4`, `sheet.png` (one frame per second, tiled), `check/` (frame 0 + a full-size frame near the end of every shot), `report.txt` (includes a text-layout report: any words broken across lines, any overly wide lines), `layout.json`.
    To preview a few frames quickly without a full render: add `--stills 0,3.5,8` (seconds).
11. **Read the end of `report.txt` first — "machine self-check," "text-layout report," "layout self-check"** (all done automatically by make.mjs: backslashes, product name, CTA, how long a caption stays on screen, whether the end-card icon and disclaimer overlap, any broken/overly-wide lines; it also measures where every text block actually rendered, checking for clipping, overlapping text, or anything outside x150–930). Fix any ✗ first (a layout ✗ usually means one field has too much text — trim items or shorten the copy). Then check `sheet.png` and `check/` against the checklist below; if something's off, edit storyboard.json and go back to step 9.
12. **Deliver**: hand the user the `video.mp4` and `sheet.png` paths, plus a "pre-publish checklist" (below) — copy step 9's "human review" items into it verbatim, one by one, and let the user confirm each — don't decide for them.

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
- Any number with a unit (duration/percentage/multiplier/headcount/money) must have the same number appear in `meta.facts`, or it's always an error — no invented figures
- Industry rules come in three tiers: **block is always enforced** (e.g. medical-aesthetic efficacy claims, a struck-through price with no stated basis, a real review missing its date); **warn flags but doesn't stop you**; **human can't be judged by validation, list it for the user at delivery** (see item 1 of the pre-publish checklist above)
- Asset paths are relative to the folder holding storyboard.json, and the file must exist; screenshots support png/jpg/webp, recordings support mp4

## Don't

- Don't edit anything under `template/`, `scripts/`, or `industries/`; don't write coordinates, pixels, frame numbers, CSS
- Don't invent data or sources the user never gave you; every on-screen number must trace back to `meta.facts` — if there's no source, write "sample data, actual results vary"
- Don't show a third-party app's name, logo, or brand color (like a specific chat app's green bubble); refer to people as "them," "a coworker," "a customer"
- Don't use real names, phone numbers, or account handles
- Don't set the `bgm` field yourself (make.mjs fills it in automatically)
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
| Contains a platform name (warning) | Your own product's category term: add it to `meta.allowWords`; if it's traffic-diversion, remove it |
| Missing required field meta.action | Write one sentence: "what the user does → what the product gives back" |
| Number not found in meta.facts | If the brief gave this number, copy it verbatim into `meta.facts` (as `{"id":"f1","text":"…"}`); if not, replace the specific number with a qualitative statement |
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

- `<SKILL>/examples/jev.json`: consumer/emotional, software industry (chat demo with 2 caption lines → gauge → quick-cut list → end card; CTA "download the Android app from our site")
- `<SKILL>/examples/ledger.json`: productivity tool, software industry (pain-point quick-cut → compare → mockApp snapping a receipt for a result → counter → end card; brief gave no CTA, so the end card has none)
- `<SKILL>/examples/meeting.json`: B2B office tool, software industry (screenshot with callouts → simulated UI → counter → steps → end card; CTA "request a free trial on our site")
- `<SKILL>/examples/en-focus.json`: an `meta.lang: "en"` example (a fictional app) — the full example below
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
      "params": {"value": 8, "from": 3, "max": 10, "label": "Focus score", "style": "gauge", "higherIs": "good", "word": "Great", "note": "Based on this session"}
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
