# Project status

Snapshot date: 2026-10-13, Australia/Sydney.

## Completed

- Assignment guide and ACCC Markdown retained. The assignment Markdown is now an edited reference; the UNSW directory and two original PDFs were removed on 2026-10-13 at the user's request. ACCC page images remain.
- ACCC report includes 49 page markers and linked page images.
- Accepted product decisions consolidated in [PRD](../product/PRD.md); discussion draft archived.
- [Field dictionary](../product/FIELD_DICTIONARY.md) defines 117 fields; it is not an implemented schema.
- Actual directory layout, reference index, collaboration rules, AI reading entry, task index, architecture/contract notes and team responsibility placeholders prepared.
- Issue and PR templates prepared locally; no remote GitHub configuration exists.
- Initial migration moved 73 files, with matching hashes at move time; 8 files were subsequently removed by explicit request. Removal paths and edit hashes are recorded in evidence/reference-conversion.

## Not yet implemented / executed

- GitHub repository, collaborator access, Issues, branches, PRs and CI.
- Application, model integration, machine-readable schemas, configured roles and reviewed synthetic guidelines.
- Full data and reviewed expected results for the 15 planned cases; no application tests have run.
- Runtime history/export, deployment and demonstration recording.

## Dependencies needing team input

- Repository owner is verified as InformationDS; members' GitHub usernames remain to be provided.
- Model interface, budget, technical constraints, implementation deadline and delivery environment.
- Task ownership and peer review assignments.

## Latest verification

Directory/Markdown/source checks: run `python scripts/maintenance/check_repository.py` from the root. The latest actual result is recorded in [repository_check.json](../../evidence/reference-conversion/repository_check.json). This check concerns repository materials, not application behavior.

## Active handoff

TASK-002 and TASK-003 complete local specification/layout work. TASK-004 is currently creating and uploading a public repository under InformationDS, explicitly authorized by the user. Member access and Issues remain pending. Detailed scope and validation are in [TASKS.md](TASKS.md).

## Update convention

Keep this file concise and date meaningful updates. Separate planned, implemented and verified states. Once GitHub exists, link Issues/PRs rather than maintaining a second ownership/status board. Preserve other members' updates; label branch-only work explicitly.
