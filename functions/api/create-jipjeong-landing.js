import {
  GROUPS,
  INDEXNOW_KEY as DEFAULT_INDEXNOW_KEY,
  buildLandingUrl,
  caseOgImageUrl,
} from "../_seo.js";

const GITHUB_FILE_PATH = "data/cases.json";
const RECOVERY_HOST = "gnlaw-recovery.co.kr";
const RECOVERY_SITE_URL = "https://gnlaw-recovery.co.kr";
const RECOVERY_GROUP = GROUPS.find((group) => group.host === RECOVERY_HOST);
const TARGET_GROUPS = ["c"];
const CREATED_BY = "jipjeong-manual";

// ─── 기준 템플릿 식별자 ─────────────────────────────────────────────────────
// 참조 페이지: 한국산업은행-지급정지-해결-중랑변호사
// BANK / REGION / ACTION 플레이스홀더를 치환하여 원고 생성
const TPLB = "BANK";    // 은행명
const TPLR = "REGION";  // 지역명
const TPLA = "ACTION";  // 행위 키워드 (지급정지 해결 / 지급정지 이의신청 / 계좌 지급정지 해제 등)

const TEMPLATE_BODY = [
  `${TPLB} ${TPLA} ${TPLR}변호사 — ${TPLB} ${TPLA}이란?`,
  `${TPLB} ${TPLA}은 금융사기 피해 신고 등으로 인해 지급정지된 계좌의 사실관계를 확인하고, 거래의 정당성을 객관적으로 설명하기 위한 절차를 의미합니다.`,
  `최근에는 보이스피싱, 투자사기, 가상자산 거래, 팀미션 사기, 중고거래 사기 등 다양한 유형의 금융사기로 인해 정상적인 거래를 한 계좌도 지급정지 대상이 되는 사례가 증가하고 있습니다. 따라서 지급정지 통보를 받았다면 지급정지 사유와 거래 경위를 먼저 확인하는 것이 중요합니다.`,
  `${TPLB} ${TPLA} ${TPLR}변호사는 거래 구조와 지급정지 사유를 종합적으로 검토하여 필요한 자료를 준비하고 대응 방향을 안내합니다.`,
  `## ${TPLB} 지급정지가 발생하는 대표적인 원인`,
  `다음과 같은 경우 지급정지가 이루어지는 사례가 자주 발생합니다.`,
  `보이스피싱 피해금이 입금된 계좌로 확인된 경우 / 투자금 또는 리딩방 피해금이 유입된 경우 / 가상자산 거래 과정에서 피해금이 이동한 경우 / 중고거래 거래대금이 피해금으로 신고된 경우 / 타인에게 계좌를 제공하거나 명의를 빌려준 경우 / 오픈채팅·메신저 거래가 피해 신고와 연결된 경우`,
  `실제 거래 당사자가 범죄를 의도하지 않았더라도 거래 구조에 따라 지급정지가 이루어질 수 있으므로 자금 흐름과 거래 경위를 객관적으로 설명하는 자료가 중요합니다.`,
  `## ${TPLB} ${TPLA} 절차`,
  `지급정지 통보를 받았다면 일반적으로 다음과 같은 순서로 진행하는 것이 도움이 됩니다.`,
  `✔ 지급정지 사유 확인`,
  `✔ 신고 기관 확인`,
  `✔ 계좌 거래내역 확보`,
  `✔ 거래 상대방 정보 확인`,
  `✔ 계약서 및 거래자료 정리`,
  `✔ 자금 흐름 분석`,
  `✔ 객관적인 소명자료 준비`,
  `✔ ${TPLA} 절차 진행`,
  `사안에 따라 금융기관의 검토와 수사기관의 절차가 함께 진행될 수 있으므로 초기 단계에서 충분한 자료를 확보하는 것이 중요합니다.`,
  `## ${TPLA}을 위해 준비해야 하는 자료`,
  `${TPLB} ${TPLA}에서는 거래를 객관적으로 설명할 수 있는 자료를 충분히 준비하는 것이 중요합니다.`,
  `대표적으로 다음과 같은 자료가 도움이 될 수 있습니다.`,
  `계좌 거래내역 / 송금 영수증 / 계약서 / 거래명세서 / 세금계산서 / 문자 및 카카오톡 대화 / 이메일 기록 / 거래 상대방 정보 / 입금 요청 내역 / 사업 관련 증빙자료`,
  `자료를 임의로 수정하거나 삭제하지 말고 원본 그대로 보관하는 것이 좋으며, 거래가 이루어진 과정을 시간순으로 정리하면 사실관계를 설명하는 데 도움이 될 수 있습니다.`,
  `## ${TPLA}을 위해 중요하게 확인하는 사항`,
  `${TPLB} ${TPLA}에서는 단순히 지급정지를 해제해 달라는 요청보다 거래의 실제 내용을 객관적으로 설명하는 것이 중요합니다.`,
  `다음 사항을 미리 점검해 두는 것이 도움이 됩니다.`,
  `거래 목적은 무엇이었는가 / 거래 상대방과 어떤 관계였는가 / 자금이 입금된 경위는 무엇인가 / 자금은 이후 어떻게 이동했는가 / 거래를 입증할 자료가 충분한가 / 일반적인 상거래로 설명할 수 있는 구조인가`,
  `위 내용을 객관적인 자료와 함께 정리하면 ${TPLA} 과정에서 사실관계를 설명하는 데 도움이 될 수 있습니다.`,
  `## ${TPLR}변호사의 검토가 필요한 이유`,
  `${TPLB} ${TPLA}은 단순히 금융기관에 서류를 제출하는 것으로 마무리되는 경우도 있지만, 거래 구조와 사실관계에 따라 민사상 분쟁이나 형사절차와 연결될 가능성도 있습니다.`,
  `특히 보이스피싱, 투자사기, 가상자산 거래, 팀미션 사기, 오픈채팅 투자방 등에서는 여러 계좌를 거쳐 자금이 이동하는 경우가 많아 거래 경위와 자금 흐름을 객관적으로 설명할 수 있는 자료가 중요합니다.`,
  `${TPLB} ${TPLA} ${TPLR}변호사는 지급정지 사유를 검토하고 거래 구조를 분석하여 필요한 증빙자료를 정리하고, 사건의 특성에 맞는 대응 방향을 안내합니다.`,
  `## ${TPLA}을 위해 확인해야 할 체크리스트`,
  `지급정지 통보를 받았다면 다음 사항을 우선 점검하는 것이 좋습니다.`,
  `☐ 지급정지 사유를 확인했는가`,
  `☐ 신고 기관을 확인했는가`,
  `☐ 계좌 거래내역을 확보했는가`,
  `☐ 거래 상대방 정보를 정리했는가`,
  `☐ 계약서와 거래명세서를 확보했는가`,
  `☐ 문자·카카오톡·이메일을 삭제하지 않았는가`,
  `☐ 송금 영수증을 보관하고 있는가`,
  `☐ 거래 경위를 시간순으로 정리했는가`,
  `☐ 자금 흐름을 설명할 자료를 확보했는가`,
  `☐ 사실과 다른 내용을 임의로 작성하지 않았는가`,
  `## ${TPLA} 과정에서 주의해야 할 사항`,
  `지급정지 상태에서는 거래와 관련된 자료를 보존하는 것이 매우 중요합니다.`,
  `다음과 같은 행동은 신중하게 판단해야 합니다.`,
  `거래자료 삭제 / 메신저 대화 삭제 / 거래 화면 수정 / 사실과 다른 거래 경위 작성 / 상대방 요구에 따른 추가 송금 / 계좌 사용 목적을 임의로 변경하여 설명하는 행위`,
  `반대로 아래 자료는 가능한 한 원본 그대로 보관하는 것이 좋습니다.`,
  `✔ 계좌 거래내역`,
  `✔ 계약서 및 거래명세서`,
  `✔ 문자 및 카카오톡 대화`,
  `✔ 이메일 기록`,
  `✔ 송금 영수증`,
  `✔ 거래 화면 캡처`,
  `✔ 상대방 연락처 및 계좌번호`,
  `## 실제 ${TPLB} ${TPLA} 과정에서 자주 확인되는 사례`,
  `${TPLB} ${TPLA} 과정에서는 다음과 같은 사례가 반복적으로 발생합니다.`,
  `정상적인 중고거래를 진행했지만 상대방이 사기 사건과 연결된 경우 / 투자금을 송금했는데 해당 계좌가 피해금 계좌로 신고된 경우 / 가상자산 거래 과정에서 피해금이 계좌를 거쳐 이동한 경우 / 사업 거래 대금이 피해금으로 오인된 경우 / 가족이나 지인의 부탁으로 계좌를 사용했다가 지급정지가 이루어진 경우`,
  `같은 지급정지 사건이라도 거래 목적과 자금 흐름은 모두 다르므로 개별적인 사실관계 확인과 자료 정리가 중요합니다.`,
  `## 핵심 요약`,
  `${TPLB} ${TPLA}은 지급정지 사유를 정확히 확인하고 거래의 정당성을 객관적인 자료로 설명하는 과정입니다.`,
  `특히 다음 사항을 우선 준비하는 것이 도움이 될 수 있습니다.`,
  `지급정지 사유 확인 / 신고 기관 확인 / 계좌 거래내역 확보 / 계약서 및 거래자료 준비 / 문자·카카오톡 대화 보관 / 송금 영수증 확보 / 거래 경위 정리 / 자금 흐름 분석 / 객관적인 증빙자료 준비`,
  `사건마다 지급정지 원인과 거래 구조가 다르므로 현재 상황을 정확하게 분석하고 사실관계를 체계적으로 정리하는 것이 중요합니다.`,
  `## 자주 묻는 질문 (FAQ)`,
  `### Q1. ${TPLB} ${TPLA}은 무엇부터 시작해야 하나요?`,
  `먼저 지급정지 사유와 신고 기관을 확인하고, 계좌 거래내역과 계약서, 송금 영수증, 메신저 대화 등 관련 자료를 확보하는 것이 중요합니다.`,
  `### Q2. 정상적인 거래였는데도 지급정지가 될 수 있나요?`,
  `거래 구조와 피해 신고 내용에 따라 지급정지가 이루어질 수 있으며, 실제 거래 경위를 객관적으로 설명할 수 있는 자료가 중요합니다.`,
  `### Q3. 지급정지가 되었다고 모두 범죄와 관련된 것인가요?`,
  `반드시 그렇지는 않습니다. 지급정지는 피해금의 추가 이동을 방지하기 위한 조치로 이루어질 수 있으며, 구체적인 사실관계는 사건마다 다를 수 있습니다.`,
  `### Q4. ${TPLA}까지 얼마나 걸리나요?`,
  `처리 기간은 지급정지 사유, 제출자료, 금융기관의 검토 및 관련 절차에 따라 달라질 수 있습니다.`,
  `### Q5. 거래내역만 제출하면 충분한가요?`,
  `거래내역 외에도 계약서, 거래명세서, 송금 영수증, 문자 및 메신저 대화 등 거래를 입증할 수 있는 자료를 함께 준비하는 것이 도움이 됩니다.`,
  `### Q6. 지급정지 상태에서 자료를 삭제하면 안 되나요?`,
  `거래자료와 대화기록은 사실관계를 확인하는 중요한 자료가 될 수 있으므로 원본 그대로 보관하는 것이 바람직합니다.`,
  `### Q7. 지급정지와 형사절차는 반드시 함께 진행되나요?`,
  `모든 사건이 형사절차로 이어지는 것은 아니며, 지급정지 사유와 사건의 내용에 따라 달라질 수 있습니다.`,
  `### Q8. 상대방이 추가 송금을 요구하면 어떻게 해야 하나요?`,
  `추가 송금 요구가 있다면 그 경위와 내용을 충분히 확인하고, 관련 기록을 모두 보관하는 것이 중요합니다.`,
  `### Q9. ${TPLB} ${TPLA}에서 가장 중요한 자료는 무엇인가요?`,
  `계좌 거래내역, 계약서, 거래명세서, 송금 영수증, 문자 및 메신저 대화 등 거래의 실제 경위를 설명할 수 있는 객관적인 자료가 중요합니다.`,
  `### Q10. ${TPLB} ${TPLA} ${TPLR}변호사를 찾는 이유는 무엇인가요?`,
  `사건마다 지급정지 원인과 거래 구조가 다르므로 사실관계를 종합적으로 검토하고 필요한 자료를 체계적으로 준비하는 것이 적절한 대응에 도움이 될 수 있기 때문입니다.`,
];

