#!/usr/bin/env python3
"""cg/hands.svg: "What She Kept" (Chapter 4). Suzu's glass hands close over Nagi's hand;
the plum-pink bead melts between them. Side-on close-up, Suzu's face out of focus top right."""
import math, random, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from outpath import out_path
import cglib as L
from cglib import *
import suzuparts as SU
import handlab as HL

L.reset("cg-h-")
OUT = out_path('cg/hands.svg', __doc__)
W, H = 1920, 1080
rnd = random.Random(11)

PINK = "#ff5fae"
PINK_L = "#ffb8dc"
PINK_CORE = "#fff4fa"
HTF = "translate(720 590) rotate(-6) scale(1.9)"     # hands frame -> screen
BEAD_L = (112, -8)                                    # bead in the hands frame


def to_screen(x, y):
    a = math.radians(-6)
    X = x * math.cos(a) - y * math.sin(a)
    Y = x * math.sin(a) + y * math.cos(a)
    return 720 + 1.9 * X, 590 + 1.9 * Y


BEAD = to_screen(*BEAD_L)


# ------------------------------------------------------------------ background: the dark kiln-house
def background():
    s = f'<rect width="{W}" height="{H}" fill="{lin("bg", [(0, "#1c1a4e"), (.55, "#13123a"), (1, "#0a0a26")], 0, 0, 0, 1080, user=True)}"/>'
    # through the open back doors: the night garden, the cracked Glasshouse glittering (all out of focus)
    view = ""
    view += f'<rect x="40" y="-40" width="620" height="560" fill="{lin("night", [(0, "#1a1050"), (.5, "#3a2486"), (.85, "#7a3c9e"), (1, "#c060a0")], 0, -40, 0, 520, user=True)}"/>'
    rr = random.Random(9)
    view += dots([(rr.uniform(50, 650), rr.uniform(-30, 300), rr.uniform(1.2, 2.6)) for _ in range(60)], "#ffffff", .85)
    view += P("M40 470 L660 470 L660 380 L600 340 L120 340 L40 380 Z", fill="#d8c8ff", op=.25)
    view += P("M40 380 L120 340 L600 340 L660 380", stroke="#ffe8ff", sw=4, op=.8)
    for k in range(40):
        x, y = rr.uniform(60, 640), rr.uniform(330, 470)
        c = rr.choice(("#ff7fc4", "#7ab8ff", "#c69bff", "#7ff0d0", "#ffd36e"))
        view += circ(x, y, rr.uniform(4, 10), c, .8)
    view += P("M40 520 L660 520 L660 470 C560 440 440 470 340 450 C240 432 140 460 40 450 Z", fill="#3a3a9a")
    for (x, y, r, c) in ((90, 470, 40, "#6a7ae0"), (200, 486, 34, "#8a6ae0"), (420, 476, 44, "#5a8ae8"), (560, 488, 36, "#8a6ae0")):
        view += circ(x, y, r, c, .9)
    view += P("M40 -40 L40 520 M240 -40 L240 520 M440 -40 L440 520 M660 -40 L660 520", stroke="#1a1438", sw=18)
    view += P("M40 520 L660 520", stroke="#1a1438", sw=24)
    s += g(view, extra=blur(10))
    # moonlight on the tatami, the dead kiln, a few glints in the room
    s += g(P("M40 520 L660 520 L860 760 L-80 760 Z", fill="#3a3c86", op=.4)
           + P("M-80 1100 C-60 760 60 600 220 600 C380 600 500 760 520 1100 Z", fill="#241a40")
           + P("M150 1100 C150 900 180 840 230 840 C280 840 310 900 310 1100 Z", fill="#120c22"), extra=blur(14))
    cols = ["#ff7fc4", "#7ab8ff", "#a66bff", "#46d9ff", "#ffc23e", "#ff9ad0", "#7df0d0"]
    for k in range(30):
        x = rnd.uniform(0, 1000)
        y = rnd.uniform(0, 1000)
        if 500 < x < 1000 and 380 < y < 780:
            continue
        r = rnd.uniform(10, 36)
        c = rnd.choice(cols)
        s += circ(x, y, r, c, rnd.uniform(.12, .3), blur(r * .3))
    return s


# ------------------------------------------------------------------ Suzu (right), out of focus
FACE34 = ("M276 250 L276 300 C278 330 286 350 300 368 C316 390 336 406 356 410 "
          "C384 412 420 400 446 380 C464 364 474 336 474 300 L472 250 Z")


