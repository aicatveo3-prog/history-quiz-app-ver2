"use strict";
// 이론 정리 페이지의 문항 번호 링크(74-11 등)를 누르면 기출 페이지로 이동하지 않고
// 같은 화면 위에 작은 창(dialog)으로 문제를 띄워 바로 풀어 볼 수 있게 한다.
// - Ctrl/Cmd/Shift 클릭, 가운데 버튼 클릭은 원래 링크(기출 페이지)로 그대로 이동한다.
// - 선택지를 누르면 곧바로 채점하고 해설(보기별 분석 포함)을 보여 준다.
// - 고른 답은 문제별 풀이 기록(solved.js)에 남기고, 이미 푼 문제는 마지막 답과 해설을 보여 준다(기출 페이지의 진도 기록은 건드리지 않는다).
// - '다시 풀기'는 창 안의 답만 비운다. 다시 답을 고르면 풀이 기록의 결과가 바뀐다.
// - 이전·다음 문제는 창을 연 목록(주제 줄의 번호, 구절의 문제 목록, 출제 문항 등)의 순서를 따르고, 목록이 없으면 같은 주제의 문제를 따른다.
(() => {
  const exams = window.EXAMS || [];
  // 이론 정리 전용 해설(theory-explanations.js). 기출 풀이 화면의 해설(explanations.js)과 따로 관리한다.
  const explanations = window.THEORY_EXPLANATIONS || {};
  const details = window.THEORY_DETAILS || {};
  const circles = ['①', '②', '③', '④', '⑤'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const themeOf = new Map(); // 문항 id -> 주제
  (window.THEORY || []).forEach(era => era.themes.forEach(t => t.questions.forEach(q => themeOf.set(q.id, t))));

  const attempts = new Map(); // 문항 id -> { answer, checked } (이번 방문에서 풀었거나 다시 풀기를 누른 문제)
  let dialog = null;
  let currentId = null;
  let sequence = []; // 이전·다음으로 오가는 문항 id 순서
  let opener = null;

  function find(id) {
    const [examId, number] = id.split('-').map(Number);
    const exam = exams.find(e => e.id === examId);
    const question = exam?.questions.find(q => q.number === number);
    return question ? { exam, question } : null;
  }
  function attempt(id) {
    if (attempts.has(id)) return attempts.get(id);
    const saved = window.SolvedLog?.get(id);
    return saved ? { answer: saved.a, checked: true } : { answer: null, checked: false };
  }
  const themeSequence = id => (themeOf.get(id)?.questions || []).map(q => q.id);

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'qd';
    dialog.setAttribute('aria-labelledby', 'qd-title');
    document.body.append(dialog);
    dialog.addEventListener('click', onDialogClick);
    dialog.addEventListener('keydown', onDialogKey);
    // 바깥(배경)을 누르면 닫는다. 창 안쪽 클릭은 target이 dialog 자신이 아니다.
    dialog.addEventListener('mousedown', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('qd-lock');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    });
    return dialog;
  }

  function choiceButtons(question, st) {
    return circles.map((mark, i) => {
      const n = i + 1;
      const cls = ['qd-choice'];
      if (st.checked && n === question.answer) cls.push('is-correct');
      else if (st.checked && n === st.answer) cls.push('is-wrong');
      return `<button type="button" class="${cls.join(' ')}" data-qd-answer="${n}" aria-label="${n}번${st.checked ? (n === question.answer ? ' 정답' : n === st.answer ? ' 내가 고른 오답' : '') : ' 선택'}" ${st.checked ? 'disabled' : ''}>${mark}</button>`;
    }).join('');
  }

  function resultBlock(id, question, st) {
    const right = st.answer === question.answer;
    const info = explanations[id];
    const deep = details[id];
    // 기출 풀기 화면의 '자세한 해설'과 같은 2단 구성: 왼쪽 1 자료 읽는 법 · 2 보기별 분석 / 오른쪽 3 배경 이론 · 4 암기 포인트
    const para = t => String(t || '').split('\n').filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('');
    const block = (title, text) => (text && String(text).trim() ? `<section class="qd-deep" aria-label="${title}"><h4>${title}</h4><div class="qd-text">${para(text)}</div></section>` : '');
    const analysis = deep ? `<section class="qd-deep" aria-label="보기별 분석"><h4>2. 보기별 분석</h4><ol>${deep.choices.map((text, i) => {
      const n = i + 1;
      const tags = `${n === question.answer ? '<b class="ok">정답</b>' : '<b class="no">오답</b>'}${n === st.answer ? '<b class="me">내 답</b>' : ''}`;
      // 해설 글이 '①…'로 시작하면 왼쪽 번호와 겹쳐 '①①'처럼 보이므로 앞 번호를 뗀다.
      return `<li><span class="qd-mark">${circles[i]}</span><div><p class="qd-tags">${tags}</p><p>${esc(String(text).replace(/^\s*[①②③④⑤]\s*/, ''))}</p></div></li>`;
    }).join('')}</ol></section>` : '';
    return `<div class="qd-result ${right ? 'is-right' : 'is-miss'}" role="status" tabindex="-1">
      <p class="qd-verdict">${right ? '정답이에요!' : '아쉽지만 오답이에요.'}</p>
      <p class="qd-answers">내 답 ${circles[st.answer - 1]} · 정답 <strong>${circles[question.answer - 1]}</strong>${right ? ` · ${question.points}점` : ''}</p>
      ${info ? `<h4>${esc(info.title)}</h4><p class="qd-clue"><span>핵심 단서</span>${esc(info.clue)}</p><p>${esc(info.explanation)}</p>${info.contrast ? `<p class="qd-contrast">${esc(info.contrast)}</p>` : ''}` : ''}
    </div>
    ${deep ? `<section class="qd-detail" aria-label="자세한 해설">
      <h3>${question.number}번 자세한 해설</h3>
      <div class="qd-detail-grid">
        <div class="qd-detail-col">${block('1. 자료 읽는 법', deep.read)}${analysis}</div>
        <div class="qd-detail-col">${block('3. 배경 이론', deep.theory)}${block('4. 암기 포인트', deep.memo)}</div>
      </div>
    </section>` : ''}`;
  }

  function render() {
    const { exam, question } = find(currentId);
    const st = attempt(currentId);
    const theme = themeOf.get(currentId);
    const others = theme ? theme.questions.filter(q => q.id !== currentId) : [];
    const position = sequence.indexOf(currentId);
    const marked = !!window.Bookmarks?.isOn(currentId);
    const nav = sequence.length > 1 ? `<div class="qd-nav" role="group" aria-label="문제 이동">
          <button type="button" class="qd-step" data-qd-step="-1" ${position <= 0 ? 'disabled' : ''}>← 이전 문제</button>
          <span class="qd-pos" aria-label="${sequence.length}문제 중 ${position + 1}번째">${position + 1} / ${sequence.length}</span>
          <button type="button" class="qd-step" data-qd-step="1" ${position >= sequence.length - 1 ? 'disabled' : ''}>다음 문제 →</button>
        </div>` : '';
    dialog.innerHTML = `<div class="qd-wrap">
      <div class="qd-head">
        <h2 id="qd-title" tabindex="-1">제${exam.id}회 ${question.number}번<small>${question.points}점${theme ? ` · ${esc(theme.name)}` : ''}</small></h2>
        ${nav}
        <button type="button" class="bookmark-btn qd-bm${marked ? ' is-on' : ''}" data-qd-bookmark aria-pressed="${marked}"><span class="bookmark-star" aria-hidden="true">${marked ? '★' : '☆'}</span><span class="bookmark-label">${marked ? '북마크됨' : '북마크'}</span></button>
        <button type="button" class="qd-x" data-qd-close aria-label="창 닫기">닫기 ✕</button>
      </div>
      <div class="qd-body">
        <section class="qd-pane qd-pane-question" aria-label="문제">
          <div class="qd-image"><img src="${esc(question.image)}" alt="제${exam.id}회 심화 ${question.number}번 원본 문제와 보기"></div>
          <div class="qd-answerbar">
            <span class="qd-answerbar-label">${st.checked ? '선택한 답' : '답 선택'}</span>
            <div class="qd-choices" role="group" aria-label="${question.number}번 답 선택">${choiceButtons(question, st)}</div>
            ${st.checked ? '<button type="button" class="button secondary qd-retry" data-qd-retry>다시 풀기</button>' : ''}
          </div>
        </section>
        <section class="qd-pane qd-pane-answer" aria-label="해설">
          ${st.checked ? resultBlock(currentId, question, st) : `<div class="qd-idle"><p class="qd-idle-title">왼쪽 문제를 보고 답을 고르세요.</p><p>번호를 누르면 바로 정답과 해설이 이 칸에 나타납니다.</p></div>`}
        </section>
      </div>
      <div class="qd-foot">
        ${others.length ? `<div class="qd-related"><span>같은 주제의 다른 기출</span>${others.map(q => `<button type="button" class="qd-chip${window.SolvedLog?.has(q.id) ? ' is-done' : ''}${window.Bookmarks?.isOn(q.id) ? ' is-bm' : ''}" data-qd-goto="${q.id}" aria-label="제${q.exam}회 ${q.number}번 문제로 바꾸기">${q.exam}-${q.number}</button>`).join('')}</div>` : '<span></span>'}
        <div class="qd-actions">
          <a class="button secondary" href="index.html#q-${exam.id}-${question.number}">기출 페이지로 이동 ↗</a>
          <button type="button" class="button primary" data-qd-close>이론으로 돌아가기</button>
        </div>
      </div>
    </div>`;
    dialog.querySelector('img').addEventListener('error', () => {
      dialog.querySelector('.qd-image').innerHTML = `<p class="qd-error">문제 이미지를 열지 못했습니다. <a href="index.html#q-${exam.id}-${question.number}">기출 페이지에서 열기</a></p>`;
    }, { once: true });
  }

  function open(id, from, list) {
    ensureDialog();
    currentId = id;
    if (list) sequence = list;
    if (!sequence.includes(id)) sequence = themeSequence(id);
    if (from) opener = from;
    render();
    if (!dialog.open) {
      document.documentElement.classList.add('qd-lock');
      dialog.showModal();
    }
    dialog.querySelectorAll('.qd-body, .qd-pane').forEach(el => { el.scrollTop = 0; });
    (dialog.querySelector('[data-qd-answer]:not(:disabled)') || dialog.querySelector('#qd-title'))?.focus({ preventScroll: true });
  }

  function onDialogClick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-qd-close')) dialog.close();
    else if (button.hasAttribute('data-qd-answer')) {
      if (attempt(currentId).checked) return;
      const answer = Number(button.dataset.qdAnswer);
      attempts.set(currentId, { answer, checked: true }); // 누르는 즉시 채점
      window.SolvedLog?.record(currentId, answer, answer === find(currentId).question.answer);
      render();
      dialog.querySelector('.qd-result')?.focus();
    } else if (button.hasAttribute('data-qd-bookmark')) {
      window.Bookmarks?.toggle(currentId); // 버튼 모양은 bookmarks-change에서 바꾼다
    } else if (button.hasAttribute('data-qd-step')) {
      const step = button.dataset.qdStep;
      open(sequence[sequence.indexOf(currentId) + Number(step)]);
      const again = dialog.querySelector(`[data-qd-step="${step}"]:not(:disabled)`);
      if (again) again.focus({ preventScroll: true }); // 같은 버튼을 이어서 누를 수 있게 한다
    } else if (button.hasAttribute('data-qd-retry')) {
      attempts.set(currentId, { answer: null, checked: false });
      render();
      dialog.querySelector('[data-qd-answer]')?.focus({ preventScroll: true });
    } else if (button.hasAttribute('data-qd-goto')) open(button.dataset.qdGoto);
  }

  function onDialogKey(event) {
    const button = event.target.closest?.('[data-qd-answer]');
    if (!button || button.disabled) return;
    const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (Number(button.dataset.qdAnswer) - 1 + step + 5) % 5 + 1;
    dialog.querySelector(`[data-qd-answer="${next}"]`).focus(); // 방향키는 포커스만 옮기고, Enter/Space/클릭으로 선택
  }

  // 북마크가 바뀌면(다른 화면·기기 포함) 열려 있는 창의 버튼도 맞춘다.
  window.addEventListener('bookmarks-change', () => {
    if (!dialog?.open || !currentId) return;
    const on = !!window.Bookmarks?.isOn(currentId);
    const btn = dialog.querySelector('[data-qd-bookmark]');
    if (!btn) return;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.bookmark-star').textContent = on ? '★' : '☆';
    btn.querySelector('.bookmark-label').textContent = on ? '북마크됨' : '북마크';
    dialog.querySelectorAll('.qd-chip').forEach(chip => chip.classList.toggle('is-bm', !!window.Bookmarks?.isOn(chip.dataset.qdGoto)));
  });

  // 문항 번호 링크 가로채기: 수정키 없이 왼쪽 클릭했을 때만 작은 창으로 연다.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a.th-src[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const match = link.getAttribute('href').match(/^index\.html#q-(\d+)-(\d+)$/);
    const id = match && `${match[1]}-${match[2]}`;
    if (!id || !find(id)) return; // 데이터가 없으면 원래대로 기출 페이지로 이동
    event.preventDefault();
    // 눌러서 연 목록의 문제들을 차례로 오간다.
    const ids = [...(link.closest('ul, .tq-row-qs')?.querySelectorAll('a.th-src[href]') || [])]
      .map(a => a.getAttribute('href').match(/^index\.html#q-(\d+)-(\d+)$/))
      .filter(Boolean)
      .map(m => `${m[1]}-${m[2]}`)
      .filter(find);
    open(id, link, ids.length > 1 ? ids : themeSequence(id));
  });

  window.TheoryQuiz = { open: (id, list) => { if (find(id)) open(id, document.activeElement, list || themeSequence(id)); } };
})();
