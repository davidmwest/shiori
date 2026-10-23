#!/usr/bin/env python3
"""bg/bakery.svg - the Asahi bakery at 5 a.m., seen from the customer side of the counter."""
import sys, os, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from bglib import *
from outpath import out_path

OUT = out_path('bg/bakery.svg', __doc__)
D = Doc('bk')
R = random.Random(5)
VX, VY, F = 900, 470, 1000.0


def P(X, Y, Z):
    return (VX + F * X / Z, VY - F * Y / Z)


def pp(pts):
    return 'M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in pts) + 'Z'


ZB = 3.67                    # back wall depth
XL, XR = -2.2, 2.42          # side walls
YF, YC = -1.55, 1.32         # floor, ceiling (eye at 0)
BL, BR = P(XL, 0, ZB)[0], P(XR, 0, ZB)[0]
BT, BB = P(0, YC, ZB)[1], P(0, YF, ZB)[1]

# ------------------------------------------------------------------ palette
WALL_T, WALL_B = '#fbe6b4', '#f3cf8c'
WOOD, WOOD_D, WOOD_L, WOOD_DD = '#b8703e', '#8c4a28', '#e09a5c', '#5e2f1c'
CRUST, CRUST_D, CRUST_L, CRUMB = '#cf7d3a', '#9b4f22', '#f4b469', '#f8e0b0'

# ------------------------------------------------------------------ back wall
D.d(lin_grad(D.id('wall'), [(0, WALL_T), (0.55, '#f8dca0'), (1, WALL_B)], 0, BT, 0, BB, user=True))
D.add(rect(0, 0, 1920, 1080, fill=D.url('wall')))
# plaster mottling
mot = ''
for i in range(70):
    x, y = R.uniform(0, 1920), R.uniform(80, 760)
    rx, ry = R.uniform(30, 110), R.uniform(10, 30)
    mot += f'M{n(x - rx)},{n(y)}a{n(rx)},{n(ry)} 0 1 0 {n(2 * rx)},0a{n(rx)},{n(ry)} 0 1 0 {n(-2 * rx)},0'
D.add(path(mot, fill='#e9b874', opacity='0.16', filter=D.blur(6)))

# ------------------------------------------------------------------ side walls
lw = [P(XL, YC, 0.9), P(XL, YC, ZB), P(XL, YF, ZB), P(XL, YF, 0.9)]
rw = [P(XR, YC, 0.9), P(XR, YC, ZB), P(XR, YF, ZB), P(XR, YF, 0.9)]
D.d(lin_grad(D.id('lw'), [(0, '#e8b878'), (1, '#f6d496')], -400, 0, BL, 0, user=True))
D.d(lin_grad(D.id('rw'), [(0, '#f9dda4'), (1, '#efc07c')], BR, 0, 1920, 0, user=True))
D.add(path(pp(lw), fill=D.url('lw')), path(pp(rw), fill=D.url('rw')))
# corner shading
D.add(path(f'M{n(BL)},{n(BT)} L{n(BL)},{n(BB)}', stroke='#c88a50', stroke_width='3', opacity='0.5'))
D.add(path(f'M{n(BR)},{n(BT)} L{n(BR)},{n(BB)}', stroke='#c88a50', stroke_width='3', opacity='0.5'))

# ------------------------------------------------------------------ ceiling + beams
ceil = [P(XL, YC, 0.6), P(XR, YC, 0.6), P(XR, YC, ZB), P(XL, YC, ZB)]
D.d(lin_grad(D.id('ceil'), [(0, '#5a3222'), (1, '#8a5534')], 0, 0, 0, BT, user=True))
D.add(path(pp(ceil), fill=D.url('ceil')))
# ceiling boards
cb = ''
for i in range(1, 16):
    X = XL + (XR - XL) * i / 16
    a, b = P(X, YC, 0.6), P(X, YC, ZB)
    cb += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
D.add(path(cb, stroke='#3e2016', stroke_width='2', opacity='0.45'))
# cross beams (running left-right)
for Z, th in [(1.2, 0.16), (2.2, 0.16), (ZB - 0.02, 0.18)]:
    a, b = P(XL, YC, Z), P(XR, YC, Z)
    c, d = P(XR, YC - th, Z), P(XL, YC - th, Z)
    D.add(path(pp([a, b, c, d]), fill=WOOD_D))
    D.add(path(f'M{n(d[0])},{n(d[1])}L{n(c[0])},{n(c[1])}', stroke=WOOD_L, stroke_width='3', opacity='0.55'))
    # underside
    e, f = P(XR, YC - th, Z + 0.15), P(XL, YC - th, Z + 0.15)
    D.add(path(pp([d, c, e, f]), fill=WOOD_DD))

# ------------------------------------------------------------------ window on the right wall (dawn)
def rwp(z, y):
    return P(XR, y, z)
wz0, wz1, wy0, wy1 = 2.62, 3.45, -0.42, 1.08
win = [rwp(wz0, wy1), rwp(wz1, wy1), rwp(wz1, wy0), rwp(wz0, wy0)]
D.d(lin_grad(D.id('dawn'), [(0, '#7d8fe0'), (0.25, '#c9a3e6'), (0.5, '#ffaecb'), (0.75, '#ffc9a0'), (1, '#ffe2a6')], 0, win[1][1], 0, win[3][1], user=True))
D.add(path(pp(win), fill=D.url('dawn')))
D.d(f'<clipPath id="{D.id("winc")}"><path d="{pp(win)}"/></clipPath>')
wv = []
WX0, WX1 = win[3][0], win[1][0]
WY0, WY1 = min(win[0][1], win[1][1]), max(win[2][1], win[3][1])
D.d(rad_grad(D.id('wsun'), [(0, ('#fffbe8', 1)), (0.15, ('#ffeab0', 0.95)), (0.5, ('#ffc890', 0.45)), (1, ('#ffb890', 0))], cx=1690, cy=470, r=260, user=True))
wv.append(rect(WX0 - 10, WY0, WX1 - WX0 + 20, WY1 - WY0, fill=D.url('wsun')))
CR_ = random.Random(8)
for cx, cy, w in [(1740, 170, 80), (1650, 240, 54), (1800, 300, 46), (1655, 118, 40)]:
    puffs = sorted([(cx + CR_.uniform(-0.55, 0.55) * w, cy + CR_.uniform(-0.28, 0.02) * w, w * CR_.uniform(0.3, 0.44)) for _ in range(7)], key=lambda p: -p[2])
    wv.append(f'<g fill="#c99ad8">' + ''.join(circle(x, y, r) for x, y, r in puffs) + f'<rect x="{n(cx - w * 0.85)}" y="{n(cy - w * 0.12)}" width="{n(1.7 * w)}" height="{n(w * 0.2)}" rx="{n(w * 0.1)}"/></g>')
    wv.append(f'<g fill="#ffc6c0">' + ''.join(circle(x + r * 0.05, y + r * 0.22, r * 0.78) for x, y, r in puffs) + '</g>')
    wv.append(f'<rect x="{n(cx - w * 0.8)}" y="{n(cy + w * 0.0)}" width="{n(1.6 * w)}" height="{n(w * 0.07)}" rx="{n(w * 0.035)}" fill="#ffe6a8"/>')
