"use strict";
// 이론 정리 페이지에 문제 연결을 표시한다. 연결은 theory-tags.js, 푼 기록은 solved.js에서 읽는다.
// 문제는 풀었든 안 풀었든 모두 보이고, 푼 문제만 진한 테두리(.is-done)로 구분한다.
// - 본문 구절: 형광펜(칠함 = 자료의 단서·정답 보기, 밑줄 = 오답 보기), ×N = 이 구절의 출제 횟수.
//   누르면 문제 목록이 뜨고, 문제마다 시험지의 선다지 문장을 그대로 보여 준다(자료 단서로 걸린 문제는 정답 선다지).
// - 소제목: '출제 N · 푼 문제 M' 묶음. 누르면 번호 칩 N개가 펼쳐지고, 칩을 누르면 해당 구절로 이동한다.
// - 주제 줄의 출제 횟수 칸: 이 주제에 나오는 문제 수와 번호 링크 전체. 오른쪽 '출제 문항': 주제에 배정된 문제.
(() => {
  const app = document.getElementById('theory-app');
  if (!app) return;
  const PREFS_KEY = 'korean-history-theory-marks-v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = s => s.replace(/\\n/g, '\n');

  const themes = new Map();
  const questionInfo = new Map(); // 문제 id -> { title, clue }
  (window.THEORY || []).forEach(era => era.themes.forEach(theme => {
    themes.set(theme.id, theme);
    theme.questions.forEach(q => questionInfo.set(q.id, q));
  }));

  const links = new Map(); // 주제 id -> [{ q, block, phrase, role, quote }]
  Object.entries(window.THEORY_TAGS || {}).forEach(([q, list]) => list.forEach(([themeId, block, phrase, role, quote]) => {
    if (!links.has(themeId)) links.set(themeId, []);
    links.get(themeId).push({ q, block, phrase, role, quote });
  }));

  const answerOf = id => {
    const [exam, number] = id.split('-').map(Number);
    return (window.EXAMS || []).find(e => e.id === exam)?.questions.find(q => q.number === number)?.answer;
  };
  const orderOnly = new Set(window.THEORY_TAGS_ORDER_ONLY || []);
  // 구절 목록에 보여 줄 시험지 문장. 보기가 순서 배열뿐인 문제만 자료 문장을 쓴다.
  function sentenceHtml({ q, role, quote }) {
    if (role === 's' && orderOnly.has(q)) return `<small class="tq-src">자료</small> ${esc(quote)}`;
    const n = role === 'a' || role === 's' ? answerOf(q) : Number(role[1]);
    const text = window.QUESTION_CHOICES?.[q]?.[n - 1];
    return text ? esc(text) : '그림 보기';
  }

  // 문단이 속한 소제목(앞쪽에서 가장 가까운 소제목)
  const headingCache = new Map();
  function headingOf(theme, block) {
    if (!headingCache.has(theme.id)) {
      let current = null;
      headingCache.set(theme.id, theme.theory.map((p, i) => {
        if (/^#{2,3} /.test(clean(p.text))) current = i;
        return current;
      }));
    }
    return headingCache.get(theme.id)[block];
  }

  function loadPrefs() {
    try { return { off: !!JSON.parse(localStorage.getItem(PREFS_KEY) || '{}').off }; }
    catch { return { off: false }; }
  }
  const prefs = loadPrefs();
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* 이번 방문에만 적용 */ } };

  const openBundles = new Set(); // '주제|소제목 문단'

  const isSolved = q => !!window.SolvedLog?.has(q);
  const byNumber = (a, b) => {
    const [ae, an] = a.split('-').map(Number);
    const [be, bn] = b.split('-').map(Number);
    return ae - be || an - bn;
  };
  const uniqueQs = items => [...new Set(items.map(i => i.q))];
  const isMarked = q => !!window.Bookmarks?.isOn(q);
  const doneClass = q => (isSolved(q) ? ' is-done' : '') + (isMarked(q) ? ' is-bm' : '');
  const solvedWord = q => (isSolved(q) ? ', 푼 문제' : '');

  function paragraphHtml(text, items) {
    // 구절별로 문제를 모으고, 글에 나오는 순서대로 칠한다(겹치면 앞 구절만 칠한다).
    const groups = new Map();
    items.forEach(item => {
      if (item.phrase === null) return;
      if (!groups.has(item.phrase)) groups.set(item.phrase, []);
      groups.get(item.phrase).push(item);
    });
    const ranges = [...groups]
      .map(([phrase, list]) => ({ at: text.indexOf(phrase), phrase, list }))
      .filter(r => r.at >= 0)
      .sort((a, b) => a.at - b.at);
    const plain = s => esc(s).replace(/\n/g, '<br>');
    let html = '';
    let pos = 0;
    ranges.forEach(({ at, phrase, list }) => {
      if (at < pos) return;
      const qs = uniqueQs(list);
      const total = qs.length;
      const fill = list.some(i => !i.role.startsWith('c'));
      const count = total > 1 ? `<span class="tq-x" aria-hidden="true">×${total}</span>` : '';
      html += plain(text.slice(pos, at));
      html += `<mark class="tq-m ${fill ? 'is-fill' : 'is-line'}" role="button" tabindex="0" data-qs="${esc(qs.map(q => `${q}:`).join(','))}" data-phrase="${esc(phrase)}" aria-label="${esc(phrase)}, 출제 ${total}번, 푼 문제 ${qs.filter(isSolved).length}개, 문제 보기">${plain(phrase)}${count}</mark>`;
      pos = at + phrase.length;
    });
    return html + plain(text.slice(pos));
  }

  function paintBundle(el, themeId, headingBlock, all) {
    if (!all.length) { el.innerHTML = ''; return; }
    const solvedCount = all.filter(isSolved).length;
    const key = `${themeId}|${headingBlock}`;
    const open = openBundles.has(key);
    const chips = open ? `<span class="tq-chips">${[...all].sort(byNumber).map(q => `<button type="button" class="tq-chip${doneClass(q)}" data-chip="${esc(q)}" aria-label="${esc(q.replace('-', '회 '))}번${solvedWord(q)}, 구절로 이동">${esc(q)}</button>`).join('')}</span>` : '';
    el.innerHTML = `<button type="button" class="tq-count" data-bundle="${esc(key)}" aria-expanded="${open}" aria-label="이 소제목에서 출제 ${all.length}번, 푼 문제 ${solvedCount}개. 번호 ${open ? '접기' : '펼치기'}">출제 ${all.length}${solvedCount ? ` · 푼 문제 ${solvedCount}` : ''}</button>${chips}`;
  }

  function paintQuestions(themeEl, theme) {
    const list = themeEl.querySelector('.th-questions');
    if (!list) return;
    const ids = theme.questions.map(q => q.id).sort(byNumber);
    list.innerHTML = ids.map(id => {
      const [exam, number] = id.split('-');
      const q = questionInfo.get(id);
      return `<li><a class="th-src${doneClass(id)}" href="index.html#q-${exam}-${number}" aria-label="제${exam}회 ${number}번 문제 보기${solvedWord(id)}">${exam}-${number}</a><span><strong>${esc(q.title)}</strong> · ${esc(q.clue)}</span></li>`;
    }).join('');
    // 출제 횟수 칸: 이 주제에 배정된 문제와 다른 주제에서 걸린 문제를 모두 나열한다.
    const row = themeEl.querySelector('.tq-row-qs');
    if (row) {
      const every = [...new Set([...ids, ...(links.get(theme.id) || []).map(i => i.q)])].sort(byNumber);
      const count = themeEl.querySelector('.th-count');
      count.textContent = `${every.length}회`;
      count.setAttribute('aria-label', `${every.length}회 출제`);
      count.classList.toggle('is-hot', every.length > 1);
      themeEl.dataset.count = every.length; // '2회 이상 출제만' 필터도 같은 횟수를 쓴다
      row.innerHTML = every.map(id => {
        const [exam, number] = id.split('-');
        return `<a class="th-src${doneClass(id)}" href="index.html#q-${exam}-${number}" aria-label="제${exam}회 ${number}번 문제 보기${solvedWord(id)}">${exam}-${number}</a>`;
      }).join('');
    }
  }

  function paintTheme(theme) {
    const el = document.getElementById(theme.id);
    if (!el) return;
    const all = links.get(theme.id) || [];
    // 본문: 이 주제에 연결이 있는 문단만 다시 그린다.
    new Set(all.map(i => i.block)).forEach(block => {
      const p = el.querySelector(`p[data-block="${block}"]`);
      if (!p) return;
      const items = prefs.off ? [] : all.filter(i => i.block === block);
      p.innerHTML = paragraphHtml(clean(theme.theory[block].text).trimEnd(), items);
    });
    // 소제목 묶음
    const perHeading = new Map();
    all.forEach(item => {
      const heading = headingOf(theme, item.block);
      if (heading === null) return;
      if (!perHeading.has(heading)) perHeading.set(heading, new Set());
      perHeading.get(heading).add(item.q);
    });
    el.querySelectorAll('.tq-bundle').forEach(slot => {
      const heading = Number(slot.dataset.heading);
      paintBundle(slot, theme.id, heading, [...(perHeading.get(heading) || [])]);
    });
    paintQuestions(el, theme);
  }

  const paintAll = () => themes.forEach(paintTheme);

  // ---- 구절을 눌렀을 때 뜨는 문제 목록 ----
  const pop = document.createElement('div');
  pop.className = 'tq-pop';
  pop.hidden = true;
  document.body.append(pop);
  let popOwner = null;

  function closePop(returnFocus = false) {
    if (pop.hidden) return;
    pop.hidden = true;
    if (returnFocus && popOwner?.isConnected) popOwner.focus({ preventScroll: true });
    popOwner = null;
  }

  function openPop(markEl) {
    const block = Number(markEl.closest('p').dataset.block);
    const items = (links.get(markEl.closest('.th-theme').dataset.theme) || []).filter(i => i.block === block && i.phrase === markEl.dataset.phrase);
    const ids = uniqueQs(items).sort(byNumber);
    const solvedCount = ids.filter(isSolved).length;
    pop.innerHTML = `<p class="tq-pop-head">출제 ${ids.length}번${solvedCount ? ` · 푼 문제 ${solvedCount}` : ''}</p><ul>${ids.map(q => {
      const [exam, number] = q.split('-');
      return `<li><a class="th-src${doneClass(q)}" href="index.html#q-${exam}-${number}" aria-label="제${exam}회 ${number}번 문제 보기${solvedWord(q)}">${exam}-${number}</a><span>${items.filter(i => i.q === q).map(sentenceHtml).join('<br>')}</span></li>`;
    }).join('')}</ul>`;
    pop.hidden = false;
    popOwner = markEl;
    const rect = markEl.getClientRects()[0] || markEl.getBoundingClientRect();
    const width = pop.offsetWidth;
    const left2 = Math.max(12, Math.min(rect.left, document.documentElement.clientWidth - width - 12));
    pop.style.left = `${left2 + window.scrollX}px`;
    pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
  }

  // 칩: 그 소제목 구간에서 이 문제의 구절로 이동해 잠깐 테두리를 보여 주고 목록을 연다.
  function goToChip(chip) {
    const q = chip.dataset.chip;
    const heading = Number(chip.closest('.tq-bundle').dataset.heading);
    const themeEl = chip.closest('.th-theme');
    const theme = themes.get(themeEl.dataset.theme);
    const marks = [...themeEl.querySelectorAll('.tq-m')].filter(m => {
      const block = Number(m.closest('p').dataset.block);
      return headingOf(theme, block) === heading && m.dataset.qs.split(',').some(e => e.startsWith(`${q}:`));
    });
    if (!marks.length) { // 형광펜을 껐거나 짚을 구절이 없는 문제
      window.TheoryQuiz?.open(q, [...chip.closest('.tq-chips').querySelectorAll('[data-chip]')].map(c => c.dataset.chip));
      return;
    }
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    marks[0].scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    marks.forEach(m => {
      m.classList.add('is-flash');
      setTimeout(() => m.classList.remove('is-flash'), 1600);
    });
    marks[0].focus({ preventScroll: true });
    openPop(marks[0]);
  }

  function syncToggle() {
    document.getElementById('tq-off')?.setAttribute('aria-pressed', String(prefs.off));
  }

  app.addEventListener('click', event => {
    const target = event.target;
    if (target.closest?.('#tq-off')) { prefs.off = !prefs.off; savePrefs(); syncToggle(); closePop(); paintAll(); return; }
    const count = target.closest?.('[data-bundle]');
    if (count) {
      const key = count.dataset.bundle;
      if (openBundles.has(key)) openBundles.delete(key); else openBundles.add(key);
      closePop();
      paintTheme(themes.get(key.split('|')[0]));
      document.querySelector(`[data-bundle="${key}"]`)?.focus({ preventScroll: true });
      return;
    }
    const chip = target.closest?.('[data-chip]');
    if (chip) { event.stopPropagation(); goToChip(chip); return; }
    const m = target.closest?.('.tq-m');
    if (m) {
      event.stopPropagation();
      if (popOwner === m) closePop(); else openPop(m);
    }
  });
  app.addEventListener('keydown', event => {
    const m = event.target.closest?.('.tq-m');
    if (m && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (popOwner === m) closePop(); else openPop(m);
    }
  });
  document.addEventListener('click', event => {
    if (pop.hidden) return;
    if (event.target.closest?.('.tq-pop a')) { closePop(); return; } // 문제 창은 theory-quiz.js가 연다
    if (!event.target.closest?.('.tq-pop')) closePop();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closePop(true); });

  // 문제를 풀거나 계정 기록을 받으면 다시 그린다.
  let queued = false;
  const repaint = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; closePop(); paintAll(); if (typeof applyFilters === 'function') applyFilters(); });
  };
  window.addEventListener('solved-change', repaint);
  window.addEventListener('bookmarks-change', repaint);
  // '북마크만' 보기에서 쓴다: 이 주제에 북마크한 문제가 있는지
  window.TheoryMarks = {
    hasBookmark: id => {
      const theme = themes.get(id);
      return !!theme && [...theme.questions.map(q => q.id), ...(links.get(id) || []).map(i => i.q)].some(isMarked);
    },
  };

  syncToggle();
  paintAll();
})();
