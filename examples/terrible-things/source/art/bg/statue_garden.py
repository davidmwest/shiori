#!/usr/bin/env python3
"""bg/statue_garden.svg - the hilltop garden of glass statues."""
import math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
import svglib
from svglib import *

from outpath import out_path

OUT = out_path('bg/statue_garden.svg', __doc__)
W, H = 1920, 1080
VX, VY, F, EYE = 960, 480, 1100, 1.0
SUNX, SUNY = 300, 230
rng = random.Random(11)
doc = Doc()


def P(X, Y, Z):
    return (VX + F * X / Z, VY - F * (Y - EYE) / Z)


def poly3(pts, close=True):
    return poly([P(*p) for p in pts], close)


for n_, sd in [("b1", 1), ("b2", 2), ("b3", 3), ("b5", 5), ("b8", 8), ("b14", 14), ("b24", 24), ("b40", 40)]:
    doc.d(blur(n_, sd))

behind = []   # everything the statues refract

# ======================================================================= SKY
SKY = [(0, "#3564d2"), (0.28, "#5a90e6"), (0.52, "#a8c2ec"), (0.7, "#ffe2b2"), (0.86, "#ffc890"), (1, "#ffb478")]
doc.d(lg("sky", 0, 0, 0, VY, SKY))
behind.append(rect(0, 0, W, VY + 4, "url(#sky)"))
doc.d(rg("sunglow", SUNX, SUNY, 1000, [(0, "#fff4d0", 1), (0.1, "#ffe39a", 0.8), (0.32, "#ffc879", 0.38), (1, "#ffc879", 0)]))
behind.append(rect(0, 0, W, VY + 4, "url(#sunglow)"))

