# 课程原型已知问题记录

本文件记录已确认但当前**不实施修复**的课程原型问题，目的是保留事实、影响范围、教学用法和生产化修复建议。这里的问题不等同于已通过项。

## F01-001 · 电信纯骚扰电话被错误生成银行交接

| 字段 | 内容 |
|---|---|
| 状态 | **Open / 当前课程原型不修复** |
| 优先级 | P1（机构边界错误） |
| 首次记录 | 2026-11-10 |
| 测试基线 | `refactor/full-rebuild` / `26e7d78aab97f98832b7b7b3040c91e87046c3e9` |
| 测试来源 | 他人提供的 F01 run-01 测试证据包（假提供商，不是真实模型验收） |
| 相关角色 | Telecom intake officer |

### 问题描述

电信角色收到纯骚扰电话时，系统错误生成收件人为 `SYN Bank A intake team` 的交接稿。该错误稿可以确认、复制和下载。

触发事实：

```text
role = telecom
contactChannel = Phone call
affectedService = Mobile phone
observedIssue = Repeated nuisance calls
```

没有金额、交易状态、账户、凭证或付款相关事实。

### 预期与实际

- 预期：摘要和当事人说明保留；不生成任何银行交接；可以转人工支持。
- 实际：生成 `HANDOVER DRAFT`，接收方为 `SYN Bank A intake team`，并允许确认和导出。

### 根因

[shared/course-case.ts](../../shared/course-case.ts#L718-L744) 的 `handoverRecipient`：

- `BANK_CLUE_KEYS` 包含通用的 `observedIssue` 和 `sharedInformation`；
- 只要这些字段为 known，就视为银行线索；
- 没有判断字段内容是否真的涉及账户、付款、凭证或银行。

因此电信角色在 `observedIssue = Repeated nuisance calls` 时被误判为需要银行交接。

### 证据

- [F01 测试报告](../../evidence/task-results/F01/run-01/REPORT.md)
- [N03 电信错误交接稿](../../evidence/task-results/F01/run-01/new-suite-attempt-01/N03-telecom-scamsafe-handover.md)
- [N03 电信页面截图](../../evidence/task-results/F01/run-01/new-suite-attempt-01/N03-telecom.png)
- [最小 HTTP 复现结果](../../evidence/task-results/F01/run-01/boundary-replay-result.json)
- [测试记录归档说明](../../evidence/task-results/F01/run-01/ARCHIVE-NOTE.md)

当前代码复核：直接用 N03 事实调用 `handoverRecipient` 返回 `bank`，`composeMaterials` 生成非空银行交接稿。该问题与模型质量无关，是确定性程序规则问题。

### 为什么当前不修复

本课程是 AI 应用课程，不是以修复所有工程边界为目标的软件工程课程。保留并展示这个失败案例，可以说明：

- AI 应用不仅是模型输出，数据、规则和合并逻辑也会影响机构路径；
- 人类最终决策需要看到收件方、事实和依据，而不能只点一个 Confirm；
- 原型的能力边界、已知限制和人工责任必须被明确说明；
- 生产化前需要程序级边界保护，不能只依赖人工复核。

因此，本轮决定**不修改**该行为，保留它作为课程案例和已知限制。该决定不代表问题已修复，也不允许声称“双角色交接边界全部通过”或“PRD 全部满足”。

### 演示时的正确用法

1. 用 N03 展示：纯骚扰电话、没有账户/付款事实，却出现银行交接。
2. 明确指出这是**系统中的程序规则错误**，不是模型幻觉。
3. 说明员工应当核对收件机构与事实依据，拒绝确认，不复制、不下载，并转人工判断。
4. 说明只有 `Confirm` 按钮不足以构成人工保障；系统还需要阻止无依据交接、提供依据展示并记录拒绝原因。
5. 在结论中把它列为已知缺陷和生产化修复项，不得列为通过。

### 生产化修复建议（本轮不实施）

- 不再把 `observedIssue` 或 `sharedInformation` 的“known”作为银行线索。
- 用语义规则判断银行相关事实：
  - 金额或交易状态为 known；
  - `claimedIdentity` / `involvedOrganisation` 包含 bank/payment/card；
  - `sharedInformation` 包含 bank/account/card/password/credential/one-time code/verification code/pin；
  - `observedIssue` 包含 account/payment/debit/transaction/fund/card/bank/credential 等。
- 增加回归测试：
  - 纯骚扰电话 → 无银行交接；
  - 泛化 `observedIssue` → 不触发银行；
  - 真实账户/付款/凭证 → 保持原银行路径；
  - 通过 `composeMaterials` 验证无 `Handover`。
- 同步更新实施方案中的交接资格说明。

## F01-002 · 无建议/无交接依据时仍生成交接稿

| 字段 | 内容 |
|---|---|
| 状态 | **Open / 待产品确认，本轮不修复** |
| 优先级 | P2（稳健性/产品规则） |
| 首次记录 | 2026-11-10 |
| 相关角色 | Telecom（N06 电信案例） |

### 问题描述

模型返回 `recommendations = []`，且：

```text
handoverReason = null
handoverRequest = null
handoverGuidelineId = null
```

程序仍根据事实判断出银行接收方，用通用理由补全，生成没有指引 Basis 的银行交接稿。

### 根因

- `handoverRecipient` 只检查事实，不检查模型是否提供了交接依据；
- `composeHandover` 在 `handoverReason` 为空时使用通用理由，且不要求 `handoverGuidelineId`。

### 证据

- [N06 电信错误交接稿](../../evidence/task-results/F01/run-01/new-suite-attempt-01/N06-telecom-scamsafe-handover.md)
- [N06 电信页面截图](../../evidence/task-results/F01/run-01/new-suite-attempt-01/N06-telecom.png)
- [N06 案例记录](../../evidence/task-results/F01/run-01/new-suite-attempt-01/N06-telecom-record.json)
- [最小 HTTP 复现结果](../../evidence/task-results/F01/run-01/boundary-replay-result.json)

### 建议方案（待确认）

保守方案：`composeHandover` 仅在 `handoverGuidelineId`、`handoverReason`、`handoverRequest` 均非空且指引适用时生成交接；否则 `handover = null`，保留摘要和当事人说明，不生成可导出的机构稿。删除无依据的通用理由兜底。

若产品希望允许程序降级补全，必须显示无模型依据的明确警告，并禁止直接确认/导出；但这需要单独的产品决定，不能默认为通过。

## 范围与验收声明

- 上述问题保留失败证据，不把失败改绿。
- 本记录不修改 PRD、程序、提示词或模型配置。
- F01-001/F01-002 存在时，双角色机构边界与完整 PRD 不能标记为全部通过。
- 真实模型、中文理解和正式人类 F 验收仍未执行；fake provider 结果只证明给定响应下的程序行为。

## 相关记录

- [F01 唯一执行记录](tasks/F01.md)
- [F01 测试报告](../../evidence/task-results/F01/run-01/REPORT.md)
- [完整测试记录](../../evidence/task-results/F01/run-01/record/ScamSafe_完整测试记录_20261110.md)
- [原始测试证据包](../../evidence/task-results/F01/run-01/input/ScamSafe_完整测试记录与证据_20261110.zip)
