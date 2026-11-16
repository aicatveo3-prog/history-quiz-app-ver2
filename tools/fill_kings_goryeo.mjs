// 한국사 연표(kings-data.js) 고려 채우기: 이론 정리(theory-data.js) 고려 주제(t21~t33)에 있는 내용만 넣는다.
//   node site/tools/fill_kings_goryeo.mjs          → 검사만(바꾸지 않음)
//   node site/tools/fill_kings_goryeo.mjs --write  → 백업 후 kings-data.js의 고려 왕(acts)과 고려 사건을 바꿈
// 항목마다 th = 근거 이론 주제 id. hot(굵게) = 고려 이론의 "구별" 문장에 나온 항목(기출 오답 선지로 자주 나오는 것).
// 검사: (1) 연도가 그 왕 재위 안 (2) 이름의 낱말이 근거 주제 글에 있음 (3) 같은 이름 중복 없음
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dist = path.resolve(import.meta.dirname, '../dist');
const file = path.join(dist, 'kings-data.js');
const ctx = vm.createContext({ window: {} });
for (const f of ['kings-data.js', 'theory-data.js']) vm.runInContext(fs.readFileSync(path.join(dist, f), 'utf8'), ctx);
const { KINGS, THEORY } = ctx.window;
const era = THEORY.find(e => e.id === 'goryeo');
// 근거 주제는 고려 주제가 기본이고, 다른 시대 주제에 고려 내용이 있으면 그 주제도 쓴다(예: t19 정치도감)
const theme = id => THEORY.flatMap(e => e.themes).find(t => t.id === id);
const norm = s => s.replace(/\\n/g, '').replace(/\s+/g, '');
const themeText = id => norm([...theme(id).memos, ...theme(id).theory, ...(theme(id).contrasts || [])].map(p => p.text).join(' '));
const contrasts = norm(era.themes.flatMap(t => (t.contrasts || []).map(c => c.text)).join(' '));

