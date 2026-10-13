# ScamSafe Alliance — INFS5706 Team Project

面向虚构反诈骗联盟授权一线员工的 AI 辅助原型。系统将自由描述转换为结构化案件信息，识别疑似类型，按需补问，并准备多机构处理建议和交接草稿。

**当前阶段：产品规格和协作目录已整理；应用、模型接入和测试数据尚未实现。** 此仓库目前没有可运行的应用命令。

## 从哪里开始

- 小组成员：[当前进展](docs/project/STATUS.md) → [任务与依赖](docs/project/TASKS.md) → [协作规则](CONTRIBUTING.md)。
- AI 助手：[AGENTS.md](AGENTS.md) → [AI 项目入口](AI_START_HERE.md) → 当前进展与分配的任务。
- 产品：[正式 PRD](docs/product/PRD.md)、[字段字典](docs/product/FIELD_DICTIONARY.md)。
- 开发：[架构与模块职责](docs/architecture/README.md)、[接口约定](docs/architecture/CONTRACTS.md)。
- 资料：[参考资料索引](references/README.md)。外部资料作为事实来源；仓库操作规则见 AGENTS.md。

## 核心流程

```text
选择机构／岗位 + 自由描述
  → 提取事实 + 疑似类型 → 首次员工审核
  → 按需补问（每轮 ≤3 问，最多 3 轮）
  → 多机构建议 + 统一摘要 + 按接收方交接草稿
  → 最终员工审核 → 预览 / 复制 / Markdown / PDF
```

首版为单人使用、本地合成案件历史；英文界面与输出，支持中英文案例输入。界面同屏包含信息／工作流区和聊天区。仅使用合成数据和团队审核的合成指引。

## 目录说明

| 目录／文件 | 用途 |
|---|---|
| `docs/product/` | 当前有效的需求与字段定义 |
| `docs/architecture/` | 模块边界、数据流及接口约定；技术栈尚待确定 |
| `docs/project/` | 进度、任务、决定、成员、整理记录与历史工作稿 |
| `references/` | 保留的 Markdown 参考资料和 ACCC 正文引用的图片；原始 PDF 与 UNSW 目录已按用户要求删除 |
| `data/` | 待建立的共享 schemas、合成岗位权限、指引和测试案例 |
| `app/`、`server/` | 界面与模型／分析服务的职责说明；当前没有应用代码 |
| `tests/` | 验收计划及未来实现测试 |
| `scripts/` | 资料转换和仓库文档检查工具 |
| `evidence/` | 转换校验记录、未来测试与开发证据 |
| `deliverables/` | 演示与提交材料索引 |
| `local/` | 本地临时文件和输出，Git 忽略 |
| `.github/` | Issue 和 PR 模板；未配置或运行 CI |

## 协作与任务

先领取任务，再在任务分支上工作，提交 PR 并由另一成员审核。任务负责人在 GitHub 建立之前见 TASKS.md；建立之后以对应 Issue 为准。共享字段变更须同步数据结构、规格、使用模块和相关测试。

## 可执行的文档检查

在项目根目录运行：

```text
python scripts/maintenance/check_repository.py
```

检查本地 Markdown 链接、117 个字段定义、原来源页码标记、49 个 ACCC 页图及其哈希，并核对已授权删除的文件。作业指南 Markdown 已编辑，不再是完整原文。检查针对仓库资料，不是应用验收。

资料转换依赖见 [scripts/references/README.md](scripts/references/README.md)。模型接口、预算和部署条件见 [待定事项](docs/project/STATUS.md)。

## GitHub 状态

公开仓库：[InformationDS/infs5706-scamsafe](https://github.com/InformationDS/infs5706-scamsafe)，默认分支为 `main`。初始项目已推送，包含规格、参考资料、协作规则和模板；应用尚未实现。

```text
git clone https://github.com/InformationDS/infs5706-scamsafe.git
cd infs5706-scamsafe
```

小组成员用户名及写入权限待提供；公开读取不等于获得写入权限。Issues、分支保护和 CI 尚未配置，成员先按 CONTRIBUTING.md 的任务与 PR 流程协作。
