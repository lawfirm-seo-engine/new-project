const GROUPS = [
  { host: "new-project-9o2.pages.dev", label: "형사고소", tone: "법적 대응", accent: "#d9b46f" },
  { host: "new-project-b.pages.dev", label: "민사소송", tone: "회수 절차", accent: "#9fd8cb" },
  { host: "new-project-c.pages.dev", label: "성공사례", tone: "피해 회수", accent: "#f0c987" },
  { host: "new-project-d.pages.dev", label: "AI브리핑", tone: "사건 정보", accent: "#8ecae6" },
  { host: "new-project-e.pages.dev", label: "전체허브", tone: "통합 안내", accent: "#c7d3a2" },
];

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = decodeURIComponent(url.pathname.split("/").pop() || "hub.webp").replace(/\.webp$/i, "");
  const group = GROUPS.find((item) => item.host === url.host) || GROUPS[0];
  const title = slug === "hub" ? "피해사건 통합 허브" : slugToTitle(slug);
  const templateUrl = `${url.origin}/assets/og-template.png`;
  const svg = createOgSvg({ title, group, templateUrl });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000",
      "Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function slugToTitle(slug) {
  return slug
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function createOgSvg({ title, group, templateUrl }) {
  const wrapped = wrapText(title, 18).slice(0, 3);
  const titleLines = wrapped
    .map((line, index) => `<text x="72" y="${252 + index * 70}" class="title">${escapeXml(line)}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000000" stop-opacity=".78"/>
      <stop offset=".48" stop-color="#000000" stop-opacity=".48"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".08"/>
    </linearGradient>
  </defs>
  <style>
    .label { fill: ${group.accent}; font: 700 30px Arial, 'Noto Sans KR', sans-serif; letter-spacing: 0; }
    .title { fill: #ffffff; font: 800 58px Arial, 'Noto Sans KR', sans-serif; letter-spacing: 0; }
    .sub { fill: rgba(255,255,255,.86); font: 400 28px Arial, 'Noto Sans KR', sans-serif; letter-spacing: 0; }
    .brand { fill: rgba(255,255,255,.72); font: 700 24px Arial, 'Noto Sans KR', sans-serif; letter-spacing: 0; }
  </style>
  <image href="${escapeXml(templateUrl)}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <rect x="48" y="64" width="510" height="502" rx="22" fill="rgba(0,0,0,.28)" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
  <text x="72" y="128" class="label">${escapeXml(group.label)} · ${escapeXml(group.tone)}</text>
  ${titleLines}
  <text x="72" y="500" class="sub">사건 개요 · 증거 보존 · 회수 대응</text>
  <text x="72" y="544" class="brand">피해사건 대응 센터</text>
</svg>`;
}

function wrapText(text, limit) {
  const words = String(text || "").split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (next.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
