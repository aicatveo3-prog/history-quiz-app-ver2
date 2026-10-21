// Exercise the actual learning logic with isolated storage and a minimal DOM adapter.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../dist');
const sources=['exams.js','explanations.js','details.js','theory-data.js','units.js','study.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
const storage=new Map();
storage.set('korean-history-exam-v1-79','original mock exam record');
function createApp({blockedStorage=false,hash=''}={}){
  const makeNode=()=>({innerHTML:'',textContent:'',disabled:false,open:false,dataset:{},addEventListener(){},setAttribute(){},focus(){},querySelector(){return makeNode()},close(){this.open=false},showModal(){this.open=true}});
  const nodes=new Map(),registered=new Map();
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id)},querySelector:makeNode,querySelectorAll:()=>[],createElement:makeNode,body:{append(){}},modelContext:{registerTool(t){registered.set(t.name,t)}}};
  const location={hash,pathname:'/index.html'};
  const context=vm.createContext({window:{addEventListener(){},scrollTo(){}},document,location,history:{replaceState(_,__,url){location.hash=url.startsWith('#')?url:''}},localStorage:{getItem(k){if(blockedStorage)throw Error('blocked');return storage.get(k)||null},setItem(k,v){if(blockedStorage)throw Error('blocked');storage.set(k,v)}},console,AbortController});
  for(const source of sources)vm.runInContext(source,context);
  return {context,registered,run:s=>vm.runInContext(s,context),html:()=>nodes.get('app').innerHTML};
}
const app=createApp(),data=app.run('window.EXAMS');
// 기출 풀이 화면의 해설: 새로 만드는 중(현재 77회만). 이론 정리는 theory-explanations.js를 따로 쓴다.
assert.equal(Object.keys(app.run('window.EXPLANATIONS')).length,450);
assert.equal(Object.keys(app.run('window.DETAILS')).length,450);
for(const exam of data){
  const hasExp=app.run(`Object.keys(explanations).some(k=>k.startsWith('${exam.id}-'))`); // exams added later have questions + answer key only
  const fullExp=app.run(`Array.from({length:50},(_,i)=>'${exam.id}-'+(i+1)).every(k=>k in explanations)`); // all 50 have explanations
  assert.equal(exam.questions.length,50);
  assert.equal(exam.questions.reduce((s,q)=>s+q.points,0),100);
  assert.deepEqual(Array.from(exam.questions,q=>q.number),Array.from({length:50},(_,i)=>i+1));
  for(const q of exam.questions){
    assert.ok([1,2,3,4,5].includes(q.answer));
    assert.ok(fs.existsSync(path.join(root,q.image)),q.image);
    if(hasExp){
      const detail=app.run(`explanations['${exam.id}-${q.number}']`);
      if(detail){
        for(const field of ['title','clue','explanation','contrast'])assert.ok(detail[field]?.trim().length>2,`${exam.id}-${q.number} ${field}`);
        assert.ok(detail.explanation.length>45,'substantive explanation');
        const deep=app.run(`window.DETAILS['${exam.id}-${q.number}']`);
        for(const field of ['read','theory','memo'])assert.ok(deep[field]?.trim().length>10,`${exam.id}-${q.number} deep ${field}`);
        assert.equal(deep.choices.length,5,`${exam.id}-${q.number} choices`);
        for(const c of deep.choices)assert.ok(c.trim().length>10,`${exam.id}-${q.number} choice text`);
      }
    }else assert.equal(app.run(`'${exam.id}-${q.number}' in explanations`),false);
    assert.ok(q.page>=1&&q.page<=12);
  }
  for(const page of exam.pages)assert.ok(fs.existsSync(path.join(root,page.image)));
  for(const file of ['questions.pdf','answers.pdf'])assert.ok(fs.existsSync(path.join(root,'assets',String(exam.id),file)));
  app.run(`startStudy(${exam.id},true)`);
  for(let n=0;n<50;n++){
    assert.ok(!app.html().includes('feedback-status'),'no answer before submission');
    assert.throws(()=>app.run('nextQuestion()'));
    assert.throws(()=>app.run('checkAnswer()'));
    app.run('chooseAnswer(activeExam.questions[session.index].answer);checkAnswer()');
    assert.ok(app.html().includes('정답이에요!'));
    if(hasExp){
      const qHasExp=app.run(`'${exam.id}-${n+1}' in explanations`);
      if(qHasExp){
        assert.ok(app.html().includes('explanation-text'));
        assert.ok(app.html().includes('deep-explain')&&app.html().includes('보기별 분석'),'detailed explanation shown after check');
      }else{
        assert.ok(app.html().includes('해설은 아직 준비 중')||app.html().includes('해설 자료를 불러오지 못했습니다'),'partial: unexplained question says so');
      }
    }else{
      assert.ok(app.html().includes('해설은 아직 준비 중'),'unexplained exams say so after checking');
      assert.ok(!app.html().includes('deep-explain'));
    }
    assert.throws(()=>app.run('chooseAnswer(1)'),'checked answer immutable');
    const checked=app.run('session.checked.filter(Boolean).length');
    app.run('checkAnswer()');assert.equal(app.run('session.checked.filter(Boolean).length'),checked);
    app.run('nextQuestion()');
  }
  const result=app.run('gradeSummary(activeExam,session)');
  assert.equal(result.score,100);assert.equal(result.correct,50);assert.equal(result.wrong,0);assert.equal(app.run('view'),'result');assert.equal(app.run('session.status'),'complete');
  console.log(fullExp?`PASS ${exam.id}: 50 question assets, 50 authored explanations, sequential check/next, 100-point result`:hasExp?`PASS ${exam.id}: 50 question assets, partial explanations, sequential check/next, 100-point result`:`PASS ${exam.id}: 50 question assets + answer key, sequential check/next, 100-point result (no explanations yet)`);
}
app.run('startStudy(79,true)');
assert.throws(()=>app.run('chooseAnswer(0)'));assert.throws(()=>app.run('chooseAnswer(6)'));assert.throws(()=>app.run('chooseAnswer(2.5)'));
app.run('chooseAnswer(2)');
let resumed=createApp({hash:'#exam-79'});
assert.equal(resumed.run('session.answers[0]'),2);assert.equal(resumed.run('session.checked[0]'),false);assert.ok(!resumed.html().includes('feedback-status'));
resumed.run('checkAnswer();nextQuestion();chooseAnswer(1);checkAnswer()');
assert.ok(resumed.html().includes('오답이에요.'));
resumed.run('nextQuestion();chooseAnswer(4)');
resumed=createApp({hash:'#study-79'});
assert.equal(resumed.run('session.index'),2);assert.equal(resumed.run('session.answers[2]'),4);assert.equal(resumed.run('session.checked[2]'),false);
resumed.run('previousQuestion()');assert.ok(resumed.html().includes('오답이에요.'));assert.throws(()=>resumed.run('chooseAnswer(4)'));
resumed.run('navigate("#learning-result-79")');
const partial=resumed.run('gradeSummary(activeExam,session)');
assert.equal(partial.score,data.find(e=>e.id===79).questions[0].points);assert.equal(partial.correct,1);assert.equal(partial.wrong,1);assert.equal(partial.checked,2);
assert.equal((resumed.html().match(/data-review=/g)||[]).length,2,'only checked answers get review links');
resumed.run('filter="wrong";renderResults()');assert.equal((resumed.html().match(/data-review=/g)||[]).length,1);
assert.equal(storage.get('korean-history-exam-v1-79'),'original mock exam record');
console.log('PASS reload/resume, legacy hash, selected-but-unchecked persistence, immutable review, weighted partial results, wrong-answer filter, old storage preservation');
const blocked=createApp({blockedStorage:true});blocked.run('startStudy(74,true);chooseAnswer(3);checkAnswer();nextQuestion()');
assert.equal(blocked.run('session.index'),1);assert.equal(blocked.run('storageAvailable'),false);assert.ok(blocked.html().includes('저장할 수 없습니다'));
console.log('PASS learning remains usable with unavailable localStorage');
storage.delete('korean-history-study-v2-78');
const toolsApp=createApp();assert.equal(toolsApp.registered.size,5);
const tool=(name,args={})=>toolsApp.registered.get(name).execute(args);
assert.throws(()=>tool('start_history_learning',{examId:99}));
tool('start_history_learning',{examId:78});assert.equal(tool('read_history_learning_state').answer,undefined);
assert.throws(()=>tool('next_history_question'));assert.throws(()=>tool('check_history_answer',{answer:6}));
const correct=tool('check_history_answer',{answer:5});assert.equal(correct.correct,true);assert.equal(tool('read_history_learning_state').answer,5);
tool('next_history_question');assert.equal(tool('read_history_learning_state').question,2);assert.equal(tool('read_history_learning_state').explanation,undefined);
console.log('PASS WebMCP state, answer-reveal guard, invalid input, checking, next question');
const navigation=createApp();navigation.run('startStudy(79,true);chooseAnswer(2);jumpQuestion(17)');
assert.equal(navigation.run('session.index'),16);
assert.equal(navigation.run('session.answers[0]'),2,'unsubmitted choice survives jumping');
assert.ok(!navigation.html().includes('feedback-status'),'jumping never grades a question');
assert.equal((navigation.html().match(/data-jump=/g)||[]).length,50);
navigation.run('chooseAnswer(4);checkAnswer();jumpQuestion(1)');
assert.equal(navigation.run('session.checked[0]'),false);
assert.equal(navigation.run('session.checked[16]'),true);
assert.equal(navigation.run('session.answers[0]'),2);
navigation.run('jumpQuestion(17)');assert.ok(navigation.html().includes('feedback-status'));
const jumpResumed=createApp({hash:'#exam-79'});assert.equal(jumpResumed.run('session.index'),16);
assert.throws(()=>navigation.run('jumpQuestion(0)'));assert.throws(()=>navigation.run('jumpQuestion(51)'));assert.throws(()=>navigation.run('jumpQuestion(1.5)'));
navigation.run('jumpQuestion(50);chooseAnswer(3);checkAnswer();nextQuestion()');assert.equal(navigation.run('session.index'),0,'last question returns to first unchecked question');
assert.equal(navigation.run('session.status'),'active');
assert.ok(!navigation.html().includes('남은 시간'));assert.ok(!navigation.html().includes('시간 제한'));
assert.ok(!fs.readFileSync(path.join(root,'study.js'),'utf8').match(/setInterval|deadline|remainingTime/));
assert.equal(data.every(e=>!('minutes' in e)),true);
tool('go_to_history_question',{question:50});assert.equal(tool('read_history_learning_state').question,50);assert.equal(tool('read_history_learning_state').answer,undefined);
assert.throws(()=>tool('go_to_history_question',{question:51}));
console.log('PASS free question navigation, unsubmitted-choice preservation, checked review, jump resume, last-question recovery, no timer');

