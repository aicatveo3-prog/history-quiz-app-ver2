// 압축 정리 자료 만들기: content/compact/*.json → dist/compact-data.js
// 실행: node site/tools/build_compact.mjs  (site 폴더 안에서는 node tools/build_compact.mjs)
//
// 원고 형식 (시대 파일 하나 = 시대 하나, 파일 이름 = theory-map.json의 시대 id)
//   { "range": "918 ~ 1392", "events": [ 사건, ... ] }
// 사건
//   y     연도(정렬 기준, 기원전은 음수)          필수
//   t     사건 이름                                 필수
//   f     분야 id(tags.json의 fields)               필수
//   n     한 줄 요점. "→"는 화살표로 그린다
//   tags  주제 태그 이름 배열(tags.json의 tags)
//   core  1이면 '핵심만' 보기에도 나온다
//   yl    연도 대신 보여 줄 글자(예: "약 70만 년 전", "12세기 중엽")
//   m     월(같은 해 사건의 순서, 화면에는 'n월'로 보임)
//   e     끝난 해(기간 사건)
//   k     흐름 줄에 쓸 짧은 이름. 문자열 또는 { "태그": "이름" }
//   th    이론 정리 주제 이름(theory-map.json과 같은 글자) → 이론 정리로 가는 링크
//   sub   펼쳐 보는 세부 흐름 [{ y?, yl?, t, n? }]
//   c     나라 id(tags.json의 countries) 또는 여러 나라 배열. 시대 파일에 lanes가 있으면 모든 사건에 필수
// 시대 안에서 사건은 연도(같은 해는 월) 순서로 적어야 한다. 순서가 어긋나면 빌드가 멈춘다.
//
//   kg    왕대 연표 시대에서 이 사건을 넣을 왕의 대수(왕이 바뀐 해에 규칙과 다를 때만)
// 왕대 연표(선택): 시대 파일의 "kingLanes": { kingdom(kings-data.js의 나라 id), kings?: [첫 대수, 끝 대수],
//   boundary: "prev"(왕이 바뀐 해의 사건은 앞 왕) | "next"(그 해에 즉위한 왕), px(1년 높이), slots: [{ id, name, color }],
//   segments: [{ from?, to?, title?, note?, cols: { 칸 id: [이름, 설명, 바뀜?] }, short: { 칸 id: 짧은 이름 } }], phases: [{ from, title, sub }] }
//   이때 사건마다 col(칸 id 또는 배열)이 필요하고, 사건 연도에 재위한 왕이 kings-data.js에 있어야 한다.
//   strips?: "row"(사건 없는 왕을 왕마다 얇은 띠 줄로) | "stack"(묶음 줄 안에 왕별 마디), box?: 1(삼국처럼 흰 카드:
//   왕 칸 = 흰 카드, 사건이 있는 칸 = 칸 색 테두리 흰 카드), cards?: [{ n, r?(복위면 1), badge, note, color? }] → 그 왕 카드에 표시 글자.
//   (strips·cards는 왕대 연표만, box는 시기 연표에서도 씀: 줄 머리 = 막대 색 테두리의 흰 카드)
// 시기 연표(선택, 개항기처럼 한 왕의 재위가 길 때): kingLanes에 "periods"를 두면 줄 = 왕 대신 시기가 된다.
//   periods: [{ id, start: [연, 월], end?: [연, 월](마지막 시기만), label, title, king(왕 대수), kingNote?, who?, keys?, marks?: [[연, 월, 글자]] }]
//   who의 **글자**는 굵게, [[글자]]는 강조 표시. keys는 직접 넣는 키워드(그 왕의 acts 중 이 시기 연도 것 뒤에 붙는다)
//   사건은 (연, 월)로 시기를 정한다(월이 없으면 1월로 본다). 규칙과 다르게 둘 때만 사건에 pd(시기 id)를 쓴다.
//   이때 segments는 from/to 대신 start(그 구간이 시작되는 시기 id, 첫 구간은 생략)를 쓰고, boundary·phases는 쓰지 않는다.
//   slots의 칸에 branches: [{ name, color, tags?: [태그], th?: [이론 주제] }]를 두면 그 칸 사건 앞에 갈래 표시를 붙인다(처음 맞는 것).
//   막대: 시기마다 king(kingdom의 왕 대수) 또는 stage(kingLanes.stages: [{ id, name, color }]의 id) 중 하나.
//   stage를 쓰면 kingdom 없이도 된다(일제 강점기: 통치 방식, 현대: 공화국). 마지막 시기에 end가 없으면 "현재"까지 열린 시기.
//   keyRefs: [kings-data.js 나라 id] → 그 나라 연표 자료 keys가 시기 keys·who·사건 이름 어디에도 없으면 '참고'로 알린다.
//   갈래에 tags·th가 없으면 사건의 br로만 붙는다.
//   pd    시기 연표 시대에서 이 사건을 넣을 시기 id(규칙과 다를 때만)
//   br    갈래 이름 직접 지정(태그로 정할 수 없을 때, 예: "개헌")
// 비교표(선택, 선사·초기 국가): 시대 파일의 "compare": { segments: [{ id, title?, note?, head, compressed?, cols: [{ id, name, sub, color, changed? }],
//   rows: [{ id, name, color, kind?, period, who?, keys?, cells: { 칸 id: [{ t, n?, key? } | { none }] } }] }] }
//   줄 = 시대·나라, 칸 = 비교 항목. 항목(t·n)은 사건이 아니라 비교 내용이고, key: 1이면 굵게(핵심).
//   compressed: 1이면 줄 사이에 시간 압축 표시(≈). 두 번째 구간부터 title(띠)이 필요하다.
//   cr    비교표 시대에서 사건을 둘 줄 id(줄 머리) 또는 구간 id(띠). cc를 함께 쓰면 그 줄의 칸 안
//   cc    비교표 칸 id
// 나라별 칸의 왕(선택, 삼국·남북국): 시대 파일의 "laneKings": { countries: { 나라 id: kings-data.js 나라 id | [여러 나라 이어 붙이기] },
//   boundary: "prev"|"next", cards: [{ c, n, kingdom?, badge, note, items?, color? }] } → 칸 안을 왕별로 묶고 cards의 왕은 큰 카드로.
//   all: 1 · px(1년 높이) → 사건·업적이 없는 왕까지 모든 왕을 즉위한 세기 줄에 한 번씩(카드 높이 = 재위 × px, 내용이 길면 내용만큼).
//   looseNote: { 나라 id: 글자 } → 왕 묶음 밖 사건 아래 설명(예: 대가야 · 왕 재위 자료 미상)
//   kgc   그 사건을 넣을 왕 { 나라 id: 왕 대수 | "나라:대수" | null } (규칙과 다를 때만. null은 특정 왕이 아닌 시기 흐름 → 왕 묶음 밖)
// 나라별 칸(선택): 시대 파일의 "lanes": [{ from?, to?, ids: [나라 id], w?: { 나라 id: 칸 너비 비율 }, title?, note? }]
//   구간(from~to, 양 끝 포함)마다 칸 구성이 다를 수 있다. 사건의 c는 그 연도가 속한 구간의 ids 안에 있어야 한다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const warn = [];
const fail = msg => errors.push(msg);

