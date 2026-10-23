"""Small helper library for building the Shiomi background SVGs (seashore, square, statue_garden)."""
import math, random


PREC = 1


def f(x):
    """Compact number formatting (PREC decimals, default 1)."""
    if isinstance(x, int):
        return str(x)
    if PREC == 0:
        s = str(int(round(x)))
        return "0" if s == "-0" else s
    s = f"{x:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    if s == "-0":
        s = "0"
    return s


def f2(x):
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def stops(lst):
    out = []
    for st in lst:
        if len(st) == 2:
            o, c = st
            out.append(f'<stop offset="{f2(o)}" stop-color="{c}"/>')
        else:
            o, c, a = st
            out.append(f'<stop offset="{f2(o)}" stop-color="{c}" stop-opacity="{f2(a)}"/>')
    return "".join(out)


def lg(id, x1, y1, x2, y2, st, user=True, extra=""):
    u = ' gradientUnits="userSpaceOnUse"' if user else ""
    return (f'<linearGradient id="{id}"{u} x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"{extra}>'
            f'{stops(st)}</linearGradient>')


def rg(id, cx, cy, r, st, user=True, fx=None, fy=None, transform=None, extra=""):
    u = ' gradientUnits="userSpaceOnUse"' if user else ""
    fxy = ""
    if fx is not None:
        fxy = f' fx="{f2(fx) if not user else f(fx)}" fy="{f2(fy) if not user else f(fy)}"'
    t = f' gradientTransform="{transform}"' if transform else ""
    if user:
        c = f'cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"'
    else:
        c = f'cx="{f2(cx)}" cy="{f2(cy)}" r="{f2(r)}"'
    return f'<radialGradient id="{id}"{u} {c}{fxy}{t}{extra}>{stops(st)}</radialGradient>'


def blur(id, sd, pad=50):
    return (f'<filter id="{id}" x="-{pad}%" y="-{pad}%" width="{100+2*pad}%" height="{100+2*pad}%">'
            f'<feGaussianBlur stdDeviation="{sd}"/></filter>')


def catmull(points, closed=False, tension=1.0):
    """Smooth path through points (Catmull-Rom -> cubic Bezier). Returns path data without M if needed."""
    pts = list(points)
    n = len(pts)
    if n < 2:
        return ""
    d = [f"M{f(pts[0][0])} {f(pts[0][1])}"]
    rng_ = range(n if closed else n - 1)
    for i in rng_:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[0]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[min(i + 1, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension)
        d.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    if closed:
        d.append("Z")
    return "".join(d)


def catmull_cont(points, tension=1.0):
    """Like catmull but without the initial M (to continue a path)."""
    s = catmull(points, tension=tension)
    i = s.index("C")
    return s[i:]


def poly(points, close=True):
    d = "M" + " ".join(f"{f(x)} {f(y)}" for x, y in points)
    return d + ("Z" if close else "")


def lerp(a, b, t):
    return a + (b - a) * t


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return "#" + "".join(f"{max(0, min(255, int(round(v)))):02x}" for v in c)


def mix(a, b, t):
    ca, cb = hex2rgb(a), hex2rgb(b)
    return rgb2hex(tuple(lerp(ca[i], cb[i], t) for i in range(3)))


def grad_at(st, t):
    """Sample a list of (offset, color) at t."""
    if t <= st[0][0]:
        return st[0][1]
    for i in range(len(st) - 1):
        o0, c0 = st[i][0], st[i][1]
        o1, c1 = st[i + 1][0], st[i + 1][1]
        if o0 <= t <= o1:
            return mix(c0, c1, (t - o0) / (o1 - o0 if o1 > o0 else 1))
    return st[-1][1]


def star4(x, y, r, w=0.18):
    """Four-point sparkle path."""
    a = r * w
    return (f"M{f(x)} {f(y-r)}Q{f(x+a)} {f(y-a)} {f(x+r)} {f(y)}Q{f(x+a)} {f(y+a)} {f(x)} {f(y+r)}"
            f"Q{f(x-a)} {f(y+a)} {f(x-r)} {f(y)}Q{f(x-a)} {f(y-a)} {f(x)} {f(y-r)}Z")


def circle(x, y, r, fill, extra=""):
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}"{extra}/>'


def ellipse(x, y, rx, ry, fill, extra=""):
    return f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{extra}/>'


def path(d, fill="none", extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def rect(x, y, w, h, fill, extra=""):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}"{extra}/>'


