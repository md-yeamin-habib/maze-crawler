import os
from PIL import Image, ImageDraw

# Output paths pointing to the static folder
base_dir = os.path.dirname(__file__)
static_dir = os.path.join(base_dir, 'static')
os.makedirs(static_dir, exist_ok=True)

png_path = os.path.join(static_dir, "icon.png")
ico_path = os.path.join(static_dir, "icon.ico")

# Design Constants
ICON_SIZE = 1024
BG_COLOR = "#0f172a"      # Floor / Default background color
WALL_COLOR = "#334155"    # Wall shade for 1 and 5
BORDER_COLOR = "#fbbf24"  # Amber border frame
TEXT_COLOR = "#38bdf8"    # Bright cyan/teal text

# Exact Maze Grid Provided (17x17)
MAZE_GRID = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1,  5,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  2, -1],
    [-1,  5,  0,  0,  0,  0,  0,  1,  0,  0,  0,  0,  0,  0,  0,  0, -1],
    [-1,  5,  0,  1,  1,  1,  0,  1,  0,  1,  1,  1,  1,  1,  0,  5, -1],
    [-1,  5,  0,  5,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5,  0,  5, -1],
    [-1,  5,  0,  5,  0,  1,  1,  1,  1,  1,  1,  1,  0,  5,  0,  5, -1],
    [-1,  5,  0,  5,  0,  1,  0,  0,  0,  0,  0,  1,  0,  5,  0,  5, -1],
    [-1,  5,  0,  5,  0,  1,  0,  0,  0,  0,  0,  1,  0,  5,  0,  5, -1],
    [-1,  5,  0,  0,  0,  0,  0,  0,  4,  0,  0,  0,  0,  5,  0,  5, -1],
    [-1,  5,  0,  1,  0,  1,  0,  0,  0,  0,  0,  1,  0,  5,  0,  5, -1],
    [-1,  5,  0,  1,  0,  1,  1,  1,  1,  1,  1,  1,  0,  5,  0,  5, -1],
    [-1,  5,  0,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5,  0,  5, -1],
    [-1,  5,  0,  1,  1,  1,  0,  1,  0,  1,  1,  1,  1,  5,  0,  5, -1],
    [-1,  5,  0,  0,  0,  0,  0,  1,  0,  0,  0,  0,  0,  0,  0,  5, -1],
    [-1,  0,  1,  1,  1,  1,  0,  1,  1,  1,  1,  1,  1,  1,  1,  5, -1],
    [-1,  3,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
]

def draw_pixel_letter(draw, letter, ox, oy, scale):
    """Draws large pixel-art characters using a 5x5 grid matrix."""
    font_grid = {
        'M': ["10001", "11011", "10101", "10001", "10001"],
        'A': ["01110", "10001", "11111", "10001", "10001"],
        'Z': ["11111", "00010", "00100", "01000", "11111"],
        'E': ["11111", "10000", "11110", "10000", "11111"],
        'C': ["01111", "10000", "10000", "10000", "01111"],
        'R': ["11110", "10001", "11110", "10100", "10001"],
        'W': ["10001", "10001", "10101", "11011", "10001"],
        'L': ["10000", "10000", "10000", "10000", "11111"]
    }
    grid = font_grid.get(letter.upper())
    if not grid:
        return

    for r in range(5):
        for c in range(5):
            if grid[r][c] == '1':
                x1 = ox + c * scale
                y1 = oy + r * scale
                x2 = x1 + scale
                y2 = y1 + scale
                draw.rectangle([x1, y1, x2, y2], fill=TEXT_COLOR)

def draw_pixel_text(draw, word, center_x, top_y, scale):
    """Draws centered pixel-art text words."""
    letter_w = 5 * scale
    letter_spacing = 1 * scale
    total_w = len(word) * letter_w + (len(word) - 1) * letter_spacing
    start_x = center_x - total_w // 2

    for i, char in enumerate(word):
        lx = start_x + i * (letter_w + letter_spacing)
        draw_pixel_letter(draw, char, lx, top_y, scale)

def generate_png():
    print(f"Generating high-res PNG icon at {png_path}...")
    img = Image.new('RGB', (ICON_SIZE, ICON_SIZE), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 1. Render Maze Grid Background
    rows = len(MAZE_GRID)
    cols = len(MAZE_GRID[0])
    cell_w = ICON_SIZE / cols
    cell_h = ICON_SIZE / rows

    for r in range(rows):
        for c in range(cols):
            val = MAZE_GRID[r][c]
            x1 = int(c * cell_w)
            y1 = int(r * cell_h)
            x2 = int((c + 1) * cell_w)
            y2 = int((r + 1) * cell_h)

            # 1 = wall (lighter shade), 5 = wall variant. Everything else treated as floor.
            if val == 1 or val == 5:
                draw.rectangle([x1, y1, x2, y2], fill=WALL_COLOR, outline="#1e293b", width=1)

    # 2. Draw Outer Gold Border Frame
    border_thickness = 32
    draw.rectangle([0, 0, ICON_SIZE - 1, ICON_SIZE - 1], outline=BORDER_COLOR, width=border_thickness)

    # 3. Draw Centered Pixel Art Text: MAZE CRAWLER
    scale = 22  # Size of each pixel block in letters
    center_x = ICON_SIZE // 2
    
    # Total text block height estimation (2 lines of 5-pixel height letters + gap)
    # 2 * (5 * 22) + gap(40) = 220 + 40 = 260px height.
    # Center vertically: (1024 - 260) / 2 = 382px start y.
    start_y = 370
    line_gap = 50
    line_height = 5 * scale

    # "MAZE"
    draw_pixel_text(draw, "MAZE", center_x, start_y, scale)
    
    # "CRAWLER"
    draw_pixel_text(draw, "CRAWLER", center_x, start_y + line_height + line_gap, scale)

    # 4. Save PNG
    img.save(png_path)
    print(f"PNG generated successfully at {png_path}.")

def convert_to_ico():
    print(f"Converting to multi-size ICO at {ico_path}...")
    img = Image.open(png_path)
    ico_sizes = [(256, 256), (128, 128), (96, 96), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ico_path, format='ICO', sizes=ico_sizes)
    print(f"ICO generated successfully at {ico_path}.")

if __name__ == '__main__':
    generate_png()
    convert_to_ico()