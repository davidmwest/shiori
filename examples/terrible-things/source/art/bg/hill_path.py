#!/usr/bin/env python3
"""bg/hill_path.svg - Glass Hill steps over Shiomi, early summer morning."""
import sys, os, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from bglib import *
from outpath import out_path

OUT = out_path('bg/hill_path.svg', __doc__)
R = random.Random(412)
D = Doc('hp')
HZ = 468          # horizon
SUN = (1790, 70)  # sun position (just inside the top-right)

# ------------------------------------------------------------------ sky
D.d(lin_grad(D.id('sky'), [(0, '#0f2fa8'), (0.22, '#1d4fd0'), (0.48, '#3a86ea'), (0.68, '#78bcf5'),
                           (0.82, '#bfe0fb'), (0.92, '#ffe0cf'), (1, '#ffd3b4')], 0, 0, 0, HZ, user=True))
D.add(rect(0, 0, 1920, HZ + 4, fill=D.url('sky')))
D.d(rad_grad(D.id('sunwash'), [(0, ('#ffffff', 1)), (0.06, ('#fffdf0', 0.95)), (0.2, ('#e6f7ff', 0.6)),
                               (0.45, ('#b8e4ff', 0.25)), (1, ('#b8e4ff', 0))], cx=SUN[0], cy=SUN[1], r=1000, user=True))
D.add(rect(0, 0, 1920, HZ + 4, fill=D.url('sunwash')))

# high cirrus streaks
cir = []
for i in range(9):
    x, y, w = R.uniform(150, 1500), R.uniform(40, 200), R.uniform(160, 420)
    cir.append(path(f'M{n(x)},{n(y)} q{n(w*0.5)},{n(-R.uniform(4, 14))} {n(w)},{n(R.uniform(-6, 4))}',
                    stroke_width=n(R.uniform(2, 6)), opacity=n(R.uniform(.25, .5))))
D.add(f'<g filter="{D.blur(2.5)}" fill="none" stroke="#ffffff" stroke-linecap="round">{"".join(cir)}</g>')

# ------------------------------------------------------------------ clouds
def tower(uid, spec, seed, top, base, **kw):
    rng = random.Random(seed)
    B = [billow_circles(cx, cy, rx, ry, rng, bumps=bm, flat=fl) for cx, cy, rx, ry, bm, fl in spec]
    D.add(cloud(D, uid, B, top, base, **kw))

# far, low bank on the left
tower('cl', [
    (330, 395, 120, 62, 9, 0.5), (520, 372, 140, 80, 10, 0.5), (700, 410, 120, 60, 9, 0.5),
    (180, 430, 150, 48, 9, 0.4), (430, 438, 210, 52, 11, 0.4), (690, 448, 170, 40, 9, 0.4),
], 7, 300, HZ, shade=('#f3f2ff', '#d8d8f2', '#b9bbe6'), lit=('#ffffff', '#fff6ee', '#ffe2d4'),
    belly='#a9a6d8', glow=0.45, clip_base=HZ)
# small floating puffs
tower('cp', [(860, 205, 74, 30, 7, 0.4), (930, 214, 56, 22, 6, 0.4)], 11, 170, 230,
      shade=('#f2f2ff', '#d6d9f5', '#b4b9e8'), glow=0.4)
tower('cq', [(560, 140, 52, 20, 6, 0.4), (610, 146, 40, 16, 5, 0.4)], 13, 115, 160,
      shade=('#f2f2ff', '#d6d9f5', '#b4b9e8'), glow=0.4)

# the great tower, centre-right
tower('ct', [
    (1255, 95, 110, 70, 10, 0.5), (1360, 120, 90, 60, 8, 0.5),
    (1180, 170, 130, 82, 10, 0.5), (1380, 190, 135, 88, 10, 0.5),
    (1120, 255, 150, 92, 11, 0.5), (1320, 270, 170, 100, 11, 0.5), (1500, 300, 120, 80, 9, 0.5),
    (1040, 340, 160, 92, 10, 0.5), (1250, 352, 210, 104, 12, 0.5), (1490, 372, 190, 92, 11, 0.5), (1700, 410, 140, 70, 9, 0.5),
    (920, 420, 180, 66, 11, 0.45), (1150, 430, 220, 72, 12, 0.45), (1420, 440, 240, 70, 12, 0.45), (1720, 452, 220, 58, 11, 0.45),
], 21, 30, HZ, shade=('#e9ebfc', '#bcc4ee', '#8f98d8'), lit=('#ffffff', '#fffbf2', '#ffe4d2'),
    belly='#9a96d2', glow=0.5, clip_base=HZ, lit_k=0.3, soft=3.5, belly_from=0.66)


# horizon haze swallowing the cloud bases
D.d(lin_grad(D.id('hzh'), [(0, ('#fff4ea', 0)), (0.55, ('#fff1e6', 0.35)), (1, ('#ffefe4', 0.85))], 0, HZ - 110, 0, HZ, user=True))
D.add(rect(0, HZ - 110, 1920, 112, fill=D.url('hzh')))

# ------------------------------------------------------------------ far land (left headland, distant island)
D.d(lin_grad(D.id('far'), [(0, '#9cc0ec'), (1, '#c7dcf4')], 0, 380, 0, HZ, user=True))
D.add(path(smooth([(-40, HZ + 2), (-40, 392), (60, 380), (170, 396), (260, 384), (380, 412), (470, 430), (560, 452), (640, HZ + 2)], closed=False) + 'Z',
           fill=D.url('far')))
