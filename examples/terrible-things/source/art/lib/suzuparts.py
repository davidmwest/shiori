"""Suzu's head parts (hair, updo, pins, comb, locks) in head-local coordinates,
ported from gen_suzu.py so the CG Suzu matches the sprite exactly."""
import math
from cglib import *

HAIR_LINE = "#240a22"
HAIR_DARK = "#34102f"
HAIR_SHADE = "#46173f"
HAIR_SHEEN = "#9a4f8c"
HAIR_STRAND = "#b874a8"
LASH = "#2a0c28"
BROW = "#3a1236"
CLOTH_LINE = "#6d6a9e"
CLOTH_SH = "#dfdef2"
BLUE = "#5b7cf0"
BLUE_D = "#3747b4"
OBI_LINE = "#5e4a9a"


def hair_grad():
    return lin("su-hair", [(0, "#7a336f"), (.3, "#5e2554"), (1, "#46193f")], 0, 60, 0, 600, user=True)


def lock_grad():
    return lin("su-hairLock", [(0, "#5e2554"), (.55, "#682a5e"), (1, "#7f3a73")], 0, 250, 0, 600, user=True)


def back_grad():
    return lin("su-hairBack", [(0, "#3c1336"), (1, "#2a0c27")])


HAIR_BACK = "M282 290 C276 316 278 340 288 356 C300 370 318 376 340 378 L420 378 C442 376 460 370 472 356 C482 340 484 316 478 290 Z"
BANG_START = (478, 318)
CLUMPS = [((468, 282), (453, 305), (440, 271)),
          ((440, 271), (419, 296), (403, 268)),
          ((403, 268), (393, 285), (385, 266)),
          ((385, 266), (365, 309), (350, 270)),
          ((350, 270), (331, 297), (316, 272)),
          ((316, 272), (300, 307), (290, 284))]
BANG_END = (282, 318)


def _bang_edge(dx=0, dy=0, soft=False):
    def pt(p):
        return f"{F(p[0]+dx)} {F(p[1]+dy)}"
    out = f" C{pt((477, 304))} {pt((472, 290))} {pt(CLUMPS[0][0])}"
    for nr, t, nl in CLUMPS:
        if soft:
            t = (t[0], t[1] - 6)
        c1 = (nr[0] - (nr[0] - t[0]) * .08, nr[1] + (t[1] - nr[1]) * .55)
        c2 = (t[0] + (nr[0] - t[0]) * .38, t[1] - (t[1] - nr[1]) * .28)
        out += f" C{pt(c1)} {pt(c2)} {pt(t)}"
        c1 = (t[0] - (t[0] - nl[0]) * .22, t[1] - (t[1] - nl[1]) * .38)
        c2 = (nl[0] + (t[0] - nl[0]) * .12, nl[1] + (t[1] - nl[1]) * .5)
        out += f" C{pt(c1)} {pt(c2)} {pt(nl)}"
    nl = CLUMPS[-1][2]
    out += f" C{pt((nl[0]-4, nl[1]+12))} {pt((BANG_END[0]+1, BANG_END[1]-14))} {pt(BANG_END)}"
    return out


CROWN = ("M282 318 C268 266 288 206 380 196 C472 206 492 266 478 318" + _bang_edge() + " Z")
BANG_SHADOW = "M266 236 L494 236 L494 330 L481 330" + _bang_edge(3, 10, soft=True) + " L266 330 Z"

LOCK_L = ("M296 250 C278 280 268 318 270 356 C272 396 288 428 290 466 C292 504 274 532 276 562 "
          "C278 594 306 606 320 590 C328 578 318 564 306 570 C300 574 300 580 304 582 "
          "C294 566 306 538 308 506 C312 466 298 430 294 392 C290 352 290 300 306 262 Z")

LOOP_L = ("M372 200 C350 160 296 112 250 112 C212 112 196 140 206 166 C218 196 270 210 330 206 "
          "C348 205 362 203 372 200 Z "
          "M342 188 C324 166 294 142 264 142 C246 142 238 154 244 166 C252 180 282 186 314 186 "
          "C326 186 336 187 342 188 Z")
LOOP_C = ("M360 198 C346 160 350 108 380 82 C410 108 414 160 400 198 Z "
          "M373 178 C369 154 370 128 380 114 C390 128 391 154 387 178 Z")
TEGARA = "M348 184 C362 176 398 176 412 184 C417 192 417 200 412 207 C398 215 362 215 348 207 C343 200 343 192 348 184 Z"


def hair_back():
    return P(HAIR_BACK, fill=back_grad(), stroke=HAIR_LINE, sw=2.6)


