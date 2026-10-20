import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url);
const code=fs.readFileSync(new URL('sync.js',root),'utf8');
function el(){const e={children:[],dataset:{},classList:{add(){},remove(){}},style:{},_l:{},
  append(...c){e.children.push(...c)},appendChild(c){e.children.push(c);if(c.src&&e.isHead)setTimeout(()=>c.onload&&c.onload(),0);return c},
  addEventListener(t,f){e._l[t]=f},setAttribute(){},querySelector(){return el()},set textContent(v){e.children=[];e._t=v},get textContent(){return e._t},
  showModal(){},close(){},focus(){},hidden:false};return e}
function setup({local={},remote={},user={uid:'u1',displayName:'테스터'}}){
  const store=new Map(Object.entries(local));const cloud=new Map(Object.entries(remote));const events=[];
  const head=el();head.isHead=true;const header=el();
  const document={createElement:()=>el(),head,body:el(),querySelector:s=>s==='.site-header'?header:null};
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k),get length(){return store.size},key:i=>[...store.keys()][i]};
  let authCb;const writes=[];
  const docRef=id=>({set:async v=>{writes.push([id,JSON.parse(v.data)]);cloud.set(id,v.data)}});
  const firebase={initializeApp(){},auth:Object.assign(()=>({onAuthStateChanged(cb){authCb=cb},signOut:async()=>authCb(null)}),{GoogleAuthProvider:class{}}),
    firestore:()=>({collection:()=>({doc:()=>({collection:()=>({doc:docRef,get:async()=>({forEach:f=>cloud.forEach((v,id)=>f({id,data:()=>({data:v})}))})})})})})};
  const window={FIREBASE_CONFIG:{apiKey:'x'},dispatchEvent:e=>events.push(e.detail),addEventListener(){}};
  const ctx=vm.createContext({window,document,localStorage,firebase,setTimeout,clearTimeout,CustomEvent:class{constructor(t,o){this.detail=o?.detail}},console});
  vm.runInContext(code,ctx);return {ctx,store,cloud,writes,events,login:()=>authCb(user),logout:()=>authCb(null),window}}
const K='korean-history-study-v2-';
const S=(n,t,ans=1)=>({examId:79,status:'active',answers:Array(50).fill(null).map((_,i)=>i<n?ans:null),checked:Array(50).fill(false).map((_,i)=>i<n),index:0,updatedAt:t});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// 1) 새 기기: 로컬 없음, 클라우드에 있음 -> 내려받기
let t=setup({remote:{'79':JSON.stringify(S(30,2000))}});await wait(20);t.login();await wait(50);
assert.equal(JSON.parse(t.store.get(K+'79')).checked.filter(Boolean).length,30);assert.ok(t.events.some(e=>e.pulled));console.log('PASS new device pulls cloud');
// 2) 로컬이 더 최근 -> 올리기
t=setup({local:{[K+'79']:JSON.stringify(S(40,5000))},remote:{'79':JSON.stringify(S(30,2000))}});await wait(20);t.login();await wait(900);
assert.equal(t.writes.length,1);assert.equal(t.writes[0][1].checked.filter(Boolean).length,40);console.log('PASS newer local uploads');
// 3) 첫 로그인: 로컬만 있음 -> 업로드
t=setup({local:{[K+'80']:JSON.stringify({...S(5,100),examId:80})}});await wait(20);t.login();await wait(900);
assert.equal(t.writes.length,1);assert.equal(t.writes[0][0],'80');console.log('PASS first login uploads existing local progress');
// 4) 빈 로컬(방금 만든 새 시도)이 클라우드 기록을 덮어쓰지 않음
t=setup({local:{[K+'79']:JSON.stringify(S(0,9999))},remote:{'79':JSON.stringify(S(30,2000))}});await wait(20);t.login();await wait(900);
assert.equal(t.writes.length,0);assert.equal(JSON.parse(t.store.get(K+'79')).checked.filter(Boolean).length,30);console.log('PASS empty fresh attempt does not clobber cloud');
// 5) 로그아웃: 로컬 기록 삭제
t=setup({local:{[K+'79']:JSON.stringify(S(10,100)),other:'keep'}});await wait(20);t.login();await wait(900);
const btn=(function find(n){if(n&&n.className==='auth-btn'&&n._t==='로그아웃')return n;for(const c of n?.children||[]){const r=find(c);if(r)return r}})(t.ctx.document.querySelector('.site-header'));
assert.ok(btn,'logout button');await btn._l.click();await wait(50);
assert.equal(t.store.has(K+'79'),false);assert.equal(t.store.get('other'),'keep');assert.ok(t.events.some(e=>e.signedOut));console.log('PASS logout clears local progress only, after flushing');
// 6) 설정 없으면 무동작
const w={};const c=vm.createContext({window:w,document:{},console});vm.runInContext(code,c);assert.equal(w.CloudSync,undefined);console.log('PASS no config => disabled');
