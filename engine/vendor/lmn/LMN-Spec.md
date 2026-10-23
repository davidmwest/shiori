# LMN — LLM Music Notation

**Specification v1.0** · song files are plain text (`.txt`) · pronounced "lemon"

LMN is a plain-text format for complete song arrangements: any number of instruments, a full drum kit, chord symbols, dynamics and sung lyrics. It is designed to be **written by language models** and **played by software**. It is compact, line-based and forgiving: every bar is anchored to its own place in time, so a mistake inside one bar never pushes the rest of the song out of sync.

**If you are an AI model reading this document:**

- **To write a song:** read Part 1 (quick reference), Part 2 (the rules), Part 3 (songwriting guide) and the full example in Part 5. Output the finished song in a single fenced code block tagged `lmn`.
- **To build a player, converter or editor:** read everything. Part 4 is the implementation guide; Appendices A–D hold the lookup tables and the grammar.

## Contents

- Part 1 — Quick reference
- Part 2 — Format specification (the rules)
- Part 3 — Songwriting guide for language models
- Part 4 — Implementation guide for players and tools
- Part 5 — Complete example song
- Appendix A — Instruments
- Appendix B — Drum lanes
- Appendix C — Chord symbols
- Appendix D — Grammar and token patterns

## Design principles

1. **What you write is what sounds.** Pitches are absolute (`F#4`, `Bb3`). The key signature is information only and never changes a note.
2. **Bars are anchored.** Each bar starts at a fixed time. A bar with too few or too many beats is padded or trimmed, never shifting later bars.
3. **No hidden state.** Every note carries its own duration.
4. **Write once, arrange many.** Sections are written once and arranged with a `form:` line. Variations (new lyrics, a key change, a drum fill) are made with `extends=`.
5. **Drums are grids.** One group of characters per beat, so patterns can be read at a glance.
6. **Lyrics live on the notes.** Each sung note carries its syllable, so words can never drift out of alignment with the melody.

---

# Part 1 — Quick reference

## A complete small song

```lmn
LMN 1
title: Quick Example
tempo: 96
time: 4/4
key: C major

track vox    voice
track keys   electric_piano  octave=4
track bass   bass
track drums  drums

section Verse bars=2
vox          | rq E4e:the G4e:sun C5q:is B4q:up/ | A4e.:the G4s:sky G4e:is E4e:o- D4h:pen/ |
keys         | {C}h {C}h | {Am}h {G}h |
bass         | C2q C2q C2e G2e C3q | A1q A1q G1h |
drums.kick   | x... .... x.x. .... | x... .... x.x. .... |
drums.snare  | .... x... .... x... | .... x... .... x..o |
drums.hat    | x.x. x.x. x.x. x.x. | % |

form: Verse*2
```

## Cheat sheet

| You write | Meaning |
|---|---|
| `C4q` | C in octave 4 (middle C), quarter note |
| `F#3e.` | F♯3, dotted eighth note |
| `Bb4h~` | B♭4, half note, tied into the next note |
| `rq` · `re` · `rs` | quarter rest · eighth rest · sixteenth rest |
| `R` | rest for the whole bar (must be alone in its bar) |
| `[C4 E4 G4]h` | several pitches struck together, half note |
| `{Am7}h` | chord symbol, voiced automatically by the player, half note |
| `E4e3` | eighth-note triplet (three of them fill one beat) |
| `C4q>` · `C4q'` | accented · staccato |
| `G4q:love` | sung note with the syllable "love" |
| `G4e:sun- E4e:shine` | a trailing `-` means the word continues on the next note |
| `E4h:night/` | a trailing `/` ends a lyric line |
| `!p` · `!mf` · `!ff` | change dynamics for the following notes |
| `%` | repeat the previous bar of this line (must be alone in its bar) |
| `C2e*8` · `(A3s C4s E4s C4s)*4` | repeat a token or a group inside a bar |
| `.... x... .... x...` | a drum bar: one group of characters per beat (see below) |
| `x` `X` `o` `.` | drum hit · accented hit · ghost (soft) hit · silence |
| `section Verse2 extends=Verse1` | copy a section, then replace only the lines you rewrite |
| `form: Intro Verse Chorus*2 Outro` | the order sections play in (`*2` = twice) |

## Durations

Lengths are counted in **beats**, where one beat is a quarter note.

| Letter | Note | Beats | Dotted `.` (×1.5) | Triplet `3` (×2/3) |
|---|---|---|---|---|
| `w` | whole | 4 | `w.` = 6 | `w3` = 8/3 |
| `h` | half | 2 | `h.` = 3 | `h3` = 4/3 |
| `q` | quarter | 1 | `q.` = 1.5 | `q3` = 2/3 |
| `e` | eighth | 1/2 | `e.` = 3/4 | `e3` = 1/3 |
| `s` | sixteenth | 1/4 | `s.` = 3/8 | `s3` = 1/6 |
| `t` | thirty-second | 1/8 | `t.` = 3/16 | `t3` = 1/12 |

Double-dotted `..` multiplies by 1.75 (`q..` = 1.75 beats).

## Bar lengths

| Time signature | Beats per bar (quarter = 1) | Drum groups per bar | One drum group spans |
|---|---|---|---|
| `4/4` | 4 | 4 | a quarter note |
| `3/4` | 3 | 3 | a quarter note |
| `2/4` | 2 | 2 | a quarter note |
| `5/4` | 5 | 5 | a quarter note |
| `2/2` | 4 | 2 | a half note |
| `6/8` | 3 | 2 | a dotted quarter (three eighths) |
| `9/8` | 4.5 | 3 | a dotted quarter |
| `12/8` | 6 | 4 | a dotted quarter |
| `5/8` | 2.5 | 5 | an eighth note |
| `7/8` | 3.5 | 7 | an eighth note |

A **pulse** is one 1/D note of the time signature N/D, except in compound meters (D is 8 or 16 and N is divisible by 3), where a pulse is three of them: a dotted quarter in 6/8, 9/8 and 12/8.

## The ten rules that matter most

1. Every bar on every line must add up to exactly the bar length (4 beats in 4/4).
2. Inside a section, every line has the same number of bars.
3. Pitches are absolute. Write every sharp and flat on every note; the `key:` field changes nothing.
4. Every note and rest carries a duration letter. `C4` alone is invalid; write `C4q`.
5. Middle C is `C4`. Bass parts live mostly in octaves 1–2, melodies in octaves 4–5.
6. Every drum bar has exactly one group per pulse: four groups in 4/4, three in 3/4, two in 6/8.
7. Chord symbols go in braces: `{Am7}h`, never `Am7h`.
8. One syllable per sung note. Split words with a trailing hyphen: `G4e:beau- A4e:ti- B4q:ful`.
9. Use `%`, `extends=` and `form:` instead of rewriting music.
10. Output the whole song in one fenced code block tagged `lmn`.

---

# Part 2 — Format specification

The words MUST, SHOULD and MAY are used as in RFC 2119. Features marked **(Extended)** are optional for players: a player that does not support one MUST ignore it and still play everything else.

## 2.1 Lines, comments and names

An LMN song is a UTF-8 plain-text file, saved with the extension `.txt` (players also accept `.lmn`). Its first line, `LMN 1`, identifies the format. The file is made of lines. Each line is exactly one of: a blank line, the version line, a header field, a track declaration, a section header, a body line, or a form line.

- **Comments.** `//` starts a comment when it is at the start of a line or preceded by whitespace. The comment runs to the end of the line. (`https://…` inside a header value is therefore safe.)
- **Whitespace.** Spaces and tabs are interchangeable, runs of whitespace count as one, and indentation has no meaning.
- **Track names** use lowercase letters, digits and `_`, and start with a letter: `vox`, `bass`, `gtr2`, `strings_hi`. The names `tempo`, `track`, `section` and `form` are reserved.
- **Section names** use letters, digits, `_` and `-`, and start with a letter: `Intro`, `Verse1`, `Pre-Chorus`, `Chorus_Final`. They are case-sensitive.
- **Keywords** (`track`, `section`, `form`) are lowercase.

A player classifies each line, after removing comments and trimming, by the first rule that matches:

1. Empty, or a Markdown code fence (a line that starts with three backtick characters, which appears when a song is copied out of a chat) → ignore.
2. Starts with `LMN` followed by a space → version line.
3. Starts with `track` followed by a space → track declaration.
4. Starts with `section` followed by a space → section header.
5. Starts with `form:` → form line.
6. Looks like `name: value`, where the value does not start with `|` → header field. (So a title may contain `|`.)
7. Contains `|` → body line. It belongs to the most recent section header.
8. Anything else → error (reported, then ignored).

## 2.2 Version line and header fields

The first line SHOULD be the version line:

```lmn
LMN 1
```

Players SHOULD accept a file without it and assume version 1.

Header fields have the form `name: value` and appear before the first section. Names are case-insensitive. (A player that finds one later applies it anyway and reports a warning.)

| Field | Value | Default | Meaning |
|---|---|---|---|
| `title` | text | `Untitled` | Song title |
| `artist` | text | none | Artist or author |
| `tempo` | number, 20–400 | `120` | Quarter notes per minute, in every time signature |
| `time` | `N/D` | `4/4` | Time signature. N is 1–32; D is 1, 2, 4, 8 or 16 |
| `key` | text, e.g. `A minor` | none | Information only. It never changes any pitch |
| `swing` | number, 50–75 | `50` | Swing amount (see 2.10). 50 means straight |
| `swing_unit` | `8` or `16` | `8` | Which note value swings |
| `transpose` | integer semitones | `0` | Shifts every pitched note in the song |

Any other field (for example `genre`, `mood`, `description`, `notes`) is allowed. Players ignore it but MAY show it.

## 2.3 Tracks

A track is one instrument. Declare each track on its own line, normally right after the header:

```text
track <name> <instrument> [attribute=value ...]
```

```lmn
track vox    voice
track keys   piano           vol=70 pan=-20
track pad    pad             vol=45 octave=3
track bass   bass
track gtr    clean_guitar    pan=35
track drums  drums
```

- `<instrument>` is a name from Appendix A. A track whose instrument is a drum kit (`drums`, `drums_rock`, `drums_electronic`, `drums_808`, `drums_jazz`, `drums_brush`, `percussion`) is a **drum track**. Every other track is a **pitched track**.
- Attributes:

| Attribute | Range | Default | Meaning |
|---|---|---|---|
| `vol` | 0–100 | `80` | Track loudness |
| `pan` | −100 to 100 | `0` | Stereo position; −100 is hard left, 100 hard right |
| `octave` | 0–8 | `4` | Register used to voice chord symbols on this track: chord roots fall between G(octave−1) and F#(octave) (Appendix C) |
| `reverb` | 0–100 | `20` | **(Extended)** Reverb amount |

- Track names MUST be unique. Up to 16 tracks are recommended, because MIDI export has 16 channels (one is reserved for drums).

## 2.4 Sections and body lines

A section is a block of bars that plays as a unit: an intro, a verse, a chorus. It starts with a section header and contains body lines, until the next section header or the end of the file.

```text
section <Name> [attribute=value ...]
<target> | <bar> | <bar> | <bar> | ...
```

Section attributes:

