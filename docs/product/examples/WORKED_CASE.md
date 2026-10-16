# EXAMPLE-01：从自由描述到两份交接草稿

用途：让成员使用同一个案件讨论界面、提示词和验收。产品规则以 [PRD](../PRD.md) 为准，字段含义见[字段字典](../FIELD_DICTIONARY.md)。这是合成教学样例，不是程序输入格式、已审核评估数据或测试通过记录；不要求成员照表创建 schema。

**使用门槛：**下文角色和指引均未获团队审核，不能当作已生效配置。若运行时已有可用角色、但没有有效指引，按第 4.1 节只生成事实摘要，不能输出第 5–6 节的具体建议和接收方稿。第 5–6 节仅供团队审核有指引路径；只有角色、指引和预期结果分别审核后，才能用于对应验收。第 7 节列出各路径的待执行检查。EXAMPLE-01 拟映射为 T09（网络钓鱼缺失／冲突变体），作为 15 个评估案例之一，待团队审核后纳入。

## 1. 选择角色并输入

教学角色：`SYN Bank A / Intake Officer`；员工代号 `STAFF-EX01`。拟定权限仅为记录合成案件、核对事实、准备本地草稿和提交人工评估请求；不具有账户操作、电信处理或发送交接权限。角色由员工选择并从审核后的配置加载，不能由叙述推断。

案件编号：`EXAMPLE-01`。接报时间：`2026-10-16 10:00 Australia/Sydney`。下列 S1–S5 是引用定位标签，不属于产品需要识别的输入语法。

> S1. I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
>
> S2. I opened the link at verify-bank.example and entered my online banking password and a one-time code.
>
> S3. At 09:30 I noticed an unfamiliar AUD 2,000 debit in my SYN Bank A app; I do not know whether it is pending or completed.
>
> S4. I use SYN Telco B for my mobile service, and I have not contacted either organisation about this yet.
>
> S5. I have the text message on my phone, but I have not provided any material to the employee.

原型不访问网址，不收集密码或验证码的实际值，不把材料存在当作已经上传或核验。

## 2. 首次提取与首次审核

首次展示的下列事实均为“未审核”；来源是当事人陈述，不是外部证实。记录编号仅用于关联同案信息。

| 字段／记录 | 初次显示值 | 来源与状态 |
|---|---|---|
| A03–A06 | Banking / SYN Bank A / Intake Officer / configured scope | 员工选择与角色配置；不来自模型 |
| B01 | Person concerned | S1–S5 的第一人称报告 |
| C02–C04 / CONTACT-01 | 16 Oct 2026 09:00 / SMS / claims to be SYN Bank A | S1；自称身份不等于真实身份 |
| C06–C07 / CONTACT-01 | verify-bank.example / account verification | S1–S2 |
| C08 / CONTACT-01 | Unknown | 未说明是否仍被联系 |
| D04 / EVENT-01 | Opened the link and entered credential categories | S2；关联 CONTACT-01 |
| E01（案件级） | Reported debit | S3；不推断为已确认损失 |
| E02 | TX-01 | 为 S3 所述同一笔扣款建立记录；后续补充不重复建交易 |
| E03–E05 / TX-01 | Transaction time unknown / 2000 / AUD | S3；09:30 是发现时间，不是交易时间 |
| E06–E09 / TX-01 | Method unknown / SYN Bank A / recipient unknown / status unknown | S3 |
| F01–F03 | Yes / banking password and one-time code / linked page | S2；只记录资料类别 |
| F05–F07 | SYN Bank A online banking / unfamiliar debit / 09:30 | S2–S3 |
| J02–J05 / EVID-01 | Text message / available on phone, not provided / CONTACT-01 | S5；内容依据仍是 S1–S2 的转述 |
| K01–K04 | Suspected phishing; identity and debit cause unverified | 依据 CONTACT-01、EVENT-01；不确认诈骗 |

S4 的 SYN Telco B 保留为叙述中的服务背景，供通信接收方判断；不能把它写成短信发送者。“接报前尚未联系这两家机构”作为否定背景保留在 A07 的 S4 来源及摘要中，不建立 I 组应对记录，也不推断为“从未采取任何应对”。其余未提及字段保持未知或按条件隐藏，不默认填“否”。

