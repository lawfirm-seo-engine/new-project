import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_VERSION,
  OG_IMAGE_WIDTH,
  caseOgImageUrl,
  loadCases,
  loadPowerlinks,
  powerlinkOgImageUrl,
} from "../_seo.js";

const EDGE_CACHE_SECONDS = 60 * 60 * 24 * 7;
const PANEL_WIDTH = 1078;
const PANEL_HEIGHT = 250;
const PANEL_LEFT = 88;
const PANEL_BOTTOM = 94;

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");
  const rawSlug = rawName.replace(/\.(png|webp|jpe?g|svg)$/i, "").slice(0, 180);
  const isPowerlink = rawSlug.startsWith("powerlink-");
  const slug = isPowerlink ? rawSlug.slice("powerlink-".length) : rawSlug;

  if (!/\.png$/i.test(rawName)) {
    const destination = isPowerlink
      ? powerlinkOgImageUrl(slug || "landing")
      : caseOgImageUrl(slug || "landing", url.origin);
    return Response.redirect(destination, 302);
  }

  const headers = imageHeaders(rawSlug || "landing");
  if (method === "HEAD") return new Response(null, { status: 200, headers });

  try {
    const template = await fetch(`${url.origin}/assets/og-template.png?v=${OG_IMAGE_VERSION}`, {
      cf: {
        cacheEverything: true,
        cacheTtl: EDGE_CACHE_SECONDS,
      },
    });

    if (!template.ok) {
      return errorResponse(`OG template fetch failed: ${template.status}`, template.status || 502);
    }

    const data = isPowerlink
      ? await powerlinkOverlayData(env, slug)
      : await caseOverlayData(env, slug);
    const png = await createOgPng(await template.arrayBuffer(), {
      title: data.title || slug || "Landing page",
      subtitle: slug || "landing",
      seed: rawSlug || slug || "landing",
      badge: isPowerlink ? "POWERLINK" : "CASE",
    });

    return new Response(png, { status: 200, headers });
  } catch (error) {
    return errorResponse(error?.message || "OG image generation failed", 500);
  }
}

function imageHeaders(slug = "landing") {
  return {
    "Content-Type": "image/png",
    "Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}, s-maxage=${EDGE_CACHE_SECONDS}, immutable`,
    "CDN-Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}`,
    "Cloudflare-CDN-Cache-Control": `public, max-age=${EDGE_CACHE_SECONDS}`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "ETag": `"og-png-${simpleHash(`${slug}-${OG_IMAGE_VERSION}`)}"`,
  };
}

function errorResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
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

async function createOgPng(templateBuffer, overlay) {
  const image = await decodePng(templateBuffer);
  drawOgPanel(image.rgb, image.width, image.height, overlay);
  return encodePngRgb(image.width, image.height, image.rgb);
}

function drawOgPanel(rgb, width, height, { title = "", subtitle = "", seed = "", badge = "CASE" }) {
  const accent = accentColor(seed);
  const panelX = Math.max(0, Math.min(width - PANEL_WIDTH, PANEL_LEFT));
  const panelY = Math.max(0, height - PANEL_BOTTOM - PANEL_HEIGHT);
  const readableTitle = titleForBitmap(title, subtitle);
  const titleLines = wrapBitmapText(readableTitle, 28, 2);
  const subtitleLine = slugToLabel(subtitle).slice(0, 44);

  drawRect(rgb, width, height, panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 17, 19, 24, 236);
  drawRect(rgb, width, height, panelX, panelY, PANEL_WIDTH, 4, accent[0], accent[1], accent[2], 255);
  drawRect(rgb, width, height, panelX, panelY + PANEL_HEIGHT - 4, PANEL_WIDTH, 4, accent[0], accent[1], accent[2], 255);
  drawRect(rgb, width, height, panelX, panelY, 4, PANEL_HEIGHT, accent[0], accent[1], accent[2], 255);
  drawRect(rgb, width, height, panelX + PANEL_WIDTH - 4, panelY, 4, PANEL_HEIGHT, accent[0], accent[1], accent[2], 255);
  drawRect(rgb, width, height, panelX, panelY, 24, PANEL_HEIGHT, accent[0], accent[1], accent[2], 255);
  drawRect(rgb, width, height, panelX + 42, panelY + 20, Math.max(150, badge.length * 34), 36, accent[0], accent[1], accent[2], 255);
  drawText(rgb, width, height, badge, panelX + 68, panelY + 29, 4, [16, 16, 16, 255]);

  titleLines.forEach((line, index) => {
    drawText(rgb, width, height, line, panelX + 42, panelY + 86 + index * 56, 6, [255, 255, 255, 255]);
  });
  drawText(rgb, width, height, subtitleLine, panelX + 42, panelY + 205, 4, [243, 211, 138, 255]);
}

