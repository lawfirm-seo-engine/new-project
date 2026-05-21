export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { name, phone, amount, caseName, domain } = await request.json();

    if (!name || !phone || !amount) {
      return json({ ok: false, message: "필수 항목이 누락되었습니다." }, 400);
    }

    const botToken = env.TELEGRAM_BOT_TOKEN;
    const chatId = await resolveChatId(env);

    if (!botToken || !chatId) {
      return json({ ok: false, message: "알림 설정이 완료되지 않았습니다." }, 503);
    }

    const text = [
      "📋 새 상담 접수",
      `사건명: ${caseName || "-"}`,
      `도메인: ${domain || "-"}`,
      `이름: ${name}`,
      `연락처: ${phone}`,
      `피해금액: ${amount}`,
      `접수일시: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    ].join("\n");

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!tgRes.ok) {
      const err = await tgRes.text();
      return json({ ok: false, message: "Telegram 전송 실패", detail: err }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