| Attribute | Example | Meaning |
|---|---|---|
| `bars` | `bars=8` | Declared number of bars, used as a check. Recommended on every section; a section made with `extends=` inherits it |
| `extends` | `extends=Verse1` | Start as a copy of another section (2.11) |
| `tempo` | `tempo=84` | Tempo for this section |
| `time` | `time=3/4` | Time signature for this section |
| `swing` | `swing=62` | Swing for this section |
| `swing_unit` | `swing_unit=16` | Swing unit for this section |
| `transpose` | `transpose=2` | Semitones added to the song's `transpose` for this section |
| `mute` | `mute=vox,drums.hat` | Comma-separated tracks or targets that are silent in this section; `mute=none` clears an inherited list |
| `key` | `key=D_major` | Information only |

Attributes not given take the header values (or, with `extends`, the parent's values). Attribute values cannot contain spaces, and there are no spaces around `=`.

**Body lines.** A body line is a **target**, a `|`, and then bars separated by `|`:

```lmn
bass         | A1q A1q A2e G2e E2q | F1q F1q F2e E2e C2q |
drums.kick   | x... .... x.x. .... | x... .... x... ..x. |
```

- The target is a track name (`bass`), a drum lane (`drums.kick`, see 2.7), or a voice of a pitched track (`piano.left`, see below).
- The first `|` separates the target from the music. After it, each `|` ends a bar. A trailing `|` is optional. Empty bar segments (as in `||`) are ignored, so a double bar line is harmless. A silent bar must be written as `R`.
- A target can appear on several lines in the same section. Its bars are joined in order, so a `%` at the start of a line repeats the last bar of the previous line. Write long sections as several systems of four bars each:

```lmn
section Verse bars=8
// bars 1-4
vox    | E4h G4h | A4w | G4h E4h | D4w |
bass   | C2w | F1w | C2w | G1w |
// bars 5-8
vox    | E4h G4h | A4h C5h | B4h G4h | C5w |
bass   | C2w | F1w | G1w | C2w |
```

- **Every target in a section MUST have the same number of bars.** The section's length is the number of bars in its longest line (a `tempo` line does not count). If `bars=` is given, it MUST equal that length; players report a mismatch.
- A track that has no line in a section is silent for that section.
- **Voices.** A pitched track can have extra independent lines called voices: `piano.left` and `piano.right` are two separate lines played on the same piano. The voice name follows the rules for track names. `piano` on its own is the main voice. Use voices when one instrument plays two independent rhythms at once, such as a pianist's two hands.

## 2.5 Form

The form line lists the order in which sections play:

```lmn
form: Intro Verse1 Chorus Verse2 Chorus Bridge Chorus*2 Outro
```

- Each item is a section name, optionally followed by `*N` (N is 1 or more) to play it N times in a row. Write repeats only this way; some players also accept `Chorus x2`, but do not rely on it.
- A section can appear any number of times.
- Several `form:` lines are joined in order.
- Without a form line, every section plays once in the order it is defined.
- Unknown section names are reported and skipped. If no name in the form is known, nothing plays.

## 2.6 Pitched tracks

A bar on a pitched track is a sequence of tokens separated by whitespace. They play one after another, starting at the beginning of the bar.

### Pitch

`<letter><accidental><octave>`

- Letter: `A`–`G`, always uppercase.
- Accidental (optional): `#` sharp, `b` flat, `##` double sharp, `bb` double flat.
- Octave: one digit, `0`–`9`. Scientific pitch notation: **`C4` is middle C (MIDI 60)** and `A4` is 440 Hz. The octave number changes between B and C, so `B3` is the note just below `C4`.
- MIDI number = 12 × (octave + 1) + step + alteration, with steps C=0, D=2, E=4, F=5, G=7, A=9, B=11 and alterations `#`=+1, `b`=−1, `##`=+2, `bb`=−2. So `Cb4` = 59 and `B#3` = 60.

Pitches are absolute. The `key:` field never adds sharps or flats; write them on every note.

### Duration

`<letter><dots><triplet>`

- Letter: `w` whole (4 beats), `h` half (2), `q` quarter (1), `e` eighth (1/2), `s` sixteenth (1/4), `t` thirty-second (1/8). A beat is always a quarter note.
- Dots (optional): `.` multiplies by 1.5, `..` by 1.75.
- Triplet (optional): `3` multiplies by 2/3. Three `e3` fill one beat; three `q3` fill two beats.
- Order is always letter, dots, triplet. Every note and rest MUST have a duration.

### Tokens

| Token | Form | Examples |
|---|---|---|
| Note | pitch + duration + modifiers + lyric | `G4q` `F#4e.` `A4h~` `C5e>:love` |
| Rest | `r` + duration | `rq` `re.` `rs` `rh` |
| Bar rest | `R` | silent for the whole bar; MUST be the only token in its bar |
| Note stack | `[` pitches `]` + duration + modifiers + lyric | `[C4 E4 G4]h` `[D3,A3]q>` |
| Chord symbol | `{` symbol `}` + duration + modifiers + lyric | `{Am7}h` `{G/B}q` `{F#m7b5}w` |
| Dynamic | `!` + level | `!p` `!mf` `!ff`; takes no time |
| Bar repeat | `%` | the previous bar of this target in this section, repeated exactly (with its dynamics, ties and lyrics); MUST be the only token in its bar |

- **Repeats inside a bar.** `TOKEN*N` repeats a token N times and `(TOKENS)*N` repeats a group, before the bar is counted: `C2e*8` is eight C2 eighth notes (4 beats), `(A3s C4s E4s C4s)*4` is a sixteen-note arpeggio, and `[C4 E4 G4]q*4` is four chord stabs. N is 1–64. Lyrics are repeated too, so leave them off repeated notes.
- In a note stack, pitches are separated by spaces or commas. All of them start together and share the duration. A pitch listed twice sounds once.
- Rests cannot carry modifiers or lyrics; players ignore them and report it.
- A chord symbol is voiced by the player using the track's `octave` attribute (Appendix C). Use chord symbols for pads, organ, comping keys and strummed parts; write notes or stacks when the exact voicing matters.

### Modifiers

Modifiers follow the duration, in any order, before the lyric.

| Modifier | Name | Effect |
|---|---|---|
| `~` | tie | Hold into the next note of the same pitch on this line. The next note is not struck again; its length is added |
| `>` | accent | Louder (velocity +20) |
| `'` | staccato | Short: sounds for about half its length |
| `^` | glide | **(Extended)** Slide in pitch into the next note on this line, without re-striking it |

Ties can cross bar lines and section boundaries. Ties are how a note lasts longer than the bar it starts in:

```lmn
lead | C5h. D5q~ | D5h rh |
```

Here D5 starts on beat 4 and is held until the middle of the next bar.

## 2.7 Drum tracks

A drum track has one line per drum sound, called a **lane**. The target is `<track>.<lane>`, with lane names from Appendix B (`kick`, `snare`, `hat`, `openhat`, `crash`, `ride`, `tom_hi`, `clap`, …).

A drum bar is a row of **groups** separated by spaces, **exactly one group per pulse** of the time signature. The pulse is one 1/D note, or a dotted quarter in compound meters such as 6/8, so there are 4 groups in 4/4, 3 in 3/4, 2 in 2/2, 2 in 6/8, 4 in 12/8 and 7 in 7/8 (see the table in Part 1). Each group is a string of step characters, and its length splits that pulse into equal steps:

| Group length | Steps when the pulse is a quarter note (4/4, 3/4) | Typical use |
|---|---|---|
| 1 | quarter notes | `x` |
| 2 | eighth notes | `x.` |
| 3 | eighth-note triplets | `x.x` (shuffle) |
| 4 | sixteenth notes | `x.x.` |
| 6 | sixteenth-note triplets | `x.x.x.` |
| 8 | thirty-second notes | `xxxxxxxx` (roll) |

Groups in the same bar may have different lengths. In compound meters such as 6/8 or 12/8, a group spans a dotted quarter, so a group of 3 is three eighth notes and a group of 6 is six sixteenths.

| Character | Meaning |
|---|---|
| `x` | hit |
| `X` | accented hit (velocity +20) |
| `o` | ghost note, soft (velocity × 0.4) |
| `.` | silence (`-` is also accepted) |

Repeats work in drum bars too: `x.x.*4` is four groups. A group containing any other character is an error; it stays silent but still uses its pulse. A drum bar may also be `R` (silent bar) or `%` (repeat previous bar). Dynamic tokens such as `!f` may appear anywhere in a drum bar, separated by spaces; they do not count as groups and affect the hits after them: `.... .... !mp xxxx !f xxxx`.

```lmn
section Groove bars=2
drums.kick    | x... .... x.x. .... | x... ..x. x... .... |
drums.snare   | .... x... .... x... | .... x... .... x.xx |
drums.hat     | x.x. x.x. x.x. x.x. | x.x. x.x. x.x. x.X. |
drums.crash   | x... .... .... .... | R |
```

An open hi-hat (`openhat`) keeps ringing until the next `hat` or `pedalhat` hit on the same track. Players SHOULD cut it off at that point.

## 2.8 Lyrics

Any note, note stack or chord symbol can carry a lyric: a colon followed by text, at the very end of the token.

```lmn
vox | rq E4e:I G4e:can C5q:see B4e:the A4e:light/ | G4q.:shin- E4e:ing D4h:through/ |
```

- **One syllable per note.** A syllable ending in `-` continues the same word on the next sung note. Players join `shin-` + `ing` into "shining".
- A sung note **without** a lyric continues the previous syllable (a melisma). `G4e:yeah A4e G4q` sings "yeah" across three notes. A note tied into from the previous one is part of the same sung note and never needs a lyric.
- A trailing `/` marks the end of a lyric line, for display. Put it on the line's last syllable, even when that note is held or tied further.
- `_` displays as a space, for several words on one note: `C4e:and_I`.
- Punctuation is allowed: `D4h:night,` `C5q:Hey!`. Everything after the colon belongs to the lyric, so apostrophes are safe even next to the staccato mark: `C4q:don't`, `C4q':there's`. Lyrics cannot contain whitespace or `|`, and are not quoted.
- Rests cannot carry lyrics.
- Several tracks can carry lyrics (lead vocal, harmonies, backing "oohs"). A muted target produces no notes and no lyrics.

Players SHOULD display lyrics in time with the music. Players are not expected to sing actual words: playing the melody with a voice-like sound and showing the lyrics is normal.

## 2.9 Dynamics

| Token | `!ppp` | `!pp` | `!p` | `!mp` | `!mf` | `!f` | `!ff` | `!fff` |
|---|---|---|---|---|---|---|---|---|
| MIDI velocity | 16 | 33 | 49 | 64 | 80 | 96 | 112 | 127 |

- Every target starts every section at `!mf` (velocity 80). Each drum lane and each voice is its own target, so `!p` on `drums.kick` does not change `drums.snare`.
- A dynamic token changes the velocity of the following notes on the same target, until another dynamic token or the end of that section. A dynamic at the end of a bar affects the bars after it.
- Accents (`>`, drum `X`) add 20, capped at 127. Drum ghost notes (`o`) are 0.4 × the current velocity.
- The track's `vol` attribute scales the whole track and is separate from velocity. To keep a part quiet everywhere, lower its `vol` rather than restating a dynamic in every section.

## 2.10 Timing

- **Bars are anchored.** Bar k of a section starts exactly where bar k−1 ends, according to the time signature, no matter what the bars contain. If the tokens of a bar add up to less than the bar length, the rest of the bar is silent. If they add up to more, everything past the bar line is cut off. Players MUST report both cases. Because of this, an error in one bar never shifts any other bar or any other track.
- **Bar length** in beats is 4 × N ÷ D for time signature N/D. A beat is a quarter note.
- **Tempo** is quarter notes per minute in every time signature, so one beat lasts 60 ÷ tempo seconds. For 6/8 with a dotted quarter at 80, write `tempo: 120`.
- **Ties** join a note with `~` to the next sounding token on the same target if that token contains the same pitch and starts exactly where the tied note ends. For stacks and chord symbols, each shared pitch is tied and the other pitches start and stop normally. A tie followed by a rest, a gap (for example a bar that is too short) or a different pitch is ignored and reported.
- **Swing.** With `swing` = S (50–75), each swing span (one beat for `swing_unit: 8`, half a beat for `swing_unit: 16`) is time-warped. With s = S ÷ 100, a position p inside the span (0 ≤ p < 1) moves to p × 2s when p < 0.5, and to s + (p − 0.5) × 2(1 − s) otherwise. The warp applies to note starts, note ends and drum steps. In practice, `swing_unit: 8` delays the second eighth note of every beat and `swing_unit: 16` delays the second sixteenth of every eighth-note pair. S = 50 is straight; about 58 is a light swing; 62 medium; 67 a triplet shuffle; 75 a hard dotted swing. Swing warps every position, including triplets and drum groups of 3 or 6, so do not combine swing with triplets. Swing never moves a bar line: if a bar is not a whole number of swing spans long (7/8, for example), the leftover part at its end is not swung.
- **Transpose.** The effective transposition of a section is the header `transpose` plus the section's `transpose`. It shifts every pitched note, including chord symbols. It never affects drums.

## 2.11 Section inheritance: `extends`

`section Verse2 extends=Verse1` creates a section that starts as a complete copy of `Verse1`:

1. Every attribute and every body line of the parent is copied. Chains are allowed (C extends B extends A); cycles are errors.
2. The child's own attributes override the parent's.
3. Each target the child writes **replaces that target's bars completely** (all of the parent's lines for it). Targets the child does not write are kept, and targets the parent lacks are added. Each drum lane and each voice is its own target, so writing only `drums.crash` replaces or adds only the crash lane.

