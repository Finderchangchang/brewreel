# hook — opening hook

**Must be shot 1.** Frame 0 is the cover: big title (caption) + product highlight badge (badge) + one hero visual, all in place from the very first frame, no blank frame.

## When to use
Every video opens with it, exactly once. 2–3 seconds.

## Params
| Field | Required | Notes |
|---|---|---|
| caption (shot-level field) | Yes | The cover headline: the viewer's pain point or a counter-intuitive question. ≤2 lines, ≤12 characters per line, wrap the sharpest 2–5 characters in `{}` |
| visual | Yes | Pick by content first: `bubble` a raw message + warning card / `stat` a big number in a ring / `icon` a big icon with orbiting small icons / `phone` a real screenshot on a phone. Then pick a composition: `split` a left/right split of "pain point vs. product" / `statBar` a big number over a full-width bar |
| text | Depends on visual | bubble: the message (≤14 chars); stat/statBar: the number or short phrase (≤6 chars reads best); icon: one line under the icon; phone: a sticky-note label; split: the right (product) side phrase (≤10 chars reads best) |
| sub | No | bubble: the warning card's title (e.g. "Red flag"); stat/statBar: a caption under the number (≤8 chars); split: one closing line at the bottom |
| icon | Required for `icon` | Icon name (see the icon list); split: the right-side icon, defaults to `check` |
| leftText | For `split` | The left (pain point) side phrase (≤10 chars), e.g. "Doing it by hand" |
| level | For `statBar` | Bar fill ratio, 0–10, defaults to 8 |
| badge | Recommended | A one-line product pitch (≤10 chars), e.g. "AI checks it first"; shows the logo on the left when `meta.logo` is set |
| src | Required for `phone` | Path to the portrait screenshot |
| tone | No | Warning color: `bad` red (default) / `warn` orange / `good` green / `accent` brand color; on `split` it recolors the right side |
| deco | No | Two floating side icons; `split` uses the first one for the left-side icon |

## Don't reuse the same visual every time
If every video in a batch uses `bubble`, or every one uses `stat`, the frame-0 covers all start to look like the same template with a new skin. For data/efficiency pitches, alternate between `stat` (a ring) and `statBar` (a full-width bar); for "before vs. now" pitches, try `split`.

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
{"type": "hook", "dur": 2.5, "caption": "Still doing reports {by hand}?", "mood": 0.7,
 "params": {"visual": "split", "leftText": "By hand", "text": "Auto-generated", "badge": "AI writes it in 3 min"}}
```
```json
{"type": "hook", "dur": 2.5, "caption": "The hassle just {dropped 80%}", "mood": 0.6,
 "params": {"visual": "statBar", "text": "-80%", "sub": "time spent on reports", "level": 9, "badge": "AI writes it in 3 min"}}
```

## Bad examples
- caption is just the product name ("XX Assistant is here"): no hook.
- `visual: "phone"` but the screenshot is just the home screen, no tension to it.
- Every video in a batch uses the same `visual`: all the frame-0 covers look identical, no differentiation.
