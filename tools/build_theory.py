"""Group per-question theory by era and theme into dist/theory-data.js.

Inputs
- content/theory-map.json        era -> theme -> question ids (hand-curated grouping), 주제마다 대표 문항(lead)
- content/theory-themes.json     주제 종합 정리(배경 이론·암기 포인트·헷갈리는 구별), 대표 문항 id로 찾는다
- content/theory-links.json      출제 문항 → 이론 본문 소제목 배치
- dist/explanations.js, dist/details.js
    기출 풀기 화면의 최신 문항 해설. 주제 목록의 문항 제목·단서와 이론 정리 문제 창 해설은 이것을 그대로 쓴다.
    그래서 이 스크립트는 build_explanations.py · build_details.py 다음에 실행한다.
    (예전의 content/theory-source/ 사본은 더 이상 읽지 않는다. 문제 창에 옛 해설이 나오던 원인이었다.)

Outputs
- dist/theory-data.js          window.THEORY (era -> theme -> theory/memo/contrast)
- dist/theory-explanations.js  window.THEORY_EXPLANATIONS / THEORY_DETAILS for the theory page's popup quiz
"""
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DIST = SITE / 'dist'
CONTENT = SITE / 'content'
def load_exams():
    text = (DIST / 'exams.js').read_text(encoding='utf-8-sig')
    return json.loads(text.split('=', 1)[1].strip().rstrip(';'))


def load_window_json(path, name):
    """dist/*.js 의 `window.NAME = {...};` 에서 객체만 읽는다."""
    text = path.read_text(encoding='utf-8-sig')
    marker = f'window.{name}'
    start = text.index('=', text.index(marker)) + 1
    while text[start].isspace():
        start += 1
    obj, _ = json.JSONDecoder().raw_decode(text, start)
    return obj


def load_rows(exams):
    """기출 풀기 화면과 같은 최신 해설(dist/explanations.js, dist/details.js)을 문항별로 모은다."""
    expl = load_window_json(DIST / 'explanations.js', 'EXPLANATIONS')
    details = load_window_json(DIST / 'details.js', 'DETAILS')
    rows = {}
    for exam in exams:
        for q in exam['questions']:
            qid = f"{exam['id']}-{q['number']}"
            e, d = expl[qid], details[qid]
            rows[qid] = {'title': e['title'], 'clue': e['clue'], 'explanation': e['explanation'], 'contrast': e['contrast'],
                         'read': d['read'], 'theory': d['theory'], 'memo': d['memo'], 'choices': d['choices']}
    return rows


def merge(items):
    """Collapse identical texts and remember which questions they came from."""
    merged = {}
    for qid, text in items:
        text = text.strip()
        if text:
            merged.setdefault(text, []).append(qid)
    return [{'text': text, 'src': [s for s in src if s]} for text, src in merged.items()]


INTRO = '(첫 소제목 앞 도입 문단)'


def load_links():
    """출제 문항 → 이론 본문 소제목 배치(content/theory-links.json).

    site/tools/draft_theory_links.mjs 로 만든 1차 배치안을 사람이 검토해 확정한 파일이다.
    문항마다 section(정답 근거가 있는 소제목 제목 그대로)과 also(함께 볼 소제목, 지금은 화면에 쓰지 않음)를 둔다.
    """
    path = CONTENT / 'theory-links.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def attach_links(theory, ids, links, theme_name):
    """소제목 문단('## 제목')의 src에 그 소제목이 정답 근거인 문항을 붙인다.

    첫 소제목 앞 도입 문단에 배치된 문항은 도입 문단의 마지막 문단 끝에 붙인다.
    배치가 없는 문항이나 본문에 없는 소제목 이름이 있으면 빌드를 멈춘다.
    """
    slots = {}
    intro_last = None
    seen_heading = False
    for part in theory:
        text = part['text'].replace('\\n', '\n').strip()
        if text.startswith('## '):
            seen_heading = True
            slots[text[3:].strip()] = part
        elif not seen_heading:
            intro_last = part
    if intro_last is not None:
        slots[INTRO] = intro_last
    for qid in ids:
        assert qid in links, (theme_name, qid, 'theory-links.json에 배치가 없습니다')
        section = links[qid]['section']
        assert section in slots, (theme_name, qid, f'없는 소제목: {section}')
        slots[section]['src'].append(qid)
    for part in theory:
        part['src'].sort(key=lambda i: tuple(map(int, i.split('-'))))


def main():
    exams = load_exams()
    rows = load_rows(exams)
    expected = {f"{e['id']}-{q['number']}" for e in exams for q in e['questions']}
    assert expected == set(rows), sorted(expected ^ set(rows))

    links = load_links()
    theme_texts = json.loads((CONTENT / 'theory-themes.json').read_text(encoding='utf-8'))
    linked = 0
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
                if qid not in rows:
                    # 시험 목록(exams.js)에 아직 없는 문항은 건너뛴다.
                    continue
                assert qid not in seen, (qid, 'duplicate', seen.get(qid), theme['name'])
                seen[qid] = theme['name']
            ids = sorted([qid for qid in ids if qid in rows], key=lambda i: tuple(map(int, i.split('-'))))
            # 'lead'가 있는 주제는 주제 종합 정리(content/theory-themes.json)만 주제 화면에 보여 준다.
            # 종합 정리는 문항 해설과 따로 보관하므로, 대표 문항의 팝업 해설(오답 비교 등)은 그 문항의 원래 해설 그대로다.
            lead = theme.get('lead')
            if lead:
                assert lead in ids, (theme['name'], lead)
                summary = theme_texts.get(lead)
                assert summary, (theme['name'], lead, 'theory-themes.json에 주제 정리가 없습니다')
                theories = [(None, p) for p in summary['theory'].split('\n')]
                memo_items = [(None, summary['memo'])]
                contrast_items = [(None, summary['contrast'])]
            else:
                theories = [(qid, p) for qid in ids for p in rows[qid]['theory'].split('\n')]
                memo_items = [(qid, rows[qid]['memo']) for qid in ids]
                contrast_items = [(qid, rows[qid]['contrast']) for qid in ids]
            theory = merge(theories)
            if lead and links:
                attach_links(theory, ids, links, theme['name'])
                linked += len(ids)
            themes.append({
                'id': f't{theme_no}',
                'name': theme['name'],
                'count': len(ids),
                'questions': [{'id': qid, 'exam': int(qid.split('-')[0]), 'number': int(qid.split('-')[1]),
                               'title': rows[qid]['title'], 'clue': rows[qid]['clue']} for qid in ids],
                'theory': theory,
                'memos': merge(memo_items),
                'contrasts': merge(contrast_items),
            })
        eras.append({'id': era['id'], 'name': era['name'], 'range': era['range'], 'themes': themes})

    missing = expected - set(seen)
    # theory-map.json에 배정되지 않은 문항이 있을 수 있다(아직 주제를 정하지 않은 시대).
    # 경고만 출력하고 빌드는 진행한다.
    if missing:
        print(f'경고: theory-map.json에 없는 문항 {len(missing)}개 (팝업 해설에는 포함됨): {sorted(missing)[:10]}...')
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
    print(f'theory-data.js: {theme_no}개 주제, {len(seen)}문항, 본문 소제목에 붙인 문항 {linked}개')
    print(f'theory-explanations.js: 팝업 해설 {len(explanations)}문항')


if __name__ == '__main__':
    main()
