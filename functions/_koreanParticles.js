export function hasFinalConsonant(value = "") {
  const chars = [...String(value || "").trim()].reverse();
  const lastHangul = chars.find((char) => /[가-힣]/.test(char));
  if (!lastHangul) return true;
  const code = lastHangul.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 !== 0 : true;
}

export function koreanParticle(value = "", consonantForm = "", vowelForm = "") {
  return hasFinalConsonant(value) ? consonantForm : vowelForm;
}

export function correctKoreanParticles(value = "") {
  const hasBatchim = (char = "") => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0;
  };
  const jongseong = (char = "") => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? code % 28 : -1;
  };
  const boundary = "(?=$|\\s|[,.!?…:;\\)\\]}'\"<])";
  return String(value || "")
    .replace(new RegExp(`([가-힣])(은|는)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) ? "은" : "는"}`)
    .replace(new RegExp(`([가-힣])(이|가)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) ? "이" : "가"}`)
    .replace(new RegExp(`([가-힣])(을|를)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) ? "을" : "를"}`)
    .replace(new RegExp(`([가-힣])(과|와)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) ? "과" : "와"}`)
    .replace(new RegExp(`([가-힣])(이란|란)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) ? "이란" : "란"}`)
    .replace(new RegExp(`([가-힣])(이나|나)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) ? "이나" : "나"}`)
    .replace(new RegExp(`([가-힣])(으로|로)${boundary}`, "g"), (_, char) => `${char}${hasBatchim(char) && jongseong(char) !== 8 ? "으로" : "로"}`);
}
