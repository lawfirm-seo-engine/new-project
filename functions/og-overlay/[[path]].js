import { OG_IMAGE_HEIGHT, OG_IMAGE_VERSION, OG_IMAGE_WIDTH, loadCases, loadPowerlinks } from "../_seo.js";

const EDGE_CACHE_SECONDS = 60 * 60 * 24 * 7;

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawSlug = decodeURIComponent(url.pathname.split("/").pop() || "")
    .replace(/\.(svg|webp|png|jpe?g)$/i, "")
    .slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;
  const data = isPowerlink
    ? await powerlinkOverlayData(env, slug)
    : await caseOverlayData(env, slug);
  const svg = createOgOverlaySvg({
    title: data.title || slug || "Landing page",
    subtitle: slug || "landing",
    seed: rawSlug || slug || "landing",
    badge: isPowerlink ? "POWERLINK" : "CASE",
  });

  return new Response(method === "HEAD" ? null : svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}, s-maxage=${EDGE_CACHE_SECONDS}, immutable`,
      "CDN-Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}`,
      "Cloudflare-CDN-Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
      "ETag": `"og-overlay-${simpleHash(`${rawSlug}-${OG_IMAGE_VERSION}`)}"`,
    },
  });
}

async function caseOverlayData(env, slug = "") {
  const cases = await loadCases(env);
  const item = cases.find((candidate) => candidate?.slug === slug);
  return {
    title: item?.caseName || item?.name || slug,
  };
}

async function powerlinkOverlayData(env, slug = "") {
  const powerlinks = await loadPowerlinks(env);
  const item = powerlinks.find((candidate) => candidate?.slug === slug);
  return {
    title: item?.title || item?.h1 || slug,
  };
}

function createOgOverlaySvg({ title = "", subtitle = "", seed = "", badge = "CASE" }) {
  const accent = accentColor(seed);
  const titleLines = wrapOgText(cleanOgText(title), 24, 2);
  const subtitleLine = cleanOgText(subtitle).slice(0, 70);
  const badgeWidth = Math.max(150, badge.length * 24);
  const lineSvg = titleLines
    .map((line, index) => {
      const y = 1006 + index * 62;
      return `<text x="130" y="${y}" class="title">${escapeXml(line)}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0.62" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.56"/>
    </linearGradient>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.38"/>
    </filter>
    <style>
      .title{font-family:'Noto Sans CJK KR','Noto Sans KR','Malgun Gothic',Arial,sans-serif;font-size:50px;font-weight:800;fill:#fff;letter-spacing:0}
      .meta{font-family:Arial,sans-serif;font-size:24px;font-weight:700;fill:#f3d38a;letter-spacing:0}
      .badge{font-family:Arial,sans-serif;font-size:22px;font-weight:800;fill:#101010;letter-spacing:0}
    </style>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#shade)"/>
  <g filter="url(#softShadow)">
    <rect x="88" y="910" width="1078" height="250" rx="18" fill="#111318" fill-opacity="0.88" stroke="${accent}" stroke-width="4"/>
    <rect x="88" y="910" width="24" height="250" rx="12" fill="${accent}"/>
    <rect x="128" y="930" width="${badgeWidth}" height="36" rx="18" fill="${accent}"/>
    <text x="154" y="956" class="badge">${escapeXml(badge)}</text>
    ${lineSvg}
    <text x="130" y="1133" class="meta">${escapeXml(subtitleLine)}</text>
  </g>
</svg>`;
}

function cleanOgText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapOgText(value = "", maxUnits = 24, maxLines = 2) {
  const words = cleanOgText(value).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = "";
  };

  for (const word of words.length ? words : [value]) {
    const next = current ? `${current} ${word}` : word;
    if (displayUnits(next) <= maxUnits) {
      current = next;
      continue;
    }
    if (current) pushCurrent();
    if (displayUnits(word) <= maxUnits) {
      current = word;
    } else {
      for (const chunk of splitByUnits(word, maxUnits)) {
        if (lines.length >= maxLines) break;
        lines.push(chunk);
      }
      current = "";
    }
    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines) pushCurrent();
  const clipped = lines.slice(0, maxLines);
  if (lines.length > maxLines || displayUnits(cleanOgText(value)) > maxUnits * maxLines) {
    clipped[clipped.length - 1] = trimToUnits(clipped[clipped.length - 1], maxUnits - 3) + "...";
  }
  return clipped.length ? clipped : ["Landing page"];
}

function splitByUnits(value = "", maxUnits = 24) {
  const chunks = [];
  let current = "";
  for (const char of String(value)) {
    if (displayUnits(current + char) > maxUnits) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function trimToUnits(value = "", maxUnits = 24) {
  let out = "";
  for (const char of String(value)) {
    if (displayUnits(out + char) > maxUnits) break;
    out += char;
  }
  return out.trim();
}

function displayUnits(value = "") {
  let units = 0;
  for (const char of String(value)) units += char.charCodeAt(0) > 127 ? 2 : 1;
  return units;
}

function accentColor(seed = "") {
  const colors = ["#d9aa4d", "#45b6a9", "#7bb56d", "#5ca0d8", "#cc7a5a", "#b58ce0", "#d7c36a"];
  return colors[seededInt(`og-${seed}`, 0, colors.length - 1)];
}

function seededInt(seed, min, max) {
  let hash = 2166136261;
  for (const char of String(seed || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return min + (Math.abs(hash) % (max - min + 1));
}

function simpleHash(value = "") {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
