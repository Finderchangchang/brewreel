# priceCard Price card / price list

Bakes the "clearly marked price" layout rules into the component — you just fill in numbers and conditions; the price never gets hard to read, and it never flickers or shakes. Two layouts:
- `card`: a price card for a single room type / package / product. Big price + unit + optional struck-through comparison price → item name → divider → included items → limits / extra fees / conditions / promo period → gift → footnote.
- `menu`: a 2–6 row price list, name and price aligned with a dotted leader. Use this when you have several rows — don't cram them into `card`.

**Never show the words "original price" on screen.** When there's a comparison price, `compare.basis` must state exactly what it's based on ("manufacturer's suggested retail price", "sum of items ordered separately", etc.) — the shot displays that basis text directly, never the word "original".

## When to use
- Any shot that needs a clearly stated price: a package deal, a ticket, a course fee, a haircut price, a price list.
- Net/after-coupon prices that need stated conditions: put them in `conditions`.

## When not to use
- You just want a small price tag in the corner of another shot (e.g. on a dish photo): use `photoShot`'s `price`/`unit` fields instead of a separate priceCard shot.
- You don't have a real price and are making one up to fill the shot: skip the shot until you have a real price.

## Parameters
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | No | — | `card` (default) / `menu` |
| items | Yes | 1–6 items | card layout only shows item[0]; menu layout lists every row |
| items[].itemId | Yes | 20 chars | id matching the brief's price table |
| items[].name | No | card 10 chars / menu 8 chars | product / package name |
| items[].price | Yes | — | a number; gimmick prices like 0/1/9.9 are not allowed |
| items[].unit | Yes | 4 chars | bowl/cup/piece/night/session/seat/person/ticket/set |
| items[].from | No | — | true adds a "starting at" suffix; card layout then needs fromNote, menu layout needs addOns |
| items[].fromNote | Required with from=true (card) | 12 chars | explains what "starting at" refers to |
| items[].note | No | 12 chars | one small note line |
| label | No | — | one of: sale price / net price / coupon price / group-buy price / package price / promo price / ticket |
| people | No | 6 chars | e.g. "2–3 people" |
| includes | No | ≤6 items, 8 chars each | what's included, with quantities |
| excludes | No | 14 chars | extra fees; write "no extra fees" if required but none apply |
| limits | No | ≤3 items, 14 chars each | e.g. "dine-in only", "not combinable" |
| conditions | No | 16 chars | conditions for a net/coupon price |
| period | No | 16 chars | promo start–end dates |
| addOns | No | ≤4 items | {cond, extra}, e.g. "hair below waist" + "+¥160" |
| compare | No | — | {price, basis, evidence}; basis is picked from a fixed list, evidence never appears on screen |
| gift | No | — | {name, qty}, e.g. "hair treatment" ×1 |
| footnote | No | 24 chars | fixed wording (set per industry) — don't rewrite it yourself |

## Duration
card 2–4.5s; menu at least 3s (give 4–4.5s for more rows).

## Good examples
```json
{"type": "priceCard", "dur": 4, "caption": "Two-person set,\n{group price ¥59}", "mood": 0.15,
 "params": {"layout": "card",
   "items": [{"itemId": "deal-1", "name": "Signature Set for Two", "price": 59, "unit": "set"}],
   "label": "Group price", "people": "2 people",
   "includes": ["Braised beef noodles×2", "Hand-pounded meatballs×1 (6pc)", "Cold shredded salad×1"],
   "limits": ["Dine-in only", "Not combinable"],
   "compare": {"price": 68, "basis": "sum of items ordered separately", "evidence": "menu photo photos/menu.jpg"},
   "footnote": "See the group-buy page for details"}}
```
```json
{"params": {"layout": "menu",
  "items": [
    {"itemId": "a", "name": "Braised Beef Noodles", "price": 22, "unit": "bowl"},
    {"itemId": "b", "name": "Hand-pounded Meatballs", "price": 16, "unit": "portion"},
    {"itemId": "c", "name": "Small Beef Noodles", "price": 12, "unit": "bowl", "note": "Great for solo diners"}
  ], "label": "Menu price"}}
```

## Bad examples
- `price: 9.9` as a gimmick teaser price: industry rules block gimmick prices.
- Writing `compare` with a `basis` outside the fixed list, or without `evidence`: validation blocks it — a price comparison must have a stated basis.
- The word "original price" appearing on screen: use `compare.basis`'s own wording instead (e.g. "manufacturer's suggested retail price").
- `items[].from: true` without `fromNote` (card) or `addOns` (menu): a "starting at" price must explain what it starts from.
