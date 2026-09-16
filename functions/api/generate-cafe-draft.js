import {
  FRAUD_TYPE_OPTIONS,
  fraudTypeLabel,
  normalizeFraudTypeKey,
  standardCaseKeyword,
  standardCoreSummary,
  standardIntroParagraphs,
  standardMethodTemplate,
  standardVictimCases,
} from "../_standardLanding.js";

const RELATED_READINGROOM_CTA = "다른 리딩방 사기 사건 보기는 이곳 📌 https://gnlaw-criminal.co.kr/prosecute/jusigridingbang-litigation/";
const PAYMENT_SUSPENSION_RELEASE_TYPE = "payment-suspension-release";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const rawCaseName = normalizeSpace(body.caseName);
    const isPaymentSuspensionRelease = body.fraudType === PAYMENT_SUSPENSION_RELEASE_TYPE;
    const fraudType = isPaymentSuspensionRelease
      ? PAYMENT_SUSPENSION_RELEASE_TYPE
      : normalizeFraudTypeKey(body.fraudType, { caseName: rawCaseName });

    if (!rawCaseName) return json({ ok: false, message: "사건명을 입력해주세요." }, 400);
    if (!isPaymentSuspensionRelease && !FRAUD_TYPE_OPTIONS.some((item) => item.key === body.fraudType)) {
      return json({ ok: false, message: "사건 유형을 선택해주세요." }, 400);
    }

    const draft = isPaymentSuspensionRelease
      ? createPaymentSuspensionReleaseDraft(rawCaseName)
      : createCafeDraft(normalizeCaseName(rawCaseName), fraudType);
    return json({ ok: true, draft });
  } catch (error) {
    return json({ ok: false, message: error.message || "원고 생성에 실패했습니다." }, 500);
  }
}

