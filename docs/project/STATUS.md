# Current final-project status

Updated: 12 November 2026 (Sydney). Active branch: `refactor/full-rebuild`. This replaces the older integration/test-fixes status summary; earlier records remain in Git history and the archive branches below.

## Current application

Run `npm ci`, then `npm run dev`, and open `http://127.0.0.1:5173/?view=course`. For a built local run, use `npm run build`, `npm start`, and `http://127.0.0.1:4310/?view=course`. The root URL retains the older integrated interface and model settings.

The course page supports bank and telecom roles, live-model case analysis, grouped editable facts, clarification, guidance and reviewed Markdown materials. It keeps one case in memory; refresh recovery, course-page history, PDF export, real institutional actions and production deployment are outside its current scope. Older routes retain storage and PDF components; their presence does not add those capabilities to the course page.

Local `.env` configuration is retained and excluded from GitHub. Fresh clones can use `.env.example` or the application settings to configure their own provider. The key supplied separately for assessment expires at the end of November 2026, as stated by the project owner; provider-side expiry was not independently verified.

## Known limitations and checks

- F01-001 remains open: generic telecom nuisance-call facts can select an unsupported bank handover recipient when otherwise valid handover fields exist.
- F01-002 and F01-003 have committed fixes and regression tests on this branch.
- Cleanup verification: all 53 tests in `tests/course-case.test.ts` passed; `npm run build` passed; the repository document/source-preservation check passed with 184 Markdown documents and 471 local links before the status refresh.
- Earlier verification of the same application source in the assessment copy passed 60 course case/turn tests with a local fake provider. Those results do not constitute live-model or human acceptance.
- The cleanup does not call the supplied live provider. Complete Chinese-input, dual-role live-model and formal human acceptance remain unverified.

## Preservation and local organisation

The final project stays at `GroupAssignment-integration`. Historical branches are saved on GitHub under their original names. The November 4 review files were committed to `codex/d01-integration-review`, and the ahead documentation commit was pushed to `docs/team-execution-rules`.

| Preservation branch | Contents |
|---|---|
| `archive/full-rebuild-before-cleanup-20261112` | Complete pre-cleanup snapshot, including original Chinese documents and evidence. |
| `archive/development-assets-20261112` | 263 source/material files: raw video, production scripts, audio/subtitle assets, documentation scripts and synthetic test probes/logs. Reinstallable speech-tool dependencies are excluded. |
| `archive/workbench-before-rollback-20261106` | Tracked state from the historical rollback stash. |
| `archive/workbench-untracked-20261106` | Companion untracked files from that stash. |

Local consolidation retains only the final branch checkout and removes the old main/review working copies after remote preservation is confirmed. Disposable items include reinstallable dependency caches, generated temporary business-check copies and remotely archived production scratch files. The final `.env` and installed application dependencies are retained for local use.

Historical specifications, evidence and mock-ups remain as references, rather than current product scope or a task queue. This avoids discarding potentially relevant records. `docs/README.md` identifies current documentation. Course folders, the individual assignment, separate presentation materials and the existing assessment package are outside the cleanup scope.

The separate assessment ZIP, checksum and manifest have not been regenerated. Its README was revised separately, so its existing manifest is not a current checksum of that edited folder.
