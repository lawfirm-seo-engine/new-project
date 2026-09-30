import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  INSTAGRAM_CONFIG_KEY,
  instagramAuthorizeUrl,
  isInstagramRateLimitError,
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
  assert.match(pageSource, /await rememberBulkLocalFiles\(jobId, item\.files\)/);
  assert.match(pageSource, /await uploadBulkServerFiles\(jobId, item\.files\)/);
  assert.match(pageSource, /indexedDB\.open\(BULK_FILE_DB_NAME, 1\)/);
  assert.match(pageSource, /await restoreBulkFiles\(nextJob\.id\)/);
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
  assert.match(pageSource, /whiteboard-local-v2\.js\?v=20260929-1/);
  assert.match(pageSource, /BULK_RENDER_MODE_STORAGE_KEY/);
  assert.match(pageSource, /rememberBulkRenderMode\(currentJob\.batchId\)/);
  assert.match(pageSource, /applyBulkRenderMode\(nextJob\.batchId\)/);
  assert.match(generatorSource, /RENDER_MODE_KEY='gnlaw-cafe-reels-render-mode-v1'/);
  assert.match(generatorSource, /window\.getWhiteboardRenderMode=getRenderMode/);
  assert.match(generatorSource, /window\.setWhiteboardRenderMode=setRenderMode/);
  assert.match(pageSource, /id="bulkQueueLoadBtn"/);
  assert.match(pageSource, /id="naverArticleSequence"[^>]*value="199"/);
  assert.match(pageSource, /async function loadRegisteredBulkQueues/);
  assert.match(pageSource, /async function resumeRegisteredBulkQueue/);
  assert.match(pageSource, /async function continueRegisteredBulkBatch/);
  assert.match(pageSource, /\.slice\(0, 3\)/);
  assert.match(pageSource, /let firstSavedFiles = null/);
  assert.match(pageSource, /window\.setWhiteboardLocalFiles\?\.\(firstSavedFiles\)/);
  assert.match(pageSource, /다시 지정한 뒤 자동화 실행을 누르세요/);
  assert.match(pageSource, /자동 복구를 멈췄습니다/);
  assert.match(pageSource, /whiteboard:local-files-selected/);
  assert.match(generatorSource, /whiteboard:local-files-selected/);
  assert.match(pageSource, /params\.set\("batchId", options\.batchId\)/);
  assert.match(workflowSource, /url\.searchParams\.get\("batchId"\)/);
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

