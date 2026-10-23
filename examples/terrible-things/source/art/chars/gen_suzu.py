#!/usr/bin/env python3
"""Suzu (the Keeper) sprite generator, v2.

Shared body/hair layers are emitted byte-identically into every expression file;
only the face group differs. blink.svg redraws the skin + front hair under a mask
made from the union of every expression's eye shapes, then draws closed lids.

usage: gen_suzu.py [--out DIR] [name ...]
  writes DIR/chars/suzu/<name>.svg (default DIR: $TMPDIR/terrible-things-art);
  install by copying those files over the game's chars/suzu/.
"""
import argparse, math, os, re, sys, tempfile

OUT_ROOT = os.path.join(tempfile.gettempdir(), "terrible-things-art")

W, H = 760, 1040
HEAD_TF = "rotate(-2 380 420)"
E = 330          # eye line (head-local)
EXL, EXR = 334, 426

# ------------------------------------------------------------------ helpers
NUM = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?")


def _fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def mir(d, cx=380):
    """Mirror an absolute path (M L C Q S T Z only) about x = cx."""
    out, idx = [], 0
    for tok in NUM.findall(d):
        if tok.isalpha():
            idx = 0
            out.append(tok)
            continue
        v = float(tok)
        if idx % 2 == 0:
            v = 2 * cx - v
        idx += 1
        out.append(_fmt(v))
    return " ".join(out)


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


def both(d, **kw):
    return P(d, **kw) + P(mir(d), **kw)


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
HAIR_LINE = "#240a22"
HAIR_DARK = "#34102f"
HAIR_SHADE = "#46173f"
HAIR_SHEEN = "#9a4f8c"
HAIR_STRAND = "#b874a8"
LASH = "#2a0c28"
BROW = "#3a1236"
SKIN = "#fde8dc"
SKIN_SH = "#f6cfc2"
SKIN_DEEP = "#eab3a6"
SKIN_LINE = "#b9705f"
CREASE = "#c98a7a"
CLOTH_LINE = "#6d6a9e"
CLOTH_SH = "#dfdef2"
BLUE = "#5b7cf0"
BLUE_D = "#3747b4"
OBI_LINE = "#5e4a9a"
GLASS_LINE = "#7f8fd6"
MOUTH_LINE = "#9a4842"

# ------------------------------------------------------------------ defs
DEFS = """
<linearGradient id="su-hair" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="600">
  <stop offset="0" stop-color="#7a336f"/><stop offset=".3" stop-color="#5e2554"/><stop offset="1" stop-color="#46193f"/>
</linearGradient>
<linearGradient id="su-hairLock" gradientUnits="userSpaceOnUse" x1="0" y1="250" x2="0" y2="600">
  <stop offset="0" stop-color="#5e2554"/><stop offset=".55" stop-color="#682a5e"/><stop offset="1" stop-color="#7f3a73"/>
</linearGradient>
<linearGradient id="su-hairBack" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#3c1336"/><stop offset="1" stop-color="#2a0c27"/>
</linearGradient>
<linearGradient id="su-sclera" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#d6d2f0"/><stop offset=".45" stop-color="#ffffff"/>
</linearGradient>
<radialGradient id="su-marble" cx=".4" cy=".34" r=".72">
  <stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#f6f0ff"/>
  <stop offset=".7" stop-color="#d4c4f7"/><stop offset="1" stop-color="#9a80dc"/>
</radialGradient>
<radialGradient id="su-marbleGlow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ffe6fb" stop-opacity=".95"/><stop offset=".6" stop-color="#f3c8ff" stop-opacity=".5"/><stop offset="1" stop-color="#f3c8ff" stop-opacity="0"/>
</radialGradient>
<linearGradient id="su-smoke" x1="0" y1="1" x2="0" y2="0">
  <stop offset="0" stop-color="#5a1fb0"/><stop offset=".55" stop-color="#8e4fe0"/><stop offset="1" stop-color="#c79bf5"/>
</linearGradient>
<linearGradient id="su-rainbow" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="su-rainbowV" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="su-tear" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#e6f8ff" stop-opacity=".8"/><stop offset="1" stop-color="#bfe9ff" stop-opacity=".85"/>
</linearGradient>
<radialGradient id="su-blush" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff8fa3" stop-opacity=".55"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<radialGradient id="su-blush2" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff6f8c" stop-opacity=".8"/><stop offset=".6" stop-color="#ff7f96" stop-opacity=".4"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<linearGradient id="su-kimono" gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2="1040">
  <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f8f7fd"/><stop offset=".8" stop-color="#eef0fd"/><stop offset="1" stop-color="#dfe5ff"/>
</linearGradient>
<linearGradient id="su-sleeve" gradientUnits="userSpaceOnUse" x1="0" y1="470" x2="0" y2="1040">
  <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f8f8fe"/><stop offset=".78" stop-color="#e9edff"/><stop offset="1" stop-color="#c9d4ff"/>
</linearGradient>
<linearGradient id="su-lining" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#5b4296"/><stop offset=".6" stop-color="#8a6fd0"/><stop offset="1" stop-color="#c3b0f2"/>
</linearGradient>
<linearGradient id="su-obi" gradientUnits="userSpaceOnUse" x1="0" y1="586" x2="0" y2="702">
  <stop offset="0" stop-color="#e0d2fb"/><stop offset=".45" stop-color="#c8b2f2"/><stop offset="1" stop-color="#a990e2"/>
</linearGradient>
<linearGradient id="su-bow" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ddcdfb"/><stop offset=".55" stop-color="#c3abf0"/><stop offset="1" stop-color="#a088de"/>
</linearGradient>
<linearGradient id="su-obiage" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffdcec"/><stop offset="1" stop-color="#eeb0cf"/>
</linearGradient>
<linearGradient id="su-bell" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#a7baff"/><stop offset=".45" stop-color="#5b7cf0"/><stop offset="1" stop-color="#3442b0"/>
</linearGradient>
<radialGradient id="su-star" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#3a3fb0"/><stop offset=".35" stop-color="#5b7cf0"/><stop offset="1" stop-color="#a3b6ff"/>
</radialGradient>
<linearGradient id="su-tegara" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#7d98ff"/><stop offset="1" stop-color="#3f53c4"/>
</linearGradient>
<linearGradient id="su-handGlass" gradientUnits="userSpaceOnUse" x1="0" y1="-20" x2="0" y2="96">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".8"/><stop offset=".25" stop-color="#f6f2ff" stop-opacity=".42"/>
  <stop offset=".55" stop-color="#eef0ff" stop-opacity=".2"/><stop offset="1" stop-color="#e6edff" stop-opacity=".26"/>
</linearGradient>
<linearGradient id="su-wristSkin" gradientUnits="userSpaceOnUse" x1="0" y1="-16" x2="0" y2="8">
  <stop offset="0" stop-color="#fde8dc"/><stop offset=".5" stop-color="#fbe4e6" stop-opacity=".7"/><stop offset="1" stop-color="#f6eaff" stop-opacity="0"/>
</linearGradient>
<linearGradient id="su-handFrost" gradientUnits="userSpaceOnUse" x1="0" y1="-10" x2="0" y2="24">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".5"/><stop offset=".45" stop-color="#f8f2ff" stop-opacity=".4"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
<linearGradient id="su-collarFade" gradientUnits="userSpaceOnUse" x1="0" y1="438" x2="0" y2="452">
  <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/>
</linearGradient>
<mask id="su-collarMask" maskUnits="userSpaceOnUse" x="0" y="0" width="760" height="1040"><rect x="0" y="380" width="760" height="240" fill="url(#su-collarFade)"/></mask>
<filter id="su-b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="su-b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="su-b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="su-b6" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
"""

BEAD_COLS = {
    "#ff4d6d": "#b8183c", "#3f6dff": "#1d36a8", "#2fc59a": "#137a5c", "#ffc23e": "#b87808",
    "#a66bff": "#5f2fc0", "#ff7fc4": "#c03a86", "#46d9ff": "#1188b0", "#b8b0c8": "#6d6680",
    "#ff9a3c": "#b85a10", "#7df0d0": "#2a9a80", "#e0559a": "#922860", "#8ecbff": "#3a78c0",
}


def bead_defs():
    s = ""
    for col in BEAD_COLS:
        s += (f'<radialGradient id="su-bd{col[1:]}" cx=".36" cy=".32" r=".75">'
              f'<stop offset="0" stop-color="#ffffff"/><stop offset=".32" stop-color="{col}" stop-opacity=".8"/>'
              f'<stop offset="1" stop-color="{col}"/></radialGradient>')
    return s


def bead(x, y, r, col, glow=True, hi=True):
    rim = BEAD_COLS[col]
    s = ""
    if glow:
        s += f'<circle cx="{_fmt(x)}" cy="{_fmt(y)}" r="{_fmt(r*1.9)}" fill="{col}" opacity=".45" filter="url(#su-b3)"/>'
    s += f'<circle cx="{_fmt(x)}" cy="{_fmt(y)}" r="{_fmt(r)}" fill="url(#su-bd{col[1:]})" stroke="{rim}" stroke-width="1.4"/>'
    if hi:
        hx, hy = x - r * .36, y - r * .38
        s += (f'<ellipse cx="{_fmt(hx)}" cy="{_fmt(hy)}" rx="{_fmt(r*.34)}" ry="{_fmt(r*.24)}" fill="#fff" '
              f'transform="rotate(-30 {_fmt(hx)} {_fmt(hy)})"/>')
        s += f'<circle cx="{_fmt(x + r*.42)}" cy="{_fmt(y + r*.4)}" r="{_fmt(max(r*.13, .9))}" fill="#fff" opacity=".85"/>'
    return s