// --- 이론 정리: 150문항이 빠짐없이 한 번씩, 문제 바로가기와 역링크 ---
const theoryApp=createApp();
const eras=theoryApp.run('JSON.parse(JSON.stringify(window.THEORY))');
const themed=eras.flatMap(e=>e.themes.flatMap(t=>t.questions.map(q=>q.id)));
assert.equal(themed.length,150);assert.equal(new Set(themed).size,150,'each question belongs to exactly one theme');
for(const era of eras)for(const theme of era.themes){
  assert.ok(theme.name.trim()&&theme.theory.length&&theme.memos.length&&theme.contrasts.length,`${theme.id} content`);
  assert.equal(theme.count,theme.questions.length);
  for(const part of [...theme.theory,...theme.memos,...theme.contrasts]){assert.ok(part.text.trim());assert.ok(part.src.every(id=>themed.includes(id)));}
}
theoryApp.run('navigate("#q-79-12")');
assert.equal(theoryApp.run('session.index'),11);assert.equal(theoryApp.run('activeExam.id'),79);assert.equal(theoryApp.run('location.hash'),'#study-79');
assert.ok(!theoryApp.html().includes('feedback-status'),'theory shortcut never reveals the answer');
theoryApp.run('chooseAnswer(activeExam.questions[11].answer);checkAnswer()');
const themeId=theoryApp.run('themeOf.get("79-12").id');
assert.ok(theoryApp.html().includes(`theory.html#${themeId}`),'study page links back to its theory theme');
theoryApp.run('navigate("#q-79-99")');assert.equal(theoryApp.run('view'),'home','unknown question falls back to home');
console.log('PASS theory data covers 150 questions once, #q- shortcut, back-link to theory');
// --- 보강 항목과 사실 정정 ---
const extraItems=eras.flatMap(e=>e.themes.flatMap(t=>t.extras.map(x=>({...x,theme:t.id}))));
assert.equal(extraItems.length,77);assert.equal(new Set(extraItems.map(x=>x.id)).size,77);
for(const x of extraItems){assert.ok(x.text.trim().length>20,`${x.id} text`);assert.ok(['짝꿍','흐름','비교'].includes(x.type));assert.ok(x.sources.length>0&&x.sources.every(s=>s.url.startsWith('https://')&&s.label),`${x.id} sources`);assert.ok(!('why' in x),'maintainer notes stay out of the page');}
// 사실 정정은 이론 정리 원고(content/theory-source)와 이론 팝업 해설에 남아 있어야 한다.
const theoryCtx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'theory-explanations.js'),'utf8'),theoryCtx);
const theoryPopup=theoryCtx.window;
assert.equal(Object.keys(theoryPopup.THEORY_EXPLANATIONS).length,150);assert.equal(Object.keys(theoryPopup.THEORY_DETAILS).length,150);
assert.deepEqual(Object.keys(theoryPopup.THEORY_DETAILS).sort(),[...themed].sort(),'theory popup covers every theory question');
const allDetails=JSON.stringify(theoryPopup.THEORY_DETAILS);
for(const stale of ['16관등(좌평~대덕)','1944 건국 강령','숙종 전국','수신사(김홍집·김옥균)','우륵은 대가야 출신으로 가야금을 만들었','단양 금굴·점말동굴','1905 을사늑약(외교권 박탈, 통감부 설치)','1997.12 IMF 구제 금융'])assert.ok(!allDetails.includes(stale),`stale fact still present: ${stale}`);
for(const fixed of ['좌평~극우','1941 건국 강령','제천 점말동굴','1906 통감부 설치','1209 교정도감 설치'])assert.ok(allDetails.includes(fixed),`fix missing: ${fixed}`);
console.log('PASS 77 sourced extras, corrected facts present and stale wording gone');

