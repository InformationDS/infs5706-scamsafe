# A01 公共运行契约

工作包编号：`A01-20261017-01`。公共入口为 `shared/runtime.ts`、`shared/module-ports.ts` 和 `shared/runtime-fixtures.ts`，固定预期为 `data/evaluation/prototype.json`。旧 CaseRecord v1、基座工作台与 HTTP API 保持兼容；新运行案件为独立 schemaVersion 2，不能将 v1 JSON 直接当成 v2 导入。

## 同一副本与独立启动

从完整副本根目录按 RUNBOOK 安装依赖及 Chromium；`npm run dev` 后打开以下入口（Windows 使用 npm.cmd）。不需要配置密钥：

| 成员 | URL | 独占新入口及默认导出 |
|---|---|---|
| B / B01 | http://127.0.0.1:5173/?module=intake | app/src/modules/intake/index.tsx，default IntakeModule |
| C / C01 | http://127.0.0.1:5173/?module=model | app/src/modules/model/index.tsx，default ModelModule |
| D / D01 | http://127.0.0.1:5173/?module=guidance | app/src/modules/guidance/index.tsx，default GuidanceModule |
| E / E01 | http://127.0.0.1:5173/?module=outputs | app/src/modules/outputs/index.tsx，default OutputsModule |

每个组件默认导出接受 `ModuleProps`；主入口用 Vite glob 自动发现，新增后重新启动开发服务／重新 build。模块缺失时有可操作的 MOCK substitute，不代表模块已完成。每个模块可在自身根容器 `.module-intake`、`.module-model`、`.module-guidance`、`.module-outputs` 下导入局部 style.css。实际其他文件权限沿用各自任务卡；不修改主页面、公共契约、package 或其他模块。

运行 `npm run check:module -- intake evidence/task-results/B01/run-01/intake`（其他模块分别替换名称与任务编号）。检查自行启动临时 mock 服务和 Chromium，须先 build；目录必须位于 evidence，已存在 result.json 时拒绝覆盖。A01检查断言公共MOCK测试控件及公共功能；真实模块出现后显示在上方，MOCK test controls继续保留并强制模拟，不调用真实服务。成员在允许的本模块测试文件补充实际业务检查，不伪称公共检查就是本模块验收。

## 结构、身份与来源

`RuntimeCaseRecord` 包含 caseId（案件身份）、evaluationId（评估编号）、instanceId（每次打开／重置／导入均更换）、version、sources、facts、analysis、followUp、role、roleRevision、guidelines、guidanceRevision、guidanceStatus、recommendations、outputs、reviews、saved 和 needsFactConfirmation。业务配置批准来自原批准包；运行案件、建议、输出仍为 pending。`mode` 区分 mock/live，不能从配置批准推定分析或员工审核通过。

字段使用字典编号，重复记录用 fieldId＋recordId，缺值 null，布尔否 false，不适用与冲突用各自 status。S1–S5分别保存原文段落；回答来源使用问题ID Q1–Q3；CORRECTION-01保存更正原因。初始输入不包含未来回答。新用户消息来源用 `SRC-<UUID>`；新案件用 `SYN-<UUID>`。B负责正式输入／合并。C新记录提议使用 `MODEL-<requestId>-<CONTACT|EVENT|TX|RESPONSE|EVID>-<从01开始的序号>`，同一请求内稳定，已有记录沿用原ID；B确认后沿用该ID，不按字段名称合并不同交易。未确认提议留在响应，不直接进入案件、审核或问题计数。

`RuntimeCaseRecordSchema` 校验字段、计数、唯一ID与来源／建议／输出／审核引用。JSON Schema无法完整表达跨字段规则，保存、导入与服务仍执行 Zod。旧pending RoleProfile不改批准；运行角色使用 ApprovedRole或旧pending类型。roleRevision每次权限上下文变化递增；guidanceRevision在指引集合／适用性变化时递增，即使同一配置编号也能失效。依赖键为 `fact:<fieldId>:<recordId或空>`、analysis、role、guidance、`guideline:<id>`、`recommendation:<id>`、`output:<id>`。每对象只引用实际依赖，不能全都绑定case version导致单稿修改失效全部草稿。

