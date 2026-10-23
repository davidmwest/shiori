"""Heads for Nagi, Hinata, Nemu (and later Mame, the Mayor) in head-local coords,
built from the same face template as chars/suzu (STYLE.md section 4)."""
import math
from cglib import *

# ------------------------------------------------------------------ palettes
NAGI = dict(line="#0b0e1e", dark="#10142a", base="#1c2238", top="#2a3354", sheen="#3b6c9e", sheen2="#5f9bd0",
            lash="#0b0e1e", brow="#141a30", iris=("#2e4660", "#7d9bb8", "#d4e4ef"), iline="#1b2a3c")
HINA = dict(line="#8a3d14", dark="#d8722a", base="#f59a3a", top="#ffc76a", sheen="#ffe2a0", lash="#5a2408",
            brow="#9a4a18", iris=("#7a3608", "#e8861a", "#ffd77a"), iline="#4a1e06")
NEMU = dict(line="#4f7f70", dark="#9ccbb8", base="#bfe6d6", top="#d6f2e6", sheen="#f6fffb", lash="#2c5a4c",
            brow="#5f9484", iris=("#2f6e52", "#6fbf94", "#d2f4dc"), iline="#21483a")
MAYOR = dict(line="#2e2b34", dark="#4a4650", base="#6b6670", top="#8c8794", sheen="#c9c4d0", lash="#2a2630",
             brow="#3e3a44", iris=("#33503f", "#6f9a80", "#d4e8da"), iline="#1f3328")
MAME = dict(line="#8a3d14", dark="#d8722a", base="#f59a3a", top="#ffc76a", sheen="#ffe2a0", lash="#5a2408",
            brow="#9a4a18", iris=("#7a3608", "#e8861a", "#ffd77a"), iline="#4a1e06")


def hairgrad(name, pal, y0=180, y1=440):
    return lin(name, [(0, pal["top"]), (.45, pal["base"]), (1, pal["dark"])], 0, y0, 0, y1, user=True)


def iris_for(name, pal, dull=False):
    gid = iris_pal(name, *pal["iris"])

    def fn(cx, cy, rx, ry):
        return iris(cx, cy, rx, ry, gid, pal["iline"], dull=dull)
    return fn


