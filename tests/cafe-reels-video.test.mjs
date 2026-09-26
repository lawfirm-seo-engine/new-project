import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost as uploadVideo } from "../functions/api/cafe-reels-video.js";
import { onRequestGet as getVideo } from "../functions/media/cafe-reels/[[id]].js";

function kvEnv() {
  const stored = new Map();
  return {
    stored,
    env: {
      CASES: {
        async put(key, value, options = {}) {
          const bytes = value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer();
          stored.set(key, { value: bytes, metadata: options.metadata || {} });
        },
        async getWithMetadata(key) {
          return stored.get(key) || { value: null, metadata: null };
        },
      },
    },
  };
}

test("Reels videos use temporary KV storage when R2 is unavailable", async () => {
  const { env, stored } = kvEnv();
  const form = new FormData();
  form.set("jobId", "manual-image-job");
  form.set("video", new File([new Uint8Array([1, 2, 3, 4, 5])], "reel.mp4", { type: "video/mp4" }));
  const response = await uploadVideo({
    request: new Request("https://gnlaw-criminal.co.kr/api/cafe-reels-video", { method: "POST", body: form }),
    env,
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.storage, "temporary-kv");
  assert.match(result.videoUrl, /^https:\/\/gnlaw-criminal\.co\.kr\/media\/cafe-reels\/[a-z0-9_-]+\.mp4$/);
  assert.equal(stored.has(result.key), true);

  const id = new URL(result.videoUrl).pathname.split("/").pop();
  const media = await getVideo({
    request: new Request(result.videoUrl, { headers: { Range: "bytes=1-3" } }),
    env,
    params: { id },
  });
  assert.equal(media.status, 206);
  assert.equal(media.headers.get("Content-Type"), "video/mp4");
  assert.equal(media.headers.get("Content-Range"), "bytes 1-3/5");
  assert.deepEqual([...new Uint8Array(await media.arrayBuffer())], [2, 3, 4]);
});
