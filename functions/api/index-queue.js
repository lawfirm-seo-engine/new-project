// 검색엔진 색인 큐: gnlaw-criminal.co.kr / gnlaw-recovery.co.kr 랜딩페이지를
// 네이버 서치어드바이저(IndexNow, 즉시 서버에서 처리)와 구글 서치콘솔
// (로컬 PC의 Playwright 도구가 처리) 색인 요청 대상으로 등록·추적한다.
//
// 사람이 로그인하는 admin_session 쿠키(6시간 만료)는 예약 스캐너·로컬 도구처럼
// 오래 도는 프로세스에 맞지 않아, 이 엔드포인트는 별도의 장기 토큰
// (Authorization: Bearer <INDEX_QUEUE_TOKEN>)으로 인증한다.

const ITEM_PREFIX = "index-queue:item:";
const INDEX_KEY = "index-queue:index:v1";
const MAX_INDEX_ENTRIES = 5000;
const INDEXNOW_KEY = "6f71f78a3dc940b9a3e1025bf8460d3c";
const NAVER_INDEXNOW = "https://searchadvisor.naver.com/indexnow";

const ALLOWED_HOSTS = new Set(["gnlaw-criminal.co.kr", "gnlaw-recovery.co.kr"]);
const REPORT_STATUSES = new Set(["requested", "indexed", "failed", "quota-exceeded"]);

export async function onRequestGet({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    if (!authorized(request, env)) return json({ ok: false, message: "인증이 필요합니다." }, 401);

    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    if (id) {
      const item = await loadItem(env, id);
      if (!item) return json({ ok: false, message: "항목을 찾을 수 없습니다." }, 404);
      return json({ ok: true, item });
    }

    const status = url.searchParams.get("status") || "";
    const index = await loadIndex(env);
    const filtered = status ? index.filter((entry) => entry.status === status) : index;
    return json({ ok: true, items: filtered, total: index.length });
  } catch (error) {
    return json({ ok: false, message: error?.message || "큐를 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    if (!authorized(request, env)) return json({ ok: false, message: "인증이 필요합니다." }, 401);

    const body = await request.json().catch(() => null);
    const action = String(body?.action || "");

    if (action === "enqueue") return json(await enqueue(env, body));
    if (action === "report") return json(await report(env, body));
    return json({ ok: false, message: "지원하지 않는 action입니다." }, 400);
  } catch (error) {
    return json({ ok: false, message: error?.message || "요청을 처리하지 못했습니다." }, 500);
  }
}

function authorized(request, env) {
  const expected = String(env.INDEX_QUEUE_TOKEN || "");
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return timingSafeEqual(match[1].trim(), expected);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function enqueue(env, body) {
  const rawUrl = String(body?.url || "").trim();
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, message: "URL이 올바르지 않습니다." };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, message: `허용되지 않은 도메인입니다: ${parsed.hostname}` };
  }
  const canonicalUrl = parsed.href;
  const id = await hashId(canonicalUrl);

  const existing = await loadItem(env, id);
  if (existing) return { ok: true, item: existing, created: false };

  const now = new Date().toISOString();
  const naver = await pingNaverIndexNow(parsed.hostname, canonicalUrl).catch((error) => ({
    ok: false,
    message: error?.message || String(error),
  }));

  const item = {
    id,
    url: canonicalUrl,
    host: parsed.hostname,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    checkedAt: body?.checks ? now : "",
    checks: body?.checks || null,
    naverStatus: naver.ok ? "submitted" : "failed",
    naverRespondedAt: now,
    naverMessage: naver.message || "",
    requestedAt: "",
    indexedAt: "",
    message: "",
  };
  await saveItem(env, item);
  return { ok: true, item, created: true };
}

async function report(env, body) {
  const id = String(body?.id || "");
  const status = String(body?.status || "");
  if (!id) return { ok: false, message: "id가 필요합니다." };
  if (!REPORT_STATUSES.has(status)) return { ok: false, message: "status 값이 올바르지 않습니다." };

  const item = await loadItem(env, id);
  if (!item) return { ok: false, message: "항목을 찾을 수 없습니다." };

  const now = new Date().toISOString();
  const next = {
    ...item,
    status,
    updatedAt: now,
    message: String(body?.message || "").slice(0, 500),
    requestedAt: status === "requested" ? now : item.requestedAt,
    indexedAt: status === "indexed" ? now : item.indexedAt,
  };
  await saveItem(env, next);
  return { ok: true, item: next };
}

async function pingNaverIndexNow(host, targetUrl) {
  const siteUrl = `https://${host}`;
  const res = await fetch(NAVER_INDEXNOW, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
      urlList: [targetUrl],
    }),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.status >= 200 && res.status < 300, message: `HTTP ${res.status} ${text.slice(0, 120)}` };
}

async function hashId(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function loadItem(env, id) {
  return env.CASES.get(`${ITEM_PREFIX}${id}`, "json");
}

async function saveItem(env, item) {
  await env.CASES.put(`${ITEM_PREFIX}${item.id}`, JSON.stringify(item));
  await updateIndex(env, item);
  return item;
}

async function loadIndex(env) {
  return (await env.CASES.get(INDEX_KEY, "json").catch(() => null)) || [];
}

async function updateIndex(env, item) {
  const index = await loadIndex(env);
  const entry = { id: item.id, url: item.url, host: item.host, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt };
  const next = [entry, ...index.filter((existing) => existing.id !== item.id)].slice(0, MAX_INDEX_ENTRIES);
  await env.CASES.put(INDEX_KEY, JSON.stringify(next));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
