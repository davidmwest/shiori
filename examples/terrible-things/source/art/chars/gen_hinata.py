#!/usr/bin/env python3
"""Hinata Asahi (the baker) sprite generator.

Shared body/hair layers are emitted byte-identically into every expression file;
only the face group differs. blink.svg redraws the skin + front hair clipped to a
patch made from the convex hull of every expression's eye shapes, then draws
closed lids (clipPaths, not masks: see STYLE.md section 7).

usage: gen_hinata.py [--out DIR] [--check] [name ...]
  writes DIR/chars/hinata/<name>.svg (default DIR: $TMPDIR/terrible-things-art);
  install by copying those files over the game's chars/hinata/.
"""
import argparse, math, os, re, sys, tempfile

OUT_ROOT = os.path.join(tempfile.gettempdir(), "terrible-things-art")

W, H = 760, 1040
HEAD_TF = "rotate(-3 380 262)"
E = 182          # eye line (head-local); skull top 62, chin 262
EXL, EXR = 334, 426

# ------------------------------------------------------------------ helpers
NUM = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?")


def _fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def fp(p):
    return f"{_fmt(p[0])} {_fmt(p[1])}"


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


def bez(c, t):
    p0, p1, p2, p3 = c
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])


def bez_d(c, t):
    p0, p1, p2, p3 = c
    u = 1 - t
    return (3*u*u*(p1[0]-p0[0]) + 6*u*t*(p2[0]-p1[0]) + 3*t*t*(p3[0]-p2[0]),
            3*u*u*(p1[1]-p0[1]) + 6*u*t*(p2[1]-p1[1]) + 3*t*t*(p3[1]-p2[1]))


def spline(pts, closed=False, move=True):
    """Catmull-Rom spline through pts as cubic path segments."""
    n = len(pts)
    d = f"M{fp(pts[0])}" if move else f" L{fp(pts[0])}"
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[i-1] if (i > 0 or closed) else pts[i]
        p1 = pts[i]
        p2 = pts[(i+1) % n]
        p3 = pts[(i+2) % n] if (i + 2 < n or closed) else p2
        c1 = (p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6)
        c2 = (p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6)
        d += f" C{fp(c1)} {fp(c2)} {fp(p2)}"
    if closed:
        d += " Z"
    return d


def interp(prof, t):
    """Piecewise-linear profile over t in [0,1] (evenly spaced knots)."""
    n = len(prof) - 1
    x = max(0.0, min(1.0, t)) * n
    i = min(int(x), n - 1)
    f = x - i
    return prof[i] * (1 - f) + prof[i+1] * f


def ribbon(c, prof, n=22, side=1, t0=0.0, t1=1.0, inset=0.0):
    """Filled tapered shape along cubic c: one edge on the curve (pushed `inset`
    toward the other side), the other offset by prof(t) along the normal."""
    a, b = [], []
    for k in range(n + 1):
        t = t0 + (t1 - t0) * k / n
        p = bez(c, t)
        dx, dy = bez_d(c, t)
        L = math.hypot(dx, dy) or 1
        nx, ny = dy / L * side, -dx / L * side
        w = interp(prof, k / n)
        a.append((p[0] + nx * w, p[1] + ny * w))
        b.append((p[0] - nx * inset, p[1] - ny * inset))
    return spline(a) + spline(b[::-1], move=False) + " Z"


def taper(c, prof=(0.6, 4.5, 4.0, 2.4, 0.4), n=16):
    """Symmetric tapered strand along cubic c (prof = full width along t)."""
    a, b = [], []
    for k in range(n + 1):
        t = k / n
        p = bez(c, t)
        dx, dy = bez_d(c, t)
        L = math.hypot(dx, dy) or 1
        nx, ny = dy / L, -dx / L
        w = interp(prof, t) / 2
        a.append((p[0] + nx * w, p[1] + ny * w))
        b.append((p[0] - nx * w, p[1] - ny * w))
    return spline(a) + spline(b[::-1], move=False) + " Z"


def curve_pts(c, t0, t1, n=12):
    return [bez(c, t0 + (t1 - t0) * k / n) for k in range(n + 1)]


def offset_curve(c, off, t0, t1, n=12):
    out = []
    for k in range(n + 1):
        t = t0 + (t1 - t0) * k / n
        p = bez(c, t)
        dx, dy = bez_d(c, t)
        L = math.hypot(dx, dy) or 1
        out.append((p[0] + dy / L * off, p[1] - dx / L * off))
    return out


# ------------------------------------------------------------------ palette
HAIR_LINE = "#8a3d14"
HAIR_SHADE = "#d8722a"
HAIR_DEEP = "#b85a1e"
HAIR_SHEEN = "#ffe2a0"
HAIR_STRAND = "#fff1c8"
HAIR_DARKSTR = "#c0601e"
LASH = "#4a1e06"
LASH_LOW = "#8a4420"
BROW = "#8a3d14"
SKIN = "#fde8dc"
SKIN_SH = "#f6cfc2"
SKIN_DEEP = "#eab3a6"
SKIN_LINE = "#b9705f"
CREASE = "#c98a7a"
NOSE = "#d3907f"
MOUTH_LINE = "#9a4842"
SHIRT = "#e8483a"
SHIRT_SH = "#c0342a"
SHIRT_DEEP = "#a52a22"
SHIRT_LINE = "#7a1e18"
APRON_SH = "#e8d6b4"
APRON_LINE = "#8a7350"
TROU_LINE = "#3a1f10"
BAND = "#d93a3a"
BAND_SH = "#b02828"
BAND_LINE = "#6e1414"
FRECKLE = "#e0937a"

DEFS = """
<linearGradient id="hi-hair" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="270">
  <stop offset="0" stop-color="#ffd27c"/><stop offset=".35" stop-color="#ffc76a"/><stop offset=".75" stop-color="#fbae4c"/><stop offset="1" stop-color="#f59a3a"/>
</linearGradient>
<linearGradient id="hi-bun" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="80">
  <stop offset="0" stop-color="#ffd585"/><stop offset=".55" stop-color="#ffc062"/><stop offset="1" stop-color="#f7a440"/>
</linearGradient>
<linearGradient id="hi-lock" gradientUnits="userSpaceOnUse" x1="0" y1="120" x2="0" y2="300">
  <stop offset="0" stop-color="#ffc76a"/><stop offset=".6" stop-color="#f9a845"/><stop offset="1" stop-color="#f08c30"/>
</linearGradient>
<linearGradient id="hi-hairBack" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#e88a34"/><stop offset="1" stop-color="#cf6c24"/>
</linearGradient>
<linearGradient id="hi-sclera" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#e3d6e6"/><stop offset=".45" stop-color="#ffffff"/>
</linearGradient>
<linearGradient id="hi-iris" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6a2c06"/><stop offset=".3" stop-color="#a84c0e"/><stop offset=".62" stop-color="#e8861a"/><stop offset="1" stop-color="#ffd77a"/>
</linearGradient>
<linearGradient id="hi-irisBright" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#a84c0e"/><stop offset=".25" stop-color="#e07e1a"/><stop offset=".5" stop-color="#ffb43c"/><stop offset="1" stop-color="#ffe49a"/>
</linearGradient>
<linearGradient id="hi-irisDull" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#5a2e14"/><stop offset=".35" stop-color="#8a5228"/><stop offset=".7" stop-color="#b88050"/><stop offset="1" stop-color="#d8b484"/>
</linearGradient>
<radialGradient id="hi-pupil" cx=".5" cy=".4" r=".6">
  <stop offset="0" stop-color="#2a0e02"/><stop offset=".8" stop-color="#4a1e06"/><stop offset="1" stop-color="#6a2c08"/>
</radialGradient>
<radialGradient id="hi-irisGlow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#fff2b8" stop-opacity=".95"/><stop offset=".6" stop-color="#ffd77a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd77a" stop-opacity="0"/>
</radialGradient>
<linearGradient id="hi-rainbow" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="hi-rainbowV" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ff7aa8"/><stop offset=".25" stop-color="#ffd36e"/><stop offset=".5" stop-color="#7ff0c0"/>
  <stop offset=".75" stop-color="#7ab8ff"/><stop offset="1" stop-color="#c69bff"/>
</linearGradient>
<linearGradient id="hi-tear" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#e6f8ff" stop-opacity=".8"/><stop offset="1" stop-color="#bfe9ff" stop-opacity=".9"/>
</linearGradient>
<radialGradient id="hi-blush" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff8fa3" stop-opacity=".55"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<radialGradient id="hi-blush2" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#ff6f8c" stop-opacity=".8"/><stop offset=".6" stop-color="#ff7f96" stop-opacity=".4"/><stop offset="1" stop-color="#ff8fa3" stop-opacity="0"/>
</radialGradient>
<radialGradient id="hi-tired" cx=".5" cy=".3" r=".6">
  <stop offset="0" stop-color="#8a6aa0" stop-opacity=".42"/><stop offset="1" stop-color="#8a6aa0" stop-opacity="0"/>
</radialGradient>
<linearGradient id="hi-pale" gradientUnits="userSpaceOnUse" x1="0" y1="96" x2="0" y2="140">
  <stop offset="0" stop-color="#7d8ee0" stop-opacity=".6"/><stop offset=".6" stop-color="#9aa8ec" stop-opacity=".3"/><stop offset="1" stop-color="#b4c0f4" stop-opacity="0"/>
</linearGradient>
<radialGradient id="hi-unblush" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#f8eae6" stop-opacity=".95"/><stop offset=".6" stop-color="#f8eae6" stop-opacity=".8"/><stop offset="1" stop-color="#f8eae6" stop-opacity="0"/>
</radialGradient>
<linearGradient id="hi-shirt" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="560">
  <stop offset="0" stop-color="#f45a4a"/><stop offset=".5" stop-color="#e8483a"/><stop offset="1" stop-color="#df4034"/>
</linearGradient>
<linearGradient id="hi-sleeve" gradientUnits="userSpaceOnUse" x1="0" y1="320" x2="0" y2="470">
  <stop offset="0" stop-color="#f65c4c"/><stop offset="1" stop-color="#e3443a"/>
</linearGradient>
<linearGradient id="hi-apron" gradientUnits="userSpaceOnUse" x1="0" y1="370" x2="0" y2="1040">
  <stop offset="0" stop-color="#fffaf0"/><stop offset=".45" stop-color="#fbf1dc"/><stop offset="1" stop-color="#f1e2c2"/>
</linearGradient>
<linearGradient id="hi-trou" gradientUnits="userSpaceOnUse" x1="0" y1="500" x2="0" y2="1040">
  <stop offset="0" stop-color="#83533a"/><stop offset="1" stop-color="#6b4026"/>
</linearGradient>
<linearGradient id="hi-band" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ee5050"/><stop offset=".6" stop-color="#d93a3a"/><stop offset="1" stop-color="#c22e2e"/>
</linearGradient>
<filter id="hi-b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="hi-b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="hi-b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="hi-b6" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
"""


