// GNLAW Google Indexer — gnlaw-criminal.co.kr / gnlaw-recovery.co.kr 랜딩페이지를
// 색인 큐(/api/index-queue)에서 하나씩 가져와 구글 서치콘솔 URL 검사로
// 색인 여부를 확인하고, 미색인이면 색인 생성 요청까지 클릭해주는 로컬 PC 도구.
//
// 네이버는 서버(scripts/scan-index-queue.js)에서 IndexNow로 이미 자동 제출되므로
// 이 도구는 구글만 처리한다. 구글 공식 Indexing API는 채용공고/라이브방송 전용이라
// 이 도구는 사람이 하던 "URL 검사 → 색인 생성 요청" 조작을 서치콘솔 화면에서
// 그대로 자동화한다(Playwright + 기존 Chrome 프로필).
//
// 실제 화면으로 검증된 내용(2026-09-29):
// - resource_id는 "도메인" 속성 형식(sc-domain:호스트)이다. 처음엔 "URL 접두어"
//   형식(https://호스트/)으로 잘못 가정해서 404가 났었다.
// - URL 검사 결과 페이지(/search-console/inspect?...&id=)의 id 파라미터는 대상
//   URL이 아니라 구글이 내부적으로 발급하는 불투명 토큰이다 — 그래서 리다이렉트
//   URL을 직접 조립해 바로 이동하는 방식은 원천적으로 불가능하고, 반드시 대시보드
//   상단의 "URL 검사" 검색창에 URL을 입력해 구글이 직접 그 페이지로 이동하게 해야
//   한다.
// - "이미 색인됨" 상태의 정확한 문구는 "URL이 Google에 등록되어 있음"이다.

import { access, mkdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

export const APP_VERSION = "v1.0.0";

const DEFAULT_API_ORIGIN = "https://gnlaw-criminal.co.kr";
const DEFAULT_PROFILE_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), "gnlaw-google-indexer", "chrome-profile");
const DEFAULT_ARTIFACT_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), "gnlaw-google-indexer", "artifacts");
const DEFAULT_POLL_SECONDS = 300; // 5분
const SEARCH_CONSOLE_HOME = "https://search.google.com/search-console";

// 서치콘솔 속성이 "URL 접두어" 방식인지 "도메인" 방식인지에 따라 resource_id 형식이 다르다.
// gnlaw-criminal.co.kr은 실제 화면으로 "도메인" 속성(sc-domain:)임을 확인했다.
// gnlaw-recovery.co.kr도 같은 방식일 가능성이 높아 기본값을 동일하게 두지만, 실제로
// 달라 화면이 열리지 않으면 GNLAW_SC_RESOURCE_GNLAW_RECOVERY_CO_KR 환경변수로
// 재정의할 수 있다(예: URL 접두어 속성이면 "https://gnlaw-recovery.co.kr/").
const DEFAULT_RESOURCE_BY_HOST = {
  "gnlaw-criminal.co.kr": "sc-domain:gnlaw-criminal.co.kr",
  "gnlaw-recovery.co.kr": "sc-domain:gnlaw-recovery.co.kr",
};