# ------------------------------------------------------------------ kimono motifs
def bell(x, y, s, rot=0, op=1.0):
    """Hanging campanula bell hanging from (x, y); height ~28*s."""
    body = ("M-9 2 C-10 10 -11 18 -15 26 L-10 24 L-5 28 L0 25 L5 28 L10 24 L15 26 "
            "C11 18 10 10 9 2 C5 -2 -5 -2 -9 2 Z")
    c = P(body, fill="url(#su-bell)", stroke=BLUE_D, sw=1.3)
    c += P("M-5 4 C-6 11 -7 17 -10 23", stroke="#ffffff", sw=1.4, op=.75)
    c += P("M-5 25 C-2 22 2 22 5 25", stroke="#2a3290", sw=1.1, op=.6)
    c += P("M-4 0 C-2 -4 2 -4 4 0 L2 3 L0 1 L-2 3 Z", fill="#6f9ad8", stroke="#3d5aa0", sw=.9)
    return g(c, f"translate({_fmt(x)} {_fmt(y)}) rotate({_fmt(rot)}) scale({_fmt(s)})", f'opacity="{op}"' if op != 1 else "")


def star(x, y, s, rot=0, op=1.0):
    """Open kikyo (balloon-flower) star facing the viewer."""
    pet = "M0 0 C-6 -6 -7 -16 0 -22 C7 -16 6 -6 0 0 Z"
    c = ""
    for k in range(5):
        c += f'<path d="{pet}" transform="rotate({k*72})" fill="url(#su-star)" stroke="{BLUE_D}" stroke-width="1.2" stroke-linejoin="round"/>'
        c += f'<path d="M0 -4 L0 -16" transform="rotate({k*72})" stroke="#e9eeff" stroke-width="1" opacity=".8"/>'
    c += '<circle r="3.2" fill="#ffffff"/><circle r="1.4" fill="#ffe08a"/>'
    return g(c, f"translate({_fmt(x)} {_fmt(y)}) rotate({_fmt(rot)}) scale({_fmt(s)})", f'opacity="{op}"' if op != 1 else "")


def leaf(x, y, s, rot, op=.85):
    c = P("M0 0 C6 -6 18 -6 26 0 C18 6 6 6 0 0 Z", fill="#b4c4f2", stroke="#7d8fd0", sw=1.1)
    c += P("M2 0 L22 0", stroke="#ffffff", sw=1, op=.8)
    return g(c, f"translate({_fmt(x)} {_fmt(y)}) rotate({_fmt(rot)}) scale({_fmt(s)})", f'opacity="{op}"')


def sprig(stem, bells=(), leaves=(), stars=()):
    s = P(stem, stroke="#8a9ad8", sw=1.6, op=.9)
    for lf in leaves:
        s += leaf(*lf)
    for b in bells:
        s += bell(*b)
    for st in stars:
        s += star(*st)
    return s


# ------------------------------------------------------------------ body geometry
NECK = "M358 384 L357 446 C356 456 350 464 342 470 L418 470 C410 464 404 456 403 446 L402 384 Z"
TORSO = ("M338 456 C314 460 292 470 278 486 C270 496 266 512 264 534 L262 1040 L498 1040 "
         "L496 534 C494 512 490 496 482 486 C468 470 446 460 422 456 Z")
BACK_COLLAR = "M318 452 C344 436 416 436 442 452 L448 478 L312 478 Z"

SLEEVE = ("M338 466 C310 468 284 478 270 496 C256 514 250 546 248 580 "
          "C246 616 240 664 232 716 C222 800 210 920 200 1040 L326 1040 "
          "C322 960 320 870 322 790 C323 744 316 702 303 670 "
          "C320.7 679.4 351.7 621.4 334 612 "
          "C322 610 304 602 296 590 C290 572 292 548 300 528 "
          "C308 506 322 484 338 466 Z")
# cuff opening at the wrist: centre, radii, rotation
CUFF_C = (318, 640)
CUFF_R = (15, 31)
CUFF_ROT = 30
OBI = "M262 588 C320 598 440 598 498 588 L500 700 C440 712 320 712 260 700 Z"

# hand in local coords: wrist centre at (0, -14) sits in the cuff, fingers along +y
HAND = ("M-17 -34 L-16 -10 C-17 4 -19 14 -22 22 C-30 28 -38 38 -42 48 C-45 56 -40 64 -34 61 "
        "C-30 58 -26 51 -20 46 C-19 56 -19 68 -17 79 C-16 89 -7 90 -6 82 C-5 94 5 96 6 86 "
        "C7 93 15 92 16 82 C18 84 25 81 26 72 C27 62 27 52 26 44 C25 30 22 14 18 -10 L18 -34 Z")
HAND_TF = "translate(323 652) rotate(-22)"


BOW_STYLE = "none"


def bow():
    """Big obi bow at the back. From the front only the flared ends of its
    loops show beside the sleeves: an upper loop angled up, a lower one down."""
    if BOW_STYLE == "none":
        return ""
    up = ("M262 572 C246 556 214 528 190 516 C176 509 166 516 168 530 C170 548 180 570 194 584 "
          "C214 590 242 588 262 584 Z")
    low = ("M262 588 C244 594 214 606 198 622 C188 632 192 646 204 646 C222 646 246 622 264 600 Z")
    s = ""
    for d in (low, up):
        for dd in (d, mir(d)):
            s += P(dd, fill="url(#su-bow)", stroke=OBI_LINE, sw=2.6)
    # pleats converging on the hidden knot, the turned fold at each end, sheen
    for d in ("M262 576 C240 560 212 540 186 528", "M262 580 C238 574 210 566 182 556"):
        s += both(d, stroke=OBI_LINE, sw=1.4, op=.5)
    s += both("M170 532 C178 540 186 548 192 560 C186 568 186 576 194 584", stroke=OBI_LINE, sw=1.5, op=.55)
    s += both("M174 520 C180 516 188 516 196 522", stroke="#ffffff", sw=2.4, op=.85)
    s += both("M168 530 C170 548 180 570 194 584 L202 586 C190 568 182 548 182 532 Z", fill="#9a80d8", op=.55)
    s += both("M262 594 C242 604 222 618 208 632", stroke=OBI_LINE, sw=1.4, op=.5)
    s += both("M196 640 C200 632 206 626 214 622", stroke="#ffffff", sw=1.8, op=.7)
    return s


def neck_and_chest():
    s = P(BACK_COLLAR, fill="#ffffff", stroke=CLOTH_LINE, sw=2.4)
    s += P("M326 450 C350 440 410 440 434 450 L438 470 L322 470 Z", fill="url(#su-lining)", op=.75)
    s += P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += P("M340 466 L420 466 C412 494 398 520 380 546 C362 520 348 494 340 466 Z", fill=SKIN)
    # chin shadow on the neck
    s += P("M358 388 C368 414 392 414 402 388 L403 420 C392 432 368 432 357 420 Z", fill=SKIN_SH)
    s += P("M392 414 C398 430 402 444 404 452 L404 404 Z", fill=SKIN_SH, op=.7)
    # glass collar at the base of the throat
    glass = "M352 440 C366 448 394 448 408 440 L424 468 C414 494 398 520 380 546 C362 520 346 494 336 468 Z"
    c = P(glass, fill="#f3eeff", op=.72)
    # we see the lilac collar lining through it
    c += P("M342 470 C356 462 404 462 418 470 L420 480 C404 474 356 474 340 480 Z", fill="#b9a2ee", op=.5)
    c += P(glass, stroke="url(#su-rainbow)", sw=1.6, op=.75)
    c += P("M344 468 C354 475 366 477 374 475", stroke="#ffffff", sw=2.2, op=.95)
    c += P("M386 475 C396 477 408 475 418 468", stroke="#ffffff", sw=2.2, op=.95)
    c += P("M346 473 C356 480 366 481 373 479", stroke="#9b8fe0", sw=1.2, op=.6)
    c += P("M387 479 C397 481 407 479 416 473", stroke="#9b8fe0", sw=1.2, op=.6)
    thr = "M370 448 C366 466 386 482 378 502 C372 516 382 528 380 540"
    c += P(thr, stroke="#ff7eb6", sw=4, op=.5, extra='filter="url(#su-b2)"') + P(thr, stroke="#ffd0e6", sw=1.1, op=.9)
    thr2 = "M396 450 C404 464 392 480 400 494"
    c += P(thr2, stroke="#7fe3ff", sw=3.5, op=.45, extra='filter="url(#su-b2)"') + P(thr2, stroke="#d8f8ff", sw=1, op=.85)
    c += sparkle(362, 488, 6)
    s += g(c, extra='mask="url(#su-collarMask)"')
    s += P("M354 442 C366 450 394 450 406 442", stroke="#ffffff", sw=5, op=.6, extra='filter="url(#su-b2)"')
    s += P("M356 448 C368 455 392 455 404 448", stroke=GLASS_LINE, sw=1.3, op=.7)
    s += P("M358 451 C370 457 390 457 402 451", stroke="url(#su-rainbow)", sw=1.2, op=.8)
    s += sparkle(398, 458, 4.5)
    return s


