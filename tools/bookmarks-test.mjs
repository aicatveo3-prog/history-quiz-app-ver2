// 북마크 규칙 검사: 틀리면 자동 추가, 맞히면 자동 항목만 빠짐, 직접 누른 것은 유지, 다시 틀리면 되돌아옴.
// 사용: node tools/bookmarks-test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dist = new URL('../dist/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, dist), 'utf8');

function setup(local = {}) {
  const store = new Map(Object.entries(local));
  const listeners = new Map();
  const events = [];
  const window = {
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    dispatchEvent: event => { events.push(event.type); (listeners.get(event.type) || []).forEach(fn => fn(event)); },
  };
  const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k), get length() { return store.size; }, key: i => [...store.keys()][i] };
  const ctx = vm.createContext({ window, localStorage, CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } }, console, Date });
  for (const f of ['exams.js', 'solved.js', 'bookmarks.js']) vm.runInContext(read(f), ctx);
  return { window, store, events };
}
const answerOf = (w, id) => { const [e, n] = id.split('-').map(Number); return w.EXAMS.find(x => x.id === e).questions.find(x => x.number === n).answer; };
const wrongOf = (w, id) => (answerOf(w, id) % 5) + 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { window: w } = setup();

// 1) 틀리면 자동으로 들어온다
let t = setup(); w.EXAMS;
t.window.SolvedLog.record('74-1', wrongOf(t.window, '74-1'), false);
assert.equal(t.window.Bookmarks.isOn('74-1'), true);
assert.equal(t.window.Bookmarks.source('74-1'), 'auto');
assert.ok(t.events.includes('bookmarks-change'));
console.log('PASS wrong answer is bookmarked automatically');

// 2) 맞히면 자동 항목은 빠진다
await sleep(5);
t.window.SolvedLog.record('74-1', answerOf(t.window, '74-1'), true);
assert.equal(t.window.Bookmarks.isOn('74-1'), false);
console.log('PASS auto bookmark leaves after a correct answer');

// 3) 안 푼 문제도 직접 북마크할 수 있고, 맞혀도 남는다
t.window.Bookmarks.set('75-1', true);
assert.equal(t.window.Bookmarks.source('75-1'), 'manual');
await sleep(5);
t.window.SolvedLog.record('75-1', answerOf(t.window, '75-1'), true);
assert.equal(t.window.Bookmarks.isOn('75-1'), true);
console.log('PASS manual bookmark survives a correct answer');

// 4) 직접 끈 문제는 다시 틀리면 돌아온다
t.window.SolvedLog.record('76-1', wrongOf(t.window, '76-1'), false);
await sleep(5);
t.window.Bookmarks.toggle('76-1');
assert.equal(t.window.Bookmarks.isOn('76-1'), false);
await sleep(5);
t.window.SolvedLog.record('76-1', wrongOf(t.window, '76-1'), false);
assert.equal(t.window.Bookmarks.isOn('76-1'), true);
assert.equal(t.window.Bookmarks.source('76-1'), 'auto');
console.log('PASS removed bookmark returns after a new wrong answer');

// 5) 직접 켠 문제는 틀려도 manual로 유지된다
t.window.Bookmarks.set('77-1', true);
await sleep(5);
t.window.SolvedLog.record('77-1', wrongOf(t.window, '77-1'), false);
assert.equal(t.window.Bookmarks.source('77-1'), 'manual');
console.log('PASS manual bookmark keeps its source on a wrong answer');

// 6) 목록: 켜진 것만, 최근 순
const ids = t.window.Bookmarks.list().map(x => x.id);
assert.ok(ids.includes('76-1') && ids.includes('77-1') && ids.includes('75-1') && !ids.includes('74-1'));
assert.equal(t.window.Bookmarks.count(), ids.length);
console.log('PASS list only has active bookmarks');

// 7) 이전에 풀어 둔 틀린 기록도 처음 열 때 자동으로 들어온다
const K = 'korean-history-study-v2-';
t = setup({ [K + 'solved']: JSON.stringify({ kind: 'solved', updatedAt: 1, items: { '72-1': { a: 1, ok: false, at: 50 }, '73-1': { a: 2, ok: true, at: 60 } } }) });
assert.equal(t.window.Bookmarks.isOn('72-1'), true);
assert.equal(t.window.Bookmarks.isOn('73-1'), false);
console.log('PASS earlier wrong answers are picked up on load');

// 8) 저장된 북마크는 새로 열어도 유지된다
const saved = t.store.get(K + 'bookmarks');
t = setup({ [K + 'bookmarks']: saved, [K + 'solved']: t.store.get(K + 'solved') });
assert.equal(t.window.Bookmarks.isOn('72-1'), true);
console.log('PASS bookmarks persist');

// 9) 없는 문제는 무시
assert.equal(t.window.Bookmarks.set('99-99', true), false);
console.log('PASS unknown question is ignored');
