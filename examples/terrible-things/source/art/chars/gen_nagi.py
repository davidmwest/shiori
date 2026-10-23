#!/usr/bin/env python3
"""Nagi sprite generator.

Shared body/hair layers are emitted byte-identically into every expression file;
only the face group differs. blink.svg redraws the skin + front hair clipped to
a patch made from the convex hull of every expression's eye shapes (clipPaths,
not masks), then draws closed lids.

usage: gen_nagi.py [--out DIR] [--check] [name ...]
  writes DIR/chars/nagi/<name>.svg (default DIR: $TMPDIR/terrible-things-art);
  install by copying those files over the game's chars/nagi/.
"""
import argparse, math, os, re, sys, tempfile

OUT_ROOT = os.path.join(tempfile.gettempdir(), "terrible-things-art")

W, H = 760, 1040
HEAD_TF = "rotate(1.5 388 372)"
E = 268                 # eye line (head-local)
EXN, EXF = 340, 430     # near (screen-left) / far (screen-right) eye centres
KF = .86                # far eye horizontal foreshortening
MID = 397               # face midline (nose / mouth / chin)

# ------------------------------------------------------------------ helpers
NUM = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?")


def _fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def xf(d, fn):
    """Apply a point mapping to an absolute path (M L C Q Z only)."""
    out, buf = [], []
    for tok in NUM.findall(d):
        if tok.isalpha():
            out.append(tok)
            continue
        buf.append(float(tok))
        if len(buf) == 2:
            x, y = fn(*buf)
            out.append(_fmt(x))
            out.append(_fmt(y))
            buf = []
    return " ".join(out)


def tN(d):
    """near eye: local (x toward the nose, y down) -> head coords"""
    return xf(d, lambda x, y: (EXN + x, E + y))


def tF(d):
    """far eye: mirrored and foreshortened"""
    return xf(d, lambda x, y: (EXF - KF * x, E + y))


def ptN(x, y):
    return EXN + x, E + y


def ptF(x, y):
    return EXF - KF * x, E + y


def P(d, fill="none", stroke=None, sw=None, op=None, extra=""):
    a = f'<path d="{d}" fill="{fill}"'
    if stroke:
        a += f' stroke="{stroke}"'
        if sw is not None:
            a += f' stroke-width="{sw}"'
        a += ' stroke-linejoin="round" stroke-linecap="round"'
    if op is not None:
        a += f' opacity="{op}"'
    if extra:
        a += " " + extra
    return a + "/>"


def pair(d, **kw):
    """the same local eye-area shape on both eyes"""
    return P(tN(d), **kw) + P(tF(d), **kw)


def g(content, tf=None, extra=""):
    a = "<g"
    if tf:
        a += f' transform="{tf}"'
    if extra:
        a += " " + extra
    return a + ">" + content + "</g>"


def sparkle(x, y, r, col="#fff", op=1):
    k = r * .2
    return (f'<path d="M{_fmt(x)} {_fmt(y-r)} L{_fmt(x+k)} {_fmt(y-k)} L{_fmt(x+r)} {_fmt(y)} L{_fmt(x+k)} {_fmt(y+k)} '
            f'L{_fmt(x)} {_fmt(y+r)} L{_fmt(x-k)} {_fmt(y+k)} L{_fmt(x-r)} {_fmt(y)} L{_fmt(x-k)} {_fmt(y-k)} Z" '
            f'fill="{col}" opacity="{op}"/>')


# ------------------------------------------------------------------ palette
HAIR_LINE = "#0b0e1e"
HAIR_DARK = "#10142a"
HAIR_SHEEN = "#3b6c9e"
HAIR_SHEEN2 = "#5f9bd0"
HAIR_STRAND = "#3a5684"
LASH = "#0e1226"
BROW = "#1a2036"
SKIN = "#fde8dc"
SKIN_SH = "#f6cfc2"
SKIN_DEEP = "#eab3a6"
SKIN_LINE = "#b9705f"
CREASE = "#c98a7a"
MOUTH_LINE = "#9a4842"
IND = "#2f3a7a"
IND_SH = "#222b5e"
IND_DEEP = "#1a2150"
IND_LINE = "#151a3e"
IND_LIGHT = "#4a58a8"
SHIRT_LINE = "#6d6a9e"
SHIRT_SH = "#dfe3f2"
TROU = "#4b4f5e"
TROU_SH = "#373a46"
TROU_LINE = "#22242e"
RED = "#d8323c"
RED_D = "#8e1a26"
IRON_LINE = "#1d2130"

# ------------------------------------------------------------------ defs
DEFS = """
<linearGradient id="na-hair" gradientUnits="userSpaceOnUse" x1="0" y1="130" x2="0" y2="380">
  <stop offset="0" stop-color="#2a3458"/><stop offset=".35" stop-color="#1e2540"/><stop offset="1" stop-color="#161b30"/>
</linearGradient>
<linearGradient id="na-hairBack" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#151a30"/><stop offset="1" stop-color="#0e1222"/>
</linearGradient>
<linearGradient id="na-sheen" gradientUnits="userSpaceOnUse" x1="270" y1="0" x2="490" y2="0">
  <stop offset="0" stop-color="#6aa8dc"/><stop offset=".45" stop-color="#3f74a8"/><stop offset="1" stop-color="#2a4d7c"/>
</linearGradient>
<linearGradient id="na-sclera" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#d3d9ee"/><stop offset=".45" stop-color="#ffffff"/>
</linearGradient>
<linearGradient id="na-iris" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#22344c"/><stop offset=".3" stop-color="#3f5b7a"/><stop offset=".58" stop-color="#7d9bb8"/>
  <stop offset=".82" stop-color="#a9c8dc"/><stop offset="1" stop-color="#d4e4ef"/>
</linearGradient>
<radialGradient id="na-irisGlow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#eef9ff" stop-opacity=".9"/><stop offset=".6" stop-color="#c4e6f5" stop-opacity=".45"/><stop offset="1" stop-color="#c4e6f5" stop-opacity="0"/>
</radialGradient>
<radialGradient id="na-pupil" cx=".5" cy=".4" r=".6">
  <stop offset="0" stop-color="#1f2f48"/><stop offset="1" stop-color="#121c2e"/>
</radialGradient>
<linearGradient id="na-rainbow" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="na-rainbowV" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="na-tear" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#e6f8ff" stop-opacity=".8"/><stop offset="1" stop-color="#bfe9ff" stop-opacity=".85"/>
</linearGradient>
<radialGradient id="na-blush" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff8fa3" stop-opacity=".55"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<radialGradient id="na-blushSoft" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff8fa3" stop-opacity=".38"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<radialGradient id="na-blush2" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff6f8c" stop-opacity=".8"/><stop offset=".6" stop-color="#ff7f96" stop-opacity=".4"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<linearGradient id="na-jacket" gradientUnits="userSpaceOnUse" x1="0" y1="390" x2="0" y2="770">
  <stop offset="0" stop-color="#3e4c9e"/><stop offset=".45" stop-color="#323e84"/><stop offset="1" stop-color="#2a3472"/>
</linearGradient>
<linearGradient id="na-sleeve" gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="0" y2="700">
  <stop offset="0" stop-color="#3f4ea0"/><stop offset=".6" stop-color="#323e84"/><stop offset="1" stop-color="#2b3574"/>
</linearGradient>
<linearGradient id="na-band" gradientUnits="userSpaceOnUse" x1="0" y1="390" x2="0" y2="760">
  <stop offset="0" stop-color="#2a3370"/><stop offset="1" stop-color="#222a60"/>
</linearGradient>
<linearGradient id="na-shirt" gradientUnits="userSpaceOnUse" x1="0" y1="370" x2="0" y2="540">
  <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1f3fb"/>
</linearGradient>
<linearGradient id="na-trousers" gradientUnits="userSpaceOnUse" x1="0" y1="720" x2="0" y2="1040">
  <stop offset="0" stop-color="#555a6c"/><stop offset=".5" stop-color="#4b4f5e"/><stop offset="1" stop-color="#454958"/>
</linearGradient>
<linearGradient id="na-iron" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#7a84a2"/><stop offset=".45" stop-color="#4a5270"/><stop offset="1" stop-color="#2c3247"/>
</linearGradient>
<filter id="na-b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="na-b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="na-b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="na-b6" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
"""

# ------------------------------------------------------------------ body geometry (absolute)
NECK = "M364 322 C365 346 364 368 361 394 L417 394 C414 368 413 346 414 322 Z"