def torso():
    s = P(TORSO, fill="url(#su-kimono)", stroke=CLOTH_LINE, sw=2.6)
    s += '<clipPath id="su-torsoClip"><path d="' + TORSO + '"/></clipPath><g clip-path="url(#su-torsoClip)">'
    s += P("M504 520 C494 560 488 620 486 700 L488 1040 L510 1040 Z", fill=CLOTH_SH)
    # front overlap (left over right): the top panel's edge runs down left of centre
    s += P("M300 700 L356 704 C352 800 346 920 342 1040 L300 1040 Z", fill=CLOTH_SH, op=.55)
    s += P("M356 704 C352 800 346 920 342 1040", stroke=CLOTH_LINE, sw=2)
    s += P("M408 712 C412 810 416 920 418 1040", stroke=CLOTH_LINE, sw=1.4, op=.4)
    # hem pattern on the top panel
    s += sprig("M436 1040 C424 990 404 960 380 948 C368 942 360 940 352 942",
               [(372, 946, .85, -4), (402, 962, .9, 6), (428, 1000, .9, 4)],
               [(418, 978, .8, -60), (360, 942, .7, 200)], [(392, 1010, .95, 12)])
    s += sprig("M326 1040 C334 1000 340 980 346 960", [(336, 992, .8, 4)], [], [(318, 960, .8, -10)])
    s += "</g>"
    return s


def collar():
    s = ""
    hl = "M330 456 L342 456 C350 486 364 514 380 540 L376 554 C358 526 340 492 330 456 Z"
    s += P(hl, fill="#cdb8f4", stroke=CLOTH_LINE, sw=1.4)
    s += P(mir(hl), fill="#cdb8f4", stroke=CLOTH_LINE, sw=1.4)
    under = "M312 456 L330 456 C340 492 358 524 378 552 L370 568 C348 538 324 498 312 456 Z"
    s += P(under, fill="#ffffff", stroke=CLOTH_LINE, sw=2.2)
    over = ("M448 456 L430 456 C420 490 404 520 382 552 C370 568 358 582 346 594 L368 596 "
            "C380 584 392 570 402 556 C422 528 438 494 448 456 Z")
    s += P(over, fill="#ffffff", stroke=CLOTH_LINE, sw=2.4)
    s += P("M442 460 C432 496 416 528 396 554 C388 566 378 578 368 590", stroke=BLUE, sw=1.8, op=.8)
    s += P("M318 460 C328 496 346 526 366 554", stroke=BLUE, sw=1.8, op=.8)
    s += P("M370 568 C354 584 338 594 318 598 L338 602 C354 598 368 588 378 576 Z", fill=CLOTH_SH)
    return s


def obi():
    s = P("M314 582 C350 572 410 572 446 582 L450 596 C410 588 350 588 310 596 Z",
          fill="url(#su-obiage)", stroke="#b0608c", sw=1.6)
    s += P("M328 584 C360 578 400 578 432 584", stroke="#ffffff", sw=1.4, op=.7)
    s += P(OBI, fill="url(#su-obi)", stroke=OBI_LINE, sw=2.6)
    s += '<clipPath id="su-obiClip"><path d="' + OBI + '"/></clipPath><g clip-path="url(#su-obiClip)">'
    for k, y in enumerate((606, 620, 668, 682)):
        s += P(f"M250 {y} C320 {y+9} 440 {y+9} 510 {y}", stroke="#ffffff" if k % 2 == 0 else "#9a80d8", sw=1.3, op=.5)
    s += P("M270 612 C330 622 430 622 490 612", stroke="#f3ecff", sw=7, op=.55, extra='filter="url(#su-b2)"')
    for (x, y) in ((312, 656), (448, 656)):
        s += star(x, y, .42, 0, .55)
    s += "</g>"
    # obijime cord with a glass-bead obidome
    cord = "M260 644 C320 652 440 652 500 644"
    s += P(cord, stroke="#5e1f52", sw=6.5) + P(cord, stroke="#a24a8e", sw=4)
    s += P("M262 643 C320 650 440 650 498 643", stroke="#e6a6d8", sw=1.1, op=.8)
    s += '<circle cx="380" cy="650" r="17" fill="#c9a8ff" opacity=".5" filter="url(#su-b3)"/>'
    s += f'<circle cx="380" cy="650" r="11" fill="#f5f0ff" fill-opacity=".55" stroke="{GLASS_LINE}" stroke-width="1.6"/>'
    s += P("M372 654 C376 646 384 654 388 646", stroke="#ff7eb6", sw=2, op=.8)
    s += P("M374 642 C380 648 378 654 384 658", stroke="#46d9ff", sw=1.4, op=.8)
    s += '<ellipse cx="376" cy="645" rx="3.4" ry="2.4" fill="#fff" transform="rotate(-30 376 645)"/>'
    s += P("M371 652 C372 657 377 660 382 660", stroke="url(#su-rainbow)", sw=1.4)
    return s


def sleeve_pattern_L():
    pat = sprig("M248 520 C240 560 236 600 238 640 C240 680 252 720 270 760",
                [(240, 566, .95, 4), (236, 616, 1.0, -4), (248, 700, .95, -12), (268, 758, .9, -16)],
                [(244, 540, .8, -110), (238, 660, .85, 70)], [(268, 600, .9, 15)])
    pat += sprig("M196 1040 C222 960 260 920 304 900",
                 [(222, 962, 1.0, 6), (256, 930, .95, -4), (290, 906, .85, 0)],
                 [(210, 1000, .9, -70)], [(244, 1000, 1.0, 20), (290, 978, .9, -10)])
    pat += sprig("M214 806 C232 824 248 850 254 884", [(228, 820, .85, 6), (252, 882, .85, 0)], [(242, 844, .8, 60)])
    pat += star(296, 822, .8, 8)
    return pat


def sleeve_one(right=False):
    m = mir if right else (lambda d: d)
    d = m(SLEEVE)
    cid = "su-slvR" if right else "su-slvL"
    s = P(d, fill="url(#su-sleeve)", stroke=CLOTH_LINE, sw=2.6)
    s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath><g clip-path="url(#{cid})">'
    # shade: light from upper left, so the right sleeve's outer side and the left
    # sleeve's inner (front) side carry the shadow tone
    if right:
        s += P(m("M240 600 C232 700 214 860 200 1040 L250 1040 C258 880 262 740 262 640 Z"), fill=CLOTH_SH, op=.85)
    else:
        s += P("M306 680 C312 760 312 900 316 1040 L330 1040 L330 660 Z", fill=CLOTH_SH, op=.8)
    s += P(m("M330 630 C316 640 304 652 298 668 L320 690 Z"), fill=CLOTH_SH, op=.7)
    # underside of the forearm part: a soft shadow band under the arm
    s += P(m("M266 646 C282 654 294 664 302 674 L301 684 C290 674 278 664 264 656 Z"), fill=CLOTH_SH, op=.8)
    s += P(m("M240 632 C262 644 284 658 302 674"), stroke=CLOTH_LINE, sw=1.5, op=.5)
    if right:
        s += g(sleeve_pattern_L(), "translate(752 0) scale(-1 1)")
    else:
        s += g(sleeve_pattern_L(), "translate(8 0)")
    for f in ("M246 640 C238 740 226 880 218 1040", "M270 690 C262 800 258 920 258 1040",
              "M302 700 C292 800 290 940 292 1040", "M298 588 C288 566 288 540 298 520",
              "M300 676 C286 690 272 716 262 750", "M308 690 C300 716 296 748 296 780"):
        s += P(m(f), stroke=CLOTH_LINE, sw=1.6, op=.45)

    s += "</g>"
    return s


CUFF_TF = "translate(0 -12) rotate(-40)"


def cuff_back():
    s = (f'<ellipse rx="33" ry="15" fill="url(#su-lining)" stroke="{CLOTH_LINE}" stroke-width="2.4"/>'
         '<ellipse cx="3" cy="3" rx="26" ry="9" fill="#4b3590" opacity=".38"/>')
    return g(s, CUFF_TF)


def wrist_clip(cid):
    return (f'<clipPath id="{cid}"><ellipse transform="{CUFF_TF}" rx="33" ry="15"/>'
            f'<path transform="{CUFF_TF}" d="M-200 0 L200 0 L200 300 L-200 300 Z"/></clipPath>')


def wrist_shade():
    d = "M-33 0 C-33 -9 -18 -15 0 -15 C18 -15 33 -9 33 0 C20 -6 -20 -6 -33 0 Z"
    return g(P(d, fill="#3a2870", op=.35, extra='filter="url(#su-b1)"'), CUFF_TF)