def flour_specks(pts, op=.75):
    s = ""
    for (x, y, r) in pts:
        s += f'<circle cx="{_fmt(x)}" cy="{_fmt(y)}" r="{_fmt(r)}" fill="#ffffff" opacity="{op}"/>'
    return s


# ================================================================== BODY (canvas coords)
NECK = "M355 228 L355 292 C354 303 347 311 337 316 L423 316 C413 311 406 303 405 292 L405 228 Z"
TROUSERS = ("M292 508 C276 546 254 584 246 620 C240 664 246 724 252 784 C256 864 260 952 264 1040 "
            "L516 1040 C516 952 518 864 520 792 C522 724 518 672 510 632 C502 590 488 546 474 508 Z")
TORSO = ("M340 310 C316 314 288 320 262 330 C246 336 236 346 232 358 C228 382 240 402 254 422 "
         "C266 450 278 482 286 508 C288 520 286 532 284 540 L478 540 C476 532 474 520 476 508 "
         "C484 482 494 450 506 422 C520 402 532 382 528 352 C524 340 514 332 498 326 C472 318 444 312 420 310 Z")
BIB = "M318 372 C340 367 420 367 442 372 C448 418 460 468 478 520 L282 520 C300 468 312 418 318 372 Z"
WAISTBAND = "M281 504 C334 515 428 515 481 504 L483 528 C428 539 334 539 279 528 Z"
SKIRT = ("M281 526 C334 537 428 537 481 526 C490 600 498 700 504 800 C508 880 510 960 512 1040 "
         "L260 1040 C260 960 261 880 264 800 C268 700 273 600 281 526 Z")


def legs():
    s = P(TROUSERS, fill="url(#hi-trou)", stroke=TROU_LINE, sw=2.6)
    s += '<clipPath id="hi-trClip"><path d="' + TROUSERS + '"/></clipPath><g clip-path="url(#hi-trClip)">'
    s += P("M490 560 C504 620 512 700 512 790 C512 880 510 960 512 1040 L530 1040 L530 540 Z", fill="#5a3420", op=.75)
    s += P("M262 640 C258 700 262 760 266 840", stroke="#a8724e", sw=2, op=.6)
    s += "</g>"
    return s


def string_trail():
    """The long apron string, tied behind, trailing past the right hip."""
    d = "M478 520 C496 534 508 566 508 612 C508 660 518 712 538 760 C556 806 560 868 548 930 C542 960 540 990 546 1040"
    s = P(d, stroke=APRON_LINE, sw=11.5)
    s += P(d, stroke="#fbf1dc", sw=8)
    s += P("M500 560 C504 590 504 620 505 650", stroke="#ffffff", sw=2, op=.8)
    s += P("M531 772 C546 812 550 860 544 912", stroke=APRON_SH, sw=3, op=.9)
    return s


def neck_and_collar():
    s = P("M344 300 C360 292 400 292 416 300 L420 318 L340 318 Z", fill=SHIRT_SH, stroke=SHIRT_LINE, sw=2)
    s += P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += P("M357 236 C368 262 392 262 403 236 L403 268 C392 280 368 280 357 268 Z", fill=SKIN_SH)
    s += P("M392 262 C398 276 402 290 404 300 L404 256 Z", fill=SKIN_SH, op=.7)
    return s


def torso():
    s = P(TORSO, fill="url(#hi-shirt)", stroke=SHIRT_LINE, sw=2.6)
    s += '<clipPath id="hi-torsoClip"><path d="' + TORSO + '"/></clipPath><g clip-path="url(#hi-torsoClip)">'
    # shadow side (light from the upper left)
    s += P("M470 330 C500 340 520 360 524 390 C516 420 500 452 490 490 L478 540 L540 540 L540 320 Z", fill=SHIRT_SH, op=.9)
    s += P("M254 422 C268 452 280 486 286 520 L298 520 C290 486 278 452 262 424 Z", fill=SHIRT_SH, op=.6)
    # fold lines from the armpits
    s += P("M262 400 C276 420 290 440 300 462", stroke=SHIRT_LINE, sw=1.5, op=.5)
    s += P("M502 404 C490 424 478 446 468 470", stroke=SHIRT_LINE, sw=1.5, op=.5)
    s += "</g>"
    # V of the open collar
    s += P("M356 312 L404 312 C398 334 390 352 380 370 C370 352 362 334 356 312 Z", fill=SKIN)
    s += P("M356 312 L404 312 C400 324 396 332 392 338 C384 330 374 328 364 334 C360 326 358 320 356 312 Z", fill=SKIN_SH)
    s += P("M372 340 C376 344 384 344 388 340", stroke=CREASE, sw=1.3, op=.6)
    # collar flaps
    flap = "M350 300 C332 306 314 314 300 326 C310 342 322 358 334 374 C344 356 354 336 359 316 C357 310 354 304 350 300 Z"
    s += P(flap, fill=SHIRT, stroke=SHIRT_LINE, sw=2.2)
    s += P(mir(flap), fill=SHIRT, stroke=SHIRT_LINE, sw=2.2)
    s += P("M302 330 C312 344 322 356 332 368 L340 360 C330 352 318 342 306 328 Z", fill="#ff7a68", op=.55)
    s += P(mir("M352 318 C348 334 342 350 334 366 L346 352 C350 340 354 328 356 318 Z"), fill=SHIRT_SH, op=.8)
    return s


def sun_patch(x, y):
    """The bakery's mark embroidered on the bib: a morning sun (asahi) rising over a loaf."""
    s = ""
    for k in range(7):
        a = math.radians(180 + 15 + k * 25)
        r0, r1 = 13, 20 if k % 2 == 0 else 17
        s += P(f"M{_fmt(x + math.cos(a)*r0)} {_fmt(y + math.sin(a)*r0)} L{_fmt(x + math.cos(a)*r1)} {_fmt(y + math.sin(a)*r1)}",
               stroke="#f59a3a", sw=2.4)
    s += P(f"M{x-11} {y} C{x-11} {y-15} {x+11} {y-15} {x+11} {y} Z", fill="#ffb02e", stroke="#c86a10", sw=1.4)
    s += P(f"M{x-7} {y-4} C{x-6} {y-9} {x-2} {y-11} {x+2} {y-11}", stroke="#ffe7a0", sw=1.6)
    # a little loaf under the sun, then the stitched outline of the patch
    s += P(f"M{x-17} {y+1} C{x-12} {y-5} {x+12} {y-5} {x+17} {y+1} C{x+18} {y+6} {x+15} {y+8} {x+12} {y+8} "
           f"L{x-12} {y+8} C{x-15} {y+8} {x-18} {y+6} {x-17} {y+1} Z", fill="#e8483a", stroke="#7a1e18", sw=1.3)
    for dx in (-8, 0, 8):
        s += P(f"M{x+dx-3} {y+4} L{x+dx+2} {y-1}", stroke="#ffd0c8", sw=1.3)
    s += f'<circle cx="{x}" cy="{y-2}" r="27" fill="none" stroke="#e0a050" stroke-width="1.2" stroke-dasharray="3 3" opacity=".8"/>'
    return s