const TEMPLATE_SUMMARY = `${TPLB} ${TPLA}은 지급정지 사유를 정확하게 확인하고 거래 경위를 객관적인 자료로 소명하는 과정이 중요합니다. ${TPLB} ${TPLA} ${TPLR}변호사가 지급정지 원인, ${TPLA} 절차, 준비해야 할 자료와 주요 유의사항을 자세히 안내합니다.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const title = normalizeSpace(body.title);
    const slug = normalizeSlug(body.slug || title);
    const isPreview = body.preview === true;

    if (!title || !slug) {
      return json({ ok: false, message: "페이지 제목은 필수입니다." }, 400);
    }

    // 제목에서 은행명 / 지역명 / 행위 키워드 추출
    const newBank   = extractBank(title);
    const newRegion = extractRegion(title);
    const newAction = extractAction(title, newBank);

    const generatedBody = buildFromTemplate(newBank, newRegion, newAction);

    if (isPreview) {
      return json({ ok: true, body: generatedBody, bank: newBank, region: newRegion, action: newAction });
    }

    // ── 저장 단계 ──────────────────────────────────────────────────────────
    const confirmedBody = Array.isArray(body.body) && body.body.length
      ? body.body
      : generatedBody;

    const generatedMeta = generateMeta(newBank, newRegion, newAction);
    const imageAlt        = normalizeSpace(body.imageAlt).slice(0, 160) || generatedMeta.imageAlt;
    const imageCaption    = normalizeSpace(body.imageCaption).slice(0, 220) || generatedMeta.imageCaption;
    const imageDescription = normalizeSpace(body.imageDescription).slice(0, 300) || generatedMeta.imageDescription;

    const summary = normalizeSpace(body.summary).slice(0, 180) || generatedMeta.summary;

    const existing = await loadExisting(env, slug);
    if (existing && !isJipjeongManual(existing)) {
      return json({
        ok: false,
        message: "이미 다른 방식으로 생성된 slug입니다. 다른 slug를 입력하세요.",
      }, 409);
    }

    const now = today();
    const landing = {
      title,
      description: summary,
      canonical: buildLandingUrl(RECOVERY_GROUP, slug),
      ogTitle: title,
      ogDescription: summary,
      ogImage: caseOgImageUrl(slug, RECOVERY_SITE_URL),
      h1: title,
      ...(imageAlt        ? { imageAlt }        : {}),
      ...(imageCaption    ? { imageCaption }    : {}),
      ...(imageDescription ? { imageDescription } : {}),
      body: confirmedBody,
      victimCases: [],
      suspiciousCompanies: [],
      faq: [],
    };

    const item = {
      ...(existing || {}),
      slug,
      caseName: title,
      category: "지급정지 랜딩",
      createdBy: CREATED_BY,
      targetGroups: TARGET_GROUPS,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      thumbnailUrl: existing?.thumbnailUrl || "",
      landingViews: Number.isInteger(existing?.landingViews) ? existing.landingViews : randomInt(140, 8000, slug),
      reports: Number.isInteger(existing?.reports) ? existing.reports : 0,
      summary,
      tags: ["지급정지", "이의신청", "종로변호사"],
      landings: { ...(existing?.landings || {}), c: landing },
    };

    if (env.CASES) {
      await env.CASES.put(`case:${slug}`, JSON.stringify(item));
      const index = await loadIndexFromKv(env);
      upsertIndex(index, item);
      await env.CASES.put("cases:index", JSON.stringify(index));
      context.waitUntil?.(upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} jipjeong landing ${slug}`).catch(() => {}));

      const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
      context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
      context.waitUntil?.(warmRecoveryCache(slug).catch(() => {}));

      return json({
        ok: true,
        message: existing ? "지급정지 랜딩이 갱신되었습니다." : "지급정지 랜딩이 생성되었습니다.",
        landing: item,
        url: buildLandingUrl(RECOVERY_GROUP, slug),
        storage: "kv+github",
      });
    }

    await upsertCaseInGitHub(env, item, `${existing ? "Update" : "Add"} jipjeong landing ${slug}`);
    const indexNowKey = env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
    context.waitUntil?.(pingIndexNow(slug, indexNowKey).catch(() => {}));
    context.waitUntil?.(warmRecoveryCache(slug).catch(() => {}));

    return json({
      ok: true,
      message: existing ? "지급정지 랜딩이 갱신되었습니다." : "지급정지 랜딩이 생성되었습니다.",
      landing: item,
      url: buildLandingUrl(RECOVERY_GROUP, slug),
      storage: "github",
    });
  } catch (error) {
    return json({ ok: false, message: error.message }, 500);
  }
}

