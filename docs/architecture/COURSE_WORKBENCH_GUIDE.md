# 课程原型工作台使用指南

面向课堂演示、组内验收和人工复核。这个指南说明如何启动、配置模型、使用课程工作台，以及当前哪些内容已验证、哪些仍是已知限制。

产品行为以 [PRD](../product/PRD.md) 为准；实现和批次范围见[课程原型实施方案](../project/COURSE_PROTOTYPE_IMPLEMENTATION_PLAN.md)。本指南只记录操作方法，不替代 PRD 或任务卡。

## 1. 入口与前提

课程页入口：

```text
http://127.0.0.1:5173/?view=course
```

根页面 `http://127.0.0.1:5173/` 仍用于旧集成页和模型设置，不是课程页。

本地启动（在仓库根目录执行）：

```powershell
npm run dev
```

启动后打开 `http://127.0.0.1:5173/?view=course`。如果使用 `npm run build` 后 `npm start`，课程页为 `http://127.0.0.1:4310/?view=course`。

前提：

- Node.js 24.x 和项目依赖已就绪。
- 真实模型演示需要可用的 OpenAI 兼容服务和密钥；模型未配置时页面按设计显示 503 提示。
- 课堂演示和验收只使用虚构案例。真实模型请求会把当前合成案件发送给配置的供应商，可能产生费用，不要把真实个人信息输入页面。

课程案件只保存在当前浏览器内存中：

- **不要刷新课程页**，否则会丢失当前案件、问题进度和材料。
- 不支持多案件历史、IndexedDB 恢复或真实机构系统连接。

## 2. 模型配置

### 2.1 通过现有页面配置（推荐）

1. 打开 `http://127.0.0.1:5173/`。
2. 在 `Model API settings` 卡片点击 `Configure model API`。
3. 设置：
   - `Model mode`：`Real API — use my provider`
   - `API base URL`：供应商的 OpenAI 兼容地址，例如 `https://provider.example/v1`；不要附加 `/chat/completions`。
   - `Model name`：供应商给出的准确模型名。
   - `API key`：个人密钥。
   - 如有需要展开 `Authentication & timeout`，按供应商要求选择 `Authorization`、`api-key` 或 `x-api-key`，填写前缀（通常是 `Bearer`）和超时。
4. 点击 `Save API settings`。保存本身不会调用模型。

保存的本地配置位于 `local/model-settings.json`（已被 Git 忽略）。通过页面保存后不需要重启，课程页下一次请求会使用新配置。**不要提交该文件，也不要在截图、聊天或文档中记录密钥。**

### 2.2 通过根目录 `.env` 配置（可选）

在仓库根目录的 `.env`（已被 Git 忽略）中设置：

```text
MODEL_MODE=live
MODEL_BASE_URL=https://provider.example/v1
MODEL_NAME=provider-model-name
MODEL_API_KEY=provider-key
MODEL_AUTH_HEADER=Authorization
MODEL_AUTH_SCHEME=Bearer
MODEL_TIMEOUT_MS=60000
PORT=4310
```

说明：

- `MODEL_BASE_URL` 不要以 `/chat/completions` 结尾。
- 修改 `.env` 后需要重启 `npm run dev`；只改运行中的进程不会自动读取新环境变量。
- 页面保存的 `local/model-settings.json` 优先于 `.env` 启动默认值。若曾保存过 mock 配置，需要先用页面改回 live，或处理该本地文件。
- 密钥不会通过页面 API 返回；页面只显示 `API key saved`。

### 2.3 常见模型错误

| 页面提示 | 含义 | 处理 |
|---|---|---|
| `Live model is not configured...` | 当前生效配置不是 live，或地址/模型名/密钥不完整 | 检查模型设置，保存后重试 |
| `The model timed out...` | 请求超过配置超时 | 等待后点 `Retry`；必要时将超时调到 90–120 秒 |
| `The model returned an unusable result...` | 模型输出不是合法 JSON/未通过契约校验 | `Retry`；保留原文，不改已保存事实 |
| `The model service could not be reached...` | 网络、地址或供应商拒绝 | 检查地址/密钥/网络，恢复后 `Retry` |
| 503 `COURSE_LIVE_REQUIRED` | 服务端认为未处于 live 配置 | 检查模式、地址、模型名和密钥 |

真实模型调用通常需要约 20–45 秒；处理中按钮显示 `Processing…`，超过 10 秒页面会提示模型仍在处理。不要重复点击。

## 3. 页面结构

课程页只保留顶部 banner 和左右两栏：

```text
┌────────────────────────────────────────────────────┐
│ ScamSafe / 当前角色 / 案件状态 / New case             │
├───────────────────────────────┬────────────────────┤
│ Case overview / Guidance      │ Case conversation  │
│ / Materials 三个标签           │ 当前问题条          │
│ 当前角色职责                  │ 对话记录            │
│ 本轮全部问题                  │ This turn 摘要      │
│ 事实 / Unknown / Remaining gaps│ 输入框和主按钮      │
│ 建议 / 材料                   │                    │
└───────────────────────────────┴────────────────────┘
```

