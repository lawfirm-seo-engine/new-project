const CONFIG_KEY = "cafe-reels:asset-sets:v1";
const IMAGE_RE = /^(https?:\/\/|\/api\/criminal-board-image\?id=)/i;

const DEFAULT_SETS = {
  fraud: {
    label: "사기피해 원고",
    description: "일반 사칭 사기·투자사기·보이스피싱 카페 원고에 함께 쓰는 고정 이미지 세트입니다.",
    slots: [
      ...Array.from({ length: 12 }, (_, index) => ({
        slot: String(index + 1).padStart(2, "0"),
        label: `${String(index + 1).padStart(2, "0")} 이미지`,
        href: "https://gnlaw-criminal.co.kr/",
      })),
      { slot: "phone", label: "전화 이미지", href: "tel:02-6348-0406" },
      { slot: "kakao", label: "카카오톡 이미지", href: "https://pf.kakao.com/_WkdxfX/chat" },
    ],
  },
  "payment-suspension-release": {
    label: "계좌지급정지해제 원고",
    description: "지급정지해제 카페 원고에 함께 쓰는 고정 이미지 세트입니다.",
    slots: [
      ...Array.from({ length: 10 }, (_, index) => ({
        slot: String(index + 1).padStart(2, "0"),
        label: `${String(index + 1).padStart(2, "0")} 이미지`,
        href: "https://gnlaw-criminal.co.kr/",
      })),
      { slot: "phone", label: "전화 이미지", href: "tel:02-6348-0406" },
      { slot: "kakao", label: "카카오톡 이미지", href: "https://pf.kakao.com/_WkdxfX/chat" },
    ],
  },
};

export async function onRequestGet({ env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    return json({ ok: true, sets: await loadSets(env) });
  } catch (error) {
    return json({ ok: false, message: error?.message || "이미지 세트를 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.CASES) return json({ ok: false, message: "KV 바인딩이 없습니다." }, 500);
    const body = await request.json().catch(() => null);
    const setKey = String(body?.setKey || "").trim();
    if (!DEFAULT_SETS[setKey]) return json({ ok: false, message: "지원하지 않는 이미지 세트입니다." }, 400);

    const current = await loadSets(env);
    const defaultsBySlot = new Map(DEFAULT_SETS[setKey].slots.map((slot) => [slot.slot, slot]));
    const incoming = Array.isArray(body?.slots) ? body.slots : [];
    const nextSlots = DEFAULT_SETS[setKey].slots.map((defaultSlot) => {
      const item = incoming.find((slot) => String(slot?.slot || "") === defaultSlot.slot) || {};
      const url = normalizeUrl(item.url);
      const href = fixedContactHref(defaultSlot) || normalizeHref(item.href || defaultSlot.href);
      const label = normalizeLabel(item.label || defaultSlot.label);
      if (url && !IMAGE_RE.test(url)) throw new Error(`${defaultSlot.label}의 이미지 주소가 올바르지 않습니다.`);
      return {
        ...defaultsBySlot.get(defaultSlot.slot),
        label,
        href,
        url,
        updatedAt: url ? new Date().toISOString() : "",
      };
    });

    current[setKey] = {
      ...DEFAULT_SETS[setKey],
      slots: nextSlots,
      updatedAt: new Date().toISOString(),
    };
    await env.CASES.put(CONFIG_KEY, JSON.stringify(current));
    return json({ ok: true, set: current[setKey], sets: current });
  } catch (error) {
    return json({ ok: false, message: error?.message || "이미지 세트를 저장하지 못했습니다." }, 500);
  }
}

async function loadSets(env) {
  const saved = await env.CASES.get(CONFIG_KEY, "json").catch(() => null);
  const sets = structuredClone(DEFAULT_SETS);
  for (const [setKey, set] of Object.entries(saved || {})) {
    if (!sets[setKey]) continue;
    const savedBySlot = new Map((set.slots || []).map((slot) => [String(slot?.slot || ""), slot]));
    sets[setKey] = {
      ...sets[setKey],
      updatedAt: set.updatedAt || "",
      slots: sets[setKey].slots.map((defaultSlot) => ({
        ...defaultSlot,
        ...(savedBySlot.get(defaultSlot.slot) || {}),
        slot: defaultSlot.slot,
        label: normalizeLabel(savedBySlot.get(defaultSlot.slot)?.label || defaultSlot.label),
        href: fixedContactHref(defaultSlot) || normalizeHref(savedBySlot.get(defaultSlot.slot)?.href || defaultSlot.href),
        url: normalizeUrl(savedBySlot.get(defaultSlot.slot)?.url || ""),
      })),
    };
  }
  return sets;
}

function normalizeUrl(value = "") {
  return String(value || "").trim().slice(0, 600);
}

function normalizeHref(value = "") {
  const text = String(value || "").trim().slice(0, 600);
  if (!text) return "";
  if (/^(https?:\/\/|tel:|mailto:)/i.test(text)) return text;
  return "";
}

function fixedContactHref(slot = {}) {
  return slot.slot === "phone" || slot.slot === "kakao" ? slot.href : "";
}

function normalizeLabel(value = "") {
  return String(value || "").trim().slice(0, 60);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
