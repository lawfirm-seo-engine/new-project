import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { chromium, request } from "playwright-core";

export const APP_VERSION = "v1.76.0 · 수정 76차";
const DEFAULT_SITE_ORIGIN = "https://gnlaw-criminal.co.kr";
const DEFAULT_CLUB_ID = "31738465";
const DEFAULT_CAFE_URL = "https://cafe.naver.com/gnlawfintech";
const DEFAULT_PHONE_LINK = "https://gnlaw-criminal.co.kr/call_redirect/";
const DEFAULT_KAKAO_LINK = "https://gnlaw-criminal.co.kr/kakao_redirect/";
const DEFAULT_PROFILE_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), "gnlaw-smarteditor-runner", "chrome-profile");
const DEFAULT_ARTIFACT_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), "gnlaw-smarteditor-runner", "artifacts");
const DEFAULT_SESSION_STATE_PATH = path.join(process.env.LOCALAPPDATA || os.homedir(), "gnlaw-smarteditor-runner", "session-state.json");

export function parseArgs(argv = []) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("-") ? args.shift() : "help";
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
    siteOrigin: cleanOrigin(options.siteOrigin || process.env.GNLAW_SITE_ORIGIN || DEFAULT_SITE_ORIGIN),
    clubId: String(options.clubId || process.env.GNLAW_CAFE_CLUB_ID || DEFAULT_CLUB_ID),
    cafeUrl: cleanOrigin(options.cafeUrl || process.env.GNLAW_CAFE_URL || DEFAULT_CAFE_URL),
    profileDir: path.resolve(options.profileDir || process.env.GNLAW_CAFE_PROFILE_DIR || DEFAULT_PROFILE_DIR),
    artifactDir: path.resolve(options.artifactDir || process.env.GNLAW_CAFE_ARTIFACT_DIR || DEFAULT_ARTIFACT_DIR),
    sessionStatePath: path.resolve(options.sessionStatePath || process.env.GNLAW_SESSION_STATE_PATH || DEFAULT_SESSION_STATE_PATH),
    chromePath: options.chromePath || process.env.GNLAW_CHROME_PATH || "",
    phoneLink: options.phoneLink || process.env.GNLAW_PHONE_LINK || DEFAULT_PHONE_LINK,
    kakaoLink: options.kakaoLink || process.env.GNLAW_KAKAO_LINK || DEFAULT_KAKAO_LINK,
    pollSeconds: Math.max(5, Number(options.pollSeconds || process.env.GNLAW_POLL_SECONDS || 15)),
    runnerId: String(options.runnerId || process.env.GNLAW_RUNNER_ID || randomUUID()).toLowerCase(),
    runnerName: String(options.runnerName || process.env.GNLAW_RUNNER_NAME || `${os.hostname()} / ${os.userInfo().username || "user"} / PID ${process.pid}`).slice(0, 120),
  };
}

export function boardForJob(job = {}) {
  const payment = job.imageSetKey === "payment-suspension-release" || job.fraudType === "payment-suspension-release";
  return payment
    ? { menuId: "2", label: "계좌지급정지해제" }
    : { menuId: "1", label: "사기피해진행사건정리" };
}

