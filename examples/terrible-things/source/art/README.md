# Art sources

These Python scripts generate every SVG in the game's `bg/`, `cg/` and `chars/` folders. Each one rebuilds the installed file byte for byte. The art direction lives in the game folder: `STYLE.md` (house style: line work, faces, glass, palettes, the blink overlay) and `ASSETS.md` (what each picture shows and where the story uses it).

Python 3.9 or newer, standard library only. Run the commands from this folder (`source/art`). Every script takes `--out DIR` (default `$TMPDIR/terrible-things-art`) and writes `DIR/` plus the same path the file has in the game, so nothing lands in the game folder unless you point `--out` at it.

To install a regenerated file, copy it over the game's copy, for example `cp /tmp/tt-art/bg/bakery.svg ../../bg/`.

| Installed SVG | Script | Command |
|---|---|---|
| `bg/bakery.svg` | `bg/bakery.py` | `python3 bg/bakery.py --out /tmp/tt-art` |
| `bg/hill_path.svg` | `bg/hill_path.py` | `python3 bg/hill_path.py --out /tmp/tt-art` |
| `bg/kiln_house.svg` | `bg/kiln_house.py` | `python3 bg/kiln_house.py --out /tmp/tt-art` |
| `bg/seashore.svg` | `bg/seashore.py` | `python3 bg/seashore.py --out /tmp/tt-art` |
| `bg/square.svg` | `bg/square.py` | `python3 bg/square.py --out /tmp/tt-art` |
| `bg/statue_garden.svg` | `bg/statue_garden.py` | `python3 bg/statue_garden.py --out /tmp/tt-art` |
| `cg/breaking.svg` | `cg/breaking.py` | `python3 cg/breaking.py --out /tmp/tt-art` |
| `cg/countess.svg` | `cg/countess.py` | `python3 cg/countess.py --out /tmp/tt-art` |
| `cg/hands.svg` | `cg/hands.py` | `python3 cg/hands.py --out /tmp/tt-art` |
| `chars/hinata/blink.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art blink` |
| `chars/hinata/blush.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art blush` |
| `chars/hinata/grin.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art grin` |
| `chars/hinata/scared.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art scared` |
| `chars/hinata/soft.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art soft` |
| `chars/hinata/tears.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art tears` |
| `chars/hinata/tired.svg` | `chars/gen_hinata.py` | `python3 chars/gen_hinata.py --out /tmp/tt-art tired` |
| `chars/nagi/blink.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art blink` |
| `chars/nagi/neutral.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art neutral` |
| `chars/nagi/resolute.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art resolute` |
| `chars/nagi/sad.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art sad` |
| `chars/nagi/smile.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art smile` |
| `chars/nagi/surprised.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art surprised` |
| `chars/nagi/tears.svg` | `chars/gen_nagi.py` | `python3 chars/gen_nagi.py --out /tmp/tt-art tears` |
| `chars/nemu/blink.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art blink` |
| `chars/nemu/panic.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art panic` |
| `chars/nemu/sad.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art sad` |
| `chars/nemu/serious.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art serious` |
| `chars/nemu/sleepy.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art sleepy` |
| `chars/nemu/smirk.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art smirk` |
| `chars/nemu/surprised.svg` | `chars/gen_nemu.py` | `python3 chars/gen_nemu.py --out /tmp/tt-art surprised` |
| `chars/suzu/angry.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art angry` |
| `chars/suzu/blink.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art blink` |
| `chars/suzu/proud.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art proud` |
| `chars/suzu/sad.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art sad` |
| `chars/suzu/soft.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art soft` |
| `chars/suzu/surprised.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art surprised` |
| `chars/suzu/tears.svg` | `chars/gen_suzu.py` | `python3 chars/gen_suzu.py --out /tmp/tt-art tears` |

A sprite generator run without names writes every expression plus `blink.svg`.

## Regenerate everything and check

```sh
for s in chars/*.py bg/*.py cg/*.py; do python3 "$s" --out /tmp/tt-art > /dev/null; done
(cd ../.. && for f in bg/*.svg cg/*.svg chars/*/*.svg; do cmp -s "$f" "/tmp/tt-art/$f" || echo "differs: $f"; done)
```

No output from the second line means the scripts and the game agree.

## Helpers in `lib/`

- `bglib.py`, `bgshapes.py`: document and painted-cloud helpers for `bakery`, `hill_path`, `kiln_house`.
- `crane2.py`: the red-crowned cranes on the kiln-house folding screen.
- `svglib.py`: document and shape helpers for `seashore`, `square`, `statue_garden`.
- `cglib.py`, `cast.py`, `cast34.py`, `figlab.py`, `handlab.py`, `suzuparts.py`: the CG face template, heads, 3/4 heads, kneeling figures, hands and Suzu's hair.
- `outpath.py`: the shared `--out` option.

## Things to know before editing

- All randomness uses fixed seeds, so output is repeatable. Most scenes draw many elements from one seeded generator, so adding or removing a random call shifts everything drawn after it. Give a new element its own `random.Random(seed)` to leave the rest alone.
- `blink.svg` is built from the eye shapes of every expression (STYLE.md section 7). After changing any expression's eyes or brows, regenerate the whole character, not just that file. `gen_hinata.py --check` and `gen_nagi.py --check` print brow clearance against the blink patch; `gen_nemu.py` always prints it.
- The CG heads are separate copies of the sprite designs (`suzuparts.py` is a port of Suzu's hair from `gen_suzu.py`). Changing a sprite does not change the CGs; edit both if the design itself changes.
- The original working copies rendered PNG previews with macOS `qlmanage`; that was dropped. Open an SVG in a browser to look at it.
