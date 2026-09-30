import {
  getInstagramAccess,
  instagramApiJson,
  instagramGraphBase,
  isInstagramRateLimitError,
} from "../_instagram.js";

const JOB_PREFIX = "cafe-reels:job:";
const INDEX_KEY = "cafe-reels:jobs:index:v1";
const SETTINGS_PATH = "data/settings.json";
const NAVER_TOKEN_KEY = "naver-cafe:oauth:v1";
const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const ASSET_CONFIG_KEY = "cafe-reels:asset-sets:v1";
const NAVER_ARTICLE_SEQUENCE_KEY = "cafe-reels:naver-article-sequence:v2";
const SMARTEDITOR_RUNNER_KEY = "cafe-reels:smarteditor-runner:v1";
const NAVER_ARTICLE_START = 147;
const NAVER_CAFE_SLUG = "gnlawfintech";
const NAVER_CAFE_MAX_IMAGES = 100;
const NAVER_CAFE_PHONE_HREF = "https://gnlaw-criminal.co.kr/call_redirect/";
const NAVER_CAFE_KAKAO_HREF = "https://gnlaw-criminal.co.kr/kakao_redirect/";
const VIDEO_RENDER_STALE_MS = 3 * 60 * 1000;
const SMARTEDITOR_RUNNER_STALE_MS = 2 * 60 * 1000;
const INSTAGRAM_RATE_LIMIT_DELAYS_MS = [60, 180, 360, 720].map((minutes) => minutes * 60 * 1000);
const INSTAGRAM_QUOTA_RECHECK_MS = 30 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    const url = new URL(request.url);
    const jobId = safeId(url.searchParams.get("jobId") || "");
    const batchId = safeId(url.searchParams.get("batchId") || "");
    if (jobId) {
      let job = await loadJob(env, jobId);
      if (!job) return json({ ok: false, message: "작업을 찾을 수 없습니다." }, 404);
      job = await recoverStaleVideoRender(env, job);
      job = await refreshPendingArticleNumber(env, job);
      return json({ ok: true, job });
    }
    if (batchId) {
      const index = await loadIndex(env);
      const summaries = index
        .filter((item) => item.batchId === batchId)
        .sort((left, right) => batchOrderValue(left.batchOrder) - batchOrderValue(right.batchOrder));
      const jobs = [];
      for (const summary of summaries) {
        let job = await loadJob(env, summary.id);
        if (!job) continue;
        job = await recoverStaleVideoRender(env, job);
        job = await refreshPendingArticleNumber(env, job);
        jobs.push(job);
      }
      return json({ ok: true, batchId, jobs });
    }
    return json({ ok: true, jobs: await loadIndex(env) });
  } catch (error) {
    return json({ ok: false, message: error?.message || "작업을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "save-job");

    if (action === "smarteditor-runner-heartbeat") {
      const state = await heartbeatSmartEditorRunner(env, body);
      return json({ ok: true, ...state });
    }

    if (action === "smarteditor-runner-release") {
      const state = await releaseSmartEditorRunner(env, body);
      return json({ ok: true, ...state });
    }

    if (action === "save-job") {
      const built = buildJob(body);
      const previous = body?.jobId ? await loadJob(env, built.id) : null;
      const autoFlow = Boolean(body?.autoFlow);
      const deferArticleNumber = autoFlow && Boolean(body?.deferArticleNumber) && previous?.smartEditorStatus !== "posted";
      const reservedNaverArticleId = normalizeText(
        deferArticleNumber
          ? ""
          : previous?.smartEditorStatus === "posted"
          ? previous.reservedNaverArticleId
          : await currentNaverArticleId(env),
      );
      const expectedCafeUrl = reservedNaverArticleId
        ? `https://cafe.naver.com/${NAVER_CAFE_SLUG}/${reservedNaverArticleId}`
        : "";
      const prepared = {
        ...built,
        createdAt: previous?.createdAt || built.createdAt,
        batchId: built.batchId || previous?.batchId || "",
        batchOrder: batchOrderValue(body?.batchOrder) ?? batchOrderValue(previous?.batchOrder),
        reservedNaverArticleId,
        expectedCafeUrl,
        cafeUrl: deferArticleNumber ? "" : (built.cafeUrl || previous?.cafeUrl || expectedCafeUrl),
        articleNumberPending: deferArticleNumber,
        cafeStatus: autoFlow ? "awaiting-reel" : (previous?.cafeStatus || built.cafeStatus),
        videoStatus: autoFlow ? "awaiting-images" : (previous?.videoStatus || built.videoStatus),
        automationMode: autoFlow ? "full" : (previous?.automationMode || "manual"),
        instagramStatus: previous?.instagramStatus || built.instagramStatus,
        instagramContainerId: previous?.instagramContainerId || "",
        instagramMediaId: previous?.instagramMediaId || "",
        instagramPermalink: previous?.instagramPermalink || "",
        instagramPublishedAt: previous?.instagramPublishedAt || "",
        instagramStoryStatus: previous?.instagramStoryStatus || built.instagramStoryStatus,
        instagramStoryContainerId: previous?.instagramStoryContainerId || "",
        instagramStoryMediaId: previous?.instagramStoryMediaId || "",
        instagramStoryPublishedAt: previous?.instagramStoryPublishedAt || "",
        instagramStoryLinkText: previous?.instagramStoryLinkText || "",
        instagramStoryLinkUrl: previous?.instagramStoryLinkUrl || "",
        naverArticleId: previous?.naverArticleId || "",
        caption: "",
      };
      prepared.caption = buildCaption(prepared);
      const job = await saveJob(env, prepared);
      return json({ ok: true, job, message: "카페 원고·이미지·릴스 작업이 저장되었습니다." });
    }

    if (action === "prepare-cafe") {
      const job = await requireJob(env, body?.jobId);
      const publish = await publishNaverCafe(env, job);
      const next = await saveJob(env, {
        ...job,
        cafeStatus: publish.ok ? "posted" : publish.status,
        images: publish.images?.length ? publish.images : job.images,
        cafeUrl: publish.cafeUrl || job.cafeUrl || "",
        naverArticleId: publish.articleId || job.naverArticleId || "",
        naverContactLinkMode: publish.contactLinkMode || job.naverContactLinkMode || "",
        naverUploadError: publish.ok ? "" : publish.message,
        naverUploadDiagnostics: publish.ok ? null : (publish.diagnostics || null),
        cafePreparedAt: new Date().toISOString(),
        caption: buildCaption({ ...job, cafeUrl: publish.cafeUrl || job.cafeUrl || "" }),
      });
      return json({
        ok: true,
        job: next,
        message: publish.message,
      });
    }

    if (action === "queue-smarteditor") {
      const job = await requireJob(env, body?.jobId);
      const next = await saveJob(env, {
        ...job,
        cafeStatus: "smarteditor-queued",
        smartEditorStatus: "queued",
        smartEditorError: "",
        smartEditorQueuedAt: new Date().toISOString(),
      });
      return json({
        ok: true,
        job: next,
        message: "SmartEditor PC 업로드 대기열에 등록했습니다. 회사 PC에서 로컬 러너를 실행해주세요.",
      });
    }

    if (action === "report-smarteditor") {
      const job = await requireJob(env, body?.jobId);
      const status = normalizeText(body?.status || "");
      const allowed = new Set(["preparing", "posted", "failed"]);
      if (!allowed.has(status)) return json({ ok: false, message: "SmartEditor 상태값이 올바르지 않습니다." }, 400);
      const cafeUrl = normalizeHttpUrl(body?.cafeUrl || job.cafeUrl || "");
      if (status === "posted" && !cafeUrl) {
        return json({ ok: false, message: "게시 완료 상태에는 카페 게시글 URL이 필요합니다." }, 400);
      }
      const next = await saveJob(env, {
        ...job,
        cafeStatus: `smarteditor-${status}`,
        smartEditorStatus: status,
        smartEditorError: status === "failed" ? String(body?.message || "SmartEditor 업로드 실패").slice(0, 1200) : "",
        smartEditorUpdatedAt: new Date().toISOString(),
        cafeUrl,
        naverArticleId: articleIdFromCafeUrl(cafeUrl) || job.naverArticleId || "",
        caption: buildCaption({ ...job, cafeUrl }),
      });
      if (status === "posted") await advanceNaverArticleId(env, next.reservedNaverArticleId);
      return json({ ok: true, job: next, message: "SmartEditor 작업 상태를 저장했습니다." });
    }

    if (action === "report-render") {
      const job = await requireJob(env, body?.jobId);
      const status = normalizeText(body?.status || "");
      const allowed = new Set(["rendering", "failed"]);
      if (!allowed.has(status)) return json({ ok: false, message: "영상 생성 상태값이 올바르지 않습니다." }, 400);
      const next = await saveJob(env, {
        ...job,
        videoStatus: status,
        videoError: status === "failed" ? String(body?.message || "영상 생성 실패").slice(0, 1200) : "",
        videoUpdatedAt: new Date().toISOString(),
      });
      return json({ ok: true, job: next, message: "영상 생성 상태를 저장했습니다." });
    }

    if (action === "report-bulk-transition") {
      const job = await requireJob(env, body?.jobId);
      const next = await saveJob(env, {
        ...job,
        bulkTransitionStatus: normalizeText(body?.status || "unknown").slice(0, 80),
        bulkTransitionMessage: String(body?.message || "").slice(0, 1200),
        bulkTransitionUpdatedAt: new Date().toISOString(),
      });
      return json({ ok: true, job: next, message: "대량 자동화 진행 상태를 저장했습니다." });
    }

    if (action === "set-naver-article-sequence") {
      const nextArticleId = Number(body?.nextArticleId);
      if (!Number.isInteger(nextArticleId) || nextArticleId < NAVER_ARTICLE_START || nextArticleId > 999999999) {
        return json({ ok: false, message: `카페 시작 번호는 ${NAVER_ARTICLE_START} 이상의 정수여야 합니다.` }, 400);
      }
      await env.CASES.put(NAVER_ARTICLE_SEQUENCE_KEY, JSON.stringify({
        next: nextArticleId,
        updatedAt: new Date().toISOString(),
      }));
      return json({ ok: true, nextArticleId: String(nextArticleId), message: `카페 시작 번호를 ${nextArticleId}번으로 설정했습니다.` });
    }

    if (action === "set-cafe-url") {
      const job = await requireJob(env, body?.jobId);
      const cafeUrl = normalizeHttpUrl(body?.cafeUrl);
      if (!cafeUrl) return json({ ok: false, message: "카페 게시글 URL을 입력해주세요." }, 400);
      const next = await saveJob(env, {
        ...job,
        cafeUrl,
        cafeStatus: "posted",
        caption: buildCaption({ ...job, cafeUrl }),
      });
      return json({ ok: true, job: next, message: "카페 게시글 URL이 저장되었습니다." });
    }

    if (action === "set-video") {
      const job = await requireJob(env, body?.jobId);
      const videoUrl = normalizeHttpUrl(body?.videoUrl);
      if (!videoUrl) return json({ ok: false, message: "공개 접근 가능한 영상 URL이 필요합니다." }, 400);
      const next = await saveJob(env, {
        ...job,
        videoUrl,
        videoKey: String(body?.videoKey || job.videoKey || "").slice(0, 300),
        videoStatus: "ready",
        caption: buildCaption({ ...job, videoUrl }),
      });
      return json({ ok: true, job: next, message: "릴스 영상 URL이 저장되었습니다." });
    }

    if (action === "start-instagram-reel") {
      const job = await requireJob(env, body?.jobId);
      const pendingRetry = instagramRetryWait(job);
      if (pendingRetry > 0) return instagramRateLimitResponse(job, pendingRetry);
      try {
        const access = await getInstagramAccess(env);
        const quota = await loadInstagramPublishingLimit(env, access);
        if (instagramPublishingQuotaFull(quota)) {
          const next = await deferInstagramRetry(env, job, null, quota);
          return instagramRateLimitResponse(next, instagramRetryWait(next));
        }
        const next = await startInstagramReel(env, job, body?.caption, access, quota);
        return json({ ok: true, job: next, message: "Instagram이 릴스 영상을 처리하고 있습니다." });
      } catch (error) {
        if (isInstagramRateLimitError(error)) {
          const quota = await tryLoadInstagramPublishingLimit(env);
          const next = await deferInstagramRetry(env, job, error, quota);
          return instagramRateLimitResponse(next, instagramRetryWait(next));
        }
        const next = await saveJob(env, {
          ...job,
          instagramStatus: "failed",
          instagramError: String(error?.message || error).slice(0, 1200),
          instagramUpdatedAt: new Date().toISOString(),
        });
        return json({ ok: false, job: next, message: next.instagramError }, 502);
      }
    }

    if (action === "check-instagram-reel") {
      const job = await requireJob(env, body?.jobId);
      const pendingRetry = instagramRetryWait(job);
      if (pendingRetry > 0) return instagramRateLimitResponse(job, pendingRetry);
      try {
        const result = await checkInstagramReel(env, job);
        return json({
          ok: true,
          job: result.job,
          done: result.done,
          rateLimited: Boolean(result.rateLimited),
          quota: result.quota || null,
          message: result.message,
        });
      } catch (error) {
        if (isInstagramRateLimitError(error)) {
          const quota = await tryLoadInstagramPublishingLimit(env);
          const next = await deferInstagramRetry(env, job, error, quota);
          return instagramRateLimitResponse(next, instagramRetryWait(next));
        }
        const next = await saveJob(env, {
          ...job,
          instagramStatus: "failed",
          instagramError: String(error?.message || error).slice(0, 1200),
          instagramUpdatedAt: new Date().toISOString(),
        });
        return json({ ok: false, job: next, message: next.instagramError }, 502);
      }
    }

    if (action === "check-instagram-publishing-limit") {
      const quota = await loadInstagramPublishingLimit(env);
      return json({
        ok: true,
        quota,
        message: instagramPublishingQuotaMessage(quota),
      });
    }

    if (action === "mark-instagram-ready") {
      const job = await requireJob(env, body?.jobId);
      const caption = normalizeCaption(body?.caption || job.caption || buildCaption(job));
      const next = await saveJob(env, {
        ...job,
        caption,
        instagramStatus: "ready-for-manual-upload",
      });
      return json({
        ok: true,
        job: next,
        message: "릴스 영상 URL과 캡션을 수동 업로드용으로 준비했습니다.",
      });
    }

    return json({ ok: false, message: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    return json({ ok: false, message: error?.message || "작업 처리에 실패했습니다." }, 500);
  }
}

function buildJob(body = {}) {
  const now = new Date().toISOString();
  const id = safeId(body.jobId || crypto.randomUUID());
  const draft = body.draft && typeof body.draft === "object" ? body.draft : {};
  const caseName = normalizeText(body.caseName || draft.caseName || "");
  const fraudType = normalizeText(body.fraudType || draft.fraudType || "");
  if (!caseName) throw new Error("사건명이 필요합니다.");
  if (!draft.title && !body.title) throw new Error("생성된 카페 원고가 필요합니다.");

  const job = {
    id,
    batchId: safeId(body.batchId || ""),
    caseName,
    fraudType,
    imageSetKey: normalizeText(body.imageSetKey || "fraud"),
    draft: {
      ...draft,
      title: normalizeText(body.title || draft.title || ""),
      body: String(body.body || draft.body || "").trim(),
    },
    images: sanitizeImages(body.images),
    cafeStatus: "draft-ready",
    cafeUrl: normalizeHttpUrl(body.cafeUrl),
    videoUrl: normalizeHttpUrl(body.videoUrl),
    videoKey: String(body.videoKey || "").slice(0, 300),
    videoStatus: body.videoUrl ? "ready" : "empty",
    instagramStatus: "empty",
    instagramStoryStatus: "empty",
    createdAt: now,
    updatedAt: now,
  };
  job.caption = buildCaption(job);
  return job;
}

async function requireJob(env, jobId) {
  const id = safeId(jobId || "");
  const job = await loadJob(env, id);
  if (!job) throw new Error("작업을 찾을 수 없습니다.");
  return job;
}

async function loadJob(env, jobId) {
  if (!jobId) return null;
  return env.CASES.get(`${JOB_PREFIX}${jobId}`, "json");
}

async function saveJob(env, job) {
  const next = { ...job, updatedAt: new Date().toISOString() };
  await env.CASES.put(`${JOB_PREFIX}${next.id}`, JSON.stringify(next));
  await updateIndex(env, next);
  return next;
}

async function updateIndex(env, job) {
  const index = await loadIndex(env);
  const item = {
    id: job.id,
    batchId: job.batchId || "",
    batchOrder: batchOrderValue(job.batchOrder),
    automationMode: job.automationMode || "",
    createdAt: job.createdAt || "",
    caseName: job.caseName,
    fraudType: job.fraudType,
    title: job.draft?.title || "",
    cafeStatus: job.cafeStatus || "",
    smartEditorStatus: job.smartEditorStatus || "",
    instagramStatus: job.instagramStatus || "",
    instagramStoryStatus: job.instagramStoryStatus || "",
    videoStatus: job.videoStatus || "",
    reservedNaverArticleId: job.reservedNaverArticleId || "",
    expectedCafeUrl: job.expectedCafeUrl || "",
    updatedAt: job.updatedAt,
  };
  const next = [item, ...index.filter((entry) => entry.id !== job.id)]
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 500);
  await env.CASES.put(INDEX_KEY, JSON.stringify(next));
}

async function loadIndex(env) {
  return (await env.CASES.get(INDEX_KEY, "json").catch(() => null)) || [];
}

async function loadSmartEditorRunner(env) {
  return (await env.CASES.get(SMARTEDITOR_RUNNER_KEY, "json").catch(() => null)) || null;
}

function publicRunnerState(state) {
  if (!state) return null;
  return {
    runnerId: state.runnerId || "",
    runnerName: state.runnerName || "",
    startedAt: state.startedAt || "",
    heartbeatAt: state.heartbeatAt || "",
    takeoverRequestedBy: state.takeoverRequestedBy || "",
    takeoverRequestedName: state.takeoverRequestedName || "",
    takeoverRequestedAt: state.takeoverRequestedAt || "",
  };
}

function isSmartEditorRunnerStale(state, now = Date.now()) {
  if (!state?.heartbeatAt) return true;
  const heartbeatAt = Date.parse(state.heartbeatAt);
  return !Number.isFinite(heartbeatAt) || now - heartbeatAt > SMARTEDITOR_RUNNER_STALE_MS;
}

async function heartbeatSmartEditorRunner(env, body = {}) {
  const runnerId = safeId(body?.runnerId || "");
  if (!runnerId) throw new Error("SmartEditor 실행기 ID가 필요합니다.");
  const runnerName = normalizeText(body?.runnerName || "GNLAW SmartEditor");
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const active = await loadSmartEditorRunner(env);
  const stale = !active || isSmartEditorRunnerStale(active, now);

  if (stale || active.runnerId === runnerId) {
    const sameRunner = active?.runnerId === runnerId;
    const takeoverRequestedBy = sameRunner ? normalizeText(active.takeoverRequestedBy || "") : "";
    const takeoverRequestedName = sameRunner ? normalizeText(active.takeoverRequestedName || "") : "";
    const takeoverRequestedAt = sameRunner ? normalizeText(active.takeoverRequestedAt || "") : "";
    const next = {
      runnerId,
      runnerName,
      startedAt: sameRunner ? (active.startedAt || nowIso) : nowIso,
      heartbeatAt: nowIso,
      phase: normalizeText(body?.phase || ""),
      takeoverRequestedBy,
      takeoverRequestedName,
      takeoverRequestedAt,
    };
    await env.CASES.put(SMARTEDITOR_RUNNER_KEY, JSON.stringify(next));
    return {
      canRun: true,
      shouldStopAfterCurrent: Boolean(takeoverRequestedBy && takeoverRequestedBy !== runnerId),
      activeRunner: publicRunnerState(next),
    };
  }

  const next = {
    ...active,
    takeoverRequestedBy: runnerId,
    takeoverRequestedName: runnerName,
    takeoverRequestedAt: nowIso,
  };
  await env.CASES.put(SMARTEDITOR_RUNNER_KEY, JSON.stringify(next));
  return {
    canRun: false,
    shouldStopAfterCurrent: false,
    activeRunner: publicRunnerState(next),
    message: `${active.runnerName || "다른 PC"}에서 SmartEditor 자동화가 실행 중입니다. 기존 PC가 현재 글을 끝낸 뒤 종료하도록 요청했습니다.`,
  };
}

async function releaseSmartEditorRunner(env, body = {}) {
  const runnerId = safeId(body?.runnerId || "");
  if (!runnerId) throw new Error("SmartEditor 실행기 ID가 필요합니다.");
  const active = await loadSmartEditorRunner(env);
  if (!active || active.runnerId === runnerId || isSmartEditorRunnerStale(active)) {
    await env.CASES.delete(SMARTEDITOR_RUNNER_KEY);
    return { released: true, activeRunner: null };
  }
  return { released: false, activeRunner: publicRunnerState(active) };
}

async function recoverStaleVideoRender(env, job) {
  if (!job || job.videoStatus !== "rendering" || job.videoUrl) return job;
  const startedAt = Date.parse(job.videoUpdatedAt || job.updatedAt || "");
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < VIDEO_RENDER_STALE_MS) return job;
  return saveJob(env, {
    ...job,
    videoStatus: "failed",
    videoError: "영상 생성이 중단되었습니다. 페이지를 새로고침한 뒤 이미지를 다시 선택하고 자동화를 실행해주세요.",
    videoUpdatedAt: new Date().toISOString(),
  });
}

async function currentNaverArticleId(env) {
  const stored = await env.CASES.get(NAVER_ARTICLE_SEQUENCE_KEY, "json").catch(() => null);
  let next = Number(stored?.next || stored || 0);
  if (!Number.isFinite(next) || next < NAVER_ARTICLE_START) next = NAVER_ARTICLE_START;
  return String(next);
}

async function advanceNaverArticleId(env, completedArticleId = "") {
  const current = Number(await currentNaverArticleId(env));
  const completed = Number(completedArticleId || current);
  if (!Number.isFinite(completed) || completed < current) return String(current);
  const next = completed + 1;
  await env.CASES.put(NAVER_ARTICLE_SEQUENCE_KEY, JSON.stringify({
    next,
    updatedAt: new Date().toISOString(),
  }));
  return String(next);
}

async function refreshPendingArticleNumber(env, job) {
  if (!job || job.smartEditorStatus === "posted" || job.cafeStatus === "smarteditor-posted") return job;
  if (await hasIncompleteEarlierBatchJob(env, job)) {
    if (!job.reservedNaverArticleId && !job.cafeUrl && job.articleNumberPending) return job;
    return saveJob(env, {
      ...job,
      reservedNaverArticleId: "",
      expectedCafeUrl: "",
      cafeUrl: "",
      articleNumberPending: true,
      caption: buildCaption({ ...job, reservedNaverArticleId: "", expectedCafeUrl: "", cafeUrl: "" }),
    });
  }
  const reservedNaverArticleId = await currentNaverArticleId(env);
  if (String(job.reservedNaverArticleId || "") === reservedNaverArticleId && !job.articleNumberPending) return job;
  const expectedCafeUrl = `https://cafe.naver.com/${NAVER_CAFE_SLUG}/${reservedNaverArticleId}`;
  return saveJob(env, {
    ...job,
    reservedNaverArticleId,
    expectedCafeUrl,
    cafeUrl: expectedCafeUrl,
    articleNumberPending: false,
    caption: buildCaption({ ...job, reservedNaverArticleId, expectedCafeUrl, cafeUrl: expectedCafeUrl }),
  });
}

async function hasIncompleteEarlierBatchJob(env, job) {
  if (!job?.batchId || job.automationMode !== "full") return false;
  const currentOrder = batchOrderValue(job.batchOrder);
  if (currentOrder === null) return false;
  const index = await loadIndex(env);
  const ids = index.filter((item) => item.batchId === job.batchId).map((item) => item.id);
  const batchJobs = (await Promise.all(ids.map((id) => loadJob(env, id))))
    .filter((item) => item && batchOrderValue(item.batchOrder) !== null)
    .sort((left, right) => batchOrderValue(left.batchOrder) - batchOrderValue(right.batchOrder));
  const position = batchJobs.findIndex((item) => item.id === job.id);
  if (position <= 0) return false;
  return batchJobs.slice(0, position).some((item) => (
    item.smartEditorStatus !== "posted"
    && item.cafeStatus !== "smarteditor-posted"
    && item.cafeStatus !== "posted"
  ));
}

async function startInstagramReel(env, job, requestedCaption = "", providedAccess = null, providedQuota = null) {
  if (job.batchId && job.automationMode === "full" && !normalizeText(job.reservedNaverArticleId || "")) {
    throw new Error("이전 사건의 네이버 카페 게시가 완료된 뒤 현재 사건의 카페 번호가 확정됩니다.");
  }
  const videoUrl = normalizeHttpUrl(job.videoUrl || "");
  if (!videoUrl) throw new Error("먼저 공개 접근 가능한 릴스 영상 URL을 저장해주세요.");
  const caption = normalizeCaption(requestedCaption || job.caption || buildCaption(job));
  const access = providedAccess || await getInstagramAccess(env);
  const endpoint = `${instagramGraphBase(env)}/${encodeURIComponent(access.igUserId)}/media`;
  const form = new URLSearchParams();
  form.set("media_type", "REELS");
  form.set("video_url", videoUrl);
  form.set("caption", caption);
  form.set("share_to_feed", "true");
  form.set("access_token", access.accessToken);
  const data = await instagramApiJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, "Instagram 릴스 컨테이너 생성");
  const containerId = normalizeText(data.id || "");
  if (!containerId) throw new Error("Instagram 릴스 컨테이너 ID를 받지 못했습니다.");
  return saveJob(env, {
    ...job,
    caption,
    instagramStatus: "processing",
    instagramContainerId: containerId,
    instagramMediaId: "",
    instagramPermalink: "",
    instagramError: "",
    instagramRetryAt: "",
    instagramRateLimitCount: 0,
    instagramRateLimitReason: "",
    instagramErrorCode: 0,
    instagramErrorSubcode: 0,
    instagramErrorHttpStatus: 0,
    instagramRetryAfterSeconds: 0,
    ...instagramQuotaFields(providedQuota),
    instagramStartedAt: new Date().toISOString(),
    instagramUpdatedAt: new Date().toISOString(),
  });
}

