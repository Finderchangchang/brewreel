# compare

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "compare", "dur": 4, "caption": "Same report,\n{different effort}",
 "params": {"left": {"title": "By hand", "items": ["Search chats", "Copy, paste"]}, "right": {"title": "With it", "items": ["Auto summary", "Tweak and send"]}}}
```
Compare the process only, with no stat numbers or level. Add stat/level only when the brief gives the numbers, and point `refs` at that fact.

Two ways to play it:
- `lr` (default): two side-by-side cards. The left card (the pain point) reveals its items one by one → a center divider draws down and "VS" pops in → the right card (using the product) reveals its items → the right card "wins": a glowing outline + badge (a warning icon if `right.tone` is `bad`, otherwise a checkmark), the left card dims → a closing verdict pill at the bottom.
- `beforeAfter`: one wide card plays "before" first, then a handle wipes from right to left to reveal "after", and finally the verdict pill.

Same batch of videos, don't always use `lr` (it's the one that's easiest to default into): when the story is a "before/after makeover", try `beforeAfter` first, and alternate between the two so the videos don't all look like the same template with a new skin.

Each side can carry one big number `stat` (e.g. "1 hour" → "3 min") and a 0–10 scale bar `level` (both sides share the same scale; `meterLabel` says what the scale measures). Before content appears, a skeleton placeholder fills the space so the card is never empty.

## When to use
- "Without the product vs. with the product," "before vs. now," "before the makeover vs. after."
- You have a concrete difference to point to: how long it took, how many steps, what the result was. The two sides' `items` should line up one-to-one (the same thing, before and after).

## When not to use
- Only one side has real content (you just want to praise the product): use `features` instead.
- You only want to show one number changing: use `counter` (`showFrom: true`).
- Don't put a real competitor's brand on the left side — write something neutral like "manual" or "before."

## Params
| Field | Required | Limit | Notes |
|---|---|---|---|
| mode | No | — | `lr` side-by-side (default) / `beforeAfter` wipe reveal |
| left.title | Yes | 6 chars | Left / "before" side title, e.g. "By hand," "Before" |
| left.items | Yes | 1–3 items, ≤10 chars each | Concrete steps or results |
| left.tone | No | — | `bad` (default) / `good` / `neutral` |
| left.icon | No | icon name | Icon before the title, defaults to `clock` |
| left.stat | No | 6 chars | This side's headline number, e.g. "1 hour," "5 steps" |
| left.level | No | 0–10 | Value on the scale bar |
| right.* | Same as above | Same as above | Right / "after" side; `tone` defaults to `good`, `icon` defaults to `bolt` |
| meterLabel | No | 6 chars | What the scale measures, e.g. "Effort"; only shows when `level` is set |
| verdict | No | 12 chars | The closing line at the bottom, e.g. "Time saved goes back to you" |

## Duration
2.5–7s, defaults to 4s. Three items per side + stat + verdict: give `lr` 4–4.5s, `beforeAfter` 4s. Too short speeds everything up.

## Good examples
```json
{"type": "compare", "dur": 4.5, "caption": "The same weekly report,\n{an hour apart}", "mood": 0.5,
 "params": {"mode": "lr",
   "left": {"title": "By hand", "items": ["Scroll chat history", "Copy & paste", "Reformat"], "stat": "1 hour", "level": 8},
   "right": {"title": "With the app", "items": ["Auto summary", "One click", "Send it"], "stat": "3 min", "level": 2},
   "meterLabel": "Effort", "verdict": "Time saved goes back to you"}}
```
```json
{"type": "compare", "dur": 4, "caption": "What the boss sees:\n{the point, instantly}", "mood": 0.3,
 "params": {"mode": "beforeAfter",
   "left": {"title": "Old report", "items": ["One long wall of text", "Key points buried", "Numbers not calculated"], "stat": "12 paragraphs"},
   "right": {"title": "New report", "items": ["Top 3 points pinned", "Progress auto-colored", "Numbers attached"], "stat": "3 points"},
   "verdict": "Easier to write, easier to read"}}
```

## Bad examples
- `"items": ["A whole long sentence written out in full"]` → over the 10-char limit, gets blocked.
- The two sides talk about different things (left about price, right about looks) → there's no comparison.
- Only one side gets a `stat` / `level`, the other is left blank → the comparison doesn't hold up.
