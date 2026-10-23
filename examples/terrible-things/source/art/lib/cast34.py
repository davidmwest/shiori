"""3/4-view heads (facing screen-right; mirror the group for facing left), derived from the
front template with a horizontal warp that slides the features toward the turn."""
from cglib import *
import cast as C

SHIFT = 24.0


def warp(x, y):
    t = (x - 380) / 124.0
    if abs(t) >= 1:
        return x, y
    return x + SHIFT * (1 - t * t), y


def W(d):
    return xf(d, warp)


def wx(x):
    return warp(x, 0)[0]


def dwx(x):
    t = (x - 380) / 124.0
    return 1 - 2 * SHIFT * t / 124.0 if abs(t) < 1 else 1


FACE34 = ("M292 250 L292 306 C294 338 306 362 324 382 C344 400 372 412 404 413 C424 412 442 400 456 380 "
          "C466 364 472 350 474 336 C474 326 468 320 470 310 C472 300 474 290 474 250 Z")
JAW34 = "M474 300 C474 330 468 352 456 380 C442 400 424 412 404 413 C432 402 452 380 460 356 C466 336 468 316 466 300 Z"
NEAR_JAW_SH = "M292 300 C294 336 306 362 324 382 C344 400 372 412 404 413 L404 430 L280 430 L280 300 Z"
EYE_C = ((wx(EXL), E), (wx(EXR), E))
EYE_SX = (dwx(EXL) * 1.02, dwx(EXR) * .86)
NOSE34 = f"M{F(wx(383)+8)} {E+26} C{F(wx(383)+11)} {E+31} {F(wx(383)+13)} {E+36} {F(wx(383)+12)} {E+39} C{F(wx(383)+9)} {E+40} {F(wx(383)+6)} {E+40} {F(wx(383)+4)} {E+39}"


def face34(bang_shadow=None, blush_on=True, light="front"):
    s = P(FACE34, fill=SKIN, stroke=SKIN_LINE, sw=2.2)
    sh = ""
    if bang_shadow:
        sh += P(W(bang_shadow), fill=SKIN_SH)
    # shadow on the near (screen-left) jaw: the far cheek catches the light ahead of her
    sh += P("M292 300 C294 336 306 362 324 382 C344 400 372 412 404 413 C372 400 340 380 322 352 C310 334 304 316 304 300 Z", fill=SKIN_SH, op=.8)
    s += clipped(FACE34, sh)
    if blush_on:
        s += blush(wx(322), E + 42, 28, 10) + blush(wx(438) - 4, E + 40, 20, 9)
    s += P(NOSE34, stroke=NOSE, sw=1.8)
    s += P(f"M{F(wx(383)+10)} {E+22} C{F(wx(383)+12)} {E+26} {F(wx(383)+12)} {E+30} {F(wx(383)+11)} {E+32}", stroke="#ffffff", sw=1.4, op=.8)
    return s


def eyes34(shape, irisfn, lash, **kw):
    return eyes(shape, irisfn, lash, centers=EYE_C, sx=EYE_SX, **kw)


def closed34(kind, lash):
    return closed_eyes(kind, lash, centers=EYE_C, sx=EYE_SX)


def brows34(d, col):
    return brow_pair(d, col, centers=EYE_C, sx=EYE_SX)


def mouth34(d):
    return W(d)


# ------------------------------------------------------------------ hair in 3/4 (warped front hair)
def nagi_back34():
    C.hairgrad("nagiHair", C.NAGI, 180, 440)
    back = ("M256 300 C252 244 296 198 380 196 C460 198 496 244 494 300 L496 420 C482 426 466 426 452 420 "
            "L316 420 C296 430 272 430 254 420 Z")
    s = P(back, fill=lin("nagiBack", [(0, "#18203a"), (1, "#0e1226")]), stroke=C.NAGI["line"], sw=2.6)
    return s


