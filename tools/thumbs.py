# Лёгкие превью фото для каталога: img/<папка>/<файл>.jpg → img/t/<папка>/<файл>.jpg (340 px, ~25 КБ).
# Без аргументов — все фото из img/p и img/auto; с аргументами — только переданные файлы (так зовёт бот).
# Уже готовые и не устаревшие превью пропускаются.
import os, sys, glob
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = 340

def thumb(src):
    rel = os.path.relpath(os.path.abspath(src), os.path.join(ROOT, 'img'))
    dst = os.path.join(ROOT, 'img', 't', rel)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    im.thumbnail((W, W * 2), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=66, optimize=True, progressive=True)
    return True

files = sys.argv[1:] or glob.glob(os.path.join(ROOT, 'img', 'p', '*.jpg')) + glob.glob(os.path.join(ROOT, 'img', 'auto', '*.jpg'))
made = sum(thumb(f) for f in files)
print(f'превью: {made} новых из {len(files)}')
