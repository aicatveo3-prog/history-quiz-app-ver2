"""Extract question text straight from the PDF text layer (exact characters, no OCR).

Some of the problem PDFs (제70·71·72·75·76·77·80회) carry a real text layer; the others draw their letters as vector
outlines (제73·74·79회) or are page scans (제78회) and need OCR (tools/extract_question_text.py).

For every question the characters inside the same crop box that produced the website image are collected with
pdfplumber, rebuilt into reading order (rows -> side-by-side text frames), split into stem / passage / five choices,
and underlined text is marked with <u>...</u>.  Output: content/questions-text/<exam>.json (final data).

Usage:  python tools/extract_text_layer.py            # every exam whose PDF has a text layer
        python tools/extract_text_layer.py 80 70
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'site' / 'dist'
SOURCE = ROOT / '한능검 기출'
OUT = ROOT / 'site' / 'content' / 'questions-text'
S = 2.2                      # website image scale; exams.js crop boxes are in these pixels
MARKS = '①②③④⑤'
GAP = 16.0                   # horizontal gap (pt) that separates side-by-side text frames
POINTS = re.compile(r'\[\s*\d\s*점\s*\]')
# Private-use glyphs of the exam font, identified by comparing with the page images
PUA = {'\ue284': '□', '\ue22d': '□', '\ue228': '○', '\ue287': '○', '\ue404': '→', '\ue232': '✻',
       # archaic Hangul (제80회 20번 상대별곡); identified from the readings, e.g. 紫陌長堤 = ᄌᆞ믝댱뎨
       '\uf1fc': '\u110c\u119e', '\ue97d': '\u1109\u119e', '\ue3a8': '\u1103\u1175', '\uf537': '\u1112\u119e', '\uf53a': '\u1112\u119e'}


def find_pdf(number):
    for f in SOURCE.glob('*.pdf'):
        if re.search(rf'(?<!\d){number}회', f.name) and '문제' in f.name and '심화' in f.name:
            return f
    raise FileNotFoundError(number)


def load_exams():
    text = (DIST / 'exams.js').read_text(encoding='utf-8-sig')
    return json.loads(text.split('=', 1)[1].strip().rstrip(';'))


def has_text_layer(pdf):
    return len(pdf.pages[2].chars) > 200


def underline_segments(page):
    """Thin horizontal strokes that may be underlines: (x0, x1, y) in top-down pt coordinates."""
    segs = []
    for r in page.rects + page.lines:
        h = abs(r['bottom'] - r['top'])
        w = r['x1'] - r['x0']
        if h <= 1.6 and w >= 6:
            segs.append((r['x0'], r['x1'], (r['top'] + r['bottom']) / 2))
    for c in page.curves:       # an underline can also be a flat drawn path
        h = c['bottom'] - c['top']
        w = c['x1'] - c['x0']
        if h <= 1.6 and w >= 6:
            segs.append((c['x0'], c['x1'], (c['top'] + c['bottom']) / 2))
    return segs


def is_underlined(ch, segs):
    cx = (ch['x0'] + ch['x1']) / 2
    for x0, x1, y in segs:
        if x0 - 0.5 <= cx <= x1 + 0.5 and -1.0 <= y - ch['bottom'] <= 4.0:
            return True
    return False


def real_underlines(chars, segs):
    """Keep only strokes that look like underlines of a few words: decorative rules under titles are much
    wider than the characters sitting on them."""
    kept = []
    for seg in segs:
        x0, x1, y = seg
        above = [c for c in chars if x0 - 0.5 <= (c['x0'] + c['x1']) / 2 <= x1 + 0.5 and -1.0 <= y - c['bottom'] <= 4.0]
        if not above:
            continue
        span = max(c['x1'] for c in above) - min(c['x0'] for c in above)
        covered = sum(c['x1'] - c['x0'] for c in above)     # a real underline sits under a run of characters, not a few far-apart ones
        if (x1 - x0) <= span * 1.35 + 6 and covered >= 0.6 * (x1 - x0):
            kept.append(seg)
    return kept


def build_fragments(chars, segs):
    """chars -> text fragments (one per line per side-by-side frame), with <u> marks."""
    chars = [dict(c, text=' ' if c['text'] in ('\t', '\u00a0') else PUA.get(c['text'], c['text'])) for c in chars if c['text'] not in ('\x00',)]
    segs = real_underlines(chars, segs)
    chars.sort(key=lambda c: ((c['top'] + c['bottom']) / 2, c['x0']))
    rows, current = [], []
    for c in chars:
        mid = (c['top'] + c['bottom']) / 2
        if current:
            row_mid = sum((d['top'] + d['bottom']) / 2 for d in current) / len(current)
            if abs(mid - row_mid) > min(c['size'], current[0]['size']) * 0.55:
                rows.append(current)
                current = []
        current.append(c)
    if current:
        rows.append(current)
    fragments = []
    for row in rows:
        row.sort(key=lambda c: c['x0'])
        part = [row[0]]
        parts = []
        for prev, c in zip(row, row[1:]):
            if c['x0'] - prev['x1'] > GAP:
                parts.append(part)
                part = []
            part.append(c)
        parts.append(part)
        for p in parts:
            flags = [is_underlined(c, segs) and c['text'].strip() != '' for c in p]
            text = ''
            open_u = False
            for c, f in zip(p, flags):
                if f and not open_u:
                    text += '<u>'
                    open_u = True
                if not f and open_u and c['text'].strip() != '':
                    text += '</u>'
                    open_u = False
                text += c['text']
            if open_u:
                text += '</u>'
            text = re.sub(r'</u>(\s*)<u>', r'\1', text)           # merge neighbouring underlines
            # an underline that only covers a stray symbol is usually a drawing artefact
            if re.fullmatch(r'\s*<u>\W{0,2}</u>\s*', text):
                text = re.sub(r'</?u>', '', text)
            fragments.append({'x0': min(c['x0'] for c in p), 'x1': max(c['x1'] for c in p),
                              'top': min(c['top'] for c in p), 'bottom': max(c['bottom'] for c in p),
                              'size': max(c['size'] for c in p), 'text': text.rstrip()})
    out = []
    for f in fragments:
        f['text'] = POINTS.sub('', f['text']).rstrip()      # the score is stored separately (`points`)
        if f['text'].strip():
            out.append(f)
    return out


def plain(text):
    return text.replace('<u>', '').replace('</u>', '').strip()


def build_blocks(fragments):
    """Group fragments into text frames: vertically stacked, horizontally overlapping lines."""
    blocks = []
    for f in sorted(fragments, key=lambda f: (f['top'], f['x0'])):
        target = None
        for b in blocks:
            last = b['lines'][-1]
            overlap = min(last['x1'], f['x1']) - max(last['x0'], f['x0'])
            narrow = min(last['x1'] - last['x0'], f['x1'] - f['x0'])
            vertical = f['top'] - last['bottom']
            ends_here = plain(last['text']).endswith('?')          # the stem line closes its own block
            starts_choice = f['text'].lstrip('<u>').lstrip()[:1] in MARKS
            if (not ends_here and not starts_choice and overlap > 0.3 * max(narrow, 1)
                    and -2 <= vertical <= max(f['size'], last['size']) * 1.1 and f['top'] > last['top'] + 1):
                target = b
        if target:
            target['lines'].append(f)
        else:
            blocks.append({'lines': [f]})
    for b in blocks:
        b['x0'] = min(l['x0'] for l in b['lines'])
        b['top'] = min(l['top'] for l in b['lines'])
        b['bottom'] = max(l['bottom'] for l in b['lines'])
    # reading order: rows of blocks from top to bottom, each row from left to right
    blocks.sort(key=lambda b: (b['top'], b['x0']))
    ordered, row, row_top = [], [], None
    for b in blocks:
        if row_top is None or b['top'] - row_top <= 8:
            row.append(b)
            row_top = b['top'] if row_top is None else row_top
        else:
            ordered += sorted(row, key=lambda x: x['x0'])
            row, row_top = [b], b['top']
    ordered += sorted(row, key=lambda x: x['x0'])
    return ordered


def parse_blocks(blocks, points):
    """Split ordered blocks into stem / passage / five choices."""
    lines = [l['text'] for b in blocks for l in b['lines']]
    notes = []
    # stem: from the first line through the first line that ends with '?'
    stem_end = next((i for i, t in enumerate(lines[:4]) if plain(t).endswith('?')), None)
    if stem_end is None:
        stem_end = next((i for i, t in enumerate(lines[:4]) if '?' in t), 0)
        notes.append('stem_end_guessed')
    # a stem row that was split into "문장" + "[N점]" fragments, or a stem placed after the choices (stream order quirks)
    stem_lines = lines[:stem_end + 1]
    # collapse a leading question number such as "12. "
    stem = ' '.join(t.strip() for t in stem_lines)
    stem = re.sub(r'^\s*\d{1,2}\s*[.,]\s*', '', stem)
    stem = POINTS.sub('', stem).strip() + f' [{points}점]'
    stem = re.sub(r'\s+', ' ', stem)
    rest = lines[stem_end + 1:]
    # choices: the last ① ... ⑤ sequence in the remaining text (works for one choice per line and for
    # several choices on one line, e.g. "① ㄱ, ㄴ  ② ㄱ, ㄷ ...")
    rest_text = '\n'.join(rest)
    positions = None
    for m in reversed([m.start() for m in re.finditer('①', rest_text)]):
        picks, cur = [m], m
        for ch in MARKS[1:]:
            nxt = rest_text.find(ch, cur + 1)
            if nxt < 0:
                picks = None
                break
            picks.append(nxt)
            cur = nxt
        if picks:
            positions = picks
            break
    choices = []
    if positions:
        bounds = positions + [len(rest_text)]
        for a, b in zip(bounds, bounds[1:]):
            seg = rest_text[a + 1:b]
            seg = re.sub(r'\s+', ' ', seg).strip()
            seg = re.sub(r'<u>\s*</u>', '', seg)
            choices.append(seg)
        passage = rest_text[:positions[0]]
    else:
        passage = rest_text
        notes.append('choices_not_found')
    # tidy: tabs/non-breaking spaces become normal spaces, trailing blanks are dropped
    passage = '\n'.join(re.sub(r'[ \t\u00a0]+', ' ', t).strip() for t in passage.split('\n') if t.strip())
    return stem, passage, choices, notes

def figure_boxes(page, crop_pt, base):
    x0, y0, x1, y1 = crop_pt
    figs = []
    for im in page.images:
        cx, cy = (im['x0'] + im['x1']) / 2, (im['top'] + im['bottom']) / 2
        if x0 <= cx <= x1 and y0 <= cy <= y1 and (im['x1'] - im['x0']) > 11 and (im['bottom'] - im['top']) > 11:
            figs.append({'kind': 'image', 'bbox': [round(im['x0'] * S - base[0]), round(im['top'] * S - base[1]),
                                                     round(im['x1'] * S - base[0]), round(im['bottom'] * S - base[1])],
                         'description': '', 'text': ''})
    return figs


def extract_exam(exam):
    number = exam['id']
    records = []
    with pdfplumber.open(find_pdf(number)) as pdf:
        assert has_text_layer(pdf), f'{number}회 has no text layer'
        for q in exam['questions']:
            page = pdf.pages[q['page'] - 1]
            cx0, cy0, cx1, cy1 = q['crop']
            crop_pt = (cx0 / S, cy0 / S, cx1 / S, cy1 / S)
            chars = [c for c in page.chars
                     if crop_pt[0] <= (c['x0'] + c['x1']) / 2 <= crop_pt[2] and crop_pt[1] <= (c['top'] + c['bottom']) / 2 <= crop_pt[3]]
            segs = underline_segments(page)
            fragments = build_fragments(chars, segs)
            blocks = build_blocks(fragments)
            stem, passage, choices, notes = parse_blocks(blocks, q['points'])
            if '밑줄' not in stem:     # underlines only matter when the question refers to them; elsewhere they are decoration
                passage = re.sub(r'</?u>', '', passage)
                choices = [re.sub(r'</?u>', '', c) for c in choices]
            figures = figure_boxes(page, crop_pt, (cx0, cy0))
            if re.search(r'[\ue000-\uf8ff]', stem + passage + ''.join(choices)):
                notes.append('unmapped_private_use_glyphs')   # e.g. archaic Hangul letters; see the page image
            images_as_choices = len(choices) == 5 and all(len(re.sub(r'<[^>]+>', '', c).strip()) < 2 for c in choices)
            if images_as_choices:
                notes.append('choices_are_pictures')
            elif len(choices) != 5:
                notes.append('choices_not_found')
            text = '\n'.join([stem] + ([passage] if passage else []) + [f'{MARKS[i]} {c}'.rstrip() for i, c in enumerate(choices)])
            records.append({
                'exam': number, 'number': q['number'], 'points': q['points'], 'answer': q['answer'],
                'page': q['page'], 'image': q['image'],
                'stem': stem, 'passage': passage, 'choices': choices,
                'choices_are_images': images_as_choices,
                'text': text,
                'figures': figures,
                'notes': ', '.join(sorted(set(notes))),
                'verified': True,
                'source': 'pdf text layer (exact characters; pictures are not described)',
            })
    assert [r['number'] for r in records] == list(range(1, 51)), number
    return records


def main(only):
    OUT.mkdir(parents=True, exist_ok=True)
    for exam in load_exams():
        if only and exam['id'] not in only:
            continue
        with pdfplumber.open(find_pdf(exam['id'])) as pdf:
            if not has_text_layer(pdf):
                print(f"skip {exam['id']}: no text layer (needs OCR)")
                continue
        records = extract_exam(exam)
        (OUT / f"{exam['id']}.json").write_text(json.dumps(records, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        bad = [r['number'] for r in records if len(r['choices']) != 5]
        print(f"{exam['id']}: 50 questions from the text layer | questions without 5 choices: {bad}", flush=True)


if __name__ == '__main__':
    main({int(a) for a in sys.argv[1:]})