// ---- 왕별 업적(acts): [대수, 복위면 1, [항목...]] ----
// 항목: { y?, e?, name, short?, th }  (연도는 이론 글에 적힌 해만)
const ACTS = [
  [1, 0, [
    { y: 918, name: '고려 건국(수도 개경)', short: '고려 건국', th: 't21' },
    { y: 918, name: '흑창(빈민 구제)', short: '흑창', th: 't23' },
    { y: 927, name: '공산 전투 패배(신숭겸 전사)', short: '공산 전투', th: 't21' },
    { y: 930, name: '고창(안동) 전투 승리', short: '고창 전투', th: 't21' },
    { y: 935, name: '경순왕 항복·견훤 귀순', short: '경순왕 항복', th: 't21' },
    { y: 936, name: '일리천 전투·후삼국 통일', short: '후삼국 통일', th: 't21' },
    { y: 940, name: '역분전', th: 't21' },
    { y: 942, name: '만부교 사건(거란 외교 단절)', short: '만부교 사건', th: 't22' },
    { name: '훈요 10조', th: 't21' },
    { name: '정계·계백료서', th: 't21' },
    { name: '사심관·기인 제도', short: '사심관·기인', th: 't21' },
    { name: '정략결혼·사성(호족 포섭)', short: '정략결혼·사성', th: 't21' },
    { name: '취민유도', th: 't21' },
    { name: '발해 유민 수용', th: 't21' },
  ]],
  [3, 0, [{ y: 947, name: '광군 30만 조직', short: '광군', th: 't22' }]],
  [4, 0, [
    { y: 956, name: '노비안검법', th: 't21' },
    { y: 958, name: '과거제(쌍기 건의)', short: '과거제', th: 't21' },
    { y: 963, name: '제위보', th: 't23' },
    { name: '광덕·준풍 연호', th: 't21' },
    { name: '칭제건원·황도', th: 't21' },
    { name: '공복 제정', th: 't21' },
    { name: '주현공부법', th: 't21' },
    { name: '관촉사 석조 미륵보살 입상(은진 미륵)', short: '관촉사 석불', th: 't33' },
    { name: '균여 보현십원가', short: '보현십원가', th: 't31' },
  ]],
  [5, 0, [{ y: 976, name: '시정 전시과', th: 't21' }]],
  [6, 0, [
    { name: '최승로 시무 28조 수용', short: '시무 28조', th: 't21' },
    { y: 983, name: '12목 설치(지방관 파견)', short: '12목', th: 't21' },
    { name: '경학박사·의학박사 파견', short: '경학·의학박사', th: 't21' },
    { y: 986, name: '의창(흑창 개편)', short: '의창', th: 't23' },
    { y: 992, name: '국자감 설립', short: '국자감', th: 't24' },
    { y: 993, name: '상평창(물가 조절)', short: '상평창', th: 't23' },
    { y: 996, name: '건원중보(최초 철전)', short: '건원중보', th: 't26' },
    { name: '2성 6부', th: 't21' },
    { name: '향리 제도 정비', short: '향리 제도', th: 't21' },
  ]],
  [7, 0, [{ y: 998, name: '개정 전시과(관직 기준 18과)', short: '개정 전시과', th: 't21' }]],
  [8, 0, [
    { y: 1011, name: '초조대장경 조판 시작', short: '초조대장경', th: 't22' },
    { y: 1029, name: '나성 완공(강감찬 건의)', short: '나성', th: 't23' },
    { name: '5도 양계 정비', short: '5도 양계', th: 't21' },
  ]],
  [10, 0, [{ name: '천리장성(덕종~정종 시기)', short: '천리장성', th: 't22' }]],
  [11, 0, [
    { y: 1076, name: '경정 전시과(현직 관리 중심)', short: '경정 전시과', th: 't21' },
    { name: '한양을 남경으로 승격(3경)', short: '남경 승격', th: 't21' },
    { name: '최충 9재 학당(사학 12도)', short: '최충 9재', th: 't24' },
  ]],
  [13, 0, [{ y: 1086, name: '교장도감 설치·교장 편찬(의천)', short: '교장(의천)', th: 't22' }]],
  [15, 0, [
    { y: 1101, name: '주전도감', th: 't26' },
    { y: 1102, name: '해동통보·삼한통보·동국통보', short: '해동통보', th: 't26' },
    { y: 1104, name: '별무반 창설(윤관 건의)', short: '별무반', th: 't22' },
    { name: '은병(활구)', th: 't26' },
    { name: '남경 개발', th: 't21' },
  ]],
  [16, 0, [
    { y: 1109, name: '국자감 7재', short: '7재', th: 't24' },
    { y: 1112, name: '혜민국', th: 't24' },
    { name: '양현고', th: 't24' },
    { name: '서적포', th: 't24' },
    { name: '청연각·보문각', th: 't24' },
    { name: '구제도감', th: 't24' },
  ]],
  [17, 0, [
    { y: 1123, name: '서긍 방문(고려도경)', short: '고려도경', th: 't26' },
    { y: 1145, name: '삼국사기(김부식)', short: '삼국사기', th: 't32' },
    { name: '무학재 폐지', th: 't24' },
    { name: '상감 청자 전성기(인종~의종)', short: '상감 청자', th: 't33' },
  ]],
  [18, 0, [{ y: 1170, name: '무신 정변·폐위(거제도 유배)', short: '무신 정변·폐위', th: 't27' }]],
  [19, 0, [
    { y: 1179, name: '경대승 집권·도방', short: '경대승 도방', th: 't27' },
    { y: 1183, name: '이의민 집권', th: 't27' },
    { y: 1190, name: '지눌 정혜결사', short: '정혜결사', th: 't31' },
    { y: 1196, name: '최충헌 봉사 10조', short: '봉사 10조', th: 't27' },
  ]],
  [20, 0, [{ name: '최충헌 옹립', th: 't27' }]],
  [21, 0, [
    { y: 1209, name: '교정도감 설치(최충헌)', short: '교정도감', th: 't27' },
    { name: '최충헌 암살 시도 실패·폐위', short: '암살 시도 실패', th: 't27' },
  ]],
  [23, 0, [
    { y: 1215, name: '해동고승전(각훈)', short: '해동고승전', th: 't32' },
    { y: 1216, name: '요세 백련 결사', short: '백련 결사', th: 't31' },
    { y: 1219, name: '최우 집권', th: 't27' },
    { y: 1225, name: '정방(최우)', short: '정방', th: 't27' },
    { y: 1227, name: '서방(최우)', short: '서방', th: 't27' },
    { y: 1236, e: 1251, name: '팔만대장경(재조대장경) 조판', short: '팔만대장경', th: 't28' },
    { name: '삼별초 조직(최우)', short: '삼별초 조직', th: 't27' },
    { name: '상정고금예문(금속 활자)', short: '상정고금예문', th: 't33' },
  ]],
  [24, 0, [{ name: '임연 → 원종 폐위(안경공 창)', short: '임연 폐위', th: 't27' }]],
  [25, 0, [
    { y: 1281, name: '삼국유사(일연)', short: '삼국유사', th: 't32' },
    { y: 1287, name: '제왕운기(이승휴)', short: '제왕운기', th: 't32' },
    { name: '제국대장공주 혼인', short: '원 공주 혼인', th: 't29' },
    { name: '왕호·관제 격하(충○왕·첨의부)', short: '왕호·관제 격하', th: 't29' },
    { name: '안향 성리학 도입', short: '안향 성리학', th: 't29' },
    { name: '도병마사 → 도평의사사', short: '도평의사사', th: 't29' },
  ]],
  [26, 1, [
    { name: '만권당(이제현·조맹부)', short: '만권당', th: 't29' },
    { name: '국자감 → 성균관 개칭', short: '성균관 개칭', th: 't24' },
  ]],
  [29, 0, [{ y: 1348, name: '경천사지 십층석탑', short: '경천사지 10층', th: 't33' }]],
  [31, 0, [
    { y: 1356, name: '기철 등 친원파 숙청', short: '기철 숙청', th: 't29' },
    { y: 1356, name: '쌍성총관부 수복(유인우·이자춘)', short: '쌍성총관부 수복', th: 't29' },
    { y: 1356, name: '정동행성 이문소 폐지', short: '이문소 폐지', th: 't29' },
    { y: 1356, name: '원 연호 폐지·관제 복구', short: '관제 복구', th: 't29' },
    { y: 1363, name: '목화 전래(문익점)', short: '목화 전래', th: 't29' },
    { y: 1365, name: '신돈 등용', th: 't29' },
    { y: 1366, name: '전민변정도감(신돈)', short: '전민변정도감', th: 't29' },
    { y: 1367, name: '성균관 중건', th: 't29' },
    { name: '정방 폐지', th: 't29' },
  ]],
  [32, 0, [
    { name: '이인임 집권·친원 정책', short: '이인임 집권', th: 't29' },
    { y: 1377, name: '화통도감(최무선)', short: '화통도감', th: 't30' },
    { y: 1377, name: '직지심체요절(청주 흥덕사)', short: '직지심체요절', th: 't33' },
    { y: 1388, name: '철령위 통보·요동 정벌(최영)', short: '요동 정벌', th: 't30' },
  ]],
  [33, 0, [{ name: '폐위(폐가입진)', short: '폐가입진', th: 't30' }]],
  [34, 0, [{ y: 1391, name: '과전법(경기 지역)', short: '과전법', th: 't23' }]],
];

