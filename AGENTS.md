# Shiori: rules for AI agents working in this repo

Shiori is a visual novel engine in plain JavaScript, built to be easy for LLMs to write games with. `SHIORI-Spec.md` is the full reference. The repo holds the engine (`engine/core`, `engine/runtime`), the CLI (`tools/`, `bin/shiori`), example games (`examples/`), the new-game template (`templates/new-game`) and tests (`tests/`).

If `HANDOFF.md` exists, read it before doing anything else: it says where the work stands and what comes next.

## People and roles

- The human author is the director and producer: premise, themes, world, cast, major plot points, structure, and what ships. The AI collaborators (Claude, Codex) do the rest of the credits: writing, art direction, music and code.
- At decision points, bring 2 or 3 options with a recommendation, then carry out the choice.

## Content rules

- **No self-insert.** Never write the author as a character, a stand-in or a narrator, and never turn the author's life into plot. The games should carry the author's personality through voice, humor and values (see `VOICE.md` in a game folder). A character whose arc echoes the author's is fine only when it is the best choice for the story.
- **Ratings:** all ages up to R. Nothing M-rated and no explicit sexual content. Characters under 18 are never sexualized, in text or art.
- **Every promise is paid.** When a story asks the reader to invest (a mystery, a threat, a relationship), it pays that back on every route that raised it. This is the author's hard no.
- **VNDB checks are advisory.** `shiori vndb` gives advice; meeting VNDB's criteria is the writer's call. Never make the engine block or fail a game over it.

## Privacy

- `private/` is gitignored and must never be committed, copied into a game, quoted in output, or sent anywhere. It holds the author's private writing profile.
- `VOICE.md` in a game folder is the shareable distillation: voice, humor and sensibility only, nothing biographical.
- From the author's Reddit data export, only `comments.csv` and `posts.csv` may be read. Never open messages, chat history, IP logs, payment, phone, birthdate or other account files. The export is not in this repo.
- Never send the author's email address to unrelated services.

## Engineering

- Run the CLI with `./bin/shiori`. It uses Node when installed, otherwise JavaScriptCore (the author's Mac has no Node; `jsc` lives at `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`). `./bin/shiori selftest` runs the tests; `jsc -m tests/run.js` runs them directly under JavaScriptCore. Both must pass.
- `SHIORI-Spec.md` Appendix A, B and C are generated: run `node tools/gen-spec.js SHIORI-Spec.md` (or `jsc -m tools/gen-spec.js -- SHIORI-Spec.md`) after changing commands, functions, header fields or diagnostics.
- Every fix needs a test that fails before and passes after. Test suites are listed in `tests/suites.js`.
- `examples/lantern-keeper`, `examples/terrible-things`, `templates/new-game`, `tests/fixtures/*` and `tests/blind/*` must keep compiling with 0 errors.
- `tests/review/` is gitignored scratch space for repros.
- User-facing text (diagnostics, hints, CLI output, docs, game UI) is plain, short and concrete, tells the author exactly what to write instead, and uses no em dashes.
- Browser check: `python3 tools/serve.py 8777`, then open `http://localhost:8777/player.html?game=examples/terrible-things` (add `&scene=<id>&autostart=1` to jump to a scene, `&dev=1` for the dev panel).
- Showcase art for `examples/terrible-things` is made with Codex image_gen. The prompt pack and its generator live in `examples/terrible-things/source/codex/`; `source/` is left out of game builds.
- Work on the branch named in `HANDOFF.md`. Commit and push often; never push to another branch, never rewrite pushed history.
