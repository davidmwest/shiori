# Leitmotifs: notes for the composers

Written alongside `glass_hill.lmn` (the overture and main theme). ASSETS.md is still the authority. This file records exactly what the main theme does, so the other five cues can quote it and transform it consistently. Everything marked *suggestion* is optional.

All pitches are absolute LMN pitches (`C4` is middle C). The key of `glass_hill` is **D major, leaning to B minor**, at 76 bpm in 4/4.

---

## 1. Suzu's figure

> "Five notes climbing and one falling, like someone starting up a staircase and changing her mind."

### Canonical form (use these pitches and durations unless the cue's key or metre forces a change)

```lmn
celesta | D5q E5q F#5q A5q | B5h. E5q~ | E5w |
```

- That is four quarters climbing D–E–F♯–A, a **dotted half on B**, then the **long falling E**. The E enters on beat 4 of the second bar and is tied through the third bar, so it lasts 5 beats.
- The pitch set is D-major pentatonic: D, E, F♯, A, B. **It never uses G or C♯.**
- **The E never resolves to D, except in `suzu_song`.** In `glass_hill` it is always left hanging: it rings over Em7 (and A7) and never reaches D, which is where she "changes her mind". Please keep that convention, so that when `suzu_song` finally lets the E fall to D, it lands as the first time.

### How `glass_hill` uses it
- It is played on the **celesta an octave up**, `D6q E6q F#6q A6q | B6h. E6q~ | E6w |`, at `!mp`/`!mf`, panned right. (A real celesta also sounds an octave above written pitch.)
- It appears in **bars 9, 17 and 33**: the fifth bar of every statement of the main theme (A1, A2, A3), always against the theme's climb to its high D6. It is always over the same harmony:

  | Figure | Chord under it |
  |---|---|
  | D E F♯ A (quarters) | Gmaj7 |
  | B (dotted half) | D/F♯ |
  | E (enters beat 4, held) | D/F♯ (beat 4), then Em7 (A1), or Em7 for 2 beats then A7 (A2, A3) |

- In A3 (bars 34–35) the glass harmonica (`halo_pad`) doubles the B and the E at the **canonical octave** (`B5h. E5q~ | E5w`), so that last statement is a little easier to hear.

### Instrument ranges to watch (the compiler warns outside them)
`celesta` and `music_box` C4–C8 (fine at D5 or D6) · `glockenspiel` G5–C8 (use D6) · `halo_pad`/`bowed_pad` C2–C6 (D5 is fine, but nothing above C6) · `trumpet` F♯3–D6 · `piccolo` D5–C8.

---

## 2. The Hill theme (the main melody)

The theme is built from one cell sung three times on the way up. The cell is a long note, a dip to the note below and back, then a **leap up a fifth that is tied over the bar line**. The held note therefore lands on the next chord as a 9th or a 7th, which is the light catching the glass.

### Melody in LMN (as the strings play it in A2; the piano plays it at the same pitch in A1)

```lmn
// open ending (A1): half cadence on E
melody | D5q. C#5e D5q A5q~ | A5h. G5e F#5e | B4q. A#4e B4q F#5q~ | F#5h. E5e D5e |
melody | G5q. F#5e G5q D6q~ | D6h. C#6e A5e | B5q. A5e G5q F#5q   | E5w          |

// closed ending (A2, A3, Outro): replace the last two bars with
melody | B5q. A5e G5q F#5e E5e | D5w |
```

In solfège (D = do): *do · ti do sol~ | sol · fa mi | la, · si, la, mi~ | mi · re do | fa · mi fa do'~ | do' · ti sol | la · sol fa mi | re* (or *… mi re | do*).

- **Range:** B4–D6. The peak is the D6 held from beat 4 of bar 5 through bar 6.
- **The A♯4 in bar 3** is the thread of unease: one chromatic glint, the B-minor leading note.
- **The "summit" cell starts on G** (`G5q. F#5e G5q D6q~`), the one D-major scale note Suzu's figure never uses apart from C♯. *Suggestion:* the bead Suzu "never uses in the song" (Nagi's) could ring **G**. It's a quiet link between Nagi's theme and the hole in Suzu's song. Nobody has to use it.