TORSO = ("M352 394 C334 398 312 404 292 410 C278 414 268 422 264 436 L260 470 "
         "C262 560 272 660 284 752 L472 752 C474 660 476 560 478 480 L478 444 "
         "C476 426 470 416 460 410 C448 404 436 398 424 394 Z")
# collar bands of the samue (wrap front, left panel over right)
BAND_UNDER = ("M346 398 C354 396 362 396 368 398 C378 432 392 470 410 512 L398 528 "
              "C376 488 358 446 346 398 Z")
BAND_OVER = ("M420 396 C428 396 436 398 442 402 C430 446 412 486 392 522 C370 562 354 610 346 660 "
             "C342 690 340 720 340 752 L320 752 C320 716 322 684 328 652 C338 600 356 552 376 512 "
             "C394 478 410 440 420 396 Z")
SHIRT_V = "M352 396 L429 397 C420 440 408 476 396 510 C380 476 364 440 352 396 Z"

# near (her right) arm: sleeve from the shoulder, bent at the elbow, forearm across the waist
SLEEVE_N = ("M294 410 C278 412 268 422 263 440 C258 470 256 520 256 566 C257 598 262 620 274 632 "
            "C292 644 336 644 390 638 L388 588 C364 588 338 584 318 578 C308 562 304 532 304 498 "
            "C304 464 302 432 294 410 Z")
CUFF_N = (389, 612, 7, 26, -3)       # sleeve opening: cx cy rx ry rot
# far (her left) arm: upper arm on the far side, sleeve ends below the elbow
SLEEVE_F = ("M462 410 C484 414 502 426 510 446 C520 490 526 550 529 610 C530 640 530 664 528 690 "
            "C514 700 492 700 478 690 C476 650 474 600 474 560 C474 520 470 470 462 440 Z")
SLEEVE_F_EDGE = "M510 446 C520 490 526 550 529 610 C530 640 530 664 528 690"
CUFF_F = (503, 692, 25, 7, 3)
FAR_DX = -16      # the far arm is drawn in this shifted frame

TROUSERS = ("M286 728 L472 728 C476 820 478 930 480 1040 L280 1040 C281 930 283 820 286 728 Z")


# ------------------------------------------------------------------ hand shapes (local frames)
# gripping right hand: wrist at origin, back of the hand toward us, fingers along +x
# lying across her left arm; they are clipped where they curl round its outer edge.
GRIP = ("M0 -13 C14 -15 30 -18 44 -20 C50 -21 56 -22 62 -21 C72 -20 82 -17 92 -12 C100 -8 108 -5 120 -2 "
        "L120 40 C110 38 100 35 90 32 C80 29 70 26 60 24 C52 22 46 21 40 21 C26 20 12 17 0 14 Z")
GRIP_SEPS = ["M60 -9 C72 -8 84 -5 94 -1 C102 2 110 4 118 6",
             "M60 3 C72 4 84 7 94 11 C102 14 110 16 118 18",
             "M58 14 C68 16 78 19 88 22 C96 25 104 27 116 30"]
THUMB = "M8 -12 C16 -22 28 -30 42 -34 C50 -36 56 -34 56 -30 C56 -26 50 -23 42 -22 C32 -20 22 -16 16 -11 Z"
GRIP_TF = "translate(428 610) rotate(-3) scale(.9)"
# relaxed left hand hanging, loosely curled, wrist at origin, fingers along +y
HANG = ("M-11 0 C-12 12 -12 24 -10 36 C-9 44 -6 52 0 56 C6 60 13 58 15 50 C17 38 16 20 14 0 Z")
HANG_THUMB = "M-11 12 C-17 20 -19 30 -16 38 C-15 41 -11 41 -10 38 C-10 31 -8 24 -5 19 Z"


# ------------------------------------------------------------------ head geometry (head-local)
FACE = ("M290 196 L288 252 C288 282 294 302 308 318 C326 336 356 349 392 351 "
        "C410 350 430 340 446 324 C460 308 468 292 470 274 C471 262 469 252 468 244 "
        "C470 232 471 214 470 196 Z")
JAW_SHADOW = ("M470 274 C468 292 460 308 446 324 C430 340 412 350 392 351 "
              "C414 342 434 328 448 310 C458 296 463 284 465 270 Z")

# bangs: blunt fringe, clumps from far (screen-right) to near (screen-left): (notch_r, tip, notch_l)
BANG_START = (481, 262)
CLUMPS = [((473, 198), (463, 211), (455, 199)),
          ((455, 199), (440, 212), (428, 196)),
          ((428, 196), (416, 210), (406, 200)),
          ((406, 200), (392, 213), (377, 193)),
          ((377, 193), (362, 211), (350, 199)),
          ((350, 199), (332, 212), (318, 197)),
          ((318, 197), (304, 210), (291, 203))]
BANG_END = (285, 262)


def _bang_edge(dx=0, dy=0, soft=False):
    def pt(p):
        return f"{_fmt(p[0]+dx)} {_fmt(p[1]+dy)}"
    out = f" C{pt((469, 252))} {pt((468, 222))} {pt(CLUMPS[0][0])}"
    for nr, t, nl in CLUMPS:
        ty = t[1] - 4 if soft else t[1]
        br, bl = ty - 3, ty - 4
        p1 = (nr[0] - 5, br)
        p2 = (nl[0] + 5, bl)
        # narrow V split, then an almost flat bottom with a soft point: a blunt cut
        out += f" C{pt((nr[0]-1, nr[1] + (br-nr[1])*.5))} {pt((nr[0]-3, br-3))} {pt(p1)}"
        out += f" C{pt((p1[0] - (p1[0]-t[0])*.5, br+1))} {pt((t[0]+4, ty-1))} {pt((t[0], ty))}"
        out += f" C{pt((t[0]-4, ty-1))} {pt((p2[0] + (t[0]-p2[0])*.5, bl+1))} {pt(p2)}"
        out += f" C{pt((nl[0]+3, bl-3))} {pt((nl[0]+1, nl[1] + (bl-nl[1])*.5))} {pt(nl)}"
    nl = CLUMPS[-1][2]
    out += f" C{pt((nl[0]-3, nl[1]+10))} {pt((BANG_END[0]+1, BANG_END[1]-12))} {pt(BANG_END)}"
    return out


CROWN = ("M284 262 C270 196 304 136 376 133 C446 132 494 182 478 272" + _bang_edge() + " Z")
BANG_SHADOW = "M260 150 L500 150 L500 280 L481 280" + _bang_edge(3, 10, soft=True) + " L260 272 Z"

HAIR_BACK = ("M300 170 C270 196 256 240 256 290 C256 322 258 346 262 362 C300 372 440 372 494 360 "
             "C498 330 498 296 494 262 C490 224 476 190 452 170 Z")
FAR_LOCK = ("M462 182 C484 204 496 240 497 286 C498 318 496 342 493 360 C484 368 470 368 460 364 "
            "C466 336 470 304 471 274 C472 244 470 214 462 182 Z")
NEAR_LOCK = ("M300 176 C281 203 259 236 257 284 C255 316 257 342 261 362 "
             "C270 369 282 371 292 368 L298 373 C306 371 314 368 320 362 "
             "C309 338 302 312 299 284 C296 252 296 220 301 196 C302 188 301 181 300 176 Z")


# ------------------------------------------------------------------ body layers
def hair_back():
    s = P(HAIR_BACK, fill="url(#na-hairBack)", stroke=HAIR_LINE, sw=2.6)
    for d in ("M300 300 C302 330 306 350 312 366", "M440 300 C442 330 444 350 446 364",
              "M470 300 C474 330 476 350 478 362"):
        s += P(d, stroke="#2c3a5c", sw=1.3, op=.6)
    return s


def far_lock():
    s = P(FAR_LOCK, fill="url(#na-hair)", stroke=HAIR_LINE, sw=2.4)
    s += P("M470 210 C484 236 490 270 490 306 C490 330 488 346 486 356", stroke=HAIR_SHEEN, sw=3.5, op=.55)
    s += P("M476 240 C482 270 484 300 482 340", stroke=HAIR_LINE, sw=1.3, op=.6)
    s += P("M466 300 C467 324 466 344 464 360", stroke=HAIR_LINE, sw=1.2, op=.5)
    s += P("M478 362 L480 352 M468 364 L469 356", stroke=HAIR_LINE, sw=1.2, op=.6)
    return s


