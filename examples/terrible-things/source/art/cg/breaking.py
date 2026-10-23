#!/usr/bin/env python3
"""cg/breaking.svg: "All the Terrible Things" (true ending). Suzu, almost all glass, breaks into
light and beads; Hinata and Nagi hold her hands; the chain of hands runs to the gate and down the hill."""
import math, random, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
sys.dont_write_bytecode = True   # keep lib/ free of __pycache__
from outpath import out_path
import cglib as L
from cglib import *
import suzuparts as SU
import cast as C
import cast34 as T
import figlab as FL

L.reset("cg-b-")
OUT = out_path('cg/breaking.svg', __doc__)
W, H = 1920, 1080
rnd = random.Random(23)

GOLD = "#ffd36e"
AMBER = "#ffb02e"
ROSE = "#ff7fc4"
BEADS = ["#ff4d6d", "#3f6dff", "#2fc59a", "#ffc23e", "#a66bff", "#ff7fc4", "#46d9ff", "#ff9a3c", "#7df0d0", "#e0559a", "#ffb02e"]

SU_T = place(960, 470, .92)
HI_T = place(650, 492, .96)
NA_T = place(1270, 500, .92, flip=True)
NE_T = place(1540, 396, .76, flip=True)
MA_P = (1680, 556, .58)
MY_P = (1834, 452, .66)
MA_T = place(*MA_P, flip=True)
MY_T = place(*MY_P, flip=True)


def tp(p, x, y):
    """head-local (x, y) of a mirrored figure placed at p = (x0, y0, s) -> screen."""
    return p[0] - p[2] * (x - 380), p[1] + p[2] * (y - 330)
CLASP_L = (806, 716)
CLASP_R = (1114, 716)
CLASP_N = (1450, 712)
CLASP_M1 = (1594, 712)
CLASP_M2 = (1770, 707)


def limb(x0, y0, x1, y1, w0, w1, fill, line, sw=2.4):
    ang = math.degrees(math.atan2(x1 - x0, -(y1 - y0)))
    ln = math.hypot(x1 - x0, y1 - y0)
    d, _, _ = capsule(x0, y0, ang, ln, w0, w1, bulge=.08)
    return P(d, fill=fill, stroke=line, sw=sw), d


def rim(d, col=GOLD, sw=6, op=.55):
    return P(d, stroke=col, sw=sw, op=op, extra=blur(2.5))


# ------------------------------------------------------------------ sky, sea, town, garden
def sky():
    s = f'<rect width="{W}" height="{H}" fill="{lin("sky", [(0, "#120a36"), (.35, "#2a1866"), (.62, "#55308e"), (.82, "#8a4c9e"), (1, "#c070a0")], 0, 0, 0, 530, user=True)}"/>'
    st1 = [(rnd.uniform(0, W), rnd.uniform(0, 480), rnd.choice((.9, 1.1, 1.4, 1.8))) for _ in range(120)]
    s += dots(st1[:80], "#ffffff", .9) + dots(st1[80:], "#ffffff", .55)
    for (x, y, r) in ((180, 80, 9), (420, 160, 7), (1500, 60, 10), (1760, 200, 8), (300, 300, 6), (1640, 330, 6)):
        s += sparkle(x, y, r, "#fff6e0", .9)
    s += circ(960, 340, 560, GOLD, .2, blur(90))
    return s


def sea_and_town():
    s = ""
    hy = 520
    s += f'<rect x="0" y="{hy}" width="{W}" height="140" fill="{lin("sea", [(0, "#7a4496"), (1, "#2a1a5e")], 0, hy, 0, hy + 100, user=True)}"/>'
    gl = ""
    for k in range(34):
        x = rnd.uniform(0, W)
        y = rnd.uniform(hy + 6, hy + 50)
        w = rnd.uniform(20, 70)
        gl += f'<path d="M{F(x)} {F(y)} L{F(x + w)} {F(y)}" opacity="{F(rnd.uniform(.25, .6))}"/>'
    s += g(gl, extra='stroke="#ffd6a0" stroke-width="1.6"')
    s += ell(960, hy + 10, 300, 18, GOLD, .45, extra=blur(10))
    s += P(f"M1120 {hy+40} C1300 {hy-10} 1480 {hy-46} 1640 {hy-44} C1760 {hy-40} 1860 {hy-70} 1960 {hy-60} L1960 700 L1120 700 Z", fill="#2a1a52")
    rr = random.Random(4)
    tl = [(rr.uniform(1160, 1920), rr.uniform(hy - 36, hy + 40), rr.uniform(1.6, 3), rr.choice(("#ffd98a", "#ffb86a", "#ffe6b0"))) for k in range(48)]
    s += bead_field(tl, hl=False)
    path = [(1880, 560), (1770, 548), (1850, 530), (1700, 520), (1800, 506), (1620, 500), (1500, 506), (1380, 520), (1250, 534)]
    ln = []
    for i in range(len(path) - 1):
        (x0, y0), (x1, y1) = path[i], path[i + 1]
        n = int(math.hypot(x1 - x0, y1 - y0) / 10)
        for k in range(n):
            t = k / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            sz = 3.4 - i * .22
            ln.append((x, y, sz))
    s += dots([(x, y, r * 2.6) for x, y, r in ln], AMBER, .45, blur(1.5)) + dots(ln, "#fff4d0")
    return s


def glasshouse():
    s = ""
    gh = "M90 522 L540 522 L540 474 L500 434 L130 434 L90 474 Z"
    s += P(gh, fill="#d8c8ff", op=.22) + P(gh, stroke="#e8e0ff", sw=2, op=.8)
    rib = "".join(f"M{110 + k*48} 522 L{110 + k*48} 450 " for k in range(10))
    s += P(rib, stroke="#e8e0ff", sw=1.3, op=.45)
    s += P("M130 434 L500 434", stroke="#ffffff", sw=2, op=.7)
    s += ell(320, 476, 260, 70, ROSE, .3, extra=blur(26))
    return s