// 업적 박스 둘째 줄의 짧은 설명(d): 근거 주제 문단을 줄인 것만. "대수:이름" → 설명. (시안: 광종·성종부터)
const DESC = {
  '4:노비안검법': '호족에게 억울하게 빼앗긴 양인을 해방(호족 기반 타격)',
  '4:과거제(쌍기 건의)': '후주 출신 쌍기의 건의, 제술과·명경과·잡과로 능력 중심 관리 등용',
  '4:제위보': '기금의 이자로 빈민을 구호',
  '4:광덕·준풍 연호': '독자적 연호 사용(외왕내제)',
  '4:칭제건원·황도': '황제를 칭하고 연호를 세움, 개경 = 황도',
  '4:공복 제정': '백관의 공복(관복 색깔) 제정, 관료 질서 확립',
  '4:주현공부법': '공물 부담 기준 정비',
  '4:관촉사 석조 미륵보살 입상(은진 미륵)': '논산, 높이 약 18m 거대 석불, 지방 호족 문화의 독자성',
  '4:균여 보현십원가': '화엄종 승려 균여의 향가 11수, 화엄 사상을 대중에게 전파',
  '6:최승로 시무 28조 수용': '유교 정치 건의(지방관 파견·불교 행사 축소·호족 통제)',
  '6:12목 설치(지방관 파견)': '전국 주요 지역에 처음 지방관(목사) 파견',
  '6:경학박사·의학박사 파견': '지방에 파견하여 교육 확대',
  '6:의창(흑창 개편)': '봄에 곡식을 빌려주고 가을에 거두는 빈민 구제',
  '6:국자감 설립': '최고 교육 기관(유학·율학·서학·산학)',
  '6:상평창(물가 조절)': '물가가 오르면 곡식을 풀고 내리면 사들여 안정',
  '6:건원중보(최초 철전)': '최초의 금속 화폐, 민간에서는 쌀·포를 주로 사용',
  '6:2성 6부': '중서문하성·상서성 + 이·병·호·형·예·공부',
  '6:향리 제도 정비': '지방 호족을 중앙 통제 아래 둠',
};

