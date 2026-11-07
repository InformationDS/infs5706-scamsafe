# ScamSafe 统一工作台重构实施计划

调查日期为 2026-11-06，按 Australia/Sydney。本文是后续实施的执行依据。本轮交付为代码调查、设计和本文，实施任务均处于待执行状态。

实施使用第1—14节的当前统一正文，接口、任务卡及验收步骤必须一致后才能冻结。第15节为验证范围记录，第16—18节为历史修订附录，保留当时发现和修订经过。发现正文、类型草案、任务卡或验收条件冲突时，先由主agent核对相关段落并统一本文，再继续受影响任务；涉及产品规则时按第1.2节处理。实施模型不能自行选择某个版本，也不能用修订附录覆盖当前正文。

## 1. 基线、权限与交付条件

### 1.1 已核对的本地基线

| 项目 | 实际结果 |
| --- | --- |
| 工作目录 | `D:\BaiduSyncdisk\UNSW\INFS5706\GroupAssignment-integration` |
| origin | `https://github.com/InformationDS/infs5706-scamsafe.git` |
| 分支 | `integration/test-fixes`，跟踪本地记录的 `origin/integration/test-fixes` |
| HEAD | `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d` |
| 调查开始工作区 | `git status --porcelain=v1` 为空 |
| stash | `stash@{0}`，`before-user-requested-rollback-20261106` |
| stash 对象 | `39926d8d2b4c337258debd96e00a18c0a3196792` |
| 远端实时状态 | 本轮没有 fetch，以上远端跟踪信息来自本地 Git |

已读 `AGENTS.md`、`docs/project/STATUS.md`、当前提交版 `docs/product/PRD.md` 第 2–7 节、字段字典相关 A–P 定义、`MODULE_CONTRACTS.md`、`PROTOTYPE_RUNBOOK.md`、集成记录最新批次、`tests/README.md`、`package.json` 及下文涉及的实现和测试。

F01 证据确实存在于 stash 的第三父提交，即未跟踪文件快照。已只读查看 `evidence/task-results/F01/run-01/REPORT.md`，树中也存在截图、下载件和日志。指定文件读取方式如下。

```powershell
git show '39926d8d2b4c337258debd96e00a18c0a3196792^3:evidence/task-results/F01/run-01/REPORT.md'
git ls-tree -r --name-only '39926d8d2b4c337258debd96e00a18c0a3196792^3' -- evidence/task-results/F01/run-01
git show '39926d8d2b4c337258debd96e00a18c0a3196792:shared/intake.ts'
```

最后一条只供比较旧修复思路。该 stash 同时含 PRD、公共接口和界面改动，不能整体恢复。本文依据 HEAD 的 PRD。stash 中的 F01 是 agent 实际界面测试记录，报告明确保留缺陷和未执行项，没有人类产品接收结论。本轮未重新观察其截图或逐份检查其下载件。

### 1.2 范围和规则分层

- **P，既定产品规则**。当前 PRD 是行为依据，用户已确定新建统一工作台、复用业务逻辑。用户统一负责产品决定和接收，旧 A–E 只提供归属参考。
- **T，本文技术决定**。React 受控工作台、一个 `RuntimeCaseRecord`、复用 Zod 与现有服务、增量可选字段、独立测试路由、集中保存、明确的回答映射。这些决定可直接实施。
- **D，需要产品内容决定**。新增批准岗位、一般自由案例的指引适用规则、风险提示批准条目。详见第 13 节。现有批准包支持的范围可先实施。

目标是易理解、可完整演示的课程原型。本轮只新增本文。后续实施保留 PRD、批准业务包、依赖、旧证据和历史。后续可按本文更新实现契约、运行说明和测试选择器，使其描述实际行为。提交、推送、合并和部署另需用户当轮授权。

最终实施交付条件为，同屏双区从空案开始，双区实时使用同案事实，真实消息处理可以更新多目标，T09 与无指引两条流程完成实际复制和下载，审核与存储回归通过，PDF 实际打开检查，历史保存数据可恢复。Mock、fake provider、真实 API、人类接收分别记录。

## 2. 真实代码调查与 PRD 对照

### 2.1 当前状态持有和调用关系

```text
main.tsx
  /                         ModulePreview(name="model", integrated=true)
  /?module=intake|model|guidance|outputs
                            ModulePreview(name=...)
  /?view=foundation          Workbench（旧 CaseRecord v1）

ModulePreview
  record + current ref       RuntimeCaseRecord v2 的唯一宿主副本
  ports.save                saveRuntimeCase → IndexedDB transaction.oncomplete
  ports.analyze             POST /api/runtime/analyze
  ports.export              POST /api/runtime/export
  B useIntake               叙述保存、提案合并、首次核对、逐题回答
  C ModelModule             另一分析按钮，只显示提案，不写入案件
  D GuidanceModule          确定性匹配和员工决定
  E OutputsModule           生成、工作文本、保护比较、最终审核、交付
```

`Workbench.tsx` 并非当前根页面，不能直接把它当作四模块宿主修改。`ModulePreview` 当前把四个完整模块沿页面顺序渲染，页面也有底座控件。B 的 `useIntake` 混合了临时输入、异步请求和业务事件编排。D/E 的 actor 各自局部持有。E 的未记录正文与保护比较只在组件内，宿主通过 `onWorkingEditChange` 得知正文脏状态。C 的 `result` 是独立诊断提案，不能作为 B 已应用的分析。

### 2.2 逐项对照

本表中“当前”均指上述 HEAD。函数名称可在仓库根目录用 `rg -n '符号名' 路径` 定位。

| PRD 条款 | 当前文件／符号与行为 | 缺口 | 计划修改 | 验收 |
| --- | --- | --- | --- | --- |
| §2、§5 同屏双区 | `main.tsx`、`ModulePreview` 顺序装配模块 | 工作流与聊天未分区，长表及诊断混杂 | R05、R07 新双区工作台，R11 切主入口 | U01、U02，两个区域同时可见 |
| FR-01、§2 角色后自由描述 | 宿主初始化及新建均 `makeRuntimeFixture('T09')`；批准包只有 EX-ROLE-01 | 无真正空案，角色未显式选择 | R02 空案工厂，R05 选择配置角色后建案 | U01，分析前无 T09 事实 |
| FR-02、§4.1 提取及多记录 | `analyzeRuntime`、`validateProposal`、`mergeRuntimeProposal` 有记录 ID 与来源校验 | 业务入口依赖种子，字段主要显示内部 ID | R04 自由输入共用服务，R07 分组和名称 | U02、U06，TX 不串案、不合币 |
| FR-03 候选类型 | B 显示类型、理由、替代解释；C 再显示提案 | 重复分析入口，补充后分类没有自动刷新路径 | R06 统一消息分析，C 留测试入口 | U02、U03，分类版本明确 |
| FR-04、§4.4 首次核对 | `confirmRuntimeFacts` 全部 checked，固定 MOCK-STAFF/simulated=true | 用户实际确认仍落训练标记 | R02 保留旧默认并增加显式员工选项，R07 可读核对 | U02、U06，普通聊天不能审核 |
| FR-05、§4.2 计数 | `eligibleQuestionProposals`、`appendSavedQuestionRound`、`useIntake.saveQuestionProposals` | 当前仅逐题输入；回答后不自动再分析；本地筛选与服务对已答目标的防重规则不同 | R02、R06 明确多问映射和轮次事务 | U03–U05、U13 |
| §5 一条输入多问题 | `answerRuntimeQuestion` 处理一个 ID，`parseAnswerValue` 仅局部类型解析 | 没有自然语言多题映射 | R01、R04、R06 提案映射和澄清 | U03、U04，一条消息只更新有据目标 |
| §4.2 未知、结束、后补 | `endRuntimeFollowUp`、`answerRuntimeQuestion` 保留 Q ID、历史和后补新来源 | UI 分散，无主动补充统一入口 | R06 聊天目标控件与补充模式 | U04、U05，停止后不增问 |
| §4.1 人工更正优先 | `mergeRuntimeProposal`、`correctRuntimeFact`、`correctRuntimeTypes` | 更正原因常为默认文案，冲突候选仍需可读化 | R02 保留规则，R07 明确更正与保留当前值 | U06，200 保留、2000 为候选 |
| §4.1、§5 来源和按需展开 | IntakeModule 表格含所有已存在事实、每行更正控件 | 缺业务分组，原始 JSON 审核难读 | R03 名称映射，R07 折叠组、记录卡和来源抽屉 | U02，不渲染 117 个空输入框 |
| FR-06/07、§4.3 指引及权限 | `evaluateGuidance`、`referenceSource`、`context` 检查批准配置及 S1/S3/S4/S5 的 T09 内容 | 固定 S ID/记录 ID/英文上下文，不是一般案例规则引擎 | R04 精确 T09 来源适配；R08 复用匹配，其他输入走无指引 | U02、U07；扩展内容待 D02 |
| 风险关注提示 | 契约记录 `riskNoticeRules=[]`，没有批准条目 | 暂无可展示提醒 | 保持明确空态，D03 决定后另增测试 | 不从模型推导风险分数 |
| FR-08/09、§4.4 决定和编辑 | `decideRecommendation`、`regenerateOutputs`、`editOutput` 保存理由、历史及保护 | D/E actor 重填，最终审核原始 JSON＋重复逐对象操作 | R08 共用员工标识，R09 可读范围审核 | U08、U09、U10 |
| FR-09 两次审核 | `finalReview` 支持 first/final 中的 final，并逐对象写入 | 数据粒度被界面逐个确认放大；`readyForReview` 要求所有事实非 unreviewed | R09 同一最终审核事件对选择闭包写逐对象记录，正常补问在最终审核覆盖 | U04、U10，仍只有两阶段 |
| FR-10 独立输出 | `outputSnapshot`、`outputSnapshotToMarkdown/Html`、`exportRuntime` | 预览和审核清单不够可读；名称主要内部 ID | R03、R09 保持单对象选择和同快照输出 | U10、U11，摘要可单独选 |
| §4.3 无指引 | `evaluateGuidance().summaryOnly`、`outputProposals`、`outputSnapshot` | 已有路径需迁移入口，不能误用旧稿 | R08、R09 保留仅摘要及旧稿失效 | U07 |
| FR-11、§4.5 存储 | `runtime-storage.ts` cases/sessions、v2 BackupSchema | 没有聊天；新建带种子；未记录正文保护只覆盖 E | R01、R05、R06 兼容可选聊天和统一输入保护 | U12、U13 |
| FR-12 API 设置 | `ModelSettings`、`ModelSettingsStore`、`/api/runtime/context` | 独立C与B请求编排重复 | R05/R06共用设置、ticket、唯一控制器及分析服务；Send/Reanalyze等动作分用途，C留独立预览 | U14，保存设置不请求模型 |
| §6 错误及迟到响应 | `ticketCurrent`、服务 settingsRevision 检查、E `deliver` 校验 | 保护分散，聊天事务及澄清尚未存在 | R05/R06/R09 单一编排、保留输入、拒绝旧结果 | U13、U14 |
| §2 英文界面／输出，双语输入 | 提示词要求英文、模型测试保留中文输入；历史来源按原文 | 需继续保持，Mock 没有通用双语理解 | R03/R04/R07 英文名称和说明、保留引用原文 | U02、U11；通用双语效果另记真实模型 |
| §5 持续共用状态、F01-001 | `answerRuntimeQuestion` 改事实而 `outputProposals` 仍读取旧 `analysis.gaps` | E09 已回答仍显示 Unresolved | R02 统一缺口计算和分析过期标识，R09 输出同源 | U05，同时核对页面、MD、PDF |

### 2.3 可直接复用与需要改造的边界

直接复用的核心包括 `intakeTargetKey`、`correctRuntimeFact`、`correctRuntimeTypes`、`eligibleQuestionProposals`、`appendSavedQuestionRound`、`endRuntimeFollowUp`、`runtimeDependencies`、`ticketCurrent`、`dependenciesValid`、`runtimeReviewValid`、`evaluateGuidance`、`recalculateGuidance`、`activeRecommendations`、`decideRecommendation`、`guidanceHandoff`、`outputProposals`、`regenerateOutputs`、`editOutput`、`outputCurrent`、`finalReview`、`outputSnapshot`、运行存储五个读写／备份函数、输出三项序列化／命名函数及 `exportRuntime`。复用前仍按 R 任务修正相关缺口和接口。

不能原样搬到新工作台的部分包括 B `runAnalysis` 的叙述语义、单题 `parseAnswerValue` 的自然语言能力假设、固定员工首次审核、E 的逐次审核 UI、`ModulePreview` 的新建种子与调试控件、C 的第二业务分析按钮。`server/src/model.ts` 内的 `requestAnalysis`、`validateProposal` 是当前文件私有函数，可在该文件内复用，不写成其他文件已可导入的公共函数。

## 3. 用户流程与工作台结构

### 3.1 布局与五阶段

```text
+------------------------------------------------------------------+
| ScamSafe | Case SYN-... | SYN Bank A / Intake Officer | Employee ...|
| Record case > Check information > Add information >               |
| Prepare materials > Review and export       Unsaved | Save case   |
| Cases | New case | API settings | Test workspace                   |
+---------------------------------------+--------------------------+
| Information and workflow              | Case conversation        |
| Current stage actions                 | Description + sources    |
| Facts by business group               | What changed / next step |
| Candidate types / reasons             | Questions Q1–Q3 + reason |
| Sources / gaps / conflicts            | Answer status / history  |
| Recommendations / decisions           | Reply to selected targets|
| Summary / recipient document editor   | [Unknown] [End follow-up]|
| Final review / selected file preview  | [message composer] [Send]|
+---------------------------------------+--------------------------+
```

T 决定为桌面初始约 60/40 两列，两区在 1280×800 和 1440×900 下均可操作，聊天输入固定在聊天区底部。业务面板按需展开，进度条控制左侧主要面板的可见性和焦点，聊天始终保留。五阶段是导航提示，不是五个互相独立的表单页，也不是新的审核节点。用户可以回看前阶段，受保护编辑先记录或放弃。

### 3.2 各状态的区域内容与动作

| 状态 | 信息／工作流区 | 聊天区 | 允许动作与结果 |
| --- | --- | --- | --- |
| 初始空态 | 机构、岗位选择，合成标记；没有案件事实、问题、建议、审核 | 英文输入引导，空 composer | 选择配置角色，点 Start case 建空案后 Send description；可选 Use T09 example 只填入文本，发送前不产生分析 |
| 分析中 | 保留当前事实；显示 Updating analysis 和请求用途；旧结果标 Previous analysis | 原消息保留，发送状态可见 | 禁重复发送同一消息；允许明确更正使旧 ticket 失效；取消请求只取消应用资格 |
| 待首次核对 | 当前事实分组、类型、依据、替代解释、未知和冲突；Check current information | 说明已提取哪些内容及下一步 | 员工可更正，明确确认后记录 first；聊天陈述不代替审核 |
| 补问中 | 同案事实、计数、当前缺口；最新变化高亮 | 一轮 1–3 问，ID、业务名称、原因、状态，统一 composer | 多问题回答、部分回答、Unknown / unable to answer、Not applicable、End follow-up；来源和事实同步 |
| 主动补充／澄清 | 当前已确认内容保持，未确定映射显示 Pending clarification | 保留整段原文，显示可选目标和引用片段 | 用户指认字段／问题或补充上下文，确定部分可单独应用，模糊部分不改事实 |
| 旧消息待决定 | 保留较新事实，旧值候选及来源可读，材料标待更新 | 原MSG展示Keep current value / Use earlier answer比较卡 | 记录员工选择后执行6.3.2的内部完整分析；分析成功且本MSG无待处理项才完成该MSG |
| 建议决定 | 有效指引、岗位边界、相关机构、条件、优先级、依赖，Accept / Modify / Reject | 说明补问停止原因及可支持的下一步 | actor 复用顶栏；每条决定仍明确，拒绝理由保留 |
| 文件编辑 | 摘要／银行／电信选择，正文、缺口、来源、员工修改标记，版本比较 | 历史会话可回看；正文Record或Discard后才可发送补充 | Working edit与已记录正文分开；有未记录编辑时提供Go to edit并保留composer；重生成保留人工稿并比较 |
| 最终审核 | 最新事实／分类／缺口概览，选择输出范围及依赖建议、明确确认 | 只说明本地审核后可复制导出 | 一次明确确认写入选择闭包的逐对象 final 记录，保存成功后显示可交付状态 |
| 预览／输出 | 选一份当前有效文件，渲染预览、Copy Markdown、Download Markdown / PDF | 显示当前选择和完成／失败状态 | 三项来自同快照；切换选择不自动审核；无效历史稿只能检查 |
| 消息分析／澄清失败 | 明确原MSG及失败步骤，保留已存来源和旧结果 | Retry message恢复对应MSG；旧答案待比较时先展示原比较卡 | 按6.3.1/6.3.2恢复，不能绕过时序保护 |
| 独立重分析／下一轮分析失败 | 显示purpose及失败状态，保留当前事实和计数 | Retry analysis或Continue follow-up恢复对应操作，不寻找不存在的MSG | 仍用最新ticket；问题成功保存展示后才计数 |
| 源消息保存／响应应用后保存失败 | 标Unsaved并保留原草稿或已应用候选 | Retry recording message或Retry save仅重试当前待保存事务 | 源保存成功才请求模型；响应已应用时不再次请求模型或重放答案 |
| 导出失败 | 保留有效审核、预览和当前选择 | 重试同一有效对象版本的复制或MD/PDF，不关联MSG | 按7.4重新验证当前资格，不重生成正文、不重新审核 |

分组至少有 Case context、People and support、Contacts and events、Transactions、Information exposure and remote access、Scenario details、Reported responses and evidence。同组按 recordId 分记录，字段详情才展示内部 ID。缺失只显示已出现或当前处理需要的目标，未提及领域不展开整份字典。

新案阶段从控制器和数据推导。旧 `record.stage` 可能是 `T09`、`corrected` 等测试变体，不能把它强制改为新枚举并导致旧数据拒绝。新工作台维护派生的五阶段导航值，`record.stage` 保留可读兼容。

## 4. 状态、持久化与数据流

### 4.1 唯一状态与临时状态

T 决定新增 `app/src/workbench/useWorkbenchCase.ts`，它是新工作台唯一案件持有者，维护 `record: RuntimeCaseRecord | null` 和同步 current ref。开始选择角色前为 null，避免给 runtime schema 加一个伪岗位。子组件只有 props、临时输入及回调，不能复制持有可独立变更的业务 record。

同一控制器集中管理历史、新建／切换、storage、请求 ID、settingsRevision、忙状态、未保存提示和所有临时输入的脏状态。`ModulePreview` 保留独立测试宿主；同一页面只挂载一个宿主。新工作台不在隐藏 DOM 再挂四个旧模块执行事件。

临时 composer、事实更正输入、建议修改输入、正文 working body 与已记录案件分离。每类临时输入都报告 dirty；UI 对保存的说明必须清楚。Save case 遇到临时修改先要求 Record 或 Discard，对聊天草稿提供 Send 或 Keep editing；不能保存案件后声称未发送消息也已保存。发送后的原消息进入案件来源和会话，可保存恢复。beforeunload 覆盖所有未保存案件／临时输入。

Send消费本次composer草稿，不能把该草稿自己的dirty当作禁用条件。公共Save case、新建／切案与Send使用不同入口保护。Send的其他编辑保护、操作内保存和失败恢复按4.1.1执行。

### 4.1.1 Send消费自身草稿与操作内保存

计划新增的发送门槛至少区分composerHasText、otherDraftKeys、activeOperation和pendingSave。`otherDraftKeys`为dirty Set去掉本次composer键后的其余项；已经Record但尚未持久化的案件变化属于record.saved=false，不属于未记录编辑。案件合法、角色已选、composer非空且无其他阻塞时，Send可用，即使composer为dirty或record.saved=false。

| 条件 | Send及界面行为 |
| --- | --- |
| 只有本次composer有未发送文字 | Send启用，点击后消费该草稿 |
| 同时存在未记录正文／事实更正／建议修改 | Send禁用，明确列出对应编辑并提供Go to edit入口，在该处Record或Discard；不自动丢弃，也不要求先清空composer |
| 当前请求、存储事务、待重试保存或非消息分析失败待恢复 | Send禁用，提供对应进度或Retry入口，当前操作继续完成 |
| 仅有已保存旧MSG待澄清／失败 | Send按其他条件正常开放，旧MSG保留阻塞信息 |

执行顺序固定如下。

1. sendMessage捕获text、questionIds和draftRevision，重新检查门槛。同步取得唯一operationId并锁住重复提交，分配稳定MSG/source ID，构造待保存候选。不能等待React busy状态渲染后才防重。
2. 控制器的内部保存方法验证当前operationId、caseId/instanceId及捕获版本，接受该操作消费的composer键和draftRevision。它直接调用同一saveRuntimeCase事务底座，不重新走公共Save case的“所有dirty都须先Record”入口。豁免仅用于匹配本次捕获草稿，不可忽略其他未记录编辑。首次消息保存同时持久化已记录的案件修改。
3. 操作持有自己的锁时可以继续源消息保存、分析和响应保存，不把自己持有的busy／transaction标志当作取消条件。新用户操作仍受锁阻止。源保存期间composer只读，整个发送请求结束前保持只读，明确显示Sending，避免清空期间接收另一份草稿；事实区按既有规则仍可在网络等待时更正并令ticket失效。
4. 只有源消息保存成功后，清除匹配的composer草稿及其dirty，随后捕获ticket请求分析。失败则保留原草稿、同MSG/source/operation及候选，显示Retry recording message；重试只保存这一候选，不再次分配ID或当成第二条Send。刷新仅恢复成功保存部分。
5. 分析失败时原消息已经保存，composer可保持已清空状态，通过原MSG的Retry恢复，不重新把原文放回composer诱导重复发送。响应应用后保存失败，只Retry save该候选。内部finally只释放自己的operationId；案件已更换或ticket过期时，保留当前输入并丢弃旧结果。

计划sendMessage参数增加draftRevision，控制器在点击时核对它。私有保存方法签名草案为 `saveOperationSnapshot(next, { operationId, consumedDraft: { key: 'composer', revision: draftRevision } })`。该方法不新增ModulePorts公共接口，也不改变saveRuntimeCase签名；后续内部响应保存复用同operationId，composer已消费时不再要求它仍dirty。公共Save case对未发送草稿的保护继续保留。

员工标识是工作台会话偏好，计划使用 `sessionStorage` 的 `scamsafe-workbench-actor`，刷新复用，当前标签关闭后自然失效。每次审核／决定／正文编辑调用仍把 actor 写入原记录。修改当前输入标识不改写历史。独立模块使用可选注入，独立打开时保留自己的输入。它仅为合成员工标识，不构成认证。

### 4.2 计划新增的兼容持久化字段

在 `RuntimeCaseRecordSchema` 增加以下可选字段，保持 schemaVersion 2、IndexedDB v1、原 backup 外层版本 2。字段缺席时不补写、不主动保存。下面全部是**计划新增类型**。