async function checkInstagramReel(env, job) {
  const containerId = normalizeText(job.instagramContainerId || "");
  if (!containerId) throw new Error("확인할 Instagram 릴스 컨테이너가 없습니다. 자동 업로드를 다시 시작해주세요.");
  if (job.instagramStatus === "posted" && job.instagramMediaId) {
    return { job, done: true, message: "Instagram 릴스 게시가 이미 완료되었습니다." };
  }

  const access = await getInstagramAccess(env);
  const statusUrl = new URL(`${instagramGraphBase(env)}/${encodeURIComponent(containerId)}`);
  statusUrl.searchParams.set("fields", "status_code,status");
  statusUrl.searchParams.set("access_token", access.accessToken);
  const status = await instagramApiJson(statusUrl, {}, "Instagram 릴스 처리 상태 확인");
  const statusCode = String(status.status_code || "").toUpperCase();
  if (["ERROR", "EXPIRED"].includes(statusCode)) {
    throw new Error(`Instagram 영상 처리 실패: ${status.status || statusCode}`);
  }
  if (statusCode !== "FINISHED") {
    const next = await saveJob(env, {
      ...job,
      instagramStatus: "processing",
      instagramProcessingStatus: String(status.status || statusCode || "IN_PROGRESS").slice(0, 500),
      instagramRetryAt: "",
      instagramUpdatedAt: new Date().toISOString(),
    });
    return { job: next, done: false, message: `Instagram 영상 처리 중: ${status.status || statusCode || "IN_PROGRESS"}` };
  }

  const quota = await loadInstagramPublishingLimit(env, access);
  if (instagramPublishingQuotaFull(quota)) {
    const next = await deferInstagramRetry(env, job, null, quota);
    return {
      job: next,
      done: false,
      rateLimited: true,
      quota,
      message: instagramPublishingQuotaMessage(quota),
    };
  }

  const publishUrl = `${instagramGraphBase(env)}/${encodeURIComponent(access.igUserId)}/media_publish`;
  const form = new URLSearchParams();
  form.set("creation_id", containerId);
  form.set("access_token", access.accessToken);
  const published = await instagramApiJson(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, "Instagram 릴스 게시");
  const mediaId = normalizeText(published.id || "");
  if (!mediaId) throw new Error("Instagram 게시물 ID를 받지 못했습니다.");

  let permalink = "";
  try {
    const mediaUrl = new URL(`${instagramGraphBase(env)}/${encodeURIComponent(mediaId)}`);
    mediaUrl.searchParams.set("fields", "permalink");
    mediaUrl.searchParams.set("access_token", access.accessToken);
    const media = await instagramApiJson(mediaUrl, {}, "Instagram 게시물 주소 확인");
    permalink = normalizeHttpUrl(media.permalink || "");
  } catch { /* 게시 성공 자체는 유지 */ }

  const reelJob = await saveJob(env, {
    ...job,
    instagramStatus: "posted",
    instagramMediaId: mediaId,
    instagramPermalink: permalink,
    instagramError: "",
    instagramRetryAt: "",
    instagramRateLimitCount: 0,
    instagramRateLimitReason: "",
    instagramErrorCode: 0,
    instagramErrorSubcode: 0,
    instagramErrorHttpStatus: 0,
    instagramRetryAfterSeconds: 0,
    ...instagramQuotaFields(quota),
    instagramPublishedAt: new Date().toISOString(),
    instagramUpdatedAt: new Date().toISOString(),
    cafeStatus: permalink ? "smarteditor-queued" : "awaiting-instagram-permalink",
    smartEditorStatus: permalink ? "queued" : (job.smartEditorStatus || ""),
    smartEditorQueuedAt: permalink ? new Date().toISOString() : (job.smartEditorQueuedAt || ""),
    draft: {
      ...job.draft,
      body: job.draft?.body || "",
    },
  });
  return {
    job: reelJob,
    done: true,
    message: permalink
      ? `Instagram 릴스 게시 완료 및 SmartEditor 자동 게시 대기 등록: ${permalink}`
      : "Instagram 릴스 게시물 주소를 확인하지 못해 카페 자동 게시 대기 등록을 보류했습니다.",
  };
}