桌面端左右面板等高并占满顶部 banner 以下空间；左侧有一个滚动区，右侧对话区单独滚动，输入框固定在面板底部。左右面板宽度不同，右侧对话区更宽。

## 4. 完整使用流程

### 4.1 选择角色

新案没有用户消息时，左侧显示：

- `Bank employee`
- `Telecom employee`

选择后顶部显示角色标题，左侧 `Current employee role` 显示职责原文。开始对话后角色按钮隐藏；切换角色需要 `New case`。

### 4.2 输入叙述或载入示例

右侧输入框标签为 `Case description or additional information`。

可以：

- 直接输入当事人经历的英文或中文叙述（中文质量目前未验收）。
- 从 `Explore a fictional case` 选择并点击 `Load example` 载入示例文本。

示例：

- `SMS phishing · unfamiliar debit`
- `Missing information · payment request`
- `Limited information · support needed`

载入示例只填输入框，不会自动分析。

### 4.3 分析案件

点击 `Analyze case`。成功后左侧会更新：

- `Current employee role`：角色职责。
- `Round questions`：本轮全部问题、问题状态、编号映射；有 pending 问题时可见。
- 事实分组：`Event` / `Money` / `Account` / `Current` / `Support`（只显示相关组）。
- `Unknown` 状态徽章：表示模型明确标记为不知道的事实。
- `Remaining gaps`：未知事实、未处理问题、uncertainty、pending conflict。
- `Case overview`、`Guidance`、`Materials` 三个标签。

右侧助手回复采用员工视角，并附程序生成的 `Next:`。成功回合还会显示 `This turn`：

- `Recorded updates`：本回合实际变化的字段/问题；无变化时显示 `No case facts changed.`
- `Still unclear`：当前仍未明确的内容；无缺口时显示 `No recorded gaps.`

### 4.4 回答追问

有 pending 问题时：

- 左侧 `Round questions` 显示当前轮全部问题，格式为 `Q1/Q2/Q3 + 问题正文 + purpose + 状态`。
- 右侧当前问题条显示 `Question i of N`、当前问题正文和三个按钮：
  - `Don't know`
  - `Skip question`
  - `End questions`

也可以在输入框自由回答。一次回答多个问题时，先核对左侧编号顺序，再写：

```text
1: ...; 2: ...; 3: ...
```

`1/2/3` 对应左侧列表的 Q1/Q2/Q3；不要在没有看问题列表时盲答。

按钮只在本地更新问题状态，不调用模型；`Don't know` 和 `Skip question` 不写入确定事实，`End questions` 把剩余 pending 题结束并保留缺口。

### 4.5 查询、更正和不确定

- 查询：`What is the current amount?`
  - 依据当前案件回答，不改变事实或问题进度。
- 明确更正：`The amount is 200 AUD, not 2000.`
  - 更新金额和币种；已有材料会标为 `Materials need updating`。
- 不确定：`I am not sure about the amount.`
  - 保留原值，增加 uncertain 说明，不把查询或不确定当成确定事实。

每次响应都会给出下一步。

### 4.6 直接编辑事实

左侧事实卡片可以编辑：

- 失焦后调用 `applyEmployeeFactEdit`。
- 空白或 `Unknown` 使该事实变为 unknown、值为空。
- 其他文本作为 known 值。
- 编辑事实不会删除已有材料；已有材料会标为 `Materials need updating`。
- 事实值、Unknown 状态、uncertainty 和 pendingConflict 在左侧显示。

### 4.7 查看建议

点击 `View guidance` 或左侧 `Guidance`：

- 显示建议的 organisation、priority、audience、action、reason、guidelineId。
- 显示 `Guideline: DEMO-Gxx — 标题; Applies to: Bank/Telecom`，便于核对依据。
- 没有建议时显示 `No guidance yet. Analyze a case, or ask in the conversation.`

建议只是辅助判断，最终由员工/人工审核决定，不执行真实机构动作。

### 4.8 生成、编辑、确认和下载材料

无材料时，右侧快捷操作显示 `Generate materials`。点击后：

- 切到 `Materials`；
- 生成 `Case summary`（含 `FICTIONAL COURSE CASE`）和 `For the person`；
- 只有交接资格成立时才出现 `Handover draft`；
- 生成后状态为 draft。

编辑材料：

- 在材料 textarea 中修改，调用 `editMaterialText`；
- 编辑后 `Copy` / `Download Markdown` 禁用；需要重新 `Confirm materials`。

确认和导出：

