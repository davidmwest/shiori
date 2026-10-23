#!/usr/bin/env python3
"""cg/countess.svg: "Countess Fluorite of the Capital" (Chapter 3, Lantern Night)."""
import math, random, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from outpath import out_path
import cglib as L
from cglib import *
import suzuparts as SU

L.reset("cg-c-")
OUT = out_path('cg/countess.svg', __doc__)
W, H = 1920, 1080
rnd = random.Random(7)

LANTERN = {"ruby": ("#ff4d6d", "#ffd0d8", "#a8163a"), "cobalt": ("#3f6dff", "#cfe0ff", "#1d2f9a"),
           "emerald": ("#2fd08a", "#d4ffe9", "#0f7a4e"), "amber": ("#ffb02e", "#fff0c0", "#b8640a")}


# ------------------------------------------------------------------ background
def sky():
    s = f'<rect width="{W}" height="{H}" fill="{lin("sky", [(0, "#0d0a36"), (.3, "#1e1564"), (.62, "#45298a"), (.85, "#7a46a2"), (1, "#a35aa8")], 0, 0, 0, 760, user=True)}"/>'
    st = [(rnd.uniform(0, W), rnd.uniform(0, 420), rnd.choice((1, 1, 1.2, 1.5, 2))) for _ in range(140)]
    s += dots(st[:70], "#ffffff", .85) + dots(st[70:], "#ffffff", .45)
    for (x, y, r) in ((300, 70, 9), (1500, 110, 8), (1220, 40, 6), (640, 150, 6), (1800, 260, 7)):
        s += sparkle(x, y, r, "#fff6d8", .9)
    return s


def house(x, w, ybase, hwall, roof, roofline, wall="#3b2a6e", win="#ffcf7a", depth=1.0):
    """A shop front across the square: wall with glowing paper windows and a tiled roof."""
    s = ""
    ytop = ybase - hwall
    s += f'<rect x="{F(x)}" y="{F(ytop)}" width="{F(w)}" height="{F(hwall+200)}" fill="{wall}"/>'
    nw = max(1, int(w // 70))
    ww = w / nw
    wins, grid, glow = "", "", ""
    for i in range(nw):
        wx = x + i * ww + ww * .18
        wy = ytop + hwall * .22
        wwid, wh = ww * .64, hwall * .38
        wins += f"M{F(wx)} {F(wy)}h{F(wwid)}v{F(wh)}h{F(-wwid)}Z"
        glow += f"M{F(wx-10)} {F(wy-10)}h{F(wwid+20)}v{F(wh+20)}h{F(-wwid-20)}Z"
        grid += "".join(f"M{F(wx + wwid*k/4)} {F(wy)}v{F(wh)}" for k in range(1, 4)) + f"M{F(wx)} {F(wy+wh/2)}h{F(wwid)}"
    s += P(glow, fill=win, op=.35, extra=blur(8)) + P(wins, fill=win, op=.95) + P(grid, stroke="#8a5a3a", sw=1.4, op=.6)
    oh = 26 * depth
    rh = 46 * depth
    d = f"M{F(x-oh)} {F(ytop+6)} L{F(x+w+oh)} {F(ytop+6)} L{F(x+w-10)} {F(ytop-rh)} L{F(x+10)} {F(ytop-rh)} Z"
    s += P(d, fill=roof, stroke=roofline, sw=2)
    s += P("".join(f"M{F(x-oh+ (10+oh)*k/4)} {F(ytop + 6 - rh * k / 4)}L{F(x+w+oh-(10+oh)*k/4)} {F(ytop + 6 - rh * k / 4)}" for k in range(1, 4)),
           stroke=roofline, sw=1.2, op=.55)
    s += P(f"M{F(x-oh)} {F(ytop+6)} L{F(x+w+oh)} {F(ytop+6)}", stroke="#ffffff", sw=1.4, op=.25)
    s += f'<rect x="{F(x-oh)}" y="{F(ytop+6)}" width="{F(w+2*oh)}" height="{F(8*depth)}" fill="#1c1240" opacity=".7"/>'
    return s


def backdrop():
    s = ""
    # Glass Hill far behind, the Glasshouse roof catching a last glint
    s += P("M520 560 C640 420 780 300 900 260 C960 240 1010 250 1060 280 C1180 340 1320 450 1420 560 Z",
           fill="#3a2672", op=.95)
    s += P("M880 262 L1040 262 L1030 248 L890 248 Z", fill="#ffd6ef", op=.8)
    s += ell(960, 255, 120, 30, "#ffb6e0", .35, extra=blur(10))
    # zigzag of lanterns climbing the hill
    pts = [(1180, 520), (1010, 470), (1150, 420), (1000, 370), (1090, 320), (1000, 290)]
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        s += dots([(x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8, 2.2) for k in range(8)], "#ffd98a", .9)
    # row of shop fronts across the square
    xs = [(330, 210, "#3f6fd8", "#1f2f78"), (540, 200, "#ef8a3c", "#8a3a14"), (740, 220, "#3f6fd8", "#1f2f78"),
          (960, 210, "#ef8a3c", "#8a3a14"), (1170, 200, "#3f6fd8", "#1f2f78"), (1370, 220, "#ef8a3c", "#8a3a14")]
    for (x, w, rc, rl) in xs:
        s += house(x, w, 640, 120, rc, rl)
    # soft haze of light over the square
    s += ell(960, 640, 820, 120, "#ff9ad0", .25, extra=blur(30))
    return s


def lantern_sym(kind):
    col, light, dark = LANTERN[kind]
    gid = rad("lan-" + kind, [(0, "#ffffff"), (.25, light), (.7, col), (1, dark)], .42, .4, .62)
    r = 20
    body = circ(0, 0, r * 2.4, col, .38, blur(r * .9))
    body += circ(0, 0, r, gid)
    body += f'<rect x="{F(-r*.42)}" y="{F(-r*1.18)}" width="{F(r*.84)}" height="{F(r*.32)}" rx="{F(r*.08)}" fill="#2a1c3a"/>'
    body += f'<rect x="{F(-r*.3)}" y="{F(r*.92)}" width="{F(r*.6)}" height="{F(r*.22)}" rx="{F(r*.06)}" fill="#2a1c3a"/>'
    body += ell(-r * .35, -r * .4, r * .28, r * .18, "#ffffff", .9, rot=-35)
    body += P(f"M{F(-r*.75)} {F(r*.1)} C{F(-r*.6)} {F(r*.6)} {F(-r*.1)} {F(r*.82)} {F(r*.3)} {F(r*.78)}", stroke="#ffffff", sw=1.4, op=.5)
    symbol("lan-" + kind, body)


def lantern(x, y, r, kind, blurred=0.0, op=1.0):
    if blurred:
        col, light, dark = LANTERN[kind]
        gid = rad("lan-" + kind, [(0, "#ffffff"), (.25, light), (.7, col), (1, dark)], .42, .4, .62)
        s = circ(x, y, r * 2.4, col, .38, blur(r * .9))
        body = circ(x, y, r, gid)
        body += ell(x - r * .35, y - r * .4, r * .28, r * .18, "#ffffff", .9, rot=-35)
        s += g(body, extra=blur(blurred))
        return s
    lantern_sym(kind)
    u = use("lan-" + kind, f"translate({F(x)} {F(y)}) scale({F(r / 20)})")
    return g(u, extra=f'opacity="{F(op)}"') if op != 1 else u


def catenary(x1, y1, x2, y2, sag, n=60):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t)
        pts.append((x, y))
    return pts


def lantern_string(x1, y1, x2, y2, sag, count, r, kinds, start=0, wire="#1a1030", blurred=0.0):
    pts = catenary(x1, y1, x2, y2, sag)
    d = "M" + " L".join(f"{F(x)} {F(y)}" for x, y in pts)
    s = P(d, stroke=wire, sw=max(1.5, r * .12))
    hang = ""
    lan = ""
    for k in range(count):
        t = (k + .5) / count
        i = int(t * (len(pts) - 1))
        x, y = pts[i]
        hang += f"M{F(x)} {F(y)}v{F(r*.6)}"
        lan += lantern(x, y + r * 1.6, r, kinds[(k + start) % len(kinds)], blurred)
    s += P(hang, stroke=wire, sw=1.5) + lan
    return s


def lanterns_back():
    ks = ["ruby", "cobalt", "amber", "emerald"]
    s = ""
    s += lantern_string(-40, 300, 1960, 250, 160, 16, 15, ks, 0)
    s += lantern_string(-40, 150, 1960, 380, 120, 15, 17, ks, 1)
    s += lantern_string(-40, 420, 1960, 140, 140, 15, 16, ks, 2)
    s += lantern_string(200, 470, 1720, 470, 90, 22, 9, ks, 3)
    return s


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])


