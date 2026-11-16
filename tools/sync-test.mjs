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
  const docRef=id=>({set:async v=>{writes.push([id,JSON.parse(v.data)]);cloud.set(id,v.data)},get:async()=>({data:()=>cloud.has(id)?{data:cloud.get(id)}:undefined})});
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
// 문제별 풀이 기록: 통째로 고르지 않고 문제별로 더 최근 것을 합친다
const SV=(items,t=1)=>JSON.stringify({kind:'solved',updatedAt:t,items});
const it=(a,ok,at)=>({a,ok,at});
// 7) 로그인: 양쪽 기록을 문제별로 합쳐 로컬에 저장하고 합친 결과를 올린다
t=setup({local:{[K+'solved']:SV({'74-1':it(1,true,100),'74-2':it(2,false,900)})},remote:{solved:SV({'74-2':it(3,true,500),'75-1':it(4,true,200)})}});await wait(20);t.login();await wait(900);
let merged=JSON.parse(t.store.get(K+'solved')).items;
assert.deepEqual(Object.keys(merged).sort(),['74-1','74-2','75-1']);assert.equal(merged['74-2'].a,2);
assert.equal(t.writes.length,1);assert.equal(Object.keys(t.writes[0][1].items).length,3);console.log('PASS solved log merges per question on login');
// 8) 합친 결과가 클라우드와 같으면 다시 올리지 않는다
t=setup({local:{[K+'solved']:SV({'74-1':it(1,true,100)},1)},remote:{solved:SV({'74-1':it(1,true,100)},2)}});await wait(20);t.login();await wait(900);
assert.equal(t.writes.length,0);console.log('PASS identical solved log is not re-uploaded');
// 9) 첫 로그인: 로컬 기록만 있으면 올린다
t=setup({local:{[K+'solved']:SV({'74-1':it(1,true,100)})}});await wait(20);t.login();await wait(900);
assert.equal(t.writes.length,1);assert.equal(t.writes[0][0],'solved');console.log('PASS first login uploads solved log');
// 10) 올리는 사이 다른 기기가 올린 문제를 덮어쓰지 않는다
t=setup({});await wait(20);t.login();await wait(50);
t.cloud.set('solved',SV({'75-1':it(4,true,200)}));
const mine={kind:'solved',updatedAt:300,items:{'74-1':it(1,true,300)}};t.store.set(K+'solved',JSON.stringify(mine));t.window.CloudSync.push('solved',mine);await wait(900);
assert.deepEqual(Object.keys(JSON.parse(t.cloud.get('solved')).items).sort(),['74-1','75-1']);assert.ok(JSON.parse(t.store.get(K+'solved')).items['75-1']);console.log('PASS upload keeps other device entries');
// 11) 풀이 기록 문서가 있어도 회차 진도는 그대로 비교된다
t=setup({remote:{solved:SV({'74-1':it(1,true,100)}),'79':JSON.stringify(S(30,2000))}});await wait(20);t.login();await wait(50);
assert.equal(JSON.parse(t.store.get(K+'79')).checked.filter(Boolean).length,30);assert.ok(t.store.get(K+'solved'));console.log('PASS solved log coexists with exam progress');
// 12) 로그아웃하면 풀이 기록도 지운다
t=setup({local:{[K+'solved']:SV({'74-1':it(1,true,100)})}});await wait(20);t.login();await wait(900);
const out=(function find(n){if(n&&n.className==='auth-btn'&&n._t==='로그아웃')return n;for(const c of n?.children||[]){const r=find(c);if(r)return r}})(t.ctx.document.querySelector('.site-header'));
await out._l.click();await wait(50);assert.equal(t.store.has(K+'solved'),false);assert.ok(t.cloud.get('solved'));console.log('PASS logout clears local solved log and keeps cloud copy');
// 북마크 기록도 문제별로 합친다(켜짐·꺼짐 모두 더 최근 쪽)
const BV=(items,t=1)=>JSON.stringify({kind:'bookmarks',updatedAt:t,items});
const bm=(on,src,at)=>({on,src,at});
t=setup({local:{[K+'bookmarks']:BV({'74-1':bm(true,'manual',100),'74-2':bm(false,'manual',900)})},remote:{bookmarks:BV({'74-2':bm(true,'auto',500),'75-1':bm(true,'auto',200)})}});await wait(20);t.login();await wait(900);
merged=JSON.parse(t.store.get(K+'bookmarks')).items;
assert.deepEqual(Object.keys(merged).sort(),['74-1','74-2','75-1']);assert.equal(merged['74-2'].on,false);
assert.equal(t.writes.length,1);assert.equal(t.writes[0][0],'bookmarks');assert.equal(JSON.parse(t.cloud.get('bookmarks')).kind,'bookmarks');
assert.ok(t.events.length>=0);console.log('PASS bookmarks merge per question, newest wins');
// 풀이 기록과 북마크가 함께 있어도 서로 섞이지 않는다
t=setup({local:{[K+'solved']:SV({'74-1':it(1,true,100)}),[K+'bookmarks']:BV({'75-1':bm(true,'manual',100)})}});await wait(20);t.login();await wait(900);
assert.deepEqual(t.writes.map(x=>x[0]).sort(),['bookmarks','solved']);
assert.deepEqual(Object.keys(JSON.parse(t.cloud.get('solved')).items),['74-1']);assert.deepEqual(Object.keys(JSON.parse(t.cloud.get('bookmarks')).items),['75-1']);console.log('PASS solved log and bookmarks stay separate');
// 6) 설정 없으면 무동작
const w={};const c=vm.createContext({window:w,document:{},console});vm.runInContext(code,c);assert.equal(w.CloudSync,undefined);console.log('PASS no config => disabled');
