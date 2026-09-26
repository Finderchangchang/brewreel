# endCard end card

logo (`meta.logo`, or an icon disc if unset) → product name → a two-line headline → 1–3 selling-point pills → an optional call to action. This is always the last shot and never exits off-screen.

## Params

| Field | Required | Notes |
|---|---|---|
| brand | Yes | Product name (≤10 chars) |
| slogan | Yes | Headline, ≤2 lines, ≤9 chars per line, may use `\n` and one `{}` span — it's best if the whole second line is the `{}` |
| points | No | Up to 3 selling points/promises/use cases, ≤14 chars each |
| cta | No | How to get it (≤12 chars): must match `meta.cta` exactly (the brief's "how to get it" text, verbatim); leave it out if the brief doesn't give one. No URLs, QR codes, or account handles |
| icon | No | Brand icon shown when there's no logo, defaults to `sparkle` |

**This shot never has a `caption`.** `mood` should be 0 (a cool-toned close). Duration 3–5s.

## Good example

```json
{"type": "endCard", "dur": 4, "mood": 0,
 "params": {"brand": "FocusPilot", "slogan": "Less scrolling,\n{more finishing}",
            "points": ["Blocks distracting apps", "One tap to start"], "cta": "Try it free", "icon": "clock"}}
```
