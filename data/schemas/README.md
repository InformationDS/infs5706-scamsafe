# 共享机器结构

唯一源为 shared/schema.ts（Zod），公共导出为 shared/index.ts。根目录执行 `npm run schemas` 生成以下文件：

- CaseRecord.schema.json
- AnalysisResult.schema.json
- AnalysisEnvelope.schema.json
- ExportSnapshot.schema.json
- RoleProfile.schema.json
- Guideline.schema.json
- Recommendation.schema.json
- HandoverDraft.schema.json
- Summary.schema.json

字段映射和函数边界见 [CONTRACTS](../../docs/architecture/CONTRACTS.md)。这里九份 schema 用于原模拟基座；岗位／指引仅允许 pending 且 disabled，最终审核仅模拟。当前已批准业务包使用 shared/business.ts 的独立结构；同一生成命令另输出五份 schema 到 [business/schemas](../business/schemas)，不将旧模拟审核自动升级为真实审核。

`npm run check` 执行 Zod 和核心操作校验。JSON Schema 表达字段形状；问题计数、重复目标、来源引用、版本依赖、审核门槛等还需运行时检查，不能仅靠 JSON 文件宣称通过。不要手改生成文件，A 应从唯一源同步修改并重建固定样例。
