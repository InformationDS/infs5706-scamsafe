# 共享数据与模块接口

本文件描述实际公共基座。产品规则以 [PRD](../product/PRD.md) 为准，字段语义以 [FIELD_DICTIONARY](../product/FIELD_DICTIONARY.md) 为准。当前仅支持合成开发数据。data/business/ 是独立的已批准配置包；原 CaseRecord／fixtures 仍为 pending、岗位停用、审核为模拟，不能直接开展正式业务验收。

## 唯一结构与字段映射

入口为 shared/index.ts；Zod 定义在 shared/schema.ts，程序操作在 shared/core.ts。`npm run schemas` 生成 data/schemas/ 中九个 JSON Schema；运行时仍须 Zod 和核心函数执行跨字段／依赖检查。

| 对象 | 实际关键属性 | 字典关系与限制 |
|---|---|---|
| CaseRecord | schemaVersion, caseId, evaluationId, version, stage, role, facts, analysis, followUp, outputs, reviews, saved, needsFactConfirmation, error? | caseId 对应 A01，version 对应 A08；evaluationId:T09 是评估编号，不能充当案件编号；stage 为开发展示标签 |
| FactRecord | fieldId, recordId?, value, version, status, reviewStatus, sourceIds, candidates, history | fieldId 使用字典实际编号；重复记录靠 fieldId＋recordId 定位；基座仅填单例涉及字段，非全部 117 项实现 |
| AnalysisResult | version, basedOnCaseVersion, source, types, reasons, alternatives, gaps, facts, guidanceStatus, recommendations | 候选类型等对应 K 组；guidanceStatus:unapproved，recommendations:[]；模型事实由公共合并函数处理 |
| Question／followUp | id, round, target, text, reason, status, answer, history；rounds, totalQuestions, stopped, questions | 目标是字段＋适用记录；最多 3 轮、每轮 3 问、全案 9 问；部分回答不新增轮次 |
| RoleProfile | id, version, organisation, title, permissions, recipients, contentApproval, enabled, synthetic | 案件的岗位上下文来源，不由模型推断；当前强制 pending／false／true |
| Guideline | id, version, roleId, required, requiredContext, allowedUnknown, step, limits, onMismatch, humanEscalation 及批准／启用标记 | 此项为旧 pending 模拟格式；批准指引由独立业务包加载，尚未接入完整匹配器 |
| OutputRecord | id, kind, version, title, body, dependencies, contentApproval | 统一摘要／交接稿的开发正文结构；有指引建议与接收方生成未实现 |
| Recommendation | id, version, responsibleRole, step, priority, dependencies, factRefs, guidelineRefs, limits, decision, decisionReason, simulated, contentApproval | 建议结构已定义；改动／拒绝需理由；只允许模拟且 pending，当前固定案件不加载建议 |
| Summary／HandoverDraft | OutputRecord 正文；handover 另含 recipient、recommendationIds | 独立摘要不得带接收方；交接稿接收方来自配置且引用建议须存在；固定 handover 引用列表为空，仅教学排版 |
| ReviewRecord | stage, objectId, objectVersion, dependencies, simulated | stage:first/final；不伪造员工姓名或日期；不是正式 O 组审核完整实现 |
| ExportSnapshot | 案件／对象编号与版本、title, body, dependencies, review 和模拟标记 | 同一正文供复制／Markdown／PDF；simulated:true 不代表业务已批准 |

未知值保存 null 并配提取状态，否定为 false，不适用为 not-applicable，冲突为 conflict 且保留候选。金额、币种和状态分别记录；来源如 S1–S5、原问题编号只是引用定位，不是已核实证据。

## 实际公共函数

| 调用 | 边界 |
|---|---|
| makeFixture(name)、fixtureNames | 统一固定状态，见 [fixtures 说明](../../data/fixtures/README.md)；是开发输入，不是业务控制器 |
| correctFact(record,target,value,reason) | 更正需要理由，保留历史并递增事实版本；首次核对后提示变化需确认 |
| confirmFacts(record) | 保留模拟首次核对历史，不构成外部事实证明 |
| mergeAnalysis、applyAnalysisResult | 基于案件版本和当前请求 ID；拒绝过期结果、未知来源和越权字段；更正值遇模型不同值保留冲突 |
| addQuestionRound(record,questions,displayedAndSaved) | 低层计数入口；调用者须实际完成展示和保存后才能传 true，失败不得消耗计数；保留稳定问题 ID |
| answerQuestion、stopFollowUp | 回答只更新对应目标；未知不造值，主动结束后不新开轮次，后补回答保留历史 |
| groupAmounts | 按币种与交易状态分组，缺金额／币种单列，不换汇、不标为确认损失 |
| currentDependencies、dependenciesCurrent、isReviewValid | 使用 fact:字段:记录、analysis、role、output:编号 等版本依赖；对象实际依赖变化才使对应审核失效 |
| replaceOutput、reviewOutput、markSaved | 输出内容变化递增版本；模拟最终核对必须基于已保存且依赖当前的输出；保存成功由实际存储结果决定 |
| buildSnapshot(record,objectId) | 拒绝未保存、待核对事实、过期或缺少最终模拟审核的输出；快照保留未批准标记 |
| snapshotToMarkdown/Html、snapshotFilename | 位于 shared/export.ts，共用快照；HTML 转义正文，不执行输入 HTML |

