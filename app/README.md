# 工作台公共基座

运行见 [RUNBOOK](../docs/architecture/RUNBOOK.md)，当前能力与限制见 [就绪情况](../docs/project/FOUNDATION_READINESS.md)。页面为合成 mock 开发入口；已批准业务基准卡通过 GET /api/business 读取实际批准包，原模拟案件仍使用停用的教学岗位。

| 文件 | 用途 |
|---|---|
| src/main.tsx | React 挂载入口 |
| src/Workbench.tsx | A 维护固定状态加载、统一操作、适配器对照和保存恢复 |
| src/components/ModelSettings.tsx | 产品内 API 设置、密钥留空保留／明确清除、保存状态；密钥不回填 |
| src/components/CasePanel.tsx | B 的事实展示／更正起点 |
| src/components/AnalysisPanel.tsx | B 的候选分析与补问展示起点 |
| src/export/OutputPanel.tsx | E 的预览、复制与基础下载入口 |
| src/storage.ts | A 维护 IndexedDB 及 JSON 备份／恢复 |

组件接收共享结构与回调，不自行定义一套案件、权限或审核状态。固定输入使用 shared/fixtures.ts 与 data/fixtures/；原 handover 保留 pending 模拟状态，当前批准参考正文另见 data/business/T09.json。修改展示不等于实现 PRD 全流程。具体修改范围见[任务入口](../docs/project/TASKS.md)中的B01、C01、D01、E01；A01准备独立预览及注入接口，四人完成模块内逻辑与绑定，A02装配主页面。