```ts
type ConversationMessage = {
  id: string;                       // MSG-UUID，重试沿用
  kind: 'initial' | 'supplement';
  sourceId: string;                 // 整段原文，已存在 sources
  questionIds: string[];            // 可能处理的原问题，可为空
  status: 'recorded' | 'needs-clarification' | 'needs-decision' | 'applied' | 'failed';
  recordedFactVersions?: Record<string, number>; // 新MSG记录时捕获，旧数据可缺席
  updates: Array<{
    questionId?: string;
    target: Target;
    sourceId: string;               // 对应精确证据片段
    outcome: 'answered' | 'unknown' | 'not-applicable' | 'conflict';
    appliedFactVersion?: number;
    disposition?: 'current' | 'historical' | 'awaiting-decision' | 'kept-current' | 'adopted-earlier';
    supersededByMessageId?: string;
    decision?: { choice: 'keep-current' | 'use-earlier'; actor: string; reason: string };
  }>;
  unresolvedQuotes: string[];
  clarifications?: Array<{
    revision: number;
    sourceId: string;               // 员工明确确认映射的附加来源
    decisions: ConfirmedMapping[];
    retainedQuotes: string[];
    actor: string;
    status: 'recorded' | 'applied' | 'failed';
  }>;
  createdAt: string;
};
type ConversationState = { messages: ConversationMessage[] };
type AnalysisUpdateState = {
  status: 'pending' | 'current' | 'failed';
  messageId?: string;
  operation?: 'message' | 'clarification' | 'reanalysis' | 'follow-up';
};
// RuntimeCaseRecordSchema 中计划新增
// conversation: ConversationStateSchema.optional()
// analysisUpdate: AnalysisUpdateStateSchema.optional()
// analysisGapHistory: z.array(z.object({
//   analysisVersion: z.number().int().positive(), gaps: z.array(z.string())
// })).optional()
```

`conversation` 只记录消息来源、应用结果和链接，不存另一份事实、建议、审核或“聊天专用问题列表”。问题文字、状态及计数始终从 `followUp.questions` 渲染。系统英文消息由状态生成，既有事件历史从来源、问答 history、recommendation history、output history 和 reviews 渲染。无需保存模型自由生成的整段“助手口吻”作为业务真相。

`analysisUpdate` 只用于明确案件整体的候选分析是否待更新，不另存分类。它按第4.2.1节从全部消息及当前操作汇总，当前响应只能完成自己的操作，不能以单条消息成功直接把案件置current。部分映射已应用但仍有unresolvedQuotes时，该消息保持needs-clarification；员工显式保留未解决说明后，仍需第6.3.1节完整分析。Unknown／Not applicable或结束按钮若没有新增事实，可只更新确定性缺口，但仍须汇总其他消息阻塞项。pending/failed时保留旧候选为历史，相关新输出和最终审核暂停，Retry按具体消息／操作恢复。独立旧案件未设置此字段时沿用现有资格规则，遇到实质新变更再设置。

### 4.2.1 多条消息的案件级状态汇总

T决定为，网络分析和存储提交按单案件串行，已保存的待澄清或失败消息可以共存。消息本地status、clarifications及updates是各自操作的记录；analysisUpdate是它们的汇总缓存。每次操作记录、成功、失败、重试、恢复后均调用计划新增 `deriveAnalysisUpdate`，返回汇总state和供界面显示的全部blockers。blockers按MSG/revision关联，不再增加另一份持久化业务队列。

1. 一条响应只更新它自己的MSG和澄清revision。MSG-2成功不能修改MSG-1的status、未处理quote或failed条目，也不能把它们当作已分析。问题的answered/unknown状态也不能代替对应消息操作完成。
2. 阻塞项包括尚未应用的recorded消息、failed消息、needs-clarification消息、needs-decision或updates含awaiting-decision的消息、尚未applied的clarification条目，以及正在进行或失败待重试的非消息分析操作。已经明确保留为未解决说明且完整分析成功的quote不再是“待处理操作”，仍在说明中保留不确定性。
3. 汇总优先级固定为，正在执行请求或尚待提交的操作为pending；没有执行中操作但存在failed项为failed；其余recorded/needs-clarification/needs-decision项为pending；全部消息和操作均已完成且最新完整分析仍适用时才current。界面同时列出所有blockers，即使顶层只能显示一个status。operation/messageId只指向当前执行项或优先阻塞项，不能据此推定其他操作已完成。
4. Send允许消费本次composer草稿；仅其他未记录编辑、存储事务、请求处理中或待重试保存时禁用，细则见4.1.1。仅有**已保存**旧待澄清／失败／待决定消息时可继续发新消息，旧项保持可见。新消息先保存再分析，成功后只完成自身并汇总。非消息Reanalyze/Continue失败先重试再开放新Send。普通Reanalyze/Continue要求先处理全部消息阻塞；6.3.2的员工决定后分析属于完成既有操作的内部续步。
5. 场景MSG-1含“It has stopped.”、MSG-2提供收款对象时，MSG-2可以更新E08并saved；MSG-1仍needs-clarification，案件pending，显示“Recipient updated; MSG-1 still needs clarification”。生成当前可交付材料、最终审核和导出继续受案件汇总门槛阻止。MSG-1澄清必须以包含MSG-2最新事实的ticket重新分析，全部完成后才current。
6. 在恢复、生成、最终审核及outputSnapshot资格检查中重新派生全部阻塞项，不能只信任保存的analysisUpdate.status。导入文件即使伪称current，但含recorded/failed/needs-clarification/needs-decision消息、awaiting-decision更新或未应用澄清，也须阻断；不能通过刷新或备份绕过。旧案没有conversation时保留既有兼容规则。模型结果是否仍适用继续使用ticketCurrent；元状态汇总不产生新的first审核或重置计数。

`deriveAnalysisUpdate`可接收唯一控制器当前非消息操作的pending/failed/completed事件。只有该操作当前ticket对应的成功事件才能清除它自己的失败；消息Send不会清除其他操作。没有执行中活动时恢复已保存消息条目即可重建消息blockers；刷新遇到保存的pending非消息操作时显示Interrupted — retry required，保留其purpose，不能自动设current。cases仍只存一份原案件，blockers列表在读取时计算。

### 4.3 保存、兼容和并发原则

1. 读旧 v2 保留事实、问题 ID、来源、角色、建议决定、正文、reviews 和 simulated。没有聊天时显示 Previous conversation unavailable，并根据现有问答渲染已记录问题，不能虚构过去聊天。
2. 新增字段用 optional，Zod 新字段包含 source/question/target 引用校验及消息 ID 唯一约束。保留原严格拒绝未知顶层字段、坏引用、不支持版本的行为。不要用 passthrough 绕过兼容。
3. 新工作台继续使用 session `integration`，恢复当前用户原主页面最近成功保存的案件。独立模块各用原 session。新案只在无历史时显示空态，已有历史正常恢复。切案重新生成 instanceId，旧 ticket 立即失效。
4. `saveRuntimeCase` 仍在 cases＋sessions 同一事务完成后返回 saved=true。保存失败保留内存候选及输入，显示 Unsaved；导出被 saved 门槛阻止。旧保存完成后若用户已有新修改，只更新“较早版本保存成功”的提示，不能盖回当前内存。
5. 新一轮问题与一次多题回答分别形成完整候选 record，一次事务保存。问题轮只有保存成功才对外显示为已问且计数提交。失败时提案作为临时待重试对象，正式 followUp 不加入该轮。
6. 发出分析先记录并成功保存原消息来源。保存失败时停止模型调用，保留 composer。分析失败时已保存原消息可恢复，并有 failed/retry 状态，事实和审核保持旧值。应用提案后保存失败，保留已应用未保存状态和同 messageId，重试只保存该候选，不能再追加来源或重复应用。
7. 所有模型结果先校验 ticket 与完整响应，最后对最新 current 应用。当前请求 ID、caseId、instanceId、caseVersion、settingsRevision 及 dependencies 必须一致，沿用 `ticketCurrent`。模型设置保存使活动请求失效。失败状态也只能由当前请求写入，旧请求 finally 不得清除新请求 busy。
8. 提交应用／存储事务期间短暂锁定所有修改控件。等待模型网络响应时允许更正并令响应过期。返回到保存开始之间不得有可编辑窗口。重生成比较、最终批量审核、导出等待也需当前内容校验。
9. JSON 备份只含案件与新增会话字段，员工偏好和模型设置不进入。未保存当前案继续使用 `assertImportAllowed` 的限制；同号确认、坏文件不覆盖、事务失败保留原案沿用既有行为。
10. 新版 v2 含可选字段的备份能被新实现读取，旧版本程序的 strict schema 可能拒绝它。回退 UI 路由仍运行新 schema，避免回退整个代码版本后误称新数据向后可写。实现前备份旧数据，保留原始 JSON 和 IndexedDB，不清库。

### 4.3.1 历史接收方与岗位切换的契约统一（2026-11-07）

现有 runtime schema 要求所有交接稿的接收方属于当前岗位；这会与 PRD 及 R02 要求的岗位切换后保留历史稿冲突。统一为：当前岗位版本的交接稿仍必须引用当前配置的接收方；只有带有正数且早于当前 `roleRevision` 的岗位依赖版本的历史稿，才可保留不属于当前岗位的原接收方。该稿按现有依赖检查失效，仅供历史检查，不能视为当前建议、审核或输出，也不因此批准任何新接收方。缺少可证明旧版本的依赖，或依赖为当前／未来版本时，未知接收方仍拒绝。R02 为此可在 `shared/runtime.ts` 的接收方引用校验处作最小兼容修改，并测试切换、历史保存恢复及输出阻断；R09 继续承担当前输出和审核的完整门槛。

### 4.4 当前缺口与 F01-001

本轮在内存调用实际 `analyzeRuntime(mock)` → `mergeRuntimeProposal` → `confirmRuntimeFacts` → `appendSavedQuestionRound` → `answerRuntimeQuestion(Q1, 'reported pending', 'answered', true)` → `outputProposals`，得到 E09 值 reported pending、Q1 answered、1 轮 3 问，但 `analysis.gaps` 仍含 `Unresolved E09:TX-01`，摘要 `staleGapInSummary=true`。该只读复现没有写浏览器、案件或代码文件。

根因有三处。

- `shared/intake.ts#answerRuntimeQuestion` 只改问题、事实、来源及版本，没有同步分析缺口。
- `useIntake.answerQuestion` 没有在答案后调用分析，B 的 `runAnalysis` 仅用于当前 narrative。
- `shared/outputs.ts#outputProposals` 一段直接输出 `analysis.gaps`，另一段从 facts 计算 Unresolved information，两段数据时点不同。

计划新增 `shared/case-gaps.ts` 作为当前事实缺口的唯一计算位置。当前缺口包含 value=null 且非 not-applicable、missing、unclear、status=conflict，或仍待员工处理的冲突候选。已明确保留当前值的历史候选不能永久视为活动冲突，要依据当前 status 区分历史候选与未处理候选。Unknown／Skipped 仍保留其目标实际缺口，不能仅凭问题 answered 就消除。

`refreshRuntimeGaps` 将字段型缺口规范为 `Unresolved <fieldId>:<recordId或空>`，对比后才变更 analysis.version。可识别的旧机器字符串严格按该格式解析，并从当前事实重算。旧非结构化缺口先放入 `analysisGapHistory`，UI 显示 Previous analysis notes；保留其原文和版本。新模型的非字段分析局限仍作为最新分析限制显示，不能靠删除任意文本“修好”F01。R04 在完整分析应用时保存最新模型限制，R02 的本地更新只把无法对应当前目标的旧文本移入历史，随后要求更新分析。

`currentFactGaps` 直接驱动左侧、最终审核及输出的 Unresolved information。Candidate analysis 不再第二次把未经协调的旧 `analysis.gaps` 宣称为当前字段缺口。新分析返回后统一规范并保留不确定性说明。旧保存案若有确定的 F01 矛盾，打开时内存修复并标 Unsaved，analysis.version 递增，使受影响输出依赖失效，提示 Update and review materials。刷新修复必须幂等，不删除历史审核或正文。

### 4.4.1 旧缺口恢复边界统一（2026-11-07）

R02 要求打开旧案时修复确定的字段缺口矛盾，但其原允许文件没有统一存储读取边界，单独访问 outputs 时也不会挂载 intake。为满足同一恢复规则，R02 可对 `app/src/runtime-storage.ts` 作最小修改：加载和导入时对已验证记录执行幂等的内存缺口修复，标为未保存并要求重新分析；不自动写库、不改变数据库版本或 session。`runtimeSnapshot` 对尚未经过该读取边界的矛盾记录保守拒绝，防止旧正文凭未变化的依赖继续导出。原 `ModulePreview` 显式打开历史案时会立即调用保存；R02 可在 `app/src/module-preview.tsx` 最小调整：已在内存修复的旧案只打开并标记 Unsaved，不写回或更新 session，待员工明确保存后才持久化；正常未修复案件仍沿用原行为。用户明确导入备份时按原导入流程保存，但修复后的 pending 状态不可丢失。恢复、备份和独立输出入口须测试；原始存储数据在员工明确保存之前保持不变。

### 4.5 人工更正、冲突与审核协调

模型永远返回提案。先验证来源及目标，再 `mergeRuntimeProposal`，员工更正值优先。对更正值不一致的新证据保留候选和来源，状态 conflict；当前值不变。`correctRuntimeFact` 的保留当前值动作也必须记录理由并将 conflict 改为已处理，历史候选仍可查。

计划给 `mergeRuntimeProposal` 增加可选 change origin，取值 initial / follow-up / direct。旧调用默认 direct，保留已有更改后确认语义。正常当前轮回答引发的模型更新使用 follow-up，不重复首次审核；新事实的 unreviewed 在最终审核的同一次明确确认中纳入当前事实核对。首次核对后主动补充、直接更正、停止后后补使用 direct，仍设置 needsFactConfirmation，员工回到原核对区确认变化。保留 first 历史，不新增第三审核阶段。

事实／分析变化后先处理refreshRuntimeGaps及recalculateGuidance，已有正文立刻标Out of date。只有全案汇总current且满足事实确认要求时才允许生成当前文稿提案，pending/failed/needs-decision期间保留旧稿供检查。员工稿更新进入比较，不能自动覆盖；outputCurrent及依赖门槛继续阻止旧审核导出。建议决定先写员工选择再刷新引用输出，不能用重新匹配结果覆盖拒绝。

## 5. 计划接口与文件归属

### 5.1 计划新增的公共接口草案

以下接口全部尚未实现。R01 冻结名称和 shape，R02/R04 按它们实现。`Target`、`Question`、`FactRecord` 使用现有 `shared/schema.ts` 类型。

```ts
// 计划新增 shared/conversation.ts，Zod 为源，以下为其推导形状
type MessageIntent = {
  messageId: string;
  sourceId: string;
  kind: 'initial' | 'supplement';
  questionIds: string[];
  clarification?: {
    revision: number;
    sourceId: string;
    decisions: ConfirmedMapping[];
    retainedQuotes: string[];
  };
};
type AnswerMapping = {
  questionId: string;
  target: Target;
  quote: string;                    // 必须是该消息原文的非空子串
  status: 'answered' | 'unknown' | 'not-applicable';
  value: FactRecord['value'];       // 未知及不适用为 null
};
type MessageResolution = {
  messageId: string;
  sourceId: string;
  answers: AnswerMapping[];
  observations?: UnknownObservation[]; // 无原问题的未知陈述，不是事实赋空指令
  unresolvedQuotes: string[];       // 模糊部分原文，保留待澄清
  clarificationRevision?: number;   // 澄清响应必须回显当前 revision
};
type UnknownObservation = { target: Target; quote: string; status: 'unknown' };
type ConfirmedMapping = {
  questionId?: string;              // 无原问题的主动信息直接使用 target
  target: Target;
  quote: string;
  status: 'answered' | 'unknown' | 'not-applicable';
  value: FactRecord['value'];       // 员工在类型控件中明确确认
};
// AnalysisRequestSchema 计划增加 interaction?: MessageIntent
// 另增加 purpose?: 'case-reanalysis' | 'follow-up'
// interaction 与 purpose 互斥，均无时保持旧预览协议
// AnalysisResponse 计划增加 resolution?: MessageResolution
// parseAnalysisResponseForRequest(input, response) 校验结构、ticket、消息和澄清revision配对；
// 事实、来源、目标等完整语义仍由 R04 服务及应用层验证。
// 有interaction时必须返回resolution；有purpose时走对应新分析协议且不返回resolution
// 无interaction且无purpose时，保留旧预览请求／响应协议
// proposal 仍是现有 AnalysisEnvelopeSchema，不把答案塞进 questions

// 计划新增 shared/case-gaps.ts
type CurrentFactGap = { target: Target; status: FactRecord['status']; reason: string };
function currentFactGaps(record: RuntimeCaseRecord): CurrentFactGap[];
function refreshRuntimeGaps(record: RuntimeCaseRecord,
  options?: { origin: 'local' | 'analysis' }): RuntimeCaseRecord;

// 计划新增 shared/workbench-case.ts
function createEmptyRuntimeCase(input: {
  role: RuntimeCaseRecord['role'];
  guidelines: RuntimeCaseRecord['guidelines'];
  caseId: string; instanceId: string; receivedAt: string;
}): RuntimeCaseRecord;
function applyResolvedMessage(input: {
  record: RuntimeCaseRecord;
  response: AnalysisResponse;
  interaction: MessageIntent;
}): { record: RuntimeCaseRecord; updatedQuestionIds: string[] };
function applyRoleSelection(record: RuntimeCaseRecord,
  role: RuntimeCaseRecord['role']): RuntimeCaseRecord;
function resolveEarlierMessageTarget(record: RuntimeCaseRecord, input: {
  messageId: string; target: Target; candidateSourceId: string;
  choice: 'keep-current' | 'use-earlier'; reason: string; actor: string;
  expectedCaseVersion: number;
}): RuntimeCaseRecord;
type AnalysisActivity = {
  operation: 'message' | 'clarification' | 'reanalysis' | 'follow-up';
  messageId?: string;
  status: 'pending' | 'failed' | 'completed';
};
function deriveAnalysisUpdate(record: RuntimeCaseRecord, activity?: AnalysisActivity): {
  state: AnalysisUpdateState;
  blockers: Array<{
    messageId?: string; clarificationRevision?: number;
    operation: AnalysisActivity['operation'];
    reason: 'recorded' | 'needs-clarification' | 'needs-decision' | 'failed' | 'in-progress';
  }>;
};

// 现有 shared/intake.ts 计划兼容增加可选末尾参数
type AnswerOptions = {
  value: FactRecord['value'];
  sourceId: string;                 // 调用方已记录精确 quote 来源
};
// answerRuntimeQuestion(record, questionId, answer, status, updateFact,
//                       options?: AnswerOptions): RuntimeCaseRecord
// 无 options 的旧调用仍走原单题解析与来源规则
// mergeRuntimeProposal(record, proposal,
//   options?: { origin: 'initial' | 'follow-up' | 'direct' }): RuntimeCaseRecord
// confirmRuntimeFacts(record,
//   reviewer?: { actor: string; simulated: boolean }): RuntimeCaseRecord

// 计划新增 shared/outputs.ts 公共函数
function finalReviewSelection(record: RuntimeCaseRecord, input: {
  outputIds: string[]; actor: string; acknowledged: boolean;
  expectedCaseVersion: number; reviewedAt?: string;
}): RuntimeCaseRecord;
function editOutputRecipient(record: RuntimeCaseRecord, id: string,
  recipientId: string, options: { actor: string; reason: string }): RuntimeCaseRecord;
// 计划新增 shared/export.ts，供runtime HTTP响应使用
function contentDispositionForFilename(filename: string): string;
```

初始 createEmptyRuntimeCase 构造合法 version=1、roleRevision/guidanceRevision=1、空 followUp／sources／recommendations／outputs／reviews；analysis version=1，types/reasons/alternatives/gaps/facts=[]、source=mock、guidanceStatus=unapproved、recommendations=[]。guidanceStatus 初始 none，匹配后再确定 available，避免空案冒充已有建议。facts 只放系统上下文 A01–A06 及确有值的接报信息，不含 A07 或任何 B–J 种子。上下文来源由系统或配置产生，模型只提议 B–J。接报时间使用带时区的真实创建时间，不把案例内时间当接报时间。

`applyResolvedMessage`先验证完整response/ticket/MessageIntent，再按6.3.2对所有目标检查消息顺序和recordedFactVersions，之后在clone上原子应用。无clarification的同MSG已applied返回原record；澄清按MSG＋revision去重，只处理未应用决定。已应用旧片段不重写Q/来源/history。它不保存、不请求模型、不建新问题轮。`resolveEarlierMessageTarget`仅做6.3.2的员工选择纯变换；控制器resolveEarlierAnswer负责保存及其后的完整分析续步。

`refreshRuntimeGaps` 默认 origin=local，将旧非结构化 gap 原文归档；origin=analysis 仅用于刚完成的完整分析，保留此次新返回的非字段限制为当前分析说明。两者都从当前事实重算字段缺口。重复相同输入返回原对象，不增加版本或重复 history。调用方在 local 后若仍需分类重分析，使用 analysisUpdate 明确标记。

额外事实提案与 answers 不得对同一 target 提交不同当前值。服务端要求匹配，客户端防御性再验；模型给出的 answer/status/value 不合类型或与 quote 无法关联时，整个响应以安全错误拒绝，保留原消息。模糊映射应通过 unresolvedQuotes 表达，无需让模型伪造确定答案。

### 5.2 公共接口行为细节

- `MessageIntent.questionIds`可含当前轮、过去unknown/skipped/answered问题，沿用原ID。员工未显式选题时，由控制器填写当前可回答问题ID集合；主动非问题补充填写空数组。该属性在请求中始终必填，不能以undefined代替默认行为。模型仍可提议有来源的额外事实；未预选的已处理历史问题按6.2.1唯一目标及证据规则回填。澄清沿用员工明确选择的原Q和原消息来源，不创建新问题。
- 模型 `quote` 指向输入整段消息，重复相同短文本时结合目标和原问题验证。未知或不适用必须有明确选择／原文，缺少回答不能自动当unknown。unknown属于“该来源无法提供答案”，不能表示撤回已有值。有原问题走answers，无原问题走observations；按第6.4.1节处理，不把unknown的null交给事实合并覆盖已知值。
- `AnswerOptions.value` 让新路径使用模型验证后的类型值，不把长段自然语言再送 `parseAnswerValue`。quote 作为 question.answer，整段原消息保存在其 source，片段 source 带原目标；不要把每个问题的 answer 都设为整段消息。
- `finalReviewSelection` 先验证期望版本、选择非空、actor、明确确认、analysisUpdate 和 needsFactConfirmation。闭包为选中输出＋其 accepted/modified 有效依赖建议。先核对最新事实，再审核依赖建议，再输出对象，沿用同 reviewedAt。无指引闭包只有 SUMMARY。clone 上全部成功才发布，不能部分写审核。
- 正常补问产生的 unreviewed facts 在这一次 final 确认中改 checked，不能增加 first 事件。直接变更 needsFactConfirmation=true 仍必须先在原核对区确认，不能借 batch 绕过。纯核对标志不增加事实内容版本，并按第7.2.1节先从生成正文中分离。若业务内容本身改变则先更新输出，展示新正文后重新确认；不能在审核提交内部重生成正文。
- `ModuleProps` 计划加可选 `employeeActor?: string`，旧调用不受影响。新工作台面板从统一 actor 获取值，独立 D/E 的 fallback 输入保留。不要把 actor 加进角色权限配置。

### 5.3 文件变更矩阵

共享文件唯一写入者为主 agent，执行任务的其他 agent 只按第 10 节的独占目录写。表中“新增”均为后续计划新增。