export function parseArgs(argv = []) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("--") ? args.shift() : "help";
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = args[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

export function runnerConfig(options = {}) {
  return {
    apiOrigin: cleanOrigin(options.apiOrigin || process.env.GNLAW_INDEX_API_ORIGIN || DEFAULT_API_ORIGIN),
    token: options.token || process.env.INDEX_QUEUE_TOKEN || "",
    profileDir: path.resolve(options.profileDir || process.env.GNLAW_INDEXER_PROFILE_DIR || DEFAULT_PROFILE_DIR),
    artifactDir: path.resolve(options.artifactDir || process.env.GNLAW_INDEXER_ARTIFACT_DIR || DEFAULT_ARTIFACT_DIR),
    chromePath: options.chromePath || process.env.GNLAW_CHROME_PATH || "",
    pollSeconds: Math.max(30, Number(options.pollSeconds || process.env.GNLAW_INDEXER_POLL_SECONDS || DEFAULT_POLL_SECONDS)),
    quotaCooldownMinutes: Math.max(5, Number(options.quotaCooldownMinutes || process.env.GNLAW_INDEXER_QUOTA_COOLDOWN_MINUTES || 360)),
  };
}

export function resourceIdForHost(host) {
  const key = `GNLAW_SC_RESOURCE_${host.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`;
  return process.env[key] || DEFAULT_RESOURCE_BY_HOST[host] || `https://${host}/`;
}

export function dashboardUrl(resourceId) {
  return `https://search.google.com/search-console?resource_id=${encodeURIComponent(resourceId)}`;
}

function cleanOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function resolveChromePath(explicitPath) {
  const candidates = [
    explicitPath,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("Chrome/Edge 실행 파일을 찾지 못했습니다. --chrome-path로 직접 지정하세요.");
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "help" || options.help) return printHelp();
  console.log(`[GNLAW Google Indexer] ${APP_VERSION}`);

  const config = runnerConfig(options);
  if (!config.token) {
    console.error("INDEX_QUEUE_TOKEN이 필요합니다 (--token 또는 환경변수).");
    process.exit(1);
  }
  await mkdir(config.profileDir, { recursive: true });
  await mkdir(config.artifactDir, { recursive: true });
  const chromePath = await resolveChromePath(config.chromePath);

  const context = await chromium.launchPersistentContext(config.profileDir, {
    executablePath: chromePath,
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });

  try {
    if (command === "login") return await login(context, config);
    if (command === "watch") return await watch(context, config, { once: Boolean(options.once) });
    throw new Error(`알 수 없는 명령: ${command}`);
  } finally {
    await context.close().catch(() => {});
  }
}

async function login(context, config) {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(SEARCH_CONSOLE_HOME, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("\nChrome에서 구글 서치콘솔에 로그인하세요.");
  console.log(`로그인 정보는 ${config.profileDir}의 전용 Chrome 프로필에만 저장됩니다 (평소 쓰는 Chrome과 분리).`);
  console.log("로그인 후 gnlaw-criminal.co.kr, gnlaw-recovery.co.kr 두 속성이 좌측 목록에 보이는지 확인하세요.");
  await prompt("\n로그인을 완료했으면 Enter를 누르세요. ");
  console.log("로그인 상태는 Chrome 프로필에 저장되어 있어 다음 실행부터는 다시 로그인할 필요가 없습니다.");
}

async function watch(context, config, options) {
  const page = context.pages()[0] || await context.newPage();
  console.log(`대기열 감시 시작 (${config.apiOrigin}, ${config.pollSeconds}초 간격)`);
  let quotaCooldownUntil = 0;

  for (;;) {
    if (Date.now() < quotaCooldownUntil) {
      const waitMin = Math.ceil((quotaCooldownUntil - Date.now()) / 60_000);
      console.log(`[할당량] 구글 일일 색인 요청 한도로 ${waitMin}분 더 대기합니다.`);
      await delay(60_000);
      continue;
    }

    const item = await nextPendingItem(config);
    if (!item) {
      if (options.once) {
        console.log("대기 중인 항목이 없습니다.");
        return;
      }
      console.log("[대기열] 대기 항목이 없습니다.");
      await delay(config.pollSeconds * 1000);
      continue;
    }

    console.log(`\n[처리] ${item.url}`);
    try {
      const result = await inspectAndRequestIndexing(page, config, item.url);
      await reportStatus(config, item.id, result.status, result.message);
      console.log(`[완료] ${item.url} :: ${result.status} ${result.message ? `(${result.message})` : ""}`);
      if (result.status === "quota-exceeded") {
        quotaCooldownUntil = Date.now() + config.quotaCooldownMinutes * 60_000;
      }
    } catch (error) {
      const message = safeErrorMessage(error);
      console.error(`[오류] ${item.url} :: ${message}`);
      await screenshotArtifact(page, config, item.id, "error").catch(() => {});
      await reportStatus(config, item.id, "failed", message).catch(() => {});
    }

    if (options.once) return;
    await delay(config.pollSeconds * 1000);
  }
}

async function inspectAndRequestIndexing(page, config, targetUrl) {
  const host = new URL(targetUrl).hostname;
  const resourceId = resourceIdForHost(host);
  const beforeUrl = page.url();
  if (!beforeUrl.startsWith("https://search.google.com/search-console") || page.url().indexOf(encodeURIComponent(resourceId)) === -1) {
    await page.goto(dashboardUrl(resourceId), { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  await openUrlInspection(page, config, targetUrl);

  const locators = searchConsoleLocators(page);
  await waitForInspectionResult(page, locators);

  if (await locators.isIndexed.first().isVisible().catch(() => false)) {
    return { status: "indexed", message: "이미 색인됨" };
  }

  const requestButton = locators.requestIndexing.first();
  const hasRequestButton = await requestButton.isVisible().catch(() => false);
  if (!hasRequestButton) {
    await screenshotArtifact(page, config, safeFileName(targetUrl), "no-request-button");
    throw new Error("색인 생성 요청 버튼을 찾지 못했습니다 (화면 구성이 예상과 다를 수 있음).");
  }
  await requestButton.click();

  const outcome = await waitForIndexingRequestOutcome(page, locators);
  await screenshotArtifact(page, config, safeFileName(targetUrl), outcome.status);
  return outcome;
}

// 상단의 "'{호스트}'에 있는 모든 URL 검사" 검색창을 클릭 → 대상 URL 입력 → Enter.
// 구글이 자체적으로 결과 페이지(불투명 id= 토큰이 붙은 URL)로 이동시켜 준다 — 그
// 결과 URL을 직접 조립하는 건 불가능하므로 반드시 이 방식으로 진입해야 한다.
async function openUrlInspection(page, config, targetUrl) {
  const searchTrigger = page.getByText(/에 있는 모든 URL 검사/).first();
  await searchTrigger.waitFor({ state: "visible", timeout: 30_000 }).catch(async () => {
    await screenshotArtifact(page, config, "search-box-not-found", "error");
    throw new Error("서치콘솔 상단 URL 검사 검색창을 찾지 못했습니다.");
  });
  await searchTrigger.click();

  // 클릭 후 실제로 포커스를 받는 입력 요소를 찾는다. 검색창 자체가 input일 수도 있고,
  // 클릭으로 새로 열리는 오버레이의 input/combobox일 수도 있어 여러 후보를 순서대로 시도한다.
  const inputCandidates = [
    page.locator('input[type="text"]:visible'),
    page.locator('[role="combobox"] input:visible'),
    page.locator('[contenteditable="true"]:visible'),
  ];
  let typed = false;
  for (const candidate of inputCandidates) {
    const target = candidate.first();
    if (await target.isVisible().catch(() => false)) {
      await target.fill(targetUrl).catch(() => {});
      typed = true;
      break;
    }
  }
  if (!typed) {
    // 입력 요소를 특정하지 못했으면 포커스가 이미 검색창에 있다고 가정하고 키보드로 직접 입력.
    await page.keyboard.type(targetUrl, { delay: 20 });
  }
  await page.keyboard.press("Enter");

  await page.waitForURL(/[?&]id=/, { timeout: 30_000 }).catch(async () => {
    await screenshotArtifact(page, config, safeFileName(targetUrl), "no-navigation");
  });
}

function searchConsoleLocators(page) {
  return {
    // 확인된 정확한 문구: "URL이 Google에 등록되어 있음" (이전엔 "...있습니다"로 잘못 가정했었음)
    isIndexed: page.getByText(/URL이 Google에 등록되어 있음|URL is on Google/i),
    isNotIndexed: page.getByText(/URL이 Google에 등록되어 있지 않음|URL is not on Google/i),
    requestIndexing: page.getByRole("button", { name: /색인 생성 요청|Request indexing/i }),
    requestInProgress: page.getByText(/색인 생성 확인 중|Validating|테스트 실행 중|Testing/i),
    requestSucceeded: page.getByText(/색인이 생성되도록 요청했습니다|Indexing requested|URL을 처리 대기열에 추가했습니다/i),
    quotaExceeded: page.getByText(/할당량을 초과|quota|한도를 초과/i),
    errorState: page.getByText(/오류가 발생했습니다|couldn't fetch|An error occurred/i),
  };
}

async function waitForInspectionResult(page, locators) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await locators.isIndexed.first().isVisible().catch(() => false)) return;
    if (await locators.isNotIndexed.first().isVisible().catch(() => false)) return;
    if (await locators.errorState.first().isVisible().catch(() => false)) {
      throw new Error("URL 검사 중 서치콘솔이 오류를 표시했습니다.");
    }
    await delay(1_000);
  }
  throw new Error("URL 검사 결과가 시간 내에 표시되지 않았습니다.");
}

async function waitForIndexingRequestOutcome(page, locators) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await locators.quotaExceeded.first().isVisible().catch(() => false)) {
      return { status: "quota-exceeded", message: "일일 색인 생성 요청 한도 초과" };
    }
    if (await locators.requestSucceeded.first().isVisible().catch(() => false)) {
      return { status: "requested", message: "색인 생성 요청 완료" };
    }
    if (await locators.errorState.first().isVisible().catch(() => false)) {
      return { status: "failed", message: "색인 생성 요청 중 오류" };
    }
    await delay(1_000);
  }
  throw new Error("색인 생성 요청 결과가 시간 내에 표시되지 않았습니다.");
}

