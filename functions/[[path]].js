// Dynamic landing page renderer — reads case data from Cloudflare KV
// Handles: /[pathPrefix]/[slug]/ for each of the 5 groups

const GROUPS = {
  "new-project-9o2.pages.dev": {
    key: "a", pathPrefix: "prosecute", bodyClass: "domain-a",
    siteName: "피해금 추적 법률센터", shortName: "형사고소 센터",
    intent: "형사고소 · 법적제재 · 형사합의 · 회수", tone: "긴급 대응",
    ctaTitle: "형사고소 가능성 확인",
    ctaText: "입금 내역, 대화 내용, 사이트 주소를 기준으로 고소장 작성과 계좌 추적 방향을 검토합니다.",
    ctaLabel: "피해 사실 접수", ogType: "article",
    descriptionSuffix: "형사고소, 법적제재, 형사합의, 피해금 회수 가능성을 사건별로 정리합니다.",
    naverVerification: "bfc9894c3704ecb4fae524d6dbbb1dc61ecb6488",
    siteUrl: "https://new-project-9o2.pages.dev",
  },
  "new-project-b.pages.dev": {
    key: "b", pathPrefix: "civil", bodyClass: "domain-b",
    siteName: "민사 회수 전략실", shortName: "민사 회수",
    intent: "민사소송 · 가압류 · 손해배상 · 부당이득반환", tone: "회수 전략",
    ctaTitle: "민사 회수 경로 검토",
    ctaText: "상대방 특정 가능성, 입금 계좌, 계약·약정 자료를 기준으로 보전처분과 본안소송을 함께 봅니다.",
    ctaLabel: "회수 절차 문의", ogType: "article",
    descriptionSuffix: "민사소송, 가압류, 손해배상, 부당이득반환, 판결 및 민사 합의 회수 절차를 안내합니다.",
    naverVerification: "055ad63c2d7af8f9a348cd098a356d22ffbc5d49",
    siteUrl: "https://new-project-b.pages.dev",
  },
  "new-project-c.pages.dev": {
    key: "c", pathPrefix: "success", bodyClass: "domain-c",
    siteName: "피해 회수 성공사례", shortName: "성공사례",
    intent: "성공사례 · 지역 · 회수율 · 전액 또는 일부 회수", tone: "결과 중심",
    ctaTitle: "유사 성공사례 비교",
    ctaText: "피해 유형과 증거 상태가 비슷한 사례를 기준으로 예상 대응 순서와 회수 가능성을 확인합니다.",
    ctaLabel: "사례 비교 문의", ogType: "article",
    descriptionSuffix: "성공사례, 지역, 회수율, 전액 또는 일부 회수 흐름을 사건별로 정리합니다.",
    naverVerification: "75b446d5dc7c0006c1b15c9e51f46f71345e03d8",
    siteUrl: "https://new-project-c.pages.dev",
  },
  "new-project-d.pages.dev": {
    key: "d", pathPrefix: "briefing", bodyClass: "domain-d",
    siteName: "피해 사건 정보", shortName: "사건 정보",
    intent: "사건 개요 · 대응 방법 · 정보 요약", tone: "정보 요약",
    ctaTitle: "사건 구조 확인",
    ctaText: "사건 개요, 피해 패턴, 증거 보존 순서를 먼저 파악한 뒤 필요한 절차를 선택합니다.",
    ctaLabel: "정보 확인", ogType: "article",
    descriptionSuffix: "네이버 검색 노출을 고려해 사건 개요, 피해 구조, 대응 방법을 정보성 문체로 정리합니다.",
    naverVerification: "a27aaeb3544f1e30860eed6045a0c50abe6705b5",
    siteUrl: "https://new-project-d.pages.dev",
  },
  "new-project-e.pages.dev": {
    key: "e", pathPrefix: "case", bodyClass: "domain-e",
    siteName: "사기피해 통합 허브", shortName: "전체 허브",
    intent: "전체 사건 허브 · 유형별 연결 · 관련 사건", tone: "통합 탐색",
    ctaTitle: "유형별 대응 보기",
    ctaText: "하나의 사건을 법적 대응, 회수 절차, 사례, 정보 요약 관점으로 나누어 확인할 수 있습니다.",
    ctaLabel: "관련 정보 확인", ogType: "article",
    descriptionSuffix: "전체 사건 허브에서 형사, 민사, 성공사례, 사건정보를 사건별로 연결합니다.",
    naverVerification: "ffa1a3b7c30df21443214e8514e4986358489efe",
    siteUrl: "https://new-project-e.pages.dev",
  },
};