def plait():
    """thin three-strand braid from behind her left ear, tied with red cord"""
    s = ""
    x0, y0, n, step = 476, 344, 9, 10.5
    for i in range(n):
        y = y0 + i * step
        x = x0 - i * .5
        w = 9 - i * .25
        sd = 1 if i % 2 == 0 else -1
        seg = (f"M{_fmt(x-sd*w)} {_fmt(y-4)} C{_fmt(x-sd*w*.4)} {_fmt(y-8)} {_fmt(x+sd*w*.6)} {_fmt(y-3)} {_fmt(x+sd*w)} {_fmt(y+4)} "
               f"C{_fmt(x+sd*w*1.05)} {_fmt(y+9)} {_fmt(x+sd*w*.4)} {_fmt(y+11)} {_fmt(x)} {_fmt(y+8)} "
               f"C{_fmt(x-sd*w*.5)} {_fmt(y+5)} {_fmt(x-sd*w*1.1)} {_fmt(y)} {_fmt(x-sd*w)} {_fmt(y-4)} Z")
        s += P(seg, fill="url(#na-hair)", stroke=HAIR_LINE, sw=1.5)
        s += P(f"M{_fmt(x-sd*w*.6)} {_fmt(y-3.5)} C{_fmt(x-sd*w*.1)} {_fmt(y-5)} {_fmt(x+sd*w*.5)} {_fmt(y-1)} {_fmt(x+sd*w*.75)} {_fmt(y+3)}",
               stroke=HAIR_SHEEN2 if sd > 0 else HAIR_SHEEN, sw=1.7, op=.85)
    yb = y0 + n * step + 1
    xb = x0 - n * .5
    # red cord tie
    s += P(f"M{_fmt(xb-6)} {_fmt(yb-3)} C{_fmt(xb-2)} {_fmt(yb-1)} {_fmt(xb+2)} {_fmt(yb-1)} {_fmt(xb+6)} {_fmt(yb-3)} "
           f"L{_fmt(xb+6)} {_fmt(yb+3)} C{_fmt(xb+2)} {_fmt(yb+5)} {_fmt(xb-2)} {_fmt(yb+5)} {_fmt(xb-6)} {_fmt(yb+3)} Z",
           fill=RED, stroke=RED_D, sw=1.3)
    s += P(f"M{_fmt(xb-4)} {_fmt(yb-1)} C{_fmt(xb-1)} {_fmt(yb+1)} {_fmt(xb+2)} {_fmt(yb+1)} {_fmt(xb+4)} {_fmt(yb-1)}",
           stroke="#ff9aa2", sw=1, op=.9)
    for d in (f"M{_fmt(xb+4)} {_fmt(yb+3)} C{_fmt(xb+8)} {_fmt(yb+10)} {_fmt(xb+7)} {_fmt(yb+18)} {_fmt(xb+10)} {_fmt(yb+25)}",
              f"M{_fmt(xb+2)} {_fmt(yb+4)} C{_fmt(xb+4)} {_fmt(yb+10)} {_fmt(xb+2)} {_fmt(yb+16)} {_fmt(xb+4)} {_fmt(yb+21)}"):
        s += P(d, stroke=RED_D, sw=3) + P(d, stroke=RED, sw=1.8)
    # brush end of the plait
    tuft = (f"M{_fmt(xb-5)} {_fmt(yb+4)} C{_fmt(xb-8)} {_fmt(yb+11)} {_fmt(xb-8)} {_fmt(yb+17)} {_fmt(xb-5)} {_fmt(yb+22)} "
            f"L{_fmt(xb-3)} {_fmt(yb+16)} L{_fmt(xb-1)} {_fmt(yb+24)} L{_fmt(xb+1)} {_fmt(yb+16)} "
            f"C{_fmt(xb+3)} {_fmt(yb+12)} {_fmt(xb+4)} {_fmt(yb+8)} {_fmt(xb+4)} {_fmt(yb+4)} Z")
    s += P(tuft, fill="url(#na-hair)", stroke=HAIR_LINE, sw=1.5)
    s += P(f"M{_fmt(xb-3)} {_fmt(yb+7)} L{_fmt(xb-3.5)} {_fmt(yb+14)}", stroke=HAIR_SHEEN, sw=1.2, op=.8)
    return s


def neck():
    s = P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    # chin shadow on the neck
    s += P("M364 326 C376 346 398 356 414 344 L414 368 C398 378 378 374 364 360 Z", fill=SKIN_SH)
    s += P("M402 352 C408 362 412 374 414 386 L414 350 Z", fill=SKIN_SH, op=.8)
    return s


def trousers():
    s = P(TROUSERS, fill="url(#na-trousers)", stroke=TROU_LINE, sw=2.6)
    s += '<clipPath id="na-trouClip"><path d="' + TROUSERS + '"/></clipPath><g clip-path="url(#na-trouClip)">'
    s += P("M448 730 C456 830 462 940 466 1040 L490 1040 L490 730 Z", fill=TROU_SH, op=.9)
    s += P("M392 800 C396 880 398 960 400 1040 L414 1040 C412 960 408 880 400 800 Z", fill=TROU_SH, op=.6)
    s += P("M390 790 C394 870 396 960 398 1040", stroke=TROU_LINE, sw=2)
    s += P("M334 790 C332 880 332 960 332 1040", stroke="#6a6f82", sw=1.5, op=.6)
    s += P("M300 744 C306 772 316 790 330 800", stroke=TROU_LINE, sw=1.4, op=.45)
    s += P("M368 760 C374 776 382 786 390 790", stroke=TROU_LINE, sw=1.4, op=.45)
    s += "</g>"
    return s


def sashiko(d, op=.55, sw=1.2):
    return P(d, stroke="#c8d2ff", sw=sw, op=op, extra='stroke-dasharray="5 4"')


def seigaiha(x0, x1, y0, r=12, rows=3, bg="#262f6a"):
    """overlapping rows of concentric wave arcs, stitched in pale thread"""
    s = ""
    for row in range(rows):
        y = y0 + row * r * .62
        off = 0 if row % 2 == 0 else r
        x = x0 - r + off
        while x < x1 + r:
            s += (f'<path d="M{_fmt(x-r)} {_fmt(y)} A{r} {r} 0 0 1 {_fmt(x+r)} {_fmt(y)} L{_fmt(x+r)} {_fmt(y+r)} '
                  f'L{_fmt(x-r)} {_fmt(y+r)} Z" fill="{bg}"/>')
            for k, rr in enumerate((r - 1.5, r * .66, r * .33)):
                s += (f'<path d="M{_fmt(x-rr)} {_fmt(y)} A{_fmt(rr)} {_fmt(rr)} 0 0 1 {_fmt(x+rr)} {_fmt(y)}" fill="none" '
                      f'stroke="#aebcff" stroke-width="1.1" opacity="{.6 if k == 0 else .45}" stroke-dasharray="3 2.4"/>')
            x += 2 * r
    return s


def jacket():
    s = P(TORSO, fill="url(#na-jacket)", stroke=IND_LINE, sw=2.6)
    s += '<clipPath id="na-torsoClip"><path d="' + TORSO + '"/></clipPath><g clip-path="url(#na-torsoClip)">'
    # shading: the far side of the body is turned away from the light
    s += P("M448 396 C464 480 470 620 466 760 L510 760 L510 396 Z", fill=IND_SH)
    # cast shadow under the crossing forearm
    s += P("M270 640 C320 650 380 652 440 644 C452 642 466 640 480 636 L480 654 C430 660 330 660 268 652 Z",
           fill=IND_SH, op=.6)
    # hem band: seigaiha waves in sashiko stitch (nagi = a calm sea)
    s += '<clipPath id="na-hemClip"><path d="M250 700 C330 706 420 708 500 704 L500 770 L250 770 Z"/></clipPath>'
    s += g(seigaiha(262, 492, 718, r=15, rows=5), extra='clip-path="url(#na-hemClip)"')
    s += P("M250 700 C330 706 420 708 500 704", stroke=IND_LINE, sw=1.6, op=.7)
    s += sashiko("M262 696 C330 702 420 704 492 700", op=.45)
    # folds
    for d in ("M300 668 C303 680 305 690 306 698", "M444 664 C446 680 447 690 447 700",
              "M414 664 C417 680 418 690 418 700", "M430 470 C440 500 446 530 448 556"):
        s += P(d, stroke=IND_LINE, sw=1.4, op=.45)
    s += P("M300 410 C320 404 338 400 350 398", stroke=IND_LIGHT, sw=2.2, op=.6)
    s += "</g>"
    return s


