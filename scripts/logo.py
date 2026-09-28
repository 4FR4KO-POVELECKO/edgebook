"""Generates the Edgebook mark as SVG path data.

Four pieces cut from a diamond (|x|+|y| <= D, top and bottom clipped flat at +-H, left and
right tips rounded with radius TIP) by three slits; each slit widens into a window. The mark
has 180-degree rotational symmetry. Corners are rounded by insetting each polygon by R and
drawing it with a round-join stroke of width 2R.

Usage: python3 scripts/logo.py  -> prints the <path> elements (viewBox "-100 -100 200 200").
Paste them into src/components/Logo.tsx and public/favicon.svg.
"""

import math

D, H = 110.5, 94        # diamond extent, flat top/bottom
TIP = 40                # radius of the left/right tips
GAP = 10                # slit width
SLIT = 49               # x of the side slits
WIN = 29                # window width
CENTER_WIN = 51         # center window: y in [-51, 51]
SIDE_WIN = (-14, 29)    # left window y-range (right one is rotated); must end >2R above the diagonal
R = 5                   # corner radius

g = GAP / 2


def inner_left():
    top = -H
    xd = -(D - H)                 # diagonal meets the flat top/bottom
    xl = -SLIT + g                # left edge of the piece
    yl = D + xl                   # diagonal meets the left edge (as |y|)
    y0, y1 = SIDE_WIN
    return [
        (xd, top), (-g, top), (-g, -CENTER_WIN), (-WIN / 2, -CENTER_WIN),
        (-WIN / 2, CENTER_WIN), (-g, CENTER_WIN), (-g, H), (xd, H),
        (xl, yl), (xl, y1), (-SLIT + WIN / 2, y1), (-SLIT + WIN / 2, y0), (xl, y0), (xl, -yl),
    ]


def tip_arc(steps=16):
    """Fillet between the two left diagonals, from bottom tangent point to top one."""
    cx = -D + TIP * math.sqrt(2)  # circle centre on the x axis
    pts = []
    for i in range(steps + 1):
        a = math.radians(135 + 90 * i / steps)   # 135deg (bottom-left) .. 225deg (top-left)
        pts.append((cx + TIP * math.cos(a), TIP * math.sin(a)))   # y points down
    return pts


def outer_left():
    xr = -SLIT - g                # right edge of the piece
    yr = D + xr                   # diagonal meets the right edge (as |y|)
    y0, y1 = SIDE_WIN
    return [
        (xr, -yr), (xr, y0), (-SLIT - WIN / 2, y0), (-SLIT - WIN / 2, y1), (xr, y1), (xr, yr),
        *tip_arc(),
    ]


def rotate(poly):
    return [(-x, -y) for x, y in poly]


def inset(poly, r):
    """Offsets a simple polygon inward by r (edges shifted, adjacent lines intersected)."""
    n = len(poly)
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    sign = 1 if area > 0 else -1
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        ln = (dx * dx + dy * dy) ** 0.5
        nx, ny = -dy / ln * sign, dx / ln * sign   # inward normal
        lines.append(((x0 + nx * r, y0 + ny * r), (dx, dy)))
    out = []
    for i in range(n):
        (p, d), (q, e) = lines[i - 1], lines[i]
        den = d[0] * e[1] - d[1] * e[0]
        t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
        out.append((p[0] + d[0] * t, p[1] + d[1] * t))
    return out


def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def path(poly):
    pts = inset(poly, R)
    return 'M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts) + 'Z'


PIECES = [outer_left(), inner_left(), rotate(inner_left()), rotate(outer_left())]

if __name__ == '__main__':
    for p in PIECES:
        print(f'<path d="{path(p)}"/>')