const CROSS_LINKS = [
  { key: "a", label: "형사고소", url: "https://new-project-9o2.pages.dev", prefix: "prosecute" },
  { key: "b", label: "민사소송", url: "https://new-project-b.pages.dev", prefix: "civil" },
  { key: "c", label: "성공사례", url: "https://new-project-c.pages.dev", prefix: "success" },
  { key: "d", label: "사건정보", url: "https://new-project-d.pages.dev", prefix: "briefing" },
  { key: "e", label: "전체허브", url: "https://new-project-e.pages.dev", prefix: "case" },
];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 정적 파일·다른 Worker로 패스스루
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/og/") ||
    pathname.startsWith("/admin/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/sitemap-index.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/rss.xml" ||
    pathname.endsWith(".txt") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".webmanifest")
  ) {
    return next();
  }

  const group = GROUPS[url.host];
  if (!group) return next();

  // /[pathPrefix]/[slug]/ 형태의 랜딩 페이지만 처리
  const parts = pathname.replace(/^\/|\/$/g, "").split("/");
  if (parts.length !== 2 || parts[0] !== group.pathPrefix || !parts[1]) {
    return next();
  }

  const slug = decodeURIComponent(parts[1]);

  // KV 우선, 없으면 GitHub fallback
  let caseData = null;

  if (env.CASES) {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) caseData = JSON.parse(raw);
  }

  if (!caseData) {
    caseData = await fetchCaseFromGitHub(slug, env);
  }

  if (!caseData) {
    return new Response("사건을 찾을 수 없습니다.", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const html = renderLanding(caseData, group, url.origin);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderLanding(caseData, group, origin) {
  const landing = caseData.landings?.[group.key] || {};
  const rawCaseName = caseData.caseName || "";
  const dispName = normalizeCaseName(rawCaseName);
  const pageTitle = groupPageTitle(rawCaseName, group.key);
  const canonical = `${group.siteUrl}/${group.pathPrefix}/${encodeURIComponent(caseData.slug)}/`;
  const ogImage = caseData.thumbnailUrl || landing.ogImage || `${group.siteUrl}/og/${caseData.slug}.webp`;
  const today = new Date().toISOString().slice(0, 10);
  const isoNow = new Date().toISOString();
  const keyword = `${baseCaseName(rawCaseName)} 사기, ${baseCaseName(rawCaseName)} 사칭 사기`;

  const headExtra = [
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="NaverBot" content="All">`,
    `<meta name="Yeti" content="All">`,
    group.naverVerification ? `<meta name="naver-site-verification" content="${group.naverVerification}">` : "",
    `<meta name="theme-color" content="${themeColor(group.key)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(group.siteName)} RSS" href="/rss.xml">`,
    `<link rel="sitemap" type="application/xml" href="/sitemap-index.xml">`,
    `<link rel="preload" as="image" href="/assets/og-template.png">`,
    `<link rel="prefetch" href="${esc(ogImage)}" as="image">`,
    `<meta property="article:published_time" content="${isoNow}">`,
    `<meta property="article:modified_time" content="${isoNow}">`,
    `<meta property="article:author" content="대온 법률사무소">`,
    `<meta property="article:section" content="${esc(group.intent)}">`,
    `<meta name="author" content="대온 법률사무소">`,
    keyword ? `<meta name="keywords" content="${esc(keyword)}">` : "",
  ].filter(Boolean).join("\n  ");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: pageTitle, url: canonical, inLanguage: "ko-KR",
        datePublished: today, dateModified: today,
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
        author: ORGANIZATION,
      },
      {
        "@type": group.key === "d" ? "NewsArticle" : "Article",
        "@id": `${canonical}#article`,
        headline: pageTitle, url: canonical, inLanguage: "ko-KR",
        datePublished: today, dateModified: today,
        author: ORGANIZATION, publisher: ORGANIZATION,
        isPartOf: { "@id": `${canonical}#webpage` },
        keywords: keyword,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: group.siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: rawCaseName, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: (landing.faq || []).map((item) => ({
          "@type": "Question", name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  }, null, 2);

  const ogThumbnail = caseData.thumbnailUrl
    ? `<img src="${esc(caseData.thumbnailUrl)}" alt="${esc(pageTitle)}" class="hero-thumb" loading="lazy">`
    : "";

  const content = createLandingContent(landing, group, caseData);
  const footerLinks = CROSS_LINKS.map((l) => {
    const active = l.key === group.key ? "is-active" : "";
    return `<a class="${active}" href="${l.url}/">${esc(l.label)}</a>`;
  }).join("\n");

  return pageTemplate({
    title: esc(pageTitle),
    description: esc(landing.description || ""),
    canonical,
    ogType: group.ogType,
    ogTitle: esc(pageTitle),
    ogDescription: esc(landing.ogDescription || landing.description || ""),
    ogImage: esc(ogImage),
    siteName: esc(group.siteName),
    headExtra,
    schema,
    bodyClass: `${group.bodyClass} landing-page`,
    tone: esc(group.tone),
    h1: esc(pageTitle),
    ogThumbnail,
    summary: esc(landing.description || ""),
    content,
    intent: esc(group.intent),
    ctaTitle: esc(group.ctaTitle),
    ctaText: esc(group.ctaText),
    ctaLabel: esc(group.ctaLabel),
    footerLinks,
    headerCall: `<a class="header-call" href="#consult">상담 접수</a>`,
  });
}

function createLandingContent(landing, group, caseData) {
  const name = esc(normalizeCaseName(caseData.caseName));
  const rawCaseName = caseData.caseName || "";
  const slug = esc(caseData.slug);
  const cn = esc(normalizeCaseName(caseData.caseName));
  const siteName = esc(group.siteName);

  const trackScript = `<script>(function(){fetch('/api/track-view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:'${slug}'})}).catch(function(){});})();</script>`;
  const memoSection = caseData.memo
    ? `<section class="article-block memo-section"><h2>운영자 안내</h2><p>${esc(caseData.memo)}</p></section>`
    : "";

  const faqSection = group.key === "d"
    ? `<section class="article-block brief-card"><h2>${name} 사건 개요</h2>${paragraphs(landing.body)}</section>
<section class="article-block"><h2>${name} 피해 유형</h2>${list(landing.victimCases)}</section>
<section class="article-block faq"><h2>자주 묻는 질문 (FAQ)</h2>${faqHtml(landing.faq, rawCaseName)}</section>`
    : `<section class="article-block"><p class="section-kicker">${esc(group.intent)}</p><h2>${name} 핵심 대응</h2>${paragraphs(landing.body)}</section>
<section class="article-block"><h2>피해 사례</h2>${list(landing.victimCases)}</section>
<section class="article-block faq"><h2>FAQ</h2>${faqHtml(landing.faq, rawCaseName)}</section>`;

  const relatedLinks = createRelatedLinks(caseData, group.key);
  const consultForm = createConsultForm(cn, siteName);
  const floatingWidgets = createFloatingWidgets(cn, siteName, slug);

  return [faqSection, memoSection, relatedLinks, consultForm, floatingWidgets, trackScript].filter(Boolean).join("\n");
}

function createConsultForm(cn, siteName) {
  return `<section class="article-block consult-form-section" id="consult">
  <h2>상담 접수</h2>
  <p>이름, 연락처, 피해금액을 입력하시면 담당자가 빠르게 연락드립니다.</p>
  <form class="consult-form" id="consultForm">
    <input type="text" name="cname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="phone" placeholder="연락처 (010-xxxx-xxxx)" required autocomplete="tel">
    <input type="text" name="amount" placeholder="피해금액 (예: 500만원)" required>
    <button type="submit">상담 접수</button>
  </form>
  <p class="consult-msg" id="consultMsg"></p>
  <script>
    document.getElementById('consultForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = this.querySelector('button');
      var msg = document.getElementById('consultMsg');
      btn.disabled = true; btn.textContent = '접수 중...';
      msg.textContent = ''; msg.className = 'consult-msg';
      try {
        var res = await fetch('https://new-project-9o2.pages.dev/api/submit-consult', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.cname.value, phone: this.phone.value, amount: this.amount.value, caseName: '${cn}', domain: '${siteName}' })
        });
        var data = await res.json();
        if (data.ok) { msg.textContent = '상담 접수가 완료되었습니다. 담당자가 연락드립니다.'; msg.className = 'consult-msg ok'; this.reset(); }
        else { msg.textContent = data.message || '접수 중 오류가 발생했습니다.'; msg.className = 'consult-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
      } catch(err) { msg.textContent = '접수 중 오류가 발생했습니다.'; msg.className = 'consult-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
    });
  </script>
</section>`;
}

function createFloatingWidgets(cn, siteName, slug) {
  return `<div class="floating-contact">
  <a href="tel:02-6952-3695" class="float-btn phone">전화문의</a>
  <a href="http://pf.kakao.com/_xcypmn/chat" class="float-btn kakao" target="_blank" rel="noopener noreferrer">카톡상담</a>
</div>
<div class="sticky-bar" id="stickyBar">
  <span class="sticky-title">긴급상담 ｜ 02-6952-3695</span>
  <form class="sticky-form" id="stickyConsultForm">
    <input type="text" name="sname" placeholder="이름" required autocomplete="name">
    <input type="tel" name="sphone" placeholder="연락처" required autocomplete="tel">
    <input type="text" name="samount" placeholder="피해금액" required>
    <button type="submit">상담 접수</button>
  </form>
  <span id="stickyMsg" class="sticky-msg"></span>
</div>
<script>
  document.getElementById('stickyConsultForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = this.querySelector('button'); var msg = document.getElementById('stickyMsg');
    btn.disabled = true; btn.textContent = '접수 중...';
    msg.textContent = ''; msg.className = 'sticky-msg';
    try {
      var res = await fetch('https://new-project-9o2.pages.dev/api/submit-consult', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.sname.value, phone: this.sphone.value, amount: this.samount.value, caseName: '${cn}', domain: '${siteName}' })
      });
      var data = await res.json();
      if (data.ok) { msg.textContent = '접수 완료!'; msg.className = 'sticky-msg ok'; this.reset(); btn.disabled = false; btn.textContent = '상담 접수'; }
      else { msg.textContent = data.message || '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
    } catch(err) { msg.textContent = '오류 발생'; msg.className = 'sticky-msg err'; btn.disabled = false; btn.textContent = '상담 접수'; }
  });
</script>`;
}

function createRelatedLinks(caseData, currentKey) {
  const name = esc(caseData.caseName || "");
  const slug = encodeURIComponent(caseData.slug);
  return `<div class="related-grid">
    ${CROSS_LINKS.map((l) => {
      const active = l.key === currentKey ? " is-active" : "";
      return `<a class="related-card${active}" href="${l.url}/${l.prefix}/${slug}/"><span>${l.label}</span><strong>${name}</strong></a>`;
    }).join("\n")}
  </div>`;
}

// ─── Template ─────────────────────────────────────────────────────────────────

function pageTemplate(d) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${d.title}</title>
  <meta name="description" content="${d.description}">
  <link rel="canonical" href="${d.canonical}">
  <meta property="og:type" content="${d.ogType}">
  <meta property="og:title" content="${d.ogTitle}">
  <meta property="og:description" content="${d.ogDescription}">
  <meta property="og:image" content="${d.ogImage}">
  <meta property="og:url" content="${d.canonical}">
  <meta property="og:site_name" content="${d.siteName}">
  <meta property="og:locale" content="ko_KR">
  ${d.headExtra}
  <script type="application/ld+json">${d.schema}</script>
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="${d.bodyClass}">
  <header class="site-header">
    <a class="brand" href="/" aria-label="대온 법률사무소 홈">
      <img src="/assets/logo.png" alt="대온 법률사무소">
    </a>
    ${d.headerCall}
  </header>
  <main>
    <section class="hero">
      <p class="eyebrow">${d.tone}</p>
      <h1>${d.h1}</h1>
      ${d.ogThumbnail}
      <p class="summary">${d.summary}</p>
    </section>
    <div class="page-shell">
      ${d.content}
    </div>
    <section id="consult" class="cta">
      <p class="eyebrow">${d.intent}</p>
      <h2>${d.ctaTitle}</h2>
      <p>${d.ctaText}</p>
      <a href="tel:0269523695">${d.ctaLabel}</a>
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="/assets/logo.png" alt="대온 법률사무소">
      </div>
      <nav class="footer-nav" aria-label="카테고리 바로가기">${d.footerLinks}</nav>
      <address class="footer-info">
        <span>대표변호사 : 신동우</span>
        <span>주소 : 서울 서초구 서초대로 250 스타갤러리브릿지빌딩 802호</span>
        <span>전화번호 : <a href="tel:0269523695">02-6952-3695</a></span>
        <span>이메일 : <a href="mailto:noleosi@daeonlaw.co.kr">noleosi@daeonlaw.co.kr</a></span>
      </address>
      <p class="copyright">COPYRIGHT © 2024 대온 법률사무소 All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORGANIZATION = {
  "@type": "Organization",
  "@id": "https://new-project-9o2.pages.dev/#organization",
  name: "대온 법률사무소",
  url: "https://new-project-9o2.pages.dev",
  logo: { "@type": "ImageObject", url: "https://new-project-9o2.pages.dev/assets/logo.png" },
};

function esc(v = "") {
  return String(v).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#039;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function normalizeCaseName(name) {
  let clean = String(name || "").trim().replace(/\s*(?:사칭\s*사기|사칭|사기|탈출|스캠|scam)\s*$/i, "").trim();
  return /사기/.test(clean) ? `${clean} 사칭` : `${clean} 사칭 사기`;
}

function baseCaseName(name) {
  return String(name || "").trim().replace(/\s*(사칭\s*사기|사기|탈출|스캠|scam)$/i, "").trim();
}

function groupPageTitle(name, key) {
  const base = baseCaseName(name);
  const s = { a: "사칭 사기 형사 고소", b: "사칭 사기 민사 소송", c: "사칭 사기 피해금 회수", d: "사칭 사기 피해 접수", e: "사칭 사기 피해 진행현황" };
  return `${base} ${s[key] || "사칭 사기"}`;
}

function themeColor(key) {
  return { a: "#111827", b: "#173b57", c: "#174333", d: "#25314d", e: "#3b2f52" }[key] || "#111827";
}

function paragraphs(items = []) {
  return (items || []).map((item) => `<p>${esc(item)}</p>`).join("\n");
}

function list(items = []) {
  return `<ul>${(items || []).map((item) => `<li>${esc(item)}</li>`).join("\n")}</ul>`;
}

function faqHtml(items = [], caseName = "") {
  return (items || []).map((item, i) => {
    let q = item.question || "";
    if (i < 3 && caseName) q = `[${caseName}] ` + q.replace(/^\[[^\]]*\]\s*/, "");
    return `<details><summary>${esc(q)}</summary><p>${esc(item.answer)}</p></details>`;
  }).join("\n");
}

// ─── GitHub Fallback ─────────────────────────────────────────────────────────

async function fetchCaseFromGitHub(slug, env) {
  try {
    const owner = env.GITHUB_REPO_OWNER;
    const repo = env.GITHUB_REPO_NAME;
    const branch = env.GITHUB_BRANCH || "main";
    const token = env.GITHUB_TOKEN;
    if (!owner || !repo || !token) return null;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/cases.json?ref=${branch}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "static-landing-generator",
      },
    });
    if (!res.ok) return null;

    const file = await res.json();
    let text = "";
    if (file.content && file.encoding !== "none") {
      const clean = file.content.replace(/\n/g, "");
      text = new TextDecoder().decode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
    } else if (file.download_url) {
      const dr = await fetch(file.download_url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "static-landing-generator",
        },
      });
      if (dr.ok) text = await dr.text();
    }

    if (!text) return null;
    const cases = JSON.parse(text.trim());
    return cases.find((c) => c.slug === slug) || null;
  } catch {
    return null;
  }
}
