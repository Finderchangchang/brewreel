# Software Product — Recipe (EN summary)

This is the original (phase-1) industry; `meta.industry` defaults to it. The full workflow lives in the repo root `SKILL.md` and `shots.md` — this file only documents how it fits into the industry-pack mechanism.

## Scope
App / tool / AI product promo videos.

## Rules
`_base/rules.json`'s generic rules (off-platform contact info, engagement-bait, medical claims, etc.) still apply. `beforeAfter` is beauty-only and stays disabled. The other 6 new shots aren't blocked, but this phase didn't write software-specific copy rules for them — most software promos work fine with the 11 original shots (`hook`/`chat`/`phone`/`mockApp`/`meter`/`compare`/`counter`/`features`/`steps`/`quickList`/`endCard`).

See the repo root `SKILL.md` for structures, hook examples, and the common-mistakes table.

<!-- round5 -->
## Show the core action in the product's own UI (enforced)
- At least one `chat` / `phone` (real screenshot) / `mockApp` shot must act out meta.action; feature cards and step cards don't count.
- `mockApp` with `kind: "form"` is only for products that really are forms (sign-up, registration, booking). Using a form to stand in for the core action is blocked (e.g. a reply assistant turning "message arrives → analysis → reply" into a form with "emotion tag / danger level" fields).
- If meta.action is about messages / chat / replies, use `chat` (or a real `phone` screenshot) so the message itself appears on screen.
- If meta.action is not conversational (e.g. "tap start → distracting apps are blocked"), don't stage it as a chat thread; use `mockApp` with `button` / `done`.
- When both `compare` columns have a `level`, the `tone: "good"` column must score better on the `meterLabel` scale ("麻烦程度"/effort: good column lower; "效率"/efficiency: good column higher).
