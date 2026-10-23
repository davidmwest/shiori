# Handoff

A living note on where the Shiori work stands, kept current so another agent (Claude or Codex) can pick it up cold. Read `AGENTS.md` first for the rules.

- **Repo:** https://github.com/davidmwest/shiori
- **Branch:** `claude/dazzling-meitner-uz8dhg` (the only branch; all work goes here)
- **Last updated:** 2026-10-23 07:15 UTC, by the Claude cloud session "Next-gen visual novel engine continuation"

## Codex workers and the fallback handoff

Claude leads this work and gives self-contained sub-tasks to Codex workers on the author's Mac (gpt-6.1-sol; the reasoning level is chosen per task). Each worker runs in its own git worktree under `~/Documents/Codex/shiori-workers/<task>` and its results come back to Claude for review before anything is merged.

If Claude has to stop entirely, the author can start Codex in the desktop app with this prompt:

> Continue the Shiori visual-novel project, handed off from Claude. Work in ~/Documents/Codex/shiori: if it doesn't exist, run `git clone https://github.com/davidmwest/shiori ~/Documents/Codex/shiori`; then `git fetch origin && git checkout claude/dazzling-meitner-uz8dhg && git pull`. Read AGENTS.md and HANDOFF.md and follow them. Work through "Next steps" in HANDOFF.md in order. Commit and push to that branch after each step, and keep HANDOFF.md current.

## Where things stand

**Engine.**
- Rounds 1 to 3 of bug fixing are merged.
- Round 4 is partly merged: compiler-expr, parser, and vm-runtime (`noblink:`, the POV name in prose mode). 401 tests pass under Node and JavaScriptCore, and every game has 0 errors.
- Still running in Claude workflows when this was written: six groups (analysis, explore, cli, compiler-expr follow-ups, parser follow-ups, vm-runtime follow-ups). Their open items are in `tests/review/review-fix/round3-open.md` (R1 to R37) and `tests/review/review-fix/round4-finished-reports.md`, but `tests/review/` is gitignored, so those files only exist in the Claude container. If you take over before the workflows land, the summaries under "Round 4 work list" below are what you need.

**Showcase game** (`examples/terrible-things`, "All the Terrible Things We Didn't Think").
- Story, SVG art, music and the 3D glasshouse are done; `check` gives "All clear".
- The art is being redone with Codex image_gen; the author said yes. The pack is in `examples/terrible-things/source/codex/`.
  - Stage 1 (character bases for Nagi, Nemu and Hinata, two takes each, plus 5 backgrounds) was sent to the author to run on the Mac.
  - Stage 2 (other expressions as face-only edits of the chosen bases, blink frames, 2 CGs) comes after the bases are chosen.
- Keep from the earlier Codex test: Suzu `proud` (base) and `soft`, Hinata `grin` (the author prefers it; the buttoned-collar redraws are optional), the bakery background and the hands CG.
- Integration plan:
  - Layered sprites: `layer: chars/<c>/body.webp` plus `layer: chars/<c>/face_{expression}.webp`.
  - Blink overlays: `blink: chars/<c>/blink_{expression}.webp`, with `noblink:` for closed-eye faces (Suzu proud, Hinata grin, Nemu sleepy).
  - Same head size for the whole cast, heights by character, backgrounds 1920x1080, all WebP.

**Author voice.** `examples/terrible-things/VOICE.md` exists. The author has not yet said whether to use it as is or change it; ask.

## Next steps

1. Land round 4: merge the six group branches, apply each group's "for other owners" notes, regenerate the spec appendices, run selftest under Node and jsc, check every game, commit, push.
2. Showcase art: collect stage 1 from the author, choose bases, post-process, build and run stage 2, integrate, check in the browser, commit.
3. Ask the author about VOICE.md.
4. Pending ideas (author to decide): the promise ledger (`@promise` / `@payoff`, checked by the explorer on every route), the first release (this game on itch.io, or 2 or 3 new pitches), Steam packaging later.

## Round 4 work list (summary)

- **analysis** (`engine/core/analyze.js`, `engine/core/vndb.js`):
  - W614/W616 runs and the longest-run stat follow @call/@return per call site (R2, R19).
  - The graph keeps the fall-through edge after a @call (R3, R20).
  - Branching Plot detection sees @set inside a called subroutine (R4).
  - Prototype-safe tables (R12, R13).
  - No em dashes in vndb output.
- **explore** (`engine/core/explore.js`; play/explore/options/HELP in `tools/cli.js`):
  - Try numeric and comma @input answers and a repeatable `--answer var=text` (R1, R23).
  - Play must not hang on default-answered input loops (R5).
  - Repeatable `--set` (R7).
  - Null @game results replay correctly (R17, R37).
  - Explore continues past R700 (R24).
  - Cap runaway play output (R25).
  - No em dashes in CLI output (R21); `{br}` in play's choice menus.
- **cli** (`engine/core/assets.js`, `tools/host.js`, `bin/shiori`, `engine/runtime/player.js`; cmdAssets and cmdDocs in `tools/cli.js`):
  - `--json` for new/build/serve (R6).
  - Fast failure for folders without game.story (R26).
  - `docs --json` keeps E116 (R8).
  - One `isExternalPath()` (R9, R22).
  - No W602 for noblink blink files.
  - `build` leaves out `source/`.
  - A portable jsc fallback with `SHIORI_ENGINE=jsc|node`.
- **compiler-expr follow-ups:**
  - Invisible characters in escape hints.
  - Colour-only module arguments.
  - noblink in the @character doc.
  - E101/E110 help.
  - Cross-file W608 via `node.speakerLike`.
  - Orphan bodies count as used.
  - A warning for `number > "string"`.
  - The E201 hint for function names.
- **parser follow-ups:**
  - Whatever the parser verifier finds.
  - argEscapeHint without an em dash, same rule as expr.js.
- **vm-runtime follow-ups:**
  - Whatever the verifier finds (noblink and the POV label, checked in a real browser).
  - Saves keep a bounded rollback history, so BACK works after loading.
  - No em dashes in runtime UI text.
