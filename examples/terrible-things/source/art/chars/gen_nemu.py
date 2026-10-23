#!/usr/bin/env python3
"""Nemu Kagami sprite generator (house style: STYLE.md, reference gen_suzu.py).

Shared body/hair layers are emitted byte-identically into every expression file;
only the face group differs. blink.svg redraws skin + front hair clipped to a
patch made from the hull of every expression's eye shapes, then draws closed lids.

usage: gen_nemu.py [--out DIR] [name ...]
  writes DIR/chars/nemu/<name>.svg (default DIR: $TMPDIR/terrible-things-art);
  install by copying those files over the game's chars/nemu/.
"""
import argparse, math, os, re, sys, tempfile

OUT_ROOT = os.path.join(tempfile.gettempdir(), "terrible-things-art")

W, H = 760, 1040
PIV = (380, 330)
TILT = -6
HEAD_TF = f"rotate({TILT} {PIV[0]} {PIV[1]})"
E = 232
EXL, EXR = 334, 426

# ------------------------------------------------------------------ helpers
NUM = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?")


def _fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def mapxy(d, fn):
    """Apply fn(x, y) -> (x, y) to every coordinate pair of an absolute M L C Q Z path."""
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


def mir(d, cx=380):
    return mapxy(d, lambda x, y: (2 * cx - x, y))


def shift(d, dx=0, dy=0):
    return mapxy(d, lambda x, y: (x + dx, y + dy))


def _rot(x, y, deg):
    a = math.radians(deg)
    dx, dy = x - PIV[0], y - PIV[1]
    return (PIV[0] + dx * math.cos(a) - dy * math.sin(a), PIV[1] + dx * math.sin(a) + dy * math.cos(a))


def Hl(d):
    """Canvas-space path -> head-local path (inverse of HEAD_TF), so hair designed
    to hang straight on the canvas can live inside the tilted head group."""
    return mapxy(d, lambda x, y: _rot(x, y, -TILT))


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


# cubic helpers for parametric eyes
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])


def split(p0, p1, p2, p3, t):
    """de Casteljau: return (left, right) control polygons."""
    def lerp(a, b):
        return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t)
    a, b, c = lerp(p0, p1), lerp(p1, p2), lerp(p2, p3)
    d, e = lerp(a, b), lerp(b, c)
    f = lerp(d, e)
    return (p0, a, d, f), (f, e, c, p3)


def pt(p):
    return f"{_fmt(p[0])} {_fmt(p[1])}"


# ------------------------------------------------------------------ palette
HAIR_LINE = "#4f7f70"
HAIR_SHADE = "#9ccbb8"
HAIR_DEEP = "#86b9a6"
HAIR_SHEEN = "#f6fffb"
HAIR_STRAND = "#8cbfac"
LASH = "#1f3d34"
BROW = "#46746a"
SKIN = "#fde8dc"
SKIN_SH = "#f6cfc2"
SKIN_DEEP = "#eab3a6"
SKIN_LINE = "#b9705f"
CREASE = "#c98a7a"
MOUTH_LINE = "#9a4842"
COAT = "#1f5a43"
COAT_SH = "#153f30"
COAT_DEEP = "#0f3226"
COAT_LINE = "#0b2a1f"
COAT_LIT = "#3a8466"
ERI = "#143a2c"
DRESS_LINE = "#3e424a"
DRESS_SH = "#6f747e"
CHEST = "#8a5a32"

# ------------------------------------------------------------------ defs
DEFS = """
<linearGradient id="ne-hair" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="560">
  <stop offset="0" stop-color="#e6faf1"/><stop offset=".35" stop-color="#d6f2e6"/><stop offset="1" stop-color="#bfe6d6"/>
</linearGradient>
<linearGradient id="ne-hairLong" gradientUnits="userSpaceOnUse" x1="0" y1="150" x2="0" y2="1040">
  <stop offset="0" stop-color="#c9ecdd"/><stop offset=".5" stop-color="#bae3d2"/><stop offset="1" stop-color="#a9dac7"/>
</linearGradient>
<linearGradient id="ne-hairBack" gradientUnits="userSpaceOnUse" x1="0" y1="150" x2="0" y2="1040">
  <stop offset="0" stop-color="#bfe3d6"/><stop offset=".6" stop-color="#b2dccd"/><stop offset="1" stop-color="#a6d3c3"/>
</linearGradient>
<linearGradient id="ne-sclera" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#d3e3e6"/><stop offset=".45" stop-color="#ffffff"/>
</linearGradient>
<linearGradient id="ne-iris" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#1d4a37"/><stop offset=".28" stop-color="#2f6e52"/><stop offset=".62" stop-color="#5fb088"/>
  <stop offset=".85" stop-color="#9fdcb6"/><stop offset="1" stop-color="#d2f4dc"/>
</linearGradient>
<radialGradient id="ne-irisGlow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#eafff1" stop-opacity=".95"/><stop offset=".6" stop-color="#c6f5d6" stop-opacity=".5"/><stop offset="1" stop-color="#c6f5d6" stop-opacity="0"/>
</radialGradient>
<radialGradient id="ne-blush" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff8fa3" stop-opacity=".42"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<radialGradient id="ne-blush2" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff6f8c" stop-opacity=".8"/><stop offset=".6" stop-color="#ff7f96" stop-opacity=".4"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<linearGradient id="ne-sweat" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#e6f8ff" stop-opacity=".85"/><stop offset="1" stop-color="#a9dcff" stop-opacity=".95"/>
</linearGradient>
<linearGradient id="ne-rainbow" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="ne-coat" gradientUnits="userSpaceOnUse" x1="0" y1="340" x2="0" y2="1040">
  <stop offset="0" stop-color="#2a6c51"/><stop offset=".4" stop-color="#1f5a43"/><stop offset="1" stop-color="#1b4f3b"/>
</linearGradient>
<linearGradient id="ne-sleeve" gradientUnits="userSpaceOnUse" x1="0" y1="380" x2="0" y2="800">
  <stop offset="0" stop-color="#2b6e53"/><stop offset=".5" stop-color="#215d46"/><stop offset="1" stop-color="#1c513d"/>
</linearGradient>
<linearGradient id="ne-lining" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#bff0d8"/><stop offset=".55" stop-color="#7fcfab"/><stop offset="1" stop-color="#4f9e7f"/>
</linearGradient>
<linearGradient id="ne-dress" gradientUnits="userSpaceOnUse" x1="0" y1="360" x2="0" y2="1040">
  <stop offset="0" stop-color="#a1a7b1"/><stop offset=".35" stop-color="#8d929b"/><stop offset="1" stop-color="#848993"/>
</linearGradient>
<linearGradient id="ne-collar" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e7ee"/>
</linearGradient>
<radialGradient id="ne-mirror" cx=".38" cy=".34" r=".75">
  <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e8f0f4"/><stop offset="1" stop-color="#a9bcc6"/>
</radialGradient>
<linearGradient id="ne-bag" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#e2c08c"/><stop offset=".55" stop-color="#c9a06a"/><stop offset="1" stop-color="#b48a55"/>
</linearGradient>
<radialGradient id="ne-nut" cx=".36" cy=".3" r=".8">
  <stop offset="0" stop-color="#f6b86a"/><stop offset=".35" stop-color="#c46a24"/><stop offset="1" stop-color="#6e2c0c"/>
</radialGradient>
<linearGradient id="ne-ledger" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#4b7fae"/><stop offset=".5" stop-color="#36628c"/><stop offset="1" stop-color="#2b5076"/>
</linearGradient>
<linearGradient id="ne-pages" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e9dcc0"/>
</linearGradient>
<filter id="ne-b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="ne-b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="ne-b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="ne-b6" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
"""

def nw(d, lift=13):
    """Neck warp: raise the collar region (slouch: the coat rides up round the neck)."""
    return mapxy(d, lambda x, y: (x, y - lift * max(0.0, min(1.0, (450 - y) / 70))))


