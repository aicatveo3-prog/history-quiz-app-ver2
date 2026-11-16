// 이론 정리 본문의 소제목마다 관련 출제 문항을 붙이기 위한 1차 배치안 생성 도구.
// 화면에는 아직 반영하지 않는다. 사람이 검토할 초안만 만든다.
//   node site/tools/draft_theory_links.mjs
// 출력
//   content/theory-links.draft.json : 문항별 1순위 소제목, 판정(확실/검토), 후보 3개, 순서형 여부
//   ../tmp/theory-links-review.md   : 검토가 필요한 문항 목록(사람이 읽는 보고서)
// 점수: 문항 단서어(clue)와 제목 낱말이 소제목 구간 본문에 나오면 점수를 준다.
//   - 구절 그대로 일치하면 2점, 낱말만 일치하면 1점
//   - 같은 주제 안에서 여러 소제목에 두루 나오는 흔한 말은 가중치를 낮춘다(희소한 말일수록 높게)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const site = path.resolve(import.meta.dirname, '..');
const ctx = vm.createContext({ window: {} });
for (const f of ['theory-data.js', 'theory-explanations.js']) vm.runInContext(fs.readFileSync(path.join(site, 'dist', f), 'utf8'), ctx);
const { THEORY, THEORY_EXPLANATIONS } = ctx.window;

const squash = s => s.replace(/\\n/g, '').replace(/\s+/g, '');
const STOP = new Set(['시기', '이후', '이전', '사이', '활동', '업적', '모습', '사실', '특징', '정책', '시대', '순서', '배경',
  '결과', '내용', '고려', '조선', '신라', '백제', '고구려', '일제', '대한', '사건', '전개', '관련', '역사', '설명', '기능', '역할']);
const ORDER = /순서|사이|시기 배열|이후|이전|전후|연표|흐름|~/;
const INTRO = '(첫 소제목 앞 도입 문단)';

// 문항 단서어: 구절(·/→ 등으로 나눈 덩어리)과 낱말(조사 제거)
function clueTerms(qid) {
  const e = THEORY_EXPLANATIONS[qid] || {};
  const raw = `${e.clue || ''} · ${(e.title || '').replace(/[–—-]/g, '·')}`;
  const phrases = raw.split(/[·\/→,()（）\[\]|~]/).map(s => s.trim()).filter(Boolean);
  const words = phrases.flatMap(p => p.split(/\s+/)).map(w => w.replace(/(에서|으로|의|과|와|을|를|이|가|은|는|에|로|때)$/, ''));
  const out = new Map();
  for (const p of phrases) if (squash(p).length >= 2 && !STOP.has(p)) out.set(squash(p), 2);
  for (const w of words) if (squash(w).length >= 2 && !STOP.has(w) && !out.has(squash(w))) out.set(squash(w), 1);
  return out; // term → 기본 점수
}

// 주제 본문을 소제목 구간으로 나눈다(소제목 문단 '## 제목' 기준)
function sectionsOf(theme) {
  const secs = [];
  let cur = null;
  for (const p of theme.theory) {
    const t = p.text.replace(/\\n/g, '\n').trim();
    if (!t) continue;
    if (t.startsWith('## ')) { cur = { title: t.slice(3).trim(), text: '' }; secs.push(cur); continue; }
    if (!cur) { cur = { title: INTRO, text: '' }; secs.push(cur); }
    cur.text += squash(t);
  }
  return secs;
}

const draft = {};
const review = [];
const summary = { total: 0, sure: 0, check: 0, order: 0 };
const perEra = [];
const dupTitles = [];

