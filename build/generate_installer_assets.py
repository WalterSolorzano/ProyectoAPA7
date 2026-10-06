"""WordAPA7 — Generador de recursos de marca del instalador NSIS.

Identidad visual plana Fluent/Word 365, la misma del logo que la app ya
muestra en su rail (src/components/shared/AppBrandLogo.tsx): cuadrado de
acento, hoja blanca, esquina plegada. Cero gradientes y cero decoración.

Las MASCOTAS nuevas del producto (src/components/layout/EditorialMascot.tsx)
viven SOLO en el instalador —las sidebars de bienvenida/cierre—, nunca en el
logo. Se portan aquí con PIL respetando la geometría del SVG (viewBox 0 0 64
64) y los tokens de color de design-system.css.

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
import math
import re
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

# ── Tokens de la mascota (src/styles/design-system.css) ────────────────────
WARNING = (192, 86, 46)         # #c0562e  --color-warning
DANGER = (212, 56, 46)          # #d4382e  --color-danger
SUCCESS = (47, 133, 90)         # #2f855a  --color-success
# rgba(79,124,255,.10) sobre el cuerpo azul se lee casi azul-sobre-azul; se
# aclara a un tinte de acento para que las líneas del rotulador se vean.
ACCENT_TINT = (167, 189, 255)
MASCOT_STROKE = 1.7             # stroke-width del SVG de la mascota

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


# ── Logo plano (marca, sin mascota) ────────────────────────────────────────
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


# ── Motor mínimo de SVG para la mascota ────────────────────────────────────
_TOKEN = re.compile(r"([MmLlHhVvCcZz])|(-?(?:\d+\.?\d*|\.\d+))")


def _tokens(d: str) -> list:
    out: list = []
    for m in _TOKEN.finditer(d):
        out.append(m.group(1) if m.group(1) else float(m.group(2)))
    return out


def _cubic(p0, p1, p2, p3, n: int = 18):
    pts = []
    for i in range(1, n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def parse_path(d: str) -> list[list[tuple[float, float]]]:
    """Subrutas absolutas de un `d` con M/L/H/V/C/Z (abs y rel)."""
    toks = _tokens(d)
    i = 0
    subs: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    start = (0.0, 0.0)
    x = y = 0.0
    cmd = ""

    def num() -> float:
        nonlocal i
        v = toks[i]
        i += 1
        return v

    while i < len(toks):
        if isinstance(toks[i], str):
            cmd = toks[i]
            i += 1
        if cmd in ("M", "m"):
            nx, ny = num(), num()
            if cmd == "m":
                nx, ny = x + nx, y + ny
            x, y = nx, ny
            start = (x, y)
            cur = [(x, y)]
            subs.append(cur)
        elif cmd in ("L", "l"):
            nx, ny = num(), num()
            if cmd == "l":
                nx, ny = x + nx, y + ny
            x, y = nx, ny
            cur.append((x, y))
        elif cmd in ("H", "h"):
            nx = num()
            x = x + nx if cmd == "h" else nx
            cur.append((x, y))
        elif cmd in ("V", "v"):
            ny = num()
            y = y + ny if cmd == "v" else ny
            cur.append((x, y))
        elif cmd in ("C", "c"):
            x1, y1, x2, y2, nx, ny = (num() for _ in range(6))
            if cmd == "c":
                x1, y1, x2, y2, nx, ny = x1 + x, y1 + y, x2 + x, y2 + y, nx + x, ny + y
            cur.extend(_cubic((x, y), (x1, y1), (x2, y2), (nx, ny)))
            x, y = nx, ny
        elif cmd in ("Z", "z"):
            if cur and cur[-1] != start:
                cur.append(start)
            x, y = start
        else:  # token inesperado: se salta
            i += 1
    return subs


class Pen:
    """Dibuja geometría del SVG (viewBox 0..64) sobre un ImageDraw."""

    def __init__(self, draw: ImageDraw.ImageDraw, ox: float, oy: float, k: float):
        self.d = draw
        self.ox = ox
        self.oy = oy
        self.k = k  # píxeles por unidad SVG

    def _xy(self, x, y):
        return (self.ox + x * self.k, self.oy + y * self.k)

    def _w(self, width: float) -> int:
        return max(1, int(round(width * self.k)))

    def rr(self, x, y, w, h, r, *, fill=None, outline=None, width=0.0):
        self.d.rounded_rectangle(
            [self.ox + x * self.k, self.oy + y * self.k,
             self.ox + (x + w) * self.k, self.oy + (y + h) * self.k],
            radius=r * self.k, fill=fill, outline=outline,
            width=self._w(width) if outline else 0,
        )

    def ellipse(self, cx, cy, rx, ry, *, fill=None, outline=None, width=0.0):
        self.d.ellipse(
            [self.ox + (cx - rx) * self.k, self.oy + (cy - ry) * self.k,
             self.ox + (cx + rx) * self.k, self.oy + (cy + ry) * self.k],
            fill=fill, outline=outline, width=self._w(width) if outline else 0,
        )

    def circle(self, cx, cy, r, *, fill=None, outline=None, width=0.0):
        self.ellipse(cx, cy, r, r, fill=fill, outline=outline, width=width)

    def poly(self, pts, *, fill=None):
        self.d.polygon([self._xy(x, y) for x, y in pts], fill=fill)

    def stroke(self, pts, color, width):
        xy = [self._xy(x, y) for x, y in pts]
        w = self._w(width)
        self.d.line(xy, fill=color, width=w, joint="curve")
        r = w / 2
        for px, py in (xy[0], xy[-1]):
            self.d.ellipse([px - r, py - r, px + r, py + r], fill=color)

    def path(self, d, *, stroke=None, fill=None, width=MASCOT_STROKE, tf=None):
        for sub in parse_path(d):
            if tf:
                sub = [tf(px, py) for px, py in sub]
            if fill is not None:
                self.poly(sub, fill=fill)
            if stroke is not None:
                self.stroke(sub, stroke, width)


def _rot_rect(x, y, w, h, deg, cx, cy):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    out = []
    for px, py in ((x, y), (x + w, y), (x + w, y + h), (x, y + h)):
        dx, dy = px - cx, py - cy
        out.append((cx + dx * ca - dy * sa, cy + dx * sa + dy * ca))
    return out


def draw_face(pen: Pen, expression: str, x: float, y: float, scale: float = 1.0) -> None:
    def tf(px, py):
        return (x + px * scale, y + py * scale)

    pen.path("M-8 -5 C-5 -7 -3 -7 -1 -5", stroke=TEXT_MAIN, tf=tf)
    pen.path("M5 -5 C7 -7 9 -7 12 -5", stroke=TEXT_MAIN, tf=tf)
    for ex in (-5, 8):
        pen.circle(*tf(ex, 1), 2.5 * scale, fill=TEXT_MAIN)
    for ex in (-4.2, 8.8):
        pen.circle(*tf(ex, 0.2), 0.7 * scale, fill=PAPER)

    if expression == "excited":
        pen.ellipse(*tf(1.5, 12), 5 * scale, 4 * scale,
                    fill=TEXT_MAIN, outline=TEXT_MAIN, width=1)
    else:
        mouths = {
            "happy": "M-5 10 C-2 15 4 15 8 10",
            "curious": "M-2 11 C1 9 4 12 7 10",
            "worried": "M-5 15 C-1 11 4 11 8 15",
            "neutral": "M-4 11 H7",
        }
        pen.path(mouths.get(expression, mouths["neutral"]), stroke=TEXT_MAIN, tf=tf)


def _arms(pen: Pen) -> None:
    pen.path("M12 39 C6 40 6 47 11 49", stroke=TEXT_MAIN)
    pen.path("M52 39 C58 40 58 47 53 49", stroke=TEXT_MAIN)


def draw_mascot(pen: Pen, kind: str, expression: str) -> None:
    """Porta un `kind` de EditorialMascot.tsx a PIL (misma geometría SVG)."""
    _arms(pen)
    if kind == "highlighter":
        pen.rr(17, 8, 30, 48, 9, fill=WARNING, outline=TEXT_MAIN, width=MASCOT_STROKE)
        pen.rr(16, 5, 32, 12, 6, fill=DANGER, outline=TEXT_MAIN, width=MASCOT_STROKE)
        pen.rr(23, 47, 18, 3, 1.5, fill=DANGER)
        draw_face(pen, expression, 32, 31)
    elif kind == "ruler":
        pen.rr(5, 23, 54, 18, 8, fill=SUCCESS, outline=TEXT_MAIN, width=MASCOT_STROKE)
        pen.path("M13 37 V31 M20 37 V33 M27 37 V31 M34 37 V33 M41 37 V31 M48 37 V33",
                 stroke=TEXT_MAIN)
        draw_face(pen, expression, 32, 28, 0.62)
    elif kind == "reference":
        pen.path("M45 45 L53 55 L40 49", fill=ACCENT, stroke=TEXT_MAIN)
        pen.rr(9, 15, 46, 34, 10, fill=ACCENT, outline=TEXT_MAIN, width=MASCOT_STROKE)
        pen.path("M17 25 C14 21 16 18 20 19 M22 25 C19 21 21 18 25 19",
                 stroke=PAPER, width=2)
        pen.path("M18 41 H45 M25 37 H45", stroke=ACCENT_TINT, width=1.4)
        draw_face(pen, expression, 33, 26, 0.62)
    elif kind == "strike":
        pen.path("M5 25 L16 20 V44 L5 39 Z", fill=TEXT_MAIN)
        pen.rr(12, 21, 47, 22, 9, fill=DANGER, outline=TEXT_MAIN, width=MASCOT_STROKE)
        pen.path("M17 48 H53", stroke=TEXT_MAIN)
        draw_face(pen, expression, 38, 28, 0.68)
    elif kind == "gear":
        for deg in (0, 45, 90, 135, 180, 225, 270, 315):
            quad = _rot_rect(29, 6, 6, 7, deg, 32, 32)
            pen.poly(quad, fill=ACCENT)
            pen.stroke(list(quad) + [quad[0]], TEXT_MAIN, MASCOT_STROKE)
        pen.circle(32, 32, 20, fill=ACCENT, outline=TEXT_MAIN, width=MASCOT_STROKE)
        draw_face(pen, expression, 32, 32, 0.55)
    else:
        raise ValueError(f"kind de mascota desconocido: {kind!r}")


def render_mascot(size: int, kind: str, expression: str) -> Image.Image:
    """Mascota a resolución SS (size*SS px), lista para pegar en un lienzo SS."""
    canvas = size * SS
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw_mascot(Pen(ImageDraw.Draw(img), 0, 0, canvas / 64.0), kind, expression)
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

    Misma retícula en ambos; el desinstalador solo cambia la mascota, la
    etiqueta y la píldora para leerse como una operación sobria.
    """
    w, h = 164, 314
    kind = "gear" if uninstaller else "highlighter"
    expression = "neutral" if uninstaller else "happy"

    img = Image.new("RGB", (w * SS, h * SS), PAPER)
    draw = ImageDraw.Draw(img)

    # Mascota centrada (hero de la sidebar; el logo vive en el header)
    mascot = 84
    mark = render_mascot(mascot, kind, expression)
    img.paste(mark, (int((w - mascot) / 2 * SS), int(28 * SS)), mark)

    # Wordmark + tagline
    draw.text(
        (w / 2 * SS, 128 * SS),
        "WordAPA7",
        font=font("bold", 21 * SS),
        fill=TEXT_MAIN,
        anchor="mm",
    )
    draw.text(
        (w / 2 * SS, 150 * SS),
        "Desinstalador" if uninstaller else "Edición Editorial",
        font=font("regular", 12 * SS),
        fill=TEXT_MUTED,
        anchor="mm",
    )

    # Separador de 1px
    draw.rectangle([20 * SS, 168 * SS, (w - 20) * SS, 169 * SS], fill=BORDER)

    # Dos líneas de contexto
    caption = (
        ("Se remueve la app", "y el complemento de Word")
        if uninstaller
        else ("Diagnóstico APA 7", "en tu documento")
    )
    for i, line in enumerate(caption):
        draw.text(
            (w / 2 * SS, (192 + i * 18) * SS),
            line,
            font=font("regular", 11 * SS),
            fill=TEXT_MUTED,
            anchor="mm",
        )

    # Píldora de estado, superficie sutil y borde de 1px
    pill = "Limpieza segura" if uninstaller else "Normas APA 7ma Ed."
    px0, py0, px1, py1 = 18, 262, 146, 292
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
    print(f"[assets] {name} generado (164x314, mascota '{kind}')")


if __name__ == "__main__":
    build_icon()
    build_header()
    build_sidebar()
    build_sidebar(uninstaller=True)