D.add(path(smooth([(-40, HZ + 2), (-40, 420), (90, 414), (200, 430), (330, 440), (420, 456), (480, HZ + 2)], closed=False) + 'Z',
           fill='#b2cdee', opacity='0.9'))
D.add(path(f'M1300,{HZ+1} q24,-12 50,-10 q20,1 34,10Z', fill='#a9c6ee'))

# ------------------------------------------------------------------ sea
SHORE = lambda x: 652 - 0.000018 * (x - 1150) ** 2 * 1.0   # shoreline (harbour front) y at x
D.d(lin_grad(D.id('sea'), [(0, '#d9f0ff'), (0.08, '#a8dcfb'), (0.3, '#5cb6ee'), (0.65, '#2f8edb'), (1, '#1f6fc4')], 0, HZ, 0, 690, user=True))
D.add(rect(0, HZ, 1920, 240, fill=D.url('sea')))
# bright sheet under the sun
D.d(rad_grad(D.id('seasun'), [(0, ('#ffffff', 0.95)), (0.25, ('#f4fbff', 0.7)), (0.6, ('#d8f1ff', 0.25)), (1, ('#d8f1ff', 0))],
             cx=1560, cy=HZ + 6, r=620, user=True, extra=' gradientTransform="translate(1560 474) scale(1 0.16) translate(-1560 -474)"'))
D.add(rect(0, HZ, 1920, 240, fill=D.url('seasun')))
D.add(rect(0, HZ - 1, 1920, 3, fill='#ffffff', opacity='0.8'))
# glitter
gl = []
for i in range(260):
    t = R.random() ** 1.6
    y = HZ + 3 + t * 190
    spread = 140 + t * 520
    x = 1560 + R.gauss(0, 1) * spread * 0.55 - t * 180
    w = (2 + t * 16) * R.uniform(0.5, 1.4)
    gl.append(f'M{n(x)},{n(y)}h{n(w)}')
D.add(path(''.join(gl), stroke='#ffffff', stroke_width='1.6', stroke_linecap='round', opacity='0.85'))
gl = []
for i in range(90):
    t = R.random()
    y = HZ + 6 + t * 180
    x = R.uniform(0, 1920)
    w = (2 + t * 12) * R.uniform(0.5, 1.2)
    gl.append(f'M{n(x)},{n(y)}h{n(w)}')
D.add(path(''.join(gl), stroke='#e8f7ff', stroke_width='1.3', stroke_linecap='round', opacity='0.5'))
# sparkles
for x, y, r in [(1500, 492, 9), (1620, 505, 6), (1420, 520, 5), (1700, 486, 5), (1555, 540, 7)]:
    D.add(star4(x, y, r, fill='#ffffff'))

# boats with wakes
def boat(x, y, s, flip=1):
    return (f'<g transform="translate({n(x)} {n(y)}) scale({n(s*flip)} {n(s)})">'
            f'<path d="M-40,2 q30,6 70,0" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"/>'
            f'<path d="M-12,-3 h22 l-3,5 h-17z" fill="#ffffff"/><rect x="-6" y="-9" width="9" height="6" fill="#e9f0ff"/>'
            f'<rect x="-5" y="-8" width="3" height="2" fill="#3d5aa8"/></g>')
D.add(boat(980, 560, 1.0), boat(1180, 520, 0.7, -1), boat(760, 500, 0.6), boat(1400, 600, 1.1, -1))

# ------------------------------------------------------------------ breakwaters + lighthouses
def lighthouse(x, y, s, body, band):
    return (f'<g transform="translate({n(x)} {n(y)}) scale({n(s)})">'
            f'<path d="M-6,0 L-4.5,-30 H4.5 L6,0Z" fill="{body}"/>'
            f'<path d="M0.5,0 L1,-30 H4.5 L6,0Z" fill="#000" opacity="0.15"/>'
            f'<rect x="-5.5" y="-20" width="11" height="4" fill="{band}"/>'
            f'<rect x="-3.5" y="-37" width="7" height="7" fill="#e8f4ff"/><path d="M-5,-37 L0,-43 L5,-37Z" fill="{band}"/>'
            f'<rect x="-8" y="-1" width="16" height="3" fill="#cfd6e6"/></g>')
D.add(path('M640,668 L1074,604 L1082,610 L650,676Z', fill='#e6ecf6'), path('M650,676 L1082,610 L1082,614 L652,681Z', fill='#8fa1c8'))
D.add(path('M1920,608 L1262,592 L1258,597 L1920,615Z', fill='#e6ecf6'), path('M1258,597 L1920,615 L1920,619 L1258,600Z', fill='#8fa1c8'))
D.add(lighthouse(1078, 607, 1.0, '#ffffff', '#e8403a'), lighthouse(1262, 594, 0.95, '#ff5a4a', '#ffffff'))


# ------------------------------------------------------------------ town
def i0(v):
    return str(int(round(v)))

WALL, WALL2, WIN, EAVE = '#fbf4e8', '#e4dccf', '#46588c', '#1d2650'
tiles_a = ''.join(f'M{x},-31L{x + (0 if x == 0 else (2 if x > 0 else -2))},-66' for x in range(-48, 50, 9))
D.d(f'<g id="{D.id("hA")}">'
    f'<rect x="-48" y="-36" width="96" height="36" fill="{WALL}"/>'
    f'<rect x="-48" y="-36" width="96" height="9" fill="{EAVE}" opacity="0.18"/>'
    f'<rect x="-36" y="-22" width="13" height="11" fill="{WIN}"/><rect x="-6" y="-22" width="13" height="11" fill="{WIN}"/>'
    f'<rect x="22" y="-24" width="14" height="24" fill="#8a5a3a"/>'
    f'<path d="M-58,-30 L58,-30 L49,-68 L-49,-68Z"/>'
    f'<path d="M-49,-68 L49,-68 L45,-77 L-45,-77Z"/><path d="M-49,-68 L49,-68 L45,-77 L-45,-77Z" fill="#fff" opacity="0.45"/>'
    f'<path d="{tiles_a}" stroke="#0a1030" stroke-width="2" opacity="0.16"/>'
    f'<path d="M-58,-30 L58,-30" stroke="{EAVE}" stroke-width="3.5" opacity="0.45"/>'
    f'<path d="M-49,-68 L49,-68" stroke="#fff" stroke-width="2.5" opacity="0.7"/>'
    f'</g>')