def glass_hand():
    """One glass hand, palm up, in local coords (screen-left hand)."""
    s = '<clipPath id="su-handClip"><path d="' + HAND + '"/></clipPath>'
    # skin above the wrist fading into frosted glass, then clear glass
    s += P(HAND, fill="url(#su-wristSkin)")
    s += P(HAND, fill="url(#su-handGlass)")
    c = P(HAND, fill="url(#su-handFrost)")
    c += P(HAND, stroke="#4a5aa8", sw=7, op=.2, extra='filter="url(#su-b2)"')
    threads = [("#ff7eb6", "#ffe0ef", "M-4 -8 C-10 8 2 22 -4 38 C-8 50 0 60 -3 72 C-4 78 -1 84 0 88"),
               ("#5fdcff", "#e0fbff", "M9 -6 C15 10 5 24 12 40 C16 50 9 62 12 82"),
               ("#ffd36e", "#fff6d8", "M-12 8 C-20 18 -24 30 -33 50")]
    for col, core, path in threads:
        c += P(path, stroke=col, sw=4, op=.45, extra='filter="url(#su-b2)"')
        c += P(path, stroke=core, sw=1.1, op=.85)
    s += g(c, extra='clip-path="url(#su-handClip)"')
    il = "#8796d8"
    for d in ("M-6 82 C-6 72 -6 62 -7 54", "M6 86 C6 74 6 64 6 54", "M16 82 C16 72 16 62 16 52"):
        s += P(d, stroke=il, sw=1.4, op=.75)
    s += P("M-18 52 C-6 56 10 54 26 46", stroke=il, sw=1.2, op=.45)
    for d in ("M-16 68 C-13 70 -9 70 -7 68", "M-5 72 C-2 74 3 74 5 72", "M7 70 C10 72 13 72 15 70", "M17 64 C20 65 23 65 25 63"):
        s += P(d, stroke=il, sw=1.1, op=.5)
    s += P("M-18 42 C-10 32 -8 20 -8 8", stroke=il, sw=1.2, op=.5)
    s += P("M24 34 C16 33 6 36 -4 43", stroke=il, sw=1.2, op=.45)
    s += P("M-27 44 C-29 48 -31 52 -32 55", stroke=il, sw=1.1, op=.5)
    s += P("M-16 -10 C-17 4 -19 14 -22 22 C-30 28 -38 38 -42 48 C-45 56 -40 64 -34 61 "
           "C-30 58 -26 51 -20 46 C-19 56 -19 68 -17 79 C-16 89 -7 90 -6 82 C-5 94 5 96 6 86 "
           "C7 93 15 92 16 82 C18 84 25 81 26 72 C27 62 27 52 26 44 C25 30 22 14 18 -10",
           stroke=GLASS_LINE, sw=2.1)
    s += P("M-24 27 C-30 32 -35 38 -38 45", stroke="#ffffff", sw=2.4, op=.95)
    s += P("M-19 56 C-19 63 -18 70 -17 76", stroke="#ffffff", sw=1.8, op=.9)
    s += P("M26 48 C27 58 27 66 26 72 C25 80 20 84 17 83", stroke="url(#su-rainbowV)", sw=2, op=.85)
    s += P("M7 91 C10 93 14 91 15 86", stroke="url(#su-rainbow)", sw=1.5, op=.8)
    for (x, y) in ((-11.5, 84), (0.5, 90), (11, 87)):
        s += f'<ellipse cx="{x}" cy="{y}" rx="2.4" ry="1.6" fill="#ffffff" opacity=".85"/>'
    s += sparkle(-30, 40, 6.5)
    s += sparkle(10, 28, 3.5, op=.9)
    s += wrist_shade()
    return cuff_back() + wrist_clip("su-wristClip") + g(s, extra='clip-path="url(#su-wristClip)"')


def hands():
    hand = glass_hand()
    glow = ('<ellipse cx="380" cy="700" rx="78" ry="44" fill="#e9dcff" opacity=".55" filter="url(#su-b6)"/>'
            '<ellipse cx="380" cy="706" rx="40" ry="22" fill="#fff4fb" opacity=".6" filter="url(#su-b6)"/>')
    s = glow + g(hand, HAND_TF)
    hand_r = hand.replace("su-handClip", "su-handClipR").replace("su-wristClip", "su-wristClipR")
    s += g(g(hand_r, HAND_TF), "translate(760 0) scale(-1 1)")
    return s


def sleeves_and_hands():
    s = sleeve_one(False) + sleeve_one(True)
    # the pocket is on the inner side of her left sleeve (screen right): only a faint
    # warm glow shows through the silk, where she keeps the bead
    s += '<ellipse cx="452" cy="722" rx="16" ry="12" fill="#ff9ccc" opacity=".22" filter="url(#su-b6)"/>'
    s += hands()
    return s


# ------------------------------------------------------------------ head geometry (head-local, inside HEAD_TF)
FACE = ("M288 250 L287 300 C287 336 300 362 320 381 C338 398 360 410 380 411 "
        "C400 410 422 398 440 381 C460 362 473 336 473 300 L472 250 Z")
JAW_SHADOW = ("M473 298 C472 336 458 362 440 381 C422 398 402 408 382 410 "
              "C406 400 430 384 446 364 C458 346 464 324 466 298 Z")
HAIR_BACK = "M282 290 C276 316 278 340 288 356 C300 370 318 376 340 378 L420 378 C442 376 460 370 472 356 C482 340 484 316 478 290 Z"

# bangs: clumps from screen-right to screen-left as (notch_right, tip, notch_left)
BANG_START = (478, 318)
CLUMPS = [((468, 282), (453, 305), (440, 271)),
          ((440, 271), (419, 296), (403, 268)),
          ((403, 268), (393, 285), (385, 266)),
          ((385, 266), (365, 309), (350, 270)),
          ((350, 270), (331, 297), (316, 272)),
          ((316, 272), (300, 307), (290, 284))]
BANG_END = (282, 318)


def _bang_edge(dx=0, dy=0, soft=False):
    """Lower edge of the bangs as C segments from BANG_START (exclusive) to BANG_END."""
    def pt(p):
        return f"{_fmt(p[0]+dx)} {_fmt(p[1]+dy)}"
    out = f" C{pt((477, 304))} {pt((472, 290))} {pt(CLUMPS[0][0])}"
    for nr, t, nl in CLUMPS:
        if soft:   # rounded version for the forehead shadow
            t = (t[0], t[1] - 6)
        c1 = (nr[0] - (nr[0] - t[0]) * .08, nr[1] + (t[1] - nr[1]) * .55)
        c2 = (t[0] + (nr[0] - t[0]) * .38, t[1] - (t[1] - nr[1]) * .28)
        out += f" C{pt(c1)} {pt(c2)} {pt(t)}"
        c1 = (t[0] - (t[0] - nl[0]) * .22, t[1] - (t[1] - nl[1]) * .38)
        c2 = (nl[0] + (t[0] - nl[0]) * .12, nl[1] + (t[1] - nl[1]) * .5)
        out += f" C{pt(c1)} {pt(c2)} {pt(nl)}"
    nl = CLUMPS[-1][2]
    out += f" C{pt((nl[0]-4, nl[1]+12))} {pt((BANG_END[0]+1, BANG_END[1]-14))} {pt(BANG_END)}"
    return out


CROWN = ("M282 318 C268 266 288 206 380 196 C472 206 492 266 478 318" + _bang_edge() + " Z")
BANG_SHADOW = "M266 236 L494 236 L494 330 L481 330" + _bang_edge(3, 10, soft=True) + " L266 330 Z"

LOCK_L = ("M296 250 C278 280 268 318 270 356 C272 396 288 428 290 466 C292 504 274 532 276 562 "
          "C278 594 306 606 320 590 C328 578 318 564 306 570 C300 574 300 580 304 582 "
          "C294 566 306 538 308 506 C312 466 298 430 294 392 C290 352 290 300 306 262 Z")
LOCK_L2 = ("M288 300 C280 336 280 372 288 404 C294 428 300 446 298 470 "
           "C304 446 302 426 298 404 C292 372 290 336 294 304 Z")

LOOP_L = ("M372 200 C350 160 296 112 250 112 C212 112 196 140 206 166 C218 196 270 210 330 206 "
          "C348 205 362 203 372 200 Z "
          "M342 188 C324 166 294 142 264 142 C246 142 238 154 244 166 C252 180 282 186 314 186 "
          "C326 186 336 187 342 188 Z")
LOOP_C = ("M360 198 C346 160 350 108 380 82 C410 108 414 160 400 198 Z "
          "M373 178 C369 154 370 128 380 114 C390 128 391 154 387 178 Z")
TEGARA = "M348 184 C362 176 398 176 412 184 C417 192 417 200 412 207 C398 215 362 215 348 207 C343 200 343 192 348 184 Z"


def hair_back():
    s = P(HAIR_BACK, fill="url(#su-hairBack)", stroke=HAIR_LINE, sw=2.6)
    return s


