# dataChart · data story card

**One shot, one data argument:** the title sets the scope, the takeaway states the conclusion, KPIs surface key readings, the chart shows evidence, annotations clarify the basis, and the footer names the source. A common sequence is hook → dataChart → product demonstration → endCard.

```json
{"type":"dataChart", "dur":4, "caption":"A few sample expenses,\n{the pattern is clear}", "mood":0.35,
 "params":{"title":"Sample ledger entries", "takeaway":"Delivery is the largest sample category", "chartType":"donut",
   "kpis":[{"label":"Largest item","value":"¥860"},{"label":"Budget used","value":"62%"}],
   "data":[{"label":"Delivery","value":860},{"label":"Tea and coffee","value":326},{"label":"Auto-renewal","value":98},{"label":"Late ride","value":410}],
   "unit":"yuan", "annotations":["Fictional ledger, for chart layout only"], "refs":["f1","f2"]}}
```

The complete validated demo is `examples/ledger.json`. Sample values require `meta.demoData: true`, a `meta.disclaimer` that says they are examples, and matching fact references. For real content, cite the real brief. Every chart value must appear in the cited fact text; do not present derived totals as source values.

## Choose a chart

- `bar`: compare categories or ranks.
- `line`: show a trend; order values chronologically.
- `dot`: compare categories on a shared horizontal scale with direct value labels.
- `stacked`: show composition; repeat a category label and use `series` to identify segments. Each bar is normalized to 100%; segment labels show raw values. Bar lengths do not compare totals.
- `donut`: show part-to-whole shares; keep to five categories or fewer.

Each shot supports up to 6 data rows, 3 KPIs, and 2 annotations. `data` rows use `{label,value,series?}`. `unit` labels the values; `max` sets a custom axis limit.

## Visual rules

Omit `palette` to use the theme's `chartColors` (when the theme in `core/themes.json` defines them) or the default `micro` palette otherwise; supply `palette` to select an explicit palette. Brand color still overrides the focal color.

The scope title uses 30 px, the takeaway 44 px, KPI numbers 52 px, and labels/sources 28–30 px. Line charts include zero, midpoint, and upper ticks. Dot charts compare categories from zero. A series keeps the same color in every segment and its legend; focusing a row within a series highlights that entire series. The donut center names the focused category and its share, falling back to the largest category when no focus is supplied.

The chart sits on a stable paper card so readings do not change color with `mood`. The default `micro` palette adapts the project's supplied MicroPalettes references into ink navy, berry, muted blue, and lavender, with narrow paper gaps between donut slices. Other choices are `mono` (ink grays), `porcelain` (ordered single hue), `palm` (muted greens/yellows with an amber focal color), and `wire` (grayscale with one orange focal color). Set `focus: true` on a data row to use the palette focal color; `meta.brandColor` still overrides the focal color. Other series colors distinguish data; they do not carry good/warn/bad semantics. Theme mood gradients and brand color overrides remain managed by the existing theme system.

`refs` accepts 1–2 fact IDs, resolves them to `meta.facts[].source`, and renders the sources in the card footer. Annotations clarify scope or limitations but do not replace a source. Use `endCard` for the closing brand, slogan, and CTA.