def shirt_and_collar():
    # white shirt visible in the V
    s = P(SHIRT_V, fill="url(#na-shirt)", stroke=SHIRT_LINE, sw=1.6)
    s += P("M396 404 C397 440 397 476 396 508", stroke=SHIRT_LINE, sw=1.2, op=.5)
    for y in (426, 452, 478):
        s += f'<circle cx="400" cy="{y}" r="2.6" fill="#ffffff" stroke="{SHIRT_LINE}" stroke-width="1"/>'
    s += P("M420 398 C414 430 404 466 396 500 L404 500 C412 466 424 432 432 400 Z", fill=SHIRT_SH, op=.8)
    # under band (screen-left)
    s += P(BAND_UNDER, fill="url(#na-band)", stroke=IND_LINE, sw=2)
    s += sashiko("M356 402 C364 440 380 480 402 518")
    # over band (screen-right) running down to the hem
    s += P(BAND_OVER, fill="url(#na-band)", stroke=IND_LINE, sw=2.2)
    s += sashiko("M431 400 C420 444 402 484 384 518 C362 560 344 608 336 652 C330 686 328 716 326 748")
    s += P("M436 404 C426 446 410 484 392 518", stroke=IND_LIGHT, sw=1.6, op=.6)
    # the shirt's stand collar
    back = "M358 380 C372 372 406 372 420 380 L422 394 L356 394 Z"
    s += P(back, fill="#e6e9f6", stroke=SHIRT_LINE, sw=1.6)
    near = "M356 384 C366 394 382 400 394 400 L394 418 C378 418 362 410 354 400 Z"
    far = "M400 400 C410 400 418 396 424 386 L426 402 C420 412 410 418 400 418 Z"
    s += P(near, fill="url(#na-shirt)", stroke=SHIRT_LINE, sw=1.8)
    s += P(far, fill=SHIRT_SH, stroke=SHIRT_LINE, sw=1.8)
    s += P("M360 398 C368 404 380 408 392 409", stroke=SHIRT_LINE, sw=1, op=.4)
    return s


def key_and_cord():
    s = ""
    # red cord around the neck, emerging from under the collar bands
    for d in ("M366 404 C374 430 386 456 396 476", "M424 404 C418 430 410 456 402 476"):
        s += P(d, stroke=RED_D, sw=3.4) + P(d, stroke=RED, sw=2.2)
    s += P("M367 408 C374 430 384 452 393 470", stroke="#ff8a92", sw=.9, op=.8)
    # iron key: ring bow, shaft, bit
    kx, ky = 399, 486
    s += f'<circle cx="{kx}" cy="{ky}" r="11" fill="none" stroke="{IRON_LINE}" stroke-width="7.4"/>'
    s += f'<circle cx="{kx}" cy="{ky}" r="11" fill="none" stroke="url(#na-iron)" stroke-width="4.6"/>'
    s += P(f"M{kx-8} {ky-6} C{kx-5} {ky-10} {kx} {ky-11} {kx+4} {ky-10}", stroke="#c3cbe2", sw=1.4, op=.9)
    shaft = f"M{kx-3.5} {ky+12} L{kx+3.5} {ky+12} L{kx+3.5} {ky+64} L{kx-3.5} {ky+64} Z"
    s += P(shaft, fill="url(#na-iron)", stroke=IRON_LINE, sw=1.6)
    collar_ = f"M{kx-6} {ky+14} L{kx+6} {ky+14} L{kx+6} {ky+19} L{kx-6} {ky+19} Z"
    s += P(collar_, fill="#5a6280", stroke=IRON_LINE, sw=1.3)
    bit = (f"M{kx+3} {ky+48} L{kx+15} {ky+48} L{kx+15} {ky+53} L{kx+11} {ky+53} L{kx+11} {ky+57} "
           f"L{kx+15} {ky+57} L{kx+15} {ky+63} L{kx+3} {ky+63} Z")
    s += P(bit, fill="url(#na-iron)", stroke=IRON_LINE, sw=1.5)
    s += P(f"M{kx-1.5} {ky+22} L{kx-1.5} {ky+60}", stroke="#b4bcd6", sw=1.1, op=.8)
    s += sparkle(kx - 6, ky - 8, 5)
    # cord knot over the ring
    s += P(f"M{kx-4} {ky-14} C{kx-2} {ky-9} {kx+2} {ky-9} {kx+4} {ky-14}", stroke=RED_D, sw=4.4)
    s += P(f"M{kx-4} {ky-14} C{kx-2} {ky-9} {kx+2} {ky-9} {kx+4} {ky-14}", stroke=RED, sw=3)
    return s


def cuff_ellipse(c, fill, stroke, sw):
    cx, cy, rx, ry, rot = c
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')