审核结构只有 first/final，含对象ID、对象版本、dependencies、simulated、actor、reviewedAt。A01固定审核全部 simulated=true、actor=MOCK-STAFF；不借用 STAFF-EX01参考文本充当实际员工。`runtimeReviewValid` 和 `runtimeSnapshot` 默认排除模拟审核；仅显式mock预览允许模拟输出。E负责真正员工审核事件、正文更新和服务复验。Employee edited保存原正文、理由、操作者及历史；重新生成不自动覆盖，具体交互由E完成。运行结构已容纳这些信息，A01不实现B/D/E的正式流程。

## Props 与注入端口

```tsx
import type { ModuleProps } from '../../../../shared/module-ports';
export default function IntakeModule({record, onChange, ports, onError, reset}: ModuleProps) {
  // 使用同一个record展示模块内容；实现逻辑在本模块内。
  // onChange(next)将已通过运行schema的修改标为未保存；ports.save(next)等待事务提交。
  return <section className="module-intake">{record.caseId}</section>;
}
```

示例只说明入口形式，交付模块仍须按卡完成实际逻辑。

| 属性／端口 | 输入与返回 | 责任与错误处理 |
|---|---|---|
| record | RuntimeCaseRecord | 唯一受控案件；禁止另造一份公共案件状态 |
| onChange(next) | 同案合法RuntimeCaseRecord → void | 模块递增实质变化的对象／案件版本；宿主标unsaved。异步前捕获ticket，返回时对当前record校验；不能用旧闭包覆盖新状态 |
| ports.save(next) | Promise<RuntimeCaseRecord>，成功返回saved=true | 只有IndexedDB事务oncomplete才成功；失败reject，保留原输入，不发“已保存”通知。调用期间若页面变化，宿主不把旧保存结果盖回当前案 |
| ports.analyze(request) | Promise<AnalysisResponse> | 仅返回事实、分析和问题提议，不合并、不消耗问题数。服务注册存在时自动使用；缺C时用明确mock。可传previewMock:true固定模拟，不调用付费服务 |
| ports.guidance(record) | Promise<{recommendations,guidanceStatus,simulated}> | A01只返回注入的固定决定，simulated=true，不执行真实匹配。D实现本模块匹配，E可直接消费固定决定而不等D |
| ports.export(record,id,format) | Promise<Blob> | 格式markdown/pdf；E服务存在时使用E，无E时显式mock服务。错误reject，不清正文或审核 |
| onError(error) | {code,message,retryable} → void | 宿主展示安全消息；HTTP失败同结构，不显示密钥／提供商原始返回 |
| reset() | void | 按当前固定变体重置；未保存保护与新建／切换相同，不删除本地历史 |

固定建议输入在 output-error／rejected／single-edit 中，T09与corrected是更早的独立起点。固定指导包为原 EX-ROLE-01 和 EX-G01–03 v1；负向样例不写批准登记。role-stale仅模拟既有角色权限上下文失效，不提供第二个已批准岗位。当前批准包没有明确风险提醒文案及触发条目，本批 `riskNoticeRules=[]`；D不生成额外风险评分或提醒，未来需明确内容再扩展，不阻塞既有指引模块开发。

## HTTP 与服务自动注册

原本机Host／Origin限制、1 MB JSON限制及安全错误继续适用，旧 `/api/analyze` 和 `/api/export` 不改形状。

| 方法／路径 | 请求 | 响应 |
|---|---|---|
| GET /api/runtime/context | 无 | settingsRevision、previewMode、modelRegistered、outputRegistered；不含配置或密钥 |
| POST /api/runtime/analyze | {case:RuntimeCaseRecord,ticket,fault?,previewMock?} | {proposal:{facts,analysis,questions},ticket,meta:{implementation,providerCalled,simulated}} |
| POST /api/runtime/export | {case:RuntimeCaseRecord,objectId,format:markdown或pdf,fault?:failure,previewMock?} | 文件bytes，Content-Type及Content-Disposition；失败返回error对象 |

