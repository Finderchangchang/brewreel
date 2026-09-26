# photoShot Real photo / short video

**Minimal valid params** (one with a real photo, one without; copy, change the text, and it passes validation):
```json
{"type": "photoShot", "dur": 2.5, "params": {"layout": "hero",
  "media": [{"src": "photos/<real photo listed in the brief>.jpg", "source": "merchant", "tag": "实拍"}], "title": "<dish / product name>"}}
```
```json
{"type": "photoShot", "dur": 2.5, "params": {"layout": "hero",
  "media": [{"source": "drawn", "tag": "示意", "illust": "food/meatball"}], "title": "<dish / product name>"}}
```

The workhorse shot for non-software industries: a real merchant photo or short video fills the frame as the hero, with a dish/product name, one selling line, and a price tag overlaid. Five layouts (`layout`):
- `hero`: one photo with a slow push-in, a bottom gradient caption bar for title/tagline/price. Good for a signature dish, a hero product, a room's main shot.
- `clip`: same as hero but the media is a short video clip (with a play badge). Good for process shots, walking through a space.
- `grid`: 2–4 photos tiled in with a staggered entrance, each with a short label.
- `callouts`: one photo with 1–3 leader-line callouts. Good for pointing out details in a single image.
- `tour`: 2–5 photos shown one at a time with page dots. Good for walking through a few angles of one room/space.

## No real photo: a full-card illustrated scene
Set that item's `source` to `"drawn"` and `tag` to `"示意"`, skip `src`, and give `illust`. The shot becomes a full-card illustrated scene: theme-colour background with texture, a main illustration about 480px wide, 2–3 props from the same industry drifting in, a slow push-in, and an industry particle layer (steam for food, sparkles for beauty/e-commerce, light bands for travel). The corner tag always says "示意" / "Illustration" — even if `tag` says "实拍", a drawing is never labelled as a real photo.

**Pick an `illust` that matches what the item is about.** Common ones:

| About | illust |
|---|---|
| noodles / noodle close-up (chopsticks lifting noodles) | `food/bowl` / `food/noodle-bowl-closeup` |
| meatballs | `food/meatball` |
| coffee / milk tea / hotpot / buns & dumplings | `food/coffee` / `food/tea` / `food/hotpot` / `food/steamer` |
| storefront | `food/storefront` (food) / `_base/store` (other industries) |
| thermos, cup / water bottle | `ecommerce/cup` / `ecommerce/bottle` |
| shipping / gift box / tag & specs | `ecommerce/parcel` / `ecommerce/gift` / `ecommerce/tag` |
| hairstyle, short cut / haircut / blow-dry | `beauty/hair-short` / `beauty/scissors` / `beauty/hairdryer` |
| room type / bed | `travel/room` / `travel/bed` |
| window view (window frame onto the landscape) | `travel/window-view` |
| guesthouse exterior / breakfast / scenery | `travel/house` / `travel/breakfast` / `travel/landscape` |
| course / spreadsheet / certificate | `education/book` / `education/sheet` / `_base/cert` |

The full list is `template/src/illust/names.json` (only names actually drawn in icons.tsx are accepted; validation checks this). If `illust` is left out, one is picked from keywords in the item's `label` and the shot's `title`/`tagline`/`roomType` (e.g. "pork meatballs" → `food/meatball`, "380ml thermos" → `ecommerce/cup`); only when nothing matches does it fall back to the `meta.industry` default.

**The illustration fallback is not a free pass**: a clean real photo always beats an illustration — use one whenever you have it.

## When to use
- The merchant has real photos/video and you want them to be the visual lead of the shot (not stuffed into a phone frame as a screenshot).
- You need to convey "what this is" and "how much / what tag" in the same shot.

## When not to use
- The asset is an app UI / a demo of an interaction: use `phone` or `mockApp` instead; a UI screenshot must never be marked `source: "merchant"` as if it were a real photo.
- One image can't carry the amount of information the shot needs: fold it into `features` or `quickList` instead.
- `grid` with missing photos padded out with a plain text list pretending to be an environment shot: skip the shot instead.

## Parameters
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | No | — | `hero` / `clip` / `grid` / `callouts` / `tour`, defaults to hero |
| media | Yes | 1–5 items | hero/clip/callouts: 1 item; grid: 2–4; tour: 2–5 |
| media[].src | Conditional | — | asset path; omit when `source: "drawn"` and give `illust` instead |
| media[].source | Yes | — | `merchant` real shot / `ai` AI-generated / `drawn` illustration fallback |
| media[].tag | Yes | — | `实拍`(real) / `示意`(illustrative) / `效果图`(rendering); `效果图` when `source` is `"ai"`, `示意` when `"drawn"`. Chinese values even on English videos — the corner tag is shown in English |
| media[].illust | No | — | pick one when `source: "drawn"` (see the table above and names.json) |
| media[].label | No | 8 chars | short label under each photo in grid/tour; also used to auto-pick an illustration |
| media[].month | No | 1–12 | fill in for season/weather-dependent shots; renders as "Shot in <month>" |
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
{"type": "photoShot", "dur": 2.5, "caption": "Broth made fresh,\n{every single day}", "mood": 0.3,
 "params": {"layout": "hero",
   "media": [{"src": "photos/house_noodle.jpg", "source": "merchant", "tag": "实拍"}],
   "title": "House Noodles", "tagline": "Broth made daily", "badge": "Signature", "price": 18, "unit": "bowl",
   "refs": ["f2"]}}
```
No real photos (room walkthrough):
```json
{"type": "photoShot", "dur": 4, "mood": 0.25,
 "params": {"layout": "tour", "roomType": "Garden twin",
  "media": [
    {"source": "drawn", "tag": "示意", "illust": "travel/room", "label": "The room"},
    {"source": "drawn", "tag": "示意", "illust": "travel/window-view", "label": "Garden view"}
  ]}}
```

## Bad examples
- `media[0].source: "merchant"` with no `src`: validation treats this as a missing asset path.
- `source: "ai"` but `tag` set to "实拍" (real shot): AI-generated media must be tagged "效果图" (rendering), never passed off as real.
- `source: "drawn"` with an unrelated illustration (meatballs shown as `food/receipt`, a thermos as `ecommerce/gift`): use a matching one from the table, or leave `illust` out and let the title pick it.
- A beauty "our work" grid without real photos, using scissors/comb drawings: a drawing is not the salon's work; retitle it as a service ("cut & blow-dry") or skip the shot.
- `layout: "grid"` with only 1 item: grid needs at least 2; use `hero` for a single item.
