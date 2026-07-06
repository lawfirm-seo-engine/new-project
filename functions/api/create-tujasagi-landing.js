import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const LC_HOST = "xn--2e0bno217bsqa58yp8nd1g2ma.kr";
const LC_SITE_URL = "https://사기피해구제센터.kr";
const LC_GROUP = GROUPS.find((g) => g.host === LC_HOST);
const TARGET_GROUPS = ["lc"];
const CREATED_BY = "tujasagi-manual";

const TPL_TITLE = "TITLE";
const TPL_SUBJECT = "SUBJECT";
const TPL_REGION = "REGION";

const TEMPLATE_BODY = [
  TPL_TITLE,
  `## 투자사기 피해 현황`,
  `투자사기는 리딩방, 주식·선물옵션 투자 플랫폼, 가상자산 거래소, SNS 투자 그룹 등 다양한 경로를 통해 발생하고 있습니다. 처음에는 소액 수익을 보여주며 신뢰를 형성한 뒤 고액 투자를 유도하고, 출금 요청 단계에서 세금·수수료·보증금 명목으로 추가 납입을 요구하는 패턴이 반복됩니다.`,
  `${TPL_REGION} 지역에서 ${TPL_SUBJECT} 상담을 받는 경우, 피해 금액과 상관없이 초기 대응 속도가 회수 가능성을 크게 좌우합니다.`,
  `## 투자사기 주요 유형`,
  `다음 유형에 해당한다면 즉시 법률 검토를 받는 것이 중요합니다.`,
  `✔ 리딩방·유료 투자 정보 구독 후 고액 손실 또는 출금 불가`,
  `✔ 해외 거래소·불법 플랫폼을 통한 코인·선물옵션 투자 손실`,
  `✔ SNS 지인 소개 투자 그룹에서 원금 보장·확정 수익 약속 후 먹튀`,
  `✔ 가짜 투자 앱 또는 조작된 수익 화면을 통한 입금 유도`,
  `✔ 출금 시 세금·보증금·수수료 명목 추가 요구 후 잠적`,
  `✔ 투자 자문사·자산운용사 사칭 후 계약서·수익 확인서 위조`,
  `## 초기 대응 체크리스트`,
  `피해 직후 아래 사항을 먼저 정리하면 법률 검토와 수사기관 신고 절차가 빠르게 진행됩니다.`,
  `✔ 입금 내역 전체 (계좌이체 확인증, 가상자산 전송 내역)`,
  `✔ 대화 내용 캡처 (카카오톡·텔레그램·라인 등)`,
  `✔ 투자 플랫폼 또는 앱 화면 캡처 (수익 화면, 출금 오류 화면)`,
  `✔ 상대방 연락처, 계좌번호, 사이트 주소, 지갑 주소`,
  `✔ 계약서·투자 확인서·수익 배당 안내 문서 (있는 경우)`,
  `원본 자료는 삭제하지 말고 그대로 보존해야 합니다. 수정하거나 캡처 후 원본을 삭제하면 이후 증거 능력이 약화될 수 있습니다.`,
  `## 법적 대응 경로`,
  `투자사기 피해는 형사와 민사를 병행 검토하는 것이 효과적입니다.`,
  `**형사 고소**: 경찰청 사이버범죄신고시스템(ECRM) 또는 검찰청 고소장 접수. 계좌 지급정지·동결 요청과 연계해 진행하면 회수 가능성을 높일 수 있습니다.`,
  `**민사 소송**: 상대방 특정이 가능한 경우 가압류·손해배상청구 소송 검토. 수사 결과와 병행해 진행하면 판결 후 강제집행 속도를 높일 수 있습니다.`,
  `**금융당국 신고**: 금융감독원 불법금융신고센터, 한국인터넷진흥원(KISA) 사이버범죄 신고. 불법 플랫폼 차단 및 추가 피해 방지에 기여합니다.`,
  `${TPL_REGION} 지역 ${TPL_SUBJECT} 상담에서는 피해 유형 분류, 상대방 특정 가능성 검토, 증거 보전 순서, 수사기관 신고 방향을 함께 안내합니다.`,
  `## 계좌 지급정지 및 피해금 회수`,
  `피해 발생 직후 상대방 계좌에 자금이 남아 있을 가능성이 가장 높습니다. 빠른 지급정지 신청이 회수의 핵심입니다.`,
  `금융기관에 전기통신금융사기 피해 신고를 접수하면 지급정지 절차가 시작됩니다. 이미 이체된 경우에도 수취 계좌 추적과 수사 협조를 통해 자금 흐름을 파악할 수 있습니다.`,
  `가상자산 피해의 경우 블록체인 추적 분석(체인 분석)과 거래소 계정 동결 신청을 병행하는 방식으로 대응합니다.`,
  `## 핵심 정리`,
  `${TPL_TITLE} 페이지에서는 ${TPL_REGION} 지역 ${TPL_SUBJECT} 상담을 통해 피해 유형 분석, 증거 보전 방법, 형사·민사 대응 경로, 계좌 지급정지 절차를 안내합니다.`,
  `투자사기 피해는 시간이 지날수록 회수 가능성이 낮아집니다. 입금 내역과 대화 내용을 정리한 뒤 법률 상담을 먼저 받아보는 것이 가장 중요한 첫 단계입니다.`,
  `## 자주 묻는 질문 (FAQ)`,
  `### Q1. 투자사기 피해 금액이 작아도 신고해야 하나요?`,
  `소액이라도 신고하는 것이 중요합니다. 동일한 조직에 의한 피해자가 여럿일 경우 공동 피해자 집단으로 수사가 진행되어 검거 가능성이 높아지고 회수 가능성도 커집니다.`,
  `### Q2. 입금한 계좌가 타인 명의라면 어떻게 하나요?`,
  `대포통장일 가능성이 높습니다. 수사기관이 계좌 추적을 통해 실제 조직원을 특정하는 과정을 거칩니다. 계좌 정보와 입금 내역을 함께 신고하면 수사 진행에 도움이 됩니다.`,
  `### Q3. 가상자산으로 입금했는데 회수가 가능한가요?`,
  `블록체인 특성상 거래 기록이 남으므로 체인 분석을 통해 자금 흐름을 추적할 수 있습니다. 국내 거래소를 경유한 경우 동결 신청이 가능한 경우도 있습니다.`,
  `### Q4. 해외 사이트인데 신고가 가능한가요?`,
  `국내 수사기관에 신고 가능합니다. 인터폴 공조 수사나 외국 수사기관 협력을 통해 진행하는 사례도 있습니다. 국내 피해자 수가 많을수록 수사 가능성이 높아집니다.`,
  `### Q5. 투자 계약서에 서명했으면 피해 주장이 어려운가요?`,
  `계약서가 존재해도 사기죄 성립은 가능합니다. 상대방이 처음부터 이행 의사 없이 계약을 체결했거나 허위 사실을 고지한 경우 계약서의 존재가 사기 입증을 막지 않습니다.`,
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

    const { subject, region } = parseTitleParts(title);
    const generatedBody = buildFromTemplate(title, subject, region);
    const generatedMeta = generateMeta(subject, region);

    if (isPreview) {
      return json({ ok: true, body: generatedBody, subject, region });
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
      canonical: buildLandingUrl(LC_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, LC_SITE_URL),
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
      category: "투자사기 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: ["투자사기", "피해구제", "사기피해"],
      landings: { ...(existing?.landings || {}), lc: landing },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} tujasagi landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmLcCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "투자사기 랜딩이 갱신되었습니다." : "투자사기 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(LC_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} tujasagi landing ${slug}`);
    return json({
      ok: true,
      message: existing ? "투자사기 랜딩이 갱신되었습니다." : "투자사기 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(LC_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

// ── 원고/메타 생성 ────────────────────────────────────────────────────────────

function buildFromTemplate(title, subject, region) {
  return TEMPLATE_BODY.map((para) =>
    String(para || "")
      .split(TPL_TITLE).join(title)
      .split(TPL_SUBJECT).join(subject)
      .split(TPL_REGION).join(region || "서울"),
  );
}

function generateMeta(subject, region) {
  const r = region || "서울";
  const summary = `${subject} 상담은 투자사기 피해 직후 형사고소 가능성, 계좌 지급정지, 피해금 회수 경로를 빠르게 확인하는 과정이 중요합니다. ${r} 지역 피해 대응 절차를 안내합니다.`.slice(0, 180);
  const imageAlt = `${subject} 투자사기 피해 대응`;
  const imageCaption = `${subject}가 안내하는 투자사기 피해구제 절차와 피해금 회수 대응`;
  const imageDescription = `${subject} 상담을 통해 투자사기 피해 직후 필요한 형사고소, 계좌추적, 피해금 회수 가능성을 정리한 법률 정보 이미지입니다.`;
  return { summary, imageAlt, imageCaption, imageDescription };
}

// ── 제목 파싱 ─────────────────────────────────────────────────────────────────

function parseTitleParts(title) {
  const s = normalizeSpace(title);
  const compact = s.replace(/\s+/g, "");

  // 지역명 추출: 제목 앞부분 "OO투자사기변호사" 패턴
  let region = "";
  const directMatch = compact.match(/^([가-힣]{1,8})투자사기변호사/);
  if (directMatch) {
    region = cleanRegion(directMatch[1]);
  }
  if (!region) {
    const lawyerMatch = s.match(/(?:^|\s)([가-힣]{1,8})\s*(?:투자사기|사기피해|피해구제)\s*변호사/);
    if (lawyerMatch) region = cleanRegion(lawyerMatch[1]);
  }

  const subject = region ? `${region}투자사기변호사` : "투자사기변호사";
  return { subject, region };
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

async function warmLcCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, LC_SITE_URL), { method: "GET" }),
    fetch(buildLandingUrl(LC_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: LC_HOST,
      key,
      keyLocation: `${LC_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(LC_GROUP, slug), `${LC_SITE_URL}/`],
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
