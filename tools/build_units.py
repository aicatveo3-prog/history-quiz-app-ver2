"""content/unit-map.json (단원별·특수 분류 원고)를 검사하고 dist/units.js를 만든다.

- eras: 시대 9개, 각 시대 안의 주제와 문항. 550문항이 정확히 한 번씩 들어가야 한다.
- special: 유물·문화유산 / 지역사 / 시대 비교·통사. 시대 단원과 겹쳐도 된다(문항은 양쪽에 보인다).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'content', 'unit-map.json')
OUT = os.path.join(HERE, '..', 'dist', 'units.js')
EXAMS = os.path.join(HERE, '..', 'dist', 'exams.js')

sk = lambda q: tuple(int(p) for p in q.split('-'))
exam_js = open(EXAMS, encoding='utf-8').read()
exams = json.loads(exam_js[exam_js.index('['):exam_js.rindex(']') + 1])
valid = {f"{e['id']}-{q['number']}" for e in exams for q in e['questions']}

data = json.load(open(SRC, encoding='utf-8'))
seen = {}
out_eras = []
for era in data['eras']:
    all_q = []
    themes = []
    for i, t in enumerate(era['themes']):
        assert t['q'], f"빈 주제: {era['id']} {t['name']}"
        for q in t['q']:
            assert q in valid, f'없는 문항: {q}'
            assert q not in seen, f'중복 배정: {q} ({seen[q]} / {era["id"]} {t["name"]})'
            seen[q] = f"{era['id']} {t['name']}"
        qs = sorted(t['q'], key=sk)
        all_q += qs
        themes.append({'id': f"{era['id']}-{i + 1}", 'name': t['name'], 'questions': qs})
    out_eras.append({'id': era['id'], 'name': era['name'], 'range': era['range'],
                     'questions': sorted(all_q, key=sk), 'themes': themes})
missing = sorted(valid - set(seen), key=sk)
assert not missing, f'시대 단원에 빠진 문항: {missing}'

out_special = []
for s in data['special']:
    assert re.fullmatch(r'special-[a-z]+', s['id'])
    for q in s['q']:
        assert q in valid, f'없는 특수 문항: {q}'
    assert len(set(s['q'])) == len(s['q']), f"{s['id']} 중복"
    out_special.append({'id': s['id'], 'name': s['name'], 'desc': s['desc'], 'questions': s['q'], 'tags': s.get('tags', {})})

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('window.UNITS = ' + json.dumps({'eras': out_eras, 'special': out_special}, ensure_ascii=False) + ';\n')
print(f"units.js: 시대 {len(out_eras)}개, 주제 {sum(len(e['themes']) for e in out_eras)}개, 문항 {len(seen)}개, 특수 분류 {[len(s['questions']) for s in out_special]}")
