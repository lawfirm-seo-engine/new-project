import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const LA_HOST = "xn--jj0b0cw1o75qwua31zyfp19e.kr";
const LA_SITE_URL = "https://xn--jj0b0cw1o75qwua31zyfp19e.kr";
const LA_GROUP = GROUPS.find((g) => g.host === LA_HOST);
const TARGET_GROUPS = ["la"];
const CREATED_BY = "voicephishing-manual";

const TPL_TITLE = "TITLE";
const TPL_SUBJECT = "SUBJECT";
const TPL_REGION = "REGION";
const TPL_ACTION = "ACTION";

const REFERENCE_PAGE_URLS = [
  "https://xn--jj0b0cw1o75qwua31zyfp19e.kr/criminal/여수보이스피싱변호사-출금정지-신청-어떻게-진행해야-할까-legal-action/",
  "https://xn--jj0b0cw1o75qwua31zyfp19e.kr/criminal/영등포보이스피싱변호사-계좌-지급정지-어떻게-진행해야-할까-legal-action/",
  "https://xn--jj0b0cw1o75qwua31zyfp19e.kr/criminal/노원보이스피싱변호사-지급정지-어떻게-진행해야-할까-legal-action/",
];

const TEMPLATE_BODY = [
  TPL_TITLE,
  `## ${TPL_ACTION} 절차가 중요한 이유`,
  `보이스피싱 피해는 송금 직후 짧은 시간 안에 여러 계좌를 거쳐 자금이 이동하는 경우가 많습니다. ${TPL_ACTION} 절차는 피해금의 추가 인출과 이동을 막기 위해 초기 단계에서 가장 먼저 검토해야 하는 절차입니다.`,
  `시간이 지날수록 계좌 분산, 현금 인출, 가상자산 전환 가능성이 커질 수 있으므로 ${TPL_SUBJECT} 상담에서는 송금 시점, 수취 계좌, 금융기관, 피해 인지 시점을 먼저 확인합니다.`,
  `## 피해를 인지했다면 먼저 확인할 자료`,
  `피해 사실을 확인했다면 감정적으로 상대방을 추궁하기보다 현재 남아 있는 자료를 원본 그대로 보존하는 것이 우선입니다.`,
  `✔ 송금한 계좌번호`,
  `✔ 송금 금액과 시간`,
  `✔ 상대방 계좌정보`,
  `✔ 문자 및 통화기록`,
  `✔ 카카오톡·텔레그램 대화`,
  `✔ 입금 영수증`,
  `✔ 거래 화면 캡처`,
  `✔ 원격제어 앱 설치 여부`,
  `위 자료는 ${TPL_ACTION} 검토와 형사고소, 피해금 회수 가능성 판단에 함께 활용될 수 있습니다.`,
  `## ${TPL_ACTION} 절차는 어떻게 진행될까`,
  `보이스피싱 피해가 의심되는 경우에는 금융회사와 관계 기관을 통해 지급정지 또는 출금정지 절차가 검토됩니다.`,
  `일반적으로는 피해 사실 확인, 금융회사 신고, 수사기관 접수, 송금내역 제출, 계좌 상태 확인, 후속 법적 대응 검토 순서로 진행됩니다.`,
  `사건의 내용에 따라 필요한 절차와 제출 자료가 달라질 수 있으므로 ${TPL_REGION} 지역에서 ${TPL_SUBJECT}를 찾는 경우에도 현재 자료를 시간순으로 정리하는 것이 중요합니다.`,
  `## 피해금 회수를 위해 준비해야 하는 자료`,
  `보이스피싱 사건은 단순히 송금했다는 사실만으로 모든 절차가 자동으로 진행되는 것은 아닙니다. 피해 경위와 상대방의 기망 정황을 객관적으로 설명할 수 있어야 합니다.`,
  `계좌 거래내역 / 송금 영수증 / 문자메시지 / 카카오톡 대화 / 텔레그램 대화 / 통화기록 / 홈페이지 주소 / 투자 또는 거래 화면 / 상대방 계좌번호 / 상대방 연락처`,
  `자료를 수정하거나 삭제하면 사실관계를 설명하는 과정에서 불리해질 수 있으므로 가능한 한 원본 상태로 보관해야 합니다.`,
  `## ${TPL_SUBJECT} 검토가 필요한 이유`,
  `보이스피싱 피해는 금융기관 신고만으로 끝나지 않는 경우가 많습니다. 피해금이 이미 이동했다면 형사고소, 계좌추적, 가압류, 손해배상청구 등 후속 절차를 함께 검토해야 할 수 있습니다.`,
  `${TPL_SUBJECT}는 피해 경위, 송금 구조, 계좌 정보, 상대방과의 대화 내용을 기준으로 ${TPL_ACTION} 가능성과 추가 대응 방향을 정리합니다.`,
  `특히 ${TPL_ACTION} 이후에도 피해금의 이동 여부와 사건 진행 상황에 따라 추가적인 법률 검토가 필요한 사례가 있으므로 초기 대응 방향을 정리하는 것이 중요합니다.`,
  `## 자주 확인되는 보이스피싱 접근 방식`,
  `최근 보이스피싱 조직은 단순 전화뿐 아니라 문자 링크, 원격제어 앱, 메신저 피싱, 기관 사칭, 대환대출 안내, 가상자산 거래소 유도 방식까지 결합해 접근합니다.`,
  `✔ 검찰·경찰·금융감독원 사칭`,
  `✔ 저금리 대환대출 안내`,
  `✔ 안전계좌 이체 요구`,
  `✔ 카드사 또는 은행 문자 사칭`,
  `✔ 원격제어 앱 설치 유도`,
  `✔ 계좌가 범죄에 연루됐다는 압박`,
  `이런 방식은 피해자의 불안감을 이용해 빠른 송금을 유도하므로, 피해가 의심된다면 추가 송금을 멈추고 자료부터 보존해야 합니다.`,
  `## 실제 상담에서 자주 문제 되는 상황`,
  `${TPL_REGION} 보이스피싱 피해 상담에서는 이미 송금이 완료된 뒤 자금이 어디까지 이동했는지 알 수 없어 불안해하는 경우가 많습니다.`,
  `피해금이 계좌에 남아 있다면 ${TPL_ACTION}를 통해 일부라도 보전될 가능성을 검토할 수 있고, 이미 인출된 경우에는 계좌추적과 민사 보전처분 가능성을 함께 살펴봐야 합니다.`,
  `상대방이 추가 송금, 인증비, 보증금, 세금, 수수료를 요구한다면 2차 피해 가능성이 있으므로 더 이상 입금하지 않는 것이 중요합니다.`,
  `## 핵심 정리`,
  `${TPL_TITLE} 페이지에서는 보이스피싱 피해 직후 필요한 자료 보존, ${TPL_ACTION}, 형사고소와 피해금 회수 가능성 검토를 중심으로 안내합니다.`,
  `피해 직후 대응 속도는 결과에 영향을 줄 수 있으므로 송금내역, 대화기록, 상대방 계좌정보, 접속 화면을 먼저 정리해야 합니다.`,
  `사건마다 자금 이동 구조와 피해 경위가 다르므로 ${TPL_SUBJECT} 상담을 통해 현재 상황에 맞는 대응 절차를 확인하는 것이 필요합니다.`,
  `## 자주 묻는 질문 (FAQ)`,
  `### Q1. 보이스피싱 피해 직후 가장 먼저 해야 할 일은 무엇인가요?`,
  `추가 송금을 멈추고 송금내역, 수취 계좌, 대화기록, 통화기록, 화면 캡처를 보존해야 합니다. 그 다음 금융기관에 신고하고 ${TPL_ACTION} 가능성을 확인하는 것이 좋습니다.`,
  `### Q2. 이미 돈이 빠져나갔다면 회수가 불가능한가요?`,
  `반드시 그렇지는 않습니다. 계좌추적, 형사절차, 민사 보전처분, 손해배상청구 등 사건에 따라 검토할 수 있는 절차가 달라집니다.`,
  `### Q3. ${TPL_ACTION}는 언제 신청해야 하나요?`,
  `피해를 인지한 즉시 검토하는 것이 좋습니다. 시간이 지날수록 자금이 이동될 가능성이 커지므로 송금 직후 자료를 정리해 빠르게 확인해야 합니다.`,
  `### Q4. ${TPL_SUBJECT} 상담 전에 준비할 자료는 무엇인가요?`,
  `입금 영수증, 계좌 거래내역, 문자와 메신저 대화, 통화기록, 상대방 계좌번호, 원격제어 앱 설치 내역, 사이트 주소 등을 준비하면 초기 검토가 빨라집니다.`,
  `### Q5. 상대방이 추가 비용을 내면 환불해 준다고 합니다. 응해도 되나요?`,
  `추가 비용, 인증비, 세금, 보증금 명목의 송금 요구는 2차 피해로 이어질 수 있습니다. 추가 입금 전 현재 자료와 상대방 신원을 먼저 확인해야 합니다.`,
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

    const { subject, region, action } = parseTitleParts(title);
    const generatedBody = buildFromTemplate(title, subject, region, action);
    const generatedMeta = generateMeta(subject, region, action);

    if (isPreview) {
      return json({ ok: true, body: generatedBody, subject, bank: subject, region, action, referencePages: REFERENCE_PAGE_URLS });
    }

    // ── 저장 ──────────────────────────────────────────────────────────────
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
      return json({
        ok: false,
        message: "이미 다른 방식으로 생성된 slug입니다. 다른 slug를 입력하세요.",
      }, 409);
    }

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(LA_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, LA_SITE_URL),
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
      category: "보이스피싱 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: ["보이스피싱", "피해구제", "금융사기"],
      landings: { ...(existing?.landings || {}), la: landing },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} voicephishing landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmLaCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "보이스피싱 랜딩이 갱신되었습니다." : "보이스피싱 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(LA_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} voicephishing landing ${slug}`);
    return json({
      ok: true,
      message: existing ? "보이스피싱 랜딩이 갱신되었습니다." : "보이스피싱 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(LA_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

// ── 원고/메타 생성 ────────────────────────────────────────────────────────

function buildFromTemplate(title, subject, region, action) {
  return TEMPLATE_BODY.map((para) => applySubstitutions(para, title, subject, region, action));
}

function applySubstitutions(value, title, subject, region, action) {
  return String(value || "")
    .split(TPL_TITLE).join(title)
    .split(TPL_SUBJECT).join(subject)
    .split(TPL_REGION).join(region || "종로")
    .split(TPL_ACTION).join(action || "지급정지");
}

function generateMeta(subject, region, action) {
  const r = region || "종로";
  const a = action || "지급정지";
  const summary = `${subject} 상담은 보이스피싱 피해 직후 ${a} 가능성, 계좌추적, 형사고소와 피해금 회수 방향을 빠르게 확인하는 과정이 중요합니다. ${r} 지역 피해 대응 절차와 준비자료를 안내합니다.`.slice(0, 180);
  const imageAlt = `${subject} ${a} 보이스피싱 피해 대응`;
  const imageCaption = `${subject}가 안내하는 ${a} 절차와 피해금 회수 대응`;
  const imageDescription = `${subject} 상담을 통해 보이스피싱 피해 직후 필요한 ${a}, 계좌추적, 형사고소 준비자료와 피해금 회수 가능성을 정리한 법률 정보 이미지입니다.`;
  return { summary, imageAlt, imageCaption, imageDescription };
}

// ── 참조 원고 추출 (과거 KV 참조 방식 호환용) ──────────────────────────────

async function findReferenceBody(env, newBank, newRegion, newAction) {
  try {
    const idxRaw = await env.CASES.get("cases:index");
    if (!idxRaw) return null;
    const index = JSON.parse(idxRaw);

    const candidates = index.filter((c) => c.createdBy === CREATED_BY);
    if (!candidates.length) return null;

    // 가장 최근 케이스를 참조로 선택
    const ref = candidates[0];
    const raw = await env.CASES.get(`case:${ref.slug}`);
    if (!raw) return null;

    const caseData = JSON.parse(raw);
    const refBody = caseData?.landings?.la?.body;
    if (!Array.isArray(refBody) || refBody.length < 3) return null;

    const refName = String(ref.caseName || ref.slug || "");
    const refBank   = extractBank(refName);
    const refRegion = extractRegion(refName);
    const refAction = extractAction(refName, refBank);

    // 참조 케이스의 은행·지역·행위를 새 값으로 치환
    return refBody.map((para) => {
      let s = String(para || "");
      if (refBank)   s = replaceAll(s, refBank, newBank);
      if (refRegion && newRegion && refRegion !== newRegion) s = replaceAll(s, refRegion, newRegion);
      if (refAction && newAction && refAction !== newAction) s = replaceAll(s, refAction, newAction);
      return s;
    });
  } catch {
    return null;
  }
}

// ── 제목 파싱 ────────────────────────────────────────────────────────────────

function extractBank(title) {
  return parseTitleParts(title).subject;
}

function extractRegion(title) {
  return parseTitleParts(title).region;
}

function extractAction(title) {
  return parseTitleParts(title).action;
}

function parseTitleParts(title) {
  const s = normalizeSpace(title).replace(/\s*,\s*/g, ", ");
  const compact = s.replace(/\s+/g, "");
  const direct = compact.match(/^(.+?)보이스피싱변호사/);
  let region = direct ? cleanRegion(direct[1]) : "";

  if (!region) {
    const lawyer = s.match(/(?:[,·\-–—]|\s)\s*([가-힣A-Za-z0-9]{1,10})\s*변호사/);
    if (lawyer) region = cleanRegion(lawyer[1]);
  }

  let rest = "";
  const marker = s.match(/보이스피싱\s*변호사|보이스피싱변호사/);
  if (marker) {
    rest = s.slice((marker.index || 0) + marker[0].length);
  } else {
    rest = s;
  }
  rest = rest
    .replace(/^[\s,·\-–—:]+/, "")
    .replace(/\s*[-–—]\s*[가-힣A-Za-z0-9]{1,10}\s*변호사[\s\S]*$/, "")
    .replace(/\s*(어떻게|어떻게 진행해야 할까|진행해야 할까|할까)\??\s*$/g, "")
    .trim();

  let action = rest || "지급정지";
  if (/출금정지\s*신청/.test(rest)) action = "출금정지 신청";
  else if (/계좌\s*지급정지/.test(rest)) action = "계좌 지급정지";
  else if (/지급정지/.test(rest)) action = "지급정지";
  else if (/출금정지/.test(rest)) action = "출금정지";
  else if (/피해구제/.test(rest)) action = "피해구제";

  const subject = region ? `${region}보이스피싱변호사` : "보이스피싱변호사";
  return { subject, region, action };
}

function cleanRegion(value = "") {
  return normalizeSpace(value)
    .replace(/^(?:서울|경기|인천|부산|대구|대전|광주|울산|세종)\s*/g, "")
    .replace(/[^가-힣A-Za-z0-9]/g, "")
    .slice(0, 10);
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function replaceAll(str, from, to) {
  if (!from || from === to) return str;
  return str.split(from).join(to);
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

async function warmLaCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, LA_SITE_URL), { method: "GET" }),
    fetch(buildLandingUrl(LA_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: LA_HOST,
      key,
      keyLocation: `${LA_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(LA_GROUP, slug), `${LA_SITE_URL}/`],
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
