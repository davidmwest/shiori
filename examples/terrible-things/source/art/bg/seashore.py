#!/usr/bin/env python3
"""bg/seashore.svg - the beach at dawn."""
import math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from svglib import *

from outpath import out_path

OUT = out_path('bg/seashore.svg', __doc__)
W, H = 1920, 1080
HZ = 530          # horizon
K = 1.2           # mirror compression
SUNX = 1300
rng = random.Random(412)
doc = Doc()

SKY = [(0.00, "#04213a"), (0.13, "#073f5a"), (0.30, "#0e6a74"), (0.46, "#2f9b8b"),
       (0.59, "#7fcaa6"), (0.69, "#cfe6bf"), (0.78, "#fbe0c9"), (0.87, "#ffbcc6"),
       (0.95, "#ffb3b8"), (1.00, "#ffd2b0")]
doc.d(lg("sky", 0, 0, 0, HZ, SKY))
doc.d(rg("sunglow", SUNX, HZ, 540, [(0, "#fff7e0", 0.95), (0.16, "#ffe6cf", 0.75), (0.42, "#ffc4c6", 0.32), (1, "#ffc4c6", 0)],
         transform=f"translate({SUNX} {HZ}) scale(1.9 1) translate(-{SUNX} -{HZ})"))
doc.d(rg("sunglow2", SUNX, HZ, 150, [(0, "#ffffff", 1), (0.25, "#fff4dc", 0.85), (1, "#ffe8d0", 0)],
         transform=f"translate({SUNX} {HZ}) scale(2.6 1) translate(-{SUNX} -{HZ})"))
for n_, sd in [("b1", 1), ("b2", 2), ("b3", 3), ("b4", 4), ("b8", 8), ("b20", 20)]:
    doc.d(blur(n_, sd))
doc.d('<filter id="bx" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="6 1.2"/></filter>')
doc.d('<filter id="bxs" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="2.5 .6"/></filter>')
doc.d('<filter id="ray" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>')
# water reflection smear: strong horizontal blur, light vertical
doc.d(f'<filter id="smear" filterUnits="userSpaceOnUse" x="-40" y="{HZ-10}" width="2000" height="{H-HZ+20}"><feGaussianBlur stdDeviation="10 2.5"/></filter>')

# ======================================================================= SKY
sky = []
sky.append(rect(0, 0, W, HZ + 2, "url(#sky)"))
doc.d(lg("irid", 0, 0, W, 0, [(0, "#c8b6e6", 0), (0.25, "#c8b6e6", 0.35), (0.5, "#f3c3dc", 0.25), (0.75, "#bfe6dc", 0.3), (1, "#bfe6dc", 0)]))
sky.append(ellipse(900, 440, 1250, 40, "url(#irid)", ' filter="url(#b20)" opacity=".7"'))
sky.append(rect(0, 0, W, HZ + 2, "url(#sunglow)"))

# crepuscular rays fanning up from the sun below the horizon
doc.d(lg("rayg", 0, HZ, 0, 0, [(0, "#fff0e4", 0.0), (0.12, "#fff0e4", 0.5), (1, "#fff0e4", 0)]))
rays = []
for ang, wid in [(-62, 26), (-41, 34), (-24, 22), (-8, 40), (9, 26), (27, 36), (45, 22), (63, 30)]:
    a = math.radians(ang)
    L = 900
    wa = math.radians(wid / 10)
    p1 = (SUNX + math.sin(a - wa) * L, HZ - math.cos(a - wa) * L)
    p2 = (SUNX + math.sin(a + wa) * L, HZ - math.cos(a + wa) * L)
    rays.append(path(poly([(SUNX, HZ + 10), p1, p2]), "url(#rayg)"))
sky.append(f'<g opacity=".17" filter="url(#ray)">' + "".join(rays) + "</g>")

# stars fading into the dawn
sd = []
for i in range(160):
    x = rng.uniform(0, W)
    y = rng.random() ** 1.7 * 320
    if abs(x - SUNX) < 300 and y > 150:
        continue
    a = max(0.0, 1 - y / 320)
    sd.append((x, y, rng.choice([1.4, 1.8, 2.2, 2.6, 3.2]) * (0.6 + 0.5 * a), a))
for band, (lo, hi, op) in enumerate([(0.66, 1.01, 0.9), (0.33, 0.66, 0.55), (0, 0.33, 0.25)]):
    sky.append(dots_path([(x, y, d) for x, y, d, a in sd if lo <= a < hi], "#f2fbff", op))
for (x, y, r) in [(330, 66, 9), (812, 112, 6), (1702, 52, 7), (1090, 34, 5), (60, 160, 5)]:
    sky.append(circle(x, y, r * 1.7, "#d8fff6", ' opacity=".2" filter="url(#b2)"'))
    sky.append(path(star4(x, y, r), "#ffffff", ' opacity=".9"'))

# waning crescent moon, lit toward the sun
MX, MY, MR = 1560, 132, 20
doc.d(f'<mask id="moonm"><rect x="{MX-40}" y="{MY-40}" width="80" height="80" fill="#000"/>'
      f'{circle(MX, MY, MR, "#fff")}{circle(MX+8, MY-7, MR*0.97, "#000")}</mask>')
sky.append(circle(MX, MY, 80, "#e6fff5", ' opacity=".12" filter="url(#b20)"'))
sky.append(circle(MX, MY, MR, "#7fb9b0", ' opacity=".14"'))
sky.append(f'<g mask="url(#moonm)">{circle(MX, MY, MR, "#fffaf0")}</g>')

