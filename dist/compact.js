"use strict";
// 압축 정리 페이지(compact.html): window.COMPACT(compact-data.js)를 선사~현대 세로 한 줄 타임라인으로 그린다.
// 분야·주제 태그·검색으로 거르고, 태그를 고르면 그 사건만 이어 맨 위에 '흐름' 줄을 만든다.
// 자료는 content/compact/*.json → node tools/build_compact.mjs 로 만든다.
(() => {
  const app = document.getElementById('compact-app');
  const quizDialog = document.getElementById('cp-quiz');
  const data = window.COMPACT;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (!data || !Array.isArray(data.eras) || !data.eras.length) {
    app.innerHTML = '<div class="cp-wrap"><p class="cp-empty">압축 정리 자료를 불러오지 못했습니다.</p></div>';
    return;
  }

  const fieldById = new Map(data.fields.map(f => [f.id, f]));
  const tagInfo = new Map(data.tags.map(t => [t.name, t]));
  const tagColor = name => fieldById.get(tagInfo.get(name)?.field)?.color || '#657474';
  const countryById = new Map((data.countries || []).map(k => [k.id, k]));
  const events = [];
  const byId = new Map();
  for (const era of data.eras) {
    for (const ev of era.events) {
      ev.era = era.id;
      ev.search = [
        ev.t, ev.n, ev.yl, ev.y < 0 ? `기원전 ${-ev.y}` : String(ev.y), fieldById.get(ev.f)?.name,
        ...(ev.c || []).map(id => countryById.get(id)?.name),
        ...ev.tags, ...(ev.sub || []).flatMap(s => [s.t, s.n, s.y]),
        typeof ev.k === 'string' ? ev.k : Object.values(ev.k || {}).join(' '),
      ].filter(v => v !== undefined && v !== null).join(' ').toLowerCase();
      events.push(ev);
      byId.set(ev.id, ev);
    }
  }
  const TOTAL = events.length;
  const CORE_TOTAL = events.filter(ev => ev.core).length;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = reduceMotion ? 'auto' : 'smooth';

  // ---- 보기 설정(브라우저에 저장) ----
  const PREF_KEY = 'korean-history-compact-v1';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; } })();
  const state = {
    field: 'all',
    tag: null,
    query: '',
    view: prefs.view === 'all' ? 'all' : 'core',
    others: prefs.others === 'dim' ? 'dim' : 'hide',
    mask: ['year', 'title'].includes(prefs.mask) ? prefs.mask : 'none',
    // 주제 태그 목록은 폰에서 화면을 많이 차지하므로, 따로 고른 적이 없으면 좁은 화면에서는 접어 둔다
    tagsOpen: typeof prefs.tagsOpen === 'boolean' ? prefs.tagsOpen : !window.matchMedia('(max-width:640px)').matches,
    // 모든 시대는 칸 구조(나라별·왕대·시기 연표·비교표)로만 본다. 예전 '한 줄' 설정(prefs.laneView)은 읽지 않는다.
    // 칸 4개가 들어가지 않는 좁은 화면만 CSS가 사건 목록으로 바꾼다
  };
  const savePrefs = () => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ view: state.view, others: state.others, mask: state.mask, tagsOpen: state.tagsOpen })); } catch { /* 저장 불가: 이번 방문에만 적용 */ }
  };
  const openSubs = new Set();
  const revealed = new Set();

  // ---- 표기 ----
  function yearHtml(ev) {
    if (ev.yl) return `<span class="cp-y-main is-text">${escapeHtml(ev.yl)}</span>`;
    const main = ev.y < 0 ? `<small>기원전</small><span class="cp-y-main">${-ev.y}</span>` : `<span class="cp-y-main">${ev.y}</span>`;
    const extra = ev.e ? `<small>~${ev.e}</small>` : ev.m ? `<small>${ev.m}월</small>` : '';
    return main + extra;
  }
  const yearText = ev => ev.yl || (ev.y < 0 ? `기원전 ${-ev.y}` : `${ev.y}${ev.e ? `~${ev.e}` : ''}`);
  const noteHtml = s => escapeHtml(s).replace(/→/g, '<span class="cp-arrow">→</span>');
  function flowLabel(ev, tag) {
    if (ev.k && typeof ev.k === 'object' && ev.k[tag]) return ev.k[tag];
    if (typeof ev.k === 'string') return ev.k;
    return ev.t;
  }

  function eventHtml(ev) {
    const field = fieldById.get(ev.f);
    const cls = ['cp-ev', ev.core ? 'is-core' : 'is-minor', ev.sub ? 'is-big' : '', ev.e ? 'is-span' : ''].filter(Boolean).join(' ');
    const tags = ev.tags.map(t => `<button type="button" class="cp-tag" data-tag="${escapeHtml(t)}" style="--c:${tagColor(t)}" aria-label="주제 태그 ${escapeHtml(t)}로 거르기">${escapeHtml(t)}</button>`).join('');
    const subToggle = ev.sub ? `<button type="button" class="cp-subtoggle" data-sub="${ev.id}" aria-expanded="false" aria-controls="sub-${ev.id}">세부 흐름 ${ev.sub.length}</button>` : '';
    const theory = ev.th ? `<a class="cp-th" href="theory.html#${ev.th.id}" title="이론 정리: ${escapeHtml(ev.th.name)}">이론 정리<span class="sr-only">: ${escapeHtml(ev.th.name)}</span> →</a>` : '';
    const sub = ev.sub ? `<ol class="cp-sub" id="sub-${ev.id}" hidden>${ev.sub.map(s => `<li>${s.y !== undefined || s.yl ? `<b>${escapeHtml(s.yl || (s.y < 0 ? `기원전 ${-s.y}` : s.y))}</b>` : '<b class="is-blank" aria-hidden="true">·</b>'}<span><strong>${escapeHtml(s.t)}</strong>${s.n ? ` <span class="cp-sub-n">${noteHtml(s.n)}</span>` : ''}</span></li>`).join('')}</ol>` : '';
    return `<article class="${cls}" id="${ev.id}" data-id="${ev.id}" style="--c:${field.color}">
      <div class="cp-y"><span class="cp-y-text">${yearHtml(ev)}</span><button type="button" class="cp-cover cp-cover-y" data-reveal="${ev.id}" aria-label="가린 연도 보기"></button></div>
      <div class="cp-ax" aria-hidden="true"><i></i></div>
      <div class="cp-bd">
        <div class="cp-main">
          <div class="cp-head">
            <h3 class="cp-t"><span class="cp-no" hidden></span>${countryLabels(ev)}<span class="cp-t-text">${escapeHtml(ev.t)}</span></h3>
            <span class="cp-tagline"><button type="button" class="cp-field" data-field="${ev.f}" style="--c:${field.color}" aria-label="분야 ${escapeHtml(field.name)}로 거르기">${escapeHtml(field.name)}</button>${tags}</span>
          </div>
          ${ev.n ? `<p class="cp-n">${noteHtml(ev.n)}</p>` : ''}
          ${sub}
          <button type="button" class="cp-cover cp-cover-t" data-reveal="${ev.id}" aria-label="가린 사건 보기"></button>
        </div>
        ${subToggle || theory ? `<div class="cp-meta">${subToggle}${theory}</div>` : ''}
      </div>
    </article>`;
  }

  function eraHtml(era) {
    const hasGrid = !!(era.lanes || era.kingLanes || era.compare);
    // 시대 머리: 상자 대신 타임라인 축 위의 큰 마디(왼쪽 연도 칸에 기간, 오른쪽에 시대 이름)
    return `<section class="cp-era${hasGrid ? ' has-lanes' : ''}" id="era-${era.id}" data-era="${era.id}" aria-labelledby="h-${era.id}">
      <header class="cp-era-head">
        <span class="cp-era-range">${escapeHtml(era.range)}</span>
        <span class="cp-eh-ax" aria-hidden="true"><i></i></span>
        <div class="cp-eh-main"><h2 id="h-${era.id}">${escapeHtml(era.name)}</h2><span class="cp-era-count" data-era-count="${era.id}"></span></div>
      </header>
      <div class="cp-list">${era.events.map(eventHtml).join('')}</div>
      ${era.lanes ? lanesHtml(era) : ''}${era.kingLanes ? kingLanesHtml(era) : ''}${era.compare ? compareHtml(era) : ''}
    </section>`;
  }

  // ---- 왕대 연표 ----
  // 줄 = 왕(재위 길이에 비례한 높이, 내용이 많으면 내용만큼), 칸 = 그 시대의 세력.
  // 왕 칸 왼쪽에는 재위 막대와 연도 눈금 자(즉위 연도 진하게, 10년마다 눈금, 100년은 강조)를 둔다.
  function kingItemHtml(ev, slot, kl) {
    const field = fieldById.get(ev.f);
    // 시기 연표는 구간을 시기(줄) 번호로, 왕대 연표는 연도로 찾는다
    const seg = kl.periods
      ? kl.segments.filter(s => s.row <= ev.ri).pop()
      : kl.segments.find(s => (s.from === null || ev.y >= s.from) && (s.to === null || ev.y <= s.to));
    const segShort = seg?.short || {};
    // 갈래 표시(예: 민족 운동 칸의 척사·의병 / 개화·계몽): 태그나 이론 주제가 처음 맞는 갈래
    // 사건에 br(갈래 이름)이 있으면 그 갈래를 쓴다(그 칸에 그 갈래가 있을 때만)
    const br = ev.br
      ? (slot.branches || []).find(b => b.name === ev.br)
      : (slot.branches || []).find(b => (b.tags || []).some(t => ev.tags.includes(t)) || (ev.th && (b.th || []).includes(ev.th.name)));
    const branch = br ? `<span class="cp-kbr" style="--b:${br.color}"><span class="sr-only">갈래 </span>${escapeHtml(br.name)}</span>` : '';
    // 시기 연표는 같은 해 안의 순서가 중요해서 월이 있으면 "1905.11"처럼 쓴다
    const yText = kl.periods && ev.m && !ev.yl && !ev.e ? `${ev.y}.${ev.m}` : yearText(ev);
    const withOthers = ev.col.filter(id => id !== slot.id).map(id => {
      const o = kl.slots.find(s => s.id === id);
      return `<span class="cp-li-w" style="--k2:${o.color}"><span class="sr-only">함께: </span>${escapeHtml(segShort[id] || o.name)}</span>`;
    }).join('');
    const tags = ev.tags.map(t => `<button type="button" class="cp-tag" data-tag="${escapeHtml(t)}" style="--c:${tagColor(t)}" aria-label="주제 태그 ${escapeHtml(t)}로 거르기">${escapeHtml(t)}</button>`).join('');
    const theory = ev.th ? `<a class="cp-th" href="theory.html#${ev.th.id}">이론 정리<span class="sr-only">: ${escapeHtml(ev.th.name)}</span> →</a>` : '';
    const sub = ev.sub ? `<ol class="cp-li-sub">${ev.sub.map(s => `<li>${s.y !== undefined || s.yl ? `<b>${escapeHtml(s.yl || (s.y < 0 ? `기원전 ${-s.y}` : s.y))}</b>` : ''}<strong>${escapeHtml(s.t)}</strong>${s.n ? ` <span>${noteHtml(s.n)}</span>` : ''}</li>`).join('')}</ol>` : '';
    const moreId = `li-${ev.id}-${slot.id}`;
    return `<div class="cp-li cp-ki ${ev.core ? 'is-core' : 'is-minor'}" data-ref="${ev.id}" style="--k:${slot.color};--c:${field.color}">
      <button type="button" class="cp-li-btn" data-li aria-expanded="false" aria-controls="${moreId}">
        <span class="cp-li-y">${escapeHtml(yText)}</span><span class="cp-li-t"><span class="cp-no" hidden></span>${branch}${escapeHtml(ev.t)}${withOthers}</span>
      </button>
      <div class="cp-li-more" id="${moreId}" hidden>
        ${ev.n ? `<p class="cp-li-n">${noteHtml(ev.n)}</p>` : ''}${sub}
        <div class="cp-meta"><button type="button" class="cp-field" data-field="${ev.f}" style="--c:${field.color}" aria-label="분야 ${escapeHtml(field.name)}로 거르기">${escapeHtml(field.name)}</button>${tags}${theory}</div>
      </div>
    </div>`;
  }
  function kingRulerHtml(s, e, px, showEnd) {
    const n = Math.max(1, e - s);
    const pos = y => 8 + (y - s) * px;
    const tick = (y, cls) => `<span class="cp-kr-l ${cls}" style="top:${pos(y)}px">${y}</span><span class="cp-kr-t ${cls === 'is-b' ? 'is-b' : ''}" style="top:${pos(y)}px"></span>`;
    let out = `<span class="cp-kr-bar" style="height:${n * px}px" aria-hidden="true"></span><span aria-hidden="true">${tick(s, 'is-b')}`;
    for (let y = Math.ceil((s + 1) / 10) * 10; y < e; y += 10) {
      if (pos(y) - pos(s) < 12 || pos(e) - pos(y) < 12) continue;
      out += tick(y, y % 100 === 0 ? 'is-c' : '');
    }
    if (showEnd && n * px > 14) out += tick(e, 'is-b');
    return `${out}</span>`;
  }
  // ---- 시기 연표(개항기처럼 한 왕의 재위가 길 때) ----
  // 줄 = 정권·시기. 왼쪽 막대 색이 왕이고(첫 왕 진한 초록, 다음 왕 올리브), 눈금 자는 매년 짧은 눈금·5년마다 연도.
  // 줄 머리에는 왕 표시, 시기 이름, 기간, 집권 세력(who), 키워드를 쓴다.
  // 막대 색(p.color)·막대 묶음(p.bar: 같은 왕 또는 같은 단계)은 빌드가 정한다
  // who 글자: **굵게**, [[강조 표시]]. 먼저 이스케이프한 뒤 표시만 바꾼다
  const whoHtml = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[\[(.+?)\]\]/g, '<i class="cp-kre">$1</i>');
  function periodRulerHtml(p, px, color, endLabel) {
    const pos = y => 8 + (y - p.s) * px;
    const h = Math.max(1, (p.e - p.s) * px);
    const [startLabel] = p.label.split(' ~ ');
    let out = `<span class="cp-kr-bar" style="height:${h}px;background:${color}" aria-hidden="true"></span><span aria-hidden="true">`;
    out += `<span class="cp-kr-l is-b" style="top:${pos(p.s)}px;color:${color}">${escapeHtml(startLabel)}</span><span class="cp-kr-t is-b" style="top:${pos(p.s)}px"></span>`;
    for (let y = Math.ceil(p.s + 0.01); y < p.e; y++) {
      if (pos(y) - pos(p.s) < 10 || pos(p.e) - pos(y) < 10) continue;
      const label = y % 5 === 0 && pos(y) - pos(p.s) >= 16 && !p.marks.some(m => Math.abs(pos(m.at) - pos(y)) < 14);
      out += `${label ? `<span class="cp-kr-l${y % 10 === 0 ? ' is-c' : ''}" style="top:${pos(y)}px">${y}</span>` : ''}<span class="cp-kr-t" style="top:${pos(y)}px"></span>`;
    }
    // 시기 안의 전환점(예: 1897 황제 즉위)은 강조 연도로
    for (const m of p.marks) out += `<span class="cp-kr-l is-c" style="top:${pos(m.at)}px">${escapeHtml(m.text)}</span><span class="cp-kr-t is-b" style="top:${pos(m.at)}px"></span>`;
    if (endLabel) out += `<span class="cp-kr-l is-b" style="top:${pos(p.e)}px;color:${color}">${escapeHtml(endLabel)}</span><span class="cp-kr-t is-b" style="top:${pos(p.e)}px"></span>`;
    return `${out}</span>`;
  }
  function periodLanesHtml(era) {
    const kl = era.kingLanes;
    const px = kl.px;
    // box: 왕대 연표와 같은 흰 카드(줄 머리 카드 + 사건이 있는 칸 카드)
    const box = !!kl.box;
    const circled = i => '①②③④⑤⑥⑦⑧⑨⑩⑪⑫'[i] || `${i + 1}.`;
    const dur = (s, e) => {
      const mo = Math.round((e - s) * 12), y = Math.floor(mo / 12), m = mo % 12;
      return `${y ? `${y}년` : ''}${m ? ` ${m}개월` : ''}`.trim();
    };
    const cols = `250px ${kl.slots.map(() => 'minmax(0,1fr)').join(' ')}`;
    const last = kl.periods.length - 1;
    return `<div class="cp-lanes cp-klanes">${kl.segments.map((seg, si) => {
      const end = kl.segments[si + 1]?.row ?? kl.periods.length;
      const head = kl.slots.map(slot => {
        const [name, sub, changed] = seg.cols[slot.id];
        return `<div class="cp-lh" style="--k:${slot.color}">${escapeHtml(name)}${changed ? '<i class="cp-kchg">바뀜</i>' : ''}<small>${escapeHtml(sub || '')}</small></div>`;
      }).join('');
      let body = '';
      for (let i = seg.row; i < end; i++) {
        const p = kl.periods[i];
        const evs = era.events.filter(ev => ev.ri === i);
        const color = p.color;
        // 같은 왕·단계가 이어지는 줄은 왕 표시를 옅게(새 왕 즉위·칭호가 바뀌는 줄만 진하게)
        const cont = i > 0 && kl.periods[i - 1].bar === p.bar && !/→|즉위|\d+대/.test(p.kingNote || '');
        const endLabel = i === last ? p.label.split(' ~ ')[1] : '';
        const headInner = `<span class="cp-kp-king${cont ? ' is-cont' : ''}"><span class="sr-only">왕: </span>${escapeHtml(p.kingNote || p.kingName || p.barName)}</span>
          <b class="cp-kk-n">${circled(i)} ${escapeHtml(p.title)}</b><span class="cp-kk-y">${escapeHtml(p.label)}${p.open ? '' : `<em>${dur(p.s, p.e)}</em>`}</span>
          ${p.who ? `<span class="cp-kp-who"><span class="sr-only">집권 세력: </span>${whoHtml(p.who)}</span>` : ''}
          ${p.keys.length ? `<span class="cp-kk-keys" aria-label="키워드">${p.keys.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</span>` : ''}`;
        // box: 줄 머리 = 흰 카드(테두리 = 왕 막대 색). 재위 막대는 카드 왼쪽에 남겨 실제 기간 길이를 보여 준다(줄은 사건 수만큼 늘어남)
        const kingCell = box
          ? `<div class="cp-kk cp-kp is-boxed is-pbox" style="min-height:${(p.e - p.s) * px + 16}px;--kc:${color}">${periodRulerHtml(p, px, color, endLabel)}<div class="cp-kcard cp-pcard">${headInner}</div></div>`
          : `<div class="cp-kk cp-kp" style="min-height:${(p.e - p.s) * px + 16}px;--kc:${color}">${periodRulerHtml(p, px, color, endLabel)}
          ${headInner}</div>`;
        const cells = kl.slots.map(slot => {
          const items = evs.filter(ev => ev.col.includes(slot.id)).map(ev => kingItemHtml(ev, slot, kl)).join('');
          return `<div class="cp-lcell${box ? ' is-boxed' : ''}" style="--k:${slot.color}">${box && items ? `<div class="cp-kbox">${items}</div>` : items}</div>`;
        }).join('');
        body += `<div class="cp-lrow cp-krow" data-period="${escapeHtml(p.id)}">${kingCell}${cells}</div>`;
      }
      const foot = `<div></div>${kl.slots.map(slot => `<div class="cp-lfoot" style="--k:${slot.color}"></div>`).join('')}`;
      const band = seg.title ? `<p class="cp-lband"><b>${escapeHtml(seg.title)}</b>${seg.note ? `<span>${escapeHtml(seg.note)}</span>` : ''}</p>` : '';
      return `<div class="cp-lseg" data-seg="${si}">${band}<div class="cp-lgrid cp-kgrid is-periods${box ? ' is-box' : ''}" style="grid-template-columns:${cols}"><div class="cp-khy">시기 · 왕 · 집권 세력 · 키워드</div>${head}${body}${foot}</div></div>`;
    }).join('')}</div>`;
  }
  function kingLanesHtml(era) {
    const kl = era.kingLanes;
    if (kl.periods) return periodLanesHtml(era);
    const px = kl.px;
    // 사건이 들어갈 왕(ki)은 빌드가 정한다(왕이 바뀐 해는 시대의 boundary 규칙 또는 사건의 kg)
    const byKing = new Map();
    for (const ev of era.events) {
      const i = ev.ki;
      if (!byKing.has(i)) byKing.set(i, []);
      byKing.get(i).push(ev);
    }
    const segIndex = y => kl.segments.findIndex(s => (s.from === null || y >= s.from) && (s.to === null || y <= s.to));
    const phaseIndex = y => { let p = 0; kl.phases.forEach((ph, i) => { if (y >= ph.from) p = i; }); return p; };
    const nm = k => `${k.n}대 ${k.name}${k.r ? '(복위)' : ''}`;
    // 띠 모드의 왕 이름: 복위는 글자 대신 작은 표시(중조: 원 간섭기에 같은 왕이 다시 즉위)
    const nmHtml = k => `${k.n}대 ${escapeHtml(k.name)}${k.r ? '<i class="cp-kre">복위</i>' : ''}`;
    const years = (s, e) => Math.max(1, e - s);
    // strips: 사건 없는 왕을 묶음 한 줄 대신 "row"(왕마다 얇은 줄) 또는 "stack"(묶음 줄 안에 왕별 띠)
    const strips = kl.strips || null;
    // box: 삼국처럼 흰 카드(왕 칸 카드 + 사건 칸 카드). 왕 칸은 표시 글자가 들어가도록 조금 넓게
    const box = !!kl.box;
    // 왕마다 구간·시기를 정하고, 사건 없는 왕은 같은 구간·시기 안에서 이어지면 한 줄로 묶는다(row 모드는 묶지 않음)
    const rows = [];
    kl.kings.forEach((k, i) => {
      const evs = byKing.get(i) || [];
      const si = segIndex(evs.length ? evs[0].y : k.s);
      const pi = phaseIndex(k.s);
      const last = rows[rows.length - 1];
      if (strips !== 'row' && !evs.length && last?.gap && last.si === si && last.pi === pi) { last.kings.push(k); last.e = k.e; return; }
      rows.push({ kings: [k], s: k.s, e: k.e, evs, si, pi, gap: !evs.length });
    });
    // stack 모드의 묶음 줄 머리: 왼쪽 막대를 왕별 마디로 나누고(높이 = 재위), 오른쪽에 왕 순서 목록
    const stackCellHtml = (r, n, isLast) => {
      const people = new Set(r.kings.map(k => `${k.n}:${k.name}`)).size;
      const head = r.kings.length > people ? `${r.kings.length}번 재위 · ${people}명` : `${people}명`;
      const pos = y => 8 + (y - r.s) * px;
      const bars = r.kings.map((k, j) => `<span class="cp-kst-bar${j % 2 ? ' is-alt' : ''}" style="top:${pos(k.s)}px;height:${Math.max(2, (k.e - k.s) * px - 1)}px"></span>`).join('');
      const list = r.kings.map(k => `<li><b>${nmHtml(k)}</b><em>${years(k.s, k.e)}년</em></li>`).join('');
      return `<div class="cp-kk is-gap is-stack" style="min-height:${n * px + 16}px">${kingRulerHtml(r.s, r.e, px, isLast)}<span aria-hidden="true">${bars}</span>
          <span class="cp-kst-h">${head}<small>${r.s}~${r.e} · ${n}년</small></span><ol class="cp-kst" aria-label="왕 순서">${list}</ol></div>`;
    };
    // row 모드의 사건 없는 왕: 얇은 줄 머리에 이름 · 연수만(사건 있는 왕만 "기간 · 연수")
    const stripCellHtml = (k, n, isLast) => `<div class="cp-kk is-gap is-strip" style="min-height:${n * px + 6}px" title="${escapeHtml(`${nm(k)} ${k.s}~${k.e}`)}">${kingRulerHtml(k.s, k.e, px, isLast)}
          <b class="cp-kk-n">${nmHtml(k)}</b><em class="cp-kk-yrs">${n}년</em></div>`;
    // 표시 글자(cards): 줄 머리 왕 이름 위에 작은 표시(예: 왕권 강화). 설명은 title과 화면 읽기 글자로
    const badgeHtml = k => k.card ? `<span class="cp-kk-badge" title="${escapeHtml(k.card.note)}"${k.card.color ? ` style="background:${k.card.color}"` : ''}>${escapeHtml(k.card.badge)}<span class="sr-only"> · ${escapeHtml(k.card.note)}</span></span>` : '';
    const lastRow = rows[rows.length - 1];
    const cols = `${box ? 250 : 226}px ${kl.slots.map(() => 'minmax(0,1fr)').join(' ')}`;
    return `<div class="cp-lanes cp-klanes">${kl.segments.map((seg, si) => {
      const segRows = rows.filter(r => r.si === si);
      if (!segRows.length) return '';
      const head = kl.slots.map(slot => {
        const [name, sub, changed] = seg.cols[slot.id];
        return `<div class="cp-lh" style="--k:${slot.color}">${escapeHtml(name)}${changed ? '<i class="cp-kchg">바뀜</i>' : ''}<small>${escapeHtml(sub || '')}</small></div>`;
      }).join('');
      let body = '';
      let phase = null;
      for (const r of segRows) {
        if (r.pi !== phase) {
          phase = r.pi;
          const ph = kl.phases[r.pi];
          if (ph) body += `<p class="cp-kphase" data-phase="${r.pi}"><b>${escapeHtml(ph.title)}</b>${ph.sub ? `<span>${escapeHtml(ph.sub)}</span>` : ''}</p>`;
        }
        const n = years(r.s, r.e);
        const label = r.gap
          ? (r.kings.length > 2 ? `${nm(r.kings[0])} ~ ${nm(r.kings[r.kings.length - 1])} (${r.kings.length}명)` : r.kings.map(nm).join(' · '))
          : nm(r.kings[0]);
        const keys = r.gap ? [] : (r.kings[0].keys || []).slice(0, 6);
        const k0 = r.kings[0];
        const keysHtml = keys.length ? `<span class="cp-kk-keys" aria-label="업적 키워드">${keys.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</span>` : '';
        // box: 사건·업적이 있는 왕 = 흰 카드(이름 · 표시 글자 / 기간 · 연수 / 키워드). 눈금 자는 카드 왼쪽에 붙는다
        const boxKing = () => `<div class="cp-kk is-boxed${k0.card ? ' is-card' : ''}" style="min-height:${n * px + 16}px${k0.card?.color ? `;--kb:${k0.card.color}` : ''}">${kingRulerHtml(r.s, r.e, px, r === lastRow)}
          <div class="cp-kcard"><div class="cp-kcard-h"><b class="cp-kk-n">${nmHtml(k0)}</b>${k0.card ? `<span class="cp-kcard-b" title="${escapeHtml(k0.card.note)}">${escapeHtml(k0.card.badge)}<span class="sr-only"> · ${escapeHtml(k0.card.note)}</span></span>` : ''}</div>
          <span class="cp-kk-y">${r.s}~${r.e}<em>${n}년</em></span>${keysHtml}</div></div>`;
        const kingCell = box && !r.gap ? boxKing()
          : r.gap && strips === 'row' ? stripCellHtml(k0, n, r === lastRow)
          : r.gap && strips === 'stack' && r.kings.length > 1 ? stackCellHtml(r, n, r === lastRow)
          : r.gap && strips ? stripCellHtml(k0, n, r === lastRow)
          : `<div class="cp-kk${r.gap ? ' is-gap' : ''}${k0.card && !r.gap ? ' is-card' : ''}" style="min-height:${n * px + 16}px${k0.card?.color ? `;--kb:${k0.card.color}` : ''}">${kingRulerHtml(r.s, r.e, px, r === lastRow)}
          ${r.gap ? '' : badgeHtml(k0)}<b class="cp-kk-n">${strips && !r.gap ? nmHtml(k0) : escapeHtml(label)}</b><span class="cp-kk-y">${r.s}~${r.e}<em>${n}년</em></span>
          ${keys.length ? `<span class="cp-kk-keys" aria-label="업적 키워드">${keys.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</span>` : ''}</div>`;
        const cells = kl.slots.map(slot => {
          const items = r.evs.filter(ev => ev.col.includes(slot.id)).map(ev => kingItemHtml(ev, slot, kl)).join('');
          // box: 사건이 있는 칸만 흰 카드(칸 색 테두리), 빈 칸은 칸 색 바탕 그대로
          const inner = box && items ? `<div class="cp-kbox">${items}</div>` : items;
          return `<div class="cp-lcell${r.gap ? ' is-gap' : ''}${box ? ' is-boxed' : ''}" style="--k:${slot.color}">${inner}</div>`;
        }).join('');
        body += `<div class="cp-lrow cp-krow${r.gap ? ' is-gap' : ''}" data-phase="${r.pi}">${kingCell}${cells}</div>`;
      }
      const foot = `<div></div>${kl.slots.map(slot => `<div class="cp-lfoot" style="--k:${slot.color}"></div>`).join('')}`;
      const band = seg.title ? `<p class="cp-lband"><b>${escapeHtml(seg.title)}</b>${seg.note ? `<span>${escapeHtml(seg.note)}</span>` : ''}</p>` : '';
      return `<div class="cp-lseg" data-seg="${si}">${band}<div class="cp-lgrid cp-kgrid${box ? ' is-box' : ''}" style="grid-template-columns:${cols}"><div class="cp-khy">재위 연도 · 왕 · 업적 키워드</div>${head}${body}${foot}</div></div>`;
    }).join('')}</div>`;
  }

  // ---- 비교표(선사·초기 국가) ----
  // 줄 = 시대·나라, 칸 = 비교 항목. 칸에는 비교 내용(사건이 아님)과, 그 칸에 둔 사건(cc)을 넣는다.
  // 줄 머리에 둔 사건(cr만)은 줄 이름을 누르면 요점이 펼쳐지고, 구간 id에 둔 사건은 띠 아래에 놓인다.
  function compareEventHtml(ev, color, headName) {
    const field = fieldById.get(ev.f);
    const tags = ev.tags.map(t => `<button type="button" class="cp-tag" data-tag="${escapeHtml(t)}" style="--c:${tagColor(t)}" aria-label="주제 태그 ${escapeHtml(t)}로 거르기">${escapeHtml(t)}</button>`).join('');
    const theory = ev.th ? `<a class="cp-th" href="theory.html#${ev.th.id}">이론 정리<span class="sr-only">: ${escapeHtml(ev.th.name)}</span> →</a>` : '';
    const sub = ev.sub ? `<ol class="cp-li-sub">${ev.sub.map(s => `<li>${s.y !== undefined || s.yl ? `<b>${escapeHtml(s.yl || (s.y < 0 ? `기원전 ${-s.y}` : s.y))}</b>` : ''}<strong>${escapeHtml(s.t)}</strong>${s.n ? ` <span>${noteHtml(s.n)}</span>` : ''}</li>`).join('')}</ol>` : '';
    const moreId = `li-${ev.id}-c`;
    // 줄 머리 사건은 줄 이름을 그대로 보여 준다(가리기에서도 가리지 않음: 비교표에서는 칸 내용이 문제)
    const label = headName
      ? `<span class="cp-chead-t"><span class="cp-no" hidden></span>${escapeHtml(headName)}</span>`
      : `<span class="cp-li-y">${escapeHtml(yearText(ev))}</span><span class="cp-li-t"><span class="cp-no" hidden></span>${escapeHtml(ev.t)}</span>`;
    return `<div class="cp-li cp-ki${headName ? ' cp-chead' : ''} ${ev.core ? 'is-core' : 'is-minor'}" data-ref="${ev.id}" style="--k:${color};--c:${field.color}">
      <button type="button" class="cp-li-btn" data-li aria-expanded="false" aria-controls="${moreId}">${label}</button>
      <div class="cp-li-more" id="${moreId}" hidden>
        ${ev.n ? `<p class="cp-li-n">${noteHtml(ev.n)}</p>` : ''}${sub}
        <div class="cp-meta"><button type="button" class="cp-field" data-field="${ev.f}" style="--c:${field.color}" aria-label="분야 ${escapeHtml(field.name)}로 거르기">${escapeHtml(field.name)}</button>${tags}${theory}</div>
      </div>
    </div>`;
  }
  function compareHtml(era) {
    const cp = era.compare;
    const whoMark = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return `<div class="cp-lanes cp-klanes">${cp.segments.map(seg => {
      const bandEv = era.events.find(ev => ev.cr === seg.id);
      const head = seg.cols.map(c => `<div class="cp-lh" style="--k:${c.color}">${escapeHtml(c.name)}${c.changed ? '<i class="cp-kchg">바뀜</i>' : ''}<small>${escapeHtml(c.sub || '')}</small></div>`).join('');
      let body = '';
      seg.rows.forEach((r, ri) => {
        const evs = era.events.filter(ev => ev.cr === r.id);
        const headEv = evs.find(ev => ev.cc === undefined);
        // 거를 때 이 줄을 남길지: 줄의 사건 + (구간 띠 사건이 있으면) 그 사건
        const refs = [...evs.map(ev => ev.id), ...(bandEv ? [bandEv.id] : [])];
        const left = `<div class="cp-kk cp-kc" style="--kc:${r.color}"><span class="cp-kr-bar" style="background:${r.color}" aria-hidden="true"></span>`
          + (seg.compressed && ri ? '<span class="cp-cgap" aria-hidden="true" title="시간 압축">≈</span>' : '')
          + (r.kind ? `<span class="cp-kp-king">${escapeHtml(r.kind)}</span>` : '')
          + (headEv ? compareEventHtml(headEv, r.color, r.name) : `<b class="cp-kk-n">${escapeHtml(r.name)}</b>`)
          + `<span class="cp-kk-y">${escapeHtml(r.period)}</span>`
          + (r.who ? `<span class="cp-kp-who">${whoMark(r.who)}</span>` : '')
          + (r.keys?.length ? `<span class="cp-kk-keys" aria-label="대표 유적">${r.keys.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</span>` : '')
          + '</div>';
        const cells = seg.cols.map(c => {
          const inCell = evs.filter(ev => ev.cc === c.id).map(ev => compareEventHtml(ev, c.color)).join('');
          const facts = (r.cells[c.id] || []).map((x, i) => x.none
            ? `<span class="cp-cnone">${escapeHtml(x.none)}</span>`
            : `<button type="button" class="cp-cf${x.key ? ' is-key' : ''}" data-cf="f:${era.id}-${r.id}-${c.id}-${i}"><span class="cp-cf-t">${escapeHtml(x.t)}</span>${x.n ? `<small>${noteHtml(x.n)}</small>` : ''}</button>`).join('');
          return `<div class="cp-lcell" style="--k:${c.color}">${inCell}${facts || (inCell ? '' : '<span class="cp-cnone" aria-label="없음">—</span>')}</div>`;
        }).join('');
        body += `<div class="cp-lrow cp-krow cp-crow" data-refs="${refs.join(' ')}">${left}${cells}</div>`;
      });
      const foot = `<div></div>${seg.cols.map(c => `<div class="cp-lfoot" style="--k:${c.color}"></div>`).join('')}`;
      const band = seg.title ? `<p class="cp-lband"><b>${escapeHtml(seg.title)}</b>${seg.note ? `<span>${escapeHtml(seg.note)}</span>` : ''}</p>` : '';
      const bandItem = bandEv ? `<div class="cp-cband">${compareEventHtml(bandEv, '#0d4945')}</div>` : '';
      const cols = `250px ${seg.cols.map(() => 'minmax(0,1fr)').join(' ')}`;
      return `<div class="cp-lseg" data-seg="${escapeHtml(seg.id)}">${band}${bandItem}<div class="cp-lgrid cp-kgrid is-periods is-compare" style="grid-template-columns:${cols}"><div class="cp-khy">${escapeHtml(seg.head || '')}</div>${head}${body}${foot}</div></div>`;
    }).join('')}</div>`;
  }

  // ---- 나라별 칸(색 칼럼) ----
  // 세기 단위로 줄을 맞추고, 한 세기 안에서는 나라 칸마다 사건을 위에서부터 쌓는다.
  // 여러 나라에 걸친 사건은 관련된 칸마다 넣고 "↔ 상대 나라"를 붙인다.
  const centOf = y => (y < 0 ? -Math.ceil(-y / 100) : Math.floor(y / 100) + 1);
  const centName = c => (c < 0 ? `<small>기원전</small>${-c}세기` : `${c}세기`);
  function countryLabels(ev) {
    return (ev.c || []).map(id => {
      const k = countryById.get(id);
      return `<span class="cp-k" style="--k:${k.color}">${escapeHtml(k.short || k.name)}</span>`;
    }).join('');
  }
  function laneTitle(ev, k) {
    // 칸이 나라를 말해 주므로 "고구려, 국내성 천도"의 앞말은 뺀다
    const prefix = `${k.name}, `;
    return ev.t.startsWith(prefix) ? ev.t.slice(prefix.length) : ev.t;
  }
  function laneItemHtml(ev, k) {
    const field = fieldById.get(ev.f);
    const withOthers = (ev.c || []).filter(id => id !== k.id).map(id => {
      const o = countryById.get(id);
      return `<span class="cp-li-w" style="--k2:${o.color}"><span class="sr-only">함께: </span>${escapeHtml(o.short || o.name)}</span>`;
    }).join('');
    const tags = ev.tags.map(t => `<button type="button" class="cp-tag" data-tag="${escapeHtml(t)}" style="--c:${tagColor(t)}" aria-label="주제 태그 ${escapeHtml(t)}로 거르기">${escapeHtml(t)}</button>`).join('');
    const theory = ev.th ? `<a class="cp-th" href="theory.html#${ev.th.id}">이론 정리<span class="sr-only">: ${escapeHtml(ev.th.name)}</span> →</a>` : '';
    const sub = ev.sub ? `<ol class="cp-li-sub">${ev.sub.map(s => `<li>${s.y !== undefined || s.yl ? `<b>${escapeHtml(s.yl || (s.y < 0 ? `기원전 ${-s.y}` : s.y))}</b>` : ''}<strong>${escapeHtml(s.t)}</strong>${s.n ? ` <span>${noteHtml(s.n)}</span>` : ''}</li>`).join('')}</ol>` : '';
    const moreId = `li-${ev.id}-${k.id}`;
    return `<div class="cp-li ${ev.core ? 'is-core' : 'is-minor'}" data-ref="${ev.id}" style="--k:${k.color};--c:${field.color}">
      <button type="button" class="cp-li-btn" data-li aria-expanded="false" aria-controls="${moreId}">
        <span class="cp-li-y">${escapeHtml(yearText(ev))}</span>
        <span class="cp-li-t"><span class="cp-no" hidden></span>${escapeHtml(laneTitle(ev, k))}${withOthers}</span>
      </button>
      <div class="cp-li-more" id="${moreId}" hidden>
        ${ev.n ? `<p class="cp-li-n">${noteHtml(ev.n)}</p>` : ''}${sub}
        <div class="cp-meta"><button type="button" class="cp-field" data-field="${ev.f}" style="--c:${field.color}" aria-label="분야 ${escapeHtml(field.name)}로 거르기">${escapeHtml(field.name)}</button>${tags}${theory}</div>
      </div>
    </div>`;
  }
  // 나라별 칸 안을 왕별로 묶는다(삼국). 왕마다 그 세기의 사건과, 처음 나오는 줄에만 업적 키워드.
  // 전성기 왕은 큰 카드(업적을 목록으로). 왕을 연결하지 않은 나라(가야)는 지금처럼 사건만 쌓는다
  // all(모든 왕, 삼국): 왕은 즉위한 세기 줄에 한 번, 그 왕의 사건은 모두 그 카드에. 카드 높이 = 재위 연수 × px(최소 높이,
  // 내용이 길면 내용만큼). 사건·업적이 있는 왕은 "346~375 · 29년", 자료 없는 왕은 얇은 띠에 "7년"만
  const reignYears = x => Math.max(1, x.e - x.s - (x.s < 0 && x.e > 0 ? 1 : 0)); // 기원전→기원후는 0년이 없음
  function laneKingCellHtml(era, list, c, k, seg) {
    const lk = era.laneKings?.[k.id];
    if (!lk) return list.map(ev => laneItemHtml(ev, k)).join('');
    // 모든 왕 모드에서 칸 구성이 연도 구간(띠)으로 나뉘면, 왕은 즉위한 해가 속한 구간에만 나온다(같은 세기가 두 구간에 걸칠 때 중복 방지)
    const firstY = Math.min(...era.events.map(ev => ev.y));
    const inSeg = x => { const y = Math.max(x.s, firstY); return !seg || ((seg.from === null || y >= seg.from) && (seg.to === null || y <= seg.to)); };
    const kings = lk.kings.filter(x => x.rows.includes(c) && (!lk.all || inSeg(x))).sort((a, b) => a.s - b.s);
    // 특정 왕이 아닌 사건(예: 9세기 선종, 왕 자료가 없는 대가야)은 왕 묶음 밖, 칸 맨 위에
    const loose = list.filter(ev => ev.kn?.[k.id] === undefined);
    const yr = y => (y < 0 ? `기원전 ${-y}` : y);
    const note = lk.looseNote || '시기 전체의 흐름 · 특정 왕 아님';
    const looseHtml = ev => `<div class="cp-lloose">${laneItemHtml(ev, k)}<small>${escapeHtml(note)}</small></div>`;
    // 모든 왕을 보이는 칸은 왕 묶음 밖 사건도 연도 순서로 왕 사이에 끼운다(예: 479 대가야 사신 → 취희왕(421~) 다음)
    const kingHtml = x => {
      // all이면 세기와 관계없이 그 왕의 사건 전부(예: 영양왕 590 즉위 → 6세기 줄에 612 살수 대첩까지)
      const evs = lk.all ? era.events.filter(ev => ev.kn?.[k.id] === x.id && ev.c.includes(k.id)) : list.filter(ev => ev.kn?.[k.id] === x.id);
      const keys = x.keysAt === c ? x.keys || [] : [];
      const span = `${yr(x.s)}~${yr(x.e)}`;
      const n = reignYears(x);
      const items = evs.map(ev => laneItemHtml(ev, k)).join('');
      const all = lk.all ? ` is-all" style="--k:${k.color};min-height:${Math.round(n * lk.px)}px` : `" style="--k:${k.color}`;
      const yrs = lk.all ? `<em class="cp-lyrs">${n}년</em>` : '';
      if (lk.all && x.quiet) {
        return `<div class="cp-lkg cp-lks${all}" title="${escapeHtml(`${x.name} ${span}`)}"><b>${escapeHtml(x.name)}</b>${yrs}</div>`;
      }
      if (x.card) {
        // 카드: 표시 글자(예: 전성기·왕권 강화·건국)와 업적. items가 있으면 업적 대신 그 목록(첫 줄에만)
        const list2 = x.keysAt === c ? (x.card.items || keys) : [];
        return `<div class="cp-lkg cp-lpk${all}" aria-label="${escapeHtml(`${x.name} · ${x.card.note}`)}">
          <div class="cp-lpk-h"><b>${escapeHtml(x.name)}</b><small>${span}</small>${yrs}<span class="cp-lpk-b" title="${escapeHtml(x.card.note)}"${x.card.color ? ` style="background:${x.card.color}"` : ''}>${escapeHtml(x.card.badge)}</span></div>
          ${list2.length ? `<ul class="cp-lpk-keys" aria-label="업적">${list2.map(t => `<li>${noteHtml(t)}</li>`).join('')}</ul>` : ''}${items}</div>`;
      }
      return `<div class="cp-lkg${all}"><div class="cp-lkg-h">${escapeHtml(x.name)}<small>${span}</small>${yrs}</div>${items}${keys.length ? `<div class="cp-lkg-keys" aria-label="업적 키워드">${keys.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}</div>`;
    };
    if (!lk.all) return loose.map(looseHtml).join('') + kings.map(kingHtml).join('');
    const parts = [...kings.map(x => ({ y: x.s, w: 0, html: kingHtml(x) })), ...loose.map(ev => ({ y: ev.y, w: 1, html: looseHtml(ev) }))];
    return parts.sort((a, b) => a.y - b.y || a.w - b.w).map(p => p.html).join('');
  }
  function lanesHtml(era) {
    return `<div class="cp-lanes">${era.lanes.map((seg, si) => {
      const list = era.events.filter(ev => (seg.from === null || ev.y >= seg.from) && (seg.to === null || ev.y <= seg.to));
      const lanes = seg.ids.map(id => countryById.get(id));
      // 첫 칸(세기)은 한 줄 보기의 연도 칸 + 축 폭에 맞춰, 색 칼럼이 축 바로 오른쪽에서 시작하게 한다
      const cols = `var(--lane-label,106px) ${lanes.map(k => `${seg.w?.[k.id] ?? 1}fr`).join(' ')}`;
      // 세기 줄: 사건이 있는 세기 + (모든 왕을 보이는 칸이면) 그 구간에서 왕이 즉위한 세기
      const kingCents = lanes.flatMap(k => era.laneKings?.[k.id]?.all ? era.laneKings[k.id].kings.flatMap(x => x.rows) : [])
        .filter(c => list.some(ev => centOf(ev.y) === c) || ((seg.from === null || c >= centOf(seg.from)) && (seg.to === null || c <= centOf(seg.to))));
      const cents = [...new Set([...list.map(ev => centOf(ev.y)), ...kingCents])].sort((a, b) => a - b);
      const head = lanes.map(k => `<div class="cp-lh" style="--k:${k.color}">${escapeHtml(k.name)}<small>${escapeHtml(k.sub || `${k.s < 0 ? `기원전 ${-k.s}` : k.s} ~ ${k.e ?? ''}`)}</small></div>`).join('');
      const rows = cents.map(c => `<div class="cp-lrow">
          <div class="cp-lc">${centName(c)}</div>
          ${lanes.map(k => `<div class="cp-lcell" style="--k:${k.color}">${laneKingCellHtml(era, list.filter(ev => centOf(ev.y) === c && ev.c.includes(k.id)), c, k, seg)}</div>`).join('')}
        </div>`).join('');
      const foot = `<div></div>${lanes.map(k => `<div class="cp-lfoot" style="--k:${k.color}"></div>`).join('')}`;
      const band = seg.title ? `<p class="cp-lband"><b>${escapeHtml(seg.title)}</b>${seg.note ? `<span>${escapeHtml(seg.note)}</span>` : ''}</p>` : '';
      return `<div class="cp-lseg" data-seg="${si}">${band}<div class="cp-lgrid" style="grid-template-columns:${cols}"><div></div>${head}${rows}${foot}</div></div>`;
    }).join('')}</div>`;
  }

  function render() {
    const fieldCount = id => events.filter(ev => ev.f === id).length;
    const tagGroups = data.fields.map(f => {
      const list = data.tags.filter(t => t.field === f.id && t.count > 0);
      if (!list.length) return '';
      return `<div class="cp-tag-group" style="--c:${f.color}"><span class="cp-group-name">${escapeHtml(f.name)}</span><div class="cp-chips">${list.map(t => `<button type="button" class="cp-chip cp-chip-tag" data-set-tag="${escapeHtml(t.name)}" aria-pressed="false">${escapeHtml(t.name)} <small>${t.count}</small></button>`).join('')}</div></div>`;
    }).join('');
    app.innerHTML = `<div class="cp-wrap">
      <div class="cp-intro">
        <div><p class="eyebrow">흐름으로 꿰는 한국사</p><h1>압축 정리</h1>
        <p>선사부터 현대까지 사건 ${TOTAL}개를 연도 순서대로 한 줄에 이었습니다. 분야나 주제 태그를 누르면 그 사건만 남고, 맨 위에 흐름이 한 줄로 정리됩니다.</p></div>
        <p class="cp-legend"><span><i class="is-core"></i>핵심 사건</span><span><i class="is-minor"></i>더 보기 사건</span><span><i class="is-span"></i>기간</span></p>
      </div>
      <div class="cp-toolbar" id="cp-toolbar">
        <div class="cp-row"><span class="cp-label" id="cp-field-label">분야</span>
          <div class="cp-chips" role="group" aria-labelledby="cp-field-label">
            <button type="button" class="cp-chip" data-set-field="all" aria-pressed="true">전체 <small>${TOTAL}</small></button>
            ${data.fields.map(f => `<button type="button" class="cp-chip cp-chip-field" data-set-field="${f.id}" aria-pressed="false" style="--c:${f.color}"><i aria-hidden="true"></i>${escapeHtml(f.name)} <small>${fieldCount(f.id)}</small></button>`).join('')}
          </div>
        </div>
        <details class="cp-tags" id="cp-tags"${state.tagsOpen ? ' open' : ''}>
          <summary><span class="cp-label">주제</span><span class="cp-tags-help">태그 ${data.tags.filter(t => t.count).length}개 · 하나를 고르면 그 흐름만 남습니다</span></summary>
          <div class="cp-tag-groups">${tagGroups}</div>
        </details>
        <div class="cp-controls">
          <label class="cp-search"><span class="sr-only">사건 검색</span><input id="cp-q" type="search" placeholder="사건·인물·키워드 검색 (예: 서희, 대동법)" autocomplete="off"></label>
          <div class="cp-seg" role="group" aria-label="보기 범위">
            <button type="button" data-view="core" aria-pressed="false">핵심만 <small>${CORE_TOTAL}</small></button>
            <button type="button" data-view="all" aria-pressed="false">전체 <small>${TOTAL}</small></button>
          </div>
          <div class="cp-seg" role="group" aria-label="가리기">
            <button type="button" data-mask="none" aria-pressed="false">가리지 않기</button>
            <button type="button" data-mask="year" aria-pressed="false">연도 가리기</button>
            <button type="button" data-mask="title" aria-pressed="false">사건 가리기</button>
          </div>
          <button type="button" class="cp-mini" id="cp-remask" hidden>다시 가리기</button>
          <span class="cp-buttons"><button type="button" class="cp-mini" data-expand="all">세부 흐름 펼치기</button><button type="button" class="cp-mini" data-expand="none">접기</button><button type="button" class="cp-mini cp-quiz-open" id="cp-quiz-open">순서 맞추기</button></span>
        </div>
      </div>
      <div class="cp-active" id="cp-active" hidden></div>
      <div class="cp-flow" id="cp-flow" hidden></div>
      <div class="cp-layout">
        <nav class="cp-jump" id="cp-jump" aria-label="시대 이동">
          <span class="cp-jump-title">시대 이동</span>
          ${data.eras.map(era => `<button type="button" data-jump="${era.id}"><span>${escapeHtml(era.name)}</span><small data-jump-count="${era.id}"></small></button>`).join('')}
          <button type="button" class="cp-jump-top" data-jump="top">↑ 필터로</button>
        </nav>
        <div class="cp-timeline" id="cp-timeline">
          <p class="cp-status" id="cp-status" role="status" aria-live="polite"></p>
          <div class="cp-sheet">${data.eras.map(eraHtml).join('')}</div>
          <p class="cp-none" id="cp-none" hidden>조건에 맞는 사건이 없습니다. 검색어나 태그를 바꿔 보세요.</p>
        </div>
      </div>
      <p class="footer">기출 해설과 일반적인 교과 서술을 바탕으로 만든 학습용 정리입니다. 연도는 통설을 따랐고, 일부 고대·전근대 연도는 전승 연도입니다.</p>
    </div>`;
  }

  // ---- 거르기 ----
  let elById = new Map();
  let laneById = new Map(); // 사건 id → 나라별 칸의 항목들(여러 나라 사건은 2개 이상)
  let lastFlow = [];
  const filterActive = () => state.field !== 'all' || !!state.tag || !!state.query.trim();

  function matches(ev) {
    const q = state.query.trim().toLowerCase();
    return (state.field === 'all' || ev.f === state.field)
      && (!state.tag || ev.tags.includes(state.tag))
      && (!q || q.split(/\s+/).every(word => ev.search.includes(word)));
  }

  function update({ keepHash = false } = {}) {
    const active = filterActive();
    // 태그·검색 중에는 '핵심만'과 상관없이 해당 사건을 모두 보여 준다(흐름이 끊기지 않게).
    const coreOnly = state.view === 'core' && !state.tag && !state.query.trim();
    const timeline = document.getElementById('cp-timeline');
    timeline.classList.toggle('mask-year', state.mask === 'year');
    timeline.classList.toggle('mask-title', state.mask === 'title');

    let shown = 0;
    let matched = 0;
    let number = 0;
    const flow = [];
    const eraCounts = new Map();
    for (const era of data.eras) {
      let eraShown = 0;
      let eraMatched = 0;
      let prevYear = null;
      for (const ev of era.events) {
        const el = elById.get(ev.id);
        const hit = matches(ev);
        const passCore = !coreOnly || ev.core;
        const visible = passCore && (hit || (active && state.others === 'dim'));
        el.hidden = !visible;
        el.classList.toggle('is-dim', visible && active && !hit);
        el.classList.toggle('is-revealed', revealed.has(ev.id));
        const no = el.querySelector('.cp-no');
        if (visible && hit && state.tag) {
          number++;
          no.textContent = number;
          no.hidden = false;
          flow.push({ ev, n: number, label: flowLabel(ev, state.tag) });
        } else {
          no.hidden = true;
        }
        if (visible) {
          const key = yearText(ev);
          el.classList.toggle('is-same-year', key === prevYear);
          prevYear = key;
          eraShown++;
          if (hit) eraMatched++;
        }
        // 나라별 칸의 같은 사건(여러 칸에 있을 수 있음)도 한 줄 보기와 똑같이 맞춘다
        for (const li of laneById.get(ev.id) || []) {
          li.hidden = el.hidden;
          li.classList.toggle('is-dim', el.classList.contains('is-dim'));
          li.classList.toggle('is-revealed', revealed.has(ev.id));
          const liNo = li.querySelector('.cp-no');
          liNo.hidden = no.hidden;
          liNo.textContent = no.textContent;
        }
      }
      const section = document.getElementById(`era-${era.id}`);
      section.hidden = eraShown === 0;
      if (era.lanes || era.kingLanes || era.compare) {
        section.classList.add('is-lanes');
        // 보이는 사건이 없는 세기 줄과 구간은 접는다.
        // 왕대 연표는 거르지 않을 때 모든 왕 줄을 남겨 시간이 끊기지 않게 하고, 거를 때만 빈 왕 줄을 접는다
        // 비교표 줄은 그 줄에 연결된 사건(줄 머리·칸·구간 띠) 중 하나라도 보이면 남긴다
        section.querySelectorAll('.cp-lrow').forEach(row => {
          if (row.classList.contains('cp-crow')) {
            const refs = row.dataset.refs.split(' ').filter(Boolean);
            row.hidden = active && !refs.some(id => elById.get(id) && !elById.get(id).hidden);
            return;
          }
          // 나라별 칸의 왕 묶음: 거를 때는 보이는 사건이 없는 왕을 접고, 거르지 않을 때는 키워드만 있는 왕도 남긴다
          // 모든 왕을 보이는 칸(is-all)은 거르지 않을 때(핵심만 보기 포함) 모든 왕이 남아 왕 순서와 시간이 끊기지 않는다
          row.querySelectorAll('.cp-lkg').forEach(g => { g.hidden = !g.querySelector('.cp-li:not([hidden])') && (active || coreOnly && !g.classList.contains('is-all') && !g.querySelector('.cp-lkg-keys,.cp-lpk-keys')); });
          // 왕대 연표 흰 카드(box): 안의 사건이 모두 숨으면 빈 카드도 숨긴다
          row.querySelectorAll('.cp-kbox').forEach(b => { b.hidden = !b.querySelector('.cp-li:not([hidden])'); });
          const has = !!row.querySelector('.cp-li:not([hidden])') || !!row.querySelector('.cp-lkg:not([hidden])');
          row.hidden = row.classList.contains('cp-krow') ? active && !has : !has;
        });
        section.querySelectorAll('.cp-kphase').forEach(p => {
          p.hidden = !section.querySelector(`.cp-krow[data-phase="${p.dataset.phase}"]:not([hidden])`);
        });
        section.querySelectorAll('.cp-lseg').forEach(seg => { seg.hidden = !seg.querySelector('.cp-lrow:not([hidden])'); });
      }
      const count = active ? eraMatched : eraShown;
      section.querySelector('[data-era-count]').textContent = `${count}개`;
      eraCounts.set(era.id, count);
      shown += eraShown;
      matched += eraMatched;
    }

    document.querySelectorAll('[data-jump-count]').forEach(el => { el.textContent = eraCounts.get(el.dataset.jumpCount) || ''; });
    document.querySelectorAll('[data-jump]').forEach(btn => {
      if (btn.dataset.jump === 'top') return;
      btn.disabled = !eraCounts.get(btn.dataset.jump);
    });

    // 위쪽 버튼 상태
    document.querySelectorAll('[data-set-field]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setField === state.field)));
    document.querySelectorAll('[data-set-tag]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setTag === state.tag)));
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    document.querySelectorAll('[data-mask]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mask === state.mask)));
    // 비교표 항목의 드러냄 상태(가리기에서 누른 항목, id는 "f:"로 시작)
    document.querySelectorAll('.cp-cf').forEach(x => x.classList.toggle('is-revealed', revealed.has(x.dataset.cf)));
    document.getElementById('cp-remask').hidden = state.mask === 'none' || !revealed.size;

    renderActive(matched);
    renderFlow(flow);
    lastFlow = flow;

    const status = document.getElementById('cp-status');
    if (active) {
      status.textContent = `조건에 맞는 사건 ${matched}개${state.others === 'dim' && shown > matched ? ` · 나머지 ${shown - matched}개는 흐리게` : ''}`;
    } else {
      status.textContent = coreOnly ? `핵심 사건 ${shown}개 표시 중 · '전체'를 누르면 ${TOTAL}개` : `전체 사건 ${shown}개 표시 중`;
    }
    document.getElementById('cp-none').hidden = !((active && matched === 0) || shown === 0);
    if (!keepHash) writeHash();
  }

  function renderActive(matched) {
    const box = document.getElementById('cp-active');
    const parts = [];
    if (state.field !== 'all') {
      const f = fieldById.get(state.field);
      parts.push(`<button type="button" class="cp-pill" data-clear="field" style="--c:${f.color}">분야: ${escapeHtml(f.name)} <span aria-hidden="true">✕</span><span class="sr-only">해제</span></button>`);
    }
    if (state.tag) parts.push(`<button type="button" class="cp-pill" data-clear="tag" style="--c:${tagColor(state.tag)}">주제: ${escapeHtml(state.tag)} <span aria-hidden="true">✕</span><span class="sr-only">해제</span></button>`);
    if (state.query.trim()) parts.push(`<button type="button" class="cp-pill" data-clear="query">검색: ${escapeHtml(state.query.trim())} <span aria-hidden="true">✕</span><span class="sr-only">해제</span></button>`);
    if (!parts.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<div class="cp-active-pills">${parts.join('')}<button type="button" class="cp-mini" data-clear="all">모두 해제</button></div>
      <div class="cp-seg cp-seg-small" role="group" aria-label="조건에 맞지 않는 사건">
        <span class="cp-seg-label">나머지 사건</span>
        <button type="button" data-others="hide" aria-pressed="${state.others === 'hide'}">숨기기</button>
        <button type="button" data-others="dim" aria-pressed="${state.others === 'dim'}">흐리게</button>
      </div>
      <span class="cp-active-count">${matched}개</span>`;
  }

  function renderFlow(flow) {
    const box = document.getElementById('cp-flow');
    if (!state.tag || !flow.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.style.setProperty('--c', tagColor(state.tag));
    box.innerHTML = `<p class="cp-flow-title"><b>${escapeHtml(state.tag)}</b>의 흐름 <small>${flow.length}단계 · 누르면 그 사건으로 이동</small></p>
      <ol class="cp-flow-list">${flow.map((item, i) => `<li>${i ? '<span class="cp-flow-arrow" aria-hidden="true">→</span>' : ''}<button type="button" data-goto="${item.ev.id}"><span class="cp-flow-no">${item.n}</span><span class="cp-flow-label">${escapeHtml(item.label)}</span><small class="cp-flow-year">${escapeHtml(yearText(item.ev))}</small></button></li>`).join('')}</ol>`;
  }

  // ---- 주소(#tag=토지&field=eco&q=...) ----
  function writeHash() {
    const params = new URLSearchParams();
    if (state.field !== 'all') params.set('field', state.field);
    if (state.tag) params.set('tag', state.tag);
    if (state.query.trim()) params.set('q', state.query.trim());
    const hash = params.toString();
    const url = hash ? `#${hash}` : location.pathname + location.search;
    if ((hash ? `#${hash}` : '') !== location.hash) history.replaceState(null, '', url);
  }
  function readHash() {
    const raw = location.hash.slice(1);
    if (!raw) return null;
    if (raw.startsWith('era-') || byId.has(raw)) return raw;
    const params = new URLSearchParams(raw);
    const field = params.get('field');
    const tag = params.get('tag');
    state.field = field && fieldById.has(field) ? field : 'all';
    state.tag = tag && tagInfo.has(tag) ? tag : null;
    state.query = params.get('q') || '';
    const input = document.getElementById('cp-q');
    if (input) input.value = state.query;
    return params.get('era') ? `era-${params.get('era')}` : null;
  }

  // ---- 이동 ----
  function scrollToEl(el, block = 'start') {
    if (!el) return;
    el.scrollIntoView({ behavior: scrollBehavior, block });
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1800);
  }
  // 지금 화면에 실제로 보이는 쪽(나라별 칸 항목 또는 한 줄 항목)
  function shownElFor(id) {
    const li = (laneById.get(id) || []).find(node => node.offsetParent !== null);
    return li || elById.get(id);
  }
  const refOf = node => node.closest('.cp-li')?.dataset.ref || node.closest('.cp-ev')?.id;
  function gotoEvent(id) {
    const el = elById.get(id);
    if (!el) return;
    if (el.hidden) {
      // 숨은 사건이면 보기 범위를 넓혀서라도 보여 준다
      state.view = 'all';
      savePrefs();
      update();
    }
    const target = shownElFor(id);
    scrollToEl(target, 'center');
    flash(target);
  }
  function revealEvent(id) {
    revealed.add(id);
    elById.get(id)?.classList.add('is-revealed');
    (laneById.get(id) || []).forEach(li => li.classList.add('is-revealed'));
    document.getElementById('cp-remask').hidden = false;
  }
  function setLaneMore(li, open) {
    const more = li.querySelector('.cp-li-more');
    more.hidden = !open;
    li.querySelector('.cp-li-btn').setAttribute('aria-expanded', String(open));
    li.classList.toggle('is-open', open);
  }
  function setSub(id, open) {
    const el = elById.get(id);
    const list = el?.querySelector('.cp-sub');
    const btn = el?.querySelector('.cp-subtoggle');
    if (!list || !btn) return;
    list.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) openSubs.add(id); else openSubs.delete(id);
  }

  // ---- 순서 맞추기 ----
  const quiz = { items: [], picks: [], checked: false, scope: '' };
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function newQuiz() {
    // 지금 화면에 보이는(조건에 맞는) 사건 중, 연도가 정확하고 서로 다른 해인 사건만 고른다
    const pool = events.filter(ev => {
      const el = elById.get(ev.id);
      return !el.hidden && !el.classList.contains('is-dim') && !ev.yl;
    });
    const seen = new Set();
    const picked = [];
    for (const ev of shuffle(pool)) {
      if (seen.has(ev.y)) continue;
      seen.add(ev.y);
      picked.push(ev);
      if (picked.length === 5) break;
    }
    quiz.items = shuffle(picked);
    quiz.picks = [];
    quiz.checked = false;
    const scope = [];
    if (state.field !== 'all') scope.push(`분야 ${fieldById.get(state.field).name}`);
    if (state.tag) scope.push(`주제 ${state.tag}`);
    if (state.query.trim()) scope.push(`검색 "${state.query.trim()}"`);
    quiz.scope = scope.length ? scope.join(' · ') : (state.view === 'core' ? '핵심 사건 전체' : '전체 사건');
    renderQuiz();
  }
  function renderQuiz() {
    const enough = quiz.items.length >= 3;
    const correctOrder = quiz.items.slice().sort((a, b) => a.y - b.y || (a.m || 0) - (b.m || 0));
    const rankOf = ev => correctOrder.indexOf(ev) + 1;
    const score = quiz.checked ? quiz.items.filter(ev => quiz.picks.indexOf(ev) + 1 === rankOf(ev)).length : 0;
    quizDialog.innerHTML = `<form method="dialog" class="cp-quiz-body">
      <div class="cp-quiz-head"><h2 id="cp-quiz-title">순서 맞추기</h2><button type="submit" class="cp-quiz-close" aria-label="닫기">✕</button></div>
      <p class="cp-quiz-scope">범위: ${escapeHtml(quiz.scope)}</p>
      ${enough ? `<p class="cp-quiz-help">${quiz.checked ? `${quiz.items.length}개 중 <b>${score}개</b> 맞혔습니다.` : '먼저 일어난 사건부터 차례로 누르세요. 다시 누르면 취소됩니다.'}</p>
      <ol class="cp-quiz-list">${quiz.items.map((ev, i) => {
        const pick = quiz.picks.indexOf(ev) + 1;
        const right = quiz.checked && pick === rankOf(ev);
        const state2 = quiz.checked ? (right ? 'is-right' : 'is-wrong') : pick ? 'is-picked' : '';
        return `<li><button type="button" class="cp-quiz-card ${state2}" data-quiz="${i}" ${quiz.checked ? 'disabled' : ''} style="--c:${fieldById.get(ev.f).color}">
          <span class="cp-quiz-pick" aria-label="${pick ? `${pick}번째로 고름` : '아직 안 고름'}">${pick || ''}</span>
          <span class="cp-quiz-text"><b>${escapeHtml(ev.t)}</b>${quiz.checked ? `<small>${escapeHtml(yearText(ev))} · 정답 ${rankOf(ev)}번째</small>` : ''}</span>
        </button></li>`;
      }).join('')}</ol>
      ${quiz.checked ? `<p class="cp-quiz-answer">정답 순서: ${correctOrder.map(ev => `${escapeHtml(ev.t)}(${escapeHtml(yearText(ev))})`).join(' → ')}</p>` : ''}
      <div class="cp-quiz-actions">
        ${quiz.checked ? '<button type="button" class="button primary" data-quiz-action="new">새 문제</button>' : `<button type="button" class="button secondary" data-quiz-action="reset" ${quiz.picks.length ? '' : 'disabled'}>다시 고르기</button><button type="button" class="button primary" data-quiz-action="check" ${quiz.picks.length === quiz.items.length ? '' : 'disabled'}>정답 확인</button>`}
      </div>` : `<p class="cp-quiz-help">지금 보이는 사건 가운데 연도가 서로 다른 사건이 3개보다 적어서 문제를 만들 수 없습니다. 태그나 검색을 바꾸거나 '전체'로 넓혀 보세요.</p>
      <div class="cp-quiz-actions"><button type="submit" class="button secondary">닫기</button></div>`}
    </form>`;
  }
  quizDialog.addEventListener('click', event => {
    if (event.target === quizDialog) { quizDialog.close(); return; } // 바깥(배경) 누르면 닫기
    const card = event.target.closest('[data-quiz]');
    if (card && !quiz.checked) {
      const ev = quiz.items[Number(card.dataset.quiz)];
      const at = quiz.picks.indexOf(ev);
      if (at >= 0) quiz.picks.splice(at, 1); else quiz.picks.push(ev);
      renderQuiz();
      quizDialog.querySelector(`[data-quiz="${card.dataset.quiz}"]`)?.focus();
      return;
    }
    const action = event.target.closest('[data-quiz-action]')?.dataset.quizAction;
    if (action === 'reset') { quiz.picks = []; renderQuiz(); quizDialog.querySelector('[data-quiz]')?.focus(); }
    if (action === 'check') { quiz.checked = true; renderQuiz(); quizDialog.querySelector('[data-quiz-action="new"]')?.focus(); }
    if (action === 'new') { newQuiz(); quizDialog.querySelector('[data-quiz]')?.focus(); }
  });

  // ---- 이벤트 ----
  function setField(field) { state.field = state.field === field ? 'all' : field; update(); }
  // 누른 사건이 거른 뒤에도 남아 있으면 그 자리로 다시 데려간다
  function keepInView(id) {
    if (!id || elById.get(id).hidden) return false;
    const target = shownElFor(id);
    scrollToEl(target, 'center');
    flash(target);
    return true;
  }
  function setTag(tag, anchorId) {
    state.tag = state.tag === tag ? null : tag;
    update();
    if (!keepInView(anchorId) && state.tag) scrollToEl(document.getElementById('cp-active'));
  }

  function bind() {
    app.addEventListener('click', event => {
      const t = event.target;
      const fieldBtn = t.closest('[data-set-field]');
      if (fieldBtn) { state.field = fieldBtn.dataset.setField; update(); return; }
      const tagBtn = t.closest('[data-set-tag]');
      if (tagBtn) { setTag(tagBtn.dataset.setTag); return; }
      const evTag = t.closest('.cp-tag');
      if (evTag) { setTag(evTag.dataset.tag, refOf(evTag)); return; }
      const evField = t.closest('.cp-field');
      if (evField) {
        const id = refOf(evField);
        setField(evField.dataset.field);
        keepInView(id);
        return;
      }
      // 비교표 항목: 이름 가리기 중에는 누르면 그 항목만 드러난다
      const cf = t.closest('[data-cf]');
      if (cf) {
        if (state.mask === 'title' && !revealed.has(cf.dataset.cf)) {
          revealed.add(cf.dataset.cf);
          cf.classList.add('is-revealed');
          document.getElementById('cp-remask').hidden = false;
        }
        return;
      }
      const laneBtn = t.closest('[data-li]');
      if (laneBtn) {
        const li = laneBtn.closest('.cp-li');
        // 가리기 중에는 첫 번째 누름으로 가린 곳을 드러내고, 그다음부터 요점을 펼친다
        if (state.mask !== 'none' && !revealed.has(li.dataset.ref)) { revealEvent(li.dataset.ref); return; }
        setLaneMore(li, laneBtn.getAttribute('aria-expanded') !== 'true');
        return;
      }
      const view = t.closest('[data-view]');
      if (view) { state.view = view.dataset.view; savePrefs(); update(); return; }
      const mask = t.closest('[data-mask]');
      if (mask) {
        state.mask = mask.dataset.mask;
        revealed.clear();
        // 펼쳐 둔 요점이 답을 보여 주지 않도록 접는다
        document.querySelectorAll('.cp-li.is-open').forEach(li => setLaneMore(li, false));
        savePrefs();
        update();
        return;
      }
      const others = t.closest('[data-others]');
      if (others) { state.others = others.dataset.others; savePrefs(); update(); return; }
      const reveal = t.closest('[data-reveal]');
      if (reveal) {
        revealed.add(reveal.dataset.reveal);
        const el = elById.get(reveal.dataset.reveal);
        el.classList.add('is-revealed');
        document.getElementById('cp-remask').hidden = false;
        // 눌렀던 가림 버튼이 사라지므로, 드러난 칸으로 초점을 옮긴다
        const shownCell = el.querySelector(state.mask === 'year' ? '.cp-y' : '.cp-main');
        if (shownCell) { shownCell.setAttribute('tabindex', '-1'); shownCell.focus({ preventScroll: true }); }
        return;
      }
      if (t.closest('#cp-remask')) { revealed.clear(); update(); return; }
      const sub = t.closest('[data-sub]');
      if (sub) { setSub(sub.dataset.sub, sub.getAttribute('aria-expanded') !== 'true'); return; }
      const expand = t.closest('[data-expand]');
      if (expand) {
        const open = expand.dataset.expand === 'all';
        events.forEach(ev => { if (ev.sub) setSub(ev.id, open); });
        // 나라별 칸은 세부 흐름이 있는 사건만 펼치고, '접기'는 모두 접는다
        document.querySelectorAll('.cp-li').forEach(li => {
          if (!open) setLaneMore(li, false);
          else if (byId.get(li.dataset.ref)?.sub) setLaneMore(li, true);
        });
        return;
      }
      const clear = t.closest('[data-clear]');
      if (clear) {
        const what = clear.dataset.clear;
        if (what === 'field' || what === 'all') state.field = 'all';
        if (what === 'tag' || what === 'all') state.tag = null;
        if (what === 'query' || what === 'all') { state.query = ''; document.getElementById('cp-q').value = ''; }
        update();
        return;
      }
      const go = t.closest('[data-goto]');
      if (go) { gotoEvent(go.dataset.goto); return; }
      const jump = t.closest('[data-jump]');
      if (jump) {
        if (jump.dataset.jump === 'top') { scrollToEl(document.getElementById('cp-toolbar')); return; }
        scrollToEl(document.getElementById(`era-${jump.dataset.jump}`));
        return;
      }
      if (t.closest('#cp-quiz-open')) {
        newQuiz();
        quizDialog.showModal();
        quizDialog.querySelector('[data-quiz]')?.focus();
      }
    });
    let timer = null;
    app.addEventListener('input', event => {
      if (event.target.id !== 'cp-q') return;
      clearTimeout(timer);
      timer = setTimeout(() => { state.query = event.target.value; update(); }, 120);
    });
    document.getElementById('cp-tags').addEventListener('toggle', event => { state.tagsOpen = event.target.open; savePrefs(); });
    window.addEventListener('hashchange', () => {
      const target = readHash();
      update({ keepHash: true });
      jumpTarget(target);
    });
    // 인쇄할 때는 가리기를 풀고 세부 흐름을 모두 펼친다(CSS에서 처리)
  }

  function jumpTarget(target) {
    if (!target) return;
    if (target.startsWith('era-')) { scrollToEl(document.getElementById(target)); return; }
    if (byId.has(target)) gotoEvent(target);
  }

  // 보고 있는 시대를 시대 이동 버튼에 표시
  function watchEras() {
    if (!('IntersectionObserver' in window)) return;
    const visible = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => visible.set(e.target.dataset.era, e.isIntersecting ? e.boundingClientRect.top : null));
      let current = null;
      let best = Infinity;
      for (const [id, top] of visible) if (top !== null && Math.abs(top) < best) { best = Math.abs(top); current = id; }
      document.querySelectorAll('.cp-jump [data-jump]').forEach(b => {
        if (b.dataset.jump === current) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }, { rootMargin: '-15% 0px -60% 0px' });
    document.querySelectorAll('.cp-era').forEach(s => observer.observe(s));
  }

  render();
  elById = new Map(events.map(ev => [ev.id, document.getElementById(ev.id)]));
  laneById = new Map();
  document.querySelectorAll('.cp-li').forEach(li => {
    if (!laneById.has(li.dataset.ref)) laneById.set(li.dataset.ref, []);
    laneById.get(li.dataset.ref).push(li);
  });
  const target = readHash();
  bind();
  update({ keepHash: true });
  watchEras();
  jumpTarget(target);
})();
