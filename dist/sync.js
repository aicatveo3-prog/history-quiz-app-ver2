"use strict";
// 로그인 + 학습 기록 동기화 (Firebase Auth / Firestore).
// 기록의 원본은 계속 localStorage이고, 로그인하면 같은 내용을 users/{uid}/progress/{회차} 문서로 복사해 둔다.
// 설정(firebase-config.js)이 없으면 아무것도 하지 않는다.
(()=>{
const cfg=window.FIREBASE_CONFIG;
if(!cfg||!cfg.apiKey)return;
const PREFIX='korean-history-study-v2-',SDK='https://www.gstatic.com/firebasejs/10.12.2/';
let auth=null,db=null,user=null,status='idle',busy=false;
const pending=new Map(),timers=new Map();

// ---- 기록 비교 ----
const getLocal=id=>{try{return JSON.parse(localStorage.getItem(PREFIX+id)||'null');}catch{return null;}};
const hasWork=s=>!!s&&Array.isArray(s.answers)&&s.answers.some(a=>a!==null);
const stamp=s=>Number(s?.updatedAt)||0,done=s=>Array.isArray(s?.checked)?s.checked.filter(Boolean).length:0;
// 클라우드 기록이 이기는 경우: 풀이가 있고 + (로컬이 비었거나 / 더 최근이거나 / 시각 정보가 없으면 더 많이 푼 쪽)
function remoteWins(local,remote){
  if(!hasWork(remote))return false;if(!hasWork(local))return true;
  if(stamp(local)&&stamp(remote))return stamp(remote)>stamp(local);
  return done(remote)>done(local);
}

// ---- Firebase 불러오기 ----
const loadScript=src=>new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(new Error('load '+src));document.head.appendChild(s);});
async function boot(){
  await loadScript(SDK+'firebase-app-compat.js');
  await Promise.all([loadScript(SDK+'firebase-auth-compat.js'),loadScript(SDK+'firebase-firestore-compat.js')]);
  firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();
  auth.onAuthStateChanged(onUser);
}
const col=()=>db.collection('users').doc(user.uid).collection('progress');

// ---- 올리기 / 내려받기 ----
function setStatus(s){status=s;renderSlot();}
function push(id,session){
  if(!user||!hasWork(session))return;
  id=String(id);pending.set(id,session);clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>flushOne(id),700));setStatus('syncing');
}
async function flushOne(id){
  const s=pending.get(id);if(!s||!user)return;pending.delete(id);
  try{await col().doc(id).set({data:JSON.stringify(s),updatedAt:stamp(s)||Date.now(),checked:done(s)});setStatus(pending.size?'syncing':'synced');}
  catch{setStatus('error');}
}
async function flushAll(){for(const id of [...pending.keys()]){clearTimeout(timers.get(id));await flushOne(id);}}
async function pull(){
  setStatus('syncing');let changed=false;
  try{
    const snap=await col().get(),seen=new Set();
    snap.forEach(d=>{
      const id=d.id,raw=d.data().data;seen.add(id);let remote=null;try{remote=JSON.parse(raw);}catch{}
      const local=getLocal(id),localRaw=localStorage.getItem(PREFIX+id);
      if(remoteWins(local,remote)){try{localStorage.setItem(PREFIX+id,JSON.stringify(remote));changed=true;}catch{}}
      else if(hasWork(local)&&localRaw!==raw)push(id,local);
    });
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith(PREFIX))continue;const id=k.slice(PREFIX.length);if(!seen.has(id)){const l=getLocal(id);if(hasWork(l))push(id,l);}}
    if(!pending.size)setStatus('synced');
  }catch{setStatus('error');}
  if(changed)window.dispatchEvent(new CustomEvent('cloudsync-change',{detail:{pulled:true}}));
}
async function onUser(u){
  user=u;renderSlot();
  if(u)await pull();else{pending.clear();setStatus('idle');}
}
async function signOut(){
  if(busy)return;busy=true;
  try{
    await flushAll();
    // 다음 사람이 이 브라우저를 써도 기록이 섞이지 않도록 로컬 기록을 지운다 (클라우드에는 그대로 남아 있다)
    const drop=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX))drop.push(k);}
    drop.forEach(k=>localStorage.removeItem(k));
    await auth.signOut();
    window.dispatchEvent(new CustomEvent('cloudsync-change',{detail:{signedOut:true}}));
  }finally{busy=false;}
}
window.CloudSync={push,flush:flushAll};