D.d(f'<g id="{D.id("hB")}">'
    f'<path d="M-36,0 V-40 L0,-64 L36,-40 V0Z" fill="{WALL}"/>'
    f'<path d="M0,-64 L36,-40 V0 H18 V-40Z" fill="{WALL2}" opacity="0.6"/>'
    f'<rect x="-22" y="-28" width="12" height="12" fill="{WIN}"/><rect x="8" y="-28" width="12" height="12" fill="{WIN}"/>'
    f'<rect x="-8" y="-14" width="16" height="14" fill="#6f8bc0"/>'
    f'<path d="M-44,-36 L0,-68 L0,-92 L-44,-60Z"/>'
    f'<path d="M44,-36 L0,-68 L0,-92 L44,-60Z"/><path d="M44,-36 L0,-68 L0,-92 L44,-60Z" fill="#fff" opacity="0.4"/>'
    f'<path d="M-44,-36 L0,-68 L44,-36" stroke="{EAVE}" stroke-width="3" fill="none" opacity="0.4"/>'
    f'<path d="M0,-68 L0,-92" stroke="#fff" stroke-width="2.5" opacity="0.75"/>'
    f'<path d="M-33,-44 L-33,-67 M-22,-52 L-22,-75 M-11,-60 L-11,-83 M11,-60 L11,-83 M22,-52 L22,-75 M33,-44 L33,-67" stroke="#0a1030" stroke-width="2" opacity="0.14"/>'
    f'</g>')
D.d(f'<g id="{D.id("hC")}">'
    f'<rect x="-56" y="-44" width="112" height="44" fill="{WALL}"/>'
    f'<rect x="-56" y="-44" width="112" height="10" fill="{EAVE}" opacity="0.18"/>'
    f'<path d="M-50,-20 h100 v6 h-100z" fill="#e05a4a"/>'
    f'<rect x="-44" y="-14" width="88" height="14" fill="#55648f"/>'
    f'<rect x="-40" y="-36" width="12" height="10" fill="{WIN}"/><rect x="-14" y="-36" width="12" height="10" fill="{WIN}"/><rect x="12" y="-36" width="12" height="10" fill="{WIN}"/>'
    f'<path d="M-66,-38 L66,-38 L40,-80 L-40,-80Z"/>'
    f'<path d="M-40,-80 L40,-80 L34,-88 L-34,-88Z"/><path d="M-40,-80 L40,-80 L34,-88 L-34,-88Z" fill="#fff" opacity="0.45"/>'
    f'<path d="M40,-80 L66,-38 L56,-38 Z" fill="#000" opacity="0.12"/>'
    f'<path d="M-66,-38 L66,-38" stroke="{EAVE}" stroke-width="3.5" opacity="0.45"/>'
    f'<path d="M-40,-80 L40,-80" stroke="#fff" stroke-width="2.5" opacity="0.7"/>'
    f'</g>')
D.d(f'<g id="{D.id("tr")}">'
    f'<circle cx="0" cy="-30" r="30" fill="#2f8f5a"/><circle cx="-20" cy="-18" r="20" fill="#2a7f52"/><circle cx="20" cy="-16" r="22" fill="#2a7f52"/>'
    f'<circle cx="8" cy="-38" r="17" fill="#55b86a"/><circle cx="24" cy="-24" r="10" fill="#55b86a"/><circle cx="-10" cy="-42" r="9" fill="#7fd07a"/>'
    f'</g>')
D.d(rad_grad(D.id('glc'), [(0, ('#ffffff', 1)), (0.3, ('#d8fbff', 0.8)), (1, ('#9fe8ff', 0))]))
D.d(rad_grad(D.id('glpc'), [(0, ('#ffffff', 1)), (0.3, ('#ffe0f4', 0.8)), (1, ('#ffb0e0', 0))]))
D.d(f'<g id="{D.id("gl")}"><circle r="10" fill="{D.url("glc")}"/>{star4(0, 0, 7, fill="#fff")}</g>')
D.d(f'<g id="{D.id("glp")}"><circle r="10" fill="{D.url("glpc")}"/>{star4(0, 0, 7, fill="#fff")}</g>')

BLUES = ['#2f63d8', '#3c78ec', '#2a52b8', '#4d8ff2', '#3567e0']
ORANGES = ['#f2722e', '#ff8b3c', '#e65f28', '#f99a46']
OTHER = ['#27a5a0', '#d9483e', '#5b70a8']

def roofcol(rng):
    r = rng.random()
    if r < 0.47:
        return rng.choice(BLUES)
    if r < 0.92:
        return rng.choice(ORANGES)
    return rng.choice(OTHER)

ROAD = lambda y: 1060 + 60 * math.sin((y - 650) / 34) + (y - 650) * 0.9
BANK = [(820, 700), (900, 745), (935, 800), (950, 880), (985, 980), (1040, 1100)]   # right-hand bank of the steps
BANKF = [(150, 520), (330, 578), (500, 646), (660, 700)] + BANK
def bank_x(y):
    for (x1, y1), (x2, y2) in zip(BANKF, BANKF[1:]):
        if y1 <= y <= y2:
            return lerp(x1, x2, (y - y1) / (y2 - y1))
    return BANKF[0][0] if y < BANKF[0][1] else BANKF[-1][0]