# ------------------------------------------------------------------ long back hair (canvas)
BACK_HAIR = ("M286 170 C262 210 244 262 236 318 C228 372 214 420 204 476 "
             "C196 520 200 560 192 600 C184 640 172 664 176 704 "
             "C180 744 168 790 162 840 C156 890 160 930 150 970 "
             "C146 990 140 1004 132 1012 C146 1008 156 998 162 986 "
             "C164 1004 160 1024 154 1040 L604 1040 "
             "C600 1022 598 1004 600 988 C606 1000 616 1010 630 1014 "
             "C620 1000 612 980 608 960 C600 920 604 880 598 840 "
             "C592 800 584 760 586 720 C588 690 596 670 590 640 "
             "C584 600 570 560 566 520 C562 490 558 480 556 470 "
             "C548 420 532 372 524 318 C516 262 498 210 474 170 Z")
BACK_STRAYS = ["M194 612 C180 630 172 652 174 676", "M178 720 C166 738 160 760 162 784",
               "M592 650 C606 668 612 690 608 712", "M600 800 C612 820 616 842 612 866"]
BACK_HAIR_SHADE = ("M300 300 C290 360 280 420 268 480 L330 480 C334 420 340 370 352 330 Z "
                   "M460 300 C470 360 480 420 492 480 L430 480 C426 420 420 370 408 330 Z")


def back_hair():
    s = "".join(P(d, stroke=HAIR_LINE, sw=1.5, op=.75) for d in BACK_STRAYS)
    s += P(BACK_HAIR, fill="url(#ne-hairBack)", stroke=HAIR_LINE, sw=2.6)
    s += '<clipPath id="ne-bhClip"><path d="' + BACK_HAIR + '"/></clipPath><g clip-path="url(#ne-bhClip)">'
    # the inner (behind the neck) part sits deep in shadow
    s += P("M300 260 C330 300 350 330 360 380 L400 380 C410 330 430 300 460 260 L460 520 L300 520 Z", fill=HAIR_SHADE, op=.8)
    # outer fan: lighter strands catching the light on the lit (left) side
    s += P("M240 330 C226 420 210 520 204 620 C200 700 194 800 186 900 L206 900 C214 800 220 700 224 620 "
           "C230 520 242 420 256 330 Z", fill="#d8f3e8", op=.8)
    for d in ("M232 360 C216 460 204 580 196 700 C190 800 182 900 170 980",
              "M252 380 C240 480 228 600 222 720 C218 820 210 920 196 1020",
              "M528 360 C544 460 556 580 564 700 C570 800 578 900 590 980",
              "M510 380 C522 480 534 600 540 720 C544 820 552 920 566 1020",
              "M548 420 C562 520 572 640 578 760 C582 840 588 900 598 950"):
        s += P(d, stroke=HAIR_LINE, sw=1.5, op=.45)
    for d in ("M214 520 C208 600 204 680 200 760", "M560 560 C566 640 570 720 572 800"):
        s += P(d, stroke="#ffffff", sw=1.4, op=.55)
    s += "</g>"
    return s


# ------------------------------------------------------------------ neck, dress
NECK = "M361 270 L360 350 C359 360 353 368 345 374 L415 374 C407 368 401 360 400 350 L399 270 Z"
DRESS = nw("M330 366 C302 372 284 384 272 402 C264 418 262 440 260 470 L256 1040 L504 1040 "
         "L500 470 C498 440 496 418 488 402 C476 384 458 372 430 366 Z")
COLLAR_L = nw("M381 382 C366 380 348 375 332 368 C324 384 326 404 340 413 C354 421 370 412 381 396 Z")
COLLAR_R = nw(shift(mir("M381 382 C366 380 348 375 332 368 C324 384 326 404 340 413 C354 421 370 412 381 396 Z"), 0, 13))


def neck_and_dress():
    s = P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += P("M361 276 C370 304 390 304 399 276 L400 312 C390 326 370 326 360 312 Z", fill=SKIN_SH)
    s += P("M390 306 C396 324 399 340 400 352 L400 296 Z", fill=SKIN_SH, op=.7)
    s += P(DRESS, fill="url(#ne-dress)", stroke=DRESS_LINE, sw=2.6)
    s += '<clipPath id="ne-dressClip"><path d="' + DRESS + '"/></clipPath><g clip-path="url(#ne-dressClip)">'
    # light from the upper left: right half in the shadow tone
    s += P("M392 410 C398 470 404 540 408 600 L410 1040 L520 1040 L520 400 Z", fill=DRESS_SH, op=.55)
    # waist seam and the skirt's pleats
    s += P("M256 598 C320 606 440 606 504 598", stroke=DRESS_LINE, sw=1.8, op=.7)
    s += P("M256 604 C320 612 440 612 504 604", stroke="#b4b9c2", sw=1.2, op=.6)
    for x0, x1 in ((352, 344), (372, 368), (394, 396), (416, 424)):
        s += P(f"M{x0} 610 C{x0} 760 {x1} 900 {x1} 1040", stroke=DRESS_LINE, sw=1.5, op=.5)
        s += P(f"M{x0+3} 614 C{x0+3} 760 {x1+3} 900 {x1+3} 1040", stroke="#b4b9c2", sw=1.1, op=.45)
    # the placket, buttoned one hole off: the right panel hangs low, so the
    # fabric pulls in diagonal drag lines between the buttons
    s += P(nw("M380 400 C381 470 383 540 384 600"), stroke=DRESS_LINE, sw=1.6, op=.75)
    s += P("M389 410 C390 480 392 550 393 606", stroke=DRESS_LINE, sw=1.2, op=.45)
    for y0 in (430, 470, 510, 550):
        s += P(f"M386 {y0+6} C394 {y0+14} 402 {y0+22} 410 {y0+26}", stroke=DRESS_LINE, sw=1.3, op=.4)
        s += P(f"M370 {y0+2} C364 {y0+10} 358 {y0+16} 350 {y0+20}", stroke=DRESS_LINE, sw=1.2, op=.3)
    # buttons (chestnut) and the empty buttonhole at the top
    for (x, y) in ((381, 436), (382, 476), (383, 516), (384, 556), (385, 594)):
        s += f'<circle cx="{x}" cy="{y}" r="5.2" fill="{CHEST}" stroke="#4a2c14" stroke-width="1.3"/>'
        s += f'<circle cx="{x-1.6}" cy="{y-1.8}" r="1.6" fill="#e6b88a"/>'
    s += P("M386 418 L394 420", stroke=DRESS_LINE, sw=2, op=.8)
    s += "</g>"
    # round school collar, lopsided because of the wrong buttoning
    for d in (COLLAR_R, COLLAR_L):
        s += P(d, fill="url(#ne-collar)", stroke=DRESS_LINE, sw=2)
    s += P(nw("M340 382 C346 396 356 404 368 404"), stroke="#c9cfd8", sw=3, op=.8)
    s += P(nw(shift(mir("M340 382 C346 396 356 404 368 404"), 0, 13)), stroke="#c9cfd8", sw=3, op=.8)
    s += P(nw("M336 378 C334 390 338 402 348 408"), stroke="#7fcfab", sw=1.6, op=.9)
    s += P(nw(shift(mir("M336 378 C334 390 338 402 348 408"), 0, 13)), stroke="#7fcfab", sw=1.6, op=.9)
    return s


# ------------------------------------------------------------------ coat
BACK_ERI = nw("M334 340 C354 330 406 330 426 340 L440 372 L320 372 Z")
PANEL_L = nw("M356 344 C332 348 302 356 278 370 C254 384 240 402 234 424 C228 450 226 490 224 540 "
           "L216 1040 L334 1040 C336 900 338 760 340 640 C342 560 344 490 346 440 "
           "C348 404 352 380 364 360 Z")
# front edge of the left panel (the eri band runs along it)
FRONT_L = "M334 1040 C336 900 338 760 340 640 C342 560 344 490 346 440 C348 404 352 380 364 360"
ERI_L = nw("M334 1040 C336 900 338 760 340 640 C342 560 344 490 346 440 C348 404 352 380 364 360 "
         "C366 352 362 344 356 344 L340 346 C330 368 324 400 322 440 C320 490 318 560 316 640 "
         "C314 760 312 900 310 1040 Z")
PANEL_R = mir(PANEL_L)
ERI_R = mir(ERI_L)


