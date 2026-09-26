# storeCard Store, location & directions

**Minimal valid params** (copy, change the text, and it passes validation):
```json
{"type": "storeCard", "dur": 3, "params": {"layout": "card", "name": "<store name>", "landmark": "<subway exit / mall floor / town>", "hours": "11:00–22:00"}}
```

Explains where the store is, its hours, how to get there, and what to tap inside the platform. **There are no phone, WeChat, QR code, website, or street-address fields** — that kind of contact info was never meant to be on screen. Three layouts:
- `photo`: a real storefront photo banner plus an info card. Without a photo the banner becomes an illustrated scene tagged "Illustration", never passed off as a real photo.
- `map`: a code-drawn abstract map (city blocks + roads + a location pin). Each route is a dashed line from its destination to the store, and each destination gets a two-line label: the place name / "Drive 25 min". landmark, hours, parking, pickup, badges, cta and disclaimer go in an info strip under the map. It does not imitate any map app's UI.
- `card`: a plain typographic info card, works without any photo — the most general-purpose option. The card is as tall as its content; when there is little content an illustrated banner (storefront, guesthouse… by industry) is added above it, so there is no big blank area.

**Every field you fill is shown; nothing is dropped silently.** A route's `to` appears as "HSR station · Drive 25 min" on the card layout and as a destination label on the map, so write a real place name (copied from the facts), not "here" or "nearby".

When `disclaimer` matches one of `meta.notices` (ignoring spaces and punctuation), only the bottom notice pill is shown, not both.

**English videos:** `routes[].mode` and `basis` must still use the Chinese enum values (步行/驾车/打车/公交/地铁/骑行/接驳车, 导航估算/实测). With `meta.lang: "en"` the screen shows Walk/Drive/Taxi/Bus/Metro/Bike/Shuttle, "min", "Parking:", "Pickup:" and the estimate note in English.

## When to use
- A shot that needs to explain the route, hours, and in-platform action prompt — typically right before the end card in group-buy / visit-the-store content.

## When not to use
- You want to put a phone number, WeChat ID, or QR code to drive people off-platform: this shot's schema has no such fields on purpose. Use `cta` for the platform's own in-app prompt instead.
- You just want a one-line "welcome" at the end: use `endCard` instead of a separate storeCard shot.

## Parameters
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | No | — | `photo` / `map` / `card` (default) |
| name | Yes | 10 chars | store name |
| landmark | No | 14 chars | subway exit / mall floor / town name — no street address |
| hours | No | 14 chars | opening hours |
| photo | No | — | storefront photo path, used with `layout: "photo"`, must be a real merchant shot |
| routes | No | 0–4 items | {to, mode, minutes, km}; `to` is the destination and is shown on screen; mode is a Chinese enum value (see above) |
| basis | No | — | 导航估算 navigation estimate (default, adds a small note automatically) / 实测 measured |
| parking | No | 10 chars | parking info |
| pickup | No | 12 chars | shuttle info; state the fee if it's not free |
| badges | No | ≤4 items, 8 chars each | e.g. "sanitized between guests", "by appointment" |
| cta | No | 10 chars | in-platform action prompt, preset per publishing platform |
| disclaimer | No | 16 chars | small disclaimer text; hidden when it duplicates a notice |

## Duration
2.5–4s; give the map layout 3.5–4s when it has 3 or more routes.

## Good examples
```json
{"type": "storeCard", "dur": 3.5, "caption": "Off the train,\n{30 min by car}", "mood": 0.2,
 "params": {"layout": "map", "name": "Bamboo Tea House", "landmark": "North end of Riverside St",
  "routes": [{"to": "East HSR station", "mode": "驾车", "minutes": 30}, {"to": "Riverside Park", "mode": "步行", "minutes": 6}],
  "parking": "6 free spots"}}
```
```json
{"params": {"layout": "card", "name": "Corner Soup House", "landmark": "Line 5, Nanhu Exit C", "hours": "09:30–21:00",
  "routes": [{"to": "Nanhu station", "mode": "步行", "minutes": 3}]}}
```

## Bad examples
- Slipping "add my WeChat" or "scan to join the group" into any field: this shot doesn't do off-platform traffic — it will be blocked.
- `"mode": "walk"`: not in the enum, validation fails. Write `"步行"`; an English video shows "Walk".
- `layout: "photo"` with a `photo` asset tagged `source: "ai"` or not a real merchant shot: a storefront photo must be the merchant's own.
- `landmark` written as a full street address: rewrite as a subway exit / mall floor / town name instead.