# chime prototype (seen close on the nearest eaves)
D.d(lin_grad(D.id('rb'), [(0, '#ff7aa8'), (0.25, '#ffd36e'), (0.5, '#7ff0c0'), (0.75, '#7ab8ff'), (1, '#c69bff')]))
D.d(f'<g id="{D.id("ch")}"><path d="M0,0 V10" stroke="#58607e" stroke-width="1.2"/>'
    f'<path d="M-9,22 C-9,8 9,8 9,22Z" fill="#e8fbff" opacity="0.55"/><path d="M-9,22 C-9,8 9,8 9,22" fill="none" stroke="url(#{D.id("rb")})" stroke-width="1.6"/>'
    f'<path d="M-5,18 C-5,13 -2,11 1,11" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
    f'<path d="M0,20 V31" stroke="#58607e" stroke-width="1"/><path d="M-3,31 h6 v15 h-6z" fill="#ffb3c8"/>'
    f'<circle cx="2" cy="12" r="8" fill="url(#{D.id("glc")})"/></g>')

D.d(lin_grad(D.id('gnd'), [(0, '#cdd6e6'), (0.4, '#e3d8c8'), (1, '#d9cbb8')], 0, 640, 0, 1080, user=True))
D.add(path(f'M440,{n(SHORE(440)+4)} ' + ' '.join(f'L{x},{n(SHORE(x)+2)}' for x in range(440, 1961, 40)) +
           ' L1960,1090 L440,1090Z', fill=D.url('gnd')))
lane = ' '.join(f'{"M" if i == 0 else "L"}{n(ROAD(y))},{n(y)}' for i, y in enumerate(range(655, 1091, 5)))
D.add(path(lane, stroke='#f6eedf', stroke_width='14', fill='none', stroke_linejoin='round'))

town = []
TR = random.Random(7)
yrow = SHORE(1400) + 16
j = 0
while True:
    sc = 0.27 * (yrow - HZ) / (SHORE(1400) + 16 - HZ)
    off = yrow - SHORE(1400)
    d = min(1, off / 220)
    if yrow > 1130:
        break
    x = 330 + TR.uniform(0, 40) * sc
    if j in (5, 10, 16):   # terrace retaining wall
        xs = list(range(300, 1961, 60))
        ys = [SHORE(xx) + off - 4 * sc for xx in xs]
        town.append(path('M' + ' L'.join(f'{xx},{i0(y)}' for xx, y in zip(xs, ys)) +
                   ' ' + ' '.join(f'L{xx},{i0(y + 14 * sc)}' for xx, y in reversed(list(zip(xs, ys)))) + 'Z', fill='#b9c0d4'))
    while x < 1990 + 60 * sc:
        y = SHORE(x) + off + TR.uniform(-3, 3) * sc
        if y > 700 and x < bank_x(y) - 60 * sc:
            x += 30 * sc
            continue
        if abs(x - ROAD(y)) < 40 * sc + 10:
            x += 30 * sc
            continue
        r = TR.random()
        if r < 0.14 and d > 0.1:
            k = TR.choice([1, 1, 2, 3])
            for q in range(k):
                town.append(f'<use href="#{D.id("tr")}" transform="translate({i0(x + q * 28 * sc)} {i0(y + 8*sc + TR.uniform(-6, 6) * sc)}) scale({sc * TR.uniform(0.8, 1.25):.2f})"/>')
            x += (40 + 28 * k) * sc
            continue
        if r < 0.19:
            x += TR.uniform(20, 50) * sc
            continue
        kind = 'hA' if r < 0.64 else ('hB' if r < 0.9 else 'hC')
        flip = -1 if TR.random() < 0.5 and kind != 'hB' else 1
        town.append(f'<use href="#{D.id(kind)}" transform="translate({i0(x)} {i0(y)}) scale({sc*flip:.2f}{"" if flip == 1 else f" {sc:.2f}"})" fill="{roofcol(TR)}"/>')
        if sc > 0.62 and kind != 'hB':
            for q in range(TR.choice([1, 2])):
                cx_ = x + TR.uniform(-40, 40) * sc
                town.append(f'<use href="#{D.id("ch")}" transform="translate({i0(cx_)} {i0(y - 31 * sc)}) scale({sc * 0.85:.2f})"/>')
        elif TR.random() < 0.3:
            gx = x + TR.uniform(-38, 38) * sc
            gy = y - (27 if kind != 'hB' else 34) * sc
            g = 'gl' if TR.random() < 0.7 else 'glp'
            town.append(f'<use href="#{D.id(g)}" transform="translate({i0(gx)} {i0(gy)}) scale({(0.5 + 0.7 * sc) * TR.uniform(0.8, 1.2):.2f})"/>')
        x += (100 if kind != 'hC' else 122) * sc * TR.uniform(0.86, 1.12)
    j += 1
    yrow += 42 * sc
