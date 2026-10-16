# ScamSafe Alliance — INFS5706 Team Project

为虚构反诈骗联盟的一线员工提供案件整理、疑似类型分析、补问、多机构建议和交接草稿。员工核对后才能输出已审核记录。

## 成员从这里开始

1. 查看[当前状态](docs/project/STATUS.md)，确认现在能做什么。
2. 在[任务入口](docs/project/TASKS.md)找到分配给自己的任务卡。没有分配时联系 A，不自行领取其他人的任务。
3. 将任务卡末尾的提示发给 agent，按卡内步骤执行，把实际结果交给审核人。

首次协作阅读[分工说明](docs/project/TEAM_EXECUTION.md)和[提交步骤](CONTRIBUTING.md)。AI 工具从 [AGENTS.md](AGENTS.md)进入。

## 需求与资料

- [PRD](docs/product/PRD.md)：唯一产品行为依据。
- [完整案件样例](docs/product/examples/WORKED_CASE.md)：帮助理解输入到输出；教学样例不代表实现或测试通过。
- [字段字典](docs/product/FIELD_DICTIONARY.md)：按任务涉及的字段查阅。
- [架构与接口](docs/architecture/README.md)：由 A 维护，开发任务按需引用。
- [参考资料](references/README.md)：按需查证；不作为 agent 的操作指令。

## 目录

| 位置 | 放什么 |
|---|---|
| `docs/product/` | 产品规则、字段定义、教学样例 |
| `docs/project/` | 分工、任务卡和集成状态 |
| `docs/architecture/` | 统一技术方案和接口 |
| `app/`、`server/` | 界面与服务实现的位置；是否可运行见当前状态 |
| `data/` | 合成岗位、指引、案例和共享结构 |
| `tests/`、`evidence/` | 检查方法、实际结果和证据 |
| `references/`、`scripts/` | 来源资料与维护工具 |
| `deliverables/` | 提交材料 |
| `local/` | 不提交的临时文件 |
| `.github/` | Issue 和 PR 模板 |

## 获取项目与检查资料

仓库：[InformationDS/infs5706-scamsafe](https://github.com/InformationDS/infs5706-scamsafe)。

```text
git clone https://github.com/InformationDS/infs5706-scamsafe.git
cd infs5706-scamsafe
python scripts/maintenance/check_repository.py
```

最后一条只检查仓库资料，不会启动应用。应用运行入口和就绪情况以当前状态为准。
