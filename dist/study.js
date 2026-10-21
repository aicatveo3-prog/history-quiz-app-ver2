"use strict";
const app=document.getElementById('app'),exams=window.EXAMS||[],explanations=window.EXPLANATIONS||{},deepDetails=window.DETAILS||{},circles=['①','②','③','④','⑤'];
let activeExam=null,session=null,view='home',filter='all',returnToResult=false,storageAvailable=true,dialogAction=null,questionListOpen=false;
// 해설이 있는 회차(해설 원고가 없는 회차는 문제와 정답만 제공한다)
const explainedExams=new Set(Object.keys(explanations).map(k=>Number(k.split('-')[0])));
const fullyExplained=new Set(exams.filter(e=>e.questions.every(q=>`${e.id}-${q.number}` in explanations)).map(e=>e.id));
const themeOf=new Map();(window.THEORY||[]).forEach(era=>era.themes.forEach(t=>t.questions.forEach(q=>themeOf.set(q.id,t))));
const memorySessions=new Map(),key=id=>`korean-history-study-v2-${id}`,examById=id=>exams.find(e=>e.id===Number(id));
// ---- 단원별·특수 분류 묶음: 여러 회차의 문항을 한 묶음으로 풀 수 있다 (진도는 묶음마다 따로 저장) ----
const unitData=window.UNITS||{eras:[],special:[]},setCatalog=new Map(),idOf=v=>/^\d+$/.test(String(v))?Number(v):String(v);
function makeSet(id,title,ids,tags={}){const questions=ids.map(s=>{const [e,n]=s.split('-').map(Number),q=examById(e)?.questions.find(x=>x.number===n);return q&&{...q,examId:e,tag:tags[s]||''};}).filter(Boolean);return {id,isSet:true,title,questions};}
for(const era of unitData.eras){for(const t of era.themes)setCatalog.set(t.id,makeSet(t.id,`${era.name} · ${t.name}`,t.questions));setCatalog.set(`era-${era.id}`,makeSet(`era-${era.id}`,`${era.name} 전체`,era.questions));}
for(const sp of unitData.special)setCatalog.set(sp.id,makeSet(sp.id,sp.name,sp.questions,sp.tags));
const setById=id=>setCatalog.get(id),studyHash=id=>typeof id==='number'?`#study-${id}`:`#set-${id}`,resultHash=id=>typeof id==='number'?`#learning-result-${id}`:`#set-result-${id}`;
const homeHash=()=>activeExam?.isSet?(String(activeExam.id).startsWith('special-')?'#special':'#units'):'';
const curKey=()=>{const q=activeExam.questions[session.index];return `${q.examId??activeExam.id}-${q.number}`;};
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readAttempt(id){
  if(memorySessions.has(id))return memorySessions.get(id);
  const n=typeof id==='string'?setById(id)?.questions.length:50;if(!n)return null;
  try{const s=JSON.parse(localStorage.getItem(key(id))||'null');
    if(!s||s.examId!==id||!['active','complete'].includes(s.status)||!Array.isArray(s.answers)||s.answers.length!==n||s.answers.some(a=>a!==null&&![1,2,3,4,5].includes(a))||!Array.isArray(s.checked)||s.checked.length!==n||s.checked.some((c,i)=>typeof c!=='boolean'||c&&s.answers[i]===null)||!Number.isInteger(s.index)||s.index<0||s.index>=n)return null;
    memorySessions.set(id,s);return s;
  }catch{storageAvailable=false;return null;}
}
function saveSession(){if(!session)return;session.updatedAt=Date.now();memorySessions.set(session.examId,session);try{localStorage.setItem(key(session.examId),JSON.stringify(session));}catch{storageAvailable=false;}window.CloudSync?.push(session.examId,session);}
// 로그인 동기화(sync.js)가 기록을 내려받았거나 로그아웃했을 때: 메모리에 캐시한 기록을 비우고 화면을 새로 그린다.
window.addEventListener('cloudsync-change',event=>{memorySessions.clear();
  if(event.detail?.signedOut){session=null;activeExam=null;history.replaceState(null,'',location.pathname);renderRoute();}
  else if(view==='home')renderRoute();});