export function orderedJobImages(job = [], siteOrigin = DEFAULT_SITE_ORIGIN) {
  const source = Array.isArray(job) ? job : job.images;
  const images = (Array.isArray(source) ? source : [])
    .filter((image) => image && image.url)
    .map((image, index) => ({
      ...image,
      slot: String(image.slot || index + 1),
      url: new URL(String(image.url), `${cleanOrigin(siteOrigin)}/`).href,
    }));
  const payment = !Array.isArray(job)
    ? job.imageSetKey === "payment-suspension-release" || job.fraudType === "payment-suspension-release"
    : images.some((image) => /\/payment-suspension-release\//i.test(image.url));
  const sequence = payment
    ? ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "kakao", "phone"]
    : ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "kakao", "phone"];
  const order = new Map(sequence.map((slot, index) => [slot, index]));
  return images.sort((left, right) => {
    const leftOrder = order.get(left.slot) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.slot) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.slot.localeCompare(right.slot, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function parseLinkedImageData(raw = "") {
  try {
    const parsed = JSON.parse(raw);
    return { id: String(parsed.id || ""), link: String(parsed.link || ""), src: String(parsed.src || "") };
  } catch {
    return { id: "", link: "", src: "" };
  }
}

export function jobVideoUrl(job = {}, siteOrigin = DEFAULT_SITE_ORIGIN) {
  const raw = String(job?.videoUrl || "").trim();
  if (!raw) return "";
  const url = new URL(raw, `${cleanOrigin(siteOrigin)}/`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("릴스 영상 URL은 HTTP 또는 HTTPS 주소여야 합니다.");
  }
  return url.href;
}

export function articleBodyForJob(job = {}) {
  const body = String(job?.draft?.body || "").replace(/\r\n?/g, "\n");
  const permalink = String(job?.instagramPermalink || "").trim();
  if (!permalink) return body;

  const lines = body.split("\n");
  const filtered = lines.filter((line, index) => {
    if (line.trim() === permalink) return false;
    if (line.trim() !== "Instagram 릴스 영상") return true;
    return !lines.slice(index + 1).some((nextLine) => nextLine.trim() === permalink);
  });
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function articleBodyPartsForJob(job = {}) {
  const paragraphs = articleBodyForJob(job)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const linkBlocks = paragraphs.filter((paragraph) => /https?:\/\//i.test(paragraph));
  const manuscript = paragraphs.filter((paragraph) => !/https?:\/\//i.test(paragraph));
  return {
    manuscript: manuscript.join("\n\n"),
    links: linkBlocks.join("\n\n"),
  };
}

export function articleLinkUrls(body = "") {
  return [...String(body || "").matchAll(/https?:\/\/[^\s<>"']+/gi)]
    .map((match) => match[0].replace(/[),.;!?]+$/g, ""));
}

export function manuscriptBatches(body = "") {
  return String(body || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function hasNaverSessionCookies(cookies = []) {
  const names = new Set((Array.isArray(cookies) ? cookies : []).map((cookie) => String(cookie?.name || "")));
  return names.has("NID_SES") || names.has("NID_AUT");
}

export function isBrowserClosedError(error) {
  const message = String(error?.message || error || "");
  return /target (?:page, )?context or browser has been closed|browser has been closed|browser.*(?:closed|crashed)|page.*closed|context.*closed/i.test(message);
}

export function isTransientNetworkError(error) {
  const message = String(error?.message || error || "");
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network.*(?:changed|failed)|connection.*(?:closed|reset)/i.test(message);
}

function safeErrorMessage(error) {
  return String(error?.message || error || "알 수 없는 오류")
    .split(/\nCall log:/i)[0]
    .replace(/^\s*-\s*cookie:.*$/gim, "")
    .trim();
}

async function launchRunnerContext(config, chromePath) {
  return chromium.launchPersistentContext(config.profileDir, {
    executablePath: chromePath,
    headless: false,
    viewport: null,
    acceptDownloads: true,
    chromiumSandbox: true,
    args: [
      "--start-maximized",
      "--disable-accelerated-video-encode",
      "--disable-accelerated-video-decode",
      "--disable-accelerated-2d-canvas",
    ],
  });
}

async function createApiContext(context) {
  return request.newContext({ storageState: await context.storageState() });
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "help" || options.help) return printHelp();
  console.log(`[GNLAW SmartEditor] ${APP_VERSION}`);

  const config = runnerConfig(options);
  await mkdir(config.profileDir, { recursive: true });
  await mkdir(config.artifactDir, { recursive: true });
  const chromePath = await resolveChromePath(config.chromePath);
  const runOptions = {
    publish: Boolean(options.publish),
    yes: Boolean(options.yes),
    once: Boolean(options.once),
    includeVideo: !Boolean(options.skipVideo),
    stopAfterCurrent: false,
  };
  if (command === "watch") return watchWithBrowserRecovery(config, chromePath, runOptions);

  const context = await launchRunnerContext(config, chromePath);
  let apiContext;
  try {
    await restoreSessionState(context, config);
    if (command === "login") return await login(context, config);
    apiContext = await createApiContext(context);
    if (command === "prepare" || command === "publish") {
      const job = options.jobFile
        ? JSON.parse(await readFile(path.resolve(options.jobFile), "utf8"))
        : await loadJob(apiContext, config, requiredOption(options, "jobId"));
      return await processJob(context, apiContext, config, job, {
        publish: command === "publish" || Boolean(options.publish),
        yes: Boolean(options.yes),
        includeVideo: !Boolean(options.skipVideo),
        editArticleId: options.editArticleId || "",
      });
    }
    throw new Error(`알 수 없는 명령: ${command}`);
  } finally {
    await apiContext?.dispose().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function watchWithBrowserRecovery(config, chromePath, options) {
  const maxRestarts = 5;
  for (let restart = 0; restart <= maxRestarts; restart += 1) {
    let context;
    let apiContext;
    try {
      context = await launchRunnerContext(config, chromePath);
      await restoreSessionState(context, config);
      apiContext = await createApiContext(context);
      if (restart > 0) console.log(`[복구] Chrome 재실행 완료 (${restart}/${maxRestarts}) · 대기열 감시를 재개합니다.`);
      return await watchQueue(context, apiContext, config, options);
    } catch (error) {
      const browserClosed = isBrowserClosedError(error);
      const transientNetwork = isTransientNetworkError(error);
      if ((!browserClosed && !transientNetwork) || options.once || restart >= maxRestarts) throw error;
      console.error(browserClosed
        ? `[복구] 자동화용 Chrome이 종료되었습니다: ${safeErrorMessage(error)}`
        : `[복구] 서버 연결이 일시적으로 끊겼습니다: ${safeErrorMessage(error)}`);
      console.error(`[복구] 로그인 세션을 유지한 채 자동화를 다시 연결합니다 (${restart + 1}/${maxRestarts}).`);
    } finally {
      await apiContext?.dispose().catch(() => {});
      await context?.close().catch(() => {});
    }
    await delay(Math.min(2_000 * (restart + 1), 10_000));
  }
}

async function login(context, config) {
  const naver = context.pages()[0] || await context.newPage();
  await naver.goto(config.cafeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const admin = await context.newPage();
  await admin.goto(`${config.siteOrigin}/admin/cafe-reels`, { waitUntil: "domcontentloaded" });
  console.log("\nChrome에서 네이버와 gnlaw-criminal 관리자 로그인을 완료하세요.");
  console.log(`로그인 정보는 ${config.profileDir}의 Chrome 프로필에만 저장됩니다.`);
  await prompt("\n두 로그인을 모두 완료했으면 Enter를 누르세요. ");
  await assertNaverLogin(naver);
  await assertSavedNaverSession(context);
  const apiContext = await createApiContext(context);
  try {
    await loadQueue(apiContext, config);
  } finally {
    await apiContext.dispose().catch(() => {});
  }
  await saveSessionState(context, config);
  console.log("로그인 상태를 확인하고 다음 실행용 세션을 저장했습니다.");
}

async function watchQueue(context, apiContext, config, options) {
  const monitorPage = context.pages()[0] || await context.newPage();
  await verifyLoginSessions(context, monitorPage, apiContext, config);
  await waitForRunnerTurn(apiContext, config, options);
  const stopHeartbeat = startRunnerHeartbeat(apiContext, config, options);
  console.log(`랜딩·릴스·SmartEditor 전체 대기열 감시 시작 (${config.siteOrigin}, ${config.pollSeconds}초 간격)`);
  let emptyQueueLogged = false;
  try {
    for (;;) {
      if (monitorPage.isClosed() || context.pages().length === 0) {
        throw new Error("Browser has been closed while the queue watcher was running.");
      }
      const lease = await heartbeatRunner(apiContext, config, "poll");
      if (lease.shouldStopAfterCurrent || options.stopAfterCurrent) {
        console.log("[인계] 다른 PC에서 자동화를 시작했습니다. 새 작업을 집지 않고 종료합니다.");
        return;
      }
      const jobs = await loadQueue(apiContext, config);
      const byReservedNumber = (a, b) => Number(a.reservedNaverArticleId || Number.MAX_SAFE_INTEGER) - Number(b.reservedNaverArticleId || Number.MAX_SAFE_INTEGER);
      const cafeQueued = jobs
        .filter((job) => job.cafeStatus === "smarteditor-queued")
        .sort(byReservedNumber)
        .at(0);
      if (cafeQueued) {
        emptyQueueLogged = false;
        const job = await loadJob(apiContext, config, cafeQueued.id);
        const result = await processJob(context, apiContext, config, job, options, monitorPage);
        const afterJobLease = await heartbeatRunner(apiContext, config, "after-job");
        if (afterJobLease.shouldStopAfterCurrent || options.stopAfterCurrent) {
          console.log("[인계] 현재 글을 완료했습니다. 다른 PC가 이어받을 수 있도록 자동화를 종료합니다.");
          return;
        }
        if (!result?.posted && !options.yes) return;
      } else {
        if (options.once) {
          console.log("대기 중인 SmartEditor 작업이 없습니다.");
          return;
        }
        if (!emptyQueueLogged) {
          console.log("[대기열] 대기 작업이 없습니다. 새 작업이 등록될 때까지 계속 감시합니다.");
          emptyQueueLogged = true;
        }
      }
      if (options.once) return;
      await delay(config.pollSeconds * 1000);
      if (monitorPage.isClosed() || context.pages().length === 0) {
        throw new Error("Browser has been closed while the queue watcher was running.");
      }
    }
  } finally {
    stopHeartbeat();
    await releaseRunner(apiContext, config).catch((error) => {
      console.error(`[실행기] 종료 상태 저장 실패: ${safeErrorMessage(error)}`);
    });
  }
}

async function verifyLoginSessions(context, page, apiContext, config) {
  console.log("[사전 확인] gnlaw-criminal 관리자 로그인 확인 중...");
  await page.goto(`${config.siteOrigin}/admin/cafe-reels`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  if (/\/admin\/login/i.test(page.url())) {
    throw new Error("gnlaw-criminal 관리자 로그인이 필요합니다. 프로그램에서 '최초 로그인'을 실행하세요.");
  }
  await loadQueue(apiContext, config);
  console.log("[사전 확인] 관리자 로그인 확인 완료");

  console.log("[사전 확인] 네이버 카페 로그인 확인 중...");
  await page.goto(config.cafeUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await assertNaverLogin(page);
  await assertSavedNaverSession(context);
  await saveSessionState(context, config);
  console.log("[사전 확인] 네이버 카페 로그인 확인 완료");

  await page.goto(`${config.siteOrigin}/admin/cafe-reels`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await loadQueue(apiContext, config);
  console.log("[사전 확인] 두 로그인 확인 완료 · 자동화를 시작합니다.");
}

async function assertSavedNaverSession(context) {
  const naverCookies = await context.cookies(["https://naver.com", "https://cafe.naver.com"]);
  if (!hasNaverSessionCookies(naverCookies)) {
    throw new Error("네이버 카페 로그인이 필요합니다. 프로그램에서 '최초 로그인'을 실행한 뒤 다시 자동화 시작을 눌러주세요.");
  }
}

async function restoreSessionState(context, config) {
  try {
    const state = JSON.parse(await readFile(config.sessionStatePath, "utf8"));
    const now = Date.now() / 1000;
    const cookies = (Array.isArray(state?.cookies) ? state.cookies : [])
      .filter((cookie) => Number(cookie?.expires || -1) < 0 || Number(cookie.expires) > now);
    if (cookies.length) {
      await context.addCookies(cookies);
      console.log(`[세션] 저장된 로그인 쿠키 ${cookies.length}개를 복원했습니다.`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.log(`[세션] 저장 상태를 복원하지 못했습니다: ${error.message}`);
  }
}

async function saveSessionState(context, config) {
  await mkdir(path.dirname(config.sessionStatePath), { recursive: true });
  await context.storageState({ path: config.sessionStatePath });
  console.log(`[세션] 로그인 상태를 ${config.sessionStatePath}에 저장했습니다.`);
}

async function processJob(context, apiContext, config, job, options, existingPage = null) {
  validateJob(job);
  const board = boardForJob(job);
  const images = orderedJobImages(job, config.siteOrigin);
  const articleParts = articleBodyPartsForJob(job);
  const phoneIndex = images.findIndex((image) => image.slot === "phone");
  const kakaoIndex = images.findIndex((image) => image.slot === "kakao");
  const videoUrl = options.includeVideo === false ? "" : jobVideoUrl(job, config.siteOrigin);
  if (phoneIndex < 0 || kakaoIndex < 0) throw new Error("전화·카카오 이미지가 모두 필요합니다.");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gnlaw-smarteditor-"));
  const page = existingPage || await context.newPage();
  const ownsPage = !existingPage;
  let submitStarted = false;
  try {
    if (options.publish) await reportStatus(apiContext, config, job.id, "preparing");
    const files = await downloadImages(apiContext, images, tempDir);
    const videoFile = videoUrl ? await downloadVideo(apiContext, videoUrl, tempDir) : null;
    const editArticleId = String(options.editArticleId || "").replace(/\D/g, "");
    const writeUrl = editArticleId
      ? `https://cafe.naver.com/ca-fe/cafes/${encodeURIComponent(config.clubId)}/articles/${editArticleId}/modify`
      : `https://cafe.naver.com/ca-fe/cafes/${encodeURIComponent(config.clubId)}/menus/${board.menuId}/articles/write`;
    await clearNaverDraftState(page);
    await page.goto(`${writeUrl}?gnlawRun=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await assertNaverLogin(page);
    if (editArticleId && !await page.locator("p.se-text-paragraph:visible").first()
      .waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false)) {
      await openExistingArticleEditor(page, config, editArticleId);
    }
    if (!editArticleId) await selectBoard(page, board);

    const articleTitle = String(job.draft.title || job.title || "");
    await page.locator("p.se-text-paragraph:visible").first().waitFor({ state: "visible", timeout: 30_000 });
    await resetEditorForJob(page);
    await fillArticleTitle(page, articleTitle);
    await uploadImagesInOrder(page, files);
    await insertArticleBody(page, articleParts.manuscript, { append: true });

    if (articleParts.links) {
      await insertArticleBody(page, articleParts.links, { append: true });
      await waitForEditorLinksStable(page, articleLinkUrls(articleParts.links));
    }

    if (videoFile) {
      await uploadVideo(page, videoFile, String(job.caseName || job.draft.title || "릴스 영상"));
    }
    if (job.instagramPermalink) {
      await insertInstagramReelPreview(page, job.instagramPermalink);
    }

    await setImageLink(page, phoneIndex, config.phoneLink);
    await setImageLink(page, kakaoIndex, config.kakaoLink);
    await fillArticleTitle(page, articleTitle);

    const screenshotPath = path.join(config.artifactDir, `${safeFileName(job.id)}-${Date.now()}-prepared.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`\n작성 완료: ${job.draft.title}`);
    console.log(`이미지 ${images.length}개 / 전화·카카오 링크 검증 완료${videoFile ? " / 릴스 영상 첨부 완료" : ""}`);
    console.log(`확인 스크린샷: ${screenshotPath}`);

    if (!options.publish) {
      console.log("미리보기 모드이므로 게시하지 않습니다.");
      await prompt("Chrome에서 결과를 확인한 뒤 Enter를 누르면 종료합니다. ");
      return { posted: false, screenshotPath };
    }

    if (!options.yes) {
      const answer = (await prompt("네이버 카페에 실제로 게시할까요? [y/N] ")).trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") {
        console.log("게시하지 않고 종료합니다.");
        return { posted: false, screenshotPath };
      }
    }

    submitStarted = await submitArticle(page);
    const cafeUrl = await canonicalCafeArticleUrl(page, config, editArticleId || job.reservedNaverArticleId);
    await openPublishedArticleForVerification(page, cafeUrl);
    const publishedImages = await verifyPublishedImageSequence(page, files);
    const publishedLinks = await verifyPublishedLinks(page, [config.phoneLink, config.kakaoLink]);
    if (videoFile) await verifyPublishedVideo(page);
    if (job.instagramPermalink) {
      await verifyPublishedInstagramOrder(page, articleLinkUrls(articleParts.links), job.instagramPermalink);
    }
    await reportStatus(apiContext, config, job.id, "posted", { cafeUrl });
    console.log(`게시 완료: ${cafeUrl}`);
    console.log(`공개 글 이미지 순서 검증: ${publishedImages.join(" → ")}`);
    console.log(`공개 글 링크 검증: ${publishedLinks.join(", ")}`);
    return { posted: true, cafeUrl, screenshotPath, videoUploaded: Boolean(videoFile) };
  } catch (error) {
    const failureScreenshotPath = path.join(config.artifactDir, `${safeFileName(job.id)}-${Date.now()}-failed.png`);
    if (await page.screenshot({ path: failureScreenshotPath, fullPage: false }).then(() => true).catch(() => false)) {
      console.error(`SmartEditor 실패 화면: ${failureScreenshotPath}`);
    }
    if (options.publish && shouldRequeueSmartEditor(error, submitStarted)) {
      await queueSmartEditor(apiContext, config, job.id).catch(() => {});
      console.error("[복구] 게시 요청 전 오류를 감지해 작업을 SmartEditor 대기열로 되돌렸습니다.");
    } else if (options.publish) {
      const message = isBrowserClosedError(error) && submitStarted
        ? `게시 요청 이후 Chrome이 종료되었습니다. 중복 방지를 위해 자동 재시도하지 않습니다: ${safeErrorMessage(error)}`
        : safeErrorMessage(error);
      await reportStatus(apiContext, config, job.id, "failed", { message }).catch(() => {});
    }
    throw error;
  } finally {
    if (ownsPage) await page.close().catch(() => {});
    else await page.goto(`${config.siteOrigin}/admin/cafe-reels`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function openExistingArticleEditor(page, config, articleId) {
  const iframePath = `/ArticleRead.nhn?clubid=${config.clubId}&articleid=${articleId}`;
  const articleUrl = `${config.cafeUrl}?iframe_url=${encodeURIComponent(iframePath)}`;
  console.log(`[편집기] 직접 수정 주소가 열리지 않아 공개 글 ${articleId}번의 수정 메뉴로 다시 진입합니다.`);
  await page.goto(articleUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await assertNaverLogin(page);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await dismissNaverCafeDialogs(page);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const frame of page.frames()) {
      const direct = frame.getByText("수정", { exact: true });
      for (let index = await direct.count() - 1; index >= 0; index -= 1) {
        const candidate = direct.nth(index);
        if (!await candidate.isVisible().catch(() => false)) continue;
        await candidate.click();
        if (await page.locator("p.se-text-paragraph:visible").first()
          .waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false)) return;
      }

      const more = frame.getByRole("button", { name: /더보기|메뉴/ });
      for (let index = await more.count() - 1; index >= 0; index -= 1) {
        const button = more.nth(index);
        if (!await button.isVisible().catch(() => false)) continue;
        await button.click().catch(() => {});
        const modify = frame.getByText("수정", { exact: true }).last();
        if (await modify.isVisible().catch(() => false)) {
          await modify.click();
          if (await page.locator("p.se-text-paragraph:visible").first()
            .waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false)) return;
        }
      }
    }
    if (attempt < 3) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
      await dismissNaverCafeDialogs(page);
      await delay(1_000);
    }
  }
  throw new Error(`네이버 카페 ${articleId}번 글의 수정 메뉴를 찾지 못했습니다. 작성 계정과 글 소유권을 확인해주세요.`);
}

async function dismissNaverCafeDialogs(page) {
  const acknowledgements = [
    page.getByText(/확인했어요!\s*더 이상 보지 않을래요/, { exact: false }),
    page.getByRole("button", { name: /닫기/ }),
  ];
  for (const candidates of acknowledgements) {
    for (let index = await candidates.count() - 1; index >= 0; index -= 1) {
      const candidate = candidates.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click().catch(() => {});
        await delay(300);
      }
    }
  }
}

async function fillArticleTitle(page, title) {
  const input = page.locator('textarea[placeholder="제목을 입력해 주세요."]');
  await input.fill(title);
  if (await input.inputValue() !== title) throw new Error("카페 원고 제목 입력 검증 실패");
}

async function clearNaverDraftState(page) {
  console.log("[편집기] 이전 임시 편집 상태를 초기화합니다.");
  await page.goto("https://cafe.naver.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (globalThis.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if (globalThis.indexedDB?.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(databases.filter((database) => database.name).map((database) => new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(database.name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      })));
    }
  }).catch((error) => {
    console.log(`[편집기] 로컬 임시 상태 정리 일부를 건너뜁니다: ${error.message}`);
  });
}

async function resetEditorForJob(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await focusEditorParagraph(page);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await delay(750);

  const staleMedia = page.locator("div.se-component.se-image, div.se-component.se-video");
  if (await staleMedia.count() > 0) {
    await focusEditorParagraph(page);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await delay(750);
  }
  if (await staleMedia.count() > 0) {
    throw new Error("네이버가 복원한 이전 임시 원고를 초기화하지 못했습니다. 편집기 창을 닫고 다시 실행해 주세요.");
  }
  console.log("[편집기] 새 원고 입력 상태를 확인했습니다.");
}

async function focusEditorParagraph(page, atStart = false) {
  const paragraphs = page.locator("p.se-text-paragraph:visible");
  const paragraph = atStart ? paragraphs.first() : paragraphs.last();
  await paragraph.waitFor({ state: "visible", timeout: 30_000 });
  await paragraph.scrollIntoViewIfNeeded();
  const clicked = await paragraph.click({ position: { x: 24, y: 12 }, timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!clicked) {
    const box = await paragraph.boundingBox();
    if (!box) throw new Error("SmartEditor 본문 입력 위치를 찾지 못했습니다.");
    await page.mouse.click(box.x + Math.min(24, Math.max(4, box.width / 2)), box.y + Math.min(12, Math.max(4, box.height / 2)));
  }
  await page.keyboard.press(atStart ? "Home" : "End");
  await delay(100);
  return paragraph;
}

async function chooseImageFiles(page, filePaths, options = {}) {
  if (options.preferExistingInput && await setFilesOnMatchingInput(page, filePaths, /image/i)) {
    console.log("[사진] 기존 파일 입력기를 재사용했습니다.");
    return;
  }
  const addButton = page.getByRole("button", { name: "사진 추가", exact: true });
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.keyboard.press("Escape").catch(() => {});
      await addButton.waitFor({ state: "visible", timeout: 10_000 });
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10_000 }),
        addButton.click({ force: attempt > 1 }),
      ]);
      await chooser.setFiles(filePaths);
      if (attempt > 1) console.log(`[사진] 파일 선택창 ${attempt}회차 재시도에 성공했습니다.`);
      else console.log("[사진] 기본 이미지를 네이버 업로더에 전달했습니다.");
      return;
    } catch (error) {
      lastError = error;
      if (await setFilesOnMatchingInput(page, filePaths, /image/i)) {
        console.log("[사진] 파일 입력 요소에 기본 이미지를 직접 지정했습니다.");
        return;
      }
      if (attempt < 3) {
        console.log(`[사진] 파일 선택창이 열리지 않아 재시도합니다 (${attempt}/3).`);
        await delay(1_000);
      }
    }
  }
  throw new Error(`기본 이미지 파일 선택 실패 (3회 재시도): ${lastError?.message || "파일 선택창이 열리지 않았습니다."}`);
}

async function uploadImagesInOrder(page, files) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    let uploaded = false;
    let lastError;
    for (let attempt = 1; attempt <= 3 && !uploaded; attempt += 1) {
      try {
        await focusEditorParagraph(page);
        await page.keyboard.press("Control+End");
        await chooseImageFiles(page, [file.path], { preferExistingInput: index > 0 && attempt === 1 });
        await waitForImageCount(page, index + 1);
        uploaded = true;
      } catch (error) {
        lastError = error;
        const transferError = page.getByText("파일 전송 오류", { exact: true });
        if (await transferError.isVisible().catch(() => false)) {
          console.log(`[사진] 네이버 파일 전송 일시 제한을 감지했습니다 (${file.slot}, ${attempt}/3).`);
          await page.getByRole("button", { name: "확인", exact: true }).click({ force: true }).catch(() => {});
          await transferError.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
        }
        if (attempt < 3) {
          const backoff = attempt * 15_000;
          console.log(`[사진] ${Math.round(backoff / 1000)}초 후 ${file.slot} 이미지를 다시 업로드합니다.`);
          await delay(backoff);
        }
      }
    }
    if (!uploaded) throw new Error(`${file.slot} 이미지 업로드 3회 실패: ${lastError?.message || "네이버 파일 전송 오류"}`);
    await verifyEditorImageSequence(page, files.slice(0, index + 1));
    console.log(`[사진] ${file.slot} 이미지 실제 배치 순서 확인 완료 (${index + 1}/${files.length})`);
    await delay(1_500);
  }
}

async function verifyEditorImageSequence(page, expectedFiles) {
  const dimensions = await page.locator("div.se-component.se-image img.se-image-resource").evaluateAll((images) => (
    images.map((image) => ({ width: image.naturalWidth, height: image.naturalHeight }))
  ));
  if (dimensions.length < expectedFiles.length) {
    throw new Error(`이미지 실제 배치 순서 검증 실패: ${expectedFiles.length}개 중 ${dimensions.length}개만 확인됨`);
  }
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const expected = expectedFiles[index];
    if (!expected.width || !expected.height) continue;
    const actual = dimensions[index];
    const expectedRatio = expected.height / expected.width;
    const actualRatio = actual.height / actual.width;
    if (!Number.isFinite(actualRatio) || Math.abs(expectedRatio - actualRatio) > 0.003) {
      throw new Error(`이미지 실제 배치 순서 검증 실패: ${index + 1}번째는 ${expected.slot} 이미지가 아닙니다.`);
    }
  }
}

async function setFilesOnMatchingInput(page, filePaths, acceptPattern) {
  for (const frame of page.frames()) {
    const inputs = frame.locator('input[type="file"]');
    for (let index = await inputs.count() - 1; index >= 0; index -= 1) {
      const input = inputs.nth(index);
      const accept = await input.getAttribute("accept").catch(() => "");
      if (!acceptPattern.test(String(accept || ""))) continue;
      try {
        await input.setInputFiles(filePaths);
        return true;
      } catch {
        // Try the next matching input or frame.
      }
    }
  }
  return false;
}

async function chooseIndividualPhotoMode(page) {
  const heading = page.getByText("사진 첨부 방식", { exact: true }).last();
  const appeared = await heading.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
  if (!appeared) return;
  await page.getByText("개별사진", { exact: true }).last().click();
  await heading.waitFor({ state: "hidden", timeout: 30_000 });
}

async function insertArticleBody(page, body, options = {}) {
  const content = String(body || "");
  if (!content.trim()) return;
  await focusEditorParagraph(page, !options.append);
  if (options.append) {
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
  }

  const normalizedContent = content.replace(/\r\n?/g, "\n");
  const blocks = manuscriptBatches(normalizedContent);
  const contentLines = blocks.flatMap((block) => block.split("\n").map((line) => line.trim()).filter(Boolean));
  const compactText = (value) => String(value || "").normalize("NFKC").replace(/[^0-9A-Za-z가-힣]/g, "");
  const expected = contentLines
    .map((line) => ({ line, token: compactText(line).slice(0, 24) }))
    .filter((item) => item.token);
  const beforeParagraphs = await page.locator("p.se-text-paragraph:visible").count();

  let clipboardPaste = false;
  try {
    const origin = new URL(page.url()).origin;
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    await page.evaluate(async (text) => navigator.clipboard.writeText(text), normalizedContent);
    await page.keyboard.press("Control+V");
    clipboardPaste = true;
  } catch (error) {
    console.log(`[본문] 클립보드 일괄 입력을 사용할 수 없어 직접 일괄 입력합니다: ${safeErrorMessage(error)}`);
    await page.keyboard.insertText(normalizedContent);
  }

  const deadline = Date.now() + 15_000;
  let missing = expected;
  while (Date.now() < deadline) {
    await delay(400);
    const paragraphTexts = await page.locator("p.se-text-paragraph:visible").allInnerTexts().catch(() => []);
    const linkedUrls = await page.locator("a[href]:visible").evaluateAll((anchors) => (
      anchors.map((anchor) => anchor.getAttribute("href") || "")
    )).catch(() => []);
    const editorText = compactText([...paragraphTexts, ...linkedUrls].join("\n"));
    missing = expected.filter((item) => !editorText.includes(item.token));
    if (!missing.length) break;
  }
  if (missing.length) {
    throw new Error(`카페 원고 일괄 입력 검증 실패 (${missing.length}/${expected.length}개 누락): ${missing[0].line.slice(0, 80)}`);
  }

  const afterParagraphs = await page.locator("p.se-text-paragraph:visible").count();
  console.log(`[본문] ${contentLines.length}개 줄·${blocks.length}개 문단 블록을 ${clipboardPaste ? "한 번에 붙여넣고" : "한 번에 입력하고"} 전체 내용을 확인했습니다 (문단 ${beforeParagraphs}→${afterParagraphs}).`);

  await focusEditorParagraph(page);
  await page.keyboard.press("Control+End");
}

function comparableUrl(value = "") {
  let result = String(value || "").trim().replace(/\s+/g, "");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }
  return result.replace(/\/$/, "");
}

async function waitForEditorLinksStable(page, expectedUrls) {
  const expected = expectedUrls.map(comparableUrl).filter(Boolean);
  if (!expected.length) return;

  await focusEditorParagraph(page);
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");

  const deadline = Date.now() + 45_000;
  let stableChecks = 0;
  let previousSignature = "";
  let observed = [];
  while (Date.now() < deadline) {
    observed = await page.locator("a[href]:visible, [data-linkdata]:visible, p.se-text-paragraph:visible")
      .evaluateAll((elements) => elements.map((element) => ({
        href: element.getAttribute("href") || "",
        linkData: element.getAttribute("data-linkdata") || "",
        text: element.textContent || "",
      }))).catch(() => []);
    const comparableObserved = observed
      .flatMap((item) => [item.href, item.linkData, item.text])
      .map(comparableUrl);
    const complete = expected.every((url) => comparableObserved.some((value) => value.includes(url)));
    const signature = JSON.stringify(observed);
    if (complete && signature === previousSignature) stableChecks += 1;
    else stableChecks = complete ? 1 : 0;
    previousSignature = signature;
    if (stableChecks >= 3) {
      console.log(`[링크] 관련 랜딩페이지 ${expected.length}개 변환 완료와 위치 안정화를 확인했습니다.`);
      return;
    }
    await delay(500);
  }
  throw new Error(`관련 랜딩페이지 링크 변환 검증 실패: ${expectedUrls.join(", ")}`);
}

async function createCleanEditorTailParagraph(page) {
  const paragraphs = page.locator("p.se-text-paragraph:visible");
  const beforeCount = await paragraphs.count();
  await focusEditorParagraph(page);
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await delay(300);
  const afterCount = await paragraphs.count();
  if (afterCount <= beforeCount) throw new Error("영상·Instagram 미리보기용 독립 문단을 만들지 못했습니다.");
  const paragraph = paragraphs.last();
  await paragraph.waitFor({ state: "visible", timeout: 15_000 });
  await paragraph.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press("End");
  return paragraph;
}

async function insertInstagramReelPreview(page, rawPermalink) {
  const permalink = String(rawPermalink || "").trim();
  let url;
  try {
    url = new URL(permalink);
  } catch {
    throw new Error("Instagram 릴스 주소가 올바르지 않습니다.");
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) {
    throw new Error("Instagram 릴스 미리보기에는 instagram.com 주소가 필요합니다.");
  }

  const previews = page.locator([
    "div.se-component.se-oglink",
    "div.se-component[data-a11y-title*='링크']",
    ".se-module-oglink",
    "[data-module='oglink']",
  ].join(", "));
  const beforeCount = await previews.count();

  const activeParagraph = await createCleanEditorTailParagraph(page);
  await page.keyboard.insertText(url.href);

  const typedUrl = await activeParagraph.innerText().catch(() => "");
  if (!typedUrl.includes(url.href)) {
    throw new Error("Instagram 릴스 주소를 SmartEditor에 입력하지 못했습니다.");
  }
  await page.keyboard.press("Enter");

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const afterCount = await previews.count();
    if (afterCount > beforeCount) {
      const preview = previews.nth(afterCount - 1);
      const previewText = await preview.innerText().catch(() => "");
      const previewHtml = await preview.innerHTML().catch(() => "");
      if (/instagram/i.test(`${previewText} ${previewHtml}`)) {
        console.log("[Instagram] 클릭 링크와 미리보기 카드 생성을 확인했습니다.");
        return;
      }
    }
    await delay(500);
  }
  throw new Error("Instagram 릴스 링크의 미리보기 카드가 생성되지 않았습니다. 네이버 또는 Instagram 응답을 확인한 뒤 다시 실행해주세요.");
}

async function selectBoard(page, board) {
  await page.locator('textarea[placeholder="제목을 입력해 주세요."]').waitFor({ state: "visible", timeout: 30_000 });
  if (new URL(page.url()).pathname.includes(`/menus/${board.menuId}/articles/write`)) return;
  const empty = page.getByText("게시판을 선택해 주세요.", { exact: true });
  if (!await empty.isVisible().catch(() => false)) return;

  await empty.click();
  let selected = false;
  const byLabel = page.getByText(board.label, { exact: false });
  for (let index = (await byLabel.count()) - 1; index >= 0; index -= 1) {
    const candidate = byLabel.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      selected = true;
      break;
    }
  }
  if (!selected) {
    const byMenuId = page.locator(`[href*="/menus/${board.menuId}/"], [data-menu-id="${board.menuId}"], [data-menuid="${board.menuId}"]`);
    for (let index = (await byMenuId.count()) - 1; index >= 0; index -= 1) {
      const candidate = byMenuId.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        selected = true;
        break;
      }
    }
  }
  if (!selected) throw new Error(`${board.label} 게시판 선택 항목을 찾지 못했습니다.`);
  await empty.waitFor({ state: "hidden", timeout: 15_000 });
}

