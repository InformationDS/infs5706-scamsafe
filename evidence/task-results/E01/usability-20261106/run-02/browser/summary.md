# Unified factual summary

SYNTHETIC CASE · Reported information requires verification. Prepared locally for employee review.

Case: EXAMPLE-01 | case version: 12
Document: Case summary | document version: 1
Employee reviewed synthetic record · E01-AUTOMATED-TEST · 2026-11-06T11:14:05.346Z
Employee review covers this recorded document and its referenced recommendations. External verification and delivery remain unconfirmed.

## Current reported facts
| Information | Current reported value | Status / check | Sources |
| --- | --- | --- | --- |
| Report source | Person concerned | extracted / checked | S1, S2, S3, S4, S5 |
| Contact 1 · Contact time | 16 October 2026 09:00 Australia/Sydney | extracted / checked | S1 |
| Contact 1 · Contact channel | SMS | extracted / checked | S1 |
| Contact 1 · Claimed identity | Claims to be SYN Bank A | extracted / checked | S1 |
| Contact 1 · Reported identifiers | verify-bank.example | extracted / checked | S2 |
| Contact 1 · Continuing contact | Unknown / not supplied | missing / checked | None |
| Event 1 · Reported action and result | Opened the link and entered banking password and one-time code categories; no secret values recorded. | extracted / checked | S2 |
| Payment involvement | Reported debit | extracted / checked | S3 |
| Transaction 1 · Transaction reference | Transaction 1 | extracted / checked | S3 |
| Transaction 1 · Transaction time | Unknown / not supplied | missing / checked | None |
| Transaction 1 · Amount | 200 | extracted / corrected | S3 |
| Transaction 1 · Currency | AUD | extracted / checked | S3 |
| Transaction 1 · Payment method | Unknown / not supplied | missing / checked | None |
| Transaction 1 · Paying institution or channel | SYN Bank A | extracted / checked | S3 |
| Transaction 1 · Recipient | Unknown / not supplied | missing / checked | None |
| Transaction 1 · Transaction status | Unknown / not supplied | missing / checked | None |
| Information provided | true | extracted / checked | S2 |
| Information categories | Banking password; One-time code | extracted / checked | S2 |
| Submission channel | Linked page | extracted / checked | S2 |
| Affected account or service | SYN Bank A online banking | extracted / checked | S2, S3 |
| Account anomalies | Unfamiliar debit | extracted / checked | S3 |
| Anomaly discovery time | 16 October 2026 09:30 Australia/Sydney | extracted / checked | S3 |
| Evidence 1 · Evidence type | Text message | extracted / checked | S5 |
| Evidence 1 · Evidence availability | Reported available on phone; not provided or verified | extracted / checked | S5 |

Amounts are reported values, not verified losses. Transactions remain separate by record, currency and status; unknown values are not zero.

## Candidate analysis (not a confirmed scam finding)
- Suspected phishing
- Basis: Contact 1: reported bank impersonation SMS; Event 1: reported credential entry.
- Uncertainty: Sender identity and the debit's connection to the SMS are unverified.
- Gap: Unresolved Contact 1 · Continuing contact
- Gap: Unresolved Transaction 1 · Transaction time
- Gap: Unresolved Transaction 1 · Payment method
- Gap: Unresolved Transaction 1 · Recipient
- Gap: Unresolved Transaction 1 · Transaction status

## Unresolved information
- Contact 1 · Continuing contact: missing; current Unknown / not supplied
- Transaction 1 · Transaction time: missing; current Unknown / not supplied
- Transaction 1 · Payment method: missing; current Unknown / not supplied
- Transaction 1 · Recipient: missing; current Unknown / not supplied
- Transaction 1 · Transaction status: missing; current Unknown / not supplied