def statue(x, y, s):
    body = ("M0 -150 C-14 -150 -22 -138 -22 -124 C-22 -110 -14 -100 0 -100 C14 -100 22 -110 22 -124 C22 -138 14 -150 0 -150 Z "
            "M-18 -96 C-34 -90 -40 -70 -42 -50 L-70 -20 L-60 -12 L-36 -32 C-34 0 -36 60 -40 120 L40 120 C36 60 34 0 36 -32 "
            "L60 -12 L70 -20 L42 -50 C40 -70 34 -90 18 -96 Z")
    c = P(body, fill="#e8e4ff", op=.16) + P(body, stroke="#c8d0ff", sw=2, op=.7)
    c += P("M-10 -140 C-16 -130 -16 -116 -8 -108", stroke="#ffffff", sw=2.4, op=.8)
    c += P("M-30 -40 C-32 0 -34 60 -36 110", stroke=rainbow(), sw=2, op=.6)
    c += P("M-6 -90 C-10 -40 6 0 -4 60", stroke=ROSE, sw=4, op=.4, extra=blur(2))
    return g(c, f"translate({F(x)} {F(y)}) scale({F(s)})")


def garden():
    s = ""
    s += P("M-20 556 L1960 556 L1960 626 L-20 626 Z", fill="#3e3270")
    s += P("M-20 556 L1960 556", stroke="#8a78c8", sw=3, op=.8)
    bricks = "".join(f"M{k*80 + (20 if k % 2 else 0)} 558 L{k*80 + (20 if k % 2 else 0)} 592 M{k*80 + 60} 592 L{k*80 + 60} 626 " for k in range(25))
    s += P(bricks + "M-20 592 L1960 592", stroke="#2a2058", sw=2, op=.7)
    s += f'<rect x="0" y="622" width="{W}" height="458" fill="{lin("ground", [(0, "#2c2462"), (1, "#1a1440")], 0, 622, 0, 1080, user=True)}"/>'
    s += ell(960, 800, 780, 210, GOLD, .26, extra=blur(40))
    return s


def gate():
    s = ""
    s += P("M1872 380 L1898 380 L1898 640 L1872 640 Z", fill="#4a2e2a", stroke="#24140f", sw=2.4)
    s += P("M1830 370 L1960 360 L1960 384 L1836 392 Z", fill="#3a2420", stroke="#24140f", sw=2.4)
    s += P("M1820 360 L1960 344", stroke="#6a4a3a", sw=6)
    s += rim("M1872 384 L1872 640", AMBER, 4, .5)
    return s


def hydrangea(x, y, r, col, col2, seed=0):
    rr = random.Random(seed)
    s = circ(x, y, r, col)
    fl = ""
    for k in range(9):
        a = rr.uniform(0, 2 * math.pi)
        d = r * math.sqrt(rr.uniform(0, 1)) * .8
        fx, fy = x + math.cos(a) * d, y + math.sin(a) * d
        fr = rr.uniform(r * .14, r * .22)
        fl += f"M{F(fx)} {F(fy - fr)} L{F(fx + fr)} {F(fy)} L{F(fx)} {F(fy + fr)} L{F(fx - fr)} {F(fy)} Z "
    s += P(fl, fill=col2, op=.55)
    s += ell(x - r * .35, y - r * .4, r * .4, r * .25, "#ffffff", .22)
    return s


def hydrangeas():
    s = ""
    rr = random.Random(8)
    for k in range(14):
        x = rr.uniform(-20, 1940)
        if 560 < x < 1360:
            continue
        s += hydrangea(x, rr.uniform(600, 650), rr.uniform(26, 38), rr.choice(("#6a7ae0", "#8a6ae0", "#5a8ae8")), "#d8e0ff", k)
    return s


def fg_hydrangeas():
    s = ""
    for (x, y, r, c) in ((40, 1040, 90, "#3a3a92"), (180, 1080, 70, "#4a3a9a"), (1880, 1030, 96, "#40388e"), (1740, 1090, 70, "#38469a")):
        s += hydrangea(x, y, r, c, "#8a96e0", int(x))
    return g(s, extra=f'opacity=".85" {blur(4)}')


# ------------------------------------------------------------------ Suzu: kneeling, almost all glass, breaking into light
def suzu_head():
    s = ""
    s += SU.hair_back()
    s += SU.face()
    s += blush(318, E + 42, 30, 11, strong=True, hatch=False) + blush(442, E + 42, 30, 11, strong=True, hatch=False)
    s += SU.glass_eyes("soft", gaze=-2, big=1.08, wet=True, pool=True)
    st_l = ("M317 352 C315 362 317 372 314 382 C311 392 316 400 322 398 C328 396 327 388 325 380 "
            "C322 370 321 361 320 352 Z")
    for d in (st_l, mir(st_l)):
        s += tear_stream(d)
    s += tear_drop(322, 410, 1.1) + tear_drop(440, 404, .9)
    mouth = "M358 382 C368 388 392 388 402 382 C400 394 392 400 380 400 C368 400 360 394 358 382 Z"
    s += mouth_open(mouth, tongue="M366 396 C372 391 388 391 394 396 L394 404 L366 404 Z")
    s += P("M354 380 C356 381 357 382 359 383", stroke=MOUTH_LINE, sw=1.6)
    s += P("M401 383 C403 382 404 381 406 380", stroke=MOUTH_LINE, sw=1.6)
    s += SU.crown()
    s += SU.comb()
    s += SU.locks()
    s += SU.brows("M304 276 C316 272 332 270 350 272 C352 274 350 276 348 275 C332 274 318 276 306 280 C304 281 303 278 304 276 Z")
    return s


def suzu_updo():
    """Updo and pins, fading upward into light (decorative mask fade)."""
    mid = I("updoFade")
    fade = lin("updoFadeG", [(0, "#fff", 0), (.45, "#fff", .25), (1, "#fff", 1)], 0, 60, 0, 230, user=True)
    L.add_def("updoFade", f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="760" height="600">'
                          f'<rect width="760" height="600" fill="{fade}"/></mask>')
    s = g(SU.updo() + SU.tegara(), extra=f'mask="url(#{mid})"')
    s += ell(380, 150, 220, 120, "#fff2d0", .5, extra=blur(24))
    s += ell(380, 130, 110, 70, "#ffffff", .55, extra=blur(14))
    for (x, y, a, col) in ((250, 120, -150, "#ff4d6d"), (300, 70, -120, "#ffc23e"), (460, 70, -60, "#2fc59a"), (520, 120, -30, "#3f6dff"),
                           (380, 40, -95, "#ff7fc4")):
        s += SU.pin(x, y, a, 40, col, "ball", glow=True)
    return s


SU_SKIRT = ("M300 640 C268 690 236 760 220 840 C210 900 208 960 214 1000 L546 1000 C552 960 550 900 540 840 "
            "C524 760 492 690 460 640 Z")
SU_TORSO = ("M352 470 C320 476 298 490 288 512 C278 536 276 574 278 640 L482 640 C484 574 482 536 472 512 "
            "C462 490 440 476 408 470 Z")


