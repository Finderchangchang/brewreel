# reviewCard Real customer review

Quotes a real customer review: a large quotation mark + the original text + a star rating + the month, with the stars lighting up one at a time (not all at once). 1–2 quotes; no real headshots, an initial-letter avatar instead.

## When to use it
- When you need "someone else says it's good" instead of "we say it's good": common in food service, travel/lodging and beauty; e-commerce can use it too, but must hide the reviewer's handle.
- When you have a screenshot that matches the quoted text (`evidence` is only for validation and human review, it never shows on screen).

## When not to use it
- Not allowed for education/training content (testimonial-style ads from students are restricted there) — use credCard or factSheet for instructor credentials or course facts instead.
- Don't fabricate a quote when you don't have a real one: `text` must be a substring of an actual review; rewriting it to sound more impressive gets it blocked.

## Params
| Field | Required | Limit | Notes |
|---|---|---|---|
| quotes | Yes | 1–2 items | one review each |
| quotes[].text | Yes | 24 chars | verbatim excerpt; may be trimmed, never made more dramatic |
| quotes[].month | Yes | 7 chars | review month, e.g. 2026-08 |
| quotes[].stars | No | 1–5 | must match the original review |
| quotes[].who | No | 8 chars | e.g. "family guest"; never a real name |
| evidence | Yes | 80 chars | path to the review screenshot; not rendered, for validation/human review only |

## Duration
2–4.5s, default 3s. About 3s for one quote; 4–4.5s for two, otherwise the stars can't finish lighting up one by one.

## Good examples
```json
{"type": "reviewCard", "dur": 3, "mood": 0.15,
 "params": {"quotes": [{"text": "Rich broth, generous portion of meat", "month": "2026-08", "stars": 5}], "evidence": "reviews/2026-08-01.png"}}
```
```json
{"type": "reviewCard", "dur": 4.5, "mood": 0.15,
 "params": {"quotes": [
   {"text": "Room was spotless, great view from the window", "month": "2026-07", "stars": 5, "who": "family guest"},
   {"text": "Owner was very friendly, will come back", "month": "2026-06", "stars": 4}
 ], "evidence": "reviews/screenshot-2026-07.png"}}
```

## Bad examples
- `text` written as "the best-reviewed shop on the whole internet" — that's not an excerpt, it's an invented superlative.
- `stars` set to 5 when the original review was 3 stars — doesn't match `evidence`, blocked by industry rules.
- Using a real customer's actual name for `who` — use a role description like "regular customer" or "family guest" instead.
