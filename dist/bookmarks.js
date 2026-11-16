"use strict";
// 북마크: 기출 풀이·단원별 풀이·이론 정리가 함께 쓰는 문제별 기록.
// - 기록: { kind:'bookmarks', updatedAt, items: { '74-11': { on: 켜짐 여부, src: 'auto'|'manual', at: 시각 } } }
// - 틀린 문제는 자동으로 들어온다(src 'auto'). 직접 누르면 src 'manual'이 되어 다시 맞혀도 남는다.
// - 자동으로 들어온 문제는 나중에 맞히면 빠지고, 직접 끈 문제도 다시 틀리면 자동으로 돌아온다.
// - 풀이 기록(solved.js)이 바뀔 때마다 맞춰 보기 때문에, 어느 화면에서 풀었든 같은 결과가 된다.
// - 저장 위치가 진도와 같은 접두어라 로그아웃 때 함께 지워지고, 계정 동기화는 sync.js가 문제별로 합친다.
(() => {
  const PREFIX = 'korean-history-study-v2-';
  const NAME = 'bookmarks';
  const KEY = PREFIX + NAME;
  const exams = window.EXAMS || [];
  const valid = new Set();
  exams.forEach(exam => exam.questions.forEach(q => valid.add(`${exam.id}-${q.number}`)));

  const emptyLog = () => ({ kind: NAME, updatedAt: 0, items: {} });
  let log = emptyLog();

  function reload() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      log = saved && saved.items && typeof saved.items === 'object' ? saved : emptyLog();
    } catch { /* 비공개 모드 등 */ }
  }
  const announce = () => window.dispatchEvent(new CustomEvent('bookmarks-change'));

  function save() {
    log.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* 메모리에만 남긴다 */ }
    window.CloudSync?.push(NAME, log);
    announce();
  }

  // 풀이 기록에 맞춰 자동 북마크를 넣고 뺀다.
  function reconcile() {
    const solved = window.SolvedLog?.all() || {};
    let changed = false;
    Object.entries(solved).forEach(([id, s]) => {
      if (!valid.has(id)) return;
      const at = Number(s.at) || 0;
      const entry = log.items[id];
      if (s.ok === false) {
        if (!entry || (at > entry.at && !(entry.on && entry.src === 'manual'))) {
          log.items[id] = { on: true, src: 'auto', at };
          changed = true;
        }
      } else if (entry && entry.on && entry.src === 'auto' && at > entry.at) {
        log.items[id] = { on: false, src: 'auto', at };
        changed = true;
      }
    });
    if (changed) save();
  }

  const isOn = id => !!log.items[id]?.on;

  function set(id, on) {
    if (!valid.has(id)) return false;
    log.items[id] = { on: !!on, src: 'manual', at: Date.now() };
    save();
    return true;
  }
  const toggle = id => { const next = !isOn(id); set(id, next); return next; };

  // 켜진 북마크 목록: [{ id, src, at }] 최근 것부터
  const list = () => Object.entries(log.items)
    .filter(([id, v]) => v.on && valid.has(id))
    .map(([id, v]) => ({ id, src: v.src, at: Number(v.at) || 0 }))
    .sort((a, b) => b.at - a.at);

  window.addEventListener('solved-change', reconcile);
  window.addEventListener('cloudsync-change', event => {
    reload();
    if (event.detail?.signedOut) announce(); else { reconcile(); announce(); }
  });
  window.addEventListener('bookmarks-merged', () => { reload(); announce(); });
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { reload(); announce(); } });

  reload();
  reconcile();

  window.Bookmarks = { isOn, set, toggle, list, count: () => list().length, source: id => log.items[id]?.src || null };
})();
