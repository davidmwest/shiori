"""3/4 kneeling figures (facing right; mirror for left), head-local frame (head centre x=380, chin 411)."""
import math
import cglib as L
from cglib import *

TORSO34 = ("M356 448 C330 452 292 462 272 484 C256 500 248 524 246 556 C244 600 244 650 248 700 "
           "C250 760 254 830 244 900 C236 960 236 1000 240 1040 L640 1040 C650 980 648 920 634 870 "
           "C620 820 596 796 566 782 C546 774 526 768 512 760 "
           "C504 720 500 680 500 640 C500 600 498 560 490 528 C484 504 470 488 452 476 C436 464 420 456 404 450 Z")
TORSO34_SH = "M246 540 C244 600 244 660 250 720 C254 790 262 860 256 920 C252 980 254 1010 262 1040 L200 1040 L210 520 Z"


def arm(sh, el, wr, w=(54, 46, 40)):
    """Smooth arm centreline shoulder -> elbow -> wrist with widths; returns closed outline."""
    pts = [(sh[0], sh[1], w[0]), ((sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2, (w[0] + w[1]) / 2), (el[0], el[1], w[1]),
           ((el[0] + wr[0]) / 2, (el[1] + wr[1]) / 2, (w[1] + w[2]) / 2), (wr[0], wr[1], w[2])]
    return tube(pts, cap=False), pts


def sleeve_on(pts, upto, extra_w=10):
    """Outline of a sleeve covering the first `upto` centreline nodes, a little wider than the arm."""
    sub = [(x, y, w + extra_w) for x, y, w in pts[:upto]]
    return tube(sub, cap=False)


def hand_fist_side(x, y, ang=0, s=1.0, skin=SKIN, line=SKIN_LINE):
    """A loosely closed hand from the side (fingers curled under), for holding."""
    d = "M-20 -16 C-6 -22 14 -22 26 -14 C36 -8 38 6 32 14 C24 22 6 24 -10 20 C-22 16 -28 4 -26 -6 C-25 -11 -23 -14 -20 -16 Z"
    c = P(d, fill=skin, stroke=line, sw=2.2)
    for i in range(3):
        c += P(f"M{8 + i*8} -14 C{11 + i*8} -6 {11 + i*8} 4 {8 + i*8} 12", stroke=line, sw=1.2, op=.55)
    return g(c, f"translate({F(x)} {F(y)}) rotate({F(ang)}) scale({F(s)})")


TORSO34_STAND = ("M356 448 C330 452 296 462 276 482 C260 498 252 520 250 548 C248 600 252 660 256 720 "
                 "C260 800 262 900 264 1000 L268 1320 L516 1320 L512 1000 C510 900 506 800 504 720 C502 660 504 600 498 548 "
                 "C494 516 484 494 466 480 C446 464 424 456 404 450 Z")
COAT34 = ("M352 448 C318 452 280 464 258 486 C238 506 230 536 228 572 C224 640 226 760 228 1000 L230 1320 L532 1320 L532 1000 "
          "C532 760 532 640 526 572 C522 534 512 506 492 488 C470 468 440 456 408 450 Z")


def wide_sleeve(el, wr, drop=110, w=40, back=10):
    """Haori/kimono sleeve: a wide drape hanging below the forearm from elbow to wrist (head-local)."""
    ex, ey = el
    wx, wy = wr
    d = (f"M{F(ex - back)} {F(ey - w*.5)} L{F(wx)} {F(wy - w*.5)} C{F(wx + 8)} {F(wy)} {F(wx + 6)} {F(wy + drop*.6)} {F(wx - 4)} {F(wy + drop)} "
         f"C{F((ex + wx)/2)} {F(max(ey, wy) + drop + 16)} {F(ex - back - 10)} {F(ey + drop + 10)} {F(ex - back - 14)} {F(ey + drop*.5)} Z")
    return d



def cap_sleeve(sh, el, w=66, roll=True):
    """Short puffy sleeve over the upper arm (head-local), with a rolled cuff band."""
    ax, ay = sh
    bx, by = el
    mx, my = ax + (bx - ax) * .55, ay + (by - ay) * .55
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    nx, ny = -dy / ln, dx / ln
    h = w / 2
    d = (f"M{F(ax + nx*h*1.1 - dx*.12)} {F(ay + ny*h*1.1 - dy*.12)} "
         f"C{F(ax + nx*h*1.3 + dx*.2)} {F(ay + ny*h*1.3 + dy*.2)} {F(mx + nx*h*1.2)} {F(my + ny*h*1.2)} {F(mx + nx*h*1.08)} {F(my + ny*h*1.08)} "
         f"L{F(mx - nx*h*1.08)} {F(my - ny*h*1.08)} "
         f"C{F(mx - nx*h*1.2 - dx*.2)} {F(my - ny*h*1.2 - dy*.2)} {F(ax - nx*h*1.2 - dx*.1)} {F(ay - ny*h*1.2 - dy*.1)} {F(ax - nx*h*.8 - dx*.2)} {F(ay - ny*h*.8 - dy*.2)} Z")
    cuff = None
    if roll:
        c0 = (mx - dx * .04, my - dy * .04)
        c1 = (mx + dx * .1, my + dy * .1)
        cuff = (f"M{F(c0[0] + nx*h*1.1)} {F(c0[1] + ny*h*1.1)} L{F(c1[0] + nx*h*1.1)} {F(c1[1] + ny*h*1.1)} "
                f"L{F(c1[0] - nx*h*1.1)} {F(c1[1] - ny*h*1.1)} L{F(c0[0] - nx*h*1.1)} {F(c0[1] - ny*h*1.1)} Z")
    return d, cuff