function createPaymentSuspensionReleaseDraft(caseName) {
  const keyword = normalizeSpace(caseName);
  const typeLabel = "지급정지해제";
  const title = `${keyword} 지급정지해제, 채무부존재확인소송으로 대응하는 방법`;
  const sections = [
    {
      heading: `${keyword} 지급정지, 왜 해제 절차가 필요한가`,
      paragraphs: [
        "계좌가 지급정지되면 단순히 금융회사에 해제를 요청하는 것만으로 해결되지 않는 경우가 있습니다. 특히 본인이 사기 거래에 관여하지 않았거나, 지급정지를 신청한 상대방에게 반환할 채무가 존재하지 않는다고 다투어야 하는 사안이라면 지급정지의 원인이 된 법률관계를 명확히 정리할 필요가 있습니다.",
        "이때 검토할 수 있는 주요 민사 절차가 채무부존재확인소송입니다. 핵심은 ‘지급정지를 신청한 상대방에 대하여 반환해야 할 채무가 존재하지 않는다’는 점을 법원의 절차를 통해 확인받는 것입니다.",
      ],
    },
    {
      heading: `${keyword} 지급정지해제 검색자가 먼저 보는 쟁점`,
      paragraphs: [
        `${keyword} 지급정지해제를 검색하는 경우 대부분 계좌 사용이 갑자기 제한되었거나, 금융회사로부터 전기통신금융사기 피해 신고와 관련된 안내를 받은 직후입니다. 이때 중요한 것은 단순히 계좌가 막혔다는 사실이 아니라 어떤 거래 때문에 지급정지가 되었고, 지급정지를 신청한 상대방에게 실제 반환 채무가 존재하는지입니다.`,
        "지급정지해제는 금융회사 문의만으로 끝나는 사안이 아니라 민사상 권리관계, 입금 경위, 계좌 사용 목적, 상대방 특정 가능성까지 함께 검토해야 합니다. 특히 채무부존재확인소송이 필요한 사건이라면 지급정지 신청인, 문제 된 입금, 입금 원인, 반환 의무 부존재 사유를 정리해야 합니다.",
      ],
      bullets: [
        "본인이 사기 행위에 관여하지 않았는데 계좌만 지급정지된 상황인지",
        "문제 된 입금이 물품대금, 정산금, 차용금 등 별도 원인으로 들어온 것인지",
        "지급정지 신청인이 누구인지 특정할 수 있는지",
        "상대방에게 반환해야 할 채무가 실제로 존재하는지",
        "채무부존재확인소송으로 법률관계를 확인받아야 하는 사안인지",
      ],
    },
    {
      heading: "지급정지해제의 핵심 대응, 채무부존재확인소송",
      paragraphs: [
        "채무부존재확인소송은 상대방이 주장하는 채무가 실제로 존재하는지 여부를 법원에서 판단받는 절차입니다. 지급정지 사안에서는 단순히 ‘나는 잘못이 없다’고 주장하는 것보다, 지급정지를 신청한 당사자를 정확히 특정하고 그 상대방에 대한 채무가 존재하지 않는다는 점을 소송상 쟁점으로 구성하는 것이 중요합니다.",
        "소송을 제기하면 금융회사가 진행 중인 분쟁과 소송의 존재를 확인할 수 있도록 사건번호, 당사자 관계, 청구취지 등 필요한 자료를 갖추어 제시하는 방향을 검토할 수 있습니다. 이후 판결이나 조정 등 사건 진행 결과와 금융회사의 내부 절차에 따라 지급정지 해제를 요청하게 됩니다.",
        "다만 소송을 제기했다는 사실만으로 지급정지가 자동 해제되는 것은 아닙니다. 지급정지의 근거, 신청인과 계좌명의인의 관계, 입금 경위, 관련 법률관계에 따라 필요한 절차와 제출 자료가 달라질 수 있으므로 사건별 검토가 필요합니다.",
      ],
      numbered: [
        "지급정지를 신청한 당사자와 문제된 거래를 정확히 특정합니다.",
        "입금 경위와 자금의 성격을 확인할 수 있는 계좌내역·이체확인증·계약자료·대화내역을 정리합니다.",
        "상대방에게 반환할 채무가 존재하지 않는 법률상·사실상 근거를 정리합니다.",
        "필요한 경우 지급정지 신청인을 상대로 채무부존재확인소송을 제기합니다.",
        "소송 계속 사실과 사건 진행 자료를 금융회사에 제출하고 지급정지 해제 절차를 진행합니다.",
      ],
    },
    {
      heading: "채무부존재확인소송에서 확인해야 할 자료",
      paragraphs: [
        "지급정지해제를 목표로 채무부존재확인소송을 진행하려면 계좌에 돈이 들어온 사실만 볼 것이 아니라, 왜 입금되었는지와 본인이 해당 거래에 어떤 지위로 관여했는지를 객관적인 자료로 설명할 수 있어야 합니다.",
      ],
      bullets: [
        "지급정지된 계좌의 거래내역과 문제된 입금의 이체확인증",
        "입금 전후 상대방 또는 관련자와 주고받은 문자·카카오톡·텔레그램 등 대화내역",
        "물품대금·대여금·정산금 등 입금 원인을 확인할 수 있는 계약서·주문내역·정산자료",
        "지급정지 사실을 확인할 수 있는 금융회사 안내 내용과 신청 관련 자료",
        "본인이 사기 또는 편취 행위에 관여하지 않았음을 뒷받침하는 객관적인 자료",
      ],
    },
    {
      heading: "소송 제기 전 특히 확인할 점",
      paragraphs: [
        "채무부존재확인소송은 누구를 상대로 제기할 것인지가 매우 중요합니다. 지급정지를 신청한 당사자를 제대로 특정하지 못하면 소송을 진행하더라도 금융회사가 해당 지급정지 건과 연결된 분쟁으로 확인하기 어려울 수 있습니다.",
        "따라서 지급정지 통지 내용, 금융회사에서 확인 가능한 정보, 입금 내역 등을 바탕으로 상대방 특정 가능성과 청구의 적절성을 먼저 검토한 뒤 소송을 진행하는 것이 필요합니다.",
      ],
    },
    {
      heading: "법무법인 선린의 지급정지해제 대응 방향",
      paragraphs: [
        "법무법인 선린은 지급정지의 발생 원인과 입금 경위, 신청인과의 법률관계, 계좌 사용 경위를 함께 검토한 뒤 채무부존재확인소송 필요 여부를 판단합니다.",
        "채무부존재확인소송이 필요한 사안이라면 지급정지 신청 당사자를 특정하고, 채무가 존재하지 않는다는 점을 뒷받침할 자료를 정리하여 소송을 진행한 뒤 금융회사에 소송 계속 사실과 관련 자료를 제시하는 방향으로 지급정지해제 절차를 검토합니다.",
      ],
    },
    {
      heading: `${keyword} 지급정지해제 관련 자주 묻는 질문`,
      paragraphs: paymentSuspensionFaq(keyword),
    },
  ];

  const hashtags = [
    "지급정지해제",
    "계좌지급정지",
    "채무부존재확인소송",
    "채무부존재확인",
    "지급정지대응",
    "법무법인선린",
  ];

  return {
    caseName: keyword,
    fraudType: PAYMENT_SUSPENSION_RELEASE_TYPE,
    typeLabel,
    title,
    sections,
    hashtags,
    body: renderPlainText(sections, hashtags, false),
  };
}