def eave(p0, p1, p2, p3, corner, tile, tile_d, tile_l, cap, under="#1c1238", n=18):
    """Tiled roof eave whose lower edge is the cubic p0..p3; 'corner' closes it off-canvas."""
    s = ""
    edge = f"M{F(p0[0])} {F(p0[1])} C{F(p1[0])} {F(p1[1])} {F(p2[0])} {F(p2[1])} {F(p3[0])} {F(p3[1])}"
    und = edge + f" L{F(p3[0])} {F(p3[1] + 34)} C{F(p2[0])} {F(p2[1] + 34)} {F(p1[0])} {F(p1[1] + 34)} {F(p0[0])} {F(p0[1] + 34)} Z"
    s += P(und, fill=under)
    raft = ""
    for k in range(n + 1):
        x, y = bez(p0, p1, p2, p3, k / n)
        raft += f"M{F(x)} {F(y + 6)}v20"
    s += P(raft, stroke="#3a2a5a", sw=10)
    s += P(f"M{F(p0[0])} {F(p0[1] + 34)} C{F(p1[0])} {F(p1[1] + 34)} {F(p2[0])} {F(p2[1] + 34)} {F(p3[0])} {F(p3[1] + 34)}", stroke="#ffcf7a", sw=2, op=.35)
    roof = edge + " " + corner + " Z"
    s += P(roof, fill=tile, stroke=tile_l, sw=3)
    dark, light = "", ""
    for k in range(n * 2 + 1):
        x, y = bez(p0, p1, p2, p3, k / (2 * n))
        if k % 2:
            dark += f"M{F(x)} {F(y)}l-260 -420"
        else:
            light += f"M{F(x)} {F(y)}l-260 -420"
    rid = P(dark, stroke=tile_d, sw=9, op=.45) + P(light, stroke="#ffffff", sw=5, op=.18)
    rows = ""
    for j in range(1, 6):
        off = j * 40
        rows += f"M{F(p0[0] - off*.62)} {F(p0[1] - off)} C{F(p1[0] - off*.62)} {F(p1[1] - off)} {F(p2[0] - off*.62)} {F(p2[1] - off)} {F(p3[0] - off*.62)} {F(p3[1] - off)}"
    rid += P(rows, stroke=tile_l, sw=2, op=.35)
    s += clipped(roof, rid)
    caps = [bez(p0, p1, p2, p3, k / n) for k in range(n + 1)]
    s += dots([(x, y, 14.2) for x, y in caps], tile_l)
    s += dots([(x, y, 11.8) for x, y in caps], cap)
    ring = "".join(f"M{F(x - 6)} {F(y)}a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" for x, y in caps)
    s += P(ring, stroke=tile_l, sw=1.4, op=.7)
    hl = "".join(f"M{F(x - 8)} {F(y - 6)}c4 -5 10 -6 14 -4" for x, y in caps)
    s += P(hl, stroke="#ffffff", sw=1.8, op=.6)
    return s


def eaves():
    s = ""
    s += eave((540, -16), (430, 70), (220, 170), (-24, 250), "L-60 -60 L600 -60",
              "#3360c8", "#1f3a8a", "#152a66", "#4a78e0")
    s += eave((1380, -16), (1490, 70), (1700, 170), (1944, 250), "L1980 -60 L1320 -60",
              "#e8743a", "#b8501e", "#7a2e10", "#f59a5a")
    for (x, y, c) in ((150, 262, "#7ab8ff"), (360, 160, "#ff9ad0"), (1570, 160, "#9cffd8"), (1780, 262, "#ffd36e")):
        s += chime(x, y, c)
    return s


def chime(x, y, col):
    s = P(f"M{F(x)} {F(y)} L{F(x)} {F(y+18)}", stroke="#d8d0ff", sw=1.4)
    bell = f"M{F(x-16)} {F(y+44)} C{F(x-16)} {F(y+26)} {F(x-10)} {F(y+18)} {F(x)} {F(y+18)} C{F(x+10)} {F(y+18)} {F(x+16)} {F(y+26)} {F(x+16)} {F(y+44)} Z"
    s += P(bell, fill="#f4f0ff", op=.55) + P(bell, stroke=GLASS_LINE, sw=1.6)
    s += P(f"M{F(x-11)} {F(y+40)} C{F(x-11)} {F(y+28)} {F(x-6)} {F(y+23)} {F(x)} {F(y+22)}", stroke="#ffffff", sw=1.6, op=.9)
    s += P(f"M{F(x-6)} {F(y+30)} C{F(x-2)} {F(y+36)} {F(x+6)} {F(y+28)} {F(x+10)} {F(y+36)}", stroke=col, sw=2.4, op=.8)
    s += P(f"M{F(x)} {F(y+44)} L{F(x)} {F(y+70)}", stroke="#d8d0ff", sw=1.2)
    s += f'<rect x="{F(x-7)}" y="{F(y+70)}" width="14" height="24" rx="2" fill="{col}" opacity=".9"/>'
    s += circ(x, y + 34, 26, col, .25, blur(8))
    return s


def crowd():
    """Implied crowd: silhouettes with lantern rim light (merged paths)."""
    s = ""
    rr = random.Random(3)
    for row, (y0, sc, col) in enumerate(((690, .8, "#2c1e62"), (760, 1.0, "#21174e"))):
        x = -40 + row * 50
        bodies = ""
        heads = []
        rims = {}
        while x < W + 40:
            w = rr.uniform(70, 110) * sc
            hh = rr.uniform(150, 200) * sc
            hr = 26 * sc
            cx = x + w / 2
            top = y0 - hh + rr.uniform(-12, 12)
            bodies += (f"M{F(x)} {F(y0+300)} L{F(x+4)} {F(top+hr*2.4)} C{F(x+8)} {F(top+hr*1.8)} {F(cx-hr)} {F(top+hr*1.7)} {F(cx)} {F(top+hr*1.7)} "
                       f"C{F(cx+hr)} {F(top+hr*1.7)} {F(x+w-8)} {F(top+hr*1.8)} {F(x+w-4)} {F(top+hr*2.4)} L{F(x+w)} {F(y0+300)} Z")
            heads.append((cx, top + hr * .9, hr))
            rim = rr.choice(("#ff7aa0", "#7ab0ff", "#7ff0c0", "#ffc860"))
            rims.setdefault(rim, "")
            rims[rim] += (f"M{F(cx - hr*.9)} {F(top + hr*.4)} C{F(cx - hr*.5)} {F(top - hr*.05)} {F(cx + hr*.3)} {F(top - hr*.1)} {F(cx + hr*.8)} {F(top + hr*.3)}"
                          f"M{F(x+6)} {F(top+hr*2.5)} C{F(x+10)} {F(top+hr*2)} {F(cx-hr)} {F(top+hr*1.8)} {F(cx)} {F(top+hr*1.8)}")
            x += w * rr.uniform(.75, 1.0)
        s += P(bodies, fill=col) + dots(heads, col)
        for c, d in rims.items():
            s += P(d, stroke=c, sw=2.1 * sc, op=.5)
    return s


