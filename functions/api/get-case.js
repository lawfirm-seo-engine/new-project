// Public case lookup API for landing page rendering.
// GET /api/get-case?slug=xxx
import { mergeCaseDataForRead } from "../_durableCaseFields.js";

const READ_REPAIR_SLUGS = new Set(["jusigridingbang"]);

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) return json({ ok: false, message: "slug is required" }, 400);

  let kvCase = null;

  // 1st priority: KV
  if (env.CASES) {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) kvCase = JSON.parse(raw);
    if (kvCase && !READ_REPAIR_SLUGS.has(slug)) return json({ ok: true, case: kvCase });
  }

  // 2nd priority: GitHub
  try {
    const found = await fetchCaseFromGitHub(slug, env);
    if (!found && kvCase) return json({ ok: true, case: kvCase });
    if (!found) return json({ ok: false, message: "not found" }, 404);

    return json({ ok: true, case: kvCase ? mergeCaseDataForRead(kvCase, found) : found });
  } catch (err) {
    return json({ ok: false, message: err.message }, 500);
  }
}

async function fetchCaseFromGitHub(slug, env) {
  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return null;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`,
    { headers: githubHeaders(token) }
  );
  if (!res.ok) return null;

  const file = await res.json();
  const text = await readFileContent(file, token);
  if (!text) return null;

  const cases = JSON.parse(text);
  return cases.find((c) => c.slug === slug) || null;
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    const clean = file.content.replace(/\n/g, "");
    return new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0))).trim();
  }
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
