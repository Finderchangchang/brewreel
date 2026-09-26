# 软件行业的预期校验结果

行业规则引擎对软件行业的预期行为（见 `tests/rules/software/*.json`，用 `node scripts/test-rules.mjs software` 跑）：

- `00-compliant.json`：用既有 11 个镜头写的软件宣传片，不触发任何行业规则（block/warn/human 全部为 0）。
- `01-disabled-shot.json`：即使是软件行业，`beforeAfter` 仍然被 `_base` 默认禁用（它是美业专属），命中「software」行业不开放镜头 beforeAfter。
- `02-base-contact.json` / `03-base-medical.json`：`_base/rules.json` 里的通用规则（站外导流 `B-contact`、医疗用语 `B-medical`）对软件行业同样生效，说明"跨行业通用"规则不因为 `meta.industry` 缺省或等于 `software`而被跳过。

`examples/*.json` 三份既有样例过校验时出现的其它提示（如字幕相似度、`meta.action` 相关检查）来自 `scripts/validate.mjs` 主体和 `scripts/lib/text-checks.mjs`，不属于本行业包（`scripts/lib/industry.mjs`）的职责范围。