# --- cumulus, lit gold from the low sun on the left
doc.d('<filter id="puff" x="-10%" y="-20%" width="120%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="4" result="n"/>'
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/></filter>')


def cumulus(cid, cx, base, w, h, seed, shade=("#fff0c4", "#ffd8b4", "#c6a2c8", "#9486c0")):
    rr = random.Random(seed)
    lobes = []
    levels = 4
    for li in range(levels):
        u = li / (levels - 1)
        width = w * (1 - 0.62 * u)
        xc = cx - w * 0.06 * u
        r = h * (0.30 - 0.06 * u)
        y = base - r * 0.7 - (h - r * 1.5) * u
        k = max(2, int(width / (r * 1.25)))
        for i in range(k):
            x = xc - width / 2 + (i + 0.5) * width / k + rr.uniform(-.25, .25) * r
            rad = r * rr.uniform(0.75, 1.3)
            lobes.append((x, y + rr.uniform(-.25, .25) * r, rad))
    top = min(y - r for x, y, r in lobes)
    shp = "".join(circle(x, y, r, "#000") for x, y, r in lobes).replace(' fill="#000"', "")
    doc.d(lg(f"{cid}s", 0, top, 0, base, [(0, shade[1]), (0.55, shade[2]), (1, shade[3])]))
    doc.d(lg(f"{cid}h", 0, top, 0, base, [(0, "#fffaf0"), (0.5, shade[0]), (1, "#ffcf98")]))
    doc.d(f'<clipPath id="{cid}c"><rect x="{f(cx-w)}" y="{f(top-60)}" width="{f(w*2)}" height="{f(base-top+60)}"/></clipPath>')
    out = f'<g clip-path="url(#{cid}c)">'
    out += f'<g fill="url(#{cid}s)">{shp}</g>'
    # lit side: lobes nudged toward the sun (up-left) and shrunk
    hl = "".join(circle(x - r * 0.22, y - r * 0.2, r * 0.8, "#000") for x, y, r in lobes).replace(' fill="#000"', "")
    out += f'<g fill="url(#{cid}h)">{hl}</g>'
    # front lobes repainted for volume
    fr = [l for l in lobes if l[1] > base - h * 0.45 and rr.random() < 0.7]
    for x, y, r in fr:
        out += circle(x, y, r * 0.95, f"url(#{cid}s)") + circle(x - r * 0.2, y - r * 0.18, r * 0.78, f"url(#{cid}h)")
    out += "</g>"
    return out


clouds = []
clouds.append(cumulus("c1", 1420, 360, 760, 300, 3))
clouds.append(cumulus("c2", 760, 330, 420, 150, 5))
clouds.append(cumulus("c3", 1860, 300, 300, 140, 7))
clouds.append(cumulus("c4", 560, 405, 520, 110, 9))
# thin high wisps
wisp = []
for (x, y, w_) in [(900, 70, 520), (1300, 120, 380), (500, 150, 300), (1650, 60, 420)]:
    wisp.append(ellipse(x, y, w_ / 2, 3.5, "#ffffff", ' opacity=".55" filter="url(#b3)"'))
skyA = "".join(behind)
behind = []
doc.d('<g id="clouds">' + "".join(clouds) + "</g>")
sunfx = "".join(wisp) + circle(SUNX, SUNY, 120, "#fff2c4", ' opacity=".55" filter="url(#b40)"')
rays = "".join(f"M{SUNX} {SUNY}L{f(SUNX+math.cos(a)*700)} {f(SUNY+math.sin(a)*700)}L{f(SUNX+math.cos(a+0.035)*700)} {f(SUNY+math.sin(a+0.035)*700)}Z"
               for a in [k * math.tau / 14 + 0.1 for k in range(14)])
sunfx += path(rays, "#fff3cc", ' opacity=".12" filter="url(#b5)"')
behind.append(circle(SUNX, SUNY, 34, "#fffdf0"))

# ======================================================================= SEA + far coast
doc.d(lg("sea", 0, VY, 0, VY + 60, [(0, "#ffd09a"), (0.08, "#a8c4e0"), (0.35, "#5a96d6"), (1, "#3a70c0")]))
behind.append(rect(0, VY, W, 160, "url(#sea)"))
# distant headland and islands
behind.append(path(catmull([(-20, VY + 1), (40, VY - 22), (120, VY - 34), (210, VY - 26), (300, VY - 8), (360, VY + 1)]) + "Z", "#8fa7d6"))
behind.append(path(catmull([(1560, VY + 1), (1600, VY - 9), (1660, VY - 12), (1720, VY - 4), (1750, VY + 1)]) + "Z", "#9fb4dc"))
# glitter under the sun
gl = []
for i in range(150):
    t = rng.random() ** 1.5
    y = VY + 2 + t * 120
    x = SUNX + rng.gauss(0, 30 + 220 * t)
    gl.append((x, y, (4 + 30 * t) * rng.uniform(0.4, 1.2)))
behind.append(dashes_path(gl, "#fff6dc", 2, 0.8))
sw = [(rng.uniform(0, W), VY + 3 + rng.random() ** 1.4 * 120, rng.uniform(10, 50)) for _ in range(90)]
behind.append(dashes_path(sw, "#ffffff", 1.6, 0.35))
behind.append(dashes_path([(rng.uniform(0, W), VY + 6 + rng.random() * 110, rng.uniform(10, 60)) for _ in range(50)], "#245aa8", 2, 0.35))

# ======================================================================= HILLTOP: trees, kiln-house, Glasshouse
# the hill top edge: ground beyond the garden falls away to the sea
behind.append(path(catmull([(-20, 532), (200, 512), (420, 504), (700, 501), (1000, 501), (1300, 502), (1560, 506), (1760, 514), (1940, 526)]) + "L1940 660L-20 660Z", "#5f9a5a"))


def tree_round(x, y, r, seed, dark="#2f6a4a", mid="#4f925a", lit="#9fd27a"):
    rr = random.Random(seed)
    out = []
    lob = [(x + rr.uniform(-r, r) * 0.8, y + rr.uniform(-r, r) * 0.6, r * rr.uniform(0.45, 0.7)) for _ in range(9)]
    out.append("".join(circle(a, b, c, dark) for a, b, c in lob))
    out.append("".join(circle(a - c * 0.18, b - c * 0.2, c * 0.8, mid) for a, b, c in lob))
    out.append("".join(circle(a - c * 0.38, b - c * 0.38, c * 0.42, lit, ' opacity=".85"') for a, b, c in lob if a < x + r * 0.2))
    return "".join(out)


trees = []
for (x, y, r, s) in [(150, 470, 70, 1), (60, 505, 80, 2), (1840, 462, 90, 3), (1740, 496, 70, 4), (1900, 512, 70, 5), (880, 482, 46, 6)]:
    trunk = rect(x - r * 0.08, y, r * 0.16, r * 0.9, "#5a3f3a")
    trees.append(trunk + tree_round(x, y, r, s))
behind.append("".join(trees))

# --- kiln-house (left-centre), irimoya roof in blue tile, brick kiln chimney
KZ = 24.0
kx0, kx1 = -10.5, -3.0
kh = []
a, b = P(kx0, 0, KZ), P(kx1, 0, KZ)
wt = P(0, 3.0, KZ)[1]
doc.d(lg("kwall", 0, 0, 0, 1, [(0, "#fff4e6"), (1, "#f0d9c8")], user=False))
kh.append(rect(a[0], wt, b[0] - a[0], a[1] - wt, "url(#kwall)"))
# timber frame
beams = [f"M{f(a[0])} {f(wt + (a[1]-wt)*0.45)}H{f(b[0])}"]
for k in range(7):
    xx = lerp(a[0], b[0], k / 6)
    beams.append(f"M{f(xx)} {f(wt)}V{f(a[1])}")
kh.append(path("".join(beams), "none", ' stroke="#5a3a34" stroke-width="5"'))
# open shoji panels, one glowing (the kiln inside)
for k in range(1, 5):
    xx0, xx1 = lerp(a[0], b[0], k / 6) + 4, lerp(a[0], b[0], (k + 1) / 6) - 4
    y0 = wt + (a[1] - wt) * 0.45 + 4
    kh.append(rect(xx0, y0, xx1 - xx0, a[1] - y0, "#ffefd6" if k != 2 else "#ffb46a"))
    kh.append(path("".join(f"M{f(lerp(xx0, xx1, j/3))} {f(y0)}V{f(a[1])}" for j in (1, 2)) + "".join(f"M{f(xx0)} {f(lerp(y0, a[1], j/4))}H{f(xx1)}" for j in (1, 2, 3)),
                   "none", ' stroke="#b09080" stroke-width="1.4"'))
# veranda shadow
kh.append(rect(a[0], a[1] - 6, b[0] - a[0], 8, "#7a5a54"))
# roof (irimoya, seen from the long side): hipped lower slope, gable ends standing up, curved eaves
e0, e1 = P(kx0 - 1.3, 2.9, KZ - 1.4), P(kx1 + 1.3, 2.9, KZ - 1.4)
g0, g1 = P(kx0 + 0.4, 4.7, KZ + 0.4), P(kx1 - 0.4, 4.7, KZ + 0.4)
r0, r1 = P(kx0 + 0.55, 6.3, KZ + 1.8), P(kx1 - 0.55, 6.3, KZ + 1.8)
doc.d(lg("kroof", 0, 0, 0, 1, [(0, "#5a74b0"), (0.6, "#3f5794"), (1, "#2c3f78")], user=False))
roof = (f"M{f(e0[0]-8)} {f(e0[1]-10)}Q{f(e0[0]+30)} {f(e0[1]+2)} {f(e0[0]+80)} {f(e0[1])}L{f(e1[0]-80)} {f(e1[1])}Q{f(e1[0]-30)} {f(e1[1]+2)} {f(e1[0]+8)} {f(e1[1]-10)}"
        f"L{f(g1[0])} {f(g1[1])}L{f(r1[0])} {f(r1[1])}L{f(r0[0])} {f(r0[1])}L{f(g0[0])} {f(g0[1])}Z")
doc.d(f'<clipPath id="kroofC"><path d="{roof}"/></clipPath>')
kh.append(path(roof, "url(#kroof)"))
cols = []
nx = 46
for k in range(1, nx):
    t = k / nx
    xa = lerp(e0[0], e1[0], t)
    xb = lerp(r0[0], r1[0], t)
    cols.append(f"M{f(xb)} {f(r0[1])}L{f(xa)} {f(e0[1]+4)}")
kh.append(f'<g clip-path="url(#kroofC)"><path d="{"".join(cols)}" fill="none" stroke="#283c74" stroke-width="2.2" opacity=".75"/>'
          f'<path d="{"".join(cols)}" fill="none" stroke="#8fa8e0" stroke-width="1" opacity=".5" transform="translate(-2 0)"/></g>')
# gable ends: small plaster triangles with timber, catching the sun on the left
gtri = f"M{f(g0[0])} {f(g0[1])}L{f(r0[0])} {f(r0[1])}L{f(r0[0]+14)} {f(g0[1]+2)}Z"
kh.append(path(gtri, "#fff1da"))
kh.append(path(f"M{f(g1[0])} {f(g1[1])}L{f(r1[0])} {f(r1[1])}L{f(r1[0]-14)} {f(g1[1]+2)}Z", "#d8c4c0"))
# ridge with turned-up ends, eave edge lit gold
kh.append(path(f"M{f(r0[0]-10)} {f(r0[1]-10)}Q{f(r0[0])} {f(r0[1]+2)} {f(r0[0]+20)} {f(r0[1])}L{f(r1[0]-20)} {f(r1[1])}Q{f(r1[0])} {f(r1[1]+2)} {f(r1[0]+10)} {f(r1[1]-10)}",
               "none", ' stroke="#1f2c5c" stroke-width="8" stroke-linecap="round"'))
kh.append(path(f"M{f(e0[0]-8)} {f(e0[1]-10)}Q{f(e0[0]+30)} {f(e0[1]+2)} {f(e0[0]+80)} {f(e0[1])}L{f(e1[0]-80)} {f(e1[1])}Q{f(e1[0]-30)} {f(e1[1]+2)} {f(e1[0]+8)} {f(e1[1]-10)}",
               "none", ' stroke="#ffd9a0" stroke-width="3.5" stroke-linecap="round"'))
kh.append(path(f"M{f(e0[0]-8)} {f(e0[1]-10)}L{f(g0[0])} {f(g0[1])}L{f(r0[0])} {f(r0[1])}", "none", ' stroke="#ffe6b8" stroke-width="2.5" opacity=".8"'))
# brick kiln chimney + a wisp of heat haze
c0 = P(kx0 + 1.8, 5.2, KZ + 1.0)
c1 = P(kx0 + 2.6, 8.0, KZ + 1.0)
kh.append(rect(c0[0], c1[1], c1[0] - c0[0], c0[1] - c1[1], "#b4553f"))
kh.append(rect(c0[0], c1[1], (c1[0] - c0[0]) * 0.4, c0[1] - c1[1], "#e0785a"))
kh.append(path("".join(f"M{f(c0[0])} {f(lerp(c1[1], c0[1], j/6))}H{f(c1[0])}" for j in range(1, 6)), "none", ' stroke="#7a3428" stroke-width="1.2" opacity=".6"'))
kh.append(rect(c0[0] - 3, c1[1] - 4, c1[0] - c0[0] + 6, 6, "#5a2c2c"))
kh.append(path(f"M{f((c0[0]+c1[0])/2)} {f(c1[1]-6)}C{f(c1[0]+10)} {f(c1[1]-40)} {f(c0[0]-20)} {f(c1[1]-70)} {f(c1[0]+30)} {f(c1[1]-120)}", "none",
               ' stroke="#ffffff" stroke-width="10" opacity=".35" stroke-linecap="round" filter="url(#b5)"'))
# glass wind chime under the eave
ch = P(kx1 + 0.6, 2.75, KZ - 1.2)
kh.append(path(f"M{f(ch[0])} {f(ch[1]-8)}V{f(ch[1])}", "none", ' stroke="#ffffff" stroke-width="1"') + circle(ch[0], ch[1] + 3, 4, "#9fe0ff", ' opacity=".85"')
          + rect(ch[0] - 1.5, ch[1] + 7, 3, 12, "#ff9fc4"))
behind.append("".join(kh))

# --- the long Glasshouse (right-centre): brick base, glass walls, pitched glass roof on iron ribs, catching gold
GZ = 27.0
gx0, gx1 = 0.8, 12.5
gh = []
a, b = P(gx0, 0, GZ), P(gx1, 0, GZ)
kb = P(0, 0.6, GZ)[1]
wt = P(0, 3.2, GZ)[1]
gh.append(rect(a[0], kb, b[0] - a[0], a[1] - kb, "#b4553f"))
gh.append(path(f"M{f(a[0])} {f(kb+ (a[1]-kb)/2)}H{f(b[0])}", "none", ' stroke="#7a3428" stroke-width="1"'))
doc.d(lg("gwall", 0, 0, 0, 1, [(0, "#d6f2ff", 0.85), (0.5, "#9fd2ec", 0.6), (1, "#c8e8f4", 0.75)], user=False))
gh.append(rect(a[0], wt, b[0] - a[0], kb - wt, "url(#gwall)"))
# beads glimpsed through the glass: coloured specks hanging in threads
bd = []
r9 = random.Random(77)
BEADC = ["#ff4d6d", "#3f6dff", "#2fc59a", "#ffc23e", "#a66bff", "#ff7fc4", "#46d9ff"]
for i in range(200):
    x = r9.uniform(a[0] + 6, b[0] - 6)
    y = r9.uniform(wt + 4, kb - 4)
    bd.append((x, y, r9.choice(BEADC)))
for c in BEADC:
    gh.append(dots_path([(x, y, 3) for x, y, cc in bd if cc == c], c, 0.8))
gh.append(path("".join(f"M{f(lerp(a[0], b[0], j/34))} {f(wt)}V{f(kb)}" for j in range(1, 34)), "none", ' stroke="#3a4a5a" stroke-width="1.3" opacity=".7"'))
gh.append(path(f"M{f(a[0])} {f(lerp(wt, kb, .5))}H{f(b[0])}", "none", ' stroke="#3a4a5a" stroke-width="1.3" opacity=".7"'))
# roof
e0, e1 = P(gx0 - 0.3, 3.2, GZ - 0.6), P(gx1 + 0.3, 3.2, GZ - 0.6)
r0, r1 = P(gx0 + 0.2, 6.0, GZ + 4.0), P(gx1 - 0.2, 6.0, GZ + 4.0)
doc.d(lg("groof", 0, 0, 0, 1, [(0, "#fff8e0"), (0.35, "#ffe2a6"), (0.7, "#bfe2f0"), (1, "#8fc8e6")], user=False))
gr = f"M{f(e0[0])} {f(e0[1])}L{f(r0[0])} {f(r0[1])}L{f(r1[0])} {f(r1[1])}L{f(e1[0])} {f(e1[1])}Z"
gh.append(path(gr, "url(#groof)", ' opacity=".95"'))
ribs = []
for j in range(0, 41):
    t = j / 40
    p0 = (lerp(e0[0], e1[0], t), e0[1])
    p1 = (lerp(r0[0], r1[0], t), r0[1])
    ribs.append(f"M{f(p0[0])} {f(p0[1])}L{f(p1[0])} {f(p1[1])}")
gh.append(path("".join(ribs), "none", ' stroke="#4a5a6a" stroke-width="1.1" opacity=".55"'))
gh.append(path(f"M{f(e0[0])} {f(e0[1])}H{f(e1[0])}M{f(r0[0])} {f(r0[1])}H{f(r1[0])}", "none", ' stroke="#3a4656" stroke-width="2.4"'))
# sun glare sliding along the roof
gh.append(path(f"M{f(lerp(e0[0], e1[0], .1))} {f(e0[1]-2)}L{f(lerp(r0[0], r1[0], .16))} {f(r0[1]+2)}L{f(lerp(r0[0], r1[0], .42))} {f(r0[1]+2)}L{f(lerp(e0[0], e1[0], .36))} {f(e0[1]-2)}Z",
               "#ffffff", ' opacity=".55"'))
gh.append(path(star4(lerp(r0[0], r1[0], .3), r0[1] + 1, 26, .08), "#ffffff"))
gh.append(path(star4(lerp(e0[0], e1[0], .72), e0[1], 14, .1), "#ffffff", ' opacity=".9"'))
# finial + double doors at the near end
behind.append("".join(gh))

# garden ground (part of what the statues refract)
GROUND = [(0, "#ffd884"), (0.08, "#bccf68"), (0.3, "#82b45a"), (1, "#3f8a52")]
doc.d(lg("grass", 0, 506, 0, 800, GROUND))
behind.append(rect(0, 506, W, 600, "url(#grass)"))

doc.d('<g id="skyA">' + skyA + "</g>")
doc.d('<g id="bgB">' + "".join(behind) + "</g>")
doc.a('<use href="#skyA"/><use href="#clouds"/>' + sunfx + '<use href="#bgB"/>')
# filter-free composite for refraction inside the statues
doc.d('<g id="behindR"><use href="#skyA"/><use href="#clouds"/><use href="#bgB"/></g>')


# ======================================================================= HYDRANGEA KIT
def floret_pattern(pid, T=22, seed=3):
    rr = random.Random(seed)
    spots = [(5.5, 5.5), (16.5, 4.5), (11, 11.5), (4.5, 17), (17, 17.5)]
    d = ""
    for cx, cy in spots:
        rot = rr.uniform(0, math.pi / 2)
        p_, w_ = 4.6, 2.4
        for k in range(4):
            a = rot + k * math.pi / 2
            dx, dy = math.cos(a), math.sin(a)
            px, py = -dy, dx
            tip = (cx + dx * p_, cy + dy * p_)
            c1 = (cx + dx * p_ * 0.55 + px * w_, cy + dy * p_ * 0.55 + py * w_)
            c2 = (cx + dx * p_ * 0.55 - px * w_, cy + dy * p_ * 0.55 - py * w_)
            d += f"M{f(cx)} {f(cy)}Q{f(c1[0])} {f(c1[1])} {f(tip[0])} {f(tip[1])}Q{f(c2[0])} {f(c2[1])} {f(cx)} {f(cy)}Z"
    dots = "".join(f"M{f(cx)} {f(cy)}h0" for cx, cy in spots)
    return (f'<pattern id="{pid}" width="{T}" height="{T}" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">'
            f'<path d="{d}" fill="#ffffff" fill-opacity=".42" stroke="#1d2a6b" stroke-opacity=".32" stroke-width=".8" stroke-linejoin="round"/>'
            f'<path d="{dots}" stroke="#1d2a6b" stroke-opacity=".45" stroke-width="1.8" stroke-linecap="round"/></pattern>')


doc.d(floret_pattern("fp"))
HYD = {"blue": ("#d6ecff", "#8fbcff", "#4f7ae6", "#2f48b0"), "sky": ("#e0f6ff", "#96d6ff", "#4f9ae8", "#2f64c0"),
       "violet": ("#f0dcff", "#bd96ff", "#8559e6", "#5536b4"), "lilac": ("#fde4ff", "#e2a2f2", "#ac68dc", "#7442b0"),
       "periw": ("#e6e8ff", "#a8aeff", "#6a72e8", "#3d43b6")}
for k, (c0, c1, c2, c3) in HYD.items():
    doc.d(rg(f"hy_{k}", 0.36, 0.3, 0.78, [(0, c0), (0.4, c1), (0.82, c2), (1, c3)], user=False))
doc.d(rg("hy_sh", 0.3, 0.25, 0.85, [(0, "#10164a", 0), (0.55, "#10164a", 0), (1, "#10164a", 0.42)], user=False))
doc.d(rg("hy_gold", 0.3, 0.25, 0.5, [(0, "#fff0c8", 0.75), (1, "#fff0c8", 0)], user=False))
r10 = random.Random(5)
for i in range(4):
    pts = []
    k = 20
    for j in range(k):
        a = 2 * math.pi * j / k + r10.uniform(-0.05, 0.05)
        rr_ = 100 * (1.0 if j % 2 == 0 else 0.9) * r10.uniform(0.93, 1.05)
        pts.append((math.cos(a) * rr_, math.sin(a) * rr_ * 0.88))
    doc.d(f'<path id="hs{i}" d="{catmull(pts, closed=True)}"/>')
    doc.d(f'<g id="hd{i}"><use href="#hs{i}"/><use href="#hs{i}" fill="url(#fp)"/><use href="#hs{i}" fill="url(#hy_sh)"/>'
          f'<use href="#hs{i}" fill="url(#hy_gold)"/></g>')
doc.d(lg("lfg", 0, 1, 0.3, 0, [(0, "#1f6a46"), (0.55, "#3f9a52"), (1, "#8fd06a")], user=False))
doc.d('<g id="lf"><path d="M0 0C32 -18 34 -62 0 -100C-34 -62 -32 -18 0 0Z" fill="url(#lfg)"/><path d="M0 -6V-86" stroke="#164a32" stroke-opacity=".45" stroke-width="3"/></g>')


def head(x, y, r, col, rr):
    return f'<use href="#hd{rr.randrange(4)}" transform="translate({f(x)} {f(y)}) scale({r/100:.3f})" fill="url(#hy_{col})"/>'


def leaf(x, y, s, ang):
    return f'<use href="#lf" transform="translate({f(x)} {f(y)}) rotate({ang:.0f}) scale({s/100:.3f})"/>'


def bush(X, Z, R, cols, seed, nheads=None):
    """Hydrangea bush on the ground at (X, Z), radius R metres."""
    rr = random.Random(seed)
    s = F / Z
    gx, gy = P(X, 0, Z)
    out = []
    # soft contact shadow, thrown right (sun on the left)
    out.append(ellipse(gx + R * s * 0.35, gy + 2, R * s * 1.15, R * s * 0.22, "#1d3a3a", ' opacity=".28"'))
    nh = nheads or rr.randint(4, 6)
    hr = 0.17 * s
    heads = []
    for i in range(nh):
        a = rr.uniform(0, math.tau)
        d = rr.uniform(0, 1) ** 0.6
        hx = gx + math.cos(a) * R * s * 0.75 * d
        hy = gy - R * s * 0.7 - math.sin(a) * R * s * 0.35 * d - rr.uniform(0, R * s * 0.25)
        heads.append((hy, hx, hr * rr.uniform(0.8, 1.15), rr.choice(cols)))
    heads.sort()
    # leaves: a skirt under and around the heads
    lv = []
    for i in range(int(6 + nh * 1.2)):
        a = rr.uniform(-math.pi, 0)
        lx = gx + math.cos(a) * R * s * rr.uniform(0.5, 1.05)
        ly = gy - R * s * 0.25 - rr.uniform(0, R * s * 0.5)
        ang = math.degrees(math.atan2(ly - (gy - R * s), lx - gx)) + 90 + rr.uniform(-25, 25)
        lv.append(leaf(lx, ly + R * s * 0.3, 0.26 * s * rr.uniform(0.8, 1.2), ang))
    out.append("".join(lv))
    out.append("".join(head(hx, hy, r_, c, rr) for hy, hx, r_, c in heads))
    # a few leaves tucked between heads
    out.append("".join(leaf(hx + rr.uniform(-1, 1) * r_, hy + r_ * 0.9, 0.2 * s, rr.uniform(-60, 60)) for hy, hx, r_, c in heads[: max(1, nh // 2)]))
    return "".join(out)


def hedge(Z0, X0, X1, cols, seed, h=0.9):
    """Far mass of hydrangeas: a scalloped band of heads (cheap)."""
    rr = random.Random(seed)
    s = F / Z0
    out = []
    a, b = P(X0, 0, Z0), P(X1, 0, Z0)
    top = P(0, h, Z0)[1]
    out.append(rect(a[0], top + 0.25 * h * s, b[0] - a[0], a[1] - top - 0.25 * h * s, "#2f6a46"))
    x = a[0]
    hs = []
    while x < b[0]:
        r_ = 0.16 * s * rr.uniform(0.85, 1.2)
        hs.append(head(x, top + rr.uniform(0, 0.35) * h * s, r_, rr.choice(cols), rr))
        if rr.random() < 0.6:
            hs.append(head(x + r_ * 0.9, top + rr.uniform(0.35, 0.7) * h * s, r_ * 0.95, rr.choice(cols), rr))
        x += r_ * rr.uniform(1.3, 1.8)
    out.append("".join(hs))
    return "".join(out)



# ----------------------------------------------------------------------- statue templates (metres, origin at the feet, y up)
def ell(cx, cy, rx, ry, n=16):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def mirror(pts):
    return [(-x, y) for x, y in pts]


FRONT = {
    "body": [(0.028, 1.385), (0.032, 1.352), (0.09, 1.336), (0.136, 1.306), (0.154, 1.256), (0.148, 1.16), (0.132, 1.07), (0.126, 0.98), (0.134, 0.85),
             (0.136, 0.6), (0.128, 0.32), (0.12, 0.13), (0.14, 0.02), (-0.14, 0.02), (-0.12, 0.13), (-0.128, 0.32), (-0.136, 0.6), (-0.134, 0.85),
             (-0.126, 0.98), (-0.132, 1.07), (-0.148, 1.16), (-0.154, 1.256), (-0.136, 1.306), (-0.09, 1.336), (-0.032, 1.352), (-0.028, 1.385)],
    "sleeveL": [(-0.136, 1.304), (-0.17, 1.284), (-0.196, 1.17), (-0.205, 1.04), (-0.21, 0.88), (-0.196, 0.75), (-0.158, 0.7), (-0.11, 0.705),
                (-0.078, 0.75), (-0.066, 0.86), (-0.064, 0.968), (-0.1, 0.998), (-0.138, 1.09), (-0.14, 1.2)],
    "handL": [(-0.088, 0.976), (-0.074, 0.996), (-0.044, 1.006), (-0.012, 1.004), (0.002, 0.992), (-0.008, 0.976), (-0.034, 0.964), (-0.07, 0.962)],
    "head": ell(0.0, 1.476, 0.079, 0.099),
}
FRONT["sleeveR"] = mirror(FRONT["sleeveL"])
FRONT["handR"] = mirror(FRONT["handL"])
FRONT_HAIR = {
    "long": [(0, 1.597), (0.078, 1.582), (0.112, 1.528), (0.122, 1.44), (0.128, 1.33), (0.152, 1.2), (0.16, 1.07), (0.118, 1.06), (0.098, 1.24), (0.07, 1.36),
             (-0.07, 1.36), (-0.098, 1.24), (-0.118, 1.06), (-0.16, 1.07), (-0.152, 1.2), (-0.128, 1.33), (-0.122, 1.44), (-0.112, 1.528), (-0.078, 1.582)],
    "bob": [(0, 1.598), (0.08, 1.582), (0.114, 1.528), (0.122, 1.45), (0.118, 1.39), (0.1, 1.372), (0.088, 1.43), (0.05, 1.53), (-0.05, 1.53), (-0.088, 1.43),
            (-0.1, 1.372), (-0.118, 1.39), (-0.122, 1.45), (-0.114, 1.528), (-0.08, 1.582)],
    "bun": [(0, 1.594), (0.074, 1.578), (0.1, 1.53), (0.098, 1.48), (0.08, 1.51), (0.03, 1.545), (-0.03, 1.545), (-0.08, 1.51), (-0.098, 1.48), (-0.1, 1.53),
            (-0.074, 1.578)],
    "braid": [(0, 1.597), (0.078, 1.582), (0.112, 1.528), (0.118, 1.45), (0.108, 1.41), (0.088, 1.45), (0.04, 1.535), (-0.04, 1.535), (-0.088, 1.45),
              (-0.108, 1.41), (-0.118, 1.45), (-0.112, 1.528), (-0.078, 1.582)],
}
FRONT_EXTRA = {"bun": [ell(0.0, 1.632, 0.055, 0.042, 12)],
               "braid": [[(0.088, 1.43), (0.118, 1.36), (0.112, 1.2), (0.1, 1.06), (0.08, 1.03), (0.079, 1.12), (0.086, 1.28), (0.07, 1.38)]]}
FRONT_FACE = {"eyes": [(-0.03, 1.476), (0.03, 1.476)], "mouth": (0.0, 1.418), "brow_dy": 0.026}

SIDE = {  # three-quarter view facing +x, hands held out palms up
    "body": [(0.036, 1.39), (0.046, 1.352), (0.088, 1.314), (0.102, 1.24), (0.088, 1.12), (0.076, 1.0), (0.086, 0.82), (0.094, 0.5), (0.096, 0.2), (0.122, 0.02),
             (-0.11, 0.02), (-0.096, 0.2), (-0.1, 0.55), (-0.106, 0.85), (-0.112, 0.965), (-0.162, 0.985), (-0.172, 1.06), (-0.124, 1.1), (-0.118, 1.2),
             (-0.104, 1.3), (-0.054, 1.352), (-0.016, 1.36), (-0.012, 1.39)],
    "handF": [(0.18, 1.06), (0.22, 1.052), (0.256, 1.058), (0.276, 1.072), (0.272, 1.088), (0.25, 1.082), (0.222, 1.08), (0.19, 1.088)],
    "arm": [(0.024, 1.312), (-0.034, 1.272), (-0.054, 1.15), (-0.06, 0.95), (-0.054, 0.8), (-0.024, 0.728), (0.05, 0.712), (0.112, 0.74), (0.142, 0.85),
            (0.158, 0.97), (0.168, 1.0), (0.166, 1.038), (0.084, 1.052), (0.058, 1.09), (0.062, 1.2), (0.052, 1.29)],
    "hand": [(0.158, 0.998), (0.2, 0.994), (0.236, 0.998), (0.258, 1.012), (0.262, 1.032), (0.244, 1.038), (0.21, 1.03), (0.172, 1.042)],
    "head": [(0.012, 1.574), (0.054, 1.562), (0.077, 1.524), (0.082, 1.494), (0.092, 1.466), (0.082, 1.452), (0.082, 1.43), (0.07, 1.404), (0.044, 1.384),
             (0.01, 1.378), (-0.028, 1.392), (-0.058, 1.424), (-0.068, 1.476), (-0.058, 1.53), (-0.03, 1.564)],
}
SIDE_HAIR = {
    "long": [(0.02, 1.598), (0.07, 1.58), (0.092, 1.53), (0.07, 1.54), (0.04, 1.52), (0.0, 1.47), (-0.02, 1.4), (-0.02, 1.34), (-0.05, 1.22), (-0.07, 1.08),
             (-0.13, 1.08), (-0.128, 1.22), (-0.11, 1.36), (-0.088, 1.48), (-0.07, 1.55), (-0.03, 1.59)],
    "bob": [(0.02, 1.598), (0.07, 1.582), (0.092, 1.53), (0.062, 1.535), (0.035, 1.51), (0.005, 1.46), (-0.01, 1.4), (-0.05, 1.37), (-0.085, 1.38),
            (-0.088, 1.47), (-0.074, 1.55), (-0.034, 1.59)],
    "bun": [(0.02, 1.594), (0.066, 1.578), (0.086, 1.534), (0.056, 1.536), (0.02, 1.51), (-0.02, 1.47), (-0.06, 1.44), (-0.072, 1.5), (-0.06, 1.55),
            (-0.026, 1.586)],
    "braid": [(0.02, 1.597), (0.07, 1.58), (0.09, 1.53), (0.06, 1.535), (0.03, 1.51), (0.0, 1.46), (-0.02, 1.41), (-0.06, 1.4), (-0.075, 1.47), (-0.066, 1.55),
              (-0.03, 1.59)],
}
SIDE_EXTRA = {"bun": [ell(-0.066, 1.565, 0.05, 0.04, 12)],
              "braid": [[(-0.05, 1.42), (-0.075, 1.36), (-0.085, 1.2), (-0.09, 1.04), (-0.07, 1.02), (-0.062, 1.12), (-0.05, 1.28), (-0.032, 1.4)]]}


def signed_area(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))


doc.d(lg("gtint", 0, 0, 0, 1, [(0, "#ffffff", 0.38), (0.45, "#dfe4ff", 0.22), (1, "#c6ccff", 0.32)], user=False))
doc.d(lg("rainbow", 0, 0, 0, 1, [(0, "#ff7aa8"), (0.25, "#ffd36e"), (0.5, "#7ff0c0"), (0.75, "#7ab8ff"), (1, "#c69bff")], user=False))
doc.d('<linearGradient id="mL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".6"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>')
doc.d('<linearGradient id="mR" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff"/></linearGradient>')
doc.d('<mask id="maskL" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#mL)"/></mask>')
doc.d('<mask id="maskR" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#mR)"/></mask>')
THREAD = ["#ff7fc4", "#46d9ff", "#ffc23e", "#a66bff", "#7ff0c0"]


def statue(idx, X, Z, hair="long", pose="front", dirn=1, h=1.58, tilt=0.0, seed=0):
    """Glass statue. Returns (refraction(fn), shading svg, ground svg)."""
    rr = random.Random(seed)
    s = F / Z * h / 1.58
    fx, fy = P(X, 0, Z)
    T_ = FRONT if pose == "front" else SIDE
    HR = FRONT_HAIR if pose == "front" else SIDE_HAIR
    EX = FRONT_EXTRA if pose == "front" else SIDE_EXTRA
    d_ = dirn if pose == "side" else 1

    def tf1(x, y):
        if tilt and y > 1.37:
            a = math.radians(tilt)
            cy_ = 1.37
            x, y = x * math.cos(a) - (y - cy_) * math.sin(a), cy_ + x * math.sin(a) + (y - cy_) * math.cos(a)
        return (fx + x * d_ * s, fy - y * s)

    def tf(pts):
        out = [tf1(x, y) for x, y in pts]
        if signed_area(out) < 0:
            out = list(reversed(out))
        return out

    parts = []
    if pose == "front":
        if hair == "long":
            parts.append(HR["long"])
        parts += [T_["sleeveL"], T_["sleeveR"], T_["body"], T_["head"]]
        if hair != "long":
            parts.append(HR[hair])
        parts += EX.get(hair, [])
        parts += [T_["handL"], T_["handR"]]
    else:
        parts.append(T_["handF"])
        if hair in ("long",):
            parts.append(HR["long"])
        parts += EX.get(hair, []) if hair == "braid" else []
        parts += [T_["body"], T_["head"]]
        if hair != "long":
            parts.append(HR[hair])
        parts += EX.get(hair, []) if hair == "bun" else []
        parts += [T_["arm"], T_["hand"]]
    sp = [tf(p) for p in parts]
    d = "".join(catmull(p, closed=True) for p in sp)
    doc.d(f'<path id="st{idx}" d="{d}"/>')
    doc.d(f'<clipPath id="sc{idx}"><use href="#st{idx}"/></clipPath>')
    xs = [x for p in sp for x, y in p]
    ys = [y for p in sp for x, y in p]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    lw = max(1.0, 0.011 * s)

    def refraction(src_uses):
        dx = 0.03 * s * d_
        return (f'<g clip-path="url(#sc{idx})"><g transform="translate({f(cx+dx)} {f(cy)}) scale(1.07 1.03) translate({f(-cx)} {f(-cy)})">{src_uses}</g></g>')

    sh = []
    sh.append(f'<use href="#st{idx}" fill="url(#gtint)"/>')
    hand_parts = [T_["handL"], T_["handR"]] if pose == "front" else [T_["hand"]]
    sh.append(path("".join(catmull(tf(p), closed=True) for p in hand_parts), "#ffffff", ' opacity=".45"'))
    sh.append(path(catmull(tf(T_["head"]), closed=True), "#f4f2ff", ' opacity=".42"'))
    sh.append(f'<g clip-path="url(#sc{idx})"><use href="#st{idx}" fill="none" stroke="#5262c8" stroke-width="{f(lw*4.5)}" opacity=".3" filter="url(#b2)"/></g>')
    sh.append(f'<use href="#st{idx}" fill="none" stroke="#7f8fd6" stroke-width="{f(lw*1.2)}" stroke-linejoin="round" opacity=".9"/>')
    sh.append(f'<g mask="url(#maskL)"><use href="#st{idx}" fill="none" stroke="#ffffff" stroke-width="{f(lw*2)}" stroke-linejoin="round" opacity=".95" transform="translate({f(lw*0.8)} {f(lw*0.6)})"/></g>')
    sh.append(f'<g mask="url(#maskR)"><use href="#st{idx}" fill="none" stroke="url(#rainbow)" stroke-width="{f(lw*1.6)}" stroke-linejoin="round" opacity=".85" transform="translate({f(-lw*0.9)} 0)"/></g>')
    T = lambda x, y: tf1(x, y)

    def seg(pts):
        return catmull([T(x, y) for x, y in pts])
    il, face = [], []
    if pose == "front":
        il.append(seg([(-0.062, 1.338), (0.0, 1.22), (0.058, 1.338)]))
        il.append(seg([(0.0, 1.22), (0.028, 1.08)]))
        il.append(seg([(-0.125, 1.075), (0.0, 1.065), (0.125, 1.075)]))
        il.append(seg([(-0.119, 0.965), (0.0, 0.958), (0.119, 0.965)]))
        il.append(seg([(0.028, 0.955), (0.045, 0.5), (0.055, 0.04)]))
        for fx_ in (-0.09, -0.07, -0.05, 0.05, 0.07, 0.09):
            p0, p1 = T(fx_, 1.0), T(fx_ * 0.94, 0.982)
            il.append(f"M{f(p0[0])} {f(p0[1])}L{f(p1[0])} {f(p1[1])}")
        if hair in ("bob", "braid", "bun"):
            il.append(seg([(-0.07, 1.53), (-0.02, 1.515), (0.03, 1.528), (0.07, 1.515)]))
        eyes = FRONT_FACE["eyes"]
        for ex, ey in eyes:
            face.append(seg([(ex - 0.017, ey - 0.002), (ex, ey + 0.009), (ex + 0.017, ey - 0.002)]))
            face.append(seg([(ex - 0.016, ey + 0.026), (ex, ey + 0.031), (ex + 0.016, ey + 0.027)]))
        dots = [T(ex, ey - 0.003) for ex, ey in eyes]
        m0, m1 = T(-0.012, 1.418), T(0.012, 1.418)
        face.append(f"M{f(m0[0])} {f(m0[1])}L{f(m1[0])} {f(m1[1])}")
        n0, n1 = T(0.004, 1.45), T(0.0, 1.442)
        face.append(f"M{f(n0[0])} {f(n0[1])}L{f(n1[0])} {f(n1[1])}")
    else:
        il.append(seg([(0.04, 1.345), (0.02, 1.25), (0.05, 1.1)]))
        il.append(seg([(-0.108, 1.09), (0.0, 1.075), (0.078, 1.085)]))
        il.append(seg([(-0.105, 0.985), (0.0, 0.97), (0.07, 0.98)]))
        il.append(seg([(0.055, 0.97), (0.06, 0.5), (0.075, 0.04)]))
        il.append(seg([(0.06, 1.07), (0.12, 1.04), (0.162, 1.02)]))
        for fx_ in (0.222, 0.238, 0.25):
            p0, p1 = T(fx_, 1.03), T(fx_ + 0.006, 1.012)
            il.append(f"M{f(p0[0])} {f(p0[1])}L{f(p1[0])} {f(p1[1])}")
        ex, ey = 0.048, 1.476
        face.append(seg([(ex - 0.015, ey - 0.001), (ex, ey + 0.009), (ex + 0.014, ey)]))
        face.append(seg([(ex - 0.014, ey + 0.026), (ex + 0.002, ey + 0.03), (ex + 0.016, ey + 0.025)]))
        dots = [T(ex + 0.002, ey - 0.002)]
        m0, m1 = T(0.052, 1.42), T(0.07, 1.421)
        face.append(f"M{f(m0[0])} {f(m0[1])}L{f(m1[0])} {f(m1[1])}")
    sh.append(path("".join(il), "none", f' stroke="#8f9ae0" stroke-width="{f(lw)}" stroke-linecap="round" opacity=".6"'))
    sh.append(path("".join(face), "none", f' stroke="#6672c4" stroke-width="{f(max(0.9, lw*0.95))}" stroke-linecap="round" opacity=".75"'))
    sh.append("".join(ellipse(x, y, max(0.9, 0.0075 * s), max(1.0, 0.009 * s), "#6672c4", ' opacity=".8"') for x, y in dots))
    th = []
    for t in range(2):
        col = THREAD[(seed + t) % len(THREAD)]
        x0 = rr.uniform(-0.08, 0.06)
        y0 = rr.uniform(0.45, 1.25)
        pts = [T(x0 + 0.04 * math.sin(j * 1.3 + t), y0 - j * 0.07 + 0.025 * math.cos(j + t)) for j in range(5)]
        dd = catmull(pts)
        th.append(path(dd, "none", f' stroke="{col}" stroke-width="{f(lw*2.6)}" stroke-linecap="round" opacity=".4" filter="url(#b2)"'))
        th.append(path(dd, "none", f' stroke="{col}" stroke-width="{f(max(0.7, lw*0.8))}" stroke-linecap="round" opacity=".8"'))
    sh.append(f'<g clip-path="url(#sc{idx})">{"".join(th)}</g>')
    g1 = T(-0.09 if pose == "front" else -0.06, 1.27)
    sh.append(path(star4(g1[0], g1[1], 0.06 * s, .1), "#ffffff"))
    g2 = T(0.05 if pose == "front" else 0.02, 1.565)
    sh.append(path(star4(g2[0], g2[1], 0.035 * s, .12), "#ffffff", ' opacity=".9"'))
    hp = T(-0.04 if pose == "front" else 0.215, 1.0)
    sh.append(circle(hp[0], hp[1], 0.05 * s, "#fff6d0", ' opacity=".35" filter="url(#b3)"'))
    st0, st1 = T(-0.1 if pose == "front" else -0.08, 1.0), T(-0.095 if pose == "front" else -0.075, 0.35)
    sh.append(path(f"M{f(st0[0])} {f(st0[1])}L{f(st1[0])} {f(st1[1])}", "none", f' stroke="#ffffff" stroke-width="{f(lw*1.6)}" stroke-linecap="round" opacity=".7"'))
    gnd = []
    sl = 1.5 * s
    gnd.append(path(f"M{f(fx-0.15*s)} {f(fy)}L{f(fx+sl)} {f(fy+0.06*s)}L{f(fx+sl*1.02)} {f(fy+0.13*s)}L{f(fx-0.1*s)} {f(fy+0.06*s)}Z", "#3a5a8a", ' opacity=".16"'))
    gnd.append(ellipse(fx + sl * 0.55, fy + 0.07 * s, 0.22 * s, 0.035 * s, "#fff2b0", ' opacity=".75"'))
    gnd.append(ellipse(fx + sl * 0.55, fy + 0.07 * s, 0.32 * s, 0.05 * s, "url(#rainbow)", ' opacity=".35"'))
    return refraction, "".join(sh), "".join(gnd)

# ======================================================================= BUSH SYMBOLS
PALS = [["blue", "sky", "periw"], ["violet", "lilac", "periw"], ["blue", "violet", "sky"], ["sky", "blue", "blue"],
        ["violet", "violet", "lilac"], ["periw", "blue", "violet"], ["lilac", "violet", "blue"], ["blue", "periw", "sky"]]
NB = len(PALS)
for v in range(NB):
    rr = random.Random(100 + v)
    out = []
    R = 60  # units: 100 = 1 m
    out.append(ellipse(R * 0.35, 2, R * 1.2, R * 0.22, "#1d3a3a", ' opacity=".28"'))
    nh = rr.randint(4, 6)
    heads = []
    for i in range(nh):
        a = rr.uniform(0, math.tau)
        d = rr.uniform(0, 1) ** 0.6
        hx = math.cos(a) * R * 0.78 * d
        hy = -R * 0.72 - math.sin(a) * R * 0.36 * d - rr.uniform(0, R * 0.25)
        heads.append((hy, hx, 17 * rr.uniform(0.85, 1.15), rr.choice(PALS[v])))
    heads.sort()
    for i in range(int(7 + nh * 1.3)):
        a = rr.uniform(-math.pi, 0)
        lx = math.cos(a) * R * rr.uniform(0.5, 1.08)
        ly = -R * 0.25 - rr.uniform(0, R * 0.5)
        ang = math.degrees(math.atan2(ly + R, lx)) + 90 + rr.uniform(-25, 25)
        out.append(leaf(lx, ly + R * 0.3, 26 * rr.uniform(0.8, 1.2), ang))
    out.append("".join(head(hx, hy, r_, c, rr) for hy, hx, r_, c in heads))
    out.append("".join(leaf(hx + rr.uniform(-1, 1) * r_, hy + r_ * 0.9, 20, rr.uniform(-60, 60)) for hy, hx, r_, c in heads[: max(1, nh // 2)]))
    doc.d(f'<g id="bu{v}">' + "".join(out) + "</g>")


def bush_use(X, Z, scale=1.0, v=0, flip=False):
    gx, gy = P(X, 0, Z)
    s = F / Z / 100 * scale
    sx = -s if flip else s
    return f'<use href="#bu{v}" transform="matrix({sx:.3f} 0 0 {s:.3f} {f(gx)} {f(gy)})"/>'


# ======================================================================= LAYOUT
STATUES = [  # (X, Z, hair, pose, dir, height, tilt)
    (-2.32, 3.6, "long", "side", 1, 1.6, -3), (1.97, 4.6, "bob", "side", -1, 1.56, 2), (-1.02, 5.6, "bun", "front", 1, 1.63, 0),
    (1.14, 6.6, "braid", "side", -1, 1.53, -2), (-3.32, 7.6, "bob", "side", 1, 1.5, 3), (5.63, 8.6, "long", "side", -1, 1.64, 0),
    (0.18, 10.0, "long", "front", 1, 1.58, 0), (-8.4, 11.0, "bun", "side", 1, 1.6, -2), (4.04, 12.0, "bob", "front", 1, 1.54, 2),
    (-4.07, 14.0, "braid", "side", 1, 1.57, 0), (2.04, 16.0, "long", "side", -1, 1.61, 1)]
PATH = [(1.65, 2.4), (0.9, 4.0), (0.1, 6.0), (-0.5, 8.2), (-1.5, 10.5), (-1.0, 13.0), (0.6, 17.0), (1.8, 24.0)]
WALL = [(-1.8, 1.62), (1.4, 2.35), (1.88, 2.5), (3.4, 3.0)]   # front edge of the wall in plan (X, Z); gate between points 1 and 2


def wall_z(X):
    if X <= WALL[0][0]:
        x0, z0 = WALL[0]
        x1, z1 = WALL[1]
        return z0 + (X - x0) * (z1 - z0) / (x1 - x0)
    for i in range(len(WALL) - 1):
        (x0, z0), (x1, z1) = WALL[i], WALL[i + 1]
        if x0 <= X <= x1:
            return lerp(z0, z1, (X - x0) / (x1 - x0))
    x0, z0 = WALL[-2]
    x1, z1 = WALL[-1]
    return z1 + (X - x1) * (z1 - z0) / (x1 - x0)


def path_x(Z):
    for i in range(len(PATH) - 1):
        (x0, z0), (x1, z1) = PATH[i], PATH[i + 1]
        if z0 <= Z <= z1:
            return lerp(x0, x1, (Z - z0) / (z1 - z0))
    return PATH[-1][0] if Z > PATH[-1][1] else PATH[0][0]


items = []  # (Z, kind, payload)
rb = random.Random(31)
Z = 2.1
while Z < 23:
    half = 0.87 * Z + 1.0
    step = 1.45 + 0.04 * Z
    X = -half + rb.uniform(0, step)
    while X < half:
        z = Z + rb.uniform(-0.3, 0.3)
        ok = z > wall_z(X) + 0.45 and abs(X - path_x(z)) > 0.85
        if z < 6.0 and abs(X) < 1.3 + 0.2 * z:     # keep the near centre calm (sprites stand here)
            ok = False
        for (sx_, sz_, *_r) in STATUES:
            if abs(X - sx_) < 0.5 and -0.25 < z - sz_ < 0.55:
                ok = False
        if ok:
            items.append((z, "bush", (X, z, rb.uniform(0.85, 1.2), rb.randrange(NB), rb.random() < 0.5)))
        X += step * rb.uniform(0.8, 1.2)
    Z += 0.8 + 0.07 * Z
for i, st in enumerate(STATUES):
    items.append((st[1], "statue", (i, st)))
items.sort(key=lambda t: -t[0])

# ======================================================================= GROUND DETAILS (gg0)
gd = []
# golden light across the grass, cooler toward the wall
doc.d(lg("gwarm", 0, 0, 1, 0, [(0, "#ffe08a", 0.55), (0.55, "#ffe08a", 0.15), (1, "#ffe08a", 0.05)], user=False))
gd.append(rect(0, 500, W, 320, "url(#gwarm)"))
# gravel path
pl_, pr_ = [], []
for k in range(40):
    zz = lerp(2.4, 24.0, k / 39)
    x = path_x(zz)
    w = 0.65
    pl_.append(P(x - w, 0, zz))
    pr_.append(P(x + w, 0, zz))
doc.d(lg("gravel", 0, 470, 0, 760, [(0, "#f6e2b8"), (1, "#e2c8a0")]))
gd.append(path(poly(pl_ + list(reversed(pr_))), "url(#gravel)"))
stones = []
for k in range(26):
    zz = 2.7 + k * 0.6
    x = path_x(zz) + rb.uniform(-0.2, 0.2)
    c = P(x, 0, zz)
    s = F / zz
    stones.append(ellipse(c[0], c[1], 0.32 * s, 0.32 * s * 1.5 / zz * 1.6, "#cfc0a8"))
    stones.append(ellipse(c[0] - 0.04 * s, c[1] - 0.01 * s, 0.25 * s, 0.25 * s * 1.5 / zz * 1.2, "#fff4dc", ' opacity=".6"'))
gd.append("".join(stones))
# statue shadows / caustics go here too (filled in below)

# ======================================================================= ASSEMBLE (far to near, with refraction)
groups = []        # ids of garden groups drawn so far
cur = ["".join(gd)]
body = []
shadow_marks = []
statue_objs = {}
for i, st in enumerate(STATUES):
    X, Zs, hair, pose, dn, hh, tilt = st
    statue_objs[i] = statue(i, X, Zs, hair, pose, dn, hh, tilt, seed=i * 7 + 1)
    cur.append(statue_objs[i][2])   # ground shadow early (drawn on the ground)


def close_group():
    gid = f"gg{len(groups)}"
    doc.d(f'<g id="{gid}">' + "".join(cur) + "</g>")
    groups.append(gid)
    body.append(f'<use href="#{gid}"/>')


for (z, kind, pay) in items:
    if kind == "bush":
        X, zz, sc_, v, fl = pay
        cur.append(bush_use(X, zz, sc_, v, fl))
    else:
        i, st = pay
        close_group()
        cur = []
        refr, shade, _g = statue_objs[i]
        src = '<use href="#behindR"/>' + "".join(f'<use href="#{g}"/>' for g in groups)
        body.append(refr(src))
        cur.append(shade)
close_group()
doc.a("".join(body))

# ======================================================================= WALL + GATE (foreground)
WH, WT = 0.55, 0.26
G0, G1 = WALL[1], WALL[2]
fg = []
# outside landing: big flat stones in front of the wall (only the right half shows above the textbox)
doc.d(lg("land", 0, 700, 0, 1080, [(0, "#efe2cc"), (1, "#bfae9c")]))
lx = [x / 10 for x in range(-22, 41, 4)]
fg.append(path(poly([P(X, 0, wall_z(X) - 0.02) for X in lx] + [(2000, 1100), (-100, 1100)]), "url(#land)"))
jl = []
for zz in (1.4, 1.6, 1.8):
    a_, b_ = P(0.0, 0, zz), P(4, 0, zz)
    jl.append(f"M{f(a_[0])} {f(a_[1])}L{f(b_[0])} {f(b_[1])}")
for X in (0.4, 0.9, 1.4, 1.9, 2.4):
    a_, b_ = P(X, 0, 1.2), P(X + 0.1, 0, wall_z(X))
    jl.append(f"M{f(a_[0])} {f(a_[1])}L{f(b_[0])} {f(b_[1])}")
fg.append(path("".join(jl), "none", ' stroke="#8f7f78" stroke-width="2" opacity=".45"'))
# hydrangeas just inside the wall, heads peeking over the cap
inside = []
for (X, sc_, v, dz) in [(-1.75, 1.0, 1, 0.55), (-1.25, 0.9, 0, 0.75), (1.15, 0.85, 2, 0.5), (2.3, 0.95, 3, 0.55), (2.8, 0.9, 7, 0.7)]:
    inside.append(bush_use(X, wall_z(X) + dz, sc_, v, X > 0))
fg.append("".join(inside))

doc.d(lg("wallf", 0, 0, 0, 1, [(0, "#e2d2bc"), (0.5, "#c2b0a8"), (1, "#8f8090")], user=False))
doc.d(lg("wallt", 0, 0, 0, 1, [(0, "#fff0d4"), (1, "#e0ccb2")], user=False))


def wall_run(xa, xb, n=24):
    Xs = [lerp(xa, xb, i / n) for i in range(n + 1)]
    ft = [P(X, WH, wall_z(X)) for X in Xs]
    bt = [P(X, WH, wall_z(X) + WT) for X in Xs]
    fb = [P(X, 0, wall_z(X)) for X in Xs]
    out = []
    # individual dressed stones in uneven courses, warm in the low sun
    rw = random.Random(int(xa * 10) + 99)
    ys = [0.0, 0.19, 0.37, WH - 0.02]
    tones = ["#e6d4bc", "#d8c4b0", "#cdb8b0", "#e0cbb6", "#c9b6b8"]
    st_, hl_, sh_ = [], [], []
    for ci in range(len(ys) - 1):
        X = xa - rw.uniform(0, 0.3)
        while X < xb:
            w = rw.uniform(0.38, 0.66)
            x0_, x1_ = max(X + 0.012, xa), min(X + w - 0.012, xb)
            if x1_ - x0_ > 0.05:
                y0_, y1_ = ys[ci] + 0.012, ys[ci + 1] - 0.012
                q = [P(x0_, y1_, wall_z(x0_)), P(x1_, y1_ + rw.uniform(-0.01, 0.01), wall_z(x1_)), P(x1_, y0_, wall_z(x1_)), P(x0_, y0_, wall_z(x0_))]
                # slightly rounded corners
                c = [(sum(p_[0] for p_ in q) / 4, sum(p_[1] for p_ in q) / 4)]
                qq = [(lerp(p_[0], c[0][0], 0.04), lerp(p_[1], c[0][1], 0.04)) for p_ in q]
                st_.append((catmull(qq + [qq[0]]), rw.choice(tones)))
                hl_.append(f"M{f(qq[3][0])} {f(qq[3][1])}L{f(qq[0][0])} {f(qq[0][1])}L{f(qq[1][0])} {f(qq[1][1])}")
                sh_.append(f"M{f(qq[1][0])} {f(qq[1][1])}L{f(qq[2][0])} {f(qq[2][1])}L{f(qq[3][0])} {f(qq[3][1])}")
            X += w
    out.append(path(poly(ft + list(reversed(fb))), "#6e6070"))
    for tone in tones:
        out.append(path("".join(d_ for d_, t_ in st_ if t_ == tone), tone))
    out.append(path("".join(hl_), "none", ' stroke="#fff6e6" stroke-width="2" opacity=".7" stroke-linejoin="round"'))
    out.append(path("".join(sh_), "none", ' stroke="#7a6a7a" stroke-width="2.4" opacity=".55" stroke-linejoin="round"'))
    # cap
    out.append(path(poly(ft + list(reversed(bt))), "url(#wallt)"))
    out.append(path(poly(ft, False), "none", ' stroke="#fff6e0" stroke-width="2.5"'))
    # cap shadow line on the face
    out.append(path(poly([(x, y + 6) for x, y in ft], False), "none", ' stroke="#5a4a5e" stroke-width="7" opacity=".22"'))
    # moss: small tufted clumps along the cap, trailing strands down the face
    mo = []
    for i in range(int((xb - xa) * 4)):
        X = rw.uniform(xa, xb)
        c = P(X, WH, wall_z(X) + rw.uniform(0, WT * 0.6))
        sz = F / wall_z(X)
        col = rw.choice(["#6fae5c", "#8fc46a", "#5a9a52"])
        for j in range(4):
            mo.append(ellipse(c[0] + rw.uniform(-0.06, 0.06) * sz, c[1] + rw.uniform(-0.008, 0.008) * sz, 0.035 * sz * rw.uniform(0.7, 1.2), 0.014 * sz, col))
    for i in range(int((xb - xa) * 2)):
        X = rw.uniform(xa, xb)
        c = P(X, WH - 0.02, wall_z(X))
        sz = F / wall_z(X)
        mo.append(path(f"M{f(c[0])} {f(c[1])}q{f(0.03*sz)} {f(0.08*sz)} {f(0.01*sz)} {f(0.16*sz)}", "none", ' stroke="#5f9f52" stroke-width="3" stroke-linecap="round"'))
    out.append("".join(mo))
    return "".join(out)


fg.append(wall_run(-2.2, G0[0]))
fg.append(wall_run(G1[0], 3.6, 6))

# --- the wooden gate, a small roof over a pair of posts; both leaves swung open into the garden
gt = []
PH = 1.55


def post(X, Z, w=0.16):
    a_, b_ = P(X - w / 2, 0, Z), P(X + w / 2, PH, Z)
    out = rect(a_[0], b_[1], b_[0] - a_[0], a_[1] - b_[1], "#7a5240")
    out += rect(a_[0], b_[1], (b_[0] - a_[0]) * 0.32, a_[1] - b_[1], "#c79066", ' opacity=".85"')
    out += rect(b_[0] - (b_[0] - a_[0]) * 0.22, b_[1], (b_[0] - a_[0]) * 0.22, a_[1] - b_[1], "#4a2f2a", ' opacity=".55"')
    return out


# doors (open inward), behind the posts
for (hx, hz, sgn) in [(G0[0] + 0.08, G0[1] + 0.03, 1), (G1[0] - 0.08, G1[1] + 0.03, -1)]:
    ang = math.radians(72)
    ex, ez = hx + sgn * 0.22 * math.cos(ang), hz + 0.22 * math.sin(ang) + 0.05
    q = [P(hx, 1.05, hz), P(ex, 1.05, ez), P(ex, 0.06, ez), P(hx, 0.06, hz)]
    gt.append(path(poly(q), "#8f6048"))
    lat = []
    for t in (0.33, 0.66):
        a_ = (lerp(q[0][0], q[1][0], t), lerp(q[0][1], q[1][1], t))
        b_ = (lerp(q[3][0], q[2][0], t), lerp(q[3][1], q[2][1], t))
        lat.append(f"M{f(a_[0])} {f(a_[1])}L{f(b_[0])} {f(b_[1])}")
    for t in (0.15, 0.4, 0.65, 0.9):
        a_ = (lerp(q[0][0], q[3][0], t), lerp(q[0][1], q[3][1], t))
        b_ = (lerp(q[1][0], q[2][0], t), lerp(q[1][1], q[2][1], t))
        lat.append(f"M{f(a_[0])} {f(a_[1])}L{f(b_[0])} {f(b_[1])}")
    gt.append(path("".join(lat), "none", ' stroke="#5a3a2c" stroke-width="2.5"'))
gt.append(post(G1[0], G1[1]))
gt.append(post(G0[0], G0[1]))
# crossbeam + lintel
for (Y0, Y1, ov) in [(PH - 0.3, PH - 0.22, 0.1), (PH - 0.06, PH + 0.04, 0.26)]:
    pa = [P(G0[0] - ov, Y1, G0[1] - 0.1 * ov), P(G1[0] + ov, Y1, G1[1] + 0.1 * ov), P(G1[0] + ov, Y0, G1[1] + 0.1 * ov), P(G0[0] - ov, Y0, G0[1] - 0.1 * ov)]
    gt.append(path(poly(pa), "#6a4436"))
    gt.append(path(f"M{f(pa[0][0])} {f(pa[0][1])}L{f(pa[1][0])} {f(pa[1][1])}", "none", ' stroke="#d39a6a" stroke-width="2.5"'))
# small gable roof: soffit, tile edge, ridge
e0, e1 = P(G0[0] - 0.42, PH + 0.06, G0[1] - 0.28), P(G1[0] + 0.42, PH + 0.06, G1[1] - 0.16)
k0, k1 = P(G0[0] - 0.38, PH + 0.32, G0[1] + 0.2), P(G1[0] + 0.38, PH + 0.32, G1[1] + 0.3)
gt.append(path(poly([P(G0[0] - 0.4, PH + 0.04, G0[1] + 0.08), P(G1[0] + 0.4, PH + 0.04, G1[1] + 0.16), e1, e0]), "#3a2a30"))
gt.append(path(f"M{f(e0[0])} {f(e0[1])}L{f(k0[0])} {f(k0[1])}L{f(k1[0])} {f(k1[1])}L{f(e1[0])} {f(e1[1])}Z", "#3a5aa8"))
tiles = []
for i in range(13):
    t = (i + 0.5) / 13
    c = (lerp(e0[0], e1[0], t), lerp(e0[1], e1[1], t))
    tiles.append(circle(c[0], c[1] + 2, 7 * (1 - 0.25 * t), "#2c4a94"))
    tiles.append(circle(c[0] - 1.5, c[1], 3 * (1 - 0.25 * t), "#8fb0f0"))
gt.append("".join(tiles))
gt.append(path(f"M{f(e0[0])} {f(e0[1])}L{f(e1[0])} {f(e1[1])}", "none", ' stroke="#ffe2a8" stroke-width="2.5" opacity=".9"'))
gt.append(path(f"M{f(k0[0]-6)} {f(k0[1])}L{f(k1[0]+6)} {f(k1[1])}", "none", ' stroke="#1f3470" stroke-width="9" stroke-linecap="round"'))
gt.append(path("".join(f"M{f(lerp(e0[0], k0[0], t))} {f(lerp(e0[1], k0[1], t))}L{f(lerp(e1[0], k1[0], t))} {f(lerp(e1[1], k1[1], t))}" for t in (0.35, 0.7)), "none", ' stroke="#2a4488" stroke-width="2.5"'))
# a glass wind chime under the lintel
cc = P((G0[0] + G1[0]) / 2, PH - 0.22, (G0[1] + G1[1]) / 2)
cs = F / ((G0[1] + G1[1]) / 2) / 240
gt.append(f'<g transform="translate({f(cc[0])} {f(cc[1])}) scale({f2(cs)})">'
          '<path d="M0 0V22" stroke="#fff" stroke-width="1.2" opacity=".85"/>'
          '<path d="M-13 38C-14 16 14 16 13 38Q0 42 -13 38Z" fill="#9fe0ff" fill-opacity=".6" stroke="#fff" stroke-width="1.4"/>'
          '<path d="M-6 28q3 6 8 2" fill="none" stroke="#ff7fb0" stroke-width="2.2" stroke-linecap="round"/>'
          '<path d="M0 36V46" stroke="#fff" stroke-width="1"/><rect x="-5" y="46" width="10" height="34" fill="#ffd36e"/>'
          f'<path d="{star4(-6, 24, 10, .1)}" fill="#fff"/></g>')
fg.append("".join(gt))
doc.a("".join(fg))

# warm afternoon haze from the sun side, and a gentle vignette
doc.d(rg("haze", SUNX, SUNY, 1500, [(0, "#fff0c0", 0.42), (0.35, "#ffd890", 0.16), (1, "#ffd890", 0)]))
doc.a(rect(0, 0, W, H, "url(#haze)"))
doc.d(rg("vig", 960, 500, 1200, [(0, "#1a1440", 0), (0.65, "#1a1440", 0), (1, "#1a1440", 0.3)],
         transform="translate(960 500) scale(1 .8) translate(-960 -500)"))
doc.a(rect(0, 0, W, H, "url(#vig)"))

n = doc.write(OUT)
print(OUT, n)