def nagi_front34():
    hg = C.hairgrad("nagiHair", C.NAGI, 180, 440)
    s = P(W(C.NAGI_FRONT), fill=hg, stroke=C.NAGI["line"], sw=2.6)
    for (x0, y0, x1, y1) in ((300, 296, 330, 214), (338, 296, 352, 206), (376, 294, 380, 200), (412, 292, 408, 204),
                             (450, 294, 430, 212)):
        s += P(W(f"M{x0} {y0} Q{F((x0+x1)/2 + (380-x0)*.08)} {F((y0+y1)/2)} {x1} {y1}"), stroke=C.NAGI["line"], sw=1.4, op=.5)
    s += P(W("M286 252 C306 226 342 214 380 213 C418 214 454 226 474 252 C466 248 460 254 452 252 C444 244 436 248 430 248 "
             "C420 240 410 244 404 244 C394 236 384 240 378 240 C368 236 360 244 352 244 C344 244 336 250 328 250 "
             "C318 248 306 256 296 254 C292 254 289 253 286 252 Z"), fill=C.NAGI["sheen"], op=.75)
    s += P(W("M304 236 C326 224 350 219 372 219"), stroke=C.NAGI["sheen2"], sw=2.2, op=.9)
    s += P(W("M500 330 C504 262 470 200 380 188 C452 210 486 262 486 320 Z"), fill=C.NAGI["dark"], op=.5)
    return s


def nagi_plait34():
    return C.nagi_plait()


def hina_back34():
    return C.hina_back()


def hina_front34():
    hg = C.hairgrad("hinaHair", C.HINA, 80, 420)
    s = P(W(C.HINA_FRONT), fill=hg, stroke=C.HINA["line"], sw=2.6)
    for (n, t, _nl) in C.HINA_EDGE_PTS:
        x0, y0 = n
        s += P(W(f"M{x0} {y0-3} Q{F(x0 + (380-x0)*.2)} {y0-40} {F(330 + (x0-330)*.5)} 196"), stroke=C.HINA["line"], sw=1.4, op=.45)
    s += P(W("M298 246 C318 226 346 216 378 214 C410 214 440 222 462 240 C454 238 448 244 440 242 C430 234 420 238 412 238 "
             "C402 230 392 234 386 234 C376 230 366 238 356 238 C346 238 338 244 330 244 C320 242 312 250 304 248 Z"),
           fill=C.HINA["sheen"], op=.75)
    s += P(W("M484 344 C498 280 494 230 474 204 C484 240 484 290 476 330 Z"), fill=C.HINA["dark"], op=.45)
    s += P(W(C.HINA_SIDE_L), fill=hg, stroke=C.HINA["line"], sw=2.2)
    s += P(W(mir(C.HINA_SIDE_L)), fill=hg, stroke=C.HINA["line"], sw=2.2)
    for d in ("M300 200 C290 186 288 172 296 160", "M470 214 C484 204 494 206 500 214", "M286 270 C272 262 266 250 268 238"):
        s += P(d, stroke=C.HINA["line"], sw=2) + P(d, stroke=C.HINA["top"], sw=.9, op=.8)
    s += C.bandana()
    return s


# ------------------------------------------------------------------ Nemu, Mame, the Mayor in 3/4
def nemu_back34():
    return C.nemu_back()


def nemu_front34():
    hg = C.hairgrad("nemuHair", C.NEMU, 160, 820)
    s = P(W(C.NEMU_FRONT), fill=hg, stroke=C.NEMU["line"], sw=2.6)
    for (n, t, _nl) in C.NEMU_EDGE_PTS:
        x0, y0 = n
        s += P(W(f"M{x0} {y0-3} Q{F(x0 + (380-x0)*.25)} {y0-40} {F(380 + (x0-380)*.42)} 190"), stroke=C.NEMU["line"], sw=1.4, op=.45)
    s += P(W("M296 252 C318 228 348 218 380 216 C412 218 442 228 464 252 C456 248 448 254 440 252 C430 244 420 248 412 248 "
             "C402 240 392 244 384 244 C374 240 364 248 356 248 C346 248 338 254 330 254 C320 252 310 260 302 258 Z"),
           fill=C.NEMU["sheen"], op=.9)
    for d in (C.NEMU_SIDE_L, mir(C.NEMU_SIDE_L)):
        s += P(W(d), fill=hg, stroke=C.NEMU["line"], sw=2.2)
    cow = "M392 176 C392 150 404 128 428 118 C446 112 458 120 452 132 C446 124 432 126 422 136 C410 148 404 162 402 178 Z"
    s += P(W(cow), fill=hg, stroke=C.NEMU["line"], sw=2.2)
    return s