- `Confirm materials` 只对 draft 可用；确认后显示 `Materials confirmed.`；
- `Copy` 和 `Download Markdown` 只在 confirmed 可用；
- 下载文件名：
  - `scamsafe-summary.md`
  - `scamsafe-person.md`
  - `scamsafe-handover.md`
- 下载内容应与页面 textarea 完全一致。

已有材料时：

- `Regenerate materials` 会先确认是否替换；
- 取消不会修改正文；
- 事实修改后已有材料保留人工编辑，标为 `Materials need updating`，确认/复制/下载暂停，直到重新生成并确认。

### 4.9 New case 和失败重试

- `New case`：没有消息且输入为空时直接重置；有内容时先确认，取消不改变当前案件。
- 模型失败时保留 textarea 原文，显示失败消息；主按钮变为 `Retry`。
- `Retry` 复用最后一条 failed 用户消息的 id；可以修改 textarea 后重试。
- 当前案件只在内存中，刷新会清空。

## 5. 三个示例的使用建议

### 5.1 SMS phishing · unfamiliar debit

适合演示：

- 事实提取、身份/渠道/金额、Unknown 交易状态；
- 三个追问、查询、更正、不确定；
- 银行角色分析；
- 材料摘要与银行建议。

### 5.2 Missing information · payment request

适合演示：

- 付款请求、供应商邮件、付款状态缺口；
- 多问题回答；
- 建议、材料生成和下载；
- 银行角色不应生成电信交接。

### 5.3 Limited information · support needed

适合演示：

- 信息不足、压力/脆弱性线索；
- `Insufficient information` 类型；
- 人工支持建议；
- 不应生成 Handover draft；
- 当事人说明不应出现员工操作指令或 `Unknown Unknown`。

## 6. 验证方法

### 6.1 自动化检查

在仓库根目录：

```powershell
npm run check
npm run build
npx tsx tests/course-browser.ts
```

- `npm run check`：TypeScript 检查和单元/契约测试。
- `npm run build`：构建页面；之后浏览器脚本使用 `dist`。
- `npx tsx tests/course-browser.ts`：使用注入的 fake `courseTurn` runner 检查页面接线、布局、材料、失败重试等；它不是真实模型验收。

`tests/course-browser.ts` 会输出 `mode=fake-model`，并在结束时关闭浏览器和临时服务。不要把它当作 live 模型结果。

### 6.2 真实模型人工检查

真实模型需要配置并主动触发。建议记录：

- 时间、模型名、调用是否成功；
- 输入用例和实际回复；
- 事实/Unknown/缺口是否正确；
- 建议的 guidelineId、appliesTo、action、reason 是否与指引和事实一致；
- 材料是否反映最新事实，下载内容是否与页面一致；
- 失败时是否保留原文、Retry 是否复用同一段文本。

不要在验收记录中写入密钥。

### 6.3 当前已验证范围

已通过自动化或人工验证的内容包括：

- 页面加载、顶部 banner、左右等高布局、无横向溢出；
- 角色职责、单滚动左栏、右侧紧凑当前问题条；
- 事实分组、Unknown、Remaining gaps、建议 audience；
- 多答案、查询、更正、不确定、追问按钮；
- 材料生成/编辑/确认/复制/下载；
- 失败/Retry；
- fake-model 浏览器检查；
- 至少一轮 live 银行案例和支持案例分析。

## 7. 已知限制

已确认的机构边界问题及当前未修复决定见[课程原型已知问题记录](../project/COURSE_KNOWN_ISSUES.md)。其中 F01-001 是电信纯骚扰电话被错误生成银行交接，F01-002 是无交接依据时的降级行为；演示时不得把它们当作通过项。

- 中文输入没有被完整验收；PRD 仍写着输入支持中英文，界面和材料使用英文。
- 电信角色的真实模型案例尚未单独验收；目前规则和 fake-model 检查覆盖电信角色。
- 没有多案件历史、刷新恢复、真实机构接口、自动发送、PDF 或部署能力。
- 问题调整/不适用等扩展流程没有完整 UI；当前以一轮最多 3 题为主。
- 建议由真实模型生成，适配性和事实一致性每次可能有差异；应以 `guidelineId/appliesTo/action/reason` 和当前事实人工核对。
- 材料摘要保留 `FICTIONAL COURSE CASE`；当事人说明和交接草稿的虚构标识不再作为 PRD 强制要求。
- 分析区不展示事实的原文 evidence；PRD 已移除该展示要求。

## 8. 相关文件

- [产品需求 PRD](../product/PRD.md)
- [课程原型实施方案与批次](../project/COURSE_PROTOTYPE_IMPLEMENTATION_PLAN.md)
- [本地运行说明](RUNBOOK.md)
- [课程页面组件](../../app/src/course/CourseWorkbench.tsx)
- [课程页面样式](../../app/src/course/course.css)
- [课程对话提示词](../../server/prompts/course-turn.txt)
- [课程浏览器验收脚本](../../tests/course-browser.ts)