async function setImageLink(page, imageIndex, href) {
  const components = page.locator("div.se-component.se-image");
  const component = components.nth(imageIndex);
  await component.locator("img.se-image-resource").click();
  await page.getByRole("button", { name: "링크 입력 열기", exact: true }).click();
  const input = page.locator("input.se-custom-layer-link-input");
  await input.fill(href);
  await page.locator("button.se-custom-layer-link-apply-button").click();

  await component.locator("img.se-image-resource").click();
  await page.getByRole("button", { name: "링크 입력 열기", exact: true }).click();
  const saved = await input.inputValue();
  if (saved !== href) throw new Error(`이미지 링크 저장 검증 실패: ${href}`);
  await page.getByRole("button", { name: "링크 입력 닫기", exact: true }).click();
}

async function submitArticle(page) {
  await prepareEditorForSubmit(page);
  const clicked = await clickRegisterButton(page);
  if (await waitForPublishedArticleView(page, 10_000)) return clicked;
  await clickRegisterButton(page, { preferLast: true, optional: true });
  if (!await waitForPublishedArticleView(page, 60_000)) {
    throw new Error(`카페 등록 후 게시글 화면을 확인하지 못했습니다: ${page.url()}`);
  }
  return clicked;
}

function shouldRequeueSmartEditor(error, submitStarted) {
  if (submitStarted) return false;
  if (isBrowserClosedError(error)) return true;
  return /등록 버튼 클릭 실패|locator\.click: Timeout|게시 요청 전/i.test(String(error?.message || error || ""));
}