def burst(cx, cy):
    """Comic spotlight rays behind the Countess."""
    s = ""
    n = 28
    for k in range(n):
        a0 = 2 * math.pi * k / n
        a1 = a0 + 2 * math.pi / n * .45
        R = 1400
        d = f"M{F(cx)} {F(cy)} L{F(cx + R*math.cos(a0))} {F(cy + R*math.sin(a0))} L{F(cx + R*math.cos(a1))} {F(cy + R*math.sin(a1))} Z"
        s += P(d, fill="#fff2c8" if k % 2 else "#ffc8ec")
    gid = rad("burstFade", [(0, "#fff", .7), (.35, "#fff", .4), (1, "#fff", 0)], cx, cy, 900, user=True)
    mid = I("burstMask")
    L.add_def("burstMask", f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
                           f'<rect width="{W}" height="{H}" fill="{gid}"/></mask>')
    return g(s, extra=f'mask="url(#{mid})" opacity=".55"')


# ------------------------------------------------------------------ Suzu, the Countess
PURPLE = "#9446dc"
PURPLE_L = "#b06cf0"
PURPLE_SH = "#6c2cb4"
PURPLE_LINE = "#3c1478"
MITT = "#fff4e2"
MITT_SH = "#ecd6b4"
MITT_LINE = "#9a6e44"
RIBBON = "#ff86c2"
RIBBON_D = "#d8488e"

SU_X, SU_Y, SU_S, SU_R = 960, 468, 1.32, -3


def duck(x, y, s=1.0, rot=0, flip=False):
    """Small white cartoon duck for the kimono pattern."""
    f = -1 if flip else 1
    c = P("M-16 4 C-16 -6 -6 -10 4 -8 C8 -16 18 -18 22 -10 C24 -6 22 -2 18 0 C24 2 22 12 10 14 C-2 16 -16 14 -16 4 Z",
          fill="#ffffff", stroke="#d9c8ff", sw=1.2)
    c += P("M21 -10 C26 -11 30 -9 30 -7 C27 -6 24 -6 21 -6 Z", fill="#ffa53a", stroke="#c86a10", sw=.8)
    c += circ(16, -10, 1.6, "#3a2060")
    c += P("M-6 2 C-2 -2 4 -2 8 2 C4 4 -2 5 -6 2 Z", fill="#e8dcff")
    symbol("duck", c)
    return use("duck", f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(f*s)} {F(s)})")


def ducks_in(region, bbox, step=74, s=1.0, seed=1):
    rr = random.Random(seed)
    x0, y0, x1, y1 = bbox
    c = ""
    j = 0
    y = y0
    while y < y1:
        x = x0 + (step / 2 if j % 2 else 0)
        while x < x1:
            c += duck(x + rr.uniform(-10, 10), y + rr.uniform(-8, 8), s * rr.uniform(.85, 1.05), rr.uniform(-15, 15), rr.random() < .4)
            x += step
        y += step * .78
        j += 1
    return clipped(region, c)


def mitt(tf, quilt_seed=0, scorch=True):
    """Quilted oven mitt; local frame: wrist at origin, fingers along +y."""
    body = ("M-36 6 C-40 40 -42 82 -36 112 C-30 140 -8 154 12 152 C34 150 46 130 46 102 "
            "C46 74 44 40 40 6 Z")
    thumb = "M-36 44 C-54 46 -70 62 -70 82 C-70 98 -58 104 -46 96 C-40 90 -38 78 -37 68 Z"
    cuff = "M-46 -34 C-16 -40 18 -40 50 -34 L46 14 C16 20 -16 20 -42 14 Z"
    s = P(thumb, fill=MITT, stroke=MITT_LINE, sw=2.6)
    s += P(body, fill=MITT, stroke=MITT_LINE, sw=2.6)
    q = P("".join(f"M{k*18 - 60} -10l160 180M{k*18 + 60} -10l-160 180" for k in range(-6, 8)), stroke=MITT_LINE, sw=1.3, op=.35)
    q += P("M10 6 C26 30 34 70 30 120 C28 140 20 150 12 152 L60 160 L60 0 Z", fill=MITT_SH, op=.7)
    if scorch:
        q += ell(-4, 120, 14, 9, "#8a5a2a", .25, extra=blur(3))
    s += clipped(body, q)
    s += clipped(thumb, P("M-60 70 C-52 92 -44 96 -36 92 L-30 110 L-80 110 Z", fill=MITT_SH, op=.7)
                 + P("M-66 70 L-40 50 M-68 86 L-40 64", stroke=MITT_LINE, sw=1.2, op=.35))
    s += P("M-24 30 C-26 60 -26 90 -20 120", stroke="#ffffff", sw=3, op=.7)
    # cuff (quilted band)
    s += P(cuff, fill="#ffe8f2", stroke=MITT_LINE, sw=2.6)
    s += clipped(cuff, P("".join(f"M{k*14 - 50} -40v60" for k in range(8)), stroke=MITT_LINE, sw=1.1, op=.3)
                 + P("M20 -40 L60 -40 L60 30 L22 30 Z", fill=MITT_SH, op=.6))
    # pink ribbon tied round the cuff, with a bow
    band = "M-45 -14 C-16 -20 18 -20 49 -14 L48 -2 C18 -8 -16 -8 -44 -2 Z"
    s += P(band, fill=RIBBON, stroke=RIBBON_D, sw=1.8)
    s += P("M-40 -12 C-14 -17 16 -17 44 -12", stroke="#ffd6ea", sw=1.4, op=.9)
    bow = g(P("M0 0 C-14 -20 -36 -22 -38 -8 C-40 6 -18 8 0 0 Z", fill=RIBBON, stroke=RIBBON_D, sw=1.8)
            + P("M0 0 C14 -22 38 -22 38 -8 C38 6 16 8 0 0 Z", fill=RIBBON, stroke=RIBBON_D, sw=1.8)
            + P("M-4 2 C-10 16 -16 30 -22 40 L-12 38 L-10 46 C-4 34 0 18 2 4 Z", fill=RIBBON, stroke=RIBBON_D, sw=1.6)
            + P("M4 2 C12 14 20 26 30 34 L20 36 L22 44 C10 34 2 18 0 4 Z", fill=RIBBON, stroke=RIBBON_D, sw=1.6)
            + P("M-30 -12 C-24 -16 -16 -14 -10 -8", stroke="#ffd6ea", sw=1.6, op=.9)
            + P("M30 -12 C24 -16 16 -14 10 -8", stroke="#ffd6ea", sw=1.6, op=.9)
            + ell(0, 0, 7, 6, RIBBON_D) + ell(-1.5, -1.5, 3, 2, "#ffd6ea"),
            "translate(30 -8) rotate(10)")
    s += bow
    return g(s, tf)


