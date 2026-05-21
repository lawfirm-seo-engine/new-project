const ADMIN_IDS = {
  phytomer: "ADMIN_HASH_PHYTOMER",
  sunthelaw: "ADMIN_HASH_SUNTHELAW",
  noleosi: "ADMIN_HASH_NOLEOSI",
  cantury77: "ADMIN_HASH_CANTURY77",
  newadmin: "ADMIN_HASH_NEWADMIN"
};

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname === "/admin/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (
    url.pathname === "/admin/login.html" ||
    url.pathname === "/admin/login" ||
    url.pathname.startsWith("/assets/")
  ) {
    if (url.pathname === "/admin/login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    return next();
  }
  
  if (url.pathname === "/admin/logout") {
    return handleLogout(url);
  }

  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api/create-case") ||
    url.pathname.startsWith("/api/generate-draft") ||
    url.pathname.startsWith("/api/get-cases") ||
    url.pathname.startsWith("/api/update-case") ||
    url.pathname.startsWith("/api/admin-settings") ||
    url.pathname.startsWith("/api/delete-case") ||
    url.pathname.startsWith("/api/telegram-test")
  ) {

    const ok = await verifySession(request, env);

    if (!ok) {
      if (url.pathname.startsWith("/api/")) {
        return json({ ok: false, message: "로그인이 필요합니다." }, 401);
      }

      return Response.redirect(`${url.origin}/admin/login.html`, 302);
    }
  }

  return next();
}

async function handleLogin(request, env) {
  const { id, pw } = await request.json();

  if (!id || !pw || !ADMIN_IDS[id]) {
    return json({ ok: false, message: "로그인 정보가 올바르지 않습니다." }, 401);
  }

  const inputHash = await sha256(pw);
  const savedHash = env[ADMIN_IDS[id]];

  if (inputHash !== savedHash) {
    return json({ ok: false, message: "로그인 정보가 올바르지 않습니다." }, 401);
  }

  const expires = Date.now() + 1000 * 60 * 60 * 6;
  const payload = `${id}.${expires}`;
  const sig = await hmac(payload, env.ADMIN_SESSION_SECRET);
  const token = `${payload}.${sig}`;

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=21600`
    }
  });
}

function handleLogout(url) {
  return new Response(null, {
    status: 302,
    headers: {
      "Location": `${url.origin}/admin/login.html`,
      "Set-Cookie": "admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    }
  });
}

async function verifySession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/admin_session=([^;]+)/);

  if (!match) return false;

  const parts = match[1].split(".");
  if (parts.length !== 3) return false;

  const [id, expires, sig] = parts;

  if (!ADMIN_IDS[id]) return false;
  if (Date.now() > Number(expires)) return false;

  const payload = `${id}.${expires}`;
  const expected = await hmac(payload, env.ADMIN_SESSION_SECRET);

  return timingSafeEqual(sig, expected);
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(text, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));

  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
