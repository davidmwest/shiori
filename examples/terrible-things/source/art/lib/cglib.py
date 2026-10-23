#!/usr/bin/env python3
"""Shared helpers for the three CGs of "All the Terrible Things We Didn't Think".

Faces follow STYLE.md: the sprite face template lives in "head-local" coordinates
(centre x = 380, skull top 210, eye line E = 330, chin 411), the same frame as
chars/suzu, and each head is placed into the 1920x1080 CG with one transform.
"""
import math, re

PFX = "cg-"
_defs = []
_def_keys = set()
_uid = [0]


def reset(pfx):
    global PFX
    PFX = pfx
    _defs.clear()
    _def_keys.clear()
    _uid[0] = 0


def I(n):
    return PFX + n


def U(n):
    return f"url(#{PFX}{n})"


def uid(base="u"):
    _uid[0] += 1
    return f"{base}{_uid[0]}"


def add_def(key, s):
    if key not in _def_keys:
        _def_keys.add(key)
        _defs.append(s)


def defs():
    return "<defs>" + "\n".join(_defs) + "</defs>"


# ------------------------------------------------------------------ number/path helpers
NUM = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?")


def F(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    if s in ("-0", "", "0"):
        return "0"
    if s.startswith("0."):
        return s[1:]
    if s.startswith("-0."):
        return "-" + s[2:]
    return s


def mir(d, cx=380):
    """Mirror an absolute path (M L C Q S T Z only) about x = cx."""
    out, idx = [], 0
    for tok in NUM.findall(d):
        if tok.isalpha():
            idx = 0
            out.append(tok)
            continue
        v = float(tok)
        if idx % 2 == 0:
            v = 2 * cx - v
        idx += 1
        out.append(F(v))
    return " ".join(out)


def xf(d, fn):
    """Apply fn(x, y) -> (x, y) to every point of an absolute M/L/C/Q path."""
    out, buf = [], []
    for tok in NUM.findall(d):
        if tok.isalpha():
            out.append(tok)
            continue
        buf.append(float(tok))
        if len(buf) == 2:
            x, y = fn(*buf)
            out.append(F(x))
            out.append(F(y))
            buf = []
    return " ".join(out)


def P(d, fill="none", stroke=None, sw=None, op=None, extra=""):
    a = f'<path d="{d}" fill="{fill}"'
    if stroke:
        a += f' stroke="{stroke}"'
        if sw is not None:
            a += f' stroke-width="{F(sw)}"'
    if op is not None:
        a += f' opacity="{F(op)}"'
    if extra:
        a += " " + extra
    return a + "/>"


def both(d, cx=380, **kw):
    return P(d, **kw) + P(mir(d, cx), **kw)


def g(content, tf=None, extra=""):
    a = "<g"
    if tf:
        a += f' transform="{tf}"'
    if extra:
        a += " " + extra
    return a + ">" + content + "</g>"


def circ(x, y, r, fill, op=None, extra=""):
    s = f'<circle cx="{F(x)}" cy="{F(y)}" r="{F(r)}" fill="{fill}"'
    if op is not None:
        s += f' opacity="{F(op)}"'
    if extra:
        s += " " + extra
    return s + "/>"


def ell(x, y, rx, ry, fill, op=None, rot=None, extra=""):
    s = f'<ellipse cx="{F(x)}" cy="{F(y)}" rx="{F(rx)}" ry="{F(ry)}" fill="{fill}"'
    if op is not None:
        s += f' opacity="{F(op)}"'
    if rot:
        s += f' transform="rotate({F(rot)} {F(x)} {F(y)})"'
    if extra:
        s += " " + extra
    return s + "/>"


def sparkle(x, y, r, col="#fff", op=1, rot=0):
    k = r * .2
    d = (f"M{F(x)} {F(y-r)} L{F(x+k)} {F(y-k)} L{F(x+r)} {F(y)} L{F(x+k)} {F(y+k)} "
         f"L{F(x)} {F(y+r)} L{F(x-k)} {F(y+k)} L{F(x-r)} {F(y)} L{F(x-k)} {F(y-k)} Z")
    ex = f' transform="rotate({F(rot)} {F(x)} {F(y)})"' if rot else ""
    return f'<path d="{d}" fill="{col}" opacity="{F(op)}"{ex}/>'


def blur(sd):
    """Gaussian blur filter id for stdDeviation sd (generous region)."""
    key = f"b{F(sd)}".replace(".", "_")
    m = 1.0 + min(sd / 6.0, 3.0)
    add_def(key, f'<filter id="{I(key)}" x="-{F(m*50)}%" y="-{F(m*50)}%" width="{F(100+m*100)}%" height="{F(100+m*100)}%">'
                 f'<feGaussianBlur stdDeviation="{F(sd)}"/></filter>')
    return f'filter="{U(key)}"'


def lin(name, stops, x1=0, y1=0, x2=0, y2=1, user=False, extra=""):
    st = "".join(f'<stop offset="{F(o)}" stop-color="{c}"' + (f' stop-opacity="{F(a)}"' if a is not None else "") + "/>"
                 for o, c, a in [(s + (None,))[:3] for s in stops])
    u = ' gradientUnits="userSpaceOnUse"' if user else ""
    add_def(name, f'<linearGradient id="{I(name)}"{u} x1="{F(x1)}" y1="{F(y1)}" x2="{F(x2)}" y2="{F(y2)}"{(" " + extra) if extra else ""}>{st}</linearGradient>')
    return U(name)


def rad(name, stops, cx=.5, cy=.5, r=.5, fx=None, fy=None, user=False, extra=""):
    st = "".join(f'<stop offset="{F(o)}" stop-color="{c}"' + (f' stop-opacity="{F(a)}"' if a is not None else "") + "/>"
                 for o, c, a in [(s + (None,))[:3] for s in stops])
    u = ' gradientUnits="userSpaceOnUse"' if user else ""
    f = ""
    if fx is not None:
        f = f' fx="{F(fx)}" fy="{F(fy)}"'
    add_def(name, f'<radialGradient id="{I(name)}"{u} cx="{F(cx)}" cy="{F(cy)}" r="{F(r)}"{f}{(" " + extra) if extra else ""}>{st}</radialGradient>')
    return U(name)


def clip(d, tf=None, cid=None):
    """Returns (defstring, clip-path attr)."""
    cid = cid or uid("cl")
    t = f' transform="{tf}"' if tf else ""
    paths = d if isinstance(d, (list, tuple)) else [d]
    s = f'<clipPath id="{I(cid)}">' + "".join(f'<path d="{p}"{t}/>' for p in paths) + "</clipPath>"
    return s, f'clip-path="{U(cid)}"'


def clipped(d, content, tf=None):
    c, a = clip(d, tf)
    return c + g(content, extra=a)


# ------------------------------------------------------------------ shared palette
SKIN = "#fde8dc"
SKIN_SH = "#f6cfc2"
SKIN_DEEP = "#eab3a6"
SKIN_LINE = "#b9705f"
CREASE = "#c98a7a"
NOSE = "#d3907f"
MOUTH_LINE = "#9a4842"
GLASS_LINE = "#7f8fd6"
RAINBOW = [(0, "#ff7aa8"), (.25, "#ffd36e"), (.5, "#7ff0c0"), (.75, "#7ab8ff"), (1, "#c69bff")]

BEAD_COLS = {
    "#ff4d6d": "#b8183c", "#3f6dff": "#1d36a8", "#2fc59a": "#137a5c", "#ffc23e": "#b87808",
    "#a66bff": "#5f2fc0", "#ff7fc4": "#c03a86", "#46d9ff": "#1188b0", "#b8b0c8": "#6d6680",
    "#ff9a3c": "#b85a10", "#7df0d0": "#2a9a80", "#e0559a": "#922860", "#8ecbff": "#3a78c0",
    "#ffb02e": "#c86a10",
}


def rainbow():
    return lin("rainbow", RAINBOW, 0, 0, 1, 1)


def rainbowV():
    return lin("rainbowV", RAINBOW, 0, 0, 0, 1)


def bead(x, y, r, col, glow=True, hi=True, glow_op=.45):
    rim = BEAD_COLS[col]
    gid = rad("bd" + col[1:], [(0, "#ffffff"), (.32, col, .8), (1, col)], .36, .32, .75)
    s = ""
    if glow:
        s += circ(x, y, r * 1.9, col, glow_op, blur(max(r * .35, 1.5)))
    s += f'<circle cx="{F(x)}" cy="{F(y)}" r="{F(r)}" fill="{gid}" stroke="{rim}" stroke-width="{F(max(r*.15, .8))}"/>'
    if hi:
        hx, hy = x - r * .36, y - r * .38
        s += ell(hx, hy, r * .34, r * .24, "#fff", rot=-30)
        s += circ(x + r * .42, y + r * .4, max(r * .13, .6), "#fff", .85)
    return s


# ------------------------------------------------------------------ face template (head-local)
FACE = ("M288 250 L287 300 C287 336 300 362 320 381 C338 398 360 410 380 411 "
        "C400 410 422 398 440 381 C460 362 473 336 473 300 L472 250 Z")
JAW_SHADOW = ("M473 298 C472 336 458 362 440 381 C422 398 402 408 382 410 "
              "C406 400 430 384 446 364 C458 346 464 324 466 298 Z")
NECK = "M358 384 L357 446 C356 456 350 464 342 470 L418 470 C410 464 404 456 403 446 L402 384 Z"
NECK_SHADOW = "M358 388 C368 414 392 414 402 388 L403 420 C392 432 368 432 357 420 Z"

E = 330
EXL, EXR = 334, 426

# eye shapes, left eye (screen-left) around (334, 330); the right eye is mirrored
EYES = {
    "neutral": dict(
        scl="M303 329 C308 315 320 306 335 305 C350 305 359 311 363 320 C365 337 357 352 337 356 C319 358 306 347 303 329 Z",
        lash=("M296 331 C300 314 315 299 335 298 C352 298 362 305 367 314 C368 317 366 318 364 317 "
              "C358 309 349 305 335 305 C320 306 310 314 304 326 C301 331 298 332 296 331 Z"),
        flick="M303 322 C299 319 295 319 291 321 C295 321 299 323 302 326 Z M305 315 C302 310 298 308 294 308 C298 310 301 313 303 317 Z",
        lower="M310 345 C316 352 325 356 337 357", crease="M310 294 Q332 284 357 290"),
    "soft": dict(
        scl="M304 330 C310 318 322 311 335 310 C349 310 358 315 362 322 C364 336 357 350 337 354 C320 356 308 346 304 330 Z",
        lash=("M297 332 C301 318 316 305 335 304 C351 304 361 309 366 318 C367 321 365 322 363 321 "
              "C357 313 348 310 335 310 C321 311 311 318 305 328 C302 332 299 333 297 332 Z"),
        flick="M304 324 C300 322 296 322 292 324 C296 324 300 326 303 328 Z M306 318 C303 313 299 312 295 312 C299 314 302 317 304 320 Z",
        lower="M310 344 C316 350 325 353 337 354", crease="M310 300 Q332 292 357 298"),
    "sad": dict(
        scl="M304 334 C310 323 322 316 336 313 C349 311 358 314 362 320 C364 336 357 350 337 355 C320 357 308 348 304 334 Z",
        lash=("M296 338 C300 324 314 310 336 307 C351 305 361 308 366 316 C367 319 365 320 363 319 "
              "C357 312 348 311 336 313 C322 315 311 322 305 333 C302 338 299 339 296 338 Z"),
        flick="M304 330 C300 329 296 330 293 333 C297 332 300 333 303 334 Z",
        lower="M310 345 C316 351 325 354 337 355", crease="M312 302 Q334 296 358 298"),
    "surprised": dict(
        scl="M302 326 C305 308 318 297 334 296 C350 296 360 304 364 316 C366 336 358 356 336 360 C318 362 304 348 302 326 Z",
        lash=("M295 326 C297 307 313 290 334 290 C351 290 362 297 367 309 C368 312 366 313 364 312 "
              "C358 301 348 296 334 296 C319 297 309 307 303 322 C301 327 298 328 295 326 Z"),
        flick="M302 316 C298 312 294 311 290 312 C294 313 298 316 301 320 Z M305 306 C302 301 298 299 294 298 C297 301 300 304 303 309 Z",
        lower="M308 348 C315 356 325 360 337 361", crease="M310 288 Q332 278 358 284"),
    "tears": dict(
        scl="M304 332 C310 320 322 313 336 311 C349 310 358 313 362 319 C364 336 357 350 337 355 C320 357 308 347 304 332 Z",
        lash=("M296 336 C300 322 314 308 336 305 C351 304 361 307 366 315 C367 318 365 319 363 318 "
              "C357 311 348 310 336 311 C322 313 311 320 305 331 C302 336 299 337 296 336 Z"),
        flick="M304 328 C300 327 296 328 293 331 C297 330 300 331 303 332 Z",
        lower=None, crease="M312 300 Q334 294 358 296"),
    # heavy-lidded (Nemu): the upper lid sits low across the iris
    "heavy": dict(
        scl="M303 334 C310 326 322 322 336 321 C350 321 359 325 363 330 C364 342 357 352 337 355 C320 357 307 348 303 334 Z",
        lash=("M295 336 C302 322 318 314 336 314 C352 314 362 318 368 326 C369 329 367 330 365 329 "
              "C359 323 350 321 336 321 C322 322 311 326 304 333 C300 337 297 338 295 336 Z"),
        flick="M302 331 C298 330 294 331 291 334 C295 333 299 334 302 335 Z",
        lower="M311 346 C317 351 326 354 337 355", crease="M308 310 Q332 302 358 308"),
}

CLOSED_HAPPY = ("M300 336 C308 318 324 310 336 310 C348 310 360 318 366 332 C366 336 362 336 360 333 "
                "C354 322 346 317 336 317 C324 317 312 324 306 337 C304 340 300 340 300 336 Z")
CLOSED_HAPPY_LASH = ("M300 336 C296 334 292 336 289 340 C294 339 298 339 301 340 Z "
                     "M304 328 C300 324 296 323 292 324 C296 325 300 328 302 331 Z")
CLOSED_DOWN = ("M297 334 C307 346 321 352 336 352 C350 352 360 347 367 338 C367 342 363 347 359 350 "
               "C351 356 343 358 336 358 C320 358 306 350 297 338 Z")
CLOSED_DOWN_LASH = ("M299 335 C295 336 291 339 288 343 C293 341 297 340 300 340 Z "
                    "M303 341 C300 345 297 348 295 352 C299 349 303 346 305 344 Z")
CLOSED_LOWER = "M318 357 C326 361 340 361 350 357"
# squeezed shut with laughter: a ">" chevron (left eye), mirrored gives "<"
SQUEEZE = ("M300 314 C314 320 328 326 352 334 C354 336 354 338 352 339 C330 344 316 350 302 358 "
           "C298 360 296 356 299 353 C312 346 324 341 338 337 C324 332 312 326 298 320 C295 318 297 313 300 314 Z")


def eye_tf(cx, cy, sx=1.0, flip=False):
    k = -sx if flip else sx
    return f"translate({F(cx)} {F(cy)}) scale({F(k)} 1) translate(-334 -330)"


def iris_pal(name, top, mid, bot):
    return lin("iris-" + name, [(0, top), (.5, mid), (1, bot)], 0, 0, 0, 1)


def sclera():
    return lin("sclera", [(0, "#d6d2f0"), (.45, "#ffffff")], 0, 0, 0, 1)


def iris(cx, cy, rx, ry, pal, line, pupil=True, dull=False, glow=None):
    """Normal anime iris (head-local coords). pal = url of iris gradient."""
    s = ell(cx, cy, rx, ry, pal)
    if glow:
        s += ell(cx, cy + ry * .45, rx * .8, ry * .38, glow, .55, extra=blur(2.2))
    if pupil:
        s += ell(cx, cy + 1, rx * .38, ry * .44, line, .78 if not dull else .9)
    # lid shadow band (top third)
    s += (f'<path d="M{F(cx-rx-3)} {F(cy-ry*.36)} C{F(cx-8)} {F(cy-ry*.16)} {F(cx+8)} {F(cy-ry*.16)} {F(cx+rx+3)} {F(cy-ry*.36)} '
          f'L{F(cx+rx+3)} {F(cy-ry-4)} L{F(cx-rx-3)} {F(cy-ry-4)} Z" fill="{line}" opacity="{".45" if dull else ".3"}"/>')
    if not dull:
        # light crescent at the bottom
        s += (f'<path d="M{F(cx-rx*.72)} {F(cy+ry*.42)} C{F(cx-rx*.3)} {F(cy+ry*.86)} {F(cx+rx*.3)} {F(cy+ry*.86)} {F(cx+rx*.72)} {F(cy+ry*.42)} '
              f'C{F(cx+rx*.3)} {F(cy+ry*.66)} {F(cx-rx*.3)} {F(cy+ry*.66)} {F(cx-rx*.72)} {F(cy+ry*.42)} Z" fill="#ffffff" opacity=".45" {blur(1)}/>')
    s += f'<ellipse cx="{F(cx)}" cy="{F(cy)}" rx="{F(rx)}" ry="{F(ry)}" fill="none" stroke="{line}" stroke-width="1.6"/>'
    return s


def glass_iris(cx, cy, rx, ry, lit=None):
    """Suzu's clear marble with a curl of violet smoke (lit = optional colour of inner light)."""
    marble = rad("marble", [(0, "#ffffff"), (.3, "#f6f0ff"), (.7, "#d4c4f7"), (1, "#9a80dc")], .4, .34, .72)
    mglow = rad("marbleGlow", [(0, "#ffe6fb", .95), (.6, "#f3c8ff", .5), (1, "#f3c8ff", 0)])
    cid = uid("ir")
    e = f'cx="{F(cx)}" cy="{F(cy)}" rx="{F(rx)}" ry="{F(ry)}"'
    s = f'<clipPath id="{I(cid)}"><ellipse {e}/></clipPath>'
    s += f'<ellipse {e} fill="{marble}"/>'
    c = ell(cx - 1, cy + ry * .45, rx * .9, ry * .5, "#b48cf0", .35, extra=blur(3))
    if lit:
        c += ell(cx, cy + ry * .2, rx * .95, ry * .8, lit, .55, extra=blur(4))

    def sm(pts):
        out = f"M{F(cx+pts[0][0]*rx/21)} {F(cy+pts[0][1]*ry/25)}"
        for i in range(1, len(pts), 3):
            out += " C" + " ".join(f"{F(cx+px*rx/21)} {F(cy+py*ry/25)}" for px, py in pts[i:i+3])
        return out
    plume = sm([(-12, 26), (-16, 10), (-4, 2), (-6, -10), (-7, -18), (8, -18), (10, -6), (12, 6), (4, 10), (2, 26)]) + " Z"
    c += P(plume, fill="#8e4fe0", op=.32, extra=blur(3))
    curl = sm([(6, 24), (-2, 14), (-14, 10), (-12, -2), (-10, -12), (4, -14), (8, -6),
               (11, 1), (3, 6), (-1, 2), (-4, -1), (-1, -6), (3, -5)])
    wisp = sm([(10, 24), (14, 16), (16, 8), (12, 0)])
    c += P(curl, stroke="#8e4fe0", sw=10 * rx / 21, op=.3, extra=blur(3))
    c += P(curl, stroke="#7d3fd1", sw=4 * rx / 21, op=.75, extra=blur(1))
    c += P(curl, stroke="#ecdcff", sw=1 * rx / 21, op=.9)
    c += P(wisp, stroke="#9a5cf0", sw=2.5 * rx / 21, op=.5, extra=blur(1))
    c += ell(cx + 3, cy + ry * .66, rx * .66, ry * .26, mglow)
    c += (f'<path d="M{F(cx-rx-2)} {F(cy-ry*.42)} C{F(cx-8)} {F(cy-ry*.2)} {F(cx+8)} {F(cy-ry*.2)} '
          f'{F(cx+rx+2)} {F(cy-ry*.42)} L{F(cx+rx+2)} {F(cy-ry-4)} L{F(cx-rx-2)} {F(cy-ry-4)} Z" fill="#3a1a6a" opacity=".3"/>')
    s += g(c, extra=f'clip-path="{U(cid)}"')
    s += f'<ellipse {e} fill="none" stroke="#6a52b8" stroke-width="1.6"/>'
    s += f'<ellipse cx="{F(cx)}" cy="{F(cy)}" rx="{F(rx-1.6)}" ry="{F(ry-1.6)}" fill="none" stroke="{rainbow()}" stroke-width="1.3" opacity=".7"/>'
    return s


def highlights(cx, cy, big=1.0, wet=False, k=1.0, flip=False):
    """Eye highlights at fixed offsets from the iris centre (k scales them; flip mirrors x)."""
    f = -1 if flip else 1
    s = ell(cx - 8 * k * f, cy - 11 * k, 7 * big * k, 8.5 * big * k, "#fff", rot=-18 * f)
    s += circ(cx + 9 * k * f, cy + 10 * k, 3.2 * k, "#fff")
    s += circ(cx - 8 * k * f, cy + 11 * k, 1.6 * k, "#fff", .9)
    s += P(f"M{F(cx+12*k*f)} {F(cy-14*k)} C{F(cx+16*k*f)} {F(cy-8*k)} {F(cx+17*k*f)} {F(cy-2*k)} {F(cx+16*k*f)} {F(cy+4*k)}",
           stroke="#fff", sw=1.6, op=.8)
    if wet:
        s += circ(cx + 3 * k * f, cy - 15 * k, 2.4 * k, "#fff")
        s += circ(cx - 12 * k * f, cy + 4 * k, 1.8 * k, "#fff", .9)
        s += P(f"M{F(cx-14*k)} {F(cy+16*k)} C{F(cx-6*k)} {F(cy+21*k)} {F(cx+6*k)} {F(cy+21*k)} {F(cx+14*k)} {F(cy+15*k)}",
               stroke="#ffffff", sw=1.8, op=.85)
    return s


def eyes(shape, irisfn, lash_col, centers=((EXL, E), (EXR, E)), sx=(1.0, 1.0), gaze=(0, 0),
         iris_r=(21, 25), big=1.0, wet=False, hl=True, crease_col=CREASE, lower_col=None,
         pool=False, hl_flip=False, only=None):
    """Both eyes. shape: key of EYES or a dict. irisfn(cx, cy, rx, ry) draws the iris in head-local coords."""
    sh = EYES[shape] if isinstance(shape, str) else shape
    s = ""
    for i, ((cx, cy), k) in enumerate(zip(centers, sx)):
        if only is not None and i != only:
            continue
        flip = (i == 1)
        tf = eye_tf(cx, cy, k, flip)
        icx, icy = cx + gaze[0] * k, cy + gaze[1]
        cid = uid("sc")
        s += f'<clipPath id="{I(cid)}"><path d="{sh["scl"]}" transform="{tf}"/></clipPath>'
        inner = P(sh["scl"], fill=sclera(), extra=f'transform="{tf}"')
        ir = irisfn(icx, icy, iris_r[0] * k, iris_r[1])
        if hl:
            ir += highlights(icx, icy, big, wet, k=min(1.0, .55 + .45 * k), flip=hl_flip)
        if pool:
            pd = ("M305 336 C313 349 326 354 338 353 C350 352 358 346 362 335 L362 328 "
                  "C356 339 348 345 338 346 C326 347 313 342 305 331 Z")
            ir += P(pd, fill="#c8ecff", op=.55, extra=f'transform="{tf}"')
            ir += P("M306 333 C314 343 326 347 338 346 C348 345 356 340 361 331", stroke="#ffffff", sw=1.6, op=.95,
                    extra=f'transform="{tf}"')
        s += inner + g(ir, extra=f'clip-path="{U(cid)}"')
        part = P(sh["lash"], fill=lash_col)
        if sh.get("flick"):
            part += P(sh["flick"], fill=lash_col)
        if sh.get("lower"):
            part += P(sh["lower"], stroke=lower_col or lash_col, sw=1.7, op=.75)
        if sh.get("crease"):
            part += P(sh["crease"], stroke=crease_col, sw=1.5, op=.75)
        s += g(part, tf)
    return s


def closed_eyes(kind, lash_col, centers=((EXL, E), (EXR, E)), sx=(1.0, 1.0), only=None):
    s = ""
    for i, ((cx, cy), k) in enumerate(zip(centers, sx)):
        if only is not None and i != only:
            continue
        tf = eye_tf(cx, cy, k, i == 1)
        if kind == "happy":
            c = P(CLOSED_HAPPY, fill=lash_col) + P(CLOSED_HAPPY_LASH, fill=lash_col)
            c += P("M314 344 C322 349 332 350 342 347", stroke=CREASE, sw=1.4, op=.6)
        elif kind == "down":
            c = P(CLOSED_DOWN, fill=lash_col) + P(CLOSED_DOWN_LASH, fill=lash_col)
            c += P(CLOSED_LOWER, stroke=CREASE, sw=1.3, op=.6)
        elif kind == "squeeze":
            c = P(SQUEEZE, fill=lash_col)
        s += g(c, tf)
    return s


def brow_pair(d, col, centers=((EXL, E), (EXR, E)), sx=(1.0, 1.0), halo="#f6d3dc", only=None):
    s = ""
    for i, ((cx, cy), k) in enumerate(zip(centers, sx)):
        if only is not None and i != only:
            continue
        tf = eye_tf(cx, cy, k, i == 1)
        c = ""
        if halo:
            c += P(d, stroke=halo, sw=3.2, op=.55)
        c += P(d, fill=col)
        s += g(c, tf)
    return s


def blush(x, y, rx=28, ry=10, strong=False, hatch=True):
    if strong:
        gid = rad("blush2", [(0, "#ff6f8c", .8), (.6, "#ff7f96", .4), (1, "#ff8fa3", 0)])
    else:
        gid = rad("blush", [(0, "#ff8fa3", .55), (1, "#ff8fa3", 0)])
    s = ell(x, y, rx, ry, gid)
    if strong and hatch:
        for x0 in (x - 12, x - 2, x + 8):
            s += P(f"M{F(x0)} {F(y+8)} L{F(x0+6)} {F(y-1)}", stroke="#ff5a7a", sw=1.6, op=.55)
            s += P(f"M{F(x0+2)} {F(y+8)} L{F(x0+7)} {F(y+1)}", stroke="#ffffff", sw=.9, op=.6)
    return s


def tear_stream(d, hl=None):
    tg = lin("tear", [(0, "#ffffff", .95), (.6, "#e6f8ff", .8), (1, "#bfe9ff", .85)], 0, 0, 1, 0)
    s = P(d, fill=tg, stroke="#7fcff6", sw=1.1, op=.95)
    if hl:
        s += P(hl, stroke="#ffffff", sw=1.5)
    return s


def tear_drop(x, y, sc=1.0):
    tg = lin("tear", [(0, "#ffffff", .95), (.6, "#e6f8ff", .8), (1, "#bfe9ff", .85)], 0, 0, 1, 0)
    d = "M0 -6 C2 -2 4 1 4 3 C4 6 -4 6 -4 3 C-4 1 -2 -2 0 -6 Z"
    return g(P(d, fill=tg, stroke="#7fcff6", sw=1) + circ(-1.4, 2, .9, "#fff"), f"translate({F(x)} {F(y)}) scale({F(sc)})")


def mouth_open(d, tongue=None, teeth_top=None, teeth_bot=None, sw=1.8):
    s = P(d, fill="#8a2f3a", stroke="#6b2430", sw=sw)
    inner = ""
    if tongue:
        inner += P(tongue, fill="#f08a96")
    if teeth_top:
        inner += P(teeth_top, fill="#ffffff")
    if teeth_bot:
        inner += P(teeth_bot, fill="#ffffff")
    if inner:
        s += clipped(d, inner)
    return s


def face_base(face=FACE, jaw=JAW_SHADOW, bang_shadow=None, nose=True, blush_y=E + 40, blush_pos=(322, 438),
              nose_x=383, skin=SKIN, line=SKIN_LINE, blush_on=True):
    s = P(face, fill=skin, stroke=line, sw=2.2)
    if bang_shadow:
        s += clipped(face, P(bang_shadow, fill=SKIN_SH))
    if jaw:
        s += P(jaw, fill=SKIN_SH, op=.7)
    if blush_on:
        for bx in blush_pos:
            s += blush(bx, blush_y)
    if nose:
        s += P(f"M{nose_x} {E+30} C{nose_x-1} {E+34} {nose_x-3} {E+37} {nose_x-5} {E+39}", stroke=NOSE, sw=1.7)
        s += P(f"M{nose_x+2} {E+24} C{nose_x+3} {E+28} {nose_x+3} {E+31} {nose_x+2} {E+34}", stroke="#ffffff", sw=1.5, op=.8)
    return s


def place(x, y, s=1.0, rot=0, flip=False, ox=380, oy=330):
    """Transform mapping head-local (ox, oy) to (x, y) with scale s and rotation rot (deg)."""
    fx = f" scale(-1 1)" if flip else ""
    return f"translate({F(x)} {F(y)}) rotate({F(rot)}) scale({F(s)}){fx} translate({F(-ox)} {F(-oy)})"


def bang_edge(start, clumps, end, dx=0, dy=0, soft=False):
    """Lower edge of a bang fringe: clumps = [(notch_right, tip, notch_left)...] from screen-right to left."""
    def pt(p):
        return f"{F(p[0]+dx)} {F(p[1]+dy)}"
    out = f" C{pt((start[0]-1, start[1]-14))} {pt((clumps[0][0][0]+4, clumps[0][0][1]+8))} {pt(clumps[0][0])}"
    for nr, t, nl in clumps:
        if soft:
            t = (t[0], t[1] - 6)
        c1 = (nr[0] - (nr[0] - t[0]) * .08, nr[1] + (t[1] - nr[1]) * .55)
        c2 = (t[0] + (nr[0] - t[0]) * .38, t[1] - (t[1] - nr[1]) * .28)
        out += f" C{pt(c1)} {pt(c2)} {pt(t)}"
        c1 = (t[0] - (t[0] - nl[0]) * .22, t[1] - (t[1] - nl[1]) * .38)
        c2 = (nl[0] + (t[0] - nl[0]) * .12, nl[1] + (t[1] - nl[1]) * .5)
        out += f" C{pt(c1)} {pt(c2)} {pt(nl)}"
    nl = clumps[-1][2]
    out += f" C{pt((nl[0]-4, nl[1]+12))} {pt((end[0]+1, end[1]-14))} {pt(end)}"
    return out


# ------------------------------------------------------------------ glass
def glass_threads(paths, w=4.0, core=1.1):
    """paths: list of (glow colour, core colour, d)."""
    s = ""
    for col, corecol, d in paths:
        s += P(d, stroke=col, sw=w, op=.55, extra=blur(2))
        s += P(d, stroke=corecol, sw=core, op=.9)
    return s


def svg_open(W=1920, H=1080):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n')


def write(path, body, W=1920, H=1080):
    s = svg_open(W, H) + defs() + '\n<g stroke-linejoin="round" stroke-linecap="round">' + body + "</g>\n</svg>\n"
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(s)
    return len(s)


# ------------------------------------------------------------------ hands
def _dirn(ang):
    a = math.radians(ang)
    return math.sin(a), -math.cos(a), math.cos(a), math.sin(a)   # dir (dx, dy), normal to +x (nx, ny)


def capsule(x0, y0, ang, length, w0, w1, bulge=.12):
    """Finger-like capsule from base (x0, y0) along ang (0 = up, + = clockwise)."""
    dx, dy, nx, ny = _dirn(ang)
    x1, y1 = x0 + dx * length, y0 + dy * length
    L0 = (x0 - nx * w0 / 2, y0 - ny * w0 / 2)
    R0 = (x0 + nx * w0 / 2, y0 + ny * w0 / 2)
    L1 = (x1 - nx * w1 / 2, y1 - ny * w1 / 2)
    R1 = (x1 + nx * w1 / 2, y1 + ny * w1 / 2)
    tip = (x1 + dx * w1 * .5, y1 + dy * w1 * .5)
    b = bulge * (w0 + w1) / 2
    mL = ((L0[0] + L1[0]) / 2 - nx * b, (L0[1] + L1[1]) / 2 - ny * b)
    mR = ((R0[0] + R1[0]) / 2 + nx * b, (R0[1] + R1[1]) / 2 + ny * b)
    k = .552 * w1 / 2
    d = (f"M{F(R0[0])} {F(R0[1])} Q{F(mR[0])} {F(mR[1])} {F(R1[0])} {F(R1[1])} "
         f"C{F(R1[0] + dx*k)} {F(R1[1] + dy*k)} {F(tip[0] + nx*k)} {F(tip[1] + ny*k)} {F(tip[0])} {F(tip[1])} "
         f"C{F(tip[0] - nx*k)} {F(tip[1] - ny*k)} {F(L1[0] + dx*k)} {F(L1[1] + dy*k)} {F(L1[0])} {F(L1[1])} "
         f"Q{F(mL[0])} {F(mL[1])} {F(L0[0])} {F(L0[1])} Z")
    return d, (x1, y1), tip


def finger_pts(x0, y0, ang, length):
    dx, dy, nx, ny = _dirn(ang)
    return (x0 + dx * length, y0 + dy * length)


def hand_back(fingers, thumb, palm=(56, 66, 64), skin=SKIN, sh=SKIN_SH, line=SKIN_LINE, nails=True, sw=2.4):
    """Back of a right hand in its own frame: wrist centre at origin, fingers toward -y,
    thumb on the -x side. fingers: [(base_dx, base_dy, ang, length, w0, w1)] index..pinky.
    thumb: (bx, by, ang, length, w0, w1). Returns svg."""
    ww, wk, pl = palm
    s = ""
    # thumb (behind the palm edge)
    td, tend, ttip = capsule(*thumb)
    s += P(td, fill=skin, stroke=line, sw=sw)
    tdx, tdy, tnx, tny = _dirn(thumb[2])
    s += clipped(td, P(f"M{F(thumb[0])} {F(thumb[1])} L{F(tend[0] + tnx*thumb[5]*.1)} {F(tend[1] + tny*thumb[5]*.1)} L{F(tend[0] + tnx*thumb[5])} {F(tend[1] + tny*thumb[5])} L{F(thumb[0] + tnx*thumb[4])} {F(thumb[1] + tny*thumb[4])} Z", fill=sh))
    # fingers
    fd = []
    for (bx, by, ang, ln, w0, w1) in fingers:
        d, end, tip = capsule(bx, by, ang, ln, w0, w1)
        fd.append((d, bx, by, ang, ln, w0, w1, end, tip))
    for (d, bx, by, ang, ln, w0, w1, end, tip) in reversed(fd):
        s += P(d, fill=skin, stroke=line, sw=sw)
        dx, dy, nx, ny = _dirn(ang)
        # shadow strip on the right (away from the light)
        sd = (f"M{F(bx + nx*w0*.18)} {F(by + ny*w0*.18)} L{F(end[0] + nx*w1*.12)} {F(end[1] + ny*w1*.12)} "
              f"L{F(end[0] + nx*w1)} {F(end[1] + ny*w1)} L{F(bx + nx*w0)} {F(by + ny*w0)} Z")
        s += clipped(d, P(sd, fill=sh))
        if nails:
            nx0, ny0 = end[0] - dx * w1 * .15, end[1] - dy * w1 * .15
            nd = (f"M{F(nx0 - nx*w1*.3)} {F(ny0 - ny*w1*.3)} C{F(nx0 - nx*w1*.32 + dx*w1*.7)} {F(ny0 - ny*w1*.32 + dy*w1*.7)} "
                  f"{F(nx0 + nx*w1*.32 + dx*w1*.7)} {F(ny0 + ny*w1*.32 + dy*w1*.7)} {F(nx0 + nx*w1*.3)} {F(ny0 + ny*w1*.3)} Z")
            s += P(nd, fill="#ffeef0", stroke=line, sw=1.1, op=.85)
        # knuckle crease
        kx, ky = bx + dx * ln * .55, by + dy * ln * .55
        s += P(f"M{F(kx - nx*w0*.22)} {F(ky - ny*w0*.22)} Q{F(kx + dx*2)} {F(ky + dy*2)} {F(kx + nx*w0*.22)} {F(ky + ny*w0*.22)}",
               stroke=line, sw=1.1, op=.45)
    # back of the hand, with the thenar bulge on the thumb side
    tx, ty = thumb[0], thumb[1]
    pd = (f"M{F(-ww/2)} 0 C{F(-ww/2 - 6)} {F(ty*.4)} {F(tx - 6)} {F(ty + 6)} {F(tx - 4)} {F(ty - 4)} "
          f"C{F(tx)} {F(ty - 14)} {F(-wk/2 - 2)} {F(-pl*.75)} {F(-wk/2)} {F(-pl)} "
          f"C{F(-wk/4)} {F(-pl - 8)} {F(wk/4)} {F(-pl - 8)} {F(wk/2)} {F(-pl + 4)} "
          f"C{F(wk/2 + 1)} {F(-pl*.6)} {F(ww/2 + 2)} {F(-pl*.3)} {F(ww/2)} 0 Z")
    s += P(pd, fill=skin)
    s += P(f"M{F(-ww/2)} 0 C{F(-ww/2 - 6)} {F(ty*.4)} {F(tx - 6)} {F(ty + 6)} {F(tx - 4)} {F(ty - 4)}", stroke=line, sw=sw)
    s += P(f"M{F(tx + 2)} {F(ty - 16)} C{F(tx + 4)} {F(ty - 24)} {F(-wk/2 - 2)} {F(-pl*.75)} {F(-wk/2)} {F(-pl)}", stroke=line, sw=sw*.8, op=.8)
    s += P(f"M{F(wk/2)} {F(-pl + 4)} C{F(wk/2 + 1)} {F(-pl*.6)} {F(ww/2 + 2)} {F(-pl*.3)} {F(ww/2)} 0", stroke=line, sw=sw)
    s += clipped(pd, P(f"M{F(wk*.18)} {F(-pl - 10)} C{F(wk*.3)} {F(-pl*.5)} {F(ww*.3)} {F(-pl*.2)} {F(ww*.25)} 10 L60 10 L60 {F(-pl - 10)} Z", fill=sh))
    # knuckle bumps and tendons
    for (bx, by, ang, ln, w0, w1) in fingers[:3]:
        s += P(f"M{F(bx - w0*.3)} {F(by + 3)} Q{F(bx)} {F(by - 3)} {F(bx + w0*.3)} {F(by + 3)}", stroke=line, sw=1.2, op=.4)
        s += P(f"M{F(bx*.6)} {F(by + 12)} L{F(bx*.25)} {F(-pl*.25)}", stroke=line, sw=1, op=.22)
    return s


def _cr(pts, closed=False):
    """Catmull-Rom through pts -> list of cubic segments (p0, c1, c2, p1)."""
    segs = []
    n = len(pts)
    for i in range(n - 1 if not closed else n):
        p0 = pts[i - 1] if (i > 0 or closed) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (i + 2 < n or closed) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        segs.append((p1, c1, c2, p2))
    return segs


def smooth(pts, closed=False):
    segs = _cr(pts, closed)
    d = f"M{F(pts[0][0])} {F(pts[0][1])}"
    for (_, c1, c2, p) in segs:
        d += f" C{F(c1[0])} {F(c1[1])} {F(c2[0])} {F(c2[1])} {F(p[0])} {F(p[1])}"
    return d + (" Z" if closed else "")


def tube_sides(pts):
    """pts: [(x, y, w)] centreline with widths. Returns (left, right) side point lists."""
    L, R = [], []
    n = len(pts)
    for i, (x, y, w) in enumerate(pts):
        if i == 0:
            dx, dy = pts[1][0] - x, pts[1][1] - y
        elif i == n - 1:
            dx, dy = x - pts[i - 1][0], y - pts[i - 1][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        L.append((x + nx * w / 2, y + ny * w / 2))
        R.append((x - nx * w / 2, y - ny * w / 2))
    return L, R


def tube(pts, cap=True, base_cap=False):
    """Smooth closed outline around a centreline with widths; round tip cap."""
    L, R = tube_sides(pts)
    x, y, w = pts[-1]
    px, py = pts[-2][0], pts[-2][1]
    ln = math.hypot(x - px, y - py) or 1
    dx, dy = (x - px) / ln, (y - py) / ln
    r = w / 2
    k = .552 * r
    d = smooth(R)
    tip = (x + dx * r, y + dy * r)
    if cap:
        d += (f" C{F(R[-1][0] + dx*k)} {F(R[-1][1] + dy*k)} {F(tip[0] - (L[-1][0]-x)/r*k)} {F(tip[1] - (L[-1][1]-y)/r*k)} {F(tip[0])} {F(tip[1])}"
              f" C{F(tip[0] + (L[-1][0]-x)/r*k)} {F(tip[1] + (L[-1][1]-y)/r*k)} {F(L[-1][0] + dx*k)} {F(L[-1][1] + dy*k)} {F(L[-1][0])} {F(L[-1][1])}")
    else:
        d += f" L{F(L[-1][0])} {F(L[-1][1])}"
    Lr = list(reversed(L))
    segs = _cr(Lr)
    for (_, c1, c2, p) in segs:
        d += f" C{F(c1[0])} {F(c1[1])} {F(c2[0])} {F(c2[1])} {F(p[0])} {F(p[1])}"
    if base_cap:
        x0, y0, w0 = pts[0]
        dx0, dy0 = pts[1][0] - x0, pts[1][1] - y0
        l0 = math.hypot(dx0, dy0) or 1
        dx0, dy0 = dx0 / l0, dy0 / l0
        r0 = w0 / 2
        k0 = .552 * r0
        b = (x0 - dx0 * r0, y0 - dy0 * r0)
        d += (f" C{F(L[0][0] - dx0*k0)} {F(L[0][1] - dy0*k0)} {F(b[0] + (L[0][0]-x0)/r0*k0)} {F(b[1] + (L[0][1]-y0)/r0*k0)} {F(b[0])} {F(b[1])}"
              f" C{F(b[0] - (L[0][0]-x0)/r0*k0)} {F(b[1] - (L[0][1]-y0)/r0*k0)} {F(R[0][0] - dx0*k0)} {F(R[0][1] - dy0*k0)} {F(R[0][0])} {F(R[0][1])}")
    return d + " Z"


def polar(x, y, ang, ln):
    """Point at distance ln from (x, y) along ang (0 = up, + = clockwise)."""
    a = math.radians(ang)
    return (x + math.sin(a) * ln, y - math.cos(a) * ln)


def finger_line(base, angs, lens, widths):
    """Centreline for a jointed finger: base (x, y), segment angles & lengths, widths at each node."""
    pts = [(base[0], base[1], widths[0])]
    x, y = base
    for i, (a, l) in enumerate(zip(angs, lens)):
        # subdivide each phalanx so the outline bends smoothly at the joints
        nx, ny = polar(x, y, a, l)
        mx, my = (x + nx) / 2, (y + ny) / 2
        wm = (widths[i] + widths[i + 1]) / 2
        pts.append((mx, my, wm))
        pts.append((nx, ny, widths[i + 1]))
        x, y = nx, ny
    return pts



# ------------------------------------------------------------------ compact repeats
def dots(pts, fill, op=None, extra=""):
    """Many round dots, compactly: zero-length round-capped segments grouped by radius (pts: (x, y, r))."""
    if not pts:
        return ""
    by = {}
    for x, y, r in pts:
        q = max(.5, round(r * 2) / 2)
        by.setdefault(q, []).append((x, y))
    out = ""
    for q, v in sorted(by.items()):
        d = "".join(f"M{F(x)} {F(y)}h0" for x, y in v)
        out += f'<path d="{d}" stroke="{fill}" stroke-width="{F(2*q)}" stroke-linecap="round"/>'
    a = ""
    if op is not None:
        a += f' opacity="{F(op)}"'
    if extra:
        a += " " + extra
    return f"<g{a}>{out}</g>" if a else out


def bead_field(beads, hl=True, op=None):
    """beads: (x, y, r, colour). One path per colour plus one for all highlights."""
    by = {}
    for x, y, r, c in beads:
        by.setdefault(c, []).append((x, y, r))
    s = "".join(dots(v, c, op) for c, v in by.items())
    if hl:
        s += dots([(x - r * .32, y - r * .36, r * .32) for x, y, r, c in beads if r >= 2.2], "#ffffff", .9)
    return s


def symbol(name, content):
    add_def("sym-" + name, f'<g id="{I("s-" + name)}">{content}</g>')


def use(name, tf):
    return f'<use xlink:href="#{I("s-" + name)}" transform="{tf}"/>'