async function prepareEditorForSubmit(page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.keyboard.press("Escape").catch(() => {});
    await delay(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await delay(500);
}

async function clickRegisterButton(page, { preferLast = false, optional = false } = {}) {
  const register = page.getByRole("button", { name: "등록", exact: true });
  const attached = await register.first()
    .waitFor({ state: "attached", timeout: optional ? 3_000 : 15_000 })
    .then(() => true)
    .catch((error) => {
      if (optional) return false;
      throw error;
    });
  if (!attached) return false;
  const count = await register.count();
  const indexes = [...Array(count).keys()];
  if (preferLast) indexes.reverse();
  let lastError;

  for (const index of indexes) {
    const candidate = register.nth(index);
    if (!await candidate.isVisible().catch(() => false)) continue;
    if (!await candidate.isEnabled().catch(() => true)) continue;

    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    for (const options of [{ timeout: 5_000 }, { timeout: 5_000, force: true }]) {
      try {
        await candidate.click(options);
        return true;
      } catch (error) {
        lastError = error;
        await page.keyboard.press("Escape").catch(() => {});
        await delay(300);
      }
    }

    const box = await candidate.boundingBox().catch(() => null);
    if (box) {
      try {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return true;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (optional) return false;
  throw new Error(`SmartEditor 등록 버튼 클릭 실패: ${safeErrorMessage(lastError)}`);
}

async function waitForPublishedArticleView(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (articleIdFromNaverUrl(page.url())) return true;
    const edit = page.getByText("수정", { exact: true });
    const remove = page.getByText("삭제", { exact: true });
    if (await edit.isVisible().catch(() => false) && await remove.isVisible().catch(() => false)) return true;
    await delay(500);
  }
  return false;
}

function articleIdFromNaverUrl(rawUrl) {
  let decoded = String(rawUrl || "");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  const match = decoded.match(/\/articles\/(\d+)|[?&]articleid=(\d+)|\/gnlawfintech\/(\d+)(?:[/?#]|$)/i);
  return match?.[1] || match?.[2] || match?.[3] || "";
}

async function canonicalCafeArticleUrl(page, config, fallbackArticleId = "") {
  let articleId = articleIdFromNaverUrl(page.url());
  if (!articleId) {
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => "");
    articleId = articleIdFromNaverUrl(canonical);
  }
  articleId ||= String(fallbackArticleId || "").replace(/\D/g, "");
  if (!articleId) throw new Error(`게시된 카페 글 번호를 확인하지 못했습니다: ${page.url()}`);
  return `${config.cafeUrl}/${articleId}`;
}

async function openPublishedArticleForVerification(page, cafeUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await delay(attempt === 1 ? 1_000 : 2_000);
      await page.goto(cafeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      const found = await waitForSelectorInAnyFrame(page, "div.se-main-container, div.ArticleContentBox, div.se-component", 20_000);
      if (!found) throw new Error("공개 글 본문 DOM을 찾지 못했습니다.");
      console.log(`[게시 검증] 공개 글 화면을 안정적으로 불러왔습니다 (${attempt}/3).`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) console.log(`[게시 검증] 공개 글 이동 중 페이지가 전환되어 다시 확인합니다 (${attempt}/3).`);
    }
  }
  throw new Error(`게시된 공개 글 화면을 불러오지 못했습니다: ${safeErrorMessage(lastError)}`);
}

async function waitForSelectorInAnyFrame(page, selector, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (await frame.locator(selector).count().catch(() => 0)) return true;
    }
    await delay(500);
  }
  return false;
}

async function verifyPublishedImageSequence(page, expectedFiles) {
  const expected = expectedFiles.map((file) => path.basename(file.path).toLowerCase());
  const deadline = Date.now() + 60_000;
  let actual = [];
  let lastError;
  while (Date.now() < deadline) {
    try {
      actual = [];
      for (const frame of page.frames()) {
        actual.push(...await frame.locator("div.se-component.se-image img.se-image-resource").evaluateAll((images) => (
          images.map((image) => {
            try {
              return decodeURIComponent(new URL(image.currentSrc || image.src).pathname.split("/").at(-1) || "").toLowerCase();
            } catch {
              return "";
            }
          }).filter(Boolean)
        )).catch(() => []));
      }
      if (actual.length >= expected.length && expected.every((name, index) => actual[index] === name)) {
        return actual.slice(0, expected.length);
      }
    } catch (error) {
      lastError = error;
      if (!/execution context was destroyed|navigation|target page.*closed/i.test(String(error?.message || error))) throw error;
    }
    await delay(750);
  }
  throw new Error(`공개 글 이미지 순서 검증 실패: 예상 ${expected.join(" → ")} / 실제 ${actual.join(" → ")}${lastError ? ` (${safeErrorMessage(lastError)})` : ""}`);
}

async function verifyPublishedLinks(page, expectedLinks) {
  const deadline = Date.now() + 60_000;
  let links = [];
  let lastError;
  while (Date.now() < deadline) {
    try {
      await page.waitForLoadState("domcontentloaded");
      const raw = [];
      for (const frame of page.frames()) {
        raw.push(...await frame.locator('a.__se_image_link[data-linkdata]').evaluateAll((anchors) => (
          anchors.map((anchor) => anchor.getAttribute("data-linkdata") || "")
        )).catch(() => []));
      }
      links = raw.map(parseLinkedImageData).map((item) => item.link).filter(Boolean);
      if (expectedLinks.every((expected) => links.includes(expected))) return links;
    } catch (error) {
      lastError = error;
      if (!/execution context was destroyed|navigation|target page.*closed/i.test(String(error?.message || error))) throw error;
    }
    await delay(750);
  }
  const missing = expectedLinks.filter((expected) => !links.includes(expected));
  throw new Error(`공개 글에서 이미지 링크를 확인하지 못했습니다: ${missing.join(", ")}${lastError ? ` (${safeErrorMessage(lastError)})` : ""}`);
}

async function verifyPublishedVideo(page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      for (const frame of page.frames()) {
        if (await frame.locator("div.se-component.se-video, div.se-video, .se-module-video, video").count() > 0) return;
      }
    } catch (error) {
      if (!/execution context was destroyed|navigation/i.test(String(error?.message || error))) throw error;
    }
    await delay(750);
  }
  throw new Error("공개 글에서 릴스 영상을 확인하지 못했습니다.");
}

