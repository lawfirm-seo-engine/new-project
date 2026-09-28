import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet, onRequestPost } from "../functions/api/cafe-reels-bulk-images.js";

function mockStorage({ withBucket = true } = {}) {
  const kvValues = new Map();
  const objects = new Map();
  const CASES = {
    async put(key, value, options = {}) {
      if (typeof value === "string") kvValues.set(key, { value, metadata: options?.metadata || {} });
      else kvValues.set(key, { value: value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer(), metadata: options?.metadata || {} });
    },
    async get(key, type) {
      const entry = kvValues.get(key);
      if (!entry) return null;
      if (type === "json") return JSON.parse(entry.value);
      return entry.value;
    },
    async getWithMetadata(key) {
      const entry = kvValues.get(key);
      return entry ? { value: entry.value, metadata: entry.metadata } : { value: null, metadata: null };
    },
  };
  const bucket = {
    async put(key, value, options = {}) {
      const bytes = value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer();
      objects.set(key, { bytes, options });
    },
    async get(key) {
      const entry = objects.get(key);
      if (!entry) return null;
      return { body: entry.bytes, async arrayBuffer() { return entry.bytes; } };
    },
  };
  return { env: { CASES, ...(withBucket ? { REELS_BUCKET: bucket } : {}) }, kvValues, objects };
}

function imageForm(jobId = "bulk-job-1") {
  const form = new FormData();
  form.set("jobId", jobId);
  for (const number of [10, 2, 1, 4, 3, 7, 6, 5, 9, 8]) {
    form.append("image", new File([new Uint8Array([number, number + 1])], `scene-${number}.png`, { type: "image/png", lastModified: 1000 + number }));
  }
  return form;
}

test("bulk Reel images are naturally ordered, backed up to R2, and restored", async () => {
  const { env, objects } = mockStorage();
  const upload = await onRequestPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-bulk-images", { method: "POST", body: imageForm() }),
    env,
  });
  const result = await upload.json();
  assert.equal(upload.status, 200);
  assert.equal(result.storage, "r2");
  assert.equal(result.images.length, 10);
  assert.deepEqual(result.images.map((item) => item.name), Array.from({ length: 10 }, (_, index) => `scene-${index + 1}.png`));
  assert.equal(objects.size, 10);

  const manifestResponse = await onRequestGet({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-bulk-images?jobId=bulk-job-1"),
    env,
  });
  const manifest = await manifestResponse.json();
  assert.equal(manifestResponse.status, 200);
  assert.deepEqual(manifest.images.map((item) => item.slot), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);

  const imageResponse = await onRequestGet({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-bulk-images?jobId=bulk-job-1&slot=02"),
    env,
  });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("Content-Type"), "image/png");
  assert.match(imageResponse.headers.get("Content-Disposition"), /scene-2\.png/);
  assert.deepEqual([...new Uint8Array(await imageResponse.arrayBuffer())], [2, 3]);
});

test("bulk Reel images fall back to temporary KV storage", async () => {
  const { env } = mockStorage({ withBucket: false });
  const upload = await onRequestPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-bulk-images", { method: "POST", body: imageForm("kv-job") }),
    env,
  });
  const result = await upload.json();
  assert.equal(upload.status, 200);
  assert.equal(result.storage, "temporary-kv");

  const imageResponse = await onRequestGet({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-bulk-images?jobId=kv-job&slot=10"),
    env,
  });
  assert.equal(imageResponse.status, 200);
  assert.deepEqual([...new Uint8Array(await imageResponse.arrayBuffer())], [10, 11]);
});

test("bulk Reel backup rejects anything other than exactly ten images", async () => {
  const { env } = mockStorage();
  const form = new FormData();
  form.set("jobId", "short-job");
  form.append("image", new File([new Uint8Array([1])], "01.png", { type: "image/png" }));
  const response = await onRequestPost({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-bulk-images", { method: "POST", body: form }),
    env,
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /정확히 10장/);
});