def mirror_crest(x, y, r=12):
    """Kagami: a round bronze-mirror crest in silver, a ring, a knob and a glint."""
    s = f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#e8f0f4" stroke-width="2.4"/>'
    s += f'<circle cx="{x}" cy="{y}" r="{_fmt(r-4.2)}" fill="url(#ne-mirror)" stroke="#9fb3bd" stroke-width="1"/>'
    s += P(f"M{_fmt(x-4)} {_fmt(y+2)} L{_fmt(x+2)} {_fmt(y-4)}", stroke="#ffffff", sw=1.8, op=.95)
    s += P(f"M{_fmt(x-1)} {_fmt(y+4)} L{_fmt(x+3)} {_fmt(y)}", stroke="#9fe8c4", sw=1.1, op=.9)
    s += sparkle(x + r*.7, y - r*.7, 3.2, op=.9)
    return s


def coat():
    s = P(BACK_ERI, fill=ERI, stroke=COAT_LINE, sw=2.4)
    s += P(nw("M340 346 C356 338 404 338 420 346 L424 362 C404 354 356 354 336 362 Z"), fill="url(#ne-lining)", op=.85)
    for side, d, eri in (("L", PANEL_L, ERI_L), ("R", PANEL_R, ERI_R)):
        m = (lambda x: x) if side == "L" else mir
        s += P(d, fill="url(#ne-coat)", stroke=COAT_LINE, sw=2.6)
        cid = f"ne-panel{side}"
        s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath><g clip-path="url(#{cid})">'
        if side == "R":
            s += P("M420 360 C450 380 470 420 480 480 L500 1040 L560 1040 L560 360 Z", fill=COAT_SH, op=.7)
        else:
            s += P("M318 420 C312 520 306 700 302 1040 L336 1040 L346 420 Z", fill=COAT_SH, op=.55)
        # long fold lines down the front
        for f in ("M300 600 C296 760 292 900 288 1040", "M270 640 C262 780 256 900 252 1040"):
            s += P(m(f), stroke=COAT_LINE, sw=1.6, op=.55)
        s += P(m("M306 640 C302 780 298 900 296 1040"), stroke=COAT_LIT, sw=1.4, op=.5)
        s += "</g>"
        s += P(eri, fill=ERI, stroke=COAT_LINE, sw=2)
        # mint lining showing as a thin piping along the open front edge
        s += P(m(nw("M335 1040 C337 900 339 760 341 640 C343 560 345 490 347 440 C349 404 353 380 365 360")),
               stroke="#8fd9b8", sw=2.2, op=.85)
        s += P(m(nw("M330 1040 C332 900 334 760 335 640 C336 560 338 490 340 440 C342 410 346 386 356 364")),
               stroke=COAT_LIT, sw=1.6, op=.55)
    s += P(nw("M240 420 C250 400 266 386 290 374 C310 364 330 356 350 350"), stroke="#4fa07e", sw=2.2, op=.7)
    s += mirror_crest(309, 420, 10)
    s += mirror_crest(451, 420, 10)
    return s


def himo():
    """Haori tie: two short mint cords knotted lopsidedly, tassels dangling."""
    s = ""
    cordL = "M340 520 C352 524 364 528 374 530"
    cordR = "M420 514 C410 520 400 526 390 530"
    for d in (cordL, cordR):
        s += P(d, stroke=HAIR_LINE, sw=5) + P(d, stroke="#e6f6ee", sw=3)
    s += f'<ellipse cx="382" cy="532" rx="9" ry="7" fill="#d9f4e6" stroke="{HAIR_LINE}" stroke-width="1.6"/>'
    s += P("M377 529 C381 527 386 528 388 531", stroke="#ffffff", sw=1.5, op=.9)
    for d in ("M378 538 C374 552 372 566 374 580", "M386 538 C392 548 396 558 396 570"):
        s += P(d, stroke=HAIR_LINE, sw=4.6) + P(d, stroke="#e6f6ee", sw=2.6)
    for (x, y, rot) in ((374, 586, 4), (396, 576, -10)):
        tas = "M-5 -6 L5 -6 L6 10 C3 13 -3 13 -6 10 Z"
        s += g(P(tas, fill="#bfe6d6", stroke=HAIR_LINE, sw=1.3) + P("M-2 -3 L-2 9 M2 -3 L2 9", stroke=HAIR_LINE, sw=.9, op=.6),
               f"translate({x} {y}) rotate({rot})")
    return s


# ------------------------------------------------------------------ sleeves, ledger, chestnut bag
# Both forearms come forward (hands lost in the sleeves); each haori sleeve's
# big flap (furi) hangs below the forearm. Left (screen) mouth holds the chestnut
# bag at the waist; the right arm clamps the ledger against her side.
SLEEVE_L = ("M264 384 C242 392 228 410 222 436 C214 476 210 540 206 610 "
            "C202 680 200 740 204 772 C206 786 218 792 236 792 L280 792 C294 792 302 786 304 774 "
            "L306 706 C316 696 326 686 334 676 L348 668 C356 652 352 628 342 618 "
            "C328 616 314 612 304 600 C302 556 300 500 296 462 C292 426 282 398 264 384 Z")
SLEEVE_R = ("M496 380 C518 388 532 406 538 432 C546 472 550 540 554 610 "
            "C558 680 560 740 556 772 C554 786 542 792 524 792 L484 792 C470 792 462 786 460 774 "
            "L458 730 C448 722 438 714 428 708 L414 702 C406 688 408 664 418 654 "
            "C432 654 446 650 458 642 C462 598 464 540 466 490 C470 440 480 400 496 380 Z")
MOUTH_L = (342, 644, 12, 25, -14)    # cx, cy, rx, ry, rot
MOUTH_R = (416, 679, 11, 24, 12)


def mouth_ellipse(c, shrink=0):
    cx, cy, rx, ry, rot = c
    return f'cx="{cx}" cy="{cy}" rx="{rx-shrink}" ry="{ry-shrink}" transform="rotate({rot} {cx} {cy})"'


def sleeve(d, side):
    cid = f"ne-slv{side}"
    s = P(d, fill="url(#ne-sleeve)", stroke=COAT_LINE, sw=2.6)
    s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath><g clip-path="url(#{cid})">'
    if side == "L":
        # shadow under the forearm and down the inner side of the flap
        s += P("M200 700 C240 690 290 680 340 668 L360 800 L200 800 Z", fill=COAT_SH, op=.55)
        s += P("M282 700 C292 740 296 770 296 800 L320 800 L320 690 Z", fill=COAT_SH, op=.7)
        s += P("M300 470 C304 520 306 570 308 604 C320 612 332 616 344 618 L344 470 Z", fill=COAT_SH, op=.6)
        # hard-edged cel highlights where the upper-left light lands
        s += P("M206 470 C214 434 232 404 266 386 C276 384 282 388 278 394 C252 406 236 428 228 470 "
               "C222 520 220 600 218 700 C218 730 220 750 222 770 L206 770 Z", fill=COAT_LIT, op=.55)
        s += P("M222 440 C228 414 244 396 266 388", stroke="#6cc39c", sw=2.6, op=.85)
        s += P("M306 602 C318 612 330 616 342 618 C330 622 316 620 306 612 Z", fill=COAT_LIT, op=.7)
        folds = ("M244 470 C236 560 232 660 232 780", "M266 560 C262 640 260 700 262 784",
                 "M300 606 C290 600 280 590 272 576", "M318 616 C306 630 298 648 296 664",
                 "M326 672 C318 690 312 704 310 716", "M236 410 C248 422 258 440 264 462",
                 "M212 700 C230 712 254 716 280 712")
    else:
        s += P("M420 720 C470 724 520 730 560 736 L560 800 L420 800 Z", fill=COAT_SH, op=.55)
        s += P("M500 400 C530 470 542 600 548 800 L580 800 L580 380 Z", fill=COAT_SH, op=.8)
        s += P("M466 480 C464 560 462 610 460 640 C448 650 432 654 418 656 L418 480 Z", fill=COAT_SH, op=.45)
        s += P("M496 382 C484 396 474 420 470 460 C468 500 466 560 464 600 L472 600 C474 540 476 480 480 440 "
               "C484 412 490 394 500 384 Z", fill=COAT_LIT, op=.5)
        s += P("M420 656 C434 656 448 652 458 642 C452 652 438 660 422 662 Z", fill=COAT_LIT, op=.7)
        folds = ("M518 470 C526 560 530 660 530 780", "M494 600 C498 660 500 720 498 784",
                 "M460 644 C470 636 480 626 488 612", "M440 654 C452 668 458 684 460 698",
                 "M432 708 C440 726 446 740 448 752", "M524 410 C512 422 502 440 496 462",
                 "M550 700 C530 714 504 720 476 716")
    for f in folds:
        s += P(f, stroke=COAT_LINE, sw=1.6, op=.5)
    s += "</g>"
    mo = MOUTH_L if side == "L" else MOUTH_R
    s += f'<ellipse {mouth_ellipse(mo)} fill="url(#ne-lining)" stroke="{COAT_LINE}" stroke-width="2.2"/>'
    cx, cy, rx, ry, rot = mo
    s += (f'<ellipse cx="{cx + (2 if side == "L" else -2)}" cy="{cy+1}" rx="{rx-4.5}" ry="{ry-5}" '
          f'transform="rotate({rot} {cx} {cy})" fill="{COAT_DEEP}"/>')
    return s


