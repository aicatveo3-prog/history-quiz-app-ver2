"""Merge the Tesseract drafts (content/questions-text/ocr/<exam>.json) with the page-image proof-reading results
(tmp/verified/<exam>-<first>-<last>.json) into the final dataset:

    content/questions-text/<exam>.json     50 records per exam
    content/questions-text/all.jsonl       every question, one JSON object per line

Proof-read fields win over OCR; a question without a proof-read entry keeps its OCR text and verified=false.
Usage:  python tools/merge_verified_text.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'site' / 'content' / 'questions-text'
DRAFTS = OUT / 'ocr'
VERIFIED = ROOT / 'tmp' / 'verified'
MARKS = '①②③④⑤'


def load_verified():
    items = {}
    for f in sorted(VERIFIED.glob('*.json')):
        for item in json.loads(f.read_text(encoding='utf-8')):
            items[(int(item['exam']), int(item['number']))] = item
    return items


def clean_stem(stem, points):
    stem = re.sub(r'\s*\[\s*\d\s*점\s*\]\s*$', '', stem.strip()).strip()
    stem = re.sub(r'^\s*\d{1,2}\s*[.,]\s*', '', stem)       # drop a leading "12." question number
    return f'{stem} [{points}점]'


def build_text(stem, passage, choices):
    parts = [stem]
    if passage.strip():
        parts.append(passage.strip())
    parts += [f'{MARKS[i]} {c}'.rstrip() for i, c in enumerate(choices)]
    return '\n'.join(parts)


def main():
    verified = load_verified()
    OUT.mkdir(parents=True, exist_ok=True)
    all_lines, stats = [], []
    for draft_file in sorted(DRAFTS.glob('[0-9]*.json'), key=lambda p: int(p.stem)):
        exam = int(draft_file.stem)
        out = []
        for d in json.loads(draft_file.read_text(encoding='utf-8')):
            v = verified.get((exam, d['number']))
            rec = {k: d[k] for k in ('exam', 'number', 'points', 'answer', 'page', 'image')}
            if v:
                choices = [str(c).strip() for c in v['choices']]
                assert len(choices) == 5, (exam, d['number'], 'choices', choices)
                stem = clean_stem(v['stem'], d['points'])
                passage = str(v.get('passage', '')).strip()
                rec.update({
                    'stem': stem, 'passage': passage, 'choices': choices,
                    'choices_are_images': bool(v.get('choices_are_images', False)),
                    'text': build_text(stem, passage, choices),
                    'figures': v.get('figures', []),
                    'notes': v.get('notes', ''),
                    'verified': True,
                    'source': 'tesseract draft proof-read against the page image',
                })
            else:
                rec.update({
                    'stem': d['stem'], 'passage': d['passage'], 'choices': d['choices'],
                    'choices_are_images': False,
                    'text': d['text'],
                    'figures': [{'kind': 'unknown', 'description': '', 'text': f['text']} for f in d['figures']],
                    'notes': 'OCR only, not proof-read: ' + ', '.join(d['ocr']['notes']),
                    'verified': False,
                    'source': 'tesseract',
                })
            rec['ocr_text'] = d['text']
            out.append(rec)
        assert [r['number'] for r in out] == list(range(1, 51)), exam
        (OUT / f'{exam}.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        stats.append((exam, sum(r['verified'] for r in out)))
    # one JSON-lines file with every exam: text-layer exams (written by extract_text_layer.py) and the merged OCR exams
    for f in sorted(OUT.glob('[0-9]*.json'), key=lambda p: int(p.stem)):
        all_lines += [json.dumps(r, ensure_ascii=False) for r in json.loads(f.read_text(encoding='utf-8'))]
    (OUT / 'all.jsonl').write_text('\n'.join(all_lines) + '\n', encoding='utf-8')
    for exam, n in stats:
        print(f'{exam}: {n}/50 proof-read')
    print(f'all.jsonl: {len(all_lines)} questions')


if __name__ == '__main__':
    main()
