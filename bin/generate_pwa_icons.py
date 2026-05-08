"""Generate PNG icons + iOS splash images for the ColorFlow PWA.

Run from the repository root:
    pip install cairosvg
    python bin/generate_pwa_icons.py

Outputs into colorflow/assets/icons/:
    icon-180.png, icon-192.png, icon-512.png, icon-512-maskable.png
    splash-750x1334.png, splash-1170x2532.png, splash-2048x2732.png
"""

from __future__ import annotations

from pathlib import Path

import cairosvg

ROOT = Path(__file__).resolve().parent.parent
ICON_SVG = ROOT / "colorflow" / "assets" / "icons" / "icon.svg"
OUT_DIR = ROOT / "colorflow" / "assets" / "icons"

# (filename, pixel size). 512 is the canonical PWA size; 192 for older Android;
# 180 for iOS apple-touch-icon.
APP_ICON_SIZES = [180, 192, 512]


def _read_icon_svg() -> str:
    return ICON_SVG.read_text(encoding="utf-8")


def _write_png(svg_text: str, out_path: Path, w: int, h: int) -> None:
    cairosvg.svg2png(
        bytestring=svg_text.encode("utf-8"),
        write_to=str(out_path),
        output_width=w,
        output_height=h,
    )
    print(f"  wrote {out_path.relative_to(ROOT)} ({w}x{h})")


def make_app_icons() -> None:
    svg = _read_icon_svg()
    for size in APP_ICON_SIZES:
        _write_png(svg, OUT_DIR / f"icon-{size}.png", size, size)


def make_maskable_icon() -> None:
    """Maskable icons need ~10% safe-zone padding so the OS can crop to circle/squircle."""
    icon_svg = _read_icon_svg()
    # Strip the wrapping <svg ...> — we re-wrap with our own viewport + padding.
    body = icon_svg.split("<svg", 1)[1].split(">", 1)[1].rsplit("</svg>", 1)[0]
    pad = 64  # of 512 viewBox
    inner = 512 - 2 * pad
    wrapper = f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#6366f1"/>
  <g transform="translate({pad},{pad}) scale({inner / 512})">
    {body}
  </g>
</svg>'''
    out = OUT_DIR / "icon-512-maskable.png"
    _write_png(wrapper, out, 512, 512)


def make_splash(width: int, height: int) -> None:
    icon_svg = _read_icon_svg()
    body = icon_svg.split("<svg", 1)[1].split(">", 1)[1].rsplit("</svg>", 1)[0]
    icon_size = min(width, height) * 0.32
    icon_x = (width - icon_size) / 2
    icon_y = (height - icon_size) / 2
    splash_svg = f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e0e16"/>
      <stop offset="100%" stop-color="#1a1330"/>
    </linearGradient>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#bg)"/>
  <g transform="translate({icon_x},{icon_y}) scale({icon_size / 512})">
    {body}
  </g>
</svg>'''
    name = f"splash-{width}x{height}.png"
    _write_png(splash_svg, OUT_DIR / name, width, height)


SPLASH_SIZES = [
    (750, 1334),    # iPhone SE/8
    (1170, 2532),   # iPhone 12/13/14 Pro
    (2048, 2732),   # iPad Pro 12.9"
]


def main() -> None:
    if not ICON_SVG.exists():
        raise SystemExit(f"missing {ICON_SVG}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("App icons:")
    make_app_icons()
    print("Maskable:")
    make_maskable_icon()
    print("iOS splash:")
    for w, h in SPLASH_SIZES:
        make_splash(w, h)
    print("Done.")


if __name__ == "__main__":
    main()