def hat():
    """Cartwheel straw hat tipped right back, seen from below: a sun-disc behind her head."""
    cx, cy = 966, 300
    rx, ry, rot = 400, 282, -10
    straw = rad("straw", [(0, "#c88a3a"), (.3, "#e0a64e"), (.6, "#f4c46a"), (.88, "#ffdc8e"), (1, "#f0b456")], .5, .5, .5)
    s = ""
    s += ell(cx + 12, cy + 20, rx + 14, ry + 12, "#140c38", .4, rot, blur(12))
    s += f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" fill="{straw}" stroke="#7a4a14" stroke-width="3"/>'
    rings = ""
    ticks = []
    ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for k in range(2, 15):
        f = k / 15
        rings += f'<ellipse cx="{cx}" cy="{cy}" rx="{F(rx*f)}" ry="{F(ry*f)}" transform="rotate({rot} {cx} {cy})" fill="none" stroke="#9a5e1c" stroke-width="{F(1.1 + f)}" opacity=".42"/>'
        rings += f'<ellipse cx="{cx}" cy="{cy}" rx="{F(rx*f - 5)}" ry="{F(ry*f - 4)}" transform="rotate({rot} {cx} {cy})" fill="none" stroke="#fff2c0" stroke-width="1.2" opacity=".4"/>'
        n = int(18 + 46 * f)
        for j in range(n):
            a = 2 * math.pi * (j + .5 * (k % 2)) / n
            x, y = rx * (f - .5 / 15) * math.cos(a), ry * (f - .5 / 15) * math.sin(a)
            X, Y = cx + x * ca - y * sa, cy + x * sa + y * ca
            dx, dy = -math.sin(a) * 4.5, math.cos(a) * 4.5
            ticks.append(f"M{F(X-dx)} {F(Y-dy)}l{F(2*dx)} {F(2*dy)}")
    s += rings + P("".join(ticks), stroke="#8a5216", sw=1.1, op=.28)
    # warm shade where the crown meets her head
    s += ell(cx - 8, cy + 60, 190, 150, "#a0601e", .45, rot, blur(18))
    # bright rim on the lit (upper-left) edge
    s += f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-7}" ry="{ry-7}" transform="rotate({rot} {cx} {cy})" fill="none" stroke="#fff4c4" stroke-width="3.5" opacity=".85" stroke-dasharray="700 2000" stroke-dashoffset="-1200"/>'
    return s


def suzu_head():
    """Suzu in head-local coords: fox mask over the eyes, laughing."""
    s = ""
    s += SU.pins(SU.PINS_BACK)
    s += SU.hair_back()
    s += P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += P(NECK_SHADOW, fill=SKIN_SH)
    s += SU.face()
    # laughing mouth: wide open, tilted up to her left
    mouth = "M342 376 C360 386 400 386 420 368 C420 394 406 416 382 418 C358 418 344 402 342 376 Z"
    s += mouth_open(mouth, tongue="M352 410 C364 398 396 396 414 402 L414 424 L352 424 Z",
                    teeth_top="M342 376 C360 386 400 386 420 368 L420 362 L342 362 Z")
    s += P("M342 381 C360 391 400 391 419 374", stroke="#e6d6e0", sw=1, op=.7)
    s += P("M337 371 C339 374 341 376 344 378", stroke=MOUTH_LINE, sw=1.8)
    s += P("M419 365 C422 362 424 359 425 355", stroke=MOUTH_LINE, sw=1.8)
    s += blush(318, E + 44, 30, 11, strong=True)
    s += blush(442, E + 40, 30, 11, strong=True)
    s += SU.glass_eyes("neutral", gaze=-2)
    s += SU.crown()
    s += fox_mask()
    # hat ribbon tied under her chin
    for d in ("M300 236 C292 300 306 360 336 404 C350 424 372 432 392 430", "M462 236 C470 300 460 360 432 404 C420 420 408 428 396 430"):
        s += P(d, stroke=PURPLE_LINE, sw=7) + P(d, stroke=PURPLE_L, sw=4.4)
    bow = (P("M396 430 C380 416 360 414 356 426 C352 440 376 444 396 432 Z", fill=PURPLE_L, stroke=PURPLE_LINE, sw=2)
           + P("M398 430 C414 414 436 414 440 426 C444 440 418 444 398 432 Z", fill=PURPLE_L, stroke=PURPLE_LINE, sw=2)
           + P("M394 432 C390 446 384 458 378 468 M400 432 C406 446 414 456 422 464", stroke=PURPLE_LINE, sw=6)
           + P("M394 432 C390 446 384 458 378 468 M400 432 C406 446 414 456 422 464", stroke=PURPLE_L, sw=3.6)
           + ell(397, 431, 6, 5, PURPLE) + P("M362 422 C368 418 376 420 382 424", stroke="#ffffff", sw=1.4, op=.8))
    s += bow
    s += SU.locks()
    s += SU.pins(SU.PINS_FRONT)
    # smug sparkles
    s += sparkle(214, 300, 16, "#ffe680") + sparkle(196, 340, 7) + sparkle(560, 290, 12) + sparkle(548, 330, 6, "#d6c2ff")
    return s


def fox_mask():
    """White kitsune half-mask: ears, red markings, almond eye holes."""
    outer = ("M282 300 C282 280 286 262 292 248 L300 206 C312 220 322 236 330 250 "
             "C346 244 362 242 380 242 C398 242 414 244 430 250 C438 236 448 220 460 206 L468 248 "
             "C474 262 478 280 478 300 C478 326 470 344 456 352 C440 358 418 356 404 352 "
             "C398 360 390 366 380 366 C370 366 362 360 356 352 C342 356 320 358 304 352 C290 344 282 326 282 300 Z")
    holeL = "M306 326 C314 312 330 306 350 312 C356 314 358 318 356 322 C348 332 330 338 314 336 C308 334 304 330 306 326 Z"
    holeR = mir(holeL)
    mg = lin("mask", [(0, "#ffffff"), (.6, "#f8f4ff"), (1, "#e4def6")])
    s = ""
    s += P(outer, fill="#3a2a5a", op=.25, extra=f'transform="translate(4 6)" {blur(3)}')
    s += P(outer + " " + holeL + " " + holeR, fill=mg, stroke="#6d6a9e", sw=2.4, extra='fill-rule="evenodd"')
    d = "M300 214 C308 226 316 238 322 250 C314 254 306 258 298 262 Z"
    s += P(d, fill="#ff6a7a", op=.9) + P(mir(d), fill="#ff6a7a", op=.9)
    s += clipped(outer, P("M478 290 C478 330 464 350 440 356 C420 358 404 352 404 352 L480 360 Z", fill="#dcd4f2", op=.8)
                 + P("M356 352 C362 360 370 366 380 366 L380 372 L350 372 Z", fill="#dcd4f2", op=.6))
    liner = ("M304 326 C296 318 292 306 294 292 C298 302 304 308 312 312 C322 306 338 304 352 310 "
             "C340 308 326 310 316 316 C310 320 306 324 304 326 Z")
    s += P(liner, fill="#e8343c") + P(mir(liner), fill="#e8343c")
    s += P("M380 252 C372 264 370 276 376 288 C378 280 382 276 386 272 C384 282 386 290 392 294 C396 282 392 264 380 252 Z",
           fill="#e8343c")
    s += circ(380, 296, 3, "#ffc23e")
    for (x, y) in ((322, 346), (334, 350), (346, 350)):
        s += circ(x, y, 2.2, "#e8343c", .85)
        s += circ(760 - x, y, 2.2, "#e8343c", .85)
    s += ell(380, 360, 7, 4.5, "#2a1c3a")
    s += P("M300 210 C310 224 318 236 326 248", stroke="#ffd36e", sw=2, op=.9)
    s += P(mir("M300 210 C310 224 318 236 326 248"), stroke="#ffd36e", sw=2, op=.9)
    s += P("M296 290 C298 270 310 256 330 252", stroke="#ffffff", sw=3, op=.9)
    s += P(holeL, stroke="#6d6a9e", sw=1.6) + P(holeR, stroke="#6d6a9e", sw=1.6)
    s += sparkle(300, 262, 6) + sparkle(452, 270, 4, op=.8)
    return s