async function verifyPublishedInstagramOrder(page, landingUrls, instagramPermalink) {
  const expectedLanding = landingUrls.map(comparableUrl).filter(Boolean);
  const expectedInstagram = comparableUrl(instagramPermalink);
  const deadline = Date.now() + 60_000;
  let diagnostic = "";
  while (Date.now() < deadline) {
    try {
      for (const frame of page.frames()) {
        const components = await frame.locator("div.se-main-container div.se-component, div.ArticleContentBox div.se-component")
          .evaluateAll((items) => items.map((item) => ({
            text: item.textContent || "",
            links: [...item.querySelectorAll("a[href]")].map((anchor) => anchor.getAttribute("href") || ""),
            html: item.innerHTML || "",
          }))).catch(() => []);
        if (!components.length) continue;
        const values = components.map((component) => comparableUrl([
          component.text,
          ...component.links,
          component.html,
        ].join("\n")));
        const landingIndexes = expectedLanding.map((url) => values.findIndex((value) => value.includes(url)));
        const instagramIndex = values.findIndex((value) => value.includes(expectedInstagram) || /instagram\.com/i.test(value));
        diagnostic = `landing=${landingIndexes.join(",")}, instagram=${instagramIndex}, components=${components.length}`;
        if (landingIndexes.every((index) => index >= 0)
          && instagramIndex > Math.max(...landingIndexes)) {
          console.log("[게시 검증] 관련 랜딩페이지 뒤에 Instagram 링크·미리보기 카드가 독립 배치된 것을 확인했습니다.");
          return;
        }
      }
    } catch (error) {
      if (!/execution context was destroyed|navigation/i.test(String(error?.message || error))) throw error;
    }
    await delay(750);
  }
  throw new Error(`공개 글에서 랜딩페이지와 Instagram 미리보기 순서를 확인하지 못했습니다 (${diagnostic || "본문 구성요소 없음"}).`);
}

