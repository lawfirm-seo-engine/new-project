export const INSTAGRAM_CONFIG_KEY = "instagram:config:v1";
export const INSTAGRAM_TOKEN_KEY = "instagram:oauth:v1";
export const INSTAGRAM_STATE_PREFIX = "instagram:oauth-state:";
export const INSTAGRAM_GRAPH_VERSION = "v24.0";

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_LONG_TOKEN_URL = "https://graph.instagram.com/access_token";
const INSTAGRAM_REFRESH_TOKEN_URL = "https://graph.instagram.com/refresh_access_token";

export function instagramGraphBase(env = {}) {
  const version = String(env.INSTAGRAM_GRAPH_VERSION || INSTAGRAM_GRAPH_VERSION).replace(/^\/+|\/+$/g, "");
  return `https://graph.instagram.com/${version}`;
}

export function instagramAuthorizeUrl({ appId, redirectUri, state }) {
  const url = new URL(INSTAGRAM_AUTHORIZE_URL);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function loadInstagramConfig(env) {
  assertStorage(env);
  const stored = await env.CASES.get(INSTAGRAM_CONFIG_KEY, "json").catch(() => null);
  if (!stored) return { appId: "", appSecret: "" };
  return {
    appId: String(stored.appId || ""),
    appSecret: stored.appSecretEncrypted
      ? await decryptValue(stored.appSecretEncrypted, env.ADMIN_SESSION_SECRET)
      : "",
    updatedAt: stored.updatedAt || "",
  };
}

export async function saveInstagramConfig(env, { appId, appSecret }) {
  assertStorage(env);
  const current = await loadInstagramConfig(env);
  const nextAppId = String(appId || "").trim();
  const nextSecret = String(appSecret || "").trim() || current.appSecret;
  if (!nextAppId) throw new Error("Instagram 앱 ID를 입력해주세요.");
  if (!nextSecret) throw new Error("Instagram 앱 시크릿 코드를 입력해주세요.");

  const stored = {
    appId: nextAppId,
    appSecretEncrypted: await encryptValue(nextSecret, env.ADMIN_SESSION_SECRET),
    updatedAt: new Date().toISOString(),
  };
  await env.CASES.put(INSTAGRAM_CONFIG_KEY, JSON.stringify(stored));
  return { appId: stored.appId, secretConfigured: true, updatedAt: stored.updatedAt };
}

export async function loadInstagramToken(env) {
  assertStorage(env);
  const stored = await env.CASES.get(INSTAGRAM_TOKEN_KEY, "json").catch(() => null);
  if (!stored?.payload) return null;
  const token = JSON.parse(await decryptValue(stored.payload, env.ADMIN_SESSION_SECRET));
  return { ...token, connectedAt: stored.connectedAt || token.connectedAt || "" };
}

export async function saveInstagramToken(env, token) {
  assertStorage(env);
  const connectedAt = token.connectedAt || new Date().toISOString();
  await env.CASES.put(INSTAGRAM_TOKEN_KEY, JSON.stringify({
    payload: await encryptValue(JSON.stringify({ ...token, connectedAt }), env.ADMIN_SESSION_SECRET),
    connectedAt,
  }));
  return { ...token, connectedAt };
}

export async function exchangeInstagramCode(env, { code, redirectUri }) {
  const config = await loadInstagramConfig(env);
  if (!config.appId || !config.appSecret) throw new Error("Instagram 앱 설정이 필요합니다.");

  const form = new URLSearchParams();
  form.set("client_id", config.appId);
  form.set("client_secret", config.appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", redirectUri);
  form.set("code", code);
  const shortToken = await fetchInstagramJson(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, "Instagram 인증 코드 교환");

  const shortAccessToken = String(shortToken.access_token || "");
  if (!shortAccessToken) throw new Error("Instagram 액세스 토큰을 받지 못했습니다.");
  const longUrl = new URL(INSTAGRAM_LONG_TOKEN_URL);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", config.appSecret);
  longUrl.searchParams.set("access_token", shortAccessToken);
  const longToken = await fetchInstagramJson(longUrl, {}, "Instagram 장기 토큰 교환");
  const accessToken = String(longToken.access_token || shortAccessToken);

  const profile = await loadInstagramProfile(env, accessToken);
  const igUserId = String(profile.user_id || profile.id || shortToken.user_id || "");
  if (!igUserId) throw new Error("Instagram 프로페셔널 계정 ID를 확인하지 못했습니다.");
  return saveInstagramToken(env, {
    accessToken,
    tokenType: longToken.token_type || shortToken.token_type || "bearer",
    expiresAt: expiresAt(longToken.expires_in || shortToken.expires_in),
    igUserId,
    username: String(profile.username || ""),
    accountType: String(profile.account_type || ""),
    connectedAt: new Date().toISOString(),
  });
}

export async function getInstagramAccess(env) {
  let token = await loadInstagramToken(env);
  if (!token?.accessToken || !token?.igUserId) {
    throw new Error("Instagram 권한 연결이 필요합니다. 관리자 설정에서 Instagram 권한 연결을 완료해주세요.");
  }
  if (expiresSoon(token.expiresAt, 7)) token = await refreshInstagramToken(env, token);
  return token;
}

export async function refreshInstagramToken(env, token) {
  const url = new URL(INSTAGRAM_REFRESH_TOKEN_URL);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token.accessToken);
  const refreshed = await fetchInstagramJson(url, {}, "Instagram 토큰 갱신");
  return saveInstagramToken(env, {
    ...token,
    accessToken: refreshed.access_token || token.accessToken,
    tokenType: refreshed.token_type || token.tokenType || "bearer",
    expiresAt: expiresAt(refreshed.expires_in),
    refreshedAt: new Date().toISOString(),
  });
}

export async function instagramApiJson(url, options = {}, label = "Instagram API") {
  return fetchInstagramJson(url, options, label);
}

async function loadInstagramProfile(env, accessToken) {
  const fields = ["user_id,username,name,account_type", "id,username"];
  let lastError;
  for (const value of fields) {
    const url = new URL(`${instagramGraphBase(env)}/me`);
    url.searchParams.set("fields", value);
    url.searchParams.set("access_token", accessToken);
    try { return await fetchInstagramJson(url, {}, "Instagram 계정 확인"); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error("Instagram 계정을 확인하지 못했습니다.");
}

async function fetchInstagramJson(input, options, label) {
  const response = await fetch(input, options);
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* handled below */ }
  if (!response.ok || data.error) {
    const message = data.error?.message || data.error_description || data.error || text.slice(0, 300) || "알 수 없는 오류";
    throw new Error(`${label} 실패 (${response.status}): ${message}`);
  }
  return data;
}

function expiresAt(seconds) {
  const ttl = Math.max(0, Number(seconds || 3600) - 60);
  return new Date(Date.now() + ttl * 1000).toISOString();
}

function expiresSoon(value, days) {
  const timestamp = Date.parse(value || "");
  return !Number.isFinite(timestamp) || timestamp <= Date.now() + days * 86_400_000;
}

async function encryptValue(value, secret) {
  if (!secret) throw new Error("ADMIN_SESSION_SECRET이 필요합니다.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decryptValue(value, secret) {
  if (!secret) throw new Error("ADMIN_SESSION_SECRET이 필요합니다.");
  const [version, ivRaw, cipherRaw] = String(value || "").split(".");
  if (version !== "v1" || !ivRaw || !cipherRaw) throw new Error("Instagram 보안 설정 형식이 올바르지 않습니다.");
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivRaw) },
    key,
    fromBase64(cipherRaw),
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function assertStorage(env) {
  if (!env?.CASES) throw new Error("KV 바인딩이 없습니다.");
}
