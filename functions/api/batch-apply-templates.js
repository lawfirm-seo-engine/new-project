// Batch endpoint: applies scam-intro/method/example templates + SEO density reduction
// to all existing cases in KV and GitHub.
// POST /api/batch-apply-templates  (no request body required)

export async function onRequestPost(context) {
  const { env } = context;

  try {
    if (!env.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);

    // 1. 템플릿 파일 로딩
    const templates = await readTemplates(env);
    const hasTemplates = templates.scamIntro || templates.scamMethod || templates.scamExample;

    // 2. KV 인덱스에서 전체 slug 목록 조회
    const idxRaw = await env.CASES.get("cases:index");
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    if (idx.length === 0) return json({ ok: false, message: "등록된 사건이 없습니다." });

    let updatedKV = 0;
    let skipped = 0;
    const errors = [];

    // 3. 각 사건별 처리
    for (const entry of idx) {
      try {
        const raw = await env.CASES.get(`case:${entry.slug}`);
        if (!raw) continue;
        const caseData = JSON.parse(raw);
        if (!caseData.landings) { skipped++; continue; }

        let changed = false;
        const caseName = caseData.caseName || "";

        for (const key of Object.keys(caseData.landings)) {
          const landing = caseData.landings[key];
          if (!landing) continue;

          const seed = `${entry.slug}-${key}`;

          // scamIntroItems 적용
          if (templates.scamIntro) {
            landing.scamIntroItems = applyTemplate(pickVariant(templates.scamIntro, seed) || [], caseName);
            changed = true;
          }

          // scamMethodItems 적용
          if (templates.scamMethod) {
            landing.scamMethodItems = applyTemplate(pickVariant(templates.scamMethod, seed + "m") || [], caseName);
            changed = true;
          }

          // victimCases 완전 대체
          if (templates.scamExample) {
            const items = applyTemplate(pickVariant(templates.scamExample, seed + "e") || [], caseName);
            if (items.length > 0) { landing.victimCases = items; changed = true; }
          }

          // SEO 밀도 감소 (body)
          if (Array.isArray(landing.body)) {
            landing.body = reduceBodyDensity(landing.body, caseName);
            changed = true;
          }

          // SEO 밀도 감소 (faq)
          if (Array.isArray(landing.faq)) {
            landing.faq = reduceFaqDensity(landing.faq, caseName);
            changed = true;
          }
        }

        if (changed) {
          caseData.updatedAt = today();
          await env.CASES.put(`case:${entry.slug}`, JSON.stringify(caseData));
          updatedKV++;
        } else {
          skipped++;
        }
      } catch (e) {
        errors.push({ slug: entry.slug, error: e.message });
      }
    }

    // 4. GitHub cases.json 일괄 업데이트
    let githubUpdated = 0;
    const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;

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
            if (!c.landings) continue;
            const caseName = c.caseName || "";
            for (const key of Object.keys(c.landings)) {
              const landing = c.landings[key];
              if (!landing) continue;
              const seed = `${c.slug}-${key}`;
              if (templates.scamIntro) landing.scamIntroItems = applyTemplate(pickVariant(templates.scamIntro, seed) || [], caseName);
              if (templates.scamMethod) landing.scamMethodItems = applyTemplate(pickVariant(templates.scamMethod, seed + "m") || [], caseName);
              if (templates.scamExample) {
                const items = applyTemplate(pickVariant(templates.scamExample, seed + "e") || [], caseName);
                if (items.length > 0) landing.victimCases = items;
              }
              if (Array.isArray(landing.body)) landing.body = reduceBodyDensity(landing.body, caseName);
              if (Array.isArray(landing.faq)) landing.faq = reduceFaqDensity(landing.faq, caseName);
            }
            c.updatedAt = today();
            githubUpdated++;
          }

          const newContent = JSON.stringify(cases, null, 2);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: "PUT",
            headers: githubHeaders(token),
            body: JSON.stringify({
              message: `Apply templates to ${githubUpdated} cases`,
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

    return json({
      ok: true,
      total: idx.length,
      updatedKV,
      githubUpdated,
      skipped,
      hasTemplates,
      errors,
    });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}

// ─── 템플릿 로딩 ─────────────────────────────────────────────────────────────────

async function readTemplates(env) {
  const { GITHUB_REPO_OWNER: owner, GITHUB_REPO_NAME: repo, GITHUB_BRANCH: branch = "main", GITHUB_TOKEN: token } = env;
  if (!owner || !repo || !token) return {};
  const read = async (filename) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/${filename}?ref=${branch}`,
        { headers: githubHeaders(token) },
      );
      if (!res.ok) return null;
      const file = await res.json();
      const raw = await readFileContent(file, token);
      return raw ? parseVariants(raw) : null;
    } catch { return null; }
  };
  const [scamIntro, scamMethod, scamExample] = await Promise.all([
    read("scam-intro.txt"),
    read("scam-method.txt"),
    read("scam-example.txt"),
  ]);
  return { scamIntro, scamMethod, scamExample };
}

function parseVariants(raw) {
  return String(raw).split(/^---\s*$/m)
    .map((b) => b.trim().split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((v) => v.length > 0);
}

function pickVariant(variants, seed) {
  if (!variants || variants.length === 0) return null;
  let h = 2166136261 >>> 0;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return variants[h % variants.length];
}

function applyTemplate(items, caseName) {
  const kw = primaryCaseKeyword(caseName) || caseName;
  return items.map((s) => s.replace(/000/g, kw));
}

// ─── SEO 밀도 감소 ───────────────────────────────────────────────────────────────

function reduceBodyDensity(body, caseName) {
  const kw = primaryCaseKeyword(caseName);
  if (!kw) return body;
  const re = new RegExp(escapeRegex(kw), "g");
  const subs = ["문제 업체", "운영 계정", "접근 계정", "거래 화면", "입금 안내자", "관리자 계정", "사이트 운영자", "상담 대상"];
  let n = 0;
  return body.map((p) =>
    p.replace(re, () => (++n <= 1 ? kw : subs[(n - 2) % subs.length])),
  );
}

function reduceFaqDensity(faq, caseName) {
  const names = [caseName, primaryCaseKeyword(caseName)].filter(Boolean);
  return faq.map((item, i) => {
    if (i < 3) return item;
    let q = item.question;
    names.forEach((n) => { q = q.split(n).join("").replace(/\s+/g, " ").trim(); });
    return { ...item, question: q };
  });
}

// ─── 텍스트 헬퍼 ─────────────────────────────────────────────────────────────────

function primaryCaseKeyword(name) {
  const clean = String(name || "").trim().replace(/\s*(사칭\s*사기|사칭|사기|탈출|스캠|scam)$/i, "").trim();
  const match = clean.match(/^(.+?사기)(?:\s+.+)?$/i);
  if (match) return match[1].trim();
  return clean ? `${clean} 사기` : "";
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── GitHub 헬퍼 ─────────────────────────────────────────────────────────────────

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
  };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    return decodeBase64(file.content).trim();
  }
  if (file.download_url) {
    const r = await fetch(file.download_url, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "static-landing-generator-admin" },
    });
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
  const binary = atob(str.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
