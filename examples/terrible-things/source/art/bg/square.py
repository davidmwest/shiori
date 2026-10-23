#!/usr/bin/env python3
"""bg/square.svg - Shiomi's town square on Lantern Night."""
import math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
import svglib
from svglib import *

from outpath import out_path

OUT = out_path('bg/square.svg', __doc__)
W, H = 1920, 1080
VX, VY, F, EYE = 960, 548, 1120, 1.6
rng = random.Random(3)
doc = Doc()


def P(X, Y, Z):
    return (VX + F * X / Z, VY - F * (Y - EYE) / Z)


def poly3(pts, close=True):
    return poly([P(*p) for p in pts], close)


def sc(Z):
    return F / Z


for n_, sd in [("b1", 1), ("b2", 2), ("b3", 3), ("b5", 5), ("b8", 8), ("b14", 14), ("b24", 24)]:
    doc.d(blur(n_, sd))

LCOL = {"ruby": ("#ff3d6a", "#ffd0dc", "#a3123a"), "cobalt": ("#3f7bff", "#d6e4ff", "#1a2f9e"),
        "emerald": ("#2fe08a", "#d4ffe6", "#0f7a4a"), "amber": ("#ffb52e", "#fff0c8", "#b2620a")}
LNAMES = list(LCOL)

# ======================================================================= SKY
SKY = [(0, "#0d1240"), (0.25, "#1d2266"), (0.5, "#33308c"), (0.68, "#5b3ea6"), (0.8, "#9a52a8"), (0.9, "#e0749e"), (1, "#ffad8f")]
doc.d(lg("sky", 0, 0, 0, 470, SKY))
doc.a(rect(0, 0, W, 560, "url(#sky)"))
st = []
for i in range(170):
    x = rng.uniform(0, W)
    y = rng.random() ** 1.5 * 300
    st.append((x, y, rng.choice([1.3, 1.7, 2.1, 2.6, 3.2]), max(0.15, 1 - y / 320)))
for lo, hi, op in [(0.66, 1.1, 0.95), (0.33, 0.66, 0.6), (0, 0.33, 0.3)]:
    doc.a(dots_path([(x, y, d) for x, y, d, a in st if lo <= a < hi], "#f4f2ff", op))
for (x, y, r) in [(760, 70, 9), (1260, 40, 7), (520, 150, 6), (1500, 120, 6), (980, 196, 5)]:
    doc.a(circle(x, y, r * 1.8, "#cfd6ff", ' opacity=".25" filter="url(#b2)"'))
    doc.a(path(star4(x, y, r), "#ffffff"))
# last light behind the hill
doc.d(rg("after", 1180, 420, 900, [(0, "#ffb08a", 0.75), (0.35, "#ff7fa0", 0.35), (1, "#ff7fa0", 0)],
         transform="translate(1180 420) scale(1 .38) translate(-1180 -420)"))
doc.a(rect(0, 0, W, 570, "url(#after)"))

# ======================================================================= GLASS HILL
HILL = [(-40, 380), (90, 352), (220, 318), (330, 290), (430, 262), (520, 246), (610, 226), (700, 196), (790, 158), (870, 126),
        (950, 104), (1030, 92), (1110, 90), (1190, 98), (1270, 118), (1350, 152), (1430, 192), (1520, 226), (1620, 250),
        (1720, 268), (1830, 290), (1960, 318)]
hill_d = catmull(HILL) + "L1960 600L-40 600Z"
doc.d(lg("hillg", 0, 130, 0, 460, [(0, "#4a3f8e"), (0.5, "#3a3580"), (1, "#3b3a86")]))
doc.a(path(hill_d, "url(#hillg)"))
# haze toward the base
doc.d(lg("hhaze", 0, 120, 0, 420, [(0, "#b866a8", 0), (1, "#e07ea2", 0.5)]))
svglib.PREC = 0
# forest: layered scalloped canopy bands following the hill's contours
doc.d(f'<clipPath id="hillC"><path d="{hill_d}"/></clipPath>')
doc.d(lg("fband", 0, 0, 0, 1, [(0, "#6a58ac"), (0.18, "#4b3f92"), (1, "#2f2a6e")], user=False))
r4 = random.Random(8)
bands = []
for k in range(8):
    dy = 26 + k * 38
    pts = []
    x = -60 + r4.uniform(0, 30)
    dpath = ""
    first = True
    while x < 1990:
        w = r4.uniform(28, 54) * (1 + k * 0.06)
        y0 = interp_pts(HILL, x) + dy + r4.uniform(-6, 6)
        y1 = interp_pts(HILL, x + w) + dy + r4.uniform(-6, 6)
        hgt = w * r4.uniform(0.35, 0.6)
        if first:
            dpath += f"M{f(x)} {f(y0)}"
            first = False
        dpath += f"C{f(x)} {f(y0-hgt)} {f(x+w)} {f(y1-hgt)} {f(x+w)} {f(y1)}"
        x += w
    dpath += "L1990 620L-60 620Z"
    bands.append(f'<path d="{dpath}" fill="url(#fband)" opacity="{f2(0.75 + 0.02*k)}"/>')
doc.a(f'<g clip-path="url(#hillC)">{"".join(bands)}</g>')
doc.a(path(hill_d, "url(#hhaze)"))
svglib.PREC = 1
# ridge rim light
doc.a(path(catmull(HILL[5:17]), "none", ' stroke="#ffb6c8" stroke-width="2.4" opacity=".6" filter="url(#b1)"'))
# the kiln-house and the long Glasshouse at the summit, catching the last light
gx, gy = 1010, 97
doc.d(lg("glh", 0, gy - 34, 0, gy, [(0, "#fff6e6"), (0.4, "#ffd0c0"), (1, "#ff9fb8")]))
doc.a(ellipse(gx + 70, gy - 16, 150, 40, "#ffc0b0", ' opacity=".55" filter="url(#b14)"'))
doc.a(path(f"M{gx} {gy} L{gx+12} {gy-26} L{gx+150} {gy-26} L{gx+162} {gy}Z", "url(#glh)"))
doc.a(path(f"M{gx+12} {gy-26} L{gx+150} {gy-26} L{gx+155} {gy-15} L{gx+7} {gy-15}Z", "#ffffff", ' opacity=".75"'))
doc.a(path("".join(f"M{gx+14+k*12} {gy-26}L{gx+8+k*12.4} {gy}" for k in range(12)), "none", ' stroke="#b77c9a" stroke-width="1.1" opacity=".75"'))
doc.a(rect(gx - 2, gy, 166, 5, "#4f3f7c"))
doc.a(path(f"M{gx+186} {gy+2} L{gx+196} {gy-14} L{gx+232} {gy-14} L{gx+242} {gy+2}Z", "#2e2a66"))
doc.a(rect(gx + 190, gy + 2, 48, 9, "#3d3878"))
doc.a(rect(gx + 206, gy + 4, 8, 6, "#ffcf7a"))
doc.a(path(star4(gx + 128, gy - 24, 15, .1), "#ffffff"))
doc.a(path(star4(gx + 40, gy - 22, 8, .12), "#ffffff", ' opacity=".9"'))
# a few clear statues as glints in the garden wall line
for k in range(5):
    doc.a(circle(gx - 60 + k * 14, gy + 8, 1.6, "#e8f0ff", ' opacity=".8"'))
# the 412 steps: a zig-zag of tiny festival lanterns down the hill
zz = [(1196, 104), (1268, 130), (1180, 160), (1318, 196), (1196, 232), (1372, 270), (1228, 306), (1420, 346)]
pts = []
for i in range(len(zz) - 1):
    a, b = zz[i], zz[i + 1]
    n = 9
    for k in range(n):
        t = k / n
        pts.append((lerp(a[0], b[0], t), lerp(a[1], b[1], t)))
doc.a(path(poly(zz, False), "none", ' stroke="#2a2662" stroke-width="5" stroke-linejoin="round" opacity=".6"'))
doc.a(dots_path([(x, y, 7) for x, y in pts], "#ffb05a", 0.35, ' filter="url(#b2)"'))
doc.a(dots_path([(x, y, 2.4) for x, y in pts], "#ffe2a8", 0.95))

svglib.PREC = 0
# ======================================================================= GROUND (stone paving)
ZF = 30.0
XL, XR = -11.0, 11.0
doc.d(lg("pave", 0, 600, 0, H, [(0, "#9a86c0"), (0.12, "#7564aa"), (0.45, "#4a4088"), (1, "#26205a")]))
doc.a(rect(0, 596, W, H - 596, "url(#pave)"))
rows = []
zz_ = 3.0
while zz_ < ZF:
    rows.append(zz_)
    zz_ += 0.8 + 0.0 * zz_
rows.append(ZF)
jl = {0: [], 1: [], 2: []}
hl = {0: [], 1: [], 2: []}
stones = []
r5 = random.Random(21)
for i in range(len(rows) - 1):
    z0, z1 = rows[i], rows[i + 1]
    g = 0 if z0 < 7 else (1 if z0 < 14 else 2)
    a, b = P(XL, 0, z0), P(XR, 0, z0)
    a = (max(-10, a[0]), a[1]); b = (min(1930, b[0]), b[1])
    jl[g].append(f"M{f(a[0])} {f(a[1])}H{f(b[0])}")
    hl[g].append(f"M{f(a[0])} {f(a[1]-1.2*(1 if g==2 else 2))}H{f(b[0])}")
    X = XL + r5.uniform(0, 1.2)
    while X < XR:
        w = r5.uniform(0.8, 1.5)
        p0, p1 = P(X, 0, z0), P(X, 0, z1)
        if -20 < p0[0] < 1940 or -20 < p1[0] < 1940:
            jl[g].append(f"M{f(p0[0])} {f(p0[1])}L{f(p1[0])} {f(p1[1])}")
        if r5.random() < 0.16:
            q = [P(X + 0.05, 0, z0 + 0.05), P(X + w - 0.05, 0, z0 + 0.05), P(X + w - 0.05, 0, z1 - 0.05), P(X + 0.05, 0, z1 - 0.05)]
            if -100 < q[0][0] < 2020:
                stones.append((poly(q), r5.random() < 0.5))
        X += w
