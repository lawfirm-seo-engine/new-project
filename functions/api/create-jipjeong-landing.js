import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const RECOVERY_HOST = "gnlaw-recovery.co.kr";
const RECOVERY_SITE_URL = "https://gnlaw-recovery.co.kr";
const RECOVERY_GROUP = GROUPS.find((group) => group.host === RECOVERY_HOST);
const TARGET_GROUPS = ["c"];
const CREATED_BY = "jipjeong-manual";

// 한국산업은행-지급정지-이의신청-종로변호사 랜딩 원고를 기본 템플릿으로 사용
const TEMPLATE_ENTITY = "한국산업은행";
const TEMPLATE_BODY = [
  "ENTITY 지급정지 이의신청 종로변호사가 알려드립니다",
  "ENTITY 지급정지 이의신청은 단순히 신청서를 제출한다고 바로 해결되는 절차가 아닙니다. 지급정지의 원인이 무엇인지 확인하고 실제 거래 경위와 자금의 성격을 객관적인 자료로 입증해야 합니다.",
  "특히 전기통신금융사기, 보이스피싱, 투자사기, 오픈채팅 사기, 코인 사기 등의 피해 신고로 계좌가 지급정지되는 사례가 증가하면서 정상적인 거래를 한 계좌 소유자도 지급정지 대상이 되는 경우가 발생하고 있습니다.",
  "ENTITY 지급정지 이의신청 종로변호사는 지급정지 원인을 확인하고 필요한 증빙자료를 검토하여 적절한 대응 방향을 제시합니다.",
  "지급정지가 발생하는 대표적인 사례",
  "지급정지는 대부분 금융사기 피해 신고 이후 이루어집니다.",
  "대표적으로 다음과 같은 경우가 많습니다.",
  "보이스피싱 피해금이 입금된 경우 투자사기 피해금이 계좌를 거쳐 이동한 경우 중고거래 사기 거래대금이 입금된 경우 가상자산 거래 과정에서 피해금이 송금된 경우 계좌 대여 또는 명의 제공으로 이용된 경우 오픈채팅 또는 SNS 거래 과정에서 피해금이 유입된 경우",
  "실제 계좌 명의자가 범죄와 무관하더라도 지급정지가 이루어질 수 있으며, 이후 거래 경위에 대한 충분한 소명이 필요합니다.",
  "ENTITY 지급정지 이의신청 절차",
  "지급정지가 확인되었다면 우선 지급정지 사유와 신고 기관을 확인해야 합니다.",
  "이후에는 다음과 같은 절차로 진행됩니다.",
  "✔ 지급정지 사유 확인",
  "✔ 거래내역 확보",
  "✔ 입출금 내역 분석",
  "✔ 계약서·대화내역 등 거래자료 확보",
  "✔ 실제 거래 목적 및 자금 흐름 정리",
  "✔ 이의신청서 제출",
  "✔ 추가 자료 제출 및 심사",
  "사안에 따라 금융기관 심사뿐 아니라 수사기관의 진행 상황도 함께 영향을 줄 수 있으므로 자료 준비가 매우 중요합니다.",
  "지급정지 이의신청 시 준비하면 도움이 되는 자료",
  "ENTITY 지급정지 이의신청에서는 객관적인 자료가 가장 중요합니다.",
  "대표적으로 다음과 같은 자료를 준비하는 것이 도움이 됩니다.",
  "거래계약서 세금계산서 거래명세서 입금 요청 내역 문자 및 메신저 대화 이메일 기록 계좌 거래내역 송금 영수증 사업 관련 증빙자료 신분 확인 자료",
  "자료가 서로 일관성을 갖추고 있을수록 거래의 정당성을 설명하는 데 도움이 될 수 있습니다.",
  "종로변호사의 검토가 필요한 이유",
  "지급정지 사건은 단순한 금융 민원으로 끝나는 경우도 있지만, 경우에 따라 형사절차 또는 민사 분쟁으로 이어질 가능성도 있습니다.",
  "따라서 거래 구조를 정확히 분석하고 지급정지 사유를 확인한 후 대응 방향을 결정하는 것이 중요합니다.",
  "ENTITY 지급정지 이의신청 종로변호사는 지급정지 경위와 거래자료를 종합적으로 검토하여 필요한 자료를 정리하고 절차 진행 시 고려해야 할 법률적 쟁점을 안내합니다.",
];
const TEMPLATE_SUMMARY =
  "ENTITY 계좌가 지급정지되었다면 이의신청 절차와 제출자료를 정확히 준비하는 것이 중요합니다. ENTITY 지급정지 이의신청 종로변호사가 지급정지 사유, 대응 절차, 민사·형사상 쟁점을 자세히 안내합니다.";

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

    // 새 제목에서 기관명(엔티티) 추출
    const newEntity = extractEntity(title);

    // 기존 지급정지 랜딩을 KV에서 찾아 원고 참조
    let referenceBody = null;
    let referenceEntity = TEMPLATE_ENTITY;
    if (env.CASES) {
      const found = await findJipjeongReferenceFromKv(env);
      if (found) {
        referenceBody = found.body;
        referenceEntity = found.entity;
      }
    }

    // 참조 원고가 없으면 내장 템플릿 사용
    const sourceBody = referenceBody || TEMPLATE_BODY;
    const sourceEntity = referenceEntity;

    // 엔티티 치환하여 새 원고 생성
    const generatedBody = substituteEntity(sourceBody, sourceEntity, newEntity);

    if (isPreview) {
      return json({ ok: true, body: generatedBody });
    }

    // 저장 단계 — body는 프론트에서 확인된 원고를 그대로 사용
    const confirmedBody = Array.isArray(body.body) && body.body.length
      ? body.body
      : generatedBody;

    const imageAlt = normalizeSpace(body.imageAlt).slice(0, 160);
    const imageCaption = normalizeSpace(body.imageCaption).slice(0, 220);
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300);

    const autoSummary = substituteEntityStr(TEMPLATE_SUMMARY, TEMPLATE_ENTITY, newEntity);
    const summary = normalizeSpace(body.summary).slice(0, 180) || autoSummary;

    const existing = await loadExisting(env, slug);
    if (existing && !isJipjeongManual(existing)) {
      return json({
        ok: false,
        message: "이미 다른 방식으로 생성된 slug입니다. 다른 slug를 입력하세요.",
      }, 409);
    }

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(RECOVERY_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, RECOVERY_SITE_URL),
      h1: title,
      ...(imageAlt ? { imageAlt } : {}),
      ...(imageCaption ? { imageCaption } : {}),
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
      category: "지급정지 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: ["지급정지", "이의신청", "종로변호사"],
      landings: {
        ...(existing?.landings || {}),
        c: landing,
      },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} jipjeong landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmRecoveryCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "지급정지 랜딩이 갱신되었습니다." : "지급정지 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(RECOVERY_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} jipjeong landing ${slug}`);
    const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
    context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
    context.waitUntil?.(warmRecoveryCache(slug).catch(() => {}));

    return json({
      ok: true,
      message: existing ? "지급정지 랜딩이 갱신되었습니다." : "지급정지 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(RECOVERY_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

// KV에서 기존 지급정지 랜딩을 찾아 참조 엔티티+원고 반환
async function findJipjeongReferenceFromKv(env) {
  try {
    const idxRaw = await env.CASES.get("cases:index");
    if (!idxRaw) return null;
    const index = JSON.parse(idxRaw);

    // 지급정지 관련 케이스 찾기
    const jipjeongCases = index.filter((c) => {
      const slug = String(c.slug || "");
      const name = String(c.caseName || "");
      return slug.includes("지급정지") || name.includes("지급정지");
    });

    if (!jipjeongCases.length) return null;

    // 가장 최근 케이스를 기준으로 사용
    const ref = jipjeongCases[0];
    const raw = await env.CASES.get(`case:${ref.slug}`);
    if (!raw) return null;

    const caseData = JSON.parse(raw);
    const body = caseData?.landings?.c?.body;
    if (!Array.isArray(body) || !body.length) return null;

    const entity = extractEntity(String(ref.caseName || ref.slug || ""));
    return { body, entity };
  } catch {
    return null;
  }
}

// 제목에서 기관명(지급정지 앞 텍스트) 추출
function extractEntity(title) {
  const normalized = normalizeSpace(title);
  // "XX 지급정지" 또는 "XX지급정지" 패턴에서 앞 부분 추출
  const match = normalized.match(/^(.+?)\s*지급정지/);
  if (match && match[1]) return match[1].trim();
  // 매칭 실패 시 첫 단어 반환
  return normalized.split(/[\s\-–—]/)[0] || normalized;
}

// 원고 배열 전체에서 구 엔티티를 신 엔티티로 치환
function substituteEntity(bodyArray, fromEntity, toEntity) {
  if (!fromEntity || !toEntity || fromEntity === toEntity) return bodyArray;
  return bodyArray.map((para) => {
    // 특수문자 이스케이프 후 정규식으로 전체 치환
    const escaped = fromEntity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return para.replace(new RegExp(escaped, "g"), toEntity);
  });
}

function substituteEntityStr(str, fromEntity, toEntity) {
  if (!fromEntity || !toEntity || fromEntity === toEntity) return str;
  const escaped = fromEntity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return str.replace(new RegExp(escaped, "g"), toEntity);
}

function isJipjeongManual(item = {}) {
  return item.createdBy === CREATED_BY;
}

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
  const pos = index.findIndex((candidate) => candidate.slug === item.slug);
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
  const pos = all.findIndex((candidate) => candidate.slug === item.slug);
  if (pos >= 0) all[pos] = item;
  else all.push(item);
  all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  await saveCasesToGitHub(env, all, message);
}

async function loadCasesFromGitHub(env) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return [];

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("GitHub cases.json 로드 실패");

  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

async function saveCasesToGitHub(env, list, message) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return;

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });

  let sha = null;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
  } else if (getRes.status !== 404) {
    throw new Error("GitHub cases.json 상태 확인 실패");
  }

  const body = {
    message,
    content: encodeBase64(JSON.stringify(list, null, 2)),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    throw new Error(`GitHub cases.json 저장 실패: ${detail.slice(0, 180)}`);
  }
}

async function warmRecoveryCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, RECOVERY_SITE_URL), { method: "GET" }),
    fetch(buildLandingUrl(RECOVERY_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: RECOVERY_HOST,
      key,
      keyLocation: `${RECOVERY_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(RECOVERY_GROUP, slug), `${RECOVERY_SITE_URL}/`],
    }),
  });
}

function githubEnv(env) {
  return {
    owner: env.GITHUB_REPO_OWNER,
    repo: env.GITHUB_REPO_NAME,
    branch: env.GITHUB_BRANCH || "main",
    token: env.GITHUB_TOKEN,
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    return decodeBase64(file.content).trim();
  }
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function decodeBase64(value) {
  const clean = String(value || "").replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
