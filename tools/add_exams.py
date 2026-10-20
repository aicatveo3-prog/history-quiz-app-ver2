"""Add more exams (questions + answer key only, no explanations) to the site.

Usage:  python tools/add_exams.py 70 71 72 ...

For every exam number the script
  1. finds `한능검 기출/*<n>회 심화 문제.pdf` and `... 정답.pdf`,
  2. renders the 12 problem pages (scale 2.2, same as the first three exams) to dist/assets/<n>/page-XX.jpg,
  3. reads the answer key text (answer + points for 50 questions, 100 points total),
  4. locates each question heading with OCR (the problem PDFs are scanned images),
     validates that headings 1..50 appear exactly once in reading order, and crops one image per question
     with the same rules as tools/crop_questions.py,
  5. appends the exam to dist/exams.js (existing exams are left untouched).

Needs pdfplumber, pypdfium2, Pillow and Tesseract (kor+eng). Explanations are NOT created here.
"""
import csv
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'site' / 'dist'
SOURCE = ROOT / '한능검 기출'
OCR_DIR = ROOT / 'tmp' / 'ocr-new'
TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe'
SCALE = 2.2
COLUMNS = {'L': (80, 798), 'R': (818, 1524)}   # OCR windows (page 1 has a divider line at x=800)
CROP_X = {'L': (80, 795), 'R': (818, 1525)}   # R starts at 818 so the big question number is not clipped
PAGE_BOTTOM = 2158


def find_pdf(number, kind):
    for f in SOURCE.glob('*.pdf'):
        if re.search(rf'(?<!\d){number}회', f.name) and kind in f.name and '심화' in f.name:
            return f
    raise FileNotFoundError(f'{number}회 {kind} PDF')


def read_answers(path):
    with pdfplumber.open(path) as pdf:
        text = pdf.pages[0].extract_text()
    triples = re.findall(r'(\d+)\s+([①②③④⑤])\s+([123])', text)
    questions = sorted(
        ({'number': int(n), 'answer': '①②③④⑤'.index(a) + 1, 'points': int(p)} for n, a, p in triples),
        key=lambda q: q['number'])
    if len(questions) != 50:
        # Some answer sheets (e.g. 제73회) print plain digits: every table row is "no ans pts" repeated 5 times.
        questions = []
        for line in text.splitlines():
            tokens = line.split()
            if len(tokens) == 15 and all(t.isdigit() for t in tokens):
                for i in range(0, 15, 3):
                    n, a, p = (int(t) for t in tokens[i:i + 3])
                    assert 1 <= a <= 5 and p in (1, 2, 3), (line, n, a, p)
                    questions.append({'number': n, 'answer': a, 'points': p})
        questions.sort(key=lambda q: q['number'])
    assert [q['number'] for q in questions] == list(range(1, 51)), ('answer numbers', [q['number'] for q in questions])
    assert sum(q['points'] for q in questions) == 100, 'points must add up to 100'
    return questions


def render_pages(number, problem_pdf):
    folder = DIST / 'assets' / str(number)
    folder.mkdir(parents=True, exist_ok=True)
    document = pdfium.PdfDocument(problem_pdf)
    assert len(document) == 12, (number, len(document))
    for i in range(len(document)):
        page = document[i]
        bitmap = page.render(scale=SCALE)
        bitmap.to_pil().convert('RGB').save(folder / f'page-{i + 1:02d}.jpg', quality=90)
        bitmap.close()
        page.close()
    document.close()
    shutil.copy2(problem_pdf, folder / 'questions.pdf')
    return folder


