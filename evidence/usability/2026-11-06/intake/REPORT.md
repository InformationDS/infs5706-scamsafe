# Intake usability and F01-001 implementation checks

Base SHA is 5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d on integration/test-fixes. Existing F01 evidence is retained.

## Root cause and change

answerRuntimeQuestion changed the current target fact but retained the original analysis.gaps array. The Mock proposal had derived Unresolved E09:TX-01 from the initial missing status. Output generation correctly consumed that stored analysis, exposing an inconsistent current snapshot.

Fact updates now reconcile explicitly fact-derived gaps from current values and missing, unclear or conflict status. Meaningful gap changes increase analysis.version, preserving normal dependency invalidation. Proposal merge uses the same reconciliation. reconcileAnalysisGaps is available for opening older saved cases. It retains unrelated free-text uncertainty, unknown record references, sources, original narrative, facts, question history and review history.

## Actual automated checks

- node_modules/.bin/tsx.cmd --test tests/intake.test.ts passed 9/9 with no skips. Log is unit-tests.txt.
- npm.cmd run build passed after shared employee metadata integration on 2026-11-06.
- Two targeted regressions cover answered transaction status, partial missing facts, source/history retention, refresh-style serialization and legacy saved gaps.

## UI scope

The intake component remains mounted. Hidden sections show description in stage 1, candidate types and fact checks in stage 2, and follow-up in stage 3. Business field and record names are primary. References, versions, source text and prior values remain expandable. Integrated save uses the host entry. Follow-up can be ended after first check even with no pending questions.

These are implementation and automated results. Independent computer-use, exported Markdown/PDF inspection and whole-workflow verification are owned by the main integration pass.

## Adapted browser regression

The existing B01_BROWSER check now follows the current standalone intake and integrated /?test=1 entry points. All original preservation, failure/retry, counting and concurrent-save assertions remain. Integrated actions confirm the shared identifier, traverse all five stages and confirm updated facts before material preparation. New assertions check resolved E09 gaps before and after refresh.

Final actual command used B01_BROWSER=1, B01_EVIDENCE_DIR=evidence/task-results/B01/usability-20261106/run-08/browser and PLAYWRIGHT_BROWSERS_PATH=C:\Users\InformationDS\AppData\Local\ms-playwright with tsx --test --test-force-exit tests/intake.test.ts. Result is 10/10, zero skipped, browser errors zero, providerRequests zero. Screenshots and result.json are in the run-08 browser directory. Command output is browser-run-08.txt here.

Earlier runs remain. Run-02 recorded the sandbox browser-cache path mismatch. Run-03 recorded restricted loopback access. Run-04 and run-06 recorded test-control visibility assumptions, and run-07 recorded an insufficient test wait for the asynchronous save completion. Run-05 passed the original dual-entry assertions before the final additional five-stage traversal. The final run uses the existing browser installation and approved local access. No desktop browser state was used or modified by these automated checks.
