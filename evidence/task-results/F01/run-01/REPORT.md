# full-rebuild 专项测试证据 · 2026-11-10

执行记录见 [F01 唯一记录](../../../../docs/project/tasks/F01.md#唯一执行记录)。本报告索引用例、实际失败和最短复现；不作为人类或正式F验收。

## 实际基线与范围

拉取 `origin/refactor/full-rebuild`，实际提交 `26e7d78aab97f98832b7b7b3040c91e87046c3e9`；个人测试分支 `codex/full-rebuild-validation`。保留原 D 分支及所有既有本地合成备份。仅新增本批测试证据和F01记录，没有修改产品程序、PRD、指引、公共结构或模型配置，也没有提交、推送或部署本次测试。

按新版 [PRD](../../../../docs/product/PRD.md)、[课程工作台指南](../../../../docs/architecture/COURSE_WORKBENCH_GUIDE.md)及实际四条DEMO指引验证 `/?view=course`。旧 STATUS/T09 模块描述不能替代新版课程标准；本轮不恢复已排除的持久化、PDF、权限及审计系统。

## 运行与证据

| 检查 | 实际结果 | 证据 |
|---|---|---|
| `npm run check` | 182项：180通过，2项旧C/E浏览器用例按默认设置跳过，0失败 | [check.txt](check.txt) |
| `npm run build` | 类型与Vite构建通过；有单包超过500kB的非阻断警告 | [build.txt](build.txt) |
| `npm run check:business` | 原EX批准包哈希、引用通过；不是新DEMO指引语义验收 | [business.txt](business.txt) |
| `node --import tsx tests/course-browser.ts` | 现有课程页17组通过，复制内容实际比较，页面异常0 | [course-browser.txt](course-browser.txt) |
| 新6案例×2角色真实页面／HTTP测试 | 172个检查点：170通过、2个交接边界失败；12条流程均完成分析／材料／复制下载／New case | [result.json](new-suite-attempt-01/result.json) |
| 最小HTTP边界复现 | 10项：8通过，2项交接异常重复出现；不是2个新缺陷 | [boundary-replay-result.json](boundary-replay-result.json) |
| 有效模型配置 | mock、未配置、无key；.env与已保存模型设置均不存在 | [effective-environment.txt](effective-environment.txt) |

运行系统与脚本哈希见 [baseline.json](baseline.json)。npm实际通过内置Node及 `local/tools/npm/bin/npm-cli.js` 运行；Node v24.22.1，Chromium 156.0.8078.4。所有结果为本机实际执行，没有把历史Windows报告当作本轮验证。

新套件使用 `createApp` 的 `fetchImpl` 注入，继续走真实 `runCourseTurn`、OpenAI兼容请求构造、响应校验、状态合并、真实Chromium页面和浏览器下载；没有使用绕过服务合并的courseTurn替身。主套件38次＋最小复现8次，合计46次本地假提供商调用，外部模型请求0。真实模型的事实提取质量、中文理解和双角色建议质量未执行。

用户已经允许现成配置下调用真实模型，但本机没有可用配置，因此没有真实模型成功结果。未配置服务实际返回503 `COURSE_LIVE_REQUIRED`，保留客户端输入的错误／重试流程另以假提供商502验证。

## 新编案例矩阵

[完整原文与预期](new-cases.json)。每个案例均分别选择银行、电信角色，调用分析、查看指引、生成材料、确认、复制、分别下载摘要／当事人说明／适用交接稿，并比较页面、剪贴板和下载字节；所有请求／响应为 [requests.json](new-suite-attempt-01/requests.json)。

| 编号 | 新内容 | 银行接报预期／实际 | 电信接报预期／实际 |
|---|---|---|---|
| N01 | 供应商邮件，4350 NZD，pending；无短信或电话 | 无电信交接／通过 | 银行交接／通过 |
| N02 | 冒充银行短信，86 GBP；查询、改19、表不确定、多题作答、失败重试；后人工改23 | 电信交接／通过 | 银行交接／通过 |
| N03 | 纯骚扰电话，异常仅为重复骚扰；没有账户或付款信息 | 电信相关交接／通过 | 无银行交接／**实际错误生成银行交接** |
| N04 | 感到overwhelmed、压力及信息不足，DEMO-G03 | 无交接且保留支持线索／通过 | 无交接且保留支持线索／通过 |
| N05 | 新中文短信与银行密码叙述，246 CNY，交易状态未知 | 电信交接／通过 | 银行交接／通过 |
| N06 | 负向提供商分支：有120 EUR账户担忧，但返回Other、空建议、无交接引用 | 无交接／通过 | 保守路径预期无无依据交接／**实际生成银行交接**，见F01-002的范围限定 |

N05只证明中文文本能通过API、状态和页面传递；结构化提案由测试假提供商预先指定，不能作为中文模型理解通过。N06也不证明DEMO-G01在真实业务上不适用：它测试的是模型未给出建议和交接引用时，程序是否仍自行补出路径。

额外实际通过：处理中阻止重复提交；角色选择保留输入、开始后隐藏切换；query即使模型误带金额和答案也不改事实／题数；明确更正和uncertainty区分；一次多答案及unknown；无效JSON失败保留输入、Retry复用原失败消息ID；材料确认、再编辑撤销确认；事实更正保留人工材料并停止导出；取消重新生成不请求提供商；确认替换使用新事实；取消New case保留原案，确认后清空。

## F01-001 · P1 · 电信纯骚扰问题被判为银行线索

- 依据：PRD FR-01/06/07、5.3；DEMO-G02和电信职责均要求报告确有账户／付款担忧才交银行。
- 前提：电信角色；N03假提案只写入 `contactChannel=Phone call`、`affectedService=Mobile phone`、`observedIssue=Repeated nuisance calls`，类型Other，本机构建议引用DEMO-G02；无银行、资金或凭证字段。
- 最短动作：分析N03→Generate materials→查看Handover draft。该稿还能Confirm、Copy和下载。
- 预期：保留摘要和当事人说明，不出现银行交接。
- 实际：出现 `Recipient: SYN Bank A intake team`，内容只有骚扰电话、移动服务和重复骚扰问题；已实际复制和下载。
- 根因位置：[shared/course-case.ts:718](../../../../shared/course-case.ts#L718) 的 `BANK_CLUE_KEYS` 包括通用 `observedIssue`（同样包括通用sharedInformation）；`handoverRecipient` 以“字段known”代替“银行相关问题”。
- 证据：[实际页面](new-suite-attempt-01/N03-telecom.png)、[下载的错误交接稿](new-suite-attempt-01/N03-telecom-scamsafe-handover.md)、[合成案件快照](new-suite-attempt-01/N03-telecom-record.json)、[最小HTTP结果](boundary-replay-result.json)。
- 已重复：最小复现让模型三个handover字段全部返回null，实际程序仍产生同样银行稿。
- 建议归属：A／公共course-case交接资格。应区分银行账户异常与普通电话服务问题，再补边界回归；本轮检查不改公共行为。

## F01-002 · P2／待A确认 · 空建议、无交接引用时程序仍补出交接稿

- 依据：PRD 5.3/5.4要求基于当前事实和演示指引准备有依据的机构路径，不能强行补齐。
- 前提：N06电信角色保留金额／账户担忧；假提供商返回 `recommendations=[]`，材料的handoverGuidelineId为null。最小复现还将handoverReason和handoverRequest明确设为null。
- 实际：模板仍根据amount生成银行交接，并用通用Reason补全，正文没有Basis。
- 测试限定：账户担忧本身可能适用DEMO-G01，本例不能据“用户叙述说无指引”断定实际无指引；明确观察是**模型未提供任何交接内容或引用时，程序自行产生可确认导出的机构稿**。这是提供商遗漏／错误响应下的保守边界问题，需要A确认是否允许这种确定性降级；不把它冒充真实模型已生成错误建议。
- 根因位置：[handoverRecipient](../../../../shared/course-case.ts#L731)没有检查当前建议／交接依据，[composeHandover](../../../../shared/course-case.ts#L900)在recipient存在时补默认理由。
- 证据：[空建议及实际稿](new-suite-attempt-01/N06-telecom-record.json)、[截图](new-suite-attempt-01/N06-telecom.png)、[下载稿](new-suite-attempt-01/N06-telecom-scamsafe-handover.md)、[null三字段复现](boundary-replay-result.json)。

## 最小复现命令

仓库根目录，使用Node 24和现有依赖：

```sh
npm run check
npm run build
npm run check:business
node --import tsx tests/course-browser.ts
node --import tsx evidence/task-results/F01/run-01/new-suite.ts evidence/task-results/F01/run-02/new-suite
node --import tsx evidence/task-results/F01/run-01/boundary-replay.ts evidence/task-results/F01/run-02-boundary.json
```

上述新目录用于后续复测，不会覆盖本批；new-suite拒绝已有result.json，boundary-replay拒绝已有结果文件。最小脚本读取本批已保留的合成案件。新套件出现已记录缺陷时预期exit=1；不能为了变绿改掉失败预期。缺浏览器时记录失败，不自动下载。

## 验收限制

有一个明确的机构边界缺陷及一个待A确认的保守降级问题，不能把本轮记为双角色边界全部通过。没有修改产品实现或替负责人修复；没有真实模型、真实员工或正式F独立人类验收，也未做PDF和持久化验收（新版不要求）。

## 完整测试记录归档

[Word完整记录](record/ScamSafe_完整测试记录_20261110.docx)、[Markdown完整记录](record/ScamSafe_完整测试记录_20261110.md)、[逐项检查清单](record/逐项检查清单.md)已按本批既有结果整理。没有为文档制作重新运行应用或新增通过结论。
