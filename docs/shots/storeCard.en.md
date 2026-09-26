# storeCard Store, location & directions

Explains where the store is, its hours, how to get there, and what to tap inside the platform. **There are no phone, WeChat, QR code, website, or street-address fields** — that kind of contact info was never meant to be on screen. Three layouts:
- `photo`: a real storefront photo banner plus an info card. Use when you have a storefront photo.
- `map`: a code-drawn abstract diagram (a few street lines + a location pin + a transit dot), not imitating any map app's UI. Use when there's no storefront photo, or to emphasize directions.
- `card`: a plain typographic info card, works without any photo — the most general-purpose option.

## When to use
- A shot that needs to explain the route, hours, and in-platform action prompt — typically right before the end card in group-buy / visit-the-store content.

## When not to use
- You want to put a phone number, WeChat ID, or QR code to drive people off-platform: this shot's schema has no such fields on purpose. Use `cta` for the platform's own in-app prompt instead (e.g. "tap the video's location pin to see the deal").
- You just want a one-line "welcome" at the end: use `endCard` instead of a separate storeCard shot.

## Parameters
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | No | — | `photo` / `map` / `card` (default) |
| name | Yes | 10 chars | store name |
| landmark | No | 14 chars | subway exit / mall floor / town name — no street address |
| hours | No | 14 chars | opening hours |
| photo | No | — | storefront photo path, used with `layout: "photo"`, must be a real merchant shot |
| routes | No | 0–4 items | {to, mode, minutes, km}; mode is one of walk/drive/taxi/bus/subway/bike/shuttle |
| basis | No | — | navigation estimate (default, adds a small disclaimer automatically) / measured |
| parking | No | 10 chars | parking info |
| pickup | No | 12 chars | shuttle info; state the fee if it's not free |
| badges | No | ≤4 items, 8 chars each | e.g. "sanitized between guests", "by appointment" |
| cta | No | 10 chars | in-platform action prompt, preset per publishing platform |
| disclaimer | No | 16 chars | small disclaimer text; beauty-category default is "cosmetic services only — no medical aesthetics" |

## Duration
2.5–4s.

## Good examples
```json
{"type": "storeCard", "dur": 3, "caption": "3 minutes' walk\n{from Exit B}", "mood": 0.2,
 "params": {"layout": "photo", "name": "Corner Noodle House",
   "landmark": "Line 2, Guiyuan Station Exit B", "hours": "10:00-21:30",
   "photo": "photos/storefront.jpg",
   "routes": [{"to": "the station", "mode": "walk", "minutes": 3}],
   "cta": "Tap the pin to see the deal"}}
```
```json
{"params": {"layout": "map", "name": "Corner Noodle House",
  "routes": [{"to": "the station", "mode": "subway", "minutes": 8}, {"to": "the office", "mode": "taxi", "minutes": 12}]}}
```

## Bad examples
- Slipping "add my WeChat" or "scan to join the group" into any field: this shot doesn't do off-platform traffic — it will be blocked.
- `layout: "photo"` with a `photo` asset tagged `source: "ai"` or not a real merchant shot: a storefront photo must be the merchant's own.
- `landmark` written as a full street address (e.g. "88 XX Road, 3rd Floor"): rewrite as a subway exit / mall floor / town name instead — nothing address-precise.