// ─── 원고 생성 ──────────────────────────────────────────────────────────────

function buildFromTemplate(bank, region, action) {
  return TEMPLATE_BODY.map((para) => applySubstitutions(para, bank, region, action));
}

function applySubstitutions(str, bank, region, action) {
  let s = str;
  s = replaceAll(s, TPLB, bank);
  s = replaceAll(s, TPLR, region || "종로");
  s = replaceAll(s, TPLA, action);
  return s;
}

function generateMeta(bank, region, action) {
  const r = region || "종로";
  const subject = `${bank} ${action}`.trim();
  const summary = `${subject}${topicParticle(subject)} 지급정지 사유를 정확하게 확인하고 거래 경위를 객관적인 자료로 소명하는 과정이 중요합니다. ${subject} ${r}변호사가 지급정지 원인, ${action} 절차, 준비해야 할 자료와 주요 유의사항을 자세히 안내합니다.`.slice(0, 180);
  const imageAlt = `${bank} ${action} ${r}변호사`;
  const imageCaption = `${bank} ${action} — ${r}변호사가 절차와 준비자료를 안내합니다`;
  const imageDescription = `${bank} ${action}에 관한 법적 절차, 준비서류, ${action} 과정을 ${r}변호사가 자세히 안내합니다. 지급정지 사유 확인부터 소명자료 준비까지 체계적으로 진행합니다.`;
  return { summary, imageAlt, imageCaption, imageDescription };
}