def mouth_lip(c, side="L"):
    """Near lip of a sleeve mouth, redrawn over whatever sticks out of it."""
    cx, cy, rx, ry, rot = c
    # right half of the (vertical) ellipse rim, as a crescent
    d = (f"M{cx} {cy-ry} C{_fmt(cx+rx*1.35)} {cy-ry} {_fmt(cx+rx*1.35)} {cy+ry} {cx} {cy+ry} "
         f"C{_fmt(cx+rx*.62)} {_fmt(cy+ry*.8)} {_fmt(cx+rx*.62)} {_fmt(cy-ry*.8)} {cx} {cy-ry} Z")
    return g(P(d, fill="url(#ne-lining)", stroke=COAT_LINE, sw=2), f"rotate({rot} {cx} {cy})")


def chestnut_bag():
    """Paper bag of candied chestnuts poking out of the left sleeve's mouth."""
    s = ""
    body = "M-19 30 L-21 -42 C-17 -48 -9 -50 -3 -46 C3 -52 11 -52 16 -46 C20 -48 23 -46 23 -42 L21 30 Z"
    s += P(body, fill="url(#ne-bag)", stroke="#6b4a26", sw=2.2)
    s += P("M10 -42 L12 28", stroke="#a8804d", sw=1.4, op=.7)
    s += P("M-21 -40 L23 -40 L22 -30 L-21 -30 Z", fill="#b48a55", op=.45)
    s += P("M-15 -18 C-9 -14 -3 -16 1 -12", stroke="#a8804d", sw=1.2, op=.6)
    for (x, y, r) in ((-10, -50, 9), (6, -54, 10), (16, -44, 7.5), (-2, -42, 7)):
        s += f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{_fmt(r*.86)}" fill="url(#ne-nut)" stroke="#4a1e08" stroke-width="1.3"/>'
        s += (f'<ellipse cx="{_fmt(x-r*.35)}" cy="{_fmt(y-r*.38)}" rx="{_fmt(r*.32)}" ry="{_fmt(r*.2)}" fill="#fff" '
              f'opacity=".9" transform="rotate(-30 {_fmt(x-r*.35)} {_fmt(y-r*.38)})"/>')
        s += P(f"M{_fmt(x-r*.6)} {_fmt(y+r*.45)} C{_fmt(x-r*.2)} {_fmt(y+r*.7)} {_fmt(x+r*.3)} {_fmt(y+r*.7)} {_fmt(x+r*.6)} {_fmt(y+r*.4)}",
               stroke="#f6c27a", sw=1, op=.6)
    s += P("M-21 -40 C-15 -36 -7 -38 -1 -34 C7 -38 15 -36 23 -40 L22 -30 L-21 -30 Z", fill="url(#ne-bag)", stroke="#6b4a26", sw=1.8)
    s += P("M-17 -35 C-11 -32 -5 -34 -1 -31", stroke="#f2dcb2", sw=1.4, op=.9)
    s += sparkle(-4, -60, 4.5)
    return g(s, "translate(352 640) rotate(24)")


LEDGER_COVER = "M404 470 L470 462 L476 700 L410 708 Z"
LEDGER_PAGES = "M396 476 L404 470 L410 708 L402 712 Z"


def ledger():
    """Account book bound in blue cloth, clamped under the right arm."""
    s = ""
    for d, col in (("M416 472 L412 444 L424 443 L428 470 Z", "#fffaf0"), ("M438 469 L440 436 L450 437 L450 468 Z", "#ffe7b8"),
                   ("M456 466 L460 449 L468 450 L466 465 Z", "#d9f4e6")):
        s += P(d, fill=col, stroke="#8a7a5a", sw=1.3)
    s += P(LEDGER_PAGES, fill="url(#ne-pages)", stroke="#16304a", sw=1.8)
    for k in range(1, 6):
        y0 = 476 + k * 38
        s += P(f"M{_fmt(397 + k*1.3)} {y0} L{_fmt(405 + k*1.3)} {y0-4}", stroke="#c9b896", sw=1, op=.8)
    s += P(LEDGER_COVER, fill="url(#ne-ledger)", stroke="#16304a", sw=2.4)
    s += '<clipPath id="ne-ledgerClip"><path d="' + LEDGER_COVER + '"/></clipPath><g clip-path="url(#ne-ledgerClip)">'
    s += P("M404 470 L420 468 L428 706 L410 708 Z", fill="#26496c", op=.8)
    s += P("M424 472 L432 704", stroke="#16304a", sw=1.3, op=.6)
    s += P("M436 500 L466 497 L468 540 L438 543 Z", fill="#f7f2e4", stroke="#16304a", sw=1.3)
    for k in range(3):
        y = 510 + k * 10
        s += P(f"M442 {y} L462 {y-2}", stroke="#8a9ab0", sw=1.2, op=.8)
    s += P("M470 462 L456 464 L471 478 Z", fill=CHEST, stroke="#4a2c14", sw=1.2)
    s += P("M408 482 C420 480 440 476 470 472", stroke="#8fb6e0", sw=2, op=.6)
    s += "</g>"
    s += P("M405 474 L410 704", stroke="#ffffff", sw=1.2, op=.5)
    return s


def sleeves_and_props():
    s = ledger()
    s += sleeve(SLEEVE_L, "L") + sleeve(SLEEVE_R, "R")
    cx, cy, rx, ry, rot = MOUTH_L
    tf = f"rotate({rot} {cx} {cy})"
    s += (f'<clipPath id="ne-bagClip"><ellipse cx="{cx}" cy="{cy}" rx="{rx-2}" ry="{ry-2}" transform="{tf}"/>'
          f'<path transform="{tf}" d="M{cx+1} {cy-300} L{cx+300} {cy-300} L{cx+300} {cy+300} L{cx+1} {cy+300} Z"/></clipPath>')
    s += g(chestnut_bag(), extra='clip-path="url(#ne-bagClip)"')
    return s


# ------------------------------------------------------------------ head geometry (head-local, inside HEAD_TF)
FACE = ("M288 152 L287 202 C287 238 300 264 320 283 C338 300 360 312 380 313 "
        "C400 312 422 300 440 283 C460 264 473 238 473 202 L472 152 Z")
JAW_SHADOW = ("M473 200 C472 238 458 264 440 283 C422 300 402 310 382 312 "
              "C406 302 430 286 446 266 C458 248 464 226 466 200 Z")

BANG_START = (484, 232)
CLUMPS = [((476, 196), (467, 230), (454, 184)),
          ((454, 184), (438, 204), (426, 176)),
          ((426, 176), (413, 194), (403, 172)),
          ((403, 172), (386, 226), (371, 176)),
          ((371, 176), (352, 200), (340, 178)),
          ((340, 178), (321, 206), (307, 186)),
          ((307, 186), (291, 226), (284, 204))]
BANG_END = (276, 234)


def _bang_edge(dx=0, dy=0, soft=False):
    def q(p):
        return f"{_fmt(p[0]+dx)} {_fmt(p[1]+dy)}"
    out = f" C{q((483, 214))} {q((480, 202))} {q(CLUMPS[0][0])}"
    for nr, t, nl in CLUMPS:
        if soft:
            t = (t[0], t[1] - 6)
        k = 2.6
        c1 = (nr[0] - (nr[0] - t[0]) * .05, nr[1] + (t[1] - nr[1]) * .62)
        c2 = (t[0] + (nr[0] - t[0]) * .22 + k, t[1] - (t[1] - nr[1]) * .1)
        out += f" C{q(c1)} {q(c2)} {q(t)}"
        c1 = (t[0] - k * .8, t[1] - (t[1] - nl[1]) * .14)
        c2 = (nl[0] + (t[0] - nl[0]) * .05, nl[1] + (t[1] - nl[1]) * .6)
        out += f" C{q(c1)} {q(c2)} {q(nl)}"
    nl = CLUMPS[-1][2]
    out += f" C{q((nl[0]-3, nl[1]+12))} {q((BANG_END[0]+1, BANG_END[1]-14))} {q(BANG_END)}"
    return out


CROWN = ("M276 234 C258 184 262 136 290 112 C312 94 344 90 372 94 "
         "C400 88 440 94 464 112 C494 136 502 184 484 232" + _bang_edge() + " Z")
BANG_SHADOW = "M266 140 L494 140 L494 236 L485 236" + _bang_edge(3, 10, soft=True) + " L266 236 Z"

# side locks in canvas space (they hang straight down past the shoulders), converted into the head frame
LOCK_L_C = ("M300 150 C282 180 266 222 266 262 C266 300 276 330 274 364 C272 396 258 424 262 456 "
            "C264 476 270 492 266 512 C276 498 282 482 282 466 C288 482 290 500 286 520 "
            "C298 500 300 478 296 456 C292 430 294 404 298 380 C302 350 296 318 296 290 "
            "C296 250 300 210 316 176 Z")
LOCK_R_C = ("M462 150 C480 182 494 224 494 266 C494 304 486 336 488 370 C490 400 502 424 500 452 "
            "C498 470 492 486 496 504 C484 492 480 476 480 462 C474 476 472 490 474 504 "
            "C462 488 462 466 466 446 C470 420 466 398 462 376 C458 346 464 314 464 284 "
            "C464 244 460 206 446 176 Z")
COWLICK = ("M380 98 C372 80 374 62 388 52 C402 42 424 44 432 58 C436 66 432 74 426 76 "
           "C428 66 420 58 408 60 C396 62 390 74 392 88 L394 100 Z")
FLYAWAYS = ["M490 196 C504 200 512 210 514 224 C506 214 498 210 488 208 Z",
            "M272 168 C260 172 252 182 250 196 C258 186 266 182 276 182 Z"]
STRAYS = ["M282 128 C268 118 262 104 266 90", "M300 112 C296 100 298 88 306 80",
          "M470 116 C480 106 494 102 506 104", "M262 230 C250 236 244 248 246 262",
          "M496 176 C510 176 520 182 526 192"]


def lock_paths():
    return Hl(LOCK_L_C), Hl(LOCK_R_C)


def face_base():
    s = P(FACE, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += '<clipPath id="ne-faceClip"><path d="' + FACE + '"/></clipPath>'
    s += g(P(BANG_SHADOW, fill=SKIN_SH), extra='clip-path="url(#ne-faceClip)"')
    s += P(JAW_SHADOW, fill=SKIN_SH, op=.7)
    s += f'<ellipse cx="322" cy="{E+40}" rx="28" ry="10" fill="url(#ne-blush)"/>'
    s += f'<ellipse cx="438" cy="{E+40}" rx="28" ry="10" fill="url(#ne-blush)"/>'
    s += P(f"M383 {E+30} C382 {E+34} 380 {E+37} 378 {E+39}", stroke="#d3907f", sw=1.7)
    s += P(f"M385 {E+24} C386 {E+28} 386 {E+31} 385 {E+34}", stroke="#ffffff", sw=1.5, op=.8)
    return s


def crown():
    s = ""
    for d in FLYAWAYS:
        s += P(d, fill="url(#ne-hair)", stroke=HAIR_LINE, sw=1.8)
    for d in STRAYS:
        s += P(d, stroke=HAIR_LINE, sw=1.5, op=.8)
    s += P(CROWN, fill="url(#ne-hair)", stroke=HAIR_LINE, sw=2.4)
    for (n, t, _nl) in CLUMPS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{_fmt(x0 + (384-x0)*.2)} {y0-46} {_fmt(384 + (x0-384)*.35)} 104",
               stroke=HAIR_LINE, sw=1.4, op=.4)
        mx = (x0 + t[0]) / 2
        s += P(f"M{_fmt(mx+2)} {y0+4} C{_fmt(mx+1)} {y0+14} {_fmt((mx+t[0])/2)} {_fmt(t[1]-12)} {_fmt(t[0]+(mx-t[0])*.3)} {_fmt(t[1]-5)}",
               stroke=HAIR_STRAND, sw=1.4, op=.7)
    # shadow tone on the right side of the crown and under the cowlick parting
    s += P("M484 232 C502 184 494 136 464 112 C452 104 440 98 428 96 C470 120 488 170 474 206 Z", fill=HAIR_SHADE, op=.75)
    # messy angel ring
    s += P("M290 150 C310 128 344 118 380 117 C416 118 450 128 470 150 "
           "C462 146 456 152 448 150 C440 142 432 146 424 146 C414 138 404 142 396 142 "
           "C388 134 378 138 372 138 C362 134 352 142 344 142 C336 142 326 148 318 148 "
           "C310 146 302 154 296 152 C293 152 292 152 290 150 Z", fill=HAIR_SHEEN, op=.9)
    s += P("M306 134 C326 122 346 116 368 116", stroke="#ffffff", sw=1.8, op=.9)
    # a few stray strands crossing the bangs (it looks slept on)
    s += P("M404 112 C400 140 394 166 382 190", stroke=HAIR_LINE, sw=1.4, op=.55)
    s += P("M330 122 C318 150 300 172 282 186", stroke=HAIR_LINE, sw=1.4, op=.55)
    s += P("M440 116 C452 136 460 156 462 176", stroke=HAIR_LINE, sw=1.4, op=.5)
    return s


def cowlick():
    s = P(COWLICK, fill="url(#ne-hair)")
    s += P(COWLICK.split(" L394 100")[0], stroke=HAIR_LINE, sw=2.2)
    s += P("M386 90 C382 76 386 62 398 56", stroke="#ffffff", sw=1.6, op=.85)
    s += P("M392 96 C390 82 396 70 408 66", stroke=HAIR_STRAND, sw=1.2, op=.7)
    return s


def locks():
    l, r = lock_paths()
    s = ""
    for d in (l, r):
        s += P(d, fill="url(#ne-hair)", stroke=HAIR_LINE, sw=2.4)
    for d in ("M286 200 C278 240 276 290 282 330", "M480 210 C486 250 486 300 480 340"):
        s += P(Hl(d), stroke=HAIR_SHEEN, sw=4, op=.9)
    for d in ("M290 230 C286 270 286 310 290 350 C292 390 280 420 278 470",
              "M470 230 C474 270 476 310 474 350 C472 390 484 420 486 470",
              "M280 380 C276 410 270 440 272 480", "M484 386 C490 414 494 440 492 470"):
        s += P(Hl(d), stroke=HAIR_LINE, sw=1.3, op=.5)
    return s


# ------------------------------------------------------------------ eyes
EYE_SHAPES = []


def reg(d, kind="fill"):
    if (d, kind) not in EYE_SHAPES:
        EYE_SHAPES.append((d, kind))
    return d


class Eye:
    """Parametric left eye (screen left). Upper lid: one cubic from the outer
    corner O to the inner corner I peaking at `top`; lower lid: cubic I -> O
    bottoming at `bot`."""

    def __init__(self, O, I, top, bot, peak=.42, th=7, lower_bias=.55):
        self.O, self.I = O, I
        y0 = (O[1] + I[1]) / 2
        c = (top - .25 * y0) / .75
        w = I[0] - O[0]
        self.U = (O, (O[0] + w * (peak - .22), c + (O[1] - I[1]) * .2), (O[0] + w * (peak + .3), c), I)
        cb = (bot - .25 * y0) / .75
        self.L = (I, (I[0] + 2, cb), (O[0] + w * (1 - lower_bias) * .5, cb), O)
        self.th = th

    def sclera(self):
        U, L = self.U, self.L
        return f"M{pt(U[0])} C{pt(U[1])} {pt(U[2])} {pt(U[3])} C{pt(L[1])} {pt(L[2])} {pt(L[3])} Z"

    def lash(self):
        U, th = self.U, self.th
        O, I = self.O, self.I
        tip = (I[0] - 1, I[1] - 2.6)
        wing = (O[0] - 9, O[1] - 2)
        return (f"M{pt(O)} C{pt(U[1])} {pt(U[2])} {pt(I)} "
                f"C{pt((I[0]+2.4, I[1]-.6))} {pt((I[0]+1.6, I[1]-2.6))} {pt(tip)} "
                f"C{pt((U[2][0], U[2][1]-th))} {pt((U[1][0], U[1][1]-th*1.1))} {pt(wing)} "
                f"C{pt((wing[0]-2, wing[1]+2))} {pt((O[0]-4, O[1]+3))} {pt(O)} Z")

    def flick(self):
        O = self.O
        x, y = O[0] - 6, O[1] - 1
        return (f"M{_fmt(x)} {_fmt(y)} C{_fmt(x-4)} {_fmt(y+1)} {_fmt(x-8)} {_fmt(y+4)} {_fmt(x-11)} {_fmt(y+8)} "
                f"C{_fmt(x-6)} {_fmt(y+6)} {_fmt(x-2)} {_fmt(y+5)} {_fmt(x+1)} {_fmt(y+5)} Z "
                f"M{_fmt(x+1)} {_fmt(y-4)} C{_fmt(x-3)} {_fmt(y-7)} {_fmt(x-7)} {_fmt(y-8)} {_fmt(x-11)} {_fmt(y-7)} "
                f"C{_fmt(x-7)} {_fmt(y-5)} {_fmt(x-3)} {_fmt(y-2)} {_fmt(x)} {_fmt(y+1)} Z")

    def lower(self):
        a, b = split(*self.L, .38)
        return f"M{pt(b[0])} C{pt(b[1])} {pt(b[2])} {pt(b[3])}"

    def crease(self, gap=11):
        U = self.U
        a, b = split(*U, .12)
        _, seg = a, b
        seg, _ = split(*seg, .84)
        sh = lambda p: (p[0], p[1] - self.th - gap)
        return f"M{pt(sh(seg[0]))} C{pt(sh(seg[1]))} {pt(sh(seg[2]))} {pt(sh(seg[3]))}"

    def lidshade(self, depth=9):
        """Heavy-lid shadow just above the lash line: a lens tapering to both corners."""
        U, th = self.U, self.th
        a, seg = split(*U, .04)
        seg, _ = split(*seg, .94)
        lo = lambda p: (p[0], p[1] - th * .7)
        up = lambda p: (p[0], p[1] - th * .7 - depth * 1.3)
        return (f"M{pt(lo(seg[0]))} C{pt(lo(seg[1]))} {pt(lo(seg[2]))} {pt(lo(seg[3]))} "
                f"C{pt(up(seg[2]))} {pt(up(seg[1]))} {pt(lo(seg[0]))} Z")


def iris(cx, cy, rx, ry, idx, pupil=(8, 11), small_pupil=False):
    cid = f"ne-ir{idx}"
    e = f'cx="{_fmt(cx)}" cy="{_fmt(cy)}" rx="{rx}" ry="{ry}"'
    s = f'<clipPath id="{cid}"><ellipse {e}/></clipPath>'
    s += f'<ellipse {e} fill="url(#ne-iris)"/>'
    c = ""
    # fine radial striations
    for k in range(12):
        a = math.radians(k * 30 + 15)
        x1, y1 = cx + math.cos(a) * rx * .42, cy + math.sin(a) * ry * .42
        x2, y2 = cx + math.cos(a) * rx * .9, cy + math.sin(a) * ry * .9
        c += P(f"M{_fmt(x1)} {_fmt(y1)} L{_fmt(x2)} {_fmt(y2)}", stroke="#bff0cf", sw=.9, op=.35)
    c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy+ry*.62)}" rx="{rx*.72:.1f}" ry="{ry*.3:.1f}" fill="url(#ne-irisGlow)"/>'
    pr = pupil
    c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy+1)}" rx="{pr[0]+3}" ry="{pr[1]+3}" fill="none" stroke="#8fd9ac" stroke-width="1.2" opacity=".5"/>'
    c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy+1)}" rx="{pr[0]}" ry="{pr[1]}" fill="#143528"/>'
    # lid shadow across the top third
    c += (f'<path d="M{_fmt(cx-rx-2)} {_fmt(cy-ry*.36)} C{_fmt(cx-8)} {_fmt(cy-ry*.14)} {_fmt(cx+8)} {_fmt(cy-ry*.14)} '
          f'{_fmt(cx+rx+2)} {_fmt(cy-ry*.36)} L{_fmt(cx+rx+2)} {_fmt(cy-ry-4)} L{_fmt(cx-rx-2)} {_fmt(cy-ry-4)} Z" fill="#0e2a20" opacity=".3"/>')
    s += g(c, extra=f'clip-path="url(#{cid})"')
    s += f'<ellipse {e} fill="none" stroke="#21483a" stroke-width="1.6"/>'
    return s


