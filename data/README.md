# 数据与配置入口

| 位置 | 当前用途 |
|---|---|
| [business/](business/README.md) | 当前已批准的有限合成岗位、指引和T09参考；唯一批准登记在此 |
| [fixtures/](fixtures/README.md) | 固定模拟状态；不作为真实员工审核 |
| [evaluation/](evaluation/README.md) | 固定验收输入与独立预期，执行证据不放这里 |
| [schemas/](schemas/README.md) | 从共享定义生成的结构；程序仍检查跨字段规则 |
| [roles/](roles/README.md)、[guidelines/](guidelines/README.md) | pending负向样例及当前业务包入口，不是有效配置加载位置 |

实际实现见[STATUS](../docs/project/STATUS.md)，当前任务见[TASKS](../docs/project/TASKS.md)。A维护结构与批准登记；成员只读取卡中列出的数据，不自行扩权限、刷新批准哈希或复制模型输出作为预期。
