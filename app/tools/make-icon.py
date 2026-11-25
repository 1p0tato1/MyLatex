#!/usr/bin/env python3
"""Dessine l'icône de MyLatex (logo « My LaTeX » sur dégradé indigo) et génère icon.icns + PNG. Usage: python3 tools/make-icon.py"""
import glob, os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont
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

# "My" + le logo LaTeX, composé en Latin Modern (la police de LaTeX, prise dans le cache Tectonic: tools/make-seed.sh)
def font(style, size): return ImageFont.truetype(glob.glob(f"../bin/seed-cache/**/lmroman10-{style}.otf", recursive=True)[0], size)
E = 560  # cadratin du logo
ink = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(ink)
x = 0; glyphs = []
# (lettre, corps, décalage vertical, crénage avant) — mêmes réglages que la macro \LaTeX
for ch, size, dy, kern in (("L", 1, 0, 0), ("A", .7, -.205, -.36), ("T", 1, 0, -.15), ("E", 1, .215, -.1667), ("X", 1, 0, -.125)):
    ft = font("regular", int(E * size)); x += kern * E; glyphs.append((x, dy * E, ch, ft)); x += d.textlength(ch, font=ft)
x0, base = (S - x) / 2, 1360
for gx, dy, ch, ft in glyphs: d.text((x0 + gx, base + dy), ch, font=ft, fill="white", anchor="ls", stroke_width=6, stroke_fill="white")
d.text((S / 2, 820), "My", font=font("italic", 540), fill="white", anchor="ms", stroke_width=6, stroke_fill="white")
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0)); shadow.paste((10, 12, 60, 120), (18, 30), ink.getchannel("A"))
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
img = Image.alpha_composite(Image.alpha_composite(bg, shadow), ink).resize((1024, 1024), Image.LANCZOS)

out = "src-tauri/icons"; os.makedirs(out, exist_ok=True)
img.save(f"{out}/icon.png")
for name, size in (("32x32.png", 32), ("64x64.png", 64), ("128x128.png", 128), ("128x128@2x.png", 256)): img.resize((size, size), Image.LANCZOS).save(f"{out}/{name}")
iconset = "/tmp/MyLatex.iconset"; shutil.rmtree(iconset, ignore_errors=True); os.makedirs(iconset)
for base in (16, 32, 128, 256, 512):
    img.resize((base, base), Image.LANCZOS).save(f"{iconset}/icon_{base}x{base}.png")
    img.resize((base * 2, base * 2), Image.LANCZOS).save(f"{iconset}/icon_{base}x{base}@2x.png")
subprocess.run(["iconutil", "-c", "icns", iconset, "-o", f"{out}/icon.icns"], check=True)
print("icon ok:", os.path.getsize(f"{out}/icon.icns") // 1024, "KB")