app/src/storage.ts 提供 saveCase/loadCase、backupCase/parseBackup。IndexedDB 数据库为 scamsafe-foundation、版本 1、对象仓库 cases；当前只恢复 EXAMPLE-01。备份包含 kind、schemaVersion、record；恢复后为未保存，须再保存才能输出。

## HTTP 边界

服务实现 server/src/app.ts，适配器为 server/src/model.ts。只接受本机 Host 与允许 origin；JSON 请求限制 1 MB。

| 方法与路径 | 输入 | 输出 |
|---|---|---|
| GET /api/business | 无 | 当前批准登记、岗位、三条指引和 T09 单例参考；校验 artifact 哈希与跨引用，不返回凭证 |
| GET /api/health | 无 | ok, mode, configured, contentApproval；不返回凭证 |
| GET /api/settings/model | 无 | mode、baseUrl、model、authHeader、authScheme、timeoutMs、hasApiKey；不返回密钥或端口 |
| PUT /api/settings/model | 模式、基地址、模型、认证参数、超时；apiKey 可选，clearApiKey 显式清除 | 校验与本地保存成功后返回脱敏设置；留空保留密钥；不发模型请求 |
| POST /api/analyze | case:CaseRecord；fault 可选 timeout／invalid／delayed | analysis 及 meta:mode,providerCalled,requestId,caseVersion,contentApproval；fault 仅 mock 可用 |
| POST /api/export | case:CaseRecord、objectId、format:markdown／pdf；mock 可选 fault:failure | 对象对应 .md 或 .pdf；服务重新构建并校验快照，不接收任意 HTML；故障触发返回可重试的 EXPORT_FAILED，不改变案件与审核 |

错误统一为 error:{code,message,retryable}。主要状态：400 输入／JSON；403 Host／origin；409 导出审核门槛；413 超限；422 非固定 mock 输入；502 无效模型输出／服务错误；503 配置缺失／PDF 不可用；504 超时。失败不替换已保存数据，错误不回显密钥或提供商原始正文。

默认 mock 只接受固定事实集合，不能用固定响应冒充任意输入分析。live 入口发送 OpenAI 兼容 chat/completions 请求，读取 choices[0].message.content JSON 并校验 AnalysisResult；不支持流式、工具调用、附件或任意服务的专属扩展；当前适配器仅返回分析供对照，不生成新补问，也不自动更新案件。配置见 [RUNBOOK](RUNBOOK.md)。

模型设置由 server/src/model-settings.ts 的 ModelSettingsStore 维护；正常启动读取 .env 默认值，再加载 local/model-settings.json。设置只保存当前电脑，原子写入成功后才替换运行配置；保存失败返回 SETTINGS_SAVE_FAILED 且旧配置不变。每次分析读取独立配置快照；页面保存新设置后丢弃旧请求返回，不改案件事实、计数或审核。GET／PUT 沿用本地 Host／Origin 和 JSON 限制；密钥不进入响应、案件备份或 IndexedDB。设置输入与脱敏字段见 shared/model-settings.ts；运行校验由服务端执行。测试显式注入 config 时默认只驻内存，生产不使用该测试模式。

## 已批准业务包

shared/business.ts 定义 BusinessApprovalSchema、ApprovedRoleSchema、ApprovedGuidelineSchema、BusinessCaseSchema 和 BusinessBaselineSchema；server/src/business.ts 的 loadBusinessBaseline() 读取 data/business/approval.json、role.json、guidelines.json 和 T09.json，校验批准登记中的 SHA256 及交叉引用。npm run check:business 提供本地校验；GET /api/business 是消费者的公共读取入口。

批准由项目用户（A）在本对话于 2026-10-17 明确授权，仅覆盖[批准基准](../product/examples/APPROVED_BASELINE.md)。这不是产品内审核记录。原来源哈希由data/evaluation/baseline/T09.source.json定位固定字节快照；当前PRD正常修订不刷新旧哈希。批准包与模拟案件结构分离，不将旧 pending 数据改成 approved；程序不得把 approved 参考正文当已发生员工审核、已核实事实或已送达结果。

## 目标规则与后续接口交付

PRD 4.4的Employee edited、4.5未保存三选项及简单风险关注提示是当前目标，尚未据此扩展基座。A01交付运行结构、模拟端口、保存底座及MODULE_CONTRACTS后，B/C/D/E各自完成业务逻辑、UI与事件绑定。A02再接入主页面及公共服务。未来MODULE_CONTRACTS以A01实际实现为准；当前上文仍描述现有基座，不能当作新模块已经就绪。

## 当前明确未实现

运行工作流中的指引匹配、建议生成／拒绝传播、岗位切换、指引版本替换、完整多案件历史、全聊天工作流及 15 例真实模型验收均未实现。handover 仍为两份 pending 模拟正文的布局样例；独立批准参考在业务包内；普通无指引流程不生成建议或接收方稿。这些功能按当前模块卡实现；成员沿用A01公共接口，不自行改公共schema。

接口由 A 维护。消费者发现缺字段或 PRD 冲突，应提供输入、预期和影响交 A 确认；不自行改语义、引入另一套状态或批准业务配置。