def apron():
    s = ""
    # neck straps rising from the bib to the back of the neck
    for d in ("M322 374 C332 350 344 328 356 310 L366 312 C352 332 342 352 336 374 Z",):
        for dd in (d, mir(d)):
            s += P(dd, fill="#fbf1dc", stroke=APRON_LINE, sw=2)
    s += P(mir("M336 374 C342 352 352 332 366 312 L362 311 C350 330 340 352 332 374 Z"), fill=APRON_SH, op=.8)
    # skirt
    s += P(SKIRT, fill="url(#hi-apron)", stroke=APRON_LINE, sw=2.6)
    s += '<clipPath id="hi-skirtClip"><path d="' + SKIRT + '"/></clipPath><g clip-path="url(#hi-skirtClip)">'
    s += P("M460 540 C474 620 484 720 490 820 C494 900 496 970 498 1040 L520 1040 L520 530 Z", fill=APRON_SH, op=.9)
    s += P("M396 700 C400 800 404 900 404 1040 L420 1040 C418 900 414 800 404 700 Z", fill=APRON_SH, op=.55)
    for f in ("M318 546 C312 650 306 800 300 1040", "M362 548 C360 680 358 860 356 1040",
              "M408 548 C410 680 414 860 418 1040", "M446 544 C452 660 460 820 468 1040"):
        s += P(f, stroke=APRON_LINE, sw=1.5, op=.4)
    # pocket
    pk = "M314 606 C350 613 412 613 448 606 L452 676 C412 684 350 684 310 676 Z"
    s += P(pk, fill="#fbf1dc", stroke=APRON_LINE, sw=2)
    s += P("M314 606 C350 613 412 613 448 606 L449 616 C412 623 350 623 313 616 Z", fill=SHIRT, stroke=SHIRT_LINE, sw=1.4)
    s += P("M318 610 C352 616 410 616 444 610", stroke="#ffd0c8", sw=1, op=.8, extra='stroke-dasharray="3 3"')
    s += P("M381 612 L381 680", stroke=APRON_LINE, sw=1.6, op=.7)
    s += P("M430 616 L444 614 L448 674 C440 676 434 677 428 678 Z", fill=APRON_SH, op=.7)
    # flour: two finger-wipes on the hip and a dusting
    for d, w in (("M300 560 C312 572 322 590 326 612", 5), ("M310 556 C322 568 332 584 338 604", 4),
                 ("M322 554 C334 564 342 578 348 594", 3.4)):
        s += P(d, stroke="#ffffff", sw=w, op=.72)
    s += flour_specks([(296, 588, 2.2), (342, 618, 1.6), (352, 576, 1.4), (420, 590, 1.8), (436, 720, 2.2),
                       (300, 760, 1.6), (372, 742, 2.6), (388, 760, 1.4), (330, 700, 1.8), (460, 640, 1.2)], .7)
    s += "</g>"
    # bib
    s += P(BIB, fill="url(#hi-apron)", stroke=APRON_LINE, sw=2.4)
    s += '<clipPath id="hi-bibClip"><path d="' + BIB + '"/></clipPath><g clip-path="url(#hi-bibClip)">'
    s += P("M436 372 C446 420 456 466 472 508 L490 508 L490 360 Z", fill=APRON_SH, op=.9)
    # bust: soft fold under the chest
    s += P("M312 448 C336 458 362 460 378 454 C366 464 340 468 308 462 Z", fill=APRON_SH, op=.8)
    s += P("M390 454 C410 460 438 458 460 446 C450 460 424 468 396 464 Z", fill=APRON_SH, op=.8)
    s += P("M316 444 C340 455 366 457 380 451", stroke=APRON_LINE, sw=1.5, op=.55)
    s += P("M392 452 C410 457 436 454 458 442", stroke=APRON_LINE, sw=1.5, op=.55)
    s += P("M326 382 C350 377 410 377 436 382", stroke=APRON_LINE, sw=1.2, op=.5, extra='stroke-dasharray="4 4"')
    s += flour_specks([(350, 400, 1.6), (412, 420, 2), (338, 488, 1.4), (430, 492, 1.8), (362, 430, 1.2)], .75)
    s += P("M396 404 C404 410 414 412 422 410", stroke="#ffffff", sw=3.2, op=.6)
    s += "</g>"
    s += sun_patch(352, 408)
    # waistband
    s += P(WAISTBAND, fill="#f6ead0", stroke=APRON_LINE, sw=2.2)
    s += P("M300 512 C348 521 416 521 466 512", stroke="#ffffff", sw=2, op=.8)

    return s


# --- arms
def limb(pts, widths, cap_end=1.0, cap_start=0.0, n=6):
    """Closed outline round a centreline (Catmull-Rom smoothed), half-widths per point."""
    cl = []
    # densify the centreline
    for i in range(len(pts) - 1):
        for k in range(n):
            t = k / n
            p0 = pts[i-1] if i > 0 else pts[i]
            p1, p2 = pts[i], pts[i+1]
            p3 = pts[i+2] if i + 2 < len(pts) else p2
            t2, t3 = t*t, t*t*t
            x = .5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y = .5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            w = widths[i] + (widths[i+1] - widths[i]) * t
            cl.append((x, y, w))
    cl.append((pts[-1][0], pts[-1][1], widths[-1]))
    left, right = [], []
    for i, (x, y, w) in enumerate(cl):
        a = cl[max(i-1, 0)]
        b = cl[min(i+1, len(cl)-1)]
        dx, dy = b[0]-a[0], b[1]-a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy/L, dx/L
        left.append((x + nx*w, y + ny*w))
        right.append((x - nx*w, y - ny*w))
    pts_out = left[::2] + [left[-1]]
    if cap_end:
        x, y, w = cl[-1]
        a = cl[-2]
        dx, dy = x - a[0], y - a[1]
        L = math.hypot(dx, dy) or 1
        pts_out.append((x + dx/L*w*cap_end, y + dy/L*w*cap_end))
    pts_out += [right[-1]] + right[::-1][1::2]
    if cap_start:
        x, y, w = cl[0]
        b = cl[1]
        dx, dy = x - b[0], y - b[1]
        L = math.hypot(dx, dy) or 1
        pts_out.append((x + dx/L*w*cap_start, y + dy/L*w*cap_start))
    return spline(pts_out, closed=True)


def shade_band(pts, widths, side=1, frac=.42):
    """A band along one side of a limb (for the cel shadow), clipped to the limb later."""
    out = []
    for i, p in enumerate(pts):
        a = pts[max(i-1, 0)]
        b = pts[min(i+1, len(pts)-1)]
        dx, dy = b[0]-a[0], b[1]-a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy/L*side, dx/L*side
        w = widths[i]
        out.append((p[0] + nx*w*(1-frac/2) + nx*6, p[1] + ny*w*(1-frac/2) + ny*6))
    return out, [w*frac + 6 for w in widths]


def cuff_band(c, d, hw, h=20):
    """Rolled sleeve cuff: a band of height h centred on c, perpendicular to direction d."""
    L = math.hypot(*d)
    ux, uy = d[0]/L, d[1]/L
    nx, ny = -uy, ux
    p = lambda a, b: (c[0] + nx*a + ux*b, c[1] + ny*a + uy*b)
    pts = [p(-hw, -h/2), p(0, -h/2 - 2), p(hw, -h/2), p(hw + 2, 0), p(hw, h/2), p(0, h/2 + 2.5), p(-hw, h/2), p(-hw - 2, 0)]
    fold = [p(-hw + 2, 1), p(0, 3), p(hw - 2, 1)]
    hi = [p(-hw + 4, -h/2 + 4), p(0, -h/2 + 2), p(hw - 6, -h/2 + 4)]
    return spline(pts, closed=True), spline(fold), spline(hi)


# hanging arm (her left, screen right): one limb from shoulder to wrist
AR = [(535, 410), (550, 456), (562, 518), (568, 548), (578, 604), (585, 662)]
ARW = [27, 26, 22.5, 25, 22, 17]
# fist-on-hip arm (her right, screen left): upper arm, then the forearm over it
AL_UP = [(238, 358), (182, 432), (128, 504)]
AL_UPW = [31, 27, 22]
AL_FO = [(120, 512), (150, 533), (186, 556), (228, 582)]
AL_FOW = [20, 25, 22, 17]

SLEEVE_R = ("M482 321 C504 322 528 328 544 344 C556 358 562 384 566 412 C568 420 570 426 572 432 "
            "L522 446 C518 432 512 418 506 404 C502 384 498 364 494 346 C492 336 489 326 486 318 Z")
SLEEVE_L = ("M278 321 C256 322 236 328 220 340 C204 354 190 374 178 392 C172 400 166 406 162 412 "
            "L208 448 C218 438 230 428 244 418 C252 400 260 380 266 360 C270 346 273 332 276 318 Z")

# relaxed hand, local frame: wrist at the origin, fingers along +y, thumb toward -x (front)
HAND_R = ("M-18 -14 C-19 6 -21 22 -21 36 C-21 48 -20 60 -16 70 C-14 75 -9 76 -7.5 71 "
          "C-6.5 77 -3 82 1 80 C3 79 4 77 4 75 C6 79 10 79 11 75 C11.5 74 12 73 12 72 "
          "C15 73 17 70 17 66 C18 56 19 46 19 38 C19 22 19 6 18 -14 Z")
THUMB_R = "M-18 2 C-24 10 -27 22 -27 32 C-27 41 -25 47 -21 47 C-17 47 -16 41 -16 35 C-15 27 -13 20 -9 14 Z"
# fist, local frame: wrist at the origin, knuckles along +x, thumb on top (-y)
FIST = ("M-12 -18 C0 -21 16 -23 28 -22 C38 -21 45 -17 46 -10 C49 -8 49 -2 46 0 C49 2 49 8 46 10 "
        "C49 12 48 19 43 21 C37 25 28 26 20 26 C8 26 -2 23 -12 20")
FIST_THUMB = "M-4 -15 C6 -24 22 -27 33 -22 C38 -20 39 -14 34 -12 C26 -9 14 -8 2 -8 Z"


def skin_limb(pts, widths, cid, shade_side, cap_end=1.0, cap_start=0.0):
    d = limb(pts, widths, cap_end=cap_end, cap_start=cap_start)
    s = P(d, fill=SKIN, stroke=SKIN_LINE, sw=2.4)
    bp, bw = shade_band(pts, widths, shade_side)
    s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>'
    s += g(P(limb(bp, bw, cap_end=1.5, cap_start=1.5), fill=SKIN_SH), extra=f'clip-path="url(#{cid})"')
    return s


def sleeve(d, cid, shade, cuffc, cuffd, hw):
    s = P(d, fill="url(#hi-sleeve)", stroke=SHIRT_LINE, sw=2.6)
    s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>'
    s += g(shade, extra=f'clip-path="url(#{cid})"')
    band, fold, hi = cuff_band(cuffc, cuffd, hw)
    s += P(band, fill=SHIRT, stroke=SHIRT_LINE, sw=2.4)
    s += P(fold, stroke=SHIRT_LINE, sw=1.5, op=.6)
    s += P(hi, stroke="#ff8f7c", sw=2.2, op=.8)
    return s


def arm_right():
    """Her left arm (screen right), hanging loose."""
    s = skin_limb(AR, ARW, "hi-arClip", -1, cap_end=.8)
    s += P("M550 515 C557 521 566 522 574 518", stroke=CREASE, sw=1.5, op=.7)
    s += P("M586 566 C591 588 593 612 592 636", stroke=SKIN_LINE, sw=1.4, op=.4)
    # relaxed hand
    h = P(HAND_R, fill=SKIN) + P(HAND_R[:-2], stroke=SKIN_LINE, sw=2.2)
    h += P("M19 40 C19 52 16 62 13 70 C10 77 5 81 -1 79 C4 72 7 62 8 52 C10 46 14 42 19 40 Z", fill=SKIN_SH)
    for d in ("M-7.5 71 C-7 60 -6 50 -6 42", "M4 75 C4 64 3 52 3 42", "M12 72 C12 62 11 52 11 42"):
        h += P(d, stroke=SKIN_LINE, sw=1.3, op=.6)
    h += P("M-16 36 C-6 40 6 40 18 35", stroke=CREASE, sw=1.2, op=.45)
    h += P(THUMB_R, fill=SKIN) + P(THUMB_R[:-2], stroke=SKIN_LINE, sw=2)
    h += '<ellipse cx="-21.5" cy="41.5" rx="2.6" ry="3.4" fill="#fff4ee" opacity=".9"/>'
    s += g(h, "translate(585 662) rotate(-6)")
    sh = P("M528 326 C548 342 560 366 566 400 C568 416 572 430 576 446 L600 446 L600 300 Z", fill=SHIRT_SH, op=.9)
    sh += P("M502 360 C506 390 512 420 520 446", stroke=SHIRT_LINE, sw=1.4, op=.45)
    s += sleeve(SLEEVE_R, "hi-arSl", sh, (548, 440), (12, 44), 33)
    s += flour_specks([(586, 600, 1.6), (594, 618, 1.2), (576, 586, 1.1), (590, 640, 1.8), (600, 700, 1.2)], .85)
    return s