// ---- 화면 ----
const slot=document.createElement('div');slot.className='auth-slot';
document.querySelector('.site-header')?.appendChild(slot);
const STATUS={syncing:'저장 중…',synced:'저장됨',error:'저장 실패',idle:''};
function renderSlot(){
  slot.textContent='';
  if(user){
    const name=document.createElement('span');name.className='auth-name';name.textContent=user.displayName||user.email||'내 계정';
    const st=document.createElement('span');st.className='auth-status';st.dataset.state=status;st.textContent=STATUS[status]||'';st.setAttribute('role','status');
    const out=document.createElement('button');out.type='button';out.className='auth-btn';out.textContent='로그아웃';out.addEventListener('click',signOut);
    slot.append(name,st,out);
  }else{
    const b=document.createElement('button');b.type='button';b.className='auth-btn primary';b.textContent='로그인';b.addEventListener('click',openDialog);slot.append(b);
  }
}
const ERR={
  'auth/invalid-email':'이메일 형식이 올바르지 않아요.','auth/missing-password':'비밀번호를 입력해 주세요.','auth/weak-password':'비밀번호는 6자 이상이어야 해요.',
  'auth/email-already-in-use':'이미 가입된 이메일이에요. 로그인해 주세요.','auth/user-not-found':'가입되지 않은 이메일이에요.','auth/wrong-password':'비밀번호가 맞지 않아요.',
  'auth/invalid-credential':'이메일 또는 비밀번호가 맞지 않아요.','auth/too-many-requests':'시도가 너무 많아요. 잠시 후 다시 해 주세요.','auth/network-request-failed':'네트워크 연결을 확인해 주세요.',
  'auth/popup-closed-by-user':'','auth/cancelled-popup-request':'','auth/unauthorized-domain':'이 주소는 Firebase 승인 도메인에 없어요. README의 설정 5번을 확인해 주세요.',
  'auth/operation-not-allowed':'이 로그인 방식이 Firebase에서 꺼져 있어요. README의 설정 3번을 확인해 주세요.'
};
let dlg=null;
function buildDialog(){
  dlg=document.createElement('dialog');dlg.className='auth-dialog';dlg.setAttribute('aria-labelledby','auth-title');
  dlg.innerHTML=`<form class="auth-form" novalidate><h2 id="auth-title">로그인</h2><p class="auth-lead">로그인하면 푼 기록이 계정에 저장되어, 다른 기기에서도 이어서 풀 수 있어요.</p>
  <button type="button" class="auth-google">Google로 계속하기</button><p class="auth-or"><span>또는 이메일로</span></p>
  <label>이메일<input type="email" name="email" autocomplete="email" required></label>
  <label>비밀번호<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
  <p class="auth-error" role="alert" hidden></p>
  <div class="auth-actions"><button type="submit" class="auth-btn primary">로그인</button><button type="button" class="auth-btn" data-signup>회원가입</button></div>
  <button type="button" class="auth-link" data-reset>비밀번호를 잊으셨나요?</button><button type="button" class="auth-close" aria-label="닫기">×</button></form>`;
  document.body.appendChild(dlg);
  const form=dlg.querySelector('form'),err=dlg.querySelector('.auth-error');
  const show=m=>{err.textContent=m;err.hidden=!m;};
  const fail=e=>show(ERR[e?.code]??'문제가 생겼어요. 잠시 후 다시 해 주세요.');
  const val=()=>({email:form.email.value.trim(),password:form.password.value});
  const run=async fn=>{show('');dlg.classList.add('is-busy');try{await fn();dlg.close();}catch(e){fail(e);}finally{dlg.classList.remove('is-busy');}};
  form.addEventListener('submit',e=>{e.preventDefault();const {email,password}=val();run(()=>auth.signInWithEmailAndPassword(email,password));});
  dlg.querySelector('[data-signup]').addEventListener('click',()=>{const {email,password}=val();run(()=>auth.createUserWithEmailAndPassword(email,password));});
  dlg.querySelector('[data-reset]').addEventListener('click',async()=>{const {email}=val();if(!email){show('위에 이메일을 먼저 입력해 주세요.');return;}
    try{await auth.sendPasswordResetEmail(email);show('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');}catch(e){fail(e);}});
  dlg.querySelector('.auth-google').addEventListener('click',()=>run(async()=>{
    const provider=new firebase.auth.GoogleAuthProvider();
    try{await auth.signInWithPopup(provider);}catch(e){if(e.code==='auth/popup-blocked'){await auth.signInWithRedirect(provider);}else throw e;}}));
  dlg.querySelector('.auth-close').addEventListener('click',()=>dlg.close());
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
}
function openDialog(){if(!dlg)buildDialog();dlg.querySelector('.auth-error').hidden=true;dlg.showModal();dlg.querySelector('input[name=email]').focus();}

renderSlot();
boot().catch(()=>{slot.textContent='';});
})();
