# Fixed development states

These JSON files are mock training fixtures, not enabled business configuration or approved acceptance expectations. All content approvals remain `pending`; roles and guidelines remain disabled. Simulated first/final review records have `simulated:true`, no invented reviewer identity or timestamp, and do not constitute team approval.

Run `npm run fixtures` to regenerate from `shared/fixtures.ts` and the fixed source text. `intake`, `corrected`, `partial`, `stopped`, `no-guidance`, `reviewed`, `stale`, `model-error`, and `save-error` cover the common stage and failure inputs. `handover` is a separate unapproved teaching display of two local drafts; it does not enable guidance or generate valid recommendations. The ordinary no-guidance path never creates handovers.

`reviewed` means simulated content review for exercising preview/export gates; every artifact still carries a training-only marker and pending business approval. `stale` changes the amount to 250 after simulated review. `save-error` preserves page inputs but blocks snapshot creation. `partial` contains one answered and two pending questions in the same saved round. Stopped and handover examples are independent starting points, not one continuous verified application run.

Pure functions in `shared/core.ts` return unsaved state after mutation. The application must persist the complete new state and call `markSaved(..., true)` only after its actual storage transaction succeeds. `addQuestionRound(..., displayedAndSaved)` is a low-level transaction input: the caller must not pass true before successful display and durable persistence, and must retain original question IDs across retries. Fixture constructors set mock stage data directly to provide fixed development inputs; they are not production workflow controllers.

Run `npm run check` for TypeScript and shared boundary checks. Those tests verify program invariants against mock data, not real model quality, content approval, storage/browser behavior or PDF layout.
