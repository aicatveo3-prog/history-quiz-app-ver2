"""Turn every question image into plain text data (content/questions-text/).

The problem PDFs draw their text as vector outlines (no text layer) and place photos/figures as separate
raster images.  So instead of OCR-ing the lossy question JPEGs we
  1. open the PDF with pdfium, remember where the embedded images are, then delete the images and thin
     rules/underlines (they confuse OCR) and re-render the page at high resolution (scale 4.4),
  2. cut the same question boxes that were used for the website images (exams.js `crop`),
  3. run Tesseract (kor+eng, "best" models in tools/tessdata) on every question,
  4. split the result into stem / passage / five choices, record figures (+ any text inside them) and
     quality flags, and write one draft JSON per exam to content/questions-text/ocr/.
  5. (separately) the drafts are proof-read against the page images and merged by tools/merge_verified_text.py.

Usage:  python tools/extract_question_text.py            # all exams in dist/exams.js
        python tools/extract_question_text.py 80 79      # only some exams
Resumable: raw Tesseract output is cached in tmp/qtext/ (delete it to force a fresh OCR run).
"""
import csv
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from statistics import mean

import pypdfium2 as pdfium
import pypdfium2.raw as raw

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'site' / 'dist'
SOURCE = ROOT / '한능검 기출'
OUT = ROOT / 'site' / 'content' / 'questions-text' / 'ocr'     # raw OCR drafts; tools/merge_verified_text.py builds the final files one folder up
CACHE = ROOT / 'tmp' / 'qtext'
TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe'
TESSDATA = ROOT / 'site' / 'tools' / 'tessdata'
BASE_SCALE = 2.2          # scale of the website images / exams.js crop boxes
SCALE = 4.4               # OCR render scale
K = SCALE / BASE_SCALE
THRESHOLD = 150           # drop tinted box backgrounds, keep black text
HANGUL = re.compile(r'[가-힣]')
MARKER = re.compile(r'^[\(\[\{]?[0-9A-Za-z@®©ⓞ①-⑩]{1,3}[\)\]\}]?$')


def find_pdf(number):
    for f in SOURCE.glob('*.pdf'):
        if re.search(rf'(?<!\d){number}회', f.name) and '문제' in f.name and '심화' in f.name:
            return f
    raise FileNotFoundError(number)


def load_exams():
    text = (DIST / 'exams.js').read_text(encoding='utf-8-sig')
    return json.loads(text.split('=', 1)[1].strip().rstrip(';'))


def tesseract(png, stem, psm, languages='kor+eng'):
    """Run Tesseract (cached) and return the parsed word table."""
    tsv = Path(str(stem) + '.tsv')
    if not tsv.exists():
        # `txt` keeps normal Korean word spacing, `tsv` gives word boxes and confidences: ask for both.
        subprocess.run([TESSERACT, str(png), str(stem), '-l', languages, '--psm', str(psm), '--dpi', '300',
                        '--tessdata-dir', str(TESSDATA), 'txt', 'tsv'],
                       capture_output=True, check=True, env=dict(os.environ, OMP_THREAD_LIMIT='1'))
    with open(tsv, encoding='utf-8') as f:
        rows = list(csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE))
    words = []
    for r in rows:
        text = (r['text'] or '').strip()
        if r['level'] == '5' and text:
            words.append({'text': text, 'conf': float(r['conf']), 'left': int(r['left']), 'top': int(r['top']),
                          'right': int(r['left']) + int(r['width']), 'bottom': int(r['top']) + int(r['height']),
                          'line': (int(r['block_num']), int(r['par_num']), int(r['line_num']))})
    txt = Path(str(stem) + '.txt')
    txt_lines = [l.strip() for l in txt.read_text(encoding='utf-8').splitlines() if l.strip()] if txt.exists() else []
    return words, txt_lines


def group_lines(words, txt_lines=None):
    lines = {}
    for w in words:
        lines.setdefault(w['line'], []).append(w)
    out = []
    for ws in lines.values():
        ws.sort(key=lambda w: w['left'])
        gap = max((b['left'] - a['right'] for a, b in zip(ws, ws[1:])), default=0)
        out.append({'words': ws, 'text': ' '.join(w['text'] for w in ws), 'top': min(w['top'] for w in ws),
                    'bottom': max(w['bottom'] for w in ws), 'left': ws[0]['left'], 'gap': gap,
                    'conf': mean(w['conf'] for w in ws)})
    out.sort(key=lambda l: l['top'])
    if txt_lines is not None and len(txt_lines) == len(out):
        for line, text in zip(out, txt_lines):    # same lines, but with proper word spacing
            line['text'] = text
    elif txt_lines is not None:
        out[0]['spacing_unreliable'] = True
    return out


