#!/usr/bin/env python3
"""Remove dark background from AstroGroot logo; keep tree and text only."""
from PIL import Image
import sys

def luminance(r, g, b):
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "static/astrogroot-logo.png"
    out_path = sys.argv[2] if len(sys.argv) > 2 else path  # overwrite by default

    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()

    # Dark threshold: pixels below this luminance are considered background
    DARK = 0.28
    # Flood-fill from all edge pixels
    to_remove = set()
    for x in range(w):
        for y in [0, h - 1]:
            r, g, b, a = px[x, y]
            if a > 0 and luminance(r, g, b) <= DARK:
                to_remove.add((x, y))
    for y in range(h):
        for x in [0, w - 1]:
            r, g, b, a = px[x, y]
            if a > 0 and luminance(r, g, b) <= DARK:
                to_remove.add((x, y))

    # Flood fill
    stack = list(to_remove)
    while stack:
        x, y = stack.pop()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in to_remove:
                r, g, b, a = px[nx, ny]
                if a > 0 and luminance(r, g, b) <= DARK:
                    to_remove.add((nx, ny))
                    stack.append((nx, ny))

    # Set background (flood-filled) pixels to transparent
    for (x, y) in to_remove:
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)

    # Remove isolated very dark pixels (e.g. small stars) not connected to edges
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a > 0 and luminance(r, g, b) <= 0.15:
                px[x, y] = (r, g, b, 0)

    img.save(out_path, "PNG")
    print(f"Saved: {out_path}")

if __name__ == "__main__":
    main()
