# Guidance usability implementation

Base SHA `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`, branch `integration/test-fixes`. Changes remain uncommitted.

## Scope

- `app/src/modules/guidance/index.tsx` uses the shared employee identifier in the integrated workflow. Organisation and role confirmation belongs to the host.
- Suggestions use business titles and readable fact names. Sources, boundaries and previous decisions remain available on demand. Inactive suggestions retain their records and appear in a separate history section.
- Accept, modify and reject continue to use the existing decision function. Required reasons and actor validation, rejection preservation, edit history and dependency invalidation retain their existing behavior.
- Recalculate, suspend, reload and JSON controls remain available in test mode and the independent guidance entry.
- `app/src/modules/guidance/style.css` removes nested scrolling from technical text.

## Actual automated checks

`node_modules/.bin/tsx.cmd --test tests/guidance.test.ts` passed 19/19. See `check.txt`.

`npm.cmd run build` passed TypeScript and Vite at this integration point. See `build.txt`. Other agents continued changing the shared working tree afterward, so the final integrated build must be recorded separately.

## Remaining verification

This module report contains no computer-use result. The main agent owns integrated workflow verification and independent retesting. No real-model request, commit, push, merge or deployment was performed by this sub-agent.