def eye_highlights(cx, cy, big=1.0, low=False):
    s = ""
    if low:   # half-lidded: the big catch-light sits just under the heavy lid
        s += (f'<ellipse cx="{_fmt(cx-7)}" cy="{_fmt(cy+5)}" rx="{6*big:.1f}" ry="{4.2*big:.1f}" fill="#fff" '
              f'transform="rotate(-12 {_fmt(cx-7)} {_fmt(cy+5)})"/>')
    else:
        s += (f'<ellipse cx="{_fmt(cx-8)}" cy="{_fmt(cy-11)}" rx="{7*big:.1f}" ry="{8.5*big:.1f}" fill="#fff" '
              f'transform="rotate(-18 {_fmt(cx-8)} {_fmt(cy-11)})"/>')
    s += f'<circle cx="{_fmt(cx+9)}" cy="{_fmt(cy+10)}" r="3.2" fill="#fff"/>'
    s += f'<circle cx="{_fmt(cx-8)}" cy="{_fmt(cy+13)}" r="1.6" fill="#fff" opacity=".9"/>'
    return s


def open_eye(eye, iris_dy=0, iris_r=(21, 25), pupil=(8, 11), gaze=0, big=1.0, low=False,
             crease=True, lidshade=0, wet=False, shake=False):
    scl, lash = eye.sclera(), eye.lash()
    flick, lower = eye.flick(), eye.lower()
    reg(scl)
    reg(lash)
    reg(flick)
    reg(lower, "stroke")
    s = ""
    for side in ("L", "R"):
        m = (lambda d: d) if side == "L" else mir
        base_cx = EXL if side == "L" else EXR
        gz = gaze if side == "L" else gaze
        cx, cy = base_cx + gz, E + iris_dy
        clip = f"ne-sc{side}"
        if lidshade:
            s += P(m(eye.lidshade(lidshade)), fill=SKIN_SH, op=.9)
        s += f'<clipPath id="{clip}"><path d="{m(scl)}"/></clipPath>'
        s += P(m(scl), fill="url(#ne-sclera)")
        inner = iris(cx, cy, iris_r[0], iris_r[1], side, pupil) + eye_highlights(cx, cy, big, low)
        s += g(inner, extra=f'clip-path="url(#{clip})"')
        s += g(P(m(shift(eye.sclera(), 0, -3)), stroke="#5c8f80", sw=5, op=.18, extra='filter="url(#ne-b1)"'),
               extra=f'clip-path="url(#{clip})"')
        s += P(m(lash), fill=LASH)
        s += P(m(flick), fill=LASH)
        s += P(m(lower), stroke="#3f6b5e", sw=1.7, op=.85)
        if crease:   # QA: clipped inside the blink patch so no crease stub shows during a blink
            s += g(P(m(eye.crease()), stroke=CREASE, sw=1.5, op=.75), extra='clip-path="url(#ne-creaseClip)"')
    return s