doc.a(path("".join(p for p, lt in stones if lt), "#c8b8ff", ' opacity=".07"'))
doc.a(path("".join(p for p, lt in stones if not lt), "#120e38", ' opacity=".12"'))
for g, wdt in [(0, 2.6), (1, 1.8), (2, 1.1)]:
    doc.a(path("".join(hl[g]), "none", f' stroke="#d9c8ff" stroke-width="{wdt*0.8}" opacity=".16"'))
    doc.a(path("".join(jl[g]), "none", f' stroke="#1c1648" stroke-width="{wdt}" opacity=".5" stroke-linecap="round"'))


def ground_ellipse(X, Z, R):
    c = P(X, 0, Z)
    yn = P(X, 0, Z - R)[1]
    yf = P(X, 0, Z + R)[1]
    return c[0], (yn + yf) / 2, R * F / Z, (yn - yf) / 2


POOLC = {"ruby": "#ff3d7a", "cobalt": "#4a7dff", "emerald": "#3cf0a0", "amber": "#ffb43a", "warm": "#ffc070", "cyan": "#5fe6ff"}
for k, c in POOLC.items():
    doc.d(rg(f"pool_{k}", 0.5, 0.5, 0.5, [(0, c, 0.55), (0.45, c, 0.22), (1, c, 0)], user=False))


def pool(X, Z, R, col, op=1.0):
    cx, cy, rx, ry = ground_ellipse(X, Z, R)
    return ellipse(cx, cy, rx, ry, f"url(#pool_{col})", f' opacity="{f2(min(1, op*1.25))}"')


pools = []
for (X, Z, R, c, o) in [(-6.4, 11.5, 4.2, "warm", 0.95), (6.4, 11.5, 4.2, "cyan", 0.7), (0, 12.8, 4.6, "cyan", 0.55),
                        (-8.5, 18, 3.2, "ruby", 0.8), (8.5, 17, 3.2, "emerald", 0.75), (-7, 25, 3.5, "amber", 0.8),
                        (7, 25, 3.5, "ruby", 0.7), (0, 27, 4.5, "warm", 0.7), (-3, 7.5, 3, "ruby", 0.5), (3.5, 7, 3, "amber", 0.5),
                        (-9.5, 26, 2.5, "cobalt", 0.6), (9.5, 21, 2.5, "amber", 0.7), (0, 20, 3, "amber", 0.55)]:
    pools.append(pool(X, Z, R, c, o))
doc.a("<g>" + "".join(pools) + "</g>")

# ======================================================================= FAR ROW (Z = ZF)
doc.d(lg("plasterF", 0, 0, 0, 1, [(0, "#5f5096"), (0.6, "#8a76b8"), (1, "#b597c0")], user=False))
doc.d(lg("plasterS", 0, 0, 0, 1, [(0, "#54468e"), (0.55, "#7f6cb4"), (1, "#b393c2")], user=False))
TILE = {"blue": ("#2d4c9c", "#1f3678", "#4f74d0"), "orange": ("#cc5f3a", "#953e28", "#f08a5a")}


def hipped_front(x0, x1, yb, ywall, ytop, roof):
    """A far building facing us. Returns svg."""
    s = sc(ZF)
    out = []
    tc = TILE[roof]
    a = P(x0, 0, ZF)
    b = P(x1, 0, ZF)
    wall_top = P(x0, ywall, ZF)[1]
    # ground floor (lit shopfronts), upper floor plaster
    gf = P(x0, 3.0, ZF)[1]
    out.append(rect(a[0], wall_top, b[0] - a[0], a[1] - wall_top, "url(#plasterF)"))
    out.append(rect(a[0], gf, b[0] - a[0], a[1] - gf, "#4a2f4c"))
    # shop interiors glowing
    nb = max(2, int((x1 - x0) / 1.8))
    for k in range(nb):
        u0 = lerp(a[0], b[0], (k + 0.12) / nb)
        u1 = lerp(a[0], b[0], (k + 0.88) / nb)
        out.append(rect(u0, gf + 10, u1 - u0, a[1] - gf - 10, "#ffcf86"))
        out.append(path("".join(f"M{f(u0 + (u1-u0)*j/6)} {f(gf+10)}V{f(a[1])}" for j in range(1, 6)), "none", ' stroke="#5a3a3a" stroke-width="1.6"'))
        out.append(rect(u0, gf + 10, u1 - u0, (a[1] - gf) * 0.36, rng.choice(["#2b3a8c", "#7a2d4a", "#2c6b5e"]), ' opacity=".92"'))
    # pent roof
    pr = P(x0 - 0.3, 3.4, ZF)[1]
    out.append(path(f"M{f(a[0]-6)} {f(gf)}L{f(b[0]+6)} {f(gf)}L{f(b[0])} {f(pr)}L{f(a[0])} {f(pr)}Z", tc[1]))
    out.append(rect(a[0] - 6, gf - 3, b[0] - a[0] + 12, 3, tc[2], ' opacity=".8"'))
    # upper window
    wy0 = P(0, 4.9, ZF)[1]
    wy1 = P(0, 3.8, ZF)[1]
    cx = (a[0] + b[0]) / 2
    ww = (b[0] - a[0]) * 0.5
    out.append(rect(cx - ww / 2, wy0, ww, wy1 - wy0, "#ffd99a"))
    out.append(path("".join(f"M{f(cx - ww/2 + ww*j/8)} {f(wy0)}V{f(wy1)}" for j in range(1, 8)), "none", ' stroke="#6a4a4a" stroke-width="1.3"'))
    # roof: eave line, tiled slope up to the ridge
    ey = P(0, ywall, ZF - 1.0)[1]
    ry = P(0, ytop, ZF + 2.5)[1]
    ea, eb = P(x0 - 0.8, ywall, ZF - 1.0)[0], P(x1 + 0.8, ywall, ZF - 1.0)[0]
    ra, rb = P(x0 + 0.6, ytop, ZF + 2.5)[0], P(x1 - 0.6, ytop, ZF + 2.5)[0]
    rd = f"M{f(ea)} {f(ey)}L{f(ra)} {f(ry)}L{f(rb)} {f(ry)}L{f(eb)} {f(ey)}Z"
    out.append(path(rd, tc[0]))
    rows = 5
    out.append(path("".join(f"M{f(lerp(ea, ra, t))} {f(lerp(ey, ry, t))}L{f(lerp(eb, rb, t))} {f(lerp(ey, ry, t))}" for t in [k / rows for k in range(1, rows)]), "none", f' stroke="{tc[1]}" stroke-width="1.4"'))
    out.append(path(f"M{f(ra)} {f(ry)}L{f(rb)} {f(ry)}", "none", f' stroke="{tc[1]}" stroke-width="4"'))
    out.append(path(f"M{f(ea)} {f(ey)}L{f(eb)} {f(ey)}", "none", f' stroke="{tc[2]}" stroke-width="3"'))
    # eave soffit shadow
    out.append(rect(a[0], ey, b[0] - a[0], wall_top - ey + 6, "#2c2148", ' opacity=".55"'))
    return "".join(out)


far = []
xs_far = [XL, -6.2, -1.5, 3.4, 7.6, XR]
roofs = ["orange", "blue", "orange", "blue", "orange"]
for i in range(len(xs_far) - 1):
    far.append(hipped_front(xs_far[i] + 0.15, xs_far[i + 1] - 0.15, 0, rng.uniform(5.4, 6.0), rng.uniform(7.2, 8.0), roofs[i]))
doc.a("<g>" + "".join(far) + "</g>")

# ======================================================================= SIDE ROWS (left X=-11 face, right X=+11 face)