function createCafeDraft(caseName, fraudType) {
  const keyword = standardCaseKeyword(caseName);
  const typeLabel = fraudTypeLabel(fraudType);
  const method = standardMethodTemplate(fraudType);
  const intros = standardIntroParagraphs(fraudType, caseName);
  const victimCase = standardVictimCases(fraudType)[0]
    .replace(/^사례\s*1\s*/i, "")
    .trim();
  const title = `${keyword} 피해 대응, 출금거부·추가입금 요구 확인할 점`;

  const sections = [
    {
      heading: `${keyword} 피해가 의심될 때 먼저 확인할 내용`,
      paragraphs: [
        standardCoreSummary(fraudType, caseName),
        `${keyword} 관련 검색을 하는 분들이 가장 먼저 확인해야 할 부분은 실제 업체명이나 담당자 이름보다 접근 경로, 입금 계좌, 출금 제한 사유, 추가 입금 요구가 어떤 흐름으로 이어졌는지입니다. 같은 이름을 사용하더라도 사칭 계정, 허위 사이트, 가짜 앱, 단체 채팅방을 통해 피해가 발생하는 경우가 많기 때문입니다.`,
        ...intros,
        "※ 이 글은 특정 업체나 인물을 사기 주체로 단정하는 내용이 아닙니다. 제보·상담 과정에서 확인되는 사칭 및 유사 피해 정황을 바탕으로 주의사항과 대응 방법을 안내합니다.",
      ],
    },
    {
      heading: `${keyword} 검색자가 자주 확인하는 핵심 쟁점`,
      paragraphs: [
        `${keyword} 피해 상담에서는 '정말 사기인지', '출금이 왜 막혔는지', '추가 입금을 하면 돌려받을 수 있는지', '이미 보낸 돈을 회복할 방법이 있는지'가 반복적으로 문제 됩니다.`,
        "검색 노출과 실제 상담 전환에서 중요한 내용은 단순한 경고 문구가 아니라 피해자가 자신의 상황을 대입해 볼 수 있는 구체적인 판단 기준입니다. 아래 항목 중 여러 개가 겹친다면 추가 송금을 멈추고 자료 보존과 법적 대응 가능성을 함께 검토하는 것이 필요합니다.",
      ],
      bullets: searchIntentBullets(fraudType, keyword),
    },
    {
      heading: `${typeLabel}에서 반복되는 주요 수법`,
      paragraphs: [
        "사칭형 금융사기 원고는 사건명만 바꿔 쓰는 방식으로는 검색 품질과 체류 시간을 확보하기 어렵습니다. 피해자가 실제로 겪는 단계별 흐름을 설명해야 유사 검색어에서도 문맥이 살아납니다.",
      ],
      numbered: method.steps,
    },
    {
      heading: "이런 상황이라면 추가 입금을 중단해야 합니다",
      paragraphs: [
        `${keyword} 피해가 의심되는 상황에서 가장 위험한 대응은 출금을 위해 다시 돈을 보내는 것입니다. 사기 조직은 이미 입금한 돈을 돌려받고 싶은 심리를 이용해 세금, 보증금, 인증비, 계정 복구비, 환전 수수료 등의 명목을 계속 바꿔 추가 송금을 요구합니다.`,
      ],
      bullets: warningSigns(fraudType),
    },
    {
      heading: `${keyword} 유사 피해 진행 사례`,
      paragraphs: [
        victimCase,
        "위와 같은 흐름에서는 초반에 일부 수익금이나 소액 환급이 이루어져도 안심하기 어렵습니다. 이후 고액 입금 단계에서 출금 조건을 바꾸거나, 담당자가 바뀌었다는 이유로 새로운 비용을 요구하는 경우가 많습니다.",
      ],
    },
    {
      heading: `${keyword} 피해를 인지한 직후 해야 할 일`,
      paragraphs: [
        "출금을 위해 세금이나 보증금을 먼저 보내야 한다는 안내를 받았다면 추가 송금부터 중단해야 합니다. 이미 입금한 돈을 되찾기 위해 또 입금하는 행동은 피해 규모만 키울 수 있습니다.",
      ],
      numbered: [
        "상대방과의 카카오톡·텔레그램·문자 대화 전체를 삭제하지 말고 보존합니다.",
        "입금 계좌번호, 예금주, 송금 일시와 금액이 보이는 이체확인증을 확보합니다.",
        "사이트 주소, 앱 설치 파일·링크, 거래 화면과 출금 거부 화면을 캡처합니다.",
        "최초 접근부터 추가 입금 요구까지의 경위를 시간순으로 정리합니다.",
        "금융회사 지급정지 요청과 형사고소·민사상 보전조치 가능성을 신속히 검토합니다.",
      ],
    },
    {
      heading: "증거 자료는 이렇게 정리하는 것이 좋습니다",
      paragraphs: [
        "사기 피해 대응에서는 '피해를 당했다'는 주장만으로는 부족하고, 접근부터 입금, 출금 거부, 추가 요구까지의 흐름이 자료로 연결되어야 합니다. 특히 계좌 명의자와 실제 지시자가 다른 경우가 많으므로 대화 내용과 이체 자료를 함께 정리해야 합니다.",
      ],
      bullets: evidenceBullets(fraudType),
    },
    {
      heading: "형사고소와 민사상 피해 회복을 함께 검토해야 하는 이유",
      paragraphs: [
        `${keyword} 사건은 상대방이 익명 채널을 사용하거나 사이트를 폐쇄하는 경우가 많아 단순 문의나 환불 요청만으로 해결되기 어렵습니다. 형사 절차에서는 사기 정황과 관련 계좌, 대화 상대, 사이트 운영 구조를 정리해 수사기관에 제출하는 것이 중요합니다.`,
        "민사 절차에서는 계좌 명의자, 모집책, 수취 계좌와 연결된 관련자에 대한 청구 가능성, 가압류 등 보전조치 필요성을 사건별로 검토합니다. 피해 회복 가능성은 입금 시점, 계좌 상태, 상대방 특정 여부, 증거 보존 정도에 따라 달라질 수 있습니다.",
      ],
      bullets: legalResponseBullets(fraudType),
    },
    {
      heading: "법무법인 선린의 대응 방향",
      paragraphs: [
        "법무법인 선린은 사건명이나 플랫폼 화면만으로 결론을 내리지 않고, 접근 경위·대화 내용·입금 계좌·출금 거부 사유·추가 송금 요구를 함께 검토합니다.",
        "확보된 자료를 토대로 사기죄 등 형사 책임, 계좌 명의자와 관련자에 대한 민사상 청구, 가압류 등 보전조치 가능성을 사건별로 검토합니다. 구체적인 절차와 결과는 증거 상태와 상대방 특정 여부에 따라 달라질 수 있습니다.",
      ],
    },
    {
      heading: `${keyword} 관련 자주 묻는 질문`,
      paragraphs: faqParagraphs(keyword, fraudType),
    },
  ];

  const hashtags = createHashtags(caseName, fraudType);
  return {
    caseName,
    fraudType,
    typeLabel,
    title,
    sections,
    hashtags,
    body: renderPlainText(sections, hashtags),
  };
}

