# ScamSafe Alliance — Final Course Prototype

This repository contains the final INFS5706 team-project course prototype on branch `refactor/full-rebuild`. It supports authorised frontline employees in fictional bank and telecommunications organisations: case intake, structured facts, clarification, guidance, and editable case materials. Human employees review the results and decide what to do.

## Included API key and expiry

The local project retains its `.env` model configuration. The separate assessment ZIP intentionally includes this file at the project owner's request. Credentials are excluded from GitHub; a fresh clone must supply its own `.env` or configure a key through the application. **The supplied API key will expire at the end of November 2026 (30 November 2026). If you need to use the prototype after that, you must configure your own API key.** The exact provider-side cut-off time has not been specified. Availability before expiry also depends on the provider, network and remaining quota.

To use your own key, edit `MODEL_API_KEY` in `.env`. Set `MODEL_BASE_URL` and `MODEL_NAME` to values supported by your provider and keep `MODEL_MODE=live`. Restart the service after editing `.env`. Alternatively, use the application's model settings described below. The expiry date is supplied by the project owner; it is not an independently checked provider guarantee.

## Requirements and installation

Use Node.js **24.x**, npm, and a current desktop Chrome or Edge browser. Internet access is required to install dependencies and call the model provider. Open a terminal in the project directory, where `package.json` is located. If using an assessment ZIP, extract it completely first.

Windows PowerShell:

```powershell
node --version
npm.cmd ci
npm.cmd run dev
```

macOS or Linux:

```sh
node --version
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/?view=course** for the submitted course prototype. Keep the terminal open; press Ctrl+C to stop. The root URL opens the older integrated interface, which also provides model configuration.

For a local build, stop the development service and run:

```sh
npm run build
npm start
```

Then open **http://127.0.0.1:4310/?view=course**. On Windows use `npm.cmd` instead of `npm`. Run every command from the project root. `npm start` still needs the source files and installed dependencies; `dist` alone is not a standalone application.

## Model settings

A local `.env`, when present, supplies the startup defaults. If settings need changing through the interface, open the root URL, click **Configure model API**, select **Real API — use my provider**, enter the OpenAI-compatible base URL, exact model name and API key, and click **Save API settings**. Do not append `/chat/completions` to the base URL. Authentication normally uses `Authorization` with the `Bearer` prefix; other supported headers are `api-key` and `x-api-key`.

Saved settings take effect on the next request without restarting and are stored locally in `local/model-settings.json`. They override `.env`, including a previously saved Mock setting. Saving settings does not test the connection. The course page requires a live model; Mock mode intentionally produces `COURSE_LIVE_REQUIRED` rather than demonstrating AI. API requests send the current fictional case to the configured provider and may consume quota. The supplied key is not printed in this documentation.

## Quick demonstration

1. Open the course URL and select **Bank employee** or **Telecom employee**.
2. Choose a fictional case under **Explore a fictional case**, click **Load example**, then **Analyze case**. Loading an example only fills the input.
3. Review grouped facts, suspected types, unknowns and remaining gaps. Answer questions in the conversation. For multiple answers, use `1: ...; 2: ...; 3: ...` after checking the displayed question list. You may also choose **Don't know**, **Skip question** or **End questions**.
4. Ask about the current case, supply additional information, or explicitly correct a fact. Check the updated facts and guidance in the left tabs.
5. Click **Generate materials**. Review and edit **Case summary**, **For the person**, and any applicable **Handover draft**. Check the recipient and supporting facts carefully; a known routing defect remains documented below.
6. Click **Confirm materials**, then **Copy** or **Download Markdown** for the required document. No material is sent to an institution.

**Do not refresh the course page during a demonstration.** Its single case is held in browser memory and will be lost on refresh. **New case** clears the case after confirmation when content exists.

## Team Responsibilities and GitHub Collaboration

The prototype was divided into six core areas of responsibility. GitHub served as the shared repository for source code, project specifications, task tracking and module integration.

| Role | Core responsibilities |
|---|---|
| **A — Architecture and integration** | Establish the project structure, shared data contracts, case state machine and review rules; coordinate module interfaces and integrate the modules into an end-to-end workflow. |
| **B — Workbench interface and interaction** | Build the two-panel workbench, role selector, case input panel, fact-review flow, clarification interactions and review controls. |
| **C — Model integration and case understanding** | Develop the model adapter, refine the prompts, and implement fact extraction, suspected scam classification, dynamic clarification generation and model-error handling. |
| **D — Guidance and institutional response pathways** | Define role permissions and the response-guideline library; implement guideline matching, recommendations for coordination across organisations and structured handovers. |
| **E — Local records and exports** | Implement local persistent storage and state recovery, case history, live previews and copying of reviewed outputs, and Markdown/PDF export. |
| **F — Evaluation and verification** | Develop synthetic test cases and expected results; write automated checks and independently verify complete workflows, boundary behaviour and environment setup. |

A–F are responsibility labels. Each member independently developed and tested their assigned module. Code review followed the pairings A–F, B–E and C–D. Changes to shared interfaces were jointly reviewed and approved by the owners of the affected modules.

### GitHub Workflow and Implementation

- **Issue-driven development:** Features were broken down into GitHub Issues and tracked throughout development, with defined owners, module dependencies and acceptance criteria (Definition of Done).
- **Task branches and pull requests:** Development used short-lived feature branches, such as `feat/task-007-workspace`. Contributions were submitted through pull requests describing the scope of changes, verification results and known limitations, then merged into the main branch after approval by the paired reviewer.
- **Interface consistency:** Role A coordinated shared data structures, external dependencies and core APIs to keep the modules aligned with the agreed data contracts. Interface changes were accompanied by updated documentation and handover notes to support integration.

### Build and Integration Sequence

1. **Establish the foundation:** Set up the common project structure, shared data contracts and standard test inputs.
2. **Develop modules in parallel:** Interface and interaction (B), model integration and case understanding (C), guidance (D), and persistence and export (E) were developed against the agreed interfaces. Clearly labelled mock data supported independent module development and testing before integration with upstream and downstream dependencies.
3. **Integrate and verify:** Role A assembled the modules into an end-to-end prototype. Role F independently performed black-box regression and boundary checks on the integrated system. Defects were returned to the responsible contributors for correction and retesting.

## Construction and file map

| Path | Purpose |
|---|---|
| `app/src/course/` | Course workbench interface and styles |
| `app/src/`, `shared/` | Application entry, retained supporting interfaces, state schemas and deterministic case rules |
| `server/src/course-turn.ts` | Model request, prompt loading, structured JSON validation and case update |
| `server/prompts/course-turn.txt` | Actual English system prompt used by the course flow |
| `server/src/` and `server/prompts/intake.txt` | Local Express API, configuration, settings and retained intake adapter |
| `data/course/` | Fictional examples, role descriptions and demonstration guidelines |
| Other `data/` directories | Synthetic fixtures and baseline data needed by retained code and checks |
| `tests/`, `scripts/maintenance/*.ts` | Automated checks and supporting generators |
| `.env`, package and build configuration | Included model defaults, pinned dependency lock and run/build setup |
| `docs/architecture/COURSE_WORKBENCH_GUIDE.md` | Current course operating guide |
| `docs/project/COURSE_KNOWN_ISSUES.md` | Current known-issue record and limits |
| `references/assignment/Assessment_Guide.md` | Existing English edited assessment excerpt, not the complete official guide |
| `docs/project/STATUS.md` | Current branch status, verification and archive locations |

The model receives the current case, fictional guidelines, latest employee message and recent conversation. It proposes structured JSON. The server validates that structure and deterministic functions in `shared/course-case.ts` apply updates, clarification progress and material states. Generated guidance is decision support; confirmation is a human review step, not proof that an external action occurred.

## Checks and limitations

```sh
npm run build
npx tsx --test tests/course-case.test.ts tests/course-turn.test.ts
```

For the optional course browser check, first run `npm run browser:install`, build the interface, then run `npx tsx tests/course-browser.ts`. This uses an injected fake model and does not establish live-model quality or human acceptance. The retained older interface has optional PDF features requiring Playwright Chromium; the submitted course flow uses Markdown and does not require Chromium for ordinary use.

See `docs/project/STATUS.md` for the checks performed on the final project. The cleanup checks do not call the live provider. Do not interpret a successful build or synthetic test as complete product acceptance.

**Known open issue F01-001:** a telecom case involving only nuisance calls can be routed to a bank handover when otherwise valid handover fields are supplied. Employees must reject an unsupported recipient and use human judgement. F01-002 (missing handover basis) and F01-003 (reopening ended questions) have local fixes included in this export. See `docs/project/COURSE_KNOWN_ISSUES.md`.

This is a fictional teaching prototype. It has no real bank/telecom integration, automatic referral, authentication, multi-user support, persistent course-case history or production deployment. Chinese-input quality and full dual-role live-model acceptance remain unverified.

## Submission and archived development history

The available assessment excerpt requests a working link or an export of code, prompts, instructions, configurations and materials needed to understand construction. The separately prepared assessment ZIP supplies the code-export component. The PowerPoint presentation and demonstration video must be submitted separately.

The separately prepared assessment package is in `../submission-prep/2026-11-12/`. It is independent of this repository cleanup and has not been regenerated. Its approved English README remains in that submission folder.

Historical development branches are retained on GitHub. The final version is `refactor/full-rebuild`. Shared source modules and synthetic baseline data remain because retained application routes and checks depend on them. Local working-copy consolidation is recorded in `docs/project/STATUS.md`.

Archive branches:

- `archive/full-rebuild-before-cleanup-20261112`: complete project snapshot before cleanup, including original Chinese documents and historical evidence.
- `archive/development-assets-20261112`: video-production inputs, maintenance drafts and synthetic test probes; reinstallable speech-tool dependencies are excluded.
- `archive/workbench-before-rollback-20261106`: tracked historical stash state.
- `archive/workbench-untracked-20261106`: companion untracked files from that stash.
- `codex/d01-integration-review`: saved November 4 review files and evidence.
- Other original development branches remain on GitHub under their existing names.

Historical documents, evidence and interface mock-ups remain for reference and do not define the current course-page feature set. Current product requirements, the course guide, known issues, the implementation plan and F01 results are indexed in `docs/README.md`. No real institution is contacted by the prototype.
