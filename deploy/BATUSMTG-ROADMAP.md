# BATUSMTG — Stability gate and development plan

This document tracks the path to a single product supporting manual Commander, automated Forge Commander, and solo AI. Do not treat documentation as evidence that tests pass on the current commit.

## Principles
- Forge owns all rules, payments, triggers, combat, and state changes in automated games.
- Casual remains an explicitly manual/assisted table.
- Share deck records, card presentation, authentication and lobby primitives without conflating the two engines.
- Never publish private cards or choices to other seats.
- No direct changes to the working branch without review.

## Phase 0: establish a reproducible baseline (P0)
- [ ] Record the current branch SHA, Node/pnpm/Java versions and Forge 2.0.15 runtime hashes.
- [x] Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`: GitHub Actions, 2026-11-05, 303 tests and build passed on `71289e80cf51371a0d86b7a35519d875de49ebf1` (see report below).
- [ ] Configure the pinned external Forge runtime and compile all eight bridge Java sources together.
- [ ] Run `node scripts/check-forge-runtime.mjs` and the documented Forge commander, decision, combat, cost, payment, AI and rule-effect suites.
- [ ] Record commands, pass/fail, environment and reproducible failure traces in a dated report.
- [ ] Verify client privacy, duplicate actions, reload, reconnect and payment cancellation.
- [ ] Run ten full matches across multiple prepared decks; distinguish completed matches from short scenario tests.

**Exit criterion:** baseline report and ten complete matches without unexplained adapter failures. A test not executed is marked NOT RUN, never PASS.

## Phase 1: controller and mechanics coverage (P0)
- Inventory every inherited Forge AI callback in the human controller.
- Add explicit human choices, validation and privacy tests for unsupported callbacks.
- Cover X costs, alternate costs, alternate casting zones, modal faces, replacements and unusual combat incrementally.
- Every mechanic needs a native test, two-client test where applicable, and failure-path test.

**Exit criterion:** published supported-mechanics matrix with reproducible regression coverage.

## Phase 2: shared UX and decks (P1)
- Unify deck import/export and Commander validation across both modes.
- Keep game-specific legal actions behind separate engine adapters.
- Show explicit Casual / Forge / Solo choices and consistent pending-decision UI.

## Phase 3: solo AI quality (P1)
- Test varied real deck archetypes in full matches.
- Log AI action selection and invalid/rejected moves.
- Calibrate difficulty using reproducible match outcomes, not arbitrary labels.

## Phase 4: four-seat Forge (P1, high risk)
- Generalize seat projections, targeting, priority, APNAP, multiplayer combat and eliminations.
- Test four humans and mixed human/AI pods.
- Validate hidden information and reconnect for each seat.

## Phase 5: persistence and release (P2)
- Design Forge state recovery or verified replay before promising resumable games.
- Test installer, deployment, backups, runtime updates and licenses.

## Current documented limitations (verify on active commit)
- Forge mode supports two seats and loses active games on server restart.
- Four-seat multiplayer is currently a separate Casual engine.
- Some human-controller callbacks and cost/casting families are not fully validated.
- The external Forge runtime is not bundled with the normal Docker image.

## Verified progress · 2026-11-05
- PR #27 merged: process and stream failure handling; 291 tests and production build passed on GitHub.
- Snapshot ordering/lifecycle follow-up: five races reproduced before the fix; 12 room integration tests added; 303 tests and build passed on the implementation commit.
- Evidence, exact commits, limitations and next steps: [snapshot/lifecycle report](FORGE-SNAPSHOT-ORDERING-2026-11-05.md), [process report](FORGE-PROCESS-STABILITY-2026-11-05.md).
- Native Java/Forge scenarios, browser runs and ten complete matches remain NOT RUN in this environment. Phase 0 is not complete.

## Next implementation ticket
**P0-01: baseline verification and failure inventory.** Run the checks above, capture concrete failures, then fix the highest-severity reproducible failure on a dedicated branch. Avoid speculative engine rewrites.

References: `forge-bridge/README.md`, `deploy/FORGE-RULES-2026-10-16.md`, `deploy/FORGE-P0-TRANSACTIONS-2026-10-16.md`, `shared/forge-runtime-lock.ts`.