def cumulus_puffs(rng, cx, base, w, h, n=None):
    """Return list of (x,y,r) circles forming a cumulus with flat base at `base`, width w, height h."""
    puffs = []
    n = n or int(w / 40) + 6
    for i in range(n):
        t = (i + rng.random() * 0.8) / n
        x = cx - w / 2 + t * w
        # dome profile: taller in the middle
        prof = math.sin(math.pi * min(max(t, 0.02), 0.98)) ** 0.8
        top = base - h * prof * (0.75 + 0.35 * rng.random())
        r = (base - top) * (0.45 + 0.25 * rng.random())
        r = max(r, h * 0.12)
        y = top + r
        y = min(y, base - r * 0.35)
        puffs.append((x, y, r))
    return puffs


class Doc:
    def __init__(self, w=1920, h=1080):
        self.w, self.h = w, h
        self.defs = []
        self.body = []

    def d(self, s):
        self.defs.append(s)

    def a(self, s):
        self.body.append(s)

    def svg(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">\n'
                f'<defs>\n' + "\n".join(self.defs) + '\n</defs>\n' + "\n".join(self.body) + '\n</svg>\n')

    def write(self, p):
        s = self.svg()
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(s)
        return len(s.encode())


def dashes_path(items, color, width, opacity=1, cap="round", extra=""):
    """items: list of (x, y, length). One path, many horizontal round-capped dashes."""
    if not items:
        return ""
    d = "".join(f"M{f(x)} {f(y)}h{f(l)}" for x, y, l in items)
    return (f'<path d="{d}" stroke="{color}" stroke-width="{f(width)}" stroke-linecap="{cap}" '
            f'fill="none" opacity="{f2(opacity)}"{extra}/>')


def dots_path(items, color, opacity=1, extra=""):
    """items: list of (x, y, diameter); diameters bucketed by caller. Uses zero-length round-capped strokes."""
    if not items:
        return ""
    groups = {}
    for x, y, dm in items:
        groups.setdefault(round(dm * 2) / 2, []).append((x, y))
    out = []
    for dm, pts in groups.items():
        d = "".join(f"M{f(x)} {f(y)}h0" for x, y in pts)
        out.append(f'<path d="{d}" stroke="{color}" stroke-width="{f(dm)}" stroke-linecap="round" fill="none" opacity="{f2(opacity)}"{extra}/>')
    return "".join(out)


def blob(cx, cy, w, h, rng, flat=0.25, nb=None):
    """Organic cloudlet: lumpy top made of random-width bumps, gently curved flat-ish base."""
    nb = nb or max(3, int(w / max(h, 1) * 1.3) + rng.randint(0, 2))
    ws = [rng.uniform(0.6, 1.4) for _ in range(nb)]
    s = sum(ws)
    xs = [cx - w / 2]
    for wv in ws:
        xs.append(xs[-1] + wv / s * w)
    d = f"M{f(xs[0])} {f(cy)}"
    vy = [cy]
    for i in range(1, nb):
        t = i / nb
        prof = math.sin(math.pi * t) ** 0.8
        vy.append(cy - h * prof * rng.uniform(0.25, 0.55))
    vy.append(cy)
    for i in range(nb):
        x0, x1 = xs[i], xs[i + 1]
        t = (i + 0.5) / nb
        prof = math.sin(math.pi * t) ** 0.7
        bh = h * (0.4 + 0.6 * prof) * rng.uniform(0.8, 1.15)
        bw = x1 - x0
        top = cy - bh
        k = 1.33
        d += (f"C{f(x0 - bw*0.08)} {f(vy[i] + (top - vy[i])*k)} {f(x1 + bw*0.08)} {f(vy[i+1] + (top - vy[i+1])*k)} {f(x1)} {f(vy[i+1])}")
    # base
    d += f"C{f(xs[-1] + w*0.03)} {f(cy + h*flat)} {f(xs[0] - w*0.03)} {f(cy + h*flat)} {f(xs[0])} {f(cy)}Z"
    return d


def epath(cx, cy, rx, ry):
    """Ellipse as a path subpath (for evenodd holes)."""
    return (f"M{f(cx-rx)} {f(cy)}a{f(rx)} {f(ry)} 0 1 0 {f(2*rx)} 0a{f(rx)} {f(ry)} 0 1 0 {f(-2*rx)} 0Z")


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def interp_pts(pts, x):
    """Piecewise-linear lookup on (x,y) list sorted by x, with Catmull smoothing approximated by cosine blend."""
    if x <= pts[0][0]:
        return pts[0][1]
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            # Catmull-Rom through neighbours for smoothness
            p0 = pts[i - 1][1] if i > 0 else y0 - (y1 - y0)
            p3 = pts[i + 2][1] if i + 2 < len(pts) else y1 + (y1 - y0)
            t2, t3 = t * t, t * t * t
            return 0.5 * ((2 * y0) + (-p0 + y1) * t + (2 * p0 - 5 * y0 + 4 * y1 - p3) * t2 + (-p0 + 3 * y0 - 3 * y1 + p3) * t3)
    return pts[-1][1]