| 文件 | 动作及当前职责 | 后续职责／复用符号 | 前置及兼容 |
| --- | --- | --- | --- |
| `shared/runtime.ts` | 修改，v2 schema、依赖、审核门槛 | R01增加可选 conversation/analysisUpdate/analysisGapHistory及澄清记录；R09增加可选输出bodyFormatVersion/recipientSelection及快照recipient；复用所有依赖函数 | R01/R09；旧 v2 无字段仍可读取 |
| `shared/module-ports.ts` | 修改，HTTP/React 契约 | interaction含澄清、purpose、resolution、employeeActor 可选扩展 | R01；原 AnalyzeRuntime/ModuleProps 可调用 |
| `shared/conversation.ts` | 新增，当前不存在 | MessageIntent/Resolution/Conversation Zod 定义，纯类型及结构验证 | R01；避免运行时循环导入 runtime |
| `shared/case-gaps.ts` | 新增，当前不存在 | `currentFactGaps`、`refreshRuntimeGaps` | R02；原 gap 原文进历史 |
| `shared/workbench-case.ts` | 新增，当前不存在 | 空案、角色选择、消息原子应用、deriveAnalysisUpdate及resolveEarlierMessageTarget | R02，依赖R01与真实intake函数 |
| `shared/intake.ts` | 修改，事实及问答变换 | typed answer 可选参数、origin、真实 first reviewer、缺口协调、统一防重 | R02；保留原五参数调用及默认训练核对 |
| `shared/field-labels.ts` | 新增，当前不存在 | 全 A–J 的英文字段/组/值名称，`fieldLabel`、`targetLabel` | R03；内部 ID 不变 |
| `shared/outputs.ts` | 修改，生成/编辑/审核 | R02缺口同源，R03名称，R09分析汇总gate/最终审核/输出格式及接收方 | R02/R03/R09；正文保护及单对象finalReview保留 |
| `shared/export.ts` | 修改限定范围 | 同快照MD/HTML/文件名，新增contentDispositionForFilename传输头；正文由outputs生成 | R09；保留安全转义和有限Markdown |
| `shared/schema.ts` | 保留 | FactRecord、Question、AnalysisEnvelope 原形状 | 通过 response 顶层 resolution 扩展，不混入 questions |
| `shared/export-schemas.ts` | 修改 | 注册新 conversation 的必要 JSON schema 输出 | R01；生成不得改批准包 |
| `shared/write-schemas.ts` | 保留 | 现有 schemas 脚本入口 | R01；不自行另建生成流程 |
| `data/schemas/RuntimeCaseRecord.schema.json` | 修改生成件 | 同 runtime 可选字段 | R01/R09，`npm.cmd run schemas` 后逐项检查 diff |
| `data/schemas/RuntimeExportSnapshot.schema.json` | 修改生成件 | 计划可选 recipient，仅用于当前输出对象和命名 | R09，旧快照无该项继续有效 |
| `data/schemas/MessageIntent.schema.json`、`MessageResolution.schema.json` | 新增生成件 | 新公开请求/响应结构 | R01，在 export-schemas 注册 |
| `server/src/model.ts` | 修改，适配/请求/严格校验 | 同analyzeRuntime处理initial/supplement/clarification与purpose两分支、时序来源、精确Mock及旧预览 | R04，复用私有requestAnalysis/validateProposal |
| `server/src/workbench-mock.ts` | 新增 | 限定T09、明确回答示例、员工澄清决定及故障变体 | R04；全部返回仍走公共校验，旧预览Mock边界保留 |
| `server/prompts/intake.txt` | 修改，提案提示词 | interaction映射、澄清、更正及purpose的case-reanalysis/follow-up分析 | R04；无interaction且无purpose保留旧协议，有purpose使用对应新分析协议 |
| `server/src/app.ts` | 修改，现有HTTP分发、配置版本与文件响应 | R04校验resolution/用途；R09仅runtime export响应头用统一helper，保留限额及安全错误 | R04/R09，旧/api/analyze和/api/export原形状 |
| `server/src/output-service.ts` | 原则保留，必要 gate 同步 | 继续用 outputSnapshot 复验，并同 HTML/MD 导出 | R09；不引入第二输出器 |
| `shared/guidance.ts` | 保留匹配，必要小修 | 复用 evaluate/recalculate/decide/handoff；禁止模型批准指引 | R08；EX-G01–03 边界和拒绝历史 |
| `app/src/runtime-storage.ts` | R02 最小恢复修复 | 加载／导入时内存修复确定的旧缺口矛盾；保留备份和后续存储接口 | R02/R05；库名、版本、session、事务不变 |
| `app/src/workbench/CaseWorkbench.tsx` | 新增 | 双区装配、头栏、进度、面板选择 | R05，后续 R06–R10 接入 |
| `app/src/workbench/useWorkbenchCase.ts` | 新增 | 唯一 record、端口、保存和请求编排 | R05/R06；从 ModulePreview 提取已验证行为 |
| `app/src/workbench/types.ts` | 新增 | CasePaneProps、WorkbenchActions及临时视图类型统一定义 | R05，主agent唯一写入；面板按冻结接口接入 |
| `app/src/workbench/ConversationPane.tsx` | 新增 | 消息、真实问题、composer、澄清、未知/结束 | R06；只显示控制器的当前状态 |
| `app/src/workbench/InformationPane.tsx` | 新增 | 分组事实、类型、来源、更正、first | R07；复用 shared intake |
| `app/src/workbench/MaterialsPane.tsx` | 新增 | 指引决定与文件编辑／比较 | R08/R10；复用 guidance、outputs |
| `app/src/workbench/ReviewExportPane.tsx` | 新增 | 可读最终审核范围、有效预览、复制下载 | R09/R10；统一 outputSnapshot |
| `app/src/workbench/workbench.css` | 新增 | 双区、聊天、事实、建议、编辑及审核面板局部样式 | R05—R10由主agent集中写入；独立旧模块CSS不受影响 |
| `app/src/main.tsx` | 修改，入口分流 | 新工作台渐进接入及最终切换 | R05 加候选路由，R11 切根路由 |
| `app/src/module-preview.tsx` | R02 最小恢复修复，后续必要导航修改 | 修复后旧案不自动写回；独立模块与旧集成测试宿主 | R02/R11；测试路由继续可运行 |
| `app/src/Workbench.tsx` | 保留，旧 v1 基座 | 继续 `?view=foundation` | 本次不删除 v1 恢复逻辑 |
| `app/src/modules/intake/useIntake.ts` | 修改最小范围 | 旧预览消费修复后的纯函数 | R02/R11；新工作台不再实例化该 hook |
| `app/src/modules/intake/index.tsx` | 保留，必要缺口显示修正 | 独立 B 检查入口 | R02/R11；不承载新双区主流程 |
| `app/src/modules/model/index.tsx` | 保留 | 仅独立模型提案预览 | R11；根页不展示第二分析按钮 |
| `app/src/modules/guidance/index.tsx`、`outputs/index.tsx` | 修改可选 actor 注入及必要复用适配 | 原模块独立预览继续有效 | R08/R09；原 fallback 与服务门槛保留 |
| `tests/intake.test.ts`、`model.test.ts`、`outputs.test.ts`、`guidance.test.ts`、`runtime-foundation.test.ts`、`server.test.ts` | 按任务修改 | 在现有 harness 增加针对回归 | R01–R09，保留原断言含义 |
| `tests/workbench.test.ts` | 新增 | 新纯变换、消息时序、汇总、未知及决定恢复回归 | R02建立，R03/R06及相应业务任务扩充 |
| `tests/workbench-browser.ts` | 新增 | 新候选／根入口、保存、消息及完整流程；复用prototype脚本结构 | R05建立，R06—R10逐步补全，R11切根入口并回归 |
| `tests/prototype-browser.ts`、`integration-browser.ts` | 修改选择入口 | 继续跑旧宿主回归 | R11；不把原断言删掉制造通过 |
| `tests/browser-check.ts`、`module-browser.ts` | 保留或必要路由适配 | 底座及公共模块回归 | R11 |
| `docs/architecture/MODULE_CONTRACTS.md`、`PROTOTYPE_RUNBOOK.md`、`tests/README.md` | 后续修改 | 写实际接口、路由、操作与证据命令 | R11/R12，PRD 不改 |

所有 `data/business/*`、`data/evaluation/*`、已有 `data/fixtures/*` 和旧 evidence 保留。R04 的限定 Mock 回复表放 `server/src/workbench-mock.ts`（计划新增），其测试输入是合成技术样例，不能登记为新内容批准。最终只整理主入口里的旧装配调用和未使用 import，不删除独立预览文件或旧业务实现以缩短页面。

### 5.4 工作台面板接口

以下也是计划新增，放在 `app/src/workbench/types.ts`，由主 agent 在 R05 唯一写入。面板不得通过 DOM 点击隐藏旧模块来调用业务。

```ts
type WorkbenchActions = {
  sendMessage(input: { text: string; questionIds: string[]; draftRevision: number }): Promise<void>;
  retryMessage(messageId: string): Promise<void>;
  resolveEarlierAnswer(input: {
    messageId: string; target: Target; candidateSourceId: string;
    choice: 'keep-current' | 'use-earlier'; reason: string;
    expectedCaseVersion: number;
  }): Promise<void>;
  clarifyMessage(input: {
    messageId: string;
    expectedCaseVersion: number;
    decisions: ConfirmedMapping[];
    retainedQuotes: string[];
  }): Promise<void>;
  reanalyzeCurrentCase(): Promise<void>;
  setQuestionStatus(input: {
    questionId: string; status: 'unknown' | 'not-applicable'; reason: string;
  }): Promise<void>;
  endFollowUp(): Promise<void>;
  displayQuestionRound(): Promise<void>;
  correctFact(input: { target: Target; value: FactRecord['value']; reason: string }): void;
  correctTypes(input: { types: string[]; reason: string }): void;
  confirmFacts(): Promise<void>;
  decide(input: {
    id: string; decision: 'accepted' | 'modified' | 'rejected';
    reason?: string; step?: string;
  }): void;
  generateMaterials(): void;
  recordOutputEdit(input: { id: string; body: string; reason: string }): void;
  changeOutputRecipient(input: { id: string; recipientId: string; reason: string }): void;
  replaceProtected(input: { ids: string[]; reason: string; expectedCaseVersion: number }): void;
  reviewSelection(input: {
    outputIds: string[]; acknowledged: boolean; expectedCaseVersion: number;
  }): Promise<void>;
  deliver(input: { objectId: string; format: 'copy' | 'markdown' | 'pdf' }): Promise<void>;
};
type CasePaneProps = {
  record: RuntimeCaseRecord;
  actor: string;
  actions: WorkbenchActions;
  locked: boolean;
  notice: string;
  reportDraft: (key: string, dirty: boolean) => void;
};
```

`reportDraft` 使用稳定 key，例如 `composer`、`fact:E04:TX-01`、`output:SUMMARY`，宿主维护 Set，避免一个面板取消 dirty 时覆盖另一个仍 dirty 的状态。组件卸载必须由控制器先处理脏输入，不能靠卸载清零模拟保存。待展示问题提案和保护比较对象由控制器持有，面板额外 props 只引用它们，不另算业务状态。R05 冻结这两个临时视图类型后再并行实现面板。`clarifyMessage` 的值必须经过同一 Zod、quote、目标和更正保护验证，员工手工选择不能绕过类型校验。该动作按第6.3.1节重新请求完整分析，不自行构造 AnalysisResponse。`reanalyzeCurrentCase` 按第6.6节重读已记录来源，不复用 sendMessage 或已应用消息的 Retry。

## 6. 聊天实现专项

### 6.1 初始描述与后续补充

第一次发送且没有已记录 initial 消息时为 initial，调用现有 `addNarrativeSource` 的初始描述语义，A07 保留初始原文。后续 Send 统一为 supplement，整段来源 kind=answer，不改 A07，不再次追加 narrative 导致“初始描述”被最新一句覆盖。旧案没有 conversation 但已有 A07/narrative 时，后续输入也属于 supplement。

主业务的 Send、消息澄清、Retry、Continue follow-up 和 Reanalyze current case 均由同一控制器编排，统一调用 `ports.analyze` → `/api/runtime/analyze` → `analyzeRuntime`，请求用途按第5节接口明确区分。Send是否开放遵守4.2.1，已保存旧消息待澄清时可接收新消息，响应只能完成自身操作；全案状态由deriveAnalysisUpdate汇总。旧 C 独立预览仍可显示原始提案，主工作台只显示控制器已应用的结果及状态。保存设置、切换面板、打开案件、生成文件均不自动请求模型。一次主动操作只发起其明确需要的请求，不并挂第二套C模块自动分析或重复付费调用。

### 6.2 一条消息回答多个问题的完整路径

示例当前 Q1=E09/TX-01、Q2=C08/CONTACT-01、Q3=E08/TX-01。

输入 `The debit is pending. The sender has not contacted me again. I do not know the recipient.` 的处理顺序如下。

1. 控制器创建 MSG-UUID，保存完整原文 source 和 message.status=recorded。此时还没有任何问题被答，也未改变计数。
2. 成功保存后捕获 ticket，interaction.questionIds=[Q1,Q2,Q3]。请求包含现有 sources/facts/followUp 与当前消息来源，配置、密钥、权限、指引和正文仍不发送给模型。
3. interaction 分支让模型返回完整 `proposal` 和 `resolution`。Q1 quote=`The debit is pending.`，value=`reported pending`；Q2 quote=`The sender has not contacted me again.`，value=false；Q3 quote=`I do not know the recipient.`，status=unknown、value=null。系统产生的 explanation 用英文，quote 保留原语言。
4. 服务验证每个 questionId 在案内、target 完全一致、quote 属于消息、没有重复 questionId、值符合事实类型。禁止靠三个问题的排列序号猜对应关系。目标不确定的片段进入 unresolvedQuotes。
5. applyResolvedMessage先完整校验响应并对所有目标执行6.3.2时序保护，再在clone上建立片段source并调用typed answer函数。本例无较新同目标更新，故Q1/Q2更新原问题与事实；Q3按6.4.1记录unknown，E08仍null，轮次及总数保持1/3。遇到旧答案比较则转needs-decision路径。
6. 同响应facts与answers必须一致，答案目标不重复合并；其他有据事实也通过时序及unknown保护后才合并。无待决定比较时规范并应用完整分析，有比较时按6.3.2保留旧分类待更新。corrected值始终受保护。
7. 一次保存完整候选 record，成功后显示 Applied and saved；失败显示 Applied — unsaved，保留候选并只重试保存。对相同 messageId 不重复调用已应用批次。
8. 聊天显示 `Updated transaction status and continuing contact. Recipient remains unknown.`，左侧相应两个事实高亮，Q1/Q2 answered、Q3 unknown，派生 E09 缺口移除，E08 缺口保留。
9. 当前轮全部处理后，控制器评估停止／上限。仅在仍有业务必要且未停止时，请用户点 Continue follow-up 发起下一轮提案，成功保存后展示计数。不把上一次响应中的旧题列表再次保存成新轮。`displayQuestionRound` 在没有当前有效提案时先以最新案件调用同一 analyze 端口，传 purpose=follow-up 且不传 interaction；ticket 检查后以 follow-up origin 合并分析，再保存提案轮。有有效提案时直接保存展示。Continue 不创建新员工消息，也不重新应用上一 MSG。此时模型输入中的问题已经处理完成，才允许返回新 questions；消息响应在输入仍有 pending 时应返回 questions=[]。

应用多个答案是一个业务批次，不能一题成功写库、下一题失败后留半个完成状态。已有基础函数可能内部递增多个版本，允许版本有间隔，但完整批次只发布和保存一次。`saved` 表示整个当前候选的事务结果。

### 6.2.1 未预选问题的原问题回填统一（2026-11-07）

`interaction.questionIds` 是员工本次预选范围，不是新建问题权限。若主动补充未预选某题，响应仍可按原 Q ID 和准确 target／quote 关联同案唯一一条已 answered、unknown 或 skipped 的历史问题；应用时把该原 Q ID 补记到本消息的 questionIds，沿用原问题、来源与 history，计数不变。仅返回额外事实时，也只允许在其 target 唯一匹配这种历史问题且可定位精确来源片段时回填；同一整段来源被用于多个新增目标而无法区分片段、或同 target 有多个历史问题时，不猜测 Q ID，保留待澄清／安全失败。此规则不允许返回未预选的当前 pending 问题或新建问题，Mock 仍只支持6.5列明的示例。服务与客户端均执行相同限制，并测试停止后原 Q3 回填、歧义拒绝及计数不变。

### 6.3 部分回答、澄清与非问题补充

- 只说 `The debit is pending.` 时只答 Q1，Q2/Q3 pending，仍在当前轮。不能主动建下一轮，也不能把没提到的两问标 unknown。
- `It has stopped.` 无法判断指后续联系还是远程连接时，保留原文和 unresolved quote。显示 `Which detail does “It has stopped” refer to?`，让员工选择 Continuing contact、Remote connection 或 Provide more detail。选择目标后仍需给出合适的类型值及证据确认。
- 一段话含明确Q1答案和模糊片段时，明确部分可应用，模糊部分保持needs-clarification。同MSG按updates防重补齐目标。所有片段被明确处理或保留后，还须其对应完整分析成功、仍适用且无待决定比较，才可标该MSG applied；仅点击确认或保留说明不能完成。随后按4.2.1汇总其他MSG。
- 额外信息 `The caller also reports that remote access is still active.` 不要求先有对应问题。模型可以提议 G05=true 并引用原文，没有新问题计数。若同属已 unknown/skipped 的旧问题，模型返回原 questionId；仅对应事实而未正确关联原问题时，客户端按精确 target 找唯一旧问补齐，存在多个候选则澄清。
- 结束后输入新信息仍记录并分析，followUp.stopped 保持 true，计数不变。needsFactConfirmation=true，回原核对区确认变化，再处理受影响文稿和审核。

禁止把同一整段文本复制为每个问题答案。禁止用固定关键词列表假装支持任意自然语言理解。`parseAnswerValue` 只服务旧单题受控入口和显式结构输入，不能作为新聊天的多题理解器。

#### 6.3.1 澄清的完整请求、应用和恢复路径

T 决定为“先记录员工的明确映射，再请求完整分析，完整响应通过后原子应用”。`clarifyMessage` 只负责事件编排，仍将实际服务返回的 AnalysisResponse 交给 `applyResolvedMessage`。不在客户端拼一份旧 analysis 冒充新响应，也不先改事实后无条件清除 pending。

1. **读取与确认**。面板从原 MSG 的 unresolvedQuotes 取待澄清原文。员工必须同时选择目标和类型值。例如 `It has stopped.` → C08/CONTACT-01 → No，或 G05 → No，不能只选字段后由客户端猜 false。有原问题时填写其原 questionId，没有原问题时允许只填 target。员工也可明确选择 Retain as unresolved note，把无法确认的原文列入 retainedQuotes，不给它编造目标或答案。
2. **完整验证**。检查 expectedCaseVersion、消息仍属当前案件、quote 为原消息待处理片段、questionId/target 精确一致、同批目标不重复、值类型、unknown/not-applicable 的 null 语义。decisions 与 retainedQuotes 不可重叠。已应用目标若需真正更正，使用单独事实更正流程，不把澄清重放为新答案。任何无效项拒绝整批，临时选择保留。
3. **保存决定及请求意图**。分配该 MSG 下递增 revision，记录 clarifications 条目。新增 correction 来源，text 用英文明确记录“员工把原 MSG 的指定 quote 解释为该 target/status/value”，target 按实际目标关联；多个决定各自保留片段来源，clarification.sourceId 指向该批完整决定说明。原消息来源和已应用答案完全保留。设置 analysisUpdate={status:pending, operation:clarification, messageId}，一次保存。这一步不改变 facts、Question.answer 或计数。事务失败保留 UI 决定并重试保存，不发送请求、不重新分配 revision/source ID。
4. **请求完整分析**。保存成功后捕获当前 ticket，调用同一 ports.analyze，interaction 沿用原 MSG/sourceId/kind，并附 clarification={revision,sourceId,decisions,retainedQuotes}。questionIds 只含本次尚未应用的目标问题。模型输入仍有最新 facts/sources/followUp，明确指出哪些是员工确认的语义映射、哪些仅是保留的未解决说明。不要发送完整会话 actor 偏好，所需业务来源仍按现有模型边界过滤。
5. **服务端验证**。必须返回完整proposal＋resolution，并回显clarificationRevision。原问题决定在resolution.answers逐项对应quote/status/value；无原问题且answered的决定在proposal.facts对应target和值，引用确认来源；无原问题且unknown的决定在resolution.observations对应target/quote，禁止对此目标输出赋null的事实提案。unknown即使有原问题也不允许借proposal.facts另行清空已知值。Not applicable须按字段语义单独验证，不能用unknown分支替代。模型不能改写员工选择、重答已应用片段或将retainedQuotes当事实。新目标按原字段/记录规则验证，retainedQuotes保留分析局限，不成为绕过上限的新问题。缺失/冲突/引用不完整整份失败。
6. **应用与状态完成**。再次验证ticket/revision及完整响应，排除已应用updates，执行6.3.2时序保护和6.4.1未知规则。无比较项时更新本次Q/事实/分析/缺口及clarification状态；本MSG片段全部处理且完整分析适用才applied。存在模糊片段则needs-clarification，出现旧答案比较则needs-decision并保留原分类待更新，按6.3.2决定后分析完成原操作。随后deriveAnalysisUpdate扫全案，当前MSG成功不清其他阻塞。retainedQuotes仍为未解决说明，current仅表示全案分析适用且无未完成操作。
7. **提交与保存失败**。同一候选 record 一次保存。失败保留已应用内存候选并标 Unsaved，重试只保存这份候选；重复调用相同 MSG/revision 不再追加事实、history 或来源。成功前不能对外导出。已成功保存的部分原回答始终保留。

| 失败点／恢复条件 | Retry 的确定动作 |
| --- | --- |
| 澄清决定尚未保存成功 | 只保存原 revision/source/decisions，然后再开始请求 |
| 请求超时、解析错误或服务拒绝 | 保留已保存的决定和旧事实，条目标 failed，analysisUpdate failed；`retryMessage` 找到该 MSG 最新未 applied clarification，用相同 revision、最新 ticket 重发完整分析 |
| 完整响应已应用但案件保存失败 | 只重试保存内存候选，不再请求模型或重新应用 |
| 请求期间案件、角色或配置改变 | 旧响应丢弃；决定仍可查看。先按新状态重新验证原目标，再用新 ticket 重试；原问题不再适用时留待员工处理，不自动转移到其他目标 |
| 刷新恢复 recorded/failed clarification | 从已保存条目恢复目标、quote、typed value、revision 和 Retry 操作；不声称未成功保存的响应可恢复 |
| 已 applied revision 再收到回调或重试 | 返回原对象／提示已处理，不增加来源、历史、计数或版本 |

对第6.5节限定 Mock，澄清响应直接消费员工已经明确选择的 typed decisions，再构造完整提案和分析，仍经相同服务验证。它不能仅凭 `It has stopped.` 自行决定 C08 或 G05。真实模型走相同字段，fake-provider 测试覆盖它拒绝或更改员工映射的情况。

#### 6.3.2 旧消息重试的目标优先级与完成条件

ticketCurrent证明请求适用于当前案件快照，但不证明请求中的原消息比后来消息更新。重试保持原消息在conversation.messages中的位置，createdAt、MSG/source ID和初次记录的recordedFactVersions均不改变。消息数组只追加，不按重试时间或模型返回时间排序。初次记录新消息时捕获当前各target的fact.version，原本不存在的目标按0比较；该版本表只存数字，不复制事实值。

在applyResolvedMessage把answers或proposal.facts交给现有合并函数之前，统一对每个目标执行以下检查，不能只保护answered映射而漏掉同响应的额外事实提案。

