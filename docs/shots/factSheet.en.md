# factSheet Spec table / box list / syllabus / exam info / color swatch

One card, five layouts, rows lighting up one at a time — the moving element is "facts being proven one by one," not everything dumped on screen at once:
- `spec`: a parameter table (key: value) with table rules
- `box`: an unboxing/packaging list, rounded tiles with a "×N" quantity and a "gift" badge
- `syllabus`: a course outline, chapter number + name + lesson count
- `exam`: exam info, same table look as spec, a source line is required at the bottom (won't render without one)
- `swatch`: a color card, swatches pop in one by one, one can be highlighted as the recommended shade

## When to use it
- When there's a screenful of hard facts worth writing out clearly: material specs, an unboxing checklist, course chapters, exam logistics, color codes.
- When you want to replace a vague one-line brag with a verifiable table or list.

## When not to use it
- Only one fact to show: use counter or something lighter instead of a whole table.
- Using the `exam` layout without a real `source`: don't invent one — skip this layout if you don't have it.

## Params
| Field | Required | Limit | Notes |
|---|---|---|---|
| layout | Yes | — | spec / box / syllabus / exam / swatch |
| title | Yes | 12 chars | card title |
| rows | Yes | 2–6 rows | see below |
| rows[].key | Yes | 6 chars | spec/exam: parameter name; box: item name; syllabus: fallback (prefer `name`); swatch: color name |
| rows[].value | Yes | 10 chars | spec/exam: parameter value; box: note; swatch layout doesn't currently render this, but it's still required |
| rows[].qty | No | integer | box layout: quantity, shown as "×N" |
| rows[].isGift | No | true/false | box layout: true adds a "gift" badge |
| rows[].no | No | 4 chars | syllabus layout: chapter number |
| rows[].name | No | 12 chars | syllabus layout: chapter title (falls back to `key` if omitted) |
| rows[].lessons | No | integer | syllabus layout: lesson count for that chapter |
| rows[].hex | No | #RRGGBB | swatch layout: color value; a malformed value renders as a placeholder gray block |
| facts | No | 0–4 items | a strip of facts at the bottom |
| facts[].label | Yes | 4 chars | e.g. "total hours" |
| facts[].value | Yes | 8 chars | e.g. "16 lessons"; must not say "lifetime" or "forever" |
| source | Required for exam | 24 chars | e.g. "Source: official site, Sep 2026" |
| notice | No | 20 chars | swatch layout uses a fixed line required by industry rules, e.g. "colors may vary by screen, check the in-store swatch" |
| image | No | asset png/jpg/jpeg/webp | thumbnail on the left (interface reserved, not yet rendered) |
| highlight | No | 0-indexed | swatch layout: index of the recommended color in `rows` |

## Duration
3–8s, default 4s. Give syllabus/exam 5–8s when there are many rows, or the row-by-row reveal gets rushed and hard to read.

## Good examples
```json
{"type": "factSheet", "dur": 4, "mood": 0.1,
 "params": {"layout": "spec", "title": "Specs",
   "rows": [{"key": "Material", "value": "304 steel"}, {"key": "Capacity", "value": "500ml"}, {"key": "Weight", "value": "320g"}]}}
```
```json
{"type": "factSheet", "dur": 6, "mood": 0.1,
 "params": {"layout": "syllabus", "title": "Course outline",
   "rows": [{"no": "1", "name": "Fundamentals", "lessons": 6}, {"no": "2", "name": "Capstone project", "lessons": 10}],
   "facts": [{"label": "Total", "value": "16 lessons"}]}}
```

## Bad examples
- `exam` layout with no `source` — won't render; don't invent something like "the internet" as the source.
- `facts` saying "lifetime access" or "forever" — gets blocked.
- `hex` that isn't a real 6-digit hex code (missing, or a color name instead) — renders as a placeholder gray block, effectively no color at all.