员工在首次审核中输入：**“The amount was entered incorrectly. The reported debit is AUD 200, not AUD 2,000.”**

- E04 / TX-01 更新为 `200`；O03 保存 `2000 → 200`、更正理由及员工；P02/P04 保留 S3 原文及来源，P06 标记“员工已更正”。
- 当前金额以人工更正为准，原始 2000 留在历史而非继续计入总额。重新分析即使再次读到 S3，也不能覆盖 200；新冲突需展示给员工处理。
- 员工明确完成首次事实与类型审核，记录 O08/O09。审核表示核对了叙述，不表示银行已经核实交易。

以下用 V1 表示初次提取快照、V2 表示更正并首次审核后的快照、VF 表示最终待审核快照。它们是讲解标签；程序中 A08 使用递增整数，不照搬这些字符串，也不在这里规定每次点击的版本增量。

## 3. 一轮补问，分两次回答

本轮问题须成功显示并持久记录后才计为第 1 轮、累计 3 问。问题展示或保存失败不应消耗一次新轮次；重试也不能重复计数。

| 问题 | 英文问题／目标字段 | 原因 |
|---|---|---|
| Q1 | Is the debit shown as pending or completed? / E09 / TX-01 | 交易状态影响银行记录和人工评估 |
| Q2 | Has the sender contacted you again? / C08 / CONTACT-01 | 判断该次接触是否仍在继续 |
| Q3 | Does the bank app identify the recipient of the debit? / E08 / TX-01 | 收款对象影响银行人工评估记录，当前未提供 |

第一次回答：**“The app says pending.”** 仅更新 Q1、E09 为“据当事人称待处理”；Q2/Q3 保持待回答，仍在第 1 轮，不自动创建第 2 轮。

第二次回答：**“I do not know whether there were more messages. I cannot identify the recipient from the app.”** Q2、Q3 标记未知／无法回答，C08、E08 保持未知；J04 继续依据 S5 保持“当事人称持有，未提供”，不当作补问新获得的事实，也不自动产生附件。该轮三个问题均已处理。

员工选择结束补问。最终保留交易时间、付款方式、收款对象及是否仍被联系等缺口；不再追问已明确无法回答的内容。补充变化在最终审核中一起核对。

此后若主动补充收款对象，更新 Q3 的原回答及 E08 / TX-01 并保留历史，不新增问题或计数，不自动恢复补问；相关输出更新后需审核。若另有 TX-02，其 E08 是不同目标，但本案已经主动结束，仍不能因此新增补问。已更正的金额 AUD 200 保持保护。

## 4. 拟审核的有限合成指引

所有行的审核状态均为 **Draft / not approved**，没有实际生效日期。只描述教学记录与人工评估边界，不构成真实业务处理规则。未来要启用，必须先审核当前岗位权限及接收方职责配置；下表任一必需条件不满足时，不输出对应步骤，不用未知或类型标签代替满足。

| 编号／版本 | 必须满足 | 允许未知及限制 | 负责岗位、拟定步骤及边界 |
|---|---|---|---|
| EX-G01 v1 | F06 报告 TX-01 为异常扣款；E07 / TX-01 为 SYN Bank A；E09 / TX-01 无冲突且不是据报已完成或仅被要求付款 | E04/E05 可未知；E09 可未知或据报待处理。记录缺口，不填造金额、币种或状态 | SYN Bank A Intake Officer 准备内部人工评估记录；由人工专员决定后续评估，不执行冻结、不承诺退款 |
| EX-G02 v1 | C03 / CONTACT-01 为 SMS；S4 明确说明 SYN Telco B 是当事人的移动服务机构；配置中有对应人工接报职责 | C08、材料原件和共享许可可未知；只准备本地稿，明确未核验及未共享 | SYN Bank A Intake Officer 准备 SYN Telco B 接报草稿；对方人工核实具体职责，不推断 SIM 换卡、不操作号码 |
| EX-G03 v1 | C03 / CONTACT-01 为 SMS；有对应短信线索及其来源 | J04 可未知；材料未提供或未核验时照实注明，不要求新增材料 | SYN Bank A Intake Officer 可为人工评估另备一份现有短信线索摘要；员工可拒绝重复整理，不声称已核验短信 |

