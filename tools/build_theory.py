"""Group per-question theory by era and theme into dist/theory-data.js.

Inputs
- content/theory-map.json        era -> theme -> question ids (hand-curated grouping)
- content/theory-source/<exam>.tsv      title, clue, explanation, contrast for each question
- content/theory-source/detail-*.json   theory (배경 이론), memo (암기 포인트), choices for each question
- content/theory-extra.json      보강 항목: 기출 해설에 없는 내용(주제 id별, 출처 필수). 화면에서 '보강'으로 구분 표시

theory-source/ is the theory page's own copy of the original 74·78·79회 explanations.
It is separate from content/<exam>.tsv (the study page's explanations), so rewriting or
deleting study-page explanations never changes the theory page.

Outputs
- dist/theory-data.js          window.THEORY (era -> theme -> theory/memo/contrast)
- dist/theory-explanations.js  window.THEORY_EXPLANATIONS / THEORY_DETAILS for the theory page's popup quiz

Every one of the 150 questions must appear in exactly one theme.
"""
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DIST = SITE / 'dist'
CONTENT = SITE / 'content'
SOURCE = CONTENT / 'theory-source'


def load_exams():
    text = (DIST / 'exams.js').read_text(encoding='utf-8-sig')
    return json.loads(text.split('=', 1)[1].strip().rstrip(';'))


def load_rows(exams):
    rows = {}
    for exam in exams:
        eid = exam['id']
        for line in (SOURCE / f'{eid}.tsv').read_text(encoding='utf-8').splitlines():
            n, _answer, title, clue, explanation, contrast = line.split('\t')
            rows[f'{eid}-{int(n)}'] = {'title': title, 'clue': clue, 'explanation': explanation, 'contrast': contrast}
        for part in sorted(SOURCE.glob(f'detail-{eid}*.json')):
            for n, detail in json.loads(part.read_text(encoding='utf-8')).items():
                rows[f'{eid}-{int(n)}'].update(read=detail['read'], theory=detail['theory'], memo=detail['memo'], choices=detail['choices'])
    return rows


EXTRA_TYPES = ('짝꿍', '흐름', '비교')


def load_extras():
    """보강 항목(content/theory-extra.json)을 주제 id별로 묶는다. 기출 해설과 섞이지 않게 별도 파일로 관리한다."""
    path = CONTENT / 'theory-extra.json'
    if not path.exists():
        return {}
    by_theme, ids = {}, set()
    for item in json.loads(path.read_text(encoding='utf-8')):
        assert item['id'] not in ids, (item['id'], 'duplicate extra')
        ids.add(item['id'])
        assert item['type'] in EXTRA_TYPES, (item['id'], item['type'])
        assert item['text'].strip(), (item['id'], 'empty text')
        assert item['sources'] and all(s['url'].startswith('https://') and s['label'].strip() for s in item['sources']), (item['id'], 'sources')
        by_theme.setdefault(item['theme'], []).append(item)
    return by_theme


def extra_public(item):
    """화면에 필요한 필드만 내보낸다(why 같은 작업 메모는 제외)."""
    return {'id': item['id'], 'type': item['type'], 'text': item['text'].strip(),
            'sources': [{k: v for k, v in s.items()} for s in item['sources']]}


def merge(items):
    """Collapse identical texts and remember which questions they came from."""
    merged = {}
    for qid, text in items:
        text = text.strip()
        if text:
            merged.setdefault(text, []).append(qid)
    return [{'text': text, 'src': src} for text, src in merged.items()]


def main():
    # Only exams that have a theory source take part in the theory page.
    exams = [e for e in load_exams() if (SOURCE / f"{e['id']}.tsv").exists()]
    rows = load_rows(exams)
    expected = {f"{e['id']}-{q['number']}" for e in exams for q in e['questions']}
    assert len(expected) == 150, len(expected)
    assert expected == set(rows), sorted(expected ^ set(rows))

    extras = load_extras()
    seen = {}
    eras = []
    theme_no = 0
    for era in json.loads((CONTENT / 'theory-map.json').read_text(encoding='utf-8')):
        themes = []
        for theme in era['themes']:
            theme_no += 1
            ids = theme['q']
            assert ids, theme['name']
            for qid in ids:
                assert qid in expected, (theme['name'], qid, 'unknown question')
                assert qid not in seen, (qid, 'duplicate', seen.get(qid), theme['name'])
                seen[qid] = theme['name']
            ids = sorted(ids, key=lambda i: tuple(map(int, i.split('-'))))
            theories = [(qid, p) for qid in ids for p in rows[qid]['theory'].split('\n')]
            themes.append({
                'id': f't{theme_no}',
                'name': theme['name'],
                'count': len(ids),
                'questions': [{'id': qid, 'exam': int(qid.split('-')[0]), 'number': int(qid.split('-')[1]),
                               'title': rows[qid]['title'], 'clue': rows[qid]['clue']} for qid in ids],
                'theory': merge(theories),
                'memos': merge((qid, rows[qid]['memo']) for qid in ids),
                'contrasts': merge((qid, rows[qid]['contrast']) for qid in ids),
                'extras': [extra_public(x) for x in extras.pop(f't{theme_no}', [])],
            })
        eras.append({'id': era['id'], 'name': era['name'], 'range': era['range'], 'themes': themes})

    missing = expected - set(seen)
    assert not missing, sorted(missing)
    assert not extras, ('보강 항목의 주제 id가 없습니다', sorted(extras))
    out = 'window.THEORY = ' + json.dumps(eras, ensure_ascii=False, indent=1) + ';\n'
    (DIST / 'theory-data.js').write_text(out, encoding='utf-8')

    # 이론 정리 페이지의 문제 팝업용 해설(기출 풀이 화면의 해설과는 별개)
    order = sorted(rows, key=lambda i: tuple(map(int, i.split('-'))))
    explanations = {qid: {k: rows[qid][k] for k in ('title', 'clue', 'explanation', 'contrast')} for qid in order}
    details = {qid: {k: rows[qid][k] for k in ('read', 'theory', 'memo', 'choices')} for qid in order}
    for qid, d in details.items():
        assert len(d['choices']) == 5, (qid, 'choices')
    (DIST / 'theory-explanations.js').write_text(
        'window.THEORY_EXPLANATIONS = ' + json.dumps(explanations, ensure_ascii=False, indent=1) + ';\n'
        'window.THEORY_DETAILS = ' + json.dumps(details, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')

    for era in eras:
        print(f"{era['name']}: {len(era['themes'])}개 주제, {sum(t['count'] for t in era['themes'])}문항")
    extra_total = sum(len(t['extras']) for e in eras for t in e['themes'])
    print(f'theory-data.js: {theme_no}개 주제, {len(seen)}문항, 보강 {extra_total}건')
    print(f'theory-explanations.js: 팝업 해설 {len(explanations)}문항')


if __name__ == '__main__':
    main()
