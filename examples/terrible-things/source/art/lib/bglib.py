"""Background-building helpers for bakery, hill_path and kiln_house: document assembly, painted clouds."""
import math, random, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bgshapes import *


class Doc:
    def __init__(self, prefix):
        self.p = prefix
        self.defs = []
        self.body = []
        self._blur = {}

    def id(self, name):
        return f'{self.p}-{name}'

    def url(self, name):
        return f'url(#{self.p}-{name})'

    def blur(self, sd):
        """Return url() for a gaussian blur filter of the given std deviation (created once)."""
        key = f'b{str(sd).replace(".", "_")}'
        if key not in self._blur:
            self._blur[key] = True
            self.defs.append(blur(self.id(key), sd, pad=60))
        return self.url(key)

    def add(self, *items):
        for it in items:
            if isinstance(it, (list, tuple)):
                self.body.extend(it)
            else:
                self.body.append(it)

    def d(self, *items):
        for it in items:
            if isinstance(it, (list, tuple)):
                self.defs.extend(it)
            else:
                self.defs.append(it)

    def svg(self, extra_root=''):
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'
                f'<defs>{"".join(self.defs)}</defs>{"".join(self.body)}</svg>\n')

    def write(self, out):
        s = self.svg()
        for bad in ('<image', '<text', '<script', 'http://www.w3.org/1999/xlink', 'xlink:href'):
            assert bad not in s, bad
        assert 'href="http' not in s
        with open(out, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(s)
        kb = len(s.encode()) / 1024
        print(f'{out}: {kb:.1f} KB')
        return kb


# ---------------------------------------------------------------------------- clouds
def billow_circles(cx, cy, rx, ry, rng, bumps=11, flat=0.45, size=(0.22, 0.42), arc=(178, 362)):
    """A cloud billow: a core ellipse (as circles) plus bumps around its upper perimeter.
    flat: fraction of ry below centre where the bottom is cut flat (bumps not placed there)."""
    C = []
    # core: a row of overlapping circles approximating the ellipse
    k = max(1, int(round(rx / ry * 1.3)))
    for i in range(k):
        u = (i + 0.5) / k * 2 - 1
        r = ry * math.sqrt(max(0.05, 1 - u * u * 0.55))
        C.append((cx + u * (rx - r * 0.7), cy, r))
    a0, a1 = arc
    for i in range(bumps):
        a = math.radians(a0 + (a1 - a0) * (i + rng.uniform(0.15, 0.85)) / bumps)
        rr = min(rx, ry) * rng.uniform(*size)
        if math.sin(a) > 0:   # lower half: smaller
            rr *= 0.75
        px = cx + math.cos(a) * (rx - rr * 0.55)
        py = cy + math.sin(a) * (ry - rr * 0.55)
        py = min(py, cy + ry * flat - rr * 0.3)
        C.append((px, py, rr))
    return C


def cloud(doc, uid, billows, top, base, light=(0.55, -0.83), lit_k=0.16,
          shade=('#f6f4ff', '#d5d6f3', '#aab0e2'), lit=('#ffffff', '#fffaf2', '#ffe8dc'),
          belly=None, glow=0.55, soft=2.2, clip_base=None, rim=None, rim_op=0.85, belly_from=0.6):
    """Draw a cel-shaded cloud made of billows (list of circle lists), back to front.
    Returns list of svg strings."""
    lx, ly = light
    L = math.hypot(lx, ly)
    lx, ly = lx / L, ly / L
    doc.d(lin_grad(doc.id(uid + 's'), [(0, shade[0]), (0.5, shade[1]), (1, shade[2])], 0, top, 0, base, user=True))
    doc.d(lin_grad(doc.id(uid + 'l'), [(0, lit[0]), (0.55, lit[1]), (1, lit[2])], 0, top, 0, base, user=True))
    out = []
    allc = [c for b in billows for c in b]
    for bi, B in enumerate(billows):
        doc.d(f'<g id="{doc.id(uid + str(bi))}">' + ''.join(circle(x, y, r) for x, y, r in B) + '</g>')
    clip = ''
    if clip_base is not None:
        doc.d(f'<clipPath id="{doc.id(uid + "cb")}"><rect x="-200" y="-200" width="2400" height="{n(clip_base + 200)}"/></clipPath>')
        clip = f' clip-path="{doc.url(uid + "cb")}"'
    out.append(f'<g{clip}>')
    if glow:
        out.append(f'<g fill="#ffffff" opacity="{glow}" filter="{doc.blur(18)}">' +
                   ''.join(f'<use href="#{doc.id(uid + str(bi))}"/>' for bi in range(len(billows))) + '</g>')
    for bi, B in enumerate(billows):
        out.append(f'<use href="#{doc.id(uid + str(bi))}" fill="{doc.url(uid + "s")}"/>')
        out.append(f'<g fill="{doc.url(uid + "l")}" filter="{doc.blur(soft)}">' + ''.join(
            circle(x + lx * r * lit_k, y + ly * r * lit_k, r * (1 - lit_k)) for x, y, r in B) + '</g>')
    if belly:
        doc.d(lin_grad(doc.id(uid + 'b'), [(0, (belly, 0)), (belly_from, (belly, 0)), (belly_from + (1 - belly_from) * 0.6, (belly, 0.5)), (1, (belly, 0.8))], 0, top, 0, base, user=True))
        doc.d(f'<mask id="{doc.id(uid + "k")}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="2120" height="1280"><g fill="#fff">' +
              ''.join(f'<use href="#{doc.id(uid + str(bi))}"/>' for bi in range(len(billows))) + '</g></mask>')
        out.append(rect(-100, top - 50, 2120, base - top + 100, fill=doc.url(uid + 'b'), mask=doc.url(uid + 'k')))
    out.append('</g>')
    return out


def canopy(doc, billows, light=(0.6, -0.8), cols=('#1c5e40', '#3a9a52', '#7fd067', '#d4f59a'), lit_k=0.22, specks=0.25, rng=None):
    """Cel-shaded foliage mass: billows (lists of circles) drawn back to front, each with a dark base,
    a lit union shifted toward the light and a few bright dabs."""
    rng = rng or random.Random(1)
    lx, ly = light
    L = math.hypot(lx, ly)
    lx, ly = lx / L, ly / L
    out = []
    for B in billows:
        out.append(f'<g fill="{cols[0]}">' + ''.join(circle(x, y, r) for x, y, r in B) + '</g>')
        out.append(f'<g fill="{cols[1]}">' + ''.join(circle(x + lx * r * lit_k, y + ly * r * lit_k, r * (1 - lit_k)) for x, y, r in B) + '</g>')
        out.append(f'<g fill="{cols[2]}">' + ''.join(circle(x + lx * r * 0.42, y + ly * r * 0.42, r * 0.5) for x, y, r in B if rng.random() < 0.45) + '</g>')
        out.append(f'<g fill="{cols[3]}" opacity="0.85">' + ''.join(circle(x + lx * r * 0.66, y + ly * r * 0.66, r * 0.17) for x, y, r in B if rng.random() < specks) + '</g>')
    return out