def suzu_head34():
    s = ""
    s += SU.hair_back()
    s += P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2, extra='transform="translate(8 0)"')
    s += P(FACE34, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    s += clipped(FACE34, P(SU.BANG_SHADOW, fill=SKIN_SH) + P("M474 300 C472 340 456 372 430 392 C410 404 390 410 370 412 L480 420 L480 300 Z", fill=SKIN_SH, op=.7))
    s += blush(306, E + 42, 22, 10, strong=True, hatch=False) + blush(420, E + 42, 32, 12, strong=True, hatch=False)
    # near ear
    s += P("M470 318 C484 316 490 330 486 346 C482 360 474 366 468 362", fill=SKIN, stroke=SKIN_LINE, sw=2)
    # eyes turned toward screen-left: far eye narrow, near eye full; lit pink, brimming
    cen = ((312, E), (404, E))
    s += eyes("tears", lambda cx, cy, rx, ry: glass_iris(cx, cy, rx, ry, "#ff6fb8"), SU.LASH, centers=cen, sx=(.7, 1.0),
              gaze=(-6, 2), big=1.05, wet=True, pool=True)
    s += P(f"M348 {E+30} C346 {E+34} 342 {E+38} 340 {E+40}", stroke=NOSE, sw=1.8)
    s += P("M332 392 C340 396 352 396 360 392", stroke=MOUTH_LINE, sw=2.2)
    # tears
    s += tear_stream("M396 354 C394 364 396 374 393 384 C390 394 395 402 401 400 C407 398 406 390 404 382 C401 372 400 363 399 354 Z")
    s += tear_stream("M306 350 C305 360 306 368 304 376 C302 384 306 390 310 388 C314 386 313 380 312 374 C310 366 309 358 309 350 Z")
    s += tear_drop(400, 414, 1.1)
    s += SU.crown()
    s += SU.comb()
    s += SU.locks()
    s += brow_pair("M304 277 C318 276 334 270 348 259 C351 257 353 260 351 262 C337 274 322 282 306 282 C303 282 302 279 304 277 Z",
                   SU.BROW, centers=cen, sx=(.7, 1.0))
    s += SU.pins(SU.PINS_FRONT, glow=True)
    return s


def suzu_body():
    s = ""
    # kimono (white with bellflowers), leaning toward Nagi, glass at the throat
    body = "M1270 1100 C1250 900 1256 660 1296 480 C1326 370 1380 300 1440 270 C1520 262 1600 270 1680 296 C1790 330 1890 400 1960 470 L1960 1100 Z"
    sg = lin("kimono", [(0, "#ffffff"), (.6, "#eef0fd"), (1, "#c9d4ff")], 0, 280, 0, 1080, user=True)
    s += P(body, fill=sg, stroke="#6d6a9e", sw=3.4)
    pat = ""
    rr = random.Random(5)
    for k in range(16):
        pat += bellflower(rr.uniform(1300, 1920), rr.uniform(420, 1060), rr.uniform(1.6, 2.2), rr.uniform(-20, 20))
    for k in range(5):
        pat += kikyo(rr.uniform(1320, 1900), rr.uniform(460, 1040), rr.uniform(1.6, 2.1), rr.uniform(0, 60))
    s += clipped(body, pat + P("M1270 300 C1300 500 1290 800 1300 1100 L1240 1100 L1240 300 Z", fill="#dfdef2"))
    # collar V with lilac han-eri, the glass collar
    s += P("M1440 290 C1480 360 1520 420 1560 470 L1600 440 C1570 400 1540 350 1520 290 Z", fill="#cdb8f4", stroke="#6d6a9e", sw=2.6)
    s += P("M1400 250 C1440 268 1500 270 1540 256 L1560 300 C1510 320 1440 318 1390 296 Z", fill="#f3eeff", op=.6)
    s += P("M1396 262 C1440 280 1500 282 1544 268", stroke="#ffffff", sw=4, op=.9)
    s += P("M1394 292 C1440 312 1500 314 1556 296", stroke=rainbow(), sw=3, op=.9)
    # long plum lock falling in front of her shoulder
    s += P("M1300 200 C1270 300 1262 420 1280 520 C1290 580 1276 640 1290 700 L1312 700 C1300 640 1314 580 1304 520 C1290 420 1300 300 1330 200 Z",
           fill=SU.lock_grad(), stroke=SU.HAIR_LINE, sw=2.6)
    s += g(suzu_head34(), place(1440, 112, 1.55, -4))
    s += ell(1400, 360, 200, 160, PINK, .18, extra=blur(40))
    return g(s, extra=blur(4))


def bellflower(x, y, s, rot=0):
    body = ("M-9 2 C-10 10 -11 18 -15 26 L-10 24 L-5 28 L0 25 L5 28 L10 24 L15 26 "
            "C11 18 10 10 9 2 C5 -2 -5 -2 -9 2 Z")
    c = P(body, fill=lin("bell", [(0, "#a7baff"), (.45, "#5b7cf0"), (1, "#3442b0")], 0, 0, 1, 1), stroke="#3747b4", sw=1.3)
    c += P("M-5 4 C-6 11 -7 17 -10 23", stroke="#ffffff", sw=1.4, op=.75)
    c += P("M-4 0 C-2 -4 2 -4 4 0 L2 3 L0 1 L-2 3 Z", fill="#6f9ad8", stroke="#3d5aa0", sw=.9)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


def kikyo(x, y, s, rot=0):
    pet = "M0 0 C-6 -6 -7 -16 0 -22 C7 -16 6 -6 0 0 Z"
    st = rad("star", [(0, "#3a3fb0"), (.35, "#5b7cf0"), (1, "#a3b6ff")])
    c = ""
    for k in range(5):
        c += f'<path d="{pet}" transform="rotate({k*72})" fill="{st}" stroke="#3747b4" stroke-width="1.2" stroke-linejoin="round"/>'
    c += circ(0, 0, 3.2, "#ffffff") + circ(0, 0, 1.4, "#ffe08a")
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


def suzu_sleeves():
    """Long kimono sleeves: the cloth wraps the forearm from the opening and hangs in a soft drape."""
    s = ""
    sg = lin("sleeve", [(0, "#ffffff"), (.55, "#eef0fd"), (1, "#c9d4ff")], 0, 240, 0, 1080, user=True)
    lining = lin("lining", [(0, "#5b4296"), (.6, "#8a6fd0"), (1, "#c3b0f2")], 0, 0, 1, 1)
    specs = (
        ((1440, 344), (22, 62), 10,
         "M1428 286 C1520 272 1640 252 1960 214 L1960 452 C1880 486 1800 512 1720 516 C1640 520 1566 500 1510 466 "
         "C1478 446 1454 424 1442 402 Z",
         ["M1500 300 C1560 380 1640 440 1760 480", "M1620 280 C1680 340 1760 400 1880 440"]),
        ((1452, 688), (22, 60), 6,
         "M1442 630 C1540 622 1700 616 1960 612 L1960 1100 L1580 1100 C1540 960 1500 840 1458 748 Z",
         ["M1520 700 C1560 820 1600 960 1640 1100", "M1640 680 C1680 800 1730 940 1780 1100"]),
    )
    for (c, r, rot, drape, folds) in specs:
        sl = P(drape, fill=sg, stroke="#6d6a9e", sw=3.4)
        rr = random.Random(c[0])
        pat = "".join(bellflower(rr.uniform(c[0] + 60, 1900), rr.uniform(c[1] - 40, c[1] + 380), rr.uniform(1.6, 2.1), rr.uniform(-15, 15)) for _ in range(7))
        pat += kikyo(rr.uniform(c[0] + 120, 1860), rr.uniform(c[1] + 40, c[1] + 300), 1.8, 20)
        pat += "".join(P(f, stroke="#b8bce0", sw=3, op=.7) for f in folds)
        pat += P(f"M{c[0]} {c[1] + 40} C{c[0] + 60} {c[1] + 120} {c[0] + 160} {c[1] + 170} {c[0] + 300} {c[1] + 190} L{c[0] + 300} {c[1] + 800} L{c[0] - 40} {c[1] + 800} Z", fill="#dcdcf2", op=.7)
        sl += clipped(drape, pat)
        sl += ell(c[0], c[1], r[0], r[1], lining, rot=rot, extra='stroke="#6d6a9e" stroke-width="3"')
        sl += ell(c[0] + 6, c[1] + 2, r[0] * .6, r[1] * .82, "#2a1c5a", .55, rot=rot)
        s += g(sl, extra=blur(1.6))
    return s


def glass_forearm(x0, y0, x1, y1, w0, w1, threads, bow=8):
    """Clear glass forearm from the wrist (x0, y0) into the sleeve opening (x1, y1), screen coords."""
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2 + bow
    pts = [(x0, y0, w0), (x0 * .75 + x1 * .25, y0 * .75 + y1 * .25 + bow * .7, w0 * .86 + w1 * .14 - 6),
           (mx, my, (w0 + w1) / 2), (x1, y1, w1)]
    d = tube(pts, cap=False)
    inner = f'<rect width="{W}" height="{H}" fill="#f4f0ff" opacity=".16"/>'
    inner += P(d, stroke="#4a5aa8", sw=14, op=.16, extra=blur(4))
    inner += circ(x0, y0, 140, PINK, .4, blur(30))
    for c, k, t in threads:
        inner += P(t, stroke=c, sw=14, op=.55, extra=blur(4)) + P(t, stroke=k, sw=3, op=.95)
    s = clipped(d, inner)
    Lp, Rp = tube_sides(pts)
    s += P(smooth(Lp), stroke=GLASS_LINE, sw=5) + P(smooth(Rp), stroke=GLASS_LINE, sw=5)
    Li, Ri = tube_sides([(x, y, w * .8) for x, y, w in pts])
    s += P(smooth(Li[:3]), stroke="#ffffff", sw=4, op=.9) + P(smooth(Ri), stroke=rainbow(), sw=4, op=.85)
    s += sparkle(Li[1][0] + 10, Li[1][1] + 8, 12)
    return s


# ------------------------------------------------------------------ Nagi's arm (left)
def nagi_arm():
    s = ""
    # forearm in the indigo samue sleeve, white shirt cuff at the wrist (hands frame)
    slv = "M-70 -44 C-160 -40 -300 -10 -460 40 L-460 170 C-300 110 -170 70 -72 52 Z"
    s += P(slv, fill=lin("nagiSleeve", [(0, "#3a4690"), (1, "#222b5e")], 0, -40, 0, 170, user=True), stroke="#151a3e", sw=3)
    s += P("M-90 -34 C-200 -24 -320 4 -460 52", stroke="#5868b0", sw=3, op=.7)
    s += P("M-100 40 C-220 64 -340 100 -460 140", stroke="#151a3e", sw=2, op=.5)
    cuff = "M-74 -46 C-60 -46 -48 -44 -38 -42 L-38 46 C-48 48 -60 50 -74 52 C-80 20 -80 -16 -74 -46 Z"
    s += P(cuff, fill="#fbfbff", stroke="#6d6a9e", sw=2.6)
    s += P("M-66 -40 C-70 -10 -70 20 -66 46", stroke="#dfe3f2", sw=4)
    return s


# ------------------------------------------------------------------ light
def bead_glow_under():
    x, y = BEAD
    s = circ(x, y, 420, PINK, .2, blur(70))
    s += circ(x, y, 230, "#ff7fc4", .42, blur(40))
    s += circ(x, y, 110, PINK_L, .75, blur(22))
    return s


def bead():
    x, y = BEAD_L
    s = ""
    s += circ(x, y, 34, PINK_CORE, .9, blur(8))
    s += circ(x, y, 15, rad("plum", [(0, "#ffffff"), (.35, "#ffd0ea"), (.8, "#ff5fae"), (1, "#c0307a")], .4, .36, .7),
              extra='stroke="#a02868" stroke-width="1.4"')
    # melting: a glossy drip pooling in the palm
    s += P(f"M{x-14} {y+6} C{x-20} {y+16} {x-8} {y+22} {x+2} {y+20} C{x+14} {y+24} {x+22} {y+16} {x+14} {y+6}", fill="#ff7fc4", op=.75)
    s += ell(x - 5, y - 6, 5, 3.4, "#ffffff", rot=-30)
    return s


def bloom():
    """Light leaking out between the glass fingers, over everything; brightest at the bead."""
    x, y = BEAD
    s = ""
    s += circ(x, y, 120, "#ff9ad0", .45, blur(26))
    s += circ(x, y, 52, PINK_CORE, .85, blur(12))
    s += circ(x, y, 20, "#ffffff", .95, blur(4))
    for (dx, dy, rx, ry, rot) in ((-60, -40, 70, 14, -24), (-70, 26, 64, 12, 14), (-14, -78, 54, 12, -70)):
        s += ell(x + dx, y + dy, rx, ry, "#ffe6f4", .45, rot, blur(8))
    for k in range(14):
        a = 2 * math.pi * k / 14 + .2
        ln = 260 + 140 * (k % 3)
        x2, y2 = x + math.cos(a) * ln, y + math.sin(a) * ln * .8
        s += P(f"M{F(x)} {F(y)} L{F(x2)} {F(y2)}", stroke="#ffd6ec", sw=12 + 8 * (k % 2), op=.14, extra=blur(8))
    s += sparkle(x, y, 34, "#ffffff") + sparkle(x, y, 18, "#ffffff", rot=45)
    return s


def nagi_threads():
    """Threads of pink light running from the bead into Nagi's fingers (hands frame), inside her skin."""
    parts = [HL.NAGI_PALM] + [tube(finger_line((b[0] - 14, b[1]), (90,) + a, (14,) + l, (w[0],) + w)) for (b, a, l, w) in HL.NAGI_F]
    inner = ""
    for (b, a, l, w) in HL.NAGI_F:
        pts = finger_line((b[0] - 14, b[1]), (90,) + a, (14,) + l, (w[0],) + w)
        cl = [(BEAD_L[0], BEAD_L[1])] + [(x, y) for x, y, _ in pts[1:-1]]
        d = smooth(cl)
        inner += P(d, stroke=PINK, sw=8, op=.5, extra=blur(3)) + P(d, stroke="#ffe8f4", sw=1.6, op=.85)
    c, at = clip(parts)
    return c + g(inner, extra=at)


def nagi_pinklight():
    """The bead's light on Nagi's skin (hands frame), clipped to her hand."""
    parts = [HL.NAGI_PALM] + [tube(finger_line((b[0] - 14, b[1]), (90,) + a, (14,) + l, (w[0],) + w)) for (b, a, l, w) in HL.NAGI_F]
    parts.append(tube(finger_line(*HL.NAGI_T)))
    gl = rad("skinGlow", [(0, "#ff8ac8", .75), (.45, "#ff8ac8", .35), (1, "#ff8ac8", 0)], BEAD_L[0], BEAD_L[1], 230, user=True)
    c, a = clip(parts)
    return c + g(f'<rect x="-100" y="-200" width="500" height="400" fill="{gl}"/>', extra=a)


def motes():
    s = ""
    x0, y0 = BEAD
    for k in range(80):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(80, 620)
        x, y = x0 + math.cos(a) * r * 1.4, y0 + math.sin(a) * r * .8
        rr = rnd.uniform(1.5, 4.5)
        s += circ(x, y, rr * 2.4, PINK, .35, blur(2)) + circ(x, y, rr, "#fff2fa", .9)
    for (x, y, r) in ((x0 - 160, y0 - 70, 20), (x0 + 120, y0 - 120, 14), (x0 - 30, y0 - 150, 10), (x0 + 200, y0 + 40, 12), (x0 - 240, y0 + 60, 10)):
        s += sparkle(x, y, r, "#fff")
    return s


def glass_glow():
    """Pink light flooding the glass near the bead (hands frame)."""
    x, y = BEAD_L
    return circ(x + 40, y - 30, 130, PINK, .5, blur(30)) + circ(x, y, 60, "#ffd6ec", .7, blur(14))


def build():
    s = background()
    s += suzu_body()
    s += bead_glow_under()
    s += suzu_sleeves()
    # glass forearms between the hands and the sleeve openings (screen coords)
    w_top = to_screen(340, -86)
    w_bot = to_screen(344, 82)
    s += glass_forearm(w_top[0] - 10, w_top[1], 1446, 344, 112, 118,
                       [(PINK, "#ffe0f0", f"M{F(w_top[0]-20)} {F(w_top[1]+10)} C1380 360 1420 350 1450 346"),
                        ("#c06bff", "#f0dcff", f"M{F(w_top[0]-20)} {F(w_top[1]-26)} C1380 334 1420 326 1450 322")])
    s += glass_forearm(w_bot[0] - 10, w_bot[1], 1458, 688, 118, 116,
                       [(PINK, "#ffe0f0", f"M{F(w_bot[0]-20)} {F(w_bot[1])} C1410 690 1440 690 1460 690")])
    hands = ""
    hands += HL.glass_parts(HL.suzu_bot_parts(), glow=glass_glow(),
                            threads=[(PINK, "#ffe0f0", "M150 60 C220 66 280 72 350 80"), ("#46d9ff", "#e0fbff", "M160 86 C230 90 290 96 350 100")])
    hands += nagi_arm()
    hands += HL.skin_hand(HL.NAGI_PALM, HL.NAGI_F, HL.NAGI_T)
    hands += nagi_pinklight()
    hands += nagi_threads()
    hands += bead()
    hands += HL.glass_parts(HL.suzu_top_parts(), glow=glass_glow(),
                            threads=[(PINK, "#ffe0f0", "M90 -40 C140 -50 200 -66 260 -84 C300 -96 330 -104 360 -110"),
                                     ("#c06bff", "#f0dcff", "M100 -62 C150 -76 210 -92 270 -104 C310 -112 340 -118 360 -122"),
                                     (PINK, "#ffe0f0", "M80 -20 C130 -28 190 -40 250 -50 C300 -58 330 -62 360 -64")])
    hands += HL.suzu_top_details()
    s += g(hands, HTF)
    s += bloom()
    s += motes()
    return s


if __name__ == "__main__":
    b = build()
    n = L.write(OUT, b)
    print(OUT, n)