def is_marker_word(word):
    t = word['text']
    return bool(MARKER.match(t)) and not HANGUL.search(t)


def parse_question(lines, width, points):
    """Split OCR lines into stem / passage / choices. Returns (stem, passage, choices, notes)."""
    notes = []
    if not lines:
        return '', '', [], ['no_text']
    # --- stem: first line(s) up to the one that carries '?' or the [N점] mark
    stem_end = 0
    for i, line in enumerate(lines[:4]):
        stem_end = i
        if '?' in line['text'] or re.search(r'\[[^\]]{1,5}[\]|]?\s*$', line['text']):
            break
    stem_lines = [l['text'] for l in lines[:stem_end + 1]]
    first = lines[0]['words'][0]['text']
    if not HANGUL.search(first) and len(first) <= 3 and re.search(r'[\d§\\.,]', first + '.'):
        stem_lines[0] = stem_lines[0][len(first):].strip()
    stem = ' '.join(stem_lines)
    stem = re.sub(r'\s*\[[^\]]{1,5}[\]|]?\s*$', '', stem).strip() + f' [{points}점]'
    rest = lines[stem_end + 1:]
    # --- choices, variant A: five lines that start with a choice marker (circled digit read as junk)
    marker_idx = [i for i, l in enumerate(rest)
                  if is_marker_word(l['words'][0]) and l['words'][0]['left'] < width * 0.12 and HANGUL.search(l['text'])]
    choices, passage_lines = [], rest
    if len(marker_idx) >= 5:
        idx = marker_idx[-5:]
        passage_lines = rest[:idx[0]]
        for a, b in zip(idx, idx[1:] + [len(rest)]):
            seg = [rest[a]['text'].split(' ', 1)[1] if ' ' in rest[a]['text'] else ''] + [l['text'] for l in rest[a + 1:b]]
            choices.append(' '.join(s for s in seg if s).strip())
    else:
        # --- variant B: markers sit inside the last lines, e.g. "① (가)  ② (나)  ③ (다) ..."
        tail = rest[-3:]
        words = [w for l in tail for w in l['words']]
        marks = [i for i, w in enumerate(words) if is_marker_word(w) and i + 1 < len(words)
                 and (words[i + 1]['text'].startswith('(') or HANGUL.search(words[i + 1]['text']))]
        if len(marks) == 5:
            first_line_of_tail = next(i for i, l in enumerate(rest) if l is tail[0])
            first_word = words[marks[0]]
            owner = next(i for i, l in enumerate(rest) if first_word in l['words'])
            passage_lines = rest[:owner]
            for a, b in zip(marks, marks[1:] + [len(words)]):
                choices.append(' '.join(w['text'] for w in words[a + 1:b]).strip())
            notes.append('choices_inline')
        else:
            notes.append('choices_not_found')
    passage = '\n'.join(l['text'] for l in passage_lines)
    if any(l['gap'] > 170 for l in lines):
        notes.append('columns_suspected')   # side-by-side text boxes may be interleaved in reading order
    return stem, passage, choices, notes


def suspicious_tokens(words):
    out = []
    for w in words:
        t = w['text']
        if w['conf'] < 60 and (HANGUL.search(t) or re.search(r'[A-Za-z]{2,}', t)):
            out.append(t)
        elif HANGUL.search(t) and re.search(r'[A-Za-z]', t):
            out.append(t)
    return out


def figure_text(png, stem):
    words, txt_lines = tesseract(png, stem, 6)
    lines = [l['text'] for l in group_lines(words, txt_lines)
             if l['conf'] >= 70 and len(HANGUL.findall(l['text'])) >= 2]
    return '\n'.join(lines)


