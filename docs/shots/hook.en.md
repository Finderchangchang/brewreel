# hook — opening hook

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "hook", "dur": 2.5, "caption": "Friday night,\n{report still blank}",
 "params": {"visual": "icon", "icon": "doc", "text": "Friday again", "badge": "Draft it in one tap"}}
```

**Must be shot 1.** Frame 0 is the cover: big title (caption) + product highlight badge (badge) + one hero visual, all in place from the very first frame, no blank frame.

## When to use
Every video opens with it, exactly once. 2–3 seconds.

## Params
| Field | Required | Notes |
|---|---|---|
| caption (shot-level field) | Yes | The cover headline: the viewer's pain point or a counter-intuitive question. ≤2 lines, ≤12 characters per line, wrap the sharpest 2–5 characters in `{}` |
| visual | Yes | Pick by content first: `bubble` a raw message + warning card / `stat` a big number in a ring (text must contain a number) / `icon` one big icon / `illust` an industry illustration / `phone` a real screenshot on a phone. Then pick a composition: `split` a left/right split of "pain point vs. product" / `statBar` a big number over a full-width bar |
| text | Depends on visual | bubble: the message (≤14 chars); stat/statBar: a short phrase with a number (≤6 chars reads best; it auto-shrinks and breaks into two lines at → or a space if needed); icon/illust: one line under the visual; phone: a sticky-note label; split: the right (product) side phrase (≤10 chars reads best) |
| sub | No | bubble: the warning card's title (e.g. "Red flag"); stat/statBar: a caption under the number (≤8 chars); split: one closing line at the bottom |
| icon | Required for `icon` | Icon name (see the icon list); split: the right-side icon, defaults to `check` |
| illust | Required for `illust` | Industry illustration id (`template/src/illust/names.json`), e.g. `travel/window` |
| orbit | No | `icon` only: 3–6 small icons orbiting the main icon, picked for your product. **Leave it out and there is no orbit**: the main icon gets bigger and pulses on the beat |
| pct | No | stat/statBar: the value as a share, 0–100; sets the ring's arc / the bar's length. Falls back to a percentage in `text` ("87%"); **with neither, no arc is drawn and the bar stays empty** |
| leftText | For `split` | The left (pain point) side phrase (≤10 chars), e.g. "Doing it by hand" |
| level | For `statBar` | Bar fill, 0–10; prints "x/10", so it needs a basis. Falls back to `pct` |
| badge | Recommended | A one-line product pitch (≤10 chars), e.g. "AI checks it first"; shows the logo on the left when `meta.logo` is set |
| src | Required for `phone` | Path to the portrait screenshot |
| tone | No | Warning color: `bad` red (default) / `warn` orange / `good` green / `accent` brand color; on `split` it recolors the right side |
| deco | No | Floating side icons. **Leave it out and none are drawn** (there are no theme defaults any more); `split` uses the first one for the left-side icon |

## Rings and bars only show numbers that mean something
- The `stat` arc length is `pct` (or a percentage in `text`). If "6 h" is meant as "a quarter of the day", write `"pct": 25`. Without a share, leave it out: the ring is drawn with no arc.
- If `text` has no number ("Bamboo outside the window", "Split by hand"), don't use `stat`: use `illust` for a place or an object, `icon` for a feature. A `stat` with no number falls back to a big-word card with no ring.
- Same for `statBar`: with no `level`, `pct` or percentage, only the empty track is drawn, no "8/10".

## Don't reuse the same visual, and don't lean on default decoration
If every video in a batch uses `bubble`, or every one uses `stat`, the frame-0 covers all start to look like the same template with a new skin. For data/efficiency pitches, alternate between `stat` (a ring) and `statBar` (a full-width bar); for "before vs. now" pitches, try `split`; for an industry film about one object or place, use `illust`. Orbiting and floating icons are only drawn when you list them (`orbit` / `deco`); the old defaults that had nothing to do with the product are gone.

## Good examples
```json
{"type": "hook", "dur": 2.5, "caption": "They said {\"you don't get me\"}.\nWhat do you say back?", "mood": 0.85,
 "params": {"visual": "bubble", "text": "You just don't get me at all", "sub": "Red flag", "badge": "AI checks it first"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "Writing the weekly report takes {an hour}?", "mood": 0.8,
 "params": {"visual": "stat", "text": "60 min", "sub": "spent on reports every week", "badge": "AI writes it in 3 min"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "Open the window:\n{a whole mountain}", "mood": 0.3,
 "params": {"visual": "illust", "illust": "travel/window", "text": "Breakfast for two included", "tone": "good", "badge": "A night in the hills"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "Still doing reports {by hand}?", "mood": 0.7,
 "params": {"visual": "split", "leftText": "By hand", "text": "Auto-generated", "badge": "AI writes it in 3 min"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "The meeting's over.\n{Who writes the notes?}", "mood": 0.7,
 "params": {"visual": "icon", "icon": "doc", "orbit": ["clock", "users", "check"], "text": "Meeting's over. Now what?", "badge": "Notes from the recording"}}
```

## Bad examples
- caption is just the product name ("XX Assistant is here"): no hook.
- `visual: "phone"` but the screenshot is just the home screen, no tension to it.
- `visual: "stat"` with a phrase that has no number ("Split by hand"): nothing to count, and the ring means nothing.
- Every video in a batch uses the same `visual`: all the frame-0 covers look identical, no differentiation.
