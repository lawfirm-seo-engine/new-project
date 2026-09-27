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
import {
  buildCaption,
  instagramStoryLinkDetails,
  onRequestGet as onWorkflowGet,
  onRequestPost as onWorkflowPost,
} from "../functions/api/cafe-reels-workflow.js";
import { buildFraudCafeTitle, isExactLandingIdentity } from "../functions/api/generate-cafe-draft.js";

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
  const workflowSource = fs.readFileSync(new URL("../functions/api/cafe-reels-workflow.js", import.meta.url), "utf8");

  assert.match(generatorSource, /whiteboard:video-ready/);
  assert.match(pageSource, /async function handleGeneratedVideo[\s\S]*await publishInstagramReel\(\)/);
  assert.match(pageSource, /class="bulk-part"/);
  assert.match(pageSource, /class="bulk-type"/);
  assert.match(pageSource, /class="bulk-images"/);
  assert.match(pageSource, /await rememberBulkLocalFiles\(saved\.job\.id, item\.files\)/);
  assert.match(pageSource, /indexedDB\.open\(BULK_FILE_DB_NAME, 1\)/);
  assert.match(pageSource, /await restoreBulkLocalFiles\(nextJob\.id\)/);
  assert.match(pageSource, /batchId/);
  assert.match(pageSource, /async function startNextBulkAutomation/);
  assert.match(pageSource, /async function waitForCafePost/);
  assert.match(pageSource, /completedJob = await waitForCafePost\(completedJob\)/);
  assert.match(pageSource, /deferArticleNumber: completed > 0/);
  assert.match(pageSource, /batchOrder: completed/);
  assert.match(pageSource, /filter\(\(job\) => job\.batchId === completedJob\.batchId\)/);
  assert.match(pageSource, /sort\(\(left, right\) => Number\(left\.batchOrder\) - Number\(right\.batchOrder\)\)/);
  assert.match(pageSource, /generateButton\.click\(\)/);
  assert.match(pageSource, /bulkAutomationRunning = true/);
  assert.match(pageSource, /if \(data\.done\)/);
  assert.match(pageSource, /if \(posted && completedJob\?\.batchId\)/);
  assert.doesNotMatch(pageSource, /continueInstagramStoryInBackground/);
  assert.doesNotMatch(pageSource, /action: "check-instagram-story"/);
  assert.match(pageSource, /action: "report-bulk-transition"/);
  const reelCheckSource = workflowSource.match(/async function checkInstagramReel[\s\S]*?export function instagramStoryLinkDetails/)?.[0] || "";
  assert.match(reelCheckSource, /done: true/);
  assert.doesNotMatch(reelCheckSource, /continueInstagramStory/);
  assert.match(generatorSource, /window\.setWhiteboardLocalFiles=setLocalFiles/);
  assert.match(generatorSource, /selectedLocalFiles/);
  assert.match(pageSource, /<option value="10" selected>10초<\/option>/);
  assert.match(pageSource, /id="generate" type="button">자동화 실행<\/button>/);
  assert.match(pageSource, /function applyJob[\s\S]*syncVideoTitle\(\)/);
  assert.match(pageSource, /whiteboard-local-v2\.js\?v=20260927-4/);
  assert.match(generatorSource, /const duration=Number\(\$\('#duration'\)\.value\)\|\|10/);
  assert.match(generatorSource, /performance\.now\(\)-startedAt/);
  assert.doesNotMatch(generatorSource, /for\(let f=0;f<total;f\+\+\)/);
  assert.match(generatorSource, /function withTimeout/);
  assert.match(generatorSource, /영상 인코더 종료 시간이 초과되었습니다/);
  assert.match(generatorSource, /\?\[720,1280\]/);
  assert.match(generatorSource, /fps=24/);
  assert.match(generatorSource, /videoBitsPerSecond:2500000/);
  assert.match(generatorSource, /rec\.requestData\(\)/);
  assert.match(generatorSource, /stream\.getTracks\(\)\.forEach/);
  assert.doesNotMatch(generatorSource, /a\.click\(\)/);
});