async function waitForImageCount(page, expected) {
  const components = page.locator("div.se-component.se-image");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await page.getByText("파일 전송 오류", { exact: true }).isVisible().catch(() => false)) {
      throw new Error("네이버 파일 전송 일시 제한");
    }
    const state = await components.evaluateAll((items) => ({
      count: items.length,
      ready: items.filter((item) => {
        const image = item.querySelector("img.se-image-resource");
        return Boolean(image && image.complete && image.naturalWidth > 0 && image.getAttribute("src"));
      }).length,
    }));
    const uploadBusy = await page.getByText(/전송중|업로드 준비 중|업로드 중/, { exact: false })
      .filter({ visible: true })
      .count()
      .then((count) => count > 0)
      .catch(() => false);
    if (state.count >= expected && state.ready >= expected && !uploadBusy) {
      await delay(300);
      return;
    }
    await delay(500);
  }
  throw new Error(`이미지 업로드 완료 대기 시간 초과 (예상 ${expected}개)`);
}

async function downloadImages(apiContext, images, tempDir) {
  const files = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const response = await apiContext.get(image.url, { timeout: 60_000 });
    if (!response.ok()) throw new Error(`${image.label || image.slot} 이미지 다운로드 실패 (${response.status()})`);
    const type = response.headers()["content-type"] || "image/jpeg";
    const extension = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
    const filePath = path.join(tempDir, `${String(index + 1).padStart(2, "0")}-${safeFileName(image.slot)}${extension}`);
    const bytes = await response.body();
    await writeFile(filePath, bytes);
    const dimensions = pngDimensions(bytes);
    files.push({ ...image, path: filePath, ...dimensions });
  }
  return files;
}

