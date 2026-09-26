# features selling-point cards

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "features", "dur": 4,
 "params": {"items": [{"icon": "doc", "title": "Auto summary", "desc": "Chats and docs in one"}, {"icon": "send", "title": "One-tap send", "desc": "Straight to your team"}]}}
```

2–4 cards pop in one at a time on the beat (icon + title + one benefit line); a yellow spotlight frame follows "the card being talked about right now." Cards not reached yet show as a dashed, numbered outline.

## When to use

- After the product's been introduced, to say "here's what else it does for you."
- One selling point per card, 2–4 cards.

## When not to use

- Describing an order of operations (do this, then that) → use steps.
- Listing 5+ things, or a pile of short phrases/quotes → use quickList.
- Only 1 selling point → act it out with counter / meter / mockApp instead.

## Params

| Field | Required | Notes |
|---|---|---|
| items | Yes | 2–4 cards, pop in in order |
| items[].icon | Yes | Icon name (pick from the icon list only) |
| items[].title | Yes | Selling-point title, **≤8 chars**, a noun phrase, e.g. "Auto summary" |
| items[].desc | No | One benefit line, **≤16 chars**, describe a result the user can feel |
| layout | No | `grid` (default: 2 side by side / 3 as one-wide-two-square / 4 as 2×2) or `stack` (vertical bars) |

Character counting: CJK characters count as 1, Latin letters/digits count as half. Going over gets blocked by validation.

## Duration

Roughly "card count × 1s + 1.5s": 2 cards 3s, 3 cards 4s, 4 cards 5–6s. Range 2.5–7s. The longer it runs, the longer each card lingers.

## Tips for writing it well

- `title` says "what it is," `desc` says "what it gets you": ✅ "Charts / completion rate turns into a chart automatically" ❌ "Powerful features / really easy to use."
- Use a different icon on every card.
- If `desc` tends to run long (13–16 chars), use `stack` — one line per item reads better.

## Example

```json
{"type": "features", "dur": 4, "caption": "It reads the tone,\n{and drafts a reply too}", "mood": 0.2,
 "params": {"items": [
   {"icon": "search", "title": "Auto summary", "desc": "Pulls this week's progress from your calendar and docs"},
   {"icon": "chart", "title": "Charts, automatically", "desc": "Completion rate turns into a chart"},
   {"icon": "doc", "title": "One-tap layout", "desc": "Drops into a template, no formatting needed"}
 ]}}
```
