const IMAGE_COUNT = 10;
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_BYTES = 95 * 1024 * 1024;
const KV_TTL_SECONDS = 30 * 24 * 60 * 60;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MANIFEST_PREFIX = "cafe-reels:bulk-images:";
const OBJECT_PREFIX = "cafe-reels/bulk-images/";

export async function onRequestPost({ request, env }) {
  const startedAt = Date.now();
  try {
    const bucket = env?.REELS_BUCKET || env?.CAFE_REELS_BUCKET;
    const kv = env?.CASES;
    if (!kv) return json({ ok: false, message: "복구용 이미지 목록을 저장할 CASES 바인딩이 없습니다." }, 500);
    if (!bucket && !kv) return json({ ok: false, message: "복구용 이미지 저장 공간이 설정되지 않았습니다." }, 500);

    const form = await request.formData().catch(() => null);
    const jobId = safeId(form?.get("jobId"));
    if (!jobId) return json({ ok: false, message: "이미지를 연결할 작업 ID가 없습니다." }, 400);
    const files = (form?.getAll("image") || []).filter((value) => value && typeof value !== "string");
    if (files.length !== IMAGE_COUNT) {
      return json({ ok: false, message: `복구용 릴스 이미지는 정확히 ${IMAGE_COUNT}장이 필요합니다. (현재 ${files.length}장)` }, 400);
    }

    const ordered = naturalSort(files);
    const totalBytes = ordered.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) return json({ ok: false, message: "이미지 10장의 전체 용량은 95MB 이하만 저장할 수 있습니다." }, 400);
    for (const file of ordered) {
      const type = String(file.type || "").toLowerCase();
      if (!IMAGE_TYPES.has(type)) return json({ ok: false, message: `${file.name}: PNG, JPG, WEBP 이미지만 사용할 수 있습니다.` }, 400);
      if (file.size > MAX_IMAGE_BYTES) return json({ ok: false, message: `${file.name}: 이미지 한 장은 24MB 이하만 저장할 수 있습니다.` }, 400);
    }

    console.log("[cafe-reels-bulk-images] upload-start", JSON.stringify({ jobId, count: ordered.length, totalBytes, storage: bucket ? "r2" : "kv" }));
    const uploadedAt = new Date().toISOString();
    const images = [];
    for (let index = 0; index < ordered.length; index += 1) {
      const file = ordered[index];
      const slot = String(index + 1).padStart(2, "0");
      const key = `${OBJECT_PREFIX}${jobId}/${slot}`;
      const type = String(file.type || "image/png").toLowerCase();
      const metadata = {
        contentType: type,
        originalName: safeFileName(file.name || `${slot}.png`),
        uploadedAt,
        bytes: String(file.size),
        slot,
      };
      const bytes = await file.arrayBuffer();
      if (bucket) {
        await bucket.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: metadata });
      } else {
        await kv.put(key, bytes, { expirationTtl: KV_TTL_SECONDS, metadata });
      }
      images.push({
        slot,
        name: metadata.originalName,
        type,
        size: file.size,
        lastModified: Number(file.lastModified) || Date.now(),
        key,
      });
    }

    const manifest = { jobId, storage: bucket ? "r2" : "temporary-kv", uploadedAt, totalBytes, images };
    await kv.put(manifestKey(jobId), JSON.stringify(manifest), bucket ? undefined : { expirationTtl: KV_TTL_SECONDS });
    console.log("[cafe-reels-bulk-images] upload-complete", JSON.stringify({ jobId, durationMs: Date.now() - startedAt, count: images.length }));
    return json({ ok: true, jobId, storage: manifest.storage, images: publicImages(images), message: "복구용 릴스 이미지 10장을 서버에 백업했습니다." });
  } catch (error) {
    console.error("[cafe-reels-bulk-images] upload-failed", error);
    return json({ ok: false, message: error?.message || "복구용 이미지 서버 백업에 실패했습니다." }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const jobId = safeId(url.searchParams.get("jobId"));
    if (!jobId) return json({ ok: false, message: "작업 ID가 없습니다." }, 400);
    const kv = env?.CASES;
    if (!kv) return json({ ok: false, message: "CASES 바인딩이 없습니다." }, 500);
    const manifest = await kv.get(manifestKey(jobId), "json");
    if (!manifest || !Array.isArray(manifest.images)) return json({ ok: false, message: "서버에 백업된 릴스 이미지가 없습니다." }, 404);

    const slotParam = url.searchParams.get("slot");
    if (!slotParam) {
      return json({
        ok: true,
        jobId,
        storage: manifest.storage,
        uploadedAt: manifest.uploadedAt,
        images: publicImages(manifest.images),
      });
    }

    const slot = String(Number(slotParam)).padStart(2, "0");
    const item = manifest.images.find((image) => image.slot === slot);
    if (!item) return json({ ok: false, message: `${slot}번 복구용 이미지를 찾을 수 없습니다.` }, 404);
    const headers = new Headers({
      "Content-Type": item.type || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.name || `${slot}.png`)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });

    if (manifest.storage === "r2") {
      const bucket = env?.REELS_BUCKET || env?.CAFE_REELS_BUCKET;
      if (!bucket) return json({ ok: false, message: "R2 이미지 저장소가 연결되지 않았습니다." }, 500);
      const object = await bucket.get(item.key);
      if (!object) return json({ ok: false, message: `${slot}번 복구용 이미지 파일이 없습니다.` }, 404);
      return new Response(object.body || await object.arrayBuffer(), { status: 200, headers });
    }

    const stored = await kv.getWithMetadata(item.key, "arrayBuffer");
    if (!stored?.value) return json({ ok: false, message: `${slot}번 복구용 이미지 파일이 만료되었거나 없습니다.` }, 404);
    return new Response(stored.value, { status: 200, headers });
  } catch (error) {
    return json({ ok: false, message: error?.message || "복구용 이미지를 불러오지 못했습니다." }, 500);
  }
}

function naturalSort(files) {
  return [...files].sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), undefined, { numeric: true, sensitivity: "base" }));
}

function publicImages(images) {
  return [...images]
    .sort((left, right) => Number(left.slot) - Number(right.slot))
    .map(({ slot, name, type, size, lastModified }) => ({ slot, name, type, size, lastModified }));
}

function manifestKey(jobId) {
  return `${MANIFEST_PREFIX}${jobId}:manifest`;
}

function safeId(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function safeFileName(value = "") {
  return String(value || "image.png").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || "image.png";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