```lmn
section Verse2 extends=Verse1                     // same music, new words
vox | rq G4e:Hold A4e:it B4q:till A4q:the | G4h:flame E4h:burns/ |

section Chorus_Up extends=Chorus transpose=2      // final chorus, one step higher

section Chorus_Inst extends=Chorus mute=vox       // instrumental chorus

section Chorus_Fill extends=Chorus                // same 4-bar chorus, drum fill at the end
drums.snare   | .... x... .... x... | % | % | .... x... xx.. .... |
drums.tom_hi  | R | R | R | .... .... ..xx .... |
drums.tom_mid | R | R | R | .... .... .... xx.. |
drums.tom_low | R | R | R | .... .... .... ..xx |
```

## 2.12 Tempo lane (Extended)

A section may contain a `tempo` line with one entry per bar, to change tempo inside the section:

```lmn
section Outro bars=4
tempo | . | . | >100 | >72 |
```

- A number sets the tempo at the start of that bar.
- `>N` changes the tempo smoothly (linearly in BPM) from its current value to N across that bar.
- `.` keeps the current tempo. A tempo line has one entry per bar; missing entries keep the current tempo, and the tempo line does not count toward the section's length.
- Each section starts at its own tempo (section attribute, else header), whatever the previous section did.

## 2.13 Errors and robustness

Players MUST NOT stop on errors. They report each problem with its line number and play everything they can:

| Problem | Player behaviour |
|---|---|
| Bar shorter or longer than the time signature | Pad with silence, or cut at the bar line |
| Lines in a section with different bar counts | Pad the short lines with silent bars |
| Drum bar with the wrong number of groups | Missing groups are silent; extra groups are ignored |
| Unknown token | Skip it (it takes no time) |
| Modifiers or a lyric on a rest | Ignore them; the rest keeps its length |
| Token whose length is readable but whose pitch is not (a stack with a bad pitch, an unknown chord symbol) | Keep its length; play the valid pitches, or stay silent |
| Body line for an undeclared track or unknown drum lane | Skip the line |
| Unknown instrument | Use a similar instrument, or `piano` |
| Unknown chord quality | Play the root's major triad (a minor triad if the quality starts with `m` but not `maj`, or with `min` or `-`) |
| Unknown section in `form:` | Skip it |
| Section defined twice | Use the first definition |
| Number out of range (tempo, vol, pan, swing, octave…) | Clamp it to the allowed range |
| Instrument or lane name in capitals | Accept it (names are matched case-insensitively) |
| `%` in the first bar of a line | Treat as `R` |
| Tie that cannot connect | Ignore the tie |

---

# Part 3 — Songwriting guide for language models

## 3.1 Workflow

1. **Plan in comments.** At the top of the file, write the genre, tempo, key, form, the chord progression of each section and the job of each instrument as `//` comments. Planning first makes the parts agree. To hit a target length: seconds = total bars × beats per bar × 60 ÷ tempo (64 bars of 4/4 at 100 BPM is 154 seconds).
2. **Declare the tracks**, choosing instruments from Appendix A.
3. **Write each section once**, in this order: harmony (chords), bass, drums, then melody with lyrics.
4. **Make variations with `extends=`**: verse 2 with new lyrics, a chorus with a fill, a final chorus a step higher.
5. **Write the `form:` line.**
6. **Check everything against the checklist in 3.10**, then output the file in one fenced code block tagged `lmn`, with no prose inside it except `//` comments. (The fence is for chat replies. A saved song file is just the text; players ignore fence lines if they are pasted in.)

## 3.2 Arranging: give every track a job

| Role | Typical instruments | What it does |
|---|---|---|
| Groove | `drums` and its lanes | Sets the feel. Kick and snare define the beat; hats or ride keep time |
| Foundation | `bass`, `synth_bass`, `upright_bass` | Root of each chord on its first beat; locks with the kick |
| Harmony | `piano`, `electric_piano`, `pad`, `organ`, `acoustic_guitar`, `strings` | Chords, usually as `{chord}` symbols or stacks |
| Lead | `voice` (with lyrics), `saw_lead`, `trumpet`, `alto_sax` | The melody. Only one lead at a time |
| Counter-line | `strings`, `clean_guitar`, `flute`, `synth_pluck` | Answers the melody in its gaps; hooks in intros |
| Colour | `glockenspiel`, `choir`, `percussion` lanes | Sparing extras that mark section changes |
| Harmony vocal | a second `voice` track | Same rhythm and syllables as the lead, usually a third above; often only in choruses. Give it its own lyrics on the same notes |

Arrangement habits that sound professional:

- **Contrast between sections.** Verses thinner, choruses fuller and higher. Bring instruments in and out with `mute=` or by leaving tracks out of a section.
- **Mark the downbeat of each new section** with a crash plus kick, and end the previous section with a short fill.
- **Leave space.** When the vocal sings, counter-lines rest; they fill the gaps between phrases.
- **Keep registers apart.** Bass below C3, chords around C3–C5, melody above them.
- **Hold the pad, move the keys.** Pads use long notes (`w`, `h`); piano or guitar carry the rhythm.

## 3.3 Comfortable ranges

| Part | Range | Sweet spot |
|---|---|---|
| Lead vocal, lower voice | A2–A4 | C3–F4 |
| Lead vocal, higher voice | F3–F5 | A3–D5 |
| Bass, upright bass | E1–G3 | E1–C3 |
| Piano or keys chords | C3–C6 | C3–C5 (`octave=4`) |
| Pad | C2–C6 | C3–C5 (`octave=3` or `4`) |
| Guitar | E2–E5 | E2–B4 |
| Lead synth | C3–C7 | C4–C6 |
| Strings section | C2–C7 | G3–G5 |
| Fiddle, violin | G3–E7 | D4–A5 |
| Trumpet | F#3–D6 | C4–G5 |
| Alto saxophone | Db3–Ab5 | A3–E5 |
| Flute | C4–C7 | G4–G6 |

After a `transpose=`, check the top and bottom notes again: a final chorus moved up two semitones also moves the melody's highest note up two.

## 3.4 Melody and lyrics

- Write the lyric line first. Split it into syllables, then give each syllable one note (or several for a melisma).
- Put **stressed syllables on strong beats** (beats 1 and 3 in 4/4; beat 1 in 3/4; the two dotted-quarter pulses in 6/8) and unstressed ones on weak beats or off-beats.
- Hyphenate inside words: `beau- ti- ful` becomes `G4e:beau- A4e:ti- B4q:ful`; `to- night`, `a- way`, `ev- ery- thing`, `mo- ment`.
- Phrases are usually 2 or 4 bars long. Leave a rest of at least an eighth note between phrases for breath.
- Mostly stepwise motion, with an occasional leap of a 4th to an octave, usually followed by a step back.
- On strong beats, use notes that belong to the chord underneath. Use other scale notes as passing notes on weak beats.
- The **chorus** is higher, simpler and more repetitive than the verse. Repeat its hook line at least twice.
- Pickup notes (sung before the first downbeat of a section) belong at the end of the previous section's last bar. If that section is also followed by other sections, make a variant for the pickup (`section Verse_to_Chorus extends=Verse` with the vocal line rewritten). A song that starts with a pickup can begin with a short section such as `section Pickup time=2/4`.

## 3.5 Harmony

- Know the key's sharps and flats, because you must write them on every note:

| Key (major / relative minor) | Sharps or flats |
|---|---|
| C major / A minor | none |
| G major / E minor | F# |
| D major / B minor | F# C# |
| A major / F# minor | F# C# G# |
| E major / C# minor | F# C# G# D# |
| F major / D minor | Bb |
| Bb major / G minor | Bb Eb |
| Eb major / C minor | Bb Eb Ab |
| Ab major / F minor | Bb Eb Ab Db |

- Choose a progression per section and write it as chord symbols. Common progressions (shown in C major and A minor):

| Feel | Roman numerals | In C major | In A minor |
|---|---|---|---|
| Pop anthem | I – V – vi – IV | C G Am F | — |
| Pop, minor flavour | vi – IV – I – V | Am F C G | Am F C G |
| Doo-wop / ballad | I – vi – IV – V | C Am F G | — |
| Rising lift | IV – V – iii – vi | F G Em Am | — |
| Minor drive | i – VI – III – VII | — | Am F C G |
| Minor descent | i – VII – VI – V | — | Am G F E |
| Jazz turnaround | ii7 – V7 – Imaj7 | Dm7 G7 Cmaj7 | Bm7b5 E7 Am7 |
| 12-bar blues | I7 ×4, IV7 ×2, I7 ×2, V7, IV7, I7, V7 | C7 … F7 … G7 | — |