# --- clouds: union shapes, organic edges from a turbulence displacement, lit from below
doc.d('<filter id="wisp" x="-10%" y="-80%" width="120%" height="260%"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.02" numOctaves="4" seed="3" result="n"/>'
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="60" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.7"/></filter>')
doc.d('<filter id="cirrus" x="-10%" y="-150%" width="120%" height="400%"><feTurbulence type="fractalNoise" baseFrequency="0.003 0.06" numOctaves="3" seed="8" result="n"/>'
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="90" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.6 .8"/></filter>')

clouds = []
cir = []
r3 = random.Random(31)
for (cx, cy, w) in [(380, 70, 700), (760, 132, 900), (240, 190, 500), (1720, 96, 420), (1180, 60, 380)]:
    for i in range(4):
        cir.append(ellipse(cx + r3.uniform(-w*0.25, w*0.25), cy + r3.uniform(-14, 14), w * r3.uniform(0.25, 0.45), r3.uniform(3, 7), "#f3b6c9"))
clouds.append('<g filter="url(#cirrus)" opacity=".42">' + "".join(cir) + "</g>")


def stratus(cid, cx, cy, w, h, top, mid, bot, rim, seed, n=9):
    rr = random.Random(seed)
    parts = []
    for i in range(n):
        t = (i + 0.5) / n
        x = cx - w / 2 + w * t + rr.uniform(-w * 0.05, w * 0.05)
        prof = math.sin(math.pi * t) ** 0.6
        ry = h * prof * rr.uniform(0.55, 1.0)
        parts.append(ellipse(x, cy - ry * 0.35, w / n * rr.uniform(0.9, 1.5), ry, "#000"))
    shape = "".join(parts).replace(' fill="#000"', "")
    doc.d(lg(cid, 0, cy - h * 1.3, 0, cy + h * 0.65, [(0, top), (0.55, mid), (0.86, bot), (1, rim)]))
    out = f'<g filter="url(#wisp)"><g transform="translate(0 3)" fill="{rim}">' + shape + "</g>"
    out += f'<g fill="url(#{cid})">' + shape + "</g>"
    lob = "".join(ellipse(cx + rr.uniform(-w * 0.35, w * 0.35), cy - h * rr.uniform(0.1, 0.5), w * rr.uniform(0.06, 0.12), h * rr.uniform(0.2, 0.4), "#fff") for _ in range(5))
    out += f'<g opacity=".12">{lob}</g></g>'
    return out


MID = [("s1", 520, 206, 820, 34, "#3a6c80", "#9b8fb0", "#f6a0bc", "#ffd8e0", 7, 10),
       ("s2", 1480, 290, 720, 30, "#4d8290", "#b39fbe", "#fbaabe", "#ffdeda", 8, 9),
       ("s3", 640, 362, 900, 22, "#7aa79f", "#d0b3c8", "#ffbdc2", "#ffe8d8", 9, 11),
       ("s4", 1720, 398, 520, 18, "#9cbcb0", "#dfbdcb", "#ffc4c0", "#ffecdc", 10, 7),
       ("s5", 230, 428, 460, 14, "#b4c9b8", "#e9c4ce", "#ffcdc4", "#fff0e0", 11, 6)]
for args in MID:
    clouds.append(stratus(*args))
# thin glowing streaks low in the sky
for (x, y, w, c, o) in [(1050, 468, 560, "#ffd9cf", .55), (300, 496, 520, "#ffe2d2", .55), (1180, 522, 760, "#fff2de", .6),
                        (1640, 462, 300, "#ffd0cc", .45), (420, 462, 260, "#ffd3d6", .4), (1560, 508, 420, "#ffe6d6", .5)]:
    clouds.append(ellipse(x, y, w / 2, 2.2, c, f' opacity="{o}" filter="url(#bx)"'))
sky.append("<g>" + "".join(clouds) + "</g>")
# sun cresting
sky.append(rect(0, HZ - 200, W, 202, "url(#sunglow2)", ' opacity=".9"'))
# the first sliver of the sun breaking the horizon, with a soft gold corona
doc.d(rg("corona", SUNX, HZ, 120, [(0, "#fff6d6", 0.95), (0.25, "#ffe0a8", 0.55), (0.6, "#ffc6a8", 0.18), (1, "#ffc6a8", 0)]))
sky.append(circle(SUNX, HZ, 120, "url(#corona)"))
sky.append(path(f"M{SUNX-30} {HZ+1}A30 30 0 0 1 {SUNX+30} {HZ+1}Z", "#fffbea"))
sky.append(path(f"M{SUNX-30} {HZ+1}A30 30 0 0 1 {SUNX+30} {HZ+1}", "none", ' stroke="#ffe7b0" stroke-width="3" opacity=".8" filter="url(#b2)"'))
sky.append('<g>' + ellipse(SUNX, HZ + 1, 60, 6, "#fffdf5", ' filter="url(#b2)"') + '</g>')
# birds
for (x, y, s) in [(560, 300, 9), (590, 318, 6.5), (1010, 250, 7)]:
    sky.append(path(f"M{f(x-s)} {f(y-s*0.35)}Q{f(x-s*0.45)} {f(y-s*0.55)} {f(x)} {f(y)}Q{f(x+s*0.45)} {f(y-s*0.55)} {f(x+s)} {f(y-s*0.35)}",
                    "none", ' stroke="#2c4d5a" stroke-width="1.7" stroke-linecap="round" opacity=".8"'))

doc.d('<g id="skyall">' + "".join(sky) + "</g>")
doc.a('<use href="#skyall"/>')

# ======================================================================= GLASS HILL + SHIOMI (far left)
hill_pts = [(-30, 552), (-10, 506), (30, 482), (80, 458), (122, 438), (160, 422), (205, 412), (250, 411), (292, 418),
            (326, 430), (356, 448), (388, 472), (422, 498), (462, 520), (515, 538), (575, 552)]
hill_d = catmull(hill_pts) + "Z"
doc.d(lg("hillg", 0, 405, 0, 548, [(0, "#3d5578"), (0.55, "#384f71"), (1, "#3a4f70")]))
doc.d(lg("hillhaze", 0, 405, 0, 548, [(0, "#f4c6cf", 0), (1, "#f8c8cf", 0.38)]))
town = []
town.append(path(hill_d, "url(#hillg)"))
# lit (sun-facing) right flank: a faint pink rim
town.append(path(catmull([(250, 411), (292, 418), (326, 430), (356, 448), (388, 472), (422, 498), (462, 520), (515, 538), (575, 550)]),
                 "none", ' stroke="#ffc9d2" stroke-width="2" opacity=".55" filter="url(#b1)"'))
# a lower front shoulder
sh = catmull([(-30, 552), (-20, 522), (50, 512), (130, 522), (210, 534), (280, 552)]) + "Z"
town.append(path(sh, "#334a6a"))
tg = []
# trees on the crown
for (x, y, r) in [(150, 426, 9), (166, 421, 11), (182, 418, 9), (286, 418, 9), (300, 424, 8), (314, 431, 8), (136, 433, 8)]:
    tg.append(circle(x, y, r, "#344c6d"))
# kiln-house roof
tg.append(path("M262 413 L270 405 L288 405 L296 413Z", "#28405e"))
tg.append(rect(265, 413, 28, 6, "#3e5677"))
# the long Glasshouse catching the dawn
tg.append(path("M196 414 L203 402.5 L250 402.5 L257 414Z", "#ffe7da"))
tg.append(path("M203 402.5 L250 402.5 L253 407.5 L200 407.5Z", "#ffffff", ' opacity=".9"'))
tg.append(rect(196, 414, 61, 3, "#5d5470"))
tg.append(ellipse(227, 408, 52, 14, "#ffd3c8", ' opacity=".55" filter="url(#b8)"'))
for xx in range(206, 252, 6):
    tg.append(path(f"M{xx} 403 L{xx-1.5} 414", "none", ' stroke="#b98fa0" stroke-width=".7" opacity=".7"'))
tg.append(path(star4(243, 403, 10, .12), "#ffffff"))
# the 412 steps zig-zagging down
steps = [(276, 420), (332, 440), (296, 456), (366, 474), (322, 490), (398, 506), (356, 520), (430, 534)]
tg.append(path(poly(steps, False), "none", ' stroke="#9fb3cf" stroke-width="1.5" stroke-linejoin="round" opacity=".5"'))
roofB, roofO = "#2f5584", "#c06a58"
r2 = random.Random(7)
houses = []
for row, (y0, x0, x1, s) in enumerate([(546, 0, 470, 1.0), (535, 0, 410, 0.92), (524, 0, 350, 0.86), (512, 0, 260, 0.8), (500, 10, 160, 0.74)]):
    x = x0 + r2.uniform(0, 8)
    while x < x1:
        w = r2.uniform(11, 19) * s
        h = r2.uniform(6, 9) * s
        yb = y0 + r2.uniform(-2, 2)
        houses.append((x, yb, w, h, r2.random() < 0.55))
        x += w + r2.uniform(1, 5)
lit = []
for (x, yb, w, h, blue) in houses:
    tg.append(rect(x, yb - h, w, h, mix("#d4c0cc", "#5f7493", 0.55)))
    rc = mix(roofB if blue else roofO, "#6e7f9e", 0.35)
    tg.append(path(f"M{f(x-2)} {f(yb-h)} L{f(x+w*0.18)} {f(yb-h-5)} L{f(x+w*0.82)} {f(yb-h-5)} L{f(x+w+2)} {f(yb-h)}Z", rc))
    if r2.random() < 0.42:
        lit.append((x + r2.uniform(2, max(2.5, w - 4)), yb - h + 2))
for (x, y) in lit:
    tg.append(rect(x, y, 2.4, 2.4, "#ffd28c"))
tg.append(dots_path([(x + 1.2, y + 1.2, 9) for x, y in lit], "#ffcf8a", 0.28, ' filter="url(#b2)"'))
# breakwater + lighthouse
tg.append(path("M430 546 L640 543 L644 549 L430 551Z", "#35496a"))
tg.append(rect(634, 528, 6, 16, "#ece4ec"))
tg.append(path("M633 528 L637 522 L641 528Z", "#c06a58"))
tg.append(circle(637, 531, 9, "#ff7a7a", ' opacity=".55" filter="url(#b2)"'))
tg.append(circle(637, 531, 1.7, "#ffd8d0"))
town.append("".join(tg))
town.append(path(hill_d, "url(#hillhaze)"))
doc.d(f'<g id="town"><g transform="translate(0 {HZ-548})">' + "".join(town) + "</g></g>")

# ======================================================================= SHORE GEOMETRY
SHORE = [(-40, 628), (300, 642), (640, 666), (980, 702), (1320, 752), (1640, 816), (1960, 896)]
DRY = [(-40, 700), (260, 722), (560, 752), (860, 794), (1160, 850), (1460, 922), (1760, 1006), (1960, 1070)]


def shore_y(x):
    return interp_pts(SHORE, x)


def dry_y(x):
    return interp_pts(DRY, x)


def sea_y(x, dz):
    """Screen y of a line parallel to the shore, dz further out (perspective)."""
    zs = 1.0 / (shore_y(x) - HZ)
    return HZ + 1.0 / (zs + dz)


def persp(y):
    """scale factor at screen y (1 at y=HZ+100)."""
    return max(0.02, (y - HZ) / 100)


sea_top = f"M-40 {HZ} L1960 {HZ} L1960 {f(shore_y(1960))} "
xs_ = [1960 - i * 40 for i in range(51)]
sea_clip = sea_top + "".join(f"L{f(x)} {f(shore_y(x))}" for x in xs_) + "Z"
shore_curve = catmull([(x, shore_y(x)) for x in range(-40, 1961, 80)])
dry_curve = catmull([(x, dry_y(x)) for x in range(-40, 1961, 80)])
wet_d = shore_curve + "L1960 1100 L-40 1100Z"
dry_d = dry_curve + "L1960 1100 L-40 1100Z"
doc.d(f'<clipPath id="seaC"><path d="{sea_clip}"/></clipPath>')
doc.d(f'<clipPath id="wetC"><path d="{wet_d}"/></clipPath>')
doc.d(f'<clipPath id="dryC"><path d="{dry_d}"/></clipPath>')


# ======================================================================= SEA
def pl(pts):
    """compact polyline path data"""
    return "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts)


def band_pl(a, b):
    return pl(a) + "L" + "L".join(f"{f(x)} {f(y)}" for x, y in reversed(b)) + "Z"


SEA = [(0, "#ffe6cc"), (0.03, "#ffc9c2"), (0.09, "#f2abc4"), (0.2, "#a99fd2"), (0.36, "#5b9fc0"),
       (0.58, "#20a3a6"), (0.8, "#25b8aa"), (1, "#3fd2b4")]
doc.d(lg("seag", 0, HZ, 0, 840, SEA))
doc.a('<g clip-path="url(#seaC)">')
doc.a(rect(0, HZ, W, 300, "url(#seag)"))
mirror = f"matrix(1 0 0 {f2(-1/K)} 0 {f(HZ + HZ / K)})"
doc.a(f'<g filter="url(#smear)" opacity=".42"><use href="#skyall" transform="{mirror}"/></g>')
doc.a(f'<use href="#town" transform="matrix(1 0 0 -.5 0 {f(HZ*1.5)})" opacity=".4" filter="url(#bxs)"/>')
# cool shadowed left, warm toward the sun
doc.d(lg("seaside", 0, 0, W, 0, [(0, "#123f66", 0.32), (0.4, "#123f66", 0), (1, "#123f66", 0.08)]))
doc.a(rect(0, HZ, W, 300, "url(#seaside)"))
# sun path
doc.d(rg("sunpath", SUNX, HZ, 300, [(0, "#fff6e2", 0.95), (0.3, "#ffe6cf", 0.5), (1, "#ffdccc", 0)],
         transform=f"translate({SUNX} {HZ}) scale(.4 1.2) translate(-{SUNX} -{HZ})"))
doc.a(rect(SUNX - 260, HZ, 520, 360, "url(#sunpath)"))

# ripples: short horizontal strokes, perspective-scaled
groups = {}
for i in range(1100):
    t = rng.random() ** 1.6
    y = HZ + 1.5 + t * 290
    x = rng.uniform(-40, W + 40)
    if y > shore_y(x) - 2:
        continue
    p = persp(y)
    ln = (6 + 36 * p) * rng.uniform(0.4, 1.3)
    th = round(max(1, min(3.5, 0.6 + 1.1 * p)) * 2) / 2
    near = math.exp(-((x - SUNX) / (50 + 160 * p)) ** 2)
    u = rng.random()
    if u < 0.15 + 0.75 * near:
        key = ("#fff8ea", th, 0.9 if near > 0.5 else 0.5)
    elif u < 0.5:
        key = ("#ffdcd6" if y < HZ + 50 else "#c9fff0", th, 0.35)
    else:
        key = ("#1d5f86" if y < HZ + 60 else "#0f6a72", th, 0.28)
    groups.setdefault(key, []).append((x - ln / 2, y, ln))
for (col, th, op), items in sorted(groups.items(), key=lambda kv: kv[0][2]):
    doc.a(dashes_path(items, col, th, op))
glit = []
for i in range(110):
    t = rng.random() ** 1.4
    y = HZ + 2 + t * 150
    x = SUNX + rng.gauss(0, 16 + 110 * t)
    if y < shore_y(x) - 4:
        glit.append((x, y, rng.uniform(1.6, 3.0 + 4 * t)))
doc.a(dots_path(glit, "#ffffff", 0.9))
doc.a(dots_path([(x, y, d * 3.2) for x, y, d in glit[::3]], "#fff1d6", 0.35, ' filter="url(#b2)"'))

# ---------------- waves ----------------
FACE = ["#effff2", "#b8f7dc", "#74e0c6", "#3bb8ae", "#1f8c8e"]
doc.d(rg("facesun", SUNX + 60, 690, 470, [(0, "#fff3c8", 0.9), (0.35, "#e8ffc8", 0.42), (1, "#e8ffc8", 0)],
         transform=f"translate({SUNX+60} 690) scale(1.5 .42) translate(-{SUNX+60} -690)"))


def foam_net(rr, x0, x1, dz0, dz1, cell, rows, op0, keep):
    """Irregular foam lace: a jittered net between two lines parallel to the shore."""
    R = []
    for k in range(rows + 1):
        v = k / rows
        dzv = dz0 + (dz1 - dz0) * v
        row = []
        x = x0 + rr.uniform(0, cell)
        while x < x1:
            y = sea_y(x, dzv)
            p = persp(y)
            if rr.random() < keep(x):
                row.append((x + rr.uniform(-.3, .3) * cell * p, y + rr.uniform(-.25, .25) * cell * p * 0.3, p))
            x += cell * p * rr.uniform(0.7, 1.3)
        R.append(row)
    segs = [[] for _ in range(3)]
    for k, row in enumerate(R):
        g = min(2, int(3 * k / (rows + 1)))
        for i in range(len(row) - 1):
            (xa, ya, pa), (xb, yb, pb) = row[i], row[i + 1]
            if xb - xa > cell * pa * 1.8 or rr.random() > 0.85:
                continue
            segs[g].append(f"M{f(xa)} {f(ya)}Q{f((xa+xb)/2)} {f((ya+yb)/2 + rr.uniform(-2, 2)*pa)} {f(xb)} {f(yb)}")
        if k < rows:
            nxt = R[k + 1]
            for (xa, ya, pa) in row:
                if not nxt or rr.random() > 0.7:
                    continue
                xb, yb, pb = min(nxt, key=lambda q: abs(q[0] - xa - rr.uniform(-6, 6)))
                if abs(xb - xa) > cell * pa:
                    continue
                segs[g].append(f"M{f(xa)} {f(ya)}Q{f((xa+xb)/2 + rr.uniform(-3, 3)*pa)} {f((ya+yb)/2)} {f(xb)} {f(yb)}")
    out = ""
    for g in range(3):
        if segs[g]:
            out += (f'<path d="{"".join(segs[g])}" fill="none" stroke="#f6fffc" stroke-width="{f(1.5 - 0.3*g)}" '
                    f'stroke-linecap="round" opacity="{f2(op0 * (1 - 0.3 * g))}"/>')
    return out


def wave(dz, x0, face_h, foam_h, seed, broken=(0.0, 1.0), holes_n=80, peak=0.6, net=None):
    rr = random.Random(seed)
    NX = 40
    xs = [x0 + (2000 - x0) * i / NX for i in range(NX + 1)]
    b0, b1 = broken

    def env(x):
        u = (x - x0) / (2000 - x0)
        return smoothstep(0, 0.2, u) * (0.55 + 0.45 * math.exp(-((u - peak) / 0.45) ** 2))

    def brk(x):
        u = (x - x0) / (2000 - x0)
        return smoothstep(b0, b0 + 0.07, u) * (1 - smoothstep(b1 - 0.07, b1, u))

    crest = [(x, sea_y(x, dz) + 1.3 * math.sin(x / 41 + seed) * persp(sea_y(x, dz))) for x in xs]
    fh = lambda x, y: face_h * persp(y) * env(x)
    off = lambda k: [(x, y + fh(x, y) * k) for x, y in crest]
    out = []
    out.append(path(band_pl(off(-0.8), crest), "#0d4e66", ' opacity=".2"'))
    N = len(FACE)
    out.append('<g opacity=".92">' + "".join(path(band_pl(off(i / N), off((i + 1) / N + 0.05)), FACE[i]) for i in range(N)) + "</g>")
    doc.d(f'<path id="wf{seed}" d="{band_pl(crest, off(1.0))}"/>')
    out.append(f'<use href="#wf{seed}" fill="url(#facesun)" opacity=".7"/>')
    # dark line where the face meets the flat water in front
    out.append(path(pl(off(1.0)), "none", ' stroke="#0f5e6c" stroke-width="2" opacity=".25"'))
    st = []
    for i in range(holes_n // 2):
        x = rr.uniform(x0 + 60, 1990)
        y = sea_y(x, dz)
        p = persp(y)
        st.append((x, y + fh(x, y) * rr.uniform(0.2, 0.75), rr.uniform(10, 40) * p * env(x)))
    out.append(dashes_path(st, "#f2fff8", 1.1, 0.5))
    # foam crest + spilling whitewater with holes
    up, lo = [], []
    for (x, y) in crest:
        p = persp(y)
        bk = brk(x)
        th = foam_h * p * env(x) * (0.3 + 0.7 * bk) * rr.uniform(0.85, 1.15)
        up.append((x, y - th * 0.6 - abs(math.sin(x / (6 + 4 * p) + seed)) * th * 0.4))
        lo.append((x, y + th * 0.4 + bk * fh(x, y) * rr.uniform(0.8, 1.05)))
    band = band_pl(up, lo)
    doc.d(f'<path id="wb{seed}" d="{band}"/>')
    holes = []
    for i in range(holes_n):
        x = rr.uniform(x0 + 30, 1990)
        j = min(NX, max(0, int((x - x0) / (2000 - x0) * NX)))
        ytop, ybot = up[j][1], lo[j][1]
        hgt = ybot - ytop
        if hgt < 8:
            continue
        p = persp(crest[j][1])
        rx = rr.uniform(2.5, 8) * p
        ry = min(rx * 0.34, hgt * 0.15)
        holes.append(epath(x, rr.uniform(ytop + hgt * 0.42, ybot - ry - 1.5), rx, ry))
    out.append(path(pl(up), "none", ' stroke="#0d4e66" stroke-width="3" opacity=".18" filter="url(#b1)" transform="translate(0 -2)"'))
    out.append(f'<path d="{band}{"".join(holes)}" fill="#fffaf7" fill-rule="evenodd" opacity=".97"/>')
    lo_sh = [(x, a + (b - a) * 0.62) for (x, a), (_, b) in zip(up, lo)]
    out.append(path(band_pl(lo_sh, lo), "#a9e4e2", ' opacity=".4"'))
    out.append(path(pl(up), "none", ' stroke="#fff3dc" stroke-width="1.6" stroke-linejoin="round" opacity=".95"'))
    out.append(f'<use href="#wb{seed}" fill="url(#facesun)" opacity=".45"/>')
    if net:
        dzn, cell, rows, op = net
        out.append(foam_net(rr, x0 + 40, 1990, dz * 0.93, dzn, cell, rows, op, lambda x: 0.25 + 0.75 * brk(x)))
    return "".join(out)


waves = []
waves.append(wave(0.0135, 0, 3.2, 2.6, 1, broken=(0.62, 0.86), holes_n=30, peak=0.7))
waves.append(wave(0.0080, 120, 5.2, 3.8, 2, broken=(0.40, 0.76), holes_n=60, peak=0.6, net=(0.0050, 19, 3, 0.4)))
waves.append(wave(0.0044, 300, 8.5, 5.4, 4, broken=(0.25, 0.7), holes_n=70, peak=0.55, net=(0.0025, 21, 4, 0.45)))
waves.append(wave(0.0016, 560, 14, 7.5, 3, broken=(0.12, 0.6), holes_n=110, peak=0.6, net=(0.0003, 23, 5, 0.5)))
doc.a("<g>" + "".join(waves) + "</g>")
for (x, dz, s) in [(SUNX + 60, 0.0016, 16), (SUNX - 110, 0.0044, 11), (SUNX + 250, 0.0080, 8), (SUNX + 470, 0.0016, 11), (SUNX - 330, 0.0135, 6)]:
    y = sea_y(x, dz) - 4
    doc.a(circle(x, y, s * 1.4, "#fff3d8", ' opacity=".5" filter="url(#b3)"'))
    doc.a(path(star4(x, y, s, .12), "#ffffff"))
doc.a("</g>")

# ======================================================================= WET SAND (mirror)
doc.d(lg("wetbase", 0, 600, 0, 1000, [(0, "#c48aa6"), (0.5, "#9a6f9e"), (1, "#735a96")]))
doc.a(path(wet_d, "url(#wetbase)"))
doc.a(f'<g clip-path="url(#wetC)" opacity=".72"><g filter="url(#smear)"><use href="#skyall" transform="{mirror}"/></g></g>')
doc.d(rg("wetsun", SUNX + 150, 770, 360, [(0, "#fff3e0", 0.85), (0.45, "#ffd9cf", 0.3), (1, "#ffd9cf", 0)],
         transform=f"translate({SUNX+150} 770) scale(.38 1.3) translate(-{SUNX+150} -770)"))
doc.a('<g clip-path="url(#wetC)">')
doc.a(rect(SUNX - 300, 600, 900, 480, "url(#wetsun)"))
sheen = []
for _ in range(60):
    x = rng.uniform(-40, 1960)
    y = rng.uniform(shore_y(x) + 6, dry_y(x) - 4)
    if y > dry_y(x) - 4:
        continue
    sheen.append((x, y, rng.uniform(30, 160) * persp(y)))
doc.a(dashes_path(sheen, "#fff3ec", 1.6, 0.25, extra=' filter="url(#bxs)"'))
doc.a("</g>")
doc.a(path(dry_curve, "none", ' stroke="#6f5778" stroke-width="12" opacity=".2" filter="url(#b4)" transform="translate(0 -4)"'))

# ---------------- shallow water + swash ----------------
rs = random.Random(9)
edge = []
x = -40
while x < 2000:
    p = persp(shore_y(x))
    lob = rs.uniform(50, 150) * (0.5 + 0.5 * p)
    edge.append((x, shore_y(x) + 8 * p + rs.uniform(-1.5, 1.5)))
    mx = x + lob / 2
    pm = persp(shore_y(mx))
    edge.append((mx, shore_y(mx) + (8 + rs.uniform(6, 15)) * pm))
    x += lob
sheet_top = [(x, sea_y(x, 0.0005)) for x in range(-40, 1961, 40)]
sheet = catmull(sheet_top) + "L" + catmull(list(reversed(edge)))[1:] + "Z"
doc.d(lg("sheet", 0, 600, 0, 900, [(0, "#8eeedb", 0.55), (0.5, "#bdf6e6", 0.35), (1, "#ffe6ec", 0.25)]))
doc.a(path(sheet, "url(#sheet)"))
doc.a(path(catmull([(x, y + 3) for x, y in edge]), "none", ' stroke="#5e4f6c" stroke-width="2.6" opacity=".2" filter="url(#b1)"'))
doc.a(path(catmull(edge), "none", ' stroke="#fff8f6" stroke-width="2.6" stroke-linecap="round" opacity=".95"'))
bub = []
for i in range(220):
    x = rs.uniform(-20, 1940)
    y = shore_y(x) + rs.uniform(-6, 14) * persp(shore_y(x))
    bub.append((x, y, rs.choice([1.5, 2, 2.5, 3]) * (0.5 + 0.5 * persp(y))))
doc.a(dots_path(bub, "#fffaf8", 0.65))

# ======================================================================= DRY SAND
doc.d(lg("sand", 0, 690, 0, 1080, [(0, "#ffdcc2"), (0.25, "#f8c3bb"), (0.65, "#d69db4"), (1, "#a179a8")]))
doc.d(rg("sandwarm", 1150, 760, 720, [(0, "#ffe9cf", 0.75), (1, "#ffe9cf", 0)],
         transform="translate(1150 760) scale(1.4 .5) translate(-1150 -760)"))
doc.d(rg("sandcool", 0, 1080, 800, [(0, "#7d6aa6", 0.55), (1, "#7d6aa6", 0)],
         transform="translate(0 1080) scale(1.3 .7) translate(0 -1080)"))
doc.a(path(dry_d, "url(#sand)"))
doc.a(path(dry_d, "url(#sandwarm)"))
doc.a(path(dry_d, "url(#sandcool)"))
doc.a(path(catmull([(x, dry_y(x) + 2) for x in range(-40, 1961, 80)]), "none", ' stroke="#fff1ea" stroke-width="1.6" opacity=".6"'))
dunes = []
for (x, y, w, h) in [(300, 800, 520, 40), (90, 940, 600, 60), (720, 910, 480, 36), (1010, 1020, 520, 40)]:
    dunes.append(ellipse(x, y, w, h, "#fff1e6", ' opacity=".3" filter="url(#b20)"'))
    dunes.append(ellipse(x + 30, y + h * 0.9, w * 0.9, h * 0.5, "#9a7aa8", ' opacity=".22" filter="url(#b20)"'))
hi_, lo_ = [], []
for i in range(46):
    x = rng.uniform(-100, 1500)
    dy = dry_y(x)
    y = rng.uniform(dy + 24, 1075)
    w = rng.uniform(70, 210) * (0.5 + (y - 660) / 600)
    sl = 0.09 + rng.uniform(-0.02, 0.02)
    c = (x + w * 0.5, y + w * sl * 0.5 - rng.uniform(4, 9))
    hi_.append(f"M{f(x)} {f(y)}Q{f(c[0])} {f(c[1])} {f(x+w)} {f(y+w*sl)}")
    lo_.append(f"M{f(x)} {f(y+3)}Q{f(c[0])} {f(c[1]+3)} {f(x+w)} {f(y+w*sl+3)}")
grain = [(rng.uniform(0, 1700), rng.uniform(680, 1080), rng.choice([1.5, 2, 2.5])) for _ in range(300)]
grain = [(x, y, d) for x, y, d in grain if y > dry_y(x) + 6]
doc.a('<g clip-path="url(#dryC)">' + "".join(dunes)
      + path("".join(lo_), "none", ' stroke="#946f92" stroke-width="2" stroke-linecap="round" opacity=".22"')
      + path("".join(hi_), "none", ' stroke="#fff4ef" stroke-width="2.2" stroke-linecap="round" opacity=".5"')
      + dots_path(grain[:150], "#9c7f9f", 0.35) + dots_path(grain[150:], "#fff6f0", 0.5) + "</g>")

# one line of footprints walking down into the surf (Nagi, carrying her)
fp = []
N = 15
for i in range(N):
    t = i / (N - 1)
    x = lerp(470, 905, t ** 0.9) + (10 if i % 2 else -10) * (1 - 0.6 * t)
    y = lerp(1100, dry_y(905) + 30, t)
    p = persp(y) * 0.62
    rx, ry = 7.5 * p, 3.6 * p
    ang = -24 + 8 * t
    fp.append(f'<g transform="translate({f(x)} {f(y)}) rotate({f(ang)})">'
              + ellipse(0, 0, rx, ry, "#7f6088", ' opacity=".36"')
              + ellipse(rx * 0.12, ry * 0.35, rx * 0.8, ry * 0.55, "#fff3ec", ' opacity=".35"')
              + ellipse(-rx * 1.25, -ry * 0.1, rx * 0.42, ry * 0.75, "#7f6088", ' opacity=".3"')
              + "</g>")
doc.a("<g>" + "".join(fp) + "</g>")


def seaglass(x, y, s, col, rot):
    pts = []
    rr = random.Random(int(x * 7 + y))
    for k in range(6):
        a = k / 6 * math.tau
        rad = s * rr.uniform(0.7, 1.1)
        pts.append((x + math.cos(a) * rad * 1.3, y + math.sin(a) * rad * 0.6))
    out = ellipse(x + 1, y + s * 0.55, s * 1.4, s * 0.28, "#5c4a62", ' opacity=".25"')
    out += circle(x, y, s * 2.2, col, ' opacity=".35" filter="url(#b3)"')
    out += path(catmull(pts, closed=True), col, ' opacity=".9"')
    out += ellipse(x - s * 0.35, y - s * 0.2, s * 0.45, s * 0.16, "#ffffff", ' opacity=".9"')
    out += path(star4(x - s * 0.4, y - s * 0.3, s * 1.8, .12), "#ffffff", ' opacity=".9"')
    return f'<g transform="rotate({rot} {f(x)} {f(y)})">{out}</g>'


def shell(x, y, s, rot):
    d = f"M{f(x)} {f(y+s*0.5)}L{f(x-s)} {f(y-s*0.2)}Q{f(x)} {f(y-s*1.3)} {f(x+s)} {f(y-s*0.2)}Z"
    out = ellipse(x, y + s * 0.65, s * 0.9, s * 0.2, "#7b6177", ' opacity=".22"') + path(d, "#ffd8dc")
    rib = "".join(f"M{f(x)} {f(y+s*0.45)}L{f(x+k*s*0.38)} {f(y-s*0.6+abs(k)*s*0.18)}" for k in range(-2, 3))
    out += path(rib, "none", ' stroke="#df9eab" stroke-width=".9"')
    return f'<g transform="rotate({rot} {f(x)} {f(y)})">{out}</g>'


bits = []
for (x, y, s, c, r_) in [(612, 760, 6, "#7fe8d6", -12), (930, 848, 5, "#ffc65e", 20), (360, 872, 7, "#9fb4ff", 8),
                          (1180, 930, 6, "#ff9fc4", -25), (232, 790, 5, "#b0f2a6", 15), (760, 738, 4.5, "#c9a4ff", 10)]:
    bits.append(seaglass(x, y, s, c, r_))
for (x, y, s, r_) in [(480, 940, 9, -15), (800, 1000, 7, 25), (150, 990, 8, 5), (1040, 1046, 6, -30), (690, 790, 6, 12)]:
    bits.append(shell(x, y, s, r_))
peb = [(rng.uniform(0, 1400), rng.uniform(760, 1075), rng.choice([3, 4, 5])) for _ in range(30)]
bits.append(dots_path([(x, y, d) for x, y, d in peb if y > dry_y(x) + 8], "#a08aa0", 0.6))
doc.a("<g>" + "".join(bits) + "</g>")

# ---------------- glass fishing float (ukidama) half sunk in the sand ----------------
FX, FY, FR = 196, 762, 32
doc.d(rg("flt", FX - 10, FY - 12, FR * 1.15, [(0, "#f2fff8", 0.92), (0.35, "#a6f2dc", 0.6), (0.8, "#3fb7a8", 0.65), (1, "#1f7f86", 0.9)]))
doc.d(rg("caus", FX + 34, FY + 16, 64, [(0, "#b8ffe6", 0.8), (0.5, "#9ff3ff", 0.28), (1, "#9ff3ff", 0)],
         transform=f"translate({FX+34} {FY+16}) scale(1.6 .42) translate(-{FX+34} -{FY+16})"))
doc.d(lg("fltrim", FX - FR, FY - FR, FX + FR, FY + FR, [(0, "#ff7aa8"), (0.25, "#ffd36e"), (0.5, "#7ff0c0"), (0.75, "#7ab8ff"), (1, "#c69bff")]))
fl = []
fl.append(ellipse(FX + 8, FY + FR * 0.62, FR * 1.35, FR * 0.3, "#6c5478", ' opacity=".35" filter="url(#b3)"'))
fl.append(rect(FX - 40, FY - 10, 170, 60, "url(#caus)"))
fl.append(circle(FX, FY, FR, "url(#flt)"))
fl.append(circle(FX, FY, FR, "none", ' stroke="#1f6f78" stroke-width="2" opacity=".7"'))
fl.append(path(f"M{f(FX+FR*0.95)} {f(FY-FR*0.3)}A{FR} {FR} 0 0 1 {f(FX-FR*0.2)} {f(FY+FR*0.98)}", "none", ' stroke="url(#fltrim)" stroke-width="2" opacity=".85"'))
net = []
for k in range(-2, 3):
    net.append(f"M{f(FX + k*FR*0.42 - FR*0.15)} {f(FY - FR*0.95 + abs(k)*FR*0.12)}Q{f(FX + k*FR*0.55)} {f(FY)} {f(FX + k*FR*0.4 + FR*0.1)} {f(FY + FR*0.92 - abs(k)*FR*0.15)}")
for k in (-0.45, 0.1, 0.6):
    hw = FR * math.sqrt(max(0.0, 1 - k * k)) * 0.98
    net.append(f"M{f(FX - hw)} {f(FY + k*FR)}Q{f(FX)} {f(FY + k*FR + FR*0.16)} {f(FX + hw)} {f(FY + k*FR)}")
fl.append(path("".join(net), "none", ' stroke="#8a6a52" stroke-width="2" stroke-linecap="round" opacity=".85"'))
fl.append(path("".join(net), "none", ' stroke="#e9cfae" stroke-width=".8" stroke-linecap="round" opacity=".7" transform="translate(-.6 -.6)"'))
fl.append(ellipse(FX - 11, FY - 13, 9, 5, "#ffffff", f' opacity=".95" transform="rotate(-30 {f(FX - 11)} {f(FY - 13)})"'))
fl.append(path(star4(FX - 14, FY - 15, 16, .1), "#ffffff"))
fl.append(path(f"M{f(FX+FR*0.55)} {f(FY+FR*0.15)}Q{f(FX+FR*0.62)} {f(FY+FR*0.5)} {f(FX+FR*0.3)} {f(FY+FR*0.72)}", "none", ' stroke="#fff6e0" stroke-width="2.2" stroke-linecap="round" opacity=".8"'))
fl.append(path(f"M{f(FX-FR*1.4)} {f(FY+FR*0.75)}Q{f(FX-FR*0.6)} {f(FY+FR*0.38)} {f(FX)} {f(FY+FR*0.5)}Q{f(FX+FR*0.7)} {f(FY+FR*0.4)} {f(FX+FR*1.5)} {f(FY+FR*0.78)}Z", "#f6cfc4"))
fl.append(path(f"M{f(FX-FR*1.0)} {f(FY+FR*0.58)}Q{f(FX-FR*0.3)} {f(FY+FR*0.4)} {f(FX+FR*0.4)} {f(FY+FR*0.47)}", "none", ' stroke="#fff3ec" stroke-width="1.6" stroke-linecap="round" opacity=".7"'))
doc.a("<g>" + "".join(fl) + "</g>")

# ---------------- beach morning glories creeping in from the lower left ----------------
mg = random.Random(77)
doc.d(rg("mgf", 0.5, 0.5, 0.5, [(0, "#fffaf4"), (0.28, "#ffe4ee"), (0.62, "#ff9cc8"), (1, "#f0609e")], user=False))
doc.d(lg("mgl", 0, 0, 0, 1, [(0, "#6fcf8a"), (1, "#2f8f6a")], user=False))
vines = [[(-20, 905), (90, 872), (190, 880), (270, 852), (350, 862), (420, 840)],
         [(-20, 1000), (70, 960), (160, 968), (240, 930), (300, 948)],
         [(60, 1090), (120, 1030), (210, 1010), (260, 1040)]]
vg = []
for v in vines:
    vg.append(path(catmull(v), "none", ' stroke="#3d7f5c" stroke-width="2.6" stroke-linecap="round"'))
leaves, flowers = [], []
for v in vines:
    for i in range(len(v) - 1):
        for k in range(3):
            t = (k + mg.random() * 0.6) / 3
            x = lerp(v[i][0], v[i + 1][0], t)
            y = lerp(v[i][1], v[i + 1][1], t)
            s = mg.uniform(11, 17)
            ang = mg.uniform(-60, 60) + (180 if mg.random() < 0.5 else 0)
            # kidney leaf
            leaves.append(f'<g transform="translate({f(x)} {f(y)}) rotate({f(ang)})">'
                          f'<path d="M0 0C{f(s*0.3)} {f(-s*0.2)} {f(s*0.9)} {f(-s*0.95)} {f(s*0.2)} {f(-s*1.15)}C{f(-s*0.3)} {f(-s*1.25)} {f(-s*0.6)} {f(-s*0.8)} 0 0Z" fill="url(#mgl)" stroke="#2c6b4c" stroke-width="1"/>'
                          f'<path d="M0 -2L{f(s*0.15)} {f(-s*0.95)}" stroke="#bff0c8" stroke-width=".9" opacity=".7"/></g>')
for (x, y, s, ang) in [(120, 860, 21, -18), (250, 842, 18, 12), (380, 832, 16, -8), (60, 962, 22, 6), (210, 925, 20, -14), (300, 935, 15, 20), (150, 1018, 22, 0)]:
    pet = []
    for k in range(5):
        a = math.radians(ang + k * 72 - 90)
        pet.append((x + math.cos(a) * s, y + math.sin(a) * s * 0.62))
    pts = []
    for k in range(5):
        a0 = math.radians(ang + k * 72 - 90)
        a1 = math.radians(ang + k * 72 - 54)
        pts.append((x + math.cos(a0) * s, y + math.sin(a0) * s * 0.62))
        pts.append((x + math.cos(a1) * s * 1.06, y + math.sin(a1) * s * 0.66))
    d = catmull(pts, closed=True)
    star = "".join(f"M{f(x)} {f(y)}L{f(px)} {f(py)}" for px, py in pet)
    flowers.append(ellipse(x + 2, y + s * 0.5, s * 0.9, s * 0.3, "#6a4a72", ' opacity=".25"')
                   + path(d, "url(#mgf)", ' stroke="#d0477f" stroke-width="1.2"')
                   + path(star, "none", ' stroke="#ff6fae" stroke-width="1.6" opacity=".75"')
                   + ellipse(x, y, s * 0.26, s * 0.17, "#fff6d6")
                   + circle(x, y, s * 0.08, "#ffd36e"))
doc.a("<g>" + "".join(vg) + "".join(leaves) + "".join(flowers) + "</g>")

# far town sits on the horizon (drawn after the sea so the mirror sits under it)
doc.a('<use href="#town"/>')
bx, by = 760, HZ - 1
doc.a(path(f"M{bx-14} {by-4} L{bx+13} {by-4} L{bx+9} {by} L{bx-11} {by}Z", "#3c4f6c")
      + rect(bx - 3, by - 10, 8, 6, "#3c4f6c") + path(f"M{bx+1} {by-10} L{bx+1} {by-22}", "none", ' stroke="#3c4f6c" stroke-width="1.2"')
      + circle(bx + 1, by - 8, 4, "#ffd38c", ' opacity=".6" filter="url(#b1)"') + circle(bx + 1, by - 8, 1.1, "#fff1cf"))

doc.d(rg("vig", 960, 520, 1150, [(0, "#06202e", 0), (0.7, "#06202e", 0), (1, "#06202e", 0.32)],
         transform="translate(960 520) scale(1 .75) translate(-960 -520)"))
doc.a(rect(0, 0, W, H, "url(#vig)"))

n = doc.write(OUT)
print(OUT, n)
