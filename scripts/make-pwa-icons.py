from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path("/workspace/public")
SIZES = [180, 192, 512]


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=(12, 17, 22, 255))
    d.rounded_rectangle(
        (int(size * 0.04), int(size * 0.04), size - int(size * 0.04) - 1, size - int(size * 0.04) - 1),
        radius=int(r * 0.85),
        outline=(59, 168, 154, 255),
        width=max(2, size // 64),
    )
    cx, cy = size / 2, size * 0.46
    drop_w, drop_h = size * 0.28, size * 0.36
    # droplet
    d.ellipse(
        [cx - drop_w / 2, cy - drop_h * 0.15, cx + drop_w / 2, cy + drop_h * 0.55],
        fill=(59, 168, 154, 255),
    )
    tip = [
        (cx, cy - drop_h * 0.62),
        (cx - drop_w * 0.42, cy + drop_h * 0.05),
        (cx + drop_w * 0.42, cy + drop_h * 0.05),
    ]
    d.polygon(tip, fill=(59, 168, 154, 255))
    # highlight
    d.ellipse(
        [cx - drop_w * 0.22, cy + drop_h * 0.02, cx - drop_w * 0.02, cy + drop_h * 0.22],
        fill=(182, 232, 220, 220),
    )
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.13))
    except OSError:
        font = ImageFont.load_default()
    text = "UMC"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2, size * 0.78), text, fill=(230, 237, 242, 255), font=font)
    return img


def main() -> None:
    grok = OUT / "__grok"
    icons = OUT / "icons"
    grok.mkdir(parents=True, exist_ok=True)
    icons.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        im = draw_icon(size)
        im.save(icons / f"icon-{size}.png", "PNG")
        im.save(grok / f"icon-{size}.png", "PNG")
    draw_icon(180).save(grok / "icon-180.png", "PNG")
    print("wrote icons", SIZES)


if __name__ == "__main__":
    main()