- One chord per bar or two chords per bar is typical. Change chords on beat 1 (and beat 3).
- Pads hold `{chord}w`. Piano comping rhythms: `{C}q {C}e {C}e rq {C}q`, or a stack pattern.
- The `octave` attribute sets the register of chord symbols (`octave=4` puts roots between G3 and F#4). See Appendix C.

## 3.6 Bass, guitar, keys and horns

- Play the chord root on beat 1 of every chord, in octave 1 or 2.
- Follow the kick drum's rhythm: where the kick hits, the bass usually plays.
- Approach the next chord with a passing note on the last eighth of the bar.
- Octave jumps (`A1e A2e`) add drive; sustained notes (`A1w`) suit ballads. Slap bass: roots with accented octave "pops" (`E1e E2s> E1s`).
- **Country and folk guitar, "boom-chick":** a single bass note, then short chord strums: `G2q {G}q' {G}q'` in 3/4, or `G2q {G}q' D2q {G}q'` in 4/4.
- **Funk clavinet or guitar comping:** short sixteenth stabs with rests between, using staccato chord symbols: `{Dm7}s' rs {Dm7}s' re. {Dm7}s' re`.
- **Horn section stabs:** short accented chords, either as stacks split across the horns (trumpet top note, sax middle, trombone bottom) or as a chord symbol on each horn track with a suitable `octave`: `rq re [D5 F5 A5]e'> rh`. For horn melodies, double the line an octave apart across instruments.

## 3.7 Drum pattern library

Each block is one bar unless noted. Combine the lanes you need.

**Pop / rock, eighth-note hats**
```lmn
drums.kick   | x... .... x.x. .... |
drums.snare  | .... x... .... x... |
drums.hat    | x.x. x.x. x.x. x.x. |
```

**Four-on-the-floor dance**
```lmn
drums.kick    | x... x... x... x... |
drums.clap    | .... x... .... x... |
drums.openhat | ..x. ..x. ..x. ..x. |
drums.shaker  | xxxx xxxx xxxx xxxx |
```

**Half-time ballad**
```lmn
drums.kick   | x... .... .... ..x. |
drums.snare  | .... .... x... .... |
drums.hat    | x.x. x.x. x.x. x.x. |
```

**Hip-hop** (try `swing: 58`, `swing_unit: 16`)
```lmn
drums.kick   | x... ...x ..x. .... |
drums.snare  | .... x... .... x... |
drums.hat    | x.x. x.x. x.x. x.x. |
```

**Trap** (`drums_808`, tempo around 140; hats roll in sextuplets on beat 3)
```lmn
drums.kick   | x... .... ..x. .x.. |
drums.snare  | .... .... x... .... |
drums.hat    | x.x. x.x. xxxxxx x.x. |
```

**Funk, sixteenths with ghost notes**
```lmn
drums.kick   | x..x ..x. .x.. x... |
drums.snare  | .... x..o .o.. x..o |
drums.hat    | xxxx xxxx xxxx xxxx |
```

**Shuffle in 4/4** (triplet groups)
```lmn
drums.kick   | x.. ... x.. ... |
drums.snare  | ... x.. ... x.. |
drums.ride   | x.x x.x x.x x.x |
```

**Jazz swing** (`swing: 67`)
```lmn
drums.ride      | x. xx x. xx |
drums.pedalhat  | . x . x |
drums.kick      | o o o o |
```

**Brushes, jazz or country ballad** (`drums_brush`; a brush stroke on every beat, pedal hi-hat on the backbeats; for a 3/4 waltz use `X o o` and `. x x`)
```lmn
drums.snare     | o X o X | % |
drums.pedalhat  | . x . x | % |
drums.kick      | x . x . | % |
```

**Waltz, 3/4**
```lmn
drums.kick   | x... .... .... |
drums.snare  | .... x... x... |
drums.hat    | x.x. x.x. x.x. |
```

**6/8 ballad** (two groups of three eighths)
```lmn
drums.kick   | x.. ... |
drums.snare  | ... x.. |
drums.hat    | xxx xxx |
```

**Fills** (last bar of a section; crash on the next section's first beat)
```lmn
drums.snare   | .... x... xx.. .... |      // two-beat fill: snare,
drums.tom_hi  | .... .... ..xx .... |      // then high tom,
drums.tom_mid | .... .... .... xx.. |      // mid tom,
drums.tom_low | .... .... .... ..xx |      // floor tom
```

## 3.8 Counting beats reliably

Bar arithmetic is where most mistakes happen. Build every bar beat by beat. In 4/4, fill each of the four beats with exactly one of these, or let a longer note cover several beats:

| Fills one beat | Covers two beats | Covers three or four |
|---|---|---|
| `q` | `h` | `h.` (three) |
| `e e` | `q. e` | `w` (four) |
| `e. s` · `s e.` | `e q.` | `h q` · `q h` |
| `s s e` · `e s s` · `s e s` | `e q e` | `q. q. q` (four) |
| `s s s s` | `q3 q3 q3` | `h. q` (four) |
| `e3 e3 e3` | | |

In **3/4**, fill three beats: `h.`, `q q q`, `h q`, `q h`, `q. e q`, `e e q q`. In **6/8**, count six eighths, grouped 3 + 3: `q. q.`, `q e q e`, `e e e q.`, `h.`, `q. e e e`.

Rests count exactly like notes. Ties do not change counting: `C4h~ | C4q …` is two beats in the first bar and one in the next. When unsure, add a comment with the beat totals, for example `// 1+1+0.5+0.5+1 = 4`.

## 3.9 Common mistakes

| Mistake | Wrong | Right |
|---|---|---|
| Bar does not add up | `C4q D4q E4h F4q` (5 beats in 4/4) | `C4q D4q E4h` |
| Missing duration | `C4 E4 G4` | `C4q E4q G4h` |
| Sharps forgotten in a sharp key | `F4q` in G major | `F#4q` |
| Chord symbol without braces | `Am7h` | `{Am7}h` |
| Wrong number of drum groups | `x... x... x...` in 4/4 | `x... x... x... ....` |
| `R` or `%` sharing a bar | `R C4q` | `rh. C4q` |
| Lines with different bar counts in one section | vox has 7 bars, bass has 8 | every line has 8 |
| Lyrics written on their own line | a separate `lyrics:` line | `C4q:Twin- C4q:kle` on the notes |
| Two syllables on one note | `C4q:twinkle` (sung on one note) | `C4e:twin- C4e:kle` |
| Repeat written as `x2` | `form: Chorus x2` | `form: Chorus*2` |
| Bass an octave too high | `A3q` for a bass line | `A1q` or `A2q` |
| Tie to a different pitch | `C4q~ D4q` | `C4q D4q`, or `C4q~ C4q` |

## 3.10 Final checklist

Before outputting a song, verify:

- [ ] The first line is `LMN 1`, and the header has `title`, `tempo`, `time` and `key`.
- [ ] Every target in a body line is a declared track, a voice of one (`piano.left`), or a drum lane from Appendix B (`drums.snare`).
- [ ] Every instrument comes from Appendix A.
- [ ] Every section has `bars=N` (sections made with `extends=` may leave it out), and every line in it has exactly N bars.
- [ ] Every bar of every pitched line adds up to the bar length (4 beats in 4/4, 3 in 3/4, 3 in 6/8).
- [ ] Every drum bar has exactly one group per pulse (four in 4/4, three in 3/4, two in 6/8).
- [ ] Every note and rest has a duration letter.
- [ ] Sharps and flats are correct for the key on every note.
- [ ] Lyrics: one syllable per note, hyphens inside words, `/` at the end of each lyric line.
- [ ] Every section in `form:` is defined, and repeats use `*N`.
- [ ] The whole song is in one fenced code block tagged `lmn`.

---

# Part 4 — Implementation guide for players and tools

This part tells you how to build software that reads LMN: a player, a MIDI converter, a visualizer or an editor. Following it closely means your tool will agree with every other LMN tool, note for note.

## 4.1 Pipeline

1. **Parse** the text into header fields, tracks, sections (raw bar strings per target, with line numbers) and the form.
2. **Resolve** `extends=` inheritance and expand the form into a list of section instances.
3. **Compile** every bar into timed events: notes with start time, length, MIDI pitch, velocity and lyric; drum hits; lyric syllables; section markers.
4. **Render**: schedule audio, write a MIDI file, draw a piano roll, show karaoke lyrics.

Keep compile separate from rendering. A compiled event list is easy to test and serves every output.

## 4.2 Parsing

Process the file line by line (line numbers start at 1):

```text
for each line:
    text = remove comment (// at start of line or after whitespace), then trim
    if text is empty or starts with ``` : continue
    if text starts with "LMN ":      version = the number after it
    elif text starts with "track ":  parse a track declaration
    elif text starts with "section ": start a new section; it becomes the current section
    elif text starts with "form:":   append the listed items to the form
    elif text matches ^([A-Za-z_][\w-]*)\s*:\s*(.*)$ and the value does not start with "|":
                                     header field (lowercase the name)
    elif text contains "|":          body line; error if there is no current section
    else: report "unrecognized line"
```

Track declarations may appear after the lines that use them, so resolve targets only after the whole file is parsed. Match instrument and lane names case-insensitively.

**Track declaration.** Split on whitespace: `track`, the name, the instrument, then `key=value` attributes. Look the instrument up in Appendix A. If it is unknown, report it and pick a fallback: a name containing `bass` → `bass`, `drum` or `kit` → `drums`, `pad` → `pad`, `string` → `strings`, `guitar` → `clean_guitar`, otherwise `piano`.

**Section header.** Split on whitespace: `section`, the name, then attributes. Being lenient helps: also accept `extends Verse1` written without `=`.

**Body line.** Split at the first `|`. The left part is the target (trim it, and drop a trailing `:` if present). Split the right part on `|`, trim each piece and drop empty pieces. Each remaining piece is one bar. Store the bars under the target in the current section, appending to any bars already stored for that target, and keep the line number with each bar.

**Target.** `name` or `name.sub`. If `name` is `tempo`, it is the tempo lane. If `name` is a drum track, `sub` is a lane: resolve aliases (Appendix B) and report unknown lanes. A drum target without a lane is an error. For pitched tracks, `sub` is a voice name. A target whose track is not declared is reported and skipped.

**Form.** Split the text after `form:` on whitespace. `Name*N` means N repetitions. Leniency: a separate token `xN` or `×N` repeats the previous item, so it plays N times in total.

## 4.3 Resolving sections and the form

```text
resolve(name, visiting):
    if name is in resolved: return it
    if name is in visiting: report "circular extends"; return the section without its parent
    S = raw section(name)
    if S has extends=P:
        base = copy of resolve(P, visiting + name)
        base.attributes = base.attributes overridden by S's own attributes
        for each target T written in S: base.lines[T] = S.lines[T]   (replace, never merge)
        result = base
    else:
        result = S
    resolved[name] = result
    return result
```

Then expand the form: for each item, append the resolved section `count` times. With no form line, use every section once in file order. Each appended copy is a **section instance**, with its own index.

For each section instance, compute:

- **N/D** from `time` (section, else header). Bar length in beats: `barBeats = 4 * N / D`.
- **Bar count**: the largest number of bars among its targets, not counting the `tempo` line. Report targets with fewer bars (and a `bars=` mismatch); missing bars are silent. A section with no lines lasts `bars=` bars, or 1.
- **Start beat**: the sum of all earlier instances' lengths (`bars × barBeats`).

## 4.4 Time: beats, swing and seconds

Work in **beats** (quarter notes) first and convert to seconds last.

**Tokens.** Split a bar with the TOKENIZE pattern in Appendix D, then expand repeats: `X*N` becomes N copies of X, and `(A B C)*N` becomes N copies of the group.

**Position of a pitched token.** Inside a bar, keep a running position `pos` starting at 0. Each token starts at `pos`, then `pos += length`. Lengths come from Part 1: `w`=4, `h`=2, `q`=1, `e`=0.5, `s`=0.25, `t`=0.125; `.` ×1.5, `..` ×1.75, `3` ×2/3. Use floating point with a tolerance of 1e-6 (or exact fractions).

- A token that starts at or after `barBeats` is dropped and reported.
- A token that ends after `barBeats` is cut at `barBeats` and reported.
- If the bar ends with `pos < barBeats`, the rest is silent; report it.

**Position of a drum step.** Let `G` be the expected number of groups: `N/3` if D ≥ 8 and N is divisible by 3, otherwise `N`. Each group spans `barBeats / G` beats. Step i of a group with L characters is at `g × span + i × span / L`. Groups beyond G are ignored; missing groups are silent; an invalid group is silent but still counts. Use the expected G, never the number of groups actually written, so a malformed bar never changes the speed.

**Swing.** If `swing` S > 50: `span = 1` beat for `swing_unit` 8, `0.5` for 16; `s = S / 100`. For any position x measured from the start of its bar:

```text
if x >= floor(barBeats / span) * span: return x      // leftover partial span: not swung
n = floor(x / span);  p = x / span - n
p2 = (p < 0.5) ? p * 2 * s  :  s + (p - 0.5) * 2 * (1 - s)
warped = (n + p2) * span
```

Apply it to note starts, note ends and drum steps (bar-relative), then add the bar's start beat.

**Tempo map.** Build a list of segments over absolute beats: `{beat0, beat1, bpm0, bpm1, sec0}`. Without a tempo lane, each section instance is one segment with constant bpm. With a tempo lane, each bar is a segment: a number sets a constant tempo for that bar, `>N` ramps from the current tempo to N across the bar, and `.` keeps the current tempo. `sec0` of each segment is the end time of the previous one.

Seconds at beat b, inside segment g:

```text
if g.bpm0 == g.bpm1:
    sec = g.sec0 + (b - g.beat0) * 60 / g.bpm0
else:
    k = (g.bpm1 - g.bpm0) / (g.beat1 - g.beat0)          // BPM change per beat
    sec = g.sec0 + (60 / k) * ln((g.bpm0 + k * (b - g.beat0)) / g.bpm0)
```

Convert every event's start and end beats with this function.

## 4.5 Notes

**Pitch.** `midi = 12 × (octave + 1) + step + alteration` (2.6), plus the section's effective transposition. Clamp to 0–127. If a token ends up with the same pitch twice, keep one.

**Chord symbols.** Voice them exactly as Appendix C describes, using the track's `octave`, then transpose.

**Velocity.** Each target starts each section instance at 80 (`mf`). Dynamic tokens set it from the table in 2.9. Accents (`>`, drum `X`) add 20, capped at 127. Drum ghost notes (`o`) are `round(0.4 × velocity)`.

**Ties.** Process each target's tokens in time order through the whole song, keeping a map of open tied notes keyed by pitch:

```text
for each sounding token (start beat a, end beat b, pitches P, tied flag):
    for each pitch p in P:
        if open[p] exists and open[p].end == a:      // a contiguous continuation
            open[p].end = b                          // extend: no new attack
            keep open[p] open if this token is tied, else close it
        else:
            create a new note event from a to b; keep it open if this token is tied
    close every open note whose pitch is not in P (report "tie could not connect")
on a rest, or when the target is absent or muted in the next section: close all open notes
```

**Articulation.** A normal note sounds from its start to its written end minus a gap of `min(5% of its whole written length, 60 ms)`, where the whole length includes every tied continuation. A staccato note (judged by its last token) ends halfway through its last token, with no further gap. Ties and glides leave no gap at the joins, because the joined notes form one event.

**Glide (Extended).** A note with `^` slides into the next sounding note on the same target: the pitch moves during the last quarter of the gliding note (at most 150 ms) and arrives exactly when the next note starts. The next note is not struck again; the same voice continues at the new pitch. In the event list a glide chain is one event: `midi` is its first pitch, `pitchPath` lists `{ "time", "midi" }` for its start and every pitch it slides to, and `duration` covers the whole chain. Players without glide play the notes legato, and MIDI export writes them as separate notes.

## 4.6 Compiled events

Use this event shape. It is easy to test, and two implementations can be compared by diffing their event lists.

```json
{
  "time": 12.5,
  "duration": 0.47,
  "beat": 25.0,
  "beats": 1.0,
  "track": "bass",
  "target": "bass",
  "midi": 40,
  "velocity": 80,
  "drum": null,
  "lyric": null,
  "section": "Verse1",
  "instance": 1
}
```

| Field | Meaning |
|---|---|
| `time` | Start in seconds from the beginning of the song |
| `duration` | How long it sounds, in seconds, after the articulation gap (4.5) |
| `beat` | Start position in beats from the beginning of the song, after swing |
| `beats` | Written length in beats, before swing; for a note cut at the bar line, the length that remains; the sum over a tie chain |
| `track`, `target` | The track name, and the full target (`bass`, `drums.snare`, `piano.left`) with drum lane aliases resolved |
| `midi` | MIDI pitch (for drums, the GM drum note from Appendix B) |
| `velocity` | 1–127 after dynamics and accents |
| `drum` | The lane name for drum hits, otherwise `null` |
| `lyric` | The display text of a syllable that starts on this event (as in the lyric entries below), on the first pitch of its token only; otherwise `null` |
| `section`, `instance` | Section name, and the section instance's position in the expanded form, counting from 0 |
| `pitchPath` | Glide chains only (4.5) |

- Drum hits have `beats` 0.25, and `duration` is the time those 0.25 beats take after the hit, with no gap.
- Sort events by `time`, then by track declaration order, then by `midi`, then in the order they were produced.
- **Lyric entries**, one per syllable, for every track that has lyrics, sorted by time: `{ "time", "beat", "track", "target", "text", "continues", "lineEnd", "section", "instance" }`. `text` has the trailing `-` and `/` removed and `_` replaced by a space; `continues` is true if the syllable ended with `-`; `lineEnd` is true if it ended with `/`.
- **Section instances**: `{ "name", "instance", "beat", "endBeat", "time", "endTime", "bars", "timeSignature": [N, D], "tempo", "transpose" }`.
- **Tempo segments**: `{ "beat0", "beat1", "bpm0", "bpm1", "sec0" }`, as in 4.4.
- **Diagnostics**: `{ "level", "line", "message" }`, where `level` is `error` (something was dropped or replaced), `warning` (likely mistake, played as best as possible) or `info` (advice, such as a note outside an instrument's usual range). Messages are free text. Report each problem once per section definition, even if the section plays several times.

## 4.7 Audio rendering

**Scheduling.** Never use `setTimeout` to time notes. In a browser, schedule with the Web Audio clock: every 25 ms, a timer schedules all events whose time falls in the next 150 ms, using `audioContext.currentTime` plus the song offset. Offline rendering (`OfflineAudioContext`) can schedule everything at once, which also gives WAV export.

**Mixing.** Each track: a gain node (`vol / 100`) → a stereo panner (`pan / 100`) → master. Send `reverb / 100` of the signal to a shared convolution reverb (a generated impulse: stereo noise with an exponential decay of about 2 s). Master: gain around 0.8 → compressor or limiter → output. Map velocity to amplitude with a curve such as `(velocity / 127) ** 2`.

**Instrument sounds.** Samples (for example a General MIDI SoundFont, using the GM numbers in Appendix A) sound best. Without samples, synthesize by family. These recipes are enough for a pleasant result:

| Family | Recipe |
|---|---|
| piano | Two slightly detuned oscillators (triangle plus quieter sawtooth) → low-pass whose cutoff starts around 4–6 kHz and falls; amplitude: 5 ms attack, then decay towards silence over 1–4 s (shorter for higher notes); 0.3 s release |
| epiano | FM: sine carrier, sine modulator at 1× frequency (plus a quiet 14× "tine" partial), modulation index decaying from about 3 to 0.5 over 1 s; 2–3 s decay; optional slow tremolo |
| organ | Additive sines at 1, 2, 3, 4, 6 and 8 × frequency with drawbar-like levels; 10 ms attack, full sustain, 60 ms release; optional 6 Hz tremolo |
| mallet | A few sine partials (marimba 1, 4, 10 ×; vibraphone 1, 4 × with tremolo; bells 1, 2.76, 5.4 ×), fast attack, exponential decay of 0.5–3 s |
| pluck | Karplus–Strong string: a short noise burst into a delay line of one period with a damped averaging filter. Darker and shorter for nylon and muted guitar, brighter for steel, harp and banjo |
| drive | Two detuned sawtooths → soft-clipping wave-shaper → low-pass around 3–4 kHz; sustained while held |
| bass | Sawtooth plus sine sub → low-pass at 300–900 Hz with a short filter envelope; `sub_bass` is a pure sine; `slap_bass` is brighter with a quick decay |
| strings | Three to five detuned sawtooths → low-pass at 2–4 kHz; attack 80–300 ms (slower for `slow_strings`); release 0.3–0.6 s; gentle vibrato after 200 ms |
| brass | Sawtooth → low-pass whose cutoff rises quickly from about 500 Hz to 3 kHz on each attack; 30 ms attack; slight vibrato |
| reed | Square or pulse wave → band-pass or low-pass around 1–2 kHz; vibrato |
| pipe | Sine with a little triangle, plus breath noise (band-passed noise) at the attack; vibrato |
| voice | Sawtooth (three detuned for `choir`) → three parallel band-pass formant filters, gentle vibrato around 5.5 Hz. Choose the vowel from the syllable's first vowel letter (formants in Hz: a 730/1090/2440, e 530/1840/2480, i 270/2290/3010, o 570/840/2410, u 300/870/2240) |
| lead | `square_lead`: square → low-pass; `saw_lead`: two detuned sawtooths → low-pass |
| pad | Four detuned sawtooths → low-pass around 1.5 kHz; 0.5–1.5 s attack; 1–2 s release |

**Drum sounds.** One-shot sounds; the written length does not matter.

| Lane | Recipe |
|---|---|
| kick | Sine sweeping from 150 Hz to 45 Hz in about 0.1 s, amplitude decay 0.35 s, plus a short click. `drums_808`: longer (about 0.9 s) and lower |
| snare | White noise → high-pass 1 kHz, decay 0.18 s, plus a triangle at 185 Hz decaying in 0.08 s |
| rim | Short band-passed click around 1.7 kHz, 0.03 s |
| clap | Three noise bursts 10 ms apart, then a 0.15 s tail, band-passed around 1.2 kHz |
| hat · pedalhat · openhat | Noise (or six inharmonic square waves) → high-pass at 7 kHz; decay 0.05 s, 0.07 s and 0.4 s. `hat` and `pedalhat` cut off a ringing `openhat` |
| crash · crash2 · splash · china | Noise → high-pass around 4 kHz with a little band-pass shimmer; decay 1.5 s (splash 0.6 s; china brighter and harsher) |
| ride · ridebell | Noise → band-pass at 6–8 kHz with metallic partials, decay 1 s; the bell adds sine partials near 2 kHz |
| tom_hi · tom_mid · tom_low | Sine sweeping down from 240 / 170 / 120 Hz to about 75% of that, decay 0.4 s |
| tamb · shaker | Noise band-passed at about 9 kHz (tambourine, 0.15 s) or 6 kHz (shaker, 10 ms attack, 0.08 s) |
| cowbell | Two square waves at 545 and 815 Hz → band-pass, decay 0.3 s |
| conga · bongo | Sine with a slight downward sweep: conga 330 / 220 Hz, bongo 480 / 360 Hz; decay 0.2 s |
| clave · woodblock · triangle | Sine at 2.5 kHz (0.04 s) · 1 kHz (0.06 s) · 4 and 6.2 kHz partials (1.2 s) |

## 4.8 MIDI export

Write a Standard MIDI File, format 1, 480 ticks per quarter note. `tick = round(beat × 480)`, using swung beats.

- **Track 0 (conductor):** track name = title; a time signature event `FF 58 04 nn dd 18 08` (dd is the power of two of D) at every section instance whose time signature differs from the previous one; a tempo event `FF 51 03 tt tt tt` (microseconds per quarter = 60 000 000 / BPM) at every tempo change, and for ramps one event per beat at the tempo of that point; a marker `FF 06` with the section name at each section instance.
- **One MIDI track per LMN track:** track name `FF 03`, a program change (Appendix A) at tick 0, volume (CC 7 = `round(vol × 1.27)`) and pan (CC 10 = `round(64 + pan × 0.63)`), then the notes. Lyrics become `FF 05` lyric events at the note-on tick: the syllable text, followed by a space if the word ends there, or by a carriage return at a lyric line end.
- **Channels:** pitched tracks take channels 1–9 and 11–16 (indexes 0–8 and 10–15), sharing channels if there are more than 15. Drum tracks use channel 10 (index 9), with the kit program from Appendix A and the notes from Appendix B; drum hits last 1/16 note.
- At equal ticks, write note-offs before note-ons. End every track with `FF 2F 00`.

## 4.9 Lyrics display

- Show the lyrics of the first track (in declaration order) that has any. Showing the others is optional.
- A display line runs until a syllable ending in `/`, or until the section instance ends.
- Join a syllable ending in `-` directly to the next one ("shin-" + "ing" → "shining"); put a space after every other syllable; show `_` as a space.
- Highlight each syllable from its note's start time. Also show the current section name.

## 4.10 Conformance

A **Core player** MUST implement everything in Part 2 except the features marked Extended, including the Appendix C voicing rule and the error handling in 2.13. It SHOULD display lyrics in time and report diagnostics with line numbers.

**Extended** features: the tempo lane (2.12), glide `^`, and the `reverb` track attribute. A player that skips one of them MUST still parse the file and play everything else.

Also recommended: mute and solo per track, a seek bar, MIDI export (`.mid`), WAV export (`.wav`), saving the song text as `.txt`, and opening song files (`.txt`, also `.lmn`) by drag and drop or a file picker. Recognize an LMN file by its first line, not its extension.

## 4.11 Test vectors

Each vector is a complete file followed by the events it must produce. The last two vectors add the repeat shorthand. At `tempo: 120` one beat is 0.5 s. Times are note starts in seconds, `@` is the MIDI pitch, and lengths in brackets are written lengths in seconds (end minus start, before the articulation gap that `duration` subtracts).

```lmn
LMN 1
tempo: 120
track a piano
section A
a | C4q D4e E4e F4h |
```
→ 0.00 @60 [0.5] · 0.50 @62 [0.25] · 0.75 @64 [0.25] · 1.00 @65 [1.0]

```lmn
LMN 1
tempo: 120
track a piano
section A
a | C4e3 D4e3 E4e3 F4q G4h |
```
→ 0.000 @60 · 0.167 @62 · 0.333 @64 · 0.500 @65 · 1.000 @67

```lmn
LMN 1
tempo: 120
track a piano
section A
a | C4h. D4q~ | D4h rh |
```
→ 0.0 @60 [1.5] · 1.5 @62 [1.5], one single note

```lmn
LMN 1
tempo: 120
track a piano
section A
a | {G7}w |
```
→ 0.0 @55 @59 @62 @65

```lmn
LMN 1
tempo: 120
track a piano octave=3
section A
a | {C/E}w |
```
→ 0.0 @40 @48 @52 @55

```lmn
LMN 1
tempo: 120
track d drums
section A
d.kick | x... .... x.x. .... |
```
→ kick (GM 36) at 0.00 · 1.00 · 1.25

```lmn
LMN 1
tempo: 120
swing: 66
track d drums
section A
d.hat | x.x. x.x. x.x. x.x. |
```
→ hat (GM 42) at 0.00 · 0.33 · 0.50 · 0.83 · 1.00 · 1.33 · 1.50 · 1.83

```lmn
LMN 1
tempo: 120
time: 6/8
track d drums
section A
d.hat | xxx xxx |
```
→ hat at 0.00 · 0.25 · 0.50 · 0.75 · 1.00 · 1.25

```lmn
LMN 1
tempo: 120
track a piano
section A
a | C4h D4h E4q |
```
→ 0.0 @60 · 1.0 @62. E4 starts at the bar line, so it is dropped and a "bar too long" diagnostic is reported.

```lmn
LMN 1
tempo: 120
track a piano
section A
a | C4w |
section B extends=A transpose=2
form: A B
```
→ 0.0 @60 · 2.0 @62

```lmn
LMN 1
tempo: 120
track a piano
section A
tempo | . | >60 |
a     | C4w | C4w |
```
(Extended) → 0.0 @60 [2.0] · 2.0 @60 [2.773]. The second bar slows from 120 to 60 BPM and lasts (60 / −15) × ln(60 / 120) = 2.773 s.

```lmn
LMN 1
tempo: 120
track a piano
section A
a | C4e*2 (E4s G4s)*2 rh |
```
→ 0.00 @60 · 0.25 @60 · 0.50 @64 · 0.625 @67 · 0.75 @64 · 0.875 @67

```lmn
LMN 1
tempo: 120
track d drums
section A
d.hat | x.*4 |
```
→ hat at 0.0 · 0.5 · 1.0 · 1.5
---

# Part 5 — Complete example song

"Paper Lanterns" is a complete 2½-minute pop arrangement. It shows the features most songs need:

- seven tracks: lead vocal with lyrics, piano and pad playing chord symbols, a synth pluck hook, strings, bass and a full drum kit;
- a planning comment block at the top;
- sections written once and reused through `form:`;
- `Verse2 extends=Verse1`, which replaces only the vocal line to give the second verse new words;
- `Chorus_Final extends=Chorus transpose=1`, a key change for the last chorus, which also adds a string line;
- drum fills and crashes that mark section changes, and `%` to repeat drum bars;
- a tempo lane that slows the outro down (Extended).

```lmn
LMN 1
title: Paper Lanterns
artist: LMN example
tempo: 100
time: 4/4
key: G major
genre: pop

// Plan
// Form: Intro, Verse1, PreChorus, Chorus, Verse2, PreChorus, Chorus, Bridge,
//       Chorus_Final (key change up a half step), Outro (slows down at the end)
// Intro, Outro   Em   C     G      D
// Verse          G    D/F#  Em     C     | G    D    Am7  D
// PreChorus      C    D     Em7    Dsus4 D
// Chorus         G    D     Em     C     | G    D    C D  G
// Bridge         Am7  Bm7   Cmaj7  D     | Am7  Bm7  C    Eb   (Eb sets up the move to Ab)
// C2e*8 below is shorthand for eight C2 eighth notes.

track vox      voice          vol=90
track keys     piano          vol=60 pan=-15
track pad      pad            vol=40 octave=3
track pluck    synth_pluck    vol=50 pan=25
track strings  strings        vol=45 pan=10
track bass     bass           vol=80
track drums    drums          vol=75

section Intro bars=4
pluck        | B4e G4e E5q D5e B4e G4q | C5e G4e E5q D5e C5e G4q | B4e G4e D5q B4e D5e G5q | F#5e E5e D5q A4h |
pad          | {Em}w | {C}w | {G}w | {D}w |
bass         | E2w | C2w | G1w | D2w |
drums.hat    | !p x.x. x.x. x.x. x.x. | % | % | x.x. x.x. .... .... |
drums.kick   | x... .... .... .... | % | % | x... .... .... .... |
drums.snare  | R | R | R | .... .... !mp xxxx !f xxxx |

section Verse1 bars=8
vox          | rq B4e:Strike A4e:a G4q:match A4e:a- B4e:gainst | A4e:the F#4q.:eve- D4h:ning/ | rq E4e:write F#4e:a G4q:wish A4e:on B4e:pa- | A4q:per G4h.:thin/ |
vox          | rq B4e:ev- A4e:ery G4q:word A4e:we B4e:nev- | A4e:er B4q.:told A4h:them/ | rq C5e:fold- B4e:ed A4q:up G4e:and A4e:tucked | F#4q:with- D4h.:in/ |
keys         | {G}h {G}q. {G}e | {D/F#}h {D/F#}q. {D/F#}e | {Em}h {Em}q. {Em}e | {C}h {C}q. {C}e |
keys         | {G}h {G}q. {G}e | {D}h {D}q. {D}e | {Am7}h {Am7}q. {Am7}e | {D}h {D}q. {D}e |
pad          | {G}w | {D/F#}w | {Em}w | {C}w | {G}w | {D}w | {Am7}w | {D}w |
bass         | G1q. G1e G1h | F#1q. F#1e F#1h | E1q. E1e E1h | C2q. C2e C2h |
bass         | G1q. G1e G1h | D2q. D2e D2h | A1q. A1e A1h | D2q. D2e D2h |
drums.kick   | x... ..x. x... .... | % | % | % | % | % | % | x... ..x. x... ..x. |
drums.snare  | .... x... .... x... | % | % | % | % | % | % | .... x... .... x.xx |
drums.hat    | x.x. x.x. x.x. x.x. | % | % | % | % | % | % | % |
drums.crash  | x... .... .... .... | R | R | R | R | R | R | R |

section Verse2 extends=Verse1
vox          | rq B4e:Hold A4e:it G4q:till A4e:the B4e:flame | A4e:is F#4q.:stea- D4h:dy/ | rq E4e:feel F#4e:the G4q:warm A4e:air B4e:pull | A4q:it G4h.:high/ |
vox          | rq B4e:all A4e:the G4q:weight A4e:we B4e:car- | A4e:ried B4q.:with A4h:us/ | rq C5e:ris- B4e:ing A4q:soft- G4e:ly A4e:through | F#4q:the D4h.:sky/ |

section PreChorus bars=4
vox          | rq G4e:Oh, A4e:it's C5q:light- B4e:er A4e:than | A4e:it D5q.:seems/ rh | rq B4e:when C5e:you D5q:o- E5e:pen D5e:up | A4e:your D5h.:hands/ re |
keys         | {C}q {C}q {C}q {C}q | {D}q {D}q {D}q {D}q | {Em7}q {Em7}q {Em7}q {Em7}q | {Dsus4}q {Dsus4}q {D}q {D}q |
pad          | {C}w | {D}w | {Em7}w | {Dsus4}h {D}h |
bass         | C2e*8 | D2e*8 | E2e*8 | D2e*8 |
drums.kick   | x... x... x... x... | % | % | % |
drums.snare  | .... x... .... x... | % | % | x.x. x.x. xxxx XXXX |
drums.hat    | x.x. x.x. x.x. x.x. | % | % | x.x. x.x. .... .... |

section Chorus bars=8
vox           | D5q.:Pa- B4e:per E5q.:lan- D5e:terns | B4e:in A4e:the F#4h.:night,/ | D5q.:ev- B4e:ery E5q.:one D5e:a | B4e:lit- A4e:tle G4h.:light,/ |
vox           | D5q.:let B4e:them E5q.:drift D5e:and | B4e:let D5e:them D5h.:fly,/ | rq E5e:we D5e:don't C5q:have B4e:to A4e:say | B4q:good- G4h.:bye/ |
keys          | {G}q {G}q {G}q {G}q | {D}q {D}q {D}q {D}q | {Em}q {Em}q {Em}q {Em}q | {C}q {C}q {C}q {C}q |
keys          | {G}q {G}q {G}q {G}q | {D}q {D}q {D}q {D}q | {C}q {C}q {D}q {D}q | {G}q {G}q {G}h |
pad           | {G}w | {D}w | {Em}w | {C}w | {G}w | {D}w | {C}h {D}h | {G}w |
pluck         | R | rh F#5e E5e D5q | R | rh E5e D5e C5q | R | rh A5e F#5e D5q | R | rh B5e A5e G5q |
bass          | G1q. G1e G1q. G1e | D2q. D2e D2q. D2e | E1q. E1e E1q. E1e | C2q. C2e C2q. C2e |
bass          | G1q. G1e G1q. G1e | D2q. D2e D2q. D2e | C2q. C2e D2q. D2e | G1q. G1e G1h |
drums.kick    | x... ..x. x... ..x. | % | % | % | % | % | % | x... ..x. x... .... |
drums.snare   | .... x... .... x... | % | % | % | % | % | % | .... x... x.x. xxxx |
drums.clap    | .... x... .... x... | % | % | % | % | % | % | .... x... .... .... |
drums.hat     | x... x... x... x... | % | % | % | % | % | % | x... x... .... .... |
drums.openhat | ..x. ..x. ..x. ..x. | % | % | % | % | % | % | ..x. ..x. .... .... |
drums.crash   | x... .... .... .... | R | R | R | x... .... .... .... | R | R | R |

section Bridge bars=8
vox          | rq A4e:If B4e:the C5q:wind B4e:should A4e:pull | B4e:them F#4q.:down/ rh | rq G4e:we A4e:will B4q:write C5e:them D5e:all | C5e:a- D5q.:gain/ rh |
vox          | rq A4e:ev- B4e:ery C5q:wish B4e:a A4e:lit- | B4e:tle D5q.:flame/ rh | rq E5e:ev- D5e:ery C5q:flame B4e:a A4e:way | G4e:back G4h.:home/ re |
keys         | {Am7}h {Am7}h | {Bm7}h {Bm7}h | {Cmaj7}h {Cmaj7}h | {D}h {D}h | {Am7}h {Am7}h | {Bm7}h {Bm7}h | {C}h {C}h | {Eb}h {Eb}h |
pad          | {Am7}w | {Bm7}w | {Cmaj7}w | {D}w | {Am7}w | {Bm7}w | {C}w | {Eb}w |
strings      | E5w | D5w | C5w | A4w | E5w | F#5w | G5w | G5w |
bass         | A1w | B1w | C2w | D2w | A1w | B1w | C2w | Eb2w |
drums.kick   | x... .... .... .... | % | % | % | % | % | x... .... x... .... | x... x... x... x... |
drums.rim    | .... .... x... .... | % | % | % | % | % | R | R |
drums.snare  | R | R | R | R | R | R | .... x... .... x... | xxxx xxxx xxxx XXXX |
drums.ride   | x... x... x... x... | % | % | % | % | % | % | R |

// The final chorus copies Chorus, moves everything up a half step (G -> Ab)
// and adds a string line.
section Chorus_Final extends=Chorus transpose=1
strings      | D4w | D4w | B3w | C4w | D4w | D4w | E4h F#4h | G4w |

section Outro bars=4 transpose=1
tempo        | . | . | >88 | >66 |
vox          | R | R | rq E5e:we D5e:don't C5q:have B4e:to A4e:say | B4q:good- G4h.:bye/ |
pluck        | B4e G4e E5q D5e B4e G4q | C5e G4e E5q D5e C5e G4q | B4e G4e D5q B4e D5e G5q | G5w |
keys         | {Em}h {Em}h | {C}h {C}h | {G}h {G}h | {G}w |
pad          | {Em}w | {C}w | {G}w | {G}w |
bass         | E1w | C2w | G1w | G1w |
drums.kick   | x... .... x... .... | % | % | x... .... .... .... |
drums.snare  | .... x... .... x... | % | % | R |
drums.hat    | x.x. x.x. x.x. x.x. | % | x.x. x.x. .... .... | R |
drums.crash  | x... .... .... .... | R | R | x... .... .... .... |

form: Intro Verse1 PreChorus Chorus Verse2 PreChorus Chorus Bridge Chorus_Final Outro
```

---

# Appendix A — Instruments

`GM` is the General MIDI program number, counted from 0 (add 1 for the 1–128 numbering some manuals use). Some names share a program because General MIDI has no closer sound. `Family` tells a synthesizer which recipe to use (Part 4.7). Ranges are typical sounding ranges.

**Keyboards**

| Name | GM | Family | Range |
|---|---|---|---|
| `piano` | 0 | piano | A0–C8 |
| `bright_piano` | 1 | piano | A0–C8 |
| `electric_piano` | 4 | epiano | E1–E7 |
| `electric_piano2` | 5 | epiano | E1–E7 |
| `harpsichord` | 6 | pluck | F1–F6 |
| `clavinet` | 7 | pluck | F1–E6 |
| `organ` | 16 | organ | C2–C7 |
| `percussive_organ` | 17 | organ | C2–C7 |
| `rock_organ` | 18 | organ | C2–C7 |
| `church_organ` | 19 | organ | C1–C7 |
| `accordion` | 21 | reed | F2–A6 |
| `harmonica` | 22 | reed | C4–C7 |

**Mallets and pitched percussion**

| Name | GM | Family | Range |
|---|---|---|---|
| `celesta` | 8 | mallet | C4–C8 |
| `glockenspiel` | 9 | mallet | G5–C8 |
| `music_box` | 10 | mallet | C4–C8 |
| `vibraphone` | 11 | mallet | F3–F6 |
| `marimba` | 12 | mallet | C2–C7 |
| `xylophone` | 13 | mallet | F4–C8 |
| `tubular_bells` | 14 | mallet | C4–F5 |
| `timpani` | 47 | mallet | D2–C4 |
| `kalimba` | 108 | mallet | C4–E6 |
| `steel_drums` | 114 | mallet | C4–E6 |

**Guitars and plucked strings**

| Name | GM | Family | Range |
|---|---|---|---|
| `nylon_guitar` | 24 | pluck | E2–B5 |
| `acoustic_guitar` | 25 | pluck | E2–B5 |
| `jazz_guitar` | 26 | pluck | E2–B5 |
| `clean_guitar` | 27 | pluck | E2–B5 |
| `muted_guitar` | 28 | pluck | E2–B4 |
| `overdrive_guitar` | 29 | drive | E2–B5 |
| `distortion_guitar` | 30 | drive | E2–B5 |
| `harp` | 46 | pluck | C1–G7 |
| `pizzicato` | 45 | pluck | C2–C7 |
| `banjo` | 105 | pluck | C3–A5 |
| `sitar` | 104 | pluck | C3–C6 |
| `koto` | 107 | pluck | C3–C6 |
| `synth_pluck` | 45 | pluck | C2–C7 |

**Basses**

| Name | GM | Family | Range |
|---|---|---|---|
| `bass` | 33 | bass | E1–G3 |
| `upright_bass` | 32 | bass | E1–G3 |
| `pick_bass` | 34 | bass | E1–G3 |
| `fretless_bass` | 35 | bass | E1–G3 |
| `slap_bass` | 36 | bass | E1–G3 |
| `synth_bass` | 38 | bass | C1–C4 |
| `synth_bass2` | 39 | bass | C1–C4 |
| `sub_bass` | 38 | bass | C1–C3 |

**Bowed strings**

| Name | GM | Family | Range |
|---|---|---|---|
| `violin` | 40 | strings | G3–E7 |
| `viola` | 41 | strings | C3–E6 |
| `cello` | 42 | strings | C2–A5 |
| `contrabass` | 43 | strings | E1–G4 |
| `tremolo_strings` | 44 | strings | C2–C7 |
| `strings` | 48 | strings | C2–C7 |
| `slow_strings` | 49 | strings | C2–C7 |
| `synth_strings` | 50 | strings | C2–C7 |
| `fiddle` | 110 | strings | G3–E6 |

**Voices** (use these for sung parts with lyrics)

| Name | GM | Family | Range |
|---|---|---|---|
| `voice` | 53 | voice | A2–F5 |
| `choir` | 52 | voice | E2–C6 |
| `synth_voice` | 54 | voice | C2–C6 |

**Brass**

| Name | GM | Family | Range |
|---|---|---|---|
| `trumpet` | 56 | brass | F#3–D6 |
| `muted_trumpet` | 59 | brass | F#3–D6 |
| `trombone` | 57 | brass | E2–F5 |
| `french_horn` | 60 | brass | B1–F5 |
| `tuba` | 58 | brass | D1–F4 |
| `brass` | 61 | brass | E2–C6 |
| `synth_brass` | 62 | brass | C2–C6 |
| `orchestra_hit` | 55 | brass | C3–C6 |

**Woodwinds**

| Name | GM | Family | Range |
|---|---|---|---|
| `soprano_sax` | 64 | reed | Ab3–E6 |
| `alto_sax` | 65 | reed | Db3–Ab5 |
| `tenor_sax` | 66 | reed | Ab2–E5 |
| `baritone_sax` | 67 | reed | Db2–Ab4 |
| `oboe` | 68 | reed | Bb3–A6 |
| `english_horn` | 69 | reed | E3–C6 |
| `bassoon` | 70 | reed | Bb1–E5 |
| `clarinet` | 71 | reed | E3–C7 |
| `bagpipe` | 109 | reed | G4–A5 |
| `piccolo` | 72 | pipe | D5–C8 |
| `flute` | 73 | pipe | C4–C7 |
| `recorder` | 74 | pipe | C5–D7 |
| `pan_flute` | 75 | pipe | C4–C7 |
| `whistle` | 78 | pipe | C5–C7 |
| `ocarina` | 79 | pipe | C4–F6 |

**Synthesizers**

| Name | GM | Family | Range |
|---|---|---|---|
| `square_lead` | 80 | lead | C3–C7 |
| `saw_lead` | 81 | lead | C3–C7 |
| `pad` | 89 | pad | C2–C6 |
| `poly_pad` | 90 | pad | C2–C6 |
| `choir_pad` | 91 | pad | C2–C6 |
| `bowed_pad` | 92 | pad | C2–C6 |
| `halo_pad` | 94 | pad | C2–C6 |
| `sweep_pad` | 95 | pad | C2–C6 |

**Drum kits** (drum tracks; MIDI channel 10, where the program number selects the kit)

| Name | Kit program | Character |
|---|---|---|
| `drums` | 0 | Standard acoustic pop/rock kit |
| `drums_rock` | 16 | Big, roomy rock kit |
| `drums_electronic` | 24 | Electronic kit |
| `drums_808` | 25 | TR-808: deep booming kick, snappy snare, ticking hats |
| `drums_jazz` | 32 | Light jazz kit |
| `drums_brush` | 40 | Brushes |
| `percussion` | 0 | Auxiliary percussion (same lanes, a separate track) |

# Appendix B — Drum lanes

| Lane | GM note | Sound |
|---|---|---|
| `kick` | 36 | Bass drum |
| `snare` | 38 | Snare drum |
| `rim` | 37 | Side stick (rim click) |
| `clap` | 39 | Hand clap |
| `hat` | 42 | Closed hi-hat |
| `pedalhat` | 44 | Pedal hi-hat |
| `openhat` | 46 | Open hi-hat |
| `crash` | 49 | Crash cymbal |
| `crash2` | 57 | Second crash cymbal |
| `ride` | 51 | Ride cymbal |
| `ridebell` | 53 | Ride bell |
| `splash` | 55 | Splash cymbal |
| `china` | 52 | China cymbal |
| `tom_hi` | 50 | High tom |
| `tom_mid` | 47 | Middle tom |
| `tom_low` | 43 | Floor tom |
| `tamb` | 54 | Tambourine |
| `cowbell` | 56 | Cowbell |
| `shaker` | 70 | Shaker (maracas) |
| `conga_hi` | 63 | High conga |
| `conga_lo` | 64 | Low conga |
| `bongo_hi` | 60 | High bongo |
| `bongo_lo` | 61 | Low bongo |
| `clave` | 75 | Claves |
| `woodblock` | 76 | Wood block |
| `triangle` | 81 | Triangle |

Players SHOULD also accept these aliases: `bd` → `kick`, `sd` → `snare`, `hh`, `hihat` and `closedhat` → `hat`, `oh` and `open_hat` → `openhat`, `ph` and `pedal_hat` → `pedalhat`, `cymbal` → `crash`, `tambourine` → `tamb`, `sidestick` → `rim`, `tom1` → `tom_hi`, `tom2` → `tom_mid`, `tom3` and `floortom` → `tom_low`.

# Appendix C — Chord symbols

A chord symbol is `{root quality}` or `{root quality/bass}`. The root and the bass are a letter `A`–`G` with an optional `#` or `b`. The quality is one of the following (case-sensitive). Intervals are semitones above the root.

| Quality | Also accepted | Intervals | Example: notes of C |
|---|---|---|---|
| *(none)* | `maj` | 0 4 7 | C E G |
| `m` | `min` `-` | 0 3 7 | C E♭ G |
| `dim` | `°` `o` | 0 3 6 | C E♭ G♭ |
| `aug` | `+` | 0 4 8 | C E G♯ |
| `sus2` | | 0 2 7 | C D G |
| `sus4` | `sus` | 0 5 7 | C F G |
| `5` | | 0 7 | C G |
| `6` | | 0 4 7 9 | C E G A |
| `m6` | `min6` | 0 3 7 9 | C E♭ G A |
| `7` | `dom7` | 0 4 7 10 | C E G B♭ |
| `maj7` | `M7` `Δ` `Δ7` | 0 4 7 11 | C E G B |
| `m7` | `min7` `-7` | 0 3 7 10 | C E♭ G B♭ |
| `mMaj7` | `mM7` `m(maj7)` | 0 3 7 11 | C E♭ G B |
| `dim7` | `°7` `o7` | 0 3 6 9 | C E♭ G♭ A |
| `m7b5` | `ø` `ø7` `min7b5` | 0 3 6 10 | C E♭ G♭ B♭ |
| `7sus4` | `7sus` | 0 5 7 10 | C F G B♭ |
| `aug7` | `7#5` `+7` | 0 4 8 10 | C E G♯ B♭ |
| `7b5` | | 0 4 6 10 | C E G♭ B♭ |
| `add9` | `add2` | 0 4 7 14 | C E G D |
| `madd9` | `m(add9)` | 0 3 7 14 | C E♭ G D |
| `69` | | 0 4 7 9 14 | C E G A D |
| `9` | | 0 4 7 10 14 | C E G B♭ D |
| `maj9` | `M9` | 0 4 7 11 14 | C E G B D |
| `m9` | `min9` `-9` | 0 3 7 10 14 | C E♭ G B♭ D |
| `9sus4` | `9sus` | 0 5 7 10 14 | C F G B♭ D |
| `7b9` | | 0 4 7 10 13 | C E G B♭ D♭ |
| `7#9` | | 0 4 7 10 15 | C E G B♭ D♯ |
| `7#11` | | 0 4 7 10 18 | C E G B♭ F♯ |
| `11` | | 0 7 10 14 17 | C G B♭ D F |
| `m11` | `min11` | 0 3 7 10 14 17 | C E♭ G B♭ D F |
| `13` | | 0 4 7 10 14 21 | C E G B♭ D A |
| `maj13` | `M13` | 0 4 7 11 14 21 | C E G B D A |
| `m13` | `min13` | 0 3 7 10 14 21 | C E♭ G B♭ D A |

Write `69`, not `6/9`: a slash always introduces a bass note.

Chord symbols are always voiced in root position, so consecutive chords can jump in register (at `octave=4`, `{F}` sits at F4–C5 but `{G}` at G3–D4). For smoother movement, use slash chords (`{G/B}`), pick each track's `octave` so its chords sit in the instrument's range, or write note stacks.

**Voicing rule** (players MUST use this, so every player sounds the same):

1. Let r be the pitch class of the root (C=0, C#=1, … B=11) and k the track's `octave` attribute (default 4).
2. The root note is R = 12 × (k + 1) + r. If r ≥ 7 (G, G#/Ab, A, A#/Bb, B), subtract 12. With k = 4, roots fall between G3 and F#4.
3. The chord's notes are R + each interval of the quality.
4. With a slash bass `/X` of pitch class x, add one more note: the highest note with pitch class x that is below R, which is R − d where d = (r − x) mod 12, using 12 when d is 0.
5. Then apply the section's transposition.

Examples with `octave=4`: `{C}` → 60 64 67 · `{G7}` → 55 59 62 65 · `{Am}` → 57 60 64 · `{F#m7}` → 66 69 73 76 · `{C/E}` → 52 60 64 67 · `{G/B}` → 47 55 59 62.

# Appendix D — Grammar and token patterns

```ebnf
file          = { line } ;
line          = version | header | track | section | body | form | comment | blank ;
version       = "LMN" , ws , integer ;
header        = field-name , ":" , text ;
track         = "track" , ws , track-name , ws , instrument , { ws , attribute } ;
section       = "section" , ws , section-name , { ws , attribute } ;
attribute     = attr-name , "=" , attr-value ;              (* no spaces around "=" *)
form          = "form:" , { ws , section-name , [ "*" , integer ] } ;
body          = target , [ ":" ] , [ ws ] , "|" , bar , { "|" , bar } , [ "|" ] ;
target        = track-name , [ "." , sub-name ] | "tempo" ;
track-name    = lower , { lower | digit | "_" } ;
sub-name      = ( letter | digit | "_" ) , { letter | digit | "_" } ;
section-name  = letter , { letter | digit | "_" | "-" } ;
field-name    = ( letter | "_" ) , { letter | digit | "_" | "-" } ;
attr-name     = letter , { letter | "_" } ;
attr-value    = non-space-char , { non-space-char } ;
instrument    = lower , { lower | digit | "_" } ;
text          = { any-char } ;
integer       = digit , { digit } ;
number        = integer , [ "." , integer ] ;
ws            = ( " " | tab ) , { " " | tab } ;
letter        = "A" … "Z" | "a" … "z" ;   lower = "a" … "z" ;   digit = "0" … "9" ;

(* pitched bars *)
pitched-bar   = "R" | "%" | item , { ws , item } ;
item          = token , [ "*" , integer ] | "(" , token , { ws , token } , ")" , "*" , integer ;
token         = note | rest | stack | chord | dynamic ;
note          = pitch , duration , { modifier } , [ lyric ] ;
rest          = "r" , duration ;
stack         = "[" , pitch , { ( ws | "," ) , pitch } , "]" , duration , { modifier } , [ lyric ] ;
chord         = "{" , chord-symbol , "}" , duration , { modifier } , [ lyric ] ;
dynamic       = "!" , ( "ppp" | "pp" | "p" | "mp" | "mf" | "f" | "ff" | "fff" ) ;
pitch         = ( "A" | "B" | "C" | "D" | "E" | "F" | "G" ) , [ "##" | "bb" | "#" | "b" ] , digit ;
duration      = ( "w" | "h" | "q" | "e" | "s" | "t" ) , [ "." | ".." ] , [ "3" ] ;
modifier      = "~" | ">" | "'" | "^" ;
lyric         = ":" , lyric-char , { lyric-char } ;         (* any characters except whitespace and "|" *)
chord-symbol  = root , quality , [ "/" , root ] ;
root          = ( "A" | "B" | "C" | "D" | "E" | "F" | "G" ) , [ "#" | "b" ] ;

(* drum bars *)
drum-bar      = "R" | "%" | drum-item , { ws , drum-item } ;    (* dynamics may appear anywhere *)
drum-item     = dynamic | group , [ "*" , integer ] ;
group         = step , { step } ;
step          = "x" | "X" | "o" | "." | "-" ;

(* tempo lane *)
tempo-bar     = "." | number | ">" , number ;
```

Token patterns (JavaScript regular expressions). Split a bar into tokens with the first pattern, so that note stacks and repeat groups containing spaces stay whole, then expand repeats with REPEAT and GROUP-REPEAT:

```text
TOKENIZE  /\([^()]*\)\*\d+|\[[^\]]*\]\S*|\S+/g
GROUP-REPEAT /^\(([^()]*)\)\*(\d+)$/
REPEAT    /^(.*[^*])\*(\d+)$/
NOTE      /^([A-G])(##|bb|#|b)?([0-9])([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/
REST      /^r([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/   (modifiers and lyric are ignored)
STACK     /^\[([^\]]+)\]([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/
CHORD     /^\{([^}]+)\}([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/
DYNAMIC   /^!(ppp|pp|p|mp|mf|f|ff|fff)$/
SYMBOL    /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/
GROUP     /^[xXo.\-]+$/
```

