# Food & Beverage — Brief Template (EN summary)

Shared fields (all industries): `industry` (= `food`), `subCategory`, `platform`, `attachDeal`, `facts[]`, `reviews[]`, `honors[]`, `certs[]`, `assets`, `brandColor`, `ownerSaid` (verbatim owner quotes), `forbidden`.

Food-specific fields: `storeName`, `category`, `isChain`, `city`/`landmark`/`hours`/`avgPrice`, `dishes[]` (`{id, name, price, unit, portion, photo, photoSource, sellingPoints[]{text, refs}}`), `deals[]` (required if `attachDeal`), `promo`, `facts[]` (required to back any "made fresh / house-braised / years in business" claim), `usesPrepared` (used pre-made ingredients?), `sellsAlcohol`, `certs[]`/`honors[]`, `reviews[]`, `salesData` (`{value, source, asOf}`, required if a sales figure appears on screen).

See `brief-template.md` for the full field table and a worked example (fictional merchant). Fill this out, then follow `recipe.md` to write `storyboard.json` and run `node scripts/validate.mjs`.

<!-- round5 -->
## Asset list (`assets`)
List every image/video the video may use. The model copies it verbatim into `meta.assets` of `storyboard.json`; a file with no registered source is blocked.

- `src` (required): file path, relative to the storyboard folder.
- `source` (required): `merchant` = the merchant's own photo / customer-consented photo; `illustration` = drawing, design mock-up or AI image; `screenshot` = app / web / mini-program screenshot.
- `kind` (recommended): dish / product / room / store / customer-before / customer-after / review …
- `pair` (required for before/after): the before and after photo of the same customer share one value, e.g. `"A"`.

Only `source: merchant` photos may carry on-screen "实拍 / N月实拍 / 顾客授权 / 未修图" labels. Files under 2KB, with a short side under 300px, undecodable files, anything under `_dev/`, and the repo's own sample screenshots (even renamed copies) are rejected. Screenshots go in `phone`, never in `photoShot`. If the merchant has no photos, write "none": the video falls back to illustrations (`source: "drawn"`), which only raises a warning.

## Keep each price and its conditions in one fact
Copy the price list into `meta.facts` sentence by sentence (e.g. "Sun–Thu 368/night, Fri–Sat 468/night, public holidays 598/night", "Sep 26–Oct 7: 59 each after claiming a 20-yuan store coupon"). The validator checks the screen against each fact: weekend/holiday prices, coupon conditions, surcharges, validity dates, booking requirements, blackout days and fee amounts must all appear, and a day range that differs from the fact (e.g. counting Sunday as weekend) is blocked.
