# Travel & Stays — Brief Template (EN summary)

Shared fields: see `industries/food/brief-template.en.md`.

Travel-specific: `name`, `type`, `location{province,county,village,landmark}` (no street address), `routes[]{to,mode,minutes,basis}`, `parking`, `pickup{price,advanceDays}`, `rooms[]{id,name,area,bed,capacity,view,photos[]{src,month}}`, `publicAreas[]`, `prices[]{itemId,weekday,weekend,holiday,unit,breakfast,checkedAt}`, `deals[]`, `fees{deposit,pet,extraBed,lateCheckout,parking}`, `ticket{adult,child,senior,hours,closedDays,reservation,extraItems[],riskItems[]}`, `licenses{business,specialTrade,homestayFiling,hygiene,food,travelAgency}`, `certs[]{grade,proof}`, `facts[]`, `reviews[]`, `seasonal[]{scene,months,photoMonth,weatherDependent}`, `audience`, `platform`, `attachDeal`, `theme`, `brandColor`, `logo`, `avoid[]`, `ownerSaid[]`.

See `test-brief.md` for a worked example (fictional homestay).

<!-- round5 -->
## Asset list (`assets`)
List every image/video the video may use. The model copies it verbatim into `meta.assets` of `storyboard.json`; a file with no registered source is blocked.

- `src` (required): file path, relative to the storyboard folder.
- `source` (required): `merchant` = the merchant's own photo / customer-consented photo; `illustration` = drawing, design mock-up or AI image; `screenshot` = app / web / mini-program screenshot.
- `kind` (recommended): dish / product / room / store / customer-before / customer-after / review …
- `pair` (required for before/after): the before and after photo of the same customer share one value, e.g. `"A"`.

Only `source: merchant` photos may carry on-screen "实拍 / N月实拍 / 顾客授权 / 未修图" labels. Files under 2KB, with a short side under 300px, undecodable files, anything under `_dev/`, and the repo's own sample screenshots (even renamed copies) are rejected. Screenshots go in `phone`, never in `photoShot`. If the merchant has no photos, write "none": the video falls back to illustrations (`source: "drawn"`), which only raises a warning.
For seasonal scenery, put the shooting month in `note` (e.g. "shot Oct 2025") so the frame may say "10月实拍".
## Keep each price and its conditions in one fact
Copy the price list into `meta.facts` sentence by sentence (e.g. "Sun–Thu 368/night, Fri–Sat 468/night, public holidays 598/night", "Sep 26–Oct 7: 59 each after claiming a 20-yuan store coupon"). The validator checks the screen against each fact: weekend/holiday prices, coupon conditions, surcharges, validity dates, booking requirements, blackout days and fee amounts must all appear, and a day range that differs from the fact (e.g. counting Sunday as weekend) is blocked.