# Glass Hill far away, the Glasshouse catching the first light on its summit
wv.append(path('M1590,520 C1640,500 1700,420 1760,400 C1800,388 1830,420 1860,450 L1860,640 L1590,640Z', fill='#c79bd0', opacity='0.8'))
wv.append(path('M1748,398 h30 l-4,-7 h-22z', fill='#fff6fb'))
wv.append(circle(1763, 395, 16, fill=D.url('glow')))
# rooftops across the street
wv.append(path('M1585,560 L1650,520 L1715,560 L1715,640 L1585,640Z M1705,548 L1790,505 L1870,548 L1870,640 L1705,640Z', fill='#8a6aa8'))
wv.append(path('M1585,560 L1650,520 L1715,560 M1705,548 L1790,505 L1870,548', stroke='#ffd0a8', stroke_width='4', fill='none'))
wv.append(path('M1600,575 h100 M1720,565 h140', stroke='#6a4e8a', stroke_width='3'))
wv.append(star4(1655, 572, 6, fill='#ffffff'))
D.add(f'<g clip-path="{D.url("winc")}">{"".join(wv)}</g>')
# window frame (wood) + mullions
fr = ''
for t in (0.33, 0.66):
    z = lerp(wz0, wz1, t)
    a, b = rwp(z, wy1), rwp(z, wy0)
    fr += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
ym = (wy0 + wy1) / 2
a, b = rwp(wz0, ym), rwp(wz1, ym)
fr += f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}'
D.add(path(fr, stroke='#7a4426', stroke_width='9', fill='none'))
D.add(path(pp(win), stroke='#6a3a20', stroke_width='16', fill='none'))
D.add(path(pp(win), stroke=WOOD_L, stroke_width='3', fill='none', opacity='0.6'))
# sill
s0, s1, s2, s3 = rwp(wz0 - 0.08, wy0), rwp(wz1 + 0.08, wy0), P(XR - 0.18, wy0, wz1 + 0.08), P(XR - 0.18, wy0, wz0 - 0.08)
D.add(path(pp([s0, s1, s2, s3]), fill='#c98552'), path(pp([s3, s2, P(XR - 0.18, wy0 - 0.06, wz1 + 0.08), P(XR - 0.18, wy0 - 0.06, wz0 - 0.08)]), fill=WOOD_D))
# glass sheen on the panes
D.add(path(pp([rwp(wz0 + 0.1, wy1 - 0.05), rwp(wz0 + 0.3, wy1 - 0.05), rwp(wz0 + 0.05, wy0 + 0.1), rwp(wz0 - 0.0, wy0 + 0.3)]), fill='#ffffff', opacity='0.18'))
# glass wind chime hanging in the window (outside the eave)
cx_, cy_ = rwp(3.0, wy1 - 0.02)
D.d(lin_grad(D.id('rb'), [(0, '#ff7aa8'), (0.25, '#ffd36e'), (0.5, '#7ff0c0'), (0.75, '#7ab8ff'), (1, '#c69bff')]))
D.d(rad_grad(D.id('glow'), [(0, ('#ffffff', 0.9)), (0.4, ('#fff1d0', 0.4)), (1, ('#fff1d0', 0))]))
D.add(f'<g transform="translate({n(cx_)} {n(cy_)})"><path d="M0,0 V26" stroke="#5a3a40" stroke-width="1.6"/>'
      f'<path d="M-17,50 C-17,22 17,22 17,50Z" fill="#eafcff" opacity="0.6"/>'
      f'<path d="M-17,50 C-17,22 17,22 17,50" fill="none" stroke="url(#{D.id("rb")})" stroke-width="2.4"/>'
      f'<path d="M-10,44 C-10,34 -5,29 1,28" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
      f'<path d="M-17,50 H17" stroke="#9ad8ff" stroke-width="1.5" opacity="0.8"/>'
      f'<path d="M0,46 V72" stroke="#5a3a40" stroke-width="1.2"/><path d="M-7,72 h14 v36 h-14z" fill="#ff9fb8"/>'
      f'<path d="M-7,72 h14 v6 h-14z" fill="#fff" opacity="0.5"/>'
      f'<circle cx="4" cy="30" r="18" fill="url(#{D.id("glow")})"/></g>')

# ------------------------------------------------------------------ back wall dressing
# shop emblem: the morning sun ("asahi") on a wooden board
D.add(f'<g transform="translate(905 178)">'
      f'<rect x="-190" y="-50" width="380" height="96" rx="10" fill="#7a4426"/><rect x="-182" y="-42" width="364" height="80" rx="7" fill="#c47c46"/>'
      f'<rect x="-182" y="-42" width="364" height="14" rx="7" fill="#e3a46a" opacity="0.6"/>'
      f'<circle cx="0" cy="12" r="30" fill="#ff7a45"/><circle cx="0" cy="12" r="30" fill="none" stroke="#ffd36e" stroke-width="5"/>'
      + ''.join(f'<path d="M{n(math.cos(math.radians(a)) * 40)},{n(12 - math.sin(math.radians(a)) * 40)} L{n(math.cos(math.radians(a)) * 58)},{n(12 - math.sin(math.radians(a)) * 58)}" stroke="#ffd36e" stroke-width="6" stroke-linecap="round"/>' for a in range(10, 180, 20))
      + f'<path d="M-150,30 h300" stroke="#7a4426" stroke-width="4"/>'
      f'<ellipse cx="-120" cy="10" rx="28" ry="16" fill="#f6c36a"/><path d="M-138,10 h36 M-130,0 v20 M-118,-2 v24 M-106,0 v20" stroke="#c98a3a" stroke-width="2"/>'
      f'<ellipse cx="120" cy="10" rx="28" ry="16" fill="#b8642e"/><circle cx="120" cy="6" r="4" fill="#ffc6d8"/>'
      f'</g>')