function topicParticle(value = "") {
  return hasFinalConsonant(value) ? "은" : "는";
}

function hasFinalConsonant(value = "") {
  const chars = [...String(value || "").trim()].reverse();
  const lastHangul = chars.find((char) => /[가-힣]/.test(char));
  if (!lastHangul) return true;
  const code = lastHangul.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 !== 0 : true;
}

// KV 기존 지급정지 케이스 원고 참조 — 찾으면 은행·지역·행위 치환 후 반환
async function findJipjeongReferenceFromKv(env, newBank, newRegion, newAction) {
  try {
    const idxRaw = await env.CASES.get("cases:index");
    if (!idxRaw) return null;
    const index = JSON.parse(idxRaw);

    const candidates = index.filter((c) => {
      const slug = String(c.slug || "");
      const name = String(c.caseName || "");
      return slug.includes("지급정지") || name.includes("지급정지");
    });
    if (!candidates.length) return null;

    // 가장 내용이 풍부한 케이스를 선택 (최근 순)
    const ref = candidates[0];
    const raw = await env.CASES.get(`case:${ref.slug}`);
    if (!raw) return null;

    const caseData = JSON.parse(raw);
    const refBody = caseData?.landings?.c?.body;
    if (!Array.isArray(refBody) || refBody.length < 20) return null;

    const refName = String(ref.caseName || ref.slug || "");
    const refBank   = extractBank(refName);
    const refRegion = extractRegion(refName);
    const refAction = extractAction(refName, refBank);

    // 참조 케이스의 은행·지역·행위를 새 값으로 치환
    return refBody.map((para) => {
      let s = String(para || "");
      s = replaceAll(s, refBank, newBank);
      if (refRegion && newRegion) s = replaceAll(s, refRegion, newRegion);
      if (refAction && newAction && refAction !== newAction) s = replaceAll(s, refAction, newAction);
      return s;
    });
  } catch {
    return null;
  }
}

