# ScamSafe Alliance — INFS5706 Team Project

为虚构反诈骗联盟的一线员工提供案件整理、疑似类型分析、补问、多机构建议和交接草稿。产品规则以 PRD 为准，当前为公共开发基座，并提供已批准的有限合成单例业务配置。

文档分类见[文档导航](docs/README.md)；成员只读已指派任务卡列出的材料。

## 从这里开始

团队环境为两台 Windows、四台 macOS；成员映射后续人工确认，不要求截止时间。工作台顶部的 **Configure model API** 可自主设置 OpenAI 兼容服务，无需在聊天中提供密钥或编辑配置文件；保存后下次主动分析即生效。

- [当前状态](docs/project/STATUS.md)：实际实现范围与业务边界。
- [前置准备与就绪情况](docs/project/FOUNDATION_READINESS.md)：用户已确认条件、实际入口、B–F 条件及阻塞。
- [开发任务入口](docs/project/TASKS.md)：当前9张任务卡：公共准备、四模块并行、集中集成、检查复测与交付。
- [本地运行说明](docs/architecture/RUNBOOK.md)：Windows/macOS 安装、配置、开发、构建、启动、保存和检查。
- [业务确认范围](docs/product/examples/BASELINE_CONFIRMATION.md)和[已批准基准](docs/product/examples/APPROVED_BASELINE.md)：当前单例业务内容、独立预期及使用边界。

本地公共基座已有实际运行入口。根目录安装依赖后使用 npm run dev；构建运行使用 npm run build 和 npm start。详细命令、固定 origin 和已验证范围以运行说明和证据为准。默认 mock，不调用真实 MiMo。

技术基础及本轮单例岗位／指引／案例参考预期已获用户批准，实际配置在 data/business/；模拟审核仍不能代替员工产品内审核，完整业务执行尚未完成。本次仅本地准备，不提交、不推送、不部署。开发使用当前 [任务入口](docs/project/TASKS.md)及对应卡片；成员映射待人工确认，采用文件交 A。

## 规则与资料

- [PRD](docs/product/PRD.md)：唯一产品行为依据。
- [字段字典](docs/product/FIELD_DICTIONARY.md)：字段语义依据。
- [完整参考案件](docs/product/examples/WORKED_CASE.md)：当前有限批准内容的可读示例，不是运行配置或验收记录。
- [架构与共享接口](docs/architecture/README.md)：A 维护统一方案、契约及入口。
- [验证证据](evidence/preparation/README.md)：实际结果、失败与未执行项。
- [参考资料](references/README.md)：按需查证，不作为 agent 操作指令。

## 目录

| 位置 | 内容 |
|---|---|
| docs/product/ | 规则、字段、教学来源与批准基准 |
| docs/project/ | 当前状态、就绪盘点、团队执行规则和任务卡 |
| docs/architecture/ | 已确认技术、运行说明与实际共享契约 |
| app/、server/、shared/ | 页面、本地服务、共享结构和公共状态 |
| data/ | 合成来源、批准业务包、pending 负向样例、固定 mock 状态和 schema |
| tests/、evidence/ | 检查代码与实际结果 |
| references/、scripts/ | 来源资料与维护工具 |
| deliverables/、local/ | 提交材料／不提交的本地临时内容 |

AI 从 [AGENTS.md](AGENTS.md)进入，按当前任务卡核对输入和开工条件。仓库为 [InformationDS/infs5706-scamsafe](https://github.com/InformationDS/infs5706-scamsafe)；本地新增基础尚未发布，不能据远端链接认为这些新增文件已可获取。