function warningSigns(fraudType) {
  const common = [
    "출금을 신청하자 세금·보증금·인증비·계정 해제비를 먼저 요구합니다.",
    "정상적인 금융회사 계좌가 아닌 개인 명의 계좌로 입금을 안내합니다.",
    "공식 고객센터가 아닌 카카오톡·텔레그램 등 비공식 채널로만 연락합니다.",
    "추가 입금을 하지 않으면 기존 투자금이나 수익금도 돌려받지 못한다고 압박합니다.",
  ];
  const first = {
    "stock-project": "교수·대표·증권사 관계자·투자 전문가를 사칭하며 고수익 프로젝트 참여를 권합니다.",
    "institution-exchange": "금융기관의 명칭과 로고를 사용한 별도 사이트·앱·특별계좌 이용을 요구합니다.",
    "team-mission": "소액 정산 후 고액 팀미션·VIP 미션·연속 주문 참여를 요구합니다.",
    "live-dating": "친분을 쌓은 뒤 후원·선물·포인트 충전·등급 승급 비용을 요구합니다.",
    "refund-reward": "환불이나 보상금을 받으려면 다른 사이트 가입과 선입금이 필요하다고 안내합니다.",
  };
  return [first[fraudType], ...common].filter(Boolean);
}

function searchIntentBullets(fraudType, keyword) {
  const common = [
    `${keyword} 명칭을 사용한 사이트·앱·채팅방이 공식 채널인지 확인되지 않습니다.`,
    "수익금이나 원금을 출금하려 하자 먼저 돈을 더 보내야 한다고 안내합니다.",
    "입금 계좌가 계속 바뀌거나 개인·법인 명의가 안내 내용과 맞지 않습니다.",
    "담당자가 원격 앱 설치, 화면 공유, 신분증·계좌 정보 제출을 요구합니다.",
  ];
  const byType = {
    "stock-project": "무료 종목 추천, VIP 리딩방, 공모주 특별배정, 기관계좌 운용을 이유로 투자금을 늘리게 합니다.",
    "institution-exchange": "증권사·은행·거래소 명칭과 로고를 사용하지만 공식 홈페이지나 고객센터에서 확인되지 않습니다.",
    "team-mission": "소액 정산 후 고액 팀미션, 연속 주문, VIP 미션을 완료해야 출금된다고 합니다.",
    "live-dating": "라이브 방송 후원, 포인트 충전, 환전, 등급 승급을 이유로 반복 결제를 요구합니다.",
    "refund-reward": "환불금이나 보상금을 지급하겠다며 수수료, 세금, 보증금 선입금을 요구합니다.",
  };
  return [byType[fraudType], ...common].filter(Boolean);
}