// ─── 제목 파싱 ──────────────────────────────────────────────────────────────

function extractBank(title) {
  // "한국산업은행 지급정지 해결, ..." → "한국산업은행"
  // "신한은행 계좌 지급정지 해제, ..." → "신한은행"
  const m = normalizeSpace(title).match(/^(.+?)\s+(?:계좌\s+)?지급정지/);
  return m ? m[1].trim() : normalizeSpace(title).split(/[\s,·]/)[0];
}

function extractRegion(title) {
  // "중랑변호사가..." → "중랑" / "- 종로변호사" → "종로"
  const s = normalizeSpace(title);
  const separated = s.match(/[,·\-–—]\s*([가-힣A-Za-z0-9]{1,10})\s*변호사/);
  if (separated) return separated[1].trim();
  const spaced = s.match(/(?:^|\s)([가-힣A-Za-z0-9]{1,10})\s*변호사(?:가|는|은|의|와|과|를|을)?(?:\s|$|[,.?])/);
  return spaced ? spaced[1].trim() : "";
}

function extractAction(title, bank) {
  // "한국산업은행 [지급정지 이의신청] - 종로변호사"
  // "한국산업은행 [계좌 지급정지 해제], 용산변호사..."
  const s = normalizeSpace(title);
  let rest = s.startsWith(bank) ? s.slice(bank.length).trim() : s;
  // 지역명+변호사 이후 제거
  rest = rest
    .replace(/\s*[,·\-–—]\s*[가-힣A-Za-z0-9]{1,10}\s*변호사[\s\S]*$/, "")
    .replace(/\s+[가-힣A-Za-z0-9]{1,10}\s*변호사[\s\S]*$/, "")
    .trim();
  return rest || "지급정지";
}