async function screenshotArtifact(page, config, name, suffix) {
  const filePath = path.join(config.artifactDir, `${safeFileName(name)}-${Date.now()}-${suffix}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[스크린샷] ${filePath}`);
  return filePath;
}

async function nextPendingItem(config) {
  const data = await apiJson(config, "GET", `${config.apiOrigin}/api/index-queue?status=pending`);
  const items = data.items || [];
  return items.length ? items[items.length - 1] : null; // 가장 오래된 pending부터
}

async function reportStatus(config, id, status, message = "") {
  return apiJson(config, "POST", `${config.apiOrigin}/api/index-queue`, {
    action: "report",
    id,
    status,
    message: String(message || "").slice(0, 500),
  });
}

async function apiJson(config, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API 응답이 올바르지 않습니다 (HTTP ${res.status}).`);
  }
  if (!res.ok || !data.ok) throw new Error(data.message || `API 요청 실패 (HTTP ${res.status})`);
  return data;
}

function safeFileName(value) {
  return String(value || "item").replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 120);
}

function safeErrorMessage(error) {
  return String(error?.message || error || "알 수 없는 오류").split(/\nCall log:/i)[0].trim();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

function printHelp() {
  console.log(`
사용법:
  node cli.mjs login              구글 서치콘솔에 로그인하고 세션을 Chrome 프로필에 저장
  node cli.mjs watch [--once]     색인 큐를 감시하며 순서대로 처리 (--once: 한 건만 처리 후 종료)

환경변수:
  INDEX_QUEUE_TOKEN                 필수. functions/api/index-queue.js와 같은 토큰
  GNLAW_INDEX_API_ORIGIN             기본값 https://gnlaw-criminal.co.kr
  GNLAW_INDEXER_POLL_SECONDS         기본값 300(5분)
  GNLAW_SC_RESOURCE_GNLAW_CRIMINAL_CO_KR  gnlaw-criminal.co.kr 서치콘솔 속성 resource_id 재정의
  GNLAW_SC_RESOURCE_GNLAW_RECOVERY_CO_KR  gnlaw-recovery.co.kr 서치콘솔 속성 resource_id 재정의
`);
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exit(1);
  });
}
