import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  INSTAGRAM_CONFIG_KEY,
  instagramAuthorizeUrl,
  loadInstagramConfig,
  saveInstagramConfig,
  saveInstagramToken,
} from "../functions/_instagram.js";
import { buildCaption, onRequestPost as onWorkflowPost } from "../functions/api/cafe-reels-workflow.js";
import { isExactLandingIdentity } from "../functions/api/generate-cafe-draft.js";

function testEnv(initial = []) {
  const stored = new Map(initial);
  return {
    stored,
    env: {
      ADMIN_SESSION_SECRET: "test-admin-secret-at-least-32-characters",
      CASES: {
        async get(key) { return stored.get(key) ?? null; },
        async put(key, value) { stored.set(key, JSON.parse(value)); },
        async delete(key) { stored.delete(key); },
      },
    },
  };
}

test("Instagram app credentials are encrypted in KV and can be loaded", async () => {
  const { env, stored } = testEnv();
  await saveInstagramConfig(env, { appId: "123456789", appSecret: "super-secret-code" });

  const raw = JSON.stringify(stored.get(INSTAGRAM_CONFIG_KEY));
  assert.match(raw, /123456789/);
  assert.doesNotMatch(raw, /super-secret-code/);
  assert.deepEqual(await loadInstagramConfig(env), {
    appId: "123456789",
    appSecret: "super-secret-code",
    updatedAt: stored.get(INSTAGRAM_CONFIG_KEY).updatedAt,
  });
});

test("Instagram authorization URL requests the publishing scopes", () => {
  const url = new URL(instagramAuthorizeUrl({
    appId: "123",
    redirectUri: "https://gnlaw-criminal.co.kr/api/instagram-oauth/callback",
    state: "state-value",
  }));
  assert.equal(url.hostname, "www.instagram.com");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("state"), "state-value");
  assert.match(url.searchParams.get("scope"), /instagram_business_basic/);
  assert.match(url.searchParams.get("scope"), /instagram_business_content_publish/);
});

test("generated whiteboard video starts Instagram publishing automatically", () => {
  const generatorSource = fs.readFileSync(new URL("../admin/whiteboard-local-v2.js", import.meta.url), "utf8");
  const pageSource = fs.readFileSync(new URL("../admin/cafe-reels.html", import.meta.url), "utf8");

  assert.match(generatorSource, /whiteboard:video-ready/);
  assert.match(pageSource, /async function handleGeneratedVideo[\s\S]*await publishInstagramReel\(\)/);
  assert.match(pageSource, /class="bulk-part"/);
  assert.match(pageSource, /class="bulk-type"/);
  assert.match(pageSource, /class="bulk-images"/);
  assert.match(pageSource, /bulkLocalFiles\.set\(saved\.job\.id, item\.files\.slice\(\)\)/);
  assert.match(pageSource, /batchId/);
  assert.match(generatorSource, /window\.setWhiteboardLocalFiles=setLocalFiles/);
  assert.match(generatorSource, /selectedLocalFiles/);
  assert.match(pageSource, /<option value="10" selected>10초<\/option>/);
  assert.match(pageSource, /id="generate" type="button">자동화 실행<\/button>/);
  assert.match(pageSource, /function applyJob[\s\S]*syncVideoTitle\(\)/);
});

test("Cafe landing reuse requires the exact case instead of generic fraud tags", () => {
  const incoming = {
    slug: "keuryuba-peurojegteu-saching",
    caseName: "크류바 프로젝트 사칭 사기",
    tags: ["프로젝트", "사기피해", "피해금회수"],
  };
  const wrongExisting = {
    slug: "eurobitx",
    caseName: "eurobitx 사칭 사기",
    tags: ["사기피해", "피해금회수"],
  };
  assert.equal(isExactLandingIdentity(incoming, wrongExisting), false);
  assert.equal(isExactLandingIdentity(incoming, { ...incoming, title: "다른 부제" }), true);
});

