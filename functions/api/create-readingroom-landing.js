import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const LD_HOST = "xn--o01bo9fw8bq3ho5ap91depg2maj5f.kr";
const LD_SITE_URL = "https://리딩방피해회수센터.kr";
const LD_GROUP = GROUPS.find((group) => group.host === LD_HOST);
const TARGET_GROUPS = ["ld"];
const CREATED_BY = "readingroom-manual";

const TPL_TITLE = "TITLE";
const TPL_CASE = "CASE";
const TPL_CHANNEL = "CHANNEL";
const TPL_CENTER = "주식리딩방사기 센터";

const TEMPLATE_BODY = [
  TPL_TITLE,
  `## ${TPL_CASE} 핵심 요약`,
  `${TPL_CASE} 피해가 의심되는 상황이라면 먼저 추가 입금을 멈추고, 리딩방 대화 내용과 입금 내역, 출금 거부 화면을 원본 그대로 보존해야 합니다. ${TPL_CHANNEL} 사건은 단순 투자 손실이 아니라 허위 수익 화면, 바람잡이 계정, 가짜 HTS·거래소, 추가 입금 요구가 결합된 사기 구조인지 확인하는 것이 중요합니다.`,
  `${TPL_CENTER}에서는 ${TPL_CASE} 관련 상담에서 계좌 흐름, 지갑 주소, 대화방 운영자, 출금 조건 변경 시점을 함께 검토해 형사고소와 민사상 피해금 회수 가능성을 나누어 안내합니다.`,
  `## 네이버 AI 브리핑형 빠른 답변`,
  `### 출금이 막혔을 때 먼저 할 일`,
  `세금, 보증금, 인증비, AML 비용, 지갑 활성화 비용을 먼저 내야 출금된다는 안내를 받았다면 추가 송금 전에 자료를 정리해야 합니다. 정상 투자 서비스에서는 개인 계좌나 지정 계좌로 추가 비용을 반복 송금하라고 요구하는 구조가 일반적이지 않습니다.`,
  `### 계좌·지갑 추적에서 필요한 자료`,
  `입금 계좌번호, 예금주, 송금 시간, 가상자산 지갑 주소, 거래소 화면, 담당자 프로필, 단체방 초대 링크, 출금 거부 메시지를 시간순으로 묶어야 합니다. 자료가 많을수록 수사기관 접수와 민사 보전처분 검토가 빨라질 수 있습니다.`,
  `### 형사고소와 민사 회수 병행 기준`,
  `상대방이 허위 수익과 출금 가능성을 말해 입금을 유도했다면 형사고소를 검토하고, 수취 계좌나 관련 법인이 특정된다면 가압류, 손해배상청구, 부당이득반환청구 등 민사 절차를 함께 살펴볼 수 있습니다.`,
  `## 주식·코인 리딩방 사기 주요 수법`,
  `### 무료 종목 추천에서 VIP방 전환`,
  `처음에는 무료 종목 추천, 시장 분석, 수익 인증을 제공하며 신뢰를 만들고 이후 VIP방, 기관 물량, 블록딜, 공모주 특별 배정, 선물 옵션 프로젝트 등으로 고액 입금을 유도하는 방식이 반복됩니다.`,
  `### 가짜 HTS·거래소·코인 지갑 유도`,
  `정상 금융회사처럼 보이는 사이트나 앱을 안내하지만, 실제로는 수익 화면만 조작되거나 출금 권한이 운영자에게 묶여 있는 경우가 있습니다. 앱 설치 파일, 접속 주소, 로그인 화면, 고객센터 대화까지 함께 보관해야 합니다.`,
  `### 세금·보증금·AML 비용 명목 추가 입금`,
  `출금 신청 단계에서 세금, 보증금, 계좌 인증비, 수수료, 자금세탁방지 심사비, 지갑 활성화 비용을 요구한다면 2차 피해 가능성을 우선 의심해야 합니다.`,
  `## 피해 직후 증거 보존 체크리스트`,
  `- 입금증과 전체 거래내역`,
  `- 카카오톡·텔레그램·네이버 밴드 대화 캡처`,
  `- 단체방 공지, 수익 인증, 출금 인증 게시물`,
  `- 투자 사이트 주소와 앱 설치 파일명`,
  `- 출금 거부 화면과 추가 입금 요구 메시지`,
  `- 상대방 계좌번호, 예금주, 지갑 주소, 담당자 프로필`,
  `## 피해금 회수 검토 절차`,
  `### 1단계 자료 정리`,
  `피해 경위를 날짜별로 정리하고, 입금 내역과 대화 내용을 연결합니다. 같은 담당자나 같은 계좌가 여러 번 등장하는지 확인합니다.`,
  `### 2단계 형사 절차 검토`,
  `기망 표현, 허위 수익 화면, 출금 제한, 추가 입금 요구가 확인되면 사기죄 고소장 구성 방향을 검토합니다.`,
  `### 3단계 민사 회수 절차 검토`,
  `수취 계좌, 법인 계좌, 계좌 명의자, 자금 이동 경로가 특정될 경우 가압류와 손해배상청구 가능성을 살펴봅니다.`,
  `## 유사 사례로 보는 대응 흐름`,
  `${TPL_CASE}와 유사한 사건에서는 피해자가 단체방의 수익 인증을 믿고 1차 입금을 한 뒤, 출금 신청 단계에서 세금과 보증금을 요구받는 흐름이 자주 확인됩니다. 또 다른 사례에서는 코인 지갑 인증비를 납부하면 원금과 수익금을 한 번에 돌려준다는 안내를 받았지만, 추가 입금 이후 담당자 계정과 사이트가 동시에 사라진 경우도 있습니다.`,
  `중요한 것은 피해 사실을 늦게 알았더라도 자료를 삭제하지 않는 것입니다. 방을 나가기 전 화면을 캡처하고, 앱을 삭제하기 전 접속 화면과 출금 제한 문구를 남겨두면 이후 대응에 도움이 됩니다.`,
  `## 자주 묻는 질문`,
  `### Q1. 리딩방에서 손실이 난 것과 사기는 어떻게 구분하나요?`,
  `정상 투자 손실과 달리 허위 수익 화면, 원금 보장 표현, 출금 거부, 추가 입금 요구, 담당자 연락 두절이 결합되어 있다면 사기 구조를 검토할 수 있습니다.`,
  `### Q2. 이미 세금이나 보증금을 추가로 냈다면 어떻게 해야 하나요?`,
  `더 이상의 추가 송금을 멈추고 기존 입금 내역과 추가 요구 메시지를 모두 보존해야 합니다. 추가 입금 경위는 피해금 산정과 기망 구조 입증에 중요한 자료가 됩니다.`,
  `### Q3. 코인 지갑으로 보낸 돈도 추적할 수 있나요?`,
  `블록체인 거래는 기록이 남기 때문에 지갑 주소와 전송 내역을 기준으로 흐름을 확인할 수 있습니다. 다만 회수 가능성은 거래소 경유 여부와 상대방 특정 가능성에 따라 달라집니다.`,
  `### Q4. 형사고소만 하면 피해금이 바로 돌아오나요?`,
  `형사고소는 처벌과 수사를 위한 절차이고, 피해금 회수를 위해서는 민사상 가압류, 손해배상청구, 부당이득반환청구를 함께 검토해야 하는 경우가 많습니다.`,
  `### Q5. 상담 전 무엇을 준비하면 좋나요?`,
  `입금증, 계좌정보, 대화 캡처, 사이트 주소, 출금 거부 화면, 담당자 프로필을 준비하면 초기 검토가 빨라집니다.`,
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

    const { caseKeyword, subject, channelType } = parseTitleParts(title);
    const generatedBody = buildFromTemplate(title, caseKeyword, channelType);
    const generatedMeta = generateMeta(caseKeyword, channelType);

    if (isPreview) {
      return json({ ok: true, body: generatedBody, subject, caseKeyword, channelType });
    }

    const rawBody = body.body;
    const confirmedBody = Array.isArray(rawBody) && rawBody.length
      ? rawBody
      : typeof rawBody === "string" && rawBody.trim()
        ? rawBody.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : generatedBody;

    const summary = normalizeSpace(body.summary).slice(0, 180) || generatedMeta.summary;
    const imageAlt = normalizeSpace(body.imageAlt).slice(0, 160) || generatedMeta.imageAlt;
    const imageCaption = normalizeSpace(body.imageCaption).slice(0, 220) || generatedMeta.imageCaption;
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300) || generatedMeta.imageDescription;

    const existing = await loadExisting(env, slug);
    const isOwnReadingroomCase = !existing || existing.createdBy === CREATED_BY;

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(LD_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, LD_SITE_URL, "png"),
      h1: title,
      ...(imageAlt ? { imageAlt } : {}),
      ...(imageCaption ? { imageCaption } : {}),
      ...(imageDescription ? { imageDescription } : {}),
      body: confirmedBody,
      victimCases: [],
      suspiciousCompanies: [],
      faq: [],
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
    };

    const item = {
      ...(existing || {}),
      slug,
      caseName: isOwnReadingroomCase ? title : existing.caseName,
      category: isOwnReadingroomCase ? "주식리딩방사기 랜딩" : existing.category,
      createdBy: isOwnReadingroomCase ? CREATED_BY : existing.createdBy,
      targetGroups: isOwnReadingroomCase ? TARGET_GROUPS : (existing.targetGroups || []),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary: isOwnReadingroomCase ? summary : existing.summary,
      tags: isOwnReadingroomCase ? ["주식리딩방사기", "코인리딩방사기", "출금거부", "피해금회수", "법무법인선린"] : (existing.tags || []),
      landings: { ...(existing?.landings || {}), ld: landing },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} readingroom landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmLdCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "리딩방 랜딩이 갱신되었습니다." : "리딩방 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(LD_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} readingroom landing ${slug}`);
    return json({
      ok: true,
      message: existing ? "리딩방 랜딩이 갱신되었습니다." : "리딩방 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(LD_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

function buildFromTemplate(title, caseKeyword, channelType) {
  return TEMPLATE_BODY.map((para) =>
    String(para || "")
      .split(TPL_TITLE).join(title)
      .split(TPL_CASE).join(caseKeyword)
      .split(TPL_CHANNEL).join(channelType)
  );
}

function generateMeta(caseKeyword, channelType) {
  const summary = `${caseKeyword} 피해가 의심되나요? ${channelType} 출금거부, 추가입금 요구, 가짜 HTS·거래소 정황과 피해금 회수 가능성, 형사고소 및 민사 대응 절차를 02-6348-0406 24시간 안내합니다.`.slice(0, 180);
  const imageAlt = `${caseKeyword} 피해 회수 대응`;
  const imageCaption = `주식리딩방사기 센터가 안내하는 ${caseKeyword} 출금거부 및 피해금 회수 대응`;
  const imageDescription = `${caseKeyword} 상담을 통해 리딩방 피해 직후 필요한 증거 보존, 형사고소, 계좌·지갑 추적, 민사 회수 가능성을 정리한 법률 정보 이미지입니다.`;
  return { summary, imageAlt, imageCaption, imageDescription };
}

function parseTitleParts(title) {
  const source = normalizeSpace(title);
  const channelType = detectChannelType(source);
  let subject = source
    .replace(/\s*(출금\s*거부|출금거부|피해금\s*회수|피해\s*회수|회수\s*대응|대응\s*방법|상담|변호사|센터).*$/i, "")
    .replace(/\s*(사칭\s*)?사기.*$/i, "")
    .trim();

  if (!subject) subject = channelType;
  subject = subject.replace(/\s+/g, " ").slice(0, 40);
  const caseKeyword = /사기/.test(subject) ? subject : `${subject} 사기`;
  return { subject, caseKeyword, channelType };
}

function detectChannelType(value = "") {
  const text = String(value || "").toLowerCase();
  const hasCoin = /(코인|가상자산|거래소|usdt|btc|eth|coin|token|wallet|지갑)/i.test(text);
  const hasStock = /(주식|공모주|증권|선물|옵션|hts|mts|stock|ipo)/i.test(text);
  if (hasCoin && hasStock) return "주식·코인 리딩방";
  if (hasCoin) return "코인 리딩방";
  return hasStock ? "주식 리딩방" : "주식 리딩방";
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
  const pos = index.findIndex((c) => c.slug === item.slug);
  if (pos >= 0) index[pos] = entry;
  else index.push(entry);
  index.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function buildIndexEntry(item) {
  const ldLanding = item.landings?.ld;
  const readingroomLanding = item.createdBy === CREATED_BY || ldLanding?.createdBy === CREATED_BY
    ? {
        createdBy: CREATED_BY,
        title: ldLanding?.title || item.caseName || "",
        h1: ldLanding?.h1 || ldLanding?.title || item.caseName || "",
        description: ldLanding?.description || item.summary || "",
        canonical: ldLanding?.canonical || buildLandingUrl(LD_GROUP, item.slug),
      }
    : null;

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
    hideFromListing: item.hideFromListing || false,
    searchHidden: item.searchHidden || false,
    targetGroups: item.targetGroups || [],
    createdBy: item.createdBy || "",
    ...(readingroomLanding ? { hasReadingroomLanding: true, landings: { ld: readingroomLanding } } : {}),
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

async function warmLdCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, LD_SITE_URL, "png"), { method: "GET" }),
    fetch(caseOgImageUrl(slug, LD_SITE_URL, "webp"), { method: "GET" }),
    fetch(buildLandingUrl(LD_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: LD_HOST,
      key,
      keyLocation: `${LD_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(LD_GROUP, slug), `${LD_SITE_URL}/`],
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
