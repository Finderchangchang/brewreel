# general 回归预期

- `tests/rules/general/01-base-only.json`：`酒驾` 命中 `_base` 的 `B-alcohol`；`治疗` 命中 `B-medical`。`开车出发`、`酒后不开车` 不命中。不跑电商的 `E-alcohol`。`steps` 不因名单被禁。`mockApp` 不按实物行业拦截。`human` 里有「不能把校验通过当成已经合规」。
- `beforeAfter` 仍被 `_base` 禁用。本包的 `enabledShots` 没有把它重新开放。
