export async function onRequestPost(context) {
  const { env } = context;
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return json({ ok: false, step: "env", message: "TELEGRAM_BOT_TOKEN 환경변수가 설정되지 않았습니다." });
  }

  // Chat ID 읽기
  let chatId = null;
  let chatIdSource = null;
  try {
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    if (owner && repo && token) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/settings.json?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin" } }
      );
      if (res.ok) {
        const file = await res.json();
        const settings = JSON.parse(decodeBase64(file.content));
        if (settings.telegramChatId) {
          chatId = settings.telegramChatId;
          chatIdSource = "settings.json";
        }
      }
    }
  } catch (e) {
    // fall through to env var
  }

  if (!chatId) {
    chatId = env.TELEGRAM_CHAT_ID || null;
    chatIdSource = chatId ? "TELEGRAM_CHAT_ID 환경변수" : null;
  }

  if (!chatId) {
    return json({
      ok: false,
      step: "chat_id",
      message: "Chat ID가 설정되지 않았습니다. 관리자 설정에서 Telegram Chat ID를 저장하거나 TELEGRAM_CHAT_ID 환경변수를 설정하세요.",
    });
  }

  // 실제 전송 테스트
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ 텔레그램 알림 테스트\n\nChat ID: ${chatId}\n출처: ${chatIdSource}\n시각: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
      }),
    });
    const body = await tgRes.json();
    if (tgRes.ok) {
      return json({ ok: true, message: `전송 성공! Chat ID: ${chatId} (${chatIdSource})`, body });
    } else {
      return json({
        ok: false,
        step: "send",
        message: `Telegram API 오류 ${tgRes.status}: ${body.description || JSON.stringify(body)}`,
        chatId,
        chatIdSource,
        body,
      });
    }
  } catch (e) {
    return json({ ok: false, step: "send", message: `전송 중 예외: ${e.message}`, chatId, chatIdSource });
  }
}

function decodeBase64(value) {
  const clean = value.replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