def updo():
    s = ""
    for d in (LOOP_L, mir(LOOP_L)):
        s += P(d, fill="url(#su-hair)", stroke=HAIR_LINE, sw=2.6, extra='fill-rule="evenodd"')
    s += P(LOOP_C, fill="url(#su-hair)", stroke=HAIR_LINE, sw=2.6, extra='fill-rule="evenodd"')
    # shadow tone: underside of each side loop and the right half of the top loop
    s += both("M206 166 C218 196 270 210 330 206 C348 205 362 203 372 200 L342 188 C336 187 326 186 314 186 "
              "C282 186 252 180 244 166 Z", fill=HAIR_SHADE, op=.9)
    s += P("M387 178 C391 154 390 128 380 114 L380 82 C410 108 414 160 400 198 Z", fill=HAIR_SHADE, op=.8)
    # strands running along the bands
    s += both("M362 190 C338 160 296 128 254 126 C230 126 216 140 220 158", stroke=HAIR_LINE, sw=1.3, op=.45)
    s += both("M226 176 C244 192 290 198 340 196", stroke=HAIR_STRAND, sw=1.3, op=.5)
    s += both("M352 182 C330 156 300 136 270 132", stroke=HAIR_STRAND, sw=1.2, op=.45)
    s += both("M366 198 C344 168 304 132 262 120 C238 116 214 126 210 146", stroke=HAIR_LINE, sw=1.1, op=.35)
    s += both("M214 170 C232 194 284 204 344 202", stroke=HAIR_LINE, sw=1.1, op=.35)
    s += P("M366 194 C356 160 358 120 376 94", stroke=HAIR_LINE, sw=1.2, op=.45)
    s += P("M394 194 C402 160 400 122 386 98", stroke=HAIR_STRAND, sw=1.2, op=.45)
    # sheen
    s += both("M212 148 C218 124 246 114 276 118 C306 124 334 146 352 168", stroke=HAIR_SHEEN, sw=6, op=.75)
    s += both("M222 136 C234 122 256 118 280 122", stroke="#ffffff", sw=1.7, op=.6)
    s += P("M358 166 C354 134 360 106 376 90", stroke=HAIR_SHEEN, sw=5, op=.8)
    s += P("M363 128 C365 110 370 98 377 91", stroke="#ffffff", sw=1.5, op=.6)
    return s


def face_base():
    s = P(FACE, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += '<clipPath id="su-faceClip"><path d="' + FACE + '"/></clipPath>'
    s += g(P(BANG_SHADOW, fill=SKIN_SH), extra='clip-path="url(#su-faceClip)"')
    s += P(JAW_SHADOW, fill=SKIN_SH, op=.7)
    s += f'<ellipse cx="322" cy="{E+40}" rx="28" ry="10" fill="url(#su-blush)"/>'
    s += f'<ellipse cx="438" cy="{E+40}" rx="28" ry="10" fill="url(#su-blush)"/>'
    s += P(f"M383 {E+30} C382 {E+34} 380 {E+37} 378 {E+39}", stroke="#d3907f", sw=1.7)
    s += P(f"M385 {E+24} C386 {E+28} 386 {E+31} 385 {E+34}", stroke="#ffffff", sw=1.5, op=.8)
    return s


def crown():
    s = P(CROWN, fill="url(#su-hair)", stroke=HAIR_LINE, sw=2.4)
    # strands from each notch up toward the knot
    for (n, t, _nl) in CLUMPS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{_fmt(x0 + (380-x0)*.25)} {y0-40} {_fmt(380 + (x0-380)*.42)} 204",
               stroke=HAIR_LINE, sw=1.4, op=.45)
        # a lighter strand down the middle of each clump
        mx = (x0 + t[0]) / 2
        s += P(f"M{_fmt(mx+2)} {y0+4} C{_fmt(mx+1)} {y0+14} {_fmt((mx+t[0])/2)} {_fmt(t[1]-12)} {_fmt(t[0]+(mx-t[0])*.3)} {_fmt(t[1]-5)}",
               stroke=HAIR_STRAND, sw=1.3, op=.55)
    # side hair swept up toward the knot
    s += both("M284 300 C280 270 292 236 330 212", stroke=HAIR_LINE, sw=1.4, op=.5)
    s += both("M292 286 C292 262 304 238 340 216", stroke=HAIR_STRAND, sw=1.3, op=.5)
    # angel-ring sheen band following the dome, with a few soft scallops
    s += P("M294 244 C314 222 346 212 380 211 C414 212 446 222 466 244 "
           "C458 240 452 246 446 244 C438 236 430 240 424 240 C414 232 404 236 398 236 "
           "C390 228 380 232 374 232 C366 228 356 236 348 236 C340 236 332 242 326 242 "
           "C318 240 310 248 302 246 C299 246 296 246 294 244 Z", fill=HAIR_SHEEN, op=.6)
    s += P("M312 228 C332 218 352 214 372 214", stroke="#ffffff", sw=1.8, op=.6)
    s += P("M392 214 C404 214 414 216 424 220", stroke="#ffffff", sw=1.2, op=.45)
    # cool shadow on the right side of the crown
    s += P("M478 318 C492 266 472 206 380 196 C452 214 474 262 466 304 Z", fill=HAIR_SHADE, op=.55)
    return s


def tegara():
    s = P(TEGARA, fill="url(#su-tegara)", stroke="#26308a", sw=2)
    for i in range(7):
        for j in range(2):
            x = 352 + i * 9 + (4.5 if j else 0)
            y = 189 + j * 9
            s += f'<circle cx="{_fmt(x)}" cy="{y}" r="1.7" fill="#ffffff" opacity=".9"/>'
    s += P("M350 188 C364 182 396 182 410 188", stroke="#b8c8ff", sw=1.4, op=.8)
    return s


def comb():
    """A clear glass kushi comb pushed into the front of the crown."""
    body = "M328 240 C338 220 358 210 380 209 C402 210 422 220 432 240 C414 234 398 232 380 232 C362 232 346 234 328 240 Z"
    s = P(body, fill="#f4efff", op=.5)
    s += P(body, stroke=GLASS_LINE, sw=1.8)
    s += P("M335 234 C346 220 362 213 380 213", stroke="#ffffff", sw=1.8, op=.95)
    s += P("M404 214 C416 219 424 227 428 235", stroke="url(#su-rainbow)", sw=1.6, op=.9)
    s += P("M340 238 L341 244 M352 235 L352 242 M364 233 L364 240 M376 232 L376 239 M388 232 L388 239 "
           "M400 233 L400 240 M412 235 L411 242 M422 238 L421 244", stroke=GLASS_LINE, sw=1.2, op=.5)
    for (x, y, col) in ((350, 229, "#ff7fc4"), (365, 223, "#46d9ff"), (380, 221, "#ffc23e"),
                        (395, 223, "#a66bff"), (410, 229, "#2fc59a")):
        s += bead(x, y, 3.8 if col == "#ffc23e" else 3.2, col, glow=(col == "#ffc23e"))
    s += sparkle(338, 226, 4)
    return s


def locks():
    s = ""
    for d in (LOCK_L, mir(LOCK_L)):
        s += P(d, fill="url(#su-hairLock)", stroke=HAIR_LINE, sw=2.4)
    s += both("M286 290 C280 330 282 372 292 410", stroke=HAIR_SHEEN, sw=4, op=.75)
    s += both("M290 300 C286 330 286 360 292 388", stroke="#ffffff", sw=1.3, op=.5)
    s += both("M300 470 C300 500 288 530 288 560", stroke=HAIR_STRAND, sw=1.6, op=.6)
    s += both("M284 360 C286 400 300 440 298 480", stroke=HAIR_LINE, sw=1.3, op=.5)
    s += both("M306 572 C312 576 314 584 310 588", stroke=HAIR_STRAND, sw=1.4, op=.7)
    return s


# hairpins: (x, y) where the stick enters, angle (deg; 0 = right, -90 = up), length, colour, kind
PINS_BACK = [
    (300, 150, -150, 72, "#ff4d6d", "ball"),
    (330, 132, -118, 70, "#ffc23e", "flower"),
    (364, 116, -100, 60, "#46d9ff", "ball"),
    (396, 116, -80, 60, "#ff7fc4", "double"),
    (430, 132, -62, 70, "#2fc59a", "ball"),
    (460, 150, -30, 72, "#3f6dff", "flower"),
    (232, 170, -168, 58, "#a66bff", "double"),
    (528, 170, -12, 58, "#ff9a3c", "ball"),
]
PINS_FRONT = [
    (284, 232, 172, 42, "#7df0d0", "dangle"),
    (476, 232, 8, 42, "#e0559a", "bell"),
    (344, 202, -138, 40, "#8ecbff", "ball"),
    (416, 202, -42, 40, "#b8b0c8", "ball"),
]