### Harmony

```
A:     D | Gmaj7 | Bm | Em7 | Gmaj7 | D/F# | Em7 | A7sus4 A7     (open)
                                             | Em7 A7 | D        (closed)
                                             | Em7 A7 | Bm7      (A3: deceptive)
```

The 9th suspensions (A over Gmaj7, F♯ over Em7) are the theme's fingerprint. When you harmonise a quotation, keep the tied note sounding over the new chord rather than re-striking it.

### Key areas and the rest of `glass_hill` (40 bars, 2:06)

| Section | Bars | Key / harmony | What happens |
|---|---|---|---|
| Intro | 1–4 | Gmaj7 · D/F♯ · Em7 · A7sus4 | Piano chimes in rising fourths and fifths (A5 D6 / A6, B5 E6 / B6), arpeggios, glass F♯5 |
| A1 | 5–12 | D major, half cadence | Piano melody; celesta figure from bar 9 |
| A2 | 13–20 | D major, full cadence | Strings melody, cello counter-melody, harp sparkles in the held bars; figure at bar 17 |
| B | 21–28 | **B minor, chromatic descent** | Cello climbs D4 E4 F♯4 G♯4 A4 A♯4 B4 C♯5 → D5 while the bass falls B A♯ A G♯ G F♯ E A: `Bm · F#7/A# · D/A · E/G# · A7/G · F#7 · Em7 · A7sus4 A7`. A glass F♯5 is held for bars 21–27 and moves only at the end. |
| A3 | 29–36 | D major → **Bm7** | Tutti: violins and cellos in octaves; figure at bar 33; deceptive cadence |
| Outro | 37–40 | Gmaj7 · D/F♯ · Em7 A7 · D | Piano alone finishes the phrase on D. The loop goes back to the Intro's Gmaj7. |

The cello's B-section line in LMN, in case anyone wants the "climb":
```lmn
cello | D4h. C#4e D4e | E4h. F#4e E4e | F#4h. E4e F#4e | G#4h. A4e G#4e | A4q. G4e A4q C#5q | A#4q. G#4e A#4q C#5q | B4q. A4e B4q E5q | D5h C#5h |
cbass | B1w | A#1w | A1w | G#1w | G1w | F#1w | E1w | A1w |
```

---

## 3. Hinata's kitchen chord

