import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { caseOgImageUrl } from "../functions/_seo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "cases.json");
const SITE_URL = "https://xn--jj0b0cw1o75qwua31zyfp19e.kr";
const TARGET_GROUPS = ["la"];
const CREATED_BY = "voicephishing-manual";
const UPDATED_AT = "2026-07-09";
const VOICEPHISHING = "\uBCF4\uC774\uC2A4\uD53C\uC2F1";
const LAWYER = "\uBCC0\uD638\uC0AC";
const VOICEPHISHING_LAWYER = `${VOICEPHISHING}${LAWYER}`;
const FALLBACK_REGION = "\uC9C0\uC5ED";

const cases = await fs.readJson(dataPath);
let updated = 0;

for (let index = 0; index < cases.length; index += 1) {
  const item = cases[index];
  if (!isVoicephishingLanding(item)) continue;

  const parsed = parseTitleParts(item.caseName || item.slug);
  const region = regionFromSlug(item.slug) || parsed.region || FALLBACK_REGION;
  const action = actionFromSlug(item.slug) || normalizeAction(parsed.action);
  const variant = pickVariant(item.slug || region, index);
  const keyword = `${region} 보이스피싱`;
  const lawyerKeyword = `${region} 보이스피싱변호사`;
  const title = createTitle(region, action, variant);
  const h1 = createH1(region, action, variant);
  const description = createDescription(region, action, variant);
  const body = createBody({ region, action, keyword, lawyerKeyword, title, h1, variant });
  const faq = createFaq({ region, action, keyword, lawyerKeyword, variant });

  const landing = {
    title,
    description,
    canonical: `${SITE_URL}/criminal/${encodeURIComponent(item.slug)}-legal-action/`,
    ogTitle: title,
    ogDescription: description,
    ogImage: caseOgImageUrl(item.slug, SITE_URL),
    h1,
    imageAlt: `${lawyerKeyword} ${action} 피해 회복 상담`,
    imageCaption: `${region} 보이스피싱 피해자의 ${action}와 민형사 대응 안내`,
    imageDescription: `${lawyerKeyword} 상담을 통해 ${action}, 계좌추적, 형사고소, 손해배상청구 가능성을 정리한 법률 정보 이미지입니다.`,
    body,
    victimCases: createVictimCases(region, action, variant),
    suspiciousCompanies: [],
    faq,
  };

  item.caseName = title;
  item.category = "보이스피싱 피해 법률상담";
  item.createdBy = CREATED_BY;
  item.targetGroups = TARGET_GROUPS;
  item.updatedAt = UPDATED_AT;
  item.summary = description;
  item.tags = ["보이스피싱", action, "지급정지", "형사고소", "피해금 회수"].filter(Boolean);
  item.landings = { la: landing };
  item.noindex = false;

  updated += 1;
}

await fs.writeJson(dataPath, cases, { spaces: 2 });
console.log(`[voicephishing-seo] updated ${updated} landings`);

function isVoicephishingLanding(item = {}) {
  return item.createdBy === CREATED_BY || (Array.isArray(item.targetGroups) && item.targetGroups.includes("la"));
}

function createTitle(region, action, variant) {
  const templates = [
    `${region} 보이스피싱변호사, ${action}와 피해금 회수`,
    `${region} 보이스피싱 피해상담, ${action} 이후 법적 대응`,
    `${region} 보이스피싱변호사 상담 전 ${action} 체크`,
    `${region} 보이스피싱 계좌피해, ${action} 대응 절차`,
    `${region} 보이스피싱 피해회복, 형사고소와 ${action}`,
    `${region} 보이스피싱변호사, 송금 직후 ${action} 판단`,
    `${region} 보이스피싱 피해자 법률상담과 ${action}`,
    `${region} 보이스피싱 사건, 계좌추적과 ${action}`,
  ];
  return templates[variant % templates.length];
}

