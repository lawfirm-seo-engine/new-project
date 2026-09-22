const MAX_BYTES = 95 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "application/octet-stream"]);

export async function onRequestPost({ request, env }) {
  try {
    const bucket = env?.REELS_BUCKET || env?.CAFE_REELS_BUCKET;
    if (!bucket) {
      return json({
        ok: false,
        message: "릴스 영상 저장용 R2 바인딩(REELS_BUCKET 또는 CAFE_REELS_BUCKET)이 설정되지 않았습니다.",
        missing: ["REELS_BUCKET"],
      }, 500);
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("video");
    if (!file || typeof file === "string") return json({ ok: false, message: "업로드할 MP4 영상이 없습니다." }, 400);
    if (file.size > MAX_BYTES) return json({ ok: false, message: "영상 용량은 95MB 이하만 업로드할 수 있습니다." }, 400);

    const type = String(file.type || "video/mp4").toLowerCase();
    if (!VIDEO_TYPES.has(type)) return json({ ok: false, message: "MP4 영상만 업로드해주세요." }, 400);

    const jobId = safeId(form.get("jobId") || "manual");
    const key = `cafe-reels/${jobId}/${Date.now().toString(36)}-${randomHex(10)}.mp4`;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: "video/mp4" },
      customMetadata: {
        originalName: String(file.name || "reels.mp4").slice(0, 120),
        uploadedAt: new Date().toISOString(),
      },
    });

    const publicBase = String(env?.CAFE_REELS_PUBLIC_BASE_URL || env?.REELS_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const videoUrl = publicBase ? `${publicBase}/${key}` : "";
    return json({
      ok: true,
      key,
      videoUrl,
      message: videoUrl
        ? "영상 업로드가 완료되었습니다."
        : "영상은 저장됐지만 공개 URL 베이스(CAFE_REELS_PUBLIC_BASE_URL)가 없어 인스타그램 발행에는 사용할 수 없습니다.",
    });
  } catch (error) {
    return json({ ok: false, message: error?.message || "영상 업로드에 실패했습니다." }, 500);
  }
}

function safeId(value = "") {
  return String(value || "manual").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "manual";
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