ARM_L = ("M164 404 C148 428 130 460 116 488 C108 502 105 516 112 527 C122 541 142 556 164 568 "
         "C182 579 200 590 216 600 L236 566 C220 554 202 542 184 532 C172 526 162 520 152 513 "
         "C164 496 182 474 212 446 Z")
ARM_L_SH = ("M152 513 C162 520 172 526 184 532 C202 542 220 554 236 566 L232 574 C212 566 192 556 176 548 "
            "C160 540 144 532 130 526 C142 520 150 516 152 513 Z M112 527 C122 541 142 556 164 568 "
            "C182 579 200 590 216 600 L222 610 L100 610 L100 520 Z M152 513 C164 496 182 474 212 446 "
            "L226 470 C200 486 176 502 160 516 Z")


def arm_left():
    """Her right arm (screen left): fist on the hip, elbow out."""
    s = P(ARM_L, fill=SKIN, stroke=SKIN_LINE, sw=2.4)
    s += f'<clipPath id="hi-alClip"><path d="{ARM_L}"/></clipPath>'
    s += g(P("M112 527 C124 542 144 556 166 568 C184 578 202 590 218 600 L230 620 L96 620 L96 520 Z "
             "M150 513 C164 496 182 474 212 446 L226 466 C200 484 178 502 162 518 Z", fill=SKIN_SH),
           extra='clip-path="url(#hi-alClip)"')
    s += P("M152 513 C147 512 142 514 139 519", stroke=CREASE, sw=1.5, op=.7)
    s += P("M146 538 C166 548 188 560 208 572", stroke=SKIN_LINE, sw=1.4, op=.4)
    s += P("M130 474 C124 486 120 496 117 506", stroke=SKIN_LINE, sw=1.3, op=.35)
    s += flour_specks([(170, 548, 1.6), (186, 560, 1.2), (198, 572, 1.8), (160, 540, 1.1), (122, 520, 1.3)], .85)
    # fist on the hip, seen from the palm side: four curled fingers stacked, thumb across the top
    f = P(FIST + " Z", fill=SKIN) + P(FIST, stroke=SKIN_LINE, sw=2.4)
    f += P("M46 12 C49 14 48 19 43 21 C37 25 28 26 20 26 C8 26 -2 23 -12 20 L-12 13 C4 18 22 19 34 17 C40 16 44 14 46 12 Z", fill=SKIN_SH)
    for d in ("M14 -7 C24 -8 36 -6 46 -6", "M14 2 C24 1 36 2 47 3", "M14 11 C24 11 34 12 45 13"):
        f += P(d, stroke=SKIN_LINE, sw=1.5, op=.7)
    for (x, y) in ((40, -3), (41, 6), (39, 15)):
        f += f'<ellipse cx="{x}" cy="{y}" rx="3" ry="1.6" fill="#ffffff" opacity=".6"/>'
    f += P("M-8 -4 C0 -2 6 2 10 8", stroke=CREASE, sw=1.2, op=.45)
    f += P(FIST_THUMB, fill=SKIN) + P(FIST_THUMB[:-2], stroke=SKIN_LINE, sw=2)
    f += '<ellipse cx="31" cy="-17.5" rx="3.4" ry="2.2" fill="#fff4ee" opacity=".9" transform="rotate(-10 31 -17.5)"/>'
    s += g(f, "translate(226 581) rotate(26)")
    sh = P("M268 330 C262 360 256 390 248 420 L210 452 L240 470 L290 420 L290 330 Z", fill=SHIRT_SH, op=.85)
    sh += P("M226 344 C206 362 190 382 176 402", stroke="#ff8f7c", sw=2.4, op=.6)
    s += sleeve(SLEEVE_L, "hi-alSl", sh, (186, 431), (-36, 50), 33)
    return s


def body_layers():
    s = "<!-- legs -->" + legs()
    s += "<!-- neck -->" + neck_and_collar()
    s += "<!-- shirt -->" + torso()
    s += "<!-- apron -->" + apron() + string_trail()
    s += "<!-- arms -->" + arm_right() + arm_left()
    return s


# ================================================================== HEAD (head-local)
FACE = ("M288 102 L287 152 C287 190 299 216 319 235 C337 252 360 263 380 264 "
        "C400 263 423 252 441 235 C461 216 473 190 473 152 L472 102 Z")
JAW_SHADOW = ("M473 150 C472 188 458 214 440 233 C422 250 402 260 382 262 "
              "C406 252 430 236 446 216 C458 198 464 176 466 150 Z")
EAR = ("M291 168 C281 158 266 160 263 176 C260 194 267 212 281 222 C286 226 292 224 293 216 Z")

BANG_START = (478, 172)
CLUMPS = [((470, 138), (464, 164), (450, 126)),
          ((450, 126), (431, 150), (418, 116)),
          ((418, 116), (408, 132), (399, 112)),
          ((399, 112), (373, 156), (356, 114)),
          ((356, 114), (340, 140), (326, 118)),
          ((326, 118), (304, 160), (294, 138))]
BANG_END = (282, 172)


def _bang_edge(dx=0, dy=0, soft=False):
    def pt(p):
        return f"{_fmt(p[0]+dx)} {_fmt(p[1]+dy)}"
    out = f" C{pt((477, 158))} {pt((474, 146))} {pt(CLUMPS[0][0])}"
    for nr, t, nl in CLUMPS:
        if soft:
            t = (t[0], t[1] - 6)
        # side-swept: tips lean to screen-left, so the right flank is long and the left short
        c1 = (nr[0] - (nr[0] - t[0]) * .05, nr[1] + (t[1] - nr[1]) * .6)
        c2 = (t[0] + (nr[0] - t[0]) * .42, t[1] - (t[1] - nr[1]) * .22)
        out += f" C{pt(c1)} {pt(c2)} {pt(t)}"
        c1 = (t[0] - (t[0] - nl[0]) * .18, t[1] - (t[1] - nl[1]) * .45)
        c2 = (nl[0] + (t[0] - nl[0]) * .1, nl[1] + (t[1] - nl[1]) * .5)
        out += f" C{pt(c1)} {pt(c2)} {pt(nl)}"
    nl = CLUMPS[-1][2]
    out += f" C{pt((nl[0]-4, nl[1]+12))} {pt((BANG_END[0]+1, BANG_END[1]-14))} {pt(BANG_END)}"
    return out


CROWN = "M282 172 C268 118 286 58 380 46 C474 58 492 118 478 172" + _bang_edge() + " Z"
BANG_SHADOW = "M266 90 L494 90 L494 184 L481 184" + _bang_edge(3, 10, soft=True) + " L266 184 Z"

LOCK_L = ("M296 134 C279 158 268 188 270 216 C271 236 266 252 254 266 C250 271 255 275 261 272 "
          "C276 264 284 248 286 228 C288 204 287 176 301 146 Z")
LOCK_L2 = ("M287 150 C277 176 275 204 279 230 C280 240 277 250 271 258 C281 252 285 240 285 228 "
           "C285 204 286 178 292 156 Z")
LOCK_R = ("M465 132 C484 156 492 186 490 214 C489 234 495 250 509 262 C514 266 510 271 503 269 "
          "C486 262 476 246 474 226 C472 202 473 174 460 144 Z")


BUN = ("M316 68 C302 54 306 32 326 21 C344 11 368 9 390 10 C414 10 438 16 451 30 "
       "C464 44 462 64 447 74 C431 84 402 86 380 84 C354 84 328 80 316 68 Z")


def bun():
    """Big messy bun on top: a rolled knot (one fat spiral), tufts and loose ends."""
    s = ""
    # loose strands springing out of the knot (messy, not tidy tufts)
    for c, w in ((((334, 34), (320, 20), (304, 16), (292, 22)), 7), (((432, 26), (444, 14), (462, 12), (474, 20)), 7),
                 (((452, 54), (468, 48), (484, 52), (490, 62)), 6), (((310, 54), (296, 50), (284, 56), (282, 66)), 6),
                 (((376, 20), (370, 12), (372, 8), (380, 10)), 0)):
        if not w:
            continue
        d = taper(c, (w, w * .9, w * .7, w * .45, .6))
        s += P(d, fill="url(#hi-bun)", stroke=HAIR_LINE, sw=2)
    s += P(BUN, fill="url(#hi-bun)", stroke=HAIR_LINE, sw=2.6)
    s += '<clipPath id="hi-bunClip"><path d="' + BUN + '"/></clipPath>'
    c = ""
    # shadow between the turns of the roll (cel tone), then the turns' edges
    c += P("M318 66 C306 52 314 32 336 24 C358 16 400 16 422 26 C442 36 446 56 432 64 C446 50 438 34 418 28 "
           "C398 20 360 20 340 28 C322 36 314 52 326 66 Z", fill=HAIR_SHADE, op=.75)
    c += P("M372 64 C356 58 352 44 364 38 C376 32 398 34 408 44 C400 38 378 36 368 42 C360 48 362 58 372 64 Z",
           fill=HAIR_SHADE, op=.75)
    c += P("M447 74 C431 84 402 86 380 84 C354 84 328 80 316 68 C340 74 360 76 382 76 C410 76 432 72 452 62 Z",
           fill=HAIR_DEEP, op=.45)
    spiral = ("M326 66 C314 52 322 32 344 24 C366 16 404 16 424 26 C442 36 446 54 432 64 "
              "C418 74 392 74 374 66 C358 58 354 44 366 38 C378 32 400 34 408 44")
    c += P(spiral, stroke=HAIR_LINE, sw=2, op=.85)
    for d in ("M334 58 C328 44 338 32 356 28", "M372 22 C392 20 414 24 428 34", "M436 50 C434 58 426 64 414 66",
              "M392 68 C380 66 370 62 366 54", "M376 42 C384 38 396 38 402 42", "M340 74 C360 78 400 79 430 74"):
        c += P(d, stroke=HAIR_LINE, sw=1.3, op=.45)
    # sheen on the upper-left of each turn
    for d in ("M332 40 C338 30 352 24 366 22", "M380 20 C394 18 410 20 420 26", "M368 46 C374 40 384 38 394 40",
              "M330 72 C344 76 360 78 376 78"):
        c += P(d, stroke=HAIR_SHEEN, sw=5, op=.85)
    c += P("M336 34 C342 28 350 25 358 24", stroke="#ffffff", sw=1.8, op=.8)
    c += P("M388 18 C396 17 404 18 410 20", stroke="#ffffff", sw=1.5, op=.7)
    s += g(c, extra='clip-path="url(#hi-bunClip)"')
    # loose ends poking out of the knot
    for d in ("M398 16 C404 9 414 7 422 11 C414 12 408 15 404 20", "M352 16 C346 10 338 10 332 14"):
        s += P(d, stroke=HAIR_LINE, sw=5.5) + P(d, stroke="#ffcf78", sw=2.6)
    return s


