import fs from "fs-extra";
import path from "path";

const root = process.cwd();
const criminalDir = path.join(root, "dist-a");
const centerDir = path.join(root, "dist-e");
const centerAssets = path.join(centerDir, "assets", "center-fintech");
const criminalAssets = path.join(criminalDir, "assets", "center-fintech");
const centerIndex = path.join(centerDir, "index.html");
const criminalIndex = path.join(criminalDir, "index.html");
const criminalDashboard = path.join(criminalDir, "admin", "dashboard.html");
const criminalHeroVersion = "20260825-person-hero-v1";
const criminalHeroImages = [
  "/assets/center-fintech/main-slide-01-q90.webp",
  "/assets/center-fintech/main-slide-02-q90.webp",
  "/assets/center-fintech/main-slide-03-q90.webp",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withHeroVersion(src) {
  return `${src}?v=${criminalHeroVersion}`;
}

function versionCriminalHeroImages(source) {
  return criminalHeroImages.reduce((html, src) => {
    const pattern = new RegExp(`${escapeRegExp(src)}(?:\\?v=[^"'\\s)<>]+)?`, "g");
    return html.replace(pattern, withHeroVersion(src));
  }, source);
}

if (!fs.existsSync(centerIndex)) {
  throw new Error("dist-e/index.html이 없습니다. scripts/generate.js 실행 결과를 확인하세요.");
}

if (fs.existsSync(centerAssets)) {
  fs.ensureDirSync(criminalAssets);
  fs.copySync(centerAssets, criminalAssets, { overwrite: true });

  const criminalCenterStyle = path.join(criminalAssets, "style.css");
  if (fs.existsSync(criminalCenterStyle)) {
    const css = versionCriminalHeroImages(fs.readFileSync(criminalCenterStyle, "utf8"));
    fs.writeFileSync(criminalCenterStyle, css);
  }
}

let html = fs.readFileSync(centerIndex, "utf8");
html = html
  .replaceAll("https://gnlaw-center.co.kr", "https://gnlaw-criminal.co.kr")
  .replaceAll('content="11d695d7d711ce5e50abbe85ae49a60242a37e70"', 'content="8ac581a40e5eda3767c63ce7d27c155ccc8ea98f"')
  .replaceAll("domain-e center-site center-fintech", "domain-a center-site center-fintech")
  .replaceAll('href="/board/">진행사건 보기</a>', 'href="/board/">성공사례 보기</a>')
  .replaceAll('/case/', '/prosecute/')
  .replaceAll('-issue/', '-litigation/')
  .replaceAll("법무법인 선린 핀테크센터", "법무법인 선린 - 금융사기피해연구소");

// 형사 사이트의 기존 좌측 상단 로고 경로는 그대로 /assets/logo.png 를 사용한다.
html = html.replace(
  /<a class="brand" href="\/" aria-label="법무법인 선린 홈">[\s\S]*?<\/a>/,
  '<a class="brand" href="/" aria-label="법무법인 선린 홈">\n      <img src="/assets/logo.png" alt="법무법인 선린">\n    </a>'
);

// 메인 슬라이드는 사용자가 지정한 3개 파일을 그대로 사용한다.
html = versionCriminalHeroImages(html).replace(
  /\/assets\/center-fintech\/style\.css\?v=[^"'\s<>]+/g,
  `/assets/center-fintech/style.css?v=${criminalHeroVersion}`
);

fs.writeFileSync(criminalIndex, html);

if (fs.existsSync(criminalDashboard)) {
  let dashboard = fs.readFileSync(criminalDashboard, "utf8");
  if (!dashboard.includes('/admin/criminal-board.html')) {
    dashboard = dashboard.replace(
      '<a class="btn" href="/admin/center-board.html">통합 허브 게시글 관리</a>',
      '<a class="btn" href="/admin/criminal-board.html">게시판 관리</a>\n    <a class="btn" href="/admin/center-board.html">통합 허브 게시글 관리</a>'
    );
    fs.writeFileSync(criminalDashboard, dashboard);
  }
}

console.log("gnlaw-criminal.co.kr 메인을 핀테크센터형 허브로 적용했습니다.");
console.log("메인 슬라이드: main-slide-01-q90.webp, main-slide-02-q90.webp, main-slide-03-q90.webp");
console.log("성공사례 메뉴: /board/");
