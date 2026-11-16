// 왕 연표의 "중요한 왕" 표시를 위한 집계 도구.
// 기출 550문항 해설에서 왕 이름이 몇 문항에 나오는지 세어 dist/kings-weight.js 를 만든다.
//   node site/tools/count_kings.mjs          → 파일 생성 + 요약 출력
//   node site/tools/count_kings.mjs --list   → 왕별 횟수 전체 출력
// 값은 [s, a]: s = 문제를 설명하는 부분(자료 읽는 법 + 간단 해설)에 나온 문항 수, a = 해설 어디에든 나온 문항 수(보기·이론 포함).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dist = path.resolve(import.meta.dirname, '../dist');
const ctx = vm.createContext({ window: {} });
for (const f of ['units.js', 'details.js', 'explanations.js', 'kings-data.js']) vm.runInContext(fs.readFileSync(path.join(dist, f), 'utf8'), ctx);
const { UNITS, DETAILS, EXPLANATIONS, KINGS } = ctx.window;

// 같은 이름의 왕(정종, 성종, 고종 …)은 문항이 속한 시대로 나라를 구분한다.
const eraOf = new Map();
UNITS.eras.forEach(e => e.questions.forEach(q => eraOf.set(q, e.id)));
const allowed = {
  prehistory: ['gaya', 'daegaya'],
  'three-kingdoms': ['goguryeo', 'baekje', 'silla', 'gaya', 'daegaya'],
  'unified-silla': ['silla', 'balhae', 'taebong', 'hubaekje', 'goryeo'],
  goryeo: ['goryeo', 'taebong', 'hubaekje', 'silla'],
  'joseon-early': ['joseon'], 'joseon-late': ['joseon'], modern: ['joseon'], colonial: ['joseon'], contemporary: ['joseon'],
};

// 이름이 그대로 쓰이지 않는 왕, 또는 다른 말과 섞이는 왕은 직접 지정한다.
const aliases = {
  'goguryeo:1': ['동명성왕', '동명왕', '주몽'], 'goguryeo:19': ['광개토'],
  'silla:1': ['혁거세'], 'silla:2': ['차차웅'], 'silla:3': ['유리 이사금'], 'silla:29': ['무열왕', '김춘추'],
  'goryeo:1': ['태조', '왕건'], 'joseon:1': ['태조', '이성계'],
  'balhae:1': ['대조영'], 'taebong:1': ['궁예'], 'hubaekje:1': ['견훤'], 'hubaekje:2': ['신검'],
};
// 같은 이름이라 문장 속 단서(cue)가 함께 있을 때만 센다.
const cues = { 'goryeo:3': ['광군', '947'], 'goryeo:10': ['천리장성', '1034', '1044'] };
// 다른 뜻과 섞여서(예: 불교의 선종) 셀 수 없는 왕: 흐리게 하지 않는다
const ignore = new Set(['goryeo:13']);

const core = n => n.replace(/ ?(거서간|차차웅|이사금|마립간)$/, '');
const kings = [];
for (const k of KINGS.kingdoms) {
  if (k.kind) continue; // 1910년 이후 통치 방식·정부·임시 정부 띠는 왕이 아니라 세지 않는다(흐리게도 하지 않음)
  const seen = new Set();
  k.kings.forEach(r => {
    const key = `${k.id}:${r.n}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (r.bare || r.unknown) return; // 가는 띠 전용 항목과 미상 구간은 세지 않는다
    let names = aliases[key];
    if (!names) {
      const stripped = r.name.replace(/왕$/, '');
      names = [r.name, ...(stripped.length >= 3 && stripped !== r.name ? [stripped] : []), ...(core(r.name) !== r.name ? [core(r.name)] : [])];
    }
    kings.push({ key, kingdom: k.id, name: r.name, n: r.n, names: [...new Set(names)] });
  });
}
// 다른 왕의 이름 속에 들어 있는 이름(근초고왕 ⊃ 초고왕, 문무왕 ⊃ 무왕)은 겹쳐 세지 않도록 먼저 지운다.
const everyName = [...new Set(kings.flatMap(x => x.names))];
for (const x of kings) x.shadows = everyName.filter(o => !x.names.includes(o) && x.names.some(n => o.includes(n))).sort((a, b) => b.length - a.length);

const texts = new Map();
for (const q of eraOf.keys()) {
  const d = DETAILS[q] || {}, e = EXPLANATIONS[q] || {};
  texts.set(q, {
    stem: [d.read, e.title, e.clue, e.explanation].filter(Boolean).join(' '),
    all: [d.read, d.theory, d.memo, ...(d.choices || []), e.title, e.clue, e.explanation, e.contrast].filter(Boolean).join(' '),
  });
}
const hit = (x, text) => {
  let t = text;
  for (const s of x.shadows) t = t.split(s).join(' ');
  if (cues[x.key] && !cues[x.key].some(c => t.includes(c))) return false;
  return x.names.some(n => t.includes(n));
};

const weight = {};
for (const x of kings) {
  let s = 0, a = 0;
  if (!ignore.has(x.key)) {
    for (const [q, t] of texts) {
      if (!allowed[eraOf.get(q)]?.includes(x.kingdom)) continue;
      if (hit(x, t.stem)) s++;
      if (hit(x, t.all)) a++;
    }
  }
  weight[x.key] = ignore.has(x.key) ? null : [s, a];
}

const body = Object.entries(weight).map(([k, v]) => `  ${JSON.stringify(k)}: ${v ? `[${v[0]}, ${v[1]}]` : 'null'}`).join(',\n');
fs.writeFileSync(path.join(dist, 'kings-weight.js'),
  `// 자동 생성: node site/tools/count_kings.mjs (직접 고치지 마세요)\n// 기출 550문항 해설에서 왕 이름이 나온 문항 수. "나라:대수": [문제 설명에 나온 문항 수, 해설 전체에 나온 문항 수]\nwindow.KINGS_WEIGHT = {\n${body}\n};\n`);

const strong = x => !weight[x.key] || weight[x.key][0] >= 1 || weight[x.key][1] >= 5;
console.log(`왕 ${kings.length}명 집계 완료 → dist/kings-weight.js (문제 설명에 1번 이상 또는 해설에 5번 이상 나온 왕 ${kings.filter(strong).length}명)`);
if (process.argv.includes('--list')) {
  const byK = {};
  kings.forEach(x => (byK[x.kingdom] ||= []).push(`${x.n}${x.name}:${weight[x.key] ? weight[x.key][0] + '/' + weight[x.key][1] : '?'}${strong(x) ? '' : '·약'}`));
  for (const [k, v] of Object.entries(byK)) console.log(`\n[${k}] ${v.join('  ')}`);
}