function evidenceBullets(fraudType) {
  const common = [
    "처음 연락을 받은 문자, 광고, SNS 계정, 오픈채팅방 초대 링크",
    "담당자와 주고받은 카카오톡·텔레그램·문자·이메일 전체 대화",
    "입금 계좌번호, 예금주, 송금 일시와 금액이 보이는 이체확인증",
    "사이트 주소, 앱 화면, 수익 화면, 출금 신청 화면, 출금 거부 안내 화면",
    "세금·보증금·인증비·수수료 등 추가 입금을 요구한 메시지",
  ];
  const byType = {
    "stock-project": "리딩방 초대 내역, 종목 추천 내역, 허위 수익 인증 화면",
    "institution-exchange": "금융기관 로고 사용 화면, 임직원 사칭 명함·프로필·위조 서류",
    "team-mission": "미션 배정 내역, 주문 오류 안내, 정산 화면, 팀미션 단체방 대화",
    "live-dating": "라이브 플랫폼 가입 링크, 포인트 충전 내역, 환전 신청 화면",
    "refund-reward": "환불 대상 안내 문자, 보상금 지급 안내, 환급 절차 설명 자료",
  };
  return [byType[fraudType], ...common].filter(Boolean);
}

function legalResponseBullets(fraudType) {
  const common = [
    "피해 경위를 시간순으로 정리해 사기 고의와 기망 행위를 설명합니다.",
    "입금 계좌와 대화 상대를 연결해 수사기관 제출 자료를 구성합니다.",
    "계좌 지급정지, 피해구제 신청, 형사고소, 민사상 청구 가능성을 함께 검토합니다.",
    "상대방이 추가 입금을 요구하는 중이라면 새 송금을 멈추고 증거부터 보존합니다.",
  ];
  const byType = {
    "stock-project": "투자 권유 과정과 출금 거부 사유를 중심으로 리딩방 운영 구조를 정리합니다.",
    "institution-exchange": "실제 금융기관과 무관한 사칭 정황, 허위 사이트·앱 운영 정황을 구분해 정리합니다.",
    "team-mission": "소액 정산으로 신뢰를 만든 뒤 고액 미션으로 전환한 흐름을 입증합니다.",
    "live-dating": "친밀감 형성 이후 포인트·환전·등급 비용으로 전환된 흐름을 정리합니다.",
    "refund-reward": "환불 또는 보상금 지급을 미끼로 한 2차 피해 구조를 입증합니다.",
  };
  return [byType[fraudType], ...common].filter(Boolean);
}