def bandana():
    """Red-and-white polka-dot bandana tied round the base of the bun, knot at the right."""
    band = "M312 82 C330 64 414 58 444 70 L448 90 C416 80 342 82 318 98 C308 96 306 88 312 82 Z"
    tail1 = "M444 70 C462 56 482 38 506 22 C506 40 498 60 484 74 C474 82 460 86 450 84 Z"
    tail2 = "M450 82 C470 82 496 88 520 98 C504 106 482 108 462 104 C456 98 452 90 450 82 Z"
    knot = "M436 66 C446 60 458 64 460 74 C462 86 452 94 442 92 C432 90 428 74 436 66 Z"
    s = ""
    s += P(tail2, fill="url(#hi-band)", stroke=BAND_LINE, sw=2.2)
    s += P(tail1, fill="url(#hi-band)", stroke=BAND_LINE, sw=2.2)
    s += P(band, fill="url(#hi-band)", stroke=BAND_LINE, sw=2.2)
    dots = ""
    cid = "hi-bandClip"
    s += (f'<clipPath id="{cid}"><path d="{band}"/><path d="{tail1}"/><path d="{tail2}"/></clipPath>')
    for (x, y, r) in ((322, 88, 2.6), (338, 84, 3), (352, 74, 3.2), (366, 82, 3), (382, 70, 3.2), (396, 79, 3), (412, 70, 3.2),
                      (426, 79, 3), (440, 72, 2.8), (470, 52, 3.2), (488, 36, 3), (478, 70, 3), (494, 52, 2.6),
                      (470, 94, 3), (488, 96, 3), (504, 99, 2.6), (458, 66, 2.4)):
        dots += f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff"/>'
    dots += P("M318 98 C342 82 416 80 448 90 L448 82 C416 74 346 76 318 90 Z", fill=BAND_SH, op=.7)
    dots += P("M484 74 C498 60 506 40 506 22 C500 44 490 60 476 70 Z", fill=BAND_SH, op=.7)
    dots += P("M462 104 C482 108 504 106 520 98 C500 100 480 100 464 96 Z", fill=BAND_SH, op=.7)
    s += g(dots, extra=f'clip-path="url(#{cid})"')
    s += P("M454 62 C468 50 484 38 498 28", stroke="#ff9a9a", sw=1.6, op=.8)
    s += P(knot, fill="url(#hi-band)", stroke=BAND_LINE, sw=2.2)
    s += P("M440 70 C444 76 446 82 444 88", stroke=BAND_LINE, sw=1.3, op=.6)
    s += '<circle cx="450" cy="74" r="2.6" fill="#ffffff"/><circle cx="446" cy="84" r="2.2" fill="#ffffff"/>'
    s += P("M326 78 C350 66 400 62 430 66", stroke="#ffb0a8", sw=1.6, op=.8)
    return s


def hair_back():
    """Wisps of the nape hair behind the neck."""
    s = ""
    for d in ("M302 214 C296 232 296 252 304 266 C298 250 302 236 312 226 Z",
              "M458 214 C466 232 466 252 458 268 C464 250 460 236 450 226 Z"):
        s += P(d, fill="url(#hi-hairBack)", stroke=HAIR_LINE, sw=2)
    return s