def pin(x, y, ang, length, col, kind):
    rim = BEAD_COLS[col]
    a = math.radians(ang)
    ex, ey = x + math.cos(a) * length, y + math.sin(a) * length
    s = ""
    stick = f'x1="{_fmt(x)}" y1="{_fmt(y)}" x2="{_fmt(ex)}" y2="{_fmt(ey)}" stroke-linecap="round"'
    s += f'<line {stick} stroke="{GLASS_LINE}" stroke-width="4.4"/>'
    s += f'<line {stick} stroke="#f4f2ff" stroke-width="2.6"/>'
    s += f'<line {stick} stroke="{col}" stroke-width="1" opacity=".75"/>'
    if kind == "ball":
        s += bead(ex, ey, 9, col)
    elif kind == "double":
        mx, my = x + math.cos(a) * length * .72, y + math.sin(a) * length * .72
        s += bead(mx, my, 6, col, glow=False)
        s += bead(ex, ey, 9.5, col)
    elif kind == "flower":
        s += f'<circle cx="{_fmt(ex)}" cy="{_fmt(ey)}" r="17" fill="{col}" opacity=".45" filter="url(#su-b3)"/>'
        for k in range(5):
            rot = ang + 90 + k * 72
            tf = f'translate({_fmt(ex)} {_fmt(ey)}) rotate({_fmt(rot)})'
            s += (f'<path d="M0 0 C-7 -4 -9 -13 0 -17 C9 -13 7 -4 0 0 Z" transform="{tf}" fill="#ffffff" '
                  f'fill-opacity=".6" stroke="{rim}" stroke-width="1.3" stroke-linejoin="round"/>')
            s += (f'<path d="M0 -3 C-2 -7 -2 -10 0 -13" transform="{tf}" stroke="{col}" stroke-width="2.2" '
                  f'fill="none" stroke-linecap="round" opacity=".9"/>')
        s += bead(ex, ey, 4.5, col, glow=False)
    elif kind in ("dangle", "bell"):
        s += bead(ex, ey, 8, col)
        cy = ey + 9
        for k, r in enumerate((3.2, 3.6, 4.2)):
            s += f'<line x1="{_fmt(ex)}" y1="{_fmt(cy)}" x2="{_fmt(ex)}" y2="{_fmt(cy + 3.5)}" stroke="#d8d0ff" stroke-width="1"/>'
            cy += r + 3.5
            s += bead(ex, cy, r, col, glow=False)
            cy += r
        s += f'<line x1="{_fmt(ex)}" y1="{_fmt(cy)}" x2="{_fmt(ex)}" y2="{_fmt(cy + 4)}" stroke="#d8d0ff" stroke-width="1"/>'
        cy += 4
        if kind == "dangle":
            s += bead(ex, cy + 5.5, 5.5, col)
        else:
            # a tiny clear glass suzu (round bell) — her name
            bx, by, r = ex, cy + 8, 8
            s += f'<circle cx="{_fmt(bx)}" cy="{_fmt(by)}" r="{r*1.8:.1f}" fill="#ffd36e" opacity=".35" filter="url(#su-b3)"/>'
            s += (f'<circle cx="{_fmt(bx)}" cy="{_fmt(by)}" r="{r}" fill="#f6f2ff" fill-opacity=".55" '
                  f'stroke="{GLASS_LINE}" stroke-width="1.6"/>')
            s += P(f"M{_fmt(bx-r+1.5)} {_fmt(by+1)} L{_fmt(bx+r-1.5)} {_fmt(by+1)}", stroke=GLASS_LINE, sw=1.2)
            s += f'<circle cx="{_fmt(bx)}" cy="{_fmt(by+3.6)}" r="1.6" fill="#7f8fd6"/>'
            s += P(f"M{_fmt(bx+r*.2)} {_fmt(by+r*.95)} C{_fmt(bx+r*.8)} {_fmt(by+r*.6)} {_fmt(bx+r)} {_fmt(by)} {_fmt(bx+r*.8)} {_fmt(by-r*.5)}",
                   stroke="url(#su-rainbow)", sw=1.4, op=.9)
            s += (f'<ellipse cx="{_fmt(bx-r*.38)}" cy="{_fmt(by-r*.4)}" rx="{r*.32:.1f}" ry="{r*.22:.1f}" fill="#fff" '
                  f'transform="rotate(-30 {_fmt(bx-r*.38)} {_fmt(by-r*.4)})"/>')
            s += f'<path d="M{_fmt(bx-2)} {_fmt(by-r-1)} C{_fmt(bx-2)} {_fmt(by-r-4)} {_fmt(bx+2)} {_fmt(by-r-4)} {_fmt(bx+2)} {_fmt(by-r-1)}" fill="none" stroke="{GLASS_LINE}" stroke-width="1.2"/>'
    return s


# ------------------------------------------------------------------ eyes
EYE_SHAPES = []      # (d, kind) for the left eye; kind 'fill' or 'stroke'; the blink mask unions them


def reg(d, kind="fill"):
    if (d, kind) not in EYE_SHAPES:
        EYE_SHAPES.append((d, kind))
    return d


