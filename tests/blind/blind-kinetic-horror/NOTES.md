# Blind test notes: "Three Fourteen" (blind-kinetic-horror)

A kinetic novel (no choices) of quiet psychological horror. Natsu is the night clerk at a fog-bound
convenience store. Every night at 3:14 a man buys one hot can of milk tea and leaves it on the counter.
On night 365 the security monitor shows the real store: closed and dark, the counter covered in 364 cans,
flowers and her photograph, and nobody behind the till. One ending (`three_fourteen`, kind=normal).

- 4 scenes (`shift`, `night_365`, `camera_two`, `after`), 64 lines, **1,212 words**, 91% narration
- Text modes: started at ADV 30 / NVL 34 lines; after restructuring, ADV 22 / NVL 42
- Effects: `@filter` night/vignette/noir, `@weather fog` (back layer, then front), `@flash` + `@shake` at the turn,
  `{shake}`, `{w}`, `{w=n}`, `@camera` push-ins, `@cg` x2, `@textbox hide` + `@pause`, `@music stop` for the silence

## Process

1. Read SHIORI-Spec.md (Parts 1–3, Appendix A/B/C/D). Wrote the whole game in one go before running any tool.
2. **First `shiori check`: 0 errors, 15 warnings. All 15 were W602 (missing asset files, as expected).** There were no other diagnostics.
3. Number of check runs until 0 errors: **1**. I ran it 3 times in total (after two rounds of changes I chose to make myself).
4. explore: 1 route (82 states), 1 ending, coverage 64/64 lines and 4/4 scenes, no runtime problems.
   vndb: **eligible**, Visual novel. Suggested tags: ADV/NVL Mixing, Kinetic Novel, AI-generated Story.
5. Read the whole route with `shiori play` (and with `--state` through the turn).

## Changes made after reading the transcript and the stats (the checker flagged none of these)

- **Too much ADV for "mostly NVL".** `stats` reported "ADV 30 lines, NVL 34 lines". The descriptions of the man walking in
  were in ADV. I moved the arrival narration into NVL and switched to ADV only for the exchanges, which gave ADV 22 / NVL 42.
- **Inconsistent quote marks.** The header sets `dialogue_quotes: “”`, but one narration line quoted dialogue with straight `"…"`.
  I changed it to curly quotes to match.
- **Chapter card drawn over the previous scene.** In `night_365`, `@chapter` came before `@scene`, so the "Night 365" card would
  appear over the back-room stage from the last scene. I added `@scene black` before it.
- Not fixed: `@music night_shift fade=3` in `night_365` does nothing, because that track is already playing ("same track = keeps playing").
- Not fixed: `@filter vignette` in the back room replaces the `night` grade. Filters don't stack (`@filter night vignette` gives E304).

## Friction

1. **Part 5 has no example in it.** Line 11 says "read Part 1 …, Part 3 … and the example in Part 5", but Part 5 holds only
   `<!-- EXAMPLE:examples/lantern-keeper/game.story -->`, a placeholder that was never expanded. A blind user (who can't open examples/)
   gets no full example beyond the 40-line Part 1 game. (medium)
2. **Header fields with fixed values don't list those values.** `status:` says "Development status, as VNDB defines it." with default
   `in_development`. I guessed `finished` and it worked. `release_type:` ("complete, a partial release or a trial") and `censored:` don't
   give their exact tokens either. (low)
3. **Is `side:` templated?** The spec only says blink/mouth "may use placeholders". I used `side: chars/natsu/side_{expression}.png`
   and the checker expanded it (5 images), so it works, but the spec doesn't say so. (low)
4. **NVL presentation is underspecified.** The spec doesn't say whether sprites (`@show`) stay visible under the NVL page, how dialogue
   is laid out in NVL, or whether `@textbox hide` also hides the NVL page. (low)
5. **Filters can't be combined.** `@filter` takes one value. I wanted night + vignette for "dark room, closing in". The spec never says
   that a new `@filter` replaces the old one. (low, missing feature)
6. **`@ending` in a kinetic novel.** The spec says "no route ends without an `@ending` (unless the game is a kinetic novel)". It's not
   clear whether a kinetic novel *should* still mark its one ending, or which `kind=` to use. (low)
7. **W616 "visual change" is undefined.** It's not clear whether `@clear`, `@mode`, `@sound` or `@camera` reset the 30-line count. (low)
8. **play transcript ordering.** Effects at the end of one scene (before the `->` jump) print *under the next scene's header*
   (e.g. `· hide man` / `· sound chime` appear after `── after "After" ──`). It also prints `· change man grieving` before every line
   even when nothing changed. (low, tool UX)
9. **Narration that starts with a quoted phrase and a colon becomes dialogue without any warning.** In a probe (outside this game),
   `"Keep it": that's all he ever says.` gave 0 warnings and printed as `Keep it: that's all he ever says.`: the quotes were removed
   and it was treated as a one-off speaker. That is what the spec defines, but a W608-style warning would help. By contrast,
   `Receipt: one can, hot.` correctly gave E114 with a good hint. (low)
10. **stats counts mode by lines, not words.** For "mostly NVL", a share of words would be the better measure. (low)
11. **vndb "Reading segments: Median of 64 lines between choices"** reads oddly for a game with no choices. (low)

## Errors in the first check (excluding W602)

None.
