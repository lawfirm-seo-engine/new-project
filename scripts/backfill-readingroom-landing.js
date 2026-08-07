// 1회성 백필: 기존 cases.json 중 리딩방/사칭 투자 성격 사건에 hasReadingroomLanding 태그 부여
// 실행: node scripts/backfill-readingroom-landing.js [--dry]
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url)).replace(/scripts$/, "");
const dataPath = path.join(root, "data", "cases.json");

const TERMS = [
  "리딩방", "리딩", "종목 추천", "종목추천", "VIP 투자방", "VIP투자방",
  "공모주 특별배정", "기관 투자 프로젝트", "기관투자 프로젝트",
  "AI 자동매매", "자동매매", "HTS", "MTS", "교수",
  "증권사", "자산운용사", "애널리스트", "대표",
];

function matchText(c) {
  return [c.caseName, ...(c.tags || []), c.memo].filter(Boolean).join(" ");
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const cases = await fs.readJson(dataPath);

  let matched = 0;
  let alreadyTagged = 0;
  const newlyTagged = [];

  for (const c of cases) {
    const text = matchText(c);
    const isMatch = TERMS.some((term) => text.includes(term));
    if (!isMatch) continue;
    matched += 1;
    if (c.hasReadingroomLanding === true) {
      alreadyTagged += 1;
      continue;
    }
    c.hasReadingroomLanding = true;
    newlyTagged.push(c.caseName);
  }

  console.log(`matched: ${matched} / ${cases.length}`);
  console.log(`already tagged: ${alreadyTagged}`);
  console.log(`newly tagged: ${newlyTagged.length}`);

  if (dryRun) {
    console.log("[dry run] no file written");
    newlyTagged.slice(0, 20).forEach((n) => console.log("-", n));
    return;
  }

  await fs.writeJson(dataPath, cases, { spaces: 2 });
  console.log("data/cases.json updated");
}

main();