# wall clock (5:00)
D.add(f'<g transform="translate(410 230)"><circle r="54" fill="#7a4426"/><circle r="45" fill="#fff7e6"/>'
      + ''.join(f'<circle cx="{n(math.sin(math.radians(a)) * 37)}" cy="{n(-math.cos(math.radians(a)) * 37)}" r="{3.2 if a % 90 == 0 else 2}" fill="#7a4426"/>' for a in range(0, 360, 30))
      + f'<path d="M0,0 L{n(math.sin(math.radians(150)) * 22)},{n(-math.cos(math.radians(150)) * 22)}" stroke="#3a2016" stroke-width="5" stroke-linecap="round"/>'
      f'<path d="M0,0 V-34" stroke="#3a2016" stroke-width="3" stroke-linecap="round"/><circle r="4" fill="#d8323c"/>'
      f'<path d="M-30,-26 A40,40 0 0 1 10,-42" stroke="#fff" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/></g>')

# the child's crayon drawing, pinned
cr = (f'<g transform="translate(1168 430) rotate(-4) scale(0.82)">'
      f'<rect x="-82" y="-62" width="164" height="124" fill="#000" opacity="0.08" transform="translate(4 5)"/>'
      f'<rect x="-82" y="-62" width="164" height="124" fill="#fffdf6"/>'
      f'<path d="M-82,40 C-40,34 20,46 82,38" stroke="#5cc25a" stroke-width="6" fill="none" stroke-linecap="round"/>'
      f'<circle cx="-56" cy="-36" r="14" fill="#ffd23e"/>'
      + ''.join(f'<path d="M{n(-56 + math.cos(math.radians(a)) * 18)},{n(-36 + math.sin(math.radians(a)) * 18)} l{n(math.cos(math.radians(a)) * 9)},{n(math.sin(math.radians(a)) * 9)}" stroke="#ffb020" stroke-width="3" stroke-linecap="round"/>' for a in range(0, 360, 45))
      # Hinata: tall, orange bun, red shirt
      + f'<circle cx="-10" cy="-30" r="9" fill="#ffe0c8" stroke="#e8902a" stroke-width="2"/><circle cx="-10" cy="-42" r="7" fill="#ff9a2a"/>'
      f'<path d="M-18,-20 h16 l3,30 h-22z" fill="#ff4a3a"/><path d="M-14,10 v16 M-6,10 v16" stroke="#7a4426" stroke-width="3" stroke-linecap="round"/>'
      f'<path d="M-18,-14 l-12,12 M-2,-14 l12,10" stroke="#ff4a3a" stroke-width="3" stroke-linecap="round"/>'
      # Mame: small, orange bob, scowl
      f'<circle cx="26" cy="-6" r="8" fill="#ffe0c8" stroke="#e8902a" stroke-width="2"/><path d="M17,-8 C18,-18 34,-18 35,-8" fill="#ff9a2a"/>'
      f'<path d="M22,-2 l3,1 M27,-1 l3,-1" stroke="#3a2016" stroke-width="1.4"/>'
      f'<path d="M19,2 h14 l2,20 h-18z" fill="#5a8cff"/><path d="M23,22 v10 M29,22 v10" stroke="#7a4426" stroke-width="3" stroke-linecap="round"/>'
      # baby in arms
      f'<circle cx="2" cy="-6" r="6" fill="#ffe0c8" stroke="#e8902a" stroke-width="1.6"/><path d="M-4,-2 h12 v8 h-12z" fill="#ffe46a"/>'
      # heart + scribble
      f'<path d="M52,-40 c-4,-8 -14,-4 -10,4 l10,10 l10,-10 c4,-8 -6,-12 -10,-4z" fill="#ff6a8a"/>'
      f'<path d="M-70,22 l6,-4 l6,4 l6,-4 l6,4" stroke="#a66bff" stroke-width="2.4" fill="none"/>'
      f'<circle cx="0" cy="-56" r="6" fill="#e8403a"/><circle cx="-2" cy="-58" r="2" fill="#fff" opacity="0.7"/>'
      f'</g>')
D.add(cr)

# ------------------------------------------------------------------ bread shelves on the back wall
SX0, SX1 = 560, 1075
D.add(rect(SX0 - 18, 282, SX1 - SX0 + 36, 470, fill='#e8b46e', opacity='0.35'))
# side posts
D.add(rect(SX0 - 22, 270, 20, 500, fill=WOOD_D), rect(SX1 + 2, 270, 20, 500, fill=WOOD_D))
D.add(rect(SX0 - 22, 270, 6, 500, fill=WOOD_L, opacity='0.5'), rect(SX1 + 2, 270, 6, 500, fill=WOOD_L, opacity='0.5'))

# loaf prototypes (origin bottom-centre)
D.d(lin_grad(D.id('crust'), [(0, CRUST_L), (0.5, CRUST), (1, CRUST_D)], 0, 0, 0, 1))
D.d(lin_grad(D.id('crustp'), [(0, '#ffe2a0'), (0.6, '#f2bd6a'), (1, '#d08a3e')], 0, 0, 0, 1))
D.d(f'<g id="{D.id("shoku")}"><path d="M-38,0 V-34 C-38,-58 -14,-60 0,-50 C14,-60 38,-58 38,-34 V0Z" fill="url(#{D.id("crust")})"/>'
    f'<path d="M-38,-30 C-38,-50 -18,-54 -6,-46" stroke="{CRUST_L}" stroke-width="4" fill="none" opacity="0.8" stroke-linecap="round"/>'
    f'<path d="M-38,0 V-34 C-38,-58 -14,-60 0,-50 C14,-60 38,-58 38,-34 V0Z" fill="none" stroke="#7a3a18" stroke-width="2"/>'
    f'<rect x="-38" y="-30" width="76" height="30" fill="#f6d39a" opacity="0.5"/></g>')