def ears():
    s = ""
    for d in (EAR, mir(EAR)):
        s += P(d, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += both("M284 180 C276 176 271 182 271 190 C272 200 277 208 284 212", stroke=CREASE, sw=1.4, op=.8)
    s += both("M285 186 C280 186 278 192 280 198", stroke=CREASE, sw=1.2, op=.6)
    s += P(mir("M290 168 C282 162 270 164 266 176 L272 182 C276 172 284 170 290 172 Z"), fill=SKIN_SH)
    return s


def face_base():
    s = P(FACE, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += '<clipPath id="hi-faceClip"><path d="' + FACE + '"/></clipPath>'
    s += g(P(BANG_SHADOW, fill=SKIN_SH), extra='clip-path="url(#hi-faceClip)"')
    s += P(JAW_SHADOW, fill=SKIN_SH, op=.7)
    s += f'<ellipse cx="322" cy="{E+40}" rx="28" ry="10" fill="url(#hi-blush)"/>'
    s += f'<ellipse cx="438" cy="{E+40}" rx="28" ry="10" fill="url(#hi-blush)"/>'
    # freckles across the nose and the tops of the cheeks
    for (x, y, r) in ((362, E+30, 1.3), (368, E+34, 1.1), (356, E+35, 1.0), (350, E+31, 1.1),
                      (398, E+30, 1.3), (392, E+34, 1.1), (404, E+35, 1.0), (410, E+31, 1.1)):
        s += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{FRECKLE}" opacity=".75"/>'
    # nose
    s += P(f"M383 {E+30} C382 {E+34} 380 {E+37} 378 {E+39}", stroke=NOSE, sw=1.7)
    s += P(f"M385 {E+24} C386 {E+28} 386 {E+31} 385 {E+34}", stroke="#ffffff", sw=1.5, op=.8)
    s += flour_smudge()
    return s


def flour_smudge():
    """A smudge of flour on her left cheek (screen right)."""
    s = P(f"M436 {E+34} C443 {E+29} 451 {E+27} 458 {E+28}", stroke="#ffffff", sw=5, op=.8)
    s += P(f"M441 {E+40} C446 {E+37} 451 {E+36} 455 {E+37}", stroke="#ffffff", sw=3, op=.65)
    s += f'<circle cx="433" cy="{E+42}" r="1.4" fill="#ffffff" opacity=".8"/>'
    return s


def crown():
    s = P(CROWN, fill="url(#hi-hair)", stroke=HAIR_LINE, sw=2.4)
    # strands from each notch sweeping up toward the bun
    for (n, t, _nl) in CLUMPS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{_fmt(x0 + (384-x0)*.3)} {y0-36} {_fmt(384 + (x0-384)*.35)} 60",
               stroke=HAIR_LINE, sw=1.4, op=.45)
        mx = (x0 + t[0]) / 2
        s += P(f"M{_fmt(mx+2)} {y0+4} C{_fmt(mx+1)} {y0+14} {_fmt((mx+t[0])/2)} {_fmt(t[1]-12)} {_fmt(t[0]+(mx-t[0])*.3)} {_fmt(t[1]-5)}",
               stroke=HAIR_DARKSTR, sw=1.3, op=.55)
    s += both("M286 150 C282 120 296 90 334 70", stroke=HAIR_LINE, sw=1.4, op=.5)
    s += both("M296 136 C298 110 312 88 344 74", stroke=HAIR_DARKSTR, sw=1.3, op=.5)
    # angel-ring sheen band
    s += P("M296 98 C316 76 348 66 380 65 C412 66 444 76 464 98 "
           "C456 94 450 100 444 98 C436 90 428 94 422 94 C412 86 402 90 396 90 "
           "C388 82 378 86 372 86 C364 82 354 90 346 90 C338 90 330 96 324 96 "
           "C316 94 308 102 300 100 C298 100 297 100 296 98 Z", fill=HAIR_SHEEN, op=.75)
    s += P("M314 82 C334 72 354 68 372 68", stroke="#ffffff", sw=1.8, op=.75)
    s += P("M394 68 C406 68 416 70 426 74", stroke="#ffffff", sw=1.3, op=.6)
    # cool shadow on the right side of the crown
    s += P("M478 172 C492 118 470 58 380 46 C450 66 474 112 466 158 Z", fill=HAIR_SHADE, op=.55)
    return s


def locks():
    s = ""
    for d in (LOCK_L2, LOCK_L, LOCK_R):
        s += P(d, fill="url(#hi-lock)", stroke=HAIR_LINE, sw=2.2)
    s += P("M283 160 C275 184 273 208 277 232", stroke=HAIR_SHEEN, sw=3, op=.8)
    s += P("M476 158 C484 182 486 206 484 226", stroke=HAIR_SHADE, sw=3, op=.7)
    s += P("M279 236 C277 248 271 258 263 266", stroke=HAIR_LINE, sw=1.2, op=.5)
    s += P("M482 236 C486 248 494 256 502 262", stroke=HAIR_LINE, sw=1.2, op=.5)
    return s


def flyaways():
    s = ""
    for c in (((300, 92), (292, 80), (282, 74), (272, 76)), ((462, 94), (472, 82), (484, 78), (494, 82)),
              ((340, 62), (336, 50), (328, 44), (318, 44))):
        s += P(taper(c, (3, 2.6, 1.8, 1, .3)), fill="url(#hi-hair)", stroke=HAIR_LINE, sw=1.3)
    # flour in her hair
    s += flour_specks([(352, 30, 1.6), (420, 44, 1.4), (322, 104, 1.2), (448, 110, 1.4), (398, 60, 1.2)], .85)
    return s


def head_back():
    return bun()


def head_front():
    return crown() + bandana() + locks() + flyaways()


# ================================================================== EYES
EYE_SHAPES = []      # (d, kind) for the left eye; the blink patch is their convex hull


def reg(d, kind="fill"):
    if (d, kind) not in EYE_SHAPES:
        EYE_SHAPES.append((d, kind))
    return d


LASH_PROF = (5.0, 7.0, 6.6, 5.0, 3.0, 1.2)


class Eye:
    """Left (screen-left) eye: upper lid cubic from the outer corner O to the inner
    corner I, lower lid cubic back from I to O."""

    def __init__(self, O, U1, U2, I, L1, L2, lash=LASH_PROF, flick=1.0, spikes=2, lower=(0.45, 0.98),
                 crease=9, crease_t=(0.2, 0.64), lower_w=1.7, lower_col=None):
        self.lower_w = lower_w
        self.lower_col = lower_col or LASH_LOW
        self.up = (O, U1, U2, I)
        self.lo = (I, L1, L2, O)
        self.O, self.I = O, I
        self.lash_prof = lash
        self.flick = flick
        self.spikes = spikes
        self.lower = lower
        self.crease = crease
        self.crease_t = crease_t

    def sclera(self):
        O, U1, U2, I = self.up
        _, L1, L2, _ = self.lo
        return f"M{fp(O)} C{fp(U1)} {fp(U2)} {fp(I)} C{fp(L1)} {fp(L2)} {fp(O)} Z"

    def lash(self):
        d = ribbon(self.up, self.lash_prof, n=20, side=1, inset=1.4)
        return d

    def flick_d(self):
        """Small wedge spikes at the outer end of the lash (like Suzu's), plus a short wing."""
        if not self.flick:
            return ""
        ox, oy = self.O
        k = self.flick
        th = self.lash_prof[0]

        def lashspike(base, ang, ln, w=2.6, bend=2.5):
            a = math.radians(ang)
            ux, uy = math.cos(a), math.sin(a)
            nx, ny = -uy, ux
            b1 = (base[0] + nx * w / 2, base[1] + ny * w / 2)
            b2 = (base[0] - nx * w / 2, base[1] - ny * w / 2)
            tip = (base[0] + ux * ln + nx * bend, base[1] + uy * ln + ny * bend)
            m1 = (base[0] + ux * ln * .55 + nx * (w * .4 + bend * .6), base[1] + uy * ln * .55 + ny * (w * .4 + bend * .6))
            m2 = (base[0] + ux * ln * .55 + nx * (-w * .2 + bend * .6), base[1] + uy * ln * .55 + ny * (-w * .2 + bend * .6))
            return f"M{fp(b1)} Q{fp(m1)} {fp(tip)} Q{fp(m2)} {fp(b2)} Z "
        # wing: the lash runs on past the outer corner and tapers
        top = (ox + 1, oy - th + .6)
        bot = (ox + 1, oy + 1)
        tip = (ox - 9 * k, oy + 2.6 * k)
        d = (f"M{fp(top)} C{fp((ox - 4, oy - th + 2))} {fp((tip[0] + 3, tip[1] - 2))} {fp(tip)} "
             f"C{fp((tip[0] + 4, tip[1] + .5))} {fp((ox - 2, oy + 1.5))} {fp(bot)} Z ")
        d += lashspike((ox + 2.5, oy - th + 1.5), 196, 10 * k, 2.6, -2.2)
        if self.spikes > 1:
            d += lashspike((ox + 7.5, oy - th - .5), 222, 8 * k, 2.4, -2)
        return d.strip()

    def lower_d(self):
        if not self.lower:
            return ""
        return spline(curve_pts(self.lo, self.lower[0], self.lower[1], 10))

    def crease_d(self):
        if not self.crease:
            return ""
        return spline(offset_curve(self.up, self.crease, self.crease_t[0], self.crease_t[1], 10))


def iris(cx, cy, rx=21, ry=25, pupil=(8, 11), dull=False, idx="L", lidshadow=True, bright=False):
    cid = f"hi-ir{idx}"
    e = f'cx="{_fmt(cx)}" cy="{_fmt(cy)}" rx="{_fmt(rx)}" ry="{_fmt(ry)}"'
    s = f'<clipPath id="{cid}"><ellipse {e}/></clipPath>'
    s += f'<ellipse {e} fill="url(#hi-iris{"Dull" if dull else ("Bright" if bright else "")})"/>'
    c = ""
    # amber texture: faint radial streaks, a honey glow pooled at the bottom
    for k in range(12):
        a = math.radians(k * 30 + 8)
        r0, r1 = pupil[0] + 2, rx * .95
        c += P(f"M{_fmt(cx + math.cos(a)*r0)} {_fmt(cy + 1 + math.sin(a)*r0*1.25)} "
               f"L{_fmt(cx + math.cos(a)*r1)} {_fmt(cy + 1 + math.sin(a)*r1*ry/rx)}",
               stroke="#ffe3a0" if not dull else "#e0c8a8", sw=1.1, op=.35)
    c += (f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy + ry*.62)}" rx="{_fmt(rx*.78)}" ry="{_fmt(ry*.34)}" '
          f'fill="url(#hi-irisGlow)" opacity="{".5" if dull else "1"}"/>')
    if pupil:
        c += f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy + 1)}" rx="{pupil[0]}" ry="{pupil[1]}" fill="url(#hi-pupil)"/>'
    # lid shadow across the top third
    if lidshadow:
        c += (f'<path d="M{_fmt(cx-rx-2)} {_fmt(cy-ry*.38)} C{_fmt(cx-8)} {_fmt(cy-ry*.18)} {_fmt(cx+8)} {_fmt(cy-ry*.18)} '
              f'{_fmt(cx+rx+2)} {_fmt(cy-ry*.38)} L{_fmt(cx+rx+2)} {_fmt(cy-ry-4)} L{_fmt(cx-rx-2)} {_fmt(cy-ry-4)} Z" '
              f'fill="#4a1a04" opacity=".32"/>')
    s += g(c, extra=f'clip-path="url(#{cid})"')
    s += f'<ellipse {e} fill="none" stroke="#5a2406" stroke-width="1.6"/>'
    return s


def eye_highlights(cx, cy, big=1.0, wet=False, dull=False):
    if dull:
        s = f'<circle cx="{_fmt(cx+9)}" cy="{_fmt(cy+10)}" r="2" fill="#fff" opacity=".55"/>'
        return s
    s = (f'<ellipse cx="{_fmt(cx-8)}" cy="{_fmt(cy-11)}" rx="{7*big:.1f}" ry="{8.5*big:.1f}" fill="#fff" '
         f'transform="rotate(-18 {_fmt(cx-8)} {_fmt(cy-11)})"/>')
    s += f'<circle cx="{_fmt(cx+9)}" cy="{_fmt(cy+10)}" r="3.2" fill="#fff"/>'
    s += f'<circle cx="{_fmt(cx-8)}" cy="{_fmt(cy+11)}" r="1.6" fill="#fff" opacity=".9"/>'
    s += P(f"M{_fmt(cx+12)} {_fmt(cy-14)} C{_fmt(cx+16)} {_fmt(cy-8)} {_fmt(cx+17)} {_fmt(cy-2)} {_fmt(cx+16)} {_fmt(cy+4)}",
           stroke="#fff", sw=1.6, op=.7)
    if wet:
        s += f'<circle cx="{_fmt(cx+3)}" cy="{_fmt(cy-15)}" r="2.4" fill="#fff"/>'
        s += f'<circle cx="{_fmt(cx-12)}" cy="{_fmt(cy+4)}" r="1.8" fill="#fff" opacity=".9"/>'
        s += P(f"M{_fmt(cx-14)} {_fmt(cy+16)} C{_fmt(cx-6)} {_fmt(cy+21)} {_fmt(cx+6)} {_fmt(cy+21)} {_fmt(cx+14)} {_fmt(cy+15)}",
               stroke="#ffffff", sw=1.8, op=.85)
    return s


def draw_eyes(eye, iris_dx=0, iris_dy=0, iris_r=(21, 25), pupil=(8, 11), big=1.0, wet=False, dull=False,
              inner_extra=None, gaze_same=True, lidshadow=True, hl_dy=0, bright=False):
    """Both eyes. iris_dx shifts the irises; with gaze_same both look the same way."""
    scl, lash, flick, low, cr = eye.sclera(), eye.lash(), eye.flick_d(), eye.lower_d(), eye.crease_d()
    reg(scl)
    reg(lash)
    if flick:
        reg(flick)
    if low:
        reg(low, "stroke")
    s = ""
    for side in ("L", "R"):
        m = (lambda d: d) if side == "L" else mir
        base_cx = EXL if side == "L" else EXR
        dx = iris_dx if (side == "L" or gaze_same) else -iris_dx
        cx, cy = base_cx + dx, E + iris_dy
        clip = f"hi-sc{side}"
        s += f'<clipPath id="{clip}"><path d="{m(scl)}"/></clipPath>'
        s += P(m(scl), fill="url(#hi-sclera)")
        inner = (iris(cx, cy, iris_r[0], iris_r[1], pupil, dull, side, lidshadow, bright)
                 + eye_highlights(cx, cy + hl_dy, big, wet, dull))
        if inner_extra:
            inner += inner_extra(side, m)
        s += g(inner, extra=f'clip-path="url(#{clip})"')
        s += P(m(lash), fill=LASH)
        if flick:
            s += P(m(flick), fill=LASH)
        if low:
            s += P(m(low), stroke=eye.lower_col, sw=eye.lower_w, op=.9)
        if cr:
            s += P(m(cr), stroke=CREASE, sw=1.5, op=.6)
    return s


def brow_shape(c, prof=(1.6, 3.4, 4.6, 4.2)):
    """Tapered brow along cubic c from the outer end to the inner end."""
    return ribbon(c, prof, n=14, side=1)


def brows(c, prof=(1.6, 3.6, 5.0, 4.8)):
    d = brow_shape(c, prof)
    s = ""
    for dd in (d, mir(d)):
        s += P(dd, fill="none", stroke="#ffe7b0", sw=2.6, op=.55)
        s += P(dd, fill=BROW)
    return s


def blush_strong(y=E + 40):
    s = f'<ellipse cx="320" cy="{y}" rx="30" ry="11" fill="url(#hi-blush2)"/>'
    s += f'<ellipse cx="440" cy="{y}" rx="30" ry="11" fill="url(#hi-blush2)"/>'
    for x0 in (308, 318, 328, 428, 438, 448):
        s += P(f"M{x0} {y+8} L{x0+6} {y-1}", stroke="#ff5a7a", sw=1.6, op=.55)
        s += P(f"M{x0+2} {y+8} L{x0+7} {y+1}", stroke="#ffffff", sw=.9, op=.6)
    return s


def teeth_band(segs, h=8):
    """Band of upper teeth hanging h px below the upper lip edge (segs: start point + cubic segments)."""
    p0 = segs[0]
    cs = segs[1:]
    up = lambda p: (p[0], p[1] - 3)
    sh = lambda p: (p[0], p[1] + h)
    pts = [p0] + [c for _, _, c in cs]
    d = f"M{fp(up(p0))}" + "".join(f" C{fp(up(a))} {fp(up(b))} {fp(up(c))}" for a, b, c in cs)
    d += f" L{fp(sh(pts[-1]))}"
    for i in range(len(cs) - 1, -1, -1):
        a, b, c = cs[i]
        d += f" C{fp(sh(b))} {fp(sh(a))} {fp(sh(pts[i]))}"
    return d + " Z"


def mouth_open(d, tongue=None, teeth_top=None, teeth_bot=None, cid="hi-m"):
    s = P(d, fill="#8a2f3a")
    inner = ""
    if tongue:
        inner += P(tongue, fill="#f08a96")
    if teeth_top:
        inner += P(teeth_top, fill="#ffffff")
    if teeth_bot:
        inner += P(teeth_bot, fill="#ffffff")
    if inner:
        s += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>' + g(inner, extra=f'clip-path="url(#{cid})"')
    s += P(d, stroke="#6b2430", sw=1.8)
    return s


# ================================================================== EXPRESSIONS
# each returns (face_layer, brow_layer, extras_layer); face_layer sits under the bangs

def sweat_drop(x, y, s=1.0):
    d = "M0 -14 C4 -6 9 0 9 6 C9 12 4 16 0 16 C-4 16 -9 12 -9 6 C-9 0 -4 -6 0 -14 Z"
    c = P(d, fill="#cdeeff", stroke="#6fb8e6", sw=1.4)
    c += P("M-4 4 C-4 1 -2 -3 0 -6", stroke="#ffffff", sw=2, op=.95)
    c += '<circle cx="3" cy="9" r="1.6" fill="#fff"/>'
    return g(c, f"translate({_fmt(x)} {_fmt(y)}) scale({_fmt(s)})")


def tear_pool(side, m, pool, line):
    return g(P(m(pool), fill="#c8ecff", op=.55) + P(m(line), stroke="#ffffff", sw=1.6, op=.95),
             extra=f'clip-path="url(#hi-sc{side})"')


def stream(d, hi=None, rb=None):
    s = P(d, fill="url(#hi-tear)", stroke="#7fcff6", sw=1.1, op=.95)
    if hi:
        s += P(hi, stroke="#ffffff", sw=1.5)
    if rb:
        s += P(rb, stroke="url(#hi-rainbowV)", sw=1.1, op=.9)
    return s


def droplet(x, y, sc=1.0, rot=0):
    tear = "M0 -6 C2 -2 4 1 4 3 C4 6 -4 6 -4 3 C-4 1 -2 -2 0 -6 Z"
    return g(P(tear, fill="url(#hi-tear)", stroke="#7fcff6", sw=1) + '<circle cx="-1.4" cy="2" r=".9" fill="#fff"/>',
             f"translate({_fmt(x)} {_fmt(y)}) rotate({_fmt(rot)}) scale({_fmt(sc)})")


def ex_grin():
    eye = Eye((300, E+2), (306, E-28), (346, E-34), (366, E-4), (354, E-16), (314, E-16),
              lower=(0.04, 0.96), lower_w=2.3, lower_col="#6a2c0e")
    face = draw_eyes(eye, iris_dy=2, lidshadow=False, hl_dy=-6, bright=True)
    # cheeks pushed up under the smiling eyes, and crinkles at the outer corners
    face += both(f"M320 {E+5} C328 {E+1} 338 {E+1} 346 {E+4}", stroke=CREASE, sw=1.2, op=.4)
    for d in (f"M292 {E-4} L284 {E-8}", f"M293 {E+5} L285 {E+8}"):
        reg(d, "stroke")
        face += both(d, stroke=SKIN_LINE, sw=1.5, op=.7)
    mouth = (f"M349 {E+50} C364 {E+57} 398 {E+57} 413 {E+47} C411 {E+64} 399 {E+74} 381 {E+74} "
             f"C363 {E+74} 351 {E+66} 349 {E+50} Z")
    face += mouth_open(mouth, tongue=f"M358 {E+72} C366 {E+62} 394 {E+60} 408 {E+68} L408 {E+80} L358 {E+80} Z",
                       teeth_top=teeth_band([(349, E+50), ((364, E+57), (398, E+57), (413, E+47))], 8),
                       cid="hi-mG")
    face += P(f"M352 {E+59} C367 {E+66} 397 {E+66} 410 {E+57}", stroke="#e6d2dc", sw=1, op=.8)
    face += P(f"M345 {E+46} C347 {E+48} 348 {E+49} 350 {E+51}", stroke=MOUTH_LINE, sw=1.8)
    face += P(f"M412 {E+48} C415 {E+45} 416 {E+43} 417 {E+40}", stroke=MOUTH_LINE, sw=1.8)
    brow = brows(((296, E-52), (308, E-66), (334, E-72), (357, E-66)))
    extras = sparkle(236, 110, 11, "#ffe680") + sparkle(222, 140, 5) + sparkle(540, 214, 8, "#fff2b0")
    extras += sparkle(556, 186, 4.5)
    return face, brow, extras


def ex_soft():
    eye = Eye((302, E+2), (310, E-12), (344, E-18), (364, E-4), (366, E+18), (324, E+30))
    face = draw_eyes(eye, iris_dy=5)
    face += P(f"M364 {E+56} C372 {E+63} 388 {E+63} 396 {E+55}", stroke=MOUTH_LINE, sw=2.1)
    face += P(f"M362 {E+54} C363 {E+56} 364 {E+57} 366 {E+57}", stroke=MOUTH_LINE, sw=1.6, op=.7)
    face += P(f"M395 {E+54} C396 {E+53} 397 {E+53} 398 {E+52}", stroke=MOUTH_LINE, sw=1.6, op=.7)
    brow = brows(((297, E-50), (310, E-61), (334, E-64), (357, E-59)))
    return face, brow, ""


def ex_tired():
    eye = Eye((302, E+4), (310, E-6), (344, E-12), (364, E-2), (366, E+18), (324, E+30),
              crease=7, crease_t=(0.1, 0.8))
    # dark circles under the eyes
    circ = f"M306 {E+22} C318 {E+32} 344 {E+33} 362 {E+18} C358 {E+34} 340 {E+42} 322 {E+40} C312 {E+38} 307 {E+30} 306 {E+22} Z"
    face = both(circ, fill="url(#hi-tired)")
    face += both(f"M312 {E+31} C324 {E+37} 344 {E+36} 357 {E+28}", stroke="#b98aa0", sw=1.3, op=.55)
    face += draw_eyes(eye, iris_dy=5, dull=True)
    face += P(f"M367 {E+58} C374 {E+61} 386 {E+61} 393 {E+56}", stroke=MOUTH_LINE, sw=1.9)
    face += P(f"M392 {E+55} C393 {E+54} 394 {E+53} 395 {E+52}", stroke=MOUTH_LINE, sw=1.5, op=.7)
    brow = brows(((297, E-48), (310, E-56), (334, E-60), (357, E-59)), prof=(1.4, 3.2, 4.4, 4.2))
    return face, brow, ""


def ex_scared():
    eye = Eye((300, E-2), (304, E-36), (348, E-44), (366, E-12), (368, E+24), (320, E+42),
              lower=(0.12, 0.98))
    pool = (f"M304 {E+6} C312 {E+20} 326 {E+26} 340 {E+25} C352 {E+24} 362 {E+16} 366 {E+4} L366 {E-2} "
            f"C360 {E+12} 350 {E+18} 340 {E+19} C326 {E+20} 312 {E+14} 304 {E+1} Z")
    line = f"M305 {E+3} C313 {E+15} 326 {E+20} 340 {E+19} C350 {E+18} 360 {E+12} 365 {E+1}"
    reg(pool)
    face = draw_eyes(eye, iris_dy=-2, iris_r=(16, 19), pupil=(4.5, 6), big=.85, wet=True,
                     inner_extra=lambda side, m: tear_pool(side, m, pool, line))
    # pale: a cool wash on the forehead and round the mouth, kept clear of the blink patch
    # pale: the colour drains from her cheeks; a cold shadow comes down over the forehead
    pale = f'<rect x="270" y="96" width="220" height="44" fill="url(#hi-pale)"/>'
    for x in (316, 326, 336, 346, 414, 424, 434, 444):
        pale += P(f"M{x} 104 L{x} {E-50 + (4 if x % 20 else 0)}", stroke="#6a7ed8", sw=1.6, op=.55)
    pale += (f'<ellipse cx="322" cy="{E+41}" rx="32" ry="13" fill="url(#hi-unblush)"/>'
             f'<ellipse cx="438" cy="{E+41}" rx="32" ry="13" fill="url(#hi-unblush)"/>')
    face += g(pale, extra='clip-path="url(#hi-faceClip)"') + flour_smudge()
    mouth = (f"M358 {E+66} C362 {E+58} 370 {E+53} 380 {E+53} C390 {E+53} 398 {E+58} 402 {E+66} "
             f"C400 {E+72} 396 {E+75} 391 {E+74} C387 {E+76} 383 {E+74} 380 {E+76} C377 {E+74} 373 {E+76} 369 {E+74} "
             f"C364 {E+75} 360 {E+72} 358 {E+66} Z")
    face += mouth_open(mouth, tongue=f"M366 {E+76} C371 {E+70} 389 {E+70} 395 {E+76} Z",
                       teeth_top=teeth_band([(358, E+66), ((362, E+58), (370, E+53), (380, E+53)),
                                             ((390, E+53), (398, E+58), (402, E+66))], 6),
                       cid="hi-mS")
    brow = brows(((295, E-58), (310, E-68), (338, E-76), (359, E-82)), prof=(1.4, 3.2, 4.6, 4.8))
    return face, brow, ""


def ex_blush():
    eye = Eye((302, E+0), (308, E-20), (344, E-26), (364, E-6), (366, E+18), (322, E+28))
    face = draw_eyes(eye, iris_dx=-12, iris_dy=4)
    face += blush_strong()
    face += P(f"M359 {E+58} C365 {E+62} 372 {E+61} 378 {E+58} C386 {E+55} 394 {E+57} 402 {E+51}", stroke=MOUTH_LINE, sw=2.1)
    face += P(f"M357 {E+55} C358 {E+57} 359 {E+58} 361 {E+59}", stroke=MOUTH_LINE, sw=1.5, op=.7)
    face += P(f"M401 {E+50} C403 {E+49} 404 {E+48} 405 {E+46}", stroke=MOUTH_LINE, sw=1.5, op=.7)
    brow = brows(((296, E-55), (311, E-64), (336, E-71), (358, E-72)))
    extras = sweat_drop(488, 128, .9)
    return face, brow, extras


def ex_tears():
    eye = Eye((302, E+8), (312, E-1), (340, E-19), (364, E-15), (362, E+8), (320, E+14),
              lower=(0.1, 0.98), crease=8, crease_t=(0.3, 0.9), lower_w=2)
    pool = (f"M303 {E+5} C312 {E+16} 326 {E+19} 340 {E+18} C352 {E+16} 360 {E+10} 365 {E-2} L365 {E-8} "
            f"C358 {E+3} 350 {E+9} 340 {E+10} C326 {E+11} 312 {E+7} 303 {E-1} Z")
    line = f"M304 {E+2} C313 {E+11} 326 {E+14} 340 {E+13} C350 {E+12} 358 {E+6} 364 {E-4}"
    reg(pool)
    face = draw_eyes(eye, iris_dy=2, big=1.05, wet=True,
                     inner_extra=lambda side, m: tear_pool(side, m, pool, line))
    face += both(f"M312 {E+19} C322 {E+25} 340 {E+25} 354 {E+18}", stroke=CREASE, sw=1.4, op=.6)
    face += blush_strong()
    # tears pour from the outer thirds of the lower lids and run down to the jaw
    st = (f"M316 {E+11} C313 {E+22} 318 {E+30} 316 {E+40} C314 {E+48} 318 {E+58} 326 {E+59} "
          f"C335 {E+60} 337 {E+50} 333 {E+42} C329 {E+34} 325 {E+26} 324 {E+19} C323 {E+15} 320 {E+12} 316 {E+11} Z")
    st2 = (f"M340 {E+16} C337 {E+23} 340 {E+30} 338 {E+37} C336 {E+43} 339 {E+48} 344 {E+47} "
           f"C349 {E+46} 348 {E+40} 346 {E+35} C344 {E+29} 345 {E+22} 340 {E+16} Z")
    for d in (st, st2):
        face += stream(d)
        face += stream(mir(d))
    face += P(f"M317 {E+24} C318 {E+32} 316 {E+42} 318 {E+52}", stroke="#ffffff", sw=1.5)
    face += P(mir(f"M317 {E+24} C318 {E+32} 316 {E+42} 318 {E+52}"), stroke="#ffffff", sw=1.5)
    face += P(f"M331 {E+44} C334 {E+50} 333 {E+55} 329 {E+58}", stroke="url(#hi-rainbowV)", sw=1.1, op=.9)
    for (x, y, sc, rot) in ((334, E+72, 1.0, 0), (428, E+70, .9, 0), (344, E+90, .7, 0), (418, E+92, .6, 0)):
        face += droplet(x, y, sc, rot)
    mouth = (f"M347 {E+68} C352 {E+58} 364 {E+51} 380 {E+51} C396 {E+51} 408 {E+58} 413 {E+68} "
             f"C410 {E+74} 404 {E+77} 397 {E+75} C391 {E+79} 385 {E+77} 380 {E+79} C375 {E+77} 369 {E+79} 363 {E+75} "
             f"C356 {E+77} 350 {E+74} 347 {E+68} Z")
    face += mouth_open(mouth, tongue=f"M360 {E+80} C366 {E+71} 394 {E+71} 400 {E+80} Z",
                       teeth_top=teeth_band([(347, E+68), ((352, E+58), (364, E+51), (380, E+51)),
                                             ((396, E+51), (408, E+58), (413, E+68))], 7),
                       cid="hi-mT")
    face += P(f"M345 {E+70} C344 {E+72} 343 {E+74} 343 {E+76}", stroke=MOUTH_LINE, sw=1.7)
    face += P(f"M415 {E+70} C416 {E+72} 417 {E+74} 417 {E+76}", stroke=MOUTH_LINE, sw=1.7)
    brow = brows(((297, E-46), (314, E-50), (340, E-64), (360, E-82)), prof=(1.4, 3.2, 4.6, 5.0))
    return face, brow, ""


EXPRESSIONS = {"grin": ex_grin, "soft": ex_soft, "tired": ex_tired, "scared": ex_scared,
               "blush": ex_blush, "tears": ex_tears}


# ================================================================== blink overlay
CLOSED_C = ((300, E+3), (314, E+15), (348, E+16), (366, E+1))
CLOSED_LOWER = f"M320 {E+20} C328 {E+23} 340 {E+23} 350 {E+20}"


def closed_lid():
    lash = ribbon(CLOSED_C, (4.6, 6.0, 5.6, 4.0, 2.2), n=20, side=1)
    ox, oy = CLOSED_C[0]
    flick = (f"M{fp((ox+2, oy-4))} Q{fp((ox-4, oy-4))} {fp((ox-10, oy-6))} Q{fp((ox-4, oy))} {fp((ox+1, oy+1))} Z "
             f"M{fp((ox+3, oy))} Q{fp((ox-3, oy+3))} {fp((ox-8, oy+7))} Q{fp((ox-1, oy+6))} {fp((ox+4, oy+4))} Z")
    return lash, flick


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
    lash, flick = closed_lid()
    pts = []
    for d, kind in EYE_SHAPES + [(lash, "fill"), (flick, "fill"), (CLOSED_LOWER, "stroke")]:
        sp = sample_path(d)
        if kind == "stroke":
            sp = [(x + dx, y + dy) for x, y in sp for dx, dy in ((0, -1.3), (0, 1.3), (-1.3, 0), (1.3, 0))]
        pts += sp
    return offset_hull(hull(pts), grow)


def blink_clip():
    d = poly_d(blink_patch_pts())
    d2 = poly_d(blink_patch_pts(BLINK_GROW + 2))
    return (f'<clipPath id="hi-blinkClip"><path d="{d}"/><path d="{mir(d)}"/></clipPath>'
            f'<clipPath id="hi-blinkHairClip"><path d="{d2}"/><path d="{mir(d2)}"/></clipPath>')


def blink_layer():
    s = blink_clip()
    lash, flick = closed_lid()
    lids = face_base()
    lids += both(lash, fill=LASH) + both(flick, fill=LASH)
    lids += both(CLOSED_LOWER, stroke=CREASE, sw=1.3, op=.6)
    hair = crown() + locks() + flyaways()
    s += g(g(lids, extra='clip-path="url(#hi-blinkClip)"') + g(hair, extra='clip-path="url(#hi-blinkHairClip)"'), HEAD_TF)
    return s


def blink():
    return header() + blink_layer() + "\n</svg>\n"


def check_clearance():
    """Distance from every brow (incl. its halo) to the hair clip patch: must stay > 2 px."""
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
        worst = min(dist(p, patch) for d in ds[:2] for p in sample_path(d))
        print(f"{name:8s} brow clearance {worst - 1.3:6.1f}px (incl. halo, vs hair clip)")
    ys = [y for x, y in patch]; xs = [x for x, y in patch]
    print("patch bbox", round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)))