async function deferInstagramRetry(env, job, error = null, quota = null) {
  const count = Math.max(1, Number(job.instagramRateLimitCount || 0) + 1);
  const configuredDelay = INSTAGRAM_RATE_LIMIT_DELAYS_MS[Math.min(count - 1, INSTAGRAM_RATE_LIMIT_DELAYS_MS.length - 1)];
  const headerDelay = Math.max(0, Number(error?.retryAfterSeconds || 0) * 1000);
  const quotaFull = instagramPublishingQuotaFull(quota);
  const delayMs = quotaFull
    ? INSTAGRAM_QUOTA_RECHECK_MS
    : Math.max(configuredDelay, headerDelay);
  const retryAt = new Date(Date.now() + delayMs).toISOString();
  const errorMessage = quotaFull
    ? instagramPublishingQuotaMessage(quota)
    : String(error?.message || error || "Instagram이 계정 행동을 일시적으로 제한했습니다.");
  return saveJob(env, {
    ...job,
    instagramStatus: "rate-limited",
    instagramError: errorMessage.slice(0, 1200),
    instagramRateLimitReason: quotaFull ? "publishing-quota" : "meta-action-throttle",
    instagramErrorCode: Number(error?.instagramCode || 0),
    instagramErrorSubcode: Number(error?.instagramSubcode || 0),
    instagramErrorHttpStatus: Number(error?.httpStatus || 0),
    instagramRetryAfterSeconds: Number(error?.retryAfterSeconds || 0),
    ...instagramQuotaFields(quota),
    instagramRetryAt: retryAt,
    instagramRateLimitCount: count,
    instagramUpdatedAt: new Date().toISOString(),
  });
}

