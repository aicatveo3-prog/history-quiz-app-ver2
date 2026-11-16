"use strict";
// 문제별 풀이 기록: 회차별·묶음별로 나뉜 진도와 별개로 "이 문제를 푼 적이 있는지"를 한곳에 모은다.
// - 기록: { kind:'solved', updatedAt, items: { '74-11': { a: 고른 답, ok: 정답 여부, at: 시각 } } }
// - 한 번 푼 문제는 '다시 풀기'나 회차 새로 시작을 해도 지워지지 않고, 다시 풀면 결과만 새 풀이로 바뀐다.
// - 저장 위치가 진도와 같은 접두어라 로그아웃 때 함께 지워지고, 계정 동기화는 sync.js가 문제별로 합친다.
(() => {
  const PREFIX = 'korean-history-study-v2-';
  const NAME = 'solved';
  const KEY = PREFIX + NAME;
  const exams = window.EXAMS || [];
  const units = window.UNITS || { eras: [], special: [] };

  const questions = new Map(); // 문제 id -> 문제
  exams.forEach(exam => exam.questions.forEach(q => questions.set(`${exam.id}-${q.number}`, q)));

  // 진도의 답 배열 순서와 맞추기 위해 study.js의 묶음 구성(없는 문제는 뺌)을 그대로 따른다.
  const setIds = new Map();
  const addSet = (id, ids) => setIds.set(id, ids.filter(q => questions.has(q)));
  (units.eras || []).forEach(era => {
    era.themes.forEach(t => addSet(t.id, t.questions));
    addSet(`era-${era.id}`, era.questions);
  });
  (units.special || []).forEach(sp => addSet(sp.id, sp.questions));

  const emptyLog = () => ({ kind: NAME, updatedAt: 0, items: {} });
  let log = emptyLog();

  // 저장소를 못 읽으면 지금까지의 메모리 기록을 그대로 둔다.
  function reload() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      log = saved && saved.items && typeof saved.items === 'object' ? saved : emptyLog();
    } catch { /* 비공개 모드 등 */ }
  }
  const announce = () => window.dispatchEvent(new CustomEvent('solved-change'));

  function save() {
    log.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* 메모리에만 남긴다 */ }
    window.CloudSync?.push(NAME, log);
    announce();
  }

  function record(id, answer, ok) {
    if (!questions.has(id)) return;
    log.items[id] = { a: answer, ok: !!ok, at: Date.now() };
    save();
  }

  function idsOf(sessionId) {
    if (/^\d+$/.test(sessionId)) {
      const exam = exams.find(e => e.id === Number(sessionId));
      return exam ? exam.questions.map(q => `${exam.id}-${q.number}`) : null;
    }
    return setIds.get(sessionId) || null;
  }

  // 기존 진도에서 기록에 없는 문제만 채운다. 진도의 시각은 회차 전체의 마지막 저장 시각이라
  // 문제별 시각이 아니므로, 이미 있는 기록은 덮어쓰지 않는다. 여러 진도에 있으면 최근 진도를 쓴다.
  function harvest() {
    const sessions = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(PREFIX) || key === KEY) continue;
        const ids = idsOf(key.slice(PREFIX.length));
        if (!ids) continue;
        let session = null;
        try { session = JSON.parse(localStorage.getItem(key)); } catch { /* 깨진 기록은 건너뜀 */ }
        if (session && Array.isArray(session.answers) && Array.isArray(session.checked) && session.answers.length === ids.length) sessions.push({ session, ids });
      }
    } catch { return; }
    sessions.sort((x, y) => (Number(y.session.updatedAt) || 0) - (Number(x.session.updatedAt) || 0));
    let added = false;
    sessions.forEach(({ session, ids }) => ids.forEach((id, i) => {
      const answer = session.answers[i];
      if (session.checked[i] !== true || ![1, 2, 3, 4, 5].includes(answer) || log.items[id]) return;
      log.items[id] = { a: answer, ok: answer === questions.get(id).answer, at: Number(session.updatedAt) || 0 };
      added = true;
    }));
    if (added) save();
  }

  // 다른 기기의 진도를 내려받았으면 다시 모으고, 로그아웃했으면 비운다.
  window.addEventListener('cloudsync-change', event => {
    reload();
    if (event.detail?.signedOut) announce();
    else harvest();
  });
  // sync.js가 계정의 기록과 합쳐 저장했을 때
  window.addEventListener('solved-merged', () => { reload(); announce(); });
  // 다른 탭에서 푼 경우
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) { reload(); announce(); }
  });

  reload();
  harvest();

  window.SolvedLog = {
    record,
    get: id => log.items[id] || null,
    has: id => !!log.items[id],
    all: () => ({ ...log.items }),
  };
})();
