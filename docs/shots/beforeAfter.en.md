# beforeAfter Before/after wipe slider

**Minimal valid JSON** (copy it, change the text, and it passes validation):
```json
{"type": "beforeAfter", "dur": 3,
 "params": {"before": {"src": "photos/before.png"}, "after": {"src": "photos/after.png"}, "consent": true, "retouched": false, "subVertical": "hair"}}
```
Beauty only. Both photos must be real merchant photos of the same customer, listed in meta.assets: `[{"src": "photos/before.png", "source": "merchant", "kind": "customer-before", "pair": "A"}, {"src": "photos/after.png", "source": "merchant", "kind": "customer-after", "pair": "A"}]`. No photos → use steps.

A real before-and-after comparison of the same customer: a vertical handle wipes from right to left to reveal "after". Only enabled for the beauty industry (hair / nails / lashes).

## When to use it
- When you have two real photos of the same customer, shot from the same angle, with written consent and no retouching.

## When not to use it
- Missing photos, no consent, retouched images, or AI-generated media: never use this shot — use `steps` to walk through the process instead.
- `subVertical` doesn't support anything skincare/medical-aesthetics related (the `skincare` value is rejected) — don't use this shot for that.

## Params
| Field | Required | Limit | Notes |
|---|---|---|---|
| before.src | Yes | asset png/jpg/jpeg/webp | the "before" photo |
| before.label | No | 4 chars | defaults to "Before" |
| after.src | Yes | asset png/jpg/jpeg/webp | the "after" photo |
| after.label | No | 4 chars | defaults to "After" |
| consent | Yes | must be true | customer gave written consent |
| retouched | Yes | must be false | photos are unretouched |
| sameAngle | No | true/false | recommended true: shot from the same angle |
| subVertical | Yes | — | hair / nail / lash |
| caption2 | No | 12 chars | one line of context inside the card, separate from the shot's `caption` |

The shot always shows a fixed "Client-authorized, unretouched photos" badge and a fixed "Results vary by person, for reference only" line — these are hard-coded in the component and must not (and cannot) be set through params.

## Duration
2–4s, default 3s. 3.5–4s gives both sides a more comfortable hold; 2s is the compressed minimum, where the wipe happens faster.

## Good examples
```json
{"type": "beforeAfter", "dur": 3.5, "mood": 0.15,
 "params": {"before": {"src": "photos/hair-before.jpg"}, "after": {"src": "photos/hair-after.jpg"},
   "consent": true, "retouched": false, "sameAngle": true, "subVertical": "hair"}}
```
```json
{"type": "beforeAfter", "dur": 3, "mood": 0.15,
 "params": {"before": {"src": "photos/nail-before.jpg", "label": "Before"}, "after": {"src": "photos/nail-after.jpg", "label": "After"},
   "consent": true, "retouched": false, "subVertical": "nail", "caption2": "Confirmed on-site by the client"}}
```

## Bad examples
- `retouched` set to true, or `consent` left out entirely — blocked outright.
- `subVertical` set to a skincare/medical-aesthetics value — outside what this shot supports.
- Faking an illustrated "example" when there are no real before/after photos — this shot must be skipped entirely when photos are missing, never substituted with artwork.
