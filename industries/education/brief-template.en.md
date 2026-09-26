# Adult Vocational Training — Brief Template (EN summary)

Shared fields: see `industries/food/brief-template.en.md`.

Education-specific: `orgName`, `platform`, `checkoutEntry` (never a bare contact handle or off-platform link), `courseName`, `courseType`, `audience` (must be adult), `syllabus[]{no,name,lessons}`, `totalLessons`/`totalHours`, `delivery`, `whereToLearn`, `needsExtraApp`, `services{files,qaMethod,qaDays,replayDays}`, `price`/`comparePrice`/`compareBasis`/`compareEvidence`, `promo{start,end,condition}`, `instructor{name,years,creds[],photoConsent}`, `exam{name,issuer,dates,requirements,sourceName,sourceDate}` (cert-prep only), `demos[]`, `assets[]`, `refundRule`, `usesAI`, `citedData[]{value,source}`, `ownerSaid[]`.

See `test-brief.md` for a worked example (fictional org: an Excel+AI office-skills course).

<!-- round5 -->
## Asset list (`assets`)
List every image/video the video may use. The model copies it verbatim into `meta.assets` of `storyboard.json`; a file with no registered source is blocked.

- `src` (required): file path, relative to the storyboard folder.
- `source` (required): `merchant` = the merchant's own photo / customer-consented photo; `illustration` = drawing, design mock-up or AI image; `screenshot` = app / web / mini-program screenshot.
- `kind` (recommended): dish / product / room / store / customer-before / customer-after / review …
- `pair` (required for before/after): the before and after photo of the same customer share one value, e.g. `"A"`.

Only `source: merchant` photos may carry on-screen "实拍 / N月实拍 / 顾客授权 / 未修图" labels. Files under 2KB, with a short side under 300px, undecodable files, anything under `_dev/`, and the repo's own sample screenshots (even renamed copies) are rejected. Screenshots go in `phone`, never in `photoShot`. If the merchant has no photos, write "none": the video falls back to illustrations (`source: "drawn"`), which only raises a warning.
Instructor and certificate photos are `merchant`; software screen recordings/screenshots are `screenshot` and go in `phone`.
## Keep each price and its conditions in one fact
Copy the price list into `meta.facts` sentence by sentence (e.g. "Sun–Thu 368/night, Fri–Sat 468/night, public holidays 598/night", "Sep 26–Oct 7: 59 each after claiming a 20-yuan store coupon"). The validator checks the screen against each fact: weekend/holiday prices, coupon conditions, surcharges, validity dates, booking requirements, blackout days and fee amounts must all appear, and a day range that differs from the fact (e.g. counting Sunday as weekend) is blocked.
