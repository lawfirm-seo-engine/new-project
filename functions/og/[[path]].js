const GROUPS = [
  { host: "new-project-9o2.pages.dev", label: "형사고소", bg: "#12355b", accent: "#f4c95d" },
  { host: "new-project-b.pages.dev", label: "민사소송", bg: "#213f36", accent: "#9fd8cb" },
  { host: "new-project-c.pages.dev", label: "성공사례", bg: "#4a274f", accent: "#f0a6ca" },
  { host: "new-project-d.pages.dev", label: "AI브리핑", bg: "#1e2f55", accent: "#8ecae6" },
  { host: "new-project-e.pages.dev", label: "전체허브", bg: "#2e3440", accent: "#a3be8c" },
];

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = decodeURIComponent(url.pathname.split("/").pop() || "hub.webp").replace(/\.webp$/i, "");
  const group = GROUPS.find((item) => item.host === url.host) || GROUPS[0];
  const title = slug === "hub" ? "피해사건 통합 허브" : slugToTitle(slug);
  const svg = createOgSvg({ title, group });

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

function createOgSvg({ title, group }) {
  const safeTitle = escapeXml(title);
  const wrapped = wrapText(safeTitle, 23).slice(0, 3);
  const lines = wrapped
    .map((line, index) => `<text x="80" y="${286 + index * 72}" class="title">${line}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>
    .label { fill: ${group.accent}; font: 700 34px Arial, sans-serif; letter-spacing: 0; }
    .title { fill: #ffffff; font: 800 60px Arial, sans-serif; letter-spacing: 0; }
    .sub { fill: rgba(255,255,255,.78); font: 400 30px Arial, sans-serif; letter-spacing: 0; }
  </style>
  <rect width="1200" height="630" fill="${group.bg}"/>
  <rect x="44" y="44" width="1112" height="542" rx="28" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
  <circle cx="1015" cy="120" r="150" fill="${group.accent}" opacity=".2"/>
  <circle cx="1084" cy="502" r="210" fill="#ffffff" opacity=".08"/>
  <text x="80" y="128" class="label">${escapeXml(group.label)} 피해 대응</text>
  ${lines}
  <text x="80" y="536" class="sub">사건 개요 · 증거 보존 · 회수 대응 정보</text>
</svg>`;
}

function wrapText(text, limit) {
  const words = text.split(" ");
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