async function downloadVideo(apiContext, videoUrl, tempDir) {
  const response = await apiContext.get(videoUrl, { timeout: 180_000 });
  if (!response.ok()) throw new Error(`릴스 영상 다운로드 실패 (${response.status()})`);

  const type = String(response.headers()["content-type"] || "").toLowerCase();
  const pathname = new URL(videoUrl).pathname.toLowerCase();
  if (type && !type.includes("video/") && !pathname.endsWith(".mp4") && !pathname.endsWith(".mov")) {
    throw new Error(`릴스 영상 응답 형식이 올바르지 않습니다 (${type}).`);
  }

  const extension = type.includes("quicktime") || pathname.endsWith(".mov") ? ".mov" : ".mp4";
  const filePath = path.join(tempDir, `reels-video${extension}`);
  const body = await response.body();
  if (!body.length) throw new Error("릴스 영상 파일이 비어 있습니다.");
  await writeFile(filePath, body);
  return { url: videoUrl, path: filePath, bytes: body.length };
}

async function uploadVideo(page, videoFile, title) {
  const components = page.locator("div.se-component.se-video");
  const beforeCount = await components.count();
  const uploader = page.locator("#video-uploader-wrap");
  const toolbarButton = page.locator('button[data-name="video"]');
  let uploaderOpened = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press("Escape").catch(() => {});
    await createCleanEditorTailParagraph(page);
    await toolbarButton.click();
    uploaderOpened = await uploader.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false);
    if (uploaderOpened) break;
    await delay(1_000);
  }
  if (!uploaderOpened) throw new Error("네이버 동영상 업로더를 열지 못했습니다.");
  await chooseVideoFile(page, uploader, videoFile.path);
  console.log("[영상] 릴스 파일을 네이버 업로더에 전달했습니다.");

  const deadline = Date.now() + 300_000;
  let dialogHandled = false;
  while (Date.now() < deadline) {
    if (await components.count() > beforeCount) {
      console.log("[영상] SmartEditor 영상 컴포넌트가 생성되었습니다.");
      const component = components.nth(beforeCount);
      await waitForVideoProcessing(component, deadline - Date.now());
      console.log("[영상] SmartEditor 영상 처리가 완료되었습니다.");
      return;
    }

    if (!dialogHandled && await uploader.isVisible().catch(() => false)) {
      const titleInput = uploader.locator('input[placeholder*="제목"], textarea[placeholder*="제목"]').first();
      if (await titleInput.isVisible().catch(() => false)) await titleInput.fill(title.slice(0, 100));

      const uploaderText = await uploader.innerText().catch(() => "");
      const uploadReady = /업로드 완료/.test(uploaderText) && !/업로드 진행중|로딩중/.test(uploaderText);
      if (!uploadReady) {
        await delay(750);
        continue;
      }

      const completeLabels = page.getByText("완료", { exact: true });
      for (let index = await completeLabels.count() - 1; index >= 0; index -= 1) {
        const complete = completeLabels.nth(index);
        if (await complete.isVisible().catch(() => false) && await complete.isEnabled().catch(() => true)) {
          await complete.click();
          console.log("[영상] 업로더의 완료 컨트롤을 클릭했습니다.");
          dialogHandled = true;
          break;
        }
      }
      if (!dialogHandled) {
        const apply = uploader.locator("button:visible").filter({
          hasText: /^\s*(등록|첨부|올리기|확인|저장)\s*$/,
        }).last();
        if (await apply.isVisible().catch(() => false) && await apply.isEnabled().catch(() => false)) {
          await apply.click();
          console.log("[영상] 업로더의 적용 컨트롤을 클릭했습니다.");
          dialogHandled = true;
        }
      }
    }
    await delay(750);
  }
  throw new Error("릴스 영상 업로드 시간 초과 (5분)");
}