const tagFile = JSON.parse(read('content/compact/tags.json'));
const fields = tagFile.fields;
const fieldIds = new Set(fields.map(f => f.id));
const tags = [];
for (const [field, names] of Object.entries(tagFile.tags)) {
  if (!fieldIds.has(field)) fail(`tags.json: 없는 분야 ${field}`);
  for (const name of names) {
    if (tags.some(t => t.name === name)) fail(`tags.json: 태그 중복 ${name}`);
    tags.push({ name, field });
  }
}
const tagNames = new Set(tags.map(t => t.name));
const countries = tagFile.countries || [];
const countryIds = new Set();
for (const k of countries) {
  if (!k.id || !k.name || !/^#[0-9a-f]{6}$/i.test(k.color || '')) fail(`tags.json: 나라 항목이 잘못됨 ${JSON.stringify(k)}`);
  if (countryIds.has(k.id)) fail(`tags.json: 나라 id 중복 ${k.id}`);
  countryIds.add(k.id);
}

// 이론 정리 주제 이름 → id (theory.html#t12 링크용). 화면과 같은 자료(theory-data.js)를 기준으로 한다.
const theoryContext = { window: {} };
vm.runInNewContext(read('dist/theory-data.js'), theoryContext);
const theoryEras = theoryContext.window.THEORY || [];
const themeId = new Map();
for (const era of theoryEras) for (const theme of era.themes) themeId.set(theme.name, theme.id);
if (!themeId.size) fail('dist/theory-data.js에서 이론 주제를 읽지 못했습니다');

// 한국사 연표의 왕 자료(재위 연도·업적 키워드). 왕대 연표(kingLanes)에서 쓴다
const kingsContext = { window: {} };
vm.runInNewContext(read('dist/kings-data.js'), kingsContext);
const kingsData = kingsContext.window.KINGS || {};

const ALLOWED = new Set(['y', 'yl', 'm', 'e', 't', 'k', 'n', 'f', 'tags', 'core', 'th', 'sub', 'c', 'col', 'kg', 'pd', 'br', 'cr', 'cc', 'kgc']);
const boundaryReview = [];
const SUB_ALLOWED = new Set(['y', 'yl', 't', 'n']);
const usedTags = new Map();
const usedThemes = new Set();

const eras = theoryEras.map(theoryEra => {
  const file = `content/compact/${theoryEra.id}.json`;
  if (!fs.existsSync(path.join(root, file))) { fail(`${file} 없음`); return null; }
  let src;
  try { src = JSON.parse(read(file)); } catch (err) { fail(`${file}: JSON 오류 ${err.message}`); return null; }
  // 나라별 칸 구간
  let lanes = null;
  if (src.lanes !== undefined) {
    if (!Array.isArray(src.lanes) || !src.lanes.length) fail(`${file}: lanes는 비어 있지 않은 배열`);
    else {
      lanes = src.lanes.map((seg, si) => {
        const where = `${file} lanes #${si + 1}`;
        for (const key of Object.keys(seg)) if (!['from', 'to', 'ids', 'w', 'title', 'note'].includes(key)) fail(`${where}: 모르는 항목 ${key}`);
        if (!Array.isArray(seg.ids) || !seg.ids.length) fail(`${where}: ids 없음`);
        for (const id of seg.ids || []) if (!countryIds.has(id)) fail(`${where}: 없는 나라 ${id}`);
        for (const id of Object.keys(seg.w || {})) if (!(seg.ids || []).includes(id)) fail(`${where}: w의 ${id}가 ids에 없음`);
        const out = { from: seg.from ?? null, to: seg.to ?? null, ids: seg.ids || [] };
        if (seg.w) out.w = seg.w;
        if (seg.title) out.title = seg.title;
        if (seg.note) out.note = seg.note;
        return out;
      });
      for (let si = 1; si < lanes.length; si++) {
        if (lanes[si - 1].to === null || lanes[si].from === null || lanes[si].from <= lanes[si - 1].to) fail(`${file}: lanes 구간 #${si}와 #${si + 1}이 겹치거나 경계가 없음`);
      }
    }
  }
  const segmentOf = y => lanes?.findIndex(seg => (seg.from === null || y >= seg.from) && (seg.to === null || y <= seg.to)) ?? -1;

  // 나라별 칸의 왕(선택, 삼국): 칸 안을 왕별로 묶는다. countries: { 나라 id: kings-data.js 나라 id }
  // countries의 값: kings-data 나라 id 하나, 또는 [나라 id | { kingdom, kings?: [첫 대수, 끝 대수], names?: { 대수: 보일 이름 } }, ...]
  //   (예: 후고구려 칸 = 태봉 궁예 → 고려 태조). 왕은 "나라:대수" id로 구분한다
  // cards: [{ c, n, kingdom?(기본: 그 칸의 첫 나라), badge, note, items?, color? }] → 큰 카드(items가 있으면 업적 대신 그 목록)
  let laneKings = null;
  if (src.laneKings !== undefined) {
    const lk = src.laneKings;
    const where = `${file} laneKings`;
    if (!lanes) fail(`${where}: lanes가 있는 시대에서만 씀`);
    for (const key of Object.keys(lk)) if (!['countries', 'boundary', 'cards', 'all', 'px', 'looseNote'].includes(key)) fail(`${where}: 모르는 항목 ${key}`);
    if (!['prev', 'next'].includes(lk.boundary)) fail(`${where}: boundary는 "prev"(앞 왕) 또는 "next"(그 해에 즉위한 왕)`);
    // all: 1이면 사건·업적이 없는 왕까지 모든 왕을 즉위한 세기 줄에 한 번씩(카드 높이 = 재위 연수 × px, 내용이 길면 내용만큼)
    if (lk.all !== undefined && lk.all !== 1) fail(`${where}: all은 1`);
    if (lk.px !== undefined && !(typeof lk.px === 'number' && lk.px > 0 && lk.px <= 10)) fail(`${where}: px(1년 높이)는 0보다 크고 10 이하`);
    if (lk.all && lk.px === undefined) fail(`${where}: all을 쓰면 px(1년 높이)가 필요`);
    // looseNote: { 나라 id: 글자 } → 왕 묶음 밖 사건(kgc null) 아래에 붙는 설명(기본: "시기 전체의 흐름 · 특정 왕 아님")
    if (lk.looseNote !== undefined && !(lk.looseNote && typeof lk.looseNote === 'object' && Object.values(lk.looseNote).every(x => typeof x === 'string' && x))) fail(`${where}: looseNote는 { 나라 id: 글자 }`);
    laneKings = { boundary: lk.boundary, map: new Map(), all: !!lk.all, px: lk.px ?? null, looseNote: lk.looseNote || {} };
    for (const cid of Object.keys(laneKings.looseNote)) if (!(lk.countries || {})[cid]) fail(`${where} looseNote: 왕을 연결하지 않은 나라 ${cid}`);
    for (const [cid, spec] of Object.entries(lk.countries || {})) {
      if (!countryIds.has(cid)) fail(`${where}: 없는 나라 ${cid}`);
      if (!(lanes || []).some(seg => seg.ids.includes(cid))) fail(`${where}: 나라 ${cid}가 lanes 칸에 없음`);
      const kings = [];
      let primary = null;
      for (const part of [].concat(spec)) {
        const p = typeof part === 'string' ? { kingdom: part } : part;
        for (const key of Object.keys(p || {})) if (!['kingdom', 'kings', 'names'].includes(key)) fail(`${where} ${cid}: 모르는 항목 ${key}`);
        const kd = kingsData.kingdoms?.find(k => k.id === p?.kingdom);
        if (!kd) { fail(`${where} ${cid}: kings-data.js에 나라 ${p?.kingdom} 없음`); continue; }
        if (p.kings !== undefined && !(Array.isArray(p.kings) && p.kings.length === 2 && p.kings.every(Number.isInteger))) fail(`${where} ${cid}: kings는 [첫 대수, 끝 대수]`);
        primary ??= kd.id;
        for (const k of kd.kings) {
          if (p.kings && (k.n < p.kings[0] || k.n > p.kings[1])) continue;
          kings.push({ ...k, id: `${kd.id}:${k.n}`, kingdom: kd.id, name: p.names?.[k.n] || k.name });
        }
      }
      if (!kings.length) fail(`${where} ${cid}: 연결된 왕이 없음`);
      laneKings.map.set(cid, { kings, primary, cards: new Map() });
    }
    if (!laneKings.map.size) fail(`${where}: countries가 비었음`);
    for (const card of lk.cards || []) {
      for (const key of Object.keys(card)) if (!['c', 'n', 'kingdom', 'badge', 'note', 'items', 'color'].includes(key)) fail(`${where} cards: 모르는 항목 ${key}`);
      const m = laneKings.map.get(card.c);
      const id = m ? `${card.kingdom || m.primary}:${card.n}` : '';
      if (!m) fail(`${where} cards: 왕을 연결하지 않은 나라 ${card.c}`);
      else if (!m.kings.some(k => k.id === id)) fail(`${where} cards: ${card.c} 칸에 ${id} 왕 없음`);
      else if (!card.badge || !card.note) fail(`${where} cards ${id}: badge(카드 표시 글자)·note(설명) 필요`);
      else if (card.items !== undefined && !(Array.isArray(card.items) && card.items.length && card.items.every(x => typeof x === 'string' && x))) fail(`${where} cards ${id}: items는 글자 배열`);
      else if (card.color !== undefined && !/^#[0-9a-f]{6}$/i.test(card.color)) fail(`${where} cards ${id}: color는 #rrggbb`);
      else m.cards.set(id, { badge: card.badge, note: card.note, ...(card.items ? { items: card.items } : {}), ...(card.color ? { color: card.color } : {}) });
    }
  }

  // 왕대 연표(선택): 줄 = 왕, 칸 = 세력. 왕 목록·재위 연도·업적 키워드는 dist/kings-data.js에서 가져온다
  let kingLanes = null;
  if (src.kingLanes !== undefined) {
    const kl = src.kingLanes;
    const where = `${file} kingLanes`;
    if (lanes) fail(`${where}: lanes와 함께 쓸 수 없음`);
    const isPeriods = kl.periods !== undefined;
    for (const key of Object.keys(kl)) if (!['kingdom', 'kings', 'boundary', 'px', 'slots', 'segments', 'phases', 'periods', 'stages', 'keyRefs', 'strips', 'cards', 'box'].includes(key)) fail(`${where}: 모르는 항목 ${key}`);
    // box: 1이면 삼국처럼 흰 카드 — 줄 머리(왕·시기)는 흰 카드, 사건이 있는 칸은 그 칸 색 테두리의 흰 카드(왕대·시기 연표 모두)
    if (kl.box !== undefined && kl.box !== 1) fail(`${where}: box는 1만 씀`);
    // strips(왕대 연표만): 사건 없는 왕을 묶음 한 줄 대신 왕마다 얇은 띠로. "row" = 왕마다 한 줄, "stack" = 묶음 줄 안에 왕별 띠
    // cards(왕대 연표만): [{ n, r?(복위 재위면 1), badge, note, color? }] → 그 왕 줄 머리에 표시 글자(예: 왕권 강화)
    if (kl.strips !== undefined && !['row', 'stack'].includes(kl.strips)) fail(`${where}: strips는 "row" 또는 "stack"`);
    if ((kl.strips !== undefined || kl.cards !== undefined) && isPeriods) fail(`${where}: strips·cards는 왕대 연표(periods 없음)에서만 씀`);
    for (const c of kl.cards || []) {
      for (const key of Object.keys(c)) if (!['n', 'r', 'badge', 'note', 'color'].includes(key)) fail(`${where} cards: 모르는 항목 ${key}`);
      if (!Number.isInteger(c.n) || !c.badge || !c.note) fail(`${where} cards: n(왕 대수)·badge·note 필요 ${JSON.stringify(c)}`);
      if (c.color !== undefined && !/^#[0-9a-f]{6}$/i.test(c.color)) fail(`${where} cards ${c.n}대: color는 #rrggbb`);
    }
    if (isPeriods) {
      if (kl.boundary !== undefined || kl.phases !== undefined) fail(`${where}: periods(시기 연표)에는 boundary·phases를 쓰지 않음`);
    } else {
      if (!['prev', 'next'].includes(kl.boundary)) fail(`${where}: boundary는 "prev"(앞 왕) 또는 "next"(그 해에 즉위한 왕)`);
      if (kl.stages !== undefined || kl.keyRefs !== undefined) fail(`${where}: stages·keyRefs는 periods(시기 연표)에서만 씀`);
    }
    if (kl.kings !== undefined && !(Array.isArray(kl.kings) && kl.kings.length === 2 && kl.kings.every(Number.isInteger))) fail(`${where}: kings는 [첫 왕 대수, 끝 왕 대수]`);
    // 시기 연표는 kingdom 없이 stages(막대 단계)만으로도 쓸 수 있다
    const kingdom = kl.kingdom === undefined && isPeriods ? null : kingsData.kingdoms?.find(k => k.id === kl.kingdom);
    if (kingdom === undefined) fail(`${where}: kings-data.js에 나라 ${kl.kingdom} 없음`);
    // 막대 단계(예: 무단·문화·민족 말살 통치, 제1~6공화국): 시기마다 king 대신 stage를 쓴다
    const stages = kl.stages || [];
    if (kl.stages !== undefined && !(Array.isArray(kl.stages) && kl.stages.length)) fail(`${where}: stages는 비어 있지 않은 배열`);
    for (const st of stages) {
      for (const key of Object.keys(st)) if (!['id', 'name', 'color'].includes(key)) fail(`${where} 단계 ${st.id}: 모르는 항목 ${key}`);
      if (!st.id || !st.name || !/^#[0-9a-f]{6}$/i.test(st.color || '')) fail(`${where}: 단계 항목이 잘못됨 ${JSON.stringify(st)}`);
    }
    if (new Set(stages.map(s => s.id)).size !== stages.length) fail(`${where}: 단계 id 중복`);
    // 키워드 누락 검사에 쓸 연표 자료 나라(kings-data.js의 keys가 시기 keys·who·사건 이름 어딘가에 있어야 함)
    if (kl.keyRefs !== undefined && !(Array.isArray(kl.keyRefs) && kl.keyRefs.every(id => kingsData.kingdoms?.some(k => k.id === id)))) fail(`${where}: keyRefs는 kings-data.js 나라 id 배열`);
    const slotIds = (kl.slots || []).map(s => s.id);
    if (!slotIds.length) fail(`${where}: slots 없음`);
    for (const s of kl.slots || []) {
      if (!s.id || !s.name || !/^#[0-9a-f]{6}$/i.test(s.color || '')) fail(`${where}: 칸 항목이 잘못됨 ${JSON.stringify(s)}`);
      for (const key of Object.keys(s)) if (!['id', 'name', 'color', 'branches'].includes(key)) fail(`${where} 칸 ${s.id}: 모르는 항목 ${key}`);
      for (const b of s.branches || []) {
        // tags·th가 없는 갈래는 사건의 br로만 붙는다(예: "개헌")
        for (const key of Object.keys(b)) if (!['name', 'color', 'tags', 'th'].includes(key)) fail(`${where} 칸 ${s.id} 갈래 ${b.name}: 모르는 항목 ${key}`);
        if (!b.name || !/^#[0-9a-f]{6}$/i.test(b.color || '')) fail(`${where} 칸 ${s.id}: 갈래 항목이 잘못됨 ${JSON.stringify(b)}`);
        for (const t of b.tags || []) if (!tagNames.has(t)) fail(`${where} 칸 ${s.id} 갈래 ${b.name}: 없는 태그 "${t}"`);
        for (const t of b.th || []) if (!themeId.has(t)) fail(`${where} 칸 ${s.id} 갈래 ${b.name}: 없는 이론 주제 "${t}"`);
      }
    }
    // 시기 연표: 시기 목록 검사. 시작 시점은 (연, 월), 뒤 시기일수록 늦어야 한다
    const ymKey = ym => ym[0] * 100 + ym[1];
    const isYm = ym => Array.isArray(ym) && ym.length === 2 && Number.isInteger(ym[0]) && Number.isInteger(ym[1]) && ym[1] >= 1 && ym[1] <= 12;
    const periods = isPeriods ? kl.periods : null;
    if (isPeriods) {
      if (!Array.isArray(periods) || !periods.length) fail(`${where}: periods는 비어 있지 않은 배열`);
      const ids = new Set();
      (periods || []).forEach((p, pi) => {
        const pw = `${where} 시기 #${pi + 1} ${p.title || ''}`;
        for (const key of Object.keys(p)) if (!['id', 'start', 'end', 'label', 'title', 'king', 'stage', 'kingNote', 'who', 'keys', 'marks'].includes(key)) fail(`${pw}: 모르는 항목 ${key}`);
        if (!p.id || ids.has(p.id)) fail(`${pw}: id가 없거나 중복`);
        ids.add(p.id);
        if (!isYm(p.start)) fail(`${pw}: start는 [연, 월]`);
        else if (pi && isYm(periods[pi - 1].start) && ymKey(p.start) <= ymKey(periods[pi - 1].start)) fail(`${pw}: start가 앞 시기보다 늦어야 함`);
        if (p.end !== undefined && (pi !== periods.length - 1 || !isYm(p.end) || (isYm(p.start) && ymKey(p.end) < ymKey(p.start)))) fail(`${pw}: end는 마지막 시기에만, start 이후의 [연, 월]`);
        if (!p.label || !p.title) fail(`${pw}: label·title 필요`);
        // 막대는 king(kingdom의 왕 대수) 또는 stage(stages의 id) 중 하나
        if ((p.king === undefined) === (p.stage === undefined)) fail(`${pw}: king과 stage 중 하나만 씀`);
        if (p.king !== undefined && (!kingdom || !Number.isInteger(p.king) || (kl.kings && (p.king < kl.kings[0] || p.king > kl.kings[1])))) fail(`${pw}: king은 kingdom이 있을 때 kings 범위 안의 왕 대수`);
        if (p.stage !== undefined && !stages.some(st => st.id === p.stage)) fail(`${pw}: 없는 단계 stage "${p.stage}"`);
        if (p.keys !== undefined && !(Array.isArray(p.keys) && p.keys.every(x => typeof x === 'string' && x))) fail(`${pw}: keys는 글자 배열`);
        for (const mk of p.marks || []) if (!(Array.isArray(mk) && mk.length === 3 && Number.isInteger(mk[0]) && Number.isInteger(mk[1]) && mk[2])) fail(`${pw}: marks는 [[연, 월, 글자]]`);
      });
      // 마지막 시기의 end가 없으면 "현재"까지 열린 시기(현대). 눈금 자 끝은 그 시기 마지막 사건 다음 해
    }
    const periodIndex = id => (periods || []).findIndex(p => p.id === id);
    (kl.segments || []).forEach((seg, si) => {
      for (const id of slotIds) {
        if (!Array.isArray(seg.cols?.[id])) fail(`${where} 구간 #${si + 1}: cols.${id} 없음`);
        if (!seg.short?.[id]) fail(`${where} 구간 #${si + 1}: short.${id} 없음`);
      }
      if (isPeriods) {
        if (seg.from !== undefined || seg.to !== undefined) fail(`${where} 구간 #${si + 1}: 시기 연표 구간은 from/to 대신 start(시기 id)`);
        if (!si && seg.start !== undefined) fail(`${where}: 첫 구간에는 start를 쓰지 않음(첫 시기부터)`);
        if (si && (periodIndex(seg.start) <= 0 || periodIndex(seg.start) <= periodIndex(kl.segments[si - 1].start ?? periods[0].id))) fail(`${where} 구간 #${si + 1}: start "${seg.start}"가 없거나 앞 구간보다 늦지 않음`);
      } else if (si && (seg.from == null || kl.segments[si - 1].to == null || seg.from <= kl.segments[si - 1].to)) fail(`${where}: 구간 #${si}와 #${si + 1} 경계가 잘못됨`);
    });
    (kl.phases || []).forEach((p, pi) => { if (!Number.isInteger(p.from) || !p.title || (pi && p.from <= kl.phases[pi - 1].from)) fail(`${where}: phases #${pi + 1}이 잘못됨`); });
    if (kingdom || (isPeriods && kingdom === null)) {
      // 막대 색: 단계는 그 색, 왕은 차례대로(첫 왕 진한 초록, 다음 왕 올리브, …)
      const KING_COLORS = ['#0d4945', '#6a7d2c', '#3d63a6'];
      const kingOrder = [...new Set((periods || []).filter(p => p.king !== undefined).map(p => p.king))];
      const barOf = p => {
        if (p.stage !== undefined) { const st = stages.find(x => x.id === p.stage); return { bar: `s:${p.stage}`, color: st?.color || '#0d4945', barName: st?.name || '' }; }
        return { bar: `k:${p.king}`, color: KING_COLORS[kingOrder.indexOf(p.king) % KING_COLORS.length], barName: kingdom?.kings.find(k => k.n === p.king)?.name || '' };
      };
      // 눈금 자용 소수 연도: 1896.2 → 1896 + 1/12
      const ymYear = ym => ym[0] + (ym[1] - 1) / 12;
      kingLanes = {
        px: Number(kl.px) || 5,
        slots: kl.slots,
        segments: kl.segments.map(seg => ({
          from: seg.from ?? null, to: seg.to ?? null, title: seg.title || null, note: seg.note || null, cols: seg.cols, short: seg.short,
          ...(isPeriods ? { row: seg.start === undefined ? 0 : periodIndex(seg.start) } : {}),
        })),
        phases: kl.phases || [],
        boundary: kl.boundary ?? null,
        ...(isPeriods && periods.every(p => isYm(p.start)) ? {
          periods: periods.map((p, pi) => ({
            id: p.id, label: p.label, title: p.title, king: p.king ?? null, ...barOf(p), kingNote: p.kingNote || null, who: p.who || null,
            start: p.start, startKey: ymKey(p.start),
            s: ymYear(p.start), e: periods[pi + 1]?.start || p.end ? ymYear(periods[pi + 1]?.start || p.end) : null, open: !periods[pi + 1] && !p.end,
            keys: p.keys || [], marks: (p.marks || []).map(([y, m, text]) => ({ at: ymYear([y, m]), text })),
          })),
        } : {}),
        kings: (kingdom?.kings || [])
          .filter(k => !kl.kings || (k.n >= kl.kings[0] && k.n <= kl.kings[1]))
          .map(k => {
            const out = { n: k.n, name: k.name, s: k.s, e: k.e };
            if (k.r) out.r = 1;
            // 업적 키워드: 고려는 keys, 조선은 acts(연도가 붙은 업적)의 짧은 이름
            const keys = k.keys?.length ? k.keys : (k.acts || []).map(a => a.short || a.name);
            if (keys.length) out.keys = keys;
            const card = (kl.cards || []).find(c => c.n === k.n && !!c.r === !!k.r);
            if (card) out.card = { badge: card.badge, note: card.note, ...(card.color ? { color: card.color } : {}) };
            return out;
          }),
        ...(kl.strips ? { strips: kl.strips } : {}),
        ...(kl.box ? { box: 1 } : {}),
      };
      if (kingdom && !kingLanes.kings.length) fail(`${where}: kings 범위에 왕이 없음`);
      for (const c of kl.cards || []) if (!kingLanes.kings.some(k => k.n === c.n && !!k.r === !!c.r)) fail(`${where} cards: ${c.n}대${c.r ? '(복위)' : ''} 왕이 kings 범위에 없음`);
    }
  }

  // 비교표(선택, 선사·초기 국가처럼 순서보다 비교가 중요할 때): 줄 = 시대·나라, 칸 = 비교 항목
  let compare = null;
  const compareRow = new Map(); // 줄 id → { seg, row }
  const compareSeg = new Map(); // 구간 id → seg
  if (src.compare !== undefined) {
    const where = `${file} compare`;
    if (lanes || src.kingLanes) fail(`${where}: lanes·kingLanes와 함께 쓸 수 없음`);
    const cp = src.compare;
    for (const key of Object.keys(cp)) if (key !== 'segments') fail(`${where}: 모르는 항목 ${key}`);
    if (!Array.isArray(cp.segments) || !cp.segments.length) fail(`${where}: segments는 비어 있지 않은 배열`);
    const isColor = c => /^#[0-9a-f]{6}$/i.test(c || '');
    const factOk = (x, w) => {
      if (x && typeof x === 'object' && Object.keys(x).length === 1 && typeof x.none === 'string' && x.none) return;
      for (const key of Object.keys(x || {})) if (!['t', 'n', 'key'].includes(key)) fail(`${w}: 항목의 모르는 항목 ${key}`);
      if (!x?.t || typeof x.t !== 'string') fail(`${w}: 항목에 t(글자) 없음`);
      if (x?.n !== undefined && typeof x.n !== 'string') fail(`${w}: 항목의 n은 글자`);
      if (x?.key !== undefined && x.key !== 1) fail(`${w}: 항목의 key는 1`);
    };
    (cp.segments || []).forEach((seg, si) => {
      const sw = `${where} 구간 #${si + 1}`;
      for (const key of Object.keys(seg)) if (!['id', 'title', 'note', 'head', 'compressed', 'cols', 'rows'].includes(key)) fail(`${sw}: 모르는 항목 ${key}`);
      if (!seg.id || compareSeg.has(seg.id)) fail(`${sw}: id가 없거나 중복`);
      compareSeg.set(seg.id, seg);
      if (si && !seg.title) fail(`${sw}: 두 번째 구간부터는 띠 제목(title) 필요`);
      const colIds = (seg.cols || []).map(c => c.id);
      if (!colIds.length || new Set(colIds).size !== colIds.length) fail(`${sw}: cols가 없거나 id 중복`);
      for (const c of seg.cols || []) {
        for (const key of Object.keys(c)) if (!['id', 'name', 'sub', 'color', 'changed'].includes(key)) fail(`${sw} 칸 ${c.id}: 모르는 항목 ${key}`);
        if (!c.id || !c.name || !isColor(c.color)) fail(`${sw}: 칸 항목이 잘못됨 ${JSON.stringify(c)}`);
      }
      if (!Array.isArray(seg.rows) || !seg.rows.length) fail(`${sw}: rows는 비어 있지 않은 배열`);
      for (const r of seg.rows || []) {
        const rw = `${sw} 줄 ${r.id || ''}`;
        for (const key of Object.keys(r)) if (!['id', 'name', 'color', 'kind', 'period', 'who', 'keys', 'cells'].includes(key)) fail(`${rw}: 모르는 항목 ${key}`);
        if (!r.id || compareRow.has(r.id) || compareSeg.has(r.id)) fail(`${rw}: id가 없거나 중복(구간 id와도 달라야 함)`);
        compareRow.set(r.id, { seg, row: r });
        if (!r.name || !isColor(r.color) || !r.period) fail(`${rw}: name·color·period 필요`);
        if (r.keys !== undefined && !(Array.isArray(r.keys) && r.keys.every(x => typeof x === 'string' && x))) fail(`${rw}: keys는 글자 배열`);
        for (const [cid, items] of Object.entries(r.cells || {})) {
          if (!colIds.includes(cid)) fail(`${rw}: 없는 칸 ${cid}`);
          if (!Array.isArray(items)) fail(`${rw} 칸 ${cid}: 항목 배열이 아님`);
          else items.forEach(x => factOk(x, `${rw} 칸 ${cid}`));
        }
      }
    });
    compare = { segments: cp.segments };
  }

  const events = [];
  let prev = null;
  (src.events || []).forEach((ev, i) => {
    const where = `${file} #${i + 1} ${ev.t || ''}`;
    // 비교표: 사건마다 cr(줄 id 또는 구간 id)이 필요. cc(칸 id)가 있으면 그 칸, 없으면 줄 머리(줄 id) 또는 띠(구간 id)
    if (compare) {
      if (ev.cr === undefined) fail(`${where}: compare가 있는 시대라 cr(줄 또는 구간 id)이 필요`);
      else if (compareRow.has(ev.cr)) {
        const { seg } = compareRow.get(ev.cr);
        if (ev.cc !== undefined && !seg.cols.some(c => c.id === ev.cc)) fail(`${where}: cc "${ev.cc}"가 줄 ${ev.cr}의 구간 칸에 없음`);
      } else if (compareSeg.has(ev.cr)) {
        if (ev.cc !== undefined) fail(`${where}: 구간(띠)에 둔 사건에는 cc를 쓰지 않음`);
      } else fail(`${where}: 없는 줄·구간 cr "${ev.cr}"`);
    } else if (ev.cr !== undefined || ev.cc !== undefined) fail(`${where}: cr·cc가 있지만 시대 파일에 compare가 없음`);
    let c = null;
    if (ev.c !== undefined) {
      c = [].concat(ev.c);
      if (!c.length || new Set(c).size !== c.length) fail(`${where}: c(나라)가 비었거나 중복`);
      for (const id of c) if (!countryIds.has(id)) fail(`${where}: 없는 나라 "${id}"`);
      if (!lanes) fail(`${where}: c가 있지만 시대 파일에 lanes가 없음`);
    }
    if (lanes) {
      const si = segmentOf(ev.y);
      if (si < 0) fail(`${where}: 연도 ${ev.y}가 lanes 어느 구간에도 속하지 않음`);
      else if (!c) fail(`${where}: lanes가 있는 시대라 c(나라)가 필요`);
      else for (const id of c) if (!lanes[si].ids.includes(id)) fail(`${where}: 나라 ${id}가 ${ev.y}년 구간의 칸에 없음`);
    }
    // 나라별 칸의 왕: 사건의 나라마다 그 해에 재위한 왕. 왕이 바뀐 해는 boundary 규칙 또는 kgc
    // kgc 값: 왕 대수(그 칸의 첫 나라) · "나라:대수" · null(특정 왕이 아닌 시기 전체의 흐름 → 왕 묶음 밖)
    let kn = null;
    if (laneKings && c) {
      kn = {};
      for (const cid of c) {
        const m = laneKings.map.get(cid);
        if (!m) continue;
        const cname = countries.find(x => x.id === cid)?.name || cid;
        if (ev.kgc?.[cid] === null) { boundaryReview.push(`${file}: ${ev.yl || ev.y} ${ev.t} [${cname}] → 왕 묶음 밖 (kgc null)`); continue; }
        const cands = m.kings.filter(k => k.s <= ev.y && ev.y <= k.e);
        let k = null;
        if (ev.kgc?.[cid] !== undefined) {
          const want = typeof ev.kgc[cid] === 'number' ? `${m.primary}:${ev.kgc[cid]}` : ev.kgc[cid];
          k = cands.find(x => x.id === want);
          if (!k) fail(`${where}: kgc ${cid} ${want} 왕은 ${ev.y}년에 재위하지 않음`);
        } else if (!cands.length) fail(`${where}: ${ev.y}년에 재위한 ${cid} 왕이 kings-data.js에 없음`);
        else k = laneKings.boundary === 'next' ? cands[cands.length - 1] : cands[0];
        if (k) {
          kn[cid] = k.id;
          if (cands.length > 1 || ev.kgc?.[cid] !== undefined) boundaryReview.push(`${file}: ${ev.y} ${ev.t} [${cname}] → ${k.n}대 ${k.name}${ev.kgc?.[cid] !== undefined ? ' (kgc 지정)' : ' (규칙)'}`);
        }
      }
    }
    if (ev.kgc !== undefined) {
      if (!laneKings || !ev.kgc || typeof ev.kgc !== 'object' || Array.isArray(ev.kgc)) fail(`${where}: kgc는 laneKings가 있는 시대에서 { 나라 id: 왕 대수 | "나라:대수" | null }`);
      else for (const cid of Object.keys(ev.kgc)) if (!(c || []).includes(cid) || !laneKings.map.has(cid)) fail(`${where}: kgc의 ${cid}는 사건 나라(c)이면서 왕을 연결한 나라여야 함`);
    }
    let col = null;
    if (ev.col !== undefined) {
      col = [].concat(ev.col);
      if (!kingLanes) fail(`${where}: col이 있지만 시대 파일에 kingLanes가 없음`);
      else for (const id of col) if (!kingLanes.slots.some(s => s.id === id)) fail(`${where}: 없는 칸 "${id}"`);
      if (!col.length || new Set(col).size !== col.length) fail(`${where}: col이 비었거나 중복`);
    } else if (kingLanes) fail(`${where}: kingLanes가 있는 시대라 col(칸)이 필요`);
    // br: 갈래를 직접 지정(태그로 정할 수 없는 갈래, 예: "개헌"). 사건 칸 중 하나에 그 갈래가 있어야 한다
    if (ev.br !== undefined && !(kingLanes && col && col.some(id => (kingLanes.slots.find(s => s.id === id)?.branches || []).some(b => b.name === ev.br)))) fail(`${where}: br "${ev.br}" 갈래가 사건 칸에 없음`);
    // 사건 → 왕 줄. 그 해에 재위한 왕이 둘(왕이 바뀐 해)이면 kg(왕 대수)을 따르고, 없으면 시대의 boundary 규칙을 따른다
    let ki = null;
    let ri = null;
    if (kingLanes?.periods) {
      // 시기 연표: (연, 월)이 시작 시점 이후인 마지막 시기. 월이 없으면 1월로 본다. pd가 있으면 그 시기
      const ps = kingLanes.periods;
      const key = ev.y * 100 + (ev.m || 1);
      if (ev.kg !== undefined) fail(`${where}: 시기 연표 시대에서는 kg 대신 pd(시기 id)`);
      if (ev.pd !== undefined) {
        ri = ps.findIndex(p => p.id === ev.pd);
        if (ri < 0) { fail(`${where}: 없는 시기 pd "${ev.pd}"`); ri = null; }
      } else {
        ps.forEach((p, idx) => { if (key >= p.startKey) ri = idx; });
        const endP = src.kingLanes.periods[ps.length - 1].end;
        if (ri === null) fail(`${where}: ${ev.y}년이 첫 시기 시작 전`);
        else if (endP && key > endP[0] * 100 + endP[1]) { fail(`${where}: ${ev.y}${ev.m ? '.' + ev.m : ''}이 마지막 시기 끝 뒤`); ri = null; }
      }
      // 시기가 바뀌는 해(시작 월이 1월이 아닌 해)의 사건, 또는 pd로 지정한 사건은 확인 목록에 보인다
      if (ri !== null && (ev.pd !== undefined || ps.some(p => p.start[0] === ev.y && p.start[1] > 1))) {
        const p = ps[ri];
        boundaryReview.push(`${file}: ${ev.y}${ev.m ? '.' + ev.m : ''} ${ev.t} → ${ri + 1} ${p.title}${ev.pd !== undefined ? ' (pd 지정)' : ev.m ? ` (${ev.m}월)` : ' (월 없음 → 1월로 봄)'}`);
      }
    } else if (ev.pd !== undefined) fail(`${where}: pd가 있지만 시대 파일에 kingLanes.periods가 없음`);
    if (kingLanes && !kingLanes.periods) {
      const cands = kingLanes.kings.map((k, idx) => ({ k, idx })).filter(({ k }) => k.s <= ev.y && ev.y <= k.e);
      if (ev.kg !== undefined) {
        const hit = cands.find(({ k }) => k.n === ev.kg);
        if (!hit) fail(`${where}: kg ${ev.kg}대 왕은 ${ev.y}년에 재위하지 않음`);
        else ki = hit.idx;
      } else if (!cands.length) fail(`${where}: ${ev.y}년에 재위한 왕이 이 시대 kings 범위에 없음`);
      else ki = (kingLanes.boundary === 'next' ? cands[cands.length - 1] : cands[0]).idx;
      if (cands.length > 1 && ki !== null) {
        const k = kingLanes.kings[ki];
        boundaryReview.push(`${file}: ${ev.y} ${ev.t} → ${k.n}대 ${k.name}${ev.kg !== undefined ? ' (kg 지정)' : ' (규칙)'}`);
      }
    } else if (ev.kg !== undefined && !kingLanes) fail(`${where}: kg가 있지만 시대 파일에 kingLanes가 없음`);
    for (const key of Object.keys(ev)) if (!ALLOWED.has(key)) fail(`${where}: 모르는 항목 ${key}`);
    if (!Number.isInteger(ev.y)) fail(`${where}: y(연도)가 정수가 아님`);
    if (!ev.t || typeof ev.t !== 'string') fail(`${where}: t(이름) 없음`);
    if (!fieldIds.has(ev.f)) fail(`${where}: 분야 f="${ev.f}" 없음`);
    if (ev.m !== undefined && !(Number.isInteger(ev.m) && ev.m >= 1 && ev.m <= 12)) fail(`${where}: m(월)은 1~12`);
    if (ev.e !== undefined && !(Number.isInteger(ev.e) && ev.e >= ev.y)) fail(`${where}: e(끝난 해)가 y보다 앞섬`);
    const evTags = ev.tags || [];
    if (!Array.isArray(evTags)) fail(`${where}: tags는 배열`);
    for (const tag of evTags) {
      if (!tagNames.has(tag)) fail(`${where}: 없는 태그 "${tag}"`);
      usedTags.set(tag, (usedTags.get(tag) || 0) + 1);
    }
    if (new Set(evTags).size !== evTags.length) fail(`${where}: 태그 중복`);
    if (ev.k && typeof ev.k === 'object') {
      for (const key of Object.keys(ev.k)) if (!evTags.includes(key)) fail(`${where}: k의 "${key}"가 사건 태그에 없음`);
    }
    let th = null;
    if (ev.th) {
      if (!themeId.has(ev.th)) fail(`${where}: 이론 주제 "${ev.th}" 없음`);
      else { th = { id: themeId.get(ev.th), name: ev.th }; usedThemes.add(ev.th); }
    }
    for (const s of ev.sub || []) {
      for (const key of Object.keys(s)) if (!SUB_ALLOWED.has(key)) fail(`${where}: sub의 모르는 항목 ${key}`);
      if (!s.t) fail(`${where}: sub에 t 없음`);
      if (s.y !== undefined && !Number.isInteger(s.y)) fail(`${where}: sub의 y가 정수가 아님`);
    }
    if (prev && (ev.y < prev.y || (ev.y === prev.y && ev.m && prev.m && ev.m < prev.m))) {
      fail(`${where}: 연도 순서가 앞 사건(${prev.y}${prev.m ? '.' + prev.m : ''} ${prev.t})보다 앞섬`);
    }
    prev = ev;
    const out = { id: `${theoryEra.id}-${i + 1}`, y: ev.y, t: ev.t, f: ev.f, tags: evTags };
    for (const key of ['yl', 'm', 'e', 'k', 'n', 'br', 'cr', 'cc']) if (ev[key] !== undefined) out[key] = ev[key];
    if (ev.core) out.core = 1;
    if (c) out.c = c;
    if (kn && Object.keys(kn).length) out.kn = kn;
    if (col) out.col = col;
    if (ki !== null) out.ki = ki;
    if (ri !== null) out.ri = ri;
    if (th) out.th = th;
    if (ev.sub?.length) out.sub = ev.sub;
    events.push(out);
  });
  if (!events.length) fail(`${file}: 사건이 없음`);
  const titles = new Map();
  for (const ev of events) {
    const key = `${ev.y}|${ev.t}`;
    if (titles.has(key)) warn.push(`${file}: 같은 해 같은 이름 ${ev.y} ${ev.t}`);
    titles.set(key, true);
  }
  const era = { id: theoryEra.id, name: theoryEra.name, range: src.range || theoryEra.range, events };
  if (lanes) era.lanes = lanes;
  if (laneKings) {
    // 나라마다 화면에 보일 왕: 사건이 있는 세기 줄마다 한 번(세기 경계에 걸친 왕도 사건 있는 세기에만),
    // 사건이 없으면 업적 키워드가 남을 때만 즉위한 세기 줄에. 키워드는 처음 나오는 줄에만 붙이고,
    // 그 줄의 같은 나라 사건 이름·흐름 줄 이름에 첫 낱말이 있으면 뺀다("웅진 천도" ↔ "한성 함락 → 웅진 천도")
    const centOf = y => (y < 0 ? -Math.ceil(-y / 100) : Math.floor(y / 100) + 1);
    const minY = Math.min(...events.map(ev => ev.y)), maxY = Math.max(...events.map(ev => ev.e || ev.y));
    // 비교 대상은 화면에 보이는 사건 이름과 문자열 흐름 줄 이름만(왕대 연표와 같음). 태그별 흐름 줄 이름({ 태그: 이름 })은 평소 보이지 않아 빼지 않는다
    const kText = k => (typeof k === 'string' ? [k] : []);
    // 겹침 판단: 첫 낱말이 3글자 이상이면 그 낱말만으로(예: "미륵사 창건" ↔ "익산 미륵사지 석탑"),
    // 아니면 2글자 이상 낱말이 모두 들어 있을 때(예: "국호·왕 칭호" ↔ "국호 '신라'·'왕' 칭호", "익산 천도 계획"은 남김)
    const words = s => String(s).replace(/\([^)]*\)/g, '').replace(/[『』「」]/g, '').split(/[\s·]/).filter(w => w.length >= 2);
    const dup = (key, titles) => {
      const ws = words(key);
      if (!ws.length) return false;
      return titles.some(t => (ws[0].length >= 3 && t.includes(ws[0])) || ws.every(w => t.includes(w)));
    };
    const outLK = {};
    const eventCents = new Set(events.map(ev => centOf(ev.y)));
    for (const [cid, m] of laneKings.map) {
      const own = events.filter(ev => ev.kn?.[cid] !== undefined);
      const kings = [];
      for (const k of m.kings.filter(x => x.e >= minY && x.s <= maxY)) {
        const mine = own.filter(ev => ev.kn[cid] === k.id);
        // all: 왕은 즉위한 세기 줄에 한 번(시대 시작 전 즉위면 시대 첫 해의 세기), 그 왕의 사건은 모두 그 카드에
        const rows = laneKings.all ? [centOf(Math.max(k.s, minY))] : [...new Set(mine.map(ev => centOf(ev.y)))];
        const keysAt = rows.length ? rows[0] : centOf(Math.max(k.s, minY));
        const titles = (laneKings.all ? mine : own.filter(ev => centOf(ev.y) === keysAt)).flatMap(ev => [ev.t, ...kText(ev.k)]);
        // 업적: keys(연도 없음) 또는 acts. 연도가 이 시대 밖인 acts는 뺀다(예: 문무왕의 668 고구려 멸망은 삼국 칸에)
        const raw = k.keys?.length ? k.keys : (k.acts || []).filter(a => !Number.isInteger(a.y ?? a.from) || ((a.y ?? a.from) >= minY && (a.y ?? a.from) <= maxY)).map(a => a.short || a.name);
        const keys = raw.filter(x => !dup(x, titles));
        const card = m.cards.get(k.id);
        if (!laneKings.all && !rows.length && !keys.length && !card?.items) continue;
        if (!laneKings.all && !rows.length && !eventCents.has(keysAt)) warn.push(`${file}: ${k.name}의 키워드를 보일 ${keysAt}세기 줄이 없음(그 세기 사건이 없어 줄이 생기지 않음)`);
        const out = { id: k.id, n: k.n, name: k.name, s: k.s, e: k.e, rows: rows.length ? rows : [keysAt], keysAt };
        // 이 정리에서 그 왕의 사건·업적이 하나도 없으면 조용한 왕(화면에서는 얇은 띠 + 재위 연수만)
        if (laneKings.all && !mine.length && !keys.length && !card) out.quiet = 1;
        if (keys.length) out.keys = keys;
        if (card) out.card = card;
        kings.push(out);
      }
      for (const [id] of m.cards) if (!kings.some(k => k.id === id)) fail(`${file} laneKings cards: ${cid} ${id} 왕이 화면에 나오지 않음(사건·키워드 없음)`);
      outLK[cid] = { kings, ...(laneKings.all ? { all: 1, px: laneKings.px } : {}), ...(laneKings.looseNote[cid] ? { looseNote: laneKings.looseNote[cid] } : {}) };
      if (laneKings.all) {
        // 같은 나라 안에서 재위가 겹치거나 빈 해가 있으면 알린다(연표 자료 확인용)
        const ks = [...kings].sort((a, b) => a.s - b.s);
        for (let i = 1; i < ks.length; i++) if (ks[i].s > ks[i - 1].e + 1) warn.push(`${file}: ${cid} ${ks[i - 1].name}(~${ks[i - 1].e})와 ${ks[i].name}(${ks[i].s}~) 사이에 빈 해가 있음`);
      }
    }
    era.laneKings = outLK;
  }
  if (compare) {
    // 줄 머리·띠에는 사건이 하나까지(그 줄·구간을 대표하는 사건)
    const heads = new Map();
    for (const ev of events) {
      if (ev.cc !== undefined) continue;
      if (heads.has(ev.cr)) fail(`${file}: 줄·구간 ${ev.cr}의 머리 사건이 둘 이상(${heads.get(ev.cr)}, ${ev.t})`);
      heads.set(ev.cr, ev.t);
    }
    era.compare = compare;
  }
  if (kingLanes) {
    // 왕 칸 키워드에서 그 왕 줄의 사건과 겹치는 것은 뺀다(괄호 속 설명은 빼고 비교: "대동법(경기)" ↔ "대동법 시행 (경기)")
    const norm = s => String(s).replace(/\([^)]*\)/g, '').replace(/[『』「」()·\s,.]/g, '');
    if (kingLanes.periods) {
      // 시기 연표 키워드: 그 시기 왕의 acts 중 연도(또는 from)가 시기 안인 것 + 시기에 직접 쓴 keys.
      // acts는 첫 낱말이 그 시기 사건 이름에 있으면 뺀다("비변사 혁파" ↔ "비변사 폐지"). 월을 모르는 acts는 6월로 본다
      const kingdom = kingsData.kingdoms.find(k => k.id === src.kingLanes.kingdom);
      const first = s => norm(String(s).split(/[\s·]/)[0]);
      const kText = k => (typeof k === 'string' ? [k] : k && typeof k === 'object' ? Object.values(k) : []);
      const ps = kingLanes.periods;
      ps.forEach((p, idx) => {
        const evs = events.filter(ev => ev.ri === idx);
        // 끝이 열린 마지막 시기: 눈금 자는 그 시기 마지막 사건 다음 해까지(사건이 없으면 1년)
        // (화면은 open이면 기간 길이를 쓰지 않는다)
        if (p.open) p.e = Math.max(p.s + 1, ...evs.map(ev => (ev.e || ev.y) + 1));
        else delete p.open;
        const until = ps[idx + 1]?.startKey ?? Infinity;
        const titles = evs.flatMap(ev => [ev.t, ...kText(ev.k)]).filter(Boolean).map(norm);
        const raw = p.king !== null ? kingdom?.kings.find(k => k.n === p.king) : null;
        if (p.king !== null && !raw) { fail(`${file} kingLanes 시기 ${p.title}: kings-data.js에 ${p.king}대 왕 없음`); return; }
        const acts = (raw?.acts || []).filter(a => {
          const y = a.y ?? a.from;
          if (!Number.isInteger(y)) return false;
          if (ps.some(q => q.start[0] === y && q.start[1] > 1)) warn.push(`${file}: 업적 "${a.name}"(${y})은 시기가 바뀌는 해라 6월로 보고 넣음`);
          const key = y * 100 + 6;
          return key >= p.startKey && key < until;
        }).map(a => a.short || a.name).filter(x => !titles.some(t => t.includes(first(x))));
        const keys = [...new Set([...acts, ...p.keys])];
        if (raw) p.kingName = raw.name;
        p.keys = keys;
      });
      // 키워드 누락 검사: keyRefs 나라의 연표 자료 keys가 이 시대 어딘가(시기 keys·who·왕 표시·사건 이름·흐름 줄 이름)에 있는지.
      // 첫 낱말로 비교한다("주석 중심제(김구)" → "주석")
      if (src.kingLanes.keyRefs) {
        const hay = norm([...ps.flatMap(p => [...p.keys, p.who || '', p.kingNote || '']), ...events.flatMap(ev => [ev.t, ...kText(ev.k)])].join('|'));
        for (const id of src.kingLanes.keyRefs) {
          for (const ruler of kingsData.kingdoms.find(k => k.id === id).kings) {
            for (const key of ruler.keys || []) {
              const f = first(String(key).replace(/\([^)]*\)/g, ''));
              if (f && !hay.includes(f)) warn.push(`${file}: 연표 자료 키워드가 빠짐 — ${ruler.name} "${key}"`);
            }
          }
        }
      }
      // 화면에는 눈금 자용 s·e만 넘긴다
      for (const p of ps) { delete p.startKey; delete p.start; }
      for (const k of kingLanes.kings) delete k.keys;
    } else kingLanes.kings.forEach((k, idx) => {
      if (!k.keys) return;
      const titles = events.filter(ev => ev.ki === idx).flatMap(ev => [ev.t, typeof ev.k === 'string' ? ev.k : null]).filter(Boolean).map(norm);
      const keys = k.keys.filter(x => { const c = norm(x); return c && !titles.some(t => t.includes(c) || c.includes(t)); });
      if (keys.length) k.keys = keys; else delete k.keys;
    });
    era.kingLanes = kingLanes;
  }
  return era;
}).filter(Boolean);

for (const tag of tagNames) if (!usedTags.has(tag)) warn.push(`쓰이지 않은 태그: ${tag}`);
for (const [name] of themeId) if (!usedThemes.has(name)) warn.push(`압축 정리에서 연결하지 않은 이론 주제: ${name}`);

if (errors.length) {
  console.error(`빌드 실패 (${errors.length}건)\n- ` + errors.join('\n- '));
  process.exit(1);
}

const data = { fields, countries, tags: tags.map(t => ({ ...t, count: usedTags.get(t.name) || 0 })), eras };
const body = `// 자동 생성: node site/tools/build_compact.mjs (직접 고치지 마세요. 원고는 content/compact/*.json)\nwindow.COMPACT = ${JSON.stringify(data)};\n`;
fs.writeFileSync(path.join(root, 'dist/compact-data.js'), body);

const total = eras.reduce((s, e) => s + e.events.length, 0);
const core = eras.reduce((s, e) => s + e.events.filter(ev => ev.core).length, 0);
console.log(`dist/compact-data.js: ${eras.length}개 시대 · 사건 ${total}개(핵심 ${core}) · 태그 ${tags.length}개 · 이론 연결 ${usedThemes.size}/${themeId.size}`);
for (const era of eras) console.log(`  ${era.name}: ${era.events.length}`);
if (warn.length) console.log(`참고 (${warn.length}건)\n- ` + warn.join('\n- '));
// 왕(또는 시기)이 바뀐 해의 사건은 어느 줄에 들어갔는지 확인할 수 있게 모두 보여 준다
if (boundaryReview.length) console.log(`왕·시기가 바뀐 해의 사건 (${boundaryReview.length}건, 역사 기록과 맞는지 확인)\n- ` + boundaryReview.join('\n- '));
