"""Small helpers for hand-building background SVGs."""
import math, random


def n(v):
    """Compact number formatting (1 decimal, integers for large magnitudes)."""
    if abs(v) >= 100:
        return str(int(round(v)))
    s = f'{v:.1f}'
    if s.endswith('.0'):
        s = s[:-2]
    if s == '-0':
        s = '0'
    return s


def pts(points):
    return ' '.join(f'{n(x)},{n(y)}' for x, y in points)


def poly(points, **attrs):
    return f'<polygon points="{pts(points)}"{A(attrs)}/>'


def A(attrs):
    out = ''
    for k, v in attrs.items():
        k = k.rstrip('_').replace('_', '-')
        if isinstance(v, float):
            v = n(v)
        out += f' {k}="{v}"'
    return out


def el(tag, **attrs):
    return f'<{tag}{A(attrs)}/>'


def circle(cx, cy, r, **attrs):
    return f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}"{A(attrs)}/>'


def ellipse(cx, cy, rx, ry, **attrs):
    return f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}"{A(attrs)}/>'


def rect(x, y, w, h, **attrs):
    return f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}"{A(attrs)}/>'


def path(d, **attrs):
    return f'<path d="{d}"{A(attrs)}/>'


def line(x1, y1, x2, y2, **attrs):
    return f'<line x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"{A(attrs)}/>'


def smooth(points, closed=True, tension=0.5):
    """Catmull-Rom spline through points -> cubic bezier path data."""
    P = list(points)
    if len(P) < 3:
        return 'M' + ' L'.join(f'{n(x)},{n(y)}' for x, y in P) + ('Z' if closed else '')
    m = len(P)
    d = f'M{n(P[0][0])},{n(P[0][1])}'
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0 = P[(i - 1) % m] if (closed or i > 0) else P[0]
        p1 = P[i]
        p2 = P[(i + 1) % m]
        p3 = P[(i + 2) % m] if (closed or i + 2 < m) else P[-1]
        k = tension / 3 * 2
        c1 = (p1[0] + (p2[0] - p0[0]) * k / 2, p1[1] + (p2[1] - p0[1]) * k / 2)
        c2 = (p2[0] - (p3[0] - p1[0]) * k / 2, p2[1] - (p3[1] - p1[1]) * k / 2)
        d += f' C{n(c1[0])},{n(c1[1])} {n(c2[0])},{n(c2[1])} {n(p2[0])},{n(p2[1])}'
    if closed:
        d += 'Z'
    return d


def blob(cx, cy, rx, ry, k=10, jit=0.15, rng=None, rot=0.0):
    rng = rng or random
    P = []
    for i in range(k):
        a = rot + 2 * math.pi * i / k
        f = 1 + rng.uniform(-jit, jit)
        P.append((cx + math.cos(a) * rx * f, cy + math.sin(a) * ry * f))
    return smooth(P)


def lin_grad(gid, stops, x1=0, y1=0, x2=0, y2=1, user=False, extra=''):
    u = ' gradientUnits="userSpaceOnUse"' if user else ''
    s = ''.join(stop(o, c) for o, c in stops)
    return f'<linearGradient id="{gid}"{u} x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"{extra}>{s}</linearGradient>'


def rad_grad(gid, stops, cx=.5, cy=.5, r=.5, user=False, fx=None, fy=None, extra=''):
    u = ' gradientUnits="userSpaceOnUse"' if user else ''
    f = ''
    if fx is not None:
        f = f' fx="{n(fx)}" fy="{n(fy)}"'
    s = ''.join(stop(o, c) for o, c in stops)
    return f'<radialGradient id="{gid}"{u} cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}"{f}{extra}>{s}</radialGradient>'


def stop(o, c):
    if isinstance(c, tuple):
        col, op = c
        return f'<stop offset="{o:g}" stop-color="{col}" stop-opacity="{op:g}"/>'
    return f'<stop offset="{o:g}" stop-color="{c}"/>'


def blur(fid, sd, pad=50):
    return (f'<filter id="{fid}" x="-{pad}%" y="-{pad}%" width="{100+2*pad}%" height="{100+2*pad}%">'
            f'<feGaussianBlur stdDeviation="{sd}"/></filter>')


def star4(cx, cy, r, w=0.18, **attrs):
    """Four-point sparkle."""
    a = r * w
    d = (f'M{n(cx)},{n(cy-r)} Q{n(cx+a*0.4)},{n(cy-a*0.4)} {n(cx+r)},{n(cy)} '
         f'Q{n(cx+a*0.4)},{n(cy+a*0.4)} {n(cx)},{n(cy+r)} Q{n(cx-a*0.4)},{n(cy+a*0.4)} {n(cx-r)},{n(cy)} '
         f'Q{n(cx-a*0.4)},{n(cy-a*0.4)} {n(cx)},{n(cy-r)}Z')
    return path(d, **attrs)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    a = [int(c1[i:i+2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i+2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(lerp(x, y, t)):02x}' for x, y in zip(a, b))


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
            u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])


class Spline:
    """Polyline sampled from a Catmull-Rom curve, parametrised by arc length 0..1."""
    def __init__(self, P, samples=400):
        self.P = P
        pts_ = []
        m = len(P)
        for i in range(m - 1):
            p0 = P[i - 1] if i > 0 else P[0]
            p1, p2 = P[i], P[i + 1]
            p3 = P[i + 2] if i + 2 < m else P[-1]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            for j in range(samples // (m - 1)):
                pts_.append(bez(p1, c1, c2, p2, j / (samples // (m - 1))))
        pts_.append(P[-1])
        self.pts = pts_
        L = [0.0]
        for a, b in zip(pts_, pts_[1:]):
            L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        self.L = L
        self.total = L[-1]

    def at(self, t):
        s = max(0, min(1, t)) * self.total
        L = self.L
        lo, hi = 0, len(L) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if L[mid] <= s:
                lo = mid
            else:
                hi = mid
        seg = L[hi] - L[lo] or 1
        u = (s - L[lo]) / seg
        a, b = self.pts[lo], self.pts[hi]
        p = (lerp(a[0], b[0], u), lerp(a[1], b[1], u))
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        return p, (dx / d, dy / d)


def svg_doc(defs, body, w=1920, h=1080):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n<defs>\n' + '\n'.join(defs) +
            '\n</defs>\n' + '\n'.join(body) + '\n</svg>\n')
