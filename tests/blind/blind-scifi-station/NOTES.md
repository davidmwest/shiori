# Blind test notes: "The Quiet Spoke" (blind-scifi-station)

I wrote this from `SHIORI-Spec.md` only (Parts 1–3, plus Appendix A/B/C/D as reference; I skimmed Part 4.4 for 3D).
I didn't open engine/, tools/, examples/ or the other blind folders.

## The game

- Orbital station Halcyon Ring. A beacon starts calling from Spoke C, which has been sealed for nine years. Its call sign is CALDER-ONE, the dead chief engineer.
- POV switches with `@pov`: Teo, the comms officer, has Part One and Part Three. Ines, the engineer and Calder's daughter, has Part Two and the epilogue of the good ending.
- An opening video is declared (`@video op movies/opening.webm`) and played (`@video op kind=opening`).
- Part Two goes inside the spoke. It is the only 3D sequence: `@world spoke worlds/station.js marks="airlock corridor hub viewport beacon" camera=airlock`. It uses `@camera from=/look=` moves through airlock → corridor → hub → viewport → beacon, plus `fov=`, `orbit=` and `zoom=`. A `@model` beacon prop is shown at a mark. Everything else is 2D.
- Music is four LMN tracks, declared and used with `@music`. Ambience and SFX are `.ogg` files.
- 2 files (`game.story`, `story/spoke.story`), 8 scenes, 1,537 words, 70% narration.
- 3 endings: Dead Air (bad), Procedure (normal) and Open Channel (good, behind `[require trust >= 2]`). The log scene is in NVL; the rest is ADV.
- Header: `ai_generated: story`. Only the story is AI-written; none of the declared art, music or video exists.

## Process

1. I wrote the whole game in one go, before running any shiori command.
2. **First `shiori check`: 0 errors, 0 warnings apart from W602** (17 W602 "file not found", which I was told to ignore).
3. It took 1 check run to reach 0 errors. I ran it 3 more times after small story edits; all were clean.
4. `explore`: 9 routes, all 3 endings reachable, coverage 99/99 lines and 8/8 scenes. `vndb`: eligible, Visual novel.
5. I read routes 1,2,1,1 (good), 2,1,1 (locked option shown as `[locked]`) and 2,1,2 (bad) with `play`.

## Friction

1. **Spec is wrong: typos in camera marks aren't caught.** Spec 2.11 says: "List them with `marks="..."` so `shiori check` can catch typos; then use them in `at=`, and in `@camera from=` … and `look=`". In a scratch probe, `@camera from=airlok look=hubb` passed `check` with no diagnostic, and `play` printed `camera from=airlok look=hubb`. `@show gizmo at=hubb` *was* caught (E303 with "Did you mean `hub`?"). (high)
2. **`@camera from=/look=` in a 2D scene is silently accepted.** I'd expect a warning that these only apply to 3D worlds. (medium)
3. **Camera arguments you leave out keep their old values, which the spec doesn't say.** The syntax line `@camera [zoom=1] … [fov=50]` reads like defaults. But my later `@camera from=hub look=airlock` kept `zoom=1.3 fov=70` from the earlier shot, which I only noticed in the `play` transcript. (medium)
4. **The spec never lists the allowed values for `status:` and `release_type:`.** Appendix B just says "Development status, as VNDB defines it". I guessed `finished`, which was right. A probe showed the checker knows the list (`finished, in_development, cancelled`; `complete, partial, trial`), so the table should list it too. (medium)
5. **Part 5 is an unexpanded placeholder.** The spec opens with "read … the example in Part 5", but Part 5 only contains `<!-- EXAMPLE:examples/lantern-keeper/game.story -->`. A model with only the spec gets no complete multi-file example. (medium)
6. **The `play` transcript leaves out information.** `@pov teo` prints just `· pov` with no name, so I can't check from the transcript whose POV is active. `@camera orbit=40` prints the camera state without `orbit`, so I can't tell headlessly whether orbit did anything. (low)
7. **Sprites at 3D marks are unclear.** Spec 2.11 says a sprite-only character is "drawn as a 2D sprite over the 3D world, exactly as over a painted background". But `at=` also accepts marks, and `@show ana at=airlock` on a sprite-only character is accepted. It isn't clear what that does for a sprite. I used `at=left` to be safe. (low)
8. **The grammar contradicts the examples for one-off speakers.** Appendix D has `'"' name '"'` with `name := [A-Za-z_][A-Za-z0-9_]*`, but the examples use `"Old man":`, and my `"Calder-One":` (with a hyphen) works. Appendix D also allows `key=value` on scene headings, which no other part of the spec mentions. (low)
9. **The VNDB report doesn't mention the opening movie.** The animation line says "cutscenes: None", which is correct for `kind=opening`, but it never says the game has an OP movie. Two characters have `role: protagonist` and `@pov` switches between them, but no multiple-protagonist tag is suggested. (low)
10. **No way to mark a line as heard "over the comm".** Much of the dialogue is a radio channel with the speaker off-stage. It works, because attributes apply "on stage or not", but a per-line voice or textbox style would help. (low, feature wish)

## Mistakes I made that the checker didn't catch

- The camera kept `zoom=1.3` into the bad ending's retreat shot (see friction 3). I found it in the `play` transcript and fixed it with `zoom=1 fov=55`.
- `@ambience stop` at the lock was never undone, so the station hum stayed silent when Part Three returned to the ops deck. I found it by re-reading and added `@ambience hum`.
- Continuity: in the bad ending, the case where the Director was told was ignored, even though she had been on the channel. I added an `@if told_director` line.
- `@camera orbit=40` orbits the current look target (the viewport), not the beacon that is revealed next. The order may be wrong for the shot I meant, and I can't verify it headlessly.
- Design: if you wake the Director, `trust` tops out at 1, so the good ending is locked for that half of the tree, and nothing tells the player why. It is a deliberate cost, but explore shows only 1 route to the good ending.