def suzu_body():
    s = ""
    torso = ("M906 648 C874 656 850 672 836 696 C822 724 816 766 816 816 L806 1100 L1114 1100 L1104 816 "
             "C1104 766 1098 724 1084 696 C1070 672 1046 656 1014 648 Z")
    kim = lin("kim", [(0, PURPLE_L), (.4, PURPLE), (1, "#7a34c4")], 0, 640, 0, 1080, user=True)
    s += P(torso, fill=kim, stroke=PURPLE_LINE, sw=3)
    s += ducks_in(torso, (800, 690, 1120, 1100), 66, .9, seed=2)
    s += clipped(torso, P("M1050 652 C1090 700 1104 800 1108 1100 L1140 1100 L1140 640 Z", fill=PURPLE_SH, op=.55))
    # collar: lilac han-eri under, purple over, left over right
    he = "M914 644 L940 644 C952 698 968 740 988 786 L976 800 C954 758 928 700 914 644 Z"
    s += P(he, fill="#e6dcff", stroke=PURPLE_LINE, sw=2) + P(mir(he, 960), fill="#e6dcff", stroke=PURPLE_LINE, sw=2)
    s += P("M1040 642 L1014 642 C1002 700 988 742 966 786 C952 814 934 840 914 862 L944 866 C964 842 982 812 996 784 "
           "C1018 736 1034 690 1040 642 Z", fill=PURPLE_L, stroke=PURPLE_LINE, sw=2.4)
    # glass collar glimpsed at the throat
    s += P("M934 646 C946 654 974 654 986 646 L992 664 C978 676 942 676 928 664 Z", fill="#f3eeff", op=.75)
    s += P("M934 650 C946 657 974 657 986 650", stroke="#ffffff", sw=3, op=.9)
    s += P("M930 662 C944 672 976 672 990 662", stroke=rainbow(), sw=1.6, op=.9)
    s += sparkle(976, 660, 6)
    # obi: white with lilac stripes, pink cord, glass bead
    obi = "M814 846 C890 862 1030 862 1106 846 L1108 972 C1030 988 890 988 812 972 Z"
    s += P(obi, fill=lin("obi", [(0, "#ffffff"), (1, "#e2d6ff")]), stroke="#5e4a9a", sw=2.6)
    s += clipped(obi, "".join(P(f"M800 {y} C890 {y+14} 1030 {y+14} 1120 {y}", stroke="#b89cf0", sw=3, op=.6) for y in (872, 950)))
    cord = "M812 912 C890 926 1030 926 1108 912"
    s += P(cord, stroke="#b8326e", sw=8) + P(cord, stroke="#ff7eb6", sw=4.5)
    s += circ(960, 922, 13, "#f5f0ff", .7) + circ(960, 922, 13, "none", extra=f'stroke="{GLASS_LINE}" stroke-width="2"')
    s += ell(955, 916, 4, 3, "#fff", rot=-30)
    return s


def sleeve_panel(d, seed, bbox, shade):
    kim = lin("kimS", [(0, PURPLE_L), (.5, PURPLE), (1, "#6a2ab2")], 0, 640, 0, 1080, user=True)
    s = P(d, fill=kim, stroke=PURPLE_LINE, sw=3)
    s += ducks_in(d, bbox, 64, .88, seed=seed)
    s += clipped(d, shade)
    return s


def suzu_arm_right():
    """Her right arm (screen-left): forearm raised, mitt held beside her laugh; the long sleeve hangs."""
    s = ""
    hang = ("M842 690 C808 700 782 730 770 770 C756 820 748 900 744 980 C742 1030 744 1070 748 1100 "
            "L872 1100 C862 1040 856 980 856 920 C856 860 862 800 872 760 L860 700 Z")
    s += sleeve_panel(hang, 5, (730, 680, 880, 1100),
                      P("M840 760 C836 860 840 980 850 1100 L890 1100 L890 700 Z", fill=PURPLE_SH, op=.6)
                      + P("M790 780 C780 860 774 960 776 1100", stroke=PURPLE_LINE, sw=1.6, op=.35))
    # upper arm + forearm tube, elbow low, rising to the wrist by her cheek
    fore = ("M838 700 C812 724 800 766 806 800 C812 826 836 830 854 812 C860 780 864 740 868 712 "
            "C870 696 864 686 850 688 Z")
    s += P(fore, fill=PURPLE_L, stroke=PURPLE_LINE, sw=2.6)
    tube = "M810 800 C806 760 810 700 820 660 L864 668 C858 712 856 760 858 798 Z"
    s += P(tube, fill=PURPLE_L, stroke=PURPLE_LINE, sw=2.6)
    s += P("M818 784 C816 750 822 716 834 690", stroke="#ffffff", sw=2.4, op=.45)
    s += ell(842, 660, 26, 12, lin("lining", [(0, "#5b4296"), (.6, "#8a6fd0"), (1, "#c3b0f2")], 0, 0, 1, 1), rot=14,
             extra=f'stroke="{PURPLE_LINE}" stroke-width="2.4"')
    s += mitt("translate(838 652) rotate(-150) scale(.84)")
    return s


def suzu_arm_left():
    """Her left arm (screen-right): mitt on the hip, elbow out; sleeve hangs from the forearm."""
    s = ""
    hang = ("M1080 700 C1120 712 1160 740 1186 780 C1210 820 1222 880 1226 960 C1228 1020 1226 1070 1222 1100 "
            "L1100 1100 C1106 1040 1112 980 1120 930 L1150 860 Z")
    s += sleeve_panel(hang, 11, (1080, 690, 1240, 1100),
                      P("M1190 780 C1210 860 1218 980 1214 1100 L1250 1100 L1250 700 Z", fill=PURPLE_SH, op=.7))
    upper = "M1076 690 C1110 700 1150 730 1178 774 C1186 790 1180 808 1164 812 C1140 790 1110 760 1078 742 Z"
    s += P(upper, fill=PURPLE_L, stroke=PURPLE_LINE, sw=2.6)
    s += mitt("translate(1150 806) rotate(128) scale(.82)")
    return s


def suzu():
    s = ""
    s += suzu_arm_left()
    s += suzu_body()
    s += g(suzu_head(), place(SU_X, SU_Y, SU_S, SU_R))
    s += suzu_arm_right()
    return s


# ------------------------------------------------------------------ the others
import cast as C

NAGI_IND = "#2f3a7a"
NAGI_IND_SH = "#222b5e"
NAGI_IND_LINE = "#151a3e"
NAGI_CORD = "#d8323c"


def iron_key(x, y, s=1.0, rot=0):
    c = P("M0 0 C-9 0 -14 6 -14 13 C-14 21 -8 26 0 26 C8 26 14 21 14 13 C14 6 9 0 0 0 Z M0 6 C-4 6 -7 9 -7 13 C-7 17 -4 20 0 20 C4 20 7 17 7 13 C7 9 4 6 0 6 Z",
          fill="#4a4a5a", stroke="#1e1e2a", sw=1.6, extra='fill-rule="evenodd"')
    c += P("M-3 25 L-3 64 L3 64 L3 25 Z", fill="#4a4a5a", stroke="#1e1e2a", sw=1.4)
    c += P("M3 50 L12 50 L12 56 L8 56 L8 60 L3 60 Z", fill="#4a4a5a", stroke="#1e1e2a", sw=1.2)
    c += P("M-10 8 C-8 4 -4 2 0 2", stroke="#b8b8d0", sw=1.6, op=.8)
    c += P("M-1 30 L-1 60", stroke="#9a9ab8", sw=1, op=.7)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


FACEPALM_F = [(-19, -52, -5, 44, 15, 12.5), (-5, -55, 0, 50, 15, 12.5), (9, -53, 5, 46, 14, 12), (21, -48, 11, 35, 12.5, 10.5)]
FACEPALM_T = (-24, -18, -30, 42, 18, 14.5)