def updo():
    hg = hair_grad()
    s = ""
    for d in (LOOP_L, mir(LOOP_L)):
        s += P(d, fill=hg, stroke=HAIR_LINE, sw=2.6, extra='fill-rule="evenodd"')
    s += P(LOOP_C, fill=hg, stroke=HAIR_LINE, sw=2.6, extra='fill-rule="evenodd"')
    s += both("M206 166 C218 196 270 210 330 206 C348 205 362 203 372 200 L342 188 C336 187 326 186 314 186 "
              "C282 186 252 180 244 166 Z", fill=HAIR_SHADE, op=.9)
    s += P("M387 178 C391 154 390 128 380 114 L380 82 C410 108 414 160 400 198 Z", fill=HAIR_SHADE, op=.8)
    s += both("M362 190 C338 160 296 128 254 126 C230 126 216 140 220 158", stroke=HAIR_LINE, sw=1.3, op=.45)
    s += both("M226 176 C244 192 290 198 340 196", stroke=HAIR_STRAND, sw=1.3, op=.5)
    s += both("M352 182 C330 156 300 136 270 132", stroke=HAIR_STRAND, sw=1.2, op=.45)
    s += both("M212 148 C218 124 246 114 276 118 C306 124 334 146 352 168", stroke=HAIR_SHEEN, sw=6, op=.75)
    s += both("M222 136 C234 122 256 118 280 122", stroke="#ffffff", sw=1.7, op=.6)
    s += P("M358 166 C354 134 360 106 376 90", stroke=HAIR_SHEEN, sw=5, op=.8)
    s += P("M363 128 C365 110 370 98 377 91", stroke="#ffffff", sw=1.5, op=.6)
    return s


def crown(sheen=True):
    s = P(CROWN, fill=hair_grad(), stroke=HAIR_LINE, sw=2.4)
    for (n, t, _nl) in CLUMPS:
        x0, y0 = n
        s += P(f"M{x0} {y0-3} Q{F(x0 + (380-x0)*.25)} {y0-40} {F(380 + (x0-380)*.42)} 204",
               stroke=HAIR_LINE, sw=1.4, op=.45)
        mx = (x0 + t[0]) / 2
        s += P(f"M{F(mx+2)} {y0+4} C{F(mx+1)} {y0+14} {F((mx+t[0])/2)} {F(t[1]-12)} {F(t[0]+(mx-t[0])*.3)} {F(t[1]-5)}",
               stroke=HAIR_STRAND, sw=1.3, op=.55)
    s += both("M284 300 C280 270 292 236 330 212", stroke=HAIR_LINE, sw=1.4, op=.5)
    s += both("M292 286 C292 262 304 238 340 216", stroke=HAIR_STRAND, sw=1.3, op=.5)
    if sheen:
        s += P("M294 244 C314 222 346 212 380 211 C414 212 446 222 466 244 "
               "C458 240 452 246 446 244 C438 236 430 240 424 240 C414 232 404 236 398 236 "
               "C390 228 380 232 374 232 C366 228 356 236 348 236 C340 236 332 242 326 242 "
               "C318 240 310 248 302 246 C299 246 296 246 294 244 Z", fill=HAIR_SHEEN, op=.6)
        s += P("M312 228 C332 218 352 214 372 214", stroke="#ffffff", sw=1.8, op=.6)
    s += P("M478 318 C492 266 472 206 380 196 C452 214 474 262 466 304 Z", fill=HAIR_SHADE, op=.55)
    return s


def tegara():
    tg = lin("su-tegara", [(0, "#7d98ff"), (1, "#3f53c4")])
    s = P(TEGARA, fill=tg, stroke="#26308a", sw=2)
    for i in range(7):
        for j in range(2):
            s += circ(352 + i * 9 + (4.5 if j else 0), 189 + j * 9, 1.7, "#ffffff", .9)
    s += P("M350 188 C364 182 396 182 410 188", stroke="#b8c8ff", sw=1.4, op=.8)
    return s


def comb():
    body = "M328 240 C338 220 358 210 380 209 C402 210 422 220 432 240 C414 234 398 232 380 232 C362 232 346 234 328 240 Z"
    s = P(body, fill="#f4efff", op=.5)
    s += P(body, stroke=GLASS_LINE, sw=1.8)
    s += P("M335 234 C346 220 362 213 380 213", stroke="#ffffff", sw=1.8, op=.95)
    s += P("M404 214 C416 219 424 227 428 235", stroke=rainbow(), sw=1.6, op=.9)
    for (x, y, col) in ((350, 229, "#ff7fc4"), (365, 223, "#46d9ff"), (380, 221, "#ffc23e"),
                        (395, 223, "#a66bff"), (410, 229, "#2fc59a")):
        s += bead(x, y, 3.8 if col == "#ffc23e" else 3.2, col, glow=(col == "#ffc23e"))
    s += sparkle(338, 226, 4)
    return s


def locks(lg=None):
    s = ""
    for d in (LOCK_L, mir(LOCK_L)):
        s += P(d, fill=lg or lock_grad(), stroke=HAIR_LINE, sw=2.4)
    s += both("M286 290 C280 330 282 372 292 410", stroke=HAIR_SHEEN, sw=4, op=.75)
    s += both("M290 300 C286 330 286 360 292 388", stroke="#ffffff", sw=1.3, op=.5)
    s += both("M300 470 C300 500 288 530 288 560", stroke=HAIR_STRAND, sw=1.6, op=.6)
    s += both("M284 360 C286 400 300 440 298 480", stroke=HAIR_LINE, sw=1.3, op=.5)
    s += both("M306 572 C312 576 314 584 310 588", stroke=HAIR_STRAND, sw=1.4, op=.7)
    return s


