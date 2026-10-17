# 验证证据入口

| 位置 | 用途 |
|---|---|
| [preparation/](preparation/README.md) | 公共基座已有实际结果，不能继承为成员任务通过 |
| [documentation-optimization/](documentation-optimization/README.md) | 本轮文档、任务定义及来源维护检查 |
| [task-restructure/](task-restructure/README.md) | 任务结构检查证据，不是任务执行 |
| [test-results/](test-results/README.md) | 应用验收证据索引 |
| task-results/任务编号/执行批次/ | 成员实际执行、失败和复测；由任务首次运行时创建 |
| [reference-conversion/](reference-conversion/) | 资料来源、转换及完整性检查 |
| [ai-usage/](ai-usage/README.md) | 关键选择、失败和修订的必要脱敏证据 |

任务只写自己的目录；不覆盖preparation或另一任务证据。当前实现和未执行项见[STATUS](../docs/project/STATUS.md)。密钥、实际个人信息、私人完整会话和本地案件不进入共享证据。