function createH1(region, action, variant) {
  const templates = [
    `${region} 보이스피싱 ${action} 대응, 무엇부터 확인할까`,
    `${region} 보이스피싱 피해금 회수를 위한 초기 법률 검토`,
    `${region} 보이스피싱 계좌 피해와 ${action} 준비자료`,
    `${region} 보이스피싱변호사 상담에서 보는 민형사 절차`,
    `${region} 보이스피싱 송금 피해, ${action}와 고소장 준비`,
    `${region} 보이스피싱 피해 직후 계좌추적과 회수 가능성`,
    `${region} 보이스피싱 법률상담, 지급정지 이후 대응 순서`,
    `${region} 보이스피싱 피해 회복을 위한 증거 정리`,
  ];
  return templates[variant % templates.length];
}

function createDescription(region, action, variant) {
  const templates = [
    `${region} 보이스피싱 피해자는 송금 직후 ${action}, 계좌추적, 형사고소, 피해금 회수 가능성을 함께 검토해야 합니다. 법무법인 선린이 준비자료와 대응 순서를 안내합니다.`,
    `${region} 지역 보이스피싱 상담은 수취 계좌, 송금 시간, 대화 기록을 기준으로 ${action} 가능성과 민형사 절차를 빠르게 정리하는 것이 중요합니다.`,
    `${region} 보이스피싱 피해 회복을 위해 ${action} 신청 시점, 계좌 이동 여부, 고소장 작성 자료, 손해배상청구 가능성을 법률적으로 점검합니다.`,
    `${region} 보이스피싱변호사 상담 전 입금증, 통화기록, 문자 링크, 원격제어 앱 내역을 보존하고 ${action}와 계좌추적 절차를 확인해야 합니다.`,
  ];
  return templates[variant % templates.length].slice(0, 180);
}