D.add(path(f'M440,{n(SHORE(440)+3)} ' + ' '.join(f'L{x},{n(SHORE(x)+2)}' for x in range(440, 1961, 40)), stroke='#ffffff', stroke_width='3', fill='none'))
D.add(*town)
D.d(lin_grad(D.id('haze'), [(0, ('#e8f4ff', 0.42)), (0.5, ('#e8f4ff', 0.12)), (1, ('#e8f4ff', 0))], 0, 600, 0, 800, user=True))
D.add(path(f'M440,{n(SHORE(440)-2)} ' + ' '.join(f'L{x},{n(SHORE(x)-2)}' for x in range(440, 1961, 40)) + ' L1960,820 L440,820Z', fill=D.url('haze')))
D.d(lin_grad(D.id('csh'), [(0, ('#22307a', 0)), (0.3, ('#22307a', 0.28)), (1, ('#22307a', 0.45))], 0, 860, 0, 1080, user=True))
D.add(path('M900,1100 L900,905 C1100,880 1250,930 1420,900 S1760,870 1940,890 L1940,1100Z', fill=D.url('csh'), filter=D.blur(10)))

# ------------------------------------------------------------------ prototypes: leaves, florets, hydrangea heads
D.d(f'<g id="{D.id("lf")}"><path d="M0,0 C8,-11 26,-15 46,-4 C31,9 12,10 0,0Z"/>'
    f'<path d="M0,0 C8,-11 26,-15 46,-4 C30,-3 14,-1 0,0Z" fill="#fff" opacity="0.14"/>'
    f'<path d="M3,0 Q22,-4 42,-4" fill="none" stroke="#d9f7a8" stroke-width="1.5" opacity="0.55"/></g>')

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
for i in range(58):
    a = HR.uniform(0, 2 * math.pi)
    rr = 35 * math.sqrt(HR.random())
    pts_.append((math.cos(a) * rr, math.sin(a) * rr * 0.86))
pts_.sort(key=lambda p: p[1])
fl = ''
for x, y in pts_:
    edge_ = math.hypot(x, y / 0.86) / 35
    sc_ = (1 - 0.32 * edge_) * HR.uniform(0.88, 1.08)
    lit = (x * 0.6 - y * 0.8) / 35
    kind = 'fh' if lit > 0.2 else ('fd' if lit < -0.3 else 'f')
    fl += f'<use href="#{D.id(kind)}" transform="translate({n(x)} {n(y)}) rotate({HR.randint(0, 89)}) scale({sc_:.2f})"/>'
D.d(f'<g id="{D.id("hy")}"><ellipse cx="0" cy="3" rx="43" ry="38"/><ellipse cx="0" cy="3" rx="43" ry="38" fill="#141a5c" opacity="0.5"/>{fl}</g>')
HYD = ['#6f8ff6', '#8a8cf2', '#a47ef0', '#86bdfc', '#5f78e8', '#b98cf2', '#7aa6ff']
LEAF = ['#2f8a4c', '#3a9c52', '#2a7a46', '#46ad5a']

def leaves(x, y, s, rng, k=7, up=True):
    out = ''
    for i in range(k):
        a = rng.uniform(-170, 10) if (up and rng.random() < 0.8) else rng.uniform(-10, 190)
        out += (f'<use href="#{D.id("lf")}" fill="{rng.choice(LEAF)}" transform="translate({i0(x)} {i0(y)}) rotate({i0(a)}) '
                f'scale({s * rng.uniform(0.8, 1.15):.2f} {s * rng.uniform(0.85, 1.1):.2f})"/>')
    return out

def bush(x, y, s, rng, heads=3, cols=None, w=1.0):
    out = ellipse(x, y + 10 * s, 64 * s * w, 34 * s, fill='#1f5a3a')
    out += leaves(x - 22 * s * w, y + 14 * s, s * 1.15, rng, k=3) + leaves(x + 22 * s * w, y + 14 * s, s * 1.15, rng, k=3)
    hs = sorted((y + rng.uniform(-20, 8) * s, x + rng.uniform(-46, 46) * s * w) for h in range(heads))
    for hy, hx in hs:
        out += f'<use href="#{D.id("hy")}" fill="{rng.choice(cols or HYD)}" transform="translate({i0(hx)} {i0(hy)}) scale({s * rng.uniform(0.85, 1.1):.2f})"/>'
        out += leaves(hx + rng.uniform(-10, 10) * s, hy + 30 * s, s * 0.8, rng, k=1, up=False)
    return out

# ------------------------------------------------------------------ our hillside
HILL = [(-20, 500), (150, 520), (330, 578), (500, 646), (660, 700), (820, 700)] + BANK[1:]
D.d(lin_grad(D.id('grass'), [(0, '#9ade6e'), (0.22, '#62bf5c'), (0.6, '#3f9d54'), (1, '#2c7a49')], 0, 500, 0, 1080, user=True))
D.add(path(smooth(HILL, closed=False) + ' L-20,1100Z', fill=D.url('grass')))
D.add(path('M-20,680 C300,760 700,900 1000,980 L1040,1100 L-20,1100Z', fill='#1d6644', opacity='0.3'))

# grass tufts + tiny wildflowers on our slope
GR = random.Random(12)
def on_hill(x, y):
    # inside the hill polygon and away from the steps
    for (x1, y1), (x2, y2) in zip(HILL, HILL[1:]):
        if x1 <= x <= x2:
            return y > lerp(y1, y2, (x - x1) / (x2 - x1)) + 8
    return False
tuft, tuftl, flw = '', '', ''
for i in range(200):
    x = GR.uniform(0, 1040)
    y = GR.uniform(500, 1080)
    if not on_hill(x, y):
        continue
    s_ = 0.4 + (y - 500) / 580 * 1.2
    tuft += f'M{n(x)},{n(y)}l{n(-3*s_)},{n(-9*s_)}M{n(x)},{n(y)}l{n(1*s_)},{n(-11*s_)}M{n(x)},{n(y)}l{n(4*s_)},{n(-8*s_)}'
    if GR.random() < 0.5:
        tuftl += f'M{n(x+6*s_)},{n(y-2)}l{n(-2*s_)},{n(-8*s_)}M{n(x+6*s_)},{n(y-2)}l{n(3*s_)},{n(-7*s_)}'
    if GR.random() < 0.3:
        r = 1.2 + s_ * 1.4
        flw += f'M{n(x-5)},{n(y-6)}m{n(-r)},0a{n(r)},{n(r)} 0 1 0 {n(2*r)},0a{n(r)},{n(r)} 0 1 0 {n(-2*r)},0'
