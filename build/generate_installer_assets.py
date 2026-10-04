"""WordAPA7 — Generador de recursos de marca del instalador NSIS.

Assets visuales alineados al design system de la app
(src/styles/design-system.css + src/styles/design-tokens.md):
  - build/icon.ico                -> icono del instalador / app / desinstalador
  - build/installerHeader.bmp     -> MUI_HEADERIMAGE_BITMAP (150x57)
  - build/installerSidebar.bmp    -> MUI_WELCOMEFINISHPAGE_BITMAP (164x314)
  - build/uninstallerSidebar.bmp  -> MUI_UNWELCOMEFINISHPAGE_BITMAP (164x314)

Diseño sobrio: superficie plana de marca, sin gradientes decorativos, sin
círculos flotantes y sin sombras de texto. La mascota (documento) se apoya
sobre una tarjeta blanca para dar estructura sin ruido. Baloo 2 se reserva
para el wordmark (fuente display de la app).

Paleta UI: SOLO tokens de design-system.css. Los colores de la mascota son
de ilustración (identidad del personaje), no chrome de UI.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
BALOO = ROOT.parent / "node_modules/@fontsource/baloo-2/files"

# ── Tokens de UI (design-system.css :root) ──────────────────────────────────
ACCENT = (79, 124, 255)         # #4f7cff  --color-accent
ACCENT_HOVER = (59, 102, 224)   # #3b66e0  --color-accent-hover
ACCENT_PRESSED = (43, 82, 204)  # #2b52cc  --color-accent-pressed
TEXT_PRIMARY = (26, 26, 46)     # #1a1a2e  --color-text-primary
SURFACE = (255, 255, 255)       # #ffffff  --color-bg-surface / --paper-white
BORDER_SUBTLE = (226, 232, 240)  # #e2e8f0  --color-paper-border-subtle

# ── Paleta de la mascota (ilustración, no UI) ───────────────────────────────
PAGE_FILL = (255, 204, 128)     # #ffcc80
PAGE_STROKE = (230, 81, 0)      # #e65100
FOLD_FILL = (255, 224, 178)     # #ffe0b2
FACE = (78, 52, 46)             # #4e342e


def baloo(weight: str, size: int) -> ImageFont.FreeTypeFont:
    path = BALOO / f"baloo-2-latin-{weight}-normal.woff"
    if not path.exists():
        raise FileNotFoundError(f"Fuente Baloo 2 no encontrada: {path}")
    return ImageFont.truetype(str(path), size)


def flat(w: int, h: int, color) -> Image.Image:
    return Image.new("RGB", (w, h), color)


def vertical_two_stop(w: int, h: int, top, bottom) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=color)
    return img


def draw_mascot(draw: ImageDraw.Draw, s: float, ox: float, oy: float) -> None:
    """Documento mascota. Expresión tranquila (sonrisa sutil, sin bigote)."""
    stroke = max(1, round(2 * s))
    draw.rounded_rectangle(
        [6 * s + ox, 6 * s + oy, 52 * s + ox, 58 * s + oy],
        radius=4 * s, fill=PAGE_FILL, outline=PAGE_STROKE, width=stroke,
    )
    draw.polygon(
        [(52 * s + ox, 6 * s + oy), (52 * s + ox, 16 * s + oy), (42 * s + ox, 6 * s + oy)],
        fill=FOLD_FILL, outline=PAGE_STROKE,
    )
    # Renglones del documento
    for x0, y0, x1, y1 in [(14, 16, 44, 18.5), (14, 22, 39, 24.5), (14, 28, 42, 30.5), (14, 34, 32, 36.5)]:
        draw.rounded_rectangle(
            [x0 * s + ox, y0 * s + oy, x1 * s + ox, y1 * s + oy],
            radius=1.2 * s, fill=PAGE_STROKE,
        )
    # Ojos
    for cx in (26, 38):
        draw.ellipse([cx * s - 2.6 * s + ox, 44 * s - 2.6 * s + oy, cx * s + 2.6 * s + ox, 44 * s + 2.6 * s + oy], fill=FACE)
    draw.ellipse([27 * s - 0.9 * s + ox, 43.2 * s - 0.9 * s + oy, 27 * s + 0.9 * s + ox, 43.2 * s + 0.9 * s + oy], fill=SURFACE)
    draw.ellipse([39 * s - 0.9 * s + ox, 43.2 * s - 0.9 * s + oy, 39 * s + 0.9 * s + ox, 43.2 * s + 0.9 * s + oy], fill=SURFACE)
    # Sonrisa sutil (serena, sin bigote)
    draw.arc([29 * s + ox, 48 * s + oy, 35 * s + ox, 54 * s + oy], 210, 330, fill=FACE, width=max(1, round(1.8 * s)))


def centered_text(draw: ImageDraw.Draw, cx: float, cy: float, text: str, font, fill) -> None:
    draw.text((cx, cy), text, font=font, fill=fill, anchor="mm")


def build_icon() -> None:
    size = 256
    radius = 56
    img = vertical_two_stop(size, size, ACCENT, ACCENT_PRESSED)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    bg = Image.new("RGB", (size, size), (0, 0, 0))
    bg.paste(img, (0, 0), mask)
    img = bg

    draw = ImageDraw.Draw(img)
    # Tarjeta blanca que eleva la mascota
    draw.rounded_rectangle([56, 60, 200, 204], radius=36, fill=SURFACE)

    s = 2.4
    draw_mascot(draw, s, 128 - 29 * s, 132 - 32 * s)

    img.save(ROOT / "icon.ico", format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("[assets] icon.ico generado")


def build_header() -> None:
    w, h = 150, 57
    img = flat(w, h, ACCENT_HOVER)
    draw = ImageDraw.Draw(img)

    font = baloo("800", 22)
    centered_text(draw, w / 2, h / 2, "WordAPA7", font, SURFACE)

    img.save(ROOT / "installerHeader.bmp", "BMP")
    print("[assets] installerHeader.bmp generado")


def _sidebar_base(w: int, h: int, base, mascot_card_y: int = 30) -> tuple[Image.Image, ImageDraw.Draw]:
    img = flat(w, h, base)
    draw = ImageDraw.Draw(img)
    # Tarjeta blanca que enmarca la mascota (estructura, no decoración)
    draw.rounded_rectangle([22, mascot_card_y, 142, mascot_card_y + 120], radius=18, fill=SURFACE)
    s = 1.7
    draw_mascot(draw, s, 82 - 29 * s, (mascot_card_y + 60) - 32 * s)
    return img, draw


def build_sidebar() -> None:
    w, h = 164, 314
    img, draw = _sidebar_base(w, h, ACCENT_HOVER)

    centered_text(draw, w / 2, 178, "WordAPA7", baloo("800", 26), SURFACE)
    centered_text(draw, w / 2, 212, "Edición Editorial", baloo("600", 14), SURFACE)

    # Píldora informativa (única pieza de acento, texto de marca)
    draw.rounded_rectangle([14, 250, 150, 284], radius=17, fill=SURFACE)
    centered_text(draw, w / 2, 267, "Normas APA 7ma Ed.", baloo("700", 12), ACCENT_HOVER)

    img.save(ROOT / "installerSidebar.bmp", "BMP")
    print("[assets] installerSidebar.bmp generado")


def build_uninstaller_sidebar() -> None:
    """Mismo sistema visual; base sobria (text-primary) para diferenciar sin romper marca."""
    w, h = 164, 314
    img, draw = _sidebar_base(w, h, TEXT_PRIMARY)

    centered_text(draw, w / 2, 178, "WordAPA7", baloo("800", 26), SURFACE)
    centered_text(draw, w / 2, 212, "Desinstalador", baloo("600", 14), SURFACE)

    draw.rounded_rectangle([14, 250, 150, 284], radius=17, fill=SURFACE)
    centered_text(draw, w / 2, 267, "No borra tus .docx", baloo("700", 12), TEXT_PRIMARY)

    img.save(ROOT / "uninstallerSidebar.bmp", "BMP")
    print("[assets] uninstallerSidebar.bmp generado")


if __name__ == "__main__":
    build_icon()
    build_header()
    build_sidebar()
    build_uninstaller_sidebar()
