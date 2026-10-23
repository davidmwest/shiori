# Handoff

Where the Shiori work stands and what comes next, kept current so the next session can pick it up cold. Read `AGENTS.md` first for the rules.

- **Repo:** https://github.com/davidmwest/shiori
- **Branch:** `claude/dazzling-meitner-uz8dhg` (the only branch besides `codex/*` worker branches; keep pushing here unless the author decides otherwise)
- **Lead:** moving back to the Mac session "Next-gen visual novel engine", which works in the author's scratch folder `~/Library/Application Support/Claude/scratch-workspaces/bfe0a93b-8513-4de4-a831-49e6ac6b1779/8eb761fc-1b6b-4740-997c-246389b367e0/scratch-2026-10-22-6d653f`. The cloud session "Next-gen visual novel engine continuation" ran from 06:20 to about 08:00 UTC on Oct 23 and is winding down.
- **Last updated:** 2026-10-23 07:30 UTC

## 1. Syncing the Mac folder

The Mac folder's `main` (18e4e35) is an ancestor of the GitHub branch: the cloud session imported the Mac history unchanged and built on it. So syncing is a fast-forward:

```bash
cd "$HOME/Library/Application Support/Claude/scratch-workspaces/bfe0a93b-8513-4de4-a831-49e6ac6b1779/8eb761fc-1b6b-4740-997c-246389b367e0/scratch-2026-10-22-6d653f"
git status --short                     # expect nothing tracked changed
git remote add origin https://github.com/davidmwest/shiori 2>/dev/null; git fetch origin
git merge --ff-only origin/claude/dazzling-meitner-uz8dhg
git branch -u origin/claude/dazzling-meitner-uz8dhg   # main now tracks the GitHub branch; push with: git push origin HEAD:claude/dazzling-meitner-uz8dhg
```

Then remove the stale round-4 worktrees and branches from the old session. Their work is already merged (compiler-expr, parser, vm-runtime), and the two others never committed:

```bash
for i in 1 2 3 4 5; do git worktree remove --force .claude/worktrees/wf_ede3a973-067-$i; git branch -D worktree-wf_ede3a973-067-$i; done
```

`private/` and `tests/review/` are gitignored. The Mac copies are the originals, and nothing new needs to come back from the cloud except what this file says.

## 2. Engine: round 4

- **Merged already:**
  - compiler-expr (round 4);
  - parser (round 4);
  - vm-runtime (R18, `noblink:`, POV name in NVL);
  - suites registered, spec regenerated.
  - 401 tests pass under Node and Linux JavaScriptCore, and every game has 0 errors.
- **Finishing in the cloud right now:** six groups, each with a fixer, a skeptical verifier and one repair pass. The cloud session merges them into the GitHub branch, regenerates the spec, runs selftest and pushes. The Mac session gets a message when that lands. **Until then, don't edit engine, CLI, test or spec files on the Mac**, or the merge will conflict.
  - **analysis:** R2/R19 call-aware reading runs, R3/R20 graph fall-through after @call, R4 Branching Plot through @call, prototype-safe tables, no em dashes in vndb output.
  - **explore:**
    - R1/R23: numeric and comma @input answers, plus `--answer var=text`.
    - R5: play stops on default-answered input loops.
    - R7: repeatable `--set`.
    - R17/R37: null @game results replay correctly.
    - R24: explore continues past R700.
    - R25: runaway play output is capped.
    - R21: no em dashes in CLI output.
    - `{br}` in play's choice menus.
  - **cli:**
    - R6: `--json` for new, build and serve.
    - R26: fast failure for folders without game.story.
    - R8: `docs --json` keeps E116.
    - R9/R22: one `isExternalPath()`.
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
    - Cross-file W608 at the parser end.
    - Kana prose before `：` no longer flagged.
    - Odd-space choice bodies.
    - A U+3000 paragraph indent between menus.
    - A `[require]` with a missing operand.
    - argEscapeHint without an em dash.
  - **vm-runtime follow-ups:**
    - Whatever its verifier found (noblink and the POV label, checked in Chromium).
    - Saves keep a bounded rollback history, so BACK works after loading.
    - No em dashes in runtime UI text.
- **Testing on the Mac:** `./bin/shiori selftest` (it uses JavaScriptCore when Node is absent) and `jsc -m tools/gen-spec.js -- SHIORI-Spec.md`.

