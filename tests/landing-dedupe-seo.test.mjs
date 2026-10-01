import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { CASE_SLUG_REDIRECTS, canonicalCaseSlug } from "../functions/_caseAliases.js";
import { normalizeCaseIdentity } from "../functions/_caseIdentity.js";
import { buildSitemapXml } from "../functions/_seo.js";
import { onRequest as renderLandingRequest } from "../functions/[[path]].js";
import { createCaseDraftSlug } from "../functions/api/generate-draft.js";
import { onRequestGet as getCaseRequest } from "../functions/api/get-case.js";

const cases = JSON.parse(await fs.readFile(new URL("../data/cases.json", import.meta.url), "utf8"));
const canonicalCase = cases.find((item) => item.slug === "hanypor");

function kv(values = {}) {
  return {
    get: async (key) => Object.hasOwn(values, key) ? values[key] : null,
    put: async () => {},
  };
}

function visibleText(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ");
}

test("all known duplicate cases are consolidated in source data", () => {
  assert.equal(Object.keys(CASE_SLUG_REDIRECTS).length, 62);
  const slugs = new Set(cases.map((item) => item.slug));
  for (const [duplicate, winner] of Object.entries(CASE_SLUG_REDIRECTS)) {
    assert.equal(slugs.has(duplicate), false, duplicate);
    assert.equal(slugs.has(winner), true, winner);
  }
});

test("case identity and draft slug normalize suffix variations", () => {
  assert.equal(normalizeCaseIdentity("HanyPor 사기"), normalizeCaseIdentity("HanyPor 사칭 사기"));
  assert.equal(createCaseDraftSlug("HanyPor 사기"), "hanypor");
  assert.equal(createCaseDraftSlug("HanyPor 사칭 사기"), "hanypor");
});

test("duplicate landing redirects permanently to the canonical URL", async () => {
  const response = await renderLandingRequest({
    request: new Request("https://gnlaw-criminal.co.kr/prosecute/hanypor-saching-litigation/"),
    env: {},
    next: async () => new Response("next"),
  });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://gnlaw-criminal.co.kr/prosecute/hanypor-litigation/");
  assert.equal(canonicalCaseSlug("hanypor-saching"), "hanypor");
});

test("canonical landing uses the exact case keyword 9 times without forbidden placeholders", async () => {
  const response = await renderLandingRequest({
    request: new Request("https://gnlaw-criminal.co.kr/prosecute/hanypor-litigation/"),
    env: { CASES: kv({
      "case:hanypor": JSON.stringify(canonicalCase),
      "cases:index": JSON.stringify(cases),
    }) },
    next: async () => new Response("next"),
  });
  assert.equal(response.status, 200);
  const visible = visibleText(await response.text());
  assert.equal((visible.match(/HanyPor 사칭 사기/g) || []).length, 9);
  for (const forbidden of ["해당 업체", "문제 사이트", "관련 계정", "해당 플랫폼"]) {
    assert.equal(visible.includes(forbidden), false, forbidden);
  }
});

test("stale duplicate KV data is merged into the canonical read", async () => {
  const response = await getCaseRequest({
    request: new Request("https://gnlaw-criminal.co.kr/api/get-case?slug=hanypor"),
    env: { CASES: kv({
      "case:hanypor": JSON.stringify({ ...canonicalCase, fraudType: "stock-project" }),
      "case:hanypor-saching": JSON.stringify({ ...canonicalCase, slug: "hanypor-saching", fraudType: "institution-exchange" }),
    }) },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.case.slug, "hanypor");
  assert.equal(payload.case.fraudType, "institution-exchange");
  assert.ok(payload.case.redirectFrom.includes("hanypor-saching"));
});

test("duplicate aliases are omitted from sitemap output", () => {
  const group = {
    key: "a",
    landingKey: "a",
    host: "gnlaw-criminal.co.kr",
    siteUrl: "https://gnlaw-criminal.co.kr",
    pathPrefix: "prosecute",
    urlSlugSuffix: "litigation",
  };
  const duplicate = { ...canonicalCase, slug: "hanypor-saching" };
  const xml = buildSitemapXml(group, [canonicalCase, duplicate]);
  assert.match(xml, /hanypor-litigation/);
  assert.doesNotMatch(xml, /hanypor-saching-litigation/);
});