def glass_eye(cx, cy, rx, ry, idx):
    """Clear marble with a curl of violet smoke and no pupil."""
    cid = f"su-ir{idx}"
    e = f'cx="{_fmt(cx)}" cy="{_fmt(cy)}" rx="{rx}" ry="{ry}"'
    s = f'<clipPath id="{cid}"><ellipse {e}/></clipPath>'
    s += f'<ellipse {e} fill="url(#su-marble)"/>'
    c = ""
    # violet haze pooling low in the marble
    c += f'<ellipse cx="{_fmt(cx-1)}" cy="{_fmt(cy+ry*.45)}" rx="{rx*.9:.1f}" ry="{ry*.5:.1f}" fill="#b48cf0" opacity=".35" filter="url(#su-b3)"/>'
    def sm(pts):
        out = f"M{_fmt(cx+pts[0][0])} {_fmt(cy+pts[0][1])}"
        for i in range(1, len(pts), 3):
            out += " C" + " ".join(f"{_fmt(cx+px)} {_fmt(cy+py)}" for px, py in pts[i:i+3])
        return out
    # a soft plume of violet smoke with one thin filament curling over near the top
    plume = (f"M{_fmt(cx-12)} {_fmt(cy+26)} C{_fmt(cx-16)} {_fmt(cy+10)} {_fmt(cx-4)} {_fmt(cy+2)} {_fmt(cx-6)} {_fmt(cy-10)} "
             f"C{_fmt(cx-7)} {_fmt(cy-18)} {_fmt(cx+8)} {_fmt(cy-18)} {_fmt(cx+10)} {_fmt(cy-6)} "
             f"C{_fmt(cx+12)} {_fmt(cy+6)} {_fmt(cx+4)} {_fmt(cy+10)} {_fmt(cx+2)} {_fmt(cy+26)} Z")
    c += P(plume, fill="#8e4fe0", op=.32, extra='filter="url(#su-b3)"')
    curl = sm([(6, 24), (-2, 14), (-14, 10), (-12, -2), (-10, -12), (4, -14), (8, -6),
               (11, 1), (3, 6), (-1, 2), (-4, -1), (-1, -6), (3, -5)])
    wisp = sm([(10, 24), (14, 16), (16, 8), (12, 0)])
    c += P(curl, stroke="#8e4fe0", sw=10, op=.3, extra='filter="url(#su-b3)"')
    c += P(curl, stroke="#7d3fd1", sw=4, op=.75, extra='filter="url(#su-b1)"')
    c += P(curl, stroke="#ecdcff", sw=1, op=.9)
    c += P(wisp, stroke="#9a5cf0", sw=2.5, op=.5, extra='filter="url(#su-b1)"')
    # caustic: light focused through the sphere pools bright at the bottom
    c += f'<ellipse cx="{_fmt(cx+3)}" cy="{_fmt(cy+ry*.66)}" rx="{rx*.66:.1f}" ry="{ry*.26:.1f}" fill="url(#su-marbleGlow)"/>'
    # lid shadow
    c += (f'<path d="M{_fmt(cx-rx-2)} {_fmt(cy-ry*.42)} C{_fmt(cx-8)} {_fmt(cy-ry*.2)} {_fmt(cx+8)} {_fmt(cy-ry*.2)} '
          f'{_fmt(cx+rx+2)} {_fmt(cy-ry*.42)} L{_fmt(cx+rx+2)} {_fmt(cy-ry-4)} L{_fmt(cx-rx-2)} {_fmt(cy-ry-4)} Z" fill="#3a1a6a" opacity=".3"/>')
    s += g(c, extra=f'clip-path="url(#{cid})"')
    s += f'<ellipse {e} fill="none" stroke="#6a52b8" stroke-width="1.6"/>'
    s += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy)}" rx="{rx-1.6:.1f}" ry="{ry-1.6:.1f}" fill="none" stroke="url(#su-rainbow)" stroke-width="1.3" opacity=".7"/>'
    return s


def eye_highlights(cx, cy, big=1.0, wet=False):
    s = (f'<ellipse cx="{_fmt(cx-8)}" cy="{_fmt(cy-11)}" rx="{7*big:.1f}" ry="{8.5*big:.1f}" fill="#fff" '
         f'transform="rotate(-18 {_fmt(cx-8)} {_fmt(cy-11)})"/>')
    s += f'<circle cx="{_fmt(cx+9)}" cy="{_fmt(cy+10)}" r="3.2" fill="#fff"/>'
    s += f'<circle cx="{_fmt(cx-8)}" cy="{_fmt(cy+11)}" r="1.6" fill="#fff" opacity=".9"/>'
    s += P(f"M{_fmt(cx+12)} {_fmt(cy-14)} C{_fmt(cx+16)} {_fmt(cy-8)} {_fmt(cx+17)} {_fmt(cy-2)} {_fmt(cx+16)} {_fmt(cy+4)}",
           stroke="#fff", sw=1.6, op=.8)
    if wet:
        s += f'<circle cx="{_fmt(cx+3)}" cy="{_fmt(cy-15)}" r="2.4" fill="#fff"/>'
        s += f'<circle cx="{_fmt(cx-12)}" cy="{_fmt(cy+4)}" r="1.8" fill="#fff" opacity=".9"/>'
        s += P(f"M{_fmt(cx-14)} {_fmt(cy+16)} C{_fmt(cx-6)} {_fmt(cy+21)} {_fmt(cx+6)} {_fmt(cy+21)} {_fmt(cx+14)} {_fmt(cy+15)}",
               stroke="#ffffff", sw=1.8, op=.85)
    return s


GAZE = -4  # marbles sit a little to screen left: her gaze lands just past the viewer
LOWER = "M310 345 C316 352 325 356 337 357"
CREASE_D = "M310 296 Q332 286 357 292"
FLICK = "M304 318 C300 315 296 315 292 317 C296 317 300 319 303 322 Z M306 311 C303 306 299 304 295 304 C299 306 302 309 304 313 Z"


def open_eye(scl, lash, iris_dy=0, iris_r=(21, 25), lower=LOWER, crease=CREASE_D, big=1.0, flick=FLICK, wet=False):
    reg(scl)
    reg(lash)
    if flick:
        reg(flick)
    if lower:
        reg(lower, "stroke")
    s = ""
    for side in ("L", "R"):
        m = (lambda d: d) if side == "L" else mir
        base_cx = EXL if side == "L" else EXR
        cx, cy = base_cx + GAZE, E + iris_dy
        clip = f"su-sc{side}"
        s += f'<clipPath id="{clip}"><path d="{m(scl)}"/></clipPath>'
        s += P(m(scl), fill="url(#su-sclera)")
        s += g(glass_eye(cx, cy, iris_r[0], iris_r[1], side) + eye_highlights(cx, cy, big, wet), extra=f'clip-path="url(#{clip})"')
        s += P(m(lash), fill=LASH)
        if flick:
            s += P(m(flick), fill=LASH)
        if lower:
            s += P(m(lower), stroke="#7a3a6a", sw=1.7, op=.85)
        if crease:   # QA: clipped inside the blink patch so no crease stub shows during a blink
            s += g(P(m(crease), stroke=CREASE, sw=1.5, op=.75), extra='clip-path="url(#su-creaseClip)"')
    return s


def brows(d):
    """Brows sit over the bangs: a soft pale halo keeps them readable on dark hair."""
    s = ""
    for dd in (d, mir(d)):
        s += P(dd, fill="none", stroke="#f6d3dc", sw=3.2, op=.55)
        s += P(dd, fill=BROW)
    return s


def blush_strong(y=E + 40):
    s = f'<ellipse cx="320" cy="{y}" rx="30" ry="11" fill="url(#su-blush2)"/>'
    s += f'<ellipse cx="440" cy="{y}" rx="30" ry="11" fill="url(#su-blush2)"/>'
    for x0 in (308, 318, 328, 428, 438, 448):
        s += P(f"M{x0} {y+8} L{x0+6} {y-1}", stroke="#ff5a7a", sw=1.6, op=.55)
        s += P(f"M{x0+2} {y+8} L{x0+7} {y+1}", stroke="#ffffff", sw=.9, op=.6)
    return s


# ------------------------------------------------------------------ expressions
# each returns (face_layer, brow_layer, extras_layer); face_layer sits under the bangs

def mouth_open(d, tongue=None, teeth_top=None, teeth_bot=None, cid="su-m"):
    s = P(d, fill="#8a2f3a", stroke="#6b2430", sw=1.8)
    inner = ""
    if tongue:
        inner += P(tongue, fill="#f08a96")
    if teeth_top:
        inner += P(teeth_top, fill="#ffffff")
    if teeth_bot:
        inner += P(teeth_bot, fill="#ffffff")
    if inner:
        s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>' + g(inner, extra=f'clip-path="url(#{cid})"')
    return s


def ex_proud():
    arc = ("M300 336 C308 318 324 310 336 310 C348 310 360 318 366 332 C366 336 362 336 360 333 "
           "C354 322 346 317 336 317 C324 317 312 324 306 337 C304 340 300 340 300 336 Z")
    lash = "M300 336 C296 334 292 336 289 340 C294 339 298 339 301 340 Z M304 328 C300 324 296 323 292 324 C296 325 300 328 302 331 Z"
    reg(arc)
    reg(lash)
    face = both(arc, fill=LASH) + both(lash, fill=LASH)
    face += both("M314 344 C322 349 332 350 342 347", stroke=CREASE, sw=1.4, op=.6)
    face += blush_strong()
    mouth = "M352 380 C366 385 394 385 410 375 C408 393 397 405 382 406 C367 406 356 397 352 380 Z"
    face += mouth_open(mouth, tongue="M360 402 C368 393 392 391 406 399 L406 412 L360 412 Z",
                       teeth_top="M352 380 C366 385 394 385 410 375 L410 370 L352 370 Z", cid="su-mP")
    face += P("M352 384 C366 389 394 389 409 380", stroke="#e6d6e0", sw=1, op=.7)
    face += P("M348 376 C350 378 352 379 354 380", stroke=MOUTH_LINE, sw=1.8)
    face += P("M409 372 C412 370 413 368 414 365", stroke=MOUTH_LINE, sw=1.8)
    brow = brows("M302 270 C312 262 330 259 352 264 C354 266 352 268 350 267 C332 264 316 266 304 273 C302 274 301 272 302 270 Z")
    extras = sparkle(214, 250, 14, "#ffe680") + sparkle(200, 284, 6) + sparkle(552, 236, 10)
    extras += sparkle(538, 270, 6, "#d6c2ff") + sparkle(232, 222, 5, "#ffc2e0")
    return face, brow, extras


def ex_soft():
    scl = "M304 330 C310 318 322 311 335 310 C349 310 358 315 362 322 C364 336 357 350 337 354 C320 356 308 346 304 330 Z"
    lash = ("M297 332 C301 318 316 305 335 304 C351 304 361 309 366 318 C367 321 365 322 363 321 "
            "C357 313 348 310 335 310 C321 311 311 318 305 328 C302 332 299 333 297 332 Z")
    flick = "M304 324 C300 322 296 322 292 324 C296 324 300 326 303 328 Z M306 318 C303 313 299 312 295 312 C299 314 302 317 304 320 Z"
    face = open_eye(scl, lash, iris_dy=3, lower="M310 344 C316 350 325 353 337 354", crease="M310 300 Q332 292 357 298", flick=flick)
    face += P("M366 386 C373 392 387 392 394 385", stroke=MOUTH_LINE, sw=2.1)
    face += P("M364 384 C365 386 366 387 367 387", stroke=MOUTH_LINE, sw=1.6, op=.7)
    face += P("M393 384 C394 383 395 383 396 382", stroke=MOUTH_LINE, sw=1.6, op=.7)
    brow = brows("M304 274 C314 268 332 266 352 270 C354 272 352 274 350 273 C332 271 316 272 306 277 C304 278 303 276 304 274 Z")
    return face, brow, ""


def ex_sad():
    scl = "M304 334 C310 323 322 316 336 313 C349 311 358 314 362 320 C364 336 357 350 337 355 C320 357 308 348 304 334 Z"
    lash = ("M296 338 C300 324 314 310 336 307 C351 305 361 308 366 316 C367 319 365 320 363 319 "
            "C357 312 348 311 336 313 C322 315 311 322 305 333 C302 338 299 339 296 338 Z")
    flick = "M304 330 C300 329 296 330 293 333 C297 332 300 333 303 334 Z"
    face = open_eye(scl, lash, iris_dy=6, lower="M310 345 C316 351 325 354 337 355", crease="M312 302 Q334 296 358 298", flick=flick)
    face += P("M370 392 C375 389 385 389 390 392", stroke=MOUTH_LINE, sw=2)
    face += P("M374 396 C378 397 382 397 386 396", stroke=CREASE, sw=1.2, op=.6)
    brow = brows("M304 278 C318 276 334 270 348 260 C351 258 353 261 351 263 C337 274 322 282 306 282 C303 282 302 279 304 278 Z")
    return face, brow, ""


def ex_surprised():
    scl = "M302 326 C305 308 318 297 334 296 C350 296 360 304 364 316 C366 336 358 356 336 360 C318 362 304 348 302 326 Z"
    lash = ("M295 326 C297 307 313 290 334 290 C351 290 362 297 367 309 C368 312 366 313 364 312 "
            "C358 301 348 296 334 296 C319 297 309 307 303 322 C301 327 298 328 295 326 Z")
    flick = "M302 316 C298 312 294 311 290 312 C294 313 298 316 301 320 Z M305 306 C302 301 298 299 294 298 C297 301 300 304 303 309 Z"
    face = open_eye(scl, lash, iris_dy=0, iris_r=(18, 21), lower="M308 348 C315 356 325 360 337 361",
                    crease="M310 288 Q332 278 358 284", flick=flick, big=.85)
    face += '<ellipse cx="381" cy="392" rx="7.5" ry="9" fill="#8a2f3a" stroke="#6b2430" stroke-width="1.8"/>'
    face += '<ellipse cx="381" cy="397" rx="4.5" ry="3" fill="#f08a96"/>'
    brow = brows("M302 258 C314 248 332 246 352 252 C354 254 352 256 350 255 C332 252 316 253 304 261 C302 262 301 260 302 258 Z")
    extras = (both("M262 262 L248 254", stroke="#7a3a6a", sw=2.4) + both("M258 280 L242 278", stroke="#7a3a6a", sw=2.4)
              + both("M270 246 L262 233", stroke="#7a3a6a", sw=2.4))
    return face, brow, extras


def ex_angry():
    scl = "M304 320 C310 314 322 312 336 314 C350 316 360 322 363 330 C362 344 354 353 337 355 C320 356 308 344 304 320 Z"
    lash = ("M296 318 C302 308 318 304 336 307 C352 310 362 318 367 327 C368 330 366 331 364 330 "
            "C358 322 348 316 336 314 C322 312 311 314 304 322 C301 324 298 322 296 318 Z")
    flick = "M302 316 C298 312 294 311 290 312 C294 313 298 315 301 320 Z"
    face = open_eye(scl, lash, iris_dy=4, iris_r=(20, 23), lower="M310 346 C316 352 325 355 337 356",
                    crease="M310 300 Q330 296 352 304", flick=flick)
    face += blush_strong()
    mouth = "M351 387 C362 381 398 381 409 387 C407 398 396 403 380 403 C364 403 353 398 351 387 Z"
    face += mouth_open(mouth, teeth_top="M348 378 L412 378 L412 392 C396 390 364 390 348 392 Z",
                       teeth_bot="M348 396 C364 394 396 394 412 396 L412 410 L348 410 Z", cid="su-mA")
    face += P("M366 384 L366 390 M380 383 L380 390 M394 384 L394 390", stroke="#d9cdd8", sw=1, op=.9)
    face += P("M351 388 C348 390 346 393 346 396", stroke=MOUTH_LINE, sw=1.8)
    face += P("M409 388 C412 390 414 393 414 396", stroke=MOUTH_LINE, sw=1.8)
    brow = brows("M296 257 C314 257 334 263 349 274 C352 276 350 280 346 279 C330 271 313 265 298 263 C295 262 294 258 296 257 Z")
    return face, brow, ""


def ex_tears():
    scl = "M304 332 C310 320 322 313 336 311 C349 310 358 313 362 319 C364 336 357 350 337 355 C320 357 308 347 304 332 Z"
    lash = ("M296 336 C300 322 314 308 336 305 C351 304 361 307 366 315 C367 318 365 319 363 318 "
            "C357 311 348 310 336 311 C322 313 311 320 305 331 C302 336 299 337 296 336 Z")
    flick = "M304 328 C300 327 296 328 293 331 C297 330 300 331 303 332 Z"
    face = open_eye(scl, lash, iris_dy=4, lower=None, crease="M312 300 Q334 294 358 296", flick=flick, big=1.08, wet=True)
    # water pooled along the lower lid, inside the eye
    pool = ("M305 336 C313 349 326 354 338 353 C350 352 358 346 362 335 L362 328 "
            "C356 339 348 345 338 346 C326 347 313 342 305 331 Z")
    for side, m in (("L", lambda d: d), ("R", mir)):
        face += g(P(m(pool), fill="#c8ecff", op=.55)
                  + P(m("M306 333 C314 343 326 347 338 346 C348 345 356 340 361 331"), stroke="#ffffff", sw=1.6, op=.95),
                  extra=f'clip-path="url(#su-sc{side})"')
    # tears spill over the lower lid and run down the cheeks, catching the light
    st_l = ("M317 352 C315 362 317 372 314 382 C311 392 316 400 322 398 C328 396 327 388 325 380 "
            "C322 370 321 361 320 352 Z")
    st_r = mir("M318 353 C316 362 318 371 316 380 C313 389 317 395 322 394 C327 393 326 386 324 379 "
               "C322 370 321 362 321 353 Z")
    for d in (st_l, st_r):
        face += P(d, fill="url(#su-tear)", stroke="#7fcff6", sw=1.1, op=.95)
    face += P("M317 366 C316 374 315 382 315 390", stroke="#ffffff", sw=1.5)
    face += P(mir("M318 366 C317 373 316 380 317 386"), stroke="#ffffff", sw=1.5)
    face += P("M323 378 C324 384 324 390 322 394", stroke="url(#su-rainbowV)", sw=1.1, op=.9)
    tear = "M0 -6 C2 -2 4 1 4 3 C4 6 -4 6 -4 3 C-4 1 -2 -2 0 -6 Z"
    for (x, y, sc) in ((320, 408, 1.0), (440, 402, .85), (312, 420, .6)):
        face += g(P(tear, fill="url(#su-tear)", stroke="#7fcff6", sw=1) + '<circle cx="-1.4" cy="2" r=".9" fill="#fff"/>',
                  f"translate({x} {y}) scale({sc})")
    face += blush_strong()
    mouth = "M364 388 C370 383 375 387 380 384 C385 387 390 383 396 388 C394 398 388 402 380 402 C372 402 366 398 364 388 Z"
    face += P(mouth, fill="#8a2f3a", stroke="#6b2430", sw=1.8)
    face += P("M370 398 C376 394 386 394 391 398 C388 401 372 401 370 398 Z", fill="#f08a96")
    brow = brows("M304 277 C318 276 334 270 348 259 C351 257 353 260 351 262 C337 274 322 282 306 282 C303 282 302 279 304 277 Z")
    return face, brow, ""


EXPRESSIONS = {"proud": ex_proud, "soft": ex_soft, "sad": ex_sad, "surprised": ex_surprised,
               "angry": ex_angry, "tears": ex_tears}

# ------------------------------------------------------------------ blink overlay
CLOSED = ("M297 334 C307 346 321 352 336 352 C350 352 360 347 367 338 C367 342 363 347 359 350 "
          "C351 356 343 358 336 358 C320 358 306 350 297 338 Z")
CLOSED_LASH = ("M299 335 C295 336 291 339 288 343 C293 341 297 340 300 340 Z "
               "M303 341 C300 345 297 348 295 352 C299 349 303 346 305 344 Z")
CLOSED_LOWER = "M318 357 C326 361 340 361 350 357"


# --- geometry helpers for the blink patch (sample paths, hull, offset)
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
    """Round-joined outward offset of a convex polygon (counter-clockwise in y-down = clockwise visually)."""
    out = []
    n = len(h)
    # orientation: make normals point outward
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


def blink_patch_pts(grow=None):
    grow = BLINK_GROW if grow is None else grow
    pts = []
    for d, kind in EYE_SHAPES + [(CLOSED, "fill"), (CLOSED_LASH, "fill")]:
        sp = sample_path(d)
        if kind == "stroke":   # widen strokes by their half width
            sp = [(x + dx, y + dy) for x, y in sp for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))]
        pts += sp
    return offset_hull(hull(pts), grow)


