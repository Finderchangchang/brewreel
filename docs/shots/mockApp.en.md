# mockApp simulated product UI

Use this when there's no screenshot: it draws a neutral-colored, realistic-looking app screen and animates it acting something out. Everything is driven by params — no image needed.

Four screen kinds (`kind`):

| kind | What happens on screen | Good for |
|---|---|---|
| dashboard | A big number rolls up from 0 → a line/bar chart grows in → metric rows appear one by one → one row gets tapped and highlighted | Data, stats, monitoring, reports |
| list | (optional) a search box gets typed into → rows appear one by one with status tags → one row gets tapped and highlighted | Orders, tasks, customers, message management |
| editor | (optional) a prompt gets typed into the input box → tap "Generate" → text writes itself out line by line → one line highlights → "Done" pops up | AI writing, auto-generation, notes |
| form | form fields auto-fill one by one (with checkmarks) → tap submit → button turns green | Bookings, orders, sign-ups, registration |

## When to use

- The product has no screenshot yet, or the screenshot is too cluttered or has private info in it.
- You want to show the *process* of doing something, not just the result.

## When not to use

- You have a good real screenshot: use phone instead, it's more credible.
- You're showing a chat conversation: use chat.
- You just want to flash one big number: use counter.

## Params

| Field | Required | Notes |
|---|---|---|
| kind | Yes | `dashboard` / `list` / `editor` / `form` |
| title | Yes | Header page name, **≤10 chars**, e.g. "Today's Overview." Use a page name from your own product, not a third-party app's name |
| items | Depends on kind | 0–5 rows, each `{icon?, text, value?, tone?}`, see below |
| items[].text | Yes | **≤10 chars** |
| items[].value | No | **≤6 chars** (digits and Latin letters count as half) |
| items[].tone | No | Color of `value`: `good` green / `warn` orange / `bad` red / `neutral` gray |
| items[].icon | No | Leading icon, pick from the icon list (e.g. trend clock alert money user doc calendar users check) |
| highlight | No | Row number to tap and highlight, **0-indexed**, 0–4 |
| stat | Recommended for dashboard | `{value ≤6 chars, label ≤8 chars}`, e.g. `{"value": "1,286", "label": "New orders today"}` — the number part rolls up |
| series | No | dashboard chart data, 2–12 numbers, 5–8 looks best |
| chart | No | dashboard chart type: `line` (default) / `bar` |
| input | No | **≤12 chars**. editor: the prompt typed in; list: the search term typed in |
| button | No | **≤4 chars**, the main button, e.g. "Generate," "Submit," "New" |
| done | No | **≤6 chars**, the completion message for editor/form, e.g. "Generated," "Booked" |

How to fill in `items` per kind:
- dashboard: 2–3 metric rows; `text` is the metric name, `value` is the number (only the first 3 rows show). Use `highlight` on the row you want to call out (e.g. an anomaly).
- list: 3–5 rows; `text` is the item name, `value` is a status tag (**≤4 chars looks best**, e.g. "Pending," "Shipped").
- editor: 3–5 rows of "generated text" — the first line renders as a bold title. `highlight` marks a line with a highlighter stroke.
- form: 2–5 fields; `text` is the field name, `value` is the filled-in content.

## Duration

dashboard 3.5–4s; list 3.5–4s; editor 4.5–5s (when `input` is set); form 3–4s. Too short speeds everything up.

## Examples

```json
{"type": "mockApp", "dur": 4, "caption": "Everything at a glance,\n{anomalies flagged automatically}", "mood": 0.3,
 "params": {"kind": "dashboard", "title": "Today's Overview",
   "stat": {"value": "1,286", "label": "New orders today"}, "series": [32, 41, 38, 52, 49, 63, 78],
   "items": [{"icon": "trend", "text": "Conversion", "value": "+12%", "tone": "good"},
             {"icon": "alert", "text": "Open complaints", "value": "2", "tone": "bad"}],
   "highlight": 1}}
```

```json
{"type": "mockApp", "dur": 5, "caption": "One line of input,\n{copy comes right out}", "mood": 0.1,
 "params": {"kind": "editor", "title": "New document", "input": "Write launch copy for a new product", "button": "Generate",
   "items": [{"text": "Introducing: all-day comfort"}, {"text": "Only 180 grams"}, {"text": "12-hour battery life"}],
   "highlight": 1, "done": "Generated"}}
```

```json
{"type": "mockApp", "dur": 4, "caption": "Hundreds of orders,\n{one search away}", "mood": 0.5,
 "params": {"kind": "list", "title": "Orders", "input": "refund",
   "items": [{"icon": "money", "text": "Refund #2931", "value": "Pending", "tone": "warn"},
             {"icon": "user", "text": "Order for Mr. Wang", "value": "Shipped", "tone": "good"},
             {"icon": "alert", "text": "Complaint: late delivery", "value": "Urgent", "tone": "bad"}],
   "highlight": 0}}
```

```json
{"type": "mockApp", "dur": 3.5, "caption": "Customer booking,\n{done in 30 seconds}", "mood": 0,
 "params": {"kind": "form", "title": "Book a visit", "button": "Submit", "done": "Booked",
   "items": [{"icon": "user", "text": "Name", "value": "Ms. Lee"}, {"icon": "calendar", "text": "Time", "value": "Sat afternoon"}, {"icon": "users", "text": "Party size", "value": "2"}]}}
```
