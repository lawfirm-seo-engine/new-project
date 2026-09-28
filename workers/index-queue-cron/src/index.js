// 15분마다 gnlaw-criminal.co.kr의 /api/index-queue(action: "scan")를 호출하는
// 얇은 트리거. 실제 스캔 로직(사건 목록 조회, 라이브 점검, 큐 등록, 네이버
// IndexNow 제출)은 전부 그 Pages Function 쪽에서 처리한다 — 여기서는 아무
// 로직도 두지 않는다(candidates 목록을 직접 만들지 않음: KV 접근·사건 필터링
// 규칙이 같은 저장소의 functions/_seo.js에 있고, 이 워커에서 중복 구현하면
// 로직이 흩어져 어긋나기 쉽다).

const DEFAULT_SCAN_ENDPOINT = "https://gnlaw-criminal.co.kr/api/index-queue";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScan(env));
  },
  // workflow_dispatch 없이도 브라우저/curl로 수동 확인할 수 있도록 fetch도 지원.
  async fetch(_request, env) {
    const result = await runScan(env);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  },
};

async function runScan(env) {
  if (!env.INDEX_QUEUE_TOKEN) {
    console.error("[index-queue-cron] INDEX_QUEUE_TOKEN 시크릿이 설정되지 않았습니다.");
    return { ok: false, message: "INDEX_QUEUE_TOKEN missing" };
  }
  const endpoint = env.SCAN_ENDPOINT || DEFAULT_SCAN_ENDPOINT;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.INDEX_QUEUE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "scan" }),
    });
    const text = await res.text();
    console.log(`[index-queue-cron] HTTP ${res.status} ${text.slice(0, 800)}`);
    return { ok: res.ok, status: res.status, body: text.slice(0, 800) };
  } catch (error) {
    console.error(`[index-queue-cron] 요청 실패: ${error?.message || error}`);
    return { ok: false, message: error?.message || String(error) };
  }
}