def process_exam(exam, pool):
    number = exam['id']
    pdf = pdfium.PdfDocument(find_pdf(number))
    cache = CACHE / str(number)
    cache.mkdir(parents=True, exist_ok=True)
    records = []
    by_page = {}
    for q in exam['questions']:
        by_page.setdefault(q['page'], []).append(q)
    for page_no in sorted(by_page):
        page = pdf[page_no - 1]
        height_pt = page.get_height()
        fig_boxes = []
        scanned = False                  # 제78회: every page is a single full-page scan, there is no vector text to isolate
        for obj in page.get_objects(filter=[raw.FPDF_PAGEOBJ_IMAGE], max_depth=15):
            l, b, r, t = obj.get_bounds()
            if (r - l) > 600 and (t - b) > 900:
                scanned = True
            fig_boxes.append((l * BASE_SCALE, (height_pt - t) * BASE_SCALE, r * BASE_SCALE, (height_pt - b) * BASE_SCALE))
        if scanned:
            fig_boxes = []
            clean = page.render(scale=SCALE).to_pil().convert('L')
            raw_img = None
        else:
            raw_img = page.render(scale=SCALE).to_pil().convert('L') if fig_boxes else None
            for obj in list(page.get_objects(filter=[raw.FPDF_PAGEOBJ_IMAGE], max_depth=15)):
                page.remove_obj(obj)
            for obj in list(page.get_objects(filter=[raw.FPDF_PAGEOBJ_PATH], max_depth=15)):
                l, b, r, t = obj.get_bounds()
                if min(r - l, t - b) < 1.3 and max(r - l, t - b) > 12:     # underlines, table rules, box borders
                    page.remove_obj(obj)
            page.gen_content()
            clean = page.render(scale=SCALE).to_pil().convert('L')
        jobs = []
        for q in by_page[page_no]:
            x0, y0, x1, y1 = (int(v * K) for v in q['crop'])
            png = cache / f"{q['number']:02d}.png"
            if not (cache / f"{q['number']:02d}.tsv").exists():
                clean.crop((x0, y0, x1, y1)).point(lambda v: 0 if v < THRESHOLD else 255).save(png)
            figs = []
            cx0, cy0, cx1, cy1 = q['crop']
            for k, (fl, ft, fr, fb) in enumerate(fig_boxes):
                if cx0 <= (fl + fr) / 2 <= cx1 and cy0 <= (ft + fb) / 2 <= cy1 and (fr - fl) > 25 and (fb - ft) > 25:
                    fpng = cache / f"{q['number']:02d}-f{k}.png"
                    if not (cache / f"{q['number']:02d}-f{k}.tsv").exists() and (fr - fl) > 120 and (fb - ft) > 60:
                        raw_img.crop((int(fl * K), int(ft * K), int(fr * K), int(fb * K))).save(fpng)
                    figs.append((k, (round(fl - cx0), round(ft - cy0), round(fr - cx0), round(fb - cy0)), fpng))
            jobs.append((q, png, figs, x1 - x0))
        # OCR everything on this page in parallel
        def run(job):
            q, png, figs, width = job
            words, txt_lines = tesseract(png, cache / f"{q['number']:02d}", 6)
            fig_out = []
            for k, box, fpng in figs:
                text = ''
                if fpng.exists():
                    text = figure_text(fpng, cache / f"{q['number']:02d}-f{k}")
                fig_out.append({'bbox': list(box), 'text': text})
            return q, words, txt_lines, fig_out, width
        for q, words, txt_lines, fig_out, width in pool.map(run, jobs):
            lines = group_lines(words, txt_lines)
            stem, passage, choices, notes = parse_question(lines, width, q['points'])
            suspects = suspicious_tokens(words)
            confs = [w['conf'] for w in words if HANGUL.search(w['text']) or w['text'].isalnum()]
            if len(choices) == 5 and any(not c for c in choices):
                notes.append('empty_choice')            # usually a choice that is a picture
            if len(choices) != 5 and not any(n.startswith('choices') for n in notes):
                notes.append('choices_not_found')
            if suspects:
                notes.append('suspicious_tokens')
            if any(l.get('spacing_unreliable') for l in lines):
                notes.append('spacing_unreliable')
            marks = '①②③④⑤'
            text_parts = [stem] + ([passage] if passage else []) + [f'{marks[i]} {c}'.rstrip() for i, c in enumerate(choices)]
            records.append({
                'exam': number, 'number': q['number'], 'points': q['points'], 'answer': q['answer'],
                'page': q['page'], 'image': q['image'],
                'stem': stem, 'passage': passage, 'choices': choices,
                'text': '\n'.join(text_parts),
                'figures': fig_out,
                'ocr': {'engine': 'tesseract kor+eng (tessdata_best), text-only PDF render x4.4',
                        'mean_conf': round(mean(confs), 1) if confs else 0.0,
                        'suspicious_tokens': suspects[:12],
                        'notes': notes},
                'verified': False,
            })
        print(f'  {number} page {page_no}: {len(by_page[page_no])} questions', flush=True)
    records.sort(key=lambda r: r['number'])
    assert [r['number'] for r in records] == list(range(1, 51)), number
    return records


def main(only):
    OUT.mkdir(parents=True, exist_ok=True)
    exams = [e for e in load_exams() if not only or e['id'] in only]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for exam in exams:
            print(f"exam {exam['id']}", flush=True)
            records = process_exam(exam, pool)
            (OUT / f"{exam['id']}.json").write_text(json.dumps(records, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'wrote OCR drafts to {OUT}')


if __name__ == '__main__':
    main({int(a) for a in sys.argv[1:]})