function faqParagraphs(keyword, fraudType) {
  const typeAnswers = {
    "stock-project": "리딩방에서 수익 화면을 보여주거나 일부 출금을 해주었다는 사정만으로 안전하다고 볼 수 없습니다. 출금 단계에서 세금, 보증금, 인증비를 요구했다면 사칭형 투자사기 가능성을 우선 검토해야 합니다.",
    "institution-exchange": "증권사, 은행, 거래소 명칭을 사용하더라도 공식 홈페이지, 대표번호, 금융당국 등록 정보와 연결되지 않으면 사칭 가능성이 있습니다. 별도 링크나 앱 설치를 요구했다면 자료를 보존해야 합니다.",
    "team-mission": "초기 소액 정산은 신뢰를 만들기 위한 장치로 사용될 수 있습니다. 고액 미션, 연속 주문, 오류 복구 비용을 요구한다면 추가 결제를 멈추고 진행 내역을 정리해야 합니다.",
    "live-dating": "포인트 충전이나 환전 수수료를 반복 요구하고 실제 출금이 지연된다면 피해 가능성이 큽니다. 대화 내역과 충전 내역을 삭제하지 않는 것이 중요합니다.",
    "refund-reward": "환불금이나 보상금을 받기 위해 먼저 돈을 내야 한다는 구조라면 2차 피해 가능성을 의심해야 합니다. 환급 안내 문자와 계좌 정보를 함께 보존해야 합니다.",
  };
  return [
    `Q. ${keyword} 피해인지 아직 확실하지 않아도 상담이 필요한가요?\nA. 피해 여부가 확정되지 않았더라도 출금 거부, 추가 입금 요구, 연락 두절, 사이트 접속 제한이 있었다면 초기 검토가 필요합니다. 초기에 자료를 보존해야 이후 형사고소와 민사 대응에서 설명이 쉬워집니다.`,
    `Q. 일부 수익금이 지급된 적이 있으면 사기가 아닌가요?\nA. ${typeAnswers[fraudType] || typeAnswers["stock-project"]}`,
    "Q. 이미 추가 입금을 한 뒤라면 무엇부터 해야 하나요?\nA. 추가 송금을 중단하고 입금 내역, 대화 내역, 사이트 화면, 상대방 계좌 정보를 보존해야 합니다. 이후 지급정지 가능성, 형사고소 자료 구성, 민사상 피해 회복 가능성을 순서대로 검토하는 것이 좋습니다.",
  ];
}

