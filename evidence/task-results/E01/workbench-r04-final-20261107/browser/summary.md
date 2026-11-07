# Unified factual summary

SYNTHETIC · Content approval pending · Local draft only. Reported information is not independently verified. No action, delivery or referral has been performed.

Case: EXAMPLE-01 | case version: 11
Object: SUMMARY | object version: 1
Employee reviewed synthetic record · E01-AUTOMATED-TEST · 2026-11-06T23:59:42.199Z
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
- REC-02 v2 [accepted]: Prepare a local SYN Telco B human intake draft.
  Basis: EX-G02 v1; SYN Bank A / Intake Officer; priority 2: Prepare in parallel with REC-01.
  Limit / uncertainty: Approved synthetic prototype guidance only; no authority for real-world action.
  Limit / uncertainty: Also requires S4 to explicitly identify SYN Telco B as the person's mobile provider and configured human intake responsibilities; this limited draft is not a runtime matcher.
  Limit / uncertainty: Unknown sharing permission permits local drafting only; no sharing or verification asserted.
  Limit / uncertainty: Do not infer SIM swapping or change a mobile service.
  Limit / uncertainty: External sharing would require human verification of permission and receiver remit; no sending occurs.
  Limit / uncertainty: The receiving human intake team verifies whether the concern falls within its remit; sharing permission remains unverified.
  Limit / uncertainty: C08:CONTACT-01: unknown; preserve this gap.
  Limit / uncertainty: O07:: unknown; preserve this gap.
  Limit / uncertainty: Reported source S1: I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
  Limit / uncertainty: Reported source S4: I use SYN Telco B for my mobile service, and I have not contacted either organisation about this yet.
- REC-03 v2 [accepted]: Optionally prepare a separate summary of existing SMS clues for human assessment.
  Basis: EX-G03 v1; SYN Bank A / Intake Officer; priority 3: Optional, lower priority.
  Limit / uncertainty: Approved synthetic prototype guidance only; no authority for real-world action.
  Limit / uncertainty: Also requires existing SMS clues and source references; this limited draft is not a runtime matcher.
  Limit / uncertainty: The employee may decline duplicate preparation; rejection retains facts and gaps.
  Limit / uncertainty: Do not request new materials or claim the SMS is verified.
  Limit / uncertainty: Existing SMS clues and sources only; may be declined as duplicate.
  Limit / uncertainty: Human staff decide whether a separate existing-clue summary is useful; no new materials are required.
  Limit / uncertainty: Reported source S1: I received a text message at 09:00 on 16 October 2026 claiming to be SYN Bank A and saying that my account needed verification.
  Limit / uncertainty: Reported source S5: I have the text message on my phone, but I have not provided any material to the employee.