function instagramRetryWait(job) {
  if (job?.instagramStatus !== "rate-limited") return 0;
  const retryAt = Date.parse(job.instagramRetryAt || "");
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : 0;
}

function instagramRateLimitResponse(job, retryAfterMs) {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  const quotaMessage = job.instagramRateLimitReason === "publishing-quota"
    ? `Instagram API 게시 한도 ${Number(job.instagramQuotaUsage || 0)}/${Number(job.instagramQuotaTotal || 0)} 소진`
    : `Meta 행동 제한 응답${job.instagramErrorCode ? ` (코드 ${job.instagramErrorCode}${job.instagramErrorSubcode ? `/${job.instagramErrorSubcode}` : ""})` : ""}`;
  return json({
    ok: true,
    done: false,
    rateLimited: true,
    retryAfterMs,
    retryAt: job.instagramRetryAt || "",
    job,
    message: `${quotaMessage} · 약 ${minutes}분 뒤 상태만 다시 확인하고, 제한이 해제된 경우에만 기존 릴스 작업을 게시합니다.`,
  });
}

async function loadInstagramPublishingLimit(env, providedAccess = null) {
  const access = providedAccess || await getInstagramAccess(env);
  const url = new URL(`${instagramGraphBase(env)}/${encodeURIComponent(access.igUserId)}/content_publishing_limit`);
  url.searchParams.set("fields", "quota_usage,config");
  url.searchParams.set("access_token", access.accessToken);
  const result = await instagramApiJson(url, {}, "Instagram 게시 한도 확인");
  const item = Array.isArray(result?.data) ? (result.data[0] || {}) : (result || {});
  const config = item.config && typeof item.config === "object" ? item.config : {};
  return {
    usage: Math.max(0, Number(item.quota_usage || 0)),
    total: Math.max(0, Number(config.quota_total || 0)),
    durationSeconds: Math.max(0, Number(config.quota_duration || 0)),
    checkedAt: new Date().toISOString(),
  };
}