def brows(d):
    s = ""
    for dd in (d, mir(d)):
        s += P(dd, fill="none", stroke="#f6fffb", sw=3.2, op=.55)
        s += P(dd, fill=BROW)
    return s


def brow_shape(x0, y0, x1, y1, bulge=-4, th=3.2):
    """Tapered brow from inner end (x0, y0) to outer end (x1, y1); thickest at the inner third."""
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2 + bulge
    return (f"M{_fmt(x0)} {_fmt(y0)} C{_fmt(x0 + (mx-x0)*.6)} {_fmt(y0 + (my-y0)*.6 - th*.9)} "
            f"{_fmt(mx)} {_fmt(my - th)} {_fmt(x1)} {_fmt(y1)} "
            f"C{_fmt(mx)} {_fmt(my + .6)} {_fmt(x0 + (mx-x0)*.6)} {_fmt(y0 + (my-y0)*.6 + th*.5)} {_fmt(x0)} {_fmt(y0 + th*.8)} Z")


def blush_strong(y=E + 40):
    s = f'<ellipse cx="320" cy="{y}" rx="30" ry="11" fill="url(#ne-blush2)"/>'
    s += f'<ellipse cx="440" cy="{y}" rx="30" ry="11" fill="url(#ne-blush2)"/>'
    for x0 in (308, 318, 328, 428, 438, 448):
        s += P(f"M{x0} {y+8} L{x0+6} {y-1}", stroke="#ff5a7a", sw=1.6, op=.55)
        s += P(f"M{x0+2} {y+8} L{x0+7} {y+1}", stroke="#ffffff", sw=.9, op=.6)
    return s


