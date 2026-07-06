import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const LE_HOST = "xn--ok0b84g7tosqai7vyka788co0b.kr";
const LE_SITE_URL = "https://투자사기대응센터.kr";
const LE_GROUP = GROUPS.find((g) => g.host === LE_HOST);
const TARGET_GROUPS = ["le"];
const CREATED_BY = "chaemubu-manual";

const TPL_TITLE = "TITLE";
const TPL_SUBJECT = "SUBJECT";
const TPL_REGION = "REGION";
const TPL_TYPE = "TYPE";

const TEMPLATE_BODY = [
  TPL_TITLE,
  `## ${TPL_TYPE}란`,
  `${TPL_TYPE}는 상대방이 존재하지 않거나 소멸한 채무를 이행할 것을 요구하는 경우, 법원에 해당 채무가 없음을 확인해달라고 청구하는 소송입니다. 불법 대부계약, 투자사기 관련 허위 채무, 과도한 위약금 청구, 보이스피싱·스팸 계정을 통한 채무 강요 등 다양한 상황에서 활용됩니다.`,
  `${TPL_REGION} 지역에서 ${TPL_SUBJECT} 상담을 찾는 경우, 상대방의 채무 이행 요구가 실제로 유효한 법적 근거를 갖추고 있는지, 소멸시효나 계약 무효 사유가 있는지 먼저 검토하는 것이 중요합니다.`,
  `## ${TPL_TYPE}가 필요한 상황`,
  `다음과 같은 상황에서 ${TPL_TYPE}를 적극적으로 검토할 수 있습니다.`,
  `✔ 계약서 내용이 불법이거나 무효인 경우`,
  `✔ 이미 변제 또는 소멸시효가 완성된 채무를 반복 청구받는 경우`,
  `✔ 투자사기·보이스피싱 관련 허위 채무를 강제 이행 요구받는 경우`,
  `✔ 과도한 위약금 또는 손해배상을 일방적으로 통보받는 경우`,
  `✔ 가압류·압류 등 법적 조치 예고와 함께 채무 이행을 요구받는 경우`,
  `✔ 정체불명의 채권추심 업체로부터 반복적인 연락을 받는 경우`,
  `## 소송 전 확인할 자료`,
  `${TPL_TYPE}를 검토하기 전에 아래 자료를 먼저 정리하면 초기 법률 검토 속도가 빨라집니다.`,
  `✔ 채권 원인 계약서 또는 거래 내역`,
  `✔ 상대방이 보낸 채무 이행 요구서·내용증명·문자·메신저 메시지`,
  `✔ 기존 변제 내역 및 영수증`,
  `✔ 가압류·압류 관련 서류`,
  `✔ 투자 또는 대출 관련 피해 자료 (사기 정황이 있는 경우)`,
  `원본 자료를 삭제하거나 수정하면 이후 사실관계 입증이 어려워질 수 있으므로 가능한 한 원본 상태로 보존해야 합니다.`,
  `## ${TPL_TYPE} 절차 개요`,
  `일반적으로 소장 작성 및 접수, 상대방 답변서 제출, 변론 기일, 판결 순서로 진행됩니다. 사건 내용에 따라 화해 권고 또는 조정으로 마무리되는 경우도 있습니다.`,
  `채무 부존재가 인정되면 상대방의 추심 행위는 법적 근거를 잃게 되며, 가압류·압류 해제 신청 등 후속 절차를 연계해 진행할 수 있습니다.`,
  `${TPL_REGION} 지역 ${TPL_SUBJECT} 상담에서는 소장 작성 전에 채무 발생 경위, 계약 유효성, 소멸시효 여부, 상대방 특정 가능성을 먼저 확인합니다.`,
  `## 투자사기·보이스피싱 연관 채무 대응`,
  `투자사기 또는 보이스피싱 과정에서 발생한 허위 채무를 상대방이 법적으로 청구하는 사례가 확인되고 있습니다. 이 경우 형사 절차와 민사 ${TPL_TYPE}를 병행 검토하는 것이 효과적입니다.`,
  `피해 경위, 사기 정황 자료, 상대방 계좌 및 연락처 정보를 함께 정리하면 형사고소와 ${TPL_TYPE} 준비를 동시에 진행할 수 있습니다.`,
  `## 핵심 정리`,
  `${TPL_TITLE} 페이지에서는 ${TPL_REGION} 지역 ${TPL_SUBJECT} 상담을 통해 채무 발생 경위 분석, ${TPL_TYPE} 가능성 검토, 소장 작성 방향을 안내합니다.`,
  `채무 이행 요구를 받았다고 해서 무조건 응할 필요는 없습니다. 법적 근거와 소멸시효 여부를 먼저 확인하고, 필요하다면 ${TPL_TYPE}를 통해 법원의 확인 판결을 받는 것이 가장 확실한 방법입니다.`,
  `## 자주 묻는 질문 (FAQ)`,
  `### Q1. ${TPL_TYPE}는 언제 제기해야 하나요?`,
  `상대방이 구체적인 채무 이행을 요구하거나 법적 절차를 예고한 시점부터 검토하는 것이 좋습니다. 소멸시효가 임박한 경우에는 신속하게 대응해야 합니다.`,
  `### Q2. 이미 일부 금액을 납부했는데 ${TPL_TYPE}를 제기할 수 있나요?`,
  `일부 납부 사실이 있어도 채무 자체의 유효성에 문제가 있다면 ${TPL_TYPE} 제기가 가능합니다. 납부 경위와 계약 내용을 함께 검토해야 합니다.`,
  `### Q3. 투자사기로 인한 허위 채무도 ${TPL_TYPE}로 대응할 수 있나요?`,
  `가능합니다. 사기 피해 정황이 있다면 형사고소와 병행해 ${TPL_TYPE}로 채무 부존재를 확인받는 것이 효과적입니다.`,
  `### Q4. ${TPL_SUBJECT} 상담 전 준비해야 할 서류는 무엇인가요?`,
  `채무 관련 계약서, 채무 이행 요구 내용증명 또는 문자, 기존 변제 내역, 관련 대화 내용 등을 준비하면 초기 검토가 빠르게 진행됩니다.`,
  `### Q5. 채권추심 연락이 계속 오는 경우 어떻게 해야 하나요?`,
  `불법 채권추심 행위는 채권추심법 위반으로 신고 대상이 됩니다. ${TPL_TYPE} 제기와 함께 추심 행위 금지 가처분 신청을 병행 검토할 수 있습니다.`,
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const title = normalizeSpace(body.title);
    const slug = normalizeSlug(body.slug || title);
    const isPreview = body.preview === true;

    if (!title || !slug) {
      return json({ ok: false, message: "페이지 제목은 필수입니다." }, 400);
    }

    const { subject, region, type } = parseTitleParts(title);
    const generatedBody = buildFromTemplate(title, subject, region, type);
    const generatedMeta = generateMeta(subject, region, type);

    if (isPreview) {
      return json({ ok: true, body: generatedBody, subject, region, type });
    }

    const rawBody = body.body;
    const confirmedBody = Array.isArray(rawBody) && rawBody.length
      ? rawBody
      : typeof rawBody === "string" && rawBody.trim()
        ? rawBody.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : generatedBody;

    const summary = normalizeSpace(body.summary).slice(0, 180) || generatedMeta.summary;
    const imageAlt         = normalizeSpace(body.imageAlt).slice(0, 160) || generatedMeta.imageAlt;
    const imageCaption     = normalizeSpace(body.imageCaption).slice(0, 220) || generatedMeta.imageCaption;
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300) || generatedMeta.imageDescription;

    const existing = await loadExisting(env, slug);
    if (existing && existing.createdBy !== CREATED_BY) {
      return json({ ok: false, message: "이미 다른 방식으로 생성된 slug입니다. 다른 slug를 입력하세요." }, 409);
    }

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(LE_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, LE_SITE_URL),
      h1: title,
      ...(imageAlt         ? { imageAlt }         : {}),
      ...(imageCaption     ? { imageCaption }     : {}),
      ...(imageDescription ? { imageDescription } : {}),
      body: confirmedBody,
      victimCases: [],
      suspiciousCompanies: [],
      faq: [],
    };

    const item = {
      ...(existing || {}),
      slug,
      caseName: title,
      category: "채무부존재소송 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: ["채무부존재소송", "투자사기", "채무확인"],
      landings: { ...(existing?.landings || {}), le: landing },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} chaemubu landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmLeCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "채무부존재소송 랜딩이 갱신되었습니다." : "채무부존재소송 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(LE_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} chaemubu landing ${slug}`);
    return json({
      ok: true,
      message: existing ? "채무부존재소송 랜딩이 갱신되었습니다." : "채무부존재소송 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(LE_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

// ── 원고/메타 생성 ────────────────────────────────────────────────────────────

function buildFromTemplate(title, subject, region, type) {
  return TEMPLATE_BODY.map((para) =>
    String(para || "")
      .split(TPL_TITLE).join(title)
      .split(TPL_SUBJECT).join(subject)
      .split(TPL_REGION).join(region || "서울")
      .split(TPL_TYPE).join(type || "채무부존재소송"),
  );
}

function generateMeta(subject, region, type) {
  const r = region || "서울";
  const t = type || "채무부존재소송";
  const summary = `${subject} 상담은 ${t} 가능성, 채무 유효성 검토, 소멸시효 확인, 소장 작성 방향을 빠르게 확인하는 과정이 중요합니다. ${r} 지역 피해 대응 절차를 안내합니다.`.slice(0, 180);
  const imageAlt = `${subject} ${t} 채무 대응`;
  const imageCaption = `${subject}가 안내하는 ${t} 절차와 채무 부존재 확인 대응`;
  const imageDescription = `${subject} 상담을 통해 ${t} 가능성, 채무 유효성, 소멸시효, 소장 작성 방향을 정리한 법률 정보 이미지입니다.`;
  return { summary, imageAlt, imageCaption, imageDescription };
}

// ── 제목 파싱 ─────────────────────────────────────────────────────────────────

function parseTitleParts(title) {
  const s = normalizeSpace(title);
  const compact = s.replace(/\s+/g, "");

  let region = "";
  const regionMatch = compact.match(/^([가-힣]{2,6})(?:지역|법원|변호사|채무)/);
  if (regionMatch) region = cleanRegion(regionMatch[1]);

  let type = "채무부존재소송";
  if (/채무부존재확인/.test(s)) type = "채무부존재확인소송";
  else if (/채무부존재/.test(s)) type = "채무부존재소송";

  const subjectMatch = s.match(/([가-힣A-Za-z0-9\s]{2,20}?)\s*(?:채무부존재|변호사|소송)/);
  let subject = subjectMatch ? subjectMatch[1].trim() : "";
  if (!subject || subject.length < 2) {
    subject = region ? `${region}${type}변호사` : `${type}변호사`;
  } else if (!subject.includes("변호사")) {
    subject = region ? `${region}${type}변호사` : `${subject} ${type}변호사`;
  }

  return { subject, region, type };
}

function cleanRegion(value = "") {
  return normalizeSpace(value)
    .replace(/^(?:서울|경기|인천|부산|대구|대전|광주|울산|세종)\s*/g, "")
    .replace(/[^가-힣A-Za-z0-9]/g, "")
    .slice(0, 10);
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

async function loadExisting(env, slug) {
  if (env.CASES) {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) return JSON.parse(raw);
  }
  const all = await loadCasesFromGitHub(env).catch(() => []);
  return all.find((item) => item.slug === slug) || null;
}

async function loadIndexFromKv(env) {
  const raw = await env.CASES.get("cases:index");
  return raw ? JSON.parse(raw) : [];
}

function upsertIndex(index, item) {
  const entry = buildIndexEntry(item);
  const pos = index.findIndex((c) => c.slug === item.slug);
  if (pos >= 0) index[pos] = entry;
  else index.push(entry);
  index.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function buildIndexEntry(item) {
  return {
    slug: item.slug,
    caseName: item.caseName || "",
    category: item.category || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    thumbnailUrl: item.thumbnailUrl || "",
    landingViews: item.landingViews || 0,
    reports: item.reports || 0,
    summary: item.summary || "",
    tags: item.tags || [],
    memo: item.memo || "",
    noindex: item.noindex || false,
    targetGroups: item.targetGroups || [],
    createdBy: item.createdBy || "",
  };
}

async function upsertCaseInGitHub(env, item, message) {
  const all = await loadCasesFromGitHub(env);
  const pos = all.findIndex((c) => c.slug === item.slug);
  if (pos >= 0) all[pos] = item;
  else all.push(item);
  all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  await saveCasesToGitHub(env, all, message);
}

async function loadCasesFromGitHub(env) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return [];
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`,
    { headers: githubHeaders(token) },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("GitHub cases.json 로드 실패");
  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

async function saveCasesToGitHub(env, list, message) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return;
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`,
    { headers: githubHeaders(token) },
  );
  let sha = null;
  if (getRes.ok) sha = (await getRes.json()).sha;
  else if (getRes.status !== 404) throw new Error("GitHub cases.json 상태 확인 실패");
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`,
    {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({ message, content: encodeBase64(JSON.stringify(list, null, 2)), branch, ...(sha ? { sha } : {}) }),
    },
  );
  if (!putRes.ok) throw new Error(`GitHub cases.json 저장 실패: ${(await putRes.text()).slice(0, 180)}`);
}

async function warmLeCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, LE_SITE_URL), { method: "GET" }),
    fetch(buildLandingUrl(LE_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: LE_HOST,
      key,
      keyLocation: `${LE_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(LE_GROUP, slug), `${LE_SITE_URL}/`],
    }),
  });
}

function githubEnv(env) {
  return { owner: env.GITHUB_REPO_OWNER, repo: env.GITHUB_REPO_NAME, branch: env.GITHUB_BRANCH || "main", token: env.GITHUB_TOKEN };
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin", "Cache-Control": "no-cache" };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") return decodeBase64(file.content).trim();
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function decodeBase64(value) {
  return new TextDecoder().decode(Uint8Array.from(atob(String(value || "").replace(/\n/g, "")), (c) => c.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let b = "";
  for (const byte of bytes) b += String.fromCharCode(byte);
  return btoa(b);
}

function normalizeSlug(value = "") {
  return String(value).trim().toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9가-힣_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return min + (hash % (max - min + 1));
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