例如 EX-G01 在 E04 未知时仍可准备注明金额未知的记录；若 E07 未知、E09 有冲突或显示据报已完成，则不匹配该指引，保留原因供人工核实。此教学条目不覆盖所有交易状态，不能为匹配它而修改事实。

### 4.1 没有有效指引时的当前目标路径

以第 3 节结束后的事实为输入，显示 **“Insufficient approved guidance; human review required”**，不创建 REC-01–03 或 HANDOVER-BANK／TELCO。可生成以下统一摘要草稿；此处的正文同样待团队审核，并非当前已审核运行数据：

> **Synthetic training case — EXAMPLE-01 — case version: [current integer version]. Insufficient approved guidance; human review required. Local factual summary only.**
>
> The person reports receiving an SMS claiming to be SYN Bank A, opening verify-bank.example and entering a banking password and a one-time code. No secret values are recorded. They report noticing an unfamiliar debit at 09:30 on 16 October 2026. The employee corrected the amount from AUD 2,000 to AUD 200; the person later described it as pending. These statements support suspected phishing, but the sender's identity and the debit's connection to the SMS are unverified.
>
> The person uses SYN Telco B and reported no prior contact with either organisation before intake. They say the SMS remains on their phone; no material was supplied or verified. Transaction time, payment method, recipient and continuing contact remain unknown. Questioning ended after one round of three questions. No subsequent action or delivery is recorded. This summary provides no specific handling recommendation or recipient handover.

员工核对最新事实／分析及此摘要后完成最终审核；不要求选择接收方或接受建议。审核有效后可本地预览、复制并导出 Markdown／PDF，文件名包含 `EXAMPLE-01`、`summary` 和具体整数版本。若有效指引日后获配置，再生成第 5–6 节输出并单独完成对应最终审核，不能继承事实摘要的通过状态。

## 5. 目标建议与最终审核操作

本节仅演示“前述配置和指引日后获审核”的目标行为。当前仓库不得显示它们为已批准建议。

| 建议 | 事实／指引依据 | 优先级、依赖与审核操作 |
|---|---|---|
| REC-01：准备银行内部人工评估记录 | TX-01，E04=200，E09=reported pending；EX-G01 v1 | 优先人工评估，因报告待处理异常扣款；员工接受，实际评估尚未执行 |
| REC-02：准备电信方短信接报草稿 | CONTACT-01，S4，EVID-01；EX-G02 v1 | 可与 REC-01 并行准备；员工接受；对外共享前仍需人工核实许可与接收方职责 |
| REC-03：另备一份现有短信线索摘要 | CONTACT-01、EVID-01；EX-G03 v1 | 可选、低优先级；员工拒绝：“The two handover drafts already contain these details; no separate note is needed.” REC-01/02 的接受选择保留 |

拒绝前，仅 HANDOVER-TELCO 的未审核初稿含有 “Please prepare a separate SMS summary.”；HANDOVER-BANK 不包含该步骤。REC-03 的拒绝保存在 O04 审核记录，电信草稿移除该句并等待员工核对；此时尚未最终审核，草稿状态仍为待审核。不能只隐藏建议卡而在正文继续要求执行它。短信事实及“短信内容未完整核实”的缺口保留，REC-01/02 的接受选择也保留。若在另一操作变体中先完成最终审核、再拒绝被引用的建议，则对应草稿原审核失效。

员工核对 VF 的最新事实、疑似类型、REC-01/02、REC-03 拒绝结果及下列两份当前草稿，明确完成最终审核。O07 为“共享许可尚未核实，仅本地草稿”；O06 为“尚无后续实际执行记录”。最终审核应绑定 VF 及两份草稿的对应版本，不能复用更早版本的通过状态。

## 6. 最终正文目标稿（英文）

以下三段供团队审核措辞；“Reviewed”只在产品实际完成上述审核且版本仍有效时使用。复制或导出选择接收方时，共用元信息、统一摘要和所选接收方正文；排版可不同，事实、局限和审核状态不可不同。

### Shared summary

**Synthetic training case — EXAMPLE-01 — case version: [current integer version].** Local draft only; sharing permission has not been verified. Reviewed for record accuracy by STAFF-EX01; this does not confirm fraud, external facts, completed actions or delivery.