function pngDimensions(bytes) {
  if (!bytes || bytes.byteLength < 24) return {};
  const buffer = Buffer.from(bytes);
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return {};
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function chooseVideoFile(page, uploader, videoPath) {
  const addButton = uploader.locator("button.nvu_btn_append.nvu_local");
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await addButton.waitFor({ state: "visible", timeout: 10_000 });
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10_000 }),
        addButton.click({ force: attempt > 1 }),
      ]);
      await chooser.setFiles(videoPath);
      if (attempt > 1) console.log(`[영상] PC 파일 선택창 ${attempt}회차 재시도에 성공했습니다.`);
      return;
    } catch (error) {
      lastError = error;
      if (await setFilesOnMatchingInput(page, videoPath, /video|mp4|quicktime/i)) {
        console.log("[영상] 업로더 파일 입력 요소에 릴스 파일을 직접 지정했습니다.");
        return;
      }
      if (attempt < 3) {
        console.log(`[영상] PC 파일 선택창이 열리지 않아 재시도합니다 (${attempt}/3).`);
        await delay(1_000);
      }
    }
  }
  throw new Error(`릴스 영상 파일 선택 실패 (3회 재시도): ${lastError?.message || "파일 선택창이 열리지 않았습니다."}`);
}

async function waitForVideoProcessing(component, remainingMs) {
  const timeout = Math.max(1_000, Math.min(remainingMs, 300_000));
  await component.waitFor({ state: "attached", timeout });
  const deadline = Date.now() + timeout;
  let stableReadyChecks = 0;
  while (Date.now() < deadline) {
    const text = await component.innerText().catch(() => "");
    if (/업로드 실패|처리 실패|변환 실패|지원하지 않는/.test(text)) {
      throw new Error(`릴스 영상 처리 실패: ${text.trim().slice(0, 200)}`);
    }

    const busy = component.locator([
      '[class*="uploading"]',
      '[class*="progress"]',
      '[class*="loading"]',
      '[aria-busy="true"]',
    ].join(", "));
    const visibleBusy = await busy.evaluateAll((elements) => elements.some((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
    })).catch(() => false);
    const readyMedia = await component.locator([
      "video",
      "iframe",
      ".se-module-video",
      '[class*="thumbnail"]',
      '[class*="preview"]',
    ].join(", ")).count();

    if (!visibleBusy && readyMedia > 0) stableReadyChecks += 1;
    else stableReadyChecks = 0;
    if (stableReadyChecks >= 3) return;
    await delay(1_000);
  }
  throw new Error("릴스 영상 변환이 제한 시간 안에 끝나지 않았습니다.");
}

async function loadQueue(context, config) {
  const data = await apiJson(context, "GET", `${config.siteOrigin}/api/cafe-reels-workflow`);
  return data.jobs || [];
}

async function waitForRunnerTurn(context, config, options) {
  for (;;) {
    const state = await heartbeatRunner(context, config, "starting");
    if (state.canRun) {
      console.log(`[실행기] 이 PC가 SmartEditor 대기열 처리를 시작합니다: ${config.runnerName}`);
      if (state.shouldStopAfterCurrent) options.stopAfterCurrent = true;
      return state;
    }
    const active = state.activeRunner || {};
    console.log(`[실행기] ${active.runnerName || "다른 PC"}에서 자동화가 실행 중입니다. 현재 글 완료 후 인계되도록 요청했고, 종료/만료를 기다립니다.`);
    await delay(Math.max(config.pollSeconds, 10) * 1000);
  }
}

function startRunnerHeartbeat(context, config, options) {
  let stopped = false;
  let inFlight = false;
  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const state = await heartbeatRunner(context, config, "working");
      if (state.shouldStopAfterCurrent) options.stopAfterCurrent = true;
    } catch (error) {
      console.error(`[실행기] 실행 상태 갱신 실패: ${safeErrorMessage(error)}`);
    } finally {
      inFlight = false;
    }
  };
  const timer = setInterval(tick, 20_000);
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function heartbeatRunner(context, config, phase = "working") {
  return apiJson(context, "POST", `${config.siteOrigin}/api/cafe-reels-workflow`, {
    data: {
      action: "smarteditor-runner-heartbeat",
      runnerId: config.runnerId,
      runnerName: config.runnerName,
      phase,
    },
  });
}

async function releaseRunner(context, config) {
  return apiJson(context, "POST", `${config.siteOrigin}/api/cafe-reels-workflow`, {
    data: {
      action: "smarteditor-runner-release",
      runnerId: config.runnerId,
      runnerName: config.runnerName,
    },
  });
}

async function loadJob(context, config, jobId) {
  const data = await apiJson(context, "GET", `${config.siteOrigin}/api/cafe-reels-workflow?jobId=${encodeURIComponent(jobId)}`);
  return data.job;
}

async function reportStatus(context, config, jobId, status, extra = {}) {
  return apiJson(context, "POST", `${config.siteOrigin}/api/cafe-reels-workflow`, {
    data: { action: "report-smarteditor", jobId, status, ...extra },
  });
}

async function queueSmartEditor(context, config, jobId) {
  return apiJson(context, "POST", `${config.siteOrigin}/api/cafe-reels-workflow`, {
    data: { action: "queue-smarteditor", jobId },
  });
}

async function apiJson(context, method, url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = method === "POST"
        ? await context.post(url, options)
        : await context.get(url, options);
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`관리자 로그인이 필요하거나 API 응답이 잘못되었습니다 (HTTP ${response.status()}).`); }
      if (!response.ok() || !data.ok) throw new Error(data.message || `API 요청 실패 (HTTP ${response.status()})`);
      return data;
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt >= 3) throw error;
      console.error(`[네트워크] API 연결이 끊겨 재시도합니다 (${attempt}/3): ${safeErrorMessage(error)}`);
      await delay(attempt * 1_000);
    }
  }
  throw lastError;
}

async function assertNaverLogin(page) {
  if (/nid\.naver\.com\/nidlogin/i.test(page.url())) {
    throw new Error("네이버 로그인이 필요합니다. 프로그램에서 '최초 로그인'을 먼저 실행하세요.");
  }
  const loginLink = page.getByText("로그인", { exact: true });
  if (await loginLink.isVisible().catch(() => false)) {
    throw new Error("네이버 로그인이 필요합니다. 프로그램에서 '최초 로그인'을 먼저 실행하세요.");
  }
}

async function resolveChromePath(explicitPath) {
  const candidates = [
    explicitPath,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error("Chrome/Edge 실행 파일을 찾지 못했습니다. --chrome-path를 지정하세요.");
}

function validateJob(job) {
  if (!job?.id) throw new Error("작업 ID가 없습니다.");
  if (!job?.draft?.title || !job?.draft?.body) throw new Error("생성된 제목과 본문이 필요합니다.");
  if (!Array.isArray(job.images) || !job.images.length) throw new Error("업로드할 이미지가 없습니다.");
}

function requiredOption(options, key) {
  if (!options[key]) throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}가 필요합니다.`);
  return options[key];
}

function cleanOrigin(value) {
  return String(value || "").replace(/\/+$/, "");
}

function safeFileName(value) {
  return String(value || "file").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "file";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prompt(message) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return await terminal.question(message); }
  finally { terminal.close(); }
}

function printHelp() {
  console.log(`
네이버 카페 SmartEditor PC 업로드 러너
버전: ${APP_VERSION}

  Windows 프로그램: 최초 로그인 → 자동화 시작
  CLI 로그인: node cli.mjs login
  CLI 전체 자동화: node cli.mjs watch --publish --yes
  기본 동작: 다른 PC가 시작하면 현재 글 완료 후 종료, 대기열이 비어도 계속 감시

주요 옵션
  --yes                 최종 게시 확인 문구 생략
  --once                대기열을 한 번만 확인
  --skip-video          작업에 저장된 릴스 영상을 첨부하지 않음
  --edit-article-id <N> 기존 카페 글 번호를 중복 없이 수정
  --phone-link <URL>    전화 이미지 링크
  --kakao-link <URL>    카카오 이미지 링크
  --chrome-path <PATH>  Chrome/Edge 실행 파일
  --profile-dir <PATH>  로그인 전용 Chrome 프로필
`);
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(`\n실패: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
