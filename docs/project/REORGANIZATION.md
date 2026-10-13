# 目录整理记录

日期：2026-10-13（Australia/Sydney）。用户授权按已讨论方案调整本地目录。

## 原有文件的去向

| 原位置 | 新位置 |
|---|---|
| `ScamSafe_Prototype_PRD_工作稿.md` | `docs/project/archive/`；正式规格汇总到 `docs/product/PRD.md` |
| `ScamSafe_字段字典_v1.md` | `docs/product/FIELD_DICTIONARY.md` |
| `PROJECT_STATUS.md`、`TASKS.md` | `docs/project/STATUS.md`、`docs/project/TASKS.md` |
| 作业指南 PDF／Markdown | `references/assignment/` |
| ACCC PDF／Markdown、49 页图 | `references/accc/` |
| UNSW 原网页与转换资料 | `references/unsw/` |
| 下载与转换校验记录 | `evidence/reference-conversion/` |
| 资料转换脚本 | `scripts/references/`，已修复目录依赖 |
| 其余临时文件 | `local/reference-work/`，Git 忽略 |

73 个原有文件移动时均通过 SHA256 比对。未删除原始资料。后续只编辑需更新的文档链接、入口、脚本路径和日志路径；原始 PDF／PNG／HTML 继续进行哈希验证。

## 新增说明与协作结构

根目录提供 README、AGENTS、AI_START_HERE、CONTRIBUTING 和 Git 忽略规则。docs 下分产品、架构、项目状态；data、app、server、tests 等提供职责说明，明确当前未实现内容。Issue／PR 模板已写入 `.github/`。

入口文件的读取顺序和资料链接已同步；归档草稿明确标为历史资料。字段定义、源文档页码、页图和本地链接由仓库检查工具验证。

## 验证与后续

- [迁移记录](../../evidence/reference-conversion/layout_migration.json)：原／新路径、字节数和移动时哈希。
- [最近仓库检查](../../evidence/reference-conversion/repository_check.json)：实际检查结果。
- [任务交接](TASKS.md)：TASK-002／TASK-003 与未完成依赖。

本次检查不证明应用功能或模型效果。GitHub、运行代码、配置和应用测试的真实状态见 [STATUS.md](STATUS.md)。

## 后续用户授权清理

首次迁移完成后，用户于同日要求删除 UNSW 目录及两份原 PDF。原始资料全部保留的描述仅指首次迁移时的状态；当前保留项见参考资料索引。授权删除已写入 [删除记录](../../evidence/reference-conversion/user_requested_removals.json)，检查不将其报告为意外丢失。
