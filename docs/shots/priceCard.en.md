# priceCard Price card / price list

**Minimal valid params** (copy, change the numbers, and it passes validation):
```json
{"type": "priceCard", "dur": 3, "params": {"layout": "card",
  "items": [{"itemId": "<id from the brief's price table>", "name": "Set for two", "price": 79, "unit": "set"}]}}
```

Bakes the "clearly marked price" layout rules into the component — you just fill in numbers and conditions; the price never gets hard to read, and it never flickers or shakes. Two layouts:
- `card`: a price card for 1–3 prices. With one item: big price + unit + optional struck-through comparison price → item name. With 2–3 items the prices stack as rows ("name / note + price"), each landing in turn. Below that: divider → included items → limits / extra fees / conditions / promo period → gift → footnote.
- `menu`: a 2–6 row price list, name and price aligned with a dotted leader.

**Every item you give is shown; nothing is dropped.** A `card` with 4+ items switches to `menu` automatically. If the content is too tall for the main zone, included items go into two columns, spacing tightens, and as a last resort the whole card scales down — no row is ever removed.

**One room type / package with two prices** (weekday/weekend, one/two people): write two `items` with the same `name` and put each date range or condition from the facts in `note`. The card shows the name once as a heading and each price row carries its own dates. Writing only one item and pushing the other price into `conditions` (or leaving it out) makes viewers think there is only one price.

**Never show the words "original price" on screen.** When there's a comparison price, `compare.basis` must state exactly what it's based on — the shot displays that basis text directly.

The card is as tall as its content and centred in the main zone, so there is no big blank area. When `footnote` matches one of `meta.notices` (ignoring spaces and punctuation), only the bottom notice pill is shown, not both.

**English videos:** `label` and `compare.basis` must still use the Chinese enum values from the params table (validation checks those); with `meta.lang: "en"` the card shows them in English (e.g. 团购价 → "Deal price", 单点合计 → "Items ordered separately"), and "from"/"Basis:"/"Extra:"/"Free:" are shown in English too.

## When to use
- Any shot that needs a clearly stated price: a package deal, a ticket, a course fee, a haircut price, a price list, weekday/weekend room rates.
- Net/after-coupon prices that need stated conditions: put them in `conditions` (e.g. "after a ¥20 coupon").

## When not to use
- You just want a small price tag in the corner of another shot (e.g. on a dish photo): use `photoShot`'s `price`/`unit` fields instead of a separate priceCard shot.
- You don't have a real price and are making one up to fill the shot: skip the shot until you have a real price.

## Parameters
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | No | — | `card` (default, 1–3 items) / `menu` (2–6 items) |
| items | Yes | 1–6 items | all shown; a card with more than 3 switches to menu |
| items[].itemId | Yes | 20 chars | id matching the brief's price table |
| items[].name | No | card 10 chars / menu 8 chars | product / package / room name; use the same name for two prices of one room type |
| items[].price | Yes | — | a number; gimmick prices like 0/1/9.9 are not allowed |
| items[].unit | Yes | 4 chars | bowl/cup/piece/night/session/seat/person/ticket/set |
| items[].from | No | — | true adds a "from" marker; card layout then needs fromNote, menu layout needs addOns |
| items[].fromNote | Required with from=true (card) | 12 chars | explains what "from" refers to |
| items[].note | No | 12 chars | one small note line; when items share a name it becomes that row's title (e.g. "Mon–Thu") |
| label | No | — | Chinese enum: 售价/到手价/券后价/团购价/套餐价/活动价/门票 (shown in English on English videos) |
| people | No | 6 chars | e.g. "2–3 people" |
| includes | No | ≤6 items, 8 chars each | what's included, with quantities |
| excludes | No | 14 chars | extra fees; write "no extra fees" if required but none apply |
| limits | No | ≤3 items, 14 chars each | e.g. "dine-in only", "not combinable" |
| conditions | No | 16 chars | conditions for a net/coupon price |
| period | No | 16 chars | promo start–end dates |
| addOns | No | ≤4 items | {cond, extra}, e.g. "waist-length hair" + "+¥160" |
| compare | No | — | {price, basis, evidence}; basis from the Chinese enum list, evidence never appears on screen |
| gift | No | — | {name, qty}, e.g. "hair treatment" ×1 |
| footnote | No | 24 chars | fixed wording (set per industry) — don't rewrite it; hidden when it duplicates a notice |

## Duration
card with 1 item 2–3s, 2–3 items 3–4s; menu at least 3s (give 4–4.5s for more rows).

## Good examples
```json
{"type": "priceCard", "dur": 3.5, "caption": "Weekday or weekend,\n{prices up front}", "mood": 0.15,
 "params": {"layout": "card", "label": "售价", "people": "2 guests",
   "items": [
     {"itemId": "room-a-weekday", "name": "Garden twin", "price": 328, "unit": "night", "note": "Mon–Thu"},
     {"itemId": "room-a-weekend", "name": "Garden twin", "price": 428, "unit": "night", "note": "Fri–Sun"}
   ],
   "includes": ["Breakfast for 2", "Free parking"]}}
```
```json
{"params": {"layout": "menu", "label": "售价",
  "items": [
    {"itemId": "a", "name": "House noodles", "price": 18, "unit": "bowl"},
    {"itemId": "b", "name": "Pork wontons", "price": 15, "unit": "bowl"},
    {"itemId": "c", "name": "Small noodles", "price": 12, "unit": "bowl", "note": "Good for one"}
  ]}}
```

## Bad examples
- `price: 9.9` as a gimmick teaser price: industry rules block gimmick prices.
- Weekday 368 and weekend 468, but only one item (368) with the weekend price in `conditions` or missing: viewers only see one price. Write two items.
- `label: "Group price"` in English: not in the enum, validation fails. Write `"团购价"`; the card shows "Deal price".
- Writing `compare` with a `basis` outside the fixed list, or without `evidence`: validation blocks it.
- `items[].from: true` without `fromNote` (card) or `addOns` (menu): a "from" price must explain what it starts from.
