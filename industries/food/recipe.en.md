# Food & Beverage — Recipe (EN summary)

Full detail is in `recipe.md` (Chinese); this is a condensed English pointer for non-Chinese-reading contributors. **The compliance rules this pack enforces are based on Chinese law (Advertising Law, Food Safety Law, Anti Food Waste Law, etc.) and Chinese short-video platform rules (Douyin, Shipinhao). They are not a general food-marketing checklist and do not reflect any other country's regulations.**

## Scope
Dine-in restaurants, cafes/tea shops, quick-service/snack shops. Not for: delivery-only kitchens, reheated pre-made meal brands with no storefront.

## Structures
- **A. Group-buy deal (Douyin, with deal link), ~21s**: hook → 2× photoShot(hero) signature dishes → photoShot(clip) prep process → priceCard(card) deal details → reviewCard → storeCard(photo) → endCard.
- **B. New product launch (coffee/tea), ~16s**: hook → photoShot(hero, "new" badge) → photoShot(clip) → meter (taste scale only) → features → priceCard(promo) → endCard.
- **C. Grand opening / visit guide, ~22s**: hook → storeCard(photo) → photoShot(grid, interior) → 2× photoShot(hero) → steps(directions) → priceCard(opening deal) → endCard.

## Shot rules
- `beforeAfter` is disabled (beauty-industry only).
- Claims like "made fresh / hand-made / house-braised" need `refs` pointing to `meta.facts`; no evidence, don't write it.
- `priceCard.limits` needs ≥1 entry; hotpot/buffet/BBQ/teahouse sub-categories require `excludes`.
- On Douyin with a deal link, never show a "original price" style comparison on screen.

## Required on-screen notices
- Dish photos → "Photos for reference only, actual product may vary" (图片仅供参考 以实物为准)
- Deal-linked → "See deal page for details" (以团购详情页为准)
- Promo → start/end date
- Sales figures → source + as-of date

See `test-brief.md` / `expected.md` for a worked example and `rules.json` for the machine-checkable rules (each pattern cites its legal/platform source, or is marked "unverified").

<!-- round5 -->
## Core action and assets (enforced by the validator)
- Food & beverage is a physical-goods / storefront industry: show the core action with **photoShot (merchant photo or illustrated scene)** and use `steps` for the process. **Do not invent app screens with `mockApp`** (order page, checkout, booking form); the validator blocks it. If the merchant really has a screenshot of its own mini-program or store page, show it in `phone`.
- Register every image in `meta.assets` with its source (merchant / illustration / screenshot); only merchant photos may be labelled "实拍".
- No photos: fall back to illustrations (`source: "drawn"`). You get an "add a real photo before publishing" reminder, not a block, and no "no real photo in the first 3 s" warning.
- When both `compare` columns have a `level`, the `tone: "good"` column must score better on the `meterLabel` scale: "保温时长" (heat retention) higher is better; "降温速度" (cooling speed) or "麻烦程度" (hassle) higher is worse.
- Price cards must carry every condition in `meta.facts`: weekend/holiday prices, coupon terms, surcharges, validity dates, booking, blackout days. If you mention a fee (extra bed, cleaning, broth base…), give the amount instead of just "extra".
