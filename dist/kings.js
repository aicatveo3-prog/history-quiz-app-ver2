"use strict";
// 한국사 연표 페이지(kings.html): window.KINGS(kings-data.js)를 한 장의 연표로 그린다.
// 삼국~대한제국은 왕, 1910년부터는 같은 줄에 통치 방식·미군정·정부(대통령)를 잇는다.
// 같은 연도 눈금 위에 나라를 나란히 놓고, 재위 기간만큼 띠를 그린다. 줄은 처음부터 끝까지 4개로 폭이 같다.
// 재위가 짧은 왕도 띠 안에 이름이 들어가도록 띠마다 최소 높이를 보장하고, 모자란 만큼 그 구간의 눈금을 넓힌다.
(() => {
  const data = window.KINGS;
  const app = document.getElementById('kings-app');
  if (!app) return;
  if (!data) { app.innerHTML = '<p class="kt-empty">한국사 연표 자료를 불러오지 못했습니다.</p>'; return; }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 기원전 1년 바로 다음 해가 기원후 1년이므로(0년 없음) 계산용 연도로 바꾼다.
  const ax = y => (y < 0 ? y + 1 : y);
  const reignYears = (s, e) => ax(e) - ax(s);
  const yearLabel = y => (y < 0 ? `기원전 ${-y}` : String(y));
  // 눈금 글자: 기원전은 "BC"를 따로 감싸 둔다(좁은 화면에서는 CSS가 "BC"를 숫자 위에 작게 올려 연도 칸을 좁힌다)
  const bigYear = n => (n >= 10000 ? `${n / 10000}만` : String(n)); // 선사 시대 눈금: 70만, 1만
  const tickLabel = y => (y < 0 ? `<span class="kt-bc">BC </span>${bigYear(-y)}` : String(y));
  const shortYear = y => (y < 0 ? `BC ${-y}` : String(y));
  const lengthLabel = (s, e) => (reignYears(s, e) === 0 ? '1년 미만' : `${reignYears(s, e)}년`);
  // when·dur: 선사 시대처럼 연도가 대략인 띠가 읽을 기간·햇수 글자(없으면 연도에서 계산)
  const range = r => r.when || `${yearLabel(r.s)} ~ ${yearLabel(r.e)}`;
  const lenOf = r => (r.dur !== undefined ? r.dur : lengthLabel(r.s, r.e));
  // 몇 대인지(gen이 false면 대수 미상이라 표시하지 않고, 문자열이면 그대로 쓴다)
  const genOf = r => (r.gen === false ? '' : typeof r.gen === 'string' ? r.gen : `${r.n}대`);

  const kingdoms = new Map(data.kingdoms.map(k => [k.id, k]));
  const reigns = [];
  data.kingdoms.forEach(k => k.kings.forEach((r, i) => reigns.push({ ...r, id: `${k.id}-${i}`, kingdom: k })));
  const reignById = new Map(reigns.map(r => [r.id, r]));
  // 왕 수: 1910년 이후의 통치 방식·정부·임시 정부 띠(kind)는 세지 않는다.
  const kingCount = reigns.filter(r => !r.r && !r.bare && !r.unknown && !r.kingdom.kind).length;

  const chart = data.chart;
  const chartStart = ax(chart.start);
  const chartEnd = ax(chart.end);
  const MIN_H = 24; // 띠 하나가 가질 수 있는 가장 낮은 높이(px): 이름 한 줄이 들어간다
  // 업적 칸이 있는 왕은 내용물(이름·연도·업적 칸 전부)의 높이가 그 띠의 최소 높이다.
  // 축소하다가 띠가 이 높이에 닿으면 그 왕만 더 줄지 않고, 모자란 만큼 그 구간의 눈금을 넓힌다.
  // 내용물 높이는 배율과 상관없고 줄 폭에만 달라지므로, 줄 폭이 바뀔 때(창 크기·글꼴)만 다시 잰다.
  const needH = new Map();
  let needKey = '';
  // 띠 안의 내용물 묶음: 업적 칸이 있으면 띠 전체가 한 묶음(id = 띠 id), 재위 단계(stages)가 있으면 단계마다 한 묶음(id = 띠 id~순서).
  // s~e: 그 묶음이 차지하는 해(계산용 연도). 단계는 다음 단계가 시작하는 해까지.
  // 띠 옆에 업적을 적는 좁힌 띠(넓은 화면)는 칸이 없어도 이름·햇수가 줄바꿈되면 그만큼이 최소 높이다(띠 전체가 한 묶음).
  const blocksOf = r => (r.stages
    ? r.stages.map((st, i) => ({ id: `${r.id}~${i}`, s: ax(st.s), e: i + 1 < r.stages.length ? ax(r.stages[i + 1].s) : ax(r.e) }))
    : keysOf(r) || besideOf(r) ? [{ id: r.id, s: ax(r.s), e: ax(r.e) }] : []);

  // ---- 왕이 한 일(acts) ----
  // 화면이 충분히 넓으면(1140px 이상: 줄 폭이 거의 다 펴진 때) acts가 있는 나라의 띠를 좁히고, 띠 바로 옆에 그 해 높이로 적는다.
  // 그보다 좁으면 띠 옆 글자 자리가 90px 안팎이라 이름이 잘리므로, 지금까지처럼 띠 안 칸(keys)으로 적는다.
  // 연도 없는 일은 즉위한 해(또는 from) 높이에 두고 연도 자리에 회색으로 재위 기간을 적는다.
  const ACTS_QUERY = '(min-width: 1140px)';
  const actsBeside = () => matchMedia(ACTS_QUERY).matches;
  // 나라 단위로 띠를 좁혀서 같은 나라 안에서 띠 폭이 들쭉날쭉하지 않게. wide: 1인 나라(신라)는 넓은 화면에서도 띠를 넓게 두고 업적을 띠 안 칸에 적는다.
  const narrowKingdom = k => !k.wide && k.kings.some(r => r.acts);
  const besideOf = r => actsBeside() && narrowKingdom(r.kingdom); // 이 왕의 업적을 띠 옆에 적는가
  const actAnchor = (a, r) => a.y ?? a.from ?? r.s; // 이 일을 놓을 높이(표시용 연도)
  // 띠 안 칸에 적을 이름들. 재위 단계가 있는 띠는 단계별로 따로 적으므로 여기서는 비운다.
  // acts가 있는 띠는 업적 박스(제목 + 설명 d)를 자료 순서대로 세로로 쌓는다. keys는 제목만 있는 박스.
  function keysOf(r) {
    if (r.stages) return r.keys || null; // 재위 단계가 있는 띠는 단계마다 따로(stagesHtml)
    const list = r.keys || (!r.acts || besideOf(r) ? null : r.acts);
    return withEvents(list, r);
  }
  // 재위 단계 i에 든 일(좁은 화면의 단계 칸): 그 단계가 시작한 해부터 다음 단계 전까지
  function stageKeys(r, i) {
    if (!r.acts || besideOf(r)) return null;
    const s = r.stages[i].s, e = i + 1 < r.stages.length ? r.stages[i + 1].s : Infinity;
    const list = r.acts.filter(a => actAnchor(a, r) >= s && actAnchor(a, r) < e);
    return list.length ? list : null;
  }
  // 화면 낭독기용 문장: "527년 불교 공인(이차돈), 532년 금관가야 병합, 순수비"(설명이 있으면 "이름: 설명")
  const actsText = r => r.acts.map(a => `${a.y ? `${yearLabel(a.y)}년${a.e ? `~${yearLabel(a.e)}년` : ''} ` : ''}${a.name}${a.d ? `: ${a.d}` : ''}`).join(', ');
  // 업적 박스 하나: 첫 줄 = 연도(있으면) + 제목, 둘째 줄 = 짧은 설명(d, 있으면). 문자열(keys)은 제목만.
  // when: 연도 글자(띠 옆은 연도 없는 일에 회색 재위 기간, 띠 안은 연도 없는 일에 연도를 쓰지 않음)
  function boxHtml(item, when = '') {
    if (typeof item === 'string') return `<span class="kt-abox"><span class="kt-abox-t">${esc(item)}</span></span>`;
    const cls = ['kt-abox', item.hot ? 'is-hot' : '', item.y ? '' : 'is-undated', item.ev ? 'is-ev' : ''].filter(Boolean).join(' ');
    // 사건 박스: 분야 색(--ec)을 왼쪽 선·연도에 쓰고, 줄임 이름이 있으면 좁은 화면에서 그것을 쓴다
    const name = item.short ? `<span class="kt-wide-only">${esc(item.name)}</span><span class="kt-narrow-only">${esc(item.short)}</span>` : esc(item.name);
    return `<span class="${cls}"${item.ev ? ` style="--ec:${EVENT_TYPES[item.ev].color}"` : ''}><span class="kt-abox-t">${when ? `<b>${when}</b>` : ''}${name}</span>${item.d ? `<span class="kt-abox-d">${esc(item.d)}</span>` : ''}${item.x ? boxMoreHtml(item.x) : ''}</span>`;
  }
  // 박스 상세(x): '풀이 문장|혼동 주의: …|순서: …' (표 항목과 같은 형식). "자세히 보기"가 켜졌을 때만 보인다(CSS .kt-detail .kt-abox-more).
  const boxMoreHtml = x => `<span class="kt-abox-more">${x.split('|').filter(Boolean).map(tblDetail).join('')}</span>`;
  const boxesHtml = list => list.map(it => boxHtml(it, typeof it === 'object' && it.y ? spanShort(it.y, it.e) : '')).join('');
  // 띠 옆 줄마다의 묶음(같은 높이의 일을 한 묶음으로). 눈금 계산(layout)과 그리기(actsHtml)가 같이 쓴다.
  //   묶음 안 순서: 연도 있는 일(자료 순서) → 연도 없는 일. items: { a: 일, r: 그 왕 띠 }
  let actLaneCache = null;
  function actLanes() {
    if (!actsBeside()) return [];
    if (actLaneCache) return actLaneCache;
    actLaneCache = chart.lanes.map((lane, li) => {
      const byYear = new Map();
      reigns.filter(r => lane.kingdoms.includes(r.kingdom.id) && narrowKingdom(r.kingdom)).forEach(r => (r.acts || []).forEach(a => {
        const y = actAnchor(a, r);
        // key: 이 묶음(업적 박스들)의 실제 높이를 재어 두는 이름(measureNeeds → layout)
        if (!byYear.has(y)) byYear.set(y, { y, items: [], key: `act:${li}:${y}` });
        byYear.get(y).items.push({ a, r });
      }));
      const groups = [...byYear.values()].sort((p, q) => p.y - q.y);
      groups.forEach(g => g.items.sort((p, q) => Number(!p.a.y) - Number(!q.a.y)));
      return groups;
    });
    return actLaneCache;
  }

  // 눈금 간격(배율)은 Ctrl + 마우스 휠(노트북 터치패드는 두 손가락 벌리기)로 자유롭게 바꾼다. 1 = 기본.
  const ZOOM_MIN = 0.25, ZOOM_MAX = 4;
  const clampZoom = v => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v * 1000) / 1000));
  const STORE_KEY = 'korean-history-kings-zoom-v3';
  // 모바일 화면 미리보기(?frame=1, PC에서 폰 폭 틀 안에 띄운 페이지): 폰에서 처음 여는 것처럼 기본 배율로 보고, 배율을 저장하지 않는다
  const FRAME = new URLSearchParams(location.search).has('frame');
  if (FRAME) document.documentElement.classList.add('kt-in-frame');
  const readZoom = () => { if (FRAME) return 0; try { return Number(localStorage.getItem(STORE_KEY)); } catch { return 0; } };
  const saveZoom = v => { if (FRAME) return; try { localStorage.setItem(STORE_KEY, String(v)); } catch { /* 저장이 막힌 환경은 무시 */ } };
  let zoom = readZoom() > 0 ? clampZoom(readZoom()) : 1;
  // 자세히 보기: 표 항목 아래에 상세 설명 칸을 보인다. 버튼으로 직접 켜고 끄면 그 선택이 우선이고(저장함),
  // 고르지 않았으면 넓은 화면에서 배율이 DETAIL_ZOOM 이상일 때 자동으로 켜진다. 배율이 그 선을 넘나들면 직접 고른 선택은 풀린다.
  const DETAIL_ZOOM = 1.5, DETAIL_KEY = 'korean-history-kings-detail-v1';
  const readDetail = () => { if (FRAME) return null; try { const v = localStorage.getItem(DETAIL_KEY); return v === 'on' ? true : v === 'off' ? false : null; } catch { return null; } };
  const saveDetail = v => { if (FRAME) return; try { if (v === null) localStorage.removeItem(DETAIL_KEY); else localStorage.setItem(DETAIL_KEY, v ? 'on' : 'off'); } catch { /* 저장이 막힌 환경은 무시 */ } };
  let detailPref = readDetail(), detailShown = null;
  const narrowMq = matchMedia('(max-width:600px)');
  const smallMq = matchMedia('(max-width:999px)'); // 박스 상세를 띠 안에 넣을 수 없는 폭(줄 폭 80~220px)
  const autoDetail = () => !narrowMq.matches && zoom >= DETAIL_ZOOM;
  const detailOn = () => detailPref ?? autoDetail();
  // 화면의 자세히 상태(루트 클래스·버튼)를 맞추고, 지난번과 달라졌으면 true(표 높이를 다시 재야 함)
  function syncDetail() {
    const on = detailOn();
    document.documentElement.classList.toggle('kt-detail', on);
    document.getElementById('kt-detail')?.setAttribute('aria-pressed', String(on));
    const changed = detailShown !== null && detailShown !== on;
    detailShown = on;
    return changed;
  }
  // 기출 해설에 거의 나오지 않은 왕은 항상 흐리게 표시한다. 기준: dist/kings-weight.js (node site/tools/count_kings.mjs 로 생성)
  const WEIGHT = window.KINGS_WEIGHT || {};
  const weightOf = r => WEIGHT[`${r.kingdom.id}:${r.n}`];
  const isMinor = r => {
    const w = weightOf(r);
    return !r.core && !r.bare && Array.isArray(w) && !(w[0] >= 1 || w[1] >= 5);
  };
  let headKey = '';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 눈금 계산: 연도 ↔ 세로 위치 ----
  // 왕이 바뀌는 해마다 구간을 끊고, 구간 높이 = 햇수 × 1년의 길이. 띠가 최소 높이보다 낮으면 그 띠가 지나는 구간을 늘린다.
  // 즉위한 해에 물러난 왕(1년 미만)은 햇수가 0이라서 자기 자리(최소 높이)를 따로 가진다.
  let segs = [], tops = [], total = 0;
  const box = new Map();
  const byFrom = new Map(), byTo = new Map(), pointAt = new Map();

  function layout() {
    const scales = chart.scales.map(s => ({ from: ax(s.from), px: s.px * zoom }));
    const pxAt = y => { let px = scales[0].px; scales.forEach(s => { if (s.from <= y) px = s.px; }); return px; };
    const cuts = new Set([chartStart, chartEnd, ...scales.map(s => s.from)]);
    // 시기 구분 경계(시기 색이 바뀌는 해)도 구간을 끊는다. 업적 칸은 띠 안에서 첫 경계보다 위에 다 들어가야 한다.
    // 좁은 화면은 세부 시기가 시작하는 해에도 이름표가 있으므로 그 해도 경계로 본다.
    const narrow = narrowOn();
    const edges = narrow ? lineEdges() : periodEdges();
    edges.forEach(y => cuts.add(y));
    // 띠 옆에 적는 왕의 일(acts)이 있는 해도 구간을 끊고, 다음 일까지 박스가 겹치지 않을 만큼 높이를 보장한다(넓은 화면에서만).
    const evLanes = actLanes();
    evLanes.forEach(groups => groups.forEach(g => cuts.add(ax(g.y))));
    const points = new Set();
    reigns.forEach(r => {
      cuts.add(ax(r.s)); cuts.add(ax(r.e));
      if (ax(r.s) === ax(r.e)) points.add(ax(r.s));
      (r.stages || []).forEach(st => cuts.add(ax(st.s))); // 재위 단계가 바뀌는 해
    });
    TABLES.forEach(t => { cuts.add(ax(t.from)); cuts.add(ax(t.to)); });
    const years = [...cuts].sort((a, b) => a - b);

    segs = [];
    years.forEach((y, i) => {
      if (points.has(y)) segs.push({ from: y, to: y, len: 0, h: MIN_H, point: true });
      if (i < years.length - 1) segs.push({ from: y, to: years[i + 1], len: years[i + 1] - y, h: (years[i + 1] - y) * pxAt(y), point: false });
    });
    byFrom.clear(); byTo.clear(); pointAt.clear();
    segs.forEach((s, i) => { if (s.point) pointAt.set(s.from, i); else { byFrom.set(s.from, i); byTo.set(s.to, i); } });

    const span = r => (ax(r.s) === ax(r.e)
      ? [pointAt.get(ax(r.s)), pointAt.get(ax(r.s))]
      : [byFrom.get(ax(r.s)), byTo.get(ax(r.e))]);
    // a~b 구간 높이가 min보다 낮으면 모자란 만큼 구간마다 햇수에 비례해 늘린다. 늘렸으면 true.
    const grow = (a, b, min) => {
      let sum = 0, len = 0;
      for (let i = a; i <= b; i++) { sum += segs[i].h; len += segs[i].len; }
      if (sum >= min - 0.01 || !len) return false;
      const add = min - sum;
      for (let i = a; i <= b; i++) if (!segs[i].point) segs[i].h += add * segs[i].len / len;
      return true;
    };
    for (let pass = 0; pass < 80; pass++) {
      let changed = false;
      for (const r of reigns) {
        if (ax(r.s) === ax(r.e)) continue;
        const [a, b] = span(r);
        const inPeriodLane = narrow && PERIOD_KINGDOMS.has(r.kingdom.id);
        // 좁은 화면: 시기가 시작하는 해에 시작하는 띠는 이름표 높이만큼 더 높아야 이름이 다 보인다
        if (grow(a, b, MIN_H + (inPeriodLane ? tagUnder(r.kingdom.id, ax(r.s)) : 0))) changed = true;
        // 좁은 화면: 업적 칸이 없는 띠도 이름·햇수가 다음 시기선(이름표) 위쪽에 다 들어가야 한다
        if (inPeriodLane && !needH.has(r.id) && !needH.has(`${r.id}~0`)) {
          const edge = edges.find(y => y > ax(r.s) && y < ax(r.e));
          if (edge !== undefined && grow(a, byTo.get(edge), LABEL_H + tagUnder(r.kingdom.id, ax(r.s)))) changed = true;
        }
        // 내용물 묶음(업적 칸 전체, 또는 재위 단계 하나)마다 그 묶음이 시작한 해부터 다음 경계까지 다 들어가야 한다.
        // 경계 = 다음 단계가 시작하는 해 또는 재위 중간에 시기가 바뀌는 해(예: 박정희 1972, 공민왕 1356) 중 먼저 오는 것.
        // 그러지 않으면 다음 단계의 이름표나 시기 테두리·색이 칸을 가로지른다.
        for (const blk of blocksOf(r)) {
          const need = needH.get(blk.id);
          if (!need) continue;
          let end = blk.e;
          if (PERIOD_KINGDOMS.has(r.kingdom.id)) {
            const edge = edges.find(y => y > blk.s && y < end);
            if (edge !== undefined) end = edge;
          }
          if (grow(byFrom.get(blk.s), byTo.get(end), need)) changed = true;
        }
      }
      // 표(선사 시대·초기 국가): 표가 다 들어가는 높이만큼 그 구간을 늘린다(표 높이는 measureNeeds가 잰다)
      for (const t of TABLES) {
        const need = needH.get(`tbl:${t.id}`);
        if (need && grow(byFrom.get(ax(t.from)), byTo.get(ax(t.to)), need)) changed = true;
      }
      // 좁은 화면: 재위 중간에 시작하는 시기 이름표(최씨 정권 1196 → 신종 1197 즉위)는 다음 띠·단계 글자가 시작하기 전에 끝나야 한다
      if (narrow) {
        tagHAt().forEach((h, y) => {
          const next = textStarts().find(s => s > y);
          if (next === undefined) return;
          const a = byFrom.get(y), b = byTo.get(next);
          if (a !== undefined && b !== undefined && b >= a && grow(a, b, h)) changed = true;
        });
      }
      // 띠 옆 왕의 일: 첫 줄 가운데가 점(그 해 눈금)에 오고 아래로 줄이 쌓인다. 같은 줄의 다음 점까지
      // "박스 줄 수 × 한 줄 + 간격"만큼은 벌어져야 겹치지 않는다. 마지막 묶음은 연표 끝 안에 다 들어가야 한다.
      // 해의 눈금 위치(yAt) = 그 해에 시작하는 구간의 맨 위이므로, 다음 해에 시작하는 구간 바로 앞까지 잰다.
      for (const groups of evLanes) {
        groups.forEach((g, i) => {
          const a = byFrom.get(ax(g.y));
          if (a === undefined) return;
          const next = groups[i + 1];
          const b = next ? byFrom.get(ax(next.y)) - 1 : segs.length - 1;
          // 띠 옆 업적 박스는 설명 줄 수에 따라 높이가 달라서, 잰 높이(needH)가 있으면 그것을 쓴다(첫 박스 첫 줄 가운데가 그 해 높이)
          const measured = g.key && needH.get(g.key);
          const need = measured
            ? (next ? measured - BOX_HEAD + EV_GAP + 2 : measured - BOX_HEAD)
            : (next ? g.items.length * EV_LINE + EV_GAP : g.items.length * EV_LINE - EV_LINE / 2);
          if (b >= a && grow(a, b, need)) changed = true;
        });
      }
      if (!changed) break;
    }

    tops = [];
    let acc = 0;
    segs.forEach(s => { tops.push(acc); acc += s.h; });
    total = acc;
    box.clear();
    reigns.forEach(r => {
      const [a, b] = span(r);
      box.set(r.id, { top: tops[a], h: tops[b] + segs[b].h - tops[a] });
    });
  }
  const yAt = year => {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.point && year >= s.from && year < s.to) return tops[i] + (year - s.from) / s.len * s.h;
    }
    return total;
  };
  const yearAtPx = p => {
    if (p <= 0) return chartStart;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (p < tops[i] + s.h) return s.point ? s.from : s.from + (p - tops[i]) / s.h * s.len;
    }
    return chartEnd;
  };
  const yStartOf = year => tops[byFrom.get(year)];
  const yEndOf = year => tops[byTo.get(year)] + segs[byTo.get(year)].h;
  const pxHere = year => { let px = chart.scales[0].px; chart.scales.forEach(s => { if (ax(s.from) <= year) px = s.px; }); return px * zoom; };

  // 왕과 재위 연도가 전해지지 않는 구간: 빗금 칸으로 비워 둔다.
  function gapHtml(r) {
    const k = r.kingdom;
    const { top, h } = box.get(r.id);
    const repeats = Array.from({ length: Math.floor(h / 320) }, (_, i) => `<span class="kt-repeat" style="top:${130 + i * 320}px">미상</span>`).join('');
    return `<div class="kt-gap" style="top:${top}px;height:${h}px;--c:${k.color}" role="note" aria-label="${esc(`${k.name} 미상: ${r.sub}`)}">${repeats}<span class="kt-gap-name">미상</span><span class="kt-gap-note">${esc(r.sub)}</span></div>`;
  }

  // ---- 시기 구분(고려·조선): 이름표와 그 시기 왕 띠를 같은 색 테두리로 묶는다 ----
  const PERIODS = data.periods || [];
  const PERIOD_KINGDOMS = new Set(['goryeo', 'joseon', 'colonial', 'usamg', 'korea']); // 시기 색으로 물드는 줄(1·2번째 줄을 묶는 시기)
  // 큰 시기의 시작·끝 해(계산용 연도, 작은 것부터). 세부 시기(in)는 이름표 칸 안에만 그려서 띠를 가로지르지 않는다.
  let edgesCache = null;
  const periodEdges = () => edgesCache || (edgesCache = [...new Set(PERIODS.filter(p => !p.in).flatMap(p => [ax(p.s), ax(p.e)]))]
    .filter(y => y > chartStart && y < chartEnd).sort((a, b) => a - b));
  let periodPx = []; // 현재 눈금 기준 위치(px). renderChart에서 다시 잰다.
  const mainPeriods = () => periodPx.filter(p => !p.in);

  // 좁은 화면(600px 이하)의 시기 이름표: 시기가 시작하는 해 가로선 바로 아래, 띠 칸 폭의 띠 모양 이름표.
  // 이름표 밑 글자가 겹치지 않도록 (1) 그 해에 시작하는 띠·재위 단계는 이름표 높이만큼 글자를 내리고(CSS kt-pstart),
  // (2) 눈금 계산이 그만큼 높이를 더 주며, (3) 시기선을 가로지르는 띠는 이름·업적이 선 위쪽에 다 들어가게 한다.
  const NARROW_QUERY = '(max-width: 600px)';
  const narrowOn = () => matchMedia(NARROW_QUERY).matches;
  const PL_TAG_H = { main: 26, sub: 20 }; // CSS .kt-pl-tag 높이(px)와 같아야 한다
  const LABEL_H = 36; // 시기선 위에 들어가야 하는 띠 글자(이름 + 햇수) 높이(px)
  // 시작하는 해(계산용 연도) → 이름표 높이. 큰 시기와 세부 시기가 같은 해에 시작하면 큰 시기 높이
  let tagHCache = null;
  const tagHAt = () => tagHCache || (tagHCache = PERIODS.reduce((m, p) => {
    const y = ax(p.s);
    if (y > chartStart && y < chartEnd) m.set(y, Math.max(m.get(y) || 0, p.in ? PL_TAG_H.sub : PL_TAG_H.main));
    return m;
  }, new Map()));
  // 좁은 화면에서 띠 글자가 넘지 말아야 하는 해: 큰 시기 경계 + 세부 시기 시작(작은 것부터)
  let lineEdgesCache = null;
  const lineEdges = () => lineEdgesCache || (lineEdgesCache = [...new Set([...periodEdges(), ...tagHAt().keys()])].sort((a, b) => a - b));
  // 이 띠·단계가 시기 이름표 바로 밑에서 시작하면 이름표 높이(px), 아니면 0.
  // 1년 미만 띠(허정 과도 정부 등)는 그 해 눈금선 위쪽 자기 자리에 있어서 이름표 밑이 아니다(isPoint)
  const tagUnder = (kingdomId, year, isPoint = false) => (!isPoint && PERIOD_KINGDOMS.has(kingdomId) ? tagHAt().get(year) || 0 : 0);
  const pstartClass = (kingdomId, year, isPoint = false) => {
    const h = tagUnder(kingdomId, year, isPoint);
    return h ? (h === PL_TAG_H.main ? ' kt-pstart' : ' kt-pstart-sub') : '';
  };
  // 시기 줄 나라에서 글자가 시작하는 해(띠 즉위·재위 단계): 시기 이름표가 다음 글자 시작 전에 끝나야 한다
  let textStartsCache = null;
  const textStarts = () => textStartsCache || (textStartsCache = [...new Set(reigns
    .filter(r => PERIOD_KINGDOMS.has(r.kingdom.id))
    .flatMap(r => [ax(r.s), ...(r.stages || []).slice(1).map(st => ax(st.s))]))].sort((a, b) => a - b));

  // 왕 띠 바탕: 시기에 걸친 부분만 시기 색으로 칠한다. 재위 중간에 시기가 바뀌면 그 지점에서 색이 바뀐다.
  // light: 자세히로 넓어진 띠(박스가 가득 찬 넓은 면)는 바탕을 한 단계 연하게 칠한다
  function periodTint(r, top, h, light = false) {
    if (!PERIOD_KINGDOMS.has(r.kingdom.id)) return '';
    const soft = c => (light ? `color-mix(in srgb,${c} 42%,#fff)` : c);
    const bot = top + h;
    const hits = mainPeriods().filter(p => p.top < bot - 0.5 && p.bot > top + 0.5);
    if (!hits.length) return '';
    const minor = isMinor(r);
    const tint = p => soft(minor ? `color-mix(in srgb,${p.tint} 45%,#f3f4f2)` : p.tint);
    const base = soft(minor ? '#f1f3f1' : 'var(--t)');
    const stops = [];
    let cur = 0;
    hits.forEach(p => {
      const a = Math.max(0, p.top - top), z = Math.min(h, p.bot - top);
      if (a > cur) stops.push(`${base} ${cur}px ${a}px`);
      stops.push(`${tint(p)} ${a}px ${z}px`);
      cur = z;
    });
    if (cur < h) stops.push(`${base} ${cur}px ${h}px`);
    // 즉위한 해가 시기 안에 있으면 즉위선도 시기 색으로
    const head = hits.find(p => p.top <= top + 0.5);
    return `;background:linear-gradient(to bottom,${stops.join(',')})${head ? `;--c:${head.color}` : ''}`;
  }

  // 좁은 화면(600px 이하)의 시기 구분: 시기 상자 대신 시기가 시작하는 해에 색 가로선 + 그 밑 띠 칸 폭의 이름표.
  // 세부 시기는 띠 칸 안 점선, 시기가 끝나고 다음 시기가 바로 이어지지 않으면 끝나는 해에 옅은 점선.
  // 넓은 화면은 시기 상자(periodsHtml)를 쓰고, 어느 쪽을 보일지는 CSS가 정한다.
  function periodLinesHtml() {
    const mains = mainPeriods();
    if (!mains.length) return '';
    const items = [];
    mains.forEach((p, i) => {
      const yrs = p.now ? `${p.s}~` : `${p.s}~${p.e}`;
      items.push(`<div class="kt-pl" style="top:${p.top}px;--pc:${p.color}" role="note" aria-label="${esc(`${p.name}, ${yrs}년: ${p.key}`)}"><span class="kt-pl-tag" aria-hidden="true">${esc(p.name)}<small>${yrs}</small></span></div>`);
      const next = mains[i + 1];
      if (!p.now && (!next || next.top > p.bot + 1)) items.push(`<i class="kt-pl is-end" style="top:${p.bot}px;--pc:${p.color}" aria-hidden="true"></i>`);
    });
    periodPx.filter(q => q.in).forEach(q => {
      const yrs = `${q.s}~${q.e}`;
      items.push(`<div class="kt-pl is-sub" style="top:${q.top}px;--pc:${q.color}" role="note" aria-label="${esc(`세부 시기 ${q.name}, ${yrs}년: ${q.key}`)}"><span class="kt-pl-tag" aria-hidden="true">└ ${esc(q.name)}<small>${yrs}</small></span></div>`);
    });
    return `<div class="kt-plines">${items.join('')}</div>`;
  }

  function periodsHtml() {
    if (!periodPx.length) return '';
    const mains = mainPeriods();
    const items = periodPx.map(p => {
      const st = `--pc:${p.color};--pt:${p.tint || '#fff'}`;
      const yrs = p.now ? `${p.s}~` : `${p.s}~${p.e}`; // now: 지금도 이어지는 시기
      if (p.in) {
        return `<div class="kt-period-sub" style="top:${p.top}px;${st}" role="note" aria-label="${esc(`세부 시기 ${p.name}, ${yrs}년: ${p.key}`)}"><b>└ ${esc(p.name)}</b><span>${yrs}</span></div>`;
      }
      const h = p.bot - p.top;
      // 안쪽 세부 시기 이름표와 겹치지 않을 때만 키워드까지 보여 준다.
      const subs = periodPx.filter(q => q.in && q.s >= p.s && q.s < p.e);
      const room = subs.length ? Math.min(...subs.map(q => q.top - p.top)) : h;
      // 키워드가 "A → B → C"·"A · B · C"·"A, B" 꼴이면 줄을 바꾼다(→는 아래 화살표 ↓, ·와 쉼표는 줄만 띄움). 낱말 안의 ·(5·16 등)는 그대로 둔다.
      // 높이가 모자라면 예전처럼 한 문단으로 이어 쓴다.
      const toks = p.key ? p.key.split(/(\s+→\s+|\s+·\s+|,\s+)/) : [];
      const parts = toks.filter((_, i) => i % 2 === 0);
      const seps = toks.filter((_, i) => i % 2 === 1);
      const arrows = seps.filter(x => x.includes('→')).length;
      const needStack = 60 + parts.length * 22 + arrows * 14 + (seps.length - arrows) * 5;
      const stack = parts.length > 1 && h >= needStack + 8 && room >= needStack;
      const stackHtml = parts.map((t, i) => esc(t) + (i < seps.length ? (seps[i].includes('→') ? '<i aria-hidden="true">↓</i>' : '<i class="kt-plsp" aria-hidden="true"></i>') : '')).join('');
      const size = stack ? 'is-full is-stack' : h >= 70 && room >= 68 ? 'is-full' : h >= 56 && room >= 56 ? 'is-mid' : 'is-tiny';
      const wideX = !smallMq.matches && detailOn() && reigns.some(r => widensFor(r.kingdom) && ax(r.s) < ax(p.e) && ax(r.e) > ax(p.s));
      return `<div class="kt-period ${size}${wideX ? ' is-x' : ''}" style="top:${p.top}px;height:${h}px;${st}" role="note" aria-label="${esc(`${p.name}, ${yrs}년: ${p.key}`)}">
        <div class="kt-period-label"><b>${esc(p.name)}</b><span>${yrs}</span>${size.startsWith('is-full') ? `<em>${stack ? stackHtml : esc(p.key)}</em>` : ''}</div>
      </div>`;
    }).join('');
    return mains.length ? `<div class="kt-periods">${items}</div>` : '';
  }

  // ---- 주요 사건: 그 해에 재위한 왕·정부 띠 안에 업적 박스와 같은 모양으로 넣는다 ----
  // 사건 박스는 왼쪽 선과 연도 글자에 분야 색을 쓰고, 업적 박스 사이에 연도 순서로 끼운다.
  // 박스는 띠 안에서 위에서 아래로 쌓이므로, 눈금 계산(layout)이 내용물 높이만큼 그 띠를 늘려 준다(업적 칸과 같은 방식).
  const EVENTS = data.events || [];
  const EVENT_TYPES = {
    war: { name: '침략·전쟁', color: '#b04e3c' },
    treaty: { name: '조약·외교', color: '#3c6ea3' },
    reform: { name: '정변·개혁', color: '#6b55a3' },
    move: { name: '봉기·운동', color: '#2f8a63' },
    econ: { name: '경제·사회', color: '#a8781c' },
  };
  const EV_LINE = 16; // 업적 박스 한 줄 높이(px). CSS의 line-height와 같아야 한다.
  const BOX_HEAD = 11; // 업적 박스 맨 위 ~ 첫 줄 가운데(px) = CSS .kt-abox 테두리 1 + 위 여백 2 + 한 줄 16의 반
  const EV_GAP = 2; // 업적 박스 묶음 사이 여백(px)

  // 사건이 일어난 해에 재위한 띠(즉위한 해는 새 왕). 재위가 겹치면(복위) 나중에 즉위한 쪽.
  const evsOf = new Map(); // 띠 id → 그 띠 안의 사건(자료 순서)
  EVENTS.forEach(e => {
    const y = ax(e.y);
    const hit = reigns
      .filter(r => PERIOD_KINGDOMS.has(r.kingdom.id) && !r.unknown && !r.bare && ax(r.s) <= y && y < ax(r.e))
      .sort((a, b) => ax(b.s) - ax(a.s))[0];
    if (!hit) return;
    if (!evsOf.has(hit.id)) evsOf.set(hit.id, []);
    evsOf.get(hit.id).push(e);
  });
  // 분야별 열(넓은 화면에서 자세히를 켠 고려 띠): 박스를 분야로 나눠 3열로 놓는다. 열은 박스의 c(pol·cul·ext), 없으면 이론정리 주제(th)나 사건 종류로 정한다.
  const COLS = [
    { id: 'pol', name: '정치·제도·경제', color: '#0d4945' },
    { id: 'cul', name: '사상·문화', color: '#3d63a6' },
    { id: 'ext', name: '대외·전쟁', color: '#b5523f' },
  ];
  const TH_COL = { t22: 'ext', t24: 'cul', t28: 'ext', t30: 'ext', t31: 'cul', t32: 'cul', t33: 'cul' };
  const EV_COL = { war: 'ext', treaty: 'ext' };
  const colOf = it => (typeof it === 'string' ? 'pol' : it.c || (it.ev ? EV_COL[it.ev] : TH_COL[it.th]) || 'pol');
  // 연도 행: 같은 연도의 박스는 같은 행에 놓고(분야별 열), 연도 순서로 아래로 쌓는다. 연도 없는 일은 맨 위 "재위 중 정책" 묶음.
  // 그 열에 박스가 없는 칸은 비워 둔다(그래야 다른 열의 같은 해 일과 가로로 맞는다).
  function colsHtml(list, undatedLabel = '재위 중 정책(연도 미상)') {
    const items = list.map(it => ({ it, c: colOf(it), y: typeof it === 'object' && it.y !== undefined ? it.y : null }));
    const used = new Set(items.map(o => o.c));
    const box = it => boxHtml(it, typeof it === 'object' && it.y ? spanShort(it.y, it.e) : ''); // 박스에도 연도를 적는다(행 왼쪽 칩과 같은 연도)
    const rowOf = (chip, group) => `${chip}${COLS.map(c => `<span class="kt-cell">${group.filter(o => o.c === c.id).map(o => box(o.it)).join('')}</span>`).join('')}`;
    const head = `<span></span>${COLS.map(c => `<span class="kt-col-h" style="--cc:${c.color}">${used.has(c.id) ? c.name : ''}</span>`).join('')}`;
    const undated = items.filter(o => o.y === null);
    const years = [...new Set(items.filter(o => o.y !== null).map(o => o.y))].sort((p, q) => ax(p) - ax(q));
    return head
      + (undated.length ? `<span class="kt-ugroup">${esc(undatedLabel)}</span>${rowOf('<span></span>', undated)}` : '')
      + years.map(y => rowOf(`<span class="kt-yr">${esc(shortYear(y))}</span>`, items.filter(o => o.y === y))).join('');
  }
  const XWIDE_FROM = ax(937); // 신라·후백제가 끝난 뒤(옆 줄이 빈 해)부터 띠를 넓힌다.
  const colsMode = k => !smallMq.matches && detailOn() && widensFor(k);
  // 박스 상세(x)가 하나라도 있는 나라: 좁은 화면에서 자세히를 켜면 그 나라 띠를 모두 넓힌다(띠 폭이 왕마다 들쭉날쭉하지 않게)
  const xKingdoms = new Set();
  reigns.forEach(r => { if ((r.acts || []).some(a => a.x) || (r.keys || []).some(a => a && a.x) || (evsOf.get(r.id) || []).some(e => e.x)) xKingdoms.add(r.kingdom.id); });
  // 띠를 옆 빈 줄까지 넓힐 수 있는 나라. 일제 강점기는 옆 줄(3번째)을 대한민국 임시 정부가 쓰므로 넓히지 않고, 자기 줄 안에서 박스를 아래로 늘려 상세를 보인다.
  const SINGLE_LANE = new Set(['colonial']);
  function widensFor(k) { return PERIOD_KINGDOMS.has(k.id) && xKingdoms.has(k.id) && !SINGLE_LANE.has(k.id); }
  // 업적 박스 목록에 사건 박스를 연도 순으로 끼운다(연도 없는 업적은 제자리). from~to: 이 목록이 맡는 해(재위 단계 하나). 사건이 없으면 list 그대로.
  function withEvents(list, r, from = -Infinity, to = Infinity) {
    const evs = (evsOf.get(r.id) || []).filter(e => ax(e.y) >= from && ax(e.y) < to);
    if (!evs.length) return list;
    const out = [...(list || [])];
    evs.forEach(e => {
      const item = { name: e.name, short: e.short, y: e.y, e: e.e, ev: e.t, x: e.x, c: e.c };
      const at = out.findIndex(it => typeof it === 'object' && it.y !== undefined && ax(it.y) > ax(e.y));
      if (at < 0) out.push(item); else out.splice(at, 0, item);
    });
    return out;
  }

  // 재위 단계: 첫 단계는 이름표 바로 아래에 이어 적고, 다음 단계부터는 그 단계가 시작한 해 높이에 점선과 함께 놓는다.
  // data-blk는 내용물 높이를 잴 때 쓰는 묶음 id(blocksOf와 같음).
  function stagesHtml(r, top, cols = false) {
    return r.stages.map((st, i) => {
      const keys = withEvents(st.keys || stageKeys(r, i), r, ax(st.s), i + 1 < r.stages.length ? ax(r.stages[i + 1].s) : Infinity);
      // 자세히로 띠를 넓힌 경우(cols)에는 단계 안 박스도 분야별 3열·연도 행으로 놓는다(한 줄로 길게 쌓이지 않게)
      const inner = `<span class="kt-stage-title"><b>${esc(yearLabel(st.s))}~</b> ${esc(st.name)}</span>${keys ? `<span class="kt-keys${cols ? ' is-cols' : ''}">${cols ? colsHtml(keys) : boxesHtml(keys)}</span>` : ''}`;
      if (i === 0) return `
      <span class="kt-stage is-first" data-blk="${r.id}~0" aria-hidden="true">${inner}</span>`;
      // 단계가 시작하는 해에 시기도 시작하면(고종 1897 대한제국) 좁은 화면에서 단계 글자를 시기 이름표 밑으로
      return `
      <span class="kt-stage${pstartClass(r.kingdom.id, ax(st.s))}" data-blk="${r.id}~${i}" style="top:${(yAt(ax(st.s)) - top).toFixed(1)}px" aria-hidden="true">${inner}</span>`;
    }).join('');
  }

  // 신라 초기 왕호(거서간·차차웅·이사금·마립간)는 따로 감싸서, 좁힌 띠에 이름이 다 안 들어가면 왕호를 뺀다(탈해 이사금 → 탈해).
  const nameWithTitle = name => {
    const m = /^(.+) (거서간|차차웅|이사금|마립간)$/.exec(name);
    return m ? `${esc(m[1])}<span class="kt-sfx"> ${esc(m[2])}</span>` : esc(name);
  };

  function bandHtml(r, beside = false) {
    const k = r.kingdom;
    const { top, h } = box.get(r.id);
    const instant = ax(r.s) === ax(r.e);
    // 1910년 이후 띠(kind): 왕이 아니므로 "재위" 대신 그 띠에 맞는 말로 읽는다. now는 지금도 이어지는 띠.
    const when = r.now ? `${yearLabel(r.s)}년부터` : instant ? `${yearLabel(r.s)}년` : range(r);
    const what = k.kind === 'rule' ? '정책' : k.kind === 'stage' ? '활동' : k.kind === 'age' || k.kind === 'nation' ? '특징' : '업적';
    const stageText = r.stages ? `. 재위 단계: ${r.stages.map(st => `${yearLabel(st.s)}년부터 ${st.name}${st.keys ? `(${st.keys.join(', ')})` : ''}`).join('; ')}` : '';
    const evText = evsOf.has(r.id) ? `. 주요 사건: ${evsOf.get(r.id).map(e => `${yearLabel(e.y)}년${e.e ? `~${yearLabel(e.e)}년` : ''} ${e.name}(${EVENT_TYPES[e.t].name})`).join(', ')}` : '';
    const keysText = (r.acts ? `${stageText}. 주요 ${what}: ${actsText(r)}`
      : r.keys ? `. 주요 ${what}: ${r.keys.join(', ')}` : stageText) + evText;
    const title = genOf(r) ? ` (${genOf(r)}${k.role ? ` ${k.role}` : ''})` : '';
    const label = r.at
      ? `${k.name} ${genOf(r)} ${r.name}, ${r.at}, 재위 기간은 알 수 없음`
      : k.kind
        ? `${k.kind === 'stage' ? `${k.name} ` : ''}${r.name}${title}${r.alt ? `, ${r.alt}` : ''}, ${when}${r.now ? ', 재임 중' : instant ? '' : `${lenOf(r) ? `(${lenOf(r)})` : ''}`}${keysText}`
        : `${k.name} ${r.n}대 ${r.name}${r.r ? '(복위)' : ''}, ${range(r)} 재위(${lengthLabel(r.s, r.e)})${r.u ? ', 연도 불확실' : ''}${r.l ? ', 전승 연도' : ''}${keysText}`;
    const wideCols = ax(r.s) >= XWIDE_FROM && colsMode(k); // 자세히로 넓어져 박스가 가득 찬 띠
    const style = `--c:${k.color};--ink:${k.ink};--t:${k.tints[r.n % 2]}${periodTint(r, top, h, wideCols)}`;
    const cls = ['kt-band', h >= 40 ? 'size-l' : 'size-m'];
    if (h >= 64) cls.push('size-xl');
    if (instant) cls.push('is-instant');
    if (isMinor(r)) cls.push('is-minor');
    if (beside) cls.push('has-strip');
    if (actsBeside() && narrowKingdom(k)) {
      cls.push('is-narrow'); // 띠 옆에 왕의 일을 적는 나라: 띠를 좁힌다
      if (h >= 34 && h < 40) cls.push('can-wrap'); // 한 줄 띠라도 두 줄 높이가 되면 긴 이름을 줄바꿈
    }
    // 폭 1000px 미만에서 자세히를 켜면, 박스 상세가 있는 나라(고려 이후)의 띠는 빈 옆 줄(고구려·발해·신라·후백제가 없는 해)까지 넓혀서 상세 글이 읽히게 한다.
    // 신라·후백제와 겹치는 936년 이전(태조)은 왼쪽 한 줄만 넓힌다.
    // 신라·후백제·발해와 줄을 같이 쓰는 936년 이전 띠(태조)는 넓히지 않는다(옆 나라 띠를 가리므로). 폭이 좁은 화면에서는 그 띠의 상세가 보이지 않는다.
    const xOk = ax(r.s) >= XWIDE_FROM;
    // 일제 강점기는 임시 정부 줄이 600px 넘는 화면에서 보이므로, 임시 정부가 숨는 600px 이하에서만 넓힌다.
    if (xOk && smallMq.matches && detailOn() && PERIOD_KINGDOMS.has(k.id) && xKingdoms.has(k.id)) {
      if (!SINGLE_LANE.has(k.id) || narrowMq.matches) cls.push('is-xwide');
      else cls.push('is-xshow'); // 601~999px: 넓히지 못하는 띠는 자기 줄 안에서 상세만 보인다
    } else if ((k.pcOnly || !PERIOD_KINGDOMS.has(k.id)) && smallMq.matches && !narrowMq.matches && detailOn() && xKingdoms.has(k.id)) {
      cls.push('is-xshow'); // 옆 줄이 비지 않은 삼국·가야·임시 정부 줄(601~999px)은 자기 줄 안에서 상세를 보인다. 600px 이하는 줄이 80px라 보이지 않는다
    }
    const cols = xOk && colsMode(k); // 넓은 화면: 띠를 옆 빈 줄까지 넓혀 박스를 분야별 3열로 놓는다
    if (cols) cls.push('is-cols', 'is-cright');
    if (r.u || r.l || r.at) cls.push('is-uncertain');
    const ps = pstartClass(k.id, ax(r.s), instant).trim(); // 시기가 시작하는 해에 즉위: 좁은 화면에서 글자를 이름표 밑으로
    if (ps) cls.push(ps);
    const flag = r.u ? '<abbr title="연도 불확실">?</abbr>' : '';
    const restored = r.r ? '<em>복위</em>' : '';
    // 띠 안 글자는 재위 햇수만(예: "93년"). 시작·끝 해는 왼쪽 눈금과 띠 위치로 보이고, 낭독 문장(label)에는 그대로 있다
    const dur = r.now ? '재임 중' : r.at ? (r.tag || r.at) : r.bare ? `존속 약 ${reignYears(r.s, r.e)}년` : lenOf(r);
    const repeats = r.bare
      ? Array.from({ length: Math.floor(h / 320) }, (_, i) => `<span class="kt-repeat" style="top:${70 + i * 320}px">${esc(k.name)}</span>`).join('')
      : '';
    return `<div class="${cls.join(' ')}" data-id="${r.id}" style="top:${top}px;height:${h}px;${style}" role="note" aria-label="${esc(label)}">${repeats}
      <span class="kt-label"><span class="kt-name">${genOf(r) ? `<small>${genOf(r)}</small> ` : ''}${nameWithTitle(r.name)}${restored}${r.alt ? `<span class="kt-alt">${esc(r.alt)}</span>` : ''}</span>
      <span class="kt-dur">${dur}${flag}</span>
      <span class="kt-years">${dur}${flag}</span></span>${keysOf(r) ? `
      <span class="kt-keys${cols ? ' is-cols' : ''}" aria-hidden="true">${cols ? colsHtml(keysOf(r), k.kind === 'gov' ? '재임 중 정책(연도 미상)' : undefined) : boxesHtml(keysOf(r))}</span>` : ''}${r.stages ? stagesHtml(r, top, cols) : ''}
    </div>`;
  }

  // 왕별 재위 연도가 없는 나라(대가야): 나라 전체 기간을 줄 오른쪽에 가는 세로 띠로 그린다.
  function stripHtml(r) {
    const k = r.kingdom;
    const { top, h } = box.get(r.id);
    const label = `${k.name}, ${range(r)}, 왕별 재위 연도는 전해지지 않음(전승 연도)`;
    const gap = 300; // 이름을 이 간격(px)마다 한 번씩 적는다
    const names = Array.from({ length: Math.max(1, Math.floor(h / gap)) }, (_, i) => `<span style="top:${8 + i * gap}px">${esc(k.name)}</span>`).join('');
    return `<div class="kt-strip is-uncertain" data-id="${r.id}" style="top:${top}px;height:${h}px;--c:${k.color};--ink:${k.ink};--t:${k.tints[1]}" role="note" aria-label="${esc(label)}">${names}</div>`;
  }

  // 눈금은 연표 전체에 한 번만 그린다.
  function ticksHtml() {
    const ticks = [], lines = [];
    // 1년이 4px보다 작은 구간(선사 시대 ~ 기원전 57년)은 눈금 간격을 구간마다 달리한다: 눈금 사이가 24px 이상 되는 가장 작은 간격.
    const COARSE = [50, 100, 500, 1000, 5000, 10000, 50000, 100000];
    const inTable = y => TABLES.some(t => y >= t.from && y < t.to); // 표 안은 눈금 간격이 같지 않아 눈금을 그리지 않는다
    for (let y = Math.ceil(chart.start / 5) * 5; y <= chart.end;) {
      if (y === 0) { y += 5; continue; }
      const px = pxHere(ax(y));
      if (px < 4) {
        const step = COARSE.find(c => c * px >= 24) || COARSE[COARSE.length - 1];
        if (y % step !== 0) { y = Math.ceil(y / step) * step; continue; }
        if (!inTable(y)) {
          const top = yAt(ax(y));
          lines.push(`<i class="is-major" style="top:${top}px"></i>`);
          ticks.push(`<span class="kt-tick${y <= -1000 ? ' is-stack' : ''}" style="top:${top}px">${tickLabel(y)}</span>`);
        }
        y += step;
        continue;
      }
      const half = y % 10 !== 0;
      if ((!half || px >= 30) && !inTable(y)) { // 5년 눈금은 10년 사이가 300px 넘게 벌어지는 곳에만
        const top = yAt(ax(y));
        lines.push(`<i class="${y % 100 === 0 ? 'is-century' : half ? 'is-half' : 'is-major'}" style="top:${top}px"></i>`);
        ticks.push(`<span class="kt-tick${y % 100 === 0 ? ' is-century' : half ? ' is-half' : ''}${y <= -1000 ? ' is-stack' : ''}" style="top:${top}px">${tickLabel(y)}</span>`);
      }
      y += 5;
    }
    return { ticks: ticks.join(''), lines: lines.join('') };
  }

  // 좁은 화면: 1번째 줄 나라(고구려·발해)가 모두 끝난 뒤에는 그 칸이 비므로, 2번째 줄의 그 뒤 항목(고려 2대 혜종 ~ 현대)을
  // 1번째 줄까지 넓혀 두 칸 폭으로 쓴다(CSS가 kt-wide를 넓힘). 1번째 줄이 끝난 해(계산용 연도)
  const lane0Free = Math.max(...chart.lanes[0].kingdoms.map(id => ax(kingdoms.get(id).end)));
  const wideClass = (index, year) => (index === 1 && year >= lane0Free ? 'kt-wide ' : '');
  // 넓은 화면: "시기 구분" 줄이 생기는 해부터는 그 줄을 이름표 폭(--pw)만 쓰게 좁히고, 왕·정부 띠(2번째 줄)를 그만큼 왼쪽으로 넓힌다(CSS kt-pshift).
  const firstPeriodHead = chart.heads.find(h => h.lanes[0][0] === '시기 구분');
  const PERIOD_FROM = firstPeriodHead ? ax(firstPeriodHead.from) : Infinity;
  const pshiftClass = (k, year) => (PERIOD_KINGDOMS.has(k.id) && year >= PERIOD_FROM ? 'kt-pshift ' : '');

  function laneHtml(lane, index) {
    const parts = [];
    const stripK = lane.strip ? kingdoms.get(lane.strip) : null;
    const stripSpan = stripK ? [ax(stripK.start), ax(stripK.end)] : null;
    if (stripK) stripK.kings.forEach((rr, j) => { if (rr.bare) parts.push(stripHtml(reignById.get(`${stripK.id}-${j}`))); }); // 나라 전체를 뜻하는 항목만 가는 띠로
    const beside = year => Boolean(stripSpan) && year >= stripSpan[0] && year <= stripSpan[1]; // 대가야 띠 옆이면 글씨가 띠를 피한다
    lane.kingdoms.forEach((id, i) => {
      const k = kingdoms.get(id);
      const prev = i > 0 ? kingdoms.get(lane.kingdoms[i - 1]) : null;
      const touching = prev && ax(prev.end) >= ax(k.start); // 앞 나라가 끝나자마자 이어지면 건국 표시 없이 색만 바뀐다
      const own = []; // 이 나라의 띠·미상 칸·시작/끝 표시
      // 좁은 화면에서 두 칸 폭으로 넓힐 항목(1번째 줄이 빈 뒤에 시작하는 2번째 줄 항목)은 맨 앞 class에 kt-wide를 붙인다
      const add = (html, year) => {
        const pre = wideClass(index, year) + pshiftClass(k, year);
        own.push(pre ? html.replace('class="', `class="${pre}`) : html);
      };
      if (ax(k.start) > chartStart && !touching && !k.quiet) {
        add(`<span class="kt-edge is-start${beside(ax(k.start)) ? ' has-strip' : ''}" style="top:${yStartOf(ax(k.start))}px;--c:${k.color}">${esc(k.startNote || `${k.short || k.name} ${shortYear(k.start)} 건국`)}</span>`, ax(k.start));
      }
      k.kings.forEach((_, j) => {
        const r = reignById.get(`${k.id}-${j}`);
        if (r.bare) return; // 가는 띠 전용
        if (r.unknown) { add(gapHtml(r), ax(r.s)); return; }
        add(bandHtml(r, Boolean(stripSpan) && ax(r.s) < stripSpan[1] && ax(r.e) > stripSpan[0]), ax(r.s));
      });
      if (k.endNote && ax(k.end) < chartEnd) {
        add(`<span class="kt-edge${beside(ax(k.end)) ? ' has-strip' : ''}" style="top:${yEndOf(ax(k.end))}px;--c:${k.color}">${esc(k.endNote)}</span>`, ax(k.end));
      }
      // 한 줄을 반씩 나눠 쓰는 나라(금관가야·대가야)와 좁은 화면에서 숨기는 나라: 모든 항목의 맨 앞 class에 표시를 더한다.
      const extra = [k.half ? `kt-half-${k.half}` : '', k.pcOnly ? 'kt-pc-only' : ''].filter(Boolean).join(' ');
      own.forEach(html => parts.push(extra ? html.replace('class="', `class="${extra} `) : html));
    });
    parts.push(actsHtml(index));
    // 줄마다 칸을 직접 지정한다(시기 구분 묶음이 1·2번째 줄에 겹쳐 놓여도 줄 순서가 밀리지 않게).
    return `<div class="kt-lane${lane.pc ? ' kt-pc-only' : ''}" style="grid-row:1;grid-column:${index + 2}">${parts.join('')}</div>`;
  }

  // 띠 옆 왕의 일(넓은 화면): 줄 하나의 묶음마다 네모 표시 하나 + 이름표 여러 줄. 첫 줄 가운데가 그 해 높이에 온다.
  // 정확한 해는 나라 색 굵은 글씨, 연도 없는 일은 회색으로 재위 기간("1649~59"). 띠의 낭독 문장에 같은 내용이 있어 화면 낭독기에서는 감춘다.
  const spanShort = (s, e) => {
    if (e === undefined || e === null || e === s) return esc(shortYear(s));
    const short = s > 0 && Math.floor(s / 100) === Math.floor(e / 100) ? String(e).slice(-2) : shortYear(e);
    return `${esc(shortYear(s))}~${esc(short)}`;
  };
  function actsHtml(index) {
    const groups = actLanes()[index];
    if (!groups || !groups.length) return '';
    const items = groups.map(g => {
      const at = yAt(ax(g.y));
      const k = g.items[0].r.kingdom; // 한 줄에 여러 나라가 이어지므로 색은 묶음마다 그 나라 색
      const color = `--ac:${k.ink};--am:${k.color}`;
      // 업적 박스(제목 + 설명)를 세로로 쌓는다. 연도 없는 일은 회색 재위 기간. 첫 박스 첫 줄 가운데가 그 해 높이(BOX_HEAD)
      const lines = g.items.map(({ a, r }) => boxHtml(a, a.y ? spanShort(a.y, a.e) : spanShort(actAnchor(a, r), r.now ? undefined : r.e))).join('');
      const undatedOnly = g.items.every(({ a }) => !a.y);
      return `<i class="kt-act-mark${undatedOnly ? ' is-undated' : ''}" style="top:${at}px;${color}"></i><div class="kt-act-lab" data-key="${g.key}" style="top:${at - BOX_HEAD}px;${color}">${lines}</div>`;
    }).join('');
    return `<div class="kt-acts" aria-hidden="true">${items}</div>`;
  }

  // ---- 표(선사 시대 구분·초기 국가 비교): 정해진 줄 범위에 걸쳐 표 시작 해 높이에 놓는다 ----
  // 열마다 '키워드|설명' 항목 목록을 적고(앞에 *를 붙이면 형광펜), 좁은 화면(600px 이하)은 CSS가 행마다 카드로 쌓는다.
  const TABLES = data.tables || [];
  // 항목: '키워드|짧은 설명|이름표: 상세 한 줄|이름표: 상세 한 줄…', 앞에 *가 있으면 시험 단서(형광펜).
  // 상세 줄은 "자세히 보기"가 켜졌을 때만 보인다(CSS .kt-detail). 이름표 없는 줄은 풀이 문장, '혼동 주의'·'순서'만 이름표를 단다.
  const DETAIL_KIND = { '혼동 주의': 'warn', 순서: 'seq', 관련: 'link' };
  const DETAIL_LINE = /^(혼동 주의|순서|관련):\s*([\s\S]+)$/;
  const tblDetail = line => {
    const m = DETAIL_LINE.exec(line);
    return m ? `<span class="kt-tbl-d is-${DETAIL_KIND[m[1]]}"><em>${m[1]}</em>${esc(m[2])}</span>` : `<span class="kt-tbl-d">${esc(line)}</span>`;
  };
  const tblItem = raw => {
    const key = raw.startsWith('*');
    const [t, d, ...rest] = (key ? raw.slice(1) : raw).split('|');
    const more = rest.filter(Boolean);
    return `<span class="kt-tbl-i${key ? ' is-key' : ''}${t === '—' ? ' is-none' : ''}"><b>${esc(t)}</b>${d ? `<small>${d.split(/,\s+/).map(l => `<span>${esc(l)}</span>`).join('')}</small>` : ''}${more.length ? `<span class="kt-tbl-more">${more.map(tblDetail).join('')}</span>` : ''}</span>`;
  };
  // 열 머리 아이콘(16×16, 선만 그림): 열마다 색(--cc)과 함께 쓴다
  const COL_ICONS = {
    star: '<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.4l-3.8 2.1.7-4.2-3.1-3 4.3-.6z"/>',
    tool: '<path d="M3 13l6.2-6.2M8.2 3.2l4.6 4.6-1.9 1.9-4.6-4.6z"/>',
    home: '<path d="M2 8l6-5 6 5M3.8 7v6.2h8.4V7M6.8 13.2V9.6h2.4v3.6"/>',
    people: '<circle cx="5.5" cy="5.4" r="2"/><circle cx="11.2" cy="6" r="1.7"/><path d="M1.8 13c0-2.5 1.7-4 3.7-4s3.7 1.5 3.7 4M9.7 9.3c2.2-.3 4 1 4 3.7"/>',
    pin: '<path d="M8 14.2s4.2-4 4.2-7.4a4.2 4.2 0 0 0-8.4 0c0 3.4 4.2 7.4 4.2 7.4z"/><circle cx="8" cy="6.8" r="1.5"/>',
    sprout: '<path d="M8 14V8.2M8 8.2c0-2.8 1.9-4.4 5-4.4 0 2.9-1.9 4.4-5 4.4zM8 10.4c0-2-1.4-3.2-4.2-3.2 0 2.1 1.4 3.2 4.2 3.2z"/>',
    crown: '<path d="M2 12.2h12M2.2 12.2L1.6 5.2l4 3L8 3.4l2.4 4.8 4-3-.6 7"/>',
    coin: '<circle cx="8" cy="8" r="5.6"/><path d="M8 4.8v6.4M5.9 6.7h3.4a1.2 1.2 0 0 1 0 2.4H6.6"/>',
    flag: '<path d="M3.4 14.4V2M3.4 3h8.6l-2 3.2L12 9.4H3.4"/>',
    sun: '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/>',
    heart: '<path d="M8 13.6S2 10.2 2 6.3A3 3 0 0 1 8 5a3 3 0 0 1 6 1.3c0 3.9-6 7.3-6 7.3z"/>',
    scale: '<path d="M8 2.4v11.2M4 13.6h8M3 4.6h10M3 4.6L1.4 8.8h3.2zM13 4.6l-1.6 4.2h3.2z"/>',
  };
  const colIcon = k => (COL_ICONS[k] ? `<svg class="kt-ci" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${COL_ICONS[k]}</svg>` : '');
  // 표: 행마다 <tbody> 한 묶음. formula(한 줄 공식)가 있으면 행 머리 옆에 칩 줄을 먼저 두고 그 아래 칸들을 놓는다
  function tablesHtml() {
    return TABLES.map(t => {
      const [a, b] = t.lanes;
      const cc = c => (c.color ? ` style="--cc:${c.color}"` : '');
      const head = `<tr><th scope="col"></th>${t.cols.map(c => `<th scope="col"${c.hot ? ' class="is-hot"' : ''}${cc(c)}>${colIcon(c.icon)}${esc(c.name)}</th>`).join('')}</tr>`;
      const groups = t.rows.map(r => {
        const rowTh = `<th scope="row"${r.formula ? ' rowspan="2"' : ''}><b>${esc(r.name)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</th>`;
        const fm = r.formula ? `<tr class="kt-tbl-fm">${rowTh}<td colspan="${t.cols.length}" class="kt-fm"><span class="kt-fm-lab">핵심</span>${r.formula.map(f => `<span class="kt-chip">${esc(f)}</span>`).join('<i aria-hidden="true">+</i>')}</td></tr>` : '';
        const cells = t.cols.map((c, i) => `<td${c.hot ? ' class="is-hot"' : ''}${cc(c)} data-label="${esc(c.name)}">${(r.cells[i] || []).map(tblItem).join('')}</td>`).join('');
        return `<tbody class="kt-tbl-g" style="--rc:${r.color}">${fm}<tr>${r.formula ? '' : rowTh}${cells}</tr></tbody>`;
      }).join('');
      // 맨 왼쪽 줄부터 걸치는 표는 눈금 칸(첫 열)까지 넓힌다. 표 구간에는 눈금 숫자가 없어서 가리는 게 없다
      const c0 = a === 0 ? 1 : a + 2;
      return `<div class="kt-tblwrap" style="grid-row:1;grid-column:${c0} / span ${b + 3 - c0}">
        <section class="kt-tbl" data-key="tbl:${t.id}" style="top:${yAt(ax(t.from))}px" aria-label="${esc(t.title)}">
          <h3>${esc(t.title)}</h3>${t.lead ? `<p class="kt-tbl-lead">${esc(t.lead)}</p>` : ''}
          <table><colgroup><col style="width:12%">${t.cols.map(c => `<col${c.w ? ` style="width:${c.w}%"` : ''}>`).join('')}</colgroup><thead>${head}</thead>${groups}</table>
          ${t.note ? `<p class="kt-tbl-note">${esc(t.note)}</p>` : ''}
        </section></div>`;
    }).join('');
  }

  // 연표 본문(눈금·띠)만 다시 그린다. 확대·축소할 때마다 쓰므로 페이지의 나머지(접어 둔 안내 등)는 건드리지 않는다.
  function drawChart() {
    layout();
    periodPx = PERIODS.map(p => ({ ...p, top: yAt(ax(p.s)), bot: yAt(ax(p.e)) }));
    const { ticks, lines } = ticksHtml();
    const el = app.querySelector('.kt-chart');
    el.style.height = `${total}px`;
    // 시기 구분 묶음은 왕 띠보다 먼저 넣어 띠 뒤에 깔리게 한다(테두리만 띠 바깥으로 보임).
    el.innerHTML = `<div class="kt-grid" aria-hidden="true">${lines}</div>
      <div class="kt-axis" aria-hidden="true">${ticks}</div>
      ${periodsHtml()}
      ${chart.lanes.map(laneHtml).join('')}
      ${tablesHtml()}
      ${periodLinesHtml()}`;
  }
  function renderChart() {
    if (syncDetail()) needKey = ''; // 상세 칸이 켜지고 꺼지면 표 높이가 달라지므로 다시 잰다
    drawChart();
    // 줄 폭이 처음이거나 바뀌었으면 업적 칸이 있는 띠의 내용물 높이를 다시 재고, 달라졌으면 그 값으로 한 번 더 그린다.
    const key = widthKey();
    if (key !== needKey) {
      needKey = key;
      if (measureNeeds()) drawChart();
    }
    markTight();
    const val = document.getElementById('kt-zoom-val');
    if (val) val.textContent = `${Math.round(zoom * 100)}%`;
  }

  // 두 줄 띠에서 이름이 길어 햇수 줄이 띠 아래로 잘리면 is-tight를 붙인다(CSS가 햇수 줄을 숨김).
  // 먼저 모두 읽고 나서 한꺼번에 바꿔서 다시 계산을 한 번만 한다.
  // 한 줄 띠(size-m)에서 "이름 햇수"가 폭을 넘으면(반 폭 대가야 등) 대수를 빼서 햇수가 남게 한다.
  // 좁은 화면의 시기 이름표가 띠 칸 폭을 넘으면(흥선 대원군 집권기 등) 연도를 빼고 이름만(연도는 가로선 위치와 낭독 문장에 있음).
  // 그래도 넘치면 글자를 한 단계 줄인다. 먼저 모두 읽고 한꺼번에 바꾼다.
  function fitPeriodTags() {
    const over = el => el.scrollWidth > el.clientWidth + 1;
    const tags = [...app.querySelectorAll('.kt-pl-tag')].filter(t => t.offsetParent !== null);
    const long = tags.filter(over);
    long.forEach(t => t.classList.add('no-yrs'));
    const still = long.filter(over);
    still.forEach(t => t.classList.add('is-small'));
  }

  function markTight() {
    fitPeriodTags();
    const bands = [...app.querySelectorAll('.kt-band.size-l, .kt-band.size-m')];
    const tight = bands.map(b => {
      if (b.classList.contains('size-m')) {
        const nm = b.querySelector('.kt-name'), dur = b.querySelector('.kt-dur');
        return nm.scrollWidth > nm.clientWidth + 1 || (dur.offsetParent && dur.scrollWidth > dur.clientWidth + 1);
      }
      const lab = b.querySelector('.kt-label');
      return !b.querySelector(':scope > .kt-keys, :scope > .kt-stage') && lab.offsetTop + lab.offsetHeight > b.clientHeight + 0.5;
    });
    bands.forEach((b, i) => { if (tight[i]) b.classList.add('is-tight'); });
    // 좁힌 띠(띠 옆에 왕의 일을 적는 나라)에서 이름이 한 줄에 다 안 들어가면 대수를 뺀다.
    const narrow = [...app.querySelectorAll('.kt-band.is-narrow')];
    const nameTight = narrow.map(b => { const nm = b.querySelector('.kt-name'); return nm.scrollWidth > nm.clientWidth + 1; });
    narrow.forEach((b, i) => { if (nameTight[i]) b.classList.add('is-tight-name'); });
  }

  // 업적 칸이 있는 줄(고려·조선)의 폭. 이 폭이 같으면 내용물 높이도 같다.
  const widthKey = () => {
    const lane = app.querySelectorAll('.kt-chart > .kt-lane')[1];
    return lane ? String(lane.clientWidth) : '';
  };
  // 업적 칸이 있는 띠마다 높이를 풀어(auto) 내용물이 다 들어가는 높이를 잰다. 바뀐 값이 있으면 true.
  // 실제로 그려질 모양(이름 + 연도 두 줄, 큰 띠)으로 잰다. 먼저 모두 바꾼 뒤 한꺼번에 읽어서 다시 계산을 한 번만 한다.
  // 재위 단계가 있는 띠: 첫 단계는 이름표와 함께 흐름 안에 있으므로 띠 높이로, 다음 단계들은 그 단계 칸의 높이로 잰다.
  function measureNeeds() {
    const bands = [...app.querySelectorAll('.kt-band')].filter(b => b.querySelector(':scope > .kt-keys, :scope > .kt-stage') || b.classList.contains('is-narrow'));
    const saved = bands.map(b => [b.className, b.style.height]);
    bands.forEach(b => { b.classList.remove('size-m'); b.classList.add('size-l', 'size-xl'); b.style.height = 'auto'; });
    const heights = bands.map(b => b.offsetHeight);
    const stageHs = bands.map(b => [...b.querySelectorAll(':scope > .kt-stage:not(.is-first)')].map(s => [s.dataset.blk, s.offsetHeight]));
    bands.forEach((b, i) => { b.className = saved[i][0]; b.style.height = saved[i][1]; });
    // 새로 잰 값으로 통째로 바꾼다(좁은 화면에서 숨는 줄의 띠는 값이 없어져 최소 높이를 붙들지 않음).
    const next = new Map();
    bands.forEach((b, i) => {
      if (!heights[i]) return; // 화면에 안 보이는 줄
      const first = b.querySelector(':scope > .kt-stage') ? `${b.dataset.id}~0` : b.dataset.id;
      next.set(first, Math.ceil(heights[i]) + 6); // +6: 맨 아래 칸 밑 여백
      stageHs[i].forEach(([id, h]) => { if (h) next.set(id, Math.ceil(h) + 6); });
    });
    // 표: 줄 폭에 따라 높이가 달라서 표마다 잰다
    app.querySelectorAll('.kt-tbl[data-key]').forEach(t => { if (t.offsetHeight) next.set(t.dataset.key, Math.ceil(t.offsetHeight) + 8); });
    // 띠 옆 업적 박스 묶음(넓은 화면): 설명 줄 수만큼 높이가 달라서 묶음마다 잰다
    app.querySelectorAll('.kt-act-lab[data-key]').forEach(l => { if (l.offsetHeight) next.set(l.dataset.key, Math.ceil(l.offsetHeight)); });
    const changed = next.size !== needH.size || [...next].some(([id, h]) => needH.get(id) !== h);
    needH.clear();
    next.forEach((h, id) => needH.set(id, h));
    return changed;
  }

  function render() {
    app.innerHTML = `<div class="kt-wrap">
      <div class="kt-intro">
        <p class="eyebrow">시간 순서로 보는 한국사</p>
        <h1>한국사 연표</h1>
        <p>선사 시대·고조선·초기 국가에 이어 삼국부터 대한제국까지 왕 ${kingCount}명, 이어서 일제 강점기의 통치 방식과 광복 뒤 미군정·대한민국 정부를 하나의 연도 눈금 위에 이어서 놓았습니다. 띠 길이가 재위·재임 기간이고, 진한 선이 시작한 해입니다. 위쪽 이름표는 보고 있는 연도에 맞춰 바뀝니다. 고려부터는 무신 집권기·붕당 정치기·제1공화국 같은 시기마다 같은 색 테두리로 띠를 묶었고, 띠 안의 작은 칸에는 그 왕·정부의 주요 업적과 정책, 그리고 재위 중에 일어난 주요 사건을 연도 순서로 적었습니다(사건은 지금 ${EVENTS.length}개, 조금씩 늘려 가는 중이며 칸 왼쪽 선 색이 분야입니다). 업적과 사건은 이론 정리에 있는 내용으로 채웁니다. Ctrl을 누른 채 마우스 휠을 돌리면 눈금 간격을 자유롭게 늘이고 줄일 수 있습니다.</p>
      </div>
      <div class="kt-toolbar">
        <nav class="kt-jump" aria-label="시대로 이동">${data.eras.map(e => `<a href="#y${e.year}" data-year="${e.year}">${esc(e.name)}</a>`).join('')}</nav>
        <div class="kt-tools">
          <p class="kt-zoom-hint"><span><kbd>Ctrl</kbd> + 휠 확대·축소</span><span class="kt-zoom-reset"><kbd>Ctrl</kbd> + <kbd>0</kbd> 원래대로</span><b id="kt-zoom-val" aria-live="polite">${Math.round(zoom * 100)}%</b></p>
          <button type="button" class="kt-mobile-btn" id="kt-mobile" aria-haspopup="dialog"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="4" y="1.5" width="8" height="13" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 12.2h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>모바일 화면</button>
          <button type="button" class="kt-detail-btn" id="kt-detail" aria-pressed="${detailOn()}" title="표의 항목마다 배경·근거·헷갈리는 점을 펼쳐 봅니다. 눈금을 ${Math.round(DETAIL_ZOOM * 100)}% 이상 확대해도 자동으로 켜집니다."><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.7" cy="6.7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.2 10.2 14 14M4.6 6.7h4.2M6.7 4.6v4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>자세히</button>
        </div>
      </div>
      <p class="kt-legend"><span><i class="kt-key kt-key-band"></i>띠 길이 = 재위·재임 기간</span><span><i class="kt-key kt-key-line"></i>즉위·취임한 해</span><span><i class="kt-key kt-key-dash"></i>연도가 불확실하거나 전승 연도</span><span><i class="kt-key kt-key-minor"></i>기출 해설에 거의 안 나온 왕</span><span><i class="kt-key kt-key-period"></i>시기 구분(같은 시기 왕을 한 색으로 묶음)</span><span><i class="kt-key-chip">업적</i>왕·정부의 주요 업적과 정책(앞쪽일수록 기출에 많이 나옴)</span>${EVENTS.length ? `<span class="kt-legend-ev">주요 사건<span class="kt-split-note">(띠 안 칸, 왼쪽 선 색 = 분야)</span> ${Object.values(EVENT_TYPES).map(t => `<span style="--ec:${t.color}"><i class="kt-key-ev"></i>${t.name}</span>`).join('')}</span>` : ''}</p>
      <details class="kt-notes"><summary>연도 기준과 알아 둘 점</summary><ul>${data.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>
      <div class="kt-frame">
        <div class="kt-lanehead" id="kt-lanehead" aria-hidden="true"></div>
        <div class="kt-chart"></div>
      </div>
      <p class="footer">재위 연도는 『삼국사기』·『삼국유사』·『고려사』·『조선왕조실록』에 따른 일반적인 연도입니다. 즉위한 해와 물러난 해를 표시하며, 책마다 1년 정도 차이가 날 수 있습니다. 1910년 이후의 시기와 정부 재임 연도는 교과서에서 쓰는 해를 따랐습니다.</p>
    </div>`;
    renderChart();
    measureBar();
    headKey = '';
    updateHead();
  }

  // ---- 화면 위에 붙어 있는 줄 이름표 ----
  const cssPx = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  function measureBar() {
    const bar = app.querySelector('.kt-toolbar');
    if (!bar) return;
    document.documentElement.style.setProperty('--kt-bar', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  }
  // 연표에서 "지금 보고 있는 연도"를 재는 기준선: 위에 붙은 막대와 줄 이름표 바로 아래
  function anchorLine() {
    const head = document.getElementById('kt-lanehead');
    return cssPx('--kt-bar') + (head ? head.offsetHeight : 36) + 16;
  }
  function yearAtLine() {
    const el = app.querySelector('.kt-chart');
    return el ? yearAtPx(anchorLine() - el.getBoundingClientRect().top) : chartStart;
  }
  function updateHead() {
    const el = document.getElementById('kt-lanehead');
    if (!el) return;
    const y = yearAtLine();
    let hi = 0;
    chart.heads.forEach((h, i) => { if (ax(h.from) <= y) hi = i; });
    if (hi === headKey) return;
    headKey = hi;
    el.innerHTML = `<span></span>${chart.heads[hi].lanes.map(([label, kid, narrow], i) => {
      // 좁은 화면은 시기 구분을 선으로 그리고 2번째 줄 띠를 1번째 칸까지 넓히므로, "시기 구분" 이름표를 숨기고 2번째 이름표를 두 칸에 걸친다(CSS)
      const periodHead = chart.heads[hi].lanes[0][0] === '시기 구분';
      const pc = (chart.lanes[i].pc || (kid && kingdoms.get(kid).pcOnly) ? ' kt-pc-only' : '') + (periodHead && i === 0 ? ' kt-head-period' : periodHead && i === 1 ? ' kt-head-wide' : '');
      if (!kid) return label ? `<span class="kt-lane-name kt-lane-plain${pc}">${esc(label)}</span>` : `<span class="${pc.trim()}"></span>`;
      const name = narrow ? `<span class="kt-wide-only">${esc(label)}</span><span class="kt-narrow-only">${esc(narrow)}</span>` : esc(label);
      return `<span class="kt-lane-name${pc}" style="--c:${kingdoms.get(kid).color}">${name}</span>`;
    }).join('')}`;
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; updateHead(); });
  }, { passive: true });
  // 창 폭이 바뀌어 줄 폭이 달라지면 업적 칸 줄바꿈도 달라지므로, 보고 있던 연도를 그 자리에 둔 채 다시 그린다.
  // 창을 끄는 동안 계속 다시 그리지 않도록, 크기 바꾸기가 잠깐 멈춘 뒤에 한 번만 다시 그린다.
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    measureBar();
    updateHead();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (widthKey() !== needKey) redraw(); }, 120);
  });
  // 글꼴이 늦게 들어오면 글자 폭이 바뀌므로 한 번 더 잰다.
  // fonts.ready는 글꼴을 쓰기 시작하기 전에 이미 끝난 것으로 나올 수 있어서, 글꼴이 실제로 다 들어올 때(loadingdone)마다도 다시 잰다.
  if (document.fonts) {
    const remeasure = () => { needKey = ''; redraw(); };
    if (document.fonts.ready) document.fonts.ready.then(remeasure);
    document.fonts.addEventListener?.('loadingdone', remeasure);
  }

  // 그 연도가 기준선 바로 위에 오도록 스크롤한다(그래서 이름표도 그 시기 것으로 바뀐다).
  function goToYear(year, instant = false) {
    const el = app.querySelector('.kt-chart');
    if (!el) return;
    const target = window.scrollY + el.getBoundingClientRect().top + yAt(ax(year)) - anchorLine() + 6;
    window.scrollTo({ top: Math.max(0, target), behavior: instant || reduceMotion() ? 'auto' : 'smooth' });
  }

  // 배율을 바꿔도 기준 위치(마우스가 있던 높이, 없으면 이름표 바로 아래)의 연도가 같은 자리에 머물게 한다.
  function setZoom(f, anchorY = null) {
    f = clampZoom(f);
    if (f === zoom) return;
    const wasAuto = autoDetail();
    zoom = f;
    saveZoom(f);
    if (detailPref !== null && autoDetail() !== wasAuto) { detailPref = null; saveDetail(null); }
    redraw(anchorY);
  }
  // 다시 그려도 기준 위치의 연도가 화면 같은 자리에 머물게 한다.
  function redraw(anchorY = null) {
    const el = app.querySelector('.kt-chart');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const line = anchorY ?? anchorLine();
    const year = rect.top <= line && rect.bottom >= line ? yearAtPx(line - rect.top) : null;
    renderChart();
    if (year !== null) window.scrollBy(0, el.getBoundingClientRect().top + yAt(year) - line);
    updateHead();
  }

  // Ctrl + 휠(터치패드 두 손가락 벌리기도 브라우저가 Ctrl + 휠로 보낸다): 브라우저 전체 확대 대신 연표 눈금만 늘이고 줄인다.
  // 휠 이벤트는 아주 자주 오므로 한 화면 그릴 때마다 한 번만 반영한다.
  let wantZoom = null, wantY = null, zoomFrame = 0;
  const queueZoom = (f, y) => {
    wantZoom = clampZoom(f);
    wantY = y;
    if (zoomFrame) return;
    zoomFrame = requestAnimationFrame(() => { zoomFrame = 0; const z = wantZoom; wantZoom = null; setZoom(z, wantY); });
  };
  window.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
    queueZoom((wantZoom ?? zoom) * Math.exp(-dy * 0.002), event.clientY);
  }, { passive: false });
  // Ctrl + = / - / 0 키도 브라우저 확대 대신 연표 눈금에 쓴다.
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const k = event.key;
    if (k === '+' || k === '=') { event.preventDefault(); queueZoom((wantZoom ?? zoom) * 1.25, null); }
    else if (k === '-' || k === '_') { event.preventDefault(); queueZoom((wantZoom ?? zoom) / 1.25, null); }
    else if (k === '0') { event.preventDefault(); queueZoom(1, null); }
  });

  app.addEventListener('click', event => {
    const jump = event.target.closest('[data-year]');
    if (jump) { event.preventDefault(); goToYear(Number(jump.dataset.year)); return; }
    if (event.target.closest('#kt-mobile')) openMobile();
    if (event.target.closest('#kt-detail')) { detailPref = !detailOn(); saveDetail(detailPref); redraw(); }
  });

  // ---- 모바일 화면 미리보기(PC): 폰 폭(390px) 틀 안에 같은 페이지를 띄운다 ----
  // 틀 안 페이지는 폭이 좁으니 폰과 같은 CSS(@media)·같은 그리기 규칙이 그대로 적용된다. 보고 있던 연도에서 시작한다.
  function openMobile() {
    let dlg = document.getElementById('kt-mobile-dlg');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'kt-mobile-dlg';
      dlg.className = 'kt-mobile-dlg';
      dlg.setAttribute('aria-label', '모바일 화면 미리보기');
      dlg.innerHTML = `<div class="kt-mobile-bar"><b>모바일 화면</b><span>폭 390px · 휴대폰에서 보이는 모습</span><button type="button" class="kt-mobile-close" aria-label="모바일 화면 닫기">닫기 ✕</button></div>
        <div class="kt-phone"><iframe title="한국사 연표 모바일 화면" class="kt-phone-frame"></iframe></div>`;
      document.body.appendChild(dlg);
      // 닫을 때 정리: 바탕 스크롤을 풀고, 틀을 비우고(틀 안 페이지가 계속 돌지 않게), 버튼으로 포커스를 돌려준다.
      // 닫기 버튼·바깥 누르기는 바로 정리하고, Esc는 close 이벤트에서 정리한다(두 번 불려도 괜찮다)
      const cleanup = () => {
        if (!document.documentElement.classList.contains('kt-mobile-open')) return;
        document.documentElement.classList.remove('kt-mobile-open');
        dlg.querySelector('iframe').src = 'about:blank';
        document.getElementById('kt-mobile')?.focus();
      };
      const close = () => { if (dlg.open) dlg.close(); cleanup(); };
      dlg.querySelector('.kt-mobile-close').addEventListener('click', close);
      // 틀 바깥(어두운 바탕)을 누르면 닫는다
      dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
      dlg.addEventListener('close', cleanup);
    }
    const year = Math.round(yearAtLine());
    dlg.querySelector('iframe').src = `kings.html?frame=1#y${year}`;
    document.documentElement.classList.add('kt-mobile-open');
    dlg.showModal();
    dlg.querySelector('.kt-mobile-close').focus();
  }

  render();
  const hash = /^#y(-?\d+)$/.exec(location.hash);
  if (hash) goToYear(Number(hash[1]), true);
})();