test("a registered bulk queue can be loaded in order and resumed from its first incomplete job", async () => {
  const batchId = "bulk-resume-test";
  const first = {
    id: "resume-first",
    batchId,
    batchOrder: 0,
    automationMode: "full",
    caseName: "완료 사건",
    instagramStatus: "posted",
    cafeStatus: "smarteditor-posted",
    smartEditorStatus: "posted",
    videoStatus: "ready",
    reservedNaverArticleId: "153",
  };
  const second = {
    id: "resume-second",
    batchId,
    batchOrder: 1,
    automationMode: "full",
    caseName: "중단 사건",
    instagramStatus: "",
    cafeStatus: "awaiting-reel",
    smartEditorStatus: "",
    videoStatus: "rendering",
    videoUpdatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    articleNumberPending: true,
  };
  const index = [second, first].map((job) => ({
    id: job.id,
    batchId: job.batchId,
    batchOrder: job.batchOrder,
    automationMode: job.automationMode,
    caseName: job.caseName,
    instagramStatus: job.instagramStatus,
    cafeStatus: job.cafeStatus,
    smartEditorStatus: job.smartEditorStatus,
    videoStatus: job.videoStatus,
    updatedAt: new Date().toISOString(),
  }));
  const { env } = testEnv([
    [`cafe-reels:job:${first.id}`, first],
    [`cafe-reels:job:${second.id}`, second],
    ["cafe-reels:jobs:index:v1", index],
    ["cafe-reels:naver-article-sequence:v2", { next: 154 }],
  ]);

  const response = await onWorkflowGet({
    request: new Request(`https://gnlaw-criminal.co.kr/api/cafe-reels-workflow?batchId=${batchId}`),
    env,
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.jobs.map((job) => job.id), [first.id, second.id]);
  assert.equal(result.jobs[0].smartEditorStatus, "posted");
  assert.equal(result.jobs[1].videoStatus, "failed");
  assert.equal(result.jobs[1].reservedNaverArticleId, "154");
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
    caseName: "소수몽키 사칭 사기",
    fraudType: "stock-project",
    imageSetKey: "fraud",
    draft: { landingUrl: "https://gnlaw-criminal.co.kr/prosecute/sosumonkey-litigation/" },
    cafeUrl: "https://cafe.naver.com/gnlawfintech/245",
  });
  assert.match(fraud, /^🚨\[사기피해주의\] 소수몽키 사칭 사기 피해가 의심된다면/);
  assert.match(fraud, /⏳ 소수몽키를 사칭한 사기로 금전을 입금했거나/);
  assert.match(fraud, /📌 소수몽키 사칭 사기 관련 내용\nhttps:\/\/gnlaw-criminal\.co\.kr\/prosecute\/sosumonkey-litigation\//);
  assert.match(fraud, /📌 다른 리딩방 사기 사건 및 대응방법\nhttps:\/\/gnlaw-criminal\.co\.kr\/prosecute\/jusigridingbang-litigation\//);
  assert.match(fraud, /📢 관련 사건 자료\nhttps:\/\/cafe\.naver\.com\/gnlawfintech\/245/);
  assert.match(fraud, /법무법인 선린 금융사기피해센터\n☎ 02-6348-0406/);
  assert.match(fraud, /#소수몽키사칭사기 #소수몽키사기 #리딩방사기 #투자사기/);

  const payment = buildCaption({
    caseName: "신한은행 계좌지급정지 이의신청 불수용",
    fraudType: "payment-suspension-release",
    imageSetKey: "payment-suspension-release",
    draft: { landingUrl: "https://gnlaw-recovery.co.kr/success/shinhan-result/" },
    cafeUrl: "https://cafe.naver.com/gnlawfintech/143",
  });
  assert.match(payment, /^🚨 신한은행 계좌지급정지 이의신청 불수용, 어떻게 대응해야 할까요\?/);
  assert.match(payment, /지금 바로 신한은행 계좌지급정지 이의신청 불수용, 두가지 방법을 상담 드립니다\./);
  assert.match(payment, /📌 신한은행 계좌지급정지해제 자세히 보기\nhttps:\/\/gnlaw-recovery\.co\.kr\/success\/shinhan-result\//);
  assert.match(payment, /📢 계좌지급정지해제 관련 사례\nhttps:\/\/cafe\.naver\.com\/gnlawfintech\/143/);
  assert.match(payment, /#신한은행계좌지급정지해제 #계좌지급정지해제/);
  assert.doesNotMatch(payment, /신한은행 계좌지급정지 이의신청 불수용은행/);
});

test("Instagram publishing quota error codes are classified as retryable limits", () => {
  assert.equal(isInstagramRateLimitError({ instagramCode: 9, instagramSubcode: 2207042 }), true);
  assert.equal(isInstagramRateLimitError({ instagramCode: 80002 }), true);
  assert.equal(isInstagramRateLimitError(new Error("ordinary validation failure")), false);
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
    if (url.pathname.endsWith("/17841400000000000/content_publishing_limit")) {
      return Response.json({ data: [{ quota_usage: 12, config: { quota_total: 50, quota_duration: 86400 } }] });
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
    assert.equal(calls.length, 6);

  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Instagram action limits keep the existing Reel container and defer retries", async () => {
  const jobId = "instagram-rate-limit-job";
  const job = {
    id: jobId,
    caseName: "소수몽키 사칭 사기",
    fraudType: "institution-exchange",
    imageSetKey: "fraud",
    draft: { title: "소수몽키 원고", body: "본문" },
    videoUrl: "https://videos.example/rate-limit.mp4",
    instagramStatus: "processing",
    instagramContainerId: "container-rate-limited",
    cafeStatus: "awaiting-reel",
  };
  const { env } = testEnv([
    [`cafe-reels:job:${jobId}`, job],
    ["cafe-reels:job:instagram-rate-limit-sibling", {
      ...job,
      id: "instagram-rate-limit-sibling",
      caseName: "다음 대기 사건 사칭 사기",
      instagramStatus: "empty",
      instagramContainerId: "",
    }],
    ["cafe-reels:jobs:index:v1", []],
  ]);
  await saveInstagramToken(env, {
    accessToken: "instagram-access-token",
    igUserId: "17841400000000000",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname.endsWith("/container-rate-limited")) {
      return Response.json({ status_code: "FINISHED", status: "Finished" });
    }
    if (url.pathname.endsWith("/17841400000000000/content_publishing_limit")) {
      return Response.json({ data: [{ quota_usage: 12, config: { quota_total: 50, quota_duration: 86400 } }] });
    }
    if (url.pathname.endsWith("/17841400000000000/media_publish")) {
      return Response.json({ error: { message: "User is performing too many actions", code: 4 } }, { status: 400 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const check = async () => {
    const response = await onWorkflowPost({
      request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-instagram-reel", jobId }),
      }),
      env,
    });
    return { response, result: await response.json() };
  };

  try {
    const limited = await check();
    assert.equal(limited.response.status, 200);
    assert.equal(limited.result.ok, true);
    assert.equal(limited.result.done, false);
    assert.equal(limited.result.rateLimited, true);
    assert.equal(limited.result.job.instagramStatus, "rate-limited");
    assert.equal(limited.result.job.instagramContainerId, "container-rate-limited");
    assert.match(limited.result.job.instagramError, /User is performing too many actions/);
    assert.equal(limited.result.job.instagramRateLimitReason, "meta-action-throttle");
    assert.equal(limited.result.job.instagramErrorCode, 4);
    assert.equal(limited.result.job.instagramQuotaUsage, 12);
    assert.equal(limited.result.job.instagramQuotaTotal, 50);
    assert.ok(Date.parse(limited.result.job.instagramRetryAt) > Date.now());
    assert.equal(calls.length, 4);

    const deferred = await check();
    assert.equal(deferred.response.status, 200);
    assert.equal(deferred.result.rateLimited, true);
    assert.ok(deferred.result.retryAfterMs > 0);
    assert.equal(calls.length, 4, "cooldown must prevent another Instagram API call");

    const siblingResponse = await onWorkflowPost({
      request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start-instagram-reel",
          jobId: "instagram-rate-limit-sibling",
          caption: "다음 사건 캡션",
        }),
      }),
      env,
    });
    const sibling = await siblingResponse.json();
    assert.equal(siblingResponse.status, 200);
    assert.equal(sibling.rateLimited, true);
    assert.equal(sibling.job.instagramRateLimitReason, "meta-action-throttle");
    assert.equal(sibling.job.instagramErrorCode, 4);
    assert.equal(sibling.job.instagramContainerId, "");
    assert.equal(calls.length, 4, "an account-wide cooldown must block every other queued job without an API call");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Instagram publishing quota is checked before media_publish and full quota never attempts publishing", async () => {
  const jobId = "instagram-quota-full-job";
  const job = {
    id: jobId,
    caseName: "게시 한도 테스트 사칭 사기",
    imageSetKey: "fraud",
    draft: { title: "게시 한도 테스트", body: "본문" },
    videoUrl: "https://videos.example/quota-full.mp4",
    instagramStatus: "processing",
    instagramContainerId: "container-quota-full",
    cafeStatus: "awaiting-reel",
  };
  const { env } = testEnv([
    [`cafe-reels:job:${jobId}`, job],
    ["cafe-reels:jobs:index:v1", []],
  ]);
  await saveInstagramToken(env, {
    accessToken: "instagram-access-token",
    igUserId: "17841400000000000",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname.endsWith("/container-quota-full")) {
      return Response.json({ status_code: "FINISHED", status: "Finished" });
    }
    if (url.pathname.endsWith("/17841400000000000/content_publishing_limit")) {
      return Response.json({ data: [{ quota_usage: 50, config: { quota_total: 50, quota_duration: 86400 } }] });
    }
    throw new Error(`Publishing must not be attempted while quota is full: ${url}`);
  };

  try {
    const response = await onWorkflowPost({
      request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-instagram-reel", jobId }),
      }),
      env,
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.rateLimited, true);
    assert.equal(result.job.instagramRateLimitReason, "publishing-quota");
    assert.equal(result.job.instagramQuotaUsage, 50);
    assert.equal(result.job.instagramQuotaTotal, 50);
    assert.match(result.message, /게시 사용량 50\/50/);
    assert.deepEqual(calls, [
      "/v24.0/container-quota-full",
      "/v24.0/17841400000000000/content_publishing_limit",
    ]);
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
