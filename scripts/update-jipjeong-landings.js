import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildJipjeongTemplate,
  generateJipjeongMeta,
  removeJongnoLawyerPhrase,
} from "../functions/api/create-jipjeong-landing.js";
import {
  RECOVERY_BANKS,
  recoveryRepresentativeTitle,
} from "../functions/_recoverySeo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesPath = path.join(root, "data", "cases.json");
const cases = await fs.readJson(casesPath);
const updatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

let updated = 0;
let detailed = 0;

for (const item of cases) {
  if (item?.createdBy !== "jipjeong-manual") continue;
  const bank = RECOVERY_BANKS.find((entry) => item.slug === entry.slug);
  if (!bank) continue;

  const action = "계좌지급정지해제";
  const title = recoveryRepresentativeTitle(item);
  const meta = generateJipjeongMeta(bank.name, action);

  item.caseName = title;
  item.summary = meta.summary;
  item.tags = ["계좌지급정지해제", "지급정지 이의제기", "소명자료", "채무부존재확인소송", "소송계속증명원"];
  item.updatedAt = updatedAt;

  item.landings = item.landings || {};
  item.landings.c = item.landings.c || {};
  {
    const landing = item.landings.c;
    landing.title = title;
    landing.h1 = title;
    landing.ogTitle = title;
    landing.description = meta.summary;
    landing.ogDescription = meta.summary;
    landing.imageAlt = meta.imageAlt;
    landing.imageCaption = meta.imageCaption;
    landing.imageDescription = meta.imageDescription;
    landing.body = buildJipjeongTemplate(bank.name, action);
    landing.victimCases = [];
    landing.suspiciousCompanies = [];
    landing.faq = [];
    detailed += 1;
  }

  updated += 1;
}

await fs.writeJson(casesPath, cases, { spaces: 2 });
console.log(`Updated ${updated} jipjeong landing records (${detailed} with detailed landing data).`);

function extractBank(title) {
  const match = normalizeSpace(title).match(/^(.+?)\s+(?:계좌\s+)?지급정지/);
  return match ? match[1].trim() : normalizeSpace(title).split(/[\s,·]/)[0];
}

function extractAction(title, bank) {
  const normalized = normalizeSpace(title);
  let rest = normalized.startsWith(bank) ? normalized.slice(bank.length).trim() : normalized;
  rest = rest
    .replace(/\s*[,·\-–—]\s*[가-힣A-Za-z0-9]{1,10}\s*변호사[\s\S]*$/, "")
    .replace(/\s+[가-힣A-Za-z0-9]{1,10}\s*변호사[\s\S]*$/, "")
    .trim();
  return rest || "지급정지";
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}