async function decodePng(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!hasPngSignature(bytes)) throw new Error("Invalid PNG signature");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) throw new Error("Invalid PNG chunk length");

    if (type === "IHDR") {
      width = readUint32(bytes, dataStart);
      height = readUint32(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (type === "IDAT") {
      idat.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width !== OG_IMAGE_WIDTH || height !== OG_IMAGE_HEIGHT) {
    throw new Error(`Unexpected OG template size: ${width}x${height}`);
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`Unsupported PNG format: bit=${bitDepth} color=${colorType} interlace=${interlace}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const bpp = channels;
  const stride = width * channels;
  const raw = await inflateZlib(concatBytes(idat));
  const expected = height * (stride + 1);
  if (raw.length < expected) throw new Error("PNG data is shorter than expected");

  const rgb = new Uint8Array(width * height * 3);
  const row = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  let input = 0;
  let output = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[input];
    input += 1;
    row.set(raw.subarray(input, input + stride));
    input += stride;
    unfilterRow(row, prev, filter, bpp);

    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      rgb[output] = row[source];
      rgb[output + 1] = row[source + 1];
      rgb[output + 2] = row[source + 2];
      output += 3;
    }
    prev.set(row);
  }

  return { width, height, rgb };
}

function unfilterRow(row, prev, filter, bpp) {
  if (filter === 0) return;

  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i] || 0;
    const upLeft = i >= bpp ? prev[i - bpp] || 0 : 0;
    let predictor = 0;

    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = up;
    else if (filter === 3) predictor = Math.floor((left + up) / 2);
    else if (filter === 4) predictor = paeth(left, up, upLeft);
    else throw new Error(`Unsupported PNG filter: ${filter}`);

    row[i] = (row[i] + predictor) & 255;
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

async function encodePngRgb(width, height, rgb) {
  const rowSize = width * 3 + 1;
  const raw = new Uint8Array(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * rowSize;
    const rgbOffset = y * width * 3;
    raw[rawOffset] = 0;
    raw.set(rgb.subarray(rgbOffset, rgbOffset + width * 3), rawOffset + 1);
  }

  const compressed = await deflateZlib(raw);
  return concatBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdrData(width, height)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

function ihdrData(width, height) {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8;
  data[9] = 2;
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

async function inflateZlib(data) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("DecompressionStream is not available");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateZlib(data) {
  if (typeof CompressionStream === "function") {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      return zlibStore(data);
    }
  }
  return zlibStore(data);
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

function drawRect(rgb, width, height, x, y, rectWidth, rectHeight, r, g, b, a = 255) {
  const x1 = Math.max(0, Math.floor(x));
  const y1 = Math.max(0, Math.floor(y));
  const x2 = Math.min(width, Math.floor(x + rectWidth));
  const y2 = Math.min(height, Math.floor(y + rectHeight));
  for (let yy = y1; yy < y2; yy += 1) {
    for (let xx = x1; xx < x2; xx += 1) {
      blendPixel(rgb, width, xx, yy, r, g, b, a);
    }
  }
}

function drawText(rgb, width, height, value, x, y, scale, color) {
  const text = slugToLabel(value);
  let cursor = x;
  for (const char of text) {
    if (char === " ") {
      cursor += scale * 4;
      continue;
    }
    const glyph = FONT[char] || FONT["?"];
    drawGlyph(rgb, width, height, glyph, cursor, y, scale, color);
    cursor += scale * 6;
    if (cursor > width - scale * 5) break;
  }
}

function drawGlyph(rgb, width, height, glyph, x, y, scale, color) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] !== "1") continue;
      drawRect(rgb, width, height, x + col * scale, y + row * scale, scale, scale, color[0], color[1], color[2], color[3]);
    }
  }
}

function blendPixel(rgb, width, x, y, r, g, b, a) {
  const index = (y * width + x) * 3;
  if (a >= 255) {
    rgb[index] = r;
    rgb[index + 1] = g;
    rgb[index + 2] = b;
    return;
  }
  const inv = 255 - a;
  rgb[index] = Math.round((r * a + rgb[index] * inv) / 255);
  rgb[index + 1] = Math.round((g * a + rgb[index + 1] * inv) / 255);
  rgb[index + 2] = Math.round((b * a + rgb[index + 2] * inv) / 255);
}

function titleForBitmap(title = "", subtitle = "") {
  const source = cleanText(title);
  const asciiTitle = source
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slugLabel = slugToLabel(subtitle);
  return (asciiTitle && asciiTitle.length >= 6 ? asciiTitle : slugLabel) || "LANDING PAGE";
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

function ascii(bytes) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function hasPngSignature(bytes) {
  return bytes.length > 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10;
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