// 지금 연표에 있지만 이론에서 근거를 찾을 수 있는 키워드는 그대로 둔다(이론에 없으면 뺀다). [대수, 복위, 키워드, 근거 주제]
const KEEP = [
  [23, 0, { name: '쌍성총관부 설치', short: '쌍성총관부', th: 't29' }],
  [24, 0, { name: '동녕부 설치', th: 't29' }],
  [24, 0, { name: '탐라총관부', th: 't29' }],
  [29, 0, { name: '정치도감', th: 't19' }],
];

// ---- 고려 사건(오른쪽 사건 줄) ----
const EVENTS = [
  { y: 945, name: '왕규의 난', t: 'reform', th: 't25' },
  { y: 993, name: '거란 1차 침입·서희 담판(강동 6주)', short: '거란 1차·서희', t: 'war', th: 't22' },
  { y: 1009, name: '강조의 정변(목종 폐위)', short: '강조의 정변', t: 'reform', th: 't25' },
  { y: 1010, e: 1011, name: '거란 2차 침입(현종 나주 피란)', short: '거란 2차', t: 'war', th: 't22' },
  { y: 1018, e: 1019, name: '거란 3차 침입·귀주 대첩(강감찬)', short: '귀주 대첩', t: 'war', th: 't22' },
  { y: 1107, e: 1109, name: '윤관의 동북 9성 축조·반환', short: '동북 9성', t: 'war', th: 't22' },
  { y: 1126, name: '이자겸의 난', t: 'reform', th: 't25' },
  { y: 1126, name: '금에 사대(이자겸 수용)', short: '금에 사대', t: 'treaty', th: 't22' },
  { y: 1135, e: 1136, name: '묘청의 서경 천도 운동', short: '묘청의 난', t: 'reform', th: 't25' },
  { y: 1170, name: '무신 정변(보현원)', short: '무신 정변', t: 'reform', th: 't27' },
  { y: 1173, name: '김보당의 난(의종 복위 시도)', short: '김보당의 난', t: 'reform', th: 't27' },
  { y: 1174, name: '조위총의 난(서경)', short: '조위총의 난', t: 'reform', th: 't27' },
  { y: 1176, e: 1177, name: '망이·망소이의 난(공주 명학소)', short: '망이·망소이', t: 'move', th: 't27' },
  { y: 1193, name: '김사미·효심의 난(운문·초전)', short: '김사미·효심', t: 'move', th: 't27' },
  { y: 1196, name: '최충헌 집권(이의민 제거)', short: '최충헌 집권', t: 'reform', th: 't27' },
  { y: 1198, name: '만적의 난(개경)', short: '만적의 난', t: 'move', th: 't27' },
  { y: 1231, name: '몽골 1차 침입(귀주성 박서)', short: '몽골 1차 침입', t: 'war', th: 't28' },
  { y: 1232, name: '강화도 천도·처인성 전투(김윤후)', short: '강화 천도·처인성', t: 'war', th: 't28' },
  { y: 1253, name: '충주성 전투(김윤후)', short: '충주성 전투', t: 'war', th: 't28' },
  { y: 1258, name: '최씨 정권 몰락(최의 제거)', short: '최씨 정권 몰락', t: 'reform', th: 't27' },
  { y: 1270, name: '개경 환도', t: 'treaty', th: 't28' },
  { y: 1270, e: 1273, name: '삼별초 항쟁(강화→진도→제주)', short: '삼별초', t: 'war', th: 't27' },
  { y: 1274, name: '일본 원정', t: 'war', th: 't29' },
  { y: 1281, name: '일본 원정', t: 'war', th: 't29' },
  { y: 1359, name: '홍건적 1차 침입(서경 함락)', short: '홍건적 1차', t: 'war', th: 't30' },
  { y: 1361, name: '홍건적 2차 침입(개경 함락)', short: '홍건적 2차', t: 'war', th: 't30' },
  { y: 1374, name: '공민왕 시해', t: 'reform', th: 't29' },
  { y: 1376, name: '홍산 대첩(최영)', short: '홍산 대첩', t: 'war', th: 't30' },
  { y: 1380, name: '진포 대첩(최무선)', short: '진포 대첩', t: 'war', th: 't30' },
  { y: 1380, name: '황산 대첩(이성계)', short: '황산 대첩', t: 'war', th: 't30' },
  { y: 1383, name: '관음포 전투(정지)', short: '관음포 전투', t: 'war', th: 't30' },
  { y: 1388, name: '위화도 회군', t: 'reform', th: 't30' },
  { y: 1389, name: '쓰시마 토벌(박위)', short: '쓰시마 토벌', t: 'war', th: 't30' },
];

