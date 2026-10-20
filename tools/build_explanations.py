"""Package authored explanations; verify every row against the imported answer key."""
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DIST = SITE / 'dist'

def main():
    exams = json.loads((DIST / 'exams.js').read_text(encoding='utf-8-sig').split('=', 1)[1].strip().rstrip(';'))
    explanations = {}
    references = {
        '74-6': ('우리역사넷: 외사정', 'https://contents.history.go.kr/front/hm/view.do?levelId=hm_011_0080'),
        '78-4': ('한국민족문화대백과사전: 도살성', 'https://encykorea.aks.ac.kr/Article/E0077952'),
        '79-5': ('우리역사넷: 강수의 청방인문표', 'https://contents.history.go.kr/front/hm/view.do?levelId=hm_039_0030&tabId=01&treeId=020403'),
        '79-34': ('우리역사넷: 지계 발급 사업', 'https://contents.history.go.kr/front/hm/view.do?levelId=hm_129_0040'),
    }
    for exam in exams:
        tsv = SITE / 'content' / f"{exam['id']}.tsv"
        if not tsv.exists():   # exams imported with add_exams.py have no explanations yet
            print(f"Skipped {exam['id']}: no explanations yet (questions and answer key only)")
            continue
        rows = tsv.read_text(encoding='utf-8').splitlines()
        seen = set()
        for row in rows:
            n, answer, title, clue, explanation, contrast = row.split('\t')
            number = int(n)
            assert number not in seen, (exam['id'], number, 'duplicate')
            seen.add(number)
            assert int(answer) == exam['questions'][number-1]['answer'], (exam['id'], number, 'answer mismatch')
            assert all([title.strip(), clue.strip(), explanation.strip(), contrast.strip()])
            entry = dict(title=title, clue=clue, explanation=explanation, contrast=contrast)
            key = f"{exam['id']}-{number}"
            if key in references:
                entry['sourceLabel'], entry['sourceUrl'] = references[key]
            explanations[key] = entry
        assert seen == set(range(1, 51)) or (seen and seen == set(range(1, max(seen) + 1))), (exam['id'], 'missing explanation', sorted(set(range(1, (max(seen) if seen else 0) + 1)) - seen))
        full = seen == set(range(1, 51))
        print(f"Verified {exam['id']}: {len(seen)} explanations match the official key{'' if full else ' (partial)'}")
    assert explanations, 'no explanations found'
    (DIST / 'explanations.js').write_text('window.EXPLANATIONS = ' + json.dumps(explanations, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')

if __name__ == '__main__':
    main()