function newAttempt(id){const e=typeof id==='string'?setById(id):examById(id);if(!e)throw Error('지원하지 않는 회차입니다.');const n=e.questions.length;session={examId:e.id,status:'active',answers:Array(n).fill(null),checked:Array(n).fill(false),index:0};activeExam=e;saveSession();return session;}
function navigate(hash){if(location.hash!==hash)history.replaceState(null,'',hash||location.pathname);renderRoute();window.scrollTo(0,0);}
function startStudy(id,fresh=false){id=idOf(id);if(fresh||!readAttempt(id))newAttempt(id);returnToResult=false;navigate(studyHash(id));}
function confirmAction(title,message,label,action,cancel='취소'){document.getElementById('dialog-title').textContent=title;document.getElementById('dialog-message').textContent=message;document.getElementById('dialog-confirm').textContent=label;document.getElementById('dialog-cancel').textContent=cancel;dialogAction=action;document.getElementById('confirm-dialog').showModal();}
document.getElementById('dialog-confirm').addEventListener('click',()=>{const action=dialogAction;dialogAction=null;document.getElementById('confirm-dialog').close();action?.();});
document.getElementById('dialog-cancel').addEventListener('click',()=>{dialogAction=null;document.getElementById('confirm-dialog').close();});
document.getElementById('confirm-dialog').addEventListener('cancel',()=>dialogAction=null);
function askRestart(id){id=idOf(id);confirmAction('처음부터 다시 풀까요?',typeof id==='string'?'이 묶음의 학습 기록을 새 풀이로 바꿉니다. 회차별 풀이 기록은 그대로 둡니다.':'이번 회차의 학습 기록을 새 풀이로 바꿉니다.','처음부터 풀기',()=>startStudy(id,true));}
function storageWarning(){return storageAvailable?'':'<p class="storage-warning" role="status">현재 브라우저에서는 기록을 저장할 수 없습니다. 학습을 마칠 때까지 페이지를 열어 두세요.</p>';}
function homeActions(e,saved,featured){const style=featured?'primary':'secondary',inline=featured?'style="color:#d2e1df"':'';
  if(saved?.status==='complete')return `<div class="resume-actions"><button class="button ${style}" data-result="${e.id}">학습 결과</button><button class="text-button" data-restart="${e.id}" ${inline}>다시 풀기</button></div>`;
  return `<button class="button ${style}" data-start="${e.id}">${saved?'이어 풀기':'문제 풀기'}</button>`;
}
function renderHome(){view='home';activeExam=null;session=null;returnToResult=false;const sorted=[...exams].sort((a,b)=>b.id-a.id);
  const cards=sorted.map((e,i)=>{const saved=readAttempt(e.id),info=fullyExplained.has(e.id)?'<div class="exam-info"><span>50문항</span><span>정답·해설</span></div>':explainedExams.has(e.id)?'<div class="exam-info"><span>50문항</span><span>정답·일부 해설</span></div>':'<div class="exam-info"><span>50문항</span><span>정답</span><span>해설 준비 중</span></div>',note=saved?`<p class="study-mini-status">${saved.checked.filter(Boolean).length} / 50문항 학습</p>`:'';
    return i===0?`<article class="featured"><div class="featured-content"><span class="badge">제공된 최신 회차</span><h2>${e.title}</h2>${info}${homeActions(e,saved,true)}${note}</div><div class="featured-preview"><img src="${e.pages[0].image}" alt="제${e.id}회 기출 문제지 미리보기"></div></article>`:`<article class="exam-card"><div><h2>${e.title}</h2>${info}${note}</div>${homeActions(e,saved,false)}</article>`;});
  app.innerHTML=`${storageWarning()}<section class="home">${tabsHtml('exams')}<div class="intro"><div><div class="eyebrow">한 문제씩 이해하는 한국사</div><h1>학습할 회차를 선택하세요.</h1><p>문제를 풀고, 정답과 해설을 확인한 뒤 다음 문제로 넘어가세요.</p></div><span class="exam-count">${exams.length}개 회차 · 심화 ${exams.reduce((s,e)=>s+e.questions.length,0)}문항</span></div>${cards[0]||'<p class="empty">기출 자료를 불러오지 못했습니다.</p>'}<div class="exam-list">${cards.slice(1).join('')}</div><div class="home-note"><strong>학습 방법</strong><span>답 선택 → 정답 확인 → 해설 읽기 → 다음 문제<br>진도는 이 브라우저에 자동 저장됩니다. 해설은 학습용으로 별도 작성했습니다.</span></div><p class="footer">문제·정답: 제공된 한국사능력검정시험 기출 PDF · 개인 학습용</p></section>`;
}
const tabsHtml=active=>{const sub={exams:`${exams.length}개 회차 · 회차마다 50문항`,units:`${unitData.eras.length}개 시대 · ${unitData.eras.reduce((n,e)=>n+e.themes.length,0)}개 주제`,special:'유물 · 지역사 · 시대 비교'};
  return `<nav class="home-tabs" aria-label="문제 푸는 방법">${[['exams','회차별 풀기','#'],['units','단원별 풀기','#units'],['special','특수 분류','#special']].map(([k,l,h])=>`<a href="${h}"${k===active?' aria-current="page"':''}><b>${l}</b><span>${sub[k]}</span></a>`).join('')}</nav>`;};
function setRow(set,label,sub=''){const s=readAttempt(set.id),n=set.questions.length,done=s?s.checked.filter(Boolean).length:0,right=s?s.checked.filter((c,i)=>c&&s.answers[i]===set.questions[i].answer).length:0;
  const act=s?.status==='complete'?`<button class="button secondary" data-result="${set.id}">학습 결과</button><button class="text-button" data-restart="${set.id}">다시 풀기</button>`:`<button class="button secondary" data-start="${set.id}">${done?'이어 풀기':'풀기'}</button>`;
  return `<li class="set-row"><div class="set-main"><strong>${escapeHtml(label)}</strong>${sub?`<span class="set-sub">${escapeHtml(sub)}</span>`:''}<span class="set-count">${n}문항${done?` · ${done}문항 학습 · 정답 ${right}`:''}</span></div><div class="set-actions">${act}</div></li>`;}
