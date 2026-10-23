#!/usr/bin/env python3
"""bg/kiln_house.svg - inside the Keeper's kiln-house: one long tatami room, kiln centre-left, garden beyond."""
import sys, os, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from bglib import *
from outpath import out_path

OUT = out_path('bg/kiln_house.svg', __doc__)
D = Doc('kh')
R = random.Random(21)
VX, VY, F = 960, 400, 900.0


def P(X, Y, Z):
    return (VX + F * X / Z, VY - F * Y / Z)


def pp(pts):
    return 'M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in pts) + 'Z'


ZB = 4.2
XL, XR = -2.7, 2.7
YF, YC = -1.45, 1.0
BL, BR = P(XL, 0, ZB)[0], P(XR, 0, ZB)[0]
BT, BB = P(0, YC, ZB)[1], P(0, YF, ZB)[1]
OX0, OX1, OYT = -2.15, 2.15, 0.48          # garden opening in the back wall
ox0, ox1 = P(OX0, 0, ZB)[0], P(OX1, 0, ZB)[0]
oyt = P(0, OYT, ZB)[1]

D.d(lin_grad(D.id('rb'), [(0, '#ff7aa8'), (0.25, '#ffd36e'), (0.5, '#7ff0c0'), (0.75, '#7ab8ff'), (1, '#c69bff')]))
D.d(rad_grad(D.id('glw'), [(0, ('#ffffff', 0.95)), (0.4, ('#eafcff', 0.4)), (1, ('#eafcff', 0))]))

# ================================================================== the garden (seen through the back opening)
G = []
GZ0 = ZB + 0.9                      # garden edge beyond the veranda
GY = YF - 0.5                       # garden ground is a step lower
D.d(lin_grad(D.id('gsky'), [(0, '#3f8ef0'), (0.6, '#8fd0ff'), (1, '#d8f2ff')], 0, oyt - 10, 0, VY, user=True))
G.append(rect(ox0 - 5, oyt - 10, ox1 - ox0 + 10, VY - oyt + 12, fill=D.url('gsky')))
for cx, cy, w in [(700, 372, 90), (1180, 380, 120), (1360, 366, 60)]:
    G.append(ellipse(cx, cy, w, 12, fill='#ffffff', opacity='0.9'))
    G.append(ellipse(cx - w * 0.2, cy - 8, w * 0.5, 12, fill='#ffffff', opacity='0.95'))
# sea band at the horizon
D.d(lin_grad(D.id('gsea'), [(0, '#bfe9ff'), (0.3, '#5cb8f0'), (1, '#2f86d8')], 0, VY, 0, 470, user=True))
G.append(rect(ox0 - 5, VY, ox1 - ox0 + 10, 80, fill=D.url('gsea')))
G.append(rect(ox0 - 5, VY - 1, ox1 - ox0 + 10, 2.5, fill='#ffffff', opacity='0.9'))
gl = ''.join(f'M{n(R.uniform(ox0, ox1))},{n(VY + 4 + R.random() ** 1.5 * 50)}h{n(R.uniform(4, 14))}' for _ in range(40))
G.append(path(gl, stroke='#ffffff', stroke_width='1.5', opacity='0.8', stroke_linecap='round'))
# far trees (left) and the Glasshouse roof glinting at the right
G.append(path('M480,470 C480,420 520,392 560,396 C590,370 640,380 650,410 C690,404 700,440 690,470Z', fill='#2f8f62'))
G.append(path('M480,470 C482,430 512,404 548,404 C540,420 536,440 540,470Z', fill='#1f6a4a'))
G.append(path('M1300,452 L1440,452 L1440,436 L1330,420 Z', fill='#d8f6ff', opacity='0.85'))
G.append(path('M1330,420 L1440,436' , stroke='#ffffff', stroke_width='2.5'))
for x in range(1336, 1440, 14):
    G.append(path(f'M{x},{n(421 + (x - 1330) * 0.145)} V452', stroke='#8fb8d8', stroke_width='1.2'))
G.append(star4(1392, 430, 9, fill='#ffffff'))
# low stone garden wall
wz = 13.0
wy_top, wy_bot = P(0, GY + 1.0, wz)[1], P(0, GY, wz)[1]
G.append(rect(ox0 - 5, wy_top, ox1 - ox0 + 10, wy_bot - wy_top + 1, fill='#b9b6c9'))
G.append(rect(ox0 - 5, wy_top, ox1 - ox0 + 10, 4, fill='#eeeaf6'))
st = ''
for row in range(3):
    yy = wy_top + 4 + row * (wy_bot - wy_top - 4) / 3
    off = (row % 2) * 18
    for x in range(int(ox0) - 40 + off, int(ox1) + 40, 36):
        st += f'M{x},{n(yy)}v{n((wy_bot - wy_top - 4) / 3)}'
    st += f'M{n(ox0)},{n(yy)}H{n(ox1)}'
G.append(path(st, stroke='#8e8aa6', stroke_width='1.4', opacity='0.7'))
# garden ground
D.d(lin_grad(D.id('gground'), [(0, '#8fd06a'), (1, '#4fa85a')], 0, wy_bot, 0, 700, user=True))
G.append(rect(ox0 - 5, wy_bot, ox1 - ox0 + 10, 700 - wy_bot, fill=D.url('gground')))
# hydrangea prototype (shared look with the hill path)
def petal4(r):
    out = ''
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        px, py = math.cos(a) * r * 0.5, math.sin(a) * r * 0.5
        out += f'M{n(px + r*0.52)},{n(py)}a{n(r*0.52)},{n(r*0.52)} 0 1 0 {n(-r*1.04)},0a{n(r*0.52)},{n(r*0.52)} 0 1 0 {n(r*1.04)},0Z'
    return out
P4 = petal4(10)
D.d(f'<g id="{D.id("f")}"><path d="{P4}" stroke="#20245e" stroke-opacity="0.3" stroke-width="1.2"/><circle r="1.6" fill="#fff" opacity="0.85"/></g>')
D.d(f'<g id="{D.id("fh")}"><path d="{P4}" stroke="#20245e" stroke-opacity="0.3" stroke-width="1.2"/><path d="{P4}" fill="#fff" opacity="0.4"/><circle r="1.6" fill="#fff"/></g>')
D.d(f'<g id="{D.id("fd")}"><path d="{P4}" stroke="#20245e" stroke-opacity="0.3" stroke-width="1.2"/><path d="{P4}" fill="#1a1f6a" opacity="0.25"/><circle r="1.6" fill="#fff" opacity="0.6"/></g>')
HR = random.Random(5)
pts_ = []
for i in range(52):
    a = HR.uniform(0, 2 * math.pi)
    rr = 35 * math.sqrt(HR.random())
    pts_.append((math.cos(a) * rr, math.sin(a) * rr * 0.86))
