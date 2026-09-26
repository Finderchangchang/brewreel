# meter gauge / score

One card: the gauge's name is at the top, a needle springs from a starting value to the target value in the middle, on the beat it lands the number bumps, a verdict pill pops up, and a hit sound plays; the next beat a closing line fades up from the bottom of the card (a skeleton bar "loads" before that). Colors are automatic by band: the riskier it gets the redder, or the better it gets the greener.

## When to use

- Turning a judgment into a number for the viewer: risk level, danger, match score, health score, efficiency, satisfaction.
- As a pain-point shot (`higherIs=bad`, high value, high mood) or a product-result shot (`higherIs=good`, high value, low mood).
- To show "from bad to good": set `from` to the old value and `value` to the new one (e.g. risk 8 → 2).

## When not to use

- Don't force a score onto something that isn't really scoreable — use features / quickList instead.
- Comparing two options: use compare (each side already has its own small scale bar).
- A large real-world number (like $12,800 or 3 hours): use counter.

## Params

| Field | Required | Limit | Notes |
|---|---|---|---|
| value | Yes | 0–1000 | Target value; don't exceed `max` (it gets clamped to `max` if you do) |
| label | Yes | 8 chars | The gauge's name, e.g. "Risk level," "Match score" |
| max | No | 1–1000 | Max value, defaults to 10. Integers 1–10 look best (gauge draws numbered segments); write 100 for a percentage |
| from | No | 0–1000 | Where the needle starts, defaults to 0 |
| unit | No | 3 chars | Unit, e.g. "pts," "%"; if unset it shows "/max" |
| style | No | — | `gauge` half-circle dial (default) / `ring` donut (percentage, completion) / `bar` horizontal bar |
| higherIs | No | — | `bad` higher = redder (default) / `good` higher = greener |
| word | No | 4 chars | The verdict pill under the number, e.g. "High risk," "Great match" |
| note | No | 14 chars | One line of explanation at the bottom of the card |
| icon | No | icon name | Icon before the gauge name, defaults to `alert` for bad / `star` for good |

## Duration

2–6s, defaults to 3s. 3s works well: enter → needle lands at 1s → verdict appears at 1.5s → 1s left to read it.

## Good examples

```json
{"type": "meter", "dur": 3, "caption": "There's more edge to that line\n{than you'd think}", "mood": 0.9,
 "params": {"value": 8, "max": 9, "label": "Risk level", "higherIs": "bad", "word": "High risk", "note": "They're checking if you care"}}
```

```json
{"type": "meter", "dur": 3, "caption": "Resume vs. the role,\n{the fit at a glance}", "mood": 0,
 "params": {"value": 92, "max": 100, "unit": "%", "style": "ring", "label": "Resume match", "higherIs": "good", "word": "Great fit", "note": "Covers 9 of the key skills"}}
```

```json
{"type": "meter", "dur": 3, "caption": "After the rewrite,\n{the risk drops}", "mood": 0.5,
 "params": {"from": 8, "value": 2, "max": 10, "style": "bar", "label": "Contract risk", "higherIs": "bad", "word": "Low risk", "note": "3 clauses flagged with fixes"}}
```

## Bad examples

- `"value": 12, "max": 10` → over the max, the needle stops at 10 and the number doesn't match what's shown.
- `"label": "How risky is this particular message"` → over 8 chars, gets blocked by validation.
- A score with no basis, paired with `note: "Completely safe"` → an absolute claim, gets blocked.
