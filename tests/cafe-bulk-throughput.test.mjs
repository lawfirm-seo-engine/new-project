import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { onRequestPost as generateCafeDraft } from "../functions/api/generate-cafe-draft.js";

function memoryKv(initialIndex = []) {
  const values = new Map([["cases:index", JSON.stringify(initialIndex)]]);
  const reads = new Map();
  return {
    reads,
    async get(key, type) {
      reads.set(key, (reads.get(key) || 0) + 1);
      const value = values.get(key) ?? null;
      if (type === "json") return value ? JSON.parse(value) : null;
      return value;
    },
    async put(key, value) {
      values.set(key, typeof value === "string" ? value : String(value));
    },
    async delete(key) {
      values.delete(key);
    },
    async list() {
      return { keys: [], list_complete: true };
    },
    index() {
      return JSON.parse(values.get("cases:index") || "[]");
    },
  };
}

async function createFraudDraft(kv, caseName) {
  const request = new Request("https://example.test/api/generate-cafe-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseName, fraudType: "institution-exchange" }),
  });
  const response = await generateCafeDraft({ request, env: { CASES: kv }, waitUntil() {} });
  const data = await response.json();
  assert.equal(response.status, 200, data.message);
  assert.equal(data.ok, true);
  return data;
}

test("bulk cafe draft reads the large case index only once per new row", async () => {
  const kv = memoryKv();

  await createFraudDraft(kv, "처리량 점검 A 사칭 사기");
  assert.equal(kv.reads.get("cases:index"), 1);

  await createFraudDraft(kv, "처리량 점검 B 사칭 사기");
  assert.equal(kv.reads.get("cases:index"), 2);
  assert.equal(kv.index().length, 2);
});

test("bulk cafe draft reuses an exact landing without reading the case index", async () => {
  const kv = memoryKv();
  const first = await createFraudDraft(kv, "처리량 재시도 사칭 사기");
  const readsAfterCreate = kv.reads.get("cases:index");

  const second = await createFraudDraft(kv, "처리량 재시도 사칭 사기");
  assert.equal(second.landing.status, "existing");
  assert.equal(second.landing.url, first.landing.url);
  assert.equal(kv.reads.get("cases:index"), readsAfterCreate);
});

test("bulk cafe draft handles the production-sized case index in one pass", async () => {
  const productionIndex = JSON.parse(readFileSync(new URL("../data/cases.json", import.meta.url), "utf8"));
  const kv = memoryKv(productionIndex);

  await createFraudDraft(kv, "대형 인덱스 처리량 점검 사칭 사기");

  assert.equal(kv.reads.get("cases:index"), 1);
  assert.equal(kv.index().length, productionIndex.length + 1);
});