pts_.sort(key=lambda p: p[1])
fl = ''
for x, y in pts_:
    e = math.hypot(x, y / 0.86) / 35
    sc_ = (1 - 0.32 * e) * HR.uniform(0.88, 1.08)
    lit = (x * 0.6 - y * 0.8) / 35
    kind = 'fh' if lit > 0.2 else ('fd' if lit < -0.3 else 'f')
    fl += f'<use href="#{D.id(kind)}" transform="translate({n(x)} {n(y)}) rotate({HR.randint(0, 89)}) scale({sc_:.2f})"/>'
D.d(f'<g id="{D.id("hy")}"><ellipse cx="0" cy="3" rx="43" ry="38"/><ellipse cx="0" cy="3" rx="43" ry="38" fill="#141a5c" opacity="0.5"/>{fl}</g>')
D.d(f'<g id="{D.id("lf")}"><path d="M0,0 C8,-11 26,-15 46,-4 C31,9 12,10 0,0Z"/>'
    f'<path d="M0,0 C8,-11 26,-15 46,-4 C30,-3 14,-1 0,0Z" fill="#fff" opacity="0.14"/>'
    f'<path d="M3,0 Q22,-4 42,-4" fill="none" stroke="#d9f7a8" stroke-width="1.5" opacity="0.55"/></g>')
HYD = ['#6f8ff6', '#7d8cf2', '#5f86f0', '#86bdfc', '#5f78e8', '#7aa6ff', '#9a8cf2']
LEAF = ['#2f8a4c', '#3a9c52', '#2a7a46', '#46ad5a']

def bush(x, y, s, rng, heads=3, w=1.0):
    out = ellipse(x, y + 10 * s, 64 * s * w, 30 * s, fill='#1f5a3a')
    for i in range(6):
        a = rng.uniform(-170, 10)
        out += (f'<use href="#{D.id("lf")}" fill="{rng.choice(LEAF)}" transform="translate({n(x + rng.uniform(-40, 40) * s * w)} {n(y + 14 * s)}) rotate({int(a)}) '
                f'scale({s * rng.uniform(0.9, 1.2):.2f})"/>')
    hs = sorted((y + rng.uniform(-18, 6) * s, x + rng.uniform(-44, 44) * s * w) for h in range(heads))
    for hy, hx in hs:
        out += f'<use href="#{D.id("hy")}" fill="{rng.choice(HYD)}" transform="translate({n(hx)} {n(hy)}) scale({s * rng.uniform(0.85, 1.1):.2f})"/>'
    return out

# glass statue prototype: a girl standing, hands out palms up (local height ~200, origin at feet)
STATUE = ('M-6,-200 C-22,-200 -28,-186 -27,-172 C-26,-160 -20,-150 -12,-147 L-13,-138 C-26,-134 -34,-126 -36,-112 '
          'L-40,-80 C-41,-74 -46,-70 -60,-66 C-66,-64 -66,-58 -60,-58 L-38,-62 C-34,-63 -32,-68 -31,-74 L-28,-92 '
          'L-26,-60 C-30,-30 -32,-10 -30,0 L-6,0 L-4,-40 L0,-40 L2,0 L28,0 C30,-10 28,-30 24,-60 L26,-92 '
          'L29,-74 C30,-68 32,-63 36,-62 L58,-58 C64,-58 64,-64 58,-66 C44,-70 39,-74 38,-80 L34,-112 '
          'C32,-126 24,-134 11,-138 L10,-147 C18,-150 24,-160 25,-172 C26,-186 20,-200 4,-200Z')
D.d(lin_grad(D.id('glass'), [(0, ('#ffffff', 0.62)), (0.5, ('#eceaff', 0.3)), (1, ('#d8f0ff', 0.42))], 0, 0, 1, 1))
HAIR = 'M-4,-206 C-26,-206 -34,-188 -32,-170 C-31,-158 -34,-150 -30,-142 C-24,-146 -20,-150 -18,-156 L18,-156 C20,-150 24,-146 30,-142 C34,-150 31,-158 32,-170 C34,-188 26,-206 4,-206Z'
D.d(f'<g id="{D.id("st")}"><path d="{HAIR}" fill="url(#{D.id("glass")})" stroke="#7f8fd6" stroke-width="2"/><path d="{STATUE}" fill="url(#{D.id("glass")})" stroke="#7f8fd6" stroke-width="2.2" stroke-linejoin="round"/>'
    f'<path d="{STATUE}" fill="none" stroke="url(#{D.id("rb")})" stroke-width="1.6" opacity="0.7" transform="translate(1.5 1)"/>'
    f'<path d="M-20,-190 C-24,-180 -24,-168 -18,-158 M-30,-118 C-32,-100 -30,-80 -28,-66 M-22,-50 C-24,-30 -24,-14 -22,-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.95"/>'
    f'<path d="M-8,-120 C4,-100 -10,-80 2,-60 C10,-46 0,-30 8,-14" stroke="#ff8fd0" stroke-width="2" fill="none" opacity="0.6"/>'
    f'<path d="M12,-110 C2,-90 18,-76 8,-56" stroke="#7fe8ff" stroke-width="1.8" fill="none" opacity="0.6"/>'
    f'<path d="M-60,-62 h18 M42,-62 h18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.9"/></g>')
# statues + hydrangeas, far to near
SR = random.Random(3)
for (X, Z, flip) in [(-1.75, 9.6, 1), (1.85, 8.8, -1), (0.15, 10.4, 1)]:
    x, y = P(X, GY, Z)
    sc = F * 1.62 / Z / 200
    G.append(bush(x - 85 * sc, y - 10 * sc, sc * 1.1, SR, heads=3, w=1.3))
    G.append(f'<use href="#{D.id("st")}" transform="translate({n(x)} {n(y)}) scale({sc * flip:.3f} {sc:.3f})"/>')
    G.append(star4(x - 30 * sc * flip, y - 150 * sc, 6, fill='#ffffff'))
    G.append(bush(x + 80 * sc, y + 6 * sc, sc * 1.2, SR, heads=3, w=1.3))
# front hydrangea row along the garden edge
for X, Z, s_ in [(-2.4, 6.6, 1.0), (-1.0, 6.4, 0.9), (1.0, 6.5, 0.9), (2.4, 6.3, 1.0), (-1.9, 5.8, 1.0), (2.0, 5.7, 1.0), (0.0, 6.0, 0.8)]:
    x, y = P(X, GY + 0.1, Z)
    G.append(bush(x, y, F / Z / 190 * s_, SR, heads=3, w=1.5))
# veranda (engawa) boards just beyond the threshold
v0, v1 = P(-3, YF, ZB), P(-3, YF, GZ0)
eng = [P(-3.2, YF, ZB), P(3.2, YF, ZB), P(3.2, YF, GZ0), P(-3.2, YF, GZ0)]
G.append(path(pp(eng), fill='#c89a6a'))
bd = ''
for i in range(1, 6):
    z = lerp(ZB, GZ0, i / 6)
    a, b = P(-3.2, YF, z), P(3.2, YF, z)
    bd += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
