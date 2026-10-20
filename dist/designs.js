"use strict";
(() => {
  const designs = {
    original: {label:'기존', caption:'현재 사용하던 초록색 학습 화면'},
    library: {label:'01 서재형', caption:'따뜻한 종이색과 명조체로 차분하게 읽는 화면'},
    dashboard: {label:'02 대시보드형', caption:'파란색 포인트와 옆쪽 문항 탐색으로 빠르게 이동하는 화면'},
    night: {label:'03 다크 집중형', caption:'어두운 배경에 문제와 해설을 넓게 배치한 화면'}
  };
  const storageKey='korean-history-design-v1';
  let saved;
  try {saved=localStorage.getItem(storageKey);} catch {}
  const requested=new URLSearchParams(location.search).get('design');
  function applyDesign(id,save=false) {
    if(!Object.hasOwn(designs,id))return;
    document.documentElement.dataset.design=id;
    document.querySelectorAll('[data-design-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.designChoice===id)));
    document.getElementById('design-caption').textContent=designs[id].caption;
    if(save){
      try{localStorage.setItem(storageKey,id);}catch{}
      // Keep an explicitly opened preview in sync when another design is chosen.
      try{const url=new URL(location.href);if(url.searchParams.has('design')){url.searchParams.set('design',id);history.replaceState(null,'',url.pathname+url.search+url.hash);}}catch{}
    }
  }
  document.getElementById('design-switcher').addEventListener('click',event=>{
    const button=event.target.closest('[data-design-choice]');
    if(button)applyDesign(button.dataset.designChoice,true);
  });
  applyDesign(Object.hasOwn(designs,requested)?requested:Object.hasOwn(designs,saved)?saved:'original',Object.hasOwn(designs,requested));
})();