def bell_at(flip, x, y, s, rot=0):
    X = 760 - x if flip else x
    body = ("M-9 2 C-10 10 -11 18 -15 26 L-10 24 L-5 28 L0 25 L5 28 L10 24 L15 26 "
            "C11 18 10 10 9 2 C5 -2 -5 -2 -9 2 Z")
    c = P(body, fill=lin("bell", [(0, "#a7baff"), (.45, "#5b7cf0"), (1, "#3442b0")], 0, 0, 1, 1), stroke="#3747b4", sw=1.3)
    c += P("M-5 4 C-6 11 -7 17 -10 23", stroke="#ffffff", sw=1.4, op=.75)
    symbol("bell", c)
    return use("bell", f"translate({F(X)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


def heart(x, y):
    s = circ(x, y, 100, "#ff3a5a", .35, blur(26))
    rr = random.Random(2)
    for k in range(26):
        a = rr.uniform(0, 2 * math.pi)
        d = rr.uniform(0, 36)
        s += bead(x + math.cos(a) * d * 1.2, y + math.sin(a) * d * .8, rr.uniform(6, 9),
                  rr.choice(("#e0559a", "#ff4d6d", "#a66bff", "#ff7fc4")), glow=False)
    s += circ(x, y, 34, "#ffd6e0", .55, blur(10))
    return s


def suzu_body():
    s = ""
    kim = lin("kimono", [(0, "#ffffff"), (.5, "#f6f4ff"), (1, "#dfe2ff")], 0, 470, 0, 1000, user=True)
    for side in (0, 1):
        m = (lambda d: d) if side == 0 else mir
        sl = m("M290 520 C260 540 240 580 228 630 C214 690 206 760 206 840 C206 880 214 910 230 930 L300 930 "
               "C292 880 290 820 296 760 C302 710 310 670 318 640 Z")
        s += P(sl, fill=kim, stroke="#6d6a9e", sw=3)
        s += clipped(sl, P(m("M290 600 C280 700 280 820 296 930 L330 930 L330 560 Z"), fill="#dfdef2")
                     + bell_at(side == 1, 250, 760, 1.2) + bell_at(side == 1, 262, 860, 1.2))
    s += P(SU_SKIRT, fill=kim, stroke="#6d6a9e", sw=3)
    pat = "".join(bell_at(False, x, y, 1.3, r) for (x, y, r) in ((262, 780, 8), (330, 900, -6), (430, 820, 10), (500, 930, -10), (380, 960, 4)))
    s += clipped(SU_SKIRT, pat + P("M460 640 C500 720 530 840 540 1000 L580 1000 L580 640 Z", fill="#dfdef2"))
    s += P(SU_TORSO, fill=kim, stroke="#6d6a9e", sw=3)
    s += P(NECK, fill="#f3eeff", op=.6)
    s += P(NECK, stroke=GLASS_LINE, sw=2)
    v = "M344 470 L416 470 C410 520 398 560 380 600 C362 560 350 520 344 470 Z"
    s += P(v, fill="#f3eeff", op=.55)
    s += clipped(v, glass_threads([(ROSE, "#ffe0f0", "M366 474 C356 510 384 530 374 570"), (GOLD, "#fff6d8", "M398 474 C408 504 388 530 394 560")], 6, 1.6)
                 + circ(380, 548, 26, "#ff5a7a", .55, blur(8)))
    s += P("M346 478 C362 490 398 490 414 478", stroke="#ffffff", sw=3, op=.95)
    s += P(v, stroke=rainbow(), sw=2, op=.8)
    he = "M336 470 L354 470 C362 514 372 554 382 590 L374 602 C360 560 346 516 336 470 Z"
    s += P(he, fill="#cdb8f4", stroke="#6d6a9e", sw=1.8) + P(mir(he), fill="#cdb8f4", stroke="#6d6a9e", sw=1.8)
    obi = "M278 604 C330 614 430 614 482 604 L484 664 C430 676 330 676 276 664 Z"
    s += P(obi, fill=lin("obi", [(0, "#e0d2fb"), (1, "#a990e2")]), stroke="#5e4a9a", sw=2.6)
    cord = "M276 636 C330 646 430 646 484 636"
    s += P(cord, stroke="#5e1f52", sw=6) + P(cord, stroke="#a24a8e", sw=3.6)
    s += circ(380, 644, 9, "#f5f0ff", .6) + circ(380, 644, 9, "none", extra=f'stroke="{GLASS_LINE}" stroke-width="1.6"')
    s += heart(380, 740)
    return s


def suzu_arms():
    s = ""
    kim = lin("kimono", [(0, "#ffffff"), (.5, "#f6f4ff"), (1, "#dfe2ff")], 0, 470, 0, 1000, user=True)
    lining = lin("lining", [(0, "#5b4296"), (.6, "#8a6fd0"), (1, "#c3b0f2")], 0, 0, 1, 1)
    for side in (0, 1):
        m = (lambda d: d) if side == 0 else mir
        X = (lambda x: x) if side == 0 else (lambda x: 760 - x)
        a, apts = FL.arm((X(300), 500), (X(262), 586), (X(214), 616), (56, 50, 44))
        s += P(a, fill=kim, stroke="#6d6a9e", sw=2.8)
        s += P(m("M292 520 C276 546 266 570 262 586"), stroke="#dfdef2", sw=8, op=.8)
        s += ell(X(212), 616, 13, 24, lining, rot=(60 if side == 0 else -60), extra='stroke="#6d6a9e" stroke-width="2.2"')
    return s


def suzu_rim():
    s = ell(960, 600, 220, 330, GOLD, .3, extra=blur(40))
    s += ell(960, 440, 130, 160, "#fff2d0", .3, extra=blur(30))
    return s


def suzu_glow():
    """Her glass body shining through the kimono: threads of light, a bright rim, sparks lifting off (head-local)."""
    sil = [SU_SKIRT, SU_TORSO]
    for side in (0, 1):
        m = (lambda d: d) if side == 0 else mir
        sil.append(m("M290 520 C260 540 240 580 228 630 C214 690 206 760 206 840 C206 880 214 910 230 930 L300 930 "
                     "C292 880 290 820 296 760 C302 710 310 670 318 640 Z"))
    inner = ""
    rr = random.Random(31)
    for k in range(9):
        x0 = rr.uniform(240, 520)
        d = f"M{F(x0)} 1000 C{F(x0 + rr.uniform(-60, 60))} 860 {F(x0 + rr.uniform(-60, 60))} 720 {F(380 + (x0 - 380) * .4)} 520"
        c = rr.choice((ROSE, GOLD, "#7ab8ff", "#c69bff", "#7ff0c0"))
        inner += P(d, stroke=c, sw=14, op=.35, extra=blur(6)) + P(d, stroke="#fffaf0", sw=2, op=.6)
    inner += f'<rect x="150" y="460" width="460" height="560" fill="{lin("veil", [(0, "#fff8e8", .55), (.5, "#fff8e8", .12), (1, "#fff8e8", 0)], 0, 460, 0, 1000, user=True)}"/>'
    c, a = clip(sil)
    s = c + g(inner, extra=a)
    for d in sil:
        s += P(d, stroke="#fff2d0", sw=8, op=.55, extra=blur(4))
    sp = [(rr.uniform(200, 560), rr.uniform(440, 900), rr.uniform(1.4, 3)) for _ in range(40)]
    s += dots(sp, "#fff6d8", .9)
    return s


def suzu():
    s = suzu_rim()
    s += g(suzu_body() + suzu_glow() + suzu_arms() + suzu_updo() + suzu_head(), SU_T)
    return s


# ------------------------------------------------------------------ Hinata (left, facing right) and Nagi (right, facing left)
CRY_BROW = "M304 278 C318 277 334 271 348 260 C351 258 353 261 351 263 C337 275 322 283 306 283 C303 283 302 280 304 278 Z"
STREAM = "M318 353 C316 362 318 371 316 380 C313 389 317 395 322 394 C327 393 326 386 324 379 C322 370 321 362 321 353 Z"
STREAM_LONG = "M318 353 C316 366 318 380 315 394 C312 408 318 418 324 416 C330 414 328 402 326 392 C323 378 322 366 321 353 Z"


def gold_face():
    return clipped(T.FACE34, ell(500, 330, 100, 150, GOLD, .38, extra=blur(14)))


def hina_head():
    h = T.hina_back34() + C.neck() + T.face34(C.HINA_BANG_SH)
    h += gold_face()   # warm light on the skin only, under the eyes
    for (x, y) in ((350, 362), (358, 366), (344, 368), (402, 362), (410, 366), (416, 360), (396, 368)):
        h += circ(T.wx(x), y, 1.6, "#e0937a", .8)
    h += T.eyes34("tears", C.iris_for("hina", C.HINA), C.HINA["lash"], wet=True, pool=True, big=1.08, gaze=(9, 1))
    h += tear_stream(T.W(STREAM_LONG)) + tear_stream(T.W(mir(STREAM)))
    h += tear_drop(T.wx(322), 430, 1.1) + tear_drop(T.wx(330), 446, .7)
    h += mouth_open(T.W("M368 398 C374 388 386 382 398 383 C410 382 422 388 428 398 C424 408 412 412 398 412 C384 412 372 408 368 398 Z"),
                    tongue=T.W("M378 406 C388 400 408 400 418 406 L418 416 L378 416 Z"))
    h += P(T.W("M372 392 C380 386 390 384 398 384"), stroke="#ffffff", sw=1.2, op=.5)
    h += blush(T.wx(322), E + 44, 30, 11, strong=True) + blush(T.wx(438), E + 42, 22, 10, strong=True)
    h += C.flour(T.wx(326), 384, 1.1, -10)
    h += T.hina_front34()
    h += T.brows34(CRY_BROW, C.HINA["brow"])
    return h


def hinata():
    s = ""
    shirt = lin("hinaShirt", [(0, "#f2604e"), (1, "#d83e30")], 0, 430, 0, 900, user=True)
    apr = lin("apron", [(0, "#fff8ea"), (1, "#f6ead0")], 0, 480, 0, 1040, user=True)
    fa, _ = FL.arm((462, 500), (504, 604), (548, 572), (50, 42, 36))
    s += P(fa, fill=SKIN_SH, stroke=SKIN_LINE, sw=2.4)
    s += P(FL.TORSO34, fill=shirt, stroke="#7a1e18", sw=2.6)
    s += clipped(FL.TORSO34, P(FL.TORSO34_SH, fill="#b8302a", op=.8)
                 + P("M296 560 C318 600 330 660 326 720 M268 720 C300 760 320 820 316 900", stroke="#7a1e18", sw=1.8, op=.4))
    # apron: bib over the chest, waist ties, skirt over the lap, flour
    apron = ("M402 498 C430 490 470 494 492 506 C498 540 500 600 504 660 C540 670 560 690 572 720 "
             "C600 760 630 820 640 900 C648 960 646 1000 640 1040 L380 1040 C376 960 380 860 388 760 C392 680 396 580 402 498 Z")
    s += P(apron, fill=apr, stroke="#8a7350", sw=2.4)
    s += clipped(apron, P("M496 506 C504 600 506 680 572 720 C620 780 640 880 646 1040 L700 1040 L700 480 Z", fill="#eadbbc", op=.8)
                 + ell(450, 620, 34, 18, "#ffffff", .7, extra=blur(4)) + ell(520, 820, 40, 20, "#ffffff", .55, extra=blur(5))
                 + P("M430 760 C440 840 446 920 444 1040 M500 780 C520 860 532 940 536 1040", stroke="#c8b48a", sw=1.6, op=.6))
    s += C.apron_logo(452, 560, 1.1)
    s += P("M396 662 C440 672 480 670 506 662", stroke="#8a7350", sw=7) + P("M396 662 C440 672 480 670 506 662", stroke="#fff8ea", sw=4.5)
    # long apron string trailing on the grass
    s += P("M392 666 C350 690 320 740 300 800 C286 850 300 900 290 960", stroke="#8a7350", sw=6) + P("M392 666 C350 690 320 740 300 800 C286 850 300 900 290 960", stroke="#fff8ea", sw=3.6)
    s += P("M408 498 C396 476 390 462 392 448", stroke="#8a7350", sw=6) + P("M408 498 C396 476 390 462 392 448", stroke="#fff8ea", sw=3.6)
    s += rim("M494 512 C502 580 506 680 570 722", GOLD, 6, .5)
    s += g(hina_head(), "rotate(7 380 440)")
    # near arm: rolled cap sleeve, strong forearm reaching for Suzu's hand
    na, nap = FL.arm((282, 504), (318, 626), (530, 590), (60, 52, 42))
    s += P(na, fill=SKIN, stroke=SKIN_LINE, sw=2.4)
    s += clipped(na, P("M300 646 L540 604 L540 640 L300 686 Z", fill=SKIN_SH, op=.8)
                 + P("M306 600 C312 620 318 636 330 646", stroke=SKIN_LINE, sw=1.4, op=.5))
    sl, cuff = FL.cap_sleeve((284, 486), (318, 626), 70)
    s += P(sl, fill=shirt, stroke="#7a1e18", sw=2.4)
    s += P(cuff, fill="#f26a58", stroke="#7a1e18", sw=2.2)
    s += rim("M330 612 C420 600 480 592 530 586", GOLD, 6, .6)
    return s


def nagi_head():
    h = T.nagi_back34() + C.neck() + T.face34(C.NAGI_BANG_SH)
    h += gold_face()   # warm light on the skin only, under the eyes
    h += T.eyes34("tears", C.iris_for("nagi", C.NAGI), C.NAGI["lash"], wet=True, pool=True, big=1.1, gaze=(9, 1), hl_flip=True)
    h += tear_stream(T.W(STREAM_LONG)) + tear_stream(T.W(mir(STREAM_LONG)))
    h += tear_drop(T.wx(322), 432, 1.1) + tear_drop(T.wx(440), 428, .9)
    h += mouth_open(T.W("M380 394 C385 387 391 384 398 385 C405 384 411 387 416 394 C412 400 406 402 398 402 C390 402 384 400 380 394 Z"),
                    tongue=T.W("M386 399 C392 396 404 396 410 399 L410 406 L386 406 Z"))
    h += blush(T.wx(322), E + 44, 30, 11, strong=True) + blush(T.wx(438), E + 42, 22, 10, strong=True)
    h += T.nagi_front34()
    h += T.brows34(CRY_BROW, C.NAGI["brow"])
    return h


def nagi():
    s = ""
    ind = lin("nagiInd", [(0, "#3e4b98"), (1, "#26306c")], 0, 450, 0, 1040, user=True)
    fa, _ = FL.arm((462, 500), (506, 604), (548, 574), (50, 42, 36))
    s += P(fa, fill="#26306c", stroke="#151a3e", sw=2.4)
    s += P(FL.TORSO34, fill=ind, stroke="#151a3e", sw=2.6)
    s += clipped(FL.TORSO34, P(FL.TORSO34_SH, fill="#1e2656", op=.9)
                 + P("M296 560 C318 600 330 660 326 720 M268 720 C300 760 320 820 316 900 M520 800 C560 860 590 940 600 1040", stroke="#151a3e", sw=1.8, op=.5))
    # dark grey work trousers on the folded legs
    legs = "M250 800 C300 790 420 784 512 762 C560 776 610 810 634 870 C648 920 650 980 640 1040 L240 1040 C236 960 240 880 250 800 Z"
    s += P(legs, fill=lin("trousers", [(0, "#5a5f70"), (1, "#3c404e")], 0, 760, 0, 1040, user=True), stroke="#252834", sw=2.4)
    s += P("M520 800 C566 840 600 900 610 980", stroke="#252834", sw=1.6, op=.5)
    # samue jacket hem and the white shirt's high collar
    s += P("M246 780 C320 800 420 790 512 762", stroke="#151a3e", sw=2.4)
    s += P("M352 440 C368 448 396 448 412 440 L416 474 C398 482 366 482 348 474 Z", fill="#fbfbff", stroke="#6d6a9e", sw=2)
    # crossed collar band (left over right), a tie at her side
    s += P("M404 476 L428 474 C452 540 474 610 498 690 L478 696 C456 618 432 546 404 476 Z", fill="#222b5e", stroke="#151a3e", sw=1.8)
    s += P("M352 476 L372 478 C392 540 430 610 478 690", stroke="#151a3e", sw=2, op=.6)
    s += P("M490 690 C500 706 506 724 504 744 M490 690 C482 708 480 724 484 740", stroke="#151a3e", sw=3)
    s += P("M372 470 C390 520 420 560 452 590", stroke="#8a1418", sw=3.4) + P("M372 470 C390 520 420 560 452 590", stroke="#d8323c", sw=2)
    s += g(P("M0 0 C-8 0 -12 5 -12 11 C-12 18 -7 22 0 22 C7 22 12 18 12 11 C12 5 8 0 0 0 Z M0 5 C-4 5 -6 8 -6 11 C-6 15 -4 17 0 17 C4 17 6 15 6 11 C6 8 4 5 0 5 Z",
             fill="#4a4a5a", stroke="#1e1e2a", sw=1.4, extra='fill-rule="evenodd"') + P("M-3 21 L-3 52 L3 52 L3 21 Z", fill="#4a4a5a", stroke="#1e1e2a", sw=1.2),
           "translate(454 588) rotate(-20)")
    s += rim("M490 520 C500 580 504 680 512 760", GOLD, 6, .45)
    # the plait hangs behind her LEFT ear: the figure is mirrored to face Suzu (turned to her right),
    # so her left ear is on the near side, at the back edge of the bob
    s += g(nagi_head(), "rotate(6 380 440)")
    # near arm reaching back to Nemu
    na, nap = FL.arm((276, 500), (232, 604), (180, 566), (58, 50, 44))
    s += P(na, fill=ind, stroke="#151a3e", sw=2.4)
    s += P("M262 520 C248 556 238 584 234 600", stroke="#6a7ad0", sw=3, op=.7)
    s += ell(178, 568, 12, 22, "#fbfbff", rot=-30, extra='stroke="#6d6a9e" stroke-width="1.6"')
    s += g(C.nagi_plait(), "rotate(6 380 440) translate(-214 4)")   # lies over the near shoulder, red cord showing
    # far arm across her front to Suzu's hand
    fo, fop = FL.arm((320, 520), (340, 630), (530, 592), (54, 48, 40))
    s += P(fo, fill="#3a4690", stroke="#151a3e", sw=2.4)
    s += P("M336 600 C340 616 344 628 352 636", stroke="#151a3e", sw=1.4, op=.5)
    s += ell(534, 590, 12, 22, "#fbfbff", rot=20, extra='stroke="#6d6a9e" stroke-width="1.6"')
    s += rim("M350 612 C430 600 490 594 530 588", GOLD, 6, .6)
    return s


# ------------------------------------------------------------------ the chain: Nemu, Mame, the Mayor
def nemu_head():
    h = C.neck() + T.face34(C.NEMU_BANG_SH, blush_on=False)
    h += gold_face()   # warm light on the skin only, under the eyes
    h += blush(T.wx(322), E + 44, 26, 10, strong=True, hatch=False) + blush(T.wx(438), E + 42, 20, 9, strong=True, hatch=False)
    h += T.eyes34("sad", C.iris_for("nemu", C.NEMU), C.NEMU["lash"], wet=True, pool=True, gaze=(8, 4), hl_flip=True)
    h += tear_stream(T.W(STREAM)) + tear_stream(T.W(mir(STREAM)))
    h += P(T.W("M384 394 C390 390 400 390 408 394"), stroke=MOUTH_LINE, sw=2.2)
    h += P(T.W("M386 400 C392 402 400 402 406 400"), stroke=CREASE, sw=1.4, op=.6)
    h += T.nemu_front34()
    h += T.brows34(CRY_BROW, C.NEMU["brow"])
    return h


def nemu():
    s = ""
    coat = lin("nemuCoat", [(0, "#2a7054"), (1, "#1f5a43")], 0, 452, 0, 1000, user=True)
    hair = ("M276 280 C252 340 240 420 238 520 C236 600 226 680 214 760 C230 740 240 720 248 700 C252 760 256 800 262 840 "
            "L500 840 C506 790 510 750 514 700 C522 724 532 744 546 760 C534 680 524 600 522 520 C520 420 508 340 484 280 Z")
    s += P(hair, fill=lin("nemuBack", [(0, "#b8e2d0"), (1, "#86b8a4")], 0, 280, 0, 840, user=True), stroke=C.NEMU["line"], sw=2.6)
    s += P("M262 360 C252 460 250 580 236 720 M300 380 C292 500 290 640 284 800 M480 380 C490 500 494 640 500 800 M512 360 C520 480 522 600 536 740",
           stroke=C.NEMU["line"], sw=1.4, op=.5)
    # back sleeve (to Mame), hanging
    b, _ = FL.arm((268, 500), (250, 616), (300, 716), (62, 56, 54))
    s += P(FL.wide_sleeve((250, 616), (300, 716), 120, 56), fill="#1a4a38", stroke="#0b2a1f", sw=2.4)
    s += P(b, fill="#22604a", stroke="#0b2a1f", sw=2.6)
    s += P(FL.COAT34, fill=coat, stroke="#0b2a1f", sw=2.6)
    s += clipped(FL.COAT34, P("M228 540 C236 640 240 800 240 1000 L200 1000 L200 540 Z", fill="#174a36"))
    # grey dress, buttoned wrong, in the open front
    s += P("M392 456 C420 540 440 660 446 1000 L448 1320 L498 1320 L496 1000 C492 760 478 600 440 452 Z", fill="#8d929b", stroke="#3e424a", sw=1.8)
    for (bx, by) in ((424, 520), (438, 572), (432, 626), (446, 676)):
        s += circ(bx, by, 4.5, "#8a5a32", extra='stroke="#3e2410" stroke-width="1.2"')
    s += P("M396 458 C404 482 424 486 432 468 C440 484 456 480 460 460 C440 452 412 452 396 458 Z", fill="#ffffff", stroke="#3e424a", sw=1.4)
    s += P("M392 456 C420 540 440 660 446 1000 L448 1320", stroke="#174a36", sw=10) + P("M440 452 C478 600 492 760 496 1000 L498 1320", stroke="#174a36", sw=10)
    s += circ(330, 580, 14, "#e8f0f4", extra='stroke="#0b2a1f" stroke-width="2"') + circ(326, 576, 4, "#ffffff")
    s += rim("M526 560 C530 660 532 800 532 900", GOLD, 6, .45)
    s += g(nemu_head(), "rotate(-6 380 440)")
    # front arm reaching down to Nagi's hand; the sleeve hangs past the hand
    a, _ = FL.arm((468, 500), (520, 614), (502, 738), (62, 56, 54))
    s += P(FL.wide_sleeve((520, 614), (502, 738), 90, 56, -6), fill="#2a7054", stroke="#0b2a1f", sw=2.4)
    s += P(a, fill="#2f7e5e", stroke="#0b2a1f", sw=2.6)
    s += P("M488 520 C508 560 518 590 520 610", stroke="#5ab08a", sw=3, op=.6)
    return s


def mame_head():
    h = T.mame_back34() + C.neck() + T.face34(None)
    h += gold_face()   # warm light on the skin only, under the eyes
    h += T.eyes34("tears", C.iris_for("mame", C.MAME), C.MAME["lash"], wet=True, pool=True, big=1.12, gaze=(8, 2), hl_flip=True)
    h += tear_stream(T.W(STREAM)) + tear_stream(T.W(mir(STREAM)))
    h += P(T.W("M382 396 C390 390 400 390 410 396"), stroke=MOUTH_LINE, sw=2.4)
    h += blush(T.wx(322), E + 44, 30, 11, strong=True) + blush(T.wx(438), E + 42, 22, 10, strong=True)
    h += T.mame_front34()
    h += T.brows34("M300 264 C316 268 334 274 350 284 C352 286 350 289 347 288 C332 280 316 274 302 270 C299 269 298 265 300 264 Z", C.MAME["brow"])
    return h


def mame():
    s = ""
    kim = lin("mameKim", [(0, "#ffb6d2"), (1, "#f07aa8")], 0, 452, 0, 1000, user=True)
    b, _ = FL.arm((272, 500), (230, 580), (196, 610), (64, 60, 58))
    s += P(FL.wide_sleeve((230, 580), (196, 610), 80, 60), fill="#e86a9a", stroke="#9a2a5a", sw=2.2)
    s += P(b, fill="#f290b8", stroke="#9a2a5a", sw=2.4)
    s += P(FL.TORSO34_STAND, fill=kim, stroke="#9a2a5a", sw=2.6)
    s += clipped(FL.TORSO34_STAND, P("M250 540 C256 640 262 800 264 1000 L230 1000 L230 540 Z", fill="#e0609a")
                 + "".join(g(P("M0 -10 L3 -3 L10 -3 L4 2 L6 9 L0 5 L-6 9 L-4 2 L-10 -3 L-3 -3 Z", fill="#ffffff", op=.8), f"translate({x} {y})")
                           for (x, y) in ((300, 560), (420, 620), (330, 740), (470, 800), (380, 900))))
    s += P("M372 452 L414 452 C430 500 444 540 456 580 L438 590 C426 550 410 500 396 470 C388 500 380 540 372 580 L356 574 C362 530 368 490 372 452 Z",
           fill="#fff4f8", stroke="#9a2a5a", sw=1.6)
    obi = "M252 640 C330 652 430 652 506 640 L506 694 C430 706 330 706 254 694 Z"
    s += P(obi, fill="#ffd36e", stroke="#9a6a10", sw=2)
    s += rim("M498 520 C504 580 506 640 506 700", GOLD, 6, .4)
    s += g(mame_head(), "rotate(-4 380 440)")
    a, _ = FL.arm((468, 500), (512, 580), (540, 640), (64, 60, 58))
    s += P(FL.wide_sleeve((512, 580), (540, 640), 70, 60, -4), fill="#ff9cc2", stroke="#9a2a5a", sw=2.2)
    s += P(a, fill="#ffb6d2", stroke="#9a2a5a", sw=2.4)
    return s


def mayor_head():
    h = T.mayor_back34() + C.neck() + T.face34(None)
    h += gold_face()   # warm light on the skin only, under the eyes
    h += T.eyes34("sad", C.iris_for("mayor", C.MAYOR), C.MAYOR["lash"], wet=True, gaze=(8, 4), iris_r=(18, 22), hl_flip=True)
    h += tear_stream(T.W(STREAM))
    h += P(T.W("M384 396 C392 393 402 393 410 396"), stroke=MOUTH_LINE, sw=2.2)
    h += P(T.W("M320 358 C330 362 342 362 352 358"), stroke=CREASE, sw=1.3, op=.5)
    h += P(T.W("M408 358 C418 362 428 362 438 358"), stroke=CREASE, sw=1.3, op=.5)
    h += T.mayor_front34()
    h += T.brows34(CRY_BROW, C.MAYOR["brow"])
    return h


def mayor():
    s = ""
    coat = lin("mayorCoat", [(0, "#2a7054"), (1, "#1f5a43")], 0, 452, 0, 1000, user=True)
    b, _ = FL.arm((266, 500), (236, 610), (200, 662), (60, 54, 50))
    s += P(FL.wide_sleeve((236, 610), (200, 662), 100, 54), fill="#1a4a38", stroke="#0b2a1f", sw=2.4)
    s += P(b, fill="#22604a", stroke="#0b2a1f", sw=2.6)
    s += P(FL.TORSO34_STAND, fill="#5a5a74", stroke="#2a2a3a", sw=2.4)
    s += P(FL.COAT34, fill=coat, stroke="#0b2a1f", sw=2.6, extra='transform="translate(380 0) scale(.96 1) translate(-380 0)"')
    s += P("M392 452 C412 520 424 620 430 1000 L432 1320 L472 1320 L470 1000 C466 760 456 600 430 450 Z", fill="#d8d4c8", stroke="#3e424a", sw=1.6)
    s += circ(330, 580, 12, "#e8f0f4", extra='stroke="#0b2a1f" stroke-width="2"')
    s += rim("M520 560 C524 660 526 800 526 900", GOLD, 6, .4)
    s += g(mayor_head(), "rotate(-3 380 440)")
    a, _ = FL.arm((468, 500), (514, 610), (502, 700), (60, 54, 50))
    s += P(FL.wide_sleeve((514, 610), (502, 700), 90, 54, -6), fill="#2a7054", stroke="#0b2a1f", sw=2.4)
    s += P(a, fill="#2f7e5e", stroke="#0b2a1f", sw=2.6)
    return s


# ------------------------------------------------------------------ joined hands, light
def clasp(x, y, r=26):
    s = circ(x, y, r * 2.8, GOLD, .38, blur(r * .7))
    s += circ(x, y, r * 1.3, "#fff2d0", .75, blur(r * .35))
    s += circ(x, y, r * .5, "#ffffff", .95, blur(r * .12))
    s += sparkle(x, y, r * 1.3, "#ffffff") + sparkle(x, y, r * .6, "#ffffff", rot=45)
    return s


def glass_hand_in(x, y, k):
    d = (f"M{F(x + 30*k)} {F(y - 18)} C{F(x + 6*k)} {F(y - 22)} {F(x - 22*k)} {F(y - 18)} {F(x - 40*k)} {F(y - 8)} "
         f"C{F(x - 48*k)} {F(y)} {F(x - 44*k)} {F(y + 12)} {F(x - 30*k)} {F(y + 14)} C{F(x - 6*k)} {F(y + 18)} {F(x + 18*k)} {F(y + 18)} {F(x + 34*k)} {F(y + 12)} Z")
    s = P(d, fill="#f4f0ff", op=.4) + P(d, stroke=GLASS_LINE, sw=2.6)
    s += P(f"M{F(x + 24*k)} {F(y - 14)} C{F(x)} {F(y - 18)} {F(x - 20*k)} {F(y - 14)} {F(x - 34*k)} {F(y - 6)}", stroke="#ffffff", sw=2, op=.9)
    s += P(f"M{F(x + 24*k)} {F(y + 10)} C{F(x)} {F(y + 14)} {F(x - 20*k)} {F(y + 12)} {F(x - 30*k)} {F(y + 8)}", stroke=rainbow(), sw=2, op=.85)
    s += P(f"M{F(x + 30*k)} {F(y)} C{F(x)} {F(y - 2)} {F(x - 20*k)} {F(y + 2)} {F(x - 36*k)} {F(y)}", stroke=ROSE, sw=4, op=.6, extra=blur(1.5))
    return s


def friend_hand(x, y, k, skin=SKIN):
    d = (f"M{F(x - 50*k)} {F(y - 24)} C{F(x - 30*k)} {F(y - 34)} {F(x)} {F(y - 32)} {F(x + 16*k)} {F(y - 20)} "
         f"C{F(x + 26*k)} {F(y - 12)} {F(x + 22*k)} {F(y + 2)} {F(x + 10*k)} {F(y + 4)} C{F(x - 10*k)} {F(y)} {F(x - 30*k)} {F(y + 4)} {F(x - 50*k)} {F(y + 10)} Z")
    s = P(d, fill=skin, stroke=SKIN_LINE, sw=2.2)
    for i in range(3):
        xx = x + (4 - i * 11) * k
        s += P(f"M{F(xx)} {F(y - 28 + i * 2)} C{F(xx + 4*k)} {F(y - 20)} {F(xx + 4*k)} {F(y - 10)} {F(xx)} {F(y - 2)}", stroke=SKIN_LINE, sw=1.2, op=.55)
    return s


def joined():
    s = ""
    s += glass_hand_in(CLASP_L[0] + 14, CLASP_L[1], -1)
    s += friend_hand(CLASP_L[0] - 14, CLASP_L[1] + 2, 1)
    s += glass_hand_in(CLASP_R[0] - 14, CLASP_R[1], 1)
    s += friend_hand(CLASP_R[0] + 14, CLASP_R[1] + 2, -1)
    for c in (CLASP_L, CLASP_R):
        s += clasp(c[0], c[1], 28)
    for c in (CLASP_N, CLASP_M1, CLASP_M2):
        s += clasp(c[0], c[1], 18)
    chain = f"M{CLASP_R[0]} {CLASP_R[1]} C1250 700 1360 690 {CLASP_N[0]} {CLASP_N[1]} C1510 704 1560 700 {CLASP_M1[0]} {CLASP_M1[1]} C1650 696 1690 692 {CLASP_M2[0]} {CLASP_M2[1]} C1800 680 1860 640 1900 600"
    s += P(chain, stroke=GOLD, sw=10, op=.25, extra=blur(6))
    s += P(chain, stroke="#fff2d0", sw=2, op=.5, extra=blur(1))
    return s


# ------------------------------------------------------------------ beads
def bead_dust():
    """Thousands of tiny beads: a tiled pattern faded into the light column and the sky."""
    pid = I("dust")
    rr = random.Random(5)
    tile = ""
    for k in range(20):
        tile += circ(rr.uniform(0, 96), rr.uniform(0, 96), rr.uniform(1.3, 2.7), rr.choice(BEADS + ["#fff6d8", "#fff6d8"]), .95)
    L.add_def("dust", f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="96" height="96" patternTransform="rotate(12)">{tile}</pattern>')
    mid = I("dustMask")
    mg = rad("dustMaskG", [(0, "#fff", 1), (.45, "#fff", .55), (1, "#fff", 0)], 960, 300, 760, user=True)
    L.add_def("dustMask", f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
                          f'<rect width="{W}" height="{H}" fill="{mg}"/></mask>')
    col = "M880 360 C700 240 460 100 300 -20 L1620 -20 C1460 100 1220 240 1040 360 Z"
    return g(P(col, fill=f"url(#{pid})"), extra=f'mask="url(#{mid})"')


def light_column():
    s = ""
    col = lin("column", [(0, "#fff2d0", 0), (.5, "#fff2d0", .35), (1, "#ffffff", .8)], 0, 0, 0, 380, user=True)
    s += P("M900 380 C820 260 700 120 600 -20 L1320 -20 C1220 120 1100 260 1020 380 Z", fill=col, extra=blur(22))
    s += P("M930 380 C900 260 860 120 830 -20 L1090 -20 C1060 120 1020 260 990 380 Z", fill=col, extra=blur(10))
    return s


FACE_ZONES = [(560, 360, 740, 580), (1170, 370, 1350, 590), (1460, 270, 1600, 470), (1630, 460, 1730, 580), (1770, 360, 1890, 500)]


def clear_of_faces(x, y):
    return not any(x0 < x < x1 and y0 < y < y1 for (x0, y0, x1, y1) in FACE_ZONES)


def bead_stream():
    """A rising plume of beads and sparks from her crown, wavering like a bonfire's, spreading into the sky;
    beads lifting off the Glasshouse; a warm snow of beads drifting down over the town."""
    s = ""
    rr = random.Random(77)
    beads, glows, tails = [], [], {}
    for k in range(360):
        t = rr.random() ** .7                       # 0 at her crown, 1 at the top of the sky
        if t < .22 and rr.random() > t * 4.5:
            continue
        y = 300 - t * 360
        u = rr.gauss(0, .42)
        width = 70 + 880 * t ** 1.4
        x = 960 + u * width + math.sin(5 * t + u * 3) * 70 * t
        if (830 < x < 1090 and 300 < y < 620) or not clear_of_faces(x, y):
            continue
        r = (6.8 - 4.4 * t) * rr.uniform(.6, 1.1)
        c = rr.choice(BEADS)
        beads.append((x, y, r, c))
        if r > 4.4 and rr.random() < .45:
            glows.append((x, y, r * 2.6, c))
        if rr.random() < .45:
            # a short tail below a rising spark, bending with the plume
            dx = -math.cos(5 * t + u * 3) * 6 * t
            tails.setdefault(c, "")
            tails[c] += f"M{F(x)} {F(y + r)}l{F(dx)} {F(r * rr.uniform(2.5, 4.5))}"
    for k in range(50):
        t = rr.random()
        x = rr.uniform(120, 520) + t * rr.uniform(-60, 240)
        y = 430 - t * 430
        beads.append((x, y, rr.uniform(1.8, 4.2), rr.choice(BEADS)))
    for k in range(85):
        x, y = rr.uniform(0, W), rr.uniform(0, 1060)
        if (760 < x < 1160 and y > 280) or not clear_of_faces(x, y):
            continue
        beads.append((x, y, rr.uniform(1.6, 3.8), rr.choice(BEADS + [AMBER, AMBER, GOLD])))
    by = {}
    for x, y, r, c in glows:
        by.setdefault(c, []).append((x, y, r))
    s += g("".join(dots(v, c) for c, v in by.items()), extra=f'opacity=".42" {blur(3)}')
    s += g("".join(P(d, stroke=c, sw=3) for c, d in tails.items()), extra=f'opacity=".35" {blur(1.6)}')
    s += bead_field(beads)
    sparks = [(960 + rr.gauss(0, .38) * (60 + t * 760), 300 - t * 350, rr.uniform(1.2, 2.6)) for t in (rr.random() for _ in range(170))]
    s += dots([p for p in sparks if clear_of_faces(p[0], p[1]) and not (840 < p[0] < 1080 and 300 < p[1] < 620)], "#fff6d8", .95)
    for k in range(6):
        x = 960 + (k - 2.5) * 28
        d = f"M{x} 360 C{F(x + (k - 2.5) * 20)} 240 {F(x + (k - 2.5) * 60)} 120 {F(x + (k - 2.5) * 130)} -20"
        s += P(d, stroke="#fff2d0", sw=10, op=.2, extra=blur(6))
    return s


def build():
    s = sky()
    s += sea_and_town()
    s += glasshouse()
    s += garden()
    s += hydrangeas()
    s += statue(150, 596, .8) + gate()
    s += light_column()
    s += bead_dust()
    s += g(mayor(), MY_T)
    s += g(nemu(), NE_T)
    s += g(mame(), MA_T)
    s += suzu()
    s += g(nagi(), NA_T)
    s += g(hinata(), HI_T)
    s += joined()
    s += bead_stream()
    s += fg_hydrangeas()
    return s


if __name__ == "__main__":
    b = build()
    n = L.write(OUT, b)
    print(OUT, n)