def neck(extra_shadow=True):
    s = P(NECK, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    if extra_shadow:
        s += P(NECK_SHADOW, fill=SKIN_SH)
    return s


# ------------------------------------------------------------------ Nagi: blue-black bob, blunt bangs, plait
NAGI_BACK = ("M266 300 C264 248 300 204 380 200 C460 204 496 248 494 300 L498 420 C482 428 462 428 446 420 "
             "L314 420 C298 428 278 428 262 420 Z")
NAGI_EDGE = (" C468 296 460 293 452 295 C448 292 446 290 444 288 C440 294 436 297 428 297"
             " C420 296 416 294 412 288 C408 296 400 300 390 299 C382 298 376 296 372 290"
             " C366 297 360 300 350 299 C342 298 336 296 332 289 C328 296 322 300 312 299"
             " C304 298 296 297 288 301")
NAGI_FRONT = ("M262 422 L260 330 C256 258 298 192 380 188 C462 192 504 258 500 330 L498 422"
              " C488 420 476 418 466 414 C468 384 472 340 474 302" + NAGI_EDGE +
              " C290 340 292 384 294 414 C284 418 272 420 262 422 Z")
NAGI_BANG_SH = "M250 240 L510 240 L510 330 L478 330" + xf(NAGI_EDGE, lambda x, y: (x + 3, y + 9)) + " L250 330 Z"


def nagi_plait():
    s = ""
    x, y = 486, 404
    for k in range(7):
        dx = 4 if k % 2 else -4
        d = f"M{F(x)} {F(y)} C{F(x+dx+9)} {F(y+4)} {F(x+dx+9)} {F(y+15)} {F(x+dx)} {F(y+19)} C{F(x+dx-8)} {F(y+15)} {F(x+dx-8)} {F(y+4)} {F(x)} {F(y)} Z"
        s += P(d, fill="url(#" + I("nagiHair") + ")", stroke=NAGI["line"], sw=1.8)
        s += P(f"M{F(x+dx-2)} {F(y+5)} C{F(x+dx+1)} {F(y+8)} {F(x+dx+2)} {F(y+12)} {F(x+dx+1)} {F(y+15)}", stroke=NAGI["sheen2"], sw=1.2, op=.7)
        y += 15
    # red cord binding and a short tassel
    s += P(f"M{F(x-7)} {F(y+2)} L{F(x+7)} {F(y+2)}", stroke="#8a1418", sw=5.5) + P(f"M{F(x-6)} {F(y+2)} L{F(x+6)} {F(y+2)}", stroke="#d8323c", sw=3.4)
    s += P(f"M{F(x-3)} {F(y+5)} C{F(x-4)} {F(y+14)} {F(x-6)} {F(y+22)} {F(x-8)} {F(y+30)} M{F(x+2)} {F(y+5)} C{F(x+3)} {F(y+14)} {F(x+5)} {F(y+22)} {F(x+6)} {F(y+30)}",
           stroke="#d8323c", sw=2.2)
    s += P(f"M{F(x)} {F(y+4)} C{F(x-2)} {F(y+12)} {F(x-1)} {F(y+18)} {F(x)} {F(y+26)}", stroke=NAGI["line"], sw=3)
    return s


def nagi_back():
    hairgrad("nagiHair", NAGI, 180, 440)
    return P(NAGI_BACK, fill=lin("nagiBack", [(0, "#18203a"), (1, "#0e1226")]), stroke=NAGI["line"], sw=2.6) + nagi_plait()


def nagi_front():
    hg = hairgrad("nagiHair", NAGI, 180, 440)
    s = P(NAGI_FRONT, fill=hg, stroke=NAGI["line"], sw=2.6)
    # strands
    for (x0, y0, x1, y1) in ((300, 296, 330, 214), (338, 296, 352, 206), (376, 294, 380, 200), (412, 292, 408, 204),
                             (450, 294, 430, 212)):
        s += P(f"M{x0} {y0} Q{F((x0+x1)/2 + (380-x0)*.08)} {F((y0+y1)/2)} {x1} {y1}", stroke=NAGI["line"], sw=1.4, op=.5)
    s += P("M276 330 C274 360 276 390 280 414", stroke=NAGI["sheen"], sw=2, op=.6)
    s += P("M486 330 C488 360 486 390 484 414", stroke=NAGI["line"], sw=1.4, op=.6)
    # sea-blue angel ring
    s += P("M286 252 C306 226 342 214 380 213 C418 214 454 226 474 252 C466 248 460 254 452 252 C444 244 436 248 430 248 "
           "C420 240 410 244 404 244 C394 236 384 240 378 240 C368 236 360 244 352 244 C344 244 336 250 328 250 "
           "C318 248 306 256 296 254 C292 254 289 253 286 252 Z", fill=NAGI["sheen"], op=.75)
    s += P("M304 236 C326 224 350 219 372 219", stroke=NAGI["sheen2"], sw=2.2, op=.9)
    s += P("M310 232 C328 224 346 221 362 221", stroke="#ffffff", sw=1.3, op=.7)
    s += P("M500 330 C504 262 470 200 380 188 C452 210 486 262 486 320 Z", fill=NAGI["dark"], op=.5)
    return s


def nagi_face():
    return face_base(bang_shadow=NAGI_BANG_SH)


# ------------------------------------------------------------------ Hinata: messy bun, bandana, side-swept bangs
HINA_BACK = ("M278 290 C272 320 274 350 284 372 C296 388 316 394 340 396 L420 396 C446 394 466 386 478 370 "
             "C488 348 488 318 482 290 Z")
HINA_EDGE_PTS = [((476, 296), (466, 318), (452, 280)), ((452, 280), (434, 306), (418, 274)),
                 ((418, 274), (396, 312), (378, 270)), ((378, 270), (356, 300), (342, 268)),
                 ((342, 268), (322, 294), (310, 270)), ((310, 270), (296, 300), (288, 286))]
HINA_FRONT = ("M276 344 C262 300 268 220 300 196 C330 176 360 172 384 172 C420 172 452 182 474 204 "
              "C496 230 498 280 484 344 C482 330 480 312 478 300"
              + bang_edge((478, 300), HINA_EDGE_PTS, (282, 318)) +
              " C280 326 278 334 276 344 Z")
HINA_BANG_SH = "M250 240 L510 240 L510 330 L478 330" + bang_edge((478, 300), HINA_EDGE_PTS, (282, 318), 3, 10, soft=True) + " L250 330 Z"
HINA_SIDE_L = ("M284 300 C274 330 270 362 276 392 C280 410 290 420 300 424 C294 410 292 396 296 382 "
               "C300 360 300 330 296 304 Z")
HINA_BUN = ("M318 186 C306 150 322 112 356 98 C366 76 400 72 420 86 C450 88 470 114 466 142 C480 160 470 190 450 196 "
            "C420 206 360 206 318 186 Z")


def hina_back():
    hg = hairgrad("hinaHair", HINA, 80, 420)
    s = P(HINA_BACK, fill=lin("hinaBack", [(0, "#e8862e"), (1, "#c86422")]), stroke=HINA["line"], sw=2.6)
    # the messy bun on top, with loose loops
    s += P(HINA_BUN, fill=hg, stroke=HINA["line"], sw=2.6)
    for d in ("M332 170 C340 130 370 108 404 110", "M350 186 C356 150 388 124 430 128", "M372 92 C392 100 410 120 414 146",
              "M440 104 C452 126 452 156 440 180", "M330 140 C350 118 380 106 410 100"):
        s += P(d, stroke=HINA["line"], sw=1.4, op=.5)
    s += P("M340 124 C356 102 384 92 410 94", stroke=HINA["sheen"], sw=5, op=.85)
    s += P("M352 112 C366 100 384 96 400 96", stroke="#ffffff", sw=1.6, op=.8)
    # loose strands escaping the bun
    for d in ("M356 98 C346 80 350 64 364 58", "M450 92 C466 80 478 82 486 92", "M466 142 C486 140 498 150 500 164",
              "M322 160 C304 150 300 134 306 122"):
        s += P(d, stroke=HINA["line"], sw=2.2) + P(d, stroke=HINA["top"], sw=1, op=.8)
    return s


def bandana():
    """Red-and-white bandana tied round the head at the base of the bun, knot to the upper right."""
    band = "M296 214 C330 186 430 184 466 210 L472 228 C440 204 326 206 292 232 Z"
    s = P(band, fill="#d93a3a", stroke="#7a1e18", sw=2.2)
    for (x, y) in ((314, 214), (338, 202), (364, 197), (390, 196), (416, 198), (442, 204), (460, 214)):
        s += circ(x, y + 6, 2.6, "#ffffff", .95)
    s += P("M300 220 C334 196 428 194 462 214", stroke="#ff8a7a", sw=1.4, op=.8)
    knot = g(P("M0 0 C10 -14 28 -30 44 -34 C46 -22 40 -8 26 0 Z", fill="#d93a3a", stroke="#7a1e18", sw=2)
             + P("M0 0 C16 -4 36 -2 50 8 C40 18 20 16 4 8 Z", fill="#c42e2e", stroke="#7a1e18", sw=2)
             + circ(26, -14, 2.4, "#fff") + circ(34, 4, 2.4, "#fff") + circ(14, -6, 2, "#fff")
             + ell(0, 0, 9, 8, "#d93a3a", extra='stroke="#7a1e18" stroke-width="2"'),
             "translate(464 210) rotate(-10)")
    return s + knot


def hina_front():
    hg = hairgrad("hinaHair", HINA, 80, 420)
    s = P(HINA_FRONT, fill=hg, stroke=HINA["line"], sw=2.6)
    for (n, t, _nl) in HINA_EDGE_PTS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{F(x0 + (380-x0)*.2)} {y0-40} {F(330 + (x0-330)*.5)} 196", stroke=HINA["line"], sw=1.4, op=.45)
        mx = (x0 + t[0]) / 2
        s += P(f"M{F(mx+2)} {y0+4} C{F(mx+1)} {y0+14} {F((mx+t[0])/2)} {F(t[1]-12)} {F(t[0]+(mx-t[0])*.3)} {F(t[1]-5)}",
               stroke=HINA["sheen"], sw=1.3, op=.7)
    s += P("M298 246 C318 226 346 216 378 214 C410 214 440 222 462 240 C454 238 448 244 440 242 C430 234 420 238 412 238 "
           "C402 230 392 234 386 234 C376 230 366 238 356 238 C346 238 338 244 330 244 C320 242 312 250 304 248 Z",
           fill=HINA["sheen"], op=.75)
    s += P("M320 230 C340 220 360 216 380 216", stroke="#ffffff", sw=1.8, op=.8)
    s += P("M484 344 C498 280 494 230 474 204 C484 240 484 290 476 330 Z", fill=HINA["dark"], op=.45)
    # side locks
    for d in (HINA_SIDE_L, mir(HINA_SIDE_L)):
        s += P(d, fill=hg, stroke=HINA["line"], sw=2.2)
    # flyaway strands
    for d in ("M300 200 C290 186 288 172 296 160", "M470 214 C484 204 494 206 500 214", "M286 270 C272 262 266 250 268 238"):
        s += P(d, stroke=HINA["line"], sw=2) + P(d, stroke=HINA["top"], sw=.9, op=.8)
    s += bandana()
    return s


def hina_face(extra=""):
    s = face_base(bang_shadow=HINA_BANG_SH)
    # freckles across the nose
    for (x, y) in ((350, 362), (358, 366), (344, 368), (402, 362), (410, 366), (416, 360), (396, 368)):
        s += circ(x, y, 1.6, "#e0937a", .8)
    return s


def flour(x, y, s=1.0, rot=0):
    d = "M-14 0 C-12 -6 -2 -8 6 -6 C14 -4 18 2 14 6 C8 10 -6 10 -12 6 Z"
    c = P(d, fill="#ffffff", op=.75, extra=blur(1.2))
    c += circ(16, -6, 2, "#fff", .8) + circ(-16, 8, 1.5, "#fff", .7)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


# ------------------------------------------------------------------ Nemu: very long messy mint-silver hair, cowlick
NEMU_BACK = ("M270 280 C252 340 246 420 248 520 C250 620 244 720 236 820 L524 820 C516 720 510 620 512 520 "
             "C514 420 508 340 490 280 Z")
NEMU_EDGE_PTS = [((480, 300), (470, 336), (454, 288)), ((454, 288), (440, 328), (424, 284)),
                 ((424, 284), (404, 334), (388, 282)), ((388, 282), (366, 326), (350, 284)),
                 ((350, 284), (330, 332), (314, 290)), ((314, 290), (298, 324), (290, 300))]
NEMU_FRONT = ("M268 360 C254 300 266 218 312 192 C340 176 362 172 382 172 C408 172 436 178 458 194 "
              "C500 222 508 300 494 360 C490 340 486 320 482 304"
              + bang_edge((482, 304), NEMU_EDGE_PTS, (282, 322)) +
              " C278 334 272 346 268 360 Z")
NEMU_BANG_SH = "M250 240 L510 240 L510 340 L482 340" + bang_edge((482, 304), NEMU_EDGE_PTS, (282, 322), 3, 10, soft=True) + " L250 340 Z"
NEMU_SIDE_L = ("M290 296 C272 340 262 400 262 470 C262 540 256 610 246 680 C268 640 282 590 288 530 "
               "C292 470 290 410 296 360 C298 336 298 316 296 300 Z")


def nemu_back():
    hg = hairgrad("nemuHair", NEMU, 160, 820)
    s = P(NEMU_BACK, fill=lin("nemuBack", [(0, "#a8d8c4"), (1, "#86b8a4")]), stroke=NEMU["line"], sw=2.6)
    for d in ("M276 360 C262 460 262 600 252 780", "M496 360 C506 460 506 600 514 780", "M300 400 C292 520 290 640 282 790",
              "M470 400 C478 520 480 640 488 790"):
        s += P(d, stroke=NEMU["line"], sw=1.4, op=.45)
    # messy flyaways sticking out of the back hair
    for d in ("M252 520 C236 510 228 496 230 480", "M512 600 C530 596 540 584 540 570", "M248 680 C232 676 222 664 222 650",
              "M520 460 C534 450 538 438 534 426"):
        s += P(d, stroke=NEMU["line"], sw=2) + P(d, stroke=NEMU["top"], sw=1, op=.9)
    return s


def nemu_front():
    hg = hairgrad("nemuHair", NEMU, 160, 820)
    s = P(NEMU_FRONT, fill=hg, stroke=NEMU["line"], sw=2.6)
    for (n, t, _nl) in NEMU_EDGE_PTS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{F(x0 + (380-x0)*.25)} {y0-40} {F(380 + (x0-380)*.42)} 190", stroke=NEMU["line"], sw=1.4, op=.45)
    s += P("M296 252 C318 228 348 218 380 216 C412 218 442 228 464 252 C456 248 448 254 440 252 C430 244 420 248 412 248 "
           "C402 240 392 244 384 244 C374 240 364 248 356 248 C346 248 338 254 330 254 C320 252 310 260 302 258 Z",
           fill=NEMU["sheen"], op=.9)
    s += P("M494 360 C508 300 498 222 458 194 C486 236 492 296 482 340 Z", fill=NEMU["dark"], op=.5)
    for d in (NEMU_SIDE_L, mir(NEMU_SIDE_L)):
        s += P(d, fill=hg, stroke=NEMU["line"], sw=2.2)
    s += P("M282 360 C276 420 274 500 268 600", stroke=NEMU["sheen"], sw=2.5, op=.8)
    # the stubborn cowlick
    cow = "M392 176 C392 150 404 128 428 118 C446 112 458 120 452 132 C446 124 432 126 422 136 C410 148 404 162 402 178 Z"
    s += P(cow, fill=hg, stroke=NEMU["line"], sw=2.2)
    # bed-head flyaways
    for d in ("M300 196 C286 186 280 172 284 160", "M460 196 C474 188 486 190 492 200", "M330 180 C324 166 326 154 334 146",
              "M268 300 C254 296 246 286 246 274"):
        s += P(d, stroke=NEMU["line"], sw=2) + P(d, stroke=NEMU["top"], sw=1, op=.9)
    return s


def nemu_face(cheek_puff=False):
    face = FACE
    if cheek_puff:
        face = ("M288 250 L287 300 C287 336 300 362 320 381 C338 398 360 410 380 411 "
                "C402 410 424 400 442 386 C462 370 480 350 478 326 C476 312 474 304 473 300 L472 250 Z")
    return face_base(face=face, bang_shadow=NEMU_BANG_SH, blush_on=False) + blush(322, E + 42, 24, 8) + blush(438, E + 42, 24, 8)


# ------------------------------------------------------------------ comic marks
def sweat_drop(x, y, s=1.0, rot=0):
    c = P("M0 -22 C6 -10 12 0 12 8 C12 16 6 22 0 22 C-6 22 -12 16 -12 8 C-12 0 -6 -10 0 -22 Z",
          fill="#cfeeff", stroke="#5aa8e0", sw=2)
    c += P("M-6 6 C-6 12 -3 16 2 17", stroke="#ffffff", sw=2.4)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)})")