test("stale browser video rendering is recovered as a retryable failure", async () => {
  const jobId = "stale-render-job";
  const staleJob = {
    id: jobId,
    caseName: "멈춘 사건",
    fraudType: "stock-project",
    imageSetKey: "fraud",
    draft: { title: "멈춘 사건 원고", body: "본문" },
    cafeStatus: "awaiting-reel",
    videoStatus: "rendering",
    videoUpdatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  };
  const { env } = testEnv([
    [`cafe-reels:job:${jobId}`, staleJob],
    ["cafe-reels:jobs:index:v1", []],
  ]);
  const response = await onWorkflowGet({
    request: new Request(`https://gnlaw-criminal.co.kr/api/cafe-reels-workflow?jobId=${jobId}`),
    env,
  });
  const result = await response.json();
  assert.equal(result.job.videoStatus, "failed");
  assert.match(result.job.videoError, /영상 생성이 중단/);
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

test("Cafe fraud titles use the requested recovery-focused wording", () => {
  assert.equal(
    buildFraudCafeTitle("테스트 프로젝트"),
    "테스트 프로젝트 사칭 사기, 출금거부·추가입금 요구 피해 회복 대응",
  );
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

test("Instagram Story metadata uses the part-specific center label and landing URL", () => {
  assert.deepEqual(instagramStoryLinkDetails({
    imageSetKey: "fraud",
    draft: { landingUrl: "https://gnlaw-criminal.co.kr/prosecute/example-litigation/" },
  }), {
    text: "법무법인 선린-금융사기피해 Fintech센터",
    url: "https://gnlaw-criminal.co.kr/prosecute/example-litigation/",
  });
  assert.deepEqual(instagramStoryLinkDetails({
    imageSetKey: "payment-suspension-release",
    draft: { landingUrl: "https://gnlaw-recovery.co.kr/success/example-result/" },
  }), {
    text: "법무법인 선린 계좌 지급정지 대응센터",
    url: "https://gnlaw-recovery.co.kr/success/example-result/",
  });
});

test("bulk jobs receive Cafe numbers one-by-one only after the previous SmartEditor post succeeds", async () => {
  const { env } = testEnv([
    ["cafe-reels:jobs:index:v1", []],
    ["cafe-reels:naver-article-sequence:v2", { next: 148 }],
  ]);
  const resetSequence = await onWorkflowPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-naver-article-sequence", nextArticleId: 147 }),
    }),
    env,
  });
  assert.equal(resetSequence.status, 200);
  const save = async (caseName, batchOrder) => {
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
          batchOrder,
          deferArticleNumber: batchOrder > 0,
        }),
      }),
      env,
    });
    return response.json();
  };
  const first = await save("first", 0);
  const second = await save("second", 1);
  const third = await save("third", 2);
  assert.equal(first.job.reservedNaverArticleId, "147");
  assert.equal(first.job.cafeUrl, "https://cafe.naver.com/gnlawfintech/147");
  assert.equal(first.job.videoStatus, "awaiting-images");
  assert.equal(first.job.batchId, "bulk-test");
  assert.equal(second.job.reservedNaverArticleId, "");
  assert.equal(second.job.articleNumberPending, true);
  assert.doesNotMatch(second.job.caption, /gnlawfintech\/147/);
  assert.equal(third.job.reservedNaverArticleId, "");

  const beforeFirstPosted = await onWorkflowGet({
    request: new Request(`https://gnlaw-criminal.co.kr/api/cafe-reels-workflow?jobId=${second.job.id}`),
    env,
  });
  const waitingSecond = await beforeFirstPosted.json();
  assert.equal(waitingSecond.job.reservedNaverArticleId, "");

  const postedResponse = await onWorkflowPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report-smarteditor",
        jobId: first.job.id,
        status: "posted",
        cafeUrl: "https://cafe.naver.com/gnlawfintech/147",
      }),
    }),
    env,
  });
  assert.equal(postedResponse.status, 200);
  const secondReadyResponse = await onWorkflowGet({
    request: new Request(`https://gnlaw-criminal.co.kr/api/cafe-reels-workflow?jobId=${second.job.id}`),
    env,
  });
  const secondReady = await secondReadyResponse.json();
  assert.equal(secondReady.job.reservedNaverArticleId, "148");
  assert.equal(secondReady.job.articleNumberPending, false);
  assert.match(secondReady.job.caption, /gnlawfintech\/148/);

  const thirdStillWaitingResponse = await onWorkflowGet({
    request: new Request(`https://gnlaw-criminal.co.kr/api/cafe-reels-workflow?jobId=${third.job.id}`),
    env,
  });
  const thirdStillWaiting = await thirdStillWaitingResponse.json();
  assert.equal(thirdStillWaiting.job.reservedNaverArticleId, "");
});