for (const era of THEORY) {
  const row = { era: era.name, total: 0, sure: 0, check: 0 };
  for (const theme of era.themes) {
    const secs = sectionsOf(theme);
    const seen = new Set();
    for (const s of secs) { if (seen.has(s.title)) dupTitles.push(`${theme.name} > ${s.title}`); seen.add(s.title); }

    for (const q of theme.questions) {
      const terms = clueTerms(q.id);
      // 흔한 말 가중치: 주제 안에서 그 말이 나오는 소제목 수(df)가 많을수록 낮게
      const scored = secs.map(s => ({ title: s.title, score: 0, hits: [] }));
      for (const [term, base] of terms) {
        const df = secs.filter(s => s.text.includes(term)).length;
        if (!df) continue;
        const weight = base * Math.log(1 + secs.length / df);
        secs.forEach((s, i) => { if (s.text.includes(term)) { scored[i].score += weight; scored[i].hits.push(term); } });
      }
      scored.sort((a, b) => b.score - a.score);
      const [top, second] = scored;
      const order = ORDER.test(THEORY_EXPLANATIONS[q.id]?.title || '');
      // 확실: 1위가 단서어 2개 이상 맞고, 2위보다 1.5배 이상 앞서며, 도입 문단이 아닐 때
      const margin = second && second.score > 0 ? top.score / second.score : Infinity;
      const sure = top.score > 0 && top.hits.length >= 2 && margin >= 1.5 && top.title !== INTRO && !order;
      const grade = sure ? '확실' : '검토';
      const reasons = [];
      if (top.score === 0) reasons.push('일치하는 단서어 없음');
      if (top.hits.length < 2) reasons.push('단서어 1개만 일치');
      if (margin < 1.5) reasons.push('2위와 점수 차 작음');
      if (top.title === INTRO) reasons.push('도입 문단이 1위');
      if (order) reasons.push('순서·시기형 문항');

      draft[q.id] = {
        theme: theme.id,
        themeName: theme.name,
        section: top.title,
        grade,
        order,
        candidates: scored.filter(s => s.score > 0).slice(0, 3).map(s => ({ section: s.title, score: +s.score.toFixed(2), hits: s.hits })),
      };
      summary.total++; row.total++;
      if (sure) { summary.sure++; row.sure++; } else { summary.check++; row.check++; review.push({ qid: q.id, era: era.name, theme: theme.name, reasons, d: draft[q.id] }); }
      if (order) summary.order++;
    }
  }
  perEra.push(row);
}

const byId = (a, b) => { const [x1, y1] = a.split('-').map(Number); const [x2, y2] = b.split('-').map(Number); return x1 - x2 || y1 - y2; };
const sorted = Object.fromEntries(Object.keys(draft).sort(byId).map(k => [k, draft[k]]));
fs.writeFileSync(path.join(site, 'content', 'theory-links.draft.json'), JSON.stringify(sorted, null, 1) + '\n', 'utf8');

// 검토 보고서
const lines = ['# 이론 본문 출제 문항 연결: 1차 배치안 검토 목록', '',
  `전체 ${summary.total}문항 · 확실 ${summary.sure} · 검토 ${summary.check} (순서·시기형 ${summary.order})`, '',
  '| 시대 | 문항 | 확실 | 검토 |', '|---|---|---|---|', ...perEra.map(r => `| ${r.era} | ${r.total} | ${r.sure} | ${r.check} |`), ''];
let lastEra = '';
for (const r of review) {
  if (r.era !== lastEra) { lines.push('', `## ${r.era}`, ''); lastEra = r.era; }
  const e = THEORY_EXPLANATIONS[r.qid] || {};
  lines.push(`- **${r.qid}** ${e.title} · [${r.theme}] · 사유: ${r.reasons.join(', ')}`);
  r.d.candidates.forEach((c, i) => lines.push(`  - ${i + 1}위 "${c.section}" (${c.score}) ${c.hits.join(', ')}`));
}
fs.mkdirSync(path.resolve(site, '..', 'tmp'), { recursive: true });
fs.writeFileSync(path.resolve(site, '..', 'tmp', 'theory-links-review.md'), lines.join('\n') + '\n', 'utf8');

console.log(`전체 ${summary.total}문항 · 확실 ${summary.sure} · 검토 ${summary.check} (순서·시기형 ${summary.order})`);
for (const r of perEra) console.log(`  ${r.era}: ${r.total}문항 · 확실 ${r.sure} · 검토 ${r.check}`);
if (dupTitles.length) console.log(`주의: 같은 주제 안에 이름이 같은 소제목 ${dupTitles.length}개`, dupTitles);
console.log('저장: content/theory-links.draft.json, tmp/theory-links-review.md');