1. 查原消息之后的已应用updates。后面的消息对相同target有disposition=current或已明确采用的更新，即为较新输入；unknown observation、historical和awaiting-decision不算事实当前值更新。appliedFactVersion记录实际写事实后的版本，用于追溯。首次正常写入的新消息也记录disposition=current。
2. 即使找不到较新MSG，如果当前fact.version已不同于原消息recordedFactVersions，也检查期间的直接更正和来源／候选变化；无法证明旧输入仍可覆盖时走员工比较。旧导入消息缺该版本表时，对已有不同值保守比较，不从重试时补一份新基线来取得优先权。缺失目标可按正常有据提案新增，人工corrected优先规则始终适用。
3. 旧值与当前值相同且无新增实质冲突时，只在原MSG保存该来源和disposition=historical；不再次写事实、不改原问题当前回答、不增加fact.version/history/计数。完整分析仍适用且原消息其他片段已处理后，该操作可以完成。
4. 值不同且已有较新更新时，保留当前值和原Q.answer，旧quote生成稳定来源并仅进入该事实的candidates。标明来源属于Earlier message，MSG.updates记outcome=conflict、disposition=awaiting-decision、supersededByMessageId（有明确较新MSG时）。fact.status改conflict并递增fact.version，既有当前值/sourceIds不被旧值替换。相同source/value候选重试只保留一份。原消息标needs-decision，不能伪装其旧答案已成为当前事实。
5. 若产生awaiting-decision比较项，响应中其他无冲突目标仍可在同一候选里应用保存，但这份旧响应的analysis不作为当前分类发布；保留之前分类为Previous analysis，员工决定后做最新事实分析。若没有比较项且全部目标合法，完整分析可正常应用，包含第3步同值只留历史的情况。所有响应结果和比较项一次保存，失败只重试该候选，不能让被拦旧值继续驱动理由或摘要。

员工在聊天原消息的比较卡中看当前值、较新来源、旧值、旧来源和关联原Q，使用Keep current value或Use earlier answer，均要求统一actor、理由及expectedCaseVersion。这属于原事实更正／冲突处理，沿用两阶段审核规则。

- Keep current value明确保留最新值，旧候选继续留历史，disposition=kept-current。若事实需要消除活动冲突，使用correctRuntimeFact确认当前值并保留候选历史，不删除较新回答或修改原Q.answer。
- Use earlier answer为员工新的明确决定，调用correctRuntimeFact采用旧候选，保留之前completed等旧值及来源history，并将所选候选及本次员工决定来源关联到当前事实。有关联Q时，沿用原Q ID更新其answer/history，updateFact=false避免重复改事实。disposition=adopted-earlier并记录实际fact.version，计数不变。
- 两种选择都记录MSG.updates.decision，新增correction来源说明原MSG、target、选择和理由。案件首次核对已存在时按direct规则设置needsFactConfirmation，受影响输出待更新。人工确认不能冒充外部核实。

`resolveEarlierAnswer`先校验候选source/target确属该MSG的awaiting-decision项及当前版本，在clone上应用并保存。比较期间又有新答案时，原expectedCaseVersion失效，须重新显示当前比较后选择。所有比较处理后原MSG暂为recorded，进入“决定已记录，分析待更新”；不能立即applied并解除全案阻塞。

后续分析是该旧操作的内部续步，通过现有purpose=case-reanalysis、最新ticket及最新facts/sources发送完整分析，沿用当前模型适配器。服务端从case.conversation派生与本次来源相关的sourceId/messageOrder/disposition，连同已记录员工决定提供给模型，不另建队列或发送员工偏好。它允许为完成这个MSG而执行，普通Reanalyze按钮仍按6.6的门槛禁用；其他MSG阻塞项保持。模型必须遵守本次明确员工决定。客户端再次执行来源时序保护，已kept-current的旧来源只能留历史，不能在再分析时重新生成同一活动冲突。人工采用值继续受corrected保护。

只有完整分析成功且适用于当前事实、该MSG无未处理片段或比较时，才标该MSG applied，随后deriveAnalysisUpdate汇总全部MSG。显式保留最新值也能完成旧操作，不必采用旧答案。完成前旧分类不恢复为current。若还有其他旧MSG未处理，案件继续阻断。

| 恢复位置 | 确定的Retry行为 |
| --- | --- |
| 旧模型响应已保存为needs-decision | 展示已有比较项，不重复发旧答案映射，不追加同候选 |
| 员工决定保存失败 | 只保存该决定候选，保留比较和选择，不重新应用更正 |
| 决定已保存，内部完整分析失败 | retryMessage识别已kept-current/adopted-earlier且无待比较项，仅重试最新事实分析，不重放原pending答案 |
| 完整分析已应用，结果保存失败 | 只重试保存相同候选，不重复审核或事实历史 |
| 刷新 | 从MSG状态、updates.disposition/decision和原来源恢复比较或决定后分析步骤；不依赖临时内存队列 |

限定Mock也必须覆盖同目标的两句明确示例 `The debit is pending.` 和 `The debit is completed.`，失败注入只使第一次操作失败，不改变消息顺序。必须回归MSG-1 pending失败→MSG-2 completed成功→Retry MSG-1：completed及Q当前回答保持，出现仅一份旧pending候选，案件待决定；Keep后最新值保持，Use earlier后只有员工明确决定才能改pending；完成最新分析后旧MSG可applied，不再永久阻塞。另测旧值相同、两次重试去重、刷新恢复、两笔交易不串目标、分析未更新前导出阻断。

### 6.4 Unknown、Not applicable、结束与后补

每个问题有英文显式状态控件，作用于该原问题 ID。Unknown / unable to answer 不改变已有确定事实为否，不重问该目标。Not applicable 要求员工明确选择并填写简短原因，保留其历史与依据；其事实是否可标 not-applicable 要通过目标语义检查，不能用“不想答”代替不适用。

End follow-up 始终可在首次核对后、尚未 stopped 时使用，包括目前没有 pending 问题但员工不再愿意补问的情况。原 `endRuntimeFollowUp` 已支持停止，新 UI 不沿用旧按钮仅 pending 时启用的限制。pending 变 skipped，answered/unknown 不变。同案不再新增问题。

未知、已跳过、已答后的新答案都沿用原 ID，`Question.history` 保存旧 status/answer，旧 Q 来源原文不修改。后补证据使用新 source，保留以前正文所引用的 Q1 等旧内容。冲突不能仅凭后补“answered”消失。达到 3 轮或 9 问时停止新增，当前轮已有问题仍可逐题处理。

#### 6.4.1 未知陈述与明确撤回分流

当前mergeRuntimeProposal对checked且未标corrected的事实可用null替换原值。本轮只读内存复现C08=false/extracted/checked接收null/missing提案后变null。因此新聊天层必须在调用合并函数前区分操作语义，并在服务端及applyResolvedMessage两处验证，不能只依靠人工更正保护。

| 当前输入及目标 | 允许的响应与应用 | 必须保留的已有内容 |
| --- | --- | --- |
| 有原Q的Unknown | resolution.answers记录原Q的unknown/quote/null，调用answerRuntimeQuestion时updateFact=false；同目标不得另有清空提案 | 已有非null事实的值、status、reviewStatus、sourceIds、候选、history和fact.version不变；Q旧回答进入Q.history |
| 无原Q的Unknown，目标已有值 | resolution.observations记录target/quote/unknown；不在proposal.facts返回该目标。应用时新增answer来源并在原MSG.updates记outcome=unknown | 已有false、字符串交易状态、金额及其核对/来源/版本不变；不自动视为冲突，也不产生新的“事实缺失” |
| 无原Q的Unknown，目标尚不存在 | 同样只返回observation；应用层可在经过字段及记录校验后确定性建立value=null/status=missing/unreviewed的占位事实并引用该来源 | 不虚构交易或其他重复记录；重复目标须引用已存在的合法recordId。只建一次占位，后续重试不加版本或history |
| 明确撤回/更正已有值 | 员工使用独立Correct fact，明确选择当前目标、值或Unknown并填写原因，走correctRuntimeFact及direct审核规则 | 旧值与来源进入history，原审核按依赖失效；不能用普通Unknown按钮隐式调用该路径 |

新observation只表达当前来源不能提供答案。更新原MSG及来源本身可使案件元版本变化，但不能因此使已有事实值变null。未知来源可从聊天和最终核对的来源详情查看；已知事实仍按原报告来源展示。若该来源确实使分类局限发生变化，完整分析通过analysis.version反映变化，不能通过更改已有事实来源或塞入无版本的生成正文改变文稿。

服务端对interaction中确定为unknown的目标禁止覆盖提案；客户端应用前再次拒绝。若模型同时返回observation和该目标的null事实，整份响应失败，保留原消息及事实，不先应用其他半份结果。不能静默删掉非法事实后把原分析宣称为有效。Mock、fake provider和live响应均走这一校验。普通额外事实提案也不能仅因新消息没有提及某字段而把已有值清空。

必要回归覆盖，无原Q的G05=false/checked，及无原Q或已存在Q的E09='reported pending'/checked，Unknown后值和fact.version不变；有Q时Q/history可更新但计数不变。另测缺失字段占位、显式Correct fact改为Unknown确实变null并留history，以及模型夹带null提案时原子拒绝。观察记录沿用原MSG/revision去重，不创建新问题。

### 6.5 Mock 与真实接口

当前 Mock 的具体限制为，它比较 narrative sources 与固定 T09 的 S1–S5 整体 JSON，其他叙述返回 MOCK_INPUT_UNSUPPORTED。它把当前 facts 复制成提案并恢复原始金额 2000，不解析答案或任意自然语言。不得把该能力写成已存在的聊天理解。

计划的课程 Mock 采用显式示例表，仍经相同 interaction/resolution 校验、应用、更正保护、计数、保存和输出流程。表放在计划新增 `server/src/workbench-mock.ts`，只允许以下输入及界面可见示例，不做模糊关键词命中。

| 输入范围 | 计划确定的结果 |
| --- | --- |
| `data/business/T09.json` 的 input 完整原文，允许 CRLF→LF 及首尾空白规范化 | 初始 T09 提案，当前 B–J 事实来自现有 intake fixture，绝不含未来回答、员工更正或审核 |
| `The debit is pending.` 或旧单题示例 `reported pending`，明确 Q1 目标 | Q1 → E09 reported pending |
| `The debit is completed.`，明确Q1目标 | Q1 → E09 reported completed，仍遵守较新消息及人工更正保护 |
| `The debit is pending. The sender has not contacted me again. I do not know the recipient.` | Q1 answered、Q2=false answered、Q3 unknown |
| `The debit is pending. It has stopped.` | Q1 answered，后半段澄清，不猜其他目标 |
| `It has stopped.` | 全段待澄清 |
| `The recipient is SYN Merchant C.`，明确 Q3，包括停止后 | Q3 原 ID 后补、E08 更新，停止及计数保持 |
| 界面 Unknown／Not applicable／End 控件 | 本地明确操作，不调用模型猜测 |
| 其他文本 | 明确提示 `This Mock demo supports the listed examples. Use a configured API for other synthetic input.`，保留输入 |

可以在该表增加明确列出的中文合成等价示例用于双语 smoke，但不得宣称通用双语模型效果。界面标明 `Limited Mock demonstration` 并可展开上述示例。真实 API 支持范围需实际验证。

T09 在新案的适配必须处理 S1–S5 和 TX-01 等固定上下文。

1. 原完整消息保存 SRC-ID，发送文本精确等于批准 input 时，建立 S1–S5 原段落来源，并检查 ID 未被其他内容占用。只在新案初始发送使用这一适配，旧案不得重写已有 S 来源。
2. Mock 提案使用现有初始 fixture 的 B–J 值和固定记录 ID，服务端 `validateProposal` 需要增加**仅限已严格识别 T09 的 Mock interaction**的固定记录 ID 白名单。允许 CONTACT-01/EVENT-01/TX-01/EVID-01，对应 family 和事实 ID 必须一致。普通 live 模型仍使用 MODEL-requestId-family-NN 规则，不能放宽所有模型的记录校验。
3. 初始空案不预载 T09 facts 或分类。只有发送已标明的完整 T09 演示原文后，Mock 才返回提案并由同一合并函数应用。
4. live 对相同 T09 如产生不同记录 ID，现有指引匹配可能无匹配。显示仅摘要，不能把 live 记录强行重命名以伪装可匹配。推广指引匹配另由 D02 决定。
5. 旧无 interaction、无 purpose 的 C 预览 Mock 行为和测试继续保留。新 interaction 分支绕开旧 narrative JSON 完全相等检查，改用上述更明确条件，不能直接删掉旧保护让任意文字获得固定结果。新工作台 purpose=follow-up/case-reanalysis 的无 interaction 请求也可以进入新 Mock 分支，但必须同时满足已记录初始 MSG 原文精确等于批准 input、S1–S5 内容完整且没有其他不同 narrative。这个额外识别条件只支持已实际发送的 T09，不支持任意消息。补充来源为 answer，不破坏该条件。Continue 的 Mock 只基于当前事实和既有问题状态生成缺口/下一轮提案，不能重新填回已更新答案或再次把初始2000作为新的答案值。case-reanalysis 单独按第6.6节处理。

### 6.6 Reanalyze current case 独立操作

信息区提供Reanalyze current case，调用actions.reanalyzeCurrentCase()。它与Send、Retry message、Continue follow-up区分意图，共用分析端口与ticket。普通按钮在没有来源、存在未记录输入或任一消息blocker时禁用，说明具体项。6.3.2员工决定后的内部分析是完成该MSG的续步，不点击普通按钮，不套用其“无消息blocker”门槛；仍校验operationId/ticket并保留其他MSG阻塞。

执行顺序为，经deriveAnalysisUpdate确认没有消息阻塞，记录pending/operation=reanalysis并保存，捕获最新ticket，调用ports.analyze({case,ticket,purpose:'case-reanalysis'})，不传interaction。服务将已有原文、后补来源、事实和人工更正一起送入完整分析，不新增MSG/来源。服务要求proposal.questions=[]且无resolution。返回后current检查，通过mergeRuntimeProposal(origin=direct)及refreshRuntimeGaps(origin=analysis)合并，再重算受影响指引、提出文稿更新，将自身操作设completed后重新派生案件状态并保存。它不调用appendSavedQuestionRound，所有问题ID/回答/计数保持。

Mock 只对已记录的精确 T09 提供该操作。它可以从 S3 再提出原金额2000作为有来源的候选，其他已回答目标保留当前答案，不能用初始未知值覆盖答案。员工200仍是当前值，首次出现2000冲突时按 direct 规则要求核对变化。重复完全相同结果不增加业务对象版本或要求新审核。正常模型也不得静默覆盖员工更正。

界面显示操作进度和失败；Retry analysis 再调用 reanalyzeCurrentCase，复用已记录案件而非再次发送原文。网络失败保留旧分类和人工事实并标 failed，不能发布为最新分析。结果应用后保存失败只重试保存。请求设置/案件变化时丢弃旧结果。这一操作不复用 `applyResolvedMessage` 的 MSG 去重，因此已应用消息不会阻止重新分析。

## 7. 审核、可读内容和输出专项

### 7.1 可读审核与名称

`shared/field-labels.ts` 计划从字典整理 A–J 全部 70 项的英文业务名称、分组和必要的枚举显示。例如 E09 为 Transaction status，E04 为 Reported amount，C08 为 Continuing contact。`targetLabel` 返回 `Transaction status · TX-01`，details 保留 E09/TX-01。统一映射用于事实卡、问题、缺口、最终审核及生成正文，接收方名称来自配置 title。已有内部 ID、原文来源、filename 中的对象 ID 继续可追溯。

输入输出中的原始来源引用可保留中文，界面标签、系统解释、生成的分析和文件章节为英文。事实表来源详情展示原文，不能伪造已验证的英文翻译。模型文字变换只能保留原意义，不翻译真实 secret values。

首次核对显示当前事实、候选类型、来源、未知和冲突，允许保留不确定。最终审核显示当前事实变化概览、分类及依据、未解决项、选择正文、相关建议及指引／岗位边界。JSON 只放 Test workspace 或折叠技术详情，不承担主要审核内容。

### 7.2 审核范围与单次明确确认

最终页面列出可选 SUMMARY、HANDOVER-BANK、HANDOVER-TELCO，默认只选择当前文件。用户可选多份共同审核。界面展示实际选择对象、版本和依赖建议闭包，并使用一句明确英文确认。一次 Review selected materials 产生每个对象的独立 final record，供原追踪和导出门槛使用。

逐对象记录不要求每个对象重复勾同一复选框。员工仍须先对每条建议作 Accept／Modify／Reject 决定，批量审核不能代替建议决定。已有有效建议审核可以复用，没有变化时不重复追加同样审核。一个未完成依赖使整次审核失败，页面列明具体对象，不留下部分审核结果。

审核闭包捕获当前版本后到点击确认前，任一事实、角色、指引、建议、正文或选择变化都取消原 ack，显示 Review selection changed。批量函数用 expectedCaseVersion 再校验，先在 clone 上调用现有 finalReview 依赖顺序再一次应用、保存。

#### 7.2.1 审核标志与生成正文分离，固定审核顺序

当前 `outputProposals` 的 Status / check 列把 fact.status 和 fact.reviewStatus 同时写入 body，而依赖只记录事实内容版本。只把 unreviewed 改 checked 就会改变重新生成的正文，但不改变这些依赖，现有 outputCurrent 也没有比较正文。第一项审阅指出的风险可在当前代码内存复现。

R09 必须将生成表格改为业务提取状态，例如 Extraction status，仅使用 fact.status；reviewStatus 在信息区和最终审核界面显示。生成正文、标题和生成依赖均不能随纯 unreviewed→checked 变化。员工更正的值、来源、原因、冲突候选及历史仍在正文中，照原内容版本规则失效。输出的最终员工审核信息继续由 snapshot 元数据输出，与 body 分开。

为处理旧保存正文，计划在 RuntimeOutputSchema 增加可选 `bodyFormatVersion: 2`，新 outputProposals 总是生成2。旧对象未带该值仍可读取、检查和保留 history，但新实现 outputCurrent 判为 Needs document update，先经明确 Generate/比较更新后再审核输出。即使依赖版本没变，也不能把仍含旧 Status / check 的对象直接放行。员工旧稿走原保护比较，不自动清洗或覆盖。正文由员工主动写入的文字沿用人工编辑规则，不新增关键词过滤。

最终审核严格按以下顺序执行。

1. 根据最新事实/分析/决定生成或明确确认文稿更新。完成所有保护比较，选中对象 bodyFormatVersion=2，analysisUpdate current，direct 更改所需首次核对已完成。
2. 用户看到这些实际保存于 record.outputs 的候选正文和各自版本，同时看到界面上的当前 fact.reviewStatus、未知与冲突。Review selected 的 ack 对应这一案件版本和范围。
3. 点击后校验 expectedCaseVersion，捕获选择对象的 body、objectVersion、dependencies、recipient 和 selection。之后仅在 clone 上把正常补问的 unreviewed 标 checked，corrected 保持 corrected。不改事实内容版本、来源、历史、分类或文稿。
4. 程序断言改标志前后 outputProposals 的 body/dependencies 相同，选择对象的实际正文和版本保持捕获值。任一内容不同，整次审核失败并提示 Update materials before review，不能在提交内部重生成后继续审核用户没看到的版本。
5. clone 上先审核依赖建议、再审核选中输出，写逐对象 final 记录并发布整个候选。pure checked 标志不追加 first 审核，也不递增文稿版本。案件元数据版本可因审核事件递增。
6. 统一保存成功后启用有效预览/复制/下载。三种输出使用同一 stored body；snapshot 的 caseVersion、review actor/time 属于本次最终审核元数据，正文必须与步骤2可见的候选逐字符相同。保存失败仅重试保存，不能重生成或重复添加已完成审核。

R09 必须增加正常补问后新事实仍为 unreviewed 的专门回归。断言 pure reviewStatus 变化不改变生成 body/dependencies、不增加 output.version，批量final成功后 stored body＝审核前可见 body＝MD正文＝HTML/PDF正文，最新事实checked。另测旧 bodyFormatVersion 缺席的对象确实阻断，员工旧稿得到比较而非静默升级。PDF允许原有分页footer和抽取空白差异。

### 7.3 编辑与重新生成

- 工作正文未 Record edit 时不能保存“已记录正文”、切文件、切面板丢输入、最终审核或交付。明确记录后走 `editOutput`，旧正文和理由留 history，Employee edited 标记保留。
- `regenerateOutputs` 的 protectedIds 和 `outputProposals` 用于当前／拟更新双栏比较。用户选择 Keep employee content 时保留正文，无效 basis 仍阻止输出；确认替换需要 actor、reason 和比较版本一致。不能把 keep 理解为重新绑定旧正文到新依据并自动恢复审核。
- Modify recommendation 复用原决定与历史，刷新引用的正文。Reject 后摘要及交接稿不再列为待执行。无关银行稿的审核不应因只拒绝电信建议失效。
- 只改一份正文不改共享 facts，其审核单独失效。字体、面板布局、展开状态不改正文和对象版本；正文字符变化按内容编辑处理，不引入“自动识别纯排版”的自然语言判定。
- 接收方改动仅允许从当前角色配置选择。记录旧接收方与正文历史，更新该稿版本及依赖并重审，不新增任意机构。课程主线仍使用两个既有配置对象，无新增收件人内容批准。

接收方编辑的具体接口也需实现，不能把文件选择器当成接收方编辑。计划在 `RuntimeOutputSchema` 加可选 `recipientSelection: { recipientId: string; actor: string; reason: string }`，旧对象缺席时沿用默认接收方。`editOutputRecipient` 只对 handover 生效，验证配置内接收方，保存旧 recipient/body/selection 的序列化历史，设置新的 selection、递增该对象版本并标 Employee edited；当前正文先保留供比较。`outputProposals` 根据该 selection 选用现有接收方职责和对应 EX-G01 或 EX-G02/03 依据，保持对象 ID 稳定，拟更新正文通过原 protectedIds 比较后才能替换。无对应有效依据时该稿 inactive，不能仅换标题继续导出。`outputCurrent` 比较 selection、recipient 和新依赖，不能把旧正文自动视为新接收方有效稿。

生成提案必须携带同一 recipientSelection，`regenerateOutputs` 对比、替换及 `outputCurrent` 均使用它。运行 schema 验证 selection.recipientId 属于当前角色配置，actor/reason 非空。接收方改动历史使用现有 history.previous 字符串保存带 kind=recipient-change 的 JSON 及旧正文，显示时识别该事件并可读呈现，其他历史字符串仍按原正文处理。这样不要求为历史记录升级版本或改写旧 history。

文件身份按 caseId＋稳定 objectId 确定，实际 recipient 是可变业务属性，objectVersion 是该稿版本。同一接收方可以存在不同稳定文稿，两者不合并或互相覆盖。R09 给 RuntimeExportSnapshotSchema 增加可选 recipient，runtimeSnapshot 从输出传入。`outputSnapshotFilename` 的 handover 规则统一为以下形式。

```text
<case>__doc-<stableObjectId>__to-<actualRecipientId>__v<objectVersion>.<md|pdf>
SYN-DEMO__doc-HANDOVER-BANK__to-HANDOVER-TELCO__v2.md
SYN-DEMO__doc-HANDOVER-TELCO__to-HANDOVER-TELCO__v2.md
```

两份稿件即使接收方和版本相同，仍由稳定objectId区分。各组成部分使用同一个可逆UTF-8百分号编码规则，只保留ASCII字母数字和连字符，其余字符含下划线均编码，确保值不会冒充分隔符或因统一替换为下划线而碰撞。输出文件名不包含正文中的自由姓名。旧快照没有recipient时使用原 caseId/objectId 文件名规则，摘要继续 caseId_summary_vN，不改历史已下载文件。

