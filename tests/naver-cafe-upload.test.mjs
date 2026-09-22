import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../functions/api/cafe-reels-workflow.js";

test("Naver Cafe upload uses a legacy-compatible multipart body with at most ten images", async () => {
  const jobId = "test-job";
  const slots = [
    ...Array.from({ length: 12 }, (_, index) => ({
      slot: String(index + 1).padStart(2, "0"),
      label: `${index + 1}`,
      url: `https://images.example/${index + 1}.jpg`,
    })),
    { slot: "phone", label: "phone", url: "https://images.example/phone.jpg" },
    { slot: "kakao", label: "kakao", url: "https://images.example/kakao.jpg" },
  ];
  const job = {
    id: jobId,
    caseName: "테스트 사건",
    fraudType: "institution-exchange",
    imageSetKey: "fraud",
    draft: { title: "테스트 제목", body: "본문 📌" },
    images: slots,
  };
  const stored = new Map([
    [`cafe-reels:job:${jobId}`, job],
    ["cafe-reels:jobs:index:v1", []],
    ["cafe-reels:asset-sets:v1", { fraud: { slots } }],
    ["naver-cafe:oauth:v1", {
      accessToken: "test-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }],
  ]);
  const env = {
    CASES: {
      async get(key) { return stored.get(key) ?? null; },
      async put(key, value) {
        stored.set(key, JSON.parse(value));
      },
    },
    NAVER_CLIENT_ID: "client-id",
    NAVER_CLIENT_SECRET: "client-secret",
    GITHUB_OWNER: "owner",
    GITHUB_REPO: "repo",
    GITHUB_BRANCH: "main",
    GITHUB_TOKEN: "github-token",
  };
  const jpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03,
  ]);
  let uploadRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith("https://api.github.com/")) {
      const settings = {
        naverCafeClubId: "31738465",
        naverCafeFraudMenuId: "1",
        naverCafePaymentSuspensionMenuId: "2",
        naverCafeSlug: "gnlawfintech",
      };
      return Response.json({ content: Buffer.from(JSON.stringify(settings)).toString("base64") });
    }
    if (url.startsWith("https://images.example/")) {
      return new Response(jpeg, { headers: { "Content-Type": "image/jpeg" } });
    }
    if (url.startsWith("https://openapi.naver.com/")) {
      uploadRequest = { url, init };
      return Response.json({ message: { result: { articleid: "123" } } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await onRequestPost({
      request: new Request("https://example.test/api/cafe-reels-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare-cafe", jobId }),
      }),
      env,
    });
    const result = await response.json();
    assert.equal(result.job.cafeStatus, "posted");
    assert.equal(result.job.images.length, 10);
    assert.match(uploadRequest.init.headers["Content-Type"], /^multipart\/form-data; boundary=/);
    assert.ok(uploadRequest.init.body instanceof Uint8Array);

    const multipart = new TextDecoder().decode(uploadRequest.init.body);
    assert.equal((multipart.match(/name="image\[\d+\]"/g) || []).length, 10);
    assert.match(multipart, /name="image\[0\]"/);
    assert.match(multipart, /name="image\[9\]"/);
    assert.match(multipart, /filename="naver-cafe-08\.jpg"/);
    assert.match(multipart, /filename="naver-cafe-phone\.jpg"/);
    assert.match(multipart, /filename="naver-cafe-kakao\.jpg"/);
    assert.doesNotMatch(multipart, /filename="naver-cafe-09\.jpg"/);
    assert.doesNotMatch(multipart, /%F0%9F%93%8C/i);
    assert.match(multipart, /Content-Transfer-Encoding: binary/);
    assert.match(multipart, /Content-Type: text\/plain; charset=UTF-8/);
    assert.match(multipart, /https%3A%2F%2Fgnlaw-criminal\.co\.kr%2Fcall_redirect%2F/);
    assert.match(multipart, /https%3A%2F%2Fpf\.kakao\.com%2F_WkdxfX%2Fchat/);
    assert.doesNotMatch(multipart, /tel%3A02-6348-0406/);
    assert.doesNotMatch(multipart, /target%3D%22_blank%22|rel%3D%22noopener%22/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