## Reported sources and correction history (historical wording may differ from current values)
- S1 (narrative): I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
- S2 (narrative): I opened the link at verify-bank.example and entered my online banking password and a one-time code.
- S3 (narrative): At 09:30 I noticed an unfamiliar AUD 2,000 debit in my SYN Bank A app; I do not know whether it is pending or completed.
- S4 (narrative): I use SYN Telco B for my mobile service, and I have not contacted either organisation about this yet.
- S5 (narrative): I have the text message on my phone, but I have not provided any material to the employee.
- Transaction 1 · Amount previous 2000: The amount was entered incorrectly. The reported debit is AUD 200, not AUD 2,000. [S3]

## Recorded response boundaries
Reported responses are listed in the current facts when supplied. Unknown response details remain unknown. No external execution or receipt is established by this local record.

## Proposed local preparation (acceptance is not execution)
- Bank assessment request [accepted]: Prepare a local internal human assessment record.
  Basis: EX-Software or access requested v1; SYN Bank A / Intake Officer; priority 1: Prioritise human assessment of the reported pending unfamiliar debit.
  Limit / uncertainty: Approved synthetic prototype guidance only; no authority for real-world action.
  Limit / uncertainty: EXAMPLE-01 teaching target Transaction 1 only.
  Limit / uncertainty: Transaction status conflicts, reported completed and payment requested are outside this teaching entry.
  Limit / uncertainty: The human specialist decides further assessment; no freeze, refund or recovery promised.
  Limit / uncertainty: May be prepared in parallel with Telecommunications assessment request; transaction facts remain reported and unverified.
  Limit / uncertainty: A designated bank human specialist decides further assessment; the intake role performs no account or transaction action.
  Limit / uncertainty: Transaction 1 · Transaction status: unknown; local preparation only.
  Limit / uncertainty: Reported source S3: At 09:30 I noticed an unfamiliar AUD 2,000 debit in my SYN Bank A app; I do not know whether it is pending or completed.
- Telecommunications assessment request [accepted]: Prepare a local SYN Telco B human intake draft.
  Basis: EX-Devices involved v1; SYN Bank A / Intake Officer; priority 2: Prepare in parallel with Bank assessment request.
  Limit / uncertainty: Approved synthetic prototype guidance only; no authority for real-world action.
  Limit / uncertainty: Also requires S4 to explicitly identify SYN Telco B as the person's mobile provider and configured human intake responsibilities; this limited draft is not a runtime matcher.
  Limit / uncertainty: Unknown sharing permission permits local drafting only; no sharing or verification asserted.
  Limit / uncertainty: Do not infer SIM swapping or change a mobile service.
  Limit / uncertainty: External sharing would require human verification of permission and receiver remit; no sending occurs.
  Limit / uncertainty: The receiving human intake team verifies whether the concern falls within its remit; sharing permission remains unverified.
  Limit / uncertainty: Contact 1 · Continuing contact: unknown; preserve this gap.
  Limit / uncertainty: O07:: unknown; preserve this gap.
  Limit / uncertainty: Reported source S1: I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
  Limit / uncertainty: Reported source S4: I use SYN Telco B for my mobile service, and I have not contacted either organisation about this yet.
- Message evidence note [accepted]: Optionally prepare a separate summary of existing SMS clues for human assessment.
  Basis: EX-Software or tool v1; SYN Bank A / Intake Officer; priority 3: Optional, lower priority.
  Limit / uncertainty: Approved synthetic prototype guidance only; no authority for real-world action.
  Limit / uncertainty: Also requires existing SMS clues and source references; this limited draft is not a runtime matcher.
  Limit / uncertainty: The employee may decline duplicate preparation; rejection retains facts and gaps.
  Limit / uncertainty: Do not request new materials or claim the SMS is verified.
  Limit / uncertainty: Existing SMS clues and sources only; may be declined as duplicate.
  Limit / uncertainty: Human staff decide whether a separate existing-clue summary is useful; no new materials are required.
  Limit / uncertainty: Reported source S1: I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
  Limit / uncertainty: Reported source S5: I have the text message on my phone, but I have not provided any material to the employee.

