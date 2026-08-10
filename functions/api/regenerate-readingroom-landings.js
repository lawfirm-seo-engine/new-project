// 1회성 마이그레이션: 이미 생성된 landings.ld(readingroom-manual) 항목의 title/H1을
// 새 패턴("사건명 + 사칭 사기" / "... 피해회복 안내")으로 재생성하고, 구버전 템플릿에 남아있는
// "네이버 AI 브리핑형" 문구를 제거한다. admin/readingroom.html에서 새로 만든 항목은 이미
// 새 패턴을 쓰므로, 이 마이그레이션이 필요한 건 그 이전에 생성된 소수의 기존 항목뿐이다.
// POST /api/regenerate-readingroom-landings        → 실제 반영
// POST /api/regenerate-readingroom-landings?dry=1  → 미리보기(쓰기 없음)
import { GROUPS, buildLandingUrl } from "../_seo.js";
import { classifyLdCategory } from "../_readingroomCategory.js";
import { ldPageH1, ldPageTitle } from "../_readingroomTemplate.js";

const LD_GROUP = GROUPS.find((g) => (g.landingKey || g.key) === "ld");
const OLD_PHRASE = "네이버 AI 브리핑형 빠른 답변";
const NEW_PHRASE = "상황별 빠른 답변";

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    if (!env.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const targets = idx.filter((e) =>
      e.createdBy === "readingroom-manual" || e.landings?.ld?.createdBy === "readingroom-manual");

    if (dryRun) {
      return json({ ok: true, dryRun: true, total: targets.length, slugs: targets.map((e) => e.slug) });
    }

    let updatedKV = 0;
    const errors = [];

    for (const entry of targets) {
      try {
        const raw = await env.CASES.get(`case:${entry.slug}`);
        if (!raw) continue;
        const caseData = JSON.parse(raw);
        const landing = caseData.landings?.ld;
        if (!landing) continue;

        const sourceName = caseData.caseName || landing.title || landing.h1 || "";
        const ldCategory = caseData.ldCategory || classifyLdCategory([sourceName, caseData.summary].filter(Boolean).join(" "));
        const pageH1 = ldPageH1(sourceName);
        const pageTitle = ldPageTitle(sourceName, ldCategory);

        landing.title = pageTitle;
        landing.h1 = pageH1;
        landing.ogTitle = pageTitle;
        landing.imageAlt = pageH1;
        if (Array.isArray(landing.body)) {
          landing.body = landing.body.map((p) => String(p || "").split(OLD_PHRASE).join(NEW_PHRASE));
        }
        if (LD_GROUP) landing.canonical = landing.canonical || buildLandingUrl(LD_GROUP, entry.slug);

        caseData.ldCategory = ldCategory;
        caseData.updatedAt = today();

        await env.CASES.put(`case:${entry.slug}`, JSON.stringify(caseData));

        entry.ldCategory = ldCategory;
        if (entry.landings?.ld) {
          entry.landings.ld.title = pageTitle;
          entry.landings.ld.h1 = pageH1;
        }
        updatedKV++;
      } catch (e) {
        errors.push({ slug: entry.slug, error: e.message });
      }
    }

    if (updatedKV > 0) {
      await env.CASES.put("cases:index", JSON.stringify(idx));
    }

    let githubUpdated = 0;
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
    const targetSlugs = new Set(targets.map((e) => e.slug));

    if (owner && repo && token && updatedKV > 0) {
      try {
        const filePath = "data/cases.json";
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(apiUrl, { headers: githubHeaders(token) });
        if (res.ok) {
          const file = await res.json();
          const raw = await readFileContent(file, token);
          const cases = raw ? JSON.parse(raw) : [];
          for (const c of cases) {
            if (!targetSlugs.has(c.slug) || !c.landings?.ld) continue;
            const sourceName = c.caseName || c.landings.ld.title || "";
            const ldCategory = c.ldCategory || classifyLdCategory([sourceName, c.summary].filter(Boolean).join(" "));
            const pageH1 = ldPageH1(sourceName);
            const pageTitle = ldPageTitle(sourceName, ldCategory);
            c.landings.ld.title = pageTitle;
            c.landings.ld.h1 = pageH1;
            c.landings.ld.ogTitle = pageTitle;
            c.landings.ld.imageAlt = pageH1;
            if (Array.isArray(c.landings.ld.body)) {
              c.landings.ld.body = c.landings.ld.body.map((p) => String(p || "").split(OLD_PHRASE).join(NEW_PHRASE));
            }
            c.ldCategory = ldCategory;
            githubUpdated++;
          }
          const newContent = JSON.stringify(cases, null, 2);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: "PUT",
            headers: githubHeaders(token),
            body: JSON.stringify({
              message: `Regenerate ${githubUpdated} readingroom landing titles`,
              content: encodeBase64(newContent),
              sha: file.sha,
              branch,
            }),
          });
        }
      } catch (e) {
        errors.push({ slug: "github", error: e.message });
      }
    }

    return json({ ok: true, total: targets.length, updatedKV, githubUpdated, errors });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "static-landing-generator-admin" };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") return decodeBase64(file.content).trim();
  if (file.download_url) {
    const r = await fetch(file.download_url, { headers: githubHeaders(token) });
    return r.ok ? (await r.text()).trim() : null;
  }
  return null;
}

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64(str) {
  const binary = atob(String(str).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
