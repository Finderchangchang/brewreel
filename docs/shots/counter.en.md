# counter rolling number

One card: an icon → a big number rolls from `from` to `to` (a ticking sound, a progress bar moving underneath) → on the beat it lands the number bumps, rays flash out, a ding plays → below it, `label` explains what the number means and `sub` gives its basis.
Set `showFrom: true` and the old value shows above the number first, gets struck through right before it lands, and a change-amount pill is calculated automatically (e.g. "↓ 87%," "↑ 3x").

## When to use

- The product's effect has one hard number behind it: time saved, money saved, a multiplier improvement, people served.
- A before/after comparison that's really just one number: old time → new time (`from` = old value, `to` = new value, `showFrom: true`) — both numbers must come from the brief. Don't mention that duration anywhere else in the video with a different figure (if counter says 3 minutes, nothing else can say "instant" or "3 seconds").

## When not to use

- The number has no source or no clear basis: don't use it. If the brief gives you a number and a source, copy it into `meta.facts` verbatim first, then use it here; if it's purely illustrative, write "sample data, actual results vary" in `sub`. Don't invent your own source like "internal testing" (validation blocks this).
- Comparing several things at once: use compare.
- Scoring something out of a max (like a 1–10 score): use meter.

## Params

| Field | Required | Limit | Notes |
|---|---|---|---|
| to | Yes | number | The number it lands on |
| label | Yes | 12 chars | What the number means, e.g. "Per weekly report," "Saved per person per year" |
| from | No | number | Starting value, defaults to 0; the old value for a before/after |
| showFrom | No | true/false | true = strike through the old value + show the change pill (requires `from` too) |
| decimals | No | 0–2 | Decimal places, defaults to 0 |
| prefix | No | 2 chars | Symbol before the number, e.g. "$," "+" |
| suffix | No | 3 chars | Unit, e.g. "%," "x," "min" |
| sub | No | 16 chars | Small-print basis/source: only write a source the brief actually gave you; if none, write "sample data, actual results vary" |
| icon | No | icon name | Icon above the number, defaults to `trend` |
| tone | No | — | Number color: `accent` theme color (default) / `good` green / `bad` red |

## Duration

2–5s, defaults to 3s. The number lands around 1.5s in, leaving time to read `label` afterward.

## Good examples

```json
{"type": "counter", "dur": 3, "caption": "No more late-night reports,\n{done in minutes}", "mood": 0.2,
 "params": {"from": 45, "to": 6, "suffix": "min", "showFrom": true, "label": "Per weekly report", "sub": "sample data, actual results vary", "icon": "clock", "tone": "good"}}
```

```json
{"type": "counter", "dur": 3, "caption": "Repeat orders\n{more than doubled}", "mood": 0.2,
 "params": {"to": 12800, "prefix": "$", "label": "Monthly repeat revenue", "sub": "sample data, actual results vary", "icon": "money"}}
```

## Bad examples

- `"to": 100, "suffix": "%", "label": "users satisfied"` → "100%" is an absolute claim, and it has no basis either.
- `"showFrom": true` with no `from` → there's no old value to strike through, so that line just doesn't show — a wasted field.
- `"label": "the amount of time you save every month after using our product"` → over 12 chars, gets blocked.