// ─── 유틸 ───────────────────────────────────────────────────────────────────

function replaceAll(str, from, to) {
  if (!from || from === to) return str;
  return str.split(from).join(to);
}

function isJipjeongManual(item = {}) {
  return item.createdBy === CREATED_BY;
}

async function loadExisting(env, slug) {
  if (env.CASES) {
    const raw = await env.CASES.get(`case:${slug}`);
    if (raw) return JSON.parse(raw);
  }
  const all = await loadCasesFromGitHub(env).catch(() => []);
  return all.find((item) => item.slug === slug) || null;
}

async function loadIndexFromKv(env) {
  const raw = await env.CASES.get("cases:index");
  return raw ? JSON.parse(raw) : [];
}

function upsertIndex(index, item) {
  const entry = buildIndexEntry(item);
  const pos = index.findIndex((candidate) => candidate.slug === item.slug);
  if (pos >= 0) index[pos] = entry;
  else index.push(entry);
  index.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function buildIndexEntry(item) {
  return {
    slug: item.slug,
    caseName: item.caseName || "",
    category: item.category || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    thumbnailUrl: item.thumbnailUrl || "",
    landingViews: item.landingViews || 0,
    reports: item.reports || 0,
    summary: item.summary || "",
    tags: item.tags || [],
    memo: item.memo || "",
    noindex: item.noindex || false,
    targetGroups: item.targetGroups || [],
    createdBy: item.createdBy || "",
  };
}

async function upsertCaseInGitHub(env, item, message) {
  const all = await loadCasesFromGitHub(env);
  const pos = all.findIndex((candidate) => candidate.slug === item.slug);
  if (pos >= 0) all[pos] = item;
  else all.push(item);
  all.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  await saveCasesToGitHub(env, all, message);
}

async function loadCasesFromGitHub(env) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return [];

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("GitHub cases.json 로드 실패");

  const file = await res.json();
  const raw = await readFileContent(file, token);
  return raw ? JSON.parse(raw) : [];
}

async function saveCasesToGitHub(env, list, message) {
  const { owner, repo, branch, token } = githubEnv(env);
  if (!owner || !repo || !token) return;

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}?ref=${branch}`, {
    headers: githubHeaders(token),
  });

  let sha = null;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
  } else if (getRes.status !== 404) {
    throw new Error("GitHub cases.json 상태 확인 실패");
  }

  const body = { message, content: encodeBase64(JSON.stringify(list, null, 2)), branch };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${GITHUB_FILE_PATH}`, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    throw new Error(`GitHub cases.json 저장 실패: ${detail.slice(0, 180)}`);
  }
}

async function warmRecoveryCache(slug) {
  await Promise.allSettled([
    fetch(caseOgImageUrl(slug, RECOVERY_SITE_URL), { method: "GET" }),
    fetch(buildLandingUrl(RECOVERY_GROUP, slug), { method: "GET" }),
  ]);
}

async function pingIndexNow(slug, key) {
  await fetch("https://searchadvisor.naver.com/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: RECOVERY_HOST,
      key,
      keyLocation: `${RECOVERY_SITE_URL}/${key}.txt`,
      urlList: [buildLandingUrl(RECOVERY_GROUP, slug), `${RECOVERY_SITE_URL}/`],
    }),
  });
}

function githubEnv(env) {
  return {
    owner: env.GITHUB_REPO_OWNER,
    repo: env.GITHUB_REPO_NAME,
    branch: env.GITHUB_BRANCH || "main",
    token: env.GITHUB_TOKEN,
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "static-landing-generator-admin",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
}

async function readFileContent(file, token) {
  if (file.content && file.encoding !== "none") {
    return decodeBase64(file.content).trim();
  }
  if (file.download_url) {
    const res = await fetch(file.download_url, { headers: githubHeaders(token) });
    if (res.ok) return (await res.text()).trim();
  }
  return "";
}

function decodeBase64(value) {
  const clean = String(value || "").replace(/\n/g, "");
  return new TextDecoder().decode(Uint8Array.from(atob(clean), (char) => char.charCodeAt(0)));
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function normalizeSpace(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function randomInt(min, max, seed) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