async function tryLoadInstagramPublishingLimit(env) {
  try { return await loadInstagramPublishingLimit(env); }
  catch { return null; }
}

function instagramPublishingQuotaFull(quota) {
  return Number(quota?.total || 0) > 0 && Number(quota?.usage || 0) >= Number(quota.total);
}

function instagramPublishingQuotaMessage(quota) {
  const usage = Number(quota?.usage || 0);
  const total = Number(quota?.total || 0);
  const hours = Math.max(1, Math.round(Number(quota?.durationSeconds || 86400) / 3600));
  return total > 0
    ? `Instagram API 게시 사용량 ${usage}/${total} · ${hours}시간 이동 한도 기준`
    : "Instagram API 게시 한도 정보를 확인하지 못했습니다.";
}

function instagramQuotaFields(quota) {
  if (!quota) return {};
  return {
    instagramQuotaUsage: Number(quota.usage || 0),
    instagramQuotaTotal: Number(quota.total || 0),
    instagramQuotaDurationSeconds: Number(quota.durationSeconds || 0),
    instagramQuotaCheckedAt: quota.checkedAt || new Date().toISOString(),
  };
}

export function instagramStoryLinkDetails(job = {}) {
  const payment = job.imageSetKey === "payment-suspension-release" || job.fraudType === "payment-suspension-release";
  return {
    text: payment
      ? "법무법인 선린 계좌 지급정지 대응센터"
      : "법무법인 선린-금융사기피해 Fintech센터",
    url: normalizeHttpUrl(job.draft?.landingUrl || job.landingUrl || ""),
  };
}

async function startInstagramStory(env, job, access = null) {
  const videoUrl = normalizeHttpUrl(job.videoUrl || "");
  if (!videoUrl) throw new Error("Instagram 스토리에 게시할 공개 영상 URL이 없습니다.");
  const credentials = access || await getInstagramAccess(env);
  const endpoint = `${instagramGraphBase(env)}/${encodeURIComponent(credentials.igUserId)}/media`;
  const form = new URLSearchParams();
  form.set("media_type", "STORIES");
  form.set("video_url", videoUrl);
  form.set("access_token", credentials.accessToken);
  const data = await instagramApiJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, "Instagram 스토리 컨테이너 생성");
  const containerId = normalizeText(data.id || "");
  if (!containerId) throw new Error("Instagram 스토리 컨테이너 ID를 받지 못했습니다.");
  const link = instagramStoryLinkDetails(job);
  return saveJob(env, {
    ...job,
    instagramStoryStatus: "processing",
    instagramStoryContainerId: containerId,
    instagramStoryMediaId: "",
    instagramStoryError: "",
    instagramStoryLinkText: link.text,
    instagramStoryLinkUrl: link.url,
    instagramStoryStartedAt: new Date().toISOString(),
    instagramStoryUpdatedAt: new Date().toISOString(),
  });
}

async function continueInstagramStory(env, job) {
  if (job.instagramStoryStatus === "posted" && job.instagramStoryMediaId) {
    return { job, done: true, message: "Instagram 릴스와 스토리 게시가 이미 완료되었습니다." };
  }

  const access = await getInstagramAccess(env);
  const containerId = normalizeText(job.instagramStoryContainerId || "");
  if (!containerId || job.instagramStoryStatus === "failed") {
    const next = await startInstagramStory(env, job, access);
    return {
      job: next,
      done: false,
      message: "Instagram 릴스 게시 완료 · 스토리 영상을 처리하고 있습니다.",
    };
  }

  const statusUrl = new URL(`${instagramGraphBase(env)}/${encodeURIComponent(containerId)}`);
  statusUrl.searchParams.set("fields", "status_code,status");
  statusUrl.searchParams.set("access_token", access.accessToken);
  const status = await instagramApiJson(statusUrl, {}, "Instagram 스토리 처리 상태 확인");
  const statusCode = String(status.status_code || "").toUpperCase();
  if (["ERROR", "EXPIRED"].includes(statusCode)) {
    throw new Error(`Instagram 스토리 처리 실패: ${status.status || statusCode}`);
  }
  if (statusCode !== "FINISHED") {
    const next = await saveJob(env, {
      ...job,
      instagramStoryStatus: "processing",
      instagramStoryProcessingStatus: String(status.status || statusCode || "IN_PROGRESS").slice(0, 500),
      instagramStoryUpdatedAt: new Date().toISOString(),
    });
    return { job: next, done: false, message: `Instagram 스토리 처리 중: ${status.status || statusCode || "IN_PROGRESS"}` };
  }

  const publishUrl = `${instagramGraphBase(env)}/${encodeURIComponent(access.igUserId)}/media_publish`;
  const form = new URLSearchParams();
  form.set("creation_id", containerId);
  form.set("access_token", access.accessToken);
  const published = await instagramApiJson(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, "Instagram 스토리 게시");
  const mediaId = normalizeText(published.id || "");
  if (!mediaId) throw new Error("Instagram 스토리 게시물 ID를 받지 못했습니다.");
  const next = await saveJob(env, {
    ...job,
    instagramStoryStatus: "posted",
    instagramStoryMediaId: mediaId,
    instagramStoryError: "",
    instagramStoryPublishedAt: new Date().toISOString(),
    instagramStoryUpdatedAt: new Date().toISOString(),
  });
  return {
    job: next,
    done: true,
    message: `Instagram 릴스·스토리 게시 완료 및 SmartEditor 자동 게시 대기 등록: ${next.instagramPermalink}`,
  };
}

