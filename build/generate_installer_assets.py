"""WordAPA7 — Generador de recursos de marca del instalador NSIS.

Assets visuales con la identidad de la app (mascota + Baloo 2 + azul #4f7cff):
 - build/icon.ico                -> icono del instalador / app / desinstalador
 - build/installerHeader.bmp     -> MUI_HEADERIMAGE_BITMAP (150x57)
 - build/installerSidebar.bmp    -> MUI_WELCOMEFINISHPAGE_BITMAP (164x314)
 - build/uninstallerSidebar.bmp  -> MUI_UNWELCOMEFINISHPAGE_BITMAP (164x314)

Diseño: alto contraste, bordes redondeados y fuente cartoon Baloo 2
(la misma que usa la app), con la cinta "docx -> APA 7" bien alineada.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
BALOO = ROOT.parent / "node_modules/@fontsource/baloo-2/files"

# ── Paleta de marca (design-tokens.md) ──────────────────────────────────────
BRAND = (79, 124, 255)          # #4f7cff
BRAND_HOVER = (123, 160, 255)   # #7ba0ff
GRAD_TOP = (96, 135, 255)       # #6087ff
GRAD_MID = (79, 124, 255)       # #4f7cff
GRAD_BOTTOM = (34, 70, 196)     # #2246c4
FRAME = (188, 208, 255)         # #bcd0ff (borde del marco redondeado)
NAVY = (20, 33, 61)             # #14213d (texto oscuro de contraste)
SOFT = (222, 231, 255)          # #dee7ff
YELLOW = (255, 201, 77)         # #ffc94d (cinta "docx -> APA 7")
YELLOW_DEEP = (226, 160, 30)    # #e2a01e (sombra de la cinta)
WHITE = (255, 255, 255)

PAGE_FILL = (255, 204, 128)     # #FFCC80
PAGE_STROKE = (230, 81, 0)      # #E65100
FOLD_FILL = (255, 224, 178)     # #FFE0B2
FACE = (78, 52, 46)             # #4E342E


def baloo(weight: str, size: int) -> ImageFont.FreeTypeFont:
    path = BALOO / f"baloo-2-latin-{weight}-normal.woff"
    if not path.exists():
        raise FileNotFoundError(f"Fuente Baloo 2 no encontrada: {path}")
    return ImageFont.truetype(str(path), size)


def v3_gradient(w: int, h: int, top, mid, bottom) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    mid_y = int(h * 0.45)
    for y in range(h):
        if y < mid_y:
            t = y / max(1, mid_y)
            c0, c1 = top, mid
        else:
            t = (y - mid_y) / max(1, h - 1 - mid_y)
            c0, c1 = mid, bottom
        color = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=color)
    return img


def draw_mascot(draw: ImageDraw.Draw, s: float, ox: float, oy: float, mouth: str = "happy") -> None:
    stroke = max(1, round(2 * s))
    draw.rounded_rectangle(
        [6 * s + ox, 6 * s + oy, 52 * s + ox, 58 * s + oy],
        radius=4 * s, fill=PAGE_FILL, outline=PAGE_STROKE, width=stroke,
    )
    draw.polygon(
        [(52 * s + ox, 6 * s + oy), (52 * s + ox, 16 * s + oy), (42 * s + ox, 6 * s + oy)],
        fill=FOLD_FILL, outline=PAGE_STROKE,
    )
    for x0, y0, x1, y1 in [(14, 16, 44, 18.5), (14, 22, 39, 24.5), (14, 28, 42, 30.5), (14, 34, 32, 36.5)]:
        draw.rounded_rectangle(
            [x0 * s + ox, y0 * s + oy, x1 * s + ox, y1 * s + oy],
            radius=1.2 * s, fill=PAGE_STROKE,
        )
    for cx in (22, 42):
        draw.ellipse([cx * s - 4 * s + ox, 46 * s - 2.4 * s + oy, cx * s + 4 * s + ox, 46 * s + 2.4 * s + oy], fill=FOLD_FILL)
    for cx in (26, 38):
        draw.ellipse([cx * s - 2.6 * s + ox, 44 * s - 2.6 * s + oy, cx * s + 2.6 * s + ox, 44 * s + 2.6 * s + oy], fill=FACE)
    draw.ellipse([27 * s - 0.9 * s + ox, 43.2 * s - 0.9 * s + oy, 27 * s + 0.9 * s + ox, 43.2 * s + 0.9 * s + oy], fill=WHITE)
    draw.ellipse([39 * s - 0.9 * s + ox, 43.2 * s - 0.9 * s + oy, 39 * s + 0.9 * s + ox, 43.2 * s + 0.9 * s + oy], fill=WHITE)
    if mouth == "happy":
        draw.arc([27 * s + ox, 49 * s + oy, 37 * s + ox, 55 * s + oy], 200, 340, fill=FACE, width=max(1, round(2.5 * s)))
    elif mouth == "excited":
        draw.pieslice([26 * s + ox, 48 * s + oy, 38 * s + ox, 57 * s + oy], 200, 340, fill=FACE)


def draw_arrow(draw: ImageDraw.Draw, x1: float, y: float, x2: float, color, width: int = 3) -> None:
    draw.line([(x1, y), (x2, y)], fill=color, width=width)
    h = max(6, width * 2)
    draw.polygon([(x2, y), (x2 - h, y - h / 1.6), (x2 - h, y + h / 1.6)], fill=color)


def shadow_text(draw, xy, text, font, fill, shadow=(22, 33, 77), offset=(0, 3)):
    draw.text((xy[0] + offset[0], xy[1] + offset[1]), text, font=font, fill=shadow)
    draw.text(xy, text, font=font, fill=fill)


def build_icon() -> None:
    size = 256
    radius = 56
    img = v3_gradient(size, size, GRAD_TOP, GRAD_MID, GRAD_BOTTOM)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img = img.resize((size, size))
    bg = Image.new("RGB", (size, size), (0, 0, 0))
    bg.paste(img, (0, 0), mask)
    img = bg

    draw = ImageDraw.Draw(img)
    # Disco de marca que eleva la mascota
    draw.ellipse([74, 82, 182, 190], fill=BRAND_HOVER)
    draw.ellipse([82, 90, 174, 182], fill=BRAND)

    s = 2.9
    draw_mascot(draw, s, 128 - 29 * s, 130 - 32 * s, mouth="excited")

    img.save(ROOT / "icon.ico", format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("[assets] icon.ico generado")


def build_header() -> None:
    w, h = 150, 57
    img = v3_gradient(w, h, GRAD_TOP, GRAD_MID, GRAD_BOTTOM)
    draw = ImageDraw.Draw(img)

    font = baloo("800", 22)
    shadow_text(draw, (12, 12), "WordAPA7", font, WHITE, shadow=(23, 51, 148), offset=(0, 3))

    # Filete redondeado de acento en el borde inferior
    draw.rounded_rectangle([10, h - 7, w - 10, h - 3], radius=2, fill=BRAND_HOVER)

    img.convert("RGB").save(ROOT / "installerHeader.bmp", "BMP")
    print("[assets] installerHeader.bmp generado")


def build_sidebar() -> None:
    w, h = 164, 314
    img = v3_gradient(w, h, GRAD_TOP, GRAD_MID, GRAD_BOTTOM)
    draw = ImageDraw.Draw(img)

    # Círculos decorativos en tonos de marca (profundidad, nada de blanco)
    draw.ellipse([-42, 214, 64, 320], fill=(30, 62, 172))
    draw.ellipse([108, -34, 238, 96], fill=(63, 100, 214))
    draw.ellipse([122, 252, 206, 336], fill=(28, 58, 158))
    draw.ellipse([-26, 36, 44, 106], fill=(63, 100, 214))

    # Marco redondeado que enmarca a la mascota
    draw.rounded_rectangle([28, 32, 136, 152], radius=26, outline=FRAME, width=3)

    # Mascota grande
    s = 2.0
    draw_mascot(draw, s, 82 - 29 * s, 92 - 32 * s, mouth="excited")

    # Título + tagline con Baloo 2 y sombra para dar profundidad
    font_title = baloo("800", 34)
    font_tag = baloo("600", 16)
    title = "WordAPA7"
    tw = draw.textlength(title, font=font_title)
    shadow_text(draw, ((w - tw) / 2, 170), title, font_title, WHITE, shadow=(23, 51, 148), offset=(0, 3))
    tag = "Formato APA 7"
    tw2 = draw.textlength(tag, font=font_tag)
    draw.text(((w - tw2) / 2, 224), tag, font=font_tag, fill=SOFT)

    # ── Cinta "docx -> APA 7" (sombra + píldora amarilla + flecha dibujada) ──
    font_ribbon = baloo("800", 16)
    px0, py0, px1, py1 = 14, 260, 150, 294
    draw.rounded_rectangle([px0, py0 + 3, px1, py1 + 3], radius=17, fill=YELLOW_DEEP)
    draw.rounded_rectangle([px0, py0, px1, py1], radius=17, fill=YELLOW)

    # Alineación exacta del grupo "docx  ➜  APA 7"
    gap = 9
    arrow_w = 24
    w_docx = draw.textlength("docx", font=font_ribbon)
    w_apa = draw.textlength("APA 7", font=font_ribbon)
    total = w_docx + gap * 2 + arrow_w + w_apa
    cx = 82
    x = cx - total / 2
    y_text = py0 + (py1 - py0 - 16) / 2
    draw.text((x, y_text), "docx", font=font_ribbon, fill=NAVY)
    ax1 = x + w_docx + gap
    ax2 = ax1 + arrow_w
    draw_arrow(draw, ax1, y_text + 8, ax2, NAVY, width=3)
    draw.text((ax2 + gap, y_text), "APA 7", font=font_ribbon, fill=NAVY)

    img.convert("RGB").save(ROOT / "installerSidebar.bmp", "BMP")
    img.convert("RGB").save(ROOT / "uninstallerSidebar.bmp", "BMP")
    print("[assets] installerSidebar.bmp + uninstallerSidebar.bmp generados")


if __name__ == "__main__":
    build_icon()
    build_header()
    build_sidebar()