def blink_clip():
    """Skin + closed lids are clipped to the patch; the redrawn front hair to a
    patch 2px larger, so at the skin's soft edge the hair is always opaque."""
    d = poly_d(blink_patch_pts())
    d2 = poly_d(blink_patch_pts(BLINK_GROW + 2))
    return (f'<clipPath id="su-blinkClip"><path d="{d}"/><path d="{mir(d)}"/></clipPath>'
            f'<clipPath id="su-blinkHairClip"><path d="{d2}"/><path d="{mir(d2)}"/></clipPath>')


def blink_layer():
    s = blink_clip()
    lids = face_base()
    lids += both(CLOSED, fill=LASH) + both(CLOSED_LASH, fill=LASH)
    lids += both(CLOSED_LOWER, stroke=CREASE, sw=1.3, op=.6)
    hair = crown() + locks()
    s += g(g(lids, extra='clip-path="url(#su-blinkClip)"') + g(hair, extra='clip-path="url(#su-blinkHairClip)"'), HEAD_TF)
    return s


# ------------------------------------------------------------------ assemble
def header():
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
            f"<defs>{DEFS}{bead_defs()}</defs>\n")


def body_layers():
    s = "<!-- obi bow (behind) -->" + bow()
    s += g(hair_back(), HEAD_TF)
    s += "<!-- neck and glass collar -->" + neck_and_chest()
    s += "<!-- kimono -->" + torso() + collar() + obi()
    s += "<!-- sleeves and glass hands -->" + sleeves_and_hands()
    return s


def head_back():
    return "".join(pin(*p) for p in PINS_BACK) + updo() + tegara()


def head_front():
    return crown() + comb() + locks() + "".join(pin(*p) for p in PINS_FRONT)


def sprite(name):
    face, brow, extras = EXPRESSIONS[name]()
    s = header()
    s += body_layers()
    s += f'<g transform="{HEAD_TF}">'
    cd = poly_d(blink_patch_pts(BLINK_GROW - 2))
    s += f'<defs><clipPath id="su-creaseClip"><path d="{cd}"/><path d="{mir(cd)}"/></clipPath></defs>'
    s += head_back() + face_base()
    s += f"<!-- face: {name} -->" + face + "<!-- /face -->"
    s += head_front()
    s += brow + extras
    s += "</g>\n</svg>\n"
    return s


def blink():
    return header() + blink_layer() + "\n</svg>\n"


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("names", nargs="*", help="expressions to write (default: all of them plus blink)")
    ap.add_argument("--out", default=OUT_ROOT, metavar="DIR",
                    help="output root; files go to DIR/chars/suzu/ (default: %(default)s)")
    opt = ap.parse_args()
    outdir = os.path.join(opt.out, "chars", "suzu")
    args = opt.names
    targets = args or list(EXPRESSIONS) + ["blink"]
    for fn in EXPRESSIONS.values():   # register every expression's eye shapes before any patch is used
        fn()
    out = {n: sprite(n) for n in EXPRESSIONS}      # also fills EYE_SHAPES for the blink mask
    out["blink"] = blink()
    for n in targets:
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, f"{n}.svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(out[n])
        print(n, len(out[n]))


def check_clearance():
    """Distance from every brow / mouth / nose to the blink patch (must stay > 2 px)."""
    patch = blink_patch_pts(BLINK_GROW + 2)
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
    import re as _re
    for name, fn in EXPRESSIONS.items():
        face, brow, extras = fn()
        ds = _re.findall(r'<path d="([^"]+)"', brow)
        worst = min(dist(p, patch) for d in ds[:2] for p in sample_path(d))
        print(f"{name:10s} brow clearance {worst - 1.6:6.1f}px (incl. halo, vs hair clip)")
    ys = [y for x, y in patch]; xs = [x for x, y in patch]
    print("patch bbox", round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)))
