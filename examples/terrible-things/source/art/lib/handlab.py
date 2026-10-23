"""Lab for the hands CG: side-on clasp. Local frames: hand points +x (right); 0deg=up, 90=right."""
import math
import cglib as L
from cglib import *

# Nagi's right hand, palm up, seen from her right side and a little above. wrist centre at origin.
NAGI_PALM = ("M-40 -38 C20 -44 110 -52 176 -58 C200 -60 216 -50 222 -36 C226 -26 222 -18 226 -6 "
             "C230 6 226 20 218 30 C212 40 204 44 196 46 C170 56 140 62 110 64 C60 66 10 58 -40 44 Z")
#            base,        angles (0=up, 90=right),  lengths,        widths
# QA: fingers curled up under Suzu's top hand so the tips stop short of her glass wrists
NAGI_F = [((196, -44), (76, 46, 14), (54, 36, 26), (36, 33, 30, 26)),   # pinky (far, top)
          ((206, -22), (80, 50, 18), (62, 40, 28), (39, 36, 33, 29)),   # ring
          ((208, 4), (84, 54, 22), (66, 42, 30), (40, 37, 34, 30)),     # middle
          ((198, 36), (88, 58, 26), (62, 40, 28), (40, 37, 34, 30))]    # index (near)
NAGI_T = ((84, 42), (84, 62, 44), (58, 46, 36), (52, 45, 39, 33))      # thumb (nearest)


def skin_hand(palm, fingers, thumb, sw=3):
    s = ""
    for (base, angs, lens, ws) in fingers:
        pts = finger_line((base[0] - 14, base[1]), (90,) + angs, (14,) + lens, (ws[0],) + ws)
        d = tube(pts)
        s += P(d, fill=SKIN)
        Ls, Rs = tube_sides(pts)
        inner = tube_sides([(x, y, w*.25) for x, y, w in pts])[1]
        sd = smooth(Rs) + " " + " ".join(f"L{F(x)} {F(y)}" for x, y in reversed(inner)) + " Z"
        s += clipped(d, P(sd, fill=SKIN_SH))
        s += P(d[:-2], stroke=SKIN_LINE, sw=sw)
        for i in (4, 6):
            a, b = Ls[i], Rs[i]
            s += P(f"M{F(a[0]*.75 + b[0]*.25)} {F(a[1]*.75 + b[1]*.25)} L{F(a[0]*.35 + b[0]*.65)} {F(a[1]*.35 + b[1]*.65)}",
                   stroke=SKIN_LINE, sw=1.5, op=.5)
        tip = pts[-1]
        s += ell(tip[0] - 3, tip[1] - 2, tip[2] * .22, tip[2] * .16, "#ffffff", .6, rot=-30)
    # palm over the finger bases
    s += P(palm, fill=SKIN)
    s += clipped(palm, P("M-60 30 C40 52 120 58 240 36 L240 90 L-60 90 Z", fill=SKIN_SH)
                 + P("M60 -16 C96 -30 150 -36 196 -26", stroke=SKIN_LINE, sw=1.8, op=.45)
                 + P("M50 10 C90 0 140 -4 196 6", stroke=SKIN_LINE, sw=1.5, op=.35)
                 + P("M200 -40 C214 -30 216 -14 214 0", stroke=SKIN_LINE, sw=1.4, op=.35))
    s += P("M-40 -38 C20 -44 110 -52 176 -58 C200 -60 216 -50 222 -36", stroke=SKIN_LINE, sw=sw)
    s += P("M196 46 C170 56 140 62 110 64 C60 66 10 58 -40 44", stroke=SKIN_LINE, sw=sw)
    # thumb, nearest, curling up toward the fingers
    pts = finger_line(*thumb)
    d = tube(pts)
    s += P(d, fill=SKIN)
    Ls, Rs = tube_sides(pts)
    inner = tube_sides([(x, y, w*.2) for x, y, w in pts])[0]
    s += clipped(d, P(smooth(Ls) + " " + " ".join(f"L{F(x)} {F(y)}" for x, y in reversed(inner)) + " Z", fill=SKIN_SH, op=.0)
                 + P(smooth(Rs) + " " + " ".join(f"L{F(x)} {F(y)}" for x, y in reversed(tube_sides([(x, y, w*.2) for x, y, w in pts])[1])) + " Z", fill=SKIN_SH))
    s += P(d[:-2], stroke=SKIN_LINE, sw=sw)
    s += P(f"M{F(Ls[3][0])} {F(Ls[3][1])} L{F(Rs[3][0]*.6 + Ls[3][0]*.4)} {F(Rs[3][1]*.6 + Ls[3][1]*.4)}", stroke=SKIN_LINE, sw=1.5, op=.5)
    tip = pts[-1]
    s += ell(tip[0] - 2, tip[1] - 3, tip[2] * .22, tip[2] * .16, "#ffffff", .6, rot=-30)
    return s


# Suzu's top hand (her left), palm down over Nagi's palm, coming from the right. Same frame as Nagi's hand.
SUZU_TOP_BACK = ("M176 -100 C220 -108 280 -114 334 -114 C342 -98 344 -78 342 -58 C300 -46 240 -30 180 -14 "
                 "C168 -40 166 -74 176 -100 Z")
