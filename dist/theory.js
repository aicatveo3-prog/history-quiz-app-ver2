"use strict";
// 이론 정리 페이지: window.THEORY(theory-data.js)를 시대별 주제 표로 그린다.
const app = document.getElementById('theory-app');
const eras = window.THEORY || [];
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = { era: 'all', query: '', frequentOnly: false, showExtras: true };
const searchText = new Map(); // theme id -> { base, all } 검색용 소문자 문자열(all은 보강 포함)

function srcLink(id) {
  const [exam, number] = id.split('-');
  return `<a class="th-src" href="index.html#q-${exam}-${number}" aria-label="제${exam}회 ${number}번 문제 보기">${exam}-${number}</a>`;
}
const srcList = ids => ids.map(srcLink).join('');

// 보강 항목의 출처 링크: '대백과 1 · 대백과 2 · 위키백과(보조)'
function extraSources(sources) {
  const kind = s => (s.secondary ? '위키백과(보조)' : '대백과');
  const total = sources.reduce((acc, s) => ({ ...acc, [kind(s)]: (acc[kind(s)] || 0) + 1 }), {});
  const seen = {};
  return sources.map(s => {
    const k = kind(s);
    seen[k] = (seen[k] || 0) + 1;
    const label = total[k] > 1 ? `${k} ${seen[k]}` : k;
    return `<a class="th-link${s.secondary ? ' is-secondary' : ''}" href="${escapeHtml(s.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.label)} 열기: ${escapeHtml(label)}">${escapeHtml(label)}</a>`;
  }).join('');
}

function renderExtras(theme) {
  if (!theme.extras.length) return '';
  return `<div class="th-extra">
    <h4><span class="th-badge">보강</span> 기출에는 없지만 함께 알아 두면 좋은 내용 <small>출처 확인 · ${theme.extras.length}건</small></h4>
    <ul class="th-extra-list">${theme.extras.map(x => `<li>
      <span class="th-type">${escapeHtml(x.type)}</span>
      <div><p>${escapeHtml(x.text)}</p><p class="th-extra-src"><span>출처</span>${extraSources(x.sources)}</p></div>
    </li>`).join('')}</ul>
  </div>`;
}

function renderTheme(theme) {
  const base = [
    theme.name,
    ...theme.questions.flatMap(q => [q.title, q.clue]),
    ...theme.theory.map(p => p.text),
    ...theme.memos.map(p => p.text),
    ...theme.contrasts.map(p => p.text),
  ];
  searchText.set(theme.id, {
    base: base.join(' ').toLowerCase(),
    all: [...base, ...theme.extras.map(x => x.text)].join(' ').toLowerCase(),
  });

  const ids = theme.questions.map(q => q.id);
  const items = list => list.map(p => `<li>${escapeHtml(p.text)} ${srcList(p.src)}</li>`).join('');
  return `<details class="th-theme" id="${theme.id}" data-theme="${theme.id}" data-count="${theme.count}">
    <summary>
      <span class="th-name">${escapeHtml(theme.name)}${theme.extras.length ? `<span class="th-extra-tag">보강 ${theme.extras.length}</span>` : ''}</span>
      <span class="th-freq"><b class="th-count ${theme.count > 1 ? 'is-hot' : ''}" aria-label="${theme.count}회 출제">${theme.count}회</b><span class="th-ids">${ids.join(' · ')}</span></span>
      <span class="th-memo">${escapeHtml(theme.memos[0].text)}</span>
    </summary>
    <div class="th-body">
      <div class="th-col">
        <h4>배경 이론</h4>
        ${theme.theory.map(p => `<p>${escapeHtml(p.text)} ${srcList(p.src)}</p>`).join('')}
      </div>
      <div class="th-col">
        <h4>암기 포인트</h4><ul class="th-list">${items(theme.memos)}</ul>
        <h4>헷갈리는 구별</h4><ul class="th-list">${items(theme.contrasts)}</ul>
        <h4>출제 문항</h4>
        <ul class="th-list th-questions">${theme.questions.map(q => `<li>${srcLink(q.id)}<span><strong>${escapeHtml(q.title)}</strong> · ${escapeHtml(q.clue)}</span></li>`).join('')}</ul>
      </div>
      ${renderExtras(theme)}
    </div>
  </details>`;
}

function renderEra(era) {
  const questionCount = era.themes.reduce((sum, t) => sum + t.count, 0);
  return `<section class="th-era" id="era-${era.id}" data-era="${era.id}" aria-labelledby="h-${era.id}">
    <header class="th-era-head"><h2 id="h-${era.id}">${escapeHtml(era.name)}</h2><p><span>${escapeHtml(era.range)}</span><span class="th-era-count">${era.themes.length}개 주제 · ${questionCount}문항</span></p></header>
    <div class="th-table">
      <div class="th-row-head" aria-hidden="true"><span>주제</span><span>출제</span><span>암기 포인트</span></div>
      ${era.themes.map(renderTheme).join('')}
    </div>
  </section>`;
}

