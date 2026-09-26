# Beauty & Personal Care — Recipe (EN summary)

Full detail in `recipe.md` (Chinese). **Rules are based on Chinese Advertising Law, the Cosmetics Supervision Regulation, and Chinese platform beauty-category rules. Scoped to "life beauty" services (hair/nail/lash/facial cleansing) — not medical aesthetics.**

## Scope
Hair, nail, lash, basic skin-cleansing services. **No medical aesthetics** (injections, lasers, etc.) and **no tattoo/microblading/semi-permanent makeup** — either mentioned in the brief blocks the whole storyboard.

## Structures
- **A. Before/after (hair/nail/lash only, consented photos), ~25s**: hook → chat → steps → beforeAfter → photoShot(tour) → priceCard(menu) → storeCard.
- **B. Price breakdown, ~20s**: hook → chat → priceCard(menu, "starting from" prices must list the add-on conditions on screen) → quickList → features → storeCard.
- **C. Trust-building Q&A, ~22s**: hook → quickList(3 questions to ask) → compare(habit) → credCard(person) → features → endCard.

## Key rules
- `beforeAfter` requires `consent: true` and `retouched: false`; `skincare` sub-vertical is never allowed to use it.
- "Starting from" prices must show the add-on conditions in the same shot.
- Medical-sounding endorsements ("doctor", "dermatologist") are blocked; no lab coats, needles, or medical crosses on screen.

## Required notices
"Life beauty services · not a medical aesthetics provider" on storeCard/endCard; "Client-consented, unretouched photo" fixed badge on beforeAfter; "Screen colors may vary — see in-store swatch" on any color-swatch shot.

See `test-brief.md` / `expected.md` for a worked example.

<!-- round5 -->
## Core action and assets (enforced by the validator)
- Beauty is a physical-goods / storefront industry: show the core action with **photoShot (merchant photo or illustrated scene)** and use `steps` for the process. **Do not invent app screens with `mockApp`** (order page, checkout, booking form); the validator blocks it. If the merchant really has a screenshot of its own mini-program or store page, show it in `phone`.
- Register every image in `meta.assets` with its source (merchant / illustration / screenshot); only merchant photos may be labelled "实拍".
- No photos: fall back to illustrations (`source: "drawn"`). You get an "add a real photo before publishing" reminder, not a block, and no "no real photo in the first 3 s" warning.
- When both `compare` columns have a `level`, the `tone: "good"` column must score better on the `meterLabel` scale: "保温时长" (heat retention) higher is better; "降温速度" (cooling speed) or "麻烦程度" (hassle) higher is worse.
- The two `beforeAfter` photos must be the `customer-before` / `customer-after` of one `pair` in the asset list, never the same file or identical copies.
