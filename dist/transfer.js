"use strict";
// 기록 옮기기: 주소가 다른 사이트(로컬 파일로 연 화면 ↔ GitHub 사이트) 사이에서 풀이 기록을 파일로 옮긴다.
// - 브라우저는 주소마다 저장 공간이 따로라서, 같은 컴퓨터라도 두 사이트의 기록은 서로 보이지 않는다.
// - 내보내기: 이 주소의 기록(회차·단원 진도, 문제별 풀이 기록, 북마크)을 JSON 파일로 저장한다.
// - 가져오기: 파일의 기록을 지금 기록과 합친다. 지우지 않는다.
//   진도는 회차·묶음마다 더 최근 것을, 풀이 기록과 북마크는 문제마다 더 최근 것을 남긴다(sync.js와 같은 규칙).
// - 로그인한 상태에서 가져오면 합친 기록이 계정에도 올라간다.
(() => {
  const PREFIX = 'korean-history-study-v2-';
  const PER_QUESTION = new Set(['solved', 'bookmarks']);
  const PUBLIC_URL = 'https://aicatveo3-prog.github.io/history-quiz-app-ver2/dist/index.html';
  const header = document.querySelector('.site-header');
  if (!header) return;

  const readLocal = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const stamp = s => Number(s?.updatedAt) || 0;
  const checkedCount = s => (Array.isArray(s?.checked) ? s.checked.filter(Boolean).length : 0);
  const hasWork = s => !!s && (Array.isArray(s.answers) ? s.answers.some(a => a !== null) : !!s.items && Object.keys(s.items).length > 0);

  function localRecords() {
    const items = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) items[key] = localStorage.getItem(key);
      }
    } catch { /* 저장 공간을 못 쓰는 환경 */ }
    return items;
  }

  function summarize(items) {
    let progress = 0; let solved = 0; let marks = 0;
    Object.entries(items).forEach(([key, raw]) => {
      let value = null;
      try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
      const id = key.slice(PREFIX.length);
      if (id === 'solved') solved = Object.keys(value?.items || {}).length;
      else if (id === 'bookmarks') marks = Object.values(value?.items || {}).filter(v => v?.on).length;
      else if (hasWork(value)) progress++;
    });
    return { progress, solved, marks };
  }
  const summaryText = s => `회차·단원 진도 ${s.progress}개 · 푼 문제 ${s.solved}개 · 북마크 ${s.marks}개`;

  // ---- 내보내기 ----
  function exportFile() {
    const items = localRecords();
    const s = summarize(items);
    const data = { app: 'korean-history-study', version: 1, exportedAt: new Date().toISOString(), from: location.protocol === 'file:' ? 'file' : location.host, items };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    a.href = url;
    a.download = `한국사_풀이기록_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return `내보냈어요: ${summaryText(s)}. 다운로드 폴더의 ${a.download} 파일을 다른 사이트에서 가져오세요.`;
  }

  // ---- 가져오기 ----
  function mergePerQuestion(name, local, incoming) {
    const items = { ...(local?.items || {}) };
    let changed = 0;
    Object.entries(incoming?.items || {}).forEach(([id, v]) => {
      if (!v || typeof v !== 'object') return;
      const cur = items[id];
      if (!cur || (Number(v.at) || 0) > (Number(cur.at) || 0)) { items[id] = v; changed++; }
    });
    return { merged: { kind: name, updatedAt: Math.max(stamp(local), stamp(incoming)), items }, changed };
  }

  function importData(data) {
    if (!data || data.app !== 'korean-history-study' || !data.items || typeof data.items !== 'object') throw new Error('format');
    const touched = [];
    let progress = 0; let solved = 0; let marks = 0;
    Object.entries(data.items).forEach(([key, raw]) => {
      if (!key.startsWith(PREFIX)) return;
      let incoming = null;
      try { incoming = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
      const id = key.slice(PREFIX.length);
      const local = readLocal(key);
      if (PER_QUESTION.has(id)) {
        const { merged, changed } = mergePerQuestion(id, local, incoming);
        if (!changed) return;
        localStorage.setItem(key, JSON.stringify(merged));
        touched.push([id, merged]);
        if (id === 'solved') solved += changed; else marks += changed;
        return;
      }
      if (!hasWork(incoming) || !Array.isArray(incoming.checked)) return;
      const newer = !hasWork(local)
        || (stamp(local) && stamp(incoming) ? stamp(incoming) > stamp(local) : checkedCount(incoming) > checkedCount(local));
      if (!newer) return;
      localStorage.setItem(key, JSON.stringify(incoming));
      touched.push([id, incoming]);
      progress++;
    });
    // 화면과 각 모듈이 새 기록을 다시 읽게 한다. 북마크를 먼저 읽혀야 한다:
    // 풀이 기록이 바뀌면 북마크 모듈이 자동 북마크를 맞춰 저장하는데, 그때 옛 북마크로 덮어쓰지 않게.
    window.dispatchEvent(new CustomEvent('bookmarks-merged'));
    window.dispatchEvent(new CustomEvent('solved-merged'));
    window.dispatchEvent(new CustomEvent('cloudsync-change', { detail: { pulled: true, imported: true } }));
    touched.forEach(([id, value]) => window.CloudSync?.push(id, value)); // 로그인 상태면 계정에도 올린다
    return { progress, solved, marks, any: touched.length > 0 };
  }

  // ---- 화면 ----
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'auth-btn transfer-btn';
  button.innerHTML = '<span class="transfer-long">기록 옮기기</span><span class="transfer-short" aria-hidden="true">기록</span>';
  button.setAttribute('aria-label', '기록 옮기기');
  header.append(button);

  let dialog = null;
  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'auth-dialog transfer-dialog';
    dialog.setAttribute('aria-labelledby', 'transfer-title');
    const onFile = location.protocol === 'file:';
    dialog.innerHTML = `<div class="auth-form">
      <h2 id="transfer-title">기록 옮기기</h2>
      <p class="auth-lead">로컬 파일로 연 사이트와 GitHub 사이트는 주소가 달라서 기록이 따로 저장돼요. 한쪽에서 내보낸 파일을 다른 쪽에서 가져오면 두 기록이 합쳐져요. 지금 기록은 지우지 않아요.</p>
      <p class="transfer-now">이 주소의 기록: <b data-transfer-now></b></p>
      <button type="button" class="auth-btn primary" data-transfer-export>이 기록을 파일로 내보내기</button>
      <button type="button" class="auth-btn" data-transfer-import>파일에서 가져와 합치기</button>
      <input type="file" accept=".json,application/json" data-transfer-file hidden>
      <p class="transfer-result" role="status" hidden></p>
      <p class="auth-lead transfer-tip">같은 계정으로 두 사이트에 모두 로그인하면 그다음부터는 자동으로 이어져요. 가져오기를 로그인한 상태에서 하면 합친 기록이 계정에도 올라가요.${onFile ? ` <a href="${PUBLIC_URL}" target="_blank" rel="noopener">GitHub 사이트 열기 ↗</a>` : ''}</p>
      <button type="button" class="auth-close" aria-label="닫기" data-transfer-close>×</button>
    </div>`;
    document.body.append(dialog);
    const result = dialog.querySelector('.transfer-result');
    const show = (text, bad = false) => { result.textContent = text; result.hidden = !text; result.classList.toggle('is-bad', bad); };
    const refresh = () => { dialog.querySelector('[data-transfer-now]').textContent = summaryText(summarize(localRecords())); };
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-transfer-close]')) { dialog.close(); return; }
      if (event.target.closest('[data-transfer-export]')) {
        try { show(exportFile()); } catch { show('내보내지 못했어요. 이 브라우저에서 저장 공간을 쓸 수 없을 수 있어요.', true); }
      } else if (event.target.closest('[data-transfer-import]')) {
        dialog.querySelector('[data-transfer-file]').click();
      }
    });
    dialog.querySelector('[data-transfer-file]').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { show('파일이 너무 커요. 이 사이트에서 내보낸 기록 파일인지 확인해 주세요.', true); return; }
      try {
        const r = importData(JSON.parse(await file.text()));
        refresh();
        show(r.any
          ? `합쳤어요: 회차·단원 진도 ${r.progress}개, 푼 문제 ${r.solved}개, 북마크 ${r.marks}개가 새로 들어오거나 더 최근 기록으로 바뀌었어요.`
          : '이미 같은 기록이 있거나 이쪽 기록이 더 최근이라 바뀐 것이 없어요.');
      } catch {
        show('이 사이트에서 내보낸 기록 파일이 아니거나 파일이 손상되었어요.', true);
      }
    });
    dialog.addEventListener('close', () => button.focus({ preventScroll: true }));
    return refresh;
  }

  let refresh = null;
  button.addEventListener('click', () => {
    if (!dialog) refresh = buildDialog();
    refresh();
    dialog.querySelector('.transfer-result').hidden = true;
    dialog.showModal();
  });

  window.RecordTransfer = { exportData: () => ({ app: 'korean-history-study', version: 1, items: localRecords() }), importData, summarize: () => summarize(localRecords()) };
})();