function createBody(ctx) {
  const { region, action, keyword, lawyerKeyword, h1, variant } = ctx;
  const h2 = headingSet(region, action, variant);
  return [
    h1,
    `## ${h2[0]}`,
    `${region}에서 보이스피싱 피해를 인지했다면 가장 먼저 볼 부분은 돈이 이동한 시간과 수취 계좌의 현재 상태입니다. ${action}는 피해금이 더 이동하기 전에 검토해야 할 초기 조치입니다.`,
    `법무법인 선린은 송금 내역, 금융기관 신고 여부, 상대방과의 대화 기록을 바탕으로 형사고소와 피해금 회수 절차를 함께 살펴봅니다.`,
    `## ${h2[1]}`,
    `${keyword} 상담에서는 입금 영수증, 계좌번호, 예금주, 통화 녹취, 문자 링크, 카카오톡 대화, 원격제어 앱 설치 내역을 시간순으로 정리하는 것이 중요합니다.`,
    `자료가 일부 부족하더라도 남아 있는 화면과 금융거래 기록을 기준으로 계좌추적 가능성과 후속 법적 절차를 검토할 수 있습니다.`,
    `✔ 송금 시간과 금액`,
    `✔ 수취 계좌번호와 예금주`,
    `✔ 문자·메신저 대화와 통화기록`,
    `✔ 원격제어 앱 또는 링크 접속 내역`,
    `✔ 금융기관 신고 접수 내용`,
    `## ${h2[2]}`,
    `${action}는 금융기관 신고만으로 끝나는 절차가 아닐 수 있습니다. 피해금이 이미 다른 계좌로 이동했다면 수사기관 접수, 계좌추적, 압수수색 자료 확보, 민사 보전처분을 함께 검토해야 합니다.`,
    `${lawyerKeyword} 상담에서는 피해자가 직접 설명하기 어려운 기망 경위와 송금 구조를 법률 문서로 정리하는 데 초점을 둡니다.`,
    `## ${h2[3]}`,
    `보이스피싱 사건은 형사절차와 민사절차가 분리되어 진행될 수 있습니다. 형사고소는 가해자 특정과 수사 개시를 위한 절차이고, 민사상 조치는 피해금 회수 가능성을 확보하기 위한 별도 검토입니다.`,
    `상대 계좌가 특정되었거나 일부 금액이 남아 있는 정황이 있다면 가압류, 손해배상청구, 부당이득반환 가능성을 함께 확인해야 합니다.`,
    `## ${h2[4]}`,
    `상대방이 보증금, 인증비, 세금, 수수료를 이유로 추가 송금을 요구한다면 2차 피해 위험이 큽니다. 환불이나 계좌 해제를 약속하더라도 먼저 송금을 멈추고 현재 자료를 보존해야 합니다.`,
    `${region} 보이스피싱 피해 상담은 추가 입금을 막고 남은 증거를 정리하는 것에서 시작됩니다.`,
    `## ${h2[5]}`,
    `상담 전에는 피해 발생 일시, 송금 계좌, 대화 상대, 금융기관 신고 여부, 경찰 접수 여부를 간단히 정리해 두면 검토가 빨라집니다.`,
    `법무법인 선린은 피해자의 설명과 자료를 토대로 ${action}, 형사고소, 계좌추적, 민사 회수 절차 중 어떤 순서가 필요한지 안내합니다.`,
    `## ${faqHeading(region, action, variant)}`,
    `### Q1. ${region} 보이스피싱 피해 직후 바로 ${action}를 해야 하나요?`,
    `피해를 인지했다면 가능한 한 빠르게 금융기관에 신고하고 ${action} 가능성을 확인하는 것이 좋습니다. 다만 사건별 계좌 상태와 송금 경위에 따라 후속 절차가 달라질 수 있습니다.`,
    `### Q2. 이미 돈이 빠져나간 경우에도 회수 가능성이 있나요?`,
    `자금이 이동했더라도 계좌추적, 형사절차, 민사 보전처분, 손해배상청구를 검토할 수 있습니다. 회수 가능성은 증거와 상대방 특정 여부에 따라 달라집니다.`,
    `### Q3. 상담 전에 꼭 필요한 자료는 무엇인가요?`,
    `입금증, 계좌 거래내역, 상대방 계좌번호, 문자와 메신저 대화, 통화기록, 앱 설치 내역, 금융기관 신고 내역을 준비하면 초기 검토에 도움이 됩니다.`,
    `### Q4. 법무법인 선린 상담은 어떤 부분을 확인하나요?`,
    `피해 경위, 송금 구조, 계좌 정보, 증거 보존 상태를 바탕으로 형사고소와 민사 회수 절차의 우선순위를 확인합니다.`,
  ];
}

function headingSet(region, action, variant) {
  const sets = [
    [
      `송금 직후 ${action} 판단 기준`,
      `${region} 피해자가 먼저 모아야 할 증거`,
      `계좌추적과 형사고소를 함께 보는 이유`,
      `민사 회수 절차가 필요한 상황`,
      `추가 송금 요구를 멈춰야 하는 이유`,
      `법무법인 선린 상담 전 준비사항`,
    ],
    [
      `${action} 신청 전 확인할 계좌 상태`,
      `문자 링크와 통화기록 보존 방법`,
      `수사기관 접수와 고소장 작성 포인트`,
      `피해금 회수 가능성을 가르는 자료`,
      `환불팀 사칭 연락에 대응하는 방법`,
      `${region} 사건 검토 시 자주 빠지는 내용`,
    ],
    [
      `보이스피싱 계좌피해 초기 대응 순서`,
      `${action} 검토에 필요한 금융거래 기록`,
      `형사절차 이후에도 민사 검토가 필요한 이유`,
      `가압류와 손해배상청구를 살펴볼 때`,
      `2차 피해를 막기 위한 연락 차단 기준`,
      `상담 접수 전 정리하면 좋은 질문`,
    ],
    [
      `${region} 보이스피싱 신고 후 다음 단계`,
      `입금증과 대화 캡처를 보존하는 방식`,
      `${action} 이후 계좌추적을 이어가는 이유`,
      `가해자 특정 전에도 검토할 수 있는 절차`,
      `추가 비용 요구가 위험 신호인 이유`,
      `민형사 대응 방향을 정하는 기준`,
    ],
  ];
  return sets[variant % sets.length].map((heading, index) =>
    contextualizeHeading(heading, region, action, variant, index)
  );
}