MAME = C.MAME


def mame_back34():
    hg = C.hairgrad("mameHair", MAME, 180, 440)
    back = ("M262 300 C258 244 300 200 380 196 C460 200 496 244 494 300 L496 398 C480 406 462 406 448 398 "
            "L318 398 C298 408 276 408 260 398 Z")
    return P(back, fill=lin("mameBack", [(0, "#e8862e"), (1, "#c86422")]), stroke=MAME["line"], sw=2.6)


MAME_FRONT = ("M262 402 L260 330 C256 258 298 192 380 188 C462 192 504 258 500 330 L498 402"
              " C488 400 476 398 466 394 C468 370 472 340 474 302 C460 296 446 290 432 296 C420 290 406 288 392 296"
              " C378 290 362 290 350 296 C336 290 320 292 306 298 C298 296 292 298 288 301"
              " C290 340 292 370 294 394 C284 398 272 400 262 402 Z")


def mame_front34():
    hg = C.hairgrad("mameHair", MAME, 180, 440)
    s = P(W(MAME_FRONT), fill=hg, stroke=MAME["line"], sw=2.6)
    s += P(W("M290 250 C310 226 346 214 380 213 C414 214 450 226 470 250 C460 246 452 252 444 250 C430 242 416 246 408 246 "
             "C396 238 386 242 378 242 C366 238 356 246 346 246 C336 246 326 252 318 252 C308 250 298 256 290 250 Z"),
           fill=MAME["sheen"], op=.75)
    # a little star hair-clip
    s += g(P("M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z", fill="#ffd36e", stroke="#b87808", sw=1.2),
           f"translate({F(wx(318))} 262) scale(1.4)")
    return s


MAYOR = C.MAYOR


def mayor_back34():
    hg = C.hairgrad("mayorHair", MAYOR, 160, 420)
    s = ""
    # neat bun at the back of the head (left, since she faces right before mirroring)
    bun = "M232 236 C226 206 244 182 272 178 C300 176 318 196 316 222 C314 248 292 264 266 262 C246 260 236 252 232 236 Z"
    s += P(bun, fill=hg, stroke=MAYOR["line"], sw=2.4)
    s += P("M246 210 C260 196 284 192 300 202", stroke=MAYOR["sheen"], sw=4, op=.8)
    s += P("M250 236 C266 226 290 224 306 232", stroke=MAYOR["line"], sw=1.3, op=.5)
    back = "M270 300 C266 250 300 206 380 202 C460 206 494 250 490 300 L488 360 C470 368 290 368 272 360 Z"
    s += P(back, fill=lin("mayorBack", [(0, "#5a5662"), (1, "#3e3a46")]), stroke=MAYOR["line"], sw=2.4)
    return s


MAYOR_FRONT = ("M274 330 C266 262 304 202 384 198 C452 200 494 244 490 310 C484 300 476 288 466 280 "
               "C440 268 410 262 380 262 C350 262 320 268 300 278 C290 290 282 308 280 330 Z")


def mayor_front34():
    hg = C.hairgrad("mayorHair", MAYOR, 160, 420)
    s = P(W(MAYOR_FRONT), fill=hg, stroke=MAYOR["line"], sw=2.4)
    for d in ("M300 280 C330 240 380 222 440 230", "M320 270 C350 244 400 236 452 246", "M290 300 C300 260 340 230 390 222"):
        s += P(W(d), stroke=MAYOR["sheen"], sw=1.6, op=.7)
    s += P(W("M296 250 C330 222 380 212 430 220"), stroke="#ffffff", sw=1.6, op=.5)
    return s