// ---- 검사 ----
const problems = [];
const goryeo = KINGS.kingdoms.find(k => k.id === 'goryeo');
const words = s => s.replace(/\(.*?\)/g, ' ').split(/[\s·→~]+/).map(w => w.replace(/[○]/g, '')).filter(w => w.length >= 2);
const inTheme = (item) => {
  const txt = themeText(item.th);
  const miss = [...words(item.name), ...(item.short ? words(item.short) : [])].filter(w => !txt.includes(norm(w)));
  return miss;
};
const isHot = item => [item.short, item.name.replace(/\(.*?\)/g, '')].filter(Boolean).some(s => contrasts.includes(norm(s)));
const reignOf = (n, r) => goryeo.kings.find(k => k.n === n && !!k.r === !!r);
const names = new Set();
for (const [n, r, list] of [...ACTS, ...KEEP.map(([n, r, it]) => [n, r, [it]])]) {
  const k = reignOf(n, r);
  if (!k) { problems.push(`왕 없음: ${n}대${r ? '(복위)' : ''}`); continue; }
  for (const it of list) {
    const d = DESC[`${n}:${it.name}`];
    if (d) {
      it.d = d;
      // 설명의 낱말도 근거 주제(같은 시대 주제 전체)에 있어야 한다. 조사 등 끝말은 앞 2자만 본다
      const eraTxt = norm(era.themes.flatMap(t => [...t.memos, ...t.theory]).map(p => p.text).join(' '));
      const dm = words(d.replace(/[,]/g, ' ')).map(w => w.replace(/(을|를|이|가|의|에|로|으로|하여|에게|에서|하고)$/, '')).filter(w => w.length >= 2 && !eraTxt.includes(norm(w)) && !eraTxt.includes(norm(w.slice(0, 2))));
      if (dm.length) problems.push(`${k.name}: "${it.name}" 설명 낱말이 이론에 없음 → ${dm.join(', ')}`);
    }
    if (!theme(it.th)) problems.push(`${k.name}: 없는 주제 ${it.th}`);
    if (it.y !== undefined && (it.y < k.s || it.y > k.e)) problems.push(`${k.name}(${k.s}~${k.e}): ${it.y} ${it.name} — 재위 밖`);
    if (it.e !== undefined && (it.e < it.y)) problems.push(`${k.name}: ${it.name} 끝 해가 앞섬`);
    const miss = inTheme(it);
    if (miss.length) problems.push(`${k.name}: "${it.name}" 근거 주제 ${it.th}에 없는 낱말 → ${miss.join(', ')}`);
    const key = `${k.name}:${it.short || it.name}`;
    if (names.has(key)) problems.push(`중복: ${key}`);
    names.add(key);
  }
}
for (const ev of EVENTS) {
  if (!['war', 'treaty', 'reform', 'move', 'econ'].includes(ev.t)) problems.push(`사건 종류 오류: ${ev.name}`);
  const miss = inTheme(ev);
  if (miss.length) problems.push(`사건 "${ev.name}" 근거 주제 ${ev.th}에 없는 낱말 → ${miss.join(', ')}`);
  if (ev.y < 943 || ev.y >= 1392) problems.push(`사건 ${ev.name}: 고려 사건 줄 범위(943~1391) 밖`);
}
// 지금 키워드 중 빠지는 것(이론 근거가 없어서)
const fullTheory = norm(THEORY.flatMap(e => e.themes.flatMap(t => [...t.memos, ...t.theory, ...(t.contrasts || [])].map(p => p.text))).join(' '));
const dropped = [];
goryeo.kings.forEach(k => (k.keys || []).forEach(key => {
  const kept = [...ACTS, ...KEEP.map(([n, r, it]) => [n, r, [it]])].some(([n, r, list]) => n === k.n && !!r === !!k.r && list.some(it => it.name === key || it.short === key));
  if (!kept) dropped.push(`${k.name}: ${key}${words(key).every(w => fullTheory.includes(norm(w))) ? ' (다른 이름으로 옮김)' : ' (이론에 없음 → 뺌)'}`);
}));

