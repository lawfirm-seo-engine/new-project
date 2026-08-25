import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "admin", "bulk-create.html");
const distPath = path.join(root, "dist-a", "admin", "bulk-create.html");
const apiPath = path.join(root, "functions", "api", "batch-check-cases.js");
const searchPath = path.join(root, "functions", "_searchNormalize.js");
const categoryScriptPath = path.join(root, "admin", "category-bulk.js");
const categoryStylePath = path.join(root, "admin", "category-bulk.css");
const generatorPath = path.join(root, "scripts", "generate.js");
const centerStylePath = path.join(root, "center-fintech-assets", "style.css");
const publicStylePath = path.join(root, "public", "style.css");
const updateCasePath = path.join(root, "functions", "api", "update-case.js");
const categoryPages = ["jipjeong.html", "voicephishing.html", "chaemubu.html", "tujasagi.html", "readingroom.html"];
const categoryApis = [
  "create-jipjeong-landing.js",
  "create-voicephishing-landing.js",
  "create-chaemubu-landing.js",
  "create-tujasagi-landing.js",
  "create-readingroom-landing.js",
];
const expectedHeroHashes = {
  "main-slide-01-q90.webp": "806E8F9CD2BFAFA24928078AD3C73023044D16E8A248CB10B3AD829D3A7915AC",
  "main-slide-02-q90.webp": "EBE229D2091ADF71DFA19C489F12E24760AC9DF5716796600D65D4EE4D7D338E",
  "main-slide-03-q90.webp": "7005AD22ACB0C8E147DF25CD13FCC826F4AD76D0DFA85321504D3FC5454E46D2",
};

const source = fs.readFileSync(sourcePath, "utf8");
const dist = fs.readFileSync(distPath, "utf8");
const api = fs.readFileSync(apiPath, "utf8");
const search = fs.readFileSync(searchPath, "utf8");
const categoryScript = fs.readFileSync(categoryScriptPath, "utf8");
const categoryStyle = fs.readFileSync(categoryStylePath, "utf8");
const generator = fs.readFileSync(generatorPath, "utf8");
const centerStyle = fs.readFileSync(centerStylePath, "utf8");
const publicStyle = fs.readFileSync(publicStylePath, "utf8");
const updateCase = fs.readFileSync(updateCasePath, "utf8");
const categorySources = categoryPages.map((name) => [name, fs.readFileSync(path.join(root, "admin", name), "utf8")]);
const categoryApiSources = categoryApis.map((name) => [name, fs.readFileSync(path.join(root, "functions", "api", name), "utf8")]);

const checks = [
  [source.includes("for (let i = 0; i < 30; i++) addRow();"), "기본 30행 초기화가 없습니다."],
  [source.includes("const chunkSize = 5"), "5건 분할 검수가 없습니다."],
  [source.includes("res.status === 503"), "503 자동 재시도가 없습니다."],
  [source.includes("selEl.disabled = false"), "100% 중복 수동 선택 기능이 없습니다."],
  [source.includes("/admin/edit.html?slug="), "유사 랜딩 편집 링크가 없습니다."],
  [source.includes("copyBtn.textContent = 'URL 복사'"), "생성 URL 복사 기능이 없습니다."],
  [source.includes("data-copy-url"), "중복 검수 URL 복사 기능이 없습니다."],
  [api.includes("existingBundles"), "배치 검수 별칭 캐시가 없습니다."],
  [api.includes("criminalLandingUrl"), "중복 검수 기존 URL 반환 기능이 없습니다."],
  [search.includes("compareIdentityBundles"), "중복 비교 캐시 함수가 없습니다."],
  [categoryScript.includes("const INITIAL_ROWS = 30"), "전용 랜딩 기본 30행 기능이 없습니다."],
  [categoryScript.includes("batchMode: true"), "전용 랜딩 안전한 대량 저장 모드가 없습니다."],
  [categoryScript.includes('/api/sync-kv-to-github'), "전용 랜딩 생성 후 저장소 동기화가 없습니다."],
  [categorySources.every(([, html]) => html.includes("category-bulk.js") && html.includes("새로고침 (새 30개)")), "전용 랜딩 5개 메뉴 중 30행 대량생성 화면이 누락되었습니다."],
  [categoryApiSources.every(([, code]) => code.includes("body.batchMode === true") && code.includes("if (!batchMode)")), "전용 랜딩 API의 대량 저장 모드가 누락되었습니다."],
  [generator.includes('href: "tel:0263480406"'), "메인 2·3번 이미지 전화 연결이 없습니다."],
  [generator.includes('20260821-main-slide-03'), "교체된 3번 메인 이미지 캐시 버전이 없습니다."],
  [generator.includes("CRIMINAL_PUBLIC_STYLE_VERSION"), "진행사건 검색 스타일 캐시 갱신이 없습니다."],
  [publicStyle.includes(".case-row[hidden]") && publicStyle.includes("display:none!important"), "진행사건 검색 결과 외 행 숨김 스타일이 없습니다."],
  [centerStyle.includes("flex-flow:row nowrap"), "모바일 상단 메뉴 한 줄 고정 스타일이 없습니다."],
  [updateCase.includes("githubLoadWarning") || updateCase.includes("usingKvSource"), "GitHub 장애 시 관리자 KV 편집 보호가 없습니다."],
  [centerStyle.includes("font-size:clamp(20px,1.7vw,26px)"), "상단 메뉴 확대 스타일이 없습니다."],
  [centerStyle.includes("margin-left:clamp(38px,5vw,96px)"), "로고와 상단 메뉴 간격 확대 스타일이 없습니다."],
  [source === dist, "admin 원본과 dist-a 배포 파일이 다릅니다. npm run generate를 먼저 실행하세요."],
  [categorySources.every(([name, html]) => html === fs.readFileSync(path.join(root, "dist-a", "admin", name), "utf8")), "전용 랜딩 관리자 원본과 dist-a 배포 파일이 다릅니다. npm run generate를 먼저 실행하세요."],
  [categoryScript === fs.readFileSync(path.join(root, "dist-a", "admin", "category-bulk.js"), "utf8"), "전용 랜딩 공용 스크립트와 dist-a 배포 파일이 다릅니다."],
  [categoryStyle === fs.readFileSync(path.join(root, "dist-a", "admin", "category-bulk.css"), "utf8"), "전용 랜딩 공용 스타일과 dist-a 배포 파일이 다릅니다."],
  ...Object.entries(expectedHeroHashes).map(([name, expected]) => {
    const sourceAsset = fs.readFileSync(path.join(root, "center-fintech-assets", name));
    const distAsset = fs.readFileSync(path.join(root, "dist-a", "assets", "center-fintech", name));
    const actual = crypto.createHash("sha256").update(sourceAsset).digest("hex").toUpperCase();
    return [actual === expected && sourceAsset.equals(distAsset), `${name}이 요청된 메인 이미지와 다르거나 dist-a에 반영되지 않았습니다.`];
  }),
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  throw new Error(`대량생성 배포 검증 실패:\n- ${failures.join("\n- ")}`);
}

console.log("[OK] bulk-create deployment guard passed");