ticket固定为 `{caseId,instanceId,caseVersion,requestId,settingsRevision,dependencies}`。设置实际保存后settingsRevision递增；服务检查开始和结束时配置版本，B/C在结果应用前用 `ticketCurrent(current,ticket,currentRequestId,currentSettingsRevision)` 再检查当前身份。新请求、案件更正、重置、打开、配置或权限变化均不得让旧响应覆盖。缺省mock分析只是原始2000的固定提议，不含实际合并；B须保留人工200并生成冲突候选。A01 delayed按钮后改250只演示旧结果丢弃。

C在其允许的 `server/src/model.ts` 导出 `analyzeRuntime: AnalyzeRuntime`，保留旧 `analyzeLive`。函数第二参数 `ModelServiceContext` 为请求开始时服务端设置快照及可注入fetchImpl（不进入JSON）；复用现有适配器、设置和提示，C实现自由输入及严格提议校验。E在 `server/src/output-service.ts` 导出 `exportRuntime: ExportRuntime`，保留旧输出API；接收完整案件并复验资格，返回 `{snapshot,bytes,contentType,filename}`。两个端口在调用时动态发现；新建／修改服务文件后重启服务，不必修改 app.ts。测试也可 `createApp({analyzeRuntime,exportRuntime})` 注入本地实现。

previewMock:true强制使用A01模拟服务，即使已有真实注册；false要求已注册，否则503 MODULE_NOT_READY。宿主端口探测注册，缺模块时注入mock；默认替身分析按钮始终强制mock，配置真实API也不自动调用。真实模块仅在员工明确点击分析时调用真实服务，不能在挂载、保存设置或重置时调用付费API。C/E独立开发可先用模拟，再通过同一HTTP路径调用自己的实现。

输出mock复用已有转义Markdown／纯文本HTML及本机Chromium PDF，不接收任意HTML。PDF只有模拟标记，不宣称实际审核或发送。复杂Markdown表格仍按纯文本显示；正式版式由E实现。409表示未保存／审核或依赖不当前，503表示未注册／模拟故障／Chromium不可用，504模拟超时，502模拟无效模型，400格式问题；失败保留输入、正文和审核。

## 持久化与可观察检查

`app/src/runtime-storage.ts` 使用同origin的 `scamsafe-runtime` IndexedDB v1，cases以caseId为键，sessions以模块名记录最近成功保存的案件；cases跨模块共享。和旧单例库隔离。没有多人锁或跨标签自动合并；并行开发者使用独立副本／浏览器。不承诺恢复未保存内容。

新建、切换、重置有未保存修改时显示Save and continue／Discard changes and continue／Cancel，保存失败保留原案及待执行操作。新建是带明确MOCK T09种子的测试案件，不是B的自由输入产品。保存不会自动增加审核或问数。

备份格式 `{kind:"ScamSafe runtime backup",schemaVersion:2,record}`，不包含模型配置；不支持旧格式／坏引用。未保存当前案时禁止导入，组合规则仍待明确，不自行增加导入的三选项。已保存时同号导入先确认Replace，取消不变，确认后仅在保存成功时打开；失败不覆盖当前案。来源与审核原样保留，模拟审核不会升级。

选择Fixed runtime variant后点Reset fixed input；必要时选择放弃或保存／取消。保存后刷新观察Saved runtime case restored。Delayed MOCK analysis后立即MOCK change amount to 250应出现Stale response ignored且金额250。输出选择no-guidance或output-error，重置后Save runtime case；在Output object中选摘要或草稿，Download MOCK markdown/pdf或Open MOCK PDF。output-error默认故障，取消Simulate output failure后同版本重试。无指引只有摘要，过期角色／指引草稿不得输出。

A01实际命令、失败、复测证据及发放结论只记[A01唯一执行记录](../project/tasks/A01.md#唯一执行记录)。完整十五例、实际员工业务审核、真实模型、macOS／第二电脑与A02全流程均不由本次mock通过推定。