D.d(f'<g id="{D.id("boule")}"><path d="M-40,0 C-44,-40 44,-40 40,0Z" fill="url(#{D.id("crust")})" stroke="#7a3a18" stroke-width="2"/>'
    f'<path d="M-22,-14 q22,-14 44,0 M-14,-24 q14,-8 28,0" stroke="{CRUMB}" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
    f'<path d="M-30,-16 C-28,-24 -20,-28 -12,-29" stroke="#fff3d0" stroke-width="3" fill="none" opacity="0.7" stroke-linecap="round"/></g>')
D.d(f'<g id="{D.id("roll")}"><path d="M-18,0 C-20,-22 20,-22 18,0Z" fill="url(#{D.id("crust")})" stroke="#7a3a18" stroke-width="1.8"/>'
    f'<path d="M-10,-8 C-9,-12 -5,-14 -1,-15" stroke="#fff3d0" stroke-width="2.4" fill="none" opacity="0.8" stroke-linecap="round"/></g>')
D.d(f'<g id="{D.id("crois")}"><path d="M-34,0 C-30,-20 30,-20 34,0 C24,-6 -24,-6 -34,0Z" fill="url(#{D.id("crustp")})" stroke="#8a4a1c" stroke-width="1.8"/>'
    f'<path d="M-20,-4 C-18,-10 -16,-12 -12,-14 M-6,-5 C-6,-11 -4,-14 0,-15 M8,-5 C8,-11 10,-13 14,-14 M20,-4 C20,-8 22,-10 24,-11" stroke="#a85a22" stroke-width="2" fill="none"/></g>')
D.d(f'<g id="{D.id("bag")}"><path d="M-7,0 L-4,-118 C-3,-126 3,-126 4,-118 L7,0Z" fill="url(#{D.id("crust")})" stroke="#7a3a18" stroke-width="1.6"/>'
    f'<path d="M-3,-100 l5,-8 M-3,-78 l5,-8 M-3,-56 l5,-8 M-3,-34 l5,-8" stroke="{CRUMB}" stroke-width="2.4" stroke-linecap="round"/></g>')
D.d(f'<g id="{D.id("jar")}"><rect x="-16" y="-44" width="32" height="44" rx="6" fill="#dff6ff" opacity="0.45" stroke="#9fc8e8" stroke-width="2"/>'
    f'<rect x="-13" y="-30" width="26" height="28" rx="4"/>'
    f'<rect x="-12" y="-52" width="24" height="9" rx="2" fill="#a0603a"/><path d="M-10,-38 V-8" stroke="#fff" stroke-width="3" opacity="0.7" stroke-linecap="round"/></g>')

shelves = [(330, 'top'), (470, 'mid'), (610, 'low'), (735, 'base')]
for y, kind in shelves:
    # contents first (sit on the shelf), then the board front
    x = SX0 + 30
    items = []
    if kind == 'top':
        seq = ['jar'] * 2 + ['basket'] + ['jar'] * 3 + ['basket'] + ['jar'] * 2
        jcols = ['#ffb02e', '#ff5a6e', '#a66bff', '#3fc5a0', '#ff8a3d', '#5a8cff', '#ffd23e']
        xs = [SX0 + 40 + i * (SX1 - SX0 - 80) / (len(seq) - 1) for i in range(len(seq))]
        for xx, it in zip(xs, seq):
            if it == 'jar':
                items.append(f'<use href="#{D.id("jar")}" fill="{R.choice(jcols)}" transform="translate({n(xx)} {y})"/>')
            else:
                items.append(f'<g transform="translate({n(xx)} {y})">'
                             f'<use href="#{D.id("bag")}" transform="rotate(-14) scale(0.6)"/><use href="#{D.id("bag")}" transform="translate(8 0) rotate(8) scale(0.62)"/>'
                             f'<path d="M-26,0 L-22,-30 H22 L26,0Z" fill="#c8894a"/><path d="M-24,-10 H24 M-23,-20 H23" stroke="#8a5428" stroke-width="2"/></g>')
    elif kind == 'mid':
        xx = SX0 + 55
        while xx < SX1 - 40:
            items.append(f'<use href="#{D.id("shoku")}" transform="translate({n(xx)} {y}) scale(0.95)"/>')
            xx += 84
    elif kind == 'low':
        xx = SX0 + 50
        k = 0
        while xx < SX1 - 40:
            proto = 'boule' if k % 3 != 2 else 'crois'
            items.append(f'<use href="#{D.id(proto)}" transform="translate({n(xx)} {y}) scale({R.uniform(0.9, 1.05):.2f})"/>')
            xx += 92 if proto == 'boule' else 82
            k += 1
    else:   # base shelf: rolls in rows
        xx = SX0 + 34
        while xx < SX1 - 20:
            items.append(f'<use href="#{D.id("roll")}" transform="translate({n(xx)} {y})"/>')
            items.append(f'<use href="#{D.id("roll")}" transform="translate({n(xx + 20)} {y - 10}) scale(0.9)"/>')
            xx += 44
    D.add(*items)
    # shelf board
    D.add(rect(SX0 - 6, y, SX1 - SX0 + 12, 14, fill=WOOD), rect(SX0 - 6, y, SX1 - SX0 + 12, 4, fill=WOOD_L, opacity='0.7'),
          rect(SX0 - 6, y + 14, SX1 - SX0 + 12, 8, fill='#8a5234', opacity='0.25'))

# ------------------------------------------------------------------ doorway with bead curtain
DX0, DX1, DY0 = 1265, 1505, 300
D.d(lin_grad(D.id('back'), [(0, '#6b4038'), (1, '#3e2430')], 0, DY0, 0, 780, user=True))
D.add(rect(DX0, DY0, DX1 - DX0, 500, fill=D.url('back')))
# back room: lamp glow, crib edge
D.d(rad_grad(D.id('bglow'), [(0, ('#ffcf8a', 0.75)), (1, ('#ffcf8a', 0))], cx=1330, cy=430, r=200, user=True))
D.add(rect(DX0, DY0, DX1 - DX0, 500, fill=D.url('bglow')))
crib = ('<g>'
        '<path d="M1400,610 C1400,585 1430,575 1460,575 C1490,575 1520,585 1520,610 V780 H1400Z" fill="#e8c090"/>'
        '<path d="M1408,612 C1408,592 1432,585 1460,585 C1488,585 1512,592 1512,612" fill="none" stroke="#c8945e" stroke-width="4"/>'
        + ''.join(f'<rect x="{x}" y="616" width="6" height="120" fill="#c08850"/>' for x in range(1414, 1512, 16)) +
        '<rect x="1400" y="736" width="120" height="14" fill="#c8945e"/>'
        '<path d="M1406,700 C1440,690 1480,700 1516,694 V736 H1406Z" fill="#9ccaf0" opacity="0.9"/>'
        '<path d="M1460,500 V540" stroke="#d8b0a0" stroke-width="2"/><path d="M1432,540 H1488" stroke="#d8b0a0" stroke-width="2"/>'
        '<path d="M1432,540 v10 M1460,540 v14 M1488,540 v10" stroke="#d8b0a0" stroke-width="1.5"/>'
        '<path d="M1432,556 l5,-6 l5,6 l-5,6z" fill="#ffd36e"/><circle cx="1460" cy="560" r="6" fill="#8fc8ff"/><path d="M1482,552 h12 v10 h-12z" fill="#ff9fbe"/>'
        '</g>')
