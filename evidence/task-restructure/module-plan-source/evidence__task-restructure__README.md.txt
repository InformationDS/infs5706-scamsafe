# 任务定义验证

本目录记录当前任务说明的检查，不是开发任务的执行或验收结果。实际成员、状态和结果只在各任务卡唯一执行记录维护。

- 当前任务为19张，入口见[任务索引](../../docs/project/TASKS.md)；tasks目录只保留当前A–F卡，不保留其他执行卡或模板。
- 路径、依赖图、生产者依赖、FR-01–FR-12覆盖与当前文档任务引用检查：`python scripts/maintenance/check_tasks.py --report evidence/task-restructure/tasks-check.json`，结果见[tasks-check.json](tasks-check.json)。
- Markdown链接、字段和来源资料检查：`python scripts/maintenance/check_repository.py --report evidence/task-restructure/repository-check.json`，结果见[repository-check.json](repository-check.json)。
- 来源片段／哈希检查：`python scripts/maintenance/check_preparation.py --report evidence/task-restructure/source-check.json`，结果见[source-check.json](source-check.json)。来源文件仅清除执行指向、明确来源身份；业务片段与批准包不变，哈希按实际文件更新。
- 业务包检查：`npm run check:business`；独立记录在business-check.txt，不代表业务流程验收。
- 程序／构建回归和独立目录浏览器检查：见runtime-check.txt、build-check.txt及browser/browser-check.json。浏览器工具仅增加可选证据输出目录，默认行为不变；任务内使用指定目录以免覆盖公共基座证据。
- 检查器负向验证与文本检查分别见negative-checks.json及text-check.json。

所有报告均以实际输出为准。未运行新卡的开发内容、未分配成员、未调用真实模型、未执行macOS实机验收；未提交、推送或部署。
