import { OG_IMAGE_VERSION, loadCases, loadPowerlinks } from "../_seo.js";

const EDGE_CACHE_SECONDS = 60 * 60 * 24 * 7;
const OVERLAY_WIDTH = 1078;
const OVERLAY_HEIGHT = 250;

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawSlug = decodeURIComponent(url.pathname.split("/").pop() || "")
    .replace(/\.(png|svg|webp|jpe?g)$/i, "")
    .slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;
  const data = isPowerlink
    ? await powerlinkOverlayData(env, slug)
    : await caseOverlayData(env, slug);
  const png = method === "HEAD" ? null : createOverlayPng({
    title: data.title || slug || "Landing page",
    subtitle: slug || "landing",
    seed: rawSlug || slug || "landing",
    badge: isPowerlink ? "POWERLINK" : "CASE",
  });

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
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

function createOverlayPng({ title = "", subtitle = "", seed = "", badge = "CASE" }) {
  const pixels = new Uint8Array(OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);
  const accent = accentColor(seed);
  const readableTitle = titleForBitmap(title, subtitle);
  const titleLines = wrapBitmapText(readableTitle, 28, 2);
  const subtitleLine = slugToLabel(subtitle).slice(0, 44);

  drawRect(pixels, 0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT, 17, 19, 24, 224);
  drawRect(pixels, 0, 0, 24, OVERLAY_HEIGHT, accent[0], accent[1], accent[2], 255);
  drawRect(pixels, 42, 20, Math.max(150, badge.length * 34), 36, accent[0], accent[1], accent[2], 255);
  drawText(pixels, badge, 68, 29, 4, [16, 16, 16, 255]);

  titleLines.forEach((line, index) => {
    drawText(pixels, line, 42, 86 + index * 56, 6, [255, 255, 255, 255]);
  });
  drawText(pixels, subtitleLine, 42, 205, 4, [243, 211, 138, 255]);

  return encodePng(OVERLAY_WIDTH, OVERLAY_HEIGHT, pixels);
}

function titleForBitmap(title = "", subtitle = "") {
  const source = cleanText(title);
  const ascii = source
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slugLabel = slugToLabel(subtitle);
  return (ascii && ascii.length >= 6 ? ascii : slugLabel) || "LANDING PAGE";
}

function slugToLabel(value = "") {
  return String(value || "")
    .replace(/^powerlink-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/[^a-zA-Z0-9.% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapBitmapText(value = "", maxChars = 28, maxLines = 2) {
  const words = slugToLabel(value).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words.length ? words : ["LANDING"]) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length <= maxChars ? word : word.slice(0, maxChars);
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push("LANDING PAGE");
  return lines.slice(0, maxLines);
}

function drawRect(pixels, x, y, width, height, r, g, b, a) {
  const x1 = Math.max(0, Math.floor(x));
  const y1 = Math.max(0, Math.floor(y));
  const x2 = Math.min(OVERLAY_WIDTH, Math.floor(x + width));
  const y2 = Math.min(OVERLAY_HEIGHT, Math.floor(y + height));
  for (let yy = y1; yy < y2; yy += 1) {
    for (let xx = x1; xx < x2; xx += 1) {
      const index = (yy * OVERLAY_WIDTH + xx) * 4;
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = a;
    }
  }
}

function drawText(pixels, value, x, y, scale, color) {
  const text = slugToLabel(value);
  let cursor = x;
  for (const char of text) {
    if (char === " ") {
      cursor += scale * 4;
      continue;
    }
    const glyph = FONT[char] || FONT["?"];
    drawGlyph(pixels, glyph, cursor, y, scale, color);
    cursor += scale * 6;
    if (cursor > OVERLAY_WIDTH - scale * 5) break;
  }
}

function drawGlyph(pixels, glyph, x, y, scale, color) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] !== "1") continue;
      drawRect(pixels, x + col * scale, y + row * scale, scale, scale, color[0], color[1], color[2], color[3]);
    }
  }
}

function encodePng(width, height, rgba) {
  const rowSize = width * 4 + 1;
  const raw = new Uint8Array(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * rowSize;
    const rgbaOffset = y * width * 4;
    raw[rawOffset] = 0;
    raw.set(rgba.subarray(rgbaOffset, rgbaOffset + width * 4), rawOffset + 1);
  }

  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdrData(width, height)),
    pngChunk("IDAT", zlibStore(raw)),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

function ihdrData(width, height) {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type, data) {
  const typeBytes = asciiBytes(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(concatBytes([typeBytes, data])));
  return chunk;
}

function zlibStore(data) {
  const blocks = [];
  blocks.push(new Uint8Array([0x78, 0x01]));
  for (let offset = 0; offset < data.length; offset += 65535) {
    const chunk = data.subarray(offset, Math.min(offset + 65535, data.length));
    const header = new Uint8Array(5);
    header[0] = offset + chunk.length >= data.length ? 1 : 0;
    header[1] = chunk.length & 255;
    header[2] = (chunk.length >>> 8) & 255;
    const nlen = (~chunk.length) & 0xffff;
    header[3] = nlen & 255;
    header[4] = (nlen >>> 8) & 255;
    blocks.push(header, chunk);
  }
  const checksum = new Uint8Array(4);
  new DataView(checksum.buffer).setUint32(0, adler32(data));
  blocks.push(checksum);
  return concatBytes(blocks);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function asciiBytes(value) {
  return Uint8Array.from(String(value), (char) => char.charCodeAt(0));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function accentColor(seed = "") {
  const colors = [[217, 170, 77], [69, 182, 169], [123, 181, 109], [92, 160, 216], [204, 122, 90], [181, 140, 224], [215, 195, 106]];
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

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
};