D.add(crib)
# bead curtain
BEADC = ['#ffb02e', '#ff5a6e', '#46d9ff', '#a66bff', '#2fc59a', '#ffd23e', '#ff7fc4', '#3f6dff']
for k in range(3):
    cols = [BEADC[(k * 3 + j) % 8] for j in range(4)]
    beads = ''.join(f'<ellipse cx="6" cy="{6 + j * 13}" rx="5.2" ry="5.8" fill="{c}"/><circle cx="4.4" cy="{4.2 + j * 13}" r="1.6" fill="#fff"/>' for j, c in enumerate(cols))
    D.d(f'<pattern id="{D.id("bp" + str(k))}" width="12" height="52" patternUnits="userSpaceOnUse" y="{DY0 + k * 17}">'
        f'<path d="M6,0 V52" stroke="#4a2a24" stroke-width="1.2"/>{beads}</pattern>')
strands = ''
xs = list(range(DX0 + 6, DX1 - 10, 19))
mid = (DX0 + DX1) / 2
for i, x in enumerate(xs):
    lean = (x - mid) / (DX1 - DX0) * 0.12   # parted: strands lean outward
    if abs(x - mid) < 24:
        continue
    h = 470 - abs(x - mid) * 0.0
    strands += (f'<rect x="{x}" y="{DY0}" width="12" height="{n(h)}" fill="url(#{D.id("bp" + str(i % 3))})" '
                f'transform="translate({n(-lean * DY0)} 0) skewX({n(math.degrees(math.atan(lean)))})"/>')
D.add(f'<g opacity="0.95">{strands}</g>')
D.add(rect(DX0, DY0, DX1 - DX0, 8, fill='#4a2a24'))
# door frame
D.add(path(f'M{DX0 - 16},{DY0 - 22} H{DX1 + 16} V780 H{DX1} V{DY0} H{DX0} V780 H{DX0 - 16}Z', fill=WOOD_D))
D.add(rect(DX0 - 16, DY0 - 22, DX1 - DX0 + 32, 6, fill=WOOD_L, opacity='0.6'))
D.add(rect(DX0 - 30, DY0 - 34, DX1 - DX0 + 60, 14, fill='#6a3a20'))

# ------------------------------------------------------------------ stairs on the left (rising toward the back)
NST = 12
Z0, Z1 = 2.0, ZB - 0.06
SXo, SXi = XL, XL + 0.68       # wall side, open side
run = (Z1 - Z0) / NST
rise = (YC - YF) / NST
# stringer side (open side, facing the room)
prof = []
for i in range(NST):
    z = Z0 + i * run
    yb = YF + i * rise
    prof += [P(SXi, yb + rise, z), P(SXi, yb + rise, z + run)]
under = [P(SXi, YC - 0.25, Z1), P(SXi, YF + 0.0, Z0 + 0.6)]
# risers and treads (visible: risers face us; treads only below eye level)
st = []
for i in range(NST - 1, -1, -1):
    z = Z0 + i * run
    yb = YF + i * rise
    a, b = P(SXo, yb, z), P(SXi, yb, z)
    c, d = P(SXi, yb + rise, z), P(SXo, yb + rise, z)
    st.append(path(pp([a, b, c, d]), fill='#a65e30'))
    st.append(path(f'M{n(d[0])},{n(d[1])}L{n(c[0])},{n(c[1])}', stroke='#f0b070', stroke_width='3'))
    if yb + rise < 0:
        e, f = P(SXi, yb + rise, z + run), P(SXo, yb + rise, z + run)
        st.append(path(pp([d, c, e, f]), fill='#d08a50'))
