# Food & Beverage — Brief Template (EN summary)

Shared fields (all industries): `industry` (= `food`), `subCategory`, `platform`, `attachDeal`, `facts[]`, `reviews[]`, `honors[]`, `certs[]`, `assets`, `brandColor`, `ownerSaid` (verbatim owner quotes), `forbidden`.

Food-specific fields: `storeName`, `category`, `isChain`, `city`/`landmark`/`hours`/`avgPrice`, `dishes[]` (`{id, name, price, unit, portion, photo, photoSource, sellingPoints[]{text, refs}}`), `deals[]` (required if `attachDeal`), `promo`, `facts[]` (required to back any "made fresh / house-braised / years in business" claim), `usesPrepared` (used pre-made ingredients?), `sellsAlcohol`, `certs[]`/`honors[]`, `reviews[]`, `salesData` (`{value, source, asOf}`, required if a sales figure appears on screen).

See `brief-template.md` for the full field table and a worked example (fictional merchant). Fill this out, then follow `recipe.md` to write `storyboard.json` and run `node scripts/validate.mjs`.