def gloom(x0, x1, y0, y1, n=6, col="#6a5ad8"):
    s = ""
    for k in range(n):
        x = x0 + (x1 - x0) * k / (n - 1)
        yy = y1 - (k % 2) * 14
        s += P(f"M{F(x)} {F(y0)} L{F(x)} {F(yy)}", stroke=col, sw=2.2, op=.55)
    return s


def apron_logo(x, y, s=1.0):
    """The Asahi bakery logo on Hinata's apron: a rising sun over a loaf, in a dashed ring."""
    c = '<circle r="20" fill="none" stroke="#e0a060" stroke-width="1.4" stroke-dasharray="3 3"/>'
    c += P("M-12 4 C-12 -6 12 -6 12 4 Z", fill="#ffb02e", stroke="#c86a10", sw=1.2)
    c += P("M-10 -8 L-13 -12 M0 -10 L0 -15 M10 -8 L13 -12", stroke="#ffb02e", sw=1.6)
    c += P("M-14 4 C-10 0 10 0 14 4 C14 10 -14 10 -14 4 Z", fill="#e8483a", stroke="#7a1e18", sw=1.2)
    c += P("M-6 3 L-3 7 M0 3 L3 7 M6 3 L9 7", stroke="#ffd0b0", sw=1.1)
    return g(c, f"translate({F(x)} {F(y)}) scale({F(s)})")


def stitch(d, col="#c8d0ff", sw=1.2, op=.7):
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-dasharray="5 4" opacity="{op}"/>'