test("caption templates use the case, landing, and reserved Cafe URL", () => {
  const fraud = buildCaption({
    caseName: "스크류바 프로젝트",
    fraudType: "stock-project",
    imageSetKey: "fraud",
    draft: { landingUrl: "https://gnlaw-criminal.co.kr/prosecute/screwbar-litigation/" },
    cafeUrl: "https://cafe.naver.com/gnlawfintech/134",
  });
  assert.match(fraud, /🚨\[사기피해주의\] 스크류바 프로젝트 사칭 사기/);
  assert.match(fraud, /screwbar-litigation/);
  assert.match(fraud, /gnlawfintech\/134/);
  assert.match(fraud, /#스크류바프로젝트사칭사기/);
  assert.match(fraud, /litigation\/\n\n스크류바 프로젝트 사칭 사기/);

  const payment = buildCaption({
    caseName: "하나",
    fraudType: "payment-suspension-release",
    imageSetKey: "payment-suspension-release",
    draft: { landingUrl: "https://gnlaw-recovery.co.kr/success/hana-result/" },
    cafeUrl: "https://cafe.naver.com/gnlawfintech/135",
  });
  assert.match(payment, /하나은행 계좌지급정지해제/);
  assert.match(payment, /gnlawfintech\/135/);
});

test("Naver Cafe number stays at 134 until a SmartEditor post succeeds", async () => {
  const { env } = testEnv([["cafe-reels:jobs:index:v1", []]]);
  const save = async (caseName) => {
    const response = await onWorkflowPost({
      request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-job",
          caseName,
          fraudType: "stock-project",
          imageSetKey: "fraud",
          draft: { title: `${caseName} 원고`, body: "본문", landingUrl: `https://gnlaw-criminal.co.kr/prosecute/${caseName}-litigation/` },
          images: [{ slot: "01", url: "https://images.example/1.jpg" }],
          autoFlow: true,
          batchId: "bulk-test",
        }),
      }),
      env,
    });
    return response.json();
  };
  const first = await save("first");
  const second = await save("second");
  assert.equal(first.job.reservedNaverArticleId, "134");
  assert.equal(first.job.cafeUrl, "https://cafe.naver.com/gnlawfintech/134");
  assert.equal(first.job.videoStatus, "awaiting-images");
  assert.equal(first.job.batchId, "bulk-test");
  assert.equal(second.job.reservedNaverArticleId, "134");

  const postedResponse = await onWorkflowPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report-smarteditor",
        jobId: first.job.id,
        status: "posted",
        cafeUrl: "https://cafe.naver.com/gnlawfintech/134",
      }),
    }),
    env,
  });
  assert.equal(postedResponse.status, 200);
  const third = await save("third");
  assert.equal(third.job.reservedNaverArticleId, "135");
});

test("Instagram Reel automation creates, checks, and publishes a Reel", async () => {
  const jobId = "instagram-reel-job";
  const job = {
    id: jobId,
    caseName: "테스트 사건",
    fraudType: "institution-exchange",
    imageSetKey: "fraud",
    draft: { title: "테스트 릴스", body: "본문" },
    images: [{ slot: "01", url: "https://images.example/1.jpg" }],
    videoUrl: "https://videos.example/reel.mp4",
    caption: "테스트 캡션",
    cafeStatus: "draft-ready",
    instagramStatus: "empty",
  };
  const { env } = testEnv([
    [`cafe-reels:job:${jobId}`, job],
    ["cafe-reels:jobs:index:v1", []],
  ]);
  await saveInstagramToken(env, {
    accessToken: "instagram-access-token",
    igUserId: "17841400000000000",
    username: "gnlaw_test",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname.endsWith("/17841400000000000/media")) {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("media_type"), "REELS");
      assert.equal(form.get("video_url"), "https://videos.example/reel.mp4");
      assert.equal(form.get("share_to_feed"), "true");
      assert.equal(form.get("access_token"), "instagram-access-token");
      return Response.json({ id: "container-123" });
    }
    if (url.pathname.endsWith("/container-123")) {
      return Response.json({ id: "container-123", status_code: "FINISHED", status: "Finished" });
    }
    if (url.pathname.endsWith("/17841400000000000/media_publish")) {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("creation_id"), "container-123");
      return Response.json({ id: "media-456" });
    }
    if (url.pathname.endsWith("/media-456")) {
      return Response.json({ id: "media-456", permalink: "https://www.instagram.com/reel/example/" });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const post = async (payload) => {
    const response = await onWorkflowPost({
      request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      env,
    });
    return { response, result: await response.json() };
  };

  try {
    const started = await post({ action: "start-instagram-reel", jobId, caption: "게시 캡션" });
    assert.equal(started.response.status, 200);
    assert.equal(started.result.job.instagramStatus, "processing");
    assert.equal(started.result.job.instagramContainerId, "container-123");

    const checked = await post({ action: "check-instagram-reel", jobId });
    assert.equal(checked.response.status, 200);
    assert.equal(checked.result.done, true);
    assert.equal(checked.result.job.instagramStatus, "posted");
    assert.equal(checked.result.job.instagramMediaId, "media-456");
    assert.equal(checked.result.job.instagramPermalink, "https://www.instagram.com/reel/example/");
    assert.equal(checked.result.job.cafeStatus, "smarteditor-queued");
    assert.match(checked.result.job.draft.body, /https:\/\/www\.instagram\.com\/reel\/example\//);
    assert.equal(calls.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