D.add(*st)
# stringer board
str_top = [P(SXi, YF + i * rise + rise + 0.1, Z0 + i * run) for i in range(NST)] + [P(SXi, YC + 0.1, Z1)]
str_bot = [P(SXi, YF + i * rise - 0.12, Z0 + i * run + run) for i in range(NST)][::-1]
D.add(path(pp(str_top + str_bot), fill='#7c4226'))
D.add(path('M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in str_top), stroke='#d89058', stroke_width='4', fill='none'))
# space under the stairs: flour sacks
for x_, y_, s_ in [(170, 690, 1.0), (260, 676, 0.85)]:
    D.add(f'<g transform="translate({x_} {y_}) scale({s_})"><path d="M-48,60 C-56,10 -40,-30 -30,-44 L30,-44 C40,-30 56,10 48,60Z" fill="#f4ead4"/>'
          f'<path d="M-30,-44 C-24,-54 24,-54 30,-44" fill="#e2d4b4"/><path d="M-36,0 C-10,8 10,8 36,0" stroke="#5a8cff" stroke-width="5" fill="none"/>'
          f'<path d="M-36,12 C-10,20 10,20 36,12" stroke="#d8323c" stroke-width="3" fill="none"/>'
          f'<path d="M20,-40 C40,-10 42,30 40,58 L48,60 C56,10 40,-30 30,-44Z" fill="#cfc0a0" opacity="0.7"/></g>')
# handrail
hr0, hr1 = P(SXi - 0.02, YF + 0.95, Z0), P(SXi - 0.02, YC + 0.75, Z1)
D.add(path(f'M{n(hr0[0])},{n(hr0[1])} L{n(hr1[0])},{n(hr1[1])}', stroke='#5e2f1c', stroke_width='12', stroke_linecap='round'))
D.add(path(f'M{n(hr0[0])},{n(hr0[1] - 3)} L{n(hr1[0])},{n(hr1[1] - 3)}', stroke='#e9a464', stroke_width='3', stroke_linecap='round', opacity='0.8'))
for i in range(1, NST, 3):
    z = Z0 + i * run + run / 2
    a, b = P(SXi - 0.02, YF + i * rise + rise, z), P(SXi - 0.02, YF + i * rise + rise + 0.88, z)
    D.add(path(f'M{n(a[0])},{n(a[1])} L{n(b[0])},{n(b[1])}', stroke='#6a3420', stroke_width='7'))
# stairwell opening in the ceiling (upstairs is dark)
D.add(path(pp([P(XL, YC, Z1 - 0.7), P(SXi + 0.05, YC, Z1 - 0.7), P(SXi + 0.05, YC, ZB), P(XL, YC, ZB)]), fill='#4a2a26'))
D.add(path(pp([P(XL, YC, Z1 - 0.7), P(SXi + 0.05, YC, Z1 - 0.7), P(SXi + 0.05, YC - 0.08, Z1 - 0.7), P(XL, YC - 0.08, Z1 - 0.7)]), fill=WOOD_D))

D.add(rect(0, 0, 1920, 1080, fill='#6a3a20', opacity='0.13'))
# ------------------------------------------------------------------ pendant lamps
D.d(rad_grad(D.id('lamp'), [(0, ('#fff8e0', 1)), (0.2, ('#ffe0a0', 0.6)), (0.55, ('#ffc878', 0.2)), (1, ('#ffc070', 0))]))
for lx, ly, s_ in [(700, 250, 1.0), (1130, 236, 0.92)]:
    D.add(path(f'M{lx},{0} V{ly - 30 * s_}', stroke='#3a2016', stroke_width='2.5'))
    D.add(circle(lx, ly + 20 * s_, 260 * s_, fill=D.url('lamp')))
    D.add(f'<g transform="translate({lx} {ly}) scale({s_})">'
          f'<path d="M-12,-30 h24 l2,10 h-28z" fill="#2f6f5a"/>'
          f'<path d="M-62,10 C-50,-18 -22,-24 0,-24 C22,-24 50,-18 62,10Z" fill="#3f8f72"/>'
          f'<path d="M-62,10 C-50,-18 -22,-24 0,-24 C-20,-18 -40,-8 -48,10Z" fill="#7fd0aa" opacity="0.5"/>'
          f'<path d="M-62,10 H62" stroke="#fff3d6" stroke-width="3"/>'
          f'<ellipse cx="0" cy="12" rx="20" ry="9" fill="#fffbea"/></g>')

# ------------------------------------------------------------------ lived-in clutter
# maneki-neko on a little shelf above the doorway
D.add(rect(DX0 + 40, 238, 160, 10, fill=WOOD), rect(DX0 + 40, 238, 160, 3, fill=WOOD_L))
D.add(f'<g transform="translate({DX0 + 90} 238)"><ellipse cx="0" cy="-22" rx="20" ry="22" fill="#fffaf2" stroke="#b09080" stroke-width="2"/>'
      f'<circle cx="0" cy="-50" r="17" fill="#fffaf2" stroke="#b09080" stroke-width="2"/><path d="M-14,-60 l3,-14 l8,9Z M14,-60 l-3,-14 l-8,9Z" fill="#fffaf2" stroke="#b09080" stroke-width="2"/>'
      f'<path d="M-12,-63 l2,-7 l4,4Z" fill="#ff9fb4"/><path d="M-6,-50 q2,2 4,0 M4,-50 q2,2 4,0" stroke="#3a2016" stroke-width="1.6" fill="none"/>'
      f'<path d="M-14,-36 h28" stroke="#d8323c" stroke-width="4"/><circle cx="0" cy="-32" r="4" fill="#ffd23e"/>'
      f'<path d="M14,-30 C26,-36 28,-52 22,-62" stroke="#b09080" stroke-width="2" fill="#fffaf2"/><circle cx="23" cy="-63" r="6" fill="#fffaf2" stroke="#b09080" stroke-width="2"/>'
      f'<ellipse cx="-6" cy="-18" rx="8" ry="10" fill="#ffd23e" opacity="0.9"/></g>')
# small potted plants on the shelf above the door
for x_ in (DX0 + 150, DX0 + 185):
    D.add(f'<g transform="translate({x_} 238)"><path d="M-10,0 L-12,-18 H12 L10,0Z" fill="#d8784a"/><path d="M0,-18 C-14,-30 -16,-44 -6,-48 C-2,-38 0,-30 0,-18 C2,-32 8,-44 16,-42 C14,-30 8,-24 0,-18Z" fill="#4faf5a"/></g>')
# dried wheat bundles hanging from the back beam
def wheat(x, y, s_):
    stalks = ''.join(f'<path d="M0,0 L{n(dx)},64" stroke="#d8a85a" stroke-width="2"/>' for dx in (-10, -5, 0, 5, 10))
    ears = ''.join(f'<ellipse cx="{n(dx * 1.15)}" cy="{n(74 + abs(dx) * 0.3)}" rx="4" ry="11" fill="#e8b860" transform="rotate({-dx} {n(dx * 1.15)} {n(74 + abs(dx) * 0.3)})"/>' for dx in (-10, -5, 0, 5, 10))
    return (f'<g transform="translate({x} {y}) scale({s_})"><path d="M0,-30 V0" stroke="#7a4426" stroke-width="1.6"/>{stalks}'
            f'<rect x="-8" y="-4" width="16" height="8" fill="#d8323c"/>{ears}</g>')
D.add(wheat(470, 152, 0.9), wheat(1530, 140, 0.8), wheat(620, 150, 0.75))
# calendar left of the emblem
D.add(f'<g transform="translate(1240 148) scale(0.8)"><rect x="-44" y="0" width="88" height="104" fill="#fffdf4"/><rect x="-44" y="0" width="88" height="22" fill="#e85a4a"/>'
      + ''.join(f'<rect x="{-38 + c * 12}" y="{30 + r * 14}" width="9" height="9" fill="#e9dcc8"/>' for r in range(5) for c in range(7))
      + f'<circle cx="6.5" cy="62.5" r="8" fill="none" stroke="#d8323c" stroke-width="2"/><circle cx="0" cy="-4" r="3" fill="#7a4426"/></g>')
# window sill: basil pot and a glass bottle with a flower
sx_, sy_ = rwp(2.75, wy0)
D.add(f'<g transform="translate({n(sx_ - 40)} {n(sy_ + 4)})"><path d="M-18,0 L-22,-30 H22 L18,0Z" fill="#c8643e"/><rect x="-24" y="-34" width="48" height="7" fill="#e07a50"/>'
      f'<path d="M0,-34 C-24,-44 -30,-64 -14,-70 C-8,-58 -4,-46 0,-34 C4,-52 14,-68 28,-62 C24,-48 12,-40 0,-34Z M0,-34 C-6,-60 0,-80 8,-84 C12,-70 8,-50 0,-34Z" fill="#4fb05a"/>'
      f'<path d="M-14,-70 C-10,-60 -6,-50 0,-34" stroke="#2f7f44" stroke-width="1.5" fill="none"/></g>')
bx_, by_ = rwp(3.2, wy0)
D.add(f'<g transform="translate({n(bx_ - 30)} {n(by_ + 2)})"><path d="M-10,0 C-14,-20 -10,-30 -4,-34 V-48 H4 V-34 C10,-30 14,-20 10,0Z" fill="#c8f4ff" opacity="0.55" stroke="#8fd0f0" stroke-width="1.6"/>'
      f'<path d="M0,-48 C-4,-64 -2,-74 2,-80" stroke="#4fa058" stroke-width="2" fill="none"/><circle cx="2" cy="-84" r="7" fill="#ff8fb4"/><circle cx="2" cy="-84" r="3" fill="#ffe08a"/>'
      f'<path d="M-6,-6 C-8,-16 -6,-24 -2,-28" stroke="#fff" stroke-width="2" fill="none" opacity="0.9"/></g>')
# broom + crate by the stairs
D.add(f'<g transform="translate(372 760) rotate(8)"><rect x="-3" y="-230" width="6" height="200" fill="#c89050"/><path d="M-20,-30 h40 l10,40 h-60z" fill="#e0b860"/>'
      f'<path d="M-24,-10 h48" stroke="#d8323c" stroke-width="3"/><path d="M-26,10 l-2,-38 M-12,10 l-1,-38 M2,10 v-38 M16,10 l1,-38" stroke="#b8902a" stroke-width="1.5"/></g>')

# ------------------------------------------------------------------ dawn light shafts from the window + flour in the air
sh = []
for (za, zb, ya, yb), tgt, op in [((2.68, 2.9, 1.0, -0.3), ((150, 520), (260, 860)), 0.42),
                                   ((2.98, 3.2, 1.0, -0.3), ((560, 470), (640, 790)), 0.34),
                                   ((3.25, 3.4, 1.0, 0.2), ((900, 430), (950, 640)), 0.24)]:
    a_, b_ = rwp(za, ya), rwp(zb, yb)
    sh.append(poly([a_, rwp(zb, ya), b_, tgt[1], tgt[0]], opacity=f'{op}'))
D.d(lin_grad(D.id('shaft'), [(0, ('#fff6dc', 1)), (0.55, ('#ffe4b0', 0.6)), (1, ('#ffe0a8', 0))], 1700, 300, 300, 650, user=True))
D.add(f'<g fill="{D.url("shaft")}" filter="{D.blur(14)}">{"".join(sh)}</g>')
D.add(f'<g fill="{D.url("shaft")}" filter="{D.blur(3)}" opacity="0.5">{"".join(sh)}</g>')
D.add(ellipse(260, 640, 150, 90, fill='#fff1c4', opacity='0.35', filter=D.blur(30)), ellipse(640, 600, 120, 80, fill='#fff1c4', opacity='0.3', filter=D.blur(30)))
# window-shaped patch of dawn light thrown onto the back wall and shelves
patch = ''
ox, oy, pw, ph, gap, sk = 360, 360, 118, 128, 12, 0.32
for r in range(2):
    for c in range(3):
        x0 = ox + c * (pw + gap) + r * (ph + gap) * sk
        y0 = oy + r * (ph + gap)
        patch += f'M{n(x0)},{n(y0)} h{pw} l{n(ph * sk)},{ph} h{-pw}Z'
D.add(path(patch, fill='#fff0c0', opacity='0.32', filter=D.blur(4)))
# flour motes
mo = ''
for i in range(110):
    t = R.random()
    x = lerp(1620, 260, t) + R.uniform(-120, 120)
    y = lerp(330, 640, t) + R.uniform(-160, 160)
    r = R.uniform(1, 3.2)
    mo += f'M{n(x - r)},{n(y)}a{n(r)},{n(r)} 0 1 0 {n(2 * r)},0a{n(r)},{n(r)} 0 1 0 {n(-2 * r)},0'
D.add(path(mo, fill='#fffbea', opacity='0.75'))
for x_, y_, r_ in [(1500, 330, 10), (980, 560, 7), (640, 720, 8), (1260, 470, 6)]:
    D.add(star4(x_, y_, r_, fill='#ffffff', opacity='0.85'))

# ------------------------------------------------------------------ the counter
CZf, CZb, CY = 1.49, 1.92, -0.5
ct = [P(-6, CY, CZb), P(6, CY, CZb), P(6, CY, CZf), P(-6, CY, CZf)]
yb_, yf_ = P(0, CY, CZb)[1], P(0, CY, CZf)[1]
D.d(lin_grad(D.id('ctop'), [(0, '#e9b878'), (1, '#d79a5c')], 0, yb_, 0, yf_, user=True))
D.add(rect(-10, yb_, 1940, yf_ - yb_, fill=D.url('ctop')))
# wood grain on the top
gr = ''
for i in range(9):
    y = lerp(yb_ + 6, yf_ - 6, (i + 0.5) / 9)
    gr += f'M-10,{n(y)} C400,{n(y + R.uniform(-3, 3))} 900,{n(y + R.uniform(-3, 3))} 1930,{n(y)}'
D.add(path(gr, stroke='#b97a44', stroke_width='1.5', opacity='0.35', fill='none'))
# window light pooled on the counter
D.d(rad_grad(D.id('pool'), [(0, ('#fff6d8', 0.55)), (1, ('#fff6d8', 0))], cx=520, cy=0, r=1, extra=''))
D.add(ellipse(560, (yb_ + yf_) / 2, 420, 40, fill='#fff1c8', opacity='0.28', filter=D.blur(14)))
# front edge
D.add(rect(-10, yf_ - 4, 1940, 12, fill='#f2c890'), rect(-10, yf_ + 8, 1940, 6, fill='#8c4a28'))
# front face (calm)
D.d(lin_grad(D.id('cfront'), [(0, '#a4602f'), (0.3, '#94532a'), (1, '#6e3a20')], 0, yf_ + 14, 0, 1080, user=True))
D.add(rect(-10, yf_ + 14, 1940, 1080 - yf_, fill=D.url('cfront')))
pan = ''
pan_hi = ''
pan_sh = ''
for x in range(-60, 1960, 240):
    x0, x1, y0, y1 = x + 22, x + 218, yf_ + 52, 1040
    pan += f'M{x0},{n(y0)}H{x1}V{y1}H{x0}Z'
    pan_sh += f'M{x0},{n(y0)}H{x1}V{n(y0 + 6)}H{x0 + 6}V{y1}H{x0}Z'
    pan_hi += f'M{x0},{y1}H{x1}V{n(y0)}H{x1 - 5}V{y1 - 5}H{x0}Z'
D.add(path(pan, fill='#8a4a26', opacity='0.55'))
D.add(path(pan_sh, fill='#3e1e10', opacity='0.45'))
D.add(path(pan_hi, fill='#e0a060', opacity='0.4'))
D.add(rect(-10, yf_ + 14, 1940, 26, fill='#b06a38'), rect(-10, yf_ + 14, 1940, 5, fill='#e8a868', opacity='0.7'))
D.add(rect(-10, yf_ + 14, 1940, 20, fill='#4a2414', opacity='0.25'))
D.add(rect(-10, 1040, 1940, 40, fill='#3e1e10', opacity='0.4'))

# ------------------------------------------------------------------ trays on the counter
def tray(x0, x1, y, depth):
    return (path(f'M{x0},{n(y)} L{x1},{n(y)} L{x1 + 14},{n(y + depth)} L{x0 - 14},{n(y + depth)}Z', fill='#c9ced8') +
            path(f'M{x0 - 14},{n(y + depth)} L{x1 + 14},{n(y + depth)} L{x1 + 14},{n(y + depth + 8)} L{x0 - 14},{n(y + depth + 8)}Z', fill='#8f96a8') +
            path(f'M{x0},{n(y)} L{x1},{n(y)}', stroke='#eef1f6', stroke_width='3'))
# bean buns (anpan): glossy, with a sesame / sakura dot
D.d(rad_grad(D.id('anpan'), [(0, '#f2a25a'), (0.55, '#c86a2c'), (1, '#8a3e18')], cx=0.38, cy=0.3, r=0.75))
D.d(f'<g id="{D.id("an")}"><ellipse cx="0" cy="0" rx="34" ry="22" fill="url(#{D.id("anpan")})" stroke="#6e2e12" stroke-width="2"/>'
    f'<ellipse cx="-10" cy="-8" rx="12" ry="5" fill="#fff4d8" opacity="0.6"/><circle cx="2" cy="-6" r="3.2" fill="#ffd0dc"/><circle cx="2" cy="-6" r="1.2" fill="#ff7aa0"/></g>')
# melon bread: pale golden dome with a crisscross crust and sugar glints
D.d(rad_grad(D.id('melon'), [(0, '#fff2b8'), (0.6, '#f4cc6e'), (1, '#d79a3e')], cx=0.4, cy=0.3, r=0.75))
D.d(f'<clipPath id="{D.id("mc")}"><ellipse cx="0" cy="0" rx="36" ry="24"/></clipPath>')
D.d(f'<g id="{D.id("me")}"><ellipse cx="0" cy="0" rx="36" ry="24" fill="url(#{D.id("melon")})" stroke="#a86a22" stroke-width="2"/>'
    f'<g clip-path="url(#{D.id("mc")})" stroke="#c88a3a" stroke-width="2" opacity="0.8">'
    + ''.join(f'<path d="M{x},-30 l30,60"/><path d="M{x + 30},-30 l-30,60"/>' for x in range(-66, 50, 13)) +
    f'</g><ellipse cx="-12" cy="-9" rx="12" ry="5" fill="#fff" opacity="0.5"/>'
    f'<circle cx="8" cy="-10" r="1.5" fill="#fff"/><circle cx="-4" cy="4" r="1.2" fill="#fff"/><circle cx="18" cy="2" r="1.2" fill="#fff"/></g>')
TYb, TYf = yb_ + 10, yf_ - 14
D.add(tray(90, 560, TYb + 4, TYf - TYb - 8))
for row, (yy, xs, sc) in enumerate([(TYb + 20, range(140, 540, 74), 0.85), (TYb + 42, range(120, 560, 80), 1.0)]):
    for x in xs:
        D.add(f'<use href="#{D.id("an")}" transform="translate({x + (row * 8)} {n(yy)}) scale({sc})"/>')
D.add(tray(1330, 1800, TYb + 4, TYf - TYb - 8))
for row, (yy, xs, sc) in enumerate([(TYb + 20, range(1380, 1780, 76), 0.85), (TYb + 42, range(1360, 1800, 82), 1.0)]):
    for x in xs:
        D.add(f'<use href="#{D.id("me")}" transform="translate({x + (row * 8)} {n(yy)}) scale({sc})"/>')
# a glass cloche of cookies at the far right, catching the window
D.add(f'<g transform="translate(1870 {n(TYf + 6)})"><ellipse cx="0" cy="0" rx="58" ry="10" fill="#c9ced8"/>'
      f'<circle cx="-20" cy="-14" r="14" fill="#e8a858"/><circle cx="10" cy="-12" r="13" fill="#d8904a"/><circle cx="-4" cy="-30" r="12" fill="#f0b868"/>'
      f'<path d="M-50,0 C-54,-80 54,-80 50,0" fill="#e8fbff" opacity="0.35" stroke="#a8d8f0" stroke-width="2"/>'
      f'<path d="M-36,-20 C-36,-50 -20,-62 -4,-64" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>'
      f'<circle cx="0" cy="-72" r="7" fill="#e8fbff" stroke="#a8d8f0" stroke-width="2"/></g>')

# soft vignette + warm grade
D.d(rad_grad(D.id('vig'), [(0, ('#000', 0)), (0.6, ('#3a1a10', 0)), (1, ('#3a1a10', 0.42))], cx=960, cy=470, r=1150, user=True))
D.add(rect(0, 0, 1920, 1080, fill=D.url('vig')))

D.write(OUT)