async function publishNaverCafe(env, job) {
  const settings = await loadNaverCafeSettings(env);
  const menuId = resolveNaverCafeMenuId(settings, job);
  const missing = [];
  if (!env?.CASES) missing.push("KV 바인딩");
  if (!env?.NAVER_CLIENT_ID) missing.push("NAVER_CLIENT_ID");
  if (!env?.NAVER_CLIENT_SECRET) missing.push("NAVER_CLIENT_SECRET");
  if (!settings.naverCafeClubId) missing.push("카페 고유 ID(clubid)");
  if (!menuId) missing.push(`${cafeBoardLabel(job)} 게시판 ID(menuid)`);

  if (missing.length) {
    return {
      ok: false,
      status: "connection-required",
      message: `네이버 카페 자동 업로드 설정이 필요합니다. 누락: ${missing.join(", ")}. 관리자 설정에서 카페 ID를 저장하고 Cloudflare 시크릿 및 네이버 권한 연결을 완료해주세요.`,
    };
  }

  const uploadImages = selectNaverUploadImages(await resolveCafeImages(env, job));
  if (!uploadImages.length) {
    return {
      ok: false,
      status: "images-required",
      message: `${cafeBoardLabel(job)} 파트에 등록된 카페 이미지가 없습니다. 이미지 세트를 등록한 뒤 다시 시도해주세요.`,
    };
  }

  const token = await getNaverAccessToken(env);
  if (!token.ok) {
    return {
      ok: false,
      status: "connection-required",
      message: token.message,
    };
  }

  const subject = normalizeArticleSubject(job.draft?.title || job.title || `${job.caseName || "사기 피해"} 대응 안내`);
  let attachments;
  try {
    attachments = await loadCafeImageAttachments(uploadImages);
  } catch (error) {
    return {
      ok: false,
      status: "upload-failed",
      message: `네이버 카페 이미지 준비 실패: ${error?.message || "이미지를 불러오지 못했습니다."}`,
    };
  }

  const endpoint = `https://openapi.naver.com/v1/cafe/${encodeURIComponent(settings.naverCafeClubId)}/menu/${encodeURIComponent(menuId)}/articles`;
  const attempts = [];
  let posted = null;
  for (const contactLinkMode of ["plain-contact-urls"]) {
    const content = buildCafeArticleHtml(job, attachments, { contactLinkMode });
    const multipart = buildNaverCafeMultipart(subject, content, attachments);
    const requestDiagnostics = {
      contactLinkMode,
      imageCount: attachments.length,
      imageBytes: attachments.reduce((sum, attachment) => sum + attachment.bytes.byteLength, 0),
      maxImageWidth: Math.max(...attachments.map((attachment) => attachment.width)),
      maxImageHeight: Math.max(...attachments.map((attachment) => attachment.height)),
      contentCharacters: content.length,
      multipartBytes: multipart.body.byteLength,
      legacyMultipart: true,
      embeddedImageHtml: false,
      imageFieldMode: "repeated",
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": multipart.contentType,
      },
      body: multipart.body,
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (res.ok && !data.error) {
      posted = { data, contactLinkMode };
      break;
    }

    const naverError = extractNaverError(data, text);
    const diagnostics = { ...requestDiagnostics, responseStatus: res.status, naverError };
    attempts.push(diagnostics);
    console.error("[naver-cafe] upload failed", JSON.stringify(diagnostics));
    return {
      ok: false,
      status: res.status === 401 ? "connection-required" : "upload-failed",
      message: `네이버 카페 업로드 실패 (${res.status}): ${naverError}`,
      diagnostics,
    };
  }

  if (!posted) {
    const last = attempts.at(-1) || {};
    return {
      ok: false,
      status: last.responseStatus === 401 ? "connection-required" : "upload-failed",
      message: `네이버 카페 업로드 실패 (${last.responseStatus || "?"}): ${last.naverError || "알 수 없는 오류"}`,
      diagnostics: { attempts },
    };
  }

  const result = posted.data.message?.result || posted.data.result || {};
  const articleId = normalizeText(result.articleid || result.articleId || result.articleNo || result.id || "");
  const cafeUrl = normalizeHttpUrl(result.articleUrl || result.articleurl || result.url || buildCafeArticleUrl(settings, articleId));
  return {
    ok: true,
    status: "posted",
    articleId,
    cafeUrl,
    images: uploadImages,
    imageCount: attachments.length,
    contactLinkMode: posted.contactLinkMode,
    message: cafeUrl
      ? `네이버 카페에 이미지 ${attachments.length}개와 원고를 자동 업로드했습니다. 전화·카카오 브리지 URL을 추가했습니다.\n${cafeUrl}`
      : `네이버 카페에 이미지 ${attachments.length}개와 원고를 자동 업로드했습니다. 전화·카카오 브리지 URL을 추가했습니다. 네이버 응답에 게시글 URL이 없어 글 목록에서 확인해주세요.`,
  };
}

