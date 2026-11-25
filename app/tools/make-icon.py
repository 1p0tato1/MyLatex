#!/usr/bin/env python3
"""Dessine l'icône de Plume (plume sur dégradé indigo) et génère icon.icns + PNG. Usage: python3 tools/make-icon.py"""
import math, os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFilter
S = 2048  # dessin en 2x puis réduction (anti-crénelage)
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
# fond: carré arrondi (squircle) à dégradé diagonal
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
grad = Image.new("RGB", (S, S))
px = grad.load()
c0, c1 = (112, 120, 255), (46, 52, 168)
for y in range(S):
    for x in range(S):
        px[x, y] = lerp(c0, c1, min(1, (x * 0.35 + y * 0.9) / (S * 1.25)))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((100, 100, S - 100, S - 100), radius=int(S * 0.225), fill=255)
bg.paste(grad, (0, 0), mask)
# reflet doux en haut
hl = Image.new("RGBA", (S, S), (0, 0, 0, 0)); ImageDraw.Draw(hl).ellipse((-S * 0.2, -S * 0.75, S * 1.2, S * 0.45), fill=(255, 255, 255, 34))
hl = hl.filter(ImageFilter.GaussianBlur(70))
bg = Image.alpha_composite(bg, Image.composite(hl, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

# plume: colonne vertébrale = courbe de Bézier, contour = profil en fuseau
def bez(t, p0, p1, p2): return ((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0], (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1])
P0, P1, P2 = (610, 1560), (820, 900), (1500, 520)
N = 220
pts, nrm = [], []
for i in range(N + 1):
    t = i / N; x, y = bez(t, P0, P1, P2)
    dx = 2 * (1-t) * (P1[0]-P0[0]) + 2 * t * (P2[0]-P1[0]); dy = 2 * (1-t) * (P1[1]-P0[1]) + 2 * t * (P2[1]-P1[1])
    L = math.hypot(dx, dy); nrm.append((-dy / L, dx / L)); pts.append((x, y))
def width(t): return 330 * (math.sin(math.pi * (0.06 + 0.94 * t)) ** 0.75) * (1 - 0.18 * t)
left = [(p[0] + n[0] * width(i / N) * 0.62, p[1] + n[1] * width(i / N) * 0.62) for i, (p, n) in enumerate(zip(pts, nrm))]   # côté étroit
right = [(p[0] - n[0] * width(i / N), p[1] - n[1] * width(i / N)) for i, (p, n) in enumerate(zip(pts, nrm))]
poly = left + right[::-1]
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0)); ImageDraw.Draw(shadow).polygon([(x + 18, y + 30) for x, y in poly], fill=(10, 12, 60, 120))
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
feather = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(feather)
d.polygon(poly, fill=(255, 255, 255, 255))
# barbes: fines lignes obliques à partir de la tige
for i in range(14, N - 6, 9):
    t = i / N; p, n = pts[i], nrm[i]; w = width(t)
    for side, k in ((1, 0.62), (-1, 1.0)):
        a = (p[0], p[1]); b = (p[0] + side * n[0] * w * k * 0.96 + (pts[min(i+12, N)][0] - p[0]) * 0.55, p[1] + side * n[1] * w * k * 0.96 + (pts[min(i+12, N)][1] - p[1]) * 0.55)
        d.line([a, b], fill=(120, 130, 235, 150), width=7)
d.line(pts, fill=(78, 88, 205, 255), width=15)                                   # tige
tail = [P0, (P0[0] - 150, P0[1] + 215)]; d.line(tail, fill=(255, 255, 255, 255), width=22)   # calame
d.ellipse((tail[1][0] - 12, tail[1][1] - 12, tail[1][0] + 12, tail[1][1] + 12), fill=(255, 255, 255, 255))
img = Image.alpha_composite(Image.alpha_composite(bg, shadow), feather).resize((1024, 1024), Image.LANCZOS)

out = "src-tauri/icons"; os.makedirs(out, exist_ok=True)
img.save(f"{out}/icon.png")
for name, size in (("32x32.png", 32), ("64x64.png", 64), ("128x128.png", 128), ("128x128@2x.png", 256)): img.resize((size, size), Image.LANCZOS).save(f"{out}/{name}")
iconset = "/tmp/Plume.iconset"; shutil.rmtree(iconset, ignore_errors=True); os.makedirs(iconset)
for base in (16, 32, 128, 256, 512):
    img.resize((base, base), Image.LANCZOS).save(f"{iconset}/icon_{base}x{base}.png")
    img.resize((base * 2, base * 2), Image.LANCZOS).save(f"{iconset}/icon_{base}x{base}@2x.png")
subprocess.run(["iconutil", "-c", "icns", iconset, "-o", f"{out}/icon.icns"], check=True)
print("icon ok:", os.path.getsize(f"{out}/icon.icns") // 1024, "KB")
