// 문제-구절 연결(dist/theory-tags.js) 검사: 없는 문제·주제·문단, 글에 없는 구절, 겹치는 구절,
// 정답 근거나 오답 보기가 빠진 문제를 찾는다.
// 사용: node tools/check-theory-tags.mjs [--era 시대id]  (시대를 주면 그 시대 문제가 모두 연결됐는지도 본다)
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../dist/', import.meta.url);
const window = {};
for (const file of ['exams.js', 'theory-data.js', 'theory-tags.js', 'question-choices.js']) vm.runInNewContext(fs.readFileSync(new URL(file, root), 'utf8'), { window });
// 자료 문장은 시험지 자료에 그대로 있어야 한다. 줄바꿈이 낱말 중간에 있을 수 있어 공백을 빼고 비교한다.
const squash = s => String(s).replace(/<\/?u>/g, '').replace(/\s+/g, '');
const passages = new Map(fs.readFileSync(new URL('../content/questions-text/all.jsonl', import.meta.url), 'utf8').trim().split('\n').map(line => {
  const row = JSON.parse(line);
  return [`${row.exam}-${row.number}`, squash(`${row.stem}${row.passage}`)];
}));

const clean = s => s.replace(/\\n/g, '\n');
const themes = new Map();
const home = new Map(); // 문제 id -> 시대 id
for (const era of window.THEORY) for (const t of era.themes) {
  themes.set(t.id, t);
  for (const q of t.questions) home.set(q.id, era.id);
}
const questionOf = id => {
  const [e, n] = id.split('-').map(Number);
  return window.EXAMS.find(x => x.id === e)?.questions.find(x => x.number === n);
};
const orderOnly = new Set(window.THEORY_TAGS_ORDER_ONLY || []);

const errors = [];
const byBlock = new Map();
let links = 0;
let noPhrase = 0;
let photoOnly = 0;
const pictureChoice = new Set();
for (const [q, list] of Object.entries(window.THEORY_TAGS)) {
  const question = questionOf(q);
  if (!question) { errors.push(`${q}: 없는 문제`); continue; }
  const roles = new Set(list.map(([, , , role]) => role));
  if (!roles.has('a') && !orderOnly.has(q)) errors.push(`${q}: 정답 보기 연결이 없음`);
  if (!roles.has('a') && !roles.has('s')) errors.push(`${q}: 정답 근거 연결이 없음`);
  if (roles.has(`c${question.answer}`)) errors.push(`${q}: ${question.answer}번은 정답인데 오답 보기로 연결됨`);
  if (!orderOnly.has(q)) for (let n = 1; n <= 5; n++) {
    if (n !== question.answer && !roles.has(`c${n}`)) errors.push(`${q}: 오답 보기 ${n}번 연결이 없음`);
  }
  const seen = new Set();
  for (const [themeId, block, phrase, role, quote] of list) {
    links++;
    const where = `${q} ${themeId}[${block}] "${phrase}"`;
    const theme = themes.get(themeId);
    if (!theme) { errors.push(`${where}: 없는 주제`); continue; }
    const text = theme.theory[block] && clean(theme.theory[block].text);
    if (text === undefined) { errors.push(`${where}: 없는 문단`); continue; }
    if (!/^(a|s|c[1-5])$/.test(role)) errors.push(`${where}: 잘못된 종류 ${role}`);
    if (role === 's') {
      if (quote === undefined) errors.push(`${where}: 자료 문장이 없음(사진뿐이면 null)`);
      else if (quote === null) photoOnly++;
      else if (!passages.get(q)?.includes(squash(quote))) errors.push(`${where}: 시험지 자료에 없는 문장 "${quote}"`);
    } else if (!window.QUESTION_CHOICES[q]?.[(role === 'a' ? question.answer : Number(role[1])) - 1]) pictureChoice.add(q);
    if (/^#{2,3} /.test(text)) errors.push(`${where}: 소제목에는 연결하지 않음`);
    if (phrase === null) { noPhrase++; continue; }
    if (!text.includes(phrase)) { errors.push(`${where}: 문단 글에 없는 구절`); continue; }
    const key = `${themeId}|${block}|${phrase}`;
    if (seen.has(key)) errors.push(`${where}: 같은 문제에 중복`);
    seen.add(key);
    const blockKey = `${themeId}|${block}`;
    if (!byBlock.has(blockKey)) byBlock.set(blockKey, new Set());
    byBlock.get(blockKey).add(phrase);
  }
}
// 같은 문단의 서로 다른 구절이 겹치면 칠할 수 없다(화면과 같이 첫 위치 기준).
for (const [blockKey, phrases] of byBlock) {
  const [themeId, block] = blockKey.split('|');
  const text = clean(themes.get(themeId).theory[Number(block)].text);
  const ranges = [...phrases].map(p => [text.indexOf(p), text.indexOf(p) + p.length, p]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) if (ranges[i][0] < ranges[i - 1][1]) errors.push(`${themeId}[${block}]: "${ranges[i - 1][2]}"와 "${ranges[i][2]}"가 겹침`);
}
const eraArg = process.argv.indexOf('--era');
if (eraArg > 0) {
  const era = process.argv[eraArg + 1];
  const missing = [...home].filter(([id, e]) => e === era && !window.THEORY_TAGS[id]).map(([id]) => id);
  if (missing.length) errors.push(`${era}: 연결 안 된 문제 ${missing.join(', ')}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAIL ${errors.length}건`);
  process.exit(1);
}
console.log(`PASS 문제 ${Object.keys(window.THEORY_TAGS).length}개 · 연결 ${links}개 · 구절 ${[...byBlock.values()].reduce((n, s) => n + s.size, 0)}곳 · 구절 없는 보기 ${noPhrase}개 · 사진뿐인 자료 ${photoOnly}개 · 그림 보기 문제 ${pictureChoice.size}개`);
