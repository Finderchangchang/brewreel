# dataChart · data story card

**One shot, one data argument:** the title sets the scope, the takeaway states the conclusion, KPIs surface key readings, the chart shows evidence, annotations clarify the basis, and the footer names the source. A common sequence is hook → dataChart → product demonstration → endCard.

```json
{"type":"dataChart", "dur":4, "caption":"A few sample expenses,\n{the pattern is clear}", "mood":0.35,
 "params":{"title":"Sample ledger entries", "takeaway":"Delivery is the largest sample category", "chartType":"donut",
   "kpis":[{"label":"Largest item","value":"¥860"},{"label":"Budget used","value":"62%"}],
   "data":[{"label":"Delivery","value":860},{"label":"Tea and coffee","value":326},{"label":"Auto-renewal","value":98},{"label":"Late ride","value":410}],
   "unit":"yuan", "annotations":["Fictional ledger, for chart layout only"], "refs":["f1","f2"]}}
```

`examples/ledger.json` uses a meter, not this shot. Sample values require `meta.demoData: true`, a `meta.disclaimer` that says they are examples (`sample` / `demo` / `演示` / `示例`), and matching fact references. For real content, cite the real brief. Every chart value must appear in the cited fact text; do not present derived totals as source values. The qualifier check counts chart values together with their unit, so a trend labelled in times or days is not blocked by mistake.

## Choose a chart

- `bar`: compare categories or ranks. Labels are at most 12 characters; the column is wide enough for that and does not ellipsize.
- `line`: show a trend; order values chronologically. Every series uses the same labels in the same order. The x-axis labels are drawn once, ticks are whole numbers, and value labels on two lines sit on opposite sides of the points.
- `dot`: compare categories on a shared horizontal scale with direct value labels. Ticks are whole numbers. Labels are at most 12 characters and are given that width.
- `stacked`: show composition; repeat a category label and use `series` to identify segments. Every category must have the same number of segments; write `value: 0` for a missing one. Each bar is normalized to 100%; a segment label is drawn only when it fits. Bar lengths do not compare totals.
- `donut`: show part-to-whole shares; keep to five categories or fewer. Labels are at most 12 characters.

Each shot supports up to 6 data rows, 3 KPIs, and 2 annotations. `data` rows use `{label,value,series?}`. `unit` labels the values; `max` sets a custom axis limit.

## Visual rules

Omit `palette` to use the theme's `chartColors`. A theme without `chartColors` gets a series chosen to contrast at least 3:1 with the card, not a fixed `micro` palette. Supply `palette` to select an explicit palette. Brand color still overrides the focal color.

The scope title uses 30 px, the takeaway 44 px, KPI numbers 52 px, and labels/sources 28–30 px. When there are many rows the plot shrinks so KPIs and annotations stay clear. Line and dot ticks run from zero to a rounded upper bound and mark zero, the midpoint, and the top. A series keeps the same color in every segment and its legend; focusing a row within a series highlights that entire series. The donut center names the focused category and its share, falling back to the largest category when no focus is supplied. The source line, the axis caption, and the stacked note "each bar = 100%" follow `meta.lang`.

The chart sits on a stable paper card so readings do not change color with `mood`. An explicit `palette: "micro"` adapts the project's supplied MicroPalettes references into ink navy, berry, muted blue, and lavender, with narrow paper gaps between donut slices. Other choices are `mono` (ink grays), `porcelain` (ordered single hue), `palm` (muted greens/yellows with an amber focal color), and `wire` (grayscale with one orange focal color). Set `focus: true` on a data row to use the palette focal color; `meta.brandColor` still overrides the focal color. Other series colors distinguish data; they do not carry good/warn/bad semantics. Theme mood gradients and brand color overrides remain managed by the existing theme system.

`refs` accepts 1–2 fact IDs, resolves them to `meta.facts[].source`, and renders the sources in the card footer. Annotations clarify scope or limitations but do not replace a source. Use `endCard` for the closing brand, slogan, and CTA.
