# Clickable prototype verification

Scope: local HTML simulation, not model or business acceptance testing.

Observed in the in-app browser:
- Supplier payment case: numbered replies populate 500 AUD and Pending, and all three questions are handled.
- Supplier email guidance uses bank assessment and supplier verification; bank role has no telecom handover draft.
- Generated materials separate clarified information from unresolved items, and omit raw conversation queries.
- Edited material returns to draft; confirmation updates the next action and export availability.
- Direct fact edits preserve employee-written materials, mark Needs update, and disable confirmation/export.
- Cancelling regeneration preserves the edited draft.
- An uncertain amount retains the existing amount and displays a separate uncertainty notice.
- Subsequent direct amount correction also updates the dependent clarification, avoiding an old amount in regenerated materials.
- Failed initial analysis followed by Retry preserves the initial narrative in conversation.
- Unknown plus early end displays 1 unknown / 2 skipped and carries those gaps into materials.

Checks: JavaScript syntax, repository documentation check, git diff whitespace check.
Not revalidated in this pass: clipboard contents, downloaded file contents, telecom role and support-case UI, comprehensive accessibility, real model output.

## Follow-up combination checks

Observed in the in-app browser:
- Payment-case reply `1: 500 AUD paid; 2: Not sure; 3: Pending.` updates amount/currency/status, records only the second answer as Unknown, and reaches 3/3 handled.
- While Question 1 is pending, generating materials then asking the current amount preserves the question and gives its next-step prompt, with an option to review existing materials.
- Support-case summary retains the reported feeling of being overwhelmed. Its affected-person explanation speaks directly to the person and omits unrelated unknown money fields.

Chinese-language handling is excluded from this follow-up scope. These are targeted simulation checks, not full product acceptance.