此变更由R09主agent集中修改shared/runtime.ts、shared/outputs.ts、shared/export.ts、两个runtime schema生成件和server/src/app.ts的runtime导出响应头；R10只接入控件。测试覆盖配置接收方选择、无依据阻断、比较前不可输出、替换后重审、无关稿状态保持，以及两份稿指向同接收方同版本的MD/PDF名称不同、客户端与服务端使用同一命名函数。

#### 7.3.1 HTTP下载名传输与共享文件名一致

当前server/src/app.ts的POST /api/runtime/export在Content-Disposition中执行 `result.filename.replace(/[^A-Za-z0-9_.-]/g, '_')`，会把共享命名函数的百分号替换掉。R09必须修正这处现有响应，不能只测output-service返回的filename。

`outputSnapshotFilename`返回值是浏览器最终应保存的文件名，包含组成部分的字面百分号编码。`contentDispositionForFilename`先验证它没有CR/LF/NUL或路径分隔符，再构造attachment头，固定ASCII fallback为scamsafe-download.md或.pdf；filename*使用UTF-8并对**整个最终文件名**做传输编码。因共享名已含字面%，此处必须再次编码为%25，客户端按filename*解码一次后才回到共享名。不能先decode共享名，也不能把%替换为下划线。

```text
共享文件名组成部分   SYN%5F%E6%A1%88%E4%BB%B6
filename*中的对应段  SYN%255F%25E6%25A1%2588%25E4%25BB%25B6
解码一次的下载名片段 SYN%5F%E6%A1%88%E4%BB%B6
```

helper的filename*格式为 `filename*=UTF-8''<encoded-full-filename>`，保留必要的属性分隔和引号转义。正常产品downloadBlob继续使用共享命名函数的最终值，HTTP路由保留服务返回bytes和contentType，只替换其Content-Disposition构造。旧/api/export响应保持原行为。

在tests/server.test.ts或outputs.test.ts用真实createApp＋exportRuntime注入发POST /api/runtime/export，分别检查MD/PDF响应。caseId至少含中文、下划线及字面百分号，例如SYN_案件%01，另含两份稳定文稿同接收方同版本。断言filename*解码一次严格等于outputSnapshotFilename，bytes未改变、扩展名正确、头无控制字符，且不出现百分号被替换的旧行为。测试输入不用实际客户数据。新工作台浏览器测试实际下载，比较download.suggestedFilename与同一共享函数返回值，MD/PDF均执行；fallback不能被当作命名一致断言的期望值。

### 7.4 同快照预览、复制、MD 与 PDF

审核前可以展示 Inspection draft，明确尚未满足有效输出资格。审核后有效预览严格经 `outputSnapshot` → `outputSnapshotToHtml`，复制严格经 `outputSnapshotToMarkdown`；MD/PDF 服务继续 `exportRuntime` → `outputSnapshot` 复验，PDF 复用同 HTML。

所有格式应有同一 caseId、caseVersion、objectId、objectVersion、正文、未核实项、来源、合成标记、review actor/time。PDF 分页 footer 可附加显示，不算正文差异。比较归一化只允许 CRLF/LF、PDF 分页与空白抽取差异，不放宽事实文字、数值和对象版本。

输出依赖已审核但尚未保存时显示 Save case to enable output。点击交付后保存或审核状态改变、切案、切对象、产生 working edit 时，丢弃迟到下载。复制和下载成功提示必须在浏览器 API 完成后发出；复制还需验收时实际粘贴。失败保留当前有效 review 与正文，允许同版本重试，不能重新分析改稿。

无有效指引时只生成 SUMMARY，固定提示 `Insufficient approved guidance; human review required`，不生成新接收方稿或具体行动建议。历史接收方稿留检查但不可导出。审核闭包只有当前 SUMMARY 及最新事实／分析，不能要求选择不存在的建议。文件名继续 `caseId_summary_vN.md/.pdf`。

## 8. 可逐步执行的任务卡

任务内的命令均从仓库根目录执行。C01–C09 是第 11 节的真实命令定义，均来自当前仓库已有脚本或 tsx 执行方式。N01 是本计划新增脚本后的命令，必须先完成对应任务再运行。每个 R 的变更文件是允许修改范围，未列共享文件由主 agent 协调。每次运行证据使用新批次，不能覆盖旧文件。

### R01–R04 实施前的阶段落点统一（2026-11-07）

R01 定义并验证请求与响应的结构契约及请求内 interaction/purpose 互斥；响应与请求的对应关系在 R04 接入模型与 HTTP 时执行完整运行时验证，R01 不调用尚未实现的服务路径。R01 对保存记录的引用进行严格校验；消息阻塞派生及伪 current 缓存的检查由 R02 实现并测试，生成、最终审核和导出的完整门槛按 R09 接入。R01 的相关验收按这些分阶段落点执行，不提前声称 R04/R09 的服务或界面已经完成。

### R01 冻结兼容数据与消息接口

- **目标与输出**。落实第 5.1 节的 Zod/type，形成可编译公共契约和旧备份兼容断言。
- **前置**。重新核对 HEAD、工作区和用户当轮实施授权。记录新增工作，不恢复 stash。
- **允许文件**。`shared/conversation.ts`（新）、`shared/runtime.ts`、`shared/module-ports.ts`、`shared/export-schemas.ts`、第 5.3 节三项 schema 生成件、`tests/runtime-foundation.test.ts`、`tests/server.test.ts`。
- **先读**。`RuntimeCaseRecordSchema`、`AnalysisRequestSchema`、`ModuleProps`、`BackupSchema`、`runtimeDependencies`、`shared/export-schemas.ts` 的生成循环。
- **顺序动作**。① conversation 只依赖 schema 中的 Target/Fact 类型，避免循环运行导入。② 增加可选root字段、澄清revision/decisions持久化、请求interaction及其clarification、互斥purpose、响应resolution和可选actor。③ 加消息、来源、问题及澄清引用约束。④ 有interaction必须有匹配resolution，澄清须回显revision；purpose=case-reanalysis/follow-up时不返回resolution，均无时保留旧预览形状。⑤ schemas生成并检查diff，仅接受计划变化。 ⑥ 定义needs-decision、recordedFactVersions及updates的时序disposition/员工决定字段，新消息捕获版本，旧数据缺字段仍可读。
- **保留行为**。schemaVersion继续为2，旧v2缺新增字段仍可读取，legacy v1独立；无interaction且无purpose的旧预览分析仍可调用；模拟审核不升级、坏引用拒绝。旧输出正文资格按R09格式迁移规则处理。
- **测试**。旧v2 JSON省略新字段仍读写；新消息坏source/Q ID/重复MSG拒绝；澄清typed值/revision/引用及UnknownObservation结构有效并可恢复；interaction与purpose互斥；旧response兼容；未知top-level key拒绝。保存的current不能掩盖未完成消息，资格检查重新派生并阻断。新增字段不改原依赖版本。 加测新旧消息时序字段、待决定来源引用和刷新恢复，缺recordedFactVersions时采用保守比较。
- **命令**。C01、C02、C03、C09。本轮文档任务不运行 schema 生成，实施时才执行 C09。
- **界面检查**。旧 `?module=intake` 和 `?module=outputs` 能打开保存案，无 schema 错误。
- **完成条件**。类型检查、兼容测试通过，生成件 diff 与契约一致，没有批准包变化。
- **失败定位**。strict Zod、跨字段引用 refine、BackupSchema、生成输出文件列表。

### R02 空案、事实／问答纯函数和 F01-001

- **目标与输出**。完成空案和原子应用函数，修好派生缺口并保留人工更正与计数。
- **前置**。R01。
- **允许文件**。`shared/workbench-case.ts`、`shared/case-gaps.ts`、`tests/workbench.test.ts`（均新）、`shared/intake.ts`、`app/src/modules/intake/useIntake.ts`、`app/src/modules/intake/index.tsx`、`app/src/runtime-storage.ts` 与 `app/src/module-preview.tsx` 的4.4.1恢复边界部分、`shared/runtime.ts` 的4.3.1／4.4.1校验部分、`shared/outputs.ts` 中缺口生成部分、`tests/intake.test.ts`、`tests/outputs.test.ts`。
- **先读**。`addNarrativeSource`、`mergeRuntimeProposal`、`correctRuntimeFact`、`confirmRuntimeFacts`、`answerRuntimeQuestion`、`eligibleQuestionProposals`、`appendSavedQuestionRound`、`outputProposals`。
- **顺序动作**。① 写合法空案工厂。② 增加typed answer options保留原调用。③ 整批验证mapping/observations，按6.4.1记录未知而不清空已有值，处理MSG/revision幂等。④ 按4.2.1实现deriveAnalysisUpdate，逐消息完成后全案汇总。⑤ origin和first reviewer区分训练/员工及follow-up/direct。⑥ 缺口计算和历史迁移统一B/E读取。⑦ 已问target防重、不同record可问，角色变更保留事实/计数并更新依赖。 ⑧ 所有answers和额外facts在合并前执行6.3.2时序检查；实现resolveEarlierMessageTarget纯函数，待决定项进入全案blockers。⑨ 按6.2.1唯一目标及证据规则，将未预选但已处理历史问题的补充回填原Q。
- **保留行为**。200 人工更正不被 2000 覆盖，后补新来源不改 Q1 旧原文，停止后不重开，原 first 默认模拟，仅显式 reviewer 记录员工事件。
- **测试**。F01回归；unknown/skipped缺口及not-applicable语义；原子批次/MSG＋revision幂等；MSG-1待澄清或failed＋MSG-2成功后全案仍阻断，处理旧项后才current；恢复伪current缓存仍阻断；无原Q的checked布尔false及E09状态收到unknown保持值/核对/来源/版本，显式更正才可变null；未知占位只在目标缺席时建立；3/9、两交易隔离、空案及旧案迁移幂等。 加测旧pending失败→新completed成功→旧Retry不回滚值或Q.answer；Keep/Use两种明确选择、同值历史留存、重复Retry候选去重、缺旧版本表、两交易隔离及决定后分析完成状态。
- **命令**。C01、C02；可加 `& .\node_modules\.bin\tsx.cmd --test tests/intake.test.ts tests/outputs.test.ts tests/workbench.test.ts`。
- **界面检查**。旧 intake Q1 保存 reported pending 后，B 缺口与新生成摘要均不把 E09 列为未解决；金额更正、Unknown、结束仍可用。
- **完成条件**。缺口单源、人工优先、消息幂等和旧单题入口均有实际测试通过。
- **失败定位**。`parseAnswerValue` 的 null/false 区别、fact.history/sourceIds、analysis.version、输出 dependencies、候选是否活动。

### R03 英文字段和对象显示名称

- **目标与输出**。全 A–J 映射与安全 fallback，完成共享函数和生成正文的名称接入，供R07之后的界面复用。
- **前置**。R01，修改输出生成部分需等待 R02 完成。
- **允许文件**。`shared/field-labels.ts`（新）、`shared/outputs.ts` 中名称生成部分、`tests/outputs.test.ts`、`tests/workbench.test.ts`。
- **先读**。字段字典 A–J、`TargetSchema`、`outputProposals`、`outputSnapshotFilename`、配置 role.recipient titles。
- **顺序动作**。① 建立 70 项 fieldId→English label/group 映射。② targetLabel 拼记录号且 details 可查 ID。③ 枚举显示归一，保留原值与历史原文。④ 输出正文使用业务名并保留 ID 追溯，不改 filename 追踪机制。⑤ 更新 snapshot 内容断言，不能只删除旧检查。
- **保留行为**。不同记录、币种及状态不合并；员工历史正文不自动重写；未知字段 fallback 到原 ID，不能崩溃。
- **测试**。映射覆盖数与字典一致，E09/E04/C08 正确，pipe/换行安全，MD/HTML 正文一致、ID 仍存在。
- **命令**。C01、C02、C08。
- **界面检查**。R03不要求新增或修改页面。检查测试生成的正文／HTML片段包含英文业务名及内部ID，实际页面接入与交互观察由R07验收。
- **完成条件**。一个名称来源、70 项覆盖、有 fallback，生成正文及测试通过。页面显示不作为本任务阻塞条件，R07负责主界面接入；旧预览标签保留原实现。
- **失败定位**。字典计数、shared/outputs 字符串、HTML escaping、旧 snapshot 断言。

### R04 模型 interaction 与限定 Mock

- **目标与输出**。同分析服务返回真实多题映射，Mock 与 fake/live provider 经同验证和应用路径。
- **前置**。R01、R02。R03 可并行，但共享文件写入先后由主 agent控制。
- **允许文件**。`server/src/model.ts`、`server/src/workbench-mock.ts`（新）、`server/prompts/intake.txt`、`server/src/app.ts`、`tests/model.test.ts`、`tests/server.test.ts`。
- **先读**。`requestAnalysis`、`validateProposal`、`analyzeRuntime`、HTTP runtime analyze 路由、`tests/model.test.ts` 的 fake provider、`referenceSource`/`context`、`fixedQuestions`。
- **顺序动作**。① 无interaction且无purpose走原协议。② interaction用含proposal/resolution的wrapper；澄清附完整确认映射、来源和revision，按6.3.1验证；供应商每次只调用一次requestAnalysis。③ caseData包含当前interaction或purpose，所需sources/facts/followUp；purpose=case-reanalysis强制questions=[]，follow-up按既有上限。④ 校验IDs、target、quote、typed值、确认映射一致性及额外字段。⑤ exact T09启用限定Mock，澄清消费明确选择，重分析和Continue按6.5/6.6分别处理。⑥ 服务路由复验resolution及purpose分支，保留配置版本、安全错误和超时限额。⑦ 字段缺口输出规范机器串，非字段限制明确区分并保持英文。 ⑧ 给模型提供派生sourceId/messageOrder/disposition与员工决定；限定Mock增加completed示例和旧消息失败注入，保持同一校验路径。⑨ 服务与客户端均按6.2.1验证未预选的唯一历史Q回填及精确来源。
- **保留行为**。live 不接收故障注入、不能输出权限/审核/建议，secret 不进入响应，不读取或打印实际配置密钥；旧 analyzeLive、旧 C 测试继续有效。
- **测试**。同消息多题/部分/歧义/未知、额外事实、错Q ID/记录/quote、同目标冲突、nested extra keys、配置变化、Mock边界及MODEL记录校验；澄清C08/G05分别生效；无原Q的unknown必须返回observation，模型夹带同目标null提案原子拒绝；其他旧MSG状态不因新响应改变；重分析不新增MSG/来源/问题，重复相同结果不产生新审核。 加测最新ticket下旧消息仍返回pending时，由应用层时序保护拦截，决定后分析须遵守当前员工选择，不能仅靠模型提示保证。
- **命令**。C01、C02；定向 `& .\node_modules\.bin\tsx.cmd --test tests/model.test.ts tests/server.test.ts`。
- **界面检查**。候选工作台接入后按 U03/U04；此前通过实际 HTTP fake-provider 检查响应，不能预报 UI 已验收。
- **完成条件**。新旧协议测试通过，Mock 精确支持范围有常量表及英文提示，providerCalled 标识正确，没有通用关键词解析冒充模型。
- **失败定位**。HTTP schema、wrapper schema、noExtraKeys、MODEL 新记录验证、source canonicalization、settingsRevision。

### R05 新工作台壳、统一保存和脏输入保护

- **目标与输出**。独立可打开候选双区入口与唯一控制器，先接空案／历史／保存，再接业务。
- **前置**。R01、R02。
- **允许文件**。`app/src/workbench/CaseWorkbench.tsx`、`useWorkbenchCase.ts`、`types.ts`、`workbench.css`（均新）、`app/src/main.tsx`、`app/src/runtime-storage.ts` 的必要兼容修复、`tests/workbench-browser.ts`（新）的壳与存储部分。
- **先读**。`ModulePreview` 的 restore/save/guard/importBackup、inert、beforeunload、`runtime-storage.ts` 全部函数、`ModelSettings` 保存事件。
- **顺序动作**。① 新增 `?view=workbench` 候选路由，根页暂留旧宿主。② 冻结 CasePaneProps/WorkbenchActions。③ 控制器一份 record/current 和 integration session；无历史先角色选择，Start case 用空案工厂。④ 接历史、统一 Save case、新建三选项、JSON 备份／导入。⑤ 以 dirty Set 保护所有临时编辑，事务时 inert，网络等待允许更正并使 ticket 失效。⑥ 顶栏 actor sessionStorage 与 API settings 独立入口。⑦ 页面标出 Pending implementation 的未接业务，不能展示成功假按钮。 ⑧ 按4.1.1区分composer与otherDraftKeys，加入draftRevision、同步operationId及私有saveOperationSnapshot；操作内保存仅豁免匹配的本次composer，不回调公共Save case保护造成自锁。
- **保留行为**。保存失败留原案和输入，同号替换确认、坏备份不覆盖，密钥不进 backup，旧 integration session 可恢复。
- **测试**。无历史空案、旧案恢复、不同案隔离、3 个未保存分支及失败、迟到保存、dirty Set 两面板互不清零、旧 v2 无会话恢复。 加测首条草稿dirty时Send启用、同时有working body时显示Go to edit、已记录未保存案件可随消息保存、双击仅一条MSG、源保存失败同ID重试及公共保存仍保护未发送草稿。
- **命令**。C01、C02；C04 启服务后人工打开候选入口，N01 在脚本已完成的覆盖范围内运行。
- **界面检查**。U01、U12、U13，两个区域同时显示；旧根页仍可用。
- **完成条件**。候选壳真实读写可用，工作输入保护无丢失，主入口未提前切换。
- **失败定位**。session 字符串、current ref、save 完成条件、dirty key、异步导入二次保护。

### R06 接入真实消息、回答和补问调度

- **目标与输出**。ConversationPane 与控制器完成第 6 节所有消息路径。
- **前置**。R04、R05。
- **允许文件**。`app/src/workbench/ConversationPane.tsx`（新）、`useWorkbenchCase.ts`、`CaseWorkbench.tsx`、`workbench.css` 的聊天部分、`tests/workbench.test.ts`、`tests/workbench-browser.ts` 的消息部分。
- **先读**。`useIntake.runAnalysis/saveQuestionProposals/answerQuestion`、新 `applyResolvedMessage`、`ticketCurrent`、`ModelSettings` 的 saved 事件。
- **顺序动作**。① initial/supplement分流及Send门槛按4.2.1。② 源消息先保存再请求，T09准备S1–S5。③ 保存后捕获ticket，完整响应检查current。④ 原子应用答案/observation/事实/分析，unknown不清空已知值。⑤ 6.3.1澄清全链及分步骤Retry，仅完成自身MSG/revision后deriveAnalysisUpdate扫全部消息。⑥ 当前轮展示保存、状态、结束、后补及上限。⑦ 普通Reanalyze/Continue用purpose且无消息阻塞才开放；6.3.2员工决定后的内部分析按其续步规则执行，不套用普通按钮门槛。⑧ 刷新重建blockers，界面展示全部未完成消息，不信缓存current。 ⑨ Send消费捕获草稿；同一操作的源保存/请求/结果保存允许继续，失败阶段分开恢复。⑩ 接入resolveEarlierAnswer比较卡、纯选择保存和最新事实分析续步，Retry不会改变消息顺序或重放已处理旧答案。
- **保留行为**。只有成功保存展示的新轮计数；已有题稳定 ID；模型结果不覆盖新更正；新设置不让旧请求冒充成功。
- **测试**。6.2/6.3/6.3.1逐状态及分阶段Retry；旧MSG待澄清或failed时新Send按门槛允许，MSG-2成功后MSG-1仍列blocker，材料/审核/输出继续阻断；保存刷新后blockers相同，旧MSG处理后分析含新事实才current；无Q unknown不清空false/E09，显式更正独立；6.6重分析不新增消息/轮次；旧请求晚返回。 加测composer自身不禁用Send、网络/事务阻止重复发送、其他未记录编辑仍保护；旧MSG与新MSG同目标冲突、两种员工选择、决定保存失败/分析失败/刷新恢复且旧操作最终可完成。
- **命令**。C01、C02、N01。补问上限测试在独立测试入口用明确合成技术变体，不冒充新增批准案例。
- **界面检查**。U02–U05、U13、U14。
- **完成条件**。输入→来源→提案→映射→问题/事实→缺口→保存→双区反馈完整，不能只生成聊天气泡。
- **失败定位**。source kind/A07、interaction.questionIds、partial message updates 防重、pending 问题判定、请求 token、save candidate。

### R07 可读事实与首次核对面板

- **目标与输出**。InformationPane 支持分组事实、来源、分类、更正和首次核对。
- **前置**。R03、R05；完整交互验收等待 R06。
- **允许文件**。`app/src/workbench/InformationPane.tsx`（新）、`workbench.css` 的信息区部分、`tests/workbench-browser.ts` 的事实部分。主 agent 负责装配 `CaseWorkbench.tsx`。
- **先读**。旧 IntakeModule 中 `amountGroups`、`correctionValue`、`keepCandidate`、新字段映射、pure correction API。
- **顺序动作**。① 分组只显示已有/相关目标。② 每个 record 独立卡，当前值、status、review、来源和活动冲突可读。③ 更正使用类型控件和理由，保留当前值/采用候选都走 correction。④ 金额按币种和状态分组，未知单列。⑤ first 区显示完整核对范围，传统一 actor，明确保存后成功。⑥ 不确定性保留，旧分析 pending/failed 标记。
- **保留行为**。false 不显示 Unknown，未知金额不为 0，多币种不相加，员工核对不等于外部核实，正常当前补问不逐轮 first。
- **测试**。金额200/2000冲突、保留当前值、两个交易、unknown/false、英文 labels、更正输入切区保护、普通消息不产生 review。
- **命令**。C01、C02、N01。
- **界面检查**。U02、U06，候选InformationPane和问题目标使用R03映射，显示Transaction status · TX-01，展开能见E09和来源；不需要滚过全部字段才能看到聊天或核对动作。旧模块预览不要求同步换标签。
- **完成条件**。可读核对能够直接改变同一 record，来源/历史无丢失，117 字段未全量铺开。
- **失败定位**。target key、输入类型转换、候选处理、事实版本、first reviewer 参数。

### R08 指引决定与员工标识复用

- **目标与输出**。MaterialsPane 的建议区复用确定性匹配和同案决定。
- **前置**。R05、R07。共享 `shared/outputs.ts` 的改造需由主 agent 排队。
- **允许文件**。`app/src/workbench/MaterialsPane.tsx`（新，建议区）、`workbench.css` 的建议区部分、`app/src/modules/guidance/index.tsx`、`app/src/modules/outputs/index.tsx` 的 actor fallback 适配、`shared/guidance.ts` 必要小修、`tests/guidance.test.ts`、`tests/workbench-browser.ts` 的建议部分。
- **先读**。`evaluateGuidance`、`recalculateGuidance`、`activeRecommendations`、`decideRecommendation`、`guidanceHandoff`、原 DecisionCard。
- **顺序动作**。① 展示有效指引/不匹配原因/权限边界。② 顶栏 actor 传入事件，不让 D/E 反复输入。③ 每条 Accept/Modify/Reject 调现有函数、保存理由。④ 显示依赖正文待更新，不能取新匹配提案覆盖决定。⑤ 无指引显示固定提示。⑥ 独立入口没有 employeeActor 时保留本地标识输入。
- **保留行为**。拒绝重算后仍拒绝，员工文字保留，未批准配置无法支持建议，只有批准岗位、不虚构其他角色。
- **测试**。拒绝 REC-03 传播、银行无关审核保持、actor 刷新复用但历史不被新 actor 改写、独立预览 fallback、无指引。
- **命令**。C01、C02、C06 中 guidance、N01。
- **界面检查**。U07、U08，统一 actor 一次填写覆盖决定与后续编辑审核。
- **完成条件**。新建议区真实控制同案建议，权限来源可查，独立 D/E 仍可操作。
- **失败定位**。guidance revision、rec dependencies、recommendationEdited、actor prop fallback、referenceSource 的 T09 限制。