async function loadNaverCafeSettings(env) {
  const { repoOwner, repoName, branch, token } = githubEnv(env);
  const res = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${SETTINGS_PATH}?ref=${branch}`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) return {};
  const file = await res.json();
  try {
    const raw = JSON.parse(decodeBase64(file.content));
    return {
      naverCafeClubId: normalizeText(raw.naverCafeClubId || ""),
      naverCafeMenuId: normalizeText(raw.naverCafeMenuId || ""),
      naverCafeFraudMenuId: normalizeText(raw.naverCafeFraudMenuId || raw.naverCafeMenuId || ""),
      naverCafePaymentSuspensionMenuId: normalizeText(raw.naverCafePaymentSuspensionMenuId || raw.naverCafeMenuId || ""),
      naverCafeSlug: normalizeText(raw.naverCafeSlug || "gnlawfintech") || "gnlawfintech",
    };
  } catch {
    return {};
  }
}

function resolveNaverCafeMenuId(settings = {}, job = {}) {
  if (isPaymentSuspensionJob(job)) {
    return settings.naverCafePaymentSuspensionMenuId || settings.naverCafeMenuId || "";
  }
  return settings.naverCafeFraudMenuId || settings.naverCafeMenuId || "";
}

function cafeBoardLabel(job = {}) {
  return isPaymentSuspensionJob(job) ? "계좌지급정지해제" : "사기피해진행사건정리";
}

function isPaymentSuspensionJob(job = {}) {
  return job.imageSetKey === "payment-suspension-release" || job.fraudType === "payment-suspension-release";
}

async function getNaverAccessToken(env) {
  const token = await env.CASES.get(NAVER_TOKEN_KEY, "json").catch(() => null);
  if (!token?.accessToken && !token?.refreshToken) {
    return {
      ok: false,
      message: "네이버 카페 권한 연결이 필요합니다. 관리자 설정에서 '네이버 권한 연결'을 먼저 완료해주세요.",
    };
  }
  if (token.accessToken && !isExpired(token.expiresAt)) {
    return { ok: true, accessToken: token.accessToken };
  }
  if (!token.refreshToken) {
    return {
      ok: false,
      message: "네이버 토큰이 만료되었고 갱신 토큰이 없습니다. 관리자 설정에서 네이버 권한 연결을 다시 진행해주세요.",
    };
  }
  return refreshNaverAccessToken(env, token);
}

async function refreshNaverAccessToken(env, token) {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("client_id", env.NAVER_CLIENT_ID || "");
  params.set("client_secret", env.NAVER_CLIENT_SECRET || "");
  params.set("refresh_token", token.refreshToken || "");

  const res = await fetchNaverTokenWithRetry(params);
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok || data.error || !data.access_token) {
    return {
      ok: false,
      message: `네이버 토큰 갱신 실패 (${res.status}): ${extractNaverError(data, text)}. 관리자 설정에서 네이버 권한 연결을 다시 진행해주세요.`,
    };
  }

  const next = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken || "",
    tokenType: data.token_type || token.tokenType || "bearer",
    expiresAt: expiresAt(data.expires_in),
    refreshedAt: new Date().toISOString(),
  };
  await env.CASES.put(NAVER_TOKEN_KEY, JSON.stringify(next));
  return { ok: true, accessToken: next.accessToken };
}

async function fetchNaverTokenWithRetry(params) {
  let lastResponse;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await delay(attempt * 350);
    lastResponse = await fetch(NAVER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: params.toString(),
    });
    if (!isRetryableStatus(lastResponse.status)) return lastResponse;
  }
  return lastResponse;
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 524);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveCafeImages(env, job) {
  const sets = await env.CASES.get(ASSET_CONFIG_KEY, "json").catch(() => null);
  const setKey = isPaymentSuspensionJob(job) ? "payment-suspension-release" : "fraud";
  const configured = sanitizeImages(sets?.[setKey]?.slots || []);
  if (configured.length) return orderCafeImages(configured, setKey).map((image) => withCanonicalArticleImage(image, setKey)).map(withFixedContactHref);

  // A saved job contains a snapshot of the image set. Prefer the current set so
  // retries also receive corrected or optimized assets, while keeping the job
  // snapshot as a fallback when no set has been configured yet.
  return orderCafeImages(sanitizeImages(job.images), setKey).map(withFixedContactHref);
}

function orderCafeImages(images, setKey) {
  const sequence = setKey === "payment-suspension-release"
    ? ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "kakao", "phone"]
    : ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "kakao", "phone"];
  const rank = new Map(sequence.map((slot, index) => [slot, index]));
  return [...images].sort((left, right) => {
    const leftRank = rank.get(left.slot) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.slot) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

function withCanonicalArticleImage(image, setKey) {
  const directory = setKey === "payment-suspension-release" ? "payment-suspension-release" : "fraud";
  const numericLimit = directory === "payment-suspension-release" ? 10 : 12;
  const numericSlot = /^\d{2}$/.test(image.slot) && Number(image.slot) >= 1 && Number(image.slot) <= numericLimit;
  const contactSlot = image.slot === "phone" || image.slot === "kakao";
  if (!numericSlot && !contactSlot) return image;
  return { ...image, url: `/assets/cafe-reels/${directory}/${image.slot}.png` };
}

function selectNaverUploadImages(images = []) {
  const normalized = sanitizeImages(images);
  return normalized.slice(0, NAVER_CAFE_MAX_IMAGES);
}

function withFixedContactHref(image) {
  // SmartEditor accepts links around images, but its legacy API rejects
  // non-HTTP schemes in multipart HTML with a generic 999 response. Keep the
  // phone image tappable through a same-origin HTTPS bridge.
  if (image.slot === "phone") return { ...image, href: NAVER_CAFE_PHONE_HREF };
  if (image.slot === "kakao") return { ...image, href: NAVER_CAFE_KAKAO_HREF };
  return { ...image, href: "" };
}

function buildCafeArticleHtml(job, attachments = [], options = {}) {
  const contactLinkMode = options.contactLinkMode || "plain-contact-urls";
  const bodyHtml = bodyToCafeHtml(job.draft?.body || "");
  // This Cafe endpoint currently rejects every <a href> payload with 403/999,
  // including Naver's documented linked-image form. Bare HTTPS URLs are
  // converted to clickable anchors by Cafe after publishing.
  const contactLinks = contactLinkMode === "plain-contact-urls"
    ? [
        `<p>전화 상담 02-6348-0406 ${escapeHtml(NAVER_CAFE_PHONE_HREF)}</p>`,
        `<p>카카오톡 상담 바로가기 ${escapeHtml(NAVER_CAFE_KAKAO_HREF)}</p>`,
      ].join("\n")
    : "";
  return [bodyHtml, contactLinks].filter(Boolean).join("\n");
}

async function loadCafeImageAttachments(images) {
  const attachments = [];
  let totalBytes = 0;

  for (const image of images) {
    const imageUrl = absoluteImageUrl(image.url);
    if (!imageUrl) continue;

    const res = await fetch(imageUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`${image.label || image.slot || "이미지"} 다운로드 실패 (${res.status})`);
    }

    const contentType = normalizeImageContentType(res.headers.get("content-type"), imageUrl);
    if (!contentType) {
      throw new Error(`${image.label || image.slot || "이미지"} 파일 형식을 확인할 수 없습니다.`);
    }

    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength) {
      throw new Error(`${image.label || image.slot || "이미지"} 파일이 비어 있습니다.`);
    }
    if (bytes.byteLength > 15 * 1024 * 1024) {
      throw new Error(`${image.label || image.slot || "이미지"} 파일이 15MB를 초과합니다.`);
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > 80 * 1024 * 1024) {
      throw new Error("첨부 이미지 전체 용량이 80MB를 초과합니다.");
    }
    const dimensions = readImageDimensions(bytes, contentType);
    if (!dimensions) {
      throw new Error(`${image.label || image.slot || "이미지"} 크기를 확인할 수 없습니다.`);
    }

    attachments.push({
      image,
      bytes: new Uint8Array(bytes),
      contentType,
      fileName: cafeImageFileName(image, contentType, attachments.length),
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  return attachments;
}

function buildNaverCafeMultipart(subject, content, attachments = []) {
  const boundary = `----NaverCafeBoundary${crypto.randomUUID().replaceAll("-", "")}`;
  const encoder = new TextEncoder();
  const chunks = [];
  const appendText = (value) => chunks.push(encoder.encode(value));
  const appendField = (name, value) => {
    appendText(`--${boundary}\r\n`);
    appendText(`Content-Disposition: form-data; name="${name}"\r\n`);
    appendText("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
    appendText(`${encodeURIComponent(stripUnsupportedNaverCharacters(value))}\r\n`);
  };

  appendField("subject", subject);
  appendField("content", content);

  for (const attachment of attachments) {
    appendText(`--${boundary}\r\n`);
    appendText(`Content-Disposition: form-data; name="image"; filename="${attachment.fileName}"\r\n`);
    appendText(`Content-Type: ${attachment.contentType}\r\n`);
    appendText("Content-Transfer-Encoding: binary\r\n\r\n");
    chunks.push(attachment.bytes);
    appendText("\r\n");
  }

  appendText(`--${boundary}--\r\n`);
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function stripUnsupportedNaverCharacters(value = "") {
  return String(value).replace(/[\u{10000}-\u{10ffff}]/gu, "");
}

function readImageDimensions(bytes, contentType) {
  const view = new DataView(bytes);
  if (contentType === "image/png" && bytes.byteLength >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (contentType === "image/gif" && bytes.byteLength >= 10) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (contentType === "image/jpeg" && bytes.byteLength >= 4) {
    let offset = 2;
    while (offset + 8 < bytes.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      }
      const length = view.getUint16(offset + 2);
      if (length < 2) return null;
      offset += 2 + length;
    }
  }
  return null;
}

function normalizeImageContentType(value, imageUrl) {
  const declared = String(value || "").split(";", 1)[0].trim().toLowerCase();
  const supported = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  if (supported.has(declared)) return declared;
  const pathname = new URL(imageUrl).pathname.toLowerCase();
  if (/\.jpe?g$/.test(pathname)) return "image/jpeg";
  if (/\.png$/.test(pathname)) return "image/png";
  if (/\.gif$/.test(pathname)) return "image/gif";
  if (/\.webp$/.test(pathname)) return "image/webp";
  return "";
}

function cafeImageFileName(image, contentType, index) {
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  }[contentType] || "jpg";
  const slot = safeId(image?.slot || String(index + 1)) || String(index + 1);
  return `naver-cafe-${slot}.${extension}`;
}

function bodyToCafeHtml(body) {
  return String(body || "").split(/\r?\n/).map((line) => {
    const text = line.trim();
    if (!text) return "<br>";
    if (/^#{1,3}\s+/.test(text)) return `<p><b>${inlineCafeText(text.replace(/^#{1,3}\s+/, ""))}</b></p>`;
    if (/^[-*]\s+/.test(text)) return `<p>• ${inlineCafeText(text.replace(/^[-*]\s+/, ""))}</p>`;
    if (/^\d+\.\s+/.test(text)) return `<p>${inlineCafeText(text)}</p>`;
    return `<p>${inlineCafeText(text)}</p>`;
  }).join("\n");
}

function inlineCafeText(text) {
  const source = String(text || "").replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    "$1 ($2)",
  );
  return escapeHtml(source);
}

