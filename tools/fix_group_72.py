"""72회 47·48번은 '[47~48] 다음을 읽고 물음에 답하시오' 공통 지문이 있는데,
문항 이미지에 지문이 빠져 있어 page-12.jpg에서 지문+문항을 합쳐 다시 만든다."""
import os, shutil
from PIL import Image

BASE = os.path.join(os.path.dirname(__file__), '..', 'dist', 'assets', '72')
BACKUP = os.path.join(os.path.dirname(__file__), '..', '..', 'tmp', 'backup-72')
os.makedirs(BACKUP, exist_ok=True)
page = Image.open(os.path.join(BASE, 'page-12.jpg')).convert('RGB')
X0, X1 = 85, 790


def stack(parts):
    w = X1 - X0
    h = sum(b - a for a, b in parts) + 12 * (len(parts) - 1)
    out = Image.new('RGB', (w, h), 'white')
    y = 0
    for a, b in parts:
        out.paste(page.crop((X0, a, X1, b)), (0, y))
        y += (b - a) + 12
    return out


# 공통 지문(머리말 + 박스): y 155~985
q47 = stack([(155, 985), (1025, 1325)])
q48 = stack([(155, 985), (1720, 2115)])
for n, im in ((47, q47), (48, q48)):
    p = os.path.join(BASE, f'question-{n}.jpg')
    b = os.path.join(BACKUP, f'question-{n}.jpg')
    if not os.path.exists(b) and os.path.exists(p):
        shutil.copy2(p, b)
    im.save(p, quality=90)
    print(n, im.size)
