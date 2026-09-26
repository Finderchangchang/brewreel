# credCard Credential card / honor card

Replaces empty claims like "master craftsman" or "gold-medal" with verifiable credentials. Two layouts:
- `person`: an instructor's or technician's credential card — an initial-letter avatar (or a photo they've consented to) + name/role/years + credentials checked off one at a time + skill tags
- `honor`: an award/certificate card — a hand-drawn badge (never imitating any official mark) + the award title + issuer · year

## When to use it
- When you want to prove "this person / this award is real" instead of just boasting.
- `person.creds` must be copied verbatim from the brief's credential field; `honor` should include `refs` pointing at a verifiable entry in `meta.facts`.

## When not to use it
- Don't use this shot when you can't back up a credential — use `features` to talk about product selling points instead.
- Never use an AI-generated face or a stock photo to impersonate a real person; if there's no photo, use the default initial-letter avatar instead of grabbing a stranger's picture.

## Params
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | Yes | — | person / honor |
| name | recommended for person | 6 chars | a short form of address, not a full legal name |
| role | No | 12 chars | e.g. "head pastry chef" |
| years | No | 0–80 | years of experience |
| creds | No | 0–3 items, 16 chars each | credentials, must be copied verbatim from the brief |
| skills | No | 0–3 items, 6 chars each | skill tags |
| photo | No | asset png/jpg/jpeg/webp | person: a photo the subject consented to; honor: a real photo of the certificate/plaque |
| title | recommended for honor | 12 chars | award title |
| issuer | No | 12 chars | issuing body |
| year | No | 1900–2100 | year |
| refs | recommended for honor | — | entry id(s) in `meta.facts` |

Common banned words (industry rules may add more): doctor, physician, expert, professor, director, dean, dermatologist, master, gold-medal, top-tier, top, authority, "number one", and any government-agency name.

## Duration
1.5–6s, default 3s. Give `person` with 2–3 credentials 3.5–4.5s, or the check-off animation gets rushed.

## Good examples
```json
{"type": "credCard", "dur": 3.5, "mood": 0.15,
 "params": {"layout": "person", "name": "Chef Chen", "role": "Head pastry chef", "years": 12,
   "creds": ["Certified Chinese Pastry Technician"], "skills": ["Hand-kneaded", "Slow-simmered broth"]}}
```
```json
{"type": "credCard", "dur": 3, "mood": 0.15,
 "params": {"layout": "honor", "title": "Merchant of the Year", "issuer": "Platform X", "year": 2026, "refs": ["f4"]}}
```

## Bad examples
- `creds` written as "widely recognized as the top master in the industry" — unverifiable, and hits the banned-word list.
- `honor` layout with no `refs` — the award has no traceable source.
- Using a stock photo or an AI-generated face for `photo` to stand in for a real person.