def nagi():
    """Nagi, left, behind: a hand over her face. Head-local frame for everything."""
    s = ""
    s += C.nagi_back()
    # body: indigo samue over a white high-collared shirt
    torso = ("M346 470 C310 474 278 484 260 502 C246 518 240 544 238 576 L232 860 L528 860 L522 576 "
             "C520 544 514 518 500 502 C482 484 450 474 414 470 Z")
    s += P(torso, fill=lin("nagiInd", [(0, "#3a4690"), (1, NAGI_IND)], 0, 470, 0, 860, user=True), stroke=NAGI_IND_LINE, sw=2.6)
    s += clipped(torso, P("M470 480 C500 520 512 600 516 860 L540 860 L540 470 Z", fill=NAGI_IND_SH)
                 + P("M260 600 C280 660 290 720 288 800 M470 600 C460 660 456 720 460 800", stroke="#151a3e", sw=2, op=.5)
                 + P("M250 520 C262 560 268 600 270 640", stroke="#5868b0", sw=3, op=.5))
    s += C.neck()
    # high white collar and the shirt in the V
    s += P("M340 470 L420 470 C414 520 400 560 380 600 C360 560 346 520 340 470 Z", fill="#fbfbff", stroke="#6d6a9e", sw=1.6)
    s += P("M350 438 C366 446 394 446 410 438 L414 474 C396 482 364 482 346 474 Z", fill="#fbfbff", stroke="#6d6a9e", sw=2)
    s += P("M352 448 C368 454 392 454 408 448", stroke="#dfe3f2", sw=3)
    # samue collar bands crossing left over right
    s += P("M334 472 L352 472 C360 520 372 560 386 600 L374 612 C356 572 342 524 334 472 Z", fill=NAGI_IND_SH, stroke=NAGI_IND_LINE, sw=1.8)
    s += P("M426 472 L408 472 C398 530 384 572 362 610 C352 626 340 642 326 656 L344 660 C362 642 378 620 390 600 C408 566 420 524 426 472 Z",
           fill="#3a4690", stroke=NAGI_IND_LINE, sw=2)
    s += C.stitch("M412 478 C404 532 390 572 368 610") + C.stitch("M346 480 C354 524 366 560 380 594")
    # red cord and the iron key
    s += P("M352 450 C340 500 352 560 378 596", stroke="#8a1418", sw=3.4) + P("M352 450 C340 500 352 560 378 596", stroke=NAGI_CORD, sw=2)
    s += P("M408 450 C420 500 410 560 384 596", stroke="#8a1418", sw=3.4) + P("M408 450 C420 500 410 560 384 596", stroke=NAGI_CORD, sw=2)
    s += iron_key(381, 594, 1.0, 4)
    s += C.nagi_face()
    # under the hand: eyes squeezed shut, a wobbly mortified mouth
    s += closed_eyes("down", C.NAGI["lash"])
    s += P("M364 392 C369 388 373 392 378 389 C383 386 387 391 392 388 C395 386 398 388 400 390", stroke=MOUTH_LINE, sw=2.2)
    s += blush(436, E + 42, 26, 9, strong=True, hatch=False)
    s += C.nagi_front()
    # left arm folded across, cupping the right elbow
    s += P("M500 506 C522 540 530 600 524 650 C520 690 500 712 470 716 L330 712 C320 700 322 684 336 676 L458 668 C470 640 470 590 462 548 Z",
           fill="#3a4690", stroke=NAGI_IND_LINE, sw=2.4)
    s += P("M336 676 C330 690 332 704 342 712", stroke=NAGI_IND_LINE, sw=1.6, op=.6)
    # right forearm rising to the face; samue sleeve, white cuff
    fore = ("M246 520 C232 560 240 640 268 700 C286 734 330 736 350 712 C362 690 352 640 338 590 "
            "C330 560 326 520 328 484 L300 476 C276 480 256 496 246 520 Z")
    s += P(fore, fill="#4352a0", stroke=NAGI_IND_LINE, sw=2.8)
    s += clipped(fore, P("M300 520 C312 600 330 660 350 712 L380 712 L380 470 Z", fill="#33408a"))
    s += P("M262 560 C268 610 280 660 300 700", stroke="#5868b0", sw=2, op=.6)
    arm = "M292 470 C296 450 302 432 310 420 L344 436 C336 450 330 464 328 480 Z"
    s += P(arm, fill="#fbfbff", stroke="#6d6a9e", sw=2)
    s += g(hand_back(FACEPALM_F, FACEPALM_T, palm=(44, 54, 48)), "translate(326 428) rotate(24) scale(1.12)")
    # comic: gloom lines, sweat drop
    s += C.gloom(300, 460, 214, 246, 7, "#7a6ae0")
    s += C.sweat_drop(500, 300, .9, 20)
    return s


def limb(x0, y0, x1, y1, w0, w1, fill, line, sw=2.4):
    ang = math.degrees(math.atan2(x1 - x0, -(y1 - y0)))
    ln = math.hypot(x1 - x0, y1 - y0)
    d, _, _ = capsule(x0, y0, ang, ln, w0, w1, bulge=.08)
    return P(d, fill=fill, stroke=line, sw=sw), d


