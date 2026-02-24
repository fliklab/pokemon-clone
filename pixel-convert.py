#!/usr/bin/env python3
"""
Convert an image to pixel-art style PNG for the pokemon-clone assets.

Examples:
  python pixel-convert.py input.png output.png
  python pixel-convert.py input.jpg output.png --size 64 --colors 16 --preview
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert image to pixel-art style PNG")
    parser.add_argument("input", type=Path, help="Input image path")
    parser.add_argument("output", type=Path, help="Output image path (PNG recommended)")
    parser.add_argument(
        "--size",
        type=int,
        default=64,
        help="Target width/height in pixels before optional preview upscale (default: 64)",
    )
    parser.add_argument(
        "--colors",
        type=int,
        default=16,
        help="Number of colors for quantization (default: 16)",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Also save enlarged preview next to output file",
    )
    parser.add_argument(
        "--preview-scale",
        type=int,
        default=8,
        help="Scale multiplier for preview image (default: 8)",
    )
    return parser.parse_args()


def convert_to_pixel_art(
    input_path: Path,
    output_path: Path,
    size: int = 64,
    colors: int = 16,
    preview: bool = False,
    preview_scale: int = 8,
) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(input_path) as img:
        rgba = img.convert("RGBA")

        # Fit image to square while preserving aspect ratio.
        fitted = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        resized = rgba.copy()
        resized.thumbnail((size, size), Image.Resampling.LANCZOS)

        x = (size - resized.width) // 2
        y = (size - resized.height) // 2
        fitted.paste(resized, (x, y))

        # Reduce colors for a classic pixel-art look.
        quantized = fitted.convert("P", palette=Image.Palette.ADAPTIVE, colors=colors)
        pixel = quantized.convert("RGBA")

        pixel.save(output_path)

        if preview:
            preview_img = pixel.resize(
                (size * preview_scale, size * preview_scale),
                Image.Resampling.NEAREST,
            )
            preview_path = output_path.with_stem(f"{output_path.stem}_preview")
            preview_img.save(preview_path)


def main() -> None:
    args = parse_args()
    convert_to_pixel_art(
        input_path=args.input,
        output_path=args.output,
        size=args.size,
        colors=args.colors,
        preview=args.preview,
        preview_scale=args.preview_scale,
    )
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
