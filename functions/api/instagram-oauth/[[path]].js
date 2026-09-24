import {
  INSTAGRAM_STATE_PREFIX,
  exchangeInstagramCode,
  instagramAuthorizeUrl,
  loadInstagramConfig,
  loadInstagramToken,
  saveInstagramConfig,
} from "../../_instagram.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const route = getRoute(url.pathname);
    if (route === "start") return startOAuth(url, env);
    if (route === "callback") return finishOAuth(url, env);
    if (route === "status") return json(await buildStatus(env));
    return Response.redirect(`${url.origin}/admin/settings.html`, 302);
  } catch (error) {
    return json({ ok: false, message: error?.message || "Instagram 연결 처리에 실패했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const route = getRoute(url.pathname);
    if (route !== "settings") return json({ ok: false, message: "지원하지 않는 작업입니다." }, 400);
    const body = await request.json().catch(() => ({}));
    const saved = await saveInstagramConfig(env, {
      appId: body.appId,
      appSecret: body.appSecret,
    });
    return json({ ok: true, settings: saved, message: "Instagram 앱 설정을 안전하게 저장했습니다." });
  } catch (error) {
    return json({ ok: false, message: error?.message || "Instagram 앱 설정 저장에 실패했습니다." }, 500);
  }
}

async function startOAuth(url, env) {
  const config = await loadInstagramConfig(env);
  if (!config.appId || !config.appSecret) return redirectSettings(url, "missing-app-settings");

  const state = randomState();
  const redirectUri = `${url.origin}/api/instagram-oauth/callback`;
  await env.CASES.put(`${INSTAGRAM_STATE_PREFIX}${state}`, JSON.stringify({
    redirectUri,
    createdAt: new Date().toISOString(),
  }), { expirationTtl: 600 });
  return Response.redirect(instagramAuthorizeUrl({ appId: config.appId, redirectUri, state }), 302);
}

async function finishOAuth(url, env) {
  const error = url.searchParams.get("error") || url.searchParams.get("error_reason");
  if (error) return redirectSettings(url, error);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) return redirectSettings(url, "missing-oauth-code");

  const stateKey = `${INSTAGRAM_STATE_PREFIX}${state}`;
  const savedState = await env.CASES.get(stateKey, "json").catch(() => null);
  if (!savedState?.redirectUri) return redirectSettings(url, "invalid-oauth-state");
  await exchangeInstagramCode(env, { code, redirectUri: savedState.redirectUri });
  await env.CASES.delete(stateKey).catch(() => {});
  return redirectSettings(url, "connected");
}

async function buildStatus(env) {
  const config = await loadInstagramConfig(env);
  const token = await loadInstagramToken(env);
  return {
    ok: true,
    configured: Boolean(config.appId && config.appSecret),
    appId: config.appId || "",
    secretConfigured: Boolean(config.appSecret),
    connected: Boolean(token?.accessToken && token?.igUserId),
    igUserId: token?.igUserId || "",
    username: token?.username || "",
    accountType: token?.accountType || "",
    expiresAt: token?.expiresAt || "",
    connectedAt: token?.connectedAt || "",
  };
}

function redirectSettings(url, result) {
  const target = new URL("/admin/settings.html", url.origin);
  target.searchParams.set("instagram", result);
  return Response.redirect(target.toString(), 302);
}

function getRoute(pathname) {
  return String(pathname || "").replace(/^\/api\/instagram-oauth\/?/, "").split("/")[0] || "";
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
