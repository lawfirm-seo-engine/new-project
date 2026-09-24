import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../functions/api/cafe-reels-workflow.js";

test("Naver Cafe upload links the phone and Kakao images with SmartEditor placeholders", async () => {
  const jobId = "test-job";
  const slots = [
    ...Array.from({ length: 12 }, (_, index) => ({
      slot: String(index + 1).padStart(2, "0"),
      label: `${index + 1}`,
      url: `/api/criminal-board-image?id=fraud-${index + 1}.jpg`,
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
  const requestedImageUrls = [];
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
    if (url.startsWith("https://gnlaw-criminal.co.kr/assets/cafe-reels/fraud/")) {
      requestedImageUrls.push(url);
      return new Response(jpeg, { headers: { "Content-Type": "image/jpeg" } });
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
    assert.equal(result.job.naverContactLinkMode, "linked-contact-images");
    assert.equal(result.job.images.length, 14);
    assert.match(uploadRequest.init.headers["Content-Type"], /^multipart\/form-data; boundary=/);
    assert.ok(uploadRequest.init.body instanceof Uint8Array);

    const multipart = new TextDecoder().decode(uploadRequest.init.body);
    assert.equal((multipart.match(/name="image"/g) || []).length, 14);
    assert.doesNotMatch(multipart, /name="image\[\d+\]"/);
    assert.match(multipart, /filename="naver-cafe-12\.jpg"/);
    assert.match(multipart, /filename="naver-cafe-phone\.jpg"/);
    assert.match(multipart, /filename="naver-cafe-kakao\.jpg"/);
    assert.deepEqual(
      requestedImageUrls,
      Array.from({ length: 12 }, (_, index) => `https://gnlaw-criminal.co.kr/assets/cafe-reels/fraud/${String(index + 1).padStart(2, "0")}.jpg`),
    );
    assert.match(multipart, /%3Ca%20href%3D%22https%3A%2F%2Fgnlaw-criminal\.co\.kr%2Fcall_redirect%2F%22%3E%3Cimg%20src%3D%22%2312%22/i);
    assert.match(multipart, /%3Ca%20href%3D%22https%3A%2F%2Fgnlaw-criminal\.co\.kr%2Fkakao_redirect%2F%22%3E%3Cimg%20src%3D%22%2313%22/i);
    assert.equal((multipart.match(/src%3D%22%23\d+%22/gi) || []).length, 2);
    assert.doesNotMatch(multipart, /%F0%9F%93%8C/i);
    assert.match(multipart, /Content-Transfer-Encoding: binary/);
    assert.match(multipart, /Content-Type: text\/plain; charset=UTF-8/);
    assert.doesNotMatch(multipart, /pf\.kakao\.com/);
    assert.doesNotMatch(multipart, /tel%3A02-6348-0406/);
    assert.doesNotMatch(multipart, /target%3D%22_blank%22|rel%3D%22noopener%22/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Naver Cafe upload reports a failure instead of silently publishing unlinked contact images", async () => {
  const jobId = "fallback-job";
  const slots = [
    { slot: "01", label: "1", url: "/api/criminal-board-image?id=fraud-1.jpg" },
    { slot: "phone", label: "phone", url: "https://images.example/phone.jpg" },
    { slot: "kakao", label: "kakao", url: "https://images.example/kakao.jpg" },
  ];
  const job = {
    id: jobId,
    caseName: "테스트 사건",
    fraudType: "institution-exchange",
    imageSetKey: "fraud",
    draft: { title: "테스트 제목", body: "본문" },
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
  const uploadRequests = [];
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
    if (url.startsWith("https://gnlaw-criminal.co.kr/assets/cafe-reels/fraud/") || url.startsWith("https://images.example/")) {
      return new Response(jpeg, { headers: { "Content-Type": "image/jpeg" } });
    }
    if (url.startsWith("https://openapi.naver.com/")) {
      uploadRequests.push({ url, init });
      const multipart = new TextDecoder().decode(init.body);
      if (/%3Ca%20href/i.test(multipart)) {
        return Response.json({ message: { error: { code: "999", msg: "unsupported html" } } }, { status: 403 });
      }
      return Response.json({ message: { result: { articleid: "456" } } });
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
    assert.equal(result.job.cafeStatus, "upload-failed");
    assert.equal(result.job.naverContactLinkMode, "");
    assert.equal(uploadRequests.length, 1);
    assert.match(result.message, /이미지 링크 업로드 실패/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