**F major add9 = F–A–C–G.** `morning_bread.lmn` (another composer's file; its header is the source of truth) voices it `F3 A3 C4 G4`, and at the time of writing it opens Hinata's tune with `C5 F5 A5 G5`, a climb up the chord to its ninth. Its "tired bar" flattens the A to A♭ (F minor add9).

**Fitting it into D major (`suzu_song`). Suggestion:** Fadd9 is ♭III in D. Suzu's falling **E** sounds beautiful over it: F A C G + E = **Fmaj9**, with no clash. Her F♯ and B do clash with it, so don't put the climbing notes over the chord. Put it **under the long falling E**:

```
D (climb D E F#) | G (A, then B held) | Fadd9 (the falling E over it = Fmaj9) | G | D ...
```

The F → G → D motion (♭III–IV–I) gets home warmly. That is the braid the brief asks for: her note held over Hinata's chord, and neither wins.

---

## 4. Suggestions for each cue

These are ideas, not instructions. The binding parts are the brief's plan and the conventions above (exact pitches; the E unresolved until `suzu_song`).

### `tamamori`: pompous waltz, 3/4, about 132, G major (B section E minor)
- All six notes (D E F♯ A B E) are diatonic to **G major and E minor**, so the figure can stay at its exact pitches.
- In 3/4 the canonical durations cut across the bar lines, which suits a lady who is slightly too grand for her own waltz:
  ```lmn
  lead | D5q E5q F#5q | A5q B5h~ | B5q E5h~ | E5h. |
  ```
  Dress it up with accents, a trill-like `B5s C6s B5s A5s` turn, or a harpsichord flourish on the last beat of each bar. Then let the bassoon blow a raspberry instead of the falling E.
- B section (music box, E minor): here the falling E lands on the tonic, which sounds like resignation rather than a change of mind. *Suggestion:* harmonise that E with Cmaj7 (E as its 3rd) so it still doesn't quite come home.

### `paper_lantern`: march, 4/4, about 144, C major
- Transpose the figure down a step: `C5 D5 E5 G5 | A5 (dotted half) | D5`. It's the main march tune on trumpets, so give it a jaunty rhythm that keeps the long A, e.g. `C5e. D5s E5e. G5s A5h~ | A5q rq D5h |`. The fall to D5 can be a bugle-call "huh?" with a woodblock answering.
- Hinata's tune in the bridge: modulate to **F major (IV of C)**, and her tune (`C5 F5 A5 G5`) appears on the accordion at its own pitch, over her own Fadd9. Then come back to C with the trumpets.
- The script cuts this cue with `@music stop fade=0.2` mid-phrase, so it never needs a cadence. Keep the momentum.

### `small_hours`: dread, about 60, nearly free
- Use **only D E F♯** at the exact pitches (D5 E5 F♯5, or an octave lower on bowed glass), then silence where the A should be.
- The fall: the story says Mr. Imai's bead is "a **flat E**, low and frightened". *Suggestion:* fall to a low **E4 that sags**: `E4h^ Eb4h` (the `^` glide is Extended in LMN, and the player supports it), or E4 and E♭4 together on two quiet glass/pad tracks so they beat against each other. LMN has no microtones, so these are the two honest ways to sound "slightly flat".
- The B section of `glass_hill` already has a lament bass (B A♯ A G♯ G F♯ E). A low string drone on B with that line crawling underneath would tie the dread to the hill.
- The Hill theme's neighbour-note cell (`D C# D`) slowed right down makes a two-note heartbeat.

### `suzu_song`: the hymn, about 66, 4/4, D major
- Open with the **canonical figure, complete, on solo glass harmonica** (`halo_pad`, or `celesta` doubled by `halo_pad`) at the canonical octave: `D5q E5q F#5q A5q | B5h. E5q~ | E5w |`.
- This is the only cue where the **E resolves to D**. Save it for the very end, as the brief says ("holds on the falling note, then resolves to D").
- Second verse: Hinata's tune as counter-melody over the Fadd9 placed under the falling E (section 3).
- *Suggestion:* the Hill theme's closing phrase (`B5q. A5e G5q F#5e E5e | D5w`) under or after the final resolution would close the circle with the overture, since the town's theme and her song end on the same D.
- *Suggestion:* for the "lopsided, slightly flat wind chime" last note, a single high celesta or music-box note with a tiny `^` glide down (`D6e^ C#6e`, or an off-pitch G if you take up the "unused note" idea) reads as lopsided without needing microtones.

### `morning_bread`
Already written. Nothing to add, except that if it wants a wink at the main theme, the Hill theme's neighbour cell (`do · ti do`) fits naturally as `F5q. E5e F5q` in F major.

---

## 5. A practical note on looping (measured in the engine)

The LMN player (`Player.tick` in `engine/vendor/lmn/lmn-synth.js`) ends a song when playback reaches **duration + 0.6 s**. It fades the old voices out over about 20 ms, then `engine/runtime/audio.js` restarts it from 0, with the first notes 0.08 s later. So:

- every loop has a gap of about 0.7 s, and any reverb tail still ringing is cut;
- a pickup into the first bar won't survive the loop. End on something that has mostly decayed, and start the first bar on its downbeat.

`glass_hill` ends its last bar with `h.` plus a quarter rest, so the tails have about 1.4 s to fade before the cut. It also starts the loop on IV (Gmaj7) after the final D, so the restart sounds like the next breath.

Checking songs: `bin/shiori check examples/terrible-things` reports LMN errors and W617 warnings (out-of-range notes count as warnings).