G.append(path(bd, stroke='#9a6a42', stroke_width='1.5', opacity='0.7'))
G.append(path(pp([P(-3.2, YF, GZ0), P(3.2, YF, GZ0), P(3.2, YF - 0.08, GZ0), P(-3.2, YF - 0.08, GZ0)]), fill='#7a5034'))
# eave overhang shadow at the top of the opening
G.append(rect(ox0 - 5, oyt - 10, ox1 - ox0 + 10, 26, fill='#3a2a34'))
G.append(rect(ox0 - 5, oyt + 16, ox1 - ox0 + 10, 4, fill='#6a4a44'))
D.d(f'<clipPath id="{D.id("open")}"><rect x="{n(ox0)}" y="{n(oyt)}" width="{n(ox1 - ox0)}" height="{n(BB - oyt + 2)}"/></clipPath>')
# daylight haze over the garden
D.d(lin_grad(D.id('ghaze'), [(0, ('#ffffff', 0.0)), (1, ('#fffbe8', 0.25))], 0, oyt, 0, BB, user=True))
G.append(rect(ox0, oyt, ox1 - ox0, BB - oyt, fill=D.url('ghaze')))

# ================================================================== room shell
# back wall
D.d(lin_grad(D.id('bwall'), [(0, '#e9cfa2'), (1, '#d8b47e')], 0, BT, 0, BB, user=True))
D.add(rect(BL, BT, BR - BL, BB - BT, fill=D.url('bwall')))
D.add(f'<g clip-path="{D.url("open")}">{"".join(G)}</g>')
# side walls
lw = [P(XL, YC, 1.0), P(XL, YC, ZB), P(XL, YF, ZB), P(XL, YF, 1.0)]
rw = [P(XR, YC, 1.0), P(XR, YC, ZB), P(XR, YF, ZB), P(XR, YF, 1.0)]
D.d(lin_grad(D.id('lw'), [(0, '#b98a5c'), (1, '#e2c08e')], -300, 0, BL, 0, user=True))
D.d(lin_grad(D.id('rw'), [(0, '#e6c898'), (1, '#c09060')], BR, 0, 2200, 0, user=True))
D.add(path(pp(lw), fill=D.url('lw')), path(pp(rw), fill=D.url('rw')))
# wooden posts (hashira) at the corners and along the walls, plus the lintel (kamoi) over the opening
WOOD, WOOD_D, WOOD_L = '#8a5434', '#5e341f', '#c88a58'
def post(X, Z, w=0.12):
    a, b = P(X - w / 2, YC, Z), P(X + w / 2, YC, Z)
    c, d = P(X + w / 2, YF, Z), P(X - w / 2, YF, Z)
    return path(pp([a, b, c, d]), fill=WOOD) + path(f'M{n(a[0]+2)},{n(a[1])}L{n(d[0]+2)},{n(d[1])}', stroke=WOOD_L, stroke_width='2', opacity='0.6')
D.add(post(XL + 0.06, ZB - 0.06), post(XR - 0.06, ZB - 0.06))
D.add(post(OX0 - 0.06, ZB), post(OX1 + 0.06, ZB))
# lintel beam across the back
a, b = P(XL, OYT + 0.12, ZB), P(XR, OYT + 0.12, ZB)
c, d = P(XR, OYT, ZB), P(XL, OYT, ZB)
D.add(path(pp([a, b, c, d]), fill=WOOD), path(f'M{n(d[0])},{n(d[1])}L{n(c[0])},{n(c[1])}', stroke=WOOD_L, stroke_width='2.5', opacity='0.7'))
# transom (ranma) above the lintel: lattice
rx0, rx1 = P(OX0, 0, ZB)[0], P(OX1, 0, ZB)[0]
ry0, ry1 = P(0, YC - 0.08, ZB)[1], P(0, OYT + 0.12, ZB)[1]
D.add(rect(rx0, ry0, rx1 - rx0, ry1 - ry0, fill='#5a3a2a', opacity='0.85'))
lat = ''
for x in range(int(rx0) + 14, int(rx1), 28):
    lat += f'M{x},{n(ry0)}V{n(ry1)}'
lat += f'M{n(rx0)},{n((ry0 + ry1) / 2)}H{n(rx1)}'
D.add(path(lat, stroke=WOOD_L, stroke_width='3', opacity='0.9'))
D.add(rect(rx0, ry0, rx1 - rx0, ry1 - ry0, fill='#ffffff', opacity='0.06'))
# sliding shoji doors stacked open at both sides of the opening
def shoji(X0, X1, Z):
    a, b = P(X0, OYT, Z), P(X1, OYT, Z)
    c, d = P(X1, YF, Z), P(X0, YF, Z)
    out = path(pp([a, b, c, d]), fill='#fbf6ea')
    gx = ''
    for i in range(1, 4):
        x = lerp(a[0], b[0], i / 4)
        gx += f'M{n(x)},{n(a[1])}V{n(d[1])}'
    for i in range(1, 7):
        y = lerp(a[1], d[1], i / 7)
        gx += f'M{n(a[0])},{n(y)}H{n(b[0])}'
    out += path(gx, stroke='#a8784e', stroke_width='2.2')
    out += path(pp([a, b, c, d]), stroke=WOOD, stroke_width='6', fill='none')
    return out
D.add(shoji(OX0 - 0.02, OX0 + 0.88, ZB - 0.02), shoji(OX1 - 0.88, OX1 + 0.02, ZB - 0.02))
# wall plaster mottling
mot = ''
for i in range(40):
    x, y = R.uniform(0, 1920), R.uniform(60, 700)
    if ox0 < x < ox1 and y > oyt:
        continue
    rx_, ry_ = R.uniform(30, 90), R.uniform(8, 24)
    mot += f'M{n(x - rx_)},{n(y)}a{n(rx_)},{n(ry_)} 0 1 0 {n(2 * rx_)},0a{n(rx_)},{n(ry_)} 0 1 0 {n(-2 * rx_)},0'
D.add(path(mot, fill='#a87c50', opacity='0.12', filter=D.blur(6)))

# ceiling: boards + battens converging to the vanishing point
ceil = [P(XL, YC, 0.5), P(XR, YC, 0.5), P(XR, YC, ZB), P(XL, YC, ZB)]
D.d(lin_grad(D.id('ceil'), [(0, '#6a4230'), (1, '#b07e58')], 0, 0, 0, BT, user=True))
D.add(path(pp(ceil), fill=D.url('ceil')))
cb = ''
for i in range(1, 22):
    X = XL + (XR - XL) * i / 22
    a, b = P(X, YC, 0.5), P(X, YC, ZB)
    cb += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