def mouth_open(d, tongue=None, teeth_top=None, cid="ne-m"):
    s = P(d, fill="#8a2f3a", stroke="#6b2430", sw=1.8)
    inner = ""
    if tongue:
        inner += P(tongue, fill="#f08a96")
    if teeth_top:
        inner += P(teeth_top, fill="#ffffff")
    if inner:
        s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>' + g(inner, extra=f'clip-path="url(#{cid})"')
    return s


# ------------------------------------------------------------------ expressions
# Eye corners: outer (300, E-2), inner (366, E-6) — the outer corner a touch higher
# after the head tilt; every expression keeps the same corners.
O_ = (300, E - 3)
I_ = (366, E - 5)


def ex_sleepy():
    eye = Eye(O_, I_, top=E + 1, bot=E + 22, peak=.5, th=7.5)
    face = open_eye(eye, iris_dy=4, low=True, crease=True, lidshade=10)
    face += P("M368 289 C374 290.5 386 290.5 393 289", stroke=MOUTH_LINE, sw=2.1)
    face += P("M366 288.4 C367 289 367.5 289.3 368 289.6", stroke=MOUTH_LINE, sw=1.6, op=.7)
    brow = brows(brow_shape(360, 182, 306, 186, bulge=-3))
    return face, brow, ""


def ex_smirk():
    eye = Eye(O_, I_, top=E - 9, bot=E + 23, peak=.48, th=7.5)
    face = open_eye(eye, iris_dy=3, gaze=-3, low=True, lidshade=8)
    face += P("M364 291 C372 292.6 384 291.5 392 287 C396 285 398 282 400 278", stroke=MOUTH_LINE, sw=2.1)
    face += P("M399 283 C401 284 403 284 405 283", stroke=MOUTH_LINE, sw=1.4, op=.6)
    face += P("M363 290.4 C363.5 291 364 291.5 364.6 291.8", stroke=MOUTH_LINE, sw=1.6, op=.7)
    # one brow (her left, screen right) cocked up
    b = brow_shape(360, 182, 306, 185, bulge=-3)
    s = P(b, fill="none", stroke="#f6fffb", sw=3.2, op=.55) + P(b, fill=BROW)
    br = mir(brow_shape(362, 180, 308, 172, bulge=-6))
    s += P(br, fill="none", stroke="#f6fffb", sw=3.2, op=.55) + P(br, fill=BROW)
    return face, s, ""


def ex_surprised():
    eye = Eye(O_, I_, top=E - 28, bot=E + 27, peak=.42, th=6.5)
    face = open_eye(eye, iris_dy=1, iris_r=(17, 21), pupil=(5, 7), big=.85)
    face += '<ellipse cx="381" cy="292" rx="6.5" ry="8" fill="#8a2f3a" stroke="#6b2430" stroke-width="1.8"/>'
    face += '<ellipse cx="381" cy="296" rx="4" ry="2.6" fill="#f08a96"/>'
    brow = brows(brow_shape(360, 168, 304, 166, bulge=-8))
    extras = (both("M262 160 L248 152", stroke=HAIR_LINE, sw=2.4) + both("M256 178 L240 176", stroke=HAIR_LINE, sw=2.4)
              + both("M272 144 L264 131", stroke=HAIR_LINE, sw=2.4))
    return face, brow, extras


def ex_serious():
    eye = Eye(O_, I_, top=E - 17, bot=E + 24, peak=.55, th=7.5)
    face = open_eye(eye, iris_dy=3, lidshade=5)
    face += P("M368 290 C374 290 386 290 393 290", stroke=MOUTH_LINE, sw=2.2)
    face += P("M373 297 C377 298 383 298 387 297", stroke=CREASE, sw=1.2, op=.55)
    brow = brows(brow_shape(362, 185, 304, 178, bulge=-1, th=3.8))
    return face, brow, ""


def ex_sad():
    eye = Eye((300, E - 1), (366, E - 7), top=E - 10, bot=E + 24, peak=.62, th=7)
    face = open_eye(eye, iris_dy=8, gaze=2, low=True, lidshade=6)
    face += P("M370 293 C375 290.5 386 290.5 391 293", stroke=MOUTH_LINE, sw=2.1)
    face += P("M372 299 C377 300.5 384 300.5 389 299", stroke=CREASE, sw=1.2, op=.55)
    brow = brows("M304 184 C318 182 334 176 350 164 C353 162 356 165 353 167 C338 180 322 188 306 188 C303 188 302 185 304 184 Z")
    return face, brow, ""


def ex_panic():
    eye = Eye(O_, I_, top=E - 28, bot=E + 28, peak=.42, th=6.5)
    face = open_eye(eye, iris_dy=2, iris_r=(14, 18), pupil=(3.4, 4.6), big=.7)
    mouth = ("M360 292 C363 286 367 285 371 289 C375 293 379 293 383 289 C387 285 392 285 396 290 "
             "C396 300 388 305 378 305 C368 305 360 300 360 292 Z")
    face += mouth_open(mouth, tongue="M364 302 C370 296 388 296 394 302 L394 310 L364 310 Z", cid="ne-mP")
    brow = brows("M304 176 C314 170 322 172 330 170 C338 168 346 166 354 160 C357 158 359 162 356 164 "
                 "C348 171 340 174 331 176 C322 178 314 177 305 181 C302 182 301 178 304 176 Z")
    # sweat bead on the temple, clear like the glass
    drop = "M0 -16 C3 -9 9 -2 9 5 C9 11 4 15 0 15 C-4 15 -9 11 -9 5 C-9 -2 -3 -9 0 -16 Z"
    sw = P(drop, fill="url(#ne-sweat)", stroke="#6fbfe6", sw=1.4)
    sw += P("M-4 2 C-5 6 -4 9 -1 11", stroke="#ffffff", sw=1.8)
    sw += P("M5 4 C6 8 4 11 2 12", stroke="url(#ne-rainbow)", sw=1.2, op=.9)
    sw += '<circle cx="-3" cy="-3" r="1.6" fill="#fff"/>'
    extras = g(sw, "translate(478 196) rotate(8)")
    extras += (both("M258 168 C252 164 248 160 244 154", stroke=HAIR_LINE, sw=2.2) + both("M252 186 C246 186 240 184 234 182", stroke=HAIR_LINE, sw=2.2))
    # hair standing on end: frizzed strands rising from the crown
    frizz = ""
    for (x, y, ang, ln, w) in ((296, 116, -142, 34, 8), (318, 102, -120, 40, 9), (344, 94, -104, 30, 7),
                               (432, 96, -70, 36, 8), (458, 106, -50, 42, 9), (478, 124, -30, 30, 7),
                               (280, 140, -164, 28, 7), (490, 150, -12, 26, 6)):
        frizz += wavy_strand(x, y, ang, ln, w)
    extras = frizz + extras
    return face, brow, extras


