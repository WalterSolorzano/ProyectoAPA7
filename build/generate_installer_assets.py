"""WordAPA7 — Generador de recursos de marca del instalador NSIS.

Identidad visual plana Fluent/Word 365, la misma del logo que la app ya
muestra en su rail (src/components/shared/AppBrandLogo.tsx): cuadrado de
acento, hoja blanca, esquina plegada. Cero gradientes, cero mascota
cartoon y cero decoración.

 - build/icon.ico                -> icono de app / instalador / desinstalador
 - build/installerHeader.bmp     -> MUI header             (150x57)
 - build/installerSidebar.bmp    -> welcome / finish page  (164x314)
 - build/uninstallerSidebar.bmp  -> welcome / finish page  (164x314)

Los tres tamaños de BMP son los que MUI2 exige: si cambian, la compilación
del instalador falla. Los tokens de color salen de src/styles/design-tokens.md.

El .ico es adaptativo: de 48px hacia arriba dibuja las tres líneas de texto
del logo; de 32px hacia abajo las omite, porque a ese tamaño se convierten
en una mancha. El contenedor ICO se escribe a mano (frames BMP con alfa
hasta 128px y PNG para 256) en lugar de dejar que PIL reescale un único
dibujo, que es justo lo que el icono adaptativo necesita.
"""

from __future__ import annotations

import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent

# ── Tokens de marca (src/styles/design-tokens.md) ──────────────────────────
ACCENT = (79, 124, 255)         # #4f7cff  --color-accent
PAPER = (255, 255, 255)         # #ffffff  --color-bg-surface
SURFACE_ALT = (241, 245, 249)   # #f1f5f9  --color-bg-surface-alt
BORDER = (226, 232, 240)        # #e2e8f0  --color-border-subtle
TEXT_MAIN = (26, 26, 46)        # #1a1a2e  --color-text-primary
TEXT_MUTED = (107, 107, 128)    # #6b6b80  --color-text-tertiary
SLATE = (96, 94, 92)            # #605e5c  versión sobria para el desinstalador

# Geometría del logo en la grid de 24 unidades de AppBrandLogo.
DOC_BOX = (6.5, 5.0, 18.0, 19.0)
FOLD = (14.5, 5.0, 8.5)
TEXT_BARS = ((9.0, 11.5, 12.0), (9.0, 14.0, 15.0), (9.0, 16.5, 13.5))
CORNER_RATIO = 5.5 / 24  # rx="5.5" sobre viewBox 24

# ── Escala de render ──────────────────────────────────────────────────────
# Todo se dibuja 8x más grande y se reduce con LANCZOS: es lo que da bordes
# suaves sin depender de un motor de antialiasing externo.
SS = 8

# ── Tipografía: chrome nativo del instalador (Segoe UI) ───────────────────
FONT_DIR = Path(r"C:\Windows\Fonts")
FONT_FILES = {
    "regular": ("segoeui.ttf", "DejaVuSans.ttf"),
    "semibold": ("seguisb.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"),
    "bold": ("segoeuib.ttf", "seguisb.ttf", "DejaVuSans-Bold.ttf"),
}
_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    key = (weight, size)
    if key not in _FONT_CACHE:
        for name in FONT_FILES[weight]:
            path = FONT_DIR / name
            if path.exists():
                _FONT_CACHE[key] = ImageFont.truetype(str(path), size)
                break
        else:
            raise FileNotFoundError(
                f"Ninguna fuente disponible para '{weight}': {FONT_FILES[weight]}"
            )
    return _FONT_CACHE[key]


def draw_logo(
    draw: ImageDraw.ImageDraw,
    ox: float,
    oy: float,
    size: float,
    *,
    accent=ACCENT,
    lines: bool = True,
) -> None:
    """Marca plana idéntica al SVG del rail, escalada a `size` píxeles."""
    k = size / 24.0

    # Cuadrado de acento
    draw.rounded_rectangle(
        [ox, oy, ox + size, oy + size], radius=CORNER_RATIO * size, fill=accent
    )

    # Hoja blanca
    dx0, dy0, dx1, dy1 = DOC_BOX
    draw.rounded_rectangle(
        [ox + dx0 * k, oy + dy0 * k, ox + dx1 * k, oy + dy1 * k],
        radius=0.8 * k,
        fill=PAPER,
    )

    # Esquina plegada: el SVG deja el triángulo superior derecho fuera de la
    # hoja; aquí se repinta en acento, con 0.4k de holgura para tapar el
    # redondeo de la esquina del rectángulo blanco.
    fx, fy0, fy1 = FOLD
    draw.polygon(
        [
            (ox + (fx - 0.1) * k, oy + (fy0 - 0.4) * k),
            (ox + (dx1 + 0.4) * k, oy + (fy0 - 0.4) * k),
            (ox + (dx1 + 0.4) * k, oy + (fy1 + 0.5) * k),
        ],
        fill=accent,
    )

    if lines:
        width = max(1.0, 1.5 * k)
        for x0, y, x1 in TEXT_BARS:
            draw.rounded_rectangle(
                [ox + x0 * k, oy + y * k, ox + x1 * k, oy + y * k + width],
                radius=width / 2,
                fill=accent,
            )


def render_logo(size: int, *, lines: bool, accent=ACCENT) -> Image.Image:
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    draw_logo(ImageDraw.Draw(img), 0, 0, size * SS, accent=accent, lines=lines)
    img = img.resize((size, size), Image.LANCZOS)
    # LANCZOS deja alfa residual (1..8/255) fuera del cuadrado redondeado.
    # A tamaño de barra de tareas eso se lee como suciedad, así que se recorta.
    img.putalpha(img.getchannel("A").point(lambda v: 0 if v < 8 else v))
    return img