function contextualizeHeading(heading, region, action, variant, index) {
  const focus = headingFocus(variant, index);
  const hasRegion = heading.includes(region);
  const hasAction = heading.includes(action);

  if (hasRegion && hasAction) return `${heading} - ${focus}`;
  if (hasRegion) return `${heading}와 ${action} ${focus}`;
  if (hasAction) return `${region} ${heading} - ${focus}`;
  return `${region} ${action} ${focus}: ${heading}`;
}

function headingFocus(variant, index) {
  const labels = [
    "초기 검토",
    "증거 정리",
    "계좌 보전",
    "고소 준비",
    "민사 회수",
    "2차 피해 차단",
    "상담 자료",
    "절차 선택",
    "피해금 추적",
    "신고 시점",
    "입금 내역",
    "법률 판단",
    "보전처분",
    "가해자 특정",
    "연락 차단",
    "회수 전략",
  ];
  return labels[(variant + index) % labels.length];
}

function faqHeading(region, action, variant) {
  const labels = [
    "초기 대응",
    "지급정지",
    "증거 보존",
    "형사고소",
    "피해금 회수",
    "계좌추적",
    "민사절차",
    "상담 준비",
  ];
  return `${region} ${action} ${labels[variant % labels.length]} FAQ`;
}

function createVictimCases(region, action, variant) {
  const pools = [
    [
      `${region}에서 수사기관을 사칭한 전화 후 안전계좌 이체를 요구받은 사례`,
      `문자 링크 접속 뒤 원격제어 앱 설치를 유도받고 송금한 사례`,
      `${action} 가능성을 확인하기 전에 추가 인증비를 요구받은 사례`,
    ],
    [
      `저금리 대환대출 안내를 믿고 보증금 명목으로 입금한 사례`,
      `가족 또는 지인을 사칭한 메신저 연락으로 계좌이체가 발생한 사례`,
      `환불을 약속하며 수수료를 요구해 2차 피해가 우려된 사례`,
    ],
    [
      `금융기관 직원을 사칭한 안내에 따라 계좌 비밀번호와 인증번호를 전달한 사례`,
      `검찰 사건 조회를 빙자한 링크 접속 후 여러 차례 송금한 사례`,
      `송금 후 계좌가 빠르게 이동되어 계좌추적이 필요한 사례`,
    ],
  ];
  return pools[variant % pools.length];
}

function createFaq({ region, action, variant }) {
  return [
    {
      question: `${region} 보이스피싱 피해 직후 ${action}를 바로 검토해야 하나요?`,
      answer: `송금 직후에는 자금 이동을 늦추는 조치가 중요하므로 금융기관 신고와 함께 ${action} 가능성을 빠르게 확인하는 것이 좋습니다.`,
    },
    {
      question: "형사고소와 피해금 회수 절차는 별개인가요?",
      answer: "형사고소는 수사와 가해자 특정에 초점이 있고, 피해금 회수는 계좌추적과 민사 보전처분까지 함께 검토해야 할 수 있습니다.",
    },
    {
      question: "상담 전에 어떤 자료를 보내야 하나요?",
      answer: "입금증, 계좌번호, 대화 캡처, 통화기록, 문자 링크, 원격제어 앱 설치 내역, 금융기관 신고 내역을 준비하면 됩니다.",
    },
    {
      question: "추가 비용을 내면 환불해 준다는 연락을 받았습니다.",
      answer: "보증금, 인증비, 수수료 명목의 추가 송금 요구는 2차 피해로 이어질 수 있으므로 먼저 송금을 중단하고 자료를 보존해야 합니다.",
    },
    {
      question: "이미 돈이 빠져나갔어도 법률 검토가 필요한가요?",
      answer: "이미 인출된 경우에도 계좌추적, 형사절차, 손해배상청구, 부당이득반환 가능성을 사안별로 확인할 필요가 있습니다.",
    },
  ].slice(0, 4 + (variant % 2));
}

