# LMN (vendored)

[LMN — LLM Music Notation](https://github.com/davidmwest/lmn) by the same author, MIT licensed (see LICENSE).

- `lmn-core.js` — parser and compiler (unchanged copy of `tools/lmn-core.js`).
- `lmn-synth.js` — the browser synthesizer: `tools/player/engine-1-dsp.js` … `engine-4-player.js` concatenated, unchanged. Defines the global `LMNSynth`.
- `LMN-Spec.md` — the notation spec, for models writing game music.
- `VERSION` — the LMN commit these files came from.

Shiori loads these only when a game declares an `.lmn` song.