function renderUnits(tab){view='home';activeExam=null;session=null;returnToResult=false;
  const body=tab==='units'?unitData.eras.map(era=>`<article class="era-card"><div class="era-head"><div><h2>${escapeHtml(era.name)}</h2><p>${escapeHtml(era.range)} · ${era.questions.length}문항 · 주제 ${era.themes.length}개</p></div></div><ul class="set-list">${setRow(setById(`era-${era.id}`),`${era.name} 전체`,'이 시대 문항을 모두 이어서 풀기').replace('class="set-row"','class="set-row set-all"')}${era.themes.map(t=>setRow(setById(t.id),t.name)).join('')}</ul></article>`).join(''):`<div class="special-grid">${unitData.special.map(sp=>`<article class="era-card"><div class="era-head"><div><h2>${escapeHtml(sp.name)}</h2><p>${escapeHtml(sp.desc)}</p></div></div><ul class="set-list">${setRow(setById(sp.id),`${sp.name} 모아 풀기`)}</ul></article>`).join('')}</div>`;
  const head=tab==='units'?['시대와 주제별로 모아 풀기','시대를 고르고, 주제별로 여러 회차의 문제를 이어서 풀어 보세요.',`${unitData.eras.length}개 시대 · ${unitData.eras.reduce((n,e)=>n+e.themes.length,0)}개 주제`]:['유형별로 모아 풀기','유물, 지역사, 시대 비교처럼 시대 단원에 담기 어려운 유형을 따로 모았습니다. 이 문항들은 시대 단원에도 그대로 들어 있습니다.',`${unitData.special.length}개 유형 · ${unitData.special.reduce((n,s)=>n+s.questions.length,0)}문항`];
  app.innerHTML=`${storageWarning()}<section class="home">${tabsHtml(tab)}<div class="intro"><div><div class="eyebrow">${head[0]}</div><h1>${tab==='units'?'단원별로 풀어 보세요.':'특수 분류로 풀어 보세요.'}</h1><p>${head[1]}</p></div><span class="exam-count">${head[2]}</span></div>${body||'<p class="empty">단원 자료를 불러오지 못했습니다.</p>'}<div class="home-note"><strong>알아 두세요</strong><span>단원별·특수 분류의 진도는 회차별 진도와 따로 저장됩니다. 정답 확인과 해설은 회차별 풀이와 같은 방식입니다.</span></div><p class="footer">문제·정답: 제공된 한국사능력검정시험 기출 PDF · 개인 학습용</p></section>`;}
function gradeSummary(e,s){let score=0,correct=0,checked=0;const rows=e.questions.map((q,i)=>{const done=s.checked[i],right=done&&s.answers[i]===q.answer;if(done)checked++;if(right){score+=q.points;correct++;}return {...q,pos:i+1,given:s.answers[i],done,right};});return {score,correct,checked,wrong:checked-correct,rows};}
function renderQuestionNavigation(){const number=session.index+1,total=activeExam.questions.length;
  return `<nav class="question-navigation" aria-label="문제 이동"><div class="navigation-heading"><label for="question-range">문제 이동</label><output id="question-range-label" for="question-range">${number}번 문제</output></div><div class="question-range-row"><span>1번</span><input id="question-range" type="range" min="1" max="${total}" step="1" value="${number}" aria-label="문제 이동 슬라이더" aria-valuetext="${number}번 문제"><span>${total}번</span></div><p class="navigation-help">바를 움직이거나 문항 번호를 눌러 이동하세요.</p><details class="question-list" ${questionListOpen?'open':''}><summary>문항 번호로 이동</summary><div class="question-grid">${activeExam.questions.map((q,i)=>{const checked=session.checked[i],state=checked?(session.answers[i]===q.answer?'correct':'wrong'):session.answers[i]!==null?'selected':'unanswered',label={correct:'정답',wrong:'오답',selected:'답 선택 후 확인 전',unanswered:'아직 안 푼 문제'}[state];return `<button class="question-jump ${state}" data-jump="${i+1}" ${i===session.index?'aria-current="step"':''} aria-label="${i+1}번 문제 · ${label}">${i+1}</button>`;}).join('')}</div><div class="navigation-legend"><span class="legend-current">현재 문제</span><span class="legend-correct">정답</span><span class="legend-wrong">오답</span><span class="legend-selected">확인 전</span></div></details></nav>`;
}
// 문제를 옮긴 뒤 위치: 넓은 화면은 문제 칸이 화면 위쪽에 오도록(이전/다음 줄이 바로 보이게), 좁은 화면은 맨 위로
let pendingScroll=null;
function toQuestion(){const go=()=>{const layout=document.querySelector('.study-layout');if(isWideLayout()&&layout?.scrollIntoView)layout.scrollIntoView({block:'start'});else window.scrollTo(0,0);};
  go();pendingScroll=go;} // 이미지가 늦게 뜨면 페이지가 짧아 스크롤이 막히므로, 이미지가 뜬 뒤 한 번 더 맞춘다