PINS_BACK = [
    (300, 150, -150, 72, "#ff4d6d", "ball"),
    (330, 132, -118, 70, "#ffc23e", "flower"),
    (364, 116, -100, 60, "#46d9ff", "ball"),
    (396, 116, -80, 60, "#ff7fc4", "double"),
    (430, 132, -62, 70, "#2fc59a", "ball"),
    (460, 150, -30, 72, "#3f6dff", "flower"),
    (232, 170, -168, 58, "#a66bff", "double"),
    (528, 170, -12, 58, "#ff9a3c", "ball"),
]
PINS_FRONT = [
    (284, 232, 172, 42, "#7df0d0", "dangle"),
    (476, 232, 8, 42, "#e0559a", "bell"),
    (344, 202, -138, 40, "#8ecbff", "ball"),
    (416, 202, -42, 40, "#b8b0c8", "ball"),
]


def pin(x, y, ang, length, col, kind, glow=True):
    rim = BEAD_COLS[col]
    a = math.radians(ang)
    ex, ey = x + math.cos(a) * length, y + math.sin(a) * length
    stick = f'x1="{F(x)}" y1="{F(y)}" x2="{F(ex)}" y2="{F(ey)}" stroke-linecap="round"'
    s = f'<line {stick} stroke="{GLASS_LINE}" stroke-width="4.4"/>'
    s += f'<line {stick} stroke="#f4f2ff" stroke-width="2.6"/>'
    s += f'<line {stick} stroke="{col}" stroke-width="1" opacity=".75"/>'
    if kind == "ball":
        s += bead(ex, ey, 9, col, glow=glow)
    elif kind == "double":
        mx, my = x + math.cos(a) * length * .72, y + math.sin(a) * length * .72
        s += bead(mx, my, 6, col, glow=False)
        s += bead(ex, ey, 9.5, col, glow=glow)
    elif kind == "flower":
        if glow:
            s += circ(ex, ey, 17, col, .45, blur(3))
        for k in range(5):
            rot = ang + 90 + k * 72
            tf = f'translate({F(ex)} {F(ey)}) rotate({F(rot)})'
            s += (f'<path d="M0 0 C-7 -4 -9 -13 0 -17 C9 -13 7 -4 0 0 Z" transform="{tf}" fill="#ffffff" '
                  f'fill-opacity=".6" stroke="{rim}" stroke-width="1.3" stroke-linejoin="round"/>')
            s += (f'<path d="M0 -3 C-2 -7 -2 -10 0 -13" transform="{tf}" stroke="{col}" stroke-width="2.2" '
                  f'fill="none" stroke-linecap="round" opacity=".9"/>')
        s += bead(ex, ey, 4.5, col, glow=False)
    elif kind in ("dangle", "bell"):
        s += bead(ex, ey, 8, col, glow=glow)
        cy = ey + 9
        for k, r in enumerate((3.2, 3.6, 4.2)):
            s += f'<line x1="{F(ex)}" y1="{F(cy)}" x2="{F(ex)}" y2="{F(cy + 3.5)}" stroke="#d8d0ff" stroke-width="1"/>'
            cy += r + 3.5
            s += bead(ex, cy, r, col, glow=False)
            cy += r
        s += f'<line x1="{F(ex)}" y1="{F(cy)}" x2="{F(ex)}" y2="{F(cy + 4)}" stroke="#d8d0ff" stroke-width="1"/>'
        cy += 4
        if kind == "dangle":
            s += bead(ex, cy + 5.5, 5.5, col)
        else:
            bx, by, r = ex, cy + 8, 8
            s += circ(bx, by, r * 1.8, "#ffd36e", .35, blur(3))
            s += (f'<circle cx="{F(bx)}" cy="{F(by)}" r="{r}" fill="#f6f2ff" fill-opacity=".55" '
                  f'stroke="{GLASS_LINE}" stroke-width="1.6"/>')
            s += P(f"M{F(bx-r+1.5)} {F(by+1)} L{F(bx+r-1.5)} {F(by+1)}", stroke=GLASS_LINE, sw=1.2)
            s += circ(bx, by + 3.6, 1.6, "#7f8fd6")
            s += ell(bx - r * .38, by - r * .4, r * .32, r * .22, "#fff", rot=-30)
    return s


def pins(lst, glow=True):
    return "".join(pin(*p, glow=glow) for p in lst)


def glass_eyes(shape="soft", gaze=-4, iris_r=(21, 25), big=1.0, wet=False, lit=None, pool=False, dy=0):
    return eyes(shape, lambda cx, cy, rx, ry: glass_iris(cx, cy, rx, ry, lit), LASH,
                gaze=(gaze, dy), iris_r=iris_r, big=big, wet=wet, pool=pool)


def brows(d):
    return brow_pair(d, BROW)


def face(bang=True, blush_on=True):
    return face_base(bang_shadow=BANG_SHADOW if bang else None, blush_on=blush_on)


NECK_PATH = NECK
