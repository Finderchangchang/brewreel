# steps 1-2-3 flow

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "steps", "dur": 4,
 "params": {"items": [{"title": "Connect"}, {"title": "Tap Generate"}, {"title": "Edit and send"}]}}
```

One flow card: nodes stacked vertically on the left, a light dot runs down the connecting line step by step, each node lighting up and its text sliding in as the dot reaches it; once all steps are done, every node gets a ✓ (with a ding). Communicates "this is easy to get started with."

## When to use

- After the selling points, right before the end card, to explain "how to use it" / "it only takes a few steps."
- 2–4 steps that have a clear order.

## When not to use

- A few selling points with no real order between them → use features.
- More than 4 steps → merge them down to 3 rather than forcing them all in.

## Params

| Field | Required | Notes |
|---|---|---|
| items | Yes | 2–4 steps, light up in order |
| items[].title | Yes | Step title, **≤8 chars**, starts with a verb, e.g. "Open chat," "Tap the button" |
| items[].desc | No | One extra line, **≤14 chars**, describes this step's result, e.g. "Draft's ready in a minute" |
| items[].icon | No | Icon name (from the icon list). If set, the node shows the icon with the step number as a small badge; otherwise it shows a large step number |

Character counting: CJK characters count as 1, Latin letters/digits count as half. Going over gets blocked by validation.

## Duration

Roughly "step count × 1s + 1.5s": 3 steps 4s, 4 steps 5s. Range 2.5–7s.

## Tips for writing it well

- Titles should be actions: ✅ "Tap 'Generate'" "Tweak two lines and send" ❌ "Generation feature" "Smart module."
- Make the last step "get the result," so the ✓ lands on the payoff.
- **Don't write "step one" / "step 1" in the title** — the step number is drawn automatically, and words like "first" also get blocked by the ad-law checks.
- 3 steps looks best.

## Example

```json
{"type": "steps", "dur": 4, "caption": "Friday afternoon,\n{the report writes itself}", "mood": 0,
 "params": {"items": [
   {"title": "Connect your calendar", "desc": "One-time authorization", "icon": "calendar"},
   {"title": "Tap 'Generate'", "desc": "Draft's ready in a minute", "icon": "sparkle"},
   {"title": "Tweak and send", "desc": "You just do the final check", "icon": "send"}
 ]}}
```