def hinata():
    """Hinata, right: doubled over laughing, flour on her cheek, one arm clamped across her stomach."""
    import figlab as FL
    s = ""
    shirt = lin("hinaShirt", [(0, "#f2604e"), (1, "#e8483a")], 0, 430, 0, 1000, user=True)
    apr = lin("apron", [(0, "#fff8ea"), (1, "#f6ead0")], 0, 500, 0, 1000, user=True)
    s += C.hina_back()
    # far arm hanging toward her knee (behind the body)
    fa, _ = FL.arm((528, 492), (566, 650), (582, 820), (58, 50, 44))
    s += P(fa, fill=SKIN_SH, stroke=SKIN_LINE, sw=2.4)
    torso = ("M330 440 C290 444 252 456 230 476 C212 494 204 524 202 560 L210 1000 L556 1000 L566 560 "
             "C564 524 556 494 538 476 C516 456 478 444 438 440 Z")
    s += P(torso, fill=shirt, stroke="#7a1e18", sw=2.6)
    s += clipped(torso, P("M500 450 C540 480 556 560 556 1000 L600 1000 L600 430 Z", fill="#c0342a")
                 + P("M226 560 C250 600 266 640 270 700 M540 570 C524 610 514 660 512 720", stroke="#9a2a22", sw=2, op=.5))
    s += C.neck(True)
    # shirt collar: V neck with small lapels
    s += P("M344 444 L380 512 L416 444 Z", fill=SKIN)
    s += P("M336 442 L380 516 L360 520 L322 452 Z", fill="#f26a58", stroke="#7a1e18", sw=2)
    s += P(mir("M336 442 L380 516 L360 520 L322 452 Z"), fill="#f26a58", stroke="#7a1e18", sw=2)
    # apron: bib on straps, waist band, skirt, the bakery logo, flour
    for d in ("M326 512 C308 486 296 466 300 446", mir("M326 512 C308 486 296 466 300 446")):
        s += P(d, stroke="#8a7350", sw=7) + P(d, stroke="#fff8ea", sw=4.4)
    bib = "M318 524 C318 512 326 506 338 506 L422 506 C434 506 442 512 442 524 L450 640 C420 650 340 650 310 640 Z"
    skirt = "M296 662 C340 674 420 674 466 662 L500 1000 L262 1000 Z"
    s += P(skirt, fill=apr, stroke="#8a7350", sw=2.4)
    s += P(bib, fill=apr, stroke="#8a7350", sw=2.4)
    s += clipped(bib, P("M420 506 C430 560 440 600 452 646 L470 646 L470 500 Z", fill="#eadbbc"))
    s += clipped(skirt, P("M440 664 C460 760 476 880 490 1000 L520 1000 L520 660 Z", fill="#eadbbc")
                 + ell(340, 760, 34, 16, "#ffffff", .7, extra=blur(4)) + P("M330 700 C324 800 318 900 316 1000 M420 700 C430 800 440 900 448 1000", stroke="#c8b48a", sw=1.6, op=.5))
    band = "M294 640 C340 652 420 652 468 640 L470 666 C420 678 340 678 292 666 Z"
    s += P(band, fill="#fff8ea", stroke="#8a7350", sw=2.2)
    s += C.apron_logo(380, 576, 1.15)
    s += ell(352, 610, 18, 8, "#ffffff", .7, extra=blur(2))
    # face
    s += C.hina_face()
    s += closed_eyes("squeeze", C.HINA["lash"])
    s += tear_drop(282, 318, 1.1) + tear_drop(270, 300, .7) + tear_drop(480, 316, 1.1) + tear_drop(494, 298, .7)
    mouth = "M336 372 C356 380 404 380 424 372 C424 400 406 424 380 424 C354 424 336 400 336 372 Z"
    s += mouth_open(mouth, tongue="M348 414 C360 400 400 400 412 414 L412 430 L348 430 Z",
                    teeth_top="M336 372 C356 380 404 380 424 372 L424 366 L336 366 Z")
    s += P("M336 377 C356 385 404 385 424 377", stroke="#e6d6e0", sw=1, op=.7)
    s += blush(318, E + 40, 30, 11, strong=True) + blush(442, E + 40, 30, 11, strong=True)
    s += C.flour(446, 382, 1.2, -10)
    s += C.hina_front()
    s += brow_pair("M300 268 C312 258 330 254 350 258 C353 260 351 263 348 262 C330 259 316 262 304 272 C301 274 299 271 300 268 Z", C.HINA["brow"])
    # near arm clamped across her stomach, hand gripping her side
    na, nap = FL.arm((240, 490), (222, 640), (430, 700), (60, 52, 44))
    s += P(na, fill=SKIN, stroke=SKIN_LINE, sw=2.4)
    s += clipped(na, P("M200 660 C300 700 380 716 440 724 L440 760 L200 760 Z", fill=SKIN_SH)
                 + P("M226 618 C234 630 242 640 252 646", stroke=SKIN_LINE, sw=1.5, op=.6))
    sl, cuff = FL.cap_sleeve((242, 474), (222, 640), 72)
    s += P(sl, fill=shirt, stroke="#7a1e18", sw=2.4) + P(cuff, fill="#f26a58", stroke="#7a1e18", sw=2.2)
    sl2, cuff2 = FL.cap_sleeve((522, 482), (560, 630), 58)
    s += P(sl2, fill="#d83e30", stroke="#7a1e18", sw=2.4) + P(cuff2, fill="#e85a4a", stroke="#7a1e18", sw=2.2)
    # fist with thumb wrapped over
    fist = "M420 680 C432 666 458 664 474 676 C488 686 490 708 480 720 C468 734 442 734 428 722 C418 712 412 692 420 680 Z"
    s += P(fist, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += P("M444 680 C448 688 448 698 444 706 M456 680 C460 688 460 700 456 708 M468 684 C472 692 472 702 468 710", stroke=SKIN_LINE, sw=1.3, op=.6)
    s += P("M424 690 C434 684 446 686 452 694", stroke=SKIN_LINE, sw=1.8, op=.8)
    # laugh marks
    for (x, y, a) in ((236, 300, -150), (226, 340, -175), (224, 380, 160)):
        dx, dy = math.cos(math.radians(a)), math.sin(math.radians(a))
        s += P(f"M{F(x)} {F(y)} L{F(x + dx*24)} {F(y + dy*24)}", stroke="#e8483a", sw=3)
    return s


def chestnut(x, y, s=1.0, rot=0):
    c = P("M0 -14 C10 -14 16 -4 14 6 C12 14 6 18 0 18 C-6 18 -12 14 -14 6 C-16 -4 -10 -14 0 -14 Z",
          fill=rad("chestnut", [(0, "#ffd9a0"), (.4, "#c97a34"), (1, "#7a3a12")], .38, .3, .75), stroke="#4a200a", sw=1.6)
    c += P("M-10 -6 C-6 -12 2 -14 6 -12", stroke="#ffffff", sw=2.2, op=.9)
    c += P("M-2 -14 L2 -18 L4 -14", stroke="#4a200a", sw=1.4)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


NEMU_COAT = "#1f5a43"
NEMU_COAT_SH = "#153f30"
NEMU_COAT_LINE = "#0b2a1f"


def nemu():
    """Nemu, far right: chewing a candied chestnut, dead inside."""
    s = ""
    s += ell(380, 260, 200, 150, "#1a1240", .55, extra=blur(26))
    s += C.nemu_back()
    torso = ("M330 452 C292 458 256 472 238 496 C224 518 218 556 220 600 L222 860 L540 860 L542 600 "
             "C544 556 538 518 524 496 C506 472 470 458 430 452 Z")
    coat = lin("nemuCoat", [(0, "#2a7054"), (1, NEMU_COAT)], 0, 452, 0, 860, user=True)
    # grey dress in the opening, buttoned wrong
    s += P("M332 456 L428 456 L440 860 L320 860 Z", fill="#8d929b", stroke="#3e424a", sw=2)
    for k, (bx, by) in enumerate(((372, 500), (390, 548), (374, 600), (392, 652), (376, 704))):
        s += circ(bx, by, 5, "#8a5a32", extra='stroke="#3e2410" stroke-width="1.4"')
    s += P("M380 470 C384 540 380 620 386 760", stroke="#3e424a", sw=1.2, op=.6)
    s += C.neck()
    s += P("M340 458 C350 486 372 490 380 470 C388 490 410 486 420 458 C400 452 360 452 340 458 Z", fill="#ffffff", stroke="#3e424a", sw=1.6)
    # coat halves
    left = ("M330 452 C292 458 256 472 238 496 C224 518 218 556 220 600 L222 860 L330 860 C334 760 336 640 340 540 L352 456 Z")
    right = mir(left)
    for d in (left, right):
        s += P(d, fill=coat, stroke=NEMU_COAT_LINE, sw=2.6)
    s += clipped(right, P("M470 470 C520 520 540 620 540 860 L560 860 L560 450 Z", fill=NEMU_COAT_SH))
    # collar band
    s += P("M352 456 L336 456 C330 560 326 700 322 860 L338 860 C342 700 346 580 352 456 Z", fill="#174a36", stroke=NEMU_COAT_LINE, sw=1.6)
    s += P(mir("M352 456 L336 456 C330 560 326 700 322 860 L338 860 C342 700 346 580 352 456 Z"), fill="#174a36", stroke=NEMU_COAT_LINE, sw=1.6)
    # mirror crests
    s += circ(290, 560, 13, "#e8f0f4", extra=f'stroke="{NEMU_COAT_LINE}" stroke-width="2"') + circ(286, 556, 4, "#ffffff")
    s += circ(470, 560, 15, "#e8f0f4", extra=f'stroke="{NEMU_COAT_LINE}" stroke-width="2"')
    s += circ(470, 560, 10, lin("mirror", [(0, "#ffffff"), (1, "#a8c0cc")], 0, 0, 1, 1))
    s += P("M464 554 L474 548", stroke="#ffffff", sw=2)
    s += C.nemu_face(cheek_puff=True)
    dead = dict(scl="M304 333 C312 327 324 325 336 325 C350 325 359 328 363 332 C364 343 357 352 337 355 C320 357 307 348 304 333 Z",
                lash=("M295 334 C303 322 320 318 336 318 C352 318 363 321 369 329 C370 332 368 333 366 332 "
                      "C360 327 350 325 336 325 C322 325 310 328 304 333 C300 336 297 336 295 334 Z"),
                flick="M302 331 C298 330 294 331 291 334 C295 333 299 334 302 335 Z",
                lower="M312 347 C318 352 327 354 337 355", crease="M306 312 Q332 306 360 312")
    s += eyes(dead, C.iris_for("nemuDull", C.NEMU, dull=True), C.NEMU["lash"], hl=False, gaze=(2, 6), iris_r=(18, 22))
    # dead-fish shadow over the upper face
    s += clipped(FACE, P("M270 250 L490 250 L490 360 C440 350 320 350 270 360 Z", fill=lin("nemuGloom", [(0, "#24206a", .85), (.6, "#3a3a8a", .45), (1, "#3a3a8a", 0)], 0, 0, 0, 1)))
    s += both("M302 336 C318 332 352 332 364 336", stroke="#2c5a4c", sw=1.2, op=.5)
    # chewing: mouth pushed to one side, cheek bulge
    s += P("M358 394 C364 392 370 392 374 394", stroke=MOUTH_LINE, sw=2.2)
    s += P("M452 372 C460 368 466 368 470 372", stroke="#ffffff", sw=2, op=.8)
    s += C.nemu_front()
    s += brow_pair("M304 282 C314 280 332 279 352 281 C354 283 352 285 350 284 C332 283 316 284 306 286 C304 287 303 285 304 282 Z", C.NEMU["brow"])
    s += C.gloom(300, 460, 250, 300, 8, "#2a2470")
    s += C.gloom(330, 430, 300, 318, 5, "#2a2470")
    # right sleeve raised to her mouth (big haori sleeve), chestnut held at her lips
    drape = ("M246 560 C222 620 214 720 224 800 C230 840 244 870 258 890 L372 890 C360 830 352 760 354 700 "
             "C356 650 366 600 380 560 Z")
    s += P(drape, fill="#2a7054", stroke=NEMU_COAT_LINE, sw=3)
    s += clipped(drape, P("M330 560 C330 660 340 780 360 890 L400 890 L400 540 Z", fill=NEMU_COAT_SH)
                 + P("M262 600 C250 680 252 780 270 870", stroke=NEMU_COAT_LINE, sw=1.6, op=.5))
    tube, tubed = limb(286, 650, 392, 448, 104, 78, "#2f7e5e", NEMU_COAT_LINE, 3)
    s += tube
    s += clipped(tubed, P("M330 660 L420 470 L460 470 L380 680 Z", fill=NEMU_COAT_SH, op=.8))
    s += P("M262 620 C290 560 330 500 364 452", stroke="#5ab08a", sw=3, op=.6)
    s += ell(394, 446, 40, 18, "#0e3324", rot=-28, extra=f'stroke="{NEMU_COAT_LINE}" stroke-width="2.4"')
    s += chestnut(380, 400, 1.2, -16)
    return s


# ------------------------------------------------------------------ foreground goldfish tank
def goldfish(x, y, s=1.0, rot=0, col="#ff6a2a"):
    c = P("M-18 0 C-12 -10 6 -12 16 -4 C20 0 20 4 16 6 C6 12 -12 10 -18 0 Z", fill=col, stroke="#a8300c", sw=1.4)
    c += P("M-16 0 C-26 -12 -40 -14 -44 -6 C-38 -2 -38 4 -44 8 C-40 14 -26 12 -16 2 Z", fill=col, op=.75, stroke="#a8300c", sw=1.2)
    c += P("M0 -8 C4 -16 10 -16 12 -10", fill=col, stroke="#a8300c", sw=1.2)
    c += circ(10, -3, 2, "#2a1020") + circ(9.4, -3.6, .7, "#fff")
    c += P("M-8 -4 C-2 -8 6 -8 10 -6", stroke="#ffe0b0", sw=1.4, op=.8)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


def tank():
    s = ""
    x0, y0, x1, y1 = -30, 770, 560, 1120
    s += ell(260, 760, 380, 120, "#46d9ff", .35, extra=blur(30))
    # back glass and water
    water = f"M{x0} {y0+26} L{x1} {y0+10} L{x1} {y1} L{x0} {y1} Z"
    s += P(water, fill=lin("water", [(0, "#7ff0ff"), (.3, "#2ab8f0"), (1, "#1458b8")], 0, 780, 0, 1080, user=True), op=.92)
    c = ""
    for (x, y, sc, r, col) in ((80, 880, 1.2, -8, "#ff6a2a"), (200, 940, 1.0, 12, "#ff8a3a"), (330, 870, 1.3, 172, "#ff5030"),
                               (460, 960, 1.1, -12, "#ffffff"), (140, 1010, 1.0, 190, "#ff7a2a"), (400, 1040, .9, 8, "#ff6030")):
        c += goldfish(x, y, sc, r, col)
    for k in range(18):
        bx, by = rnd.uniform(0, 540), rnd.uniform(800, 1080)
        c += circ(bx, by, rnd.uniform(2, 5), "none", extra='stroke="#e0fcff" stroke-width="1.4" opacity=".8"')
    # caustic ripples
    for k in range(6):
        yy = 800 + k * 40
        c += P(f"M0 {yy} C80 {yy-10} 160 {yy+10} 240 {yy} C320 {yy-10} 400 {yy+10} 540 {yy}", stroke="#c8faff", sw=2, op=.25)
    s += clipped(water, c)
    # water surface
    s += P(f"M{x0} {y0+26} L{x1} {y0+10} L{x1} {y0+24} L{x0} {y0+40} Z", fill="#d8fbff", op=.75)
    # glass box edges and glints
    s += P(f"M{x0} {y0} L{x1} {y0-14} L{x1} {y1} M{x0} {y0} L{x0} {y1}", stroke="#e8fcff", sw=4, op=.8)
    s += P(f"M{x1-6} {y0-8} L{x1-6} {y1}", stroke=rainbow(), sw=3, op=.7)
    s += P(f"M40 {y0+60} L120 {y0+40}", stroke="#ffffff", sw=5, op=.7)
    s += P(f"M60 {y0+90} L100 {y0+80}", stroke="#ffffff", sw=3, op=.6)
    s += sparkle(520, y0 + 10, 16) + sparkle(90, y0 + 40, 10, op=.9)
    # paper scoop leaning on the rim
    s += P("M520 860 L470 720", stroke="#e85a8a", sw=7) + P("M520 860 L470 720", stroke="#ffb6d2", sw=3)
    s += ell(462, 692, 30, 26, "#ffffff", .75, rot=-20, extra='stroke="#e85a8a" stroke-width="4"')
    s += P("M444 684 C452 676 466 674 476 680", stroke="#ffffff", sw=2.4, op=.9)
    return s


def fg_lanterns():
    s = ""
    s += lantern(70, 70, 64, "ruby", blurred=5)
    s += lantern(1860, 90, 70, "amber", blurred=5)
    s += lantern(1700, 40, 40, "emerald", blurred=3)
    return s


def glints():
    s = ""
    for (x, y, r, c) in ((620, 470, 14, "#fff6c0"), (1290, 430, 18, "#fff"), (700, 330, 9, "#ffd6f0"), (1250, 260, 10, "#fff6c0"),
                         (560, 600, 8, "#fff"), (1350, 560, 9, "#ffd6f0")):
        s += sparkle(x, y, r, c)
    # fireflies
    ff = [(rnd.uniform(0, W), rnd.uniform(380, 900)) for k in range(26)]
    s += dots([(x, y, 7) for x, y in ff], "#fff3a0", .35, blur(3)) + dots([(x, y, 2) for x, y in ff], "#fffbe0", .9)
    return s


def ground():
    s = f'<rect x="0" y="640" width="{W}" height="440" fill="{lin("ground", [(0, "#4a3684"), (1, "#2a1e58")], 0, 640, 0, 1080, user=True)}"/>'
    for k in range(9):
        y = 660 + k * k * 6
        s += P(f"M0 {y} L{W} {y}", stroke="#6a52a8", sw=1.4, op=.4)
    for k in range(-12, 13):
        s += P(f"M{960 + k*40} 640 L{960 + k*260} 1080", stroke="#6a52a8", sw=1.4, op=.35)
    s += ell(960, 760, 700, 90, "#ff9ad0", .18, extra=blur(30))
    return s


def build():
    body = sky() + backdrop() + lanterns_back() + ground() + eaves()
    body += crowd()
    body += burst(965, 330)
    body += g(nemu(), place(1786, 372, 1.0, -7))
    body += g(nagi(), place(318, 420, 1.06, 3))
    body += hat()
    body += suzu()
    body += g(hinata(), place(1524, 566, 1.12, -17))
    body += tank()
    body += fg_lanterns()
    body += glints()
    return body


if __name__ == "__main__":
    b = build()
    n = L.write(OUT, b)
    print(OUT, n)