function render() {
  const themeTotal = eras.reduce((sum, e) => sum + e.themes.length, 0);
  const questionTotal = eras.reduce((sum, e) => sum + e.themes.reduce((s, t) => s + t.count, 0), 0);
  if (!eras.length) { app.innerHTML = '<p class="th-empty">이론 자료를 불러오지 못했습니다.</p>'; return; }
  app.innerHTML = `<div class="th-wrap">
    <div class="th-intro">
      <div><p class="eyebrow">기출에서 뽑은 이론 정리</p><h1>시대별 이론 정리</h1>
      <p>제74·78·79회 심화 ${questionTotal}문항의 해설을 ${themeTotal}개 주제로 묶었습니다. 주제를 눌러 배경 이론, 암기 포인트, 헷갈리는 구별을 확인하세요.</p></div>
      <p class="th-legend"><span class="th-src">74-11</span> = 제74회 11번 문제 · 누르면 문제로 이동<br><span class="th-badge">보강</span> = 기출 해설에 없는 추가 내용 (출처 링크 포함)</p>
    </div>
    <div class="th-toolbar">
      <div class="th-tabs" role="group" aria-label="시대 선택">
        <button class="th-tab" type="button" data-era="all" aria-pressed="true">전체 <small>${themeTotal}</small></button>
        ${eras.map(e => `<button class="th-tab" type="button" data-era="${e.id}" aria-pressed="false">${escapeHtml(e.name)} <small>${e.themes.length}</small></button>`).join('')}
      </div>
      <div class="th-controls">
        <label class="th-search"><span class="sr-only">주제 검색</span><input id="th-query" type="search" placeholder="인물, 사건, 키워드 검색 (예: 광종, 책화)" autocomplete="off"></label>
        <label class="th-check"><input id="th-frequent" type="checkbox"> 2회 이상 출제만</label>
        <label class="th-check"><input id="th-extras" type="checkbox" checked> 보강 내용 보기</label>
        <span class="th-buttons"><button class="th-mini" type="button" data-expand="all">모두 펼치기</button><button class="th-mini" type="button" data-expand="none">모두 접기</button></span>
        <output id="th-status" class="th-status" aria-live="polite"></output>
      </div>
    </div>
    ${eras.map(renderEra).join('')}
    <p class="th-none" id="th-none" hidden>조건에 맞는 주제가 없습니다. 검색어나 필터를 바꿔 보세요.</p>
    <p class="footer">기출 해설에서 모은 학습용 정리 · 보강 내용은 한국민족문화대백과사전 등으로 확인했으며 공식 해설이 아닙니다</p>
  </div>`;
  applyFilters();
}

function applyFilters() {
  const query = state.query.trim().toLowerCase();
  let shownThemes = 0;
  document.querySelectorAll('.th-era').forEach(section => {
    const eraMatch = state.era === 'all' || section.dataset.era === state.era;
    let visible = 0;
    section.querySelectorAll('.th-theme').forEach(el => {
      const ok = eraMatch
        && (!state.frequentOnly || Number(el.dataset.count) > 1)
        && (!query || searchText.get(el.dataset.theme)[state.showExtras ? 'all' : 'base'].includes(query));
      el.hidden = !ok;
      if (ok) visible++;
    });
    section.hidden = visible === 0;
    shownThemes += visible;
  });
  document.querySelector('.th-wrap').classList.toggle('th-hide-extra', !state.showExtras);
  document.querySelectorAll('.th-tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.era === state.era)));
  document.getElementById('th-none').hidden = shownThemes !== 0;
  document.getElementById('th-status').textContent = `${shownThemes}개 주제 표시 중`;
}

function setAllOpen(open) {
  document.querySelectorAll('.th-theme:not([hidden])').forEach(el => { el.open = open; });
}

// #t12 (주제) 또는 #era-goryeo (시대)로 들어오면 해당 위치를 연다.
function openFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  if (hash.startsWith('era-')) {
    const id = hash.slice(4);
    if (eras.some(e => e.id === id)) { state.era = id; applyFilters(); }
    return;
  }
  const target = document.getElementById(hash);
  if (target?.classList.contains('th-theme')) {
    state.era = 'all'; state.query = ''; state.frequentOnly = false;
    document.getElementById('th-query').value = '';
    document.getElementById('th-frequent').checked = false;
    applyFilters();
    target.open = true;
    target.scrollIntoView({ block: 'start' });
    target.querySelector('summary').focus({ preventScroll: true });
  }
}

app.addEventListener('click', event => {
  const tab = event.target.closest('.th-tab');
  if (tab) {
    state.era = tab.dataset.era;
    history.replaceState(null, '', state.era === 'all' ? location.pathname : `#era-${state.era}`);
    applyFilters();
    return;
  }
  const expand = event.target.closest('[data-expand]');
  if (expand) setAllOpen(expand.dataset.expand === 'all');
});
app.addEventListener('input', event => {
  if (event.target.id === 'th-query') { state.query = event.target.value; applyFilters(); }
});
app.addEventListener('change', event => {
  if (event.target.id === 'th-frequent') { state.frequentOnly = event.target.checked; applyFilters(); }
  if (event.target.id === 'th-extras') { state.showExtras = event.target.checked; applyFilters(); }
});
window.addEventListener('hashchange', openFromHash);
// 인쇄할 때는 모든 주제를 펼친다.
window.addEventListener('beforeprint', () => setAllOpen(true));

render();
openFromHash();
