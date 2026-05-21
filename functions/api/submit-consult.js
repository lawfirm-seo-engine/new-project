export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { name, phone, amount, caseName, domain } = await request.json();

    if (!name || !phone || !amount) {
      return json({ ok: false, message: "필수 항목이 누락되었습니다." }, 400);
    }

    const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const text = [
      "📋 새 상담 접수",
      `사건명: ${caseName || "-"}`,
      `도메인: ${domain || "-"}`,
      `이름: ${name}`,
      `연락처: ${phone}`,
      `피해금액: ${amount}`,
      `접수일시: ${now}`,
    ].join("\n");

    // GitHub에 접수 내용 저장 (Telegram 미설정 시에도 데이터 보존)
    await saveConsultToGithub(env, { name, phone, amount, caseName, domain, createdAt: now });

    // Telegram 알림 (설정된 경우에만)
    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = await resolveChatId(env);

    if (botToken && chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
      } catch { /* 텔레그램 실패해도 접수는 성공 처리 */ }
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

async function saveConsultToGithub(env, consult) {
  try {
    const { repoOwner, repoName, branch, token } = githubEnv(env);
    if (!token || !repoOwner || !repoName) return;

    const filePath = "data/consults.json";
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;

    let existing = [];
    let sha;
    const res = await fetch(apiUrl, { headers: githubHeaders(token) });
    if (res.ok) {
      const file = await res.json();
      sha = file.sha;
      try { existing = JSON.parse(decodeBase64(file.content)); } catch { existing = []; }
    }

    existing.push({ id: Date.now(), ...consult });

    const putBody = {
      message: `Add consult: ${consult.name}`,
      content: encodeBase64(JSON.stringify(existing, null, 2)),
      branch,
    };
    if (sha) putBody.sha = sha;

    await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      { method: "PUT", headers: githubHeaders(token), body: JSON.stringify(putBody) }
    );
  } catch { /* 저장 실패해도 접수는 성공 처리 */ }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function resolveChatId(env) {
  try {
    const { repoOwner, repoName, branch, token } = githubEnv(env);
    if (token && repoOwner && repoName) {
      const res = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/settings.json?ref=${branch}`,
        { headers: githubHeaders(token) }
      );
      if (res.ok) {
        const file = await res.json();
        const settings = JSON.parse(decodeBase64(file.content));
        if (settings.telegramChatId) return settings.telegramChatId;
      }
    }
  } catch { /* fall through */ }
  return env.TELEGRAM_CHAT_ID || null;
}

function githubEnv(env) {
  return {
    repoOwner: env.GITHUB_REPO_OWNER,
    repoName: env.GITHUB_REPO_NAME,
    branch: env.GITHUB_BRANCH || "main",
    token: env.GITHUB_TOKEN,
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
  };
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