def far_arm():
    s = P(SLEEVE_F, fill="url(#na-sleeve)", stroke=IND_LINE, sw=2.6)
    s += '<clipPath id="na-slvF"><path d="' + SLEEVE_F + '"/></clipPath><g clip-path="url(#na-slvF)">'
    s += P("M504 430 C516 500 520 580 520 700 L540 700 L540 430 Z", fill=IND_SH)
    s += P("M470 666 C488 674 508 676 532 670 L536 704 L466 704 Z", fill=IND_SH, op=.8)
    # cloth bunched under her fingers
    for d in ("M492 470 C498 510 500 540 500 566", "M484 646 C494 652 506 656 518 656",
              "M494 640 C500 648 506 662 508 676"):
        s += P(d, stroke=IND_LINE, sw=1.4, op=.5)
    s += sashiko("M482 684 C494 690 512 690 524 684")
    s += "</g>"
    s += cuff_ellipse(CUFF_F, "#1a2150", IND_LINE, 2)
    # shirt sleeve, wrist, hanging hand (half hidden behind the hip)
    cuff = "M486 692 C490 702 492 712 492 722 L514 722 C514 712 516 702 520 692 Z"
    s += P(cuff, fill="url(#na-shirt)", stroke=SHIRT_LINE, sw=1.8)
    s += P("M490 714 L515 714", stroke=SHIRT_LINE, sw=1.1, op=.6)
    hand = P(HANG, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    hand += P("M3 2 C7 16 9 32 8 46 C8 52 6 56 3 58 C9 59 13 56 15 50 C17 38 16 20 14 2 Z", fill=SKIN_SH)
    # curled fingertips tucked in toward the thigh
    hand += P("M-10 36 C-14 42 -14 50 -10 54 C-6 58 0 58 4 56", stroke=SKIN_LINE, sw=1.6, op=.8)
    hand += P("M-9 44 C-5 46 -1 46 2 45 M-7 51 C-3 53 1 53 4 52", stroke=SKIN_LINE, sw=1.2, op=.55)
    hand += P(HANG_THUMB, fill=SKIN, stroke=SKIN_LINE, sw=1.8)
    hand += P("M-8 4 C-9 14 -9 24 -8 32", stroke="#ffffff", sw=1.4, op=.5)
    s += g(hand, "translate(503 720) rotate(2)")
    return g(s, f"translate({FAR_DX} 0)")


def near_arm():
    s = P(SLEEVE_N, fill="url(#na-sleeve)", stroke=IND_LINE, sw=2.6)
    s += '<clipPath id="na-slvN"><path d="' + SLEEVE_N + '"/></clipPath><g clip-path="url(#na-slvN)">'
    # underside of the arm and the fold at the elbow
    s += P("M246 570 C256 616 290 630 392 624 L392 650 L240 650 Z", fill=IND_SH)
    s += P("M290 430 C298 470 302 520 302 576 L318 576 L318 430 Z", fill=IND_SH, op=.7)
    for d in ("M300 584 C288 594 276 602 262 606", "M318 604 C336 610 356 612 376 610",
              "M268 436 C276 446 280 458 284 474", "M266 520 C266 548 268 570 274 590"):
        s += P(d, stroke=IND_LINE, sw=1.5, op=.5)
    s += P("M262 452 C259 490 259 530 261 560", stroke=IND_LIGHT, sw=2.4, op=.6)
    s += P("M270 424 C278 418 286 414 294 412", stroke=IND_LIGHT, sw=2.2, op=.6)
    s += P("M318 580 C340 585 362 588 384 589", stroke=IND_LIGHT, sw=2, op=.55)
    s += sashiko("M376 590 C379 606 380 620 379 634")
    s += "</g>"
    # opening of the sleeve with the white shirt sleeve coming out
    s += cuff_ellipse(CUFF_N, "#1a2150", IND_LINE, 2)
    shirt = "M386 590 C398 590 412 591 428 592 L430 626 C414 628 398 630 388 632 Z"
    s += P(shirt, fill="url(#na-shirt)", stroke=SHIRT_LINE, sw=1.8)
    s += P("M420 592 L422 627", stroke=SHIRT_LINE, sw=1.1, op=.6)
    # the gripping hand: clipped where the fingers curl round the far arm's outer edge
    far_edge = xf(SLEEVE_F_EDGE, lambda x, y: (x + FAR_DX, y))
    edge = sample_path(far_edge, 16)
    clip = "M300 440 L" + " L".join(f"{_fmt(x)} {_fmt(y)}" for x, y in edge) + " L300 700 Z"
    hand = P(GRIP, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    # shade: the lower fingers, the underside, and where the fingers turn away round the arm
    hand += P("M58 14 C68 16 78 19 88 22 C96 25 104 27 120 30 L120 40 C110 38 100 35 90 32 C80 29 70 26 60 24 "
              "C52 22 46 21 40 21 C26 20 12 17 0 14 L0 9 C14 12 30 14 46 14 Z", fill=SKIN_SH)
    hand += P("M98 -10 C104 -7 110 -5 120 -2 L120 40 L104 36 C108 26 108 6 100 -8 Z", fill=SKIN_SH, op=.75)
    for d in GRIP_SEPS:
        hand += P(d, stroke=SKIN_LINE, sw=1.5, op=.8)
    for d in ("M84 -16 C86 -13 86 -10 85 -7", "M88 -4 C90 -1 90 3 89 6", "M86 8 C88 11 88 15 87 18"):
        hand += P(d, stroke=SKIN_LINE, sw=1.1, op=.5)
    for d in ("M50 -18 C52 -14 53 -10 53 -6", "M54 -4 C56 0 56 4 56 8"):
        hand += P(d, stroke=SKIN_LINE, sw=1, op=.3)
    hand += P("M14 -8 C26 -12 38 -16 52 -17 C60 -17 68 -16 76 -14", stroke="#ffffff", sw=1.5, op=.6)
    s += f'<clipPath id="na-gripClip"><path d="{clip}"/></clipPath>'
    s += g(g(hand, GRIP_TF), extra='clip-path="url(#na-gripClip)"')
    s += P(far_edge, stroke=IND_LINE, sw=2.6)
    thumb = P(THUMB, fill=SKIN, stroke=SKIN_LINE, sw=2)
    thumb += P("M44 -32 C49 -33.5 53 -32.5 54 -30.5 C51 -28.5 47 -28.5 44 -29.5 Z", fill="#fff4ef", stroke=SKIN_LINE, sw=.9, op=.9)
    s += g(thumb, GRIP_TF)
    return s


def body_layers():
    s = "<!-- back hair -->" + g(hair_back(), HEAD_TF)
    s += "<!-- trousers -->" + trousers()
    s += "<!-- far arm -->" + far_arm()
    s += "<!-- neck -->" + neck()
    s += "<!-- jacket -->" + jacket() + shirt_and_collar() + key_and_cord()
    s += "<!-- near arm -->" + near_arm()
    s += "<!-- plait -->" + g(plait() + far_lock(), HEAD_TF)
    return s


# ------------------------------------------------------------------ head
def face_base():
    s = P(FACE, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += '<clipPath id="na-faceClip"><path d="' + FACE + '"/></clipPath>'
    s += g(P(BANG_SHADOW, fill=SKIN_SH), extra='clip-path="url(#na-faceClip)"')
    s += P(JAW_SHADOW, fill=SKIN_SH, op=.75)
    s += f'<ellipse cx="330" cy="{E+40}" rx="27" ry="10" fill="url(#na-blushSoft)"/>'
    s += f'<ellipse cx="446" cy="{E+40}" rx="21" ry="9" fill="url(#na-blushSoft)"/>'
    s += P(f"M{MID+3} {E+30} C{MID+4} {E+34} {MID+5} {E+37} {MID+7} {E+39} L{MID+3} {E+40}", stroke="#d3907f", sw=1.7)
    s += P(f"M{MID+1} {E+22} C{MID+2} {E+26} {MID+2} {E+29} {MID+1} {E+32}", stroke="#ffffff", sw=1.5, op=.8)
    return s


def crown():
    s = P(CROWN, fill="url(#na-hair)", stroke=HAIR_LINE, sw=2.4)
    # strands from the notches up toward the whorl
    for (n, t, _nl) in CLUMPS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{_fmt(x0 + (366-x0)*.2)} {y0-46} {_fmt(366 + (x0-366)*.35)} 150",
               stroke=HAIR_LINE, sw=1.4, op=.5)
        mx = (x0 + t[0]) / 2
        s += P(f"M{_fmt(mx+1)} {y0-10} C{_fmt(mx)} {y0+2} {_fmt((mx+t[0])/2)} {_fmt(t[1]-10)} {_fmt(t[0]+(mx-t[0])*.3)} {_fmt(t[1]-4)}",
               stroke=HAIR_STRAND, sw=1.3, op=.7)
    # angel-ring sheen: sea-blue band following the dome with a soft scalloped edge
    s += P("M292 190 C314 164 346 152 378 151 C412 152 446 164 468 188 "
           "C462 185 457 191 451 189 C443 181 436 188 429 185 C420 175 410 184 401 181 "
           "C393 172 383 181 374 179 C365 172 355 182 347 181 C339 177 330 186 322 186 "
           "C314 185 306 195 299 193 C296 193 294 192 292 190 Z", fill="url(#na-sheen)", op=.85)
    s += P("M304 176 C322 162 344 155 368 154", stroke="#9fd0f4", sw=2.2, op=.8)
    s += P("M392 155 C406 156 418 159 430 164", stroke="#ffffff", sw=1.3, op=.5)
    # cool rim light along the lit top edge so the dark bob reads on night scenes
    s += P("M287 232 C282 190 310 146 372 139 C408 136 436 146 456 162", stroke="#7fb4e6", sw=2, op=.45)
    # cool shadow on the far side of the crown
    s += P("M480 262 C492 180 446 132 376 133 C440 146 474 196 468 240 Z", fill=HAIR_DARK, op=.6)
    return s


def near_lock():
    s = P(NEAR_LOCK, fill="url(#na-hair)", stroke=HAIR_LINE, sw=2.4)
    s += P("M290 190 C272 220 264 252 264 290 C264 320 266 340 268 356", stroke=HAIR_SHEEN, sw=4.5, op=.7)
    s += P("M284 206 C274 228 270 252 270 280", stroke="#9fd0f4", sw=1.4, op=.7)
    s += P("M292 206 C284 250 284 306 296 364", stroke=HAIR_LINE, sw=1.3, op=.55)
    s += P("M276 300 C276 330 278 350 282 366", stroke=HAIR_STRAND, sw=1.3, op=.6)
    s += P("M304 322 C308 340 312 352 316 362", stroke=HAIR_LINE, sw=1.2, op=.45)
    return s


def head_front():
    return crown() + near_lock()


# ------------------------------------------------------------------ eyes
EYE_SHAPES = []     # (local d, kind)


def reg(d, kind="fill"):
    if (d, kind) not in EYE_SHAPES:
        EYE_SHAPES.append((d, kind))
    return d


def iris(cx, cy, rx, ry, idx, k=1.0, small=False):
    cid = f"na-ir{idx}"
    e = f'cx="{_fmt(cx)}" cy="{_fmt(cy)}" rx="{_fmt(rx)}" ry="{_fmt(ry)}"'
    s = f'<clipPath id="{cid}"><ellipse {e}/></clipPath>'
    s += f'<ellipse {e} fill="url(#na-iris)"/>'
    c = ""
    # sea-glass glow pooling in the lower half
    c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy+ry*.55)}" rx="{_fmt(rx*.85)}" ry="{_fmt(ry*.42)}" fill="url(#na-irisGlow)"/>'
    # fine radial streaks
    for a in range(0, 360, 24):
        r0, r1 = 10, ry * .95
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        c += (f'<line x1="{_fmt(cx+ca*r0*k)}" y1="{_fmt(cy+sa*r0)}" x2="{_fmt(cx+ca*r1*k)}" y2="{_fmt(cy+sa*r1)}" '
              f'stroke="#cfe6f5" stroke-width=".8" opacity=".35"/>')
    # pupil with a pale ring
    pr = (6.5, 9) if small else (8, 11)
    c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy+1)}" rx="{_fmt(pr[0]*k+3)}" ry="{_fmt(pr[1]+3)}" fill="none" stroke="#a6c6dc" stroke-width="1.4" opacity=".55"/>'
    c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy+1)}" rx="{_fmt(pr[0]*k)}" ry="{_fmt(pr[1])}" fill="url(#na-pupil)"/>'
    # lid shadow across the top third
    c += (f'<path d="M{_fmt(cx-rx-2)} {_fmt(cy-ry*.35)} C{_fmt(cx-8)} {_fmt(cy-ry*.18)} {_fmt(cx+8)} {_fmt(cy-ry*.18)} '
          f'{_fmt(cx+rx+2)} {_fmt(cy-ry*.35)} L{_fmt(cx+rx+2)} {_fmt(cy-ry-4)} L{_fmt(cx-rx-2)} {_fmt(cy-ry-4)} Z" fill="#101a2c" opacity=".3"/>')
    s += g(c, extra=f'clip-path="url(#{cid})"')
    s += f'<ellipse {e} fill="none" stroke="#1b2a3c" stroke-width="1.6"/>'
    return s


def highlights(cx, cy, k=1.0, big=1.0, wet=False):
    hx, hy = cx - 8 * k, cy - 11
    s = (f'<ellipse cx="{_fmt(hx)}" cy="{_fmt(hy)}" rx="{_fmt(7*big*k)}" ry="{_fmt(8.5*big)}" fill="#fff" '
         f'transform="rotate(-18 {_fmt(hx)} {_fmt(hy)})"/>')
    s += f'<circle cx="{_fmt(cx+9*k)}" cy="{_fmt(cy+10)}" r="3.2" fill="#fff"/>'
    s += f'<circle cx="{_fmt(cx-8*k)}" cy="{_fmt(cy+11)}" r="1.6" fill="#fff" opacity=".9"/>'
    s += P(f"M{_fmt(cx+12*k)} {_fmt(cy-14)} C{_fmt(cx+16*k)} {_fmt(cy-8)} {_fmt(cx+17*k)} {_fmt(cy-2)} {_fmt(cx+16*k)} {_fmt(cy+4)}",
           stroke="#fff", sw=1.5, op=.75)
    if wet:
        s += f'<circle cx="{_fmt(cx+4*k)}" cy="{_fmt(cy-15)}" r="2.4" fill="#fff"/>'
        s += f'<circle cx="{_fmt(cx-12*k)}" cy="{_fmt(cy+3)}" r="1.8" fill="#fff" opacity=".9"/>'
        s += P(f"M{_fmt(cx-14*k)} {_fmt(cy+16)} C{_fmt(cx-6*k)} {_fmt(cy+21)} {_fmt(cx+6*k)} {_fmt(cy+21)} {_fmt(cx+14*k)} {_fmt(cy+15)}",
               stroke="#ffffff", sw=1.8, op=.85)
    return s


GAZE = 2


def open_eye(scl, lash, flick=None, lower=None, crease=None, iris_dy=2, iris_r=(21, 25), big=1.0, wet=False,
             small=False, pool=None, lower_col="#4a5880"):
    reg(scl)
    reg(lash)
    if flick:
        reg(flick)
    if lower:
        reg(lower, "stroke")
    _reg_crease(crease)
    s = ""
    for side, T, cx0, k in (("N", tN, EXN, 1.0), ("F", tF, EXF, KF)):
        cx, cy = cx0 + GAZE, E + iris_dy
        ki = 1.0 if side == "N" else .9
        clip = f"na-sc{side}"
        s += f'<clipPath id="{clip}"><path d="{T(scl)}"/></clipPath>'
        s += P(T(scl), fill="url(#na-sclera)")
        inner = iris(cx, cy, iris_r[0] * ki, iris_r[1], side, ki, small) + highlights(cx, cy, ki, big, wet)
        if pool:
            inner += P(T(pool[0]), fill="#c8ecff", op=.55) + P(T(pool[1]), stroke="#ffffff", sw=1.6, op=.95)
        s += g(inner, extra=f'clip-path="url(#{clip})"')
        s += P(T(lash), fill=LASH)
        if flick:
            s += P(T(flick), fill=LASH)
        if lower:
            s += P(T(lower), stroke=lower_col, sw=1.7, op=.85)
        if crease:
            s += P(T(crease), stroke=CREASE, sw=1.4, op=.5)
    return s


def _reg_crease(c):
    if c:
        reg(c, "stroke")


def brows(d):
    s = ""
    for T in (tN, tF):
        s += P(T(d), fill="none", stroke="#f6d3dc", sw=3.2, op=.55)
        s += P(T(d), fill=BROW)
    return s


def blush_strong(y=E + 40):
    s = f'<ellipse cx="328" cy="{y}" rx="31" ry="12" fill="url(#na-blush2)"/>'
    s += f'<ellipse cx="447" cy="{y}" rx="24" ry="11" fill="url(#na-blush2)"/>'
    for x0 in (314, 324, 334, 436, 445, 454):
        s += P(f"M{x0} {y+8} L{x0+6} {y-1}", stroke="#ff5a7a", sw=1.6, op=.55)
        s += P(f"M{x0+2} {y+8} L{x0+7} {y+1}", stroke="#ffffff", sw=.9, op=.6)
    return s


def mouth_open(d, tongue=None, teeth_top=None, cid="na-m"):
    s = P(d, fill="#8a2f3a", stroke="#6b2430", sw=1.8)
    inner = ""
    if tongue:
        inner += P(tongue, fill="#f08a96")
    if teeth_top:
        inner += P(teeth_top, fill="#ffffff")
    if inner:
        s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>' + g(inner, extra=f'clip-path="url(#{cid})"')
    return s


# ---- local eye shapes (near eye; +x toward the nose)
SCL_N = "M-31 4 C-27 -9 -14 -20 2 -21 C15 -21 24 -16 28 -9 C31 3 26 18 6 23 C-12 26 -26 18 -31 4 Z"
LASH_N = ("M-38 4 C-34 -12 -18 -26 2 -27 C17 -27 27 -21 32 -12 C33 -9 31 -8 29 -9 "
          "C24 -16 15 -20 2 -20 C-13 -19 -25 -9 -30 2 C-33 6 -36 6 -38 4 Z")
FLICK_N = ("M-35 -1 C-38 -4 -41 -5 -44 -4 C-41 -2 -38 1 -36 4 Z "
           "M-29 -10 C-32 -14 -35 -16 -39 -17 C-36 -14 -33 -11 -31 -7 Z")
LOWER_N = "M-23 18 C-16 23 -7 25 5 25"
CREASE_N = "M-22 -29 Q-6 -36 12 -33"


def mouth_line(d, sw=2.0):
    return P(d, stroke=MOUTH_LINE, sw=sw)


def tension_lines():
    s = ""
    for d in ("M246 214 L232 206", "M242 234 L227 233", "M252 196 L242 184",
              "M508 206 L519 195", "M512 226 L527 224"):
        s += P(d, stroke="#3a4a78", sw=2.4)
    return s


def ex_neutral():
    face = open_eye(SCL_N, LASH_N, FLICK_N, LOWER_N, CREASE_N)
    face += mouth_line(f"M{MID-9} 324.6 C{MID-4} 325.3 {MID+3} 325.3 {MID+8} 324.4")
    face += P(f"M{MID-10.5} 324.2 C{MID-10} 324.7 {MID-9.5} 324.8 {MID-9} 324.6", stroke=MOUTH_LINE, sw=1.6, op=.7)
    brow = brows(BROW_N)
    return face, brow, ""


def ex_smile():
    scl = "M-31 3 C-27 -11 -14 -22 2 -23 C15 -23 24 -18 28 -10 C31 1 26 13 6 17 C-12 20 -26 14 -31 3 Z"
    lash = ("M-38 3 C-34 -13 -18 -28 2 -29 C17 -29 27 -23 32 -13 C33 -10 31 -9 29 -10 "
            "C24 -17 15 -22 2 -22 C-13 -21 -25 -11 -30 1 C-33 5 -36 5 -38 3 Z")
    face = open_eye(scl, lash, FLICK_N, "M-24 13 C-16 18 -6 19 6 18", "M-22 -30 Q-6 -37 12 -34", iris_dy=1)
    face += f'<ellipse cx="331" cy="{E+38}" rx="24" ry="9" fill="url(#na-blushSoft)"/>'
    face += f'<ellipse cx="446" cy="{E+38}" rx="19" ry="8" fill="url(#na-blushSoft)"/>'
    face += mouth_line(f"M{MID-10} 322 C{MID-5} 327 {MID+4} 327.5 {MID+10} 321")
    face += P(f"M{MID-12.5} 321 C{MID-11.5} 322 {MID-10.8} 322.4 {MID-10} 322.5", stroke=MOUTH_LINE, sw=1.6, op=.75)
    face += P(f"M{MID+10} 321.5 C{MID+11} 320.8 {MID+11.6} 320 {MID+12} 319", stroke=MOUTH_LINE, sw=1.5, op=.7)
    brow = brows("M-31 -48 C-20 -55 -2 -58 19 -56 C23 -55.5 24 -51.5 20 -51 C2 -52.5 -16 -52 -30 -46.5 C-32 -46 -32.5 -47.5 -31 -48 Z")
    return face, brow, ""


def ex_sad():
    scl = "M-31 6 C-27 -3 -16 -11 0 -13 C14 -15 23 -13 28 -7 C31 4 26 18 6 23 C-12 26 -26 18 -31 6 Z"
    lash = ("M-38 6 C-34 -6 -18 -17 0 -19 C15 -21 26 -18 32 -10 C33 -7 31 -6 29 -7 "
            "C24 -12 14 -14 0 -12 C-14 -10 -25 -2 -30 4 C-33 8 -36 8 -38 6 Z")
    flick = "M-35 3 C-38 2 -42 3 -45 6 C-41 6 -38 7 -36 9 Z"
    face = open_eye(scl, lash, flick, LOWER_N, "M-20 -23 Q-4 -29 14 -27", iris_dy=6)
    face += mouth_line(f"M{MID-9} 325 C{MID-4} 323.4 {MID+3} 323.4 {MID+9} 325", sw=2.1)
    face += P(f"M{MID-4} 330.5 C{MID-1} 331.6 {MID+2} 331.6 {MID+5} 330.5", stroke=CREASE, sw=1.3, op=.6)
    brow = brows("M-32 -47 C-20 -49 -4 -52 14 -59 C18 -61 21 -58 18 -56 C2 -49 -14 -45.5 -30 -44.5 C-33 -44.5 -34 -46 -32 -47 Z")
    return face, brow, ""


def ex_surprised():
    scl = "M-31 2 C-28 -13 -14 -25 2 -26 C17 -26 26 -19 29 -10 C32 5 26 22 6 26 C-12 29 -27 19 -31 2 Z"
    lash = ("M-38 1 C-34 -16 -18 -31 2 -32 C18 -32 28 -25 33 -14 C34 -11 32 -10 30 -11 "
            "C25 -21 16 -25 2 -25 C-13 -24 -25 -12 -30 -1 C-33 3 -36 3 -38 1 Z")
    flick = ("M-35 -4 C-38 -7 -41 -9 -44 -8 C-41 -6 -38 -2 -36 1 Z "
             "M-29 -14 C-31 -18 -34 -21 -38 -22 C-35 -19 -33 -16 -31 -11 Z")
    face = open_eye(scl, lash, flick, "M-24 21 C-16 26 -7 28 5 28", None, iris_dy=1, iris_r=(17, 21), big=.85, small=True)
    face += f'<ellipse cx="{MID}" cy="330" rx="6" ry="7.5" fill="#8a2f3a" stroke="#6b2430" stroke-width="1.8"/>'
    face += f'<ellipse cx="{MID+.5}" cy="334" rx="3.6" ry="2.4" fill="#f08a96"/>'
    brow = brows("M-31 -56 C-20 -63 -2 -65 19 -62 C23 -61.5 24 -57.5 20 -57 C2 -59.5 -16 -59 -30 -54.5 C-32 -54 -32.5 -55.5 -31 -56 Z")
    return face, brow, tension_lines()


POOL = ("M-29 8 C-22 18 -8 22 4 21 C16 20 24 14 27 4 L27 -2 C22 10 14 15 4 15 C-8 16 -21 11 -29 2 Z",
        "M-28 5 C-20 14 -8 17 4 16 C14 15 22 11 26 2")


def tear_drop(x, y, sc):
    t = "M0 -6 C2 -2 4 1 4 3 C4 6 -4 6 -4 3 C-4 1 -2 -2 0 -6 Z"
    return g(P(t, fill="url(#na-tear)", stroke="#7fcff6", sw=1) + '<circle cx="-1.4" cy="2" r=".9" fill="#fff"/>',
             f"translate({_fmt(x)} {_fmt(y)}) scale({sc})")


def ex_tears():
    scl = "M-31 5 C-27 -6 -15 -15 1 -17 C15 -18 24 -15 28 -9 C31 3 26 15 6 19 C-12 22 -26 16 -31 5 Z"
    lash = ("M-38 5 C-34 -9 -18 -21 1 -23 C16 -24 26 -20 32 -12 C33 -9 31 -8 29 -9 "
            "C24 -14 15 -16 1 -16 C-14 -14 -25 -5 -30 3 C-33 7 -36 7 -38 5 Z")
    flick = "M-35 2 C-38 1 -42 2 -45 5 C-41 5 -38 6 -36 8 Z"
    pool = ("M-29 6 C-22 14 -8 18 4 17 C16 16 24 11 27 2 L27 -4 C22 7 14 11 4 11 C-8 12 -21 8 -29 0 Z",
            "M-28 3 C-20 11 -8 14 4 13 C14 12 22 8 26 0")
    face = blush_strong()
    # flush across the nose
    face += f'<ellipse cx="{MID-4}" cy="{E+43}" rx="30" ry="7" fill="url(#na-blush2)" opacity=".7"/>'
    face += open_eye(scl, lash, flick, "M-26 15 C-18 20 -6 21 8 19", "M-20 -24 Q-4 -30 14 -28", iris_dy=3, big=1.08,
                     wet=True, pool=pool, lower_col="#c45a72")
    # streams spill from the outer third of each lower lid and widen down the cheek
    st_n = ("M322 280 C320 292 321 304 318 315 C315 325 320 333 326 331 C332 329 331 321 329 313 "
            "C326 302 324 291 324 280 C323.5 279 322.5 279 322 280 Z")
    st_f = ("M444 281 C443 292 444 304 442 313 C439 322 443 329 448 328 C453 327 452 320 450 313 "
            "C448 303 446 292 446 281 C445.5 280 444.5 280 444 281 Z")
    for d in (st_n, st_f):
        face += P(d, fill="url(#na-tear)", stroke="#7fcff6", sw=1.1, op=.95)
    face += P("M321 298 C320 306 319 314 319 322", stroke="#ffffff", sw=1.5)
    face += P("M444 298 C443 305 443 312 443 318", stroke="#ffffff", sw=1.4)
    face += P("M327 312 C328 318 328 324 326 328", stroke="url(#na-rainbowV)", sw=1.1, op=.9)
    for (x, y, sc) in ((324, 343, 1.0), (447, 339, .85), (318, 356, .6)):
        face += tear_drop(x, y, sc)
    # open, trembling mouth
    m = (f"M{MID-12} 331 C{MID-10} 326 {MID-6} 325 {MID-3} 322.5 C{MID} 324.5 {MID+3} 322 {MID+6} 324 "
         f"C{MID+8} 325 {MID+10} 327 {MID+11} 330.5 C{MID+7} 333.5 {MID+3} 335 {MID-1} 335 C{MID-5} 335 {MID-9} 333.5 {MID-12} 331 Z")
    face += mouth_open(m, tongue=f"M{MID-8} 334 C{MID-4} 330.5 {MID+3} 330.5 {MID+8} 334 L{MID+8} 340 L{MID-8} 340 Z",
                       cid="na-mT")
    face += P(f"M{MID-14.5} 332 C{MID-13.5} 333.5 {MID-12.5} 334.5 {MID-11} 335", stroke=MOUTH_LINE, sw=1.4, op=.7)
    face += P(f"M{MID+12.5} 331.5 C{MID+13} 333 {MID+13.5} 334 {MID+14} 335", stroke=MOUTH_LINE, sw=1.4, op=.7)
    face += P(f"M{MID-5} 339.5 C{MID-2} 340.8 {MID+2} 340.8 {MID+5} 339.5", stroke=CREASE, sw=1.2, op=.6)
    brow = brows("M-32 -46 C-20 -49 -2 -54 14 -62 C18 -64 21 -61 18 -59 C2 -51 -14 -46 -30 -43.5 C-33 -43.5 -34 -45 -32 -46 Z")
    return face, brow, ""


def ex_resolute():
    scl = "M-31 3 C-26 -8 -14 -17 2 -18 C15 -19 24 -16 28 -10 C31 2 26 16 6 20 C-12 23 -26 16 -31 3 Z"
    lash = ("M-38 3 C-33 -11 -18 -23 2 -24 C17 -25 27 -21 32 -13 C33 -10 31 -9 29 -10 "
            "C24 -15 15 -17 2 -17 C-13 -16 -25 -7 -30 1 C-33 5 -36 5 -38 3 Z")
    pool = ("M-29 9 C-22 17 -8 20 4 19 C16 18 24 13 27 5 L27 1 C22 10 14 14 4 14 C-8 15 -21 11 -29 5 Z",
            "M-28 7 C-20 14 -8 16.5 4 16 C14 15.5 22 11.5 26 4")
    face = open_eye(scl, lash, FLICK_N, "M-24 16 C-16 21 -7 22 5 22", "M-22 -26 Q-6 -32 12 -30", iris_dy=2,
                    big=1.05, wet=True, pool=pool)
    face += mouth_line(f"M{MID-11} 324.5 C{MID-4} 323 {MID+4} 323 {MID+10} 324.5", sw=2.2)
    face += P(f"M{MID-11} 324.5 C{MID-12} 325.3 {MID-12.8} 326.2 {MID-13.2} 327.2", stroke=MOUTH_LINE, sw=1.6, op=.8)
    face += P(f"M{MID+10} 324.5 C{MID+11} 325.3 {MID+11.6} 326.2 {MID+12} 327", stroke=MOUTH_LINE, sw=1.5, op=.7)
    face += P(f"M{MID-4} 330.5 C{MID-1} 331.6 {MID+2} 331.6 {MID+5} 330.5", stroke=CREASE, sw=1.3, op=.55)
    brow = brows("M-32 -56 C-18 -57 0 -55 18 -49.5 C22 -48.5 22.5 -44.6 18.5 -45.2 C1 -49.6 -16 -51.4 -30 -51.6 C-33 -51.6 -34 -54.5 -32 -56 Z")
    return face, brow, ""


BROW_N = "M-31 -47 C-20 -53 -2 -56 19 -54 C23 -53.5 24 -49.5 20 -49 C2 -50.5 -16 -50 -30 -45.5 C-32 -45 -32.5 -46.5 -31 -47 Z"

EXPRESSIONS = {"neutral": ex_neutral, "smile": ex_smile, "sad": ex_sad, "surprised": ex_surprised,
               "tears": ex_tears, "resolute": ex_resolute}

# ------------------------------------------------------------------ blink overlay
CLOSED = ("M-36 8 C-26 17 -12 21 2 21 C15 21 24 17 30 10 C30 13 27 17 23 20 "
          "C15 25 8 26 2 26 C-14 26 -27 20 -36 12 Z")
CLOSED_LASH = ("M-34 10 C-38 11 -42 14 -45 18 C-40 16 -36 15 -33 15 Z "
               "M-29 16 C-32 20 -34 24 -36 28 C-32 25 -29 22 -26 19 Z")
CLOSED_LOWER = "M-14 30 C-6 33 6 33 14 30"


def sample_path(d, step=12):
    toks = NUM.findall(d)
    pts, i, cur, start, cmd = [], 0, (0.0, 0.0), (0.0, 0.0), None

    def num():
        nonlocal i
        v = float(toks[i]); i += 1
        return v
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]; i += 1
            if cmd in "Zz":
                cur = start
                continue
        if cmd == "M":
            cur = start = (num(), num()); pts.append(cur); cmd = "L"
        elif cmd == "L":
            cur = (num(), num()); pts.append(cur)
        elif cmd == "Q":
            c1 = (num(), num()); p = (num(), num())
            for k in range(1, step + 1):
                t = k / step
                pts.append(((1-t)**2*cur[0] + 2*(1-t)*t*c1[0] + t*t*p[0], (1-t)**2*cur[1] + 2*(1-t)*t*c1[1] + t*t*p[1]))
            cur = p
        elif cmd == "C":
            c1 = (num(), num()); c2 = (num(), num()); p = (num(), num())
            for k in range(1, step + 1):
                t = k / step; u = 1 - t
                pts.append((u**3*cur[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t**3*p[0],
                            u**3*cur[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t**3*p[1]))
            cur = p
        else:
            raise ValueError(cmd)
    return pts


def hull(points):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in points))

    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def offset_hull(h, r):
    out = []
    n = len(h)
    area = sum(h[i][0]*h[(i+1) % n][1] - h[(i+1) % n][0]*h[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1
    for i in range(n):
        p0, p1, p2 = h[i-1], h[i], h[(i+1) % n]

        def normal(a, b):
            dx, dy = b[0]-a[0], b[1]-a[1]
            L = math.hypot(dx, dy) or 1
            return (sgn*dy/L, -sgn*dx/L)
        n1, n2 = normal(p0, p1), normal(p1, p2)
        a1, a2 = math.atan2(n1[1], n1[0]), math.atan2(n2[1], n2[0])
        da = (a2 - a1 + math.pi) % (2*math.pi) - math.pi
        steps = max(1, int(abs(da) / .25))
        for k in range(steps + 1):
            a = a1 + da * k / steps
            out.append((p1[0] + r*math.cos(a), p1[1] + r*math.sin(a)))
    return out


def poly_d(pts):
    return "M" + " L".join(f"{_fmt(x)} {_fmt(y)}" for x, y in pts) + " Z"


BLINK_GROW = 5


def blink_patch_pts(side, grow=None):
    grow = BLINK_GROW if grow is None else grow
    pt = ptN if side == "N" else ptF
    pts = []
    for d, kind in EYE_SHAPES + [(CLOSED, "fill"), (CLOSED_LASH, "fill"), (CLOSED_LOWER, "stroke")]:
        sp = sample_path(d)
        if kind == "stroke":
            sp = [(x + dx, y + dy) for x, y in sp for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))]
        pts += [pt(x, y) for x, y in sp]
    return offset_hull(hull(pts), grow)


