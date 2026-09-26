# 测试简报：软件产品

软件行业沿用第一阶段已有的三份样例简报和分镜，不重新写一份：

- `examples/jev.json`：C 端情感类（聊天演示 → 对比 → 仪表 → 快切 → 片尾）
- `examples/ledger.json`：工具提效类（痛点快切 → 对比 → mockApp 演示 → 数字 → 片尾）
- `examples/meeting.json`：B 端办公类（截图圈注 → 模拟界面 → 数字 → 步骤 → 片尾）

`tests/rules/software/` 下的 4 个校验样例只测行业规则引擎本身（新镜头禁用、`_base` 通用规则同样管软件行业），不重复测字数/断词/相似度这些已经在 `scripts/validate.mjs` 主体覆盖的规则。
