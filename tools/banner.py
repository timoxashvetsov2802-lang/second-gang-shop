# Картинка для закрепа «Каталог» в канале: аватарка + SECOND GANG. Запуск: python tools/banner.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1280, 720
BG, PINK, GREY = (10, 10, 10), (255, 46, 136), (150, 150, 150)
FONTS = Path('C:/Windows/Fonts')

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

# аватарка в розовом кольце (как в мини-аппке)
size, ring = 380, 12
ava = Image.open(ROOT / 'img/logo.jpg').convert('RGB').resize((size, size), Image.LANCZOS)
mask = Image.new('L', (size * 4, size * 4), 0)
ImageDraw.Draw(mask).ellipse((0, 0, size * 4, size * 4), fill=255)
mask = mask.resize((size, size), Image.LANCZOS)
cx, cy = 300, H // 2
img.paste(ava, (cx - size // 2, cy - size // 2), mask)
r = size // 2 + ring + 6
d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=PINK, width=ring)

# вертикальная черта
d.line((580, 170, 580, 550), fill=(235, 235, 235), width=5)

title = ImageFont.truetype(str(FONTS / 'ariblk.ttf'), 92)
sub = ImageFont.truetype(str(FONTS / 'arialbd.ttf'), 30)
x = 630
d.text((x, 218), 'SECOND', font=title, fill=(255, 255, 255))
d.text((x, 320), 'GANG', font=title, fill=PINK)
d.text((x + 4, 448), 'АРХИВНЫЕ ВЕЩИ  ·  ОДЕЖДА  ·  ОБУВЬ', font=sub, fill=GREY)

out = ROOT / 'img/post-catalog.jpg'
img.save(out, quality=92)
print(out)