def blink_clip():
    a = "".join(f'<path d="{poly_d(blink_patch_pts(s))}"/>' for s in ("N", "F"))
    b = "".join(f'<path d="{poly_d(blink_patch_pts(s, BLINK_GROW + 2))}"/>' for s in ("N", "F"))
    return (f'<clipPath id="na-blinkClip">{a}</clipPath>'
            f'<clipPath id="na-blinkHairClip">{b}</clipPath>')


def blink_layer():
    s = blink_clip()
    lids = face_base()
    lids += pair(CLOSED, fill=LASH) + pair(CLOSED_LASH, fill=LASH)
    lids += pair(CLOSED_LOWER, stroke=CREASE, sw=1.3, op=.6)
    hair = head_front()
    s += g(g(lids, extra='clip-path="url(#na-blinkClip)"') + g(hair, extra='clip-path="url(#na-blinkHairClip)"'), HEAD_TF)
    return s


# ------------------------------------------------------------------ assemble
def header():
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
            f"<defs>{DEFS}</defs>\n")


def sprite(name):
    face, brow, extras = EXPRESSIONS[name]()
    s = header()
    s += body_layers()
    s += f'<g transform="{HEAD_TF}">'
    s += face_base()
    s += f"<!-- face: {name} -->" + face + "<!-- /face -->"
    s += head_front()
    s += brow + extras
    s += "</g>\n</svg>\n"
    return s