def ocr_headings(item):
    number, page, side = item
    source = DIST / 'assets' / str(number) / f'page-{page:02d}.jpg'
    x0, x1 = COLUMNS[side]
    y0 = 330 if page == 1 else 105
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    stem = OCR_DIR / f'{number}-{page:02d}-{side}'
    Image.open(source).crop((x0, y0, x1, 2160)).save(str(stem) + '.png')
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    subprocess.run([TESSERACT, str(stem) + '.png', str(stem), '-l', 'kor+eng', '--psm', '6', 'tsv'],
                   capture_output=True, check=True, env=env)
    with open(str(stem) + '.tsv', encoding='utf-8') as f:
        words = list(csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE))
    found = []
    for w in words:
        m = re.fullmatch(r'(\d{1,2})[.,]', w['text'] or '')
        if m and int(w['left']) < 45 and 1 <= int(m[1]) <= 50:
            found.append((int(m[1]), int(w['top']) + y0))
    return number, page, side, found


def ocr_strip(number, page, side, mode):
    """Second chance for a column: OCR only the narrow strip where question numbers sit, enlarged.
    Returns every number-like token (digits, optional dot) so a misread number can still be located."""
    source = DIST / 'assets' / str(number) / f'page-{page:02d}.jpg'
    x0, _ = COLUMNS[side]
    y0 = 330 if page == 1 else 105
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    stem = OCR_DIR / f'{number}-{page:02d}-{side}-strip{mode}'
    strip = Image.open(source).crop((x0, y0, x0 + 150, 2160))
    strip.resize((strip.width * 3, strip.height * 3), Image.LANCZOS).save(str(stem) + '.png')
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    subprocess.run([TESSERACT, str(stem) + '.png', str(stem), '-l', 'eng', '--psm', str(mode), 'tsv'],
                   capture_output=True, check=True, env=env)
    with open(str(stem) + '.tsv', encoding='utf-8') as f:
        words = list(csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE))
    found = []
    for w in words:
        m = re.fullmatch(r'(\d{1,2})[.,]?', w['text'] or '')
        if m and int(w['left']) < 45 * 3 and int(w['height']) >= 45:   # question numbers are tall bold glyphs
            found.append((int(m[1]), int(w['top']) // 3 + y0))
    return found


def assign_numbers(detected):
    """detected: [(number_or_misread, ...)] in reading order -> strictly increasing numbers 1..50
    that agree with as many OCR readings as possible."""
    k = len(detected)
    NEG = -10 ** 6
    dp = [[NEG] * 52 for _ in range(k + 1)]
    back = [[0] * 52 for _ in range(k + 1)]
    dp[0][0] = 0
    for i in range(1, k + 1):
        best, arg = NEG, 0
        for j in range(1, 51):
            if dp[i - 1][j - 1] > best:
                best, arg = dp[i - 1][j - 1], j - 1
            # best over all j' < j
            dp[i][j] = best + (1 if detected[i - 1] == j else 0) if best > NEG else NEG
            back[i][j] = arg
    j = max(range(1, 51), key=lambda v: dp[k][v])
    out = []
    for i in range(k, 0, -1):
        out.append(j)
        j = back[i][j]
    return out[::-1]


def locate_questions(number):
    work = [(number, p, s) for p in range(1, 13) for s in ('L', 'R')]
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(ocr_headings, work))
    columns = [(p, s) for p in range(1, 13) for s in ('L', 'R')]
    tops = {c: sorted({t for _, t in found}) for (_, p, s, found) in results for c in [(p, s)]}
    read = {(p, s, t): n for (_, p, s, found) in results for n, t in found}

    def positions():
        return [(c, t) for c in columns for t in tops[c]]

    # Number every detected heading by its place in reading order, trusting OCR digits only as hints.
    pos = positions()
    assigned = assign_numbers([read[(c[0], c[1], t)] for c, t in pos])
    labelled = {n: (c, t) for n, (c, t) in zip(assigned, pos)}
    # Fill gaps (headings OCR did not see at all) from the strip between the neighbouring headings.
    for n in range(1, 51):
        if n in labelled:
            continue
        before = max((k for k in labelled if k < n), default=None)
        after = min((k for k in labelled if k > n), default=None)
        lo = columns.index(labelled[before][0]) if before else 0
        hi = columns.index(labelled[after][0]) if after else len(columns) - 1
        done = False
        for c in columns[lo:hi + 1]:
            floor = labelled[before][1] + 150 if before and labelled[before][0] == c else 0
            ceil = labelled[after][1] - 150 if after and labelled[after][0] == c else 10 ** 6
            for mode in (6, 11, 4):
                hits = [t for _, t in ocr_strip(number, c[0], c[1], mode)
                        if floor <= t <= ceil and all(abs(t - u) > 120 for u in tops[c])]
                if hits:
                    tops[c] = sorted(tops[c] + [hits[0]])
                    labelled[n] = (c, hits[0])
                    done = True
                    break
            if done:
                break
    layout = {c: [] for c in columns}
    for n, (c, t) in labelled.items():
        layout[c].append((n, t))
    order = [n for c in columns for n, _ in sorted(layout[c], key=lambda x: x[1])]
    return layout, order

def crop_questions(number, layout, questions):
    folder = DIST / 'assets' / str(number)
    pages = []
    for p in range(1, 13):
        original = Image.open(folder / f'page-{p:02d}.jpg').convert('RGB')
        numbers = []
        for side in ('L', 'R'):
            entries = sorted(layout[(p, side)], key=lambda x: x[1])
            x0, x1 = CROP_X[side]
            for i, (n, top) in enumerate(entries):
                bottom = entries[i + 1][1] - 16 if i + 1 < len(entries) else PAGE_BOTTOM
                crop = original.crop((x0, top - 12, x1, bottom))
                # Trim only outer white space below the content; keep every photo and line of text.
                diff = ImageChops.difference(crop, Image.new('RGB', crop.size, 'white')).convert('L').point(lambda v: 255 if v > 35 else 0)
                box = diff.getbbox()
                if box:
                    crop = crop.crop((0, 0, crop.width, min(crop.height, box[3] + 15)))
                image = f'assets/{number}/question-{n:02d}.jpg'
                crop.save(DIST / image, quality=94)
                q = questions[n - 1]
                assert q['number'] == n
                q.update({'image': image, 'page': p, 'crop': [x0, top - 12, x1, bottom]})
                numbers.append(n)
        if numbers:
            pages.append({'image': f'assets/{number}/page-{p:02d}.jpg', 'first': min(numbers), 'last': max(numbers)})
        else:
            pages.append({'image': f'assets/{number}/page-{p:02d}.jpg', 'first': 0, 'last': 0})
    return pages


def load_exams():
    text = (DIST / 'exams.js').read_text(encoding='utf-8-sig')
    return json.loads(text.split('=', 1)[1].strip().rstrip(';'))


def save_exams(exams):
    exams = sorted(exams, key=lambda e: e['id'])
    (DIST / 'exams.js').write_text('window.EXAMS = ' + json.dumps(exams, ensure_ascii=False) + ';\n', encoding='utf-8')


def add_exam(number):
    problem = find_pdf(number, '문제')
    answer = find_pdf(number, '정답')
    questions = read_answers(answer)
    render_pages(number, problem)
    shutil.copy2(answer, DIST / 'assets' / str(number) / 'answers.pdf')
    layout, order = locate_questions(number)
    if order != list(range(1, 51)):
        missing = sorted(set(range(1, 51)) - set(order))
        raise SystemExit(f'{number}회: heading detection mismatch. found order={order} missing={missing}')
    pages = crop_questions(number, layout, questions)
    return {'id': number, 'title': f'제{number}회 심화', 'questions': questions, 'pages': pages}


def main(numbers):
    exams = load_exams()
    have = {e['id'] for e in exams}
    for number in numbers:
        if number in have:
            print(f'skip {number}: already imported')
            continue
        exam = add_exam(number)
        exams = [e for e in exams if e['id'] != number] + [exam]
        save_exams(exams)   # save after every exam so a later failure keeps finished work
        print(f'Added {number}: 50 questions, 100 points, 12 pages', flush=True)


if __name__ == '__main__':
    main([int(a) for a in sys.argv[1:]])
