"""A better rinpa-style red-crowned crane for the kiln-house folding screen (QA pass)."""
import math


def _n(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1])


def _wing(sc=1.0, up=True):
    """Return (wing_d, black_band_d, feather_lines_d) for a raised wing, shoulder at the origin, facing right."""
    k = sc
    fy = 1 if up else -0.78
    P = lambda x, y: (x * k, y * k * fy)
    # leading edge: shoulder -> wrist (pushed forward) -> tip
    lead = [P(6, -6), P(30, -46), P(24, -98), P(0, -132)]
    tip = P(-26, -156)
    # trailing edge: tip -> primaries -> secondaries -> back of the body, scalloped
    tr = [tip, P(-74, -136), P(-74, -54), P(-52, -2)]
    nf = 10
    ts = [(i / nf) ** 0.9 for i in range(nf + 1)]
    pts = [_bez(*tr, t) for t in ts]
    d = f"M{_n(lead[0][0])},{_n(lead[0][1])} C{_n(lead[1][0])},{_n(lead[1][1])} {_n(lead[2][0])},{_n(lead[2][1])} {_n(lead[3][0])},{_n(lead[3][1])}"
    c0 = P(-6, -150)
    d += f" Q{_n(c0[0])},{_n(c0[1])} {_n(tip[0])},{_n(tip[1])}"
    scal = []
    for i in range(nf):
        a, b = pts[i], pts[i + 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = dy / L, -dx / L
        if not up:
            nx, ny = -nx, -ny
        prim = i < 4
        bulge = (13 if prim else 7) * k
        # primaries: long finger feathers that point back along the wing; secondaries: round scallops
        if prim:
            c = (a[0] + dx * .2 + nx * bulge, a[1] + dy * .2 + ny * bulge)
        else:
            c = ((a[0] + b[0]) / 2 + nx * bulge, (a[1] + b[1]) / 2 + ny * bulge)
        scal.append((c, b))
        d += f" Q{_n(c[0])},{_n(c[1])} {_n(b[0])},{_n(b[1])}"
    e1, e2 = P(-30, 0), P(-8, -3)
    d += f" C{_n(e1[0])},{_n(e1[1])} {_n(e2[0])},{_n(e2[1])} {_n(lead[0][0])},{_n(lead[0][1])} Z"
    # black secondaries: the inner trailing feathers, with a soft curved inner edge
    i0 = 4
    band = f"M{_n(pts[i0][0])},{_n(pts[i0][1])}"
    for c, b in scal[i0:]:
        band += f" Q{_n(c[0])},{_n(c[1])} {_n(b[0])},{_n(b[1])}"
    q1, q2, q3 = P(-34, -8), P(-46, -50), P(-50, -92)
    band += f" C{_n(q1[0])},{_n(q1[1])} {_n(q2[0])},{_n(q2[1])} {_n(q3[0])},{_n(q3[1])}"
    band += f" L{_n(pts[i0][0])},{_n(pts[i0][1])} Z"
    # feather separations on the white primaries and coverts
    lines = ""
    for i in range(1, i0 + 1):
        a = pts[i]
        b = (a[0] + 30 * k, a[1] + 14 * k * fy)
        lines += f"M{_n(a[0])},{_n(a[1])} L{_n(b[0])},{_n(b[1])} "
    w1, w2 = P(-40, -96), P(10, -62)
    lines += f"M{_n(w1[0])},{_n(w1[1])} Q{_n(P(-10,-90)[0])},{_n(P(-10,-90)[1])} {_n(w2[0])},{_n(w2[1])}"
    return d, band, lines


def crane(x, y, s, flip=1, up=True):
    """Red-crowned crane in flight, facing right (flip=-1 faces left); wings raised (up) or swept down."""
    out = f'<g transform="translate({x} {y}) scale({s * flip} {s})" stroke-linejoin="round" stroke-linecap="round">'
    fw, fb, fl = _wing(0.78, up)
    nw, nb, nl = _wing(1.0, up)
    # far wing, set back and a touch higher, in shadow
    out += f'<g transform="translate(-18 -10) rotate(-16)"><path d="{fw}" fill="#e4e2f0" stroke="#6d6a9e" stroke-width="1.8"/><path d="{fb}" fill="#3a3850"/></g>'
    # legs trailing behind
    out += '<path d="M-40,4 C-62,8 -96,12 -124,13 M-40,7 C-62,13 -92,19 -120,22" stroke="#2a2a3a" stroke-width="2.2" fill="none"/>'
    # body and black tail plumes
    out += '<path d="M-56,3 C-40,-12 -2,-15 26,-6 C14,8 -20,13 -56,3Z" fill="#ffffff" stroke="#6d6a9e" stroke-width="2"/>'
    out += '<path d="M-44,0 C-56,6 -68,14 -80,14 C-70,8 -62,0 -58,-6 C-54,-2 -50,0 -44,0Z" fill="#2a2a3a"/>'
    # long black neck, white nape, red crown, olive bill
    out += '<path d="M22,-5 C36,-10 48,-14 58,-18 C62,-19.5 66,-20.5 70,-21" stroke="#2a2a3a" stroke-width="5.5" fill="none"/>'
    out += '<path d="M30,-10 C40,-14 50,-17 60,-20" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".75"/>'
    out += '<ellipse cx="72" cy="-21" rx="6.5" ry="5" fill="#2a2a3a"/><path d="M68,-25.5 C70.5,-28 75,-28 77,-25 C74,-24 71,-24 68,-25.5Z" fill="#e8403a"/>'
    out += '<path d="M77,-20 L96,-16.5" stroke="#c8a456" stroke-width="2.6"/><circle cx="73.5" cy="-21.5" r="1.1" fill="#ffffff"/>'
    # near wing on top
    out += f'<path d="{nw}" fill="#ffffff" stroke="#6d6a9e" stroke-width="2"/><path d="{nb}" fill="#2a2a3a"/>'
    out += f'<path d="{nl}" stroke="#c9c6e0" stroke-width="1.4" fill="none"/>'
    out += '</g>'
    return out

