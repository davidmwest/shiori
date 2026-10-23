# Blind test notes: "The Lantern Princess" (blind-school-romance)

Method: read only `SHIORI-Spec.md` (Parts 1-3 in full, Parts 4-5 and the appendices as reference). Wrote the whole game in one pass before running any tool. No file under engine/, tools/, tests/ or examples/ was opened.

## The game
- 10 scenes, 1,543 words (second version; first draft was 1,456), 67% narration by words (`shiori stats`), 3 endings (`curtain_call` good, `quiet_friends` normal, `empty_seat` bad).
- Two sprite characters (`aoi`, `rin`), each with `expression` and `pose` groups, plus blink overlays and a VNDB character sheet. One-off speaker `"Kana"`.
- Hub menu (`ask_rin`) of three `[once]` questions plus an exit. Two `[require ...]` locked options: `[require knows_fear]` (rooftop, unlocked by a hub answer) and `[require warmth >= 4 and nerve >= 2]` (the confession).
- Three `@chapter` cards (Act One, Act Two, Act Three) plus an Intermission card. `@pov` switch to Rin for the interlude. `@if/@else` in two places, `@camera`, `@move`, `@weather`, `@filter`, `@cg`, `@ambience`, `@sound`, `@ending`.
- Affection variables: `warmth` (Rin's feelings), `nerve` (Aoi's honesty). Flags `knows_fear`, `ending_cut`, `said_oath`, `confessed`.
- Header filled in honestly, `ai_generated: story`. Art and music files do not exist (W602 only).

## Process log
| Step | Result |
|---|---|
| 1. Write whole game from spec | done before any tool call |
| 2. First `shiori check` | **0 errors, 15 warnings, all W602.** Zero non-W602 diagnostics. |
| 3. Runs until 0 errors | **1** (already clean). A 2nd check after my own logic edits was also clean. |
| 4. `explore` | 172 routes, 3 endings all reachable, coverage 96/96 lines, 10/10 scenes, no problems. |
| 4. `vndb` | eligible, classified Visual novel, 68% narration at first draft. |
| 4. `play` | read the good route (`1,3,4,1,1,1`), the bad route and the normal route. |

### First check output (non-W602)
Nothing. The only output was 15 x `warning[W602] File not found ...` (11 for declared images/audio, 4 for sprite/blink templates, with hints "Paths are relative to the folder that holds game.story." and "Check the folder and the file extension.").

## Mistakes in my script that the tools did NOT catch
Both were found only by reading the `shiori play` transcripts, and both are logic/consistency errors a checker cannot see:
1. **Interlude mood keyed to the wrong variable.** I made Rin's thoughts in the interlude depend on `@if warmth >= 3`, intending "Aoi said the oath to her face". But `warmth` can reach 3 even if the player read the oath flat (hub points), so Rin would remember a promise Aoi never made. Fixed with a dedicated flag `said_oath`.
2. **Bad ending contradicted the player's route.** `empty_seat` always said a red line crossed out the last word, but the player can reach that ending without ever choosing to cut the ending (low warmth from skipping the hub and reading flat). Fixed with `@if ending_cut` / `@else`.
3. (Style, not a bug) I first wrote 67% narration by words; the checklist says "~30%+" and 3.2 says healthy is 30-60%, so I added some dialogue lines. It is still 67%, because my narration lines are long. `shiori stats` reports this but nothing warns about narration being too high.

## Friction points