# ── Contenedor ICO escrito a mano ─────────────────────────────────────────
ICON_SIZES = (16, 24, 32, 48, 64, 128, 256)
LINES_MIN_SIZE = 48  # por debajo, las tres líneas se vuelven mancha


def _bmp_frame(img: Image.Image) -> bytes:
    """Frame ICO en BMP 32-bit: BITMAPINFOHEADER + BGRA de abajo hacia arriba
    + máscara AND (vacía, el canal alfa manda)."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    data = bytearray()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            r, g, b, a = px[x, y]
            data += bytes((b, g, r, a))
    header = struct.pack(
        "<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(data), 0, 0, 0, 0
    )
    mask_stride = ((w + 31) // 32) * 4
    return header + bytes(data) + b"\x00" * (mask_stride * h)


def save_ico(path: Path, frames: list[tuple[int, Image.Image]]) -> None:
    blobs: list[bytes] = []
    for size, img in frames:
        if size >= 256:
            buf = io.BytesIO()
            img.save(buf, "PNG")
            blobs.append(buf.getvalue())
        else:
            blobs.append(_bmp_frame(img))

    entries = []
    offset = 6 + 16 * len(frames)
    for (size, _), blob in zip(frames, blobs):
        entries.append((0 if size >= 256 else size, len(blob), offset))
        offset += len(blob)

    with open(path, "wb") as fh:
        fh.write(struct.pack("<HHH", 0, 1, len(entries)))
        for size, length, off in entries:
            fh.write(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, length, off))
        for blob in blobs:
            fh.write(blob)


def build_icon() -> None:
    frames = [
        (size, render_logo(size, lines=size >= LINES_MIN_SIZE))
        for size in ICON_SIZES
    ]
    save_ico(ROOT / "icon.ico", frames)
    print(
        "[assets] icon.ico generado "
        f"({', '.join(f'{s}px' for s, _ in frames)}; "
        f"líneas desde {LINES_MIN_SIZE}px)"
    )


def build_header() -> None:
    """MUI_HEADERIMAGE_BITMAP: 150x57, sin texto incrustado (lo pone MUI)."""
    w, h = 150, 57
    img = Image.new("RGB", (w * SS, h * SS), PAPER)
    draw = ImageDraw.Draw(img)

    draw_logo(draw, 12 * SS, (h - 32) / 2 * SS, 32 * SS, lines=True)
    draw.text(
        (54 * SS, h / 2 * SS),
        "WordAPA7",
        font=font("bold", 20 * SS),
        fill=TEXT_MAIN,
        anchor="lm",
    )

    # Filete inferior de 1px: el borde que separa el header de la página
    draw.rectangle([0, (h - 1) * SS, w * SS, h * SS], fill=BORDER)

    img.resize((w, h), Image.LANCZOS).save(ROOT / "installerHeader.bmp", "BMP")
    print("[assets] installerHeader.bmp generado (150x57)")


def build_sidebar(*, uninstaller: bool = False) -> None:
    """MUI_WELCOMEFINISHPAGE_BITMAP / MUI_UNWELCOMEFINISHPAGE_BITMAP: 164x314.

    Misma retícula en ambos; el desinstalador solo cambia la marca y la
    etiqueta a pizarra para leerse como una operación sobria, sin alarmismo.
    """
    w, h = 164, 314
    accent = SLATE if uninstaller else ACCENT

    img = Image.new("RGB", (w * SS, h * SS), PAPER)
    draw = ImageDraw.Draw(img)

    # Marca centrada
    mark = 56
    draw_logo(draw, (w - mark) / 2 * SS, 36 * SS, mark * SS, accent=accent, lines=True)

    # Wordmark + tagline
    draw.text(
        (w / 2 * SS, 112 * SS),
        "WordAPA7",
        font=font("bold", 21 * SS),
        fill=TEXT_MAIN,
        anchor="mm",
    )
    draw.text(
        (w / 2 * SS, 135 * SS),
        "Desinstalador" if uninstaller else "Edición Editorial",
        font=font("regular", 12 * SS),
        fill=TEXT_MUTED,
        anchor="mm",
    )

    # Separador de 1px
    draw.rectangle([20 * SS, 154 * SS, (w - 20) * SS, 155 * SS], fill=BORDER)

    # Dos líneas de contexto: sin ellas el centro de la columna queda vacío.
    caption = (
        ("Se remueve la app", "y el complemento de Word")
        if uninstaller
        else ("Diagnóstico APA 7", "en tu documento")
    )
    for i, line in enumerate(caption):
        draw.text(
            (w / 2 * SS, (182 + i * 18) * SS),
            line,
            font=font("regular", 11 * SS),
            fill=TEXT_MUTED,
            anchor="mm",
        )

    # Píldora de estado, superficie sutil y borde de 1px
    pill = "Limpieza segura" if uninstaller else "Normas APA 7ma Ed."
    px0, py0, px1, py1 = 18, 258, 146, 290
    draw.rounded_rectangle(
        [px0 * SS, py0 * SS, px1 * SS, py1 * SS],
        radius=8 * SS,
        fill=SURFACE_ALT,
        outline=BORDER,
        width=SS,
    )
    draw.text(
        ((px0 + px1) / 2 * SS, (py0 + py1) / 2 * SS),
        pill,
        font=font("semibold", 11 * SS),
        fill=TEXT_MUTED,
        anchor="mm",
    )

    name = "uninstallerSidebar.bmp" if uninstaller else "installerSidebar.bmp"
    img.resize((w, h), Image.LANCZOS).save(ROOT / name, "BMP")
    print(f"[assets] {name} generado (164x314)")


if __name__ == "__main__":
    build_icon()
    build_header()
    build_sidebar()
    build_sidebar(uninstaller=True)