def side_house(side, za, zb, roof, seed):
    rr = random.Random(seed)
    s = side  # -1 left, +1 right
    X = 11.0 * s
    tc = TILE[roof]
    out = []
    # ground floor shopfront
    q = [(X, 0, za), (X, 3.0, za), (X, 3.0, zb), (X, 0, zb)]
    out.append(path(poly3(q), "#45294a"))
    # lit lattice interior
    m = 0.25
    qi = [(X, 0.0, za + m), (X, 2.6, za + m), (X, 2.6, zb - m), (X, 0.0, zb - m)]
    out.append(path(poly3(qi), "#ffc477"))
    # lattice bars
    bars = []
    nb = 14
    for k in range(1, nb):
        z = lerp(za + m, zb - m, k / nb)
        a, b = P(X, 0.0, z), P(X, 2.6, z)
        bars.append(f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}")
    out.append(path("".join(bars), "none", f' stroke="#5a3434" stroke-width="{f(max(1, 0.06*sc(za)))}"'))
    # noren curtain over part of the front
    zc0, zc1 = lerp(za, zb, 0.3), lerp(za, zb, 0.75)
    nc = rr.choice(["#283c8f", "#8c2b4a", "#1f6a5c", "#5a2f8c"])
    nq = [(X - 0.02 * s, 2.6, zc0), (X - 0.02 * s, 1.7, zc0), (X - 0.02 * s, 1.7, zc1), (X - 0.02 * s, 2.6, zc1)]
    out.append(path(poly3(nq), nc))
    for k in range(1, 4):
        z = lerp(zc0, zc1, k / 4)
        a, b = P(X - 0.02 * s, 2.6, z), P(X - 0.02 * s, 1.75, z)
        out.append(path(f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}", "none", ' stroke="#ffd7a0" stroke-width="1.4" opacity=".7"'))
    mc = P(X - 0.02 * s, 2.2, (zc0 + zc1) / 2)
    out.append(circle(mc[0], mc[1], 0.18 * sc((zc0 + zc1) / 2), "#ffffff", ' opacity=".85"'))
    # pent roof (hisashi), seen from below
    hz = [(X, 3.05, za - 0.2), (X - 0.9 * s, 2.85, za - 0.2), (X - 0.9 * s, 2.85, zb + 0.2), (X, 3.05, zb + 0.2)]
    out.append(path(poly3(hz), "#24183c"))
    edge = [P(X - 0.9 * s, 2.85, za - 0.2), P(X - 0.9 * s, 2.85, zb + 0.2)]
    out.append(path(poly(edge, False), "none", f' stroke="{tc[2]}" stroke-width="{f(max(2, 0.12*sc(za)))}" stroke-linecap="round"'))
    # upper floor plaster with a glowing slatted window
    uq = [(X, 3.05, za), (X, 5.6, za), (X, 5.6, zb), (X, 3.05, zb)]
    out.append(path(poly3(uq), "url(#plasterS)"))
    w0, w1 = lerp(za, zb, 0.22), lerp(za, zb, 0.78)
    wq = [(X, 3.7, w0), (X, 4.9, w0), (X, 4.9, w1), (X, 3.7, w1)]
    out.append(path(poly3(wq), "#ffd796"))
    sl = []
    for k in range(1, 10):
        z = lerp(w0, w1, k / 10)
        a, b = P(X, 3.7, z), P(X, 4.9, z)
        sl.append(f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}")
    out.append(path("".join(sl), "none", f' stroke="#6b4646" stroke-width="{f(max(1, 0.05*sc(za)))}"'))
    # main eave: soffit, then the tiled roof sloping up and away
    so = [(X, 5.6, za - 0.3), (X - 1.2 * s, 5.35, za - 0.3), (X - 1.2 * s, 5.35, zb + 0.3), (X, 5.6, zb + 0.3)]
    out.append(path(poly3(so), "#1f1638"))
    rf = [(X - 1.2 * s, 5.35, za - 0.3), (X + 3.2 * s, 7.6, za - 0.3), (X + 3.2 * s, 7.6, zb + 0.3), (X - 1.2 * s, 5.35, zb + 0.3)]
    out.append(path(poly3(rf), tc[0]))
    # tile rows (lines along Z on the roof)
    tl = []
    for k in range(1, 6):
        t = k / 6
        a = P(lerp(X - 1.2 * s, X + 3.2 * s, t), lerp(5.35, 7.6, t), za - 0.3)
        b = P(lerp(X - 1.2 * s, X + 3.2 * s, t), lerp(5.35, 7.6, t), zb + 0.3)
        tl.append(f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}")
    out.append(path("".join(tl), "none", f' stroke="{tc[1]}" stroke-width="{f(max(1.2, 0.07*sc(za)))}"'))
    e1, e2 = P(X - 1.2 * s, 5.35, za - 0.3), P(X - 1.2 * s, 5.35, zb + 0.3)
    out.append(path(f"M{f(e1[0])} {f(e1[1])}L{f(e2[0])} {f(e2[1])}", "none", f' stroke="{tc[2]}" stroke-width="{f(max(2.5, 0.16*sc(za)))}" stroke-linecap="round"'))
    # glass wind chimes under the eave
    nch = max(1, int((zb - za) / 1.6))
    for k in range(nch):
        z = lerp(za, zb, (k + 0.5) / nch)
        top = P(X - 1.0 * s, 5.38, z)
        bell = P(X - 1.0 * s, 5.05, z)
        rr_ = 0.11 * sc(z)
        col = rr.choice(["#7fd8ff", "#ff9fc4", "#b8f0a0", "#ffd36e", "#c9a4ff"])
        out.append(path(f"M{f(top[0])} {f(top[1])}L{f(bell[0])} {f(bell[1])}", "none", ' stroke="#e8e0ff" stroke-width="1" opacity=".7"'))
        out.append(path(f"M{f(bell[0]-rr_)} {f(bell[1]+rr_*0.6)}Q{f(bell[0]-rr_)} {f(bell[1]-rr_*0.9)} {f(bell[0])} {f(bell[1]-rr_*0.9)}Q{f(bell[0]+rr_)} {f(bell[1]-rr_*0.9)} {f(bell[0]+rr_)} {f(bell[1]+rr_*0.6)}Z",
                        col, ' opacity=".9"'))
        out.append(circle(bell[0] - rr_ * 0.35, bell[1] - rr_ * 0.3, max(0.8, rr_ * 0.25), "#ffffff"))
        st_ = P(X - 1.0 * s, 4.55, z)
        out.append(path(f"M{f(bell[0])} {f(bell[1]+rr_*0.6)}L{f(st_[0])} {f(st_[1])}", "none", f' stroke="#fff4e0" stroke-width="{f(max(1.2, 0.05*sc(z)))}" opacity=".8"'))
    return "".join(out)


sides = []
zs = [8.0, 12.5, 16.5, 20.2, 23.6, 27.0, 30.0]
roofsL = ["blue", "orange", "blue", "orange", "blue", "orange"]
roofsR = ["orange", "blue", "orange", "blue", "orange", "blue"]
# far ones first
for i in reversed(range(len(zs) - 1)):
    sides.append(side_house(-1, zs[i] + 0.08, zs[i + 1] - 0.08, roofsL[i], 10 + i))
    sides.append(side_house(1, zs[i] + 0.08, zs[i + 1] - 0.08, roofsR[i], 30 + i))
doc.a("<g>" + "".join(sides) + "</g>")


svglib.PREC = 1
# ======================================================================= LANTERN SYMBOLS
for k, (c, core, dark) in LCOL.items():
    doc.d(rg(f"lb_{k}", 0.42, 0.45, 0.62, [(0, "#fffdf4"), (0.22, core), (0.6, c), (1, dark)], user=False, fx=0.4, fy=0.4))
    doc.d(rg(f"lh_{k}", 0.5, 0.5, 0.5, [(0, c, 0.6), (0.35, c, 0.22), (1, c, 0)], user=False))
    # unit lantern: height ~100 from hook (0,-50) to finial (0,50)
    body = "M-18 -30C-40 -26 -46 2 -40 22C-34 40 -14 46 0 46C14 46 34 40 40 22C46 2 40 -26 18 -30Z"
    doc.d(f'<g id="ln_{k}"><path d="M0 -58V-44" stroke="#2a2346" stroke-width="3"/>'
          f'<path d="{body}" fill="url(#lb_{k})"/>'
          f'<path d="{body}" fill="none" stroke="{dark}" stroke-width="2.5" opacity=".8"/>'
          f'<path d="M-30 -14C-36 0 -34 16 -26 28" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".75"/>'
          f'<path d="M-6 -24C14 -22 30 -10 34 6" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".35"/>'
          f'<path d="M-22 -30L-16 -44L16 -44L22 -30Z" fill="#2d2648"/><path d="M-16 -44L16 -44" stroke="#c9b27a" stroke-width="3"/>'
          f'<path d="M-22 -30H22" stroke="#d8c08a" stroke-width="2.5"/>'
          f'<path d="M-8 46L0 56L8 46Z" fill="#2d2648"/></g>')


def lantern(x, y, s, k, halo=True):
    """x,y = hook point; s = lantern height in px."""
    out_h = ""
    if halo:
        out_h = circle(x, y + s * 0.55, s * 1.25, f"url(#lh_{k})")
    out_b = f'<use href="#ln_{k}" transform="translate({f(x)} {f(y + s*0.58)}) scale({f2(s/100)})"/>'
    return out_h, out_b


def catenary(A, B, sag, n=40):
    pts = []
    for i in range(n + 1):
        t = i / n
        X = lerp(A[0], B[0], t)
        Y = lerp(A[1], B[1], t) - sag * 4 * t * (1 - t)
        Z = lerp(A[2], B[2], t)
        pts.append((X, Y, Z))
    return pts


def string_layer(A, B, sag, spacing, seed, size=0.34, halo=True, skip=None):
    rr = random.Random(seed)
    pts = catenary(A, B, sag, 60)
    scr = [P(*q) for q in pts]
    # clip offscreen extremes
    zmin = min(q[2] for q in pts)
    sw = max(1.0, 0.025 * F / zmin)
    line = path(poly(scr, False), "none", f' stroke="#16123a" stroke-width="{f(sw)}" stroke-linejoin="round" opacity=".9"')
    # lanterns at roughly equal 3D spacing
    L = 0
    acc = []
    halos, bodies = [], []
    nxt = rr.uniform(0.2, spacing)
    for i in range(1, len(pts)):
        d = math.dist(pts[i - 1], pts[i])
        L += d
        if L >= nxt:
            nxt += spacing * rr.uniform(0.85, 1.15)
            X, Y, Z = pts[i]
            x, y = P(X, Y, Z)
            if -60 < x < 1980 and y > -60 and not (skip and skip(x, y, rr)):
                k = LNAMES[(len(acc) + seed) % 4] if rr.random() < 0.75 else rr.choice(LNAMES)
                acc.append(k)
                h_, b_ = lantern(x, y, size * F / Z, k, halo)
                halos.append(h_)
                bodies.append(b_)
    return halos, line, bodies


def thin_center(x, y, rr):
    return abs(x - 960) < 230 and 150 < y < 470 and rr.random() < 0.55


# ======================================================================= FAR STRINGS (behind the frame/fountain)
far_h, far_l, far_b = [], [], []
for (A, B, sag, sp, sd) in [((-9.9, 5.3, 27.0), (-2.0, 5.4, 29.6), 0.35, 1.05, 1), ((9.9, 5.3, 27.0), (2.0, 5.4, 29.6), 0.35, 1.05, 2),
                            ((-9.9, 5.3, 22.0), (-4.5, 5.4, 29.6), 0.45, 1.05, 3), ((9.9, 5.3, 22.0), (4.5, 5.4, 29.6), 0.45, 1.05, 4),
                            ((-9.9, 5.3, 17.5), (-7.0, 5.4, 29.6), 0.5, 1.0, 5), ((9.9, 5.3, 17.5), (7.0, 5.4, 29.6), 0.5, 1.0, 6),
                            ((-9.9, 5.3, 25.5), (9.9, 5.3, 25.5), 0.25, 1.15, 7)]:
    h_, l_, b_ = string_layer(A, B, sag, sp, sd, skip=thin_center)
    far_h += h_; far_l.append(l_); far_b += b_
doc.a("<g>" + "".join(far_h) + "</g>" + "".join(far_l) + "<g>" + "".join(far_b) + "</g>")

# ======================================================================= CHIME FRAME (Glass Bell Contest)
ZC = 19.5
fr = []
bam_w = max(2, 0.09 * F / ZC)
doc.d(lg("bam", 0, 0, 1, 0, [(0, "#9fd27a"), (0.5, "#6aa858"), (1, "#3f7a48")], user=False))
doc.d(lg("bamh", 0, 0, 0, 1, [(0, "#b6e08a"), (0.5, "#79b862"), (1, "#4a8a50")], user=False))
for X in (-3.5, 3.5):
    a, b = P(X, 0, ZC), P(X, 3.5, ZC)
    fr.append(rect(a[0] - bam_w / 2, b[1], bam_w, a[1] - b[1], "url(#bam)"))
    for Yn in (0.8, 1.6, 2.4, 3.1):
        q = P(X, Yn, ZC)
        fr.append(rect(q[0] - bam_w / 2 - 1, q[1] - 1, bam_w + 2, 2.2, "#38663e"))
    # braces
    c0, c1 = P(X, 0, ZC - 0.9), P(X, 1.6, ZC)
    fr.append(path(f"M{f(c0[0])} {f(c0[1])}L{f(c1[0])} {f(c1[1])}", "none", f' stroke="#4f8a50" stroke-width="{f(bam_w*0.7)}" stroke-linecap="round"'))
bars = [3.25, 2.6, 1.95]
for Yb in bars:
    a, b = P(-3.9, Yb, ZC), P(3.9, Yb, ZC)
    fr.append(rect(a[0], a[1] - bam_w * 0.45, b[0] - a[0], bam_w * 0.9, "url(#bamh)"))
    for k in range(1, 8):
        q = P(-3.9 + 7.8 * k / 8, Yb, ZC)
        fr.append(rect(q[0] - 0.8, q[1] - bam_w * 0.45, 1.6, bam_w * 0.9, "#3d6e42"))
doc.a("<g>" + "".join(fr) + "</g>")
chimes = []
r6 = random.Random(40)
GL = ["#7fd8ff", "#ff9fc4", "#b8f0a0", "#ffd36e", "#c9a4ff", "#9fb8ff", "#ff8f8f"]
PAPER = ["#ff8fb8", "#ffe066", "#7fd0ff", "#ffffff", "#c9a4ff", "#ff9f7a", "#8ff0b0"]
s_ = F / ZC
cnt = 0
for bi, Yb in enumerate(bars):
    n = 13
    for k in range(n):
        X = -3.5 + 7.0 * (k + 0.5) / n + (0.2 if bi % 2 else 0)
        top = P(X, Yb, ZC)
        drop = r6.uniform(0.06, 0.14)
        bell = P(X, Yb - drop - 0.12, ZC)
        r = 0.12 * s_
        col = r6.choice(GL)
        crooked = (bi == 2 and k == n - 1)
        rot = 16 if crooked else r6.uniform(-5, 5)
        g = [f'<path d="M{f(top[0])} {f(top[1])}V{f(bell[1]-r)}" stroke="#f0e8ff" stroke-width=".9" opacity=".6"/>']
        # dome bell, open at the bottom
        bd = (f"M{f(bell[0]-r)} {f(bell[1]+r*0.35)}C{f(bell[0]-r*1.1)} {f(bell[1]-r*1.25)} {f(bell[0]+r*1.1)} {f(bell[1]-r*1.25)} {f(bell[0]+r)} {f(bell[1]+r*0.35)}"
              f"Q{f(bell[0])} {f(bell[1]+r*0.6)} {f(bell[0]-r)} {f(bell[1]+r*0.35)}Z")
        g.append(path(bd, col, ' fill-opacity=".6" stroke="#fff" stroke-width="1" stroke-opacity=".85"'))
        g.append(path(f"M{f(bell[0]-r*0.5)} {f(bell[1]-r*0.1)}Q{f(bell[0])} {f(bell[1]+r*0.15)} {f(bell[0]+r*0.5)} {f(bell[1]-r*0.1)}", "none", ' stroke="#fff" stroke-width=".8" opacity=".6"'))
        g.append(circle(bell[0] - r * 0.4, bell[1] - r * 0.45, max(0.9, r * 0.2), "#ffffff"))
        # clapper string + paper tanzaku
        sx = bell[0] + r6.uniform(-0.4, 0.4)
        st0 = bell[1] + r * 0.45
        st1 = st0 + 0.07 * s_
        g.append(path(f"M{f(bell[0])} {f(bell[1]-r*0.2)}L{f(sx)} {f(st1)}", "none", ' stroke="#f0e8ff" stroke-width=".8" opacity=".7"'))
        plen = r6.uniform(0.3, 0.4) * s_
        pw = 0.1 * s_
        sw_ = r6.uniform(-2.5, 2.5)
        g.append(path(f"M{f(sx-pw/2)} {f(st1)}L{f(sx+pw/2)} {f(st1)}L{f(sx+pw/2+sw_)} {f(st1+plen)}L{f(sx-pw/2+sw_)} {f(st1+plen)}Z",
                      r6.choice(PAPER), ' opacity=".95"'))
        chimes.append(f'<g transform="rotate({f(rot)} {f(top[0])} {f(top[1])})">' + "".join(g) + "</g>")
        if r6.random() < 0.15:
            chimes.append(path(star4(bell[0] - r * 0.3, bell[1] - r * 0.4, r * 2.0, .1), "#ffffff", ' opacity=".9"'))
doc.a("<g>" + "".join(chimes) + "</g>")

# ======================================================================= CROWD (implied, silhouettes)
doc.d(lg("ppl", 0, 0, 0, 1, [(0, "#2c2766"), (1, "#1c1848")], user=False))


def person(X, Z, h=1.55, kind=0, rim="#ff9fc4", acc=None, face=1):
    s = F / Z * h / 1.55
    x, y = P(X, 0, Z)
    u = s * 0.1  # ~ 15.5 cm
    out = []
    # body (yukata) from shoulders to feet
    sh = y - 1.32 * s
    body = (f"M{f(x-1.3*u)} {f(sh+0.5*u)}C{f(x-2.6*u)} {f(sh+1*u)} {f(x-2.3*u)} {f(sh+4.2*u)} {f(x-1.5*u)} {f(sh+4.4*u)}"
            f"L{f(x-1.25*u)} {f(y-0.4*u)}L{f(x+1.25*u)} {f(y-0.4*u)}L{f(x+1.5*u)} {f(sh+4.4*u)}"
            f"C{f(x+2.3*u)} {f(sh+4.2*u)} {f(x+2.6*u)} {f(sh+1*u)} {f(x+1.3*u)} {f(sh+0.5*u)}Z")
    out.append(path(body, "url(#ppl)"))
    # obi
    out.append(rect(x - 1.3 * u, sh + 3.2 * u, 2.6 * u, 0.9 * u, acc or "#5a3f8c", ' opacity=".8"'))
    if kind == 1:  # big bow at the back (girl seen from behind)
        out.append(path(f"M{f(x)} {f(sh+3.6*u)}L{f(x-1.6*u)} {f(sh+2.8*u)}L{f(x-1.4*u)} {f(sh+4.6*u)}ZM{f(x)} {f(sh+3.6*u)}L{f(x+1.6*u)} {f(sh+2.8*u)}L{f(x+1.4*u)} {f(sh+4.6*u)}Z", acc or "#ff7fb0", ' opacity=".9"'))
    # neck + head + hair
    hx, hy = x, sh - 0.85 * u
    out.append(circle(hx, hy, 0.95 * u, "#2c2766"))
    if kind in (1, 3):
        out.append(circle(hx + 0.2 * u, hy - 1.0 * u, 0.55 * u, "#221d55"))  # bun
    # feet / geta
    out.append(rect(x - 1.0 * u, y - 0.4 * u, 0.8 * u, 0.35 * u, "#1a1640"))
    out.append(rect(x + 0.2 * u, y - 0.4 * u, 0.8 * u, 0.35 * u, "#1a1640"))
    # rim light on one side
    rx = 1 if face > 0 else -1
    out.append(path(f"M{f(x+rx*1.3*u)} {f(sh+0.6*u)}C{f(x+rx*2.5*u)} {f(sh+1.1*u)} {f(x+rx*2.25*u)} {f(sh+4.1*u)} {f(x+rx*1.5*u)} {f(sh+4.4*u)}L{f(x+rx*1.25*u)} {f(y-0.5*u)}",
                    "none", f' stroke="{rim}" stroke-width="{f(max(1.1, u*0.22))}" stroke-linecap="round" opacity=".75"'))
    out.append(path(f"M{f(hx+rx*0.2*u)} {f(hy-0.95*u)}A{f(0.95*u)} {f(0.95*u)} 0 0 {1 if rx>0 else 0} {f(hx+rx*0.9*u)} {f(hy+0.3*u)}", "none",
                    f' stroke="{rim}" stroke-width="{f(max(1.1, u*0.22))}" stroke-linecap="round" opacity=".75"'))
    return "".join(out)


crowd = []
crowd.append(person(-6.8, 25.5, 1.6, 1, "#ffb05a", "#ff7fb0", 1))
crowd.append(person(-5.9, 26.2, 1.7, 0, "#ffb05a", "#3f5fbf", 1))
crowd.append(person(6.2, 24.8, 1.5, 3, "#ff7fa0", "#ffd36e", -1))
crowd.append(person(7.3, 25.6, 1.15, 0, "#ff7fa0", "#ff9fc4", -1))
crowd.append(person(-4.6, 17.4, 1.58, 1, "#7fd8ff", "#c9a4ff", 1))
crowd.append(person(4.9, 16.8, 1.62, 0, "#ffd36e", "#2fc59a", -1))
crowd.append(person(5.5, 17.6, 1.1, 1, "#ffd36e", "#ff7fb0", -1))
crowd.append(person(-2.4, 23.5, 1.6, 3, "#ffc070", "#a66bff", 1))
crowd.append(person(2.6, 22.8, 1.66, 0, "#ffc070", "#46d9ff", -1))
for (X, Z, h, k, rim, acc, fc) in [(-8.6, 27.5, 1.55, 1, "#ffb05a", "#ffd36e", 1), (-3.9, 28.4, 1.62, 0, "#ff9fc4", "#2fc59a", 1),
                                   (-1.2, 28.8, 1.5, 3, "#ffc070", "#ff7fb0", -1), (1.6, 28.2, 1.68, 0, "#ffc070", "#3f6dff", 1),
                                   (3.8, 27.8, 1.2, 1, "#ff9fc4", "#ffd36e", -1), (8.9, 27.0, 1.6, 3, "#7fd8ff", "#c9a4ff", -1),
                                   (-9.3, 21.5, 1.58, 0, "#ff7fa0", "#46d9ff", 1), (9.4, 20.2, 1.55, 1, "#2fe08a", "#ff7fb0", -1)]:
    crowd.append(person(X, Z, h, k, rim, acc, fc))
# a yo-yo balloon and a goldfish bag held by the children
bx_, by_ = P(7.3 - 0.25, 0.75, 25.6)
crowd.append(circle(bx_, by_, 4, "#ff6fa8") + circle(bx_ - 1.2, by_ - 1.2, 1.2, "#ffffff"))
gx_, gy_ = P(5.5 - 0.3, 0.6, 17.6)
crowd.append(path(f"M{f(gx_-5)} {f(gy_-6)}Q{f(gx_-8)} {f(gy_+6)} {f(gx_)} {f(gy_+7)}Q{f(gx_+8)} {f(gy_+6)} {f(gx_+5)} {f(gy_-6)}Z", "#bff2ff", ' opacity=".55"')
             + ellipse(gx_, gy_ + 2, 2.6, 1.4, "#ff7a2a"))
doc.a("<g>" + "".join(crowd) + "</g>")


# ======================================================================= FOUNTAIN
ZFN, RF = 12.8, 2.5


def ring(R, Y, n=64, a0=0, a1=2 * math.pi, Zc=ZFN, Xc=0.0):
    return [P(Xc + R * math.cos(a0 + (a1 - a0) * i / n), Y, Zc + R * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


fn = []
doc.d(lg("stoneW", 0, 0, 0, 1, [(0, "#b7a6dc"), (0.25, "#8f7fc0"), (1, "#4a3f86")], user=False))
doc.d(lg("stoneT", 0, 0, 0, 1, [(0, "#e6dcff"), (1, "#b4a4e0")], user=False))
doc.d(lg("water", 0, 0, 0, 1, [(0, "#2a4fa8"), (0.5, "#2f86b8"), (1, "#56d2d6")], user=False))
cx, cy, rx, ry = ground_ellipse(0, ZFN, RF + 0.6)
fn.append(ellipse(cx, cy + 4, rx, ry, "#140f3a", ' opacity=".45" filter="url(#b8)"'))
# outer wall (front half) between Y=0 and Y=0.62
top_front = ring(RF, 0.62, 30, math.pi, 2 * math.pi)
bot_front = ring(RF, 0.0, 30, math.pi, 2 * math.pi)
fn.append(path(poly(top_front + list(reversed(bot_front))), "url(#stoneW)"))
# stone blocks on the wall
seams = []
for i in range(1, 12):
    a = math.pi + math.pi * i / 12
    p0 = P(RF * math.cos(a), 0.62, ZFN + RF * math.sin(a))
    p1 = P(RF * math.cos(a), 0.0, ZFN + RF * math.sin(a))
    seams.append(f"M{f(p0[0])} {f(p0[1])}L{f(p1[0])} {f(p1[1])}")
fn.append(path("".join(seams), "none", ' stroke="#3a3070" stroke-width="1.6" opacity=".55"'))
mid = ring(RF, 0.31, 48, math.pi, 2 * math.pi)
fn.append(path(poly(mid, False), "none", ' stroke="#3a3070" stroke-width="1.4" opacity=".4"'))
# rim top: ring between RF and RF-0.32
outer = ring(RF, 0.62, 44)
inner = ring(RF - 0.34, 0.62, 44)
fn.append(f'<path d="{poly(outer)}{poly(list(reversed(inner)))}" fill="url(#stoneT)" fill-rule="evenodd"/>')
fn.append(path(poly(ring(RF, 0.62, 48, math.pi, 2 * math.pi), False), "none", ' stroke="#f4eeff" stroke-width="2" opacity=".75"'))
# water surface
wat = ring(RF - 0.34, 0.5, 44)
fn.append(path(poly(wat), "url(#water)"))
doc.d(f'<clipPath id="watC"><path d="{poly(wat)}"/></clipPath>')
wr = []
r7 = random.Random(5)
for (col, X, Z, R) in [("#ff4d7a", -1.2, ZFN + 0.6, 0.6), ("#ffc23e", 1.1, ZFN + 0.9, 0.5), ("#2fe08a", 0.3, ZFN - 1.2, 0.5), ("#a66bff", -0.6, ZFN - 1.4, 0.45), ("#46d9ff", 1.4, ZFN - 0.8, 0.5)]:
    c = P(X, 0.5, Z)
    wr.append(ellipse(c[0], c[1], R * F / Z, R * F / Z * 0.12, col, ' opacity=".55" filter="url(#b5)"'))
# ripples
rip = []
for k in range(1, 6):
    rp = ring(0.55 + k * 0.32, 0.5, 28)
    rip.append(poly(rp))
wr.append(path("".join(rip), "none", ' stroke="#bff6ff" stroke-width="1.2" opacity=".35"'))
# coins and glass beads in the basin
for i in range(26):
    a = r7.uniform(0, math.tau)
    R = r7.uniform(0.7, RF - 0.5)
    c = P(R * math.cos(a), 0.5, ZFN + R * math.sin(a))
    col = r7.choice(["#ff4d6d", "#3f6dff", "#2fc59a", "#ffc23e", "#a66bff", "#ff7fc4", "#46d9ff", "#ffe6a0"])
    wr.append(ellipse(c[0], c[1], 3.2, 1.3, col, ' opacity=".85"'))
    wr.append(circle(c[0] - 1, c[1] - 0.6, 0.8, "#ffffff", ' opacity=".9"'))
fn.append(f'<g clip-path="url(#watC)">{"".join(wr)}</g>')
# central pedestal
colw = 0.3
pa, pb = P(-colw, 0.5, ZFN), P(colw, 1.42, ZFN)
doc.d(lg("ped", 0, 0, 1, 0, [(0, "#d9cdf6"), (0.35, "#a898d8"), (1, "#4f4590")], user=False))
fn.append(rect(pa[0], pb[1], pb[0] - pa[0], pa[1] - pb[1], "url(#ped)"))
for Yr in (0.75, 1.15):
    q0, q1 = P(-colw - 0.05, Yr, ZFN), P(colw + 0.05, Yr, ZFN)
    fn.append(rect(q0[0], q0[1] - 2, q1[0] - q0[0], 4, "#cfc2f2"))
# upper bowl (seen nearly edge-on, we're at eye level)
bowl_top = ring(0.98, 1.56, 48)
bowl_bot_front = ring(0.98, 1.56, 32, math.pi, 2 * math.pi)
bowl_base = ring(0.35, 1.36, 24, math.pi, 2 * math.pi)
fn.append(path(poly(bowl_bot_front + list(reversed(bowl_base))), "url(#stoneW)"))
fn.append(path(poly(bowl_top), "#9fe6f0", ' opacity=".9"'))
fn.append(path(poly(bowl_top), "none", ' stroke="#f4eeff" stroke-width="2.2"'))
# water falling from the bowl rim into the basin
falls = []
for i in range(17):
    a = math.pi + math.pi * (i + 0.5) / 17 + r7.uniform(-0.05, 0.05)
    p0 = P(0.98 * math.cos(a), 1.55, ZFN + 0.98 * math.sin(a))
    p1 = P(1.6 * math.cos(a), 0.52, ZFN + 1.6 * math.sin(a))
    c1 = P(1.35 * math.cos(a), 1.55, ZFN + 1.35 * math.sin(a))
    falls.append(f"M{f(p0[0])} {f(p0[1])}Q{f(c1[0])} {f(c1[1])} {f(p1[0])} {f(p1[1])}")
fd = "".join(falls)
fn.append(path(fd, "none", ' stroke="#9feaff" stroke-width="5" opacity=".28" stroke-linecap="round"'))
fn.append(path(fd, "none", ' stroke="#f0fdff" stroke-width="1.4" opacity=".75" stroke-linecap="round"'))
for i in range(0, 17, 2):
    a = math.pi + math.pi * (i + 0.5) / 17
    p1 = P(1.6 * math.cos(a), 0.52, ZFN + 1.6 * math.sin(a))
    fn.append(ellipse(p1[0], p1[1], 7, 2, "#ffffff", ' opacity=".7"'))
# spout and a glass orb finial catching the lanterns
q0, q1 = P(-0.09, 1.56, ZFN), P(0.09, 1.95, ZFN)
fn.append(rect(q0[0], q1[1], q1[0] - q0[0], q0[1] - q1[1], "#bfb2ea"))
oc = P(0, 2.12, ZFN)
orr = 0.2 * F / ZFN
doc.d(rg("orb", 0.4, 0.38, 0.6, [(0, "#ffffff", 0.95), (0.3, "#e8f6ff", 0.45), (0.8, "#c9b8ff", 0.25), (1, "#8f7fe6", 0.6)], user=False))
doc.d(lg("rainb", 0, 0, 1, 1, [(0, "#ff7aa8"), (0.25, "#ffd36e"), (0.5, "#7ff0c0"), (0.75, "#7ab8ff"), (1, "#c69bff")], user=False))
fn.append(circle(oc[0], oc[1], orr * 2.2, "#bfe8ff", ' opacity=".25" filter="url(#b8)"'))
fn.append(circle(oc[0], oc[1], orr, "url(#orb)"))
fn.append(path(f"M{f(oc[0]+orr*0.9)} {f(oc[1]-orr*0.35)}A{f(orr)} {f(orr)} 0 0 1 {f(oc[0]-orr*0.2)} {f(oc[1]+orr*0.98)}", "none", ' stroke="url(#rainb)" stroke-width="2" opacity=".9"'))
fn.append(circle(oc[0] - orr * 0.35, oc[1] - orr * 0.35, orr * 0.22, "#ffffff"))
fn.append(path(star4(oc[0] - orr * 0.4, oc[1] - orr * 0.4, orr * 1.3, .1), "#ffffff"))
# jets: a few glittering drops
drops = [(oc[0] + r7.gauss(0, 30), oc[1] + r7.uniform(10, 60), r7.choice([2, 2.5, 3])) for _ in range(30)]
fn.append(dots_path(drops, "#e8fbff", 0.7))
doc.a("<g>" + "".join(fn) + "</g>")


# ======================================================================= STALLS (yatai)
def stall(side, kind):
    s = side
    X0, X1 = (-8.7, -4.7) if s < 0 else (4.7, 8.7)
    Zf, Zb = 10.0, 11.7
    out = []
    inner_x = X1 if s < 0 else X0   # the side facing the centre (visible)
    outer_x = X0 if s < 0 else X1
    cloth, stripe = ("#d8314a", "#fff3ee") if kind == "goldfish" else ("#2f62d8", "#f4f8ff")
    back = "#2b2370" if kind == "goldfish" else "#2c5ab0"
    # back wall cloth
    out.append(path(poly3([(X0, 0.8, Zb), (X0, 2.62, Zb), (X1, 2.62, Zb), (X1, 0.8, Zb)]), back))
    # inner side panel
    out.append(path(poly3([(inner_x, 0.8, Zf + 0.1), (inner_x, 2.4, Zf + 0.1), (inner_x, 2.62, Zb), (inner_x, 0.8, Zb)]), back, ' opacity=".85"'))
    # posts
    for X in (X0, X1):
        for Z in (Zf, Zb):
            a, b = P(X, 0, Z), P(X, 2.45, Z)
            w = 0.09 * F / Z
            out.append(rect(a[0] - w / 2, b[1], w, a[1] - b[1], "#4a2f38"))
            out.append(rect(a[0] - w / 2, b[1], w * 0.35, a[1] - b[1], "#8a5a4a", ' opacity=".7"'))
    # canopy underside (lit by the lamp), stripes running front to back
    cu = [(X0 - 0.25, 2.4, Zf - 0.3), (X1 + 0.25, 2.4, Zf - 0.3), (X1 + 0.25, 2.66, Zb + 0.15), (X0 - 0.25, 2.66, Zb + 0.15)]
    out.append(path(poly3(cu), cloth))
    ns = 10
    stp = []
    for k in range(ns):
        if k % 2:
            continue
        xa, xb = lerp(X0 - 0.25, X1 + 0.25, k / ns), lerp(X0 - 0.25, X1 + 0.25, (k + 1) / ns)
        stp.append(poly3([(xa, 2.4, Zf - 0.3), (xb, 2.4, Zf - 0.3), (xb, 2.66, Zb + 0.15), (xa, 2.66, Zb + 0.15)]))
    out.append(path("".join(stp), stripe))
    out.append(path(poly3(cu), "#ffcf86", ' opacity=".25"'))
    return out


def valance(side, kind):
    X0, X1 = (-8.95, -4.45) if side < 0 else (4.45, 8.95)
    Zv = 9.7
    cloth, stripe = ("#d8314a", "#fff3ee") if kind == "goldfish" else ("#2f62d8", "#f4f8ff")
    out = []
    ns = 14
    for k in range(ns):
        xa, xb = lerp(X0, X1, k / ns), lerp(X0, X1, (k + 1) / ns)
        a, b = P(xa, 2.42, Zv), P(xb, 2.42, Zv)
        c = P(xa, 2.02, Zv)
        d = P(xb, 2.02, Zv)
        mxy = P((xa + xb) / 2, 1.94, Zv)
        out.append(path(f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}L{f(d[0])} {f(d[1])}Q{f(mxy[0])} {f(mxy[1])} {f(c[0])} {f(c[1])}Z", stripe if k % 2 else cloth))
    a, b = P(X0, 2.46, Zv), P(X1, 2.46, Zv)
    out.append(rect(a[0], a[1] - 3, b[0] - a[0], 7, "#3a2440"))
    # glow wash from the lamp on the valance
    c = P((X0 + X1) / 2, 2.2, Zv)
    out.append(ellipse(c[0], c[1] + 6, (b[0] - a[0]) * 0.5, 30, "#ffd28a", ' opacity=".2" filter="url(#b14)"'))
    return out


# --- goldfish scooping (left) ---
gs = stall(-1, "goldfish")
# goldfish emblem on the back cloth
ec = P(-6.7, 1.95, 11.69)
es = F / 11.7 * 0.32
gs.append(f'<g transform="translate({f(ec[0])} {f(ec[1])}) scale({f2(es/30)})">'
          '<path d="M-26 0C-16 -16 10 -16 18 0C10 16 -16 16 -26 0Z" fill="#ff5a3c"/>'
          '<path d="M16 0L34 -14C30 -4 30 4 34 14Z" fill="#ff8a5c"/><path d="M-6 -10Q0 -22 8 -11Z" fill="#ff8a5c"/>'
          '<circle cx="-15" cy="-3" r="3" fill="#2a1a2a"/><circle cx="-16" cy="-4" r="1" fill="#fff"/></g>')
for (Xo, Yo, sc_) in [(-8.0, 2.25, 0.16), (-5.3, 1.35, 0.18), (-7.6, 1.2, 0.14)]:
    c = P(Xo, Yo, 11.69)
    gs.append(circle(c[0], c[1], sc_ * F / 11.7 * 0.35, "#4a7dff", ' opacity=".5"'))
    gs.append(circle(c[0], c[1], sc_ * F / 11.7 * 0.18, "#ffffff", ' opacity=".55"'))
# wooden table + a glowing glass goldfish tank
TX0, TX1, TZ0, TZ1 = -8.3, -5.1, 10.35, 11.25
TY0, TY1 = 0.78, 1.32
gs.append(path(poly3([(TX0 - 0.1, TY0, TZ0 - 0.1), (TX1 + 0.1, TY0, TZ0 - 0.1), (TX1 + 0.1, TY0 - 0.08, TZ0 - 0.1), (TX0 - 0.1, TY0 - 0.08, TZ0 - 0.1)]), "#8a5a44"))
for X in (TX0 + 0.1, TX1 - 0.1):
    a_, b_ = P(X, TY0 - 0.08, TZ0), P(X, 0, TZ0)
    gs.append(rect(a_[0] - 3, a_[1], 6, b_[1] - a_[1], "#4a2f38"))
doc.d(lg("tankw", 0, 0, 0, 1, [(0, "#9ff6ff"), (0.25, "#3fd0e8"), (0.75, "#2a8fd8"), (1, "#3a6fd0")], user=False))
front = [(TX0, TY1, TZ0), (TX1, TY1, TZ0), (TX1, TY0, TZ0), (TX0, TY0, TZ0)]
side = [(TX1, TY1, TZ0), (TX1, TY1, TZ1), (TX1, TY0, TZ1), (TX1, TY0, TZ0)]
c0 = P((TX0 + TX1) / 2, (TY0 + TY1) / 2, TZ0)
gs.append(ellipse(c0[0], c0[1], 260, 70, "#5fe6ff", ' opacity=".35" filter="url(#b24)"'))
gs.append(path(poly3(side), "#2fa6d8", ' opacity=".85"'))
gs.append(path(poly3(front), "url(#tankw)", ' opacity=".88"'))
wl = [(TX0, TY1 - 0.06, TZ0), (TX1, TY1 - 0.06, TZ0), (TX1, TY1 - 0.06, TZ1), (TX0, TY1 - 0.06, TZ1)]
gs.append(path(poly3(wl), "#c8fbff", ' opacity=".7"'))
doc.d(f'<clipPath id="tankC"><path d="{poly3(front)}"/></clipPath>')
fish = []
r8 = random.Random(12)
for i in range(16):
    X = r8.uniform(TX0 + 0.12, TX1 - 0.12)
    Y = r8.uniform(TY0 + 0.08, TY1 - 0.12)
    Z = r8.uniform(TZ0 + 0.1, TZ1 - 0.1)
    c = P(X, Y, TZ0)
    L = 0.12 * F / Z * r8.uniform(0.8, 1.2)
    d = 1 if r8.random() < 0.5 else -1
    col = r8.choice(["#ff5a2a", "#ff5a2a", "#ff7a3a", "#ff3d3d", "#2a1a3a", "#fff0e0"])
    tilt = r8.uniform(-15, 15)
    fish.append(f'<g transform="translate({f(c[0])} {f(c[1])}) rotate({f(tilt)}) scale({d} 1)">'
                f'<path d="M{f(-L/2)} 0C{f(-L/4)} {f(-L/3)} {f(L/4)} {f(-L/3)} {f(L/2)} 0C{f(L/4)} {f(L/3.4)} {f(-L/4)} {f(L/3.4)} {f(-L/2)} 0Z" fill="{col}"/>'
                f'<path d="M{f(-L/2+1)} 0L{f(-L*0.95)} {f(-L/3)}Q{f(-L*0.75)} 0 {f(-L*0.95)} {f(L/3)}Z" fill="{col}" opacity=".75"/>'
                f'<circle cx="{f(L*0.3)}" cy="{f(-L*0.06)}" r="{f(max(0.8, L*0.06))}" fill="#1a1020"/></g>')
bub = [(r8.uniform(P(TX0, 0, TZ0)[0] + 10, P(TX1, 0, TZ0)[0] - 10), r8.uniform(P(0, TY1, TZ0)[1] + 6, P(0, TY0, TZ0)[1] - 4), r8.choice([2, 2.5, 3])) for _ in range(24)]
weed = []
for i in range(5):
    X = lerp(TX0 + 0.2, TX1 - 0.2, i / 4) + r8.uniform(-0.1, 0.1)
    b_ = P(X, TY0, TZ0)
    t_ = P(X + r8.uniform(-0.05, 0.05), TY0 + r8.uniform(0.18, 0.32), TZ0)
    weed.append(f"M{f(b_[0])} {f(b_[1])}Q{f(b_[0]+r8.uniform(-8,8))} {f((b_[1]+t_[1])/2)} {f(t_[0])} {f(t_[1])}")
gs.append(f'<g clip-path="url(#tankC)"><path d="{"".join(weed)}" fill="none" stroke="#2fc59a" stroke-width="3" stroke-linecap="round" opacity=".7"/>'
          + "".join(fish) + dots_path(bub, "#e8fdff", 0.6) + "</g>")
# glass edges, gleam
gs.append(path(poly3(front), "none", ' stroke="#e8fdff" stroke-width="2" opacity=".85"'))
g0, g1 = P(TX0 + 0.25, TY1 - 0.04, TZ0), P(TX0 + 0.55, TY0 + 0.05, TZ0)
gs.append(path(f"M{f(g0[0])} {f(g0[1])}L{f(g1[0])} {f(g1[1])}", "none", ' stroke="#ffffff" stroke-width="5" opacity=".35" stroke-linecap="round"'))
g2 = P(TX1 - 0.05, TY1, TZ0)
gs.append(path(star4(g2[0], g2[1], 12, .1), "#ffffff"))
# paper scoops (poi) resting on the rim
for X in (-7.7, -7.35):
    c = P(X, TY1 + 0.01, TZ0)
    r_ = 0.07 * F / 10.3
    gs.append(ellipse(c[0], c[1] - 2, r_, r_ * 0.45, "#fff8f0", ' stroke="#d8314a" stroke-width="1.5"'))
    gs.append(path(f"M{f(c[0]+r_)} {f(c[1]-2)}l{f(r_*1.6)} {f(-r_*0.3)}", "none", ' stroke="#d8314a" stroke-width="2.5" stroke-linecap="round"'))
# goldfish in bags hanging along the inner side
for k, Z in enumerate([10.25, 10.65, 11.05, 11.45]):
    top = P(-4.85, 2.25, Z)
    bc = P(-4.85, 1.72 - 0.04 * k, Z)
    bs = 0.13 * F / Z
    gs.append(path(f"M{f(top[0])} {f(top[1])}L{f(bc[0])} {f(bc[1]-bs*1.2)}", "none", ' stroke="#fff" stroke-width="1" opacity=".6"'))
    gs.append(path(f"M{f(bc[0]-bs*0.35)} {f(bc[1]-bs*1.2)}C{f(bc[0]-bs*1.2)} {f(bc[1]-bs*0.2)} {f(bc[0]-bs)} {f(bc[1]+bs*0.9)} {f(bc[0])} {f(bc[1]+bs*0.95)}"
                  f"C{f(bc[0]+bs)} {f(bc[1]+bs*0.9)} {f(bc[0]+bs*1.2)} {f(bc[1]-bs*0.2)} {f(bc[0]+bs*0.35)} {f(bc[1]-bs*1.2)}Z", "#b8f0ff", ' opacity=".45" stroke="#ffffff" stroke-width="1"'))
    gs.append(ellipse(bc[0], bc[1] + bs * 0.3, bs * 0.32, bs * 0.18, "#ff5a2a"))
    gs.append(path(f"M{f(bc[0]-bs*0.6)} {f(bc[1]-bs*0.3)}Q{f(bc[0]-bs*0.75)} {f(bc[1]+bs*0.3)} {f(bc[0]-bs*0.4)} {f(bc[1]+bs*0.7)}", "none", ' stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".85"'))
gs += valance(-1, "goldfish")
gh, gb = lantern(*P(-6.7, 2.2, 10.2), 0.42 * F / 10.2, "amber")
doc.a("<g>" + gh + "".join(gs) + gb + "</g>")

# --- shaved ice (right) ---
si = stall(1, "ice")
# wave pattern (seigaiha) on the back cloth
wv = []
for row in range(5):
    for k in range(9):
        X = 4.75 + k * 0.46 + (0.23 if row % 2 else 0)
        Y = 2.5 - row * 0.32
        if X > 8.65:
            continue
        c = P(X, Y, 11.69)
        r_ = 0.24 * F / 11.7
        wv.append(f"M{f(c[0]-r_)} {f(c[1])}A{f(r_)} {f(r_)} 0 0 1 {f(c[0]+r_)} {f(c[1])}")
si.append(path("".join(wv), "none", ' stroke="#9fc4ff" stroke-width="1.6" opacity=".55"'))
# counter
CX0, CX1, CZ0, CZ1 = 5.0, 8.4, 10.25, 11.3
si.append(path(poly3([(CX0, 0.9, CZ0), (CX1, 0.9, CZ0), (CX1, 0.9, CZ1), (CX0, 0.9, CZ1)]), "#e6e0ff"))
doc.d(lg("ctr", 0, 0, 0, 1, [(0, "#dcd4ff"), (1, "#8f86d0")], user=False))
si.append(path(poly3([(CX0, 0.9, CZ0), (CX1, 0.9, CZ0), (CX1, 0.0, CZ0), (CX0, 0.0, CZ0)]), "url(#ctr)"))
# blue waves along the skirt
skw = []
for k in range(16):
    X = CX0 + (k + 0.5) * (CX1 - CX0) / 16
    c = P(X, 0.25, CZ0)
    r_ = 0.11 * F / CZ0
    skw.append(f"M{f(c[0]-r_)} {f(c[1])}A{f(r_)} {f(r_)} 0 0 1 {f(c[0]+r_)} {f(c[1])}")
si.append(path(poly3([(CX0, 0.42, CZ0), (CX1, 0.42, CZ0), (CX1, 0.0, CZ0), (CX0, 0.0, CZ0)]), "#3f6dff"))
si.append(path("".join(skw), "none", ' stroke="#ffffff" stroke-width="2.2" opacity=".85"'))
si.append(path(poly3([(CX0, 0.9, CZ0), (CX1, 0.9, CZ0)], False), "none", ' stroke="#ffffff" stroke-width="2.5"'))
# ice machine (iron frame, red wheel) at the back left
mc = P(5.7, 1.45, 11.0)
mr = 0.32 * F / 11.0
si.append(rect(mc[0] - mr * 0.3, mc[1], mr * 0.6, P(5.7, 0.9, 11.0)[1] - mc[1], "#2a2346"))
si.append(circle(mc[0], mc[1], mr, "none", ' stroke="#e83a4a" stroke-width="4"'))
si.append(path("".join(f"M{f(mc[0])} {f(mc[1])}L{f(mc[0]+mr*math.cos(a))} {f(mc[1]+mr*math.sin(a))}" for a in [k * math.pi / 3 for k in range(6)]), "none", ' stroke="#e83a4a" stroke-width="2"'))
ib = P(5.7, 1.05, 11.0)
si.append(rect(ib[0] - mr * 0.5, ib[1] - mr * 0.45, mr, mr * 0.45, "#cff6ff", ' opacity=".85"'))
# syrup bottles glowing
for k, (col, glow) in enumerate([("#ff2d55", "#ff7f9f"), ("#2fe08a", "#9fffd0"), ("#2f8fff", "#9fd0ff"), ("#ffd23a", "#fff09f"), ("#c86bff", "#e6b8ff")]):
    X = 6.45 + k * 0.32
    a, b = P(X, 0.9, 11.05), P(X, 1.35, 11.05)
    bw = 0.12 * F / 11.05
    si.append(ellipse(a[0], (a[1] + b[1]) / 2, bw * 1.6, (a[1] - b[1]) * 0.8, glow, ' opacity=".35" filter="url(#b5)"'))
    si.append(path(f"M{f(a[0]-bw/2)} {f(a[1])}L{f(a[0]-bw/2)} {f(b[1]+bw*0.6)}Q{f(a[0]-bw/2)} {f(b[1]+bw*0.1)} {f(a[0]-bw*0.18)} {f(b[1])}L{f(a[0]+bw*0.18)} {f(b[1])}Q{f(a[0]+bw/2)} {f(b[1]+bw*0.1)} {f(a[0]+bw/2)} {f(b[1]+bw*0.6)}L{f(a[0]+bw/2)} {f(a[1])}Z", col, ' opacity=".9"'))
    si.append(rect(a[0] - bw * 0.3, b[1] + bw * 0.6, bw * 0.16, (a[1] - b[1]) * 0.6, "#ffffff", ' opacity=".7"'))
    si.append(rect(a[0] - bw * 0.2, b[1] - bw * 0.25, bw * 0.4, bw * 0.3, "#f4f2ff"))
# cups of shaved ice in front, rainbow-topped
for k, col in enumerate(["#ff4d7a", "#2fe08a", "#3f8fff", "#ffd23a", "#ff9fc4", "#46d9ff"]):
    X = 5.3 + k * 0.5
    c = P(X, 0.9, 10.45)
    cw = 0.17 * F / 10.45
    si.append(path(f"M{f(c[0]-cw/2)} {f(c[1]-cw*0.9)}L{f(c[0]+cw/2)} {f(c[1]-cw*0.9)}L{f(c[0]+cw*0.35)} {f(c[1])}L{f(c[0]-cw*0.35)} {f(c[1])}Z", "#e9f4ff"))
    si.append(path(f"M{f(c[0]-cw/2)} {f(c[1]-cw*0.9)}L{f(c[0]+cw/2)} {f(c[1]-cw*0.9)}", "none", ' stroke="#7fb8ff" stroke-width="1.6"'))
    si.append(path(f"M{f(c[0]-cw*0.55)} {f(c[1]-cw*0.9)}Q{f(c[0]-cw*0.5)} {f(c[1]-cw*1.9)} {f(c[0])} {f(c[1]-cw*1.95)}Q{f(c[0]+cw*0.5)} {f(c[1]-cw*1.9)} {f(c[0]+cw*0.55)} {f(c[1]-cw*0.9)}Z", "#ffffff"))
    si.append(path(f"M{f(c[0]-cw*0.5)} {f(c[1]-cw*1.25)}Q{f(c[0])} {f(c[1]-cw*2.0)} {f(c[0]+cw*0.5)} {f(c[1]-cw*1.25)}Q{f(c[0])} {f(c[1]-cw*1.5)} {f(c[0]-cw*0.5)} {f(c[1]-cw*1.25)}Z", col, ' opacity=".9"'))
    si.append(circle(c[0] - cw * 0.15, c[1] - cw * 1.7, max(1, cw * 0.08), "#ffffff"))
si += valance(1, "ice")
# the kakigori flag: white cloth, red band, blue waves, a plover and a red sun
fx0, fx1 = 4.85, 5.75
FZ = 9.72
fl = []
q = [P(fx0, 2.0, FZ), P(fx1, 2.0, FZ), P(fx1, 1.3, FZ), P(fx0, 1.3, FZ)]
fl.append(path(poly(q), "#fbfbff"))
fl.append(path(poly([P(fx0, 2.0, FZ), P(fx1, 2.0, FZ), P(fx1, 1.9, FZ), P(fx0, 1.9, FZ)]), "#e8323f"))
fl.append(path(poly([P(fx0, 1.3, FZ), P(fx1, 1.3, FZ), P(fx1, 1.44, FZ), P(fx0, 1.44, FZ)]), "#2f62d8"))
fs = F / FZ
wv2 = []
for k in range(5):
    c = P(fx0 + 0.09 + k * 0.18, 1.44, FZ)
    wv2.append(f"M{f(c[0]-0.09*fs)} {f(c[1])}Q{f(c[0]-0.03*fs)} {f(c[1]-0.12*fs)} {f(c[0]+0.09*fs)} {f(c[1]-0.02*fs)}")
fl.append(path("".join(wv2), "none", ' stroke="#2f62d8" stroke-width="3" stroke-linecap="round"'))
cup = P(fx0 + 0.58, 1.78, FZ)
cw_ = 0.2 * fs
fl.append(path(f"M{f(cup[0]-cw_/2)} {f(cup[1])}L{f(cup[0]+cw_/2)} {f(cup[1])}L{f(cup[0]+cw_*0.3)} {f(cup[1]+cw_*0.8)}L{f(cup[0]-cw_*0.3)} {f(cup[1]+cw_*0.8)}Z", "#2f62d8"))
fl.append(path(f"M{f(cup[0]-cw_*0.55)} {f(cup[1])}Q{f(cup[0])} {f(cup[1]-cw_*1.3)} {f(cup[0]+cw_*0.55)} {f(cup[1])}Z", "#e8323f"))
fl.append(path(f"M{f(cup[0]-cw_*0.3)} {f(cup[1]-cw_*0.55)}Q{f(cup[0])} {f(cup[1]-cw_*0.85)} {f(cup[0]+cw_*0.25)} {f(cup[1]-cw_*0.6)}", "none", ' stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".8"'))
bd = P(fx0 + 0.27, 1.62, FZ)
fl.append(path(f"M{f(bd[0]-0.12*fs)} {f(bd[1])}Q{f(bd[0]-0.05*fs)} {f(bd[1]-0.07*fs)} {f(bd[0])} {f(bd[1])}Q{f(bd[0]+0.05*fs)} {f(bd[1]-0.07*fs)} {f(bd[0]+0.12*fs)} {f(bd[1])}", "none", ' stroke="#2f62d8" stroke-width="2.6" stroke-linecap="round"'))
fl.append(path(poly([P(fx0, 1.3, FZ), P(fx1, 1.3, FZ)], False), "none", ' stroke="#c8c4e8" stroke-width="1.5"'))
si += fl
ih, ib_ = lantern(*P(6.7, 2.2, 10.2), 0.42 * F / 10.2, "cobalt")
doc.a("<g>" + ih + "".join(si) + ib_ + "</g>")

# ======================================================================= NEAR STRINGS (big lanterns overhead)
near_h, near_l, near_b = [], [], []
def thin_center(x, y, rr):
    return abs(x - 960) < 230 and 150 < y < 470 and rr.random() < 0.7


def thin_top(x, y, rr):
    return 960 < x < 1250 and rr.random() < 0.8


for (A, B, sag, sp, sd, sz, sk) in [((-9.9, 5.8, 8.0), (9.9, 5.8, 13.0), 0.2, 1.2, 11, 0.36, thin_center), ((-9.9, 5.8, 13.0), (9.9, 5.8, 8.0), 0.2, 1.2, 12, 0.36, thin_center),
                                    ((-9.9, 5.4, 9.5), (-6.0, 5.4, 18.0), 0.3, 1.1, 15, 0.36, None), ((9.9, 5.4, 9.5), (6.0, 5.4, 18.0), 0.3, 1.1, 16, 0.36, None)]:
    h_, l_, b_ = string_layer(A, B, sag, sp, sd, sz, skip=sk)
    near_h += h_; near_l.append(l_); near_b += b_
doc.a("<g>" + "".join(near_h) + "</g>" + "".join(near_l) + "<g>" + "".join(near_b) + "</g>")

# soft vignette for depth (keeps the textbox area calm)
doc.d(rg("vig", 960, 520, 1200, [(0, "#0a0828", 0), (0.62, "#0a0828", 0), (1, "#0a0828", 0.42)],
         transform="translate(960 520) scale(1 .78) translate(-960 -520)"))
doc.a(rect(0, 0, W, H, "url(#vig)"))

n = doc.write(OUT)
print(OUT, n)
