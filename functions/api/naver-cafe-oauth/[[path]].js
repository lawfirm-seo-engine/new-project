const TOKEN_KEY = "naver-cafe:oauth:v1";
const STATE_PREFIX = "naver-cafe:oauth-state:";
const NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize";
const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const route = getRoute(url.pathname);

    if (route === "start") return startOAuth(url, env);
    if (route === "callback") return finishOAuth(url, env);
    if (route === "status") return json(await buildStatus(env));

    return Response.redirect(`${url.origin}/admin/settings.html`, 302);
  } catch (error) {
    return json({ ok: false, message: error?.message || "네이버 연결 처리에 실패했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    if (getRoute(url.pathname) !== "status") return json({ ok: false, message: "지원하지 않는 작업입니다." }, 400);
    return json(await buildStatus(env));
  } catch (error) {
    return json({ ok: false, message: error?.message || "네이버 연결 상태 확인에 실패했습니다." }, 500);
  }
}

async function startOAuth(url, env) {
  assertKv(env);
  const clientId = env.NAVER_CLIENT_ID;
  const clientSecret = env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirectSettings(url, "missing-naver-env");

  const state = randomState();
  const redirectUri = `${url.origin}/api/naver-cafe-oauth/callback`;
  await env.CASES.put(`${STATE_PREFIX}${state}`, JSON.stringify({ redirectUri, createdAt: new Date().toISOString() }), {
    expirationTtl: 600,
  });

  const next = new URL(NAVER_AUTHORIZE_URL);
  next.searchParams.set("response_type", "code");
  next.searchParams.set("client_id", clientId);
  next.searchParams.set("redirect_uri", redirectUri);
  next.searchParams.set("state", state);
  return Response.redirect(next.toString(), 302);
}

async function finishOAuth(url, env) {
  assertKv(env);
  const error = url.searchParams.get("error");
  if (error) return redirectSettings(url, error);

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) return redirectSettings(url, "missing-oauth-code");

  const stateKey = `${STATE_PREFIX}${state}`;
  const savedState = await env.CASES.get(stateKey, "json").catch(() => null);
  if (!savedState) return redirectSettings(url, "invalid-oauth-state");

  const token = await requestNaverToken({
    grantType: "authorization_code",
    clientId: env.NAVER_CLIENT_ID,
    clientSecret: env.NAVER_CLIENT_SECRET,
    code,
    state,
  });

  await env.CASES.put(TOKEN_KEY, JSON.stringify({
    accessToken: token.access_token || "",
    refreshToken: token.refresh_token || "",
    tokenType: token.token_type || "bearer",
    expiresAt: expiresAt(token.expires_in),
    connectedAt: new Date().toISOString(),
  }));
  await env.CASES.delete(stateKey);

  return redirectSettings(url, "connected");
}

async function buildStatus(env) {
  assertKv(env);
  const token = await env.CASES.get(TOKEN_KEY, "json").catch(() => null);
  return {
    ok: true,
    envReady: Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET),
    connected: Boolean(token?.accessToken || token?.refreshToken),
    expiresAt: token?.expiresAt || "",
    connectedAt: token?.connectedAt || "",
  };
}

async function requestNaverToken({ grantType, clientId, clientSecret, code = "", state = "", refreshToken = "" }) {
  const params = new URLSearchParams();
  params.set("grant_type", grantType);
  params.set("client_id", clientId || "");
  params.set("client_secret", clientSecret || "");
  if (code) params.set("code", code);
  if (state) params.set("state", state);
  if (refreshToken) params.set("refresh_token", refreshToken);

  const res = await fetch(`${NAVER_TOKEN_URL}?${params.toString()}`);
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `네이버 토큰 요청 실패 (${res.status})`);
  }
  return data;
}

function expiresAt(seconds) {
  const ttl = Math.max(0, Number(seconds || 0) - 60);
  return new Date(Date.now() + ttl * 1000).toISOString();
}

function redirectSettings(url, result) {
  const target = new URL("/admin/settings.html", url.origin);
  target.searchParams.set("naver", result);
  return Response.redirect(target.toString(), 302);
}

function getRoute(pathname) {
  return String(pathname || "").replace(/^\/api\/naver-cafe-oauth\/?/, "").split("/")[0] || "";
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertKv(env) {
  if (!env?.CASES) throw new Error("KV 바인딩이 없습니다.");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
