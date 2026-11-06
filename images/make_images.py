# make_images.py
# i used this script to make the two images for level 2.
# it is not part of the web app. i ran it once:
#     python3 make_images.py
# and it saved heightmap.png (grayscale) and colormap.png (color) in this folder.
#
# the seafloor is some sine wave hills, a few underwater mountains, and a
# trench that winds down the middle.

import math
import random
from PIL import Image

SIZE = 512
random.seed(7)  # same seed so i get the same images every time

# a few underwater mountains: (center x, center y, radius, how tall)
MOUNTAINS = [(110, 120, 60, 0.35), (400, 390, 75, 0.4), (420, 110, 45, 0.25), (90, 420, 50, 0.2)]


def trench_center(y):
    # x position of the middle of the trench for row y
    return SIZE / 2 + 80 * math.sin(y / 70) + 30 * math.sin(y / 23)


def height_at(x, y):
    # rolling hills from sine waves
    h = 0.45 + 0.08 * math.sin(x / 40) * math.cos(y / 50) + 0.05 * math.sin((x + y) / 25)

    # mountains are bumps shaped like a bell curve
    for cx, cy, r, tall in MOUNTAINS:
        d2 = (x - cx) ** 2 + (y - cy) ** 2
        h += tall * math.exp(-d2 / (2 * r * r))

    # the trench pulls the height down close to its center line
    d = x - trench_center(y)
    h -= 0.6 * math.exp(-(d * d) / (2 * 28 * 28))
    return h


# ---- height map ----
heights = [[height_at(x, y) for x in range(SIZE)] for y in range(SIZE)]
low = min(min(row) for row in heights)
high = max(max(row) for row in heights)

gray = Image.new("L", (SIZE, SIZE))
for y in range(SIZE):
    for x in range(SIZE):
        h = (heights[y][x] - low) / (high - low)  # 0 to 1
        heights[y][x] = h
        gray.putpixel((x, y), int(h * 255))
gray.save("heightmap.png")

# ---- color image ----
# colors for different heights, low to high. we mix the two closest ones.
STOPS = [
    (0.0, (8, 14, 45)),      # bottom of the trench, almost black blue
    (0.25, (18, 45, 90)),    # deep blue
    (0.5, (45, 85, 110)),    # blue gray
    (0.68, (95, 100, 95)),   # rock
    (0.84, (160, 145, 110)), # dark sand
    (1.0, (215, 195, 145)),  # light sand on the mountains
]


def color_for(h):
    for i in range(len(STOPS) - 1):
        h0, c0 = STOPS[i]
        h1, c1 = STOPS[i + 1]
        if h <= h1:
            t = (h - h0) / (h1 - h0)
            return [c0[k] * (1 - t) + c1[k] * t for k in range(3)]
    return list(STOPS[-1][1])


color = Image.new("RGB", (SIZE, SIZE))
for y in range(SIZE):
    for x in range(SIZE):
        c = color_for(heights[y][x])
        color.putpixel((x, y), (int(c[0]), int(c[1]), int(c[2])))

# coral: small pink circles at random spots on the middle heights
for _ in range(120):
    cx = random.randint(0, SIZE - 1)
    cy = random.randint(0, SIZE - 1)
    if 0.5 < heights[cy][cx] < 0.85:
        for y in range(cy - 4, cy + 5):
            for x in range(cx - 4, cx + 5):
                if 0 <= x < SIZE and 0 <= y < SIZE and (x - cx) ** 2 + (y - cy) ** 2 <= 16:
                    color.putpixel((x, y), (230, 110, 120))

# glowing vents: cyan spots along the trench
for vy in range(40, SIZE, 85):
    vx = int(trench_center(vy))
    for y in range(vy - 6, vy + 7):
        for x in range(vx - 6, vx + 7):
            if 0 <= x < SIZE and 0 <= y < SIZE and (x - vx) ** 2 + (y - vy) ** 2 <= 36:
                color.putpixel((x, y), (60, 240, 230))

color.save("colormap.png")
print("saved heightmap.png and colormap.png")