### Spec
1. **Part 5 example is missing (spec-wrong, medium).** Line 11 says "read ... the example in Part 5", and Part 5 says "Its `game.story`:" but then contains only the unexpanded template marker `<!-- EXAMPLE:examples/lantern-keeper/game.story -->`. A reader of the spec alone gets no worked example except the 40-line game in Part 1. Suggestion: inline the file into the shipped spec (or drop the references).
2. **Enumerated header values are not listed (spec-unclear, medium).** Appendix B says `status:` is "Development status, as VNDB defines it" (default `in_development`) and `release_type:` is "complete / partial / trial" only in prose. I guessed `status: finished`; it happened to be right, but only a deliberate probe showed the real error `` `status:` `bogus` is not one of: finished, in_development, cancelled. ``. Put the allowed values in the table. The same applies to `platforms:` (web, win, mac, lin, and, ios are listed, but `platforms: web toaster` is silently accepted), `censored:`, `age_rating:`.
3. **Appendix C is incomplete (low).** Part 3.1 mentions W616 ("30+ lines in a row with no visual change"), but Appendix C ends at W615. E115 is also skipped (E114 then E116).
4. **Rule 3 vs 2.9 on declaration order (low).** Part 1 rule 3 says "Declare every ... before using it", while 2.9 says declarations "apply to the whole game wherever they appear". Which is it? (Declaring at the top worked, so I never found out.)
5. **Attribute stickiness is described only in one clause (low).** 2.10: "Attributes are remembered" and 2.5 "from this line on". The play output shows `Rin (sad, holding_script)` on every line, so a pose set once persists. It is fine, but an example showing that a pose must be reset explicitly (`rin (neutral, stand)`) would help.
6. **`@show` on a character already on stage (low).** 2.10 says it "changes one already shown (attributes, position ...)" but not whether the position change jumps or slides. I used `@show rin ... at=center` to relocate her in the last scene and could not tell what it looks like. `@move` is the documented slide.
7. **Hub warning in 3.4 is runtime-only.** The table lists "A menu where every option has `[if ...]`" under mistakes with code R704, which suggests `check` catches it. It does not (see below); only `explore` does.
8. **Locked options have no way to explain themselves (missing feature, medium).** Spec: `[require cond]` is "Always shown, but locked (greyed out)". A first-time player gets no hint why. A form like `[require warmth >= 4 "needs more trust"]` or a `lock_text` would make require-style gates much better design.
9. **`shiori docs` covers only `@commands`.** `shiori docs choices` prints `No command @choices.` There is no docs entry for the syntax topics (choices/modifiers, text tags, header fields), which are the part a new writer needs most. Appendix A also does not document `* ` / `[once]`.

### Tools
10. **`check` does not catch an all-conditional menu.** Probe: a menu where both options are `[if x > 5]` gives `0 errors, 0 warnings. All clear.`; `explore` then reports `R704 A menu had no available choices` correctly. A static warning ("no unconditional option") would be cheap.
11. **`play` shows `· pov` with no character name** for `@pov aoi` / `@pov rin`, and narration lines carry no POV label, so I could not confirm in the transcript that the POV switch did anything. Show `· pov rin`.
12. **`play` prints some `change` lines twice.** `@show rin neutral holding_script at=center` on a character already on stage printed `· change rin neutral holding_script` twice in a row (once for the command, once for the following dialogue). Harmless noise.
13. **W602 sprite hint is generic.** "Check the folder and the file extension." does not name the files for sprites in the normal output (the probe showed `` `a` sprite: 2 of 2 images not found (c/a_neutral.png, c/a_smile.png) ``, which is better but still no "(expected N files)"); for a game with 20 combos this will be noisy. A `--no-assets` or `--ignore W602` flag would help while art is missing.
14. **`explore` route counts are inflated by hub order.** 172 routes, 117 of them end in the same bad ending, because three `[once]` questions can be answered in 3! x subsets orders. Fine at this size but it will explode for bigger hubs; collapsing routes with identical state would be cleaner.
15. **`W606` never fired.** A flavour option with no body and no jump (`* Flavour choice with nothing`) gave no warning in my probe, though the code table says "Choice has no visible effect". Either the spec means something narrower or it is unimplemented. I could not tell.
16. **W608 heuristic.** `Old Man: Who goes there?` correctly gives W608, but `Aoi remembers now: the pages ...` (a narration line that happens to contain a colon after capitalised first word) did not, which is right. `Note: this is a note.` gives E114 (not W608), also matching the spec's `| Note:` advice. Messages and hints were excellent here.

### Things that worked really well
- Every probe error I tried had a precise line/column, a fix hint ("Did you mean `a`?", "Character ids are case-sensitive: write `a:`.", "a's attributes: expression: neutral smile; pose: stand.", "Write `==` to compare").
- The quick-reference Part 1 plus the "twelve rules" were enough to write 1,500 words with zero errors on the first check.
- `explore` printing ready-made `shiori play ... --choices` replay lines is great; `play` marks locked options (`[locked]`) and hidden `[once]` options.
- `vndb` report is clear, and it picked up `ai_generated` and `status` correctly.

## Feature wishes
- Locked-option hint text (above).
- A per-ending summary in `explore` of the variable ranges that reach it (e.g. `warmth 3..4`) so thresholds can be tuned without replaying.
- A static "no unconditional option" warning for menus, and a warning for narration above ~60% as well as below 15%.
- `shiori check --ignore W602` while art is missing.