### R09 最终范围审核与统一输出门槛

- **目标与输出**。实现 `finalReviewSelection` 和 ReviewExportPane，不重复逐对象勾选。
- **前置**。R02、R03、R05、R08。
- **允许文件**。`shared/runtime.ts`的可选输出bodyFormatVersion/recipientSelection和快照recipient、`shared/outputs.ts`、`shared/export.ts`、两个runtime schema生成件、`server/src/output-service.ts`必要gate同步、`server/src/app.ts`仅POST /api/runtime/export响应头及helper import、`app/src/workbench/ReviewExportPane.tsx`（新）、`app/src/modules/outputs/index.tsx`必要兼容适配、`tests/outputs.test.ts`、`tests/server.test.ts`的runtime导出响应测试、`tests/workbench-browser.ts`的审核/输出部分。
- **先读**。`readyForReview`、`finalReview`、`outputCurrent`、`outputSnapshot`、`runtimeSnapshot`、E `deliver`、output serializers及server/src/app.ts的runtime导出Content-Disposition构造。
- **顺序动作**。① 7.2.1正文分离reviewStatus、格式迁移gate。② 最新正文可见后收集范围/expectedCaseVersion/ack。③ clone改核对标志，断言正文/依赖/版本不变再审核，禁止内部重生成。④ direct first门槛及deriveAnalysisUpdate全案阻塞重验，不能只信缓存。⑤ 单一snapshot和晚响应保护。⑥ 无指引仅SUMMARY，可读清单。⑦ 接收方及稳定ID命名；按7.3.1新增HTTP头helper，替换runtime响应的百分号清洗，旧/api/export保留。⑧ C09检查生成件。
- **保留行为**。逐对象依赖和版本历史、不模拟审核升级、不执行外部动作、复制和文件同正文、输出错误保留 review。
- **测试**。多选原子审核及正文不变、格式迁移保护；direct first门槛、单稿失效、无指引、晚下载/复制；保存的current含旧消息blocker仍阻断；两份同接收方同版本稿名称不同；中文/下划线/字面% caseId的MD/PDF经真实HTTP filename*解码一次严格等于共享名，body字节不变，实际download.suggestedFilename一致。 加测needs-decision及决定后分析未完成时，生成/审核/导出仍阻断，最新值保留不会被旧分类或正文覆盖。
- **命令**。C01、C02、C06 中 outputs、N01。
- **界面检查**。U07、U10、U11。
- **完成条件**。所选有效对象可输出，失效对象真实阻断，最终审核无需逐个重复确认。
- **失败定位**。事实核对标志与版本、expectedCaseVersion、闭包拓扑顺序、runtimeReviewValid、outputCurrent、saved 标志。

### R10 文稿编辑保护与完整候选工作流

- **目标与输出**。把编辑／比较／重生成接入 MaterialsPane，与 R09 的输出形成完整候选流程。
- **前置**。R06–R09。
- **允许文件**。`app/src/workbench/MaterialsPane.tsx` 的文稿区、`CaseWorkbench.tsx`、`useWorkbenchCase.ts`、`workbench.css`、`tests/workbench-browser.ts`；必要回归补充 `tests/outputs.test.ts`。
- **先读**。原 `OutputEditor`、`regenerateOutputs`、`editOutput`、E pending comparison、onWorkingEditChange 和 deliver 的晚返回保护。
- **顺序动作**。① 单文件选择与 working body/reason。② Record/Discard 明确区分，不通过 blur 自动录入。③ protectedIds 比较保留／替换和 expected version。④ 五阶段焦点接通，所有业务仍同屏两区。⑤ 事实/建议变更依赖刷新提示接通，旧文稿保留检查。⑥ 可选接收方变更只来自配置并记录历史。⑦ 全流程演示录入和输出脚本完成。
- **保留行为**。人工正文不静默覆盖，无关稿审核保留，单稿改动不改 facts，切区不丢未记录文本。
- **测试**。U09 全部分支、共享事实250、拒绝传播、未记录文本期间公共保存/切案/导出阻断、过期 comparison 拒绝替换。
- **命令**。C01、C02、N01。
- **界面检查**。U02、U08–U12，候选入口完成 T09 和无指引摘要。
- **完成条件**。两个候选主线可演示，业务按钮均接真实事件，原始长页面没有被换皮塞进两栏。
- **失败定位**。editor key 重挂载、dirty Set、protectedIds、current version、output history、onChange 传播。

### R11 切换主入口、独立测试路由与兼容回归

- **目标与输出**。确认候选完成后切根页，保留旧宿主与独立测试路径。
- **前置**。R10 的候选技术检查通过，完成 U01–U10 的界面预检。
- **允许文件**。`app/src/main.tsx`、`app/src/module-preview.tsx` 的导航、`tests/prototype-browser.ts`、`tests/integration-browser.ts`、`tests/browser-check.ts`、`tests/module-browser.ts` 的必要路由适配、`tests/workbench-browser.ts`、`docs/architecture/MODULE_CONTRACTS.md`、`PROTOTYPE_RUNBOOK.md`、`tests/README.md`。
- **先读**。main 三分支、旧 tests 中 page.goto/导航断言与原 state selectors。
- **顺序动作**。① 确定路由表，第 9 节优先级。② 根页新工作台，旧集成移 `?view=integration`，原四独立模块/foundation 保留。③ 原宿主脚本改为明确旧集成 URL，原断言保留。④ 新脚本真正访问 `/`，不能继续跑旧宿主冒充新入口。⑤ 更新运行说明、兼容和限定 Mock 文案。⑥ 仅移除确已不用的主入口 import/装配，保留独立模块文件。
- **保留行为**。原 integration session、旧来源/历史、module glob、固定诊断故障入口，主页面不挂第二个模型模块。
- **测试**。所有路由、旧案恢复、独立四模块、根页无fixed diagnostic控件；Send/澄清/Retry/Continue/Reanalyze均由唯一控制器发同一分析端口，主页面不挂独立C提案模块。
- **命令**。C01、C02、C05、C06、C07、C08、N01。
- **界面检查**。默认浏览器逐个打开路由，根页完成 U01/U02/U07；测试入口和产品入口可清楚区分。
- **完成条件**。新入口通过而旧回归未被丢弃，说明与真实 URL 一致。
- **失败定位**。query 分支优先级、旧测试默认 `/`、ModulePreview 导航、构建静态目录、history session。

### R12 独立界面验收与最终交接

- **目标与输出**。执行第 11 节实际验收，保留失败与复测，报告真实交付层级。
- **前置**。R11。
- **允许文件**。本计划的执行结果附录、`evidence/workbench-refactor/<新批次>/` 新证据。若修复代码，回到对应 R 的允许文件并重新运行受影响回归，不直接扩展范围。
- **先读**。本文第 11 节、既有 F01 报告、当前运行说明、新脚本实际断言。
- **顺序动作**。① 记录版本、工作区、浏览器及模式。② 运行真实命令并记录 actual/skipped。③ 默认浏览器 computer-use 从空案执行 U01–U14。④ 实际粘贴、打开下载 MD/PDF、逐页看中文/表格/分页/完整性。⑤ 记录首次失败，修复后新批次复测。⑥ 用第 14 节模板交接。
- **保留行为**。旧 evidence/stash 不动，自动检查不替代 UI，agent 测试不写成人类产品接收，Mock 不替代真实模型效果。
- **测试**。所有课程必须项逐条实际记录，扩展项保持未执行而非填通过。
- **命令**。C01–C08、N01，C03 只做文档保全；C09 无 schema 改动时无需重跑。
- **界面检查**。完整 U01–U14，重点复测 F01-001。
- **完成条件**。必须项无未解释失败；有阻塞明确列出，不提前宣称全部 PRD 通过。用户接收作为独立结论。
- **失败定位**。按用例回到对应 R；环境工具故障与产品失败分别记录，下载成功不能代替 PDF 内容正确。

## 9. 路由、独立测试入口与分阶段落点

### 9.1 最终路由表

`main.tsx` 按以下优先级匹配，防止 `view` 与 `module` 同时存在时装配两个宿主。

| 优先级 | URL | 用途 |
| --- | --- | --- |
| 1 | `/?module=intake|model|guidance|outputs` | 原独立模块，原固定输入及故障控件保留 |
| 2 | `/?view=foundation` | 原 v1 Workbench |
| 3 | `/?view=integration` | 原 integrated ModulePreview，显式旧集成检查 |
| 4 | `/?view=workbench` | 新工作台候选链接，切根入口后继续等价可用 |
| 5 | `/` 及无有效已知参数 | 新 CaseWorkbench |

R05 到 R10 期间根页仍用旧集成，第 4 项候选可打开。R11 才切换默认。Test workspace 链接把员工带到独立测试入口列表，未保存／未记录输入先由宿主 guard 处理。不要用看不见的 query 参数偷偷切真实 API 或模拟审核身份。

### 9.2 分阶段与回退

| 阶段 | 任务 | 可运行落点 | 失败保留与回退 |
| --- | --- | --- | --- |
| A 兼容核心 | R01–R04 | 原根页/独立模块正常，新增纯函数和模型 interaction 已测试 | 不切入口；保留已完成兼容代码，修具体失败；旧数据不清空 |
| B 候选壳与聊天 | R05/R06 | `?view=workbench` 可建空案、保存、分析、答多题；原根页仍可用 | 继续使用旧根页，新 UI 显示具体未完成能力；不回滚工作区其他修改 |
| C 完整候选 | R07–R10 | 候选双区从空案至当前文件输出，完成 U01–U10 预检 | 旧根页保留；保留新增文件，按 R 修复；员工稿与来源不覆盖 |
| D 切换与回归 | R11 | 根页新工作台、旧宿主明确测试 URL | 如果根路由失败，只把默认路由指回旧集成，继续运行新兼容 schema；保存数据仍可读 |
| E 验收 | R12 | 自动、实际界面、PDF 结果分别有记录 | 失败留首批证据，新批次复测；存在必须项失败则报告未完成 |

实施期间使用 `git diff -- <允许文件>` 和工作区状态检查保留其他工作。用户未授权时不自动提交作为检查点；可用当前 diff 和原案件 JSON 备份作为恢复依据。禁止 `git reset --hard`、整体 checkout 或 stash pop 来回退阶段。旧代码整理只限主入口已失效装配及无用 import，独立入口、业务函数、v1 存储仍留作兼容验证。

## 10. 集成与分工

### 10.1 单 agent 路径

按 R01 → R02 → R03 → R04 → R05 → R06 → R07 → R08 → R09 → R10 → R11 → R12 执行。每张卡先完成 pure/service 断言，再接 UI，最后实际交互。不要完成全部 UI 后才检查兼容和来源。

### 10.2 主 agent＋最多三个子 agent 路径

本文提供后续可选的并行实施安排。本轮没有启动实施子 agent。采用并行时必须先完成共享契约与控制器，不允许边猜接口边同时改共享文件。

1. 主 agent 完成 R01–R06，R03 的名称部分、R08 的共享 actor 适配、R09 的 `finalReviewSelection`／服务 gate 先由主 agent完成并验证。冻结 `types.ts`、真实回调、状态规则和共享函数。这一交接点仍不等于 R08/R09 全部 UI 完成。
2. 子 agent A 实施 R07 的 `InformationPane.tsx`，只写这一文件。
3. 子 agent B 实施 R08 的 `MaterialsPane.tsx` 建议部分，再实施 R10 中该文件的编辑／比较部分，只写这一文件。R10 的主控制器装配等待其他面板就绪。
4. 子 agent C 实施 R09 的 `ReviewExportPane.tsx`，只写这一文件。
5. 主 agent 独占 `CaseWorkbench.tsx`、`useWorkbenchCase.ts`、`types.ts`、`ConversationPane.tsx`、`workbench.css`、main/module-preview、全部 shared/server、全部测试和运行说明。子 agent 需要新回调或 CSS 时先发具体请求及建议 diff，由主 agent写入；不能自行扩展共享契约。
6. 子 agent 独立文件完成后，主 agent 逐个接入、补自动断言、集中调整样式。所有面板接入后再完成 R10，其后 R11、R12 顺序执行。主 agent 跑完整检查时停止其他写入，防止同一批次测试代码变化。

三位子 agent 可以同时写各自单文件，不能同时写 shared/outputs、types、CSS 或 tests/workbench-browser。若某面板发现真实共享缺陷，先交接，不在它的目录内另造一套事实或审核实现。主 agent 可暂停相关面板，完成共享修复并重发接口版本。

### 10.3 每次交接必须报告

- 实际基线 SHA、收到的接口版本或类型内容，以及实际修改文件。
- 使用的现有函数、调用参数、尚缺的回调，不能只写“逻辑已复用”。
- 完成的输入→状态→界面行为，注明临时输入和持久化由谁负责。
- 实际运行命令、结果、跳过项，依赖其他面板的 UI 检查保持待集成。
- 未实现分支、遇到的冲突和需要主 agent 修改的具体位置。
- 没有写入共享文件的核对，交接后不继续变更直到新任务。

## 11. 测试命令与演示验收

### 11.1 当前仓库真实命令

以下命令是后续实施可运行入口，不表示本轮已经运行。Node 范围来自 package.json，为 >=24 <25。Windows 用 npm.cmd；本机已有依赖，任务不需要改 package.json 或下载新框架。

```powershell
Set-Location 'D:\BaiduSyncdisk\UNSW\INFS5706\GroupAssignment-integration'

# C01，类型与现有 tests/*.test.ts
npm.cmd run check

# C02，类型检查与 Vite 构建
npm.cmd run build

# C03，文档链接、字段与来源保全；只输出 stdout
python scripts/maintenance/check_repository.py

# C04，本地开发，另一个终端保持运行
npm.cmd run dev

# C08，批准业务包、哈希及引用
npm.cmd run check:business

# C09，实施 R01 的 schema 生成步骤，会写生成件
npm.cmd run schemas
```

C01 默认包含条件跳过的模块浏览器检查。没有设置 B01/C01/D01/E01 开关时不能把 C01 写成“四模块真实浏览器全通过”。C02 生成 dist，浏览器脚本使用当前 dist，所以先构建再跑。

C05 是现有四模块完整条件检查，使用新的证据目录。以下脚本暂设环境变量，结束后恢复之前值。路径来自各模块测试的真实约束。

```powershell
$batch = 'workbench-' + [guid]::NewGuid().ToString('N')
$checkEnvironment = @{
  B01_BROWSER = '1'; C01_BROWSER = '1'; D01_BROWSER = '1'; E01_BROWSER = '1'
  B01_EVIDENCE_DIR = "evidence/task-results/B01/$batch/browser"
  C01_EVIDENCE_DIR = "evidence/task-results/C01/$batch/browser"
  D01_EVIDENCE_DIR = "evidence/task-results/D01/$batch/browser"
  E01_EVIDENCE_DIR = "evidence/task-results/E01/$batch/browser"
}
$previousCheckEnvironment = @{}
foreach ($name in $checkEnvironment.Keys) {
  $previousCheckEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  [Environment]::SetEnvironmentVariable($name, $checkEnvironment[$name], 'Process')
}
try {
  npm.cmd run check
  if ($LASTEXITCODE -ne 0) { throw 'Conditional module checks failed. Preserve this batch.' }
} finally {
  foreach ($name in $previousCheckEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previousCheckEnvironment[$name], 'Process')
  }
}
```

C06 是公共模块测试控制台回归。每次执行设置新 batch，再依次运行。它们只检查公共 Mock 控件，不能替代真实模块的业务断言。

```powershell
$batch = 'workbench-' + [guid]::NewGuid().ToString('N')
npm.cmd run check:module -- intake "evidence/workbench-refactor/$batch/public-intake"
npm.cmd run check:module -- model "evidence/workbench-refactor/$batch/public-model"
npm.cmd run check:module -- guidance "evidence/workbench-refactor/$batch/public-guidance"
npm.cmd run check:module -- outputs "evidence/workbench-refactor/$batch/public-outputs"
```

C07 是已有浏览器脚本，均自行起临时本地服务并使用 Playwright Chromium，无需复用人工浏览器案件。各条失败后先保留结果并定位，再换新批次复测。

```powershell
$batch = 'workbench-' + [guid]::NewGuid().ToString('N')
& .\node_modules\.bin\tsx.cmd tests/integration-browser.ts "evidence/workbench-refactor/$batch/old-host"
& .\node_modules\.bin\tsx.cmd tests/prototype-browser.ts "evidence/workbench-refactor/$batch/old-prototype"
npm.cmd run check:browser -- "evidence/workbench-refactor/$batch/foundation"
```

R11 切入口后前两条脚本必须已指向 `?view=integration`，继续检查原宿主。`check:browser` 保留原底座行为。禁止只更新所有脚本去旧宿主后遗漏新入口。

N01 是**计划新增命令**，R05 建立 `tests/workbench-browser.ts` 后才存在，R06–R10 逐步补全，R11 后默认访问 `/`。使用现有 tsx，不新增 npm script。

```powershell
$batch = 'workbench-' + [guid]::NewGuid().ToString('N')
& .\node_modules\.bin\tsx.cmd tests/workbench-browser.ts "evidence/workbench-refactor/$batch/new-workbench"
```

新脚本参考 prototype-browser 的临时服务、证据目录边界、拒绝覆盖 result.json、providerRequests 计数及 finally 写结果。它必须覆盖真实新组件和服务，无付费 provider 调用，fake provider 检查另写明。截图、剪贴板实际读取、下载文件、测试结果保存在该新批次下。不得通过直接写 IndexedDB 替代“从空案发送初始描述”的主线步骤。

### 11.2 必须完成的课程技术回归

| 项目 | 断言 |
| --- | --- |
| Schema/存储 | 旧 v2 及新可选字段、坏引用拒绝、刷新和导入、session 恢复、消息无密钥 |
| 模型 | 新旧合同、单消息多题、typed value/quote/目标一致、部分/歧义、额外事实、严格额外字段、timeout/invalid/旧请求 |
| 合并 | 人工200保护、候选2000、后补新源、事务幂等、无整段文本复制给所有题 |
| 问题 | 部分留轮、unknown 防重、停止不重开、后补同Q ID、同字段不同记录、0题不计、3/9边界、保存失败不计 |
| 指引 | 配置与来源匹配、权限不从叙述推断、无指引只有摘要、拒绝/修改保留 |
| 审核 | 两阶段、batch final 闭包、正常补问不重复 first、直接更正需确认、逐对象失效范围 |
| 输出 | 单对象可独立选择、编辑历史与重生成保护、未保存/过期不能导出、同快照 MD/HTML/PDF、晚文件丢弃 |
| UI与故障 | 双区同案、全 dirty 保护、失败输入保留、实际复制下载、页面异常记录 |

### 11.3 默认浏览器 computer-use 用例

使用系统当前默认浏览器。启动前核实实际默认值，不能根据旧 F01 假定仍是豆包。用户要求避免 Microsoft Edge。通过默认浏览器打开本地 URL；如果默认值已变为 Edge，记录并请用户指定可用替代浏览器，不自行改系统默认。自动 Playwright Chromium 与人工可见默认浏览器是两类结果。

实施时先读取当时可用 computer-use 技能并按其要求操作。以下是必须执行的实际 UI 步骤和观察条件；本轮只设计，没有执行。

| ID | 初始条件、实际动作 | 应观察与保留证据 |
| --- | --- | --- |
| U01 空案与双区 | 进入根页，无历史用空态；有历史按 New case 的保存/放弃/取消规则；选择 SYN Bank A / Intake Officer，Start case | 没有预载 T09 事实、分类、问答或审核；左右两区同屏；新案号 SYN；确认角色来自配置 |
| U02 T09 从输入开始 | Use T09 example 填入完整 input，实际 Send；等待提案；左区核对2000，将 E04/TX-01 更正200，理由写合成来电更正；明确 first；显示并保存问题 | 发送前空案，后有 S1–S5 及原消息；金额200、旧值2000留历史，first actor=当前标识；轮次只在保存后1/3题；两个区域值同步 |
| U03 一条回答多问 | 新T09变体，发送第6.2节三句完整示例 | Q1 answered/E09 pending、Q2 answered/C08 false、Q3 unknown/E08 null；各答案不同证据片段；1轮3问；聊天和事实同步 |
| U04 部分、澄清与结束 | 另一T09只发pending；发 `It has stopped.`，选择C08及No并确认，另案选择G05及No；受控触发澄清保存/模型/响应保存失败并分别Retry；再Q2 Unknown、End follow-up | 部分不进下一轮；明确目标和值进入完整分析；已答Q1及来源历史不重写，无原问题G05也可更新；只有新完整分析适用且歧义已处理才current；各失败按6.3.1恢复，计数不变 |
| U05 F01-001与后补 | 在T09按旧最短复现 Q1=`reported pending`，生成材料查看缺口；结束后用原 Q3 输入收款对象并更新、确认变更 | E09 不再是当前未解决缺口，页面和摘要一致；Q3 ID及计数不变、stopped=true；后补有新来源与旧问历史；输出重审，MD/PDF相同口径 |
| U06 更正保护与多记录 | 更正金额200后点信息区Reanalyze current case；检查来源和消息数量；独立测试入口释放延迟提案前改250；查看两交易/币种变体 | 重读原文但不新增MSG/来源/问题，200保留且2000为候选；重复相同结果不新增审核要求；迟到响应丢弃；TX独立、false不等未知，币种/状态分组 |
| U07 无指引摘要 | 独立受控 Suspend guidance 后回当前案更新，或采用明确无匹配案例；生成，单独选SUMMARY并最终审核、保存、导出；选择历史接收方稿尝试输出 | 固定英文不足提示、仅事实摘要，无具体行动/路径；不要求不存在建议；旧稿导出真实阻断，摘要可独立MD/PDF |
| U08 决定与拒绝传播 | 有效指引案接受所需建议、生成并审核各稿；Reject REC-03填写理由，重算、更新并保存、刷新 | 拒绝未撤销；电信/引用摘要移除该待执行动作并重审；无关银行有效审核保持；统一actor历史保留 |
| U09 员工编辑与重生成 | 选银行稿输入编辑但先不Record，尝试Save/切文件/切案/导航；Record edit给理由；变更相关事实后 Generate，分别试 Keep/Cancel/明确Replace | 工作文本被保护；无自动覆盖；旧稿留history；keep的陈旧稿仍阻断；明确替换需理由与当前比较版本；只改银行稿不使无关电信稿失效 |
| U10 当前最终审核 | 正常补问后保留新事实unreviewed，更新并展示SUMMARY/银行稿正文，记录内容和文稿版本；一次确认Review selected并Save；比较实际导出；再改事实250 | 最新事实checked，正文/文稿版本与确认前一致，仅审核元数据更新；无新first；旧格式文稿先要求更新且保护员工稿；直接更正仍需原核对确认，旧审核失效 |
| U11 复制和实际文件 | 分别选各稿Copy并实际粘贴，下载MD/PDF并通过下载列表打开；受控把两个稳定稿设同一配置接收方及同版本，明确更新审核后分别下载；中文/长表变体重复 | 审核前可见正文与粘贴/MD/HTML/PDF正文一致；两份同接收方同版本的文件名仍含不同稳定稿ID，客户端服务端相同；逐页检查中文、表格、分页和完整性 |
| U12 保存刷新与隔离 | 保存有问答/决定/员工稿/审核的案件，Ctrl+R；新建/切案分别Save and continue、Discard、Cancel；下载备份，坏JSON导入及同号取消 | 只恢复实际保存内容，旧v2可打开；actor会话复用、记录原actor不改；不同案不串；取消不变，坏文件/同号取消不覆盖 |
| U13 保存与输出失败 | 测试入口开启下一次保存失败，提交新轮/回答/切案，再关闭重试；对有效文件模拟PDF失败并重试；下载等待时开始working edit | 保存失败不计新轮、不切案、不清输入；恢复只计一次；导出失败保留review正文，重试同版本；晚PDF不能下载为当前有效稿 |
| U14 模型失败与配置版本 | 使用受控timeout/invalid/fake-provider延迟；请求期间更正事实或保存API设置；检查发送前后状态；不使用实际密钥做自动测试 | 保留原输入、旧结果标历史，错误可重试；旧结果不覆盖；保存设置零provider调用，下一次主动分析才使用新设置；模拟和fake结果明确 |