SUZU_TOP_BACK_STROKE = "M176 -100 C220 -108 280 -114 334 -114 M342 -58 C300 -46 240 -30 180 -14"
SUZU_TOP_F = [((180, -92), (264, 246, 226), (62, 42, 30), (34, 31, 28, 24)),   # index (far)
              ((176, -70), (262, 242, 220), (68, 46, 32), (35, 32, 29, 25)),   # middle
              ((176, -48), (258, 238, 216), (64, 42, 30), (34, 31, 28, 24)),   # ring
              ((180, -26), (254, 234, 212), (52, 36, 26), (31, 28, 25, 22))]   # pinky (near)
SUZU_TOP_T = ((300, -126), (266, 252, 240), (52, 40, 30), (40, 35, 30, 26))   # thumb, far side

# Suzu's bottom hand (her right), palm up under Nagi's hand
SUZU_BOT_PALM = ("M150 32 C200 36 270 44 340 50 C348 72 348 96 342 114 C280 112 210 106 152 98 "
                 "C140 78 140 52 150 32 Z")
SUZU_BOT_STROKE = "M342 114 C280 112 210 106 152 98 C142 84 140 62 146 44"
SUZU_BOT_F = [((154, 40), (272, 278, 290), (62, 42, 28), (33, 30, 27, 23)),
              ((152, 56), (270, 278, 292), (70, 46, 30), (34, 31, 28, 24)),
              ((152, 72), (268, 276, 290), (64, 42, 28), (33, 30, 27, 23)),
              ((154, 88), (266, 274, 286), (52, 36, 24), (30, 27, 24, 21))]


def glass_parts(parts, threads=(), glow=None, sw=3, frost=None):
    """parts: [(kind, d_closed, pts or None, stroke_d or None)] drawn as one clear glass object."""
    cid = uid("gl")
    s = f'<clipPath id="{I(cid)}">' + "".join(f'<path d="{d}"/>' for _, d, _, _ in parts) + "</clipPath>"
    inner = ""
    gb = lin("glassBody", [(0, "#ffffff", .38), (1, "#e9e6ff", .14)], 0, 0, 0, 1)
    for _, d, _, _ in parts:
        pass
    inner += f'<rect x="-400" y="-400" width="1200" height="800" fill="#f4f0ff" opacity=".16"/>'
    if glow:
        inner += glow
    if frost:
        inner += frost
    for _, d, _, _ in parts:
        inner += P(d, stroke="#4a5aa8", sw=12, op=.22, extra=blur(3))
    for col, core, d in threads:
        inner += P(d, stroke=col, sw=9, op=.6, extra=blur(3))
        inner += P(d, stroke=core, sw=2.2, op=.95)
    s += g(inner, extra=f'clip-path="{U(cid)}"')
    for kind, d, pts, sd in parts:
        s += P(sd or d, stroke=GLASS_LINE, sw=sw)
    for kind, d, pts, sd in parts:
        if not pts:
            continue
        Ls, Rs = tube_sides([(x, y, w * .66) for x, y, w in pts])
        s += P(smooth(Ls[2:-1]), stroke="#ffffff", sw=2.6, op=.9)
        Ls2, Rs2 = tube_sides([(x, y, w * .8) for x, y, w in pts])
        s += P(smooth(Rs2[3:]), stroke=rainbow(), sw=2.2, op=.85)
        tip = pts[-1]
        s += ell(tip[0], tip[1], tip[2] * .24, tip[2] * .17, "#ffffff", .9)
    return s


def suzu_top_parts():
    parts = []
    pts = finger_line(*SUZU_TOP_T)
    d = tube(pts)
    parts.append(("thumb", d, pts, d[:-2]))
    for (base, angs, lens, ws) in SUZU_TOP_F:
        pts = finger_line((base[0] + 12, base[1]), (270,) + angs, (12,) + lens, (ws[0],) + ws)
        d = tube(pts)
        parts.append(("finger", d, pts, d[:-2]))
    parts.append(("back", SUZU_TOP_BACK, None, SUZU_TOP_BACK_STROKE))
    return parts


def suzu_top_details():
    s = ""
    for (base, angs, lens, ws) in SUZU_TOP_F[:3]:
        x, y = base[0] + 12, base[1]
        s += P(f"M{x-4} {y-12} Q{x+6} {y} {x-4} {y+12}", stroke="#ffffff", sw=2.4, op=.8)
    s += P("M200 -98 C250 -104 300 -110 330 -110", stroke="#ffffff", sw=3.4, op=.9)
    s += sparkle(250, -100, 10) + sparkle(300, -60, 6, op=.9)
    return s


def suzu_bot_parts():
    parts = []
    for (base, angs, lens, ws) in SUZU_BOT_F:
        pts = finger_line((base[0] + 12, base[1]), (270,) + angs, (12,) + lens, (ws[0],) + ws)
        d = tube(pts)
        parts.append(("finger", d, pts, d[:-2]))
    parts.append(("palm", SUZU_BOT_PALM, None, SUZU_BOT_STROKE))
    return parts
