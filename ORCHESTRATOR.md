# Orchestrator

The coordination board for the two Claude sessions working on Shiori while the author is away:

- **cloud:** "Next-gen visual novel engine continuation". It is finishing the round-4 engine work, then stops.
- **mac:** "Next-gen visual novel engine", on the author's Mac. It takes over everything else now, and the engine once the cloud session hands it over.

This file is the only channel between them. Cross-session messages can sit unread, so don't rely on them.

## Rules

1. **Pull before every step:** `git pull --no-rebase origin claude/dazzling-meitner-uz8dhg`. Then re-read **Signals** and **Ownership**.
2. **Stay in your lane:** edit only files your session owns, and in this file only your own section. Each session may also edit its own lines under Signals.
3. **Commit and push after every step.** If the push is rejected, pull and push again. Never force-push or rewrite pushed history.
4. **Log your progress:** one line per step in your own section. Keep it short: time (UTC), what changed, the commit.
5. **Rules and state:** `AGENTS.md` holds the rules. `HANDOFF.md` describes the project state; the mac session maintains it from now on.

## Signals

- **round4:** `PENDING` (cloud). It changes to `MERGED <commit>` when the six groups are merged, the spec is regenerated, and selftest passes under Node and JavaScriptCore.
- **engine owner:** `cloud`. It becomes `mac` at the same moment.
- **cloud session:** `ACTIVE`. It becomes `DONE` after the hand-over; after that nothing more comes from the cloud.
- **mac session:** `NOT STARTED` (mac updates this line).

## Ownership

| Paths | Owner now | After round4 MERGED |
|---|---|---|
| `engine/`, `tools/cli.js`, `tools/host.js`, `tools/gen-spec.js`, `bin/`, `tests/`, `SHIORI-Spec.md`, `templates/` | cloud | mac |
| `examples/` (art, story, music, source/) | mac | mac |
| `tools/codex-worker.sh`, `tools/codex-tasks/`, `reviews/` | mac | mac |
| `HANDOFF.md`, `AGENTS.md`, `CLAUDE.md`, `README.md` | mac | mac |
| `codex/*` branches | Codex workers push; mac reviews and merges | same |

## Work queue (mac)

Take items from the top. Mark one `[x]` when it's done, and add new items as needed.

- [ ] **Sync.** Sync the Mac folder as described in HANDOFF.md section 1, and remove the stale `wf_ede3a973-067` worktrees and branches.
- [ ] **Art post-processing tooling** (HANDOFF section 4), under `examples/terrible-things/source/`. It covers:
  - alpha clean-up;
  - face and blink overlays cut from expression edits;
  - per-character sizing;
  - backgrounds upscaled to 1920x1080;
  - WebP output.
- [ ] **Stage-1 picks.** Apply them: Nagi `nagi_neutral_a`, Nemu `nemu_sleepy_a`, all five backgrounds (from `codex/art-stage1`; don't merge its `.codex-last-message.md`). Clean the four bases (with Suzu and Hinata from `source/codex/refs/`) into `source/codex/bases/`.
- [ ] **Art stage 2.** Build it (`python3 make_pack.py <dir> stage2`) and run it as a Codex worker:
  - `tools/codex-worker.sh --cmd art-stage2 'cd <pack> && NOZIP=1 sh run.sh stage2' <out path>`;
  - review the result, post-process it and wire it into `game.story` (layered sprites, `noblink:`);
  - check it in the browser and commit.
- [ ] **Story audit.** When `codex/story-audit` lands, review `reviews/story-audit.md`. Fix what holds up; give dialogue and joke rewrites to an Astra worker. Follow `VOICE.md`, which the author accepted as is for now.
- [ ] **After round4 is MERGED:**
  - pull;
  - a Sol worker for a second-model code review of the round-4 merge;
  - a Sol worker for a run under Apple's JavaScriptCore plus a Safari/WebKit check of the player and the showcase;
  - triage what they find.
- [ ] **Waiting on the author** (ask when they're back):
  - stage-1 picks (they may override);
  - the promise ledger feature;
  - the first release;
  - Steam packaging later.

Codex model policy (the author's): **Sol** (gpt-6.1-sol) does background grunt work, such as audits, art runs, code review and testing. **Astra** (gpt-6-astra) writes what players see: dialogue and songs. Pick the reasoning level per task.

## Cloud section (only the cloud session edits this)

- 07:45 Set up this board. Six round-4 groups are still running in cloud workflows (analysis, explore, cli, compiler-expr follow-ups, parser follow-ups, vm-runtime follow-ups). When they finish: merge, regenerate the spec, run selftest under Node and jsc, check every game, push, then flip **round4**, **engine owner** and **cloud session** under Signals.

## Mac section (only the mac session edits this)

- (nothing yet)