def wavy_strand(x, y, ang, ln, w):
    """A tapered, kinked lock of hair standing up from (x, y)."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    def p(t, off):
        wob = math.sin(t * math.pi * 1.6) * 5
        return (x + ux * ln * t + nx * (off + wob), y + uy * ln * t + ny * (off + wob))
    a0, a1, a2 = p(0, -w / 2), p(.4, -w * .36), p(.75, -w * .18)
    tip = p(1.05, 0)
    b2, b1, b0 = p(.75, w * .18), p(.4, w * .36), p(0, w / 2)
    d = (f"M{pt(a0)} Q{pt(a1)} {pt(p(.55, -w*.28))} T{pt(tip)} "
         f"Q{pt(b2)} {pt(p(.55, w*.28))} T{pt(b0)} Z")
    return P(d, fill="url(#ne-hair)", stroke=HAIR_LINE, sw=1.8)


EXPRESSIONS = {"sleepy": ex_sleepy, "smirk": ex_smirk, "surprised": ex_surprised,
               "serious": ex_serious, "sad": ex_sad, "panic": ex_panic}

# ------------------------------------------------------------------ blink overlay
CLOSED_EYE = Eye(O_, I_, top=E + 9, bot=E + 22, peak=.5, th=6)


def closed_shapes():
    O, I = O_, I_
    # sagging lash curve (◡), 5–6 px thick
    lash = (f"M{_fmt(O[0]-2)} {_fmt(O[1]+3)} C{_fmt(O[0]+12)} {_fmt(E+16)} {_fmt(I[0]-20)} {_fmt(E+17)} {_fmt(I[0]+1)} {_fmt(I[1]+6)} "
            f"C{_fmt(I[0]+2)} {_fmt(I[1]+8)} {_fmt(I[0])} {_fmt(I[1]+9)} {_fmt(I[0]-2)} {_fmt(I[1]+9)} "
            f"C{_fmt(I[0]-20)} {_fmt(E+23)} {_fmt(O[0]+12)} {_fmt(E+23)} {_fmt(O[0]-1)} {_fmt(O[1]+9)} Z")
    x, y = O[0] - 2, O[1] + 5
    flick = (f"M{_fmt(x)} {_fmt(y-2)} C{_fmt(x-4)} {_fmt(y-2)} {_fmt(x-8)} {_fmt(y-4)} {_fmt(x-11)} {_fmt(y-7)} "
             f"C{_fmt(x-7)} {_fmt(y)} {_fmt(x-3)} {_fmt(y+2)} {_fmt(x+1)} {_fmt(y+3)} Z "
             f"M{_fmt(x+2)} {_fmt(y+4)} C{_fmt(x-1)} {_fmt(y+8)} {_fmt(x-4)} {_fmt(y+11)} {_fmt(x-6)} {_fmt(y+14)} "
             f"C{_fmt(x-1)} {_fmt(y+11)} {_fmt(x+3)} {_fmt(y+9)} {_fmt(x+5)} {_fmt(y+7)} Z")
    lower = f"M{_fmt(O[0]+10)} {_fmt(E+22)} C{_fmt(O[0]+16)} {_fmt(E+25)} {_fmt(O[0]+26)} {_fmt(E+26)} {_fmt(O[0]+34)} {_fmt(E+25)}"
    crease = f"M{_fmt(O[0]+6)} {_fmt(E+2)} C{_fmt(O[0]+20)} {_fmt(E+8)} {_fmt(I[0]-22)} {_fmt(E+8)} {_fmt(I[0]-6)} {_fmt(E+3)}"
    return lash, flick, lower, crease


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


def blink_patch_pts(grow=None):
    grow = BLINK_GROW if grow is None else grow
    lash, flick, lower, crease = closed_shapes()
    pts = []
    for d, kind in EYE_SHAPES + [(lash, "fill"), (flick, "fill"), (lower, "stroke")]:
        sp = sample_path(d)
        if kind == "stroke":
            sp = [(x + dx, y + dy) for x, y in sp for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))]
        pts += sp
    return offset_hull(hull(pts), grow)


def blink_clip():
    d = poly_d(blink_patch_pts())
    d2 = poly_d(blink_patch_pts(BLINK_GROW + 2))
    return (f'<clipPath id="ne-blinkClip"><path d="{d}"/><path d="{mir(d)}"/></clipPath>'
            f'<clipPath id="ne-blinkHairClip"><path d="{d2}"/><path d="{mir(d2)}"/></clipPath>')


def blink_layer():
    s = blink_clip()
    lash, flick, lower, crease = closed_shapes()
    lids = face_base()
    lids += both(crease, stroke=CREASE, sw=1.4, op=.55)
    lids += both(lash, fill=LASH) + both(flick, fill=LASH)
    lids += both(lower, stroke=CREASE, sw=1.3, op=.6)
    hair = locks() + crown()
    s += g(g(lids, extra='clip-path="url(#ne-blinkClip)"') + g(hair, extra='clip-path="url(#ne-blinkHairClip)"'), HEAD_TF)
    return s


# ------------------------------------------------------------------ assemble
def header():
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
            f"<defs>{DEFS}</defs>\n")


def body_layers():
    s = "<!-- long hair (behind) -->" + back_hair()
    s += "<!-- neck and dress -->" + neck_and_dress()
    s += "<!-- council coat -->" + coat() + himo()
    s += "<!-- sleeves, ledger, chestnuts -->" + sleeves_and_props()
    return s


def head_front():
    return locks() + crown() + cowlick()


def sprite(name):
    face, brow, extras = EXPRESSIONS[name]()
    s = header()
    s += body_layers()
    s += f'<g transform="{HEAD_TF}">'
    cd = poly_d(blink_patch_pts(BLINK_GROW - 2))
    s += f'<defs><clipPath id="ne-creaseClip"><path d="{cd}"/><path d="{mir(cd)}"/></clipPath></defs>'
    s += face_base()
    s += f"<!-- face: {name} -->" + face + "<!-- /face -->"
    s += head_front()
    s += brow + extras
    s += "</g>\n</svg>\n"
    return s


def blink():
    return header() + blink_layer() + "\n</svg>\n"


def check_clearance():
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
    for name, fn in EXPRESSIONS.items():
        face, brow, extras = fn()
        ds = re.findall(r'<path d="([^"]+)"', brow)
        worst = min(dist(p if p[0] < 380 else (760 - p[0], p[1]), patch) for d in ds for p in sample_path(d))
        print(f"{name:10s} brow clearance {worst - 1.6:6.1f}px (incl. halo, vs hair clip)")
    ys = [y for x, y in patch]; xs = [x for x, y in patch]
    print("patch bbox", round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("names", nargs="*", help="expressions to write (default: all of them plus blink)")
    ap.add_argument("--out", default=OUT_ROOT, metavar="DIR",
                    help="output root; files go to DIR/chars/nemu/ (default: %(default)s)")
    opt = ap.parse_args()
    outdir = os.path.join(opt.out, "chars", "nemu")
    args = opt.names
    targets = args or list(EXPRESSIONS) + ["blink"]
    for fn in EXPRESSIONS.values():   # register every expression's eye shapes before any patch is used
        fn()
    out = {n: sprite(n) for n in EXPRESSIONS}
    out["blink"] = blink()
    for n in targets:
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, f"{n}.svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(out[n])
        print(n, len(out[n]))
    check_clearance()
