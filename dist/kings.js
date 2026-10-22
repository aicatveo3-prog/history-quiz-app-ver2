"use strict";
// 왕 연표 페이지: window.KINGS(kings-data.js)를 구간별로 나라를 나란히 놓고, 재위 기간만큼 띠를 그린다.
(() => {
  const data = window.KINGS;
  const app = document.getElementById('kings-app');
  if (!app) return;
  if (!data) { app.innerHTML = '<p class="kt-empty">왕 연표 자료를 불러오지 못했습니다.</p>'; return; }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 기원전 1년 바로 다음 해가 기원후 1년이므로(0년 없음) 계산용 연도로 바꾼다.
  const ax = y => (y < 0 ? y + 1 : y);
  const reignYears = (s, e) => ax(e) - ax(s);
  const yearLabel = y => (y < 0 ? `기원전 ${-y}` : String(y));
  const tickLabel = y => (y < 0 ? `BC ${-y}` : String(y));
  const lengthLabel = (s, e) => (reignYears(s, e) === 0 ? '1년 미만' : `${reignYears(s, e)}년`);
  const range = r => `${yearLabel(r.s)} ~ ${yearLabel(r.e)}`;

  const kingdoms = new Map(data.kingdoms.map(k => [k.id, k]));
  const reigns = [];
  data.kingdoms.forEach(k => k.kings.forEach((r, i) => reigns.push({ ...r, id: `${k.id}-${i}`, kingdom: k })));
  const reignById = new Map(reigns.map(r => [r.id, r]));
  const kingCount = reigns.filter(r => !r.r).length;

  const ZOOMS = [{ px: 2, label: '축소' }, { px: 4, label: '기본' }, { px: 8, label: '확대' }];
  const STORE_KEY = 'korean-history-kings-zoom';
  const readZoom = () => { try { return Number(localStorage.getItem(STORE_KEY)); } catch { return 0; } };
  const saveZoom = v => { try { localStorage.setItem(STORE_KEY, String(v)); } catch { /* 저장이 막힌 환경은 무시 */ } };
  let scale = ZOOMS.some(z => z.px === readZoom()) ? readZoom() : 4;
  let pickedId = null;

  // 재위 구간 겹침 판단. 1년이 안 되는 재위(즉위한 해에 물러남)는 반년 길이로 본다.
  const interval = r => { const lo = ax(r.s), hi = ax(r.e); return [lo, hi > lo ? hi : lo + 0.5]; };
  const overlaps = (a, b) => { const [a1, a2] = interval(a), [b1, b2] = interval(b); return a1 < b2 && b1 < a2; };

  // 구간 안에 들어오는 재위인지(즉위한 해에 물러난 왕은 그 해가 구간 안이면 포함)
  const inSection = (r, sec) => {
    const s = ax(r.s), e = ax(r.e), lo = ax(sec.start), hi = ax(sec.end);
    return s === e ? s >= lo && s <= hi : e > lo && s < hi;
  };

  function bandHtml(r, sec, wide, afterMark) {
    const secStart = ax(sec.start), secEnd = ax(sec.end);
    const s = ax(r.s), e = ax(r.e);
    const from = Math.max(s, secStart), to = Math.min(e, secEnd);
    const top = (from - secStart) * scale;
    const k = r.kingdom;
    const label = `${k.name} ${r.n}대 ${r.name}${r.r ? '(복위)' : ''}, ${range(r)} 재위(${lengthLabel(r.s, r.e)})${r.u ? ', 연도 불확실' : ''}${r.l ? ', 전승 연도' : ''}`;
    const style = `--c:${k.color};--ink:${k.ink};--t:${k.tints[r.n % 2]}`;
    if (s === e) {
      // 1년이 안 되는 재위: 즉위한 해의 선 위에 이름만 작게 붙인다.
      return `<button type="button" class="kt-mark${r.u || r.l ? ' is-uncertain' : ''}" data-id="${r.id}" style="top:${top}px;${style}" aria-label="${esc(label)}"><span>${r.n}대 ${esc(r.name)} · ${yearLabel(r.s)} · 1년 미만</span></button>`;
    }
    const h = (to - from) * scale;
    const size = h >= 34 ? 'l' : h >= 17 ? 'm' : h >= 10 ? 's' : 'xs';
    const cls = ['kt-band', `size-${size}`];
    if (s < secStart) cls.push('is-cut-top');
    if (e > secEnd) cls.push('is-cut-bottom');
    if (r.u || r.l) cls.push('is-uncertain');
    if (afterMark) cls.push('after-mark');
    const flag = r.u ? '<abbr title="연도 불확실">?</abbr>' : '';
    const restored = r.r ? '<em>복위</em>' : '';
    // 넓은 칸의 짧은 재위는 오른쪽 이름표로 보여 주므로, 바로 앞 이름표와 겹치면 아래로 민다.
    let nudge = '';
    if (wide && (size === 's' || size === 'xs')) {
      const center = top + h / 2;
      const dy = pillCursor.last === null ? 0 : Math.max(0, pillCursor.last + 24 - center);
      pillCursor.last = center + dy;
      if (dy) nudge = `;--dy:${dy}px`;
    } else if (wide) {
      pillCursor.last = null;
    }
    return `<button type="button" class="${cls.join(' ')}" data-id="${r.id}" style="top:${top}px;height:${h}px;${style}${nudge}" aria-label="${esc(label)}">
      <span class="kt-label"><span class="kt-name"><small>${r.n}대</small> ${esc(r.name)}${restored}</span>${wide && r.alt ? `<span class="kt-alt">${esc(r.alt)}</span>` : ''}
      <span class="kt-years"><span>${r.s < 0 ? 'BC ' + -r.s : r.s}~${r.e < 0 ? 'BC ' + -r.e : r.e}</span> <span>· ${lengthLabel(r.s, r.e)}${flag}</span></span></span>
    </button>`;
  }

  function ticksHtml(sec) {
    const secStart = ax(sec.start);
    const labelStep = scale >= 4 ? 10 : 50;
    const ticks = [], lines = [];
    const first = Math.ceil(sec.start / 10) * 10;
    for (let y = first; y <= sec.end; y += 10) {
      if (y === 0) continue;
      const top = (ax(y) - secStart) * scale;
      const major = y % labelStep === 0;
      lines.push(`<i class="${y % 100 === 0 ? 'is-century' : major ? 'is-major' : ''}" style="top:${top}px"></i>`);
      if (major) ticks.push(`<span class="kt-tick${y % 100 === 0 ? ' is-century' : ''}" style="top:${top}px">${tickLabel(y)}</span>`);
    }
    return { ticks: ticks.join(''), lines: lines.join('') };
  }

  const pillCursor = { last: null };
  function laneHtml(lane, sec, wide) {
    const secStart = ax(sec.start), secEnd = ax(sec.end);
    const parts = [];
    pillCursor.last = null;
    const first = kingdoms.get(lane.kingdoms[0]);
    if (ax(first.start) > secStart) {
      parts.push(`<span class="kt-edge is-start" style="top:${(ax(first.start) - secStart) * scale}px;--c:${first.color}">${yearLabel(first.start)} 건국</span>`);
    }
    for (const id of lane.kingdoms) {
      const k = kingdoms.get(id);
      const list = k.kings.map((r, i) => reignById.get(`${k.id}-${i}`)).filter(r => inSection(r, sec));
      const markYears = new Set(list.filter(r => r.s === r.e).map(r => r.s));
      list.forEach(r => parts.push(bandHtml(r, sec, wide, r.s !== r.e && markYears.has(r.s))));
      if (k.endNote && ax(k.end) < secEnd && ax(k.end) > secStart) {
        parts.push(`<span class="kt-edge" style="top:${(ax(k.end) - secStart) * scale}px;--c:${k.color}">${esc(k.endNote)}</span>`);
      }
    }
    return `<div class="kt-lane">${parts.join('')}</div>`;
  }

  function sectionHtml(sec) {
    const wide = sec.lanes.length === 1;
    const height = (ax(sec.end) - ax(sec.start)) * scale;
    const shown = new Set();
    sec.lanes.forEach(l => l.kingdoms.forEach(id => kingdoms.get(id).kings.forEach(r => {
      if (inSection(r, sec)) shown.add(`${id}-${r.n}`);
    })));
    const { ticks, lines } = ticksHtml(sec);
    const heads = sec.lanes.map(l => {
      const k = kingdoms.get(l.kingdoms[0]);
      return `<span class="kt-lane-name" style="--c:${k.color}">${esc(l.label)}</span>`;
    }).join('');
    return `<section class="kt-section" id="sec-${sec.id}" data-sec="${sec.id}" aria-labelledby="h-${sec.id}">
      <header class="kt-sec-head"><h2 id="h-${sec.id}">${esc(sec.name)}</h2><p>${yearLabel(sec.start)} ~ ${yearLabel(sec.end)} · 왕 ${shown.size}명</p></header>
      ${sec.note ? `<p class="kt-note">${esc(sec.note)}</p>` : ''}
      <div class="kt-frame${wide ? ' is-wide' : ''}" style="--lanes:${sec.lanes.length}">
        <div class="kt-lanehead" aria-hidden="true"><span></span>${heads}</div>
        <div class="kt-chart" data-sec="${sec.id}" style="height:${height}px">
          <div class="kt-grid" aria-hidden="true">${lines}</div>
          <div class="kt-axis" aria-hidden="true">${ticks}</div>
          ${sec.lanes.map(l => laneHtml(l, sec, wide)).join('')}
        </div>
      </div>
    </section>`;
  }

  function render() {
    app.innerHTML = `<div class="kt-wrap">
      <div class="kt-intro">
        <p class="eyebrow">시간 순서로 보는 왕</p>
        <h1>왕 연표</h1>
        <p>삼국부터 대한제국까지 왕 ${kingCount}명을 같은 연도 눈금 위에 나라별로 나란히 놓았습니다. 띠 길이가 재위 기간이고, 진한 선이 즉위한 해입니다. 왕을 누르면 재위 정보와 같은 시기 다른 나라 왕을 보여 줍니다.</p>
      </div>
      <div class="kt-toolbar">
        <nav class="kt-jump" aria-label="시대로 이동">${data.sections.map(s => `<a href="#sec-${s.id}">${esc(s.name)}</a>`).join('')}</nav>
        <div class="kt-zoom" role="group" aria-label="눈금 간격">${ZOOMS.map(z => `<button type="button" data-zoom="${z.px}" aria-pressed="${z.px === scale}">${z.label}</button>`).join('')}</div>
      </div>
      <p class="kt-legend"><span><i class="kt-key kt-key-band"></i>띠 길이 = 재위 기간</span><span><i class="kt-key kt-key-line"></i>즉위한 해</span><span><i class="kt-key kt-key-dash"></i>연도가 불확실하거나 전승 연도</span></p>
      <div id="kt-sections">${data.sections.map(sectionHtml).join('')}</div>
      <p class="footer">재위 연도는 『삼국사기』·『삼국유사』·『고려사』·『조선왕조실록』에 따른 일반적인 연도입니다. 즉위한 해와 물러난 해를 표시하며, 책마다 1년 정도 차이가 날 수 있습니다.</p>
    </div>
    <aside class="kt-sheet" id="kt-sheet" aria-live="polite" hidden></aside>`;
    measureBar();
    applyPick();
  }

  // ---- 선택한 왕의 정보 ----
  function sheetHtml(r) {
    const k = r.kingdom;
    const periods = k.kings.filter(x => x.n === r.n && x.name === r.name);
    const near = new Map();
    for (const other of reigns) {
      if (other.kingdom === k || !overlaps(r, other)) continue;
      if (!near.has(other.kingdom.id)) near.set(other.kingdom.id, []);
      const list = near.get(other.kingdom.id);
      if (!list.some(x => x.name === other.name && x.n === other.n)) list.push(other);
    }
    const notes = [];
    if (periods.length > 1) notes.push(`물러났다가 다시 즉위했습니다: ${periods.map(p => `${range(p)}${p.r ? '(복위)' : ''}`).join(', ')}`);
    if (r.u) notes.push('재위 연도가 확실하지 않아 책마다 다르게 적혀 있습니다.');
    if (r.l) notes.push('『삼국유사』 가락국기에 전하는 연도로, 실제와 다를 수 있습니다.');
    if (r.note) notes.push(r.note);
    const nearHtml = near.size
      ? `<ul class="kt-near">${[...near].map(([id, list]) => `<li><b style="--c:${kingdoms.get(id).color}">${esc(kingdoms.get(id).name)}</b><span>${list.map(x => `<button type="button" data-pick="${x.id}">${esc(x.name)}</button>`).join('')}</span></li>`).join('')}</ul>`
      : '<p class="kt-none">같은 시기에 재위한 다른 나라 왕이 없습니다.</p>';
    const total = periods.reduce((sum, p) => sum + reignYears(p.s, p.e), 0);
    return `<div class="kt-sheet-card" style="--c:${k.color}">
      <button type="button" class="kt-close" data-close aria-label="닫기">×</button>
      <p class="kt-sheet-kingdom">${esc(k.name)} · ${r.n}대</p>
      <h3 id="kt-sheet-title">${esc(r.name)}${r.alt ? ` <small>${esc(r.alt)}</small>` : ''}</h3>
      <p class="kt-sheet-years">${range(r)} <span>재위 ${periods.length > 1 ? `모두 ${total}년` : lengthLabel(r.s, r.e)}</span></p>
      ${notes.map(n => `<p class="kt-sheet-note">${esc(n)}</p>`).join('')}
      <h4>같은 시기 다른 나라 왕</h4>
      ${nearHtml}
    </div>`;
  }

  function applyPick() {
    const sheet = document.getElementById('kt-sheet');
    const r = pickedId && reignById.get(pickedId);
    const nearIds = new Set();
    if (r) reigns.forEach(o => { if (o.kingdom !== r.kingdom && overlaps(r, o)) nearIds.add(o.id); });
    const sameKing = r ? new Set(r.kingdom.kings.map((x, i) => (x.n === r.n && x.name === r.name ? `${r.kingdom.id}-${i}` : null)).filter(Boolean)) : new Set();
    document.querySelectorAll('.kt-band, .kt-mark').forEach(el => {
      const id = el.dataset.id;
      el.classList.toggle('is-picked', sameKing.has(id));
      el.classList.toggle('is-near', nearIds.has(id));
      el.classList.toggle('is-dim', Boolean(r) && !sameKing.has(id) && !nearIds.has(id));
      el.setAttribute('aria-pressed', String(sameKing.has(id)));
    });
    app.classList.toggle('has-pick', Boolean(r));
    if (!r) { sheet.hidden = true; sheet.innerHTML = ''; return; }
    sheet.innerHTML = sheetHtml(r);
    sheet.hidden = false;
  }

  function pick(id, { scroll = false } = {}) {
    pickedId = id;
    applyPick();
    if (scroll) {
      const el = document.querySelector(`[data-id="${id}"]`);
      el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el?.focus({ preventScroll: true });
    }
  }

  // ---- 상단 막대 높이(세로 고정 위치 계산용) ----
  function measureBar() {
    const bar = app.querySelector('.kt-toolbar');
    if (!bar) return;
    document.documentElement.style.setProperty('--kt-bar', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  }

  // 눈금을 바꿔도 보고 있던 연도가 같은 자리에 오도록 한다.
  function anchorLine() {
    const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kt-bar')) || 0;
    return bar + 60;
  }
  function currentAnchor() {
    const line = anchorLine();
    for (const chart of document.querySelectorAll('.kt-chart')) {
      const rect = chart.getBoundingClientRect();
      if (rect.top <= line && rect.bottom >= line) return { sec: chart.dataset.sec, year: (line - rect.top) / scale };
    }
    return null;
  }
  function setZoom(px) {
    if (px === scale) return;
    const anchor = currentAnchor();
    scale = px;
    saveZoom(px);
    render();
    if (anchor) {
      const chart = document.querySelector(`.kt-chart[data-sec="${anchor.sec}"]`);
      if (chart) window.scrollBy(0, chart.getBoundingClientRect().top + anchor.year * scale - anchorLine());
    }
  }

  app.addEventListener('click', event => {
    const zoom = event.target.closest('[data-zoom]');
    if (zoom) { setZoom(Number(zoom.dataset.zoom)); return; }
    if (event.target.closest('[data-close]')) { const last = pickedId; pick(null); document.querySelector(`[data-id="${last}"]`)?.focus({ preventScroll: true }); return; }
    const near = event.target.closest('[data-pick]');
    if (near) { pick(near.dataset.pick, { scroll: true }); return; }
    const band = event.target.closest('.kt-band, .kt-mark');
    if (band) { pick(pickedId === band.dataset.id ? null : band.dataset.id); return; }
    if (event.target.closest('.kt-chart')) pick(null);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && pickedId) { const last = pickedId; pick(null); document.querySelector(`[data-id="${last}"]`)?.focus({ preventScroll: true }); }
  });
  window.addEventListener('resize', measureBar);

  render();
  if (location.hash) document.querySelector(location.hash.replace(/[^#\w-]/g, ''))?.scrollIntoView();
})();
