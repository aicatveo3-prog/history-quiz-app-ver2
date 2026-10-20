"""72회 47·48번 공통 지문을 텍스트 데이터에 추가한다 (questions-text/72.json, all.jsonl)."""
import json, os
D = os.path.join(os.path.dirname(__file__), '..', 'content', 'questions-text')
SHARED = """[47~48] 다음을 읽고 물음에 답하시오.
(가) ㉠왕은 5월에 교서를 내려 문무 관료들에게 토지를 차등 있게 주었다. …… 봄 정월에 중앙과 지방 관리들의 녹읍을 폐지하고 해마다 조를 차등 있게 주고 이를 일정한 법으로 삼았다.
(나) 처음으로 직관(職官)·산관(散官)의 각 품의 전시과를 제정하였는데, 관품의 높고 낮은 것은 논하지 않고 다만 인품만 가지고 전시과의 등급을 결정하였다.
(다) 도평의사사에서 글을 올려 과전을 지급하는 법을 정할 것을 청하니, 그 의견을 따랐다. 경기는 사방의 근본이므로 마땅히 과전을 설치하여 사대부를 우대하여야 한다. 무릇 수도에 거주하며 왕실을 지키는 자는 현직, 산직(散職)을 불문하고 각각 과(科)에 따라 받게 한다.
(라) 만약 그 자신이 죽고 그 아내에게 미치게 되면 수신전이라 일컬었고, 부부가 다 죽고 그 아들에게 전해지면 휼양전이라 일컬었으며, 만약 그 아들이 관직에 제수되더라도 그대로 그 전지를 주고는 과전이라 일컬었는데, …… ㉡왕께서 이를 없애고, 현직 관리에게 주어 직전(職田)이라 하였던 것입니다."""


def patch(recs):
    for r in recs:
        if r['exam'] != 72 or r['number'] not in (47, 48):
            continue
        if r['number'] == 47:
            r['passage'] = SHARED
        else:
            bogi = r['passage'].strip()
            r['passage'] = SHARED + '\n' + bogi if not r['passage'].startswith('[47') else r['passage']
        parts = [r['stem'], r['passage']] + [f"{'①②③④⑤'[i]} {c}" for i, c in enumerate(r['choices'])]
        r['text'] = '\n'.join(parts)
        r['notes'] = (r.get('notes', '') + ' 47~48번 공통 지문 포함(PDF 텍스트 레이어에서 누락되어 보정).').strip()
    return recs


p = os.path.join(D, '72.json')
recs = patch(json.load(open(p, encoding='utf-8')))
json.dump(recs, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

pa = os.path.join(D, 'all.jsonl')
lines = [json.loads(l) for l in open(pa, encoding='utf-8') if l.strip()]
lines = patch(lines)
with open(pa, 'w', encoding='utf-8') as f:
    for r in lines:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
print('patched')