function normalizeArticleSubject(value) {
  return normalizeText(value).slice(0, 120) || "법무법인 선린 금융사기 피해 대응 안내";
}

function buildCafeArticleUrl(settings, articleId) {
  if (!articleId) return "";
  const slug = settings.naverCafeSlug || "gnlawfintech";
  return `https://cafe.naver.com/${encodeURIComponent(slug)}/${encodeURIComponent(articleId)}`;
}

function absoluteImageUrl(value = "") {
  const text = String(value || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return new URL(text, "https://gnlaw-criminal.co.kr").toString();
  return "";
}

function isExpired(value) {
  if (!value) return false;
  return new Date(value).getTime() - Date.now() < 120000;
}

function expiresAt(seconds) {
  const ttl = Math.max(0, Number(seconds || 0) - 60);
  return new Date(Date.now() + ttl * 1000).toISOString();
}

function extractNaverError(data, fallback) {
  const candidates = [data?.message?.error, data?.error, data?.error_description, data?.errorMessage];
  for (const candidate of candidates) {
    const message = formatNaverError(candidate);
    if (message) return message;
  }
  return plainErrorText(fallback) || "알 수 없는 오류";
}

function formatNaverError(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  const code = normalizeText(value.code || value.errorCode || value.status || "");
  const message = normalizeText(value.msg || value.message || value.error_description || value.description || "");
  return [code, message].filter(Boolean).join(": ");
}

function plainErrorText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
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

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.slice(0, 30).map((item) => ({
    slot: normalizeText(item?.slot || ""),
    label: normalizeText(item?.label || ""),
    url: normalizeHttpOrRelativeImage(item?.url || ""),
    href: normalizeHref(item?.href || ""),
  })).filter((item) => item.slot && item.url);
}

export function buildCaption(job = {}) {
  const caseName = normalizeText(job.caseName || job.draft?.caseName || "");
  const landingUrl = normalizeHttpUrl(job.draft?.landingUrl || job.landingUrl || "");
  const cafeUrl = normalizeHttpUrl(job.cafeUrl || job.expectedCafeUrl || "");
  const payment = job.imageSetKey === "payment-suspension-release" || job.fraudType === "payment-suspension-release";

  if (payment) {
    const bankName = paymentBankName(caseName);
    const subject = /계좌\s*지급정지/.test(caseName) ? caseName : `${bankName} 계좌지급정지해제`;
    const bankTag = bankName.replace(/[^0-9A-Za-z가-힣]/g, "");
    return normalizeCaption([
      `🚨 ${subject}, 어떻게 대응해야 할까요? 📲 02-6348-0406 지금 바로 ${subject}, 두가지 방법을 상담 드립니다.`,
      "",
      "📌 카카오톡 상담",
      "https://pf.kakao.com/_WkdxfX/chat",
      "",
      "먼저 계좌가 지급정지된 사유와 피해신고 내용을 확인하고, 거래 경위를 입증할 자료와 이의제기 신청서를 준비하는 순서로 대응합니다.",
      "",
      "이의제기만으로 지급정지가 해결되지 않는 경우에는 사실관계에 따라 채무부존재확인소송 등 법적 절차를 진행합니다.",
      "",
      "특히 지급정지 신청자와 피해신고 내용을 정확히 확인하고, 계좌 거래내역·송금 경위·관련 대화내용 등 객관적인 자료를 보존하는 것이 중요합니다.",
      "",
      `📌 ${bankName} 계좌지급정지해제 자세히 보기`,
      landingUrl,
      "",
      "🚨 채무부존재확인소송·계좌지급정지 대응센터",
      "☎ 02-6348-0406",
      "",
      "📢 법무법인 선린 계좌 지급정지 대응센터",
      "https://gnlaw-recovery.co.kr",
      "",
      "📢 계좌지급정지해제 관련 사례",
      cafeUrl || null,
      "",
      `#${bankTag}계좌지급정지해제 #계좌지급정지해제 #계좌지급정지이의신청 #계좌지급정지이의제기 #지급정지해제이의신청불수용 #지급정지해제이의제기불수용 #채무부존재확인소송 #법무법인선린`,
    ].filter((line) => line !== null).join("\n"));
  }

  const subject = /사칭\s*사기/.test(caseName) ? caseName : `${caseName} 사칭 사기`;
  const impersonatedName = subject.replace(/\s*사칭\s*사기.*$/, "").trim() || caseName;
  const objectParticle = koreanObjectParticle(impersonatedName);
  const compactTag = subject.replace(/[^0-9A-Za-z가-힣]/g, "");
  const impersonatedTag = impersonatedName.replace(/[^0-9A-Za-z가-힣]/g, "");
  return normalizeCaption([
    `🚨[사기피해주의] ${subject} 피해가 의심된다면 📲 02-6348-0406 지금 바로 상담으로 피해 회복 가능 여부를 확인해야 합니다.`,
    "",
    `⏳ ${impersonatedName}${objectParticle} 사칭한 사기로 금전을 입금했거나, 수익금·투자금 출금을 요청하는 과정에서 추가 입금을 요구받았나요? 사이트 폐쇄, 리딩방 폭파, 고객센터 연락두절 상태인가요? 망설이지 않고 상담 받으면 늦지 않습니다.`,
    "",
    "📌 카카오톡 상담",
    "https://pf.kakao.com/_WkdxfX/chat",
    "",
    "⏰ 특히 출금을 이유로 수수료, 세금, 보증금 또는 추가 투자금을 계속 요구한다면 상대방과의 대화 내용, 입금계좌, 이체확인증, 사이트 주소, 문자·카카오톡·텔레그램 등의 자료를 삭제하지 말고 보관하는 것이 중요합니다.",
    "",
    `📌 ${subject} 관련 내용`,
    landingUrl,
    "",
    "📌 다른 리딩방 사기 사건 및 대응방법",
    "https://gnlaw-criminal.co.kr/prosecute/jusigridingbang-litigation/",
    "",
    "📢 관련 사건 자료",
    cafeUrl || null,
    "",
    "법무법인 선린 금융사기피해센터",
    "☎ 02-6348-0406",
    "",
    `#${compactTag} #${impersonatedTag}사기 #리딩방사기 #투자사기 #금융사기 #사기피해 #법무법인선린 #리딩방사기 #팀미션사기 #라이브방송사기`,
  ].filter((line) => line !== null).join("\n"));
}

function paymentBankName(caseName = "") {
  const match = String(caseName || "").match(/^(.+?(?:은행|뱅크))(?=\s|$)/);
  return match?.[1] || (/은행$/.test(caseName) ? caseName : `${caseName}은행`);
}

function koreanObjectParticle(value = "") {
  const hangul = [...String(value || "").trim()].reverse().find((char) => /[가-힣]/.test(char));
  if (!hangul) return "을";
  const code = hangul.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 === 0 ? "를" : "을";
}

function batchOrderValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function articleIdFromCafeUrl(value = "") {
  const match = String(value || "").match(/\/(?:articles\/)?(\d+)(?:[/?#]|$)/i);
  return match?.[1] || "";
}

function normalizeCaption(value = "") {
  return String(value || "").trim().slice(0, 2200);
}

function normalizeText(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 180);
}

function normalizeHttpUrl(value = "") {
  const text = String(value || "").trim().slice(0, 1000);
  return /^https?:\/\//i.test(text) ? text : "";
}

function normalizeHttpOrRelativeImage(value = "") {
  const text = String(value || "").trim().slice(0, 1000);
  return /^(https?:\/\/|\/api\/criminal-board-image\?id=|\/assets\/cafe-reels\/)/i.test(text) ? text : "";
}

function normalizeHref(value = "") {
  const text = String(value || "").trim().slice(0, 1000);
  return /^(https?:\/\/|tel:|mailto:)/i.test(text) ? text : "";
}

function safeId(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}
