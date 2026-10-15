# TASK-012：六人分工与执行规则

- 日期／时区：2026-10-15，Australia/Sydney。
- 执行者：当前文档编写会话；不代表已指定 B–F 的真实成员。
- 工作包：TASK-012，详细执行规则与交接模板。
- 分支：docs/team-execution-rules。
- 状态：文档完成，待团队审核；未合并至 main。

## 已完成与文件

- TEAM_EXECUTION.md：A–F 六个角色、24 个工作包、九个里程碑、接口归属、审核／合并、测试、AI 启动和交接规则。
- handoffs/README.md 与 TEMPLATE.md：每个工作包独立记录，A 在集成时汇总。
- TEAM.md、TASKS.md、STATUS.md：角色占位、工作包映射及分支工作状态。
- 根 README、AI_START_HERE、CONTRIBUTING、AGENTS：入口与读取／更新规则。

## 契约和范围

未改变产品 PRD、117 个字段语义或任何运行接口。新模块路径是拟定归属，不是已创建的应用代码。没有邀请成员、分配实际 GitHub Issue、安装框架或调用模型。

## 验证

文档验证使用 `python scripts/maintenance/check_repository.py --report evidence/reference-conversion/repository_check.json` 和 `git diff --check`；最近检查见 [校验记录](../../../evidence/reference-conversion/repository_check.json)。另检查六个角色各四个唯一工作包和 M1–M9 九个里程碑。没有运行应用测试。

## 后续

团队核对分工后填入真实姓名／GitHub 用户名及时间安排。A 组织技术栈和共享接口，随后按工作包创建任务 Issue。保留尚未实现和未验证状态，不把文档 PR 当成应用交付。
