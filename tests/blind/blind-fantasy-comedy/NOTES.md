# Blind test notes: "The Nap of Alaric Nodd" (fantasy comedy)

Only SHIORI-Spec.md was read (Parts 1-3, Appendix A/B/C/D skimmed as reference). Nothing under engine/, tools/, other tests/ or examples/ was opened.

## Result
- 1,339 words, 8 scenes, 4 endings (promoted / royal_decree / honest_nap / moat_duty), 3 menus, one `@gameplay` mini-game.
- `shiori check`: 0 errors on the very first run. The only warnings were 14 x W602 (missing art/audio/gameplay files, as expected).
- `shiori explore`: 22 routes, all 4 endings, coverage 83/83 lines and 8/8 scenes, no runtime errors.
- `shiori vndb`: "eligible, with warnings", classified as VN / game hybrid. Narration is 66% of words. Reading share is 77.0% (2 min gameplay vs ~7 min reading).
- Brief features: `@gameplay broom_rodeo ... minutes=2 results="win lose"` + `@game broom_rodeo into=rodeo_result`; `@rename quill "???"` ... `@rename quill`; custom `@position dais` and `@position doorway`; `@move broom ... ease=back`; `@camera zoom=1.6 y=0.1` then `@camera reset`.
- I also wrote a real gameplay module, games/broom_rodeo.js, from Part 4.5 (only syntax-checked with jsc; see Friction 5).

## Process log
1. Wrote the whole game from the spec before running any tool (990 words).
2. First `shiori check`: **0 errors**, 14 warnings, all W602. Nothing other than W602 was printed.
3. explore + vndb + stats + play. VNDB gave two warnings: reading share 71.2% and "Reading is interrupted often. The median reading segment is 13 lines". I expanded the narration to 1,332 words (median 16 lines, the warning became a tick; reading share 76.9%).
4. Re-read the script and fixed three continuity bugs the tools cannot see (below). Added the gameplay .js file (W602 count 14 -> 13).
5. Total check runs: 4 (initial, after expansion, after adding the .js, final). 0 errors every time, so iterations to 0 errors = 1.

## Friction
1. **[medium] Part 5 is empty.** Part 1 says "read ... the example in Part 5", but Part 5 is only `<!-- EXAMPLE:examples/lantern-keeper/game.story -->`. A reader with only the spec has just the 40-line sample in Part 1. Inline the file or drop the reference.
2. **[high] `play` cannot pick a gameplay result, so explore's replay command is wrong for these routes.** Part 3.1 step 4: "Each ending comes with a ready-made `shiori play` command that replays it". Explore printed `replay: shiori play ... --choices 1,1,2` for Moat Duty, but that route needs `[broom_rodeo -> lose]`. `play` silently resolves `@game` to the first result ("win"), so the command stops with `Choice 2 is not available here (available: 1, 3, 4)`. Workaround that worked: `play --from reveal --set rodeo_result=lose,favour=2,biscuit=false --choices 2`. Suggest a flag such as `--game broom_rodeo=lose` that explore includes in its replay line, and that `play` prints which result it assumed.
3. **[medium] Choice numbering with hidden options is undocumented.** In `play`, a hidden `[if]` option still holds its number: `1) Take full credit. / 2) (hidden: condition is false) / 3) ... / 4) ...`, and `--choices` uses those numbers ("n = 1 or 3 or 4"). The spec (2.7, 4.6 "1-9: pick a choice") never says whether the number keys in the browser follow the original index or the visible position.
4. **[medium] How `@game` results and `minutes=` interact with VNDB is unexplained.** `@game ... into=variable` "stores its result" but the spec never says the variable must be declared, that it is a string, or that results are compared with `==`. I guessed `@var rodeo_result = ""` and it worked. Part 3.2 says pure VN needs 99% reading, so any `@gameplay` with `minutes=` makes a game a hybrid; the formula (reading share = reading time / (reading + gameplay)) and the "long reading segments" threshold appear only in the vndb output. The report shows a warning mark on "Counts as a visual novel / game hybrid" even though the verdict is eligible; this reads like a problem until you realise 99% is unreachable.
5. **[medium] Gameplay module docs sit in "Part 4: extend the engine".** The intro says to read Part 4 only to extend the engine, yet anyone using `@game` has to write a module from Part 4.5. It is three lines: no word on `params`, `signal`, what the player draws around `container`, whether the result must be a string, or what happens on abort. I could only syntax-check my module (jsc -m). The shared browser pane was taken over by another session and a new-tab navigation was refused, so it was never run in the player. `check` and `explore` never execute the module either.
6. **[low] Header enums not listed.** `status:` is "as VNDB defines it", `release_type:` is complete/partial/trial only by inference. I guessed `status: finished` and the report printed "Development status: Finished", but the valid values should be in Appendix B.
7. **[low] W602 noise.** 13-14 W602 warnings, each with a two-line hint, drown real warnings while art does not exist yet. `shiori` usage lists no `--ignore W602` or summary-style option; I grepped them out by hand.
8. **[low] Appendix C is missing W616.** Part 3.1 cites "30+ lines in a row with no visual change at all (W616)", but the diagnostic table stops at W615 (and has no E115).
9. **[low] `shiori docs play` -> "No command @play."** `docs` only knows story commands. The `play` options (`--from --set --seen --state --max`) appear only in the bare `shiori` usage text and partly in 3.1.
10. **[low] Explore quotes choice text.** A choice written as `* "It is a very advanced nap."` is printed as `""It is a very advanced nap.""`. Cosmetic.
11. **[low] Unspecified `@rename` scope.** "from now on" is clear, but the spec does not say whether `@scene` (clean stage) or a load/rollback resets a rename. I reset it explicitly.
12. **[low] Player start gate.** `player.html?...&autostart=1` still shows a "Click to start" button (audio unlock) and `window.shiori.state()` is null until it is clicked. Not mentioned in 4.6.

## Mistakes the checker did NOT catch (all mine, found by reading the transcript)
- Continuity: Quill said "You gave me a biscuit and a mop", but a player only ever gives one. Fixed with a `@var biscuit` flag and an `@if`.
- Continuity: "The broom looks at the mop" even on the biscuit route; the honest ending said "gets his job back" though he was never fired; the promotion ending mentioned a mop that may never have appeared. All fixed.
- A "Hold my hat" gag had no set-up. I added the pointed hat in the opening scene before running anything.
- Pacing for VNDB (reading share, median segment of 13 lines) was only flagged by `shiori vndb`, not `check`.
- Nothing verifies the gameplay .js beyond file existence, that `@rename` is reset on every route, or that a prop was shown before `@move` (jumping into scene `rodeo` with `?scene=rodeo` gave runtime R700 "`alaric` is not on stage").

## What worked well
- `check` found nothing wrong in a 240-line script written blind: the spec's cheat sheet, the 12 rules and the common-mistakes table were enough.
- `explore` output (shortest route per ending + coverage) and `vndb` (narration %, reading share, tags, draft entry) were genuinely useful; `play` transcripts made pacing easy to judge.