function paymentSuspensionFaq(keyword) {
  return [
    `Q. ${keyword} 지급정지는 소송을 제기하면 바로 풀리나요?\nA. 채무부존재확인소송을 제기했다는 사실만으로 지급정지가 자동 해제되는 것은 아닙니다. 다만 소송을 통해 상대방에 대한 채무가 존재하지 않는다는 점을 다투고, 사건번호와 진행 자료를 금융회사에 제시하는 방식으로 해제 절차를 검토할 수 있습니다.`,
    "Q. 지급정지 신청인이 누구인지 모르면 어떻게 하나요?\nA. 금융회사 안내 내용, 입금 내역, 거래 상대방 자료를 바탕으로 신청인 특정 가능성을 먼저 확인해야 합니다. 상대방 특정이 어려운 경우에는 소송 상대방 구성과 자료 확보 방법을 별도로 검토해야 합니다.",
    "Q. 계좌에 돈이 들어왔다는 이유만으로 반환해야 하나요?\nA. 입금 사실만으로 곧바로 반환 채무가 인정되는 것은 아닙니다. 입금 원인, 거래 관계, 상대방과의 약정, 본인의 관여 정도에 따라 반환 의무가 달라질 수 있으므로 자료를 기준으로 판단해야 합니다.",
  ];
}

function createHashtags(caseName, fraudType) {
  const base = caseName.replace(/\s*(사칭\s*사기|사기)\s*$/i, "").replace(/\s+/g, "");
  const typeTags = {
    "stock-project": ["주식리딩방사기", "투자프로젝트사칭"],
    "institution-exchange": ["금융기관사칭", "가상자산사기"],
    "team-mission": ["팀미션사기", "부업사기"],
    "live-dating": ["라이브방송사기", "만남플랫폼사기"],
    "refund-reward": ["환불사기", "보상금사칭"],
  };
  return [...new Set([`${base}사기`, ...(typeTags[fraudType] || []), "출금거부", "사기피해대응", "법무법인선린"])];
}

function renderPlainText(sections, hashtags, includeReadingroomCta = true) {
  const blocks = [];
  sections.forEach((section) => {
    blocks.push(section.heading);
    (section.paragraphs || []).forEach((item) => blocks.push(item));
    (section.numbered || []).forEach((item, index) => blocks.push(`${index + 1}. ${item}`));
    (section.bullets || []).forEach((item) => blocks.push(`- ${item}`));
  });
  blocks.push(hashtags.map((tag) => `#${tag}`).join(" "));
  if (includeReadingroomCta) blocks.push(RELATED_READINGROOM_CTA);
  return blocks.join("\n\n");
}

function normalizeCaseName(name) {
  const value = normalizeSpace(name);
  if (/사기$/.test(value)) return value;
  return `${value.replace(/\s*(사칭|스캠|scam)\s*$/i, "").trim()} 사칭 사기`;
}

function normalizeSpace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
