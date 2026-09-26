# Adult Vocational Training — Recipe (EN summary)

Full detail in `recipe.md` (Chinese). **Rules are based on Chinese Advertising Law (esp. Art. 24 on training-ad restrictions), the eight-ministry notice on after-school training ads, and Chinese platform training-category rules. Not a general edtech-marketing checklist.**

## Scope
Adult vocational skills (office software, AI tools, certification prep). **K12 / preschool / kids' enrichment is rejected outright** — any mention of that audience blocks the whole storyboard.

## Structures
- **A. Tip-and-hook (office software), ~28s**: hook → mockApp(sheet) → mockApp(app) → compare(method-vs-method, never before/after-the-course) → factSheet(syllabus) → endCard.
- **B. Course pitch, ~40s**: hook → features(facts only) → factSheet(syllabus) → credCard(person, verbatim credentials) → steps → chat(FAQ, disclaimer says "demo dialogue") → priceCard/endCard.
- **C. Certification info, ~35s**: hook → factSheet(exam, source required) → steps(official application flow) → factSheet(syllabus) → features → endCard ("exam outcome depends on the individual").

## Key rules
- `reviewCard` is disabled (no student testimonials in this industry).
- No "before you took the course / after" comparisons.
- `credCard.creds` must be verbatim from the brief.
- Demo phone numbers must be masked (`138****0000`); a full number will be blocked by the anti-doxxing/contact-info rule — that's expected.
- The validator only counts `chat` as a "core action demo" when it has a `panel` (with `verdict` or `replies`). A messages-only `chat` (e.g. the "AI office demo" variant's "talk to a generic AI assistant" shot) will **not** satisfy the required demo check. Either add a `panel` to `chat`, or use `mockApp` (`kind: "editor"`, `input` = what the user asked, `items` = what the AI produced) instead — see `examples/education.json` for the latter.
- Office-software accent color: avoid green shades close to `#07C160`/`#1AAD19`/`#95EC69`/`#09BB07` (validator flags them as looking like a chat app's brand color); `#0F766E` clears the check.
- `priceCard.compare` (struck-through original price) is currently **always blocked** for this industry: `compareHasBasis` in `scripts/checks/index.mjs` only evaluates `shotRules.priceCard.forbidCompareWhen` when that field exists; when it's undefined the DSL evaluator treats it as "always true" (unlike `mediaPolicy`, which explicitly guards with `!!`), so compare is forbidden by default. Education's `rules.json` never sets `forbidCompareWhen`, so `compare` cannot be used no matter how correctly `basis`/`evidence` are filled — this is a shared-script gap, not a content problem. Until it's fixed, only show the current price on `priceCard` and skip `compare`.

## Required notices
"Results vary by individual"; for exam-prep: "Exam outcome depends on the candidate; this course does not guarantee passing"; "Demo data is fictional" on any mock screen; "AI-assisted content" if AI voice is used.

See `test-brief.md` / `expected.md` for a worked example.
