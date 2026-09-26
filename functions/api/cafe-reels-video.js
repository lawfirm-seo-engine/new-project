const MAX_BYTES = 95 * 1024 * 1024;
const MAX_KV_BYTES = 24 * 1024 * 1024;
const KV_VIDEO_TTL_SECONDS = 7 * 24 * 60 * 60;
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "application/octet-stream"]);

export async function onRequestPost({ request, env }) {
  try {
    const bucket = env?.REELS_BUCKET || env?.CAFE_REELS_BUCKET;
    const kv = env?.CASES;
    if (!bucket && !kv) return json({ ok: false, message: "릴스 영상을 저장할 공간이 설정되지 않았습니다." }, 500);

    const form = await request.formData().catch(() => null);
    const file = form?.get("video");
    if (!file || typeof file === "string") return json({ ok: false, message: "업로드할 MP4 영상이 없습니다." }, 400);
    if (file.size > MAX_BYTES) return json({ ok: false, message: "영상 용량은 95MB 이하만 업로드할 수 있습니다." }, 400);
    if (!bucket && file.size > MAX_KV_BYTES) {
      return json({ ok: false, message: "현재 임시 영상 저장소에서는 24MB 이하의 영상만 업로드할 수 있습니다." }, 400);
    }

    const type = String(file.type || "video/mp4").toLowerCase();
    if (!VIDEO_TYPES.has(type)) return json({ ok: false, message: "MP4 영상만 업로드해주세요." }, 400);

    const jobId = safeId(form.get("jobId") || "manual");
    const publicId = `${jobId}-${Date.now().toString(36)}-${randomHex(32)}`;
    const key = `cafe-reels/${publicId}.mp4`;
    const metadata = {
      contentType: "video/mp4",
      originalName: String(file.name || "reels.mp4").slice(0, 120),
      uploadedAt: new Date().toISOString(),
      bytes: String(file.size),
    };
    if (bucket) {
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: "video/mp4" },
        customMetadata: metadata,
      });
    } else {
      await kv.put(key, await file.arrayBuffer(), {
        expirationTtl: KV_VIDEO_TTL_SECONDS,
        metadata,
      });
    }

    const publicBase = String(env?.CAFE_REELS_PUBLIC_BASE_URL || env?.REELS_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const videoUrl = publicBase
      ? `${publicBase}/${key}`
      : `${new URL(request.url).origin}/media/cafe-reels/${publicId}.mp4`;
    return json({
      ok: true,
      key,
      videoUrl,
      storage: bucket ? "r2" : "temporary-kv",
      message: bucket
        ? "영상 업로드가 완료되었습니다."
        : "영상 업로드가 완료되었습니다. Instagram과 카페 게시가 끝날 때까지 임시 공개 주소로 보관합니다.",
    });
  } catch (error) {
    return json({ ok: false, message: error?.message || "영상 업로드에 실패했습니다." }, 500);
  }
}

function safeId(value = "") {
  return String(value || "manual").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "manual";
}

function randomHex(bytes) {
  const arr = new Uint8Array(Math.ceil(bytes / 2));
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, bytes);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