// --- 해설 없이 추가된 회차: 문제·정답만 제공 ---
const unexplainedIds=data.filter(e=>!app.run(`Object.keys(explanations).some(k=>k.startsWith('${e.id}-'))`)).map(e=>e.id);
assert.deepEqual(Array.from(unexplainedIds),[70,71]);
assert.deepEqual(Array.from(data,e=>e.id),[70,71,72,73,74,75,76,77,78,79,80],'all eleven exams are present, oldest first');
const homeApp=createApp();homeApp.run('renderHome()');
assert.ok(homeApp.html().includes('해설 준비 중'));assert.ok(homeApp.html().includes('제80회 심화'),'newest exam is featured');
console.log('PASS exams without study explanations are listed on the home page as answer-only (해설 준비 중)');

// --- 단원별 풀기 · 특수 분류 ---
const unitApp=createApp();
const units=unitApp.run('JSON.parse(JSON.stringify(window.UNITS))');
const allIds=data.flatMap(e=>e.questions.map(q=>`${e.id}-${q.number}`));
const unitIds=units.eras.flatMap(e=>e.themes.flatMap(t=>t.questions));
assert.equal(unitIds.length,550);assert.equal(new Set(unitIds).size,550,'each question belongs to exactly one unit theme');
assert.deepEqual([...unitIds].sort(),[...allIds].sort(),'unit themes cover every question');
for(const era of units.eras){assert.deepEqual(Array.from(era.questions).sort(),Array.from(era.themes.flatMap(t=>t.questions)).sort(),`${era.id} all-set matches its themes`);for(const t of era.themes)assert.ok(t.questions.length>=2,`${t.id} has enough questions`);}
assert.deepEqual(Array.from(units.special,s=>s.id),['special-artifact','special-region','special-cross']);
for(const sp of units.special){assert.ok(sp.questions.length>0);for(const q of sp.questions)assert.ok(allIds.includes(q),`${sp.id} ${q}`);}
unitApp.run('navigate("#units")');assert.ok(unitApp.html().includes('home-tabs')&&unitApp.html().includes('고려 전체'));assert.equal(unitApp.run('view'),'home');
unitApp.run('navigate("#special")');assert.ok(unitApp.html().includes('유물·문화유산')&&unitApp.html().includes('지역사'));
// 묶음 풀이: 회차를 넘나드는 문항, 진도는 회차 기록과 분리
const examBefore=storage.get('korean-history-study-v2-72');
const unitThemeId=units.eras.find(e=>e.id==='goryeo').themes[0].id;
unitApp.run(`startStudy("${unitThemeId}",true)`);
assert.equal(unitApp.run('location.hash'),`#set-${unitThemeId}`);assert.equal(unitApp.run('activeExam.isSet'),true);
const setSize=unitApp.run('activeExam.questions.length');assert.ok(setSize>=2);
assert.ok(unitApp.html().includes('feedback-status')===false);assert.ok(unitApp.html().includes(`/ ${setSize}문항 학습`));
assert.equal((unitApp.html().match(/data-jump=/g)||[]).length,setSize);
for(let n=0;n<setSize;n++){
  assert.throws(()=>unitApp.run('nextQuestion()'));
  unitApp.run('chooseAnswer(activeExam.questions[session.index].answer);checkAnswer()');
  assert.ok(unitApp.html().includes('정답이에요!'));
  unitApp.run('nextQuestion()');
}
assert.equal(unitApp.run('view'),'result');assert.equal(unitApp.run('location.hash'),`#set-result-${unitThemeId}`);
assert.ok(unitApp.html().includes(`${setSize}문항 정답`));assert.equal((unitApp.html().match(/data-review=/g)||[]).length,setSize);
assert.equal(unitApp.run('session.status'),'complete');
assert.equal(storage.get('korean-history-study-v2-72'),examBefore,'set progress never touches exam records');
unitApp.run('navigate("#units")');assert.ok(unitApp.html().includes('학습 결과'),'completed set shows result button');
const reloaded=createApp({hash:`#set-${unitThemeId}`});assert.equal(reloaded.run('activeExam.id'),unitThemeId);assert.equal(reloaded.run('session.status'),'complete');
assert.equal(createApp({hash:'#set-nope'}).run('view'),'home','unknown set falls back to home');
// 특수 분류 묶음도 같은 흐름 + 지역 태그
const regionApp=createApp();regionApp.run('startStudy("special-region",true)');
assert.ok(regionApp.run('activeExam.questions.some(q=>q.tag)'));assert.ok(regionApp.html().includes('제'));
regionApp.run('chooseAnswer(1);jumpQuestion(2)');assert.equal(regionApp.run('session.index'),1);
assert.throws(()=>regionApp.run('jumpQuestion(99)'));
// 72회 47·48번 공통 지문
const q72=JSON.parse(fs.readFileSync(path.resolve(root,'../content/questions-text/72.json'),'utf8'));
for(const n of [47,48])assert.ok(q72.find(q=>q.number===n).passage.includes('녹읍'),`72-${n} shared passage`);
console.log('PASS 550 questions in unit themes exactly once, 3 special sets, set study flow (check/next/result/reload), set progress separate from exam progress');
