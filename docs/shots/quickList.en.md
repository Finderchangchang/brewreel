# quickList quick-cut list

3–6 rows of white cards fly in one per beat, alternating left and right; as each one lands, a "stamp" appears on the right: a score rolling from 0 to its target (optionally with a verdict word), or a colored tag dropping in. A color bar on the left fills in by tone. Fast pace, strong feeling.

## When to use

- A rapid-fire string of pain points: one concrete scenario + verdict per row (panicked / time-wasting / redo). The caption should say what this set of scenarios has in common (e.g. "Reconciling books at month-end,\n{every step is a redo}"), not a catch-all line like "does this ever happen to you..." (validation will flag that).
- One judgment per line: a real quote + a score per row (see the Jev example: "whatever" 5/9, "worth a closer look"). If the caption mentions a count ("these 4 lines"), it has to match the number of rows.
- Listing scenarios: "it works in all of these places."

## When not to use

- Each item needs a full explanatory sentence → use features (it has `desc`).
- There's a clear order → use steps.

## Params

| Field | Required | Notes |
|---|---|---|
| items | Yes | 3–6 rows |
| items[].text | Yes | Row text, **≤10 chars**, a concrete scenario or a real quote — shorter hits harder |
| items[].tag | No | Verdict/tag, **≤4 chars**. Shown under the number when `score` is set; otherwise it's a standalone colored tag |
| items[].tone | No | Color: `bad` red / `warn` orange / `good` green / `neutral` gray; unset = brand color |
| items[].score | No | A score (0–999, up to 1 decimal), rolls up from 0 to this value |
| items[].icon | No | Leading icon (auto-picked from `tone` if unset); unused when `quote` is true |
| max | No | Max score (an integer 1–100). If set, the score renders as "8/9" |
| quote | No | `true` = each row renders as an avatar + gray speech bubble (for quoting what someone said); default = icon + bold text |
| title | No | A small title pill above the list, **≤8 chars**. Skip it if the caption already says it |

Character counting: CJK characters count as 1, Latin letters/digits count as half. Going over gets blocked by validation.

## Duration

3–4 rows: 3s. 5–6 rows: 4s. Range 2–6s. With many rows and little time, it automatically switches to half a beat per row.

## Tips for writing it well

- Pick one per row: either `score` (+ `tag` as a verdict) or just `tag` alone. Don't mix both styles in one list.
- Alternate good and bad tones (bad, good, bad, good...) for better rhythm.
- Don't fake scores as "user ratings" or "approval rate" claims to outsiders — use them for the product's own internal judgment (like a risk score).

## Example 1: quotes + scores

```json
{"type": "quickList", "dur": 3, "caption": "It reads these\n{before you have to}", "mood": 0.6,
 "params": {"quote": true, "max": 9, "items": [
   {"text": "whatever", "score": 5, "tag": "worth a look", "tone": "warn"},
   {"text": "I'm not mad", "score": 8, "tag": "high risk", "tone": "bad"},
   {"text": "do your thing", "score": 7, "tag": "risky", "tone": "bad"},
   {"text": "haha sure", "score": 2, "tag": "fine", "tone": "good"}
 ]}}
```

## Example 2: pain points + tags

```json
{"type": "quickList", "dur": 3, "caption": "Reconciling books at month-end,\n{every step is a redo}", "mood": 0.8,
 "params": {"items": [
   {"text": "Realize it Friday afternoon", "tag": "panic", "tone": "bad", "icon": "clock"},
   {"text": "Dig through chat for updates", "tag": "slow", "tone": "warn", "icon": "search"},
   {"text": "Finish it, told it's too vague", "tag": "redo", "tone": "bad", "icon": "doc"},
   {"text": "Format's different every time", "tag": "tiring", "tone": "warn", "icon": "chart"}
 ]}}
```