function parseTitleParts(title = "") {
  const normalized = normalizeSpace(title).replace(/\s*,\s*/g, ", ");
  const region = extractRegionFromVoicephishing(normalized);

  let rest = "";
  const marker = normalized.match(new RegExp(`${VOICEPHISHING}\\s*${LAWYER}|${VOICEPHISHING_LAWYER}`));
  if (marker) rest = normalized.slice((marker.index || 0) + marker[0].length);
  else rest = normalized;

  rest = rest
    .replace(/^[\s,·\-–—:]+/, "")
    .replace(/\s*(어떻게|어떻게 진행해야 할까|진행해야 할까|할까|방안은|방법은)\??\s*$/g, "")
    .trim();

  return { region, action: rest };
}

function extractRegionFromVoicephishing(value = "") {
  const decoded = decodeURIComponent(String(value || ""));
  const compact = decoded.replace(/[-_\s]+/g, "");
  const pattern = new RegExp(`([\\uAC00-\\uD7A3A-Za-z0-9]{1,30})${VOICEPHISHING_LAWYER}`, "g");
  const matches = [...compact.matchAll(pattern)];
  if (!matches.length) return "";

  const raw = matches[matches.length - 1][1] || "";
  const candidates = raw
    .split(/계좌|출금정지|지급정지|피해구제|신청|절차|어떻게|진행해야|할까|방법|방안/g)
    .map((part) => cleanRegion(part))
    .filter(Boolean);

  return candidates.at(-1) || cleanRegion(raw);
}

function normalizeAction(value = "") {
  const action = normalizeSpace(value);
  const detected = detectAction(action);
  if (detected) return detected;
  return action || "지급정지";
}

function actionFromSlug(slug = "") {
  const decoded = decodeURIComponent(String(slug || "")).replace(/[-_\s]+/g, " ");
  return detectAction(decoded);
}

function detectAction(action = "") {
  if (/피해금\s*회수/.test(action)) return "피해금 회수";
  if (/계좌\s*지급정지/.test(action)) return "계좌 지급정지";
  if (/계좌\s*출금정지/.test(action)) return "계좌 출금정지";
  if (/출금정지\s*신청/.test(action)) return "출금정지 신청";
  if (/출금정지/.test(action)) return "출금정지";
  if (/지급정지/.test(action)) return "지급정지";
  if (/피해구제/.test(action)) return "피해구제";
  return "";
}

function regionFromSlug(slug = "") {
  const decoded = decodeURIComponent(String(slug || ""));
  const tokens = decoded.split(/[-_\s]+/g).filter(Boolean);

  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const compact = tokens[i].replace(/\s+/g, "");
    if (!compact.endsWith(VOICEPHISHING_LAWYER)) continue;
    const region = compact.slice(0, -VOICEPHISHING_LAWYER.length);
    const cleaned = cleanRegion(region);
    if (cleaned) return cleaned;
  }

  return extractRegionFromVoicephishing(decoded);
}

function cleanRegion(value = "") {
  const cleaned = normalizeSpace(value)
    .replace(/^(?:서울|경기|인천|부산|대구|대전|광주|울산|세종)\s*/g, "")
    .replace(/(?:보이스피싱|변호사|피해|상담|계좌|출금정지|지급정지|어떻게|진행해야|할까|신청|절차|방법|방안)/g, "")
    .replace(/[^\uAC00-\uD7A3A-Za-z0-9]/g, "");

  return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
}

function pickVariant(seed = "", index = 0) {
  let hash = 2166136261 >>> 0;
  for (const char of `${seed}-${index}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return hash % 32;
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}
