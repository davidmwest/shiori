# Shiori — a visual novel engine for language models

Shiori (栞, "bookmark") is a visual novel engine whose scripts are plain text that language models write reliably and people read easily. It runs in any browser, needs no build step or install, does 2D and 3D, plays music written in [LMN](engine/vendor/lmn/README.md), and drafts a [VNDB](https://vndb.org/d2) entry with an advisory read against VNDB's guidelines.

```shiori
SHIORI 1
title: The Lantern Keeper

@character mio
  name: Mio
  color: #f29bb0
  sprite: chars/mio/{expression}.svg
  expression: neutral smile sad blush

@image harbor_dusk bg/harbor_dusk.svg
@audio theme music/theme.lmn
@var trust = 0

# harbor "The Pier"
@scene harbor_dusk with=fade
@music theme
@weather fireflies layer=back
The tide comes in the colour of weak tea. Mio is already at the end of the pier.
@show mio neutral at=center
mio (smile): I saved you the dry end of the bench.

* Sit beside her.
  @set trust += 1
  mio (blush): ...You actually sat.
* Stay standing. -> standing
```

## Use it with an AI

1. Give a model [`SHIORI-Spec.md`](SHIORI-Spec.md). It holds the whole language, a writing guide (including how to pass VNDB), the engine guide, and a generated command reference.
2. Ask for a game: *"Using the attached spec, write a short visual novel about …"*.
3. Let it check its own work with the CLI. The engine explains each problem with a line number and a fix:

```bash
bin/shiori check examples/lantern-keeper     # every error and warning, with "did you mean" fixes
bin/shiori play examples/lantern-keeper --choices 1,1,2,3   # read a route in the terminal
bin/shiori explore examples/lantern-keeper   # play every route: endings, dead ends, runtime errors, coverage
bin/shiori vndb examples/lantern-keeper      # advisory read against VNDB's guidelines + a draft entry and tags
bin/shiori stats examples/lantern-keeper     # words, reading time, narration share, lines per character
bin/shiori graph examples/lantern-keeper     # Mermaid / Graphviz story graph
bin/shiori docs show                         # reference for any command
```

`bin/shiori` uses Node.js if it is installed, and otherwise the JavaScriptCore engine built into macOS. There is nothing to install.

## Play a game

```bash
bin/shiori serve examples/lantern-keeper
```

Open the printed URL (`player.html?game=examples/lantern-keeper&dev=1`). `dev=1` adds a developer panel with live reload, variables, the stage, and jump-to-scene. Other URL parameters: `scene=`, `set=trust:2`, `choices=1,2`, `skip=1`. A running game exposes `window.shiori` for automation.

To publish, upload the engine folder (or just `player.html`, `engine/` and your game) to any static host.

## Features

- **Writing:** narration as plain lines, `name: text` dialogue, expressions per line (`mio (sad): …`), choices with `[if]`, `[require]` (shown locked) and `[once]`, variables, persistent unlocks, `@call`, multiple points of view (`@pov`), chapters, endings, name input, furigana, text effects.
- **Presentation:** ADV textbox and NVL pages, side portraits, 16 transitions, characters that breathe, blink and lip-flap, speaker highlighting, camera pans and zooms, 11 weather effects, colour filters (sepia flashbacks, night, dream…), shakes and flashes, CGs, video.
- **3D:** real-time three.js worlds as backgrounds, with named marks, camera flights and 3D characters (glTF, VRM, or code). 2D sprites work over 3D worlds and 3D models over 2D backgrounds.
- **Audio:** music crossfades, ambience, sound effects, voice with ducking, and LMN songs synthesised live (models can compose the soundtrack too).
- **Player:** saves with thumbnails, quick save, autosave, rollback and roll-forward, backlog with voice replay, auto and skip modes (read-text aware), CG gallery, endings list, music room, settings, keyboard play, self-voicing (text to speech), reduced motion and high contrast.
- **For models:** every name is declared and checked; errors carry codes, line and column, and a fix; a headless player and a route explorer let a model test every branch without a browser; saves survive script edits.
- **VNDB:** `shiori vndb` drafts the entry (release fields such as resolution, voiced, animation flags and length; tags, including honest AI-generated tags; character sheets) and points out anything VNDB's editors would look at — reading share, narration, presentation. It is advice: the author decides what the game is, and VNDB's editors decide what they list.
- **Programmable:** add commands, effects and gameplay with plain JavaScript modules (`modules:` in the header). The documentation of a module's commands is generated from its schema.

## What's here

| Path | What it is |
|---|---|
| [`SHIORI-Spec.md`](SHIORI-Spec.md) | The specification — the document to give a model. |
| [`player.html`](player.html) | The browser player. |
| [`engine/core/`](engine/core) | Parser, compiler, VM, command modules, analysis, route explorer, VNDB report. Host-agnostic JavaScript, no dependencies. |
| [`engine/runtime/`](engine/runtime) | Browser runtime: stage compositor, 3D layer, UI, audio, saves, developer tools. |
| [`engine/vendor/lmn/`](engine/vendor/lmn) | LMN music notation and synthesiser (MIT). |
| [`tools/`](tools) · [`bin/shiori`](bin/shiori) | The command-line tools. |
| [`examples/`](examples) | Example games. |
| [`templates/new-game/`](templates/new-game) | Starter game used by `shiori new`. |
| [`tests/`](tests) | Test suite: `bin/shiori selftest`. |

## License

[MIT](LICENSE)