def blink():
    return header() + blink_layer() + "\n</svg>\n"


def check_clearance():
    def inside(p, poly):
        x, y = p; c = False
        for i in range(len(poly)):
            (x1, y1), (x2, y2) = poly[i-1], poly[i]
            if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1:
                c = not c
        return c

    def dist(p, poly):
        best = 1e9
        for i in range(len(poly)):
            (x1, y1), (x2, y2) = poly[i-1], poly[i]
            dx, dy = x2-x1, y2-y1
            t = max(0, min(1, ((p[0]-x1)*dx + (p[1]-y1)*dy) / (dx*dx + dy*dy or 1)))
            best = min(best, math.hypot(p[0]-x1-t*dx, p[1]-y1-t*dy))
        return -best if inside(p, poly) else best
    for side in ("N", "F"):
        patch = blink_patch_pts(side, BLINK_GROW + 2)
        for name, fn in EXPRESSIONS.items():
            face, brow, extras = fn()
            ds = re.findall(r'<path d="([^"]+)"', brow)
            dd = ds[0] if side == "N" else ds[2]
            worst = min(dist(p, patch) for p in sample_path(dd))
            print(f"{side} {name:10s} brow clearance {worst - 1.6:6.1f}px")
        xs = [x for x, y in patch]; ys = [y for x, y in patch]
        print(side, "patch bbox", round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("names", nargs="*", help="expressions to write (default: all of them plus blink)")
    ap.add_argument("--out", default=OUT_ROOT, metavar="DIR",
                    help="output root; files go to DIR/chars/nagi/ (default: %(default)s)")
    ap.add_argument("--check", action="store_true", help="also print brow clearance against the blink patch")
    opt = ap.parse_args()
    outdir = os.path.join(opt.out, "chars", "nagi")
    args = opt.names
    check = opt.check
    targets = args or list(EXPRESSIONS) + ["blink"]
    out = {n: sprite(n) for n in EXPRESSIONS}
    out["blink"] = blink()
    for n in targets:
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, f"{n}.svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(out[n])
        print(n, len(out[n]))
    if check:
        check_clearance()
