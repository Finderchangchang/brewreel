# endCard end card

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "endCard", "dur": 4,
 "params": {"brand": "ReportPal", "slogan": "Friday afternoon,\n{report done}"}}
```
`brand` must match meta.product exactly.

logo (`meta.logo`, or an icon disc if unset) → product name → a two-line headline → 1–3 selling points → an optional call to action. This is always the last shot and never exits off-screen. The whole group is centred around y≈880 (its bottom never goes past y 1320), and the logo grows when there is little content.

## Three layouts
| layout | What it looks like |
|---|---|
| `stack` | One centred column: logo → product-name pill → big headline → selling-point pills → call to action |
| `panel` | The headline sits on top like a title; below it one white card that grows with its content: logo + product name on one row, one ticked row per selling point, a full-width call-to-action button |
| `spotlight` | A brand icon, prominent product name, secondary slogan, selling-point chips arranged into explicit rows, and a call to action |

**Leave `layout` out and one is picked from the product name**: the same product always gets the same layout, and different products usually get different ones, so a batch of films doesn't end on identical cards. `panel` is never picked when there are no selling points.

## Params

| Field | Required | Notes |
|---|---|---|
| brand | Yes | Product name (≤10 chars) |
| slogan | Yes | Headline, ≤2 lines, ≤9 chars per line, may use `\n` and one `{}` span — it's best if the whole second line is the `{}` |
| points | No | Up to 3 selling points/promises/use cases, ≤14 chars each. A point that says the same thing as `meta.disclaimer` or a `meta.notices` entry is dropped automatically (no repeated notice) |
| cta | No | How to get it (≤12 chars): must match `meta.cta` exactly (the brief's "how to get it" text, verbatim); leave it out if the brief doesn't give one. No URLs, QR codes, or account handles |
| icon | No | Brand icon shown when there's no logo, defaults to `sparkle` |
| layout | No | `stack` / `panel` / `spotlight`; picked automatically when left out |

**This shot never has a `caption`.** `mood` should be 0 (a cool-toned close). Duration 3–5s.

## Good examples

```json
{"type": "endCard", "dur": 4, "mood": 0,
 "params": {"brand": "FocusPilot", "slogan": "Less scrolling,\n{more finishing}",
            "points": ["Blocks distracting apps", "One tap to start"], "cta": "Try it free", "icon": "clock"}}
```
```json
{"type": "endCard", "dur": 4, "mood": 0,
 "params": {"brand": "MeetNotes", "slogan": "Meeting's done,\n{notes are too}", "layout": "panel",
            "points": ["Notes from the recording", "To-dos assigned"], "cta": "Free trial on our site", "icon": "doc"}}
```

## Bad example
- A selling point that reads "Demo data, may differ": the disclaimer at the top already says that, so it would appear twice.
