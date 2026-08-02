// 사용법: node extract_style.js poistylefunc.js > style_data.json
//
// getStyle 응답(JS 소스)은 키가 따옴표 없는 JS 객체 리터럴이라 순수 JSON이 아님.
// 정규식으로 직접 파싱하면 문자열 내부의 중첩된 따옴표/이스케이프 때문에
// 깨지기 쉬우므로, JS 엔진(node)이 실제로 파일을 실행해서 StyleJson()을
// 호출한 뒤 그 결과를 JSON.stringify로 뽑아낸다.
//
// 전제: 이 파일은 함수 선언(PoiStyleFunc, FeatureVO, StyleJson)만 있고
// 최상위에서 실행되는 코드가 없어야 안전하다 (실행해도 부작용 없음).

const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("사용법: node extract_style.js <원본JS파일경로>");
  process.exit(1);
}

const code = fs.readFileSync(path.resolve(inputPath), "utf-8");

eval(code);

console.log(JSON.stringify(StyleJson()));
