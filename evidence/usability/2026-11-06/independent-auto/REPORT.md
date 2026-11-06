# Independent automated usability regression

The starting branch is `integration/test-fixes` at `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`. Tests run against uncommitted integrated changes. Existing F01 evidence remains separate.

## Final result

`tests/usability-browser.ts` passed nine workflow groups in `run-08/result.json`, using isolated Chromium 156.0.8078.4 contexts and a local Mock server. Page errors and external provider requests were both zero.

Normal five-stage UI coverage includes the following.

- Identity confirmation gates progression. T09 analysis, amount correction to 200, first check, Q1 `reported pending`, Q2 unknown and stopped follow-up retain one round and three questions. Current analysis no longer lists E09 as unresolved.
- One review acknowledgement records six effective object reviews with the shared employee identifier. Clipboard and downloaded Markdown equal the selected reviewed snapshot. Summary and Chinese-edited bank PDFs download.
- Unrecorded employee body changes block saving and navigation. A recorded bank edit preserves the unrelated telecommunications review.
- Rejecting the message-evidence suggestion removes its action from refreshed telecommunications materials. Changing the amount to 250 requires renewed confirmation and review. Employee wording remains until explicit comparison and replacement, and replacement history retains that text.
- Saving and refreshing preserves employee identifier, answers, decisions, text and valid reviews. Creating a new case resets identity confirmation.

Diagnostic coverage is recorded separately within the same test result.

- An isolated saved fixture with final reviews removed verifies bank-only selection reviews only the bank document and its referenced recommendation.
- An isolated legacy fixture with the original stale E09 gap and suspended guidance verifies reconciliation on restore, unsaved migration status, preserved sources/questions, and summary-only review/export without recommendation review.
- A corrected fixed input is generated, reviewed and saved before refresh. Refresh retains the reconciled analysis version and effective summary review.

PDF download is an automated assertion here. This report does not claim visual PDF inspection or computer-use operation. Those results belong to the main agent's separate evidence.

## Preserved attempts

| Batch | Actual result |
| --- | --- |
| run-01 | Playwright sandbox cache lacked the installed Chromium executable. No product navigation occurred. Retest used the existing user cache through `PLAYWRIGHT_BROWSERS_PATH`. |
| run-02 | Loopback browser navigation was blocked by the sandbox. No product assertion occurred. Retests used approved loopback execution. |
| run-03 | Two workflow groups passed. An immediate disabled-button read preceded React effect propagation. The failure screenshot already shows the protected edit state. The script now waits for that state. |
| run-04 | Five workflow groups passed. |
| run-05 | Seven groups passed. The new-case locator used the wrong button name. |
| run-06 | Eight groups passed. |
| run-07 | Eight groups passed. The added fixed-input test closed an already-open test-control panel. |
| run-08 | Nine groups passed, zero page errors, zero external provider requests. |

## Existing guidance regression

`tests/guidance.test.ts` retains its existing decision, edit, rejection, context-cycle, restoration and no-guidance assertions. Its browser portion now uses the independent guidance entry. Normal integrated coverage is supplied by the new five-stage script. The second reset now explicitly handles the existing unsaved-changes dialog, matching the first reset.

With `D01_BROWSER=1`, the suite passed 20/20. Evidence is `evidence/task-results/D01/usability-20261106/run-02/browser/`. Its first attempt remains in `run-01/browser/`, including the reset-dialog failure.

No desktop browser was operated by this independent tester. No real model, human acceptance, cross-system result, commit, push or deployment is claimed.
