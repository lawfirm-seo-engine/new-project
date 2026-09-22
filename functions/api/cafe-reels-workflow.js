const JOB_PREFIX = "cafe-reels:job:";
const INDEX_KEY = "cafe-reels:jobs:index:v1";

export async function onRequestGet({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    const url = new URL(request.url);
    const jobId = safeId(url.searchParams.get("jobId") || "");
    if (jobId) {
      const job = await loadJob(env, jobId);
      if (!job) return json({ ok: false, message: "작업을 찾을 수 없습니다." }, 404);
      return json({ ok: true, job });
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

    if (action === "save-job") {
      const job = await saveJob(env, buildJob(body));
      return json({ ok: true, job, message: "카페 원고·이미지·릴스 작업이 저장되었습니다." });
    }

    if (action === "prepare-cafe") {
      const job = await requireJob(env, body?.jobId);
      const next = await saveJob(env, {
        ...job,
        cafeStatus: "manual-required",
        cafePreparedAt: new Date().toISOString(),
      });
      return json({
        ok: true,
        job: next,
        message: "카페 게시용 원고와 이미지 세트가 준비되었습니다. 카페 게시 후 게시글 URL을 입력하면 릴스 캡션에 반영됩니다.",
      });
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
        message: "릴스 업로드용 영상 URL과 캡션이 준비되었습니다. 외부 계정 자동 게시 기능은 별도 승인과 계정 설정 후 연결할 수 있습니다.",
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
    caseName: job.caseName,
    fraudType: job.fraudType,
    title: job.draft?.title || "",
    cafeStatus: job.cafeStatus || "",
    instagramStatus: job.instagramStatus || "",
    updatedAt: job.updatedAt,
  };
  const next = [item, ...index.filter((entry) => entry.id !== job.id)]
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 80);
  await env.CASES.put(INDEX_KEY, JSON.stringify(next));
}

async function loadIndex(env) {
  return (await env.CASES.get(INDEX_KEY, "json").catch(() => null)) || [];
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

function buildCaption(job = {}) {
  const title = normalizeText(job.draft?.title || job.title || `${job.caseName || "사기 피해"} 대응 안내`);
  const cafeUrl = normalizeHttpUrl(job.cafeUrl || "");
  return normalizeCaption([
    title,
    "",
    "피해 정황과 입금 자료를 보존한 뒤 법률 대응 가능성을 확인하세요.",
    cafeUrl ? `자세한 내용: ${cafeUrl}` : "",
    "",
    "#법무법인선린 #사기피해 #금융사기 #피해회복",
  ].filter(Boolean).join("\n"));
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
  return /^(https?:\/\/|\/api\/criminal-board-image\?id=)/i.test(text) ? text : "";
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
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