test("Instagram Reel automation creates, checks, and publishes a Reel", async () => {
  const jobId = "instagram-reel-job";
  const job = {
    id: jobId,
    caseName: "테스트 사건",
    fraudType: "institution-exchange",
    imageSetKey: "fraud",
    draft: {
      title: "테스트 릴스",
      body: "본문",
      landingUrl: "https://gnlaw-criminal.co.kr/prosecute/test-litigation/",
    },
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
      assert.equal(form.get("video_url"), "https://videos.example/reel.mp4");
      assert.equal(form.get("access_token"), "instagram-access-token");
      if (form.get("media_type") === "REELS") {
        assert.equal(form.get("share_to_feed"), "true");
        return Response.json({ id: "container-123" });
      }
      assert.equal(form.get("media_type"), "STORIES");
      assert.equal(form.has("caption"), false);
      assert.equal(form.has("link"), false);
      assert.equal(form.has("link_sticker"), false);
      return Response.json({ id: "story-container-789" });
    }
    if (url.pathname.endsWith("/container-123")) {
      return Response.json({ id: "container-123", status_code: "FINISHED", status: "Finished" });
    }
    if (url.pathname.endsWith("/story-container-789")) {
      return Response.json({ id: "story-container-789", status_code: "FINISHED", status: "Finished" });
    }
    if (url.pathname.endsWith("/17841400000000000/media_publish")) {
      const form = new URLSearchParams(init.body);
      if (form.get("creation_id") === "container-123") return Response.json({ id: "media-456" });
      assert.equal(form.get("creation_id"), "story-container-789");
      return Response.json({ id: "story-media-987" });
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
    assert.notEqual(checked.result.job.instagramStoryStatus, "processing");
    assert.equal(checked.result.job.cafeStatus, "smarteditor-queued");
    assert.equal(checked.result.job.draft.body, "본문");
    assert.equal(calls.length, 4);

  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Instagram Story automation is disabled and cannot block Reel or Cafe processing", async () => {
  const jobId = "instagram-story-disabled-job";
  const job = {
    id: jobId,
    caseName: "연속 자동화 테스트 사건",
    fraudType: "institution-exchange",
    imageSetKey: "fraud",
    draft: {
      title: "연속 자동화 테스트",
      body: "본문",
      landingUrl: "https://gnlaw-criminal.co.kr/prosecute/test-litigation/",
    },
    images: [{ slot: "01", url: "https://images.example/1.jpg" }],
    videoUrl: "https://videos.example/reel.mp4",
    cafeStatus: "smarteditor-queued",
    instagramStatus: "posted",
    instagramMediaId: "reel-media-already-posted",
    instagramPermalink: "https://www.instagram.com/reel/already-posted/",
    instagramStoryStatus: "empty",
  };
  const { env } = testEnv([
    [`cafe-reels:job:${jobId}`, job],
    ["cafe-reels:jobs:index:v1", []],
  ]);
  const response = await onWorkflowPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check-instagram-story", jobId }),
    }),
    env,
  });
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.equal(result.ok, false);
  const unchanged = await env.CASES.get(`cafe-reels:job:${jobId}`, "json");
  assert.equal(unchanged.instagramStatus, "posted");
  assert.equal(unchanged.instagramStoryStatus, "empty");
  assert.equal(unchanged.cafeStatus, "smarteditor-queued");
});
