# Travel & Stays — Recipe (EN summary)

Full detail in `recipe.md` (Chinese). **Rules are based on Chinese price-fraud regulations, the Online Travel Services rules, the Tourism Law, and Chinese platform rules. Not a general travel-marketing checklist.**

## Scope
Homestays, small hotels, scenic spots, day trips, campsites. **Guided-tour products (day trips, group tours, chartered transport) require a travel-agency license** — missing it blocks the whole storyboard.

## Structures
- **A. Immersive room tour, ~29.5s**: hook(photo) → photoShot(tour, exterior) → photoShot(tour, one room: wide→bed→view→bathroom) → features(specs, no adjectives) → photoShot(hero, breakfast/experience) → storeCard(map) → priceCard(matching that room) → endCard.
- **B. Weekend-trip guide, ~28s**: hook → storeCard(map) → steps(day plan) → photoShot(tour, seasonal, month tagged) → quickList(booking/closed days/extra fees) → priceCard(ticket, excludes required) → endCard.
- **C. Price breakdown, ~23.5s**: hook(stat) → priceCard(card) → compare(weekday vs. weekend, never "original price") → photoShot(same room as the price card) → quickList(check-in notes) → endCard.

## Key rules
- Star/grade claims need `refs` to an actual rating certificate.
- Any "N minutes" travel-time claim must state the mode of transport in the same sentence; vague distance ("just a few minutes away") is blocked.
- Seasonal-scenery photos need a `month` tag plus a "weather/season dependent" caveat.
- **Do not use a blanket "for reference only" disclaimer** (the opposite of the food industry's requirement) — tag each photo individually instead.
- Guided-tour wording without a travel-agency license is blocked.

## Required notices
Per-photo tag ("actual photo" / "photo taken in [month]" / "illustrative"); "weekend/holiday pricing differs, see checkout page" (fixed priceCard footnote); "travel time is a navigation estimate" on any route; "weather/season dependent" on seasonal scenery; age/height/health limits + weather closure note on high-risk activities.

See `test-brief.md` / `expected.md` for a worked example.

<!-- round5 -->
## Core action and assets (enforced by the validator)
- Travel & lodging is a physical-goods / storefront industry: show the core action with **photoShot (merchant photo or illustrated scene)** and use `steps` for the process. **Do not invent app screens with `mockApp`** (order page, checkout, booking form); the validator blocks it. If the merchant really has a screenshot of its own mini-program or store page, show it in `phone`.
- Register every image in `meta.assets` with its source (merchant / illustration / screenshot); only merchant photos may be labelled "实拍".
- No photos: fall back to illustrations (`source: "drawn"`). You get an "add a real photo before publishing" reminder, not a block, and no "no real photo in the first 3 s" warning.
- When both `compare` columns have a `level`, the `tone: "good"` column must score better on the `meterLabel` scale: "保温时长" (heat retention) higher is better; "降温速度" (cooling speed) or "麻烦程度" (hassle) higher is worse.
- Price cards must carry every condition in `meta.facts`: weekend/holiday prices, coupon terms, surcharges, validity dates, booking, blackout days. If you mention a fee (extra bed, cleaning, broth base…), give the amount instead of just "extra".