U06 的多记录、U11 的中文长表、U13/U14 故障均是受控技术变体，放独立测试入口并在报告写明构造方式。它们不能冒充新增批准的完整业务案例。若当前批准包没有足够交易明细，使用测试中固定结构和预先计算期望值，不能临时输入任意内容再让 Mock 声称理解。

U04必须增加跨消息子场景。保存一条“It has stopped.”待澄清消息，再发送明确Q3收款对象；第二条成功保存后，检查第一条仍needs-clarification、全案仍pending，左侧收款对象更新但生成材料/最终审核/输出阻断，刷新后相同。再处理第一条，完整分析包含新收款对象后才current。另以旧MSG failed重复同场景，顶层汇总按4.2.1显示failed及全部blockers。不能通过关闭旧消息卡片清除阻塞。

U04/U06还须用受控已知G05=false/checked、E09='reported pending'/checked状态，选择无原Q的Unknown澄清，观察聊天新增未知来源、已有事实及fact.version保持。若有原Q，仅Q/history变化；显式Correct fact改Unknown再检查其变null及历史。模型夹带null的负向响应由fake-provider测试断言原子拒绝，不能在UI先覆盖后再恢复掩盖失败。

U11额外用合成caseId `SYN_案件%01` 实际下载MD/PDF，并与共享filename和真实runtime响应filename*一次解码值比对。HTTP头断言记录在自动测试证据，default browser的实际文件名记录在computer-use证据；相同bytes和正确名称分别判断，文件下载成功不代表两者都正确。

U01/U13必须补充Send自身草稿用例。角色已选后输入首条T09描述，确认composer为dirty时Send仍可用；单击后源消息保存和请求确实启动，双击不多出MSG/source/请求。源保存故障时原文和原ID保留，Retry recording message成功后才调用模型。另在已打开文稿中输入未Record正文，再在composer输入补充，确认Send禁用并显示Go to edit，Record或Discard正文后Send恢复，聊天草稿全程保留。源保存期间操作持有锁仍可完成内部事务，不能因自己busy而停止。公共Save case对未发送草稿继续显示保护提示。

U04必须补充同目标时序用例。MSG-1明确pending，注入一次分析失败并保存；MSG-2明确completed并成功保存；Retry MSG-1。核对completed和原Q当前回答保持，旧pending仅为带来源的比较候选、MSG-1 needs-decision且计数不变。分别在独立变体选择Keep current value和Use earlier answer，核对原值/历史/员工决定，并完成最新事实分析，MSG-1最终applied。重复Retry和刷新不重复候选/来源/更正history；处理前与分析未完成时输出阻断。已记录的较新事实不能只在事实表保持，却被旧分析文字写回pending。

每行保留实际动作、预期、实际、证据路径、模式、是否复测。自动化结果在 `automation/` 子目录，默认浏览器结果在 `computer-use/` 子目录，PDF文本/渲染在 `pdf/` 子目录；都是同一新批次下的证据，不为每个 R 新建流程文档。默认浏览器实际观察与离线 PDF 渲染分别注明。

### 11.4 可延后的扩展与真实模型检查

- 完整 T01–T15、macOS、第二电脑、更多浏览器尺寸、复杂 Markdown/超高单表格行、跨指引版本迁移，可后续扩展，不阻塞有限课程演示，但报告保留未覆盖范围。
- 真实 API 的通用中英文提取、多问题自由表述、歧义澄清必须另行实际检查，不能用 fake provider 单测证明模型效果。需要用户在产品设置中自行配置，保存后不回填密钥。只记录 provider/model 的允许公开信息与实际结果，不输出密钥。
- 如果后续交付只完成限定 Mock 演示，交付名称应注明 Limited Mock prototype。不得声称任意自然语言、所有机构岗位或全PRD验收完成。真实模型自由叙述效果是单独未验证项。

## 12. 重要状态变化示例

下表的普通消息示例默认是当前新输入；旧MSG的Retry须先执行6.3.2时序检查，不能直接套用普通回答覆盖规则。所有例子的案件级current仍由4.2.1全量汇总。

| 输入／动作 | 处理 | 状态变化 | 双区反馈 |
| --- | --- | --- | --- |
| 初始 T09 Send | 源保存→Mock提案→严格验证→合并→保存 | A07/来源及B–J事实建立，尚无 first 或计数 | 左区待核对，聊天说明已记录但未外部证实 |
| Q1 pending + Q2 no | 原MSG不同quote→原Q ID→typed值→完整分析 | E09='reported pending'、C08=false，Q3仍pending，轮次不变 | 两处高亮，Next step提示回答Q3或未知/结束 |
| Q1新值与员工更正冲突 | 当前 corrected 优先，新quote为候选 | question可answered，fact仍conflict且原值保留 | 明确 Answer recorded; fact conflict requires review |
| 保存新轮失败 | 候选轮不对外提交，保留提案 | 正式rounds/totalQuestions不增 | Unsaved question proposal; retry，不能显示已问 |
| 停止后补Q3 | 沿用Q3、新source、旧history，direct origin | stopped=true、计数不变、needsFactConfirmation=true | 原核对区确认变化，材料需更新与重审 |
| 拒绝REC-03 | decide→recalculate保留拒绝→refresh依赖稿 | rec版本变，引用稿失效，无关银行审核保持 | 电信稿显示Needs update，拒绝理由可读 |
| Record bank edit | editOutput，保留旧body/reason/actor | 仅银行output.version变，Employee edited | 银行需final，其他无依赖变化的稿件状态保持 |
| Review selected + Save失败 | clone上review完成但存储失败 | 内存审核记录保留且saved=false | 显示Review recorded — unsaved，复制下载仍阻断，Retry save |
| 旧模型结果返回 | ticketCurrent失败 | 当前更正/角色/问题/审核不变 | Outdated response ignored，保持当前请求状态 |

## 13. 需要用户决定的实质产品内容

以下是现有范围之外的可选内容扩展，集中保留供用户以后决定。当前实施按表中的既定默认范围推进，接口冻结及R01—R12无需等待这些扩展决定。当前建议均不修改PRD。

| 编号 | 待决定内容 | 建议及实施影响 |
| --- | --- | --- |
| D01 | 是否为演示再批准第二个机构／岗位 | 先用当前唯一 SYN Bank A / Intake Officer，选择器仍由配置生成。需要展示真实岗位切换差异时，再提供批准角色内容；技术权限失效变体可先测 |
| D02 | 是否把三条教学指引推广至 T09 原文以外的自由案例 | 先保持 exact teaching context，其他案例无匹配时走事实摘要。若要普遍适用，需要批准结构化职责／适用条件和对应案例，不能由工程把 S1/S3 内容条件删掉来扩大指引 |
| D03 | 是否本次提供简单风险关注提示的批准文案和触发项 | 当前 riskNoticeRules 为空，先不生成提醒。若提供批准条目，再补明确条件、来源、指引及未核对标记；不计算风险分数 |

新增认证平台、真实发送、部署、多人协作不属于本次任务。命名、组件划分、双列比例、单次范围审核、会话员工标识和可选字段已由本文作出技术决定，不需再次停工询问。

## 14. 可复制启动指令与交付模板

### 14.1 主 agent 实施提示词

```text
在 D:\BaiduSyncdisk\UNSW\INFS5706\GroupAssignment-integration 实施
docs/project/SCAMSAFE_WORKBENCH_REFACTOR_PLAN.md。

先读 AGENTS.md、STATUS.md、当前 PRD 第2–6节及该计划。核对分支、HEAD、工作区。
计划调查基线为 integration/test-fixes@5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d。
如果当前已变更，检查差异并保留他人工作，不强行还原基线。
不整体恢复 before-user-requested-rollback-20261106 stash。
F01报告可通过该计划给出的stash第三父提交路径只读查看。

按R01–R12执行，先兼容契约和纯函数，再候选工作台，再切根入口。
复用现有业务逻辑，新增函数按计划实现后才能调用，不把计划接口当现有能力。
案件只有一份RuntimeCaseRecord，聊天问题读取原followUp，输入到多问映射必须真实生效。
禁止整段文本复制给每个问题、禁止关键词规则伪装任意语言理解。
Mock仅支持明确列出的示例，真实模型结果和fake/provider模拟分别记录。
保持旧v2数据/来源/问题ID/计数/员工稿/审核兼容，保留更正和拒绝历史。
只使用两个审核阶段，最终范围审核仍逐对象保存记录。
不改PRD或批准业务包，不增加框架，不引入生产认证/部署/真实发送。
未经本轮明确授权不提交、推送、合并或部署。

单agent按计划顺序完成。若本轮明确采用并行路径，最多三个子agent，
先完成公共接口及控制器冻结，只分派计划第10节的独占面板文件。
共享文件和全部测试由主agent唯一写入，集成前停其他写入。

每任务完成后运行其真实验证命令，保留首次失败及新批次复测。
新脚本N01只有文件建立后才能执行。C01默认跳过的浏览器项要如实记。
默认浏览器computer-use与Playwright分别记录，避免Microsoft Edge。
实际粘贴复制内容、实际下载并打开PDF检查中文/表格/分页/完整性。
以第14.4节模板报告，不把agent结果写成人类接收。
```

### 14.2 子 agent 提示词模板

```text
你负责统一工作台的一个独占面板，任务为 <R编号及面板职责>。
当前公共接口冻结于 <主agent提供的实际SHA或接口diff摘要>。
先读 AGENTS.md、计划第3–7节、对应任务卡和主agent给出的types.ts。

唯一允许写入文件为 <InformationPane.tsx / MaterialsPane.tsx / ReviewExportPane.tsx>。
读取和调用现有共享函数及宿主actions。不得另建案件状态、来源、计数或审核系统。
不得写shared、server、main、useWorkbenchCase、types、公共CSS、tests或PRD。
需要新回调、CSS、测试断言时，报告具体参数/状态/建议diff，由主agent统一实现。
界面英文，保留原文引用，多问题状态来自record.followUp，不用气泡伪装业务结果。
保留临时编辑并通过reportDraft报告，不因卸载或切对象清空未记录输入。

执行对应任务列出的只读检查及可运行验证，避免覆盖任何已有证据。
交接报告包含实际文件、复用函数/参数、完成分支、测试命令/结果/未验证项、
依赖主agent的具体请求。完成后停止写入等待集成，不提交或推送。
```

### 14.3 集成检查清单

- [ ] 当前 Git 状态与允许文件一致，未恢复 stash，未改 PRD/依赖/批准包/旧证据。
- [ ] 所有计划新增文件已经真实存在，导出及 TypeScript 类型可编译。
- [ ] main 根路由访问新工作台，旧集成测试有明确 URL，四独立模块和 foundation 保留。
- [ ] 一个record、一个分析编排控制器和服务端口、一个保存协调器；Send/澄清/Reanalyze等按用途调用，页面没有隐藏模块执行事件。
- [ ] 新案选择角色后自由描述开始，没有种子事实/预填审核。
- [ ] 多题quote/value/Q ID/target经严格校验，部分/歧义不虚构答案。
- [ ] 问答/缺口/来源/计数/历史/审核两区同步，F01-001页面与MD/PDF已复测。
- [ ] 旧v2可恢复，新字段可选且严格校验，integration session不丢。
- [ ] 临时输入与已记录内容区分，保存失败/迟到保存/迟到模型/迟到PDF不丢新内容。
- [ ] Send消费自身composer，其他未记录编辑提供处理入口；同operation内部保存可继续，公共Save case保护及重复发送锁有效。
- [ ] 旧消息Retry保持原顺序，所有目标先检查较新更新；旧答案不自动覆盖当前值，员工选择、分析续步和刷新恢复均可完成且不永久阻塞。
- [ ] actor复用，历史actor不改，first训练默认兼容，真实确认显式。
- [ ] 批量final范围与依赖可读、逐对象记录、仅两阶段、保存后才可输出。
- [ ] 员工正文与拒绝保留，重生成需比较确认，单对象失效边界正确。
- [ ] Mock有明确范围，fake、真实API、自动化、默认浏览器、人类接收分开。
- [ ] 所有执行命令、实际结果、跳过和失败有证据，实际粘贴下载及PDF逐页检查完成。

### 14.4 最终交付报告模板

```text
# ScamSafe workbench implementation handoff

## 基线和变更
调查/实施起始SHA、最终SHA或未提交diff、分支、工作区状态
实际修改文件和完成R编号
未完成任务及具体原因

## 可运行入口
实际启动命令与URL
Mock支持输入和限制
真实API检查范围及未验证项，不含密钥

## 实际验证
逐条命令、退出结果、跳过项、证据目录
computer-use浏览器、日期、U编号、预期/实际
复制实际粘贴、MD/PDF下载和PDF逐页检查
F01-001复测结果及对应页面/文件
首次失败与后续修复复测，不覆盖旧证据

## 状态与兼容
旧保存案/备份验证范围
问题/计数/来源/更正/拒绝/员工稿/审核失效检查
默认入口切换和可用的回退入口

## 待用户决定和接收
D01/D02/D03实际决定或仍待定
剩余限制、已作技术决定、未验证内容
agent技术检查与人类产品接收分别列出
```

## 15. 本轮文档自查与验证边界

本轮已完成下列调查及文档自查，清单状态只描述本轮文档。

- [x] 核对实际分支、HEAD、干净工作区、origin URL 和指定 stash SHA。
- [x] 只读找到并阅读 stash 第三父提交内 F01 报告，确认截图和下载件路径存在；未恢复 stash。
- [x] 区分旧 Workbench v1、当前 ModulePreview v2、新工作台计划文件和独立 C 提案入口。
- [x] 核对状态持有者、真实函数、模型入口、Mock输入边界、存储和导出门槛。
- [x] 实际内存复现 F01-001，观察当前事实已更新而分析缺口及摘要仍旧；该复现不等于UI复测。
- [x] PRD逐项映射包含同屏双区、多问输入、两次审核、无指引摘要、独立文件选择、英文与双语输入。
- [x] R01–R12均列出目标、前置、允许文件、先读符号、顺序动作、保留行为、测试、命令、UI验收、完成及失败定位。
- [x] 所有新增类型、文件和 N01 明确标为计划新增；C01–C09核对当前package和脚本入口。
- [x] 兼容设计覆盖旧v2、会话缺席、source/Q ID、未知/跳过/后补、计数、保存失败、审核及人工正文。
- [x] 并行方案每个面板唯一写入者，共享契约、控制器、CSS与测试由主agent独占。
- [x] 阶段落点先候选后切入口，保留旧预览与回退路线，课程内容批准问题集中列出。

尚未执行后续实现、应用全套测试、新工作台computer-use、真实模型效果或新PDF验收。既有集成记录的89项结果及F01历史结果保持其原时间和范围，本文没有重新证明它们。新增Zod/TypeScript草案尚未编译，任务实施时必须按真实类型修正并保持本计划的行为约束。

本轮实际运行 `python scripts/maintenance/check_repository.py`，结果 passed、errors=[]，检查覆盖133份Markdown、435个本地链接、117个字段定义及来源保全。该结果仅为仓库文档和来源检查。最终另核对只新增本文，HEAD和stash对象保持调查基线。

额外只读结构检查确认 R01–R12 共12张任务卡各有11项执行字段、U01–U14共14个界面用例、R编号引用闭合、Markdown代码围栏成对。文档审读同时核对了下一轮分析的无interaction路径、部分澄清幂等、接收方编辑所需持久化及文件命名，相关计划接口尚待实施编译和运行验证。

## 16. 附录 · 五项审阅修订记录

第16—18节只记录修订经过；当前实施规则以第1—14节统一正文为准。存在不一致时先统一正文、接口和任务卡，不能从附录另选一条规则实施。

本次在同一HEAD只读复核方案与真实代码，并修订本文。五项意见均成立，其中第1项描述拟实施审核路径的风险，第4项描述拟新增命名规则的风险。当前finalReview会拒绝unreviewed事实，当前文件命名包含objectId，不能把这两项表述为已在当前产品正常入口复现的审核／命名故障。

| 审阅项 | 当前依据与修订落点 | 实施完成的新增必要断言 |
| --- | --- | --- |
| 1 核对标志使正文变化但依赖不变 | 已只读内存复现outputProposals的body变化和dependencies相同；7.2.1及R09规定生成正文移除reviewStatus、旧bodyFormatVersion迁移和固定审核顺序 | normal follow-up后批量核对不改body/文稿版本，审核可见正文与实际导出正文相同 |
| 2 澄清未接完整分析 | 原clarifyMessage只传answers，与applyResolvedMessage所需完整响应缺环；5.1/5.4/6.3.1及R01/R02/R04/R06补revision、typed确认、持久化、真实完整请求、应用及逐步重试 | 部分已应用目标不重放，明确C08/G05选择正确，网络失败不能清pending，刷新能恢复决定 |
| 3 缺独立重分析操作 | 原WorkbenchActions无对应动作；5.4/6.6及R04/R06/U06新增reanalyzeCurrentCase和purpose区分 | 不新增MSG/来源/题数、不受已应用MSG去重阻塞，人工更正和迟到保护保留 |
| 4 拟定文件名可能碰撞 | 原拟定规则仅按实际recipient及版本，当前实现实际仍用objectId；7.3/R09/U11改稳定文稿ID＋实际recipient | 两稿同接收方同版本的MD/PDF名不同，客户端服务端同函数 |
| 5 R03范围无法满足界面验收 | R03未获页面写权限，R05前无候选页；R03改为纯映射/生成正文验收，R07明确承担可读界面 | R03在其允许文件内可独立结束，R07实际观察字段名/ID/来源展开 |

本次新增验证仅为代码／文档核对和内存断言，方案中的新类型与执行链仍须后续编译、自动回归和实际界面验证。五项修订及其测试是接口冻结的必要条件，不能把文档修订完成记录为产品已修复。

## 17. 附录 · 三项实施规则修订记录

后续审阅的三项均成立。本次仍只修订本文，原整体架构与R01–R12顺序保留。

| 问题 | 已核对依据 | 本次明确的实施规则与验收归属 |
| --- | --- | --- |
| 多消息阻塞被单次成功覆盖 | 原4.2状态完成围绕当前MSG，未定义其他MSG的汇总及Send门槛 | 4.2.1/deriveAnalysisUpdate规定响应只完成自身，扫描全部消息/澄清，受控串行且旧已保存阻塞允许新Send；R01/R02/R06/R09及U04检查旧MSG仍阻断和刷新恢复 |
| 无Q Unknown清空已知值 | 已内存复现checked的C08=false经现有mergeRuntimeProposal收到null后变null | 6.3.1/6.4.1及resolution.observations把未知来源与事实更正分开，已有值不变，仅目标缺席时允许确定性未知占位；R02/R04/R06及U04/U06检查布尔、交易状态、版本和非法null原子拒绝 |
| HTTP头破坏共享文件名 | server/src/app.ts的runtime响应真实存在百分号替换；只读表达式核对得到与共享名不同的结果 | 7.3.1/shared contentDispositionForFilename及R09加入app.ts和server.test.ts允许范围；完整文件名传输编码，filename*一次解码等于共享名；U11中文/下划线/% caseId和MD/PDF实际下载验证 |

本次实际检查包括现有函数的Unknown覆盖内存断言、现有HTTP文件名替换表达式、文档结构及仓库文档检查。尚未运行新实现的编译、完整回归、浏览器下载或PDF验收。完成本文规则补清后，可按计划进入后续实施，实施结果仍以实际测试记录为准。

## 18. 附录 · Send与旧消息时序修订记录

修订日期为2026-11-07，按Australia/Sydney。本次只优化实施文档，补清两项已确认规则缺口。

| 修订 | 主体规则及接口 | 任务和验收 |
| --- | --- | --- |
| 当前Send消费自身草稿 | 4.1.1区分composer/其他dirty、draftRevision、operationId及内部保存；4.2.1的Send门槛同步修正；公共保存仍保护未发送输入 | R05/R06，U01/U13覆盖首条草稿可发、其他编辑入口、双击防重、源保存失败和内部事务不自锁 |
| Retry旧消息没有新的事实优先权 | 6.3.2及recordedFactVersions/updates.disposition使用原消息顺序；applyResolvedMessage拦截旧目标写入；resolveEarlierMessageTarget及resolveEarlierAnswer记录员工选择并完成最新分析 | R01/R02/R04/R06/R09，U04覆盖旧失败→新completed→旧Retry、Keep/Use、去重、恢复和操作最终完成 |

新增类型、helper和操作仍是计划新增。本轮文档结构检查确认12张任务卡的11项执行字段完整、14个界面用例及R引用闭合、代码围栏成对；仓库文档保全检查passed、errors=[]。Git复核仅本文处于未跟踪状态，HEAD与指定stash对象保持基线。新流程的编译、运行、computer-use和PDF验收仍属于后续实施任务。

2026-11-07一致性整理补记。第3.2节已按消息分析、独立操作、待保存事务和输出版本分别描述Retry；正文、接口注释、文件矩阵及R01统一interaction/purpose判定。并同步文件编辑Send保护、消息applied完成条件、旧答案比较时分析处理、导入needs-decision重验、普通重分析与内部续步的门槛，以及types/Mock/浏览器测试文件归属。修订附录保留历史经过，实施前如遇正文与接口／任务卡冲突，先统一相关条目再继续。

## 19. 2026-11-07 实施记录（未完成）

本次从 `integration/test-fixes` 的 `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d` 开始，初始工作区仅本文未跟踪。没有恢复 stash，没有提交、推送、合并或部署。以下是实际中间状态，不能视为 R01–R04 完成或 R05 的前置已满足。

- **R01 部分实现，尚未完成**：新增 `shared/conversation.ts` 的消息、映射、未知观察、澄清及状态 schema/type；`RuntimeCaseRecordSchema` 增加三个可选字段及部分引用检查；`AnalysisRequestSchema` 增加互斥的 interaction/purpose，响应类型增加可选 resolution，模块属性增加可选 employeeActor。新增兼容及严格结构测试。旧 v2 fixture 及备份测试通过；尚需补齐所有任务卡要求的引用、澄清恢复、请求与响应对应及边界测试。新消息版本捕获由后续控制器实现，不是已完成能力。
- `runtimeSnapshot` 加入临时保守检查：任何未完成消息、待决定更新、未完成澄清或非 current 分析缓存均阻断导出；此检查不是 R02 的 `deriveAnalysisUpdate`，也不替代 R09 的生成和审核门槛。
- 为防止旧服务将新请求当旧协议处理，提前在 R04 允许文件 `server/src/app.ts` 加了临时 503 fail-closed guard；**R04 必须以完整 interaction/purpose 实现及请求/响应验证替换它**。因此目前新协议不能实际分析，不得向 R05/R06 交付为可用接口。
- **R02、R03、R04 均未实施**：空案、问答原子变换、Unknown 保护、跨消息状态汇总、旧消息时序、F01-001、英文字段映射、限定 Mock 和真实新模型协议均未实现或验证。原入口保留，但 F01-001 仍未修复。没有执行新工作台、真实模型、人类验收及 PDF 视觉复测。
- 实际代码/测试/生成件：`shared/conversation.ts`、`shared/runtime.ts`、`shared/module-ports.ts`、`shared/export-schemas.ts`、`server/src/app.ts`、`tests/runtime-foundation.test.ts`、`data/schemas/RuntimeCaseRecord.schema.json`、`data/schemas/MessageIntent.schema.json`、`data/schemas/MessageResolution.schema.json`。本文保留未跟踪；B01/E01 自动浏览器证据为新批次。