# ================================================================== assemble
def header():
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
            f"<defs>{DEFS}</defs>\n")


def sprite(name):
    face, brow, extras = EXPRESSIONS[name]()
    s = header()
    s += g(hair_back(), HEAD_TF)
    s += body_layers()
    s += f'<g transform="{HEAD_TF}">'
    s += head_back() + ears() + face_base()
    s += f"<!-- face: {name} -->" + face + "<!-- /face -->"
    s += head_front()
    s += brow + extras
    s += "</g>\n</svg>\n"
    return s


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("names", nargs="*", help="expressions to write (default: all of them plus blink)")
    ap.add_argument("--out", default=OUT_ROOT, metavar="DIR",
                    help="output root; files go to DIR/chars/hinata/ (default: %(default)s)")
    ap.add_argument("--check", action="store_true", help="only print brow clearance against the blink patch; write nothing")
    opt = ap.parse_args()
    outdir = os.path.join(opt.out, "chars", "hinata")
    args = opt.names
    if opt.check:
        for n in EXPRESSIONS:
            sprite(n)
        check_clearance()
        sys.exit()
    out = {n: sprite(n) for n in EXPRESSIONS}      # also fills EYE_SHAPES for the blink patch
    out["blink"] = blink()
    targets = args or list(out)
    for n in targets:
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, f"{n}.svg"), "w", encoding="utf-8", newline="\n") as f:
            f.write(out[n])
        print(n, len(out[n]))