## 3. Codex workers

- **Policy:** Claude leads and gives self-contained sub-tasks to Codex on the Mac.
  - **Sol** (gpt-6.1-sol) does background grunt work the author doesn't see: audits, art runs, code review, testing.
  - **Astra** writes what players see: dialogue and songs.
- **Launcher:** `tools/codex-worker.sh` runs one worker in its own worktree under `~/Documents/Codex/shiori-workers/<task>` and pushes the result to `codex/<task>`. Codex itself runs sandboxed (workspace-write, no network); only the launcher pushes. Review a worker's branch before merging anything from it. The script header explains its files.
- **Started by the cloud session** through a launch session on the Mac ("Shiori: launch Codex workers"), once the author approves its commands:
  - `story-audit` (Sol, highest reasoning). It produces `reviews/story-audit.md` on `codex/story-audit`: the promise ledger per route, continuity, character voices, AI tells, content rating, and the top ten fixes. Review the findings, then fix what holds up. Hand the dialogue and joke rewrites to Astra.
  - `art-stage1` puts the raw PNGs on `codex/art-stage1` under `examples/terrible-things/source/codex/stage1/out/`.
- **Good next workers:**
  - a Sol code review of the round-4 merge (a second model's eyes) once it lands;
  - a Sol run of selftest and every game under Apple's JavaScriptCore, plus a Safari/WebKit check of the player and showcase.

## 4. Showcase art (examples/terrible-things)

- **Decision:** the author said yes to redoing all showcase art with Codex image_gen.
- **Keep from the earlier test:** Suzu `proud` (her base) and `soft`, Hinata `grin` (the author likes it as is; no collar change), the bakery background and the hands CG. These are in `examples/terrible-things/source/codex/refs/` (`style_suzu.png`, `hinata_v1.png`). Suzu `soft` and the bakery and hands images are in the Mac folder's `tests/review/tt-hd/`.
- **Pack:** `examples/terrible-things/source/codex/`.
  - `make_pack.py` builds packs; `run.sh` runs one on the Mac, 4 images at a time, and with `NOZIP=1` skips the Desktop zips.
  - Stage 1 (already built in `stage1/`): two takes each of Nagi neutral and Nemu sleepy, and 5 backgrounds.
  - Stage 2 (build with `python3 make_pack.py <dir> stage2` after copying the chosen cleaned bases to `source/codex/bases/{nagi,suzu,hinata,nemu}.png`):
    - every other expression as a face-only edit of its base;
    - a closed-eye blink frame for each open-eyed expression;
    - the countess and breaking CGs, drawn from a cast sheet.
- **Post-processing plan** (not written yet; Python + Pillow + numpy):
  - **Alpha:** Codex sprites are about 99% opaque inside (alpha 253). Set alpha ≥ 245 to 255 and alpha < 8 to 0.
  - **Faces:** expression edits keep exact alignment (measured 0 px shift) but faintly re-render line work everywhere. Take only the face region from each edit, feathered over about 12 px into the shared body, and store it as a full-canvas overlay.
  - **Layering** in `game.story`:
    - `layer: chars/<c>/body.webp`
    - `layer: chars/<c>/face_{expression}.webp`
    - `blink: chars/<c>/blink_{expression}.webp`
    - `noblink:` for closed-eye faces (Suzu proud, Hinata grin, Nemu sleepy).
  - **Size:** the same head size for the whole cast (about 150 px on the 1080-px stage). Heights by character: Hinata tallest, then Nemu (slouched), Nagi, Suzu. Bottom-aligned, with the figure cut at mid-thigh.
  - **Backgrounds:** come out at 1672x941; upscale to 1920x1080.
  - **Format:** WebP for everything (about 250 KB per sprite instead of 2 MB).
  - **Check:** in the browser, then move the old SVGs and their generators under `source/` (left out of builds).

## 5. Waiting on the author

- `examples/terrible-things/VOICE.md`: use as is, or changes?
- Stage-1 art: pick the bases (Nagi a/b, Nemu a/b) or ask for redraws.
- Later decisions:
  - the promise ledger feature (`@promise` / `@payoff`, checked by the explorer on every route);
  - the first release (this game on itch.io, or 2 or 3 new pitches);
  - Steam packaging.
