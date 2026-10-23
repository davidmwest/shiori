You are a story editor reviewing the showcase visual novel "All the Terrible Things We Didn't Think" in `examples/terrible-things/`. Follow `AGENTS.md`. This is a review only: do not change any game, engine or test file, and do not run git commands. Your one output is a new file, `reviews/story-audit.md`. The launcher commits and pushes it for you.

Read in full:
- `examples/terrible-things/game.story` and `story/*.story`, in include order: ch1, interlude, ch2, ch3, ch4, ch5, ch6, endings;
- `examples/terrible-things/VOICE.md` (the author's voice and values) and `ASSETS.md` (who the characters are);
- `SHIORI-Spec.md` sections 2.4 to 2.8, for the script syntax.

Use the engine to see the branches. On this Mac `./bin/shiori` runs under JavaScriptCore:
- `./bin/shiori graph examples/terrible-things`
- `./bin/shiori explore examples/terrible-things`
- `./bin/shiori play examples/terrible-things --choices 1,2,...` to read one route

Write `reviews/story-audit.md` with these sections, quoting lines with file:line:

1. **Promise ledger.** List every place the story asks the reader to invest, and where each one is paid off, per ending. That covers mysteries, threats, foreshadowing, set-ups, relationships, and choices that imply consequences: for example the missing eighth summer, the wind chime that never rang, the glass spreading through Suzu, and Hinata's 4 a.m. thoughts. Flag every route where a promise raised on that route is never paid. This is the author's one hard rule.
2. **Continuity and logic.** Report:
   - contradictions in facts, timeline, names, or who knows what and when;
   - choices whose effects never show;
   - variables that are set but never matter.
3. **Characters.** Cover Nagi, Suzu, Hinata, Nemu, Mayor Kagami and Mame:
   - Does each one sound distinct, and want something of their own?
   - Which lines could belong to anyone?
   - Where does a character act only to serve the plot?
4. **Prose.** Report:
   - AI-sounding tells (exact phrases with file:line);
   - overused words or constructions;
   - em dashes and clichés;
   - places that break `VOICE.md`.
5. **Content.** The game is rated 15. The cast are 17 or 18, except Mame (8) and the Mayor. Report:
   - anything that crosses into M-rated territory or sexualizes anyone;
   - anywhere the intrusive-thought theme is handled carelessly.
6. **The ten most valuable fixes, ranked.** For each give file:line, the problem, and a concrete suggested change. Do not rewrite jokes or key emotional lines yourself; mark them as candidates for a later polish pass instead.

Be specific and don't pad. Write plainly, with no em dashes. When you finish, reply with a five-line summary of the most important findings.
