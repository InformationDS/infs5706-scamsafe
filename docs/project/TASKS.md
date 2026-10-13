# Task registry and handoff

Before GitHub setup this file is a temporary task index. Once Issues exist, link each task to its Issue; Issue ownership and status become authoritative. This file is not a lock and cannot prevent two people working in separate clones from taking the same task.

| Task | Deliverable | Current state | Owner | Depends on |
|---|---|---|---|---|
| TASK-001 | Collaboration rules, reading entry and initial progress snapshot | Done: documentation prepared | Current session | Existing requirements |
| TASK-002 | Consolidated formal PRD, decision summary and architecture outline | Done: specifications and architecture notes prepared | Current session | Accepted product decisions |
| TASK-003 | Proposed directory layout, link migration and reference index | Done: local layout reorganized and checked | Current session | TASK-002, authorized reorganization |
| TASK-004 | GitHub repository and collaboration templates/setup | Public repository and initial push complete; member access/Issues pending | Current session | TASK-003, owner InformationDS |
| TASK-005 | Shared data contracts and configured roles/permissions | Not started | Unassigned | TASK-002 |
| TASK-006 | Reviewed synthetic guidelines and 15 evaluation cases | Not started | Unassigned | TASK-005 |
| TASK-007 | Dual-area workflow interface | Not started | Unassigned | TASK-005, implementation choice |
| TASK-008 | Model integration, extraction/classification/follow-up/recommendations | Not started | Unassigned | TASK-005, TASK-006, model access |
| TASK-009 | Version-aware reviews, history and Markdown/PDF export | Not started | Unassigned | TASK-005, TASK-007 |
| TASK-010 | Integrated verification and prototype handoff | Not started | Unassigned | TASK-006 through TASK-009 |

## Starting a task

- Identify the task and read its dependencies and applicable requirements.
- Confirm ownership through the human/team's agreed coordination channel before overlapping another member's scope.
- Once GitHub exists, use a task branch and link the Issue in the PR. Shared schema changes need clear review and downstream impact notes.
- If ownership, dependencies or contracts are inconsistent, record the discrepancy and resolve it with the responsible member/human before dependent edits.

## Handoff format

```text
Task / Issue:
Owner and branch:
Changed files:
Behavior or requirement changed:
Validation actually performed and results:
Mocks vs real dependencies:
Remaining issues / dependencies:
Next step:
Relevant commit / PR / evidence:
```

## TASK-001 handoff (2026-10-12, historical)

- Scope: removed member-AI usage restrictions from the authored PRD introduction; established repository reading, modification and update conventions.
- Files: AGENTS.md, AI_START_HERE.md, PROJECT_STATUS.md, TASKS.md and the existing PRD working draft.
- Validation: local document references and current-state claims are checked during this document task. No application behavior was tested.
- Directory layout, GitHub and runtime work: not executed.

## TASK-002 / TASK-003 handoff (2026-10-13)

- Scope: consolidated the formal PRD, architecture/contract notes, project decision log and team responsibilities; migrated 73 existing files into the agreed layout.
- Files: root entry/rules, docs/, references/, scripts/, evidence/, module/data/test directory notes and .github templates.
- Preservation: all moved files matched SHA256 at move time; original PDFs, PNGs and HTML are checked for continued byte preservation. Links and relocated tool paths were repaired.
- Validation: `python scripts/maintenance/check_repository.py`; detailed output saved in evidence/reference-conversion/repository_check.json after the final check.
- Handoff: GitHub is not created; no application code, machine-readable schemas, reviewed guidelines, complete cases or application tests exist yet. Model/hosting constraints and team ownership remain pending.

## 后续资料清理交接（2026-10-13）

- 用户明确要求的 8 个文件已删除；删除清单记录路径及哈希，不存储文件内容。
- 作业指南已标为编辑参考版本；索引、引用、工具入口和校验脚本已更新。
- 此为资料维护，不涉及应用实现或既有产品业务权限的改动。
- 验证结果见 evidence/reference-conversion/repository_check.json。

## TASK-004 初始发布交接（2026-10-13）

- 创建公开仓库并成功推送 main，地址：https://github.com/InformationDS/infs5706-scamsafe。
- 100 个跟踪文件包含规格、资料、说明和模板；本地临时目录未上传。
- 已检查上传清单、常见密钥模式、文档链接、资料哈希与 diff 格式；无应用验收结果。
- 成员邀请及任务 Issue 仍待配置；有对应 Issue 前，本任务索引继续作为临时入口。