const totalActs = ACTS.reduce((a, [, , l]) => a + l.length, 0) + KEEP.length;
const hotN = [...ACTS.flatMap(([, , l]) => l), ...EVENTS].filter(isHot).length;
console.log(`왕 업적 ${totalActs}개(지금 키워드 ${goryeo.kings.reduce((a, k) => a + (k.keys || []).length, 0)}개) · 사건 ${EVENTS.length}개(지금 ${KINGS.events.filter(e => e.y >= 943 && e.y < 1392).length}개) · 굵게(구별 문장) ${hotN}개`);
console.log(`검사 문제 ${problems.length}${problems.length ? '\n  ' + problems.join('\n  ') : ''}`);
console.log(`지금 키워드에서 바뀌는 것 ${dropped.length}\n  ${dropped.join('\n  ')}`);

if (!process.argv.includes('--write')) process.exit(problems.length ? 1 : 0);
if (problems.length) { console.log('문제가 있어 쓰지 않음'); process.exit(1); }

// ---- 쓰기: 고려 kings 줄과 고려 사건 줄을 바꾼다 ----
const q = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const actStr = it => `{ ${it.y !== undefined ? `y: ${it.y}, ` : ''}${it.e !== undefined ? `e: ${it.e}, ` : ''}name: ${q(it.name)}${it.short ? `, short: ${q(it.short)}` : ''}${it.d ? `, d: ${q(it.d)}` : ''}${isHot(it) ? ', hot: 1' : ''}, th: ${q(it.th)} }`;
const evStr = ev => `    { y: ${ev.y}, ${ev.e !== undefined ? `e: ${ev.e}, ` : ''}name: ${q(ev.name)}${ev.short ? `, short: ${q(ev.short)}` : ''}, t: ${q(ev.t)}${isHot(ev) ? ', hot: 1' : ''}, th: ${q(ev.th)} },`;
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');
const gStart = lines.findIndex(l => l.includes("id: 'goryeo'"));
const kStart = lines.findIndex((l, i) => i > gStart && /^\s*kings: \[\s*$/.test(l));
const kEnd = lines.findIndex((l, i) => i > kStart && /^\s*\],\s*$/.test(l));
// 고려 kings 블록을 자료(왕 목록)에서 통째로 다시 쓴다(여러 번 돌려도 같은 결과). keys·acts 말고 다른 항목은 그대로 둔다.
const ind = '        ';
const val = v => (typeof v === 'string' ? q(v) : String(v));
const out = [`${ind}// acts: 왕 띠 안(좁은 화면)·띠 옆(넓은 화면)에 적는 업적. 이론 정리 고려 주제에 있는 것만(th = 근거 주제, hot = 이론 "구별" 문장에 나온 것). tools/fill_kings_goryeo.mjs`];
for (const k of goryeo.kings) {
  const head = Object.entries(k).filter(([key]) => key !== 'keys' && key !== 'acts').map(([key, v]) => `${key}: ${val(v)}`).join(', ');
  const list = [...(ACTS.find(([an, ar]) => an === k.n && !!ar === !!k.r)?.[2] || []), ...KEEP.filter(([kn, kr]) => kn === k.n && !!kr === !!k.r).map(([, , it]) => it)];
  if (!list.length) { out.push(`${ind}{ ${head} },`); continue; }
  out.push(`${ind}{ ${head}, acts: [`);
  list.forEach(it => out.push(`${ind}  ${actStr(it)},`));
  out.push(`${ind}] },`);
}
// 사건: "// 고려 (943~1392)" 다음 줄부터 "// 조선" 앞까지
const eStart = lines.findIndex(l => /\/\/ 고려 \(943~1392\)/.test(l));
const eEnd = lines.findIndex((l, i) => i > eStart && /\/\/ 조선 \(/.test(l));
const backupDir = path.resolve(import.meta.dirname, '../../tmp/backup-kings');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
fs.writeFileSync(path.join(backupDir, `kings-data.${stamp}.js`), src);
const next = [
  ...lines.slice(0, kStart + 1), ...out, ...lines.slice(kEnd, eStart + 1),
  ...EVENTS.map(evStr), ...lines.slice(eEnd),
].join('\n').replace(/지금은 고려 \d+개/, `지금은 고려 ${EVENTS.length}개`);
fs.writeFileSync(file, next);
console.log(`썼음: ${file} (백업 tmp/backup-kings/kings-data.${stamp}.js)`);
