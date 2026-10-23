# Notes for the Shiori engine, from writing *All the Terrible Things We Didn't Think*

I learned the language from `SHIORI-Spec.md` (Parts 1–3, Appendices A–D) and the CLI output, without reading the engine source. The game has 28 scenes, about 10,000 words, 7 menus (one of them a hub), 3 endings including a true ending gated on `endings_seen()`, 3 points of view, ADV and NVL, and one 3D world.

**Overall:** writing in Shiori was fast, and the language stayed out of the way. Prose-first lines (plain line = narration) are the single best decision in the design; I never had to think about syntax while writing paragraphs. I hit only two compile errors in the whole project, both typos in expression names, and both messages told me exactly what to do. Most of the friction below is in the **tooling around the language** (explore budgets, the VNDB report, lints that don't exist yet), not the language itself.

---

## Top issues (most impactful first)

1. **`shiori vndb` reports the wrong number of endings when its exploration is cut short.**
   `explore --max-states 5000000` finds all 3 endings. `vndb` (with its default budget) prints `ℹ Route exploration was cut short` and then, in the suggested tags, `[Multiple Endings] — 2 endings.` The true ending, which needs a second playthrough, is silently left out of a draft that's meant to be pasted into VNDB. Count endings from the `@ending` declarations (which are static), or reuse explore's result, or accept `--max-states`. At least say "2 of 3 declared endings reached" instead of stating a wrong fact.

2. **`explore`'s default budget is far too small for one ordinary hub menu, and it doesn't seem to merge equivalent states.**
   A single hub with four `[once]` questions and two exits creates 113 orderings. The default run stopped at 20,016 states with `STOPPED EARLY: raise --max-states.` It took me three tries to find a budget that finished (the full run needs about 475k states and takes only 2 s). Two suggestions:
   - Merge states that are identical after the hub: same position, variables, `[once]` set and visit counts. Picking A then B or B then A leaves exactly the same state, so permutations collapse.
   - When stopping early, say roughly how far it got ("~5% of the frontier") and suggest a concrete number, or raise the default. The run is cheap.

3. **There's no lint for long ADV lines.** Spec 2.5 says ADV lines should stay at about 250 characters, but W607 fires only above 600, in either mode. My first draft had about 20 ADV lines of 260–405 characters that would overflow a textbox. I found them with my own `awk` script. Make W607 mode-aware (for example, warn above ~280 characters while `@mode adv` is active, and above 600 in NVL). The compiler already knows the mode at each line.

4. **A degenerate 3D camera isn't caught.** I wrote `@camera from=statue look=statue`, which puts the camera inside the thing it's looking at. `check` accepted it, and so did `@camera from=door look=door` in a test. A warning such as "`from=` and `look=` are the same mark, so the camera will look at itself" would have caught a real bug in the game's only 3D scene. Related ambiguities in spec 2.11 and 4.4:
   - Does `from=door` with no `look=` use the mark's own default `look`? I assumed so.
   - What does `orbit=40` orbit around when there's no `look=` on the same line: the current look target? I assumed so.
   - Can `orbit=` be combined with `from=`?
   One sentence each in the `@camera` entry would settle it.

5. **24 W602 "missing file" warnings bury everything else.** This project (like every asset-later project) has one W602 per missing file. To see real warnings I had to run `check … | grep -v W602` every time, and the summary line just says `0 errors, 24 warnings.` Suggest grouping them ("W602 ×24 missing asset files, run with `--assets` to list"), or a flag such as `--ignore W602`, and a per-code breakdown in the summary line.

---

## Places the spec was unclear

- **`visited()` and the current visit.** Spec 2.4: "`visited("harbor")` … the number of times the scene has been entered in this playthrough." It's unclear whether the visit in progress counts. I needed `@if visited("ask_keeper") == 1` to show a different prompt on the first pass through the hub. It worked (so the current entry counts), but I had to test it. The hub example in 2.7 also repeats its prompt line on every loop, which reads badly in practice. Showing the `visited()` idiom there would help every hub writer.
- **What `@scene` resets.** The table says it clears characters, CG, weather, filter, tint and camera. It doesn't say whether `@mode nvl`, `@pov` or `@rename` survive. I re-set them explicitly to be safe.
- **`@pov` after `@rename`.** The POV label uses the *renamed* name. My Keeper is renamed "Tamamori" when her POV interlude runs, and `play --json` shows `"name": "Tamamori"`. That's exactly what I wanted, because it avoids a spoiler, but the spec doesn't say so. Worth one line in the `@pov` entry.
- **Dialogue attributes persist on off-stage characters.** This is documented ("Attributes are remembered"), but the consequence is easy to miss. My narrator Nagi has no sprite on stage for four chapters. A `nagi (surprised): Why not?` in Chapter 1 meant the transcript showed `Nagi (surprised): Good morning.` for her next lines, and her first real `@show nagi` would have used whatever expression was last mentioned 200 lines earlier. I added explicit attributes on every `@show`. A transcript marker for inherited attributes, or a note in 2.10, would help.
- **Choice numbers in `--choices`.** The printed numbers are the option's original position, even when earlier options are hidden by `[once]`. For example, `6` is still "Say you'll see her tomorrow" after options 1–4 are gone. It's consistent with "numbers as printed", but an LLM building a `--choices` list by counting visible options will get it wrong. Say it explicitly in Part 3.1.
- **Single-word versus multi-word unknown speakers behave differently.** Spec 2.5 says `Old Man: …` becomes narration with W608. In a test, `Mayor: I am the mayor.` was a hard **E114** error. The hint offered to declare a new character called `Mayor`, but a declared character `kagami` already has `name: Mayor Kagami`. Suggest: when the unknown speaker matches the start of a declared `name:`, say *"Did you mean `kagami` (Mayor Kagami)?"* Speakers written by display name are the most likely LLM mistake.
- **`@assert` with a message after a string comparison** (`@assert ran_to == "hinata" or ran_to == "suzu" "message"`) looks ambiguous: is the last string part of the expression? It parsed correctly. An example like this in the `@assert` entry would remove the doubt.

## Error messages: what worked

E203 (`hinata` has no attribute `angry_placeholder` + the full list of valid expressions), E300 (`Did you mean @sound?`), E501 (`{wave}` is never closed, add `{/wave}`) and E303 (unknown `at=` mark, plus a hint to list marks on `@world`) were all excellent: one read and I knew the fix. The R701 assertion report with the `via:` choice path is great. The replay lines from `explore` (`shiori play … --choices 2,6,2,1,2,2,3 --seen fourteenth,salt`) are the best feature of the toolchain for an LLM author.

## Small CLI issues

- **`play --seen` isn't in `shiori --help`.** I only found it in explore's replay line.
- **explore's replay line lists more `--seen` endings than needed** (`--seen fourteenth,salt` when either one alone unlocks the true ending). Harmless, but it suggests both are required.
- **`play` prints `· pov` without saying whose POV.** I had to use `--json` to check that `@pov suzu` was in effect. Print `· pov suzu (Tamamori)`.
- **`stats` has no per-scene word counts.** Hitting a word budget (this brief: ≤ 10,000) meant writing my own Python counter to find which scenes to trim. `stats --by-scene` would make revision much faster. My counter also disagreed with `stats` by about 1%, so I couldn't be sure I was measuring the same thing.

## Mistakes I made that nothing caught

- The degenerate camera (`from=statue look=statue`; issue 4).
- About 20 ADV lines over 250 characters (issue 3).
- **Story-logic continuity errors**, which are naturally outside a checker's reach, but worth listing as a class:
  - An ending referred to "the plum-coloured bead that used to be mine" after that bead had been returned and melted two chapters earlier.
  - A trim removed "we'll tie a cloth over that mask", but the next line still said "A blindfold. How quaint."
  - A background described as "lanterns unlit" when the only square background has them lit.
  - Two endings used details ("Two streets", "I told you") that are only established if an optional hub question was asked.
  I fixed these by reading full transcripts with `play --quiet`, which is the right tool. One thing that might help: a `play --diff-routes A B` that shows only the lines that differ between two choice lists. Most of my continuity bugs were in `@if` branches I wasn't reading.

## Features I wanted

- **Asset usage report (`shiori assets`).** For each declared image, world and audio: every scene that uses it, and with which `@filter`, `@tint` and `@weather`. Writing ASSETS.md meant reconstructing this by hand (for example, `statue_garden` is used under no filter, under `sepia`, and under `night` + fireflies, and the painter needs to know all three). An optional `desc="…"` on declarations that this report includes would let the asset brief live next to the code.
- **A hint on locked options:** `* [require endings_seen() >= 1 "Unlocks after any ending"] …`. A greyed-out true-ending option with no explanation is a common player complaint.
- **A built-in per-character word and line budget in `stats`,** like the existing "Lines per speaker", but also counting narration under each `@pov`. That would show at a glance whether a POV chapter carries its weight.

## What made writing slower

In order of time lost: finding an `explore` budget (about 3 runs), trimming to the word budget without per-scene counts, re-running `check` through `grep -v W602`, and checking long ADV lines by hand. Writing the actual script, including choices, hubs, the 3D scene and POV switches, was quick and pleasant. The cheat sheet and the "twelve rules" in Part 1 were all I needed after the first read.