function jumpQuestion(number){
  if(view!=='study'||!session)throw Error('먼저 학습을 시작해 주세요.');
  if(!Number.isInteger(number)||number<1||number>activeExam.questions.length)throw Error('올바른 문항 번호를 선택해 주세요.');
  session.index=number-1;saveSession();renderLesson();toQuestion();document.getElementById('current-question-title').focus({preventScroll:true});
}
// 문제 이미지의 가로/세로 비율: 넓은 화면에서 문제 칸 너비를 화면 높이에 맞추는 데 쓴다.
function questionRatio(q){const c=q.crop;return c&&c[3]>c[1]?((c[2]-c[0])/(c[3]-c[1])).toFixed(3):'0.72';}
function renderDeep(q,answer){const qe=q.examId??activeExam.id,d=deepDetails[`${qe}-${q.number}`],theme=themeOf.get(`${qe}-${q.number}`);if(!d)return theme?`<p class="deep-theory-link"><a class="button secondary" href="theory.html#${theme.id}">이론 정리에서 ‘${escapeHtml(theme.name)}’ 보기</a></p>`:'';
  const rows=d.choices.map((text,i)=>{const n=i+1,isAnswer=n===q.answer,isMine=n===answer;return `<li class="deep-choice ${isAnswer?'is-answer':''} ${isMine&&!isAnswer?'is-mine':''}"><span class="deep-mark">${circles[i]}</span><div><p class="deep-tags">${isAnswer?'<b class="tag ok">정답</b>':'<b class="tag no">오답</b>'}${isMine?'<b class="tag me">내가 고른 답</b>':''}</p><p>${escapeHtml(text)}</p></div></li>`}).join('');
  const para=t=>String(t).split(String.fromCharCode(10)).map(x=>`<p>${escapeHtml(x)}</p>`).join('');
  return `<section class="deep-explain" aria-label="${q.number}번 자세한 해설"><h2>${q.number}번 자세한 해설</h2><div class="deep-grid"><div class="deep-col"><div class="deep-block"><h3>1. 자료 읽는 법</h3>${para(d.read)}</div><div class="deep-block deep-wide"><h3>2. 보기별 분석</h3><ol class="deep-choices">${rows}</ol></div></div><div class="deep-col"><div class="deep-block deep-wide"><h3>3. 배경 이론</h3>${para(d.theory)}</div><div class="deep-block memo"><h3>4. 암기 포인트</h3>${para(d.memo)}</div></div></div>${theme?`<p class="deep-theory-link"><a class="button secondary" href="theory.html#${theme.id}">이론 정리에서 ‘${escapeHtml(theme.name)}’ 보기</a></p>`:''}</section>`}