The person reports receiving an SMS at 09:00 on 16 October 2026 claiming to be SYN Bank A. They opened verify-bank.example and entered a banking password and a one-time code; no secret values are recorded. At 09:30 they noticed an unfamiliar debit in the SYN Bank A app. The employee corrected the initially entered AUD 2,000 to AUD 200. The person later described the debit as pending. This supports suspected phishing, but the sender's identity and the connection between the message and the debit remain unverified.

The person uses SYN Telco B and reported no prior contact with either organisation before intake. They say the text remains on their phone; no material was supplied or verified. Further contact from the sender, transaction time, payment method and recipient remain unknown. Questioning ended after one round of three questions. No subsequent action or delivery has been recorded.

### Bank recipient — HANDOVER-BANK

**Recipient: SYN Bank A / designated human review team.** Please assess the reported unfamiliar AUD 200 debit, described by the person as pending, together with the reported credential entry. REC-01 is accepted for preparation of this local review record under EX-G01 v1 in this synthetic scenario. The intake role has not changed the account or transaction. Transaction details and the relationship to the SMS require human verification. No recovery, refund or other outcome is promised.

### Telecom recipient — HANDOVER-TELCO

**Recipient: SYN Telco B / designated human intake team.** The person reports using your mobile service and receiving an SMS claiming to be SYN Bank A. This local draft records the communication concern for assessment of whether it falls within your team's remit; it does not establish who sent the message. The person reports an unfamiliar AUD 200 bank debit, described as pending, but its connection to the SMS is unverified. REC-02 is accepted for preparation under EX-G02 v1 in this synthetic scenario. The original text has not been supplied or verified, and continuing contact is unknown. No mobile account change, message blocking or external transfer has been performed. A separate SMS summary was declined as unnecessary duplication; the information gaps remain.

## 7. 成员按结果核对

这是开发后的观察清单，当前各项均**未执行**。记录实际结果和证据，不把下表勾选为已经通过。

| 操作 | 应观察到的结果 |
|---|---|
| 输入并首次更正，再重新分析 | 当前金额仍为 AUD 200；2000 可在原文／更正历史或新冲突候选中出现，但不能替换当前值；不显示已确认损失 |
| 第一轮只回答 Q1 后刷新 | 仍为 1 轮、3 问；Q1 已回答，Q2/Q3 待回答；金额更正和角色均保留 |
| 回答剩余问题并主动结束 | 未知项保留，无第 2 轮，不重复追问 Q2/Q3；最终审核可核对新增变化 |
| 以当前未审核 EX-G 指引尝试生成建议 | 显示无有效指引提示；不生成 REC-01–03 或接收方稿，可继续事实／分类／补问，并最终审核事实摘要后本地复制和导出 |
| 主动结束后又主动补充 Q3 的答案 | 更新原 Q3 和 E08 / TX-01，保留原未知历史；仍为 1 轮、3 问，不恢复补问；相关输出需重新审核 |
| 新金额更正保存后，旧分析请求晚返回 | 当前金额、更正、计数与审核状态均不被旧结果覆盖；旧结果标为过期 |
| 在获审核的指引前提下拒绝 REC-03 | 保留拒绝原因和 REC-01/02 的接受选择；电信初稿移除另备摘要步骤并待核对，银行稿不因该步骤变化而失效；若原电信稿已最终审核，则其审核失效 |
| 审核两份最新草稿，分别预览、复制、下载 Markdown/PDF | 每份均包含相同版本与共享摘要；金额、未知项、接收方内容一致；PDF 无截断或缺字 |
| 最终审核后把金额更正为 AUD 250 | 银行与电信草稿均引用金额，均标为需重新审核；不能把旧 AUD 200 导出成最新已审核记录 |
| 最终审核后切换员工角色 | 重算权限相关建议与草稿，受影响审核失效；补问计数仍为 1 轮、3 问 |
| 最新状态保存成功后刷新 | 恢复同一案件的事实、来源、更正、角色、问答、拒绝记录和审核有效性；不自动新增审核或交接完成状态 |

两格式实际导出时应使用具体整数版本替换正文占位；文件名包含案件编号、接收方和该版本。完成团队审核后，再依据共享结构将本案例转换为 [cases](../../../data/evaluation/cases/README.md) 和独立核对的 [expected](../../../data/evaluation/expected/README.md)，不把生成结果直接当标准答案。
