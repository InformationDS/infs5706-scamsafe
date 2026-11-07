# Local draft for SYN Bank A / designated human review team

SYNTHETIC · Content approval pending · Local draft only. Reported information is not independently verified. No action, delivery or referral has been performed.

Case: EXAMPLE-01 | case version: 14
Object: HANDOVER-BANK | object version: 2
Employee reviewed synthetic record · E01-AUTOMATED-TEST · 2026-11-07T00:06:51.769Z
Employee review is not content approval, external verification or delivery.

SYNTHETIC · Content approval pending · Local draft only. Reported information is not independently verified. No action, delivery or referral has been performed.

## Current reported facts
| Field / record | Current reported value | Status / check | Sources |
| --- | --- | --- | --- |
| Report source (B01:) | Person concerned | extracted / checked | S1, S2, S3, S4, S5 |
| Contact time · CONTACT-01 (C02:CONTACT-01) | 16 October 2026 09:00 Australia/Sydney | extracted / checked | S1 |
| Contact channel · CONTACT-01 (C03:CONTACT-01) | SMS | extracted / checked | S1 |
| Claimed identity or organisation · CONTACT-01 (C04:CONTACT-01) | Claims to be SYN Bank A | extracted / checked | S1 |
| Other party identifiers · CONTACT-01 (C06:CONTACT-01) | verify-bank.example | extracted / checked | S2 |
| Continuing contact · CONTACT-01 (C08:CONTACT-01) | Unknown / not supplied | missing / checked | None |
| Action and reported result · EVENT-01 (D04:EVENT-01) | Opened the link and entered banking password and one-time code categories; no secret values recorded. | extracted / checked | S2 |
| Payment reported or requested (E01:) | Reported debit | extracted / checked | S3 |
| Transaction ID · TX-01 (E02:TX-01) | TX-01 | extracted / checked | S3 |
| Transaction time · TX-01 (E03:TX-01) | Unknown / not supplied | missing / checked | None |
| Reported amount · TX-01 (E04:TX-01) | 200 | extracted / corrected | S3 |
| Currency · TX-01 (E05:TX-01) | AUD | extracted / checked | S3 |
| Payment method · TX-01 (E06:TX-01) | Unknown / not supplied | missing / checked | None |
| Paying institution or channel · TX-01 (E07:TX-01) | SYN Bank A | extracted / checked | S3 |
| Recipient or channel · TX-01 (E08:TX-01) | Unknown / not supplied | missing / checked | None |
| Transaction status · TX-01 (E09:TX-01) | Unknown / not supplied | missing / checked | None |
| Information provided or entered (F01:) | Yes | extracted / checked | S2 |
| Information categories (F02:) | Banking password; One-time code | extracted / checked | S2 |
| Submission channel or recipient (F03:) | Linked page | extracted / checked | S2 |
| Affected account or service (F05:) | SYN Bank A online banking | extracted / checked | S2, S3 |
| Observed account anomalies (F06:) | Unfamiliar debit | extracted / checked | S3 |
| Anomaly discovery time (F07:) | 16 October 2026 09:30 Australia/Sydney | extracted / checked | S3 |
| Evidence type · EVID-01 (J02:EVID-01) | Text message | extracted / checked | S5 |
| Evidence availability · EVID-01 (J04:EVID-01) | Reported available on phone; not provided or verified | extracted / checked | S5 |

Amounts are reported values, not verified losses. Transactions remain separate by record, currency and status; unknown values are not zero.

## Candidate analysis (not a confirmed scam finding)
- Suspected phishing
- Basis: CONTACT-01: reported bank impersonation SMS; EVENT-01: reported credential entry.
- Uncertainty: Sender identity and the debit's connection to the SMS are unverified.
- Gap: Transaction time
- Gap: Payment method
- Gap: Recipient
- Gap: Continuing contact

## Unresolved information
- Continuing contact · CONTACT-01 (C08:CONTACT-01): missing; current Unknown / not supplied; candidates []
- Transaction time · TX-01 (E03:TX-01): missing; current Unknown / not supplied; candidates []
- Payment method · TX-01 (E06:TX-01): missing; current Unknown / not supplied; candidates []
- Recipient or channel · TX-01 (E08:TX-01): missing; current Unknown / not supplied; candidates []
- Transaction status · TX-01 (E09:TX-01): missing; current Unknown / not supplied; candidates []

## Reported sources and correction history (historical wording may differ from current values)
- S1 (narrative): I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
- S2 (narrative): I opened the link at verify-bank.example and entered my online banking password and a one-time code.
- S3 (narrative): At 09:30 I noticed an unfamiliar AUD 2,000 debit in my SYN Bank A app; I do not know whether it is pending or completed.
- S4 (narrative): I use SYN Telco B for my mobile service, and I have not contacted either organisation about this yet.
- S5 (narrative): I have the text message on my phone, but I have not provided any material to the employee.
- Reported amount · TX-01 (E04:TX-01) previous 2000: The amount was entered incorrectly. The reported debit is AUD 200, not AUD 2,000. [S3]

## Recorded response boundaries
Reported responses are listed in the current facts when supplied. Unknown response details remain unknown. No external execution or receipt is established by this local record.


## Intended recipient
SYN Bank A / designated human review team
Human verification and assessment of reported unfamiliar debits, credential exposure and transaction information; the prototype only prepares a local draft.
Sharing permission remains unverified unless explicitly recorded. No sending performed.

## Proposed local preparation (acceptance is not execution)
- REC-01 v2 [accepted]: Prepare a local internal human assessment record.
  Basis: EX-G01 v1; SYN Bank A / Intake Officer; priority 1: Prioritise human assessment of the reported pending unfamiliar debit.
  Limit / uncertainty: Approved synthetic prototype guidance only; no authority for real-world action.
  Limit / uncertainty: EXAMPLE-01 teaching target TX-01 only.
  Limit / uncertainty: E09 conflicts, reported completed and payment requested are outside this teaching entry.
  Limit / uncertainty: The human specialist decides further assessment; no freeze, refund or recovery promised.
  Limit / uncertainty: May be prepared in parallel with REC-02; transaction facts remain reported and unverified.
  Limit / uncertainty: A designated bank human specialist decides further assessment; the intake role performs no account or transaction action.
  Limit / uncertainty: E09:TX-01: unknown; local preparation only.
  Limit / uncertainty: Reported source S3: At 09:30 I noticed an unfamiliar AUD 2,000 debit in my SYN Bank A app; I do not know whether it is pending or completed.


## 中文表格与长文本
| 条目 | 合成说明 |
| --- | --- |
| 中文 | 保留未知、来源和员工修改 |
| 长单词 | SyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongTokenSyntheticLongToken |

中文段落 1：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 2：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 3：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 4：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 5：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 6：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 7：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 8：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 9：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 10：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 11：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 12：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 13：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 14：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 15：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文段落 16：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。长文本边界验证，不代表真实案件或审核批准。

中文正文完整性终点 E01-END
