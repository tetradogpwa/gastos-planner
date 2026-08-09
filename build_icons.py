"""Generate PWA icons for Mis Gastos.

Creates 192x192 and 512x512 PNGs with a wallet/coin motif.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

PRIMARY = (99, 102, 241)  # indigo-500
PRIMARY_DARK = (79, 70, 229)
WHITE = (255, 255, 255)
GREEN = (16, 185, 129)
GREEN_DARK = (5, 150, 105)
SHADOW = (15, 23, 42)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    # For maskable, keep all content inside 80% safe zone
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded square with gradient
    pad = int(size * 0.05) if not maskable else int(size * 0.10)
    bg_size = size - 2 * pad
    bg = Image.new('RGBA', (bg_size, bg_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)

    # Vertical gradient
    for y in range(bg_size):
        t = y / max(1, bg_size - 1)
        color = lerp(PRIMARY, PRIMARY_DARK, t) + (255,)
        bg_draw.line([(0, y), (bg_size, y)], fill=color)

    # Rounded mask
    mask = Image.new('L', (bg_size, bg_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(bg_size * 0.22)
    mask_draw.rounded_rectangle([(0, 0), (bg_size, bg_size)], radius=radius, fill=255)
    bg.putalpha(mask)

    img.paste(bg, (pad, pad), bg)

    # Draw a wallet/card icon centered
    # Use the inner 56% of the size for the icon
    inner = int(size * 0.56)
    cx = size // 2
    cy = size // 2 - int(size * 0.02)
    half = inner // 2

    # Card body
    card_left = cx - half
    card_top = cy - int(half * 0.72)
    card_right = cx + half
    card_bottom = cy + int(half * 0.72)
    card_radius = int(inner * 0.12)

    # Subtle drop shadow
    shadow_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_img)
    sd.rounded_rectangle(
        [(card_left + 4, card_top + 6), (card_right + 4, card_bottom + 6)],
        radius=card_radius,
        fill=(0, 0, 0, 60),
    )
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=8))
    img.alpha_composite(shadow_img)

    # Card
    card = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle(
        [(card_left, card_top), (card_right, card_bottom)],
        radius=card_radius,
        fill=WHITE + (255,),
    )
    img.alpha_composite(card)

    # Green band on top of card
    band = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    band_h = int((card_bottom - card_top) * 0.32)
    bd.rounded_rectangle(
        [(card_left, card_top), (card_right, card_top + band_h + card_radius)],
        radius=card_radius,
        fill=GREEN + (255,),
    )
    # Square off bottom corners of band
    bd.rectangle(
        [(card_left, card_top + card_radius), (card_right, card_top + band_h)],
        fill=GREEN + (255,),
    )
    img.alpha_composite(band)

    # Currency symbol: € in white
    sym_size = int(inner * 0.42)
    try:
        from PIL import ImageFont
        # Try a system font; fallback to default
        font = None
        for path in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        ]:
            if os.path.exists(path):
                font = ImageFont.truetype(path, sym_size)
                break
        if font is None:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    sym = "€"
    bbox = draw.textbbox((0, 0), sym, font=font)
    sw = bbox[2] - bbox[0]
    sh = bbox[3] - bbox[1]
    sx = cx - sw // 2 - bbox[0]
    sy = cy - sh // 2 - bbox[1] - int(size * 0.04)
    draw.text((sx, sy), sym, fill=PRIMARY + (255,), font=font)

    # Draw 3 small lines below the symbol (like card stripes)
    line_y = cy + int(inner * 0.18)
    line_x_start = cx - int(inner * 0.22)
    line_w = int(inner * 0.10)
    for i, w in enumerate([line_w, int(line_w * 1.6), int(line_w * 0.8)]):
        y = line_y + i * int(size * 0.04)
        x0 = line_x_start
        x1 = line_x_start + w
        # Rounded line
        ld = ImageDraw.Draw(img)
        ld.rounded_rectangle(
            [(x0, y), (x1, y + int(size * 0.018))],
            radius=int(size * 0.009),
            fill=(148, 163, 184, 255),
        )

    return img


def main():
    # Standard icons
    icon192 = make_icon(192, maskable=False)
    icon192.save(os.path.join(OUT_DIR, 'icon-192.png'), 'PNG')

    icon512 = make_icon(512, maskable=False)
    icon512.save(os.path.join(OUT_DIR, 'icon-512.png'), 'PNG')

    # Maskable variants
    icon192m = make_icon(192, maskable=True)
    icon192m.save(os.path.join(OUT_DIR, 'icon-192-maskable.png'), 'PNG')

    icon512m = make_icon(512, maskable=True)
    icon512m.save(os.path.join(OUT_DIR, 'icon-512-maskable.png'), 'PNG')

    # Favicon
    icon32 = make_icon(32, maskable=False)
    icon32.save(os.path.join(OUT_DIR, 'favicon-32.png'), 'PNG')

    # Apple touch
    icon180 = make_icon(180, maskable=False)
    icon180.save(os.path.join(OUT_DIR, 'apple-touch-icon.png'), 'PNG')

    print('Icons generated:')
    for f in sorted(os.listdir(OUT_DIR)):
        full = os.path.join(OUT_DIR, f)
        print(f'  {f}  ({os.path.getsize(full)} bytes)')


if __name__ == '__main__':
    main()