D.add(path(cb, stroke='#3a2016', stroke_width='3', opacity='0.55'))
for Z in (1.6, 2.6, 3.6):
    a, b = P(XL, YC, Z), P(XR, YC, Z)
    D.add(path(f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}', stroke=WOOD_D, stroke_width=n(F * 0.1 / Z)))
D.add(path(f'M{n(BL)},{n(BT)}L{n(BR)},{n(BT)}', stroke=WOOD_D, stroke_width='8'))

# ================================================================== tatami floor
fl_ = [P(XL, YF, 1.0), P(XR, YF, 1.0), P(XR, YF, ZB), P(XL, YF, ZB)]
D.d(lin_grad(D.id('tat'), [(0, '#e9cf86'), (0.5, '#e0bf72'), (1, '#c99e58')], 0, BB, 0, 1080, user=True))
D.add(path(pp(fl_), fill=D.url('tat')))
# weave texture: fine lines across
wv = ''
z = ZB
while z > 1.1:
    a, b = P(XL, YF, z), P(XR, YF, z)
    wv += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
    z -= 0.035 * z / 2.5
D.add(path(wv, stroke='#b8904a', stroke_width='1', opacity='0.35'))
# mats: columns 0.9 wide along Z, 1.8 long, staggered; borders (heri) along long edges
heri = ''
xs = [XL + i * 0.9 for i in range(7)]
for i, X in enumerate(xs):
    a, b = P(X, YF, 1.0), P(X, YF, ZB)
    w0 = F * 0.035 / 1.0
    heri += pp([P(X - 0.018, YF, 1.0), P(X + 0.018, YF, 1.0), P(X + 0.018, YF, ZB), P(X - 0.018, YF, ZB)])
D.add(path(heri, fill='#2d3a2a'))
D.add(path(heri, fill='#6f8a5a', opacity='0.25'))
seams = ''
for i in range(len(xs) - 1):
    off = 0.9 if i % 2 else 0.0
    z = ZB - off
    while z > 1.0:
        a, b = P(xs[i], YF, z), P(xs[i + 1], YF, z)
        seams += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
        z -= 1.8
D.add(path(seams, stroke='#8a6a34', stroke_width='2', opacity='0.6'))
# daylight from the garden pooled on the tatami
D.d(rad_grad(D.id('pool'), [(0, ('#fffbe0', 0.55)), (0.5, ('#fff4c8', 0.25)), (1, ('#fff4c8', 0))]))
pz = [P(OX0 + 0.2, YF, ZB), P(OX1 - 0.2, YF, ZB), P(OX1 + 0.6, YF, 2.6), P(OX0 - 0.6, YF, 2.6)]
D.add(path(pp(pz), fill='#fff6d0', opacity='0.32', filter=D.blur(18)))
D.add(path(pp([P(OX0, YF, ZB), P(OX1, YF, ZB), P(OX1 - 0.3, YF, 3.4), P(OX0 + 0.3, YF, 3.4)]), fill='#bfeaff', opacity='0.22', filter=D.blur(14)))
# threshold rail
a, b = P(XL, YF, ZB), P(XR, YF, ZB)
D.add(path(f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}', stroke=WOOD_D, stroke_width='7'))

# ================================================================== folding screen with white cranes (right)
panels = []
NP = 6
SZ0, SZ1, SXs = 2.0, 3.6, 1.95
sh = 1.62   # height
for i in range(NP):
    z0 = lerp(SZ0, SZ1, i / NP)
    z1 = lerp(SZ0, SZ1, (i + 1) / NP)
    x0 = SXs + (0.18 if i % 2 else 0.0)
    x1 = SXs + (0.0 if i % 2 else 0.18)
    q = [P(x0, YF + sh, z0), P(x1, YF + sh, z1), P(x1, YF + 0.03, z1), P(x0, YF + 0.03, z0)]
    panels.append((i, q))
D.d(lin_grad(D.id('scr'), [(0, '#fdfbf4'), (1, '#efe9da')], 0, 0, 0, 1))
D.d(lin_grad(D.id('scrd'), [(0, '#e6e2e0'), (1, '#d6d0c6')], 0, 0, 0, 1))
for i, q in reversed(panels):
    D.add(path(pp(q), fill=D.url('scr' if i % 2 else 'scrd')))
    D.add(path(pp(q), fill='none', stroke='#3a2a2a', stroke_width='5', stroke_linejoin='round'))
    D.add(path(f'M{n(q[3][0])},{n(q[3][1] - 10)}L{n(q[2][0])},{n(q[2][1] - 10)}', stroke='#9fb8e0', stroke_width='14', opacity='0.55'))
# painting across the screen (drawn flat then sheared to the screen's average plane): cranes, cloud bands, waves
sx0, sy0 = P(SXs, YF + sh, SZ0)
sx1, sy1 = P(SXs, YF + sh, SZ1)
_, sb0 = P(SXs, YF, SZ0)
W_ = sx0 - sx1
H_ = sb0 - sy0
skew = (sy1 - sy0) / (sx1 - sx0)          # top edge slope
paint = []
paint.append(path('M0,96 C60,80 120,104 190,90 S280,84 300,92 L300,128 C240,118 170,138 110,126 S30,134 0,138Z', fill='#f0cf7a', opacity='0.55'))
paint.append(path('M0,340 C50,326 110,348 170,334 S260,330 300,338 L300,360 C240,352 170,366 110,356 S40,364 0,362Z', fill='#f0cf7a', opacity='0.45'))
paint.append(path('M0,500 C30,486 60,486 84,500 C108,486 138,486 162,500 C186,486 216,486 240,500 C262,488 284,488 300,496 L300,560 L0,560Z', fill='#7fa6e8', opacity='0.5'))
paint.append(path('M10,506 C30,494 56,494 76,506 M92,506 C112,494 138,494 158,506 M174,506 C194,494 220,494 240,506', stroke='#ffffff', stroke_width='3', fill='none', opacity='0.8'))
# pine branch reaching in from the far edge
paint.append(path('M300,34 C260,44 230,58 196,56 C176,55 160,62 150,70', stroke='#5a3a2a', stroke_width='7', fill='none', stroke_linecap='round'))
for x_, y_, w_ in [(160, 62, 30), (205, 48, 36), (258, 38, 34)]:
    paint.append(ellipse(x_, y_ - 6, w_, 11, fill='#2f7a50'))
    paint.append(ellipse(x_, y_ - 9, w_ * 0.8, 6, fill='#4fa86a'))
    paint.append(path(''.join(f'M{n(x_ + dx)},{n(y_ - 2)}l{n(dx * 0.15)},-14' for dx in range(-int(w_) + 6, int(w_) - 4, 7)), stroke='#1f5a3a', stroke_width='1.4', opacity='0.7'))
def crane(x, y, s, flip=1, up=True):
    """Red-crowned crane in flight, facing right; wings raised (up) or swept down."""
    sy = 1 if up else -1
    def w(d):   # mirror wing shapes vertically for the down-stroke
        if up:
            return d
        import re as _re
        return _re.sub(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', lambda m: f'{m.group(1)},{-float(m.group(2)) * 0.8:g}', d)
    far = w('M-14,-6 C-24,-36 -44,-66 -72,-88 L-78,-76 Q-80,-64 -86,-60 Q-82,-48 -88,-40 Q-74,-26 -58,-8Z')
    fart = w('M-72,-88 L-78,-76 Q-80,-64 -86,-60 L-74,-62 Q-72,-74 -72,-88Z')
    near = w('M0,-8 C8,-44 -2,-84 -22,-116 L-34,-104 Q-38,-90 -48,-86 Q-50,-72 -58,-66 Q-56,-50 -62,-42 Q-50,-26 -40,-8Z')
    neart = w('M-22,-116 L-34,-104 Q-38,-90 -48,-86 L-36,-84 Q-28,-98 -22,-116Z')
    out = f'<g transform="translate({x} {y}) scale({s * flip} {s})" stroke-linejoin="round">'
    out += f'<path d="{far}" fill="#e6e4f2" stroke="#6d6a9e" stroke-width="2"/><path d="{fart}" fill="#2a2a3a"/>'
    out += '<path d="M-44,2 C-62,6 -92,10 -118,12 M-44,4 C-62,10 -90,16 -114,20" stroke="#2a2a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    out += '<path d="M-52,2 C-40,-12 6,-14 30,-6 C18,6 -14,10 -52,4Z" fill="#ffffff" stroke="#6d6a9e" stroke-width="2"/>'
    out += '<path d="M-52,2 L-64,-2 L-62,8 Z" fill="#2a2a3a"/>'
    out += '<path d="M28,-6 C40,-10 54,-14 66,-18" stroke="#2a2a3a" stroke-width="5" fill="none" stroke-linecap="round"/>'
    out += '<circle cx="68" cy="-19" r="5" fill="#2a2a3a"/><circle cx="68" cy="-22.5" r="3" fill="#e8403a"/><path d="M72,-18 L90,-15" stroke="#d8b060" stroke-width="2.4" stroke-linecap="round"/>'
    out += f'<path d="{near}" fill="#ffffff" stroke="#6d6a9e" stroke-width="2"/><path d="{neart}" fill="#2a2a3a"/>'
    out += '<path d="M-8,-30 C-14,-50 -18,-70 -22,-88" stroke="#d8d6ec" stroke-width="2" fill="none"/>'
    out += '</g>'
    return out
from crane2 import crane   # QA pass: redrawn red-crowned cranes (the old wings read as sails)
paint.append(crane(120, 280, 0.9, 1, True))
paint.append(crane(215, 432, 0.62, 1, False))
paint.append(crane(232, 196, 0.42, 1, True))
# pine branch
paint.append(path('M460,40 C400,60 360,70 300,64', stroke='#5a3a2a', stroke_width='8', fill='none'))
for x_, y_ in [(300, 60), (350, 52), (410, 48)]:
    paint.append(ellipse(x_, y_ - 10, 34, 14, fill='#3f8a5a'))
D.d(f'<clipPath id="{D.id("scrc")}">' + ''.join(f'<path d="{pp(q)}"/>' for i, q in panels) + '</clipPath>')
k_ = H_ / 560
mat = f'matrix({-k_:.4f} {skew * (-k_):.4f} 0 {k_:.4f} {n(sx0)} {n(sy0)})'
D.add(f'<g clip-path="{D.url("scrc")}"><g transform="{mat}">{"".join(paint)}</g></g>')
# re-darken the receding panels so the zigzag still reads
for i, q in panels:
    if i % 2 == 0:
        D.add(path(pp(q), fill='#6a5a8a', opacity='0.12'))
for i, q in panels:
    D.add(path(pp(q), fill='none', stroke='#3a2a2a', stroke_width='4', stroke_linejoin='round'))
    D.add(path(f'M{n(q[0][0])},{n(q[0][1])}L{n(q[1][0])},{n(q[1][1])}', stroke='#c8a060', stroke_width='3'))

# ================================================================== the kiln (centre-left)
KX, KZ, KR, KH = -1.25, 3.05, 0.62, 1.38
kx, ky = P(KX, YF, KZ)
kr = F * KR / KZ
kh = F * KH / KZ
ktop = ky - kh
# chimney pipe up through the ceiling
cx0, cx1 = kx - kr * 0.16, kx + kr * 0.16
D.add(rect(cx0, 0, cx1 - cx0, ktop + 20, fill='#4a3a3a'), rect(cx0, 0, (cx1 - cx0) * 0.35, ktop + 20, fill='#7a6a6a', opacity='0.6'))
D.add(rect(cx0 - 6, ktop - 40, cx1 - cx0 + 12, 14, fill='#3a2a2a'))
# dome silhouette
dome = (f'M{n(kx - kr)},{n(ky)} C{n(kx - kr)},{n(ky - kh * 0.6)} {n(kx - kr * 0.62)},{n(ktop)} {n(kx)},{n(ktop)} '
        f'C{n(kx + kr * 0.62)},{n(ktop)} {n(kx + kr)},{n(ky - kh * 0.6)} {n(kx + kr)},{n(ky)}Z')
D.d(lin_grad(D.id('brick'), [(0, '#e0784a'), (0.55, '#c85a34'), (1, '#9a3e26')], 0, ktop, 0, ky, user=True))
D.add(path(dome, fill=D.url('brick')))
D.d(f'<clipPath id="{D.id("domec")}"><path d="{dome}"/></clipPath>')
# mortar base, then individual bricks in curved courses
D.add(path(dome, fill='#e8b090'))
BRK = ['#e07a4a', '#d86e40', '#e88a58', '#cf6438', '#e47f4c']
bricks = {c: '' for c in BRK}
rows = 12
BR_ = random.Random(9)
for r_ in range(rows):
    t0, t1 = r_ / rows, (r_ + 1) / rows
    y0, y1 = ky - kh * t0, ky - kh * t1
    half0 = kr * math.sqrt(max(0.0, 1 - (t0 * 0.985) ** 2.3))
    half1 = kr * math.sqrt(max(0.0, 1 - (t1 * 0.985) ** 2.3))
    half = max(half0, 1)
    nb = max(2, int(half / 21))
    for j in range(-nb - 1, nb + 1):
        u0 = (j + (0.5 if r_ % 2 else 0)) / nb
        u1 = (j + 1 + (0.5 if r_ % 2 else 0)) / nb
        if u1 < -1.05 or u0 > 1.05:
            continue
        sag = lambda u, h: kh * 0.035 * (1 - min(1, u * u))
        g = 2.0
        xa0, xa1 = kx + u0 * half0 + g, kx + u1 * half0 - g
        xb0, xb1 = kx + u0 * half1 + g, kx + u1 * half1 - g
        ya0, ya1 = y0 + sag(u0, 0) - 2, y0 + sag(u1, 0) - 2
        yb0, yb1 = y1 + sag(u0, 0) + 2, y1 + sag(u1, 0) + 2
        c = BR_.choice(BRK)
        bricks[c] += f'M{n(xa0)},{n(ya0)}L{n(xa1)},{n(ya1)}L{n(xb1)},{n(yb1)}L{n(xb0)},{n(yb0)}Z'
D.add(f'<g clip-path="{D.url("domec")}">' + ''.join(path(d_, fill=c) for c, d_ in bricks.items() if d_) +
      # hard cel shadow on the left, cool rim on the right (garden light behind), soft top sheen
      path(f'M{n(kx - kr - 10)},{n(ky + 10)} L{n(kx - kr - 10)},{n(ktop - 10)} L{n(kx - kr * 0.2)},{n(ktop - 10)} C{n(kx - kr * 0.5)},{n(ktop + kh * 0.3)} {n(kx - kr * 0.56)},{n(ky - kh * 0.3)} {n(kx - kr * 0.42)},{n(ky + 10)}Z', fill='#6a1a3a', opacity='0.38') +
      path(f'M{n(kx + kr * 0.45)},{n(ktop + kh * 0.04)} C{n(kx + kr * 0.92)},{n(ktop + kh * 0.28)} {n(kx + kr * 1.02)},{n(ky - kh * 0.4)} {n(kx + kr * 0.99)},{n(ky)} L{n(kx + kr * 1.1)},{n(ky)} L{n(kx + kr * 1.1)},{n(ktop)}Z', fill='#c8f0ff', opacity='0.45') +
      ellipse(kx - kr * 0.1, ktop + kh * 0.2, kr * 0.38, kh * 0.09, fill='#ffd0a8', opacity='0.45', filter=D.blur(6)) + '</g>')
D.d(lin_grad(D.id('kbot'), [(0, ('#3a1020', 0)), (0.7, ('#3a1020', 0)), (1, ('#3a1020', 0.3))], 0, ktop, 0, ky, user=True))
D.add(path(dome, fill=D.url('kbot')))
D.add(path(dome, fill='none', stroke='#6e2618', stroke_width='3'))
# base plinth
D.add(path(f'M{n(kx - kr - 14)},{n(ky)} h{n(2 * kr + 28)} v-14 h{n(-2 * kr - 28)}Z', fill='#8a8296'), path(f'M{n(kx - kr - 14)},{n(ky - 14)} h{n(2 * kr + 28)}', stroke='#c8c0d8', stroke_width='3'))
# the little iron door, glowing
dw, dh = kr * 0.62, kh * 0.36
dx0, dy1 = kx - dw / 2, ky - kh * 0.1
D.d(rad_grad(D.id('fire'), [(0, '#fff7c0'), (0.35, '#ffcf4a'), (0.7, '#ff8a2a'), (1, '#e0502a')], cx=0.5, cy=0.7, r=0.7))
D.d(rad_grad(D.id('fglow'), [(0, ('#ffb050', 0.75)), (0.4, ('#ff8a3a', 0.3)), (1, ('#ff7a30', 0))]))
D.add(circle(kx, dy1 - dh * 0.4, kr * 1.9, fill=D.url('fglow')))
D.add(path(f'M{n(dx0 - 10)},{n(dy1 + 6)} V{n(dy1 - dh * 0.62)} A{n(dw / 2 + 10)},{n(dw / 2 + 10)} 0 0 1 {n(dx0 + dw + 10)},{n(dy1 - dh * 0.62)} V{n(dy1 + 6)}Z', fill='#3a2a2e'))
D.add(path(f'M{n(dx0)},{n(dy1)} V{n(dy1 - dh * 0.62)} A{n(dw / 2)},{n(dw / 2)} 0 0 1 {n(dx0 + dw)},{n(dy1 - dh * 0.62)} V{n(dy1)}Z', fill=D.url('fire')))
# the door itself swung half open (iron, rim-lit orange)
D.add(path(f'M{n(dx0 + dw)},{n(dy1)} L{n(dx0 + dw + dw * 0.55)},{n(dy1 + 8)} L{n(dx0 + dw + dw * 0.55)},{n(dy1 - dh * 0.75)} C{n(dx0 + dw + dw * 0.4)},{n(dy1 - dh * 1.05)} {n(dx0 + dw + dw * 0.1)},{n(dy1 - dh * 1.05)} {n(dx0 + dw)},{n(dy1 - dh * 0.95)}Z', fill='#3e3440'))
D.add(path(f'M{n(dx0 + dw)},{n(dy1 - dh * 0.95)} L{n(dx0 + dw)},{n(dy1)}', stroke='#ffb050', stroke_width='3'))
D.add(circle(dx0 + dw + dw * 0.4, dy1 - dh * 0.4, 4, fill='#ffb050'))
# glow spill on the tatami in front of the kiln
D.add(ellipse(kx, ky + 40, kr * 2.2, 70, fill='#ff9a40', opacity='0.34', filter=D.blur(20)))
D.add(ellipse(kx - kr * 1.2, ky - kh * 0.4, kr * 1.4, kh * 0.6, fill='#ff9a50', opacity='0.16', filter=D.blur(30)))
# sparks
for i in range(9):
    sx_ = kx + R.uniform(-dw * 0.4, dw * 0.9)
    sy_ = dy1 - dh * R.uniform(0.9, 2.4)
    D.add(circle(sx_, sy_, R.uniform(1.4, 2.8), fill='#ffd36e', opacity=n(R.uniform(0.5, 0.9))))

# wall shelves of finished glass on the left wall, catching the garden light
GLC = ['#ff4d6d', '#3f6dff', '#2fc59a', '#ffc23e', '#a66bff', '#ff7fc4', '#46d9ff']
for Ysh in (0.42, 0.82):
    a_, b_ = P(XL, Ysh, 2.62), P(XL, Ysh, 3.75)
    c_, d_ = P(XL + 0.22, Ysh, 3.75), P(XL + 0.22, Ysh, 2.62)
    D.add(path(pp([a_, b_, c_, d_]), fill=WOOD_L), path(pp([d_, c_, P(XL + 0.22, Ysh - 0.04, 3.75), P(XL + 0.22, Ysh - 0.04, 2.62)]), fill=WOOD))
    k = 0
    z = 2.72
    while z < 3.68:
        X = XL + 0.11
        bxx, byy = P(X, Ysh, z)
        hgt = F * R.uniform(0.12, 0.22) / z
        wid = F * R.uniform(0.05, 0.08) / z
        col = GLC[k % len(GLC)]
        shape = R.choice(['vase', 'bottle', 'bowl'])
        if shape == 'bottle':
            d_path = f'M{n(bxx - wid)},{n(byy)} C{n(bxx - wid * 1.1)},{n(byy - hgt * 0.6)} {n(bxx - wid * 0.3)},{n(byy - hgt * 0.6)} {n(bxx - wid * 0.25)},{n(byy - hgt)} H{n(bxx + wid * 0.25)} C{n(bxx + wid * 0.3)},{n(byy - hgt * 0.6)} {n(bxx + wid * 1.1)},{n(byy - hgt * 0.6)} {n(bxx + wid)},{n(byy)}Z'
        elif shape == 'vase':
            d_path = f'M{n(bxx - wid * 0.7)},{n(byy)} C{n(bxx - wid * 1.3)},{n(byy - hgt * 0.5)} {n(bxx - wid * 0.4)},{n(byy - hgt * 0.8)} {n(bxx - wid * 0.6)},{n(byy - hgt)} H{n(bxx + wid * 0.6)} C{n(bxx + wid * 0.4)},{n(byy - hgt * 0.8)} {n(bxx + wid * 1.3)},{n(byy - hgt * 0.5)} {n(bxx + wid * 0.7)},{n(byy)}Z'
        else:
            hgt *= 0.45
            d_path = f'M{n(bxx - wid * 1.2)},{n(byy - hgt)} C{n(bxx - wid * 1.1)},{n(byy)} {n(bxx + wid * 1.1)},{n(byy)} {n(bxx + wid * 1.2)},{n(byy - hgt)}Z'
        D.add(path(d_path, fill=col, opacity='0.55', stroke=col, stroke_width='1.5'))
        D.add(path(f'M{n(bxx - wid * 0.45)},{n(byy - hgt * 0.15)} V{n(byy - hgt * 0.7)}', stroke='#ffffff', stroke_width='2.2', stroke_linecap='round', opacity='0.9'))
        D.add(circle(bxx, byy - hgt * 0.5, wid * 1.8, fill=D.url('glw'), opacity='0.45'))   # QA: less haze
        z += R.uniform(0.13, 0.2)
        k += 1
    # coloured light the glass throws on the wall below the shelf
    D.add(path(pp([P(XL, Ysh - 0.05, 2.7), P(XL, Ysh - 0.05, 3.6), P(XL, Ysh - 0.3, 3.6), P(XL, Ysh - 0.3, 2.7)]), fill='url(#' + D.id('rb') + ')', opacity='0.11', filter=D.blur(6)))   # QA: softer wall rainbow

# rack of glass pipes and tongs (left of the kiln)
rx_, rz_ = -2.35, 3.0
ra, rb = P(rx_, YF, rz_), P(rx_ + 0.42, YF, rz_)
rtop = P(rx_, YF + 1.7, rz_)[1]
D.add(rect(ra[0], rtop, 12, ra[1] - rtop, fill=WOOD), rect(rb[0] - 12, rtop, 12, rb[1] - rtop, fill=WOOD))
for yy in (rtop + 30, rtop + (ra[1] - rtop) * 0.55):
    D.add(rect(ra[0], yy, rb[0] - ra[0], 10, fill=WOOD_D), rect(ra[0], yy, rb[0] - ra[0], 3, fill=WOOD_L, opacity='0.7'))
pipes = ''
pipes_hi = ''
for i, (x_, lean) in enumerate([(0.12, -0.05), (0.2, 0.02), (0.28, -0.02), (0.36, 0.05), (0.44, 0.0)]):
    x0 = lerp(ra[0], rb[0], x_)
    yb = ra[1] - 4
    yt = rtop - 30 - i * 6
    pipes += f'M{n(x0)},{n(yb)} L{n(x0 + lean * 300)},{n(yt)}'
    pipes_hi += f'M{n(x0 - 1.5)},{n(yb - 20)} L{n(x0 + lean * 300 - 1.5)},{n(yt + 30)}'
D.add(path(pipes, stroke='#cfeeff', stroke_width='7', stroke_linecap='round', opacity='0.55'))
D.add(path(pipes, stroke='#7f8fd6', stroke_width='1.5', fill='none', opacity='0.8', transform='translate(3 0)'))
D.add(path(pipes_hi, stroke='#ffffff', stroke_width='2', stroke_linecap='round', opacity='0.95'))
for i in range(5):
    x0 = lerp(ra[0], rb[0], [0.12, 0.2, 0.28, 0.36, 0.44][i])
    D.add(ellipse(x0 + [-0.05, 0.02, -0.02, 0.05, 0][i] * 300, rtop - 30 - i * 6, 5, 3, fill='#ffffff', opacity='0.8'))
# tongs hanging on the rack
for j, x_ in enumerate((0.62, 0.8)):
    x0 = lerp(ra[0], rb[0], x_)
    y0 = rtop + 40
    D.add(path(f'M{n(x0)},{n(y0)} L{n(x0 - 10)},{n(y0 + 150)} M{n(x0)},{n(y0)} L{n(x0 + 10)},{n(y0 + 150)}', stroke='#3a3440', stroke_width='4', stroke_linecap='round'))
    D.add(circle(x0, y0, 5, fill='none', stroke='#3a3440', stroke_width='3'))
# bowl of water with coloured beads, on a low stand beside the kiln
bx, by = P(-0.35, YF + 0.32, 2.85)
D.add(path(f'M{n(bx - 60)},{n(by + 70)} h120 l-10,-70 h-100z', fill=WOOD_D))
D.add(ellipse(bx, by, 68, 18, fill='#2a4a7a'))
D.add(path(f'M{n(bx - 68)},{n(by)} C{n(bx - 60)},{n(by + 40)} {n(bx + 60)},{n(by + 40)} {n(bx + 68)},{n(by)}Z', fill='#e8ecf6'))
D.add(path(f'M{n(bx - 68)},{n(by)} C{n(bx - 60)},{n(by + 40)} {n(bx + 60)},{n(by + 40)} {n(bx + 68)},{n(by)}', stroke='#5a6aa8', stroke_width='2', fill='none'))
D.add(path(f'M{n(bx - 40)},{n(by + 18)} C{n(bx - 20)},{n(by + 24)} {n(bx + 20)},{n(by + 24)} {n(bx + 40)},{n(by + 18)}', stroke='#3f6dff', stroke_width='4', fill='none', opacity='0.8'))
D.add(ellipse(bx, by, 60, 14, fill='#7fd0ff', opacity='0.75'))
for cx_, cy_, col in [(-28, 2, '#ff4d6d'), (-6, -4, '#ffc23e'), (16, 3, '#2fc59a'), (34, -2, '#a66bff'), (2, 6, '#46d9ff'), (-44, -2, '#7d6a4a')]:
    D.add(circle(bx + cx_, by + cy_, 6.5, fill=col), circle(bx + cx_ - 2, by + cy_ - 2, 2, fill='#fff'))
D.add(ellipse(bx - 20, by - 6, 22, 3, fill='#ffffff', opacity='0.7'))
D.add(circle(bx + 16, by + 3, 14, fill=D.url('glw')))

# ================================================================== low table, cushions (centre-right)
TX0, TX1, TZ0, TZ1, TY = 0.5, 1.6, 3.2, 3.8, YF + 0.36
ttop = [P(TX0, TY, TZ1), P(TX1, TY, TZ1), P(TX1, TY, TZ0), P(TX0, TY, TZ0)]
D.add(ellipse((ttop[2][0] + ttop[3][0]) / 2, P(0, YF, TZ0)[1] + 4, 240, 26, fill='#5a3a2a', opacity='0.25', filter=D.blur(8)))
for X, Z in [(TX0 + 0.06, TZ0 + 0.06), (TX1 - 0.06, TZ0 + 0.06)]:
    a, b = P(X - 0.04, TY, Z), P(X + 0.04, YF, Z)
    D.add(rect(a[0], a[1], b[0] - a[0], b[1] - a[1], fill='#3a2018'))
D.add(path(pp(ttop), fill='#6a3a26'))
D.add(path(pp([ttop[3], ttop[2], P(TX1, TY - 0.05, TZ0), P(TX0, TY - 0.05, TZ0)]), fill='#4a2618'))
D.add(path(pp(ttop), fill='#ffffff', opacity='0.08'))
D.add(path(f'M{n(ttop[3][0])},{n(ttop[3][1])}L{n(ttop[2][0])},{n(ttop[2][1])}', stroke='#c88a58', stroke_width='2.5'))
# teapot + cups + basket of melon bread on the table
tx, ty = P(0.8, TY, 3.5)
D.add(f'<g transform="translate({n(tx)} {n(ty)})"><ellipse cx="0" cy="0" rx="30" ry="8" fill="#000" opacity="0.15"/>'
      f'<path d="M-26,-4 C-30,-30 30,-30 26,-4Z" fill="#f4f6ff"/><path d="M-26,-4 C-30,-30 30,-30 26,-4Z" fill="none" stroke="#6d6a9e" stroke-width="2"/>'
      f'<path d="M-14,-14 c4,-4 8,0 4,4 M2,-18 c4,-4 8,0 4,4" stroke="#5b7cf0" stroke-width="2.5" fill="none"/>'
      f'<path d="M26,-14 C38,-18 40,-28 44,-30" stroke="#f4f6ff" stroke-width="6" fill="none" stroke-linecap="round"/>'
      f'<path d="M-14,-26 C-12,-40 12,-40 14,-26" fill="none" stroke="#8a5a3a" stroke-width="4"/><circle cx="0" cy="-27" r="4" fill="#5b7cf0"/>'
      f'<path d="M-18,-12 C-18,-20 -12,-24 -6,-25" stroke="#fff" stroke-width="3" fill="none"/></g>')
for cxo in (60, 100):
    cx2, cy2 = P(0.8 + cxo / 300, TY, 3.4)
    D.add(f'<g transform="translate({n(cx2)} {n(cy2)})"><path d="M-12,-2 L-10,-18 H10 L12,-2Z" fill="#f4f6ff" stroke="#6d6a9e" stroke-width="1.5"/>'
          f'<ellipse cx="0" cy="-18" rx="10" ry="3" fill="#9ccf6a"/><path d="M-10,-10 h20" stroke="#5b7cf0" stroke-width="2"/></g>')
bx2, by2 = P(1.32, TY, 3.6)
D.add(f'<g transform="translate({n(bx2)} {n(by2)})"><path d="M-44,0 L-50,-30 H50 L44,0Z" fill="#c8894a"/>'
      f'<path d="M-48,-20 H48 M-46,-10 H46" stroke="#8a5428" stroke-width="2"/>'
      f'<ellipse cx="-20" cy="-32" rx="22" ry="12" fill="#f4cc6e" stroke="#a86a22" stroke-width="1.5"/><ellipse cx="14" cy="-34" rx="22" ry="12" fill="#f6d27a" stroke="#a86a22" stroke-width="1.5"/>'
      f'<path d="M-34,-36 l20,10 M-28,-42 l20,10 M0,-40 l20,10 M6,-44 l20,10" stroke="#c88a3a" stroke-width="1.5"/>'
      f'<path d="M-50,-30 C-40,-60 40,-60 50,-30" fill="none" stroke="#a86a3a" stroke-width="4"/></g>')
# ================================================================== glass wind chime hanging in the eaves (top of the opening)
chx, chy = P(-1.05, OYT, ZB)
chx -= 10
D.add(f'<g transform="translate({n(chx)} {n(chy)}) scale(1.45)"><path d="M0,0 V24" stroke="#5a3a40" stroke-width="1.6"/>'
      f'<path d="M-15,46 C-15,20 15,20 15,46Z" fill="#eafcff" opacity="0.55"/>'
      f'<path d="M-15,46 C-15,20 15,20 15,46" fill="none" stroke="url(#{D.id("rb")})" stroke-width="2.2"/>'
      f'<path d="M-9,40 C-9,31 -5,26 1,25" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'
      f'<path d="M-15,46 H15" stroke="#9ad8ff" stroke-width="1.4"/>'
      f'<path d="M0,42 V64" stroke="#5a3a40" stroke-width="1.2"/><path d="M-6,64 h12 v34 h-12z" fill="#a9bcff"/><path d="M-6,64 h12 v5 h-12z" fill="#fff" opacity="0.5"/>'
      f'<circle cx="4" cy="30" r="20" fill="url(#{D.id("glw")})"/></g>')

# little rainbows thrown onto the tatami by the glass
for (X, Z, w) in [(-1.9, 2.4, 0.5), (-1.55, 2.2, 0.35), (-2.2, 2.9, 0.4)]:
    a_, b_ = P(X, YF, Z), P(X + w, YF, Z - 0.12)
    D.add(path(f'M{n(a_[0])},{n(a_[1])} L{n(b_[0])},{n(b_[1])}', stroke=D.url('rb'), stroke_width='9', stroke_linecap='round', opacity='0.45', filter=D.blur(2)))

# ================================================================== light: daylight shafts from the garden, warm/cool grade
D.d(lin_grad(D.id('day'), [(0, ('#fffef0', 0.5)), (1, ('#fffef0', 0))], 0, oyt, 0, 1080, user=True))
shafts = [poly([(ox0 + 40, oyt + 20), (ox0 + 200, oyt + 20), (ox0 + 60, 1080), (ox0 - 260, 1080)]),
          poly([(ox1 - 260, oyt + 20), (ox1 - 120, oyt + 20), (ox1 + 120, 1080), (ox1 - 200, 1080)])]
D.add(f'<g fill="{D.url("day")}" filter="{D.blur(20)}" opacity="0.55">{"".join(shafts)}</g>')
D.add(rect(ox0, oyt + 6, ox1 - ox0, BB - oyt - 6, fill='none', stroke='#f4fbff', stroke_width='26', opacity='0.4', filter=D.blur(14)))
motes = ''
for i in range(50):
    x, y = R.uniform(ox0 - 150, ox1 + 100), R.uniform(oyt + 30, 900)
    r = R.uniform(1, 2.6)
    motes += f'M{n(x - r)},{n(y)}a{n(r)},{n(r)} 0 1 0 {n(2 * r)},0a{n(r)},{n(r)} 0 1 0 {n(-2 * r)},0'
D.add(path(motes, fill='#ffffff', opacity='0.6'))
D.d(rad_grad(D.id('vig'), [(0, ('#000', 0)), (0.62, ('#2a1420', 0)), (1, ('#2a1420', 0.4))], cx=960, cy=470, r=1150, user=True))
D.add(rect(0, 0, 1920, 1080, fill=D.url('vig')))

D.write(OUT)
