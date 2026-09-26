# photoShot Real photo / short video

The workhorse shot for non-software industries: a real merchant photo or short video fills the frame as the hero, with a dish/product name, one selling line, and a price tag overlaid. Five layouts (`layout`):
- `hero`: one photo with a slow push-in, a bottom gradient caption bar for title/tagline/price. Good for a signature dish, a hero product, a room's main shot.
- `clip`: same as hero but the media is a short video clip (with a play badge). Good for process shots, walking through a space.
- `grid`: 2–4 photos tiled in with a staggered entrance, each with a short label. Good for multi-angle environment shots, several dishes shown together.
- `callouts`: one photo with 1–3 leader-line callouts. Good for pointing out details in a single image (ingredients, craft, parts).
- `tour`: 2–5 photos shown one at a time with page dots. Good for walking through a few angles of one room/space.

When there is no real asset, set that item's `source` to `"drawn"`. Skip `src` and give `illust` instead (an illustration name from `template/src/illust/names.json`, picked by industry, e.g. `"food/bowl"`). Leaving `illust` out is fine too — it falls back to a default illustration based on `meta.industry`. **The illustration fallback is not a free pass**: a clean real photo always beats an illustration — use one whenever you have it.

## When to use
- The merchant has real photos/video and you want them to be the visual lead of the shot (not stuffed into a phone frame as a screenshot).
- You need to convey "what this is" and "how much / what tag" in the same shot.

## When not to use
- The asset is an app UI / a demo of an interaction: use `phone` (a real screenshot) or `mockApp` (a simulated UI when there is no screenshot) instead of forcing photoShot.
- One image can't carry the amount of information the shot needs: fold it into `features` or `quickList` instead, where an illustration icon is enough.
- `grid` with missing photos padded out with a plain text list pretending to be an environment shot: skip the shot instead, or use a shot that actually has images.

## Parameters
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | No | — | `hero` / `clip` / `grid` / `callouts` / `tour`, defaults to hero |
| media | Yes | 1–5 items | hero/clip/callouts: 1 item; grid: 2–4; tour: 2–5 |
| media[].src | Conditional | — | asset path; omit when `source: "drawn"` and give `illust` instead |
| media[].source | Yes | — | `merchant` real shot / `ai` AI-generated / `drawn` illustration fallback |
| media[].tag | Yes | — | `实拍`(real) / `示意`(illustrative) / `效果图`(rendering); must be `效果图` when `source` is `"ai"` |
| media[].illust | No | — | pick one when `source: "drawn"` (see names.json) |
| media[].label | No | 8 chars | short label under each photo in grid/tour |
| media[].month | No | 1–12 | fill in for season/weather-dependent shots; renders as "shot in month N" |
| title | No | 10 chars | dish / product / room-type name |
| tagline | No | 12 chars | one selling line |
| badge | No | 4 chars | e.g. "signature", "new" |
| price / unit | No | — | small price tag in the corner; price is a number, unit ≤4 chars |
| roomType | No | 10 chars | travel/hospitality only — one room type per shot |
| callouts | Required when layout=callouts | 2–4 items, text ≤8 chars | leader-line callout text |
| refs | No | — | ids into meta.facts, backing up claims like "simmered daily" or "10 years in business" |

## Duration
hero 1.5–3s; clip 2–4s; grid 2.5–4s; tour 1.2–3s per photo (total scales with photo count); callouts follows hero's range (default 2.5s, give 3.5–4s with more callouts).

## Good examples
```json
{"type": "photoShot", "dur": 2.5, "caption": "Beef shank braised daily,\n{bone broth simmered 4 hours}", "mood": 0.3,
 "params": {"layout": "hero",
   "media": [{"src": "photos/beef_noodle.jpg", "source": "merchant", "tag": "实拍"}],
   "title": "Braised Beef Noodles", "tagline": "House-braised shank", "badge": "Signature", "price": 22, "unit": "bowl",
   "refs": ["f2"]}}
```
```json
{"type": "photoShot", "dur": 3, "mood": 0.25,
 "params": {"layout": "grid",
   "media": [
     {"src": "photos/hall.jpg", "source": "merchant", "tag": "实拍", "label": "Dining hall"},
     {"src": "photos/room.jpg", "source": "merchant", "tag": "实拍", "label": "Private room"}
   ]}}
```
Fallback with no real photo:
```json
{"params": {"layout": "hero",
  "media": [{"source": "drawn", "illust": "food/bowl"}],
  "title": "Signature Beef Noodles", "price": 22, "unit": "bowl"}}
```

## Bad examples
- `media[0].source: "merchant"` with no `src`: validation treats this as a missing asset path.
- `source: "ai"` but `tag` set to "实拍" (real shot): AI-generated media must be tagged "效果图" (rendering), never passed off as real.
- `layout: "grid"` with only 1 item: grid needs at least 2; use `hero` for a single item.
- Setting this shot's `title` to something other than `meta.product`: photoShot describes a specific dish/product/room, not the whole product.
