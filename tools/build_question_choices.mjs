// 시험지 보기 문장(content/questions-text/all.jsonl)을 이론 정리 페이지에서 쓰는 dist/question-choices.js로 만든다.
// 보기가 그림뿐인 문제는 빈 문자열로 두고, 화면에서는 '그림 보기'로 표시한다.
// 사용: node tools/build_question_choices.mjs
import fs from 'node:fs';

const rows = fs.readFileSync(new URL('../content/questions-text/all.jsonl', import.meta.url), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const choices = {};
for (const row of rows) {
  choices[`${row.exam}-${row.number}`] = row.choices.map(text => (row.choices_are_images || String(text).startsWith('[그림]') ? '' : String(text).trim()));
}
const body = Object.entries(choices).map(([id, list]) => `${JSON.stringify(id)}:${JSON.stringify(list)}`).join(',\n');
fs.writeFileSync(new URL('../dist/question-choices.js', import.meta.url), `// tools/build_question_choices.mjs가 만든 파일. 직접 고치지 말 것.\nwindow.QUESTION_CHOICES = {\n${body}\n};\n`);
console.log(`문제 ${rows.length}개 · 그림 보기 문제 ${Object.values(choices).filter(list => list.some(text => !text)).length}개`);