D.add(path(tuft, stroke='#2f8a4a', stroke_width='1.8', stroke_linecap='round', fill='none', opacity='0.55'))
D.add(path(tuftl, stroke='#b5ec82', stroke_width='1.6', stroke_linecap='round', fill='none', opacity='0.7'))
D.add(path(flw, fill='#fffbe8', opacity='0.9'))

# stone retaining wall on the town side of the bank
WB = [(905, 748), (940, 800), (955, 880), (990, 980), (1045, 1100)]
wall_out = [(x + 34 + (y - 740) * 0.05, y + 6) for x, y in WB]
D.add(path('M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in WB + wall_out[::-1]) + 'Z', fill='#b9b4c8'))
st = ''
SRW = random.Random(3)
for (x1, y1), (x2, y2) in zip(WB, WB[1:]):
    yy = y1
    while yy < y2:
        h = SRW.uniform(14, 24)
        f = (yy - y1) / (y2 - y1)
        xa = lerp(x1, x2, f)
        st += f'M{n(xa)},{n(yy)}h{n(36 + (yy - 740) * 0.05)}'
        yy += h
D.add(path(st, stroke='#8f89a6', stroke_width='2', opacity='0.7'))
D.add(path('M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in WB), stroke='#e9e4f2', stroke_width='3', fill='none'))
BKR = random.Random(77)
for x_, y_, s_ in [(905, 742, 0.42), (935, 800, 0.5), (950, 868, 0.58), (975, 950, 0.66), (1010, 1040, 0.75)]:
    D.add(bush(x_ - 10, y_, s_, BKR, heads=2, w=1.0))

# ------------------------------------------------------------------ left hillside dressing
def foliage(cx, cy, R, rng, cols=('#1d6142', '#3c9650', '#7ccb62', '#c4ef8a'), k=7, light=(0.6, -0.8)):
    lx, ly = light
    C = []
    for i in range(k):
        a = rng.uniform(0, 2 * math.pi)
        d = R * 0.55 * math.sqrt(rng.random())
        C.append((cx + math.cos(a) * d, cy + math.sin(a) * d * 0.75, R * rng.uniform(0.32, 0.52)))
    out = f'<g fill="{cols[0]}">' + ''.join(circle(x, y, r) for x, y, r in C) + '</g>'
    out += f'<g fill="{cols[1]}">' + ''.join(circle(x + lx * r * 0.22, y + ly * r * 0.22, r * 0.78) for x, y, r in C) + '</g>'
    out += f'<g fill="{cols[2]}">' + ''.join(circle(x + lx * r * 0.45, y + ly * r * 0.45, r * 0.42) for x, y, r in C if rng.random() < 0.8) + '</g>'
    out += f'<g fill="{cols[3]}" opacity="0.8">' + ''.join(circle(x + lx * r * 0.6, y + ly * r * 0.6, r * 0.16) for x, y, r in C if rng.random() < 0.5) + '</g>'
    # edge leaves
    for i in range(int(R / 9)):
        a = rng.uniform(0, 2 * math.pi)
        x, y = cx + math.cos(a) * R * 0.85, cy + math.sin(a) * R * 0.66
        out += (f'<use href="#{D.id("lf")}" fill="{rng.choice(cols[:3])}" transform="translate({i0(x)} {i0(y)}) '
                f'rotate({i0(math.degrees(a) + rng.uniform(-30, 30))}) scale({R / 70 * rng.uniform(0.5, 0.8):.2f})"/>')
    return out

FR = random.Random(44)
# trees on the left slope (behind the step-side hydrangeas)
def tree(cx, base, h, w, rng, trunk=True):
    """Round broadleaf tree (camphor-ish) built from billows."""
    out = []
    if trunk:
        out.append(path(f'M{n(cx-w*0.07)},{n(base)} C{n(cx-w*0.05)},{n(base-h*0.3)} {n(cx-w*0.04)},{n(base-h*0.45)} {n(cx-w*0.02)},{n(base-h*0.55)} '
                        f'L{n(cx+w*0.05)},{n(base-h*0.55)} C{n(cx+w*0.05)},{n(base-h*0.4)} {n(cx+w*0.06)},{n(base-h*0.25)} {n(cx+w*0.09)},{n(base)}Z', fill='#5b3f48'))
        out.append(path(f'M{n(cx+w*0.02)},{n(base-h*0.55)} L{n(cx+w*0.05)},{n(base-h*0.55)} C{n(cx+w*0.05)},{n(base-h*0.4)} {n(cx+w*0.06)},{n(base-h*0.25)} {n(cx+w*0.09)},{n(base)} L{n(cx+w*0.05)},{n(base)}Z', fill='#8a6a6a'))
    B = []
    top = base - h
    for k, (fy, fw) in enumerate([(0.62, 0.95), (0.4, 0.8), (0.2, 0.55)]):
        yy = top + h * fy * 0.75
        B.append(billow_circles(cx + rng.uniform(-0.05, 0.05) * w, yy, w * fw * 0.5, h * 0.22, rng, bumps=9, size=(0.3, 0.5), arc=(150, 390)))
    B.reverse()
    out += canopy(D, B, rng=rng, specks=0.0)
    return out


D.add(ellipse(110, 640, 120, 18, fill='#1d6644', opacity='0.35'), ellipse(255, 640, 80, 12, fill='#1d6644', opacity='0.35'))
D.add(tree(250, 640, 190, 170, FR), tree(70, 650, 300, 260, FR))
# hydrangea plantings on the left slope
for x_, y_, s_ in [(470, 662, 0.42), (395, 650, 0.45), (318, 640, 0.48), (240, 652, 0.52), (160, 664, 0.55), (80, 676, 0.58), (5, 690, 0.6)]:
    D.add(bush(x_, y_, s_, FR, heads=3, w=1.3))

# ------------------------------------------------------------------ the steps
CL = [(300, 1160), (335, 1030), (420, 925), (560, 848), (705, 798), (812, 766), (878, 748)]
SP = Spline(CL, samples=600)
def W(t):
    return 610 * (1 - t) ** 1.35 + 40
def edge(t, side, grow=0.0):
    (x, y), (dx, dy) = SP.at(t)
    nx, ny = -dy, dx
    h = W(t) / 2 * (1 + grow)
    return (x + nx * h * side, y + ny * h * side * 0.5)
ts = [0.0]
while ts[-1] < 1:
    ts.append(ts[-1] + W(ts[-1]) * 0.08 / SP.total)
ts[-1] = 1.0
TT = [i / 60 for i in range(61)]
def band(g0, g1, side):
    A = [edge(t, side, g0) for t in TT]
    B = [edge(t, side, g1) for t in TT]
    return 'M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in A + B[::-1]) + 'Z'
# curbs (raised stone edging both sides)
D.add(path(band(0.0, 0.12, -1), fill='#9d97ad'), path(band(0.0, 0.12, 1), fill='#b3adc2'))
D.add(path(band(0.0, 0.05, -1), fill='#c9c3d3'), path(band(0.0, 0.05, 1), fill='#ddd7e3'))
SR = random.Random(9)
treads = {}
ao, nose, joints, curbj = '', '', '', ''
for i in range(len(ts) - 1):
    t0, t1 = ts[i], ts[i + 1]
    a, b = edge(t0, -1), edge(t0, 1)
    c, d_ = edge(t1, 1), edge(t1, -1)
    tone = SR.choice(['#efe7dc', '#e8dfd3', '#f2ebe2', '#e4dbcf'])
    treads.setdefault(tone, []).append(f'M{n(a[0])},{n(a[1])}L{n(b[0])},{n(b[1])}L{n(c[0])},{n(c[1])}L{n(d_[0])},{n(d_[1])}Z')
    k = 0.3
    e1 = (lerp(d_[0], a[0], k), lerp(d_[1], a[1], k))
    e2 = (lerp(c[0], b[0], k), lerp(c[1], b[1], k))
    ao += f'M{n(d_[0])},{n(d_[1])}L{n(c[0])},{n(c[1])}L{n(e2[0])},{n(e2[1])}L{n(e1[0])},{n(e1[1])}Z'
    w0 = max(1.0, W(t0) * 0.017)
    nose += f'M{n(a[0])},{n(a[1] - w0/2)}L{n(b[0])},{n(b[1] - w0/2)}L{n(b[0])},{n(b[1] + w0/2)}L{n(a[0])},{n(a[1] + w0/2)}Z'
    for q in range(SR.choice([1, 2, 2])):
        u = SR.uniform(0.2, 0.8)
        p0 = (lerp(a[0], b[0], u), lerp(a[1], b[1], u))
        p1 = (lerp(d_[0], c[0], u), lerp(d_[1], c[1], u))
        joints += f'M{n(p0[0])},{n(p0[1])}L{n(p1[0])},{n(p1[1])}'
for tone, ds in treads.items():
    D.add(path(''.join(ds), fill=tone))
D.add(path(ao, fill='#6a6294', opacity='0.5'))
D.add(path(joints, stroke='#9c94a8', stroke_width='1.3', opacity='0.5', fill='none'))
D.add(path(nose, fill='#fffbf2', opacity='0.95'))
D.d(lin_grad(D.id('stsh'), [(0, ('#4f55a8', 0.10)), (0.5, ('#4f55a8', 0.0)), (0.8, ('#4f55a8', 0.0)), (1, ('#4f55a8', 0.3))], 0, 0, 1, 0))
D.add(path('M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in [edge(t, -1) for t in TT] + [edge(t, 1) for t in TT][::-1]) + 'Z', fill=D.url('stsh')))
# a few fallen hydrangea florets and moss on the steps
mo = ''
for i in range(26):
    t = SR.random() ** 1.4 * 0.9
    side = SR.choice([-1, 1])
    p = edge(t, side, -SR.uniform(0.02, 0.1))
    r = 3 + W(t) * 0.012
    mo += f'M{n(p[0]-r)},{n(p[1])}a{n(r)},{n(r*0.6)} 0 1 0 {n(2*r)},0a{n(r)},{n(r*0.6)} 0 1 0 {n(-2*r)},0Z'
D.add(path(mo, fill='#6dbb57', opacity='0.8'))
pet = ''
for i in range(16):
    t = SR.random() ** 1.3 * 0.75
    p = edge(t, SR.uniform(-0.8, 0.8))
    pet += f'<use href="#{D.id("f")}" fill="{SR.choice(HYD)}" transform="translate({i0(p[0])} {i0(p[1])}) rotate({SR.randint(0, 89)}) scale({0.5 + W(t) * 0.0016:.2f} {0.35 + W(t) * 0.001:.2f})"/>'
D.add(pet)

# ------------------------------------------------------------------ hydrangeas along the steps (far to near)
BR = random.Random(17)
bushes = []
for side in (-1, 1):
    t = 0.0
    while t < 0.97:
        p = edge(t, side, 0.2 + BR.uniform(0, 0.1))
        s_ = 0.25 + (W(t) / 600) * 1.35
        bushes.append((p[1], p[0], s_, side, t))
        t += 0.05 + 0.13 * (1 - t) ** 1.5
bushes.sort()
for y_, x_, s_, side, t in bushes:
    D.add(bush(x_ + side * 30 * s_, y_ - 10 * s_, s_, BR, heads=3 if s_ > 0.6 else 2, w=1.2))


# stone lantern beside the steps
def lantern(x, y, s):
    return (f'<g transform="translate({n(x)} {n(y)}) scale({n(s)})">'
            f'<ellipse cx="0" cy="2" rx="34" ry="8" fill="#1d4a34" opacity="0.4"/>'
            f'<path d="M-22,0 h44 l-4,-10 h-36z" fill="#b8b2c6"/><rect x="-7" y="-58" width="14" height="48" fill="#cfc9d9"/><rect x="2" y="-58" width="5" height="48" fill="#a9a2bb"/>'
            f'<path d="M-20,-58 h40 l-4,-8 h-32z" fill="#b8b2c6"/>'
            f'<rect x="-15" y="-90" width="30" height="24" fill="#d8d2e2"/><rect x="5" y="-90" width="10" height="24" fill="#aaa3bd"/>'
            f'<rect x="-8" y="-85" width="11" height="14" fill="#ffe6a8"/><rect x="-8" y="-85" width="11" height="14" fill="#fff" opacity="0.5"/>'
            f'<path d="M-30,-88 Q0,-98 30,-88 L18,-108 Q0,-114 -18,-108Z" fill="#c9c3d6"/><path d="M0,-112 L30,-88 L18,-108Z" fill="#9e97b2"/>'
            f'<path d="M-5,-110 a5,5 0 1 1 10,0z" fill="#c9c3d6"/>'
            f'<path d="M-6,-58 h4 v48 h-4z" fill="#7fc76a" opacity="0.5"/></g>')


# ------------------------------------------------------------------ birds, sun rays, flare
birds = ''
for x_, y_, s_ in [(760, 330, 1.0), (812, 352, 0.8), (700, 372, 0.7), (1560, 520, 0.6), (1600, 506, 0.5)]:
    birds += f'M{n(x_ - 14*s_)},{n(y_)} q{n(7*s_)},{n(-8*s_)} {n(14*s_)},{n(-1*s_)} q{n(7*s_)},{n(-7*s_)} {n(14*s_)},{n(2*s_)}'
D.add(path(birds, stroke='#ffffff', stroke_width='3', fill='none', stroke_linecap='round', stroke_linejoin='round'))
D.add(path(birds, stroke='#5b6fae', stroke_width='1.2', fill='none', opacity='0.5', transform='translate(0 1.5)'))

rays = []
for a0, a1, op in [(118, 123, .16), (128, 131, .11), (137, 143, .15), (150, 153, .1), (160, 166, .12), (173, 176, .08)]:
    L = 2600
    p1 = (SUN[0] + math.cos(math.radians(a0)) * L, SUN[1] + math.sin(math.radians(a0)) * L)
    p2 = (SUN[0] + math.cos(math.radians(a1)) * L, SUN[1] + math.sin(math.radians(a1)) * L)
    rays.append(poly([SUN, p1, p2], opacity=f'{op}'))
D.d(rad_grad(D.id('rayfade'), [(0, ('#fff', 1)), (0.6, ('#fff', 0.5)), (1, ('#fff', 0))], cx=SUN[0], cy=SUN[1], r=1500, user=True))
D.d(f'<mask id="{D.id("raym")}" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><rect width="1920" height="1080" fill="{D.url("rayfade")}"/></mask>')
D.add(f'<g mask="{D.url("raym")}"><g filter="{D.blur(16)}" fill="#fff8dc">{"".join(rays)}</g></g>')
# sun core + bloom
D.d(rad_grad(D.id('sunc'), [(0, ('#ffffff', 1)), (0.18, ('#ffffff', 1)), (0.3, ('#fffbe6', 0.7)), (1, ('#fff3c8', 0))]))
D.add(circle(SUN[0], SUN[1], 150, fill=D.url('sunc')))
D.add(ellipse(SUN[0], SUN[1], 260, 3.5, fill='#ffffff', opacity='0.55', filter=D.blur(1.5)))
D.add(star4(SUN[0], SUN[1], 64, w=0.05, fill='#ffffff', opacity='0.6'))
# lens ghosts along the sun -> centre line
D.d(rad_grad(D.id('gh1'), [(0, ('#ffffff', 0)), (0.7, ('#bff0ff', 0.12)), (0.92, ('#c9b8ff', 0.18)), (1, ('#ffb8e0', 0))]))
D.d(rad_grad(D.id('gh2'), [(0, ('#fff3c0', 0.35)), (1, ('#fff3c0', 0))]))
cxm, cym = 960, 540
for k, r, g in [(0.35, 26, 'gh2'), (0.62, 60, 'gh1'), (0.8, 16, 'gh2'), (1.3, 90, 'gh1'), (1.55, 34, 'gh2')]:
    gx, gy = SUN[0] + (cxm - SUN[0]) * k, SUN[1] + (cym - SUN[1]) * k
    D.add(circle(gx, gy, r, fill=D.url(g)))

D.write(OUT)