// ---- 문제/해설 화면 배분 (넓은 화면 전용) ----
// splitFraction: 사용자가 정한 '문제 칸 너비 / 본문 너비'(null이면 자동 맞춤). 같은 브라우저에 저장한다.
const SPLIT_KEY='korean-history-study-split-v1',SPLIT_MIN=.22,SPLIT_MAX=.72;
let splitFraction=loadSplit(),splitDrag=null;
function loadSplit(){try{const v=Number(JSON.parse(localStorage.getItem(SPLIT_KEY)||'null')?.fraction);return v>=SPLIT_MIN&&v<=SPLIT_MAX?v:null;}catch{return null;}}
function saveSplit(){try{if(splitFraction===null)localStorage.removeItem(SPLIT_KEY);else localStorage.setItem(SPLIT_KEY,JSON.stringify({fraction:splitFraction}));}catch{}}
const isWideLayout=()=>!!window.matchMedia?.('(min-width:901px)')?.matches;
const splitStyle=()=>splitFraction===null?'':`;--qpane:${(splitFraction*100).toFixed(2)}%`;
// 해설 칸과 문제 칸이 너무 좁아지지 않도록 현재 화면 너비에서 쓸 수 있는 범위를 구한다.
const splitBounds=width=>{const lo=Math.max(SPLIT_MIN,340/width),hi=Math.min(SPLIT_MAX,1-(400+28)/width);return [lo,Math.max(lo,hi)];};
function splitMetrics(){const layout=document.querySelector('.study-layout'),card=layout?.querySelector('.question-card');return layout&&card?{layout,card,width:layout.getBoundingClientRect().width,left:layout.getBoundingClientRect().left}:null;}
const renderSplitHandle=()=>`<div class="split-handle" role="separator" aria-orientation="vertical" tabindex="0" aria-label="문제와 해설 너비 조절. 좌우 방향키로 조절하고 Enter를 누르면 자동 맞춤" aria-valuemin="${SPLIT_MIN*100}" aria-valuemax="${SPLIT_MAX*100}" aria-valuenow="${Math.round((splitFraction??.42)*100)}" title="끌어서 너비 조절 · 더블클릭: 자동 맞춤"><span class="split-grip" aria-hidden="true"></span></div>`;
// 화면에 반영: 사용자의 의도(splitFraction)는 그대로 두고, 현재 화면 너비에 맞게 보정한 값만 CSS에 적용한다.
function paintSplit(){
  if(!isWideLayout())return; // 좁은 화면은 세로 배치라 배분 도구를 쓰지 않는다
  const m=splitMetrics();if(!m)return;
  if(splitFraction===null)m.layout.style.removeProperty('--qpane');
  else{const [lo,hi]=splitBounds(m.width);m.layout.style.setProperty('--qpane',(Math.min(Math.max(splitFraction,lo),hi)*100).toFixed(2)+'%');}
  const handle=document.querySelector('.split-handle');
  if(handle)handle.setAttribute('aria-valuenow',String(Math.round(m.card.getBoundingClientRect().width/m.width*100)));
  fitSticky();
}
// 문제 카드가 화면보다 높으면 고정(sticky)을 풀어 카드 안에 스크롤바 없이 페이지 스크롤로 끝까지 볼 수 있게 한다.
function fitSticky(){const layout=document.querySelector('.study-layout'),card=layout?.querySelector('.question-card');if(!layout?.classList||!card)return;layout.classList.toggle('card-tall',isWideLayout()&&card.offsetHeight>(window.innerHeight||0)-32);}
function setSplit(value,persist=true){
  splitFraction=value===null?null:Math.min(Math.max(Number(value),SPLIT_MIN),SPLIT_MAX);
  paintSplit();if(persist)saveSplit();
}
function currentSplit(){const m=splitMetrics();return m?m.card.getBoundingClientRect().width/m.width:.42;}
app.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('.split-handle');if(!handle||event.button!==0)return;
  event.preventDefault();splitDrag=event.pointerId;try{handle.setPointerCapture(event.pointerId);}catch{}document.querySelector('.study-layout')?.classList.add('is-resizing');
});
app.addEventListener('pointermove',event=>{
  if(splitDrag!==event.pointerId)return;const m=splitMetrics();if(!m)return;
  setSplit((event.clientX-m.left-14)/m.width,false);
});
function endSplitDrag(event){if(splitDrag!==event.pointerId)return;splitDrag=null;document.querySelector('.study-layout')?.classList.remove('is-resizing');saveSplit();}
app.addEventListener('pointerup',endSplitDrag);app.addEventListener('pointercancel',endSplitDrag);
app.addEventListener('dblclick',event=>{if(event.target.closest('.split-handle'))setSplit(null);});
app.addEventListener('keydown',event=>{
  if(!event.target.closest?.('.split-handle'))return;
  const step=event.shiftKey?.06:.02,m=splitMetrics();if(!m)return;const [lo,hi]=splitBounds(m.width);
  const next={ArrowLeft:currentSplit()-step,ArrowRight:currentSplit()+step,Home:lo,End:hi}[event.key];
  if(next!==undefined){event.preventDefault();setSplit(next);}
  else if(event.key==='Enter'){event.preventDefault();setSplit(null);}
});
window.addEventListener('resize',()=>{if(view==='study')paintSplit();});
// 문제 카드 아래에 붙는 답 선택 줄: 선택지 ①~⑤와 '정답 확인'(확인 뒤에는 '다음 문제') 버튼
function renderAnswerBar(q,done,answer,right,index,count){
  const nextLabel=index===activeExam.questions.length-1?(count===activeExam.questions.length?'학습 결과 보기':'아직 안 푼 문제로'):'다음 문제';
  return `<div class="answer-bar"><span class="answer-label">${done?'내 답':'답 선택'}</span><div class="choice-row" role="radiogroup" aria-label="${q.number}번 답 선택">${circles.map((c,i)=>`<button class="choice ${done&&q.answer===i+1?'correct-choice':done&&answer===i+1&&!right?'wrong-choice':''}" role="radio" data-answer="${i+1}" aria-label="${i+1}번 선택" aria-checked="${answer===i+1}" tabindex="${answer?answer===i+1?0:-1:i===0?0:-1}" ${done?'disabled':''}>${c}</button>`).join('')}</div>${done?`<button class="button secondary" data-retry>다시 풀기</button>`:`<button class="button primary" id="check-answer" data-check ${answer===null?'disabled':''}>정답 확인</button>`}<div class="answer-nav"><button class="button secondary" data-previous ${index===0?'disabled':''}>이전 문제</button>${done?`<button class="button primary" data-next>${nextLabel}</button>`:`<button class="button secondary" data-skip>다음 문제</button>`}</div></div>`;
}
// ---- 문제 접기: 정답을 확인한 뒤에는 문제 카드를 접고 해설만 볼 수 있다(다른 문제로 넘어가면 다시 펼쳐진다) ----
let foldedKey=null;
function toggleFold(){
  const layout=document.querySelector('.study-layout'),button=document.querySelector('[data-fold]');if(!layout||!button)return;
  const folded=layout.classList.toggle('is-folded');
  foldedKey=folded?`${activeExam.id}-${session.index}`:null;
  button.setAttribute('aria-checked',String(!folded));
  if(!folded)paintSplit();
}
function renderLesson(){view='study';const index=session.index,q=activeExam.questions[index],qe=q.examId??activeExam.id,total=activeExam.questions.length,done=session.checked[index],answer=session.answers[index],right=answer===q.answer,detail=explanations[`${qe}-${q.number}`],count=session.checked.filter(Boolean).length,folded=done&&foldedKey===`${activeExam.id}-${index}`;if(!folded)foldedKey=null;
  app.innerHTML=`${storageWarning()}<section class="study-wrap"><div class="study-topline"><div class="study-heading"><p class="eyebrow">오늘의 한국사 학습</p><h1>${activeExam.title}<span class="lesson-mode">한 문제씩 풀기</span></h1></div><div class="study-actions"><button class="back-link" data-home>${activeExam.isSet?'목록으로':'회차 선택'}</button>${returnToResult?'<button class="text-button" data-show-result>학습 결과로</button>':''}</div></div><div class="study-progress"><progress value="${count}" max="${total}" aria-label="학습 진행률"></progress><span><strong>${count}</strong> / ${total}문항 학습</span></div>${renderQuestionNavigation()}<div class="study-layout${done?' is-done':''}${folded?' is-folded':''}" style="--qratio:${questionRatio(q)}${splitStyle()}"><article class="question-card"><div class="question-caption"><h2 id="current-question-title" tabindex="-1">${index+1}번 문제</h2><span>${activeExam.isSet?`제${qe}회 ${q.number}번${q.tag?` · ${escapeHtml(q.tag)}`:''} · ${q.points}점 · ${index+1} / ${total}`:`${q.points}점 · ${q.number} / ${total}`}</span>${done?`<button type="button" class="fold-switch" role="switch" data-fold aria-checked="${!folded}" aria-label="문제 보기"><span class="fold-switch-label">문제 보기</span><span class="fold-switch-track" aria-hidden="true"><span class="fold-switch-knob"></span></span></button>`:''}</div><div class="question-body"><img id="question-image" src="${q.image}" alt="제${qe}회 심화 ${q.number}번 원본 문제와 보기" fetchpriority="high"></div>${renderAnswerBar(q,done,answer,right,index,count)}<div class="question-tools"><a class="text-button" href="assets/${qe}/questions.pdf#page=${q.page}" target="_blank" rel="noopener">원본 PDF ${q.page}쪽</a></div></article>${renderSplitHandle()}<div class="study-side">${done?`<aside class="solve-card feedback-card" aria-label="정답과 해설"><div class="feedback ${right?'':'incorrect'}" role="status" aria-live="polite"><p class="feedback-status">${right?'정답이에요!':'아쉽지만, 오답이에요.'}</p><p class="feedback-answers">내 답 ${circles[answer-1]} · 정답 <strong>${circles[q.answer-1]}</strong>${right?` · ${q.points}점`:''}</p><h3 class="explanation-title">${escapeHtml(detail?.title||(explainedExams.has(qe)?'문항 해설':'해설 준비 중'))}</h3>${detail?`<p class="clue">${escapeHtml(detail.clue)}</p><p class="explanation-text">${escapeHtml(detail.explanation)}</p>${detail.contrast?`<p class="contrast">${escapeHtml(detail.contrast)}</p>`:''}${detail.sourceUrl?`<p><a class="text-button" href="${escapeHtml(detail.sourceUrl)}" target="_blank" rel="noopener">참고: ${escapeHtml(detail.sourceLabel)}</a></p>`:''}`:`<p class="explanation-text">${explainedExams.has(qe)?'이 문항의 해설 자료를 불러오지 못했습니다.':'이 회차의 해설은 아직 준비 중입니다. 정답만 확인할 수 있어요.'}</p>`}<p class="explanation-note">${explainedExams.has(qe)?'학습용 자체 작성 해설 · ':''}정답은 원본 정답표 기준</p></div></aside>${renderDeep(q,answer)}`:`<aside class="solve-card idle-card" aria-label="해설 안내"><p>왼쪽에서 답을 고르고 <strong>정답 확인</strong>을 누르면 정답과 해설이 이곳에 나타납니다.</p></aside>`}</div></div><div class="study-bottom"><span>${storageAvailable?'진도 자동 저장 · 같은 브라우저에서 이어 풀기':'저장 불가 · 현재 페이지를 열어 두세요.'}</span></div></section>`;
  document.getElementById('question-image').addEventListener('load',()=>{fitSticky();if(pendingScroll){const go=pendingScroll;pendingScroll=null;go();}});
  document.getElementById('question-image').addEventListener('error',()=>{document.querySelector('.question-body').innerHTML='<p class="study-image-error">문제 이미지를 열지 못했습니다. 아래 원본 PDF에서 확인해 주세요.</p>';},{once:true});
  paintSplit();
}
function chooseAnswer(answer){if(view!=='study'||!session)throw Error('먼저 학습을 시작해 주세요.');if(session.checked[session.index])throw Error('확인한 답은 수정할 수 없습니다.');if(!Number.isInteger(answer)||answer<1||answer>5)throw Error('1~5번 중에서 선택해 주세요.');session.answers[session.index]=answer;saveSession();document.querySelectorAll('[data-answer]').forEach(b=>{const selected=Number(b.dataset.answer)===answer;b.setAttribute('aria-checked',String(selected));b.tabIndex=selected?0:-1;});document.getElementById('check-answer').disabled=false;}
function checkAnswer(){if(view!=='study'||!session)throw Error('진행 중인 학습이 없습니다.');const i=session.index;if(session.answers[i]===null)throw Error('답을 먼저 선택해 주세요.');if(session.checked[i])return;session.checked[i]=true;if(session.checked.every(Boolean))session.status='complete';saveSession();renderLesson();
  // 넓은 화면에서는 고정된 문제 칸과 해설이 한 화면에 보이도록 위치를 맞춘다.
  if(window.matchMedia?.('(min-width:901px)')?.matches)document.querySelector('.study-layout')?.scrollIntoView?.({block:'start'});
  document.querySelector('[data-next]')?.focus({preventScroll:true});}
