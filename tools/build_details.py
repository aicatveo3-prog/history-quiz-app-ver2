"""Package detailed explanations (content/detail-<exam>.json) into dist/details.js.

Each entry: read (지문 읽기), choices (보기 5개 분석), theory (배경 이론), memo (암기 포인트).
Supports partial explanations (fewer than 50 questions per exam).
"""
import json
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DIST = SITE / 'dist'
CONTENT = SITE / 'content'
FIELDS = ('read', 'theory', 'memo')

def main(strict=True):
    exams = json.loads((DIST / 'exams.js').read_text(encoding='utf-8-sig').split('=', 1)[1].strip().rstrip(';'))
    details = {}
    for exam in exams:
        parts = sorted(CONTENT.glob(f"detail-{exam['id']}*.json"))
        if not parts:
            print(f"SKIP {exam['id']}: no detail-{exam['id']}*.json")
            continue
        rows = {}
        for part in parts:
            chunk = json.loads(part.read_text(encoding='utf-8'))
            assert not (set(rows) & set(chunk)), (part.name, 'duplicate question numbers')
            rows.update(chunk)
        for number in rows:
            assert 1 <= int(number) <= 50, (exam['id'], number, 'out of range')
        for number, row in rows.items():
            for field in FIELDS:
                assert str(row.get(field, '')).strip(), (exam['id'], number, field)
            choices = row.get('choices')
            assert isinstance(choices, list) and len(choices) == 5 and all(str(c).strip() for c in choices), (exam['id'], number, 'choices')
            details[f"{exam['id']}-{number}"] = {k: row[k] for k in (*FIELDS, 'choices')}
        full = set(rows) == {str(n) for n in range(1, 51)}
        print(f"Packaged {exam['id']}: {len(rows)} detailed explanations{'' if full else ' (partial)'}")
    (DIST / 'details.js').write_text('window.DETAILS = ' + json.dumps(details, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    print(f"details.js: {len(details)} entries")

if __name__ == '__main__':
    main(strict='--partial' not in sys.argv)
