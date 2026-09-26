# E-commerce (Physical Goods) — Recipe (EN summary)

Full detail in `recipe.md` (Chinese). **Rules are based on Chinese law (Advertising Law, E-commerce Law, price-fraud regulations) and Chinese platform rules (Douyin, Weixin Channels). Not a general e-commerce checklist.**

## Scope
Everyday physical goods. **Rejected outright**: health-food, pharmaceuticals, medical devices, special medical foods, tobacco, e-cigarettes.

## Structures
- **A. Pain-point solve, ~23.5s**: hook → photoShot(callouts) → counter(measure, with test condition + source) → features → priceCard(optional) → endCard.
- **B. Before/after test, ~23.5s**: hook → counter(measure) → compare(self only, never vs. a competitor) → factSheet(spec) → phone (real review screenshot, handle de-identified) → endCard.
- **C. Unboxing, ~24s**: hook → factSheet(box, gifts named+quantified) → quickList → photoShot(grid) → priceCard → endCard.

## Key rules
- `chat` only if `brief.realQA` has a real support Q&A; scripted "haggle with the boss" dialogue is blocked.
- `counter(measure)` needs a test condition and source on the same shot.
- `compare` is self-vs-self only, never against a named competitor.
- Product photos must be merchant shots; don't render a lifelike mock of the product with no photo.

## Required notices
"Price as shown at checkout"; promo start/end dates; strikethrough-price basis (either "lowest price in the last 7 days" or "manufacturer's suggested retail price"); test condition + source on any measured claim.

See `test-brief.md` / `expected.md` for a worked example.

<!-- round5 -->
## Core action and assets (enforced by the validator)
- Physical e-commerce is a physical-goods / storefront industry: show the core action with **photoShot (merchant photo or illustrated scene)** and use `steps` for the process. **Do not invent app screens with `mockApp`** (order page, checkout, booking form); the validator blocks it. If the merchant really has a screenshot of its own mini-program or store page, show it in `phone`.
- Register every image in `meta.assets` with its source (merchant / illustration / screenshot); only merchant photos may be labelled "实拍".
- No photos: fall back to illustrations (`source: "drawn"`). You get an "add a real photo before publishing" reminder, not a block, and no "no real photo in the first 3 s" warning.
- When both `compare` columns have a `level`, the `tone: "good"` column must score better on the `meterLabel` scale: "保温时长" (heat retention) higher is better; "降温速度" (cooling speed) or "麻烦程度" (hassle) higher is worse.
- Price cards must carry every condition in `meta.facts`: weekend/holiday prices, coupon terms, surcharges, validity dates, booking, blackout days. If you mention a fee (extra bed, cleaning, broth base…), give the amount instead of just "extra".
