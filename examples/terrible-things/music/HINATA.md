# Hinata's tune and the kitchen chord

Reference for the cues that quote Hinata: `suzu_song` (her tune becomes the counter-melody over the kitchen chord) and `paper_lantern` (her tune on accordion in the bridge). The source is `morning_bread.lmn`.

- **Key:** F major. **Metre:** 6/8. **Tempo:** `tempo: 156`, so the dotted quarter (the felt 6/8 beat) is 104.
- **Instruments:** wooden flute (`flute`), accordion (`accordion`), acoustic guitar (`acoustic_guitar`), upright bass (`upright_bass`), and hand claps (`percussion`, lane `clap`).
- **Form:** Intro 4, A1 16, B 16, A2 16, C 8, A3 16, Outro 3. That's 79 bars, about 1:31.

## The kitchen chord

Fadd9, voiced **F3 A3 C4 G4**:

```lmn
[F3 A3 C4 G4]
```

This is the guitar's open Fadd9 shape. Read upward, the notes are F–A–C–G, the order the brief gives. In `morning_bread` the accordion holds this exact stack under every Fadd9 bar, and the guitar picks it as `F3e A3e C4e G4e C4e A3e`. The song ends with the accordion holding it alone. With a bass under it, the guitar's full shape is `[F2 C3 F3 A3 C4 G4]`. For `suzu_song`, sound `[F3 A3 C4 G4]` as written (any octave doubling is fine) under the climax.

**The tired bar** is the kitchen chord with its third flattened: F minor add9, **`[F3 Ab3 C4 G4]`**. Bar 8 of every A section plays it the same way each time:

- the melody freezes on G5,
- the accordion plays it at `!pp`,
- the guitar strums it once,
- the bass holds F2,
- the claps stop.

It never resolves; the next bar simply restarts the tune in major. This is Hinata's exhaustion, and it is free to borrow.

## Hinata's tune (the A strain, 16 bars, 6/8)

The head climbs the kitchen chord and lands on its ninth: **C5 F5 A5 G5**, all four notes from F–A–C–G. Then it lilts down A–G F–C. Bars 1–2 are the shortest quote that's still recognisably hers. Bars 1–4 are the comfortable phrase.

This is the exact text of the flute line in `morning_bread` (sections A1 and A3):

```lmn
// bars 1-8: ends on the tired bar (the run E F G stops on G and is held)
| C5e F5e A5e G5q. | A5q G5e F5q C5e | D5e F5e A5e G5q. | G5q F5e E5q C5e | F5e Bb5e D6e C6q. | C6q Bb5e A5q G5e | Bb5e A5e G5e E5e F5e G5e~ | G5h. |
// bars 9-16: the same run finally reaches A
| C5e F5e A5e G5q. | A5q G5e F5q C5e | D5e F5e A5e G5q. | G5q F5e E5q C5e | F5e Bb5e D6e C6q. | C6q Bb5e A5q G5e | Bb5e A5e G5e E5e F5e G5e | A5h. |
```

Harmony, one chord per bar (bar 7 has two):

```text
Fadd9 | Fadd9 | Gm7 | C7 | Bb(add9) | Am7 | Gm7 C7 | Fm(add9)
Fadd9 | Fadd9 | Gm7 | C7 | Bb(add9) | Am7 | Gm7 C7 | Fadd9
```

The range is C5–D6, which sits well on flute, accordion (as in A2), trumpet or glass harmonica.

**Second voice.** In A2 and A3 a line a third below goes with it. It uses the same rhythm, so it is useful if a cue wants the tune in thirds:

```lmn
| A4e C5e F5e C5q. | F5q E5e C5q A4e | Bb4e D5e F5e D5q. | E5q D5e C5q G4e | D5e F5e Bb5e A5q. | A5q G5e E5q E5e | G5e F5e D5e C5e D5e E5e | F5h. |
```

## The same tune in 4/4

Both versions below compile cleanly. Their pitches are identical to the 6/8 original, and their rhythms are in exact proportion to it (triplets keep the lilt).

### Slow: one 6/8 bar becomes one 4/4 bar (16 bars)

The mapping is eighth → `q3`, quarter → `h3`, dotted quarter → `h`, dotted half → `w`. This suits `suzu_song` at 66, where the counter-melody moves broadly under a hymn.

```lmn
| C5q3 F5q3 A5q3 G5h | A5h3 G5q3 F5h3 C5q3 | D5q3 F5q3 A5q3 G5h | G5h3 F5q3 E5h3 C5q3 | F5q3 Bb5q3 D6q3 C6h | C6h3 Bb5q3 A5h3 G5q3 | Bb5q3 A5q3 G5q3 E5q3 F5q3 G5q3~ | G5w |
| C5q3 F5q3 A5q3 G5h | A5h3 G5q3 F5h3 C5q3 | D5q3 F5q3 A5q3 G5h | G5h3 F5q3 E5h3 C5q3 | F5q3 Bb5q3 D6q3 C6h | C6h3 Bb5q3 A5h3 G5q3 | Bb5q3 A5q3 G5q3 E5q3 F5q3 G5q3 | A5w |
```

### Half: two 6/8 bars become one 4/4 bar (8 bars)

The mapping is eighth → `e3`, quarter → `q3`, dotted quarter → `q`, dotted half → `h`. This suits `paper_lantern`. At 144 it runs a little faster than the original, which is right for the caper. In `suzu_song` it gives a livelier counter-line.

```lmn
| C5e3 F5e3 A5e3 G5q A5q3 G5e3 F5q3 C5e3 | D5e3 F5e3 A5e3 G5q G5q3 F5e3 E5q3 C5e3 | F5e3 Bb5e3 D6e3 C6q C6q3 Bb5e3 A5q3 G5e3 | Bb5e3 A5e3 G5e3 E5e3 F5e3 G5e3~ G5h |
| C5e3 F5e3 A5e3 G5q A5q3 G5e3 F5q3 C5e3 | D5e3 F5e3 A5e3 G5q G5q3 F5e3 E5q3 C5e3 | F5e3 Bb5e3 D6e3 C6q C6q3 Bb5e3 A5q3 G5e3 | Bb5e3 A5e3 G5e3 E5e3 F5e3 G5e3 A5h |
```

Don't combine these triplet versions with `swing:`, because swing warps triplets (LMN-Spec 2.10).

## Keys in the other cues

- **`paper_lantern` (C major).** F is IV of C, so a bridge that moves to F can quote the tune at pitch with no transposition, over its own Fadd9.
- **`suzu_song` (D major).** Fadd9 is ♭III of D, a bright chromatic-mediant lift. The brief asks for that exact chord, so keep the tune in F where the kitchen chord sounds. Her held notes, G5 and A5, are also the 4th and 5th of D, so they braid with Suzu's figure. Her F and C naturals belong to the Fadd9 moment, so let Suzu's F♯ wait until the harmony returns to D.
- If a passage needs her tune in D without the chord, use `transpose=-3`.