function nextQuestion(){if(!session.checked[session.index])throw Error('정답과 해설을 먼저 확인해 주세요.');if(session.index===activeExam.questions.length-1){const remaining=session.checked.findIndex(done=>!done);if(remaining!==-1){jumpQuestion(remaining+1);return;}navigate(resultHash(session.examId));return;}jumpQuestion(session.index+2);}
function previousQuestion(){if(!session||session.index===0)return;session.index--;saveSession();renderLesson();toQuestion();document.getElementById('current-question-title').focus({preventScroll:true});}
function retryQuestion(){if(view!=='study'||!session)return;const i=session.index;if(!session.checked[i])return;session.answers[i]=null;session.checked[i]=false;if(session.status==='complete')session.status='active';foldedKey=null;saveSession();renderLesson();window.scrollTo(0,0);document.getElementById('current-question-title').focus({preventScroll:true});}
function skipQuestion(){if(view!=='study'||!session)return;const next=session.index+2;if(next<=activeExam.questions.length)jumpQuestion(next);else jumpQuestion(1);}
function renderResults(){view='result';const r=gradeSummary(activeExam,session),total=activeExam.questions.length,isSet=!!activeExam.isSet,rows=r.rows.filter(q=>filter==='all'||filter==='wrong'&&q.done&&!q.right);
  app.innerHTML=`${storageWarning()}<section class="result-home"><button class="back-link" data-home>${isSet?'목록으로':'회차 선택'}</button><div class="result-title"><div><h1>${activeExam.title} · 학습 결과</h1><p>${r.checked} / ${total}문항 학습 · 확인한 답안 기준</p></div><div class="result-actions">${r.checked<total?`<button class="button secondary" data-start="${activeExam.id}">이어 풀기</button>`:''}<button class="button primary" data-restart="${activeExam.id}">처음부터 풀기</button></div></div><div class="result-summary"><div>${isSet?`<div class="score">${r.correct}<small> / ${total}문항 정답</small></div><p class="grade-note">확인한 답안 기준 정답 수</p>`:`<div class="score">${r.score}<small> / 100점</small></div><p class="grade-note">원본 배점으로 계산한 학습 점수</p>`}</div><div class="result-stats"><div><strong>${r.correct}</strong><span>정답</span></div><div><strong>${r.wrong}</strong><span>오답</span></div><div><strong>${total-r.checked}</strong><span>아직 안 푼 문제</span></div></div></div><div class="review-header"><h2>문제와 해설 다시 보기</h2><div class="review-filter"><button data-filter="all" aria-pressed="${filter==='all'}">전체</button><button data-filter="wrong" aria-pressed="${filter==='wrong'}">오답 ${r.wrong}</button></div></div><div class="result-table-wrap"><table class="result-table"><thead><tr><th scope="col">문항</th><th scope="col">내 답</th><th scope="col">정답</th><th scope="col">결과</th><th scope="col">해설</th></tr></thead><tbody>${rows.map(q=>`<tr><td>${isSet?`제${q.examId}회 ${q.number}번`:`${q.number}번`}</td><td>${q.given?circles[q.given-1]:'—'}</td><td>${q.done?circles[q.answer-1]:'—'}</td><td>${q.done?`<span class="${q.right?'correct-label':'wrong-label'}">${q.right?'정답':'오답'}</span>`:'미학습'}</td><td>${q.done?`<button class="text-button" data-review="${q.pos}">${explainedExams.has(q.examId??activeExam.id)?'해설 보기':'문제 보기'}</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">오답이 없습니다.</td></tr>'}</tbody></table></div></section>`;
}
function renderRoute(){const direct=location.hash.match(/^#q-(\d+)-(\d+)$/),target=direct&&examById(direct[1]);
  if(target&&Number(direct[2])>=1&&Number(direct[2])<=target.questions.length){ // 이론 정리에서 특정 문항으로 이동
    activeExam=target;session=readAttempt(target.id)||newAttempt(target.id);session.index=Number(direct[2])-1;returnToResult=false;saveSession();history.replaceState(null,'',`#study-${target.id}`);renderLesson();return;}
  const setMatch=location.hash.match(/^#set-(result-)?([a-z0-9-]+)$/);
  if(setMatch){const set=setById(setMatch[2]);if(!set){renderHome();return;}activeExam=set;session=readAttempt(set.id)||newAttempt(set.id);if(setMatch[1])renderResults();else renderLesson();return;}
  if(location.hash==='#units'||location.hash==='#special'){renderUnits(location.hash.slice(1));return;}
  const match=location.hash.match(/^#(study|exam|learning-result|result)-(\d+)$/);if(!match){renderHome();return;}activeExam=examById(match[2]);if(!activeExam){renderHome();return;}session=readAttempt(activeExam.id)||newAttempt(activeExam.id);if(match[1].includes('result'))renderResults();else renderLesson();}
app.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-start'))startStudy(idOf(b.dataset.start));else if(b.hasAttribute('data-home')){saveSession();navigate(homeHash());}
  else if(b.hasAttribute('data-restart'))askRestart(b.dataset.restart);else if(b.hasAttribute('data-answer'))chooseAnswer(Number(b.dataset.answer));
  else if(b.hasAttribute('data-check'))checkAnswer();else if(b.hasAttribute('data-next'))nextQuestion();else if(b.hasAttribute('data-skip'))skipQuestion();else if(b.hasAttribute('data-previous'))previousQuestion();
  else if(b.hasAttribute('data-retry'))retryQuestion();
  else if(b.hasAttribute('data-jump'))jumpQuestion(Number(b.dataset.jump));
  else if(b.hasAttribute('data-result')){filter='all';navigate(resultHash(idOf(b.dataset.result)));}
  else if(b.hasAttribute('data-show-result'))navigate(resultHash(session.examId));
  else if(b.hasAttribute('data-filter')){filter=b.dataset.filter;renderResults();}
  else if(b.hasAttribute('data-review')){session.index=Number(b.dataset.review)-1;returnToResult=true;saveSession();navigate(studyHash(session.examId));}
  else if(b.hasAttribute('data-fold'))toggleFold();
});
app.addEventListener('input',event=>{if(event.target.id!=='question-range')return;const value=Number(event.target.value);document.getElementById('question-range-label').textContent=`${value}번 문제`;event.target.setAttribute('aria-valuetext',`${value}번 문제`);});
app.addEventListener('change',event=>{if(event.target.id==='question-range'){jumpQuestion(Number(event.target.value));document.getElementById('question-range').focus({preventScroll:true});}});
app.addEventListener('toggle',event=>{if(event.target.classList?.contains('question-list'))questionListOpen=event.target.open;},true);
app.addEventListener('keydown',event=>{const b=event.target.closest('[data-answer]');if(!b||b.disabled)return;const step=['ArrowRight','ArrowDown'].includes(event.key)?1:['ArrowLeft','ArrowUp'].includes(event.key)?-1:0;if(step){event.preventDefault();const next=(Number(b.dataset.answer)-1+step+5)%5+1;chooseAnswer(next);document.querySelector(`[data-answer="${next}"]`).focus();}});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();saveSession();navigate('');});window.addEventListener('hashchange',renderRoute);window.addEventListener('pagehide',saveSession);
function registerBrowserTools(){if(!document.modelContext?.registerTool)return;const lifecycle=new AbortController(),tools=[
  {name:'go_to_history_question',description:'Move to a question number while preserving selected and checked answers. Unchecked answers stay hidden.',inputSchema:{type:'object',properties:{question:{type:'integer',minimum:1,maximum:50}},required:['question'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{jumpQuestion(input?.question);return {examId:activeExam.id,question:session.index+1};}},
  {name:'read_history_learning_state',description:'Read the current question and progress. Answers and explanations are returned only after checking.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({view,examId:activeExam?.id||null,question:session?session.index+1:null,completed:session?.checked.filter(Boolean).length||0,...(view==='study'&&session.checked[session.index]?{correct:session.answers[session.index]===activeExam.questions[session.index].answer,answer:activeExam.questions[session.index].answer,explanation:explanations[curKey()],detailedExplanation:deepDetails[curKey()]}:{})})},
  {name:'start_history_learning',description:'Start or resume one-question-at-a-time learning for an exam.',inputSchema:{type:'object',properties:{examId:{type:'integer',enum:exams.map(e=>e.id)}},required:['examId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!Number.isInteger(input?.examId)||!examById(input.examId))throw Error('지원하지 않는 회차입니다.');startStudy(input.examId);return {examId:activeExam.id,question:session.index+1};}},
  {name:'check_history_answer',description:'Choose and check an answer for the current question, then show its explanation.',inputSchema:{type:'object',properties:{answer:{type:'integer',minimum:1,maximum:5}},required:['answer'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{chooseAnswer(input?.answer);checkAnswer();return {question:session.index+1,correct:session.answers[session.index]===activeExam.questions[session.index].answer,answer:activeExam.questions[session.index].answer};}},
  {name:'next_history_question',description:'Move to the next question after the current explanation is shown, or display the final learning result.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{if(view!=='study')throw Error('진행 중인 학습이 없습니다.');nextQuestion();return {view,question:session.index+1};}}
];tools.forEach(tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
renderRoute();registerBrowserTools();