实际验证：

1. `npm.cmd run schemas` 成功，生成后用 JSON 比较 HEAD：RuntimeCaseRecord 原有属性和其他根属性均未变化，只新增 `conversation`、`analysisUpdate`、`analysisGapHistory`，另新增 MessageIntent/MessageResolution 两个文件；没有业务包生成件变更。Zod 运行时 refine 不会完全由 JSON Schema 表达，仍须执行运行时校验。
2. `npm.cmd run build` 成功（类型检查和 Vite 构建）。
3. `npm.cmd run check` 首次在沙箱内运行时，本机 HTTP 测试出现多项失败并长时间未退出，已中断；定向 `& .\\node_modules\\.bin\\tsx.cmd --test --test-name-pattern 'approved business API' tests/business.test.ts` 复现 `connect EACCES 127.0.0.1`。本机 bind 可成功但 connect 被沙箱拒绝。随后在允许本机连接的环境复测，最终 90 项中 88 通过、0 失败、2 项条件浏览器检查跳过。此前复测版本为 89 项、87 通过、2 跳过；后续新增一项阻断测试。
4. 使用 `B01_BROWSER=1`、`E01_BROWSER=1` 及新证据目录运行 `npm.cmd run check`：91 项中 90 通过、0 失败、1 跳过；B01 和 E01 真实旧模块 Playwright 检查通过，C01 浏览器项跳过。证据在 `evidence/task-results/B01/workbench-r01-20261107/browser/` 和 `evidence/task-results/E01/workbench-r01-20261107/browser/`。这是旧模块自动化，不是新工作台 computer-use 或人类验收。
5. `python scripts/maintenance/check_repository.py` 在追加本记录前通过，检查 133 份 Markdown、435 个本地链接、117 字段，errors=[]；只验证文档/来源保全。

继续前先阅读当前未提交 diff，完成 R01 剩余严格校验及测试，再依次完成 R02–R04。不要删除 503 guard 直到新服务真正实现并经过完整校验；完成后重跑各任务卡命令，记录首次失败与新批次复测。仅在 R01–R04 全部完成、F01-001 实际验证及旧入口回归后，才能进入 R05–R06。

追加本记录后再次运行 `python scripts/maintenance/check_repository.py`：passed，135 份 Markdown、435 个本地链接、117 字段，errors=[]；该命令不验证应用功能。

## 20. 2026-11-07 继续实施记录

本次继续时 HEAD 为 `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`，保留第19节全部未提交工作与旧证据。

- R01 补充澄清来源、引用、修订去重、时序和员工决定一致性校验；新增响应结构及请求／响应匹配函数。`npm.cmd run schemas` 后 JSON 比较仅有计划的三个可选顶层字段及两个新消息 schema，原属性未变；`npm.cmd run build`、`python scripts/maintenance/check_repository.py` 通过。`npm.cmd run check` 为 90 通过、2 跳过；启用 B01/E01 后 92 通过、1 跳过，证据为 B01/E01 的 `workbench-r01-20261107-02/browser`。请求到模型的完整语义与 HTTP 验证仍由 R04 负责，503 临时保护仍保留。
- R02 实现空案、typed answer、可指定 first reviewer、事实缺口重算与旧备注归档、消息阻塞汇总、原子应用与旧答案比较/选择；提供旧案恢复的内存修复和输出阻断。按4.3.1及4.4.1先统一历史接收方和存储读取边界后，最小修改 runtime、runtime-storage 及旧宿主打开动作。原始 IndexedDB 不自动覆盖。定向测试覆盖多问、Unknown、人工更正、旧重试、澄清、停后补充基础、角色历史、导入等；最终 `npm.cmd run check` 109 通过、2 跳过，B01 Playwright 证据 `evidence/task-results/B01/workbench-r02-20261107-03/browser/`：F01-001 的旧 intake 当前缺口和生成摘要、旧 outputs 打开及原 IndexedDB 保留通过。未执行 MD/PDF 的 F01 视觉复测、新工作台或人工验收。
- R02 首次构建失败：`shared/outputs.ts` 的 target 参数类型过窄；修正后构建通过。新增时序断言首次完整检查一项失败：测试夹具把较新答案视为已分析却保留旧的 reanalysis pending；更正夹具并复测通过。新增基于 case version 的检查后，三项测试首次失败，原因是测试响应错误沿用旧 `basedOnCaseVersion`，构造真实当前请求版本后复测通过。首次失败均保留于此，不覆盖证据。
- R03 已建立 70 个 A–J 英文名称／分组，生成正文显示业务名和内部 ID，保留原始引用；映射、未知值、pipe/换行及 Markdown/HTML 测试通过。`npm.cmd run build` 通过；`npm.cmd run check` 为 109 通过、2 跳过；`npm.cmd run check:business` 通过，验证批准内容哈希及引用，并不表示业务验收。

R04 尚未完成；`server/src/app.ts` 对新协议仍返回 503，任何接入此协议的工作台均不可视为可用。R05/R06 尚未开始。后续完整测试应持续复核新纯函数与真实服务组合、更多澄清和保存恢复边界，Mock/fake provider/真实模型分别记载。

### 20.1 R04 进行中检查点

已开始 `server/src/workbench-mock.ts` 和 `server/src/model.ts` 新协议分支，仍未完成 R04：HTTP 的临时 503 保护仍在，尚未开放新协议。定向命令 `& .\node_modules\.bin\tsx.cmd --test --test-name-pattern 'limited workbench Mock starts' tests/model.test.ts` 通过，范围仅为精确 T09 初始消息和不支持变体，providerCalled=false，不代表真实模型或 R04 完成。还需多题、澄清、旧消息、fake provider、HTTP 边界、故障和完整任务卡检查。

R04 继续检查点：已实现并接入 interaction/purpose 分支，替换临时 503；限定 Mock 只接受计划中的 T09 和明确示例。定向 `tests/model.test.ts tests/server.test.ts` 在允许本地连接的环境为 25 通过、1 个条件浏览器检查跳过；其中新协议实际 HTTP + local fake-provider 正向/负向检查通过，Mock 标明 providerCalled=false，fake provider 标明 providerCalled=true。新增覆盖 C08/G05 明确澄清、Unknown 不清空既有布尔、错误 Q/目标/quote、嵌套额外字段、相同目标旧重试/Keep 后重分析及 live 固定记录 ID 禁用；真实 API 未调用。完整任务卡复核和最终全套命令仍需再执行，不能据这一检查点宣称所有 R04 验收完成。

R04 任务卡复核：`npm.cmd run check` 最终 118 通过、0 失败、2 个条件浏览器检查跳过；`npm.cmd run build` 通过；定向 `tsx --test tests/model.test.ts tests/server.test.ts` 为 27 通过、1 跳过。新协议经真实本机 HTTP 与 fake provider 检查，限定 Mock、fake provider 分别标记调用状态；旧协议回归通过。仍未执行真实 API 通用中英文效果、新工作台 U03/U04 或人类验收。R01–R04 的技术实现及本阶段自动检查已完成，可以进入 R05/R06；后续若发现缺陷必须回到对应范围修复并复测。

### 20.2 R05/R06 进行中检查点

R05 已添加 `?view=workbench` 候选壳、单一 record 控制器、`integration` session、空案、保存/切案/备份及 dirty 防护；根页仍为旧宿主。N01 首批 `20261107-r05-01` 在刷新后未重新选择角色，Start case 按设计禁用而超时；修正测试后新批次 `20261107-r05-02` 通过空案、保存刷新、脏草稿、失败保存重试、切案和导入取消，providerCalls=0。`npm.cmd run check` 为119通过、2跳过，构建通过。默认浏览器是豆包；人工打开检查时自动审批拒绝对现有无关登录窗口截图，未绕过，默认浏览器观察仍待可安全执行的空白窗口。

R06 正在编写控制器，源消息先保存、稳定操作锁、模型请求、结果保存及分步 retry 已初步接入，但 UI、澄清和故障路径尚未完成并通过验证。此时不得视为 R06 完成，也不得依赖候选页作为最终产品入口；继续前先检查当前未提交 diff 和类型构建。

用户随后明确本轮仅要求 R01–R04；据此停止 R05/R06，撤出本次新增的候选路由、工作台组件和其测试脚本。上述 R05 自动测试批次作为历史执行证据保留，不代表当前工作区仍有候选页面，也不代表 R05/R06 已完成。默认浏览器截图自动审批拒绝的情况仍按事实保留。

### 20.3 R01–R04 最终收尾（当前范围）

最终范围按用户最新指示止于 R04；第19节及20.1、20.2的未完成描述是当时的历史检查点，不是当前状态。R01–R04 已实现并完成下述自动验证，R05/R06 未实施。按6.2.1补齐未预选的唯一历史 Q 回填：沿用原 Q ID、target、精确 quote、来源及历史，不重计；不允许未预选的 pending 题，同目标有多个旧题时不猜测，同一整段作为多题答案或无法区分的多个额外目标时拒绝。fake provider 和纯函数均覆盖停止后 Q3 回填。人工直接更正标记重新分析 pending；消息时序决定继续沿用该消息的内部续步，不抹除其他阻塞。

最终执行（本机 HTTP 测试使用允许回环连接的环境）：

1. `npm.cmd run build` 成功；`npm.cmd run check` 为 122 项、120 通过、0 失败、2 个条件浏览器项跳过。
2. 设置 `B01_BROWSER=1`、`E01_BROWSER=1`，将证据目录分别设为 `evidence/task-results/B01/workbench-r04-final-20261107-02/browser` 和 `evidence/task-results/E01/workbench-r04-final-20261107-02/browser`，再执行 `npm.cmd run check`：123 项、122 通过、0 失败、1 项 C01 浏览器检查跳过。B01/E01 是旧独立入口的 Playwright 自动检查，其中 B01 包含 F01 缺口、摘要及旧案存储恢复；E01 包含输出页面和 PDF 压力检查，但不是 F01 的 PDF 视觉复验或人工验收。
3. `& .\node_modules\.bin\tsx.cmd --test tests/intake.test.ts tests/outputs.test.ts tests/workbench.test.ts`：37 通过、0 失败、1 个 E01 浏览器项跳过。`& .\node_modules\.bin\tsx.cmd --test tests/model.test.ts tests/server.test.ts`：28 通过、0 失败、1 个 C01 浏览器项跳过。后者包含限定 Mock、真实本机 HTTP 与本地 fake provider，未调用真实模型。
4. `npm.cmd run schemas` 成功；解析 JSON 与 HEAD 比较，原 RuntimeCaseRecord schema 内容未变，仅新增 `conversation`、`analysisUpdate`、`analysisGapHistory`；另外两个新文件为 MessageIntent/MessageResolution schema。`git diff --name-only -- data/schemas data/business` 仅显示 RuntimeCaseRecord schema，业务包没有已跟踪差异。运行时引用 refine 仍须由测试验证，不能只依赖 JSON Schema。
5. `npm.cmd run check:business` 通过批准合成内容的哈希和引用检查，输出 execution=not-executed，不代表业务验收。C03 文档保全检查在追加此记录后执行并另记结果。

补充保留失败：最后一次在受限沙箱运行 model/intake/workbench 定向集时，两项需要本机 HTTP 的测试显示失败且进程未正常结束，已中断；其余测试输出不构成完整结果。允许本机回环后，上述完整及定向命令均复测通过。此前的构建、夹具和 caseVersion 首次失败及复测保留于第19节和第20节；R05 已取消的首次失败批次保留在20.2。真实模型、F01 MD/PDF 视觉复验、新工作台 U03/U04、默认浏览器人工观察和人类业务验收均未执行。使用未来 R06 的完整重分析操作才能处理带 conversation 案件人工更正后保留的 reanalysis pending；旧无 conversation 的独立入口沿用现有分析完成路径。

C03 `python scripts/maintenance/check_repository.py`：passed，141 份 Markdown、435 个本地链接、117 个字段、errors=[]，只检查仓库文档与来源保全。`git diff --check` 通过，仅提示若干文件的 LF/CRLF 转换。当前分支仍为 `integration/test-fixes`、HEAD 仍为 `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`。`app/src/main.tsx` 因索引 stat 缓存显示 M，但工作文件 hash 与索引均为 `263479df156e614384e1d44353ca62f310a69bd0` 且无内容 diff；未为刷新索引修改 `.git`。未跟踪的本文和新证据批次保留，未恢复 stash、提交、推送、合并或部署。

### 20.4 R05 本次继续检查点（未完成）

本次确认分支及 HEAD 仍为上述值，保留原有全部未提交代码、本文、证据和 stash。R01–R04 当前 `npm.cmd run build` 通过；`npm.cmd run check` 在允许本机回环后 120 通过、0 失败、2 项条件浏览器检查跳过。第一次在受限沙箱运行该检查时多个本机 HTTP 测试失败且进程未退出，已中断；回环环境复测通过。真实模型、F01 MD/PDF 视觉复验和人工业务验收仍未执行。

R05 新增 `?view=workbench` 候选壳及其 `CaseWorkbench.tsx`、`useWorkbenchCase.ts`、`types.ts`、样式和 `tests/workbench-browser.ts`。根页仍为原集成入口。已接入单一案件、角色空案、integration 恢复、保存/新建/切案、备份/导入、composer 草稿保护、beforeunload 和会话员工标识。其他业务明确显示 pending。首轮构建因弹窗回调的可空类型检查产生 TS2721/TS2345，补充空值检查后构建通过。

`npm.cmd run check` 复测为 120 通过、0 失败、2 跳过；`npm.cmd run build` 通过。N01 新批次 `evidence/workbench-refactor/20261107-r05-current-01/automation/`、`-02/automation/`、`-03/automation/`、`-04/automation/` 均通过各自覆盖项。最后一批在隔离浏览器上下文实际检查空案、保存刷新、草稿保护、新案隔离、取消、保存失败重试、坏 JSON、同号导入取消、放弃分支和旧集成入口保存的无 conversation v2 案件恢复；providerRequests=0。它不是完整 R05 验收，未验证多面板 dirty、迟到保存、Send 事务及全部故障路径。

R05 **尚未完成**：尚无 draftRevision、稳定 operationId 及操作内保存，未验证 Send 自身草稿、重复提交及源保存失败恢复；事实/正文编辑面板尚未接入，多面板 dirty 和 Go to edit 未验。R06 **尚未开始**，没有消息发送、澄清、重分析、补问调度或相应完整验收。候选页不可视为可用的完整工作台。当前 HTTP 默认浏览器为豆包，检查发现已有无关窗口；历史自动审批曾拒绝对该窗口截图，本次未绕过，也未完成安全独立窗口的 computer-use。所有新证据与历史证据均保留。未更改 PRD、批准业务包或依赖；没有恢复 stash、提交、推送、合并或部署。

追加记录后 C03 `python scripts/maintenance/check_repository.py` 通过，141 份 Markdown、435 个本地链接、117 个字段，errors=[]；只检查文档与来源保全。`git diff --check` 通过，Git 仅提示既有 LF/CRLF 转换。

### 20.5 R05–R06 本次继续实施与验证

本次继续时分支和 HEAD 仍为 `integration/test-fixes`／`5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`，保留第20.4节工作区、原证据和 stash。候选入口仍为 `?view=workbench`，根页保持原集成宿主。R05 新增草稿版本、同步 operation ID 和操作内保存，区分源记录失败与已应用结果的保存失败；同一消息原文、来源及决定的失败重试沿用候选，问题轮只有事务成功才发布和计数。控制器持有单一案件、各项未记录编辑标记及提案临时视图；1280×800 和 1440×900 自动化布局检查两个区域同屏，旧 v2 integration session 可恢复。正文 working edit 尚属 R09/R10，当前以事实更正草稿与 composer 验证不同 dirty key，不声称已验证正文编辑。

R06 候选页接入初始／补充来源、限定 Mock 或配置的模型服务、完整 ticket 和响应校验、答案原子应用、问题轮和显式状态、结束及后补、澄清决定与分步重试、独立 purpose 重分析、旧消息比较和决定后内部分析。网络等待期间更正使旧结果失效；未记录编辑出现时不应用迟到结果。跨消息阻塞从记录派生；已明确保留为未解决的说明由控制器在后续完整分析中保留。上述是候选页技术实现，不表示 R07–R12 的面板、材料、审核或导出已经实现。

首次失败和复测：N01 `20261107-r06-current-01/automation` 因 Q1 的测试定位器超时，调整定位方式后 `-02` 通过；`-03` 因旧成功状态仍可见而过早断言下一次发送，加入操作中提示后 `-04` 通过跨消息场景；`-05`／`-06` 的继续补问因重分析后需要再次核对而未执行，补充重新核对入口与门槛后 `-07` 通过。故障注入中明确验证了源保存失败、模型请求失败、决定保存失败、决定后的分析失败和响应保存失败；结果保留于各新批次。初次方案历史中 R05 构建及沙箱回环失败仍保留在20.4节。

最终 `npm.cmd run build` 通过；`npm.cmd run check` 在允许回环的环境为 121 通过、0 失败、2 项条件浏览器检查跳过。N01 `evidence/workbench-refactor/20261107-r06-current-30/automation/` 覆盖双区与空案、备份及旧案、两类草稿、双击和源保存、单消息多题、部分及跨消息澄清、两种旧答案决定、失败与刷新恢复、设置／事实更正使旧响应失效、未知与不适用、问题轮失败不计数、补问上限、结束后原Q回填、保留不确定说明及重复重分析；providerRequests=0，使用限定 Mock 和受控本地故障，不是实际模型或人工验收。上限使用明确标识的独立合成技术变体。

本轮发现既有 `applyResolvedMessage`／服务边界未强制确认部分澄清响应保留其他未解决片段；R06 控制器在应用前拒绝遗漏，新增定向测试。底层公共函数及其他潜在调用方仍需在获相应范围授权后统一修复，不能把本次控制器防护称为底层已修复。默认浏览器为豆包；因仅发现已有无关窗口，且历史自动审批曾拒绝对该窗口截图，本轮没有绕过或进行默认浏览器 computer-use。U02–U05/U13/U14 的默认浏览器人工观察及真实 API 效果未验证；材料、最终审核、MD/PDF 对照和正文 working edit 仍依后续任务，不得把 Playwright 视为人类业务接收。

本次未更改 PRD、批准业务包或依赖，未恢复 stash，未提交、推送、合并或部署；所有旧证据与本次失败和复测批次均保留。

本记录追加后再次运行 C03：passed，141 份 Markdown、435 个本地链接、117 字段，errors=[]；`git diff --check` 通过，仅有 LF/CRLF 提示。C03 不是应用功能测试。

### 20.6 R05–R06 公共澄清边界收尾与 R07 交接（2026-11-07）

本轮开始和收尾前核对的分支为 `integration/test-fixes`，HEAD 为 `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`。R01–R06 未提交工作、未跟踪方案和旧证据均保留；本节更新第20.5节关于公共层尚未修复、默认浏览器尚未观察的当时状态，不改写历史记录。

**修复与边界。** `shared/workbench-case.ts` 的 `applyResolvedMessage` 在变更和已应用幂等返回之前检查：本次决定或显式保留未处理的原有 unresolved quote 必须仍出现在响应中；遗漏则整份拒绝，输入案件、事实、消息和待解决片段不变。合法部分澄清仍保留其余片段。`app/src/workbench/useWorkbenchCase.ts` 删除原来独立的相同规则，调用公共应用函数。检查调用方后确认 `server/src/model.ts` 的 `validateWorkbenchResponse` 已在响应验证时调用同一公共函数；无须另加一份服务规则。旧无 interaction 的协议不使用这条消息应用路径。控制器保存源决定后的失败状态属于独立事务，错误响应不会应用或丢失事实及其他片段。

**首次失败和复测。** 新增直接公共函数回归后，修复前运行 `& .\node_modules\.bin\tsx.cmd --test --test-name-pattern 'public application rejects a partial clarification' tests/workbench.test.ts`，因遗漏响应没有抛错而失败（`Missing expected exception`）；移入公共边界后同命令通过。直接回归另覆盖完整部分响应、显式 `retainedQuotes`、多次部分澄清、合法及遗漏的重试、JSON 备份/恢复后的行为和输入不变。`tests/model.test.ts` 对服务验证及真实本机 HTTP 路由使用本地 fake provider：遗漏响应得到 502，完整响应可通过并保留第二片段，未调用真实模型。

**最终验证。** 新批次为 `evidence/workbench-refactor/20261107-r05-r06-closeout-02/`；先前 `20261107-r05-r06-closeout-01/`、第20.5节全部失败和复测批次均未覆盖。允许本机回环后，`npm.cmd run check`：126 项、124 通过、0 失败、2 个条件浏览器检查跳过；`& .\node_modules\.bin\tsx.cmd --test tests/workbench.test.ts tests/model.test.ts tests/server.test.ts`：53 项、52 通过、0 失败、1 个条件浏览器检查跳过；`npm.cmd run build` 通过。N01 新批次 `automation/result.json`：24 项记录的检查、errors=[]、providerRequests=0；其中双片段子例通过 Playwright 注入合成响应，验证控制器遗漏时拒绝、合法重试保留另一片段及刷新恢复。它不等于真实模型测试或独立人类验收。`git diff --check` 通过，仅有 LF/CRLF 提示。

**本轮实际界面观察。** 新增 N01 的 `--interactive` 启动方式仅用于本机独立候选检查，服务使用内存 Mock 设置及随机回环端口。HTTP 默认浏览器经本轮核实为豆包；最初读取无关现有窗口的 computer-use 审批请求超时，随后打开独立豆包窗口并实际操作候选页，没有使用 Edge。空案、草稿保存保护、模拟源保存失败及重试、T09 合成输入、E04 更正和再分析、首次核对、补问、一条消息回答三题、刷新恢复和单片段 G05 澄清均有实际观察；详情和边界见新批次 `computer-use.md`。截图仅用于本轮交互观察，没有另存；这不是人工业务验收。双片段故障由上述自动化和本机 fake-provider HTTP 测试覆盖，没有在此手动窗口注入。信息区目前是较长的事实列表；E04 当前值 200 与待审核冲突需要 R07 以可读方式呈现候选、来源和历史。

**留给后续卡的验收。** R07 完成分组事实、来源/候选/历史、首次核对和多记录后，再逐项检查 U02/U06，特别是 200 与 2000、unknown 与 false、不同 TX 隔离、来源追溯和可读布局。正文 working edit 与多面板 dirty/Go to edit、材料和指引、最终审核、MD/PDF 页面/导出一致性及相应 U05/U07–U10 等，分别依 R08–R12 的实际实现与测试完成；不得把当前候选页检查或自动化当作这些验收。真实模型、全面设备/可访问性检查及独立人类业务验收仍未执行。

本轮没有更改 PRD、批准业务包或依赖，没有恢复 stash，也没有提交、推送、合并或部署。下一张任务卡为 R07；开始前重新核对当前未提交状态与本节记录，保留所有已有文件和证据。

追加本节后执行 C03 `python scripts/maintenance/check_repository.py`：passed，142 份 Markdown、435 个本地链接、117 个字段，errors=[]；日志位于新批次 `repository-check.log`。此检查覆盖仓库文档与来源保全，不是应用测试。
