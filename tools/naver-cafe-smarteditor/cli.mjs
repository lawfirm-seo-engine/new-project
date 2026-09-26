import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

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
  const contacts = images.filter((image) => image.slot === "phone" || image.slot === "kakao");
  const regular = images.filter((image) => image.slot !== "phone" && image.slot !== "kakao");
  return [...regular, ...contacts];
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

export function hasNaverSessionCookies(cookies = []) {
  const names = new Set((Array.isArray(cookies) ? cookies : []).map((cookie) => String(cookie?.name || "")));
  return names.has("NID_SES") || names.has("NID_AUT");
}

export function hasUnfinishedBatchJobs(jobs = [], queuedJob = {}) {
  const batchId = String(queuedJob?.batchId || "");
  if (!batchId) return false;
  const readyStatuses = new Set(["smarteditor-queued", "smarteditor-preparing", "smarteditor-posted"]);
  return (Array.isArray(jobs) ? jobs : []).some((job) => (
    job?.id !== queuedJob.id
    && String(job?.batchId || "") === batchId
    && !readyStatuses.has(String(job?.cafeStatus || ""))
  ));
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "help" || options.help) return printHelp();

  const config = runnerConfig(options);
  await mkdir(config.profileDir, { recursive: true });
  await mkdir(config.artifactDir, { recursive: true });
  const chromePath = await resolveChromePath(config.chromePath);
  const context = await chromium.launchPersistentContext(config.profileDir, {
    executablePath: chromePath,
    headless: false,
    viewport: null,
    acceptDownloads: true,
    chromiumSandbox: true,
    args: ["--start-maximized"],
  });

  try {
    await restoreSessionState(context, config);
    if (command === "login") return await login(context, config);
    if (command === "watch") {
      return await watchQueue(context, config, {
        publish: Boolean(options.publish),
        yes: Boolean(options.yes),
        once: Boolean(options.once),
        includeVideo: !Boolean(options.skipVideo),
      });
    }
    if (command === "prepare" || command === "publish") {
      const job = options.jobFile
        ? JSON.parse(await readFile(path.resolve(options.jobFile), "utf8"))
        : await loadJob(context, config, requiredOption(options, "jobId"));
      return await processJob(context, config, job, {
        publish: command === "publish" || Boolean(options.publish),
        yes: Boolean(options.yes),
        includeVideo: !Boolean(options.skipVideo),
      });
    }
    throw new Error(`알 수 없는 명령: ${command}`);
  } finally {
    await context.close();
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
  await loadQueue(context, config);
  await saveSessionState(context, config);
  console.log("로그인 상태를 확인하고 다음 실행용 세션을 저장했습니다.");
}

async function watchQueue(context, config, options) {
  const monitorPage = context.pages()[0] || await context.newPage();
  await verifyLoginSessions(context, monitorPage, config);
  console.log(`랜딩·릴스·SmartEditor 전체 대기열 감시 시작 (${config.siteOrigin}, ${config.pollSeconds}초 간격)`);
  for (;;) {
    const jobs = await loadQueue(context, config);
    const byReservedNumber = (a, b) => Number(a.reservedNaverArticleId || Number.MAX_SAFE_INTEGER) - Number(b.reservedNaverArticleId || Number.MAX_SAFE_INTEGER);
    const cafeQueued = jobs
      .filter((job) => job.cafeStatus === "smarteditor-queued")
      .sort(byReservedNumber)
      .find((job) => !hasUnfinishedBatchJobs(jobs, job));
    if (cafeQueued) {
      const job = await loadJob(context, config, cafeQueued.id);
      const result = await processJob(context, config, job, options, monitorPage);
      if (!result?.posted && !options.yes) return;
    } else if (options.once) {
      console.log("대기 중인 SmartEditor 작업이 없습니다.");
      return;
    }
    if (options.once) return;
    await delay(config.pollSeconds * 1000);
  }
}

async function verifyLoginSessions(context, page, config) {
  console.log("[사전 확인] gnlaw-criminal 관리자 로그인 확인 중...");
  await page.goto(`${config.siteOrigin}/admin/cafe-reels`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  if (/\/admin\/login/i.test(page.url())) {
    throw new Error("gnlaw-criminal 관리자 로그인이 필요합니다. 프로그램에서 '최초 로그인'을 실행하세요.");
  }
  await loadQueue(context, config);
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
  await loadQueue(context, config);
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

async function processJob(context, config, job, options, existingPage = null) {
  validateJob(job);
  const board = boardForJob(job);
  const images = orderedJobImages(job, config.siteOrigin);
  const phoneIndex = images.findIndex((image) => image.slot === "phone");
  const kakaoIndex = images.findIndex((image) => image.slot === "kakao");
  const videoUrl = options.includeVideo === false ? "" : jobVideoUrl(job, config.siteOrigin);
  if (phoneIndex < 0 || kakaoIndex < 0) throw new Error("전화·카카오 이미지가 모두 필요합니다.");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gnlaw-smarteditor-"));
  const page = existingPage || await context.newPage();
  const ownsPage = !existingPage;
  try {
    if (options.publish) await reportStatus(context, config, job.id, "preparing");
    const files = await downloadImages(context, images, tempDir);
    const videoFile = videoUrl ? await downloadVideo(context, videoUrl, tempDir) : null;
    const writeUrl = `https://cafe.naver.com/ca-fe/cafes/${encodeURIComponent(config.clubId)}/menus/${board.menuId}/articles/write`;
    await page.goto(writeUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await assertNaverLogin(page);
    await selectBoard(page, board);

    const articleTitle = String(job.draft.title || job.title || "");
    await page.locator("p.se-text-paragraph").first().waitFor({ state: "visible", timeout: 30_000 });
    await fillArticleTitle(page, articleTitle);
    await insertArticleBody(page, String(job.draft.body || ""));

    const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
    await page.getByRole("button", { name: "사진 추가", exact: true }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(files.map((file) => file.path));
    await chooseIndividualPhotoMode(page);
    await waitForImageCount(page, images.length);

    if (videoFile) {
      await uploadVideo(page, videoFile, String(job.caseName || job.draft.title || "릴스 영상"));
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

    await submitArticle(page);
    const cafeUrl = page.url();
    const publishedLinks = await verifyPublishedLinks(page, [config.phoneLink, config.kakaoLink]);
    if (videoFile) await verifyPublishedVideo(page);
    await reportStatus(context, config, job.id, "posted", { cafeUrl });
    console.log(`게시 완료: ${cafeUrl}`);
    console.log(`공개 글 링크 검증: ${publishedLinks.join(", ")}`);
    return { posted: true, cafeUrl, screenshotPath, videoUploaded: Boolean(videoFile) };
  } catch (error) {
    const failureScreenshotPath = path.join(config.artifactDir, `${safeFileName(job.id)}-${Date.now()}-failed.png`);
    if (await page.screenshot({ path: failureScreenshotPath, fullPage: false }).then(() => true).catch(() => false)) {
      console.error(`SmartEditor 실패 화면: ${failureScreenshotPath}`);
    }
    if (options.publish) {
      await reportStatus(context, config, job.id, "failed", { message: error?.message || String(error) }).catch(() => {});
    }
    throw error;
  } finally {
    if (ownsPage) await page.close().catch(() => {});
    else await page.goto(`${config.siteOrigin}/admin/cafe-reels`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fillArticleTitle(page, title) {
  const input = page.locator('textarea[placeholder="제목을 입력해 주세요."]');
  await input.fill(title);
  if (await input.inputValue() !== title) throw new Error("카페 원고 제목 입력 검증 실패");
}

async function chooseIndividualPhotoMode(page) {
  const heading = page.getByText("사진 첨부 방식", { exact: true }).last();
  const appeared = await heading.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
  if (!appeared) return;
  await page.getByText("개별사진", { exact: true }).last().click();
  await heading.waitFor({ state: "hidden", timeout: 30_000 });
}

async function insertArticleBody(page, body) {
  const content = String(body || "");
  const paragraph = page.locator("p.se-text-paragraph").first();
  await paragraph.waitFor({ state: "visible", timeout: 30_000 });
  await paragraph.click();

  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]) await page.keyboard.insertText(lines[index]);
    if (index < lines.length - 1) await page.keyboard.press("Enter");
  }

  const editorText = (await page.locator(".se-component-content").allInnerTexts()).join("\n");
  const compactText = (value) => String(value || "").normalize("NFKC").replace(/[^0-9A-Za-z가-힣]/g, "");
  const normalizedEditorText = compactText(editorText);
  const verifiableLines = lines
    .map((line) => line.trim())
    .filter((line) => line && !/https?:\/\//i.test(line))
    .map((line) => compactText(line.replace(/^(?:[-*•·]+|\d+[.)])\s*/, "")))
    .filter(Boolean);
  const expectedLength = verifiableLines.join("").length;
  if (normalizedEditorText.length < Math.max(80, expectedLength * 0.45)) {
    throw new Error(`카페 원고 본문 입력 분량 검증 실패: 예상 ${expectedLength}자 / 확인 ${normalizedEditorText.length}자`);
  }
  const firstLine = verifiableLines[0] || "";
  if (firstLine && !normalizedEditorText.includes(firstLine.slice(0, Math.min(12, firstLine.length)))) {
    throw new Error(`카페 원고 본문 입력 검증 실패: ${firstLine.slice(0, 80)}`);
  }

  await page.locator("p.se-text-paragraph").first().click();
  await page.keyboard.press("Control+Home");
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
  const register = page.getByRole("button", { name: "등록", exact: true });
  await register.first().click();
  try {
    await page.waitForURL(/\/articles\/\d+/, { timeout: 10_000, waitUntil: "domcontentloaded" });
    return;
  } catch {
    const count = await register.count();
    if (count > 1 && await register.last().isVisible()) await register.last().click();
  }
  await page.waitForURL(/\/articles\/\d+/, { timeout: 60_000, waitUntil: "domcontentloaded" });
}

async function verifyPublishedLinks(page, expectedLinks) {
  await page.waitForLoadState("domcontentloaded");
  const raw = await page.locator('a.__se_image_link[data-linkdata]').evaluateAll((anchors) => (
    anchors.map((anchor) => anchor.getAttribute("data-linkdata") || "")
  ));
  const links = raw.map(parseLinkedImageData).map((item) => item.link).filter(Boolean);
  for (const expected of expectedLinks) {
    if (!links.includes(expected)) throw new Error(`공개 글에서 이미지 링크를 확인하지 못했습니다: ${expected}`);
  }
  return links;
}

async function verifyPublishedVideo(page) {
  const video = page.locator("div.se-component.se-video, div.se-video, .se-module-video, video");
  await video.first().waitFor({ state: "attached", timeout: 30_000 }).catch(() => {});
  if (await video.count() < 1) throw new Error("공개 글에서 릴스 영상을 확인하지 못했습니다.");
}

async function waitForImageCount(page, expected) {
  const components = page.locator("div.se-component.se-image");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const count = await components.count();
    if (count >= expected) return;
    await delay(500);
  }
  throw new Error(`이미지 업로드 시간 초과 (예상 ${expected}개)`);
}

async function downloadImages(context, images, tempDir) {
  const files = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const response = await context.request.get(image.url, { timeout: 60_000 });
    if (!response.ok()) throw new Error(`${image.label || image.slot} 이미지 다운로드 실패 (${response.status()})`);
    const type = response.headers()["content-type"] || "image/jpeg";
    const extension = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
    const filePath = path.join(tempDir, `${String(index + 1).padStart(2, "0")}-${safeFileName(image.slot)}${extension}`);
    await writeFile(filePath, await response.body());
    files.push({ ...image, path: filePath });
  }
  return files;
}

async function downloadVideo(context, videoUrl, tempDir) {
  const response = await context.request.get(videoUrl, { timeout: 180_000 });
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
    await page.locator("p.se-text-paragraph").first().click();
    await page.keyboard.press("Control+Home");
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

async function chooseVideoFile(page, uploader, videoPath) {
  const addButton = uploader.locator("button.nvu_btn_append.nvu_local");
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await addButton.waitFor({ state: "visible", timeout: 10_000 });
      const chooserPromise = page.waitForEvent("filechooser", { timeout: 10_000 });
      await addButton.click();
      const chooser = await chooserPromise;
      await chooser.setFiles(videoPath);
      if (attempt > 1) console.log(`[영상] PC 파일 선택창 ${attempt}회차 재시도에 성공했습니다.`);
      return;
    } catch (error) {
      lastError = error;
      const fileInputs = uploader.locator('input[type="file"]');
      for (let index = await fileInputs.count() - 1; index >= 0; index -= 1) {
        const input = fileInputs.nth(index);
        const accept = await input.getAttribute("accept").catch(() => "");
        if (accept && !/video|mp4|quicktime/i.test(accept)) continue;
        if (await input.isEnabled().catch(() => true)) {
          await input.setInputFiles(videoPath);
          console.log("[영상] 업로더 파일 입력 요소에 릴스 파일을 직접 지정했습니다.");
          return;
        }
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

async function loadJob(context, config, jobId) {
  const data = await apiJson(context, "GET", `${config.siteOrigin}/api/cafe-reels-workflow?jobId=${encodeURIComponent(jobId)}`);
  return data.job;
}

async function reportStatus(context, config, jobId, status, extra = {}) {
  return apiJson(context, "POST", `${config.siteOrigin}/api/cafe-reels-workflow`, {
    data: { action: "report-smarteditor", jobId, status, ...extra },
  });
}

async function apiJson(context, method, url, options = {}) {
  const response = method === "POST"
    ? await context.request.post(url, options)
    : await context.request.get(url, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`관리자 로그인이 필요하거나 API 응답이 잘못되었습니다 (HTTP ${response.status()}).`); }
  if (!response.ok() || !data.ok) throw new Error(data.message || `API 요청 실패 (HTTP ${response.status()})`);
  return data;
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

  Windows 프로그램: 최초 로그인 → 자동화 시작
  CLI 로그인: node cli.mjs login
  CLI 전체 자동화: node cli.mjs watch --publish --yes

주요 옵션
  --yes                 최종 게시 확인 문구 생략
  --once                대기열을 한 번만 확인
  --skip-video          작업에 저장된 릴스 영상을 첨부하지 않음
  --phone-link <URL>    전화 이미지 링크
  --kakao-link <URL>    카카오 이미지 링크
  --chrome-path <PATH>  Chrome/Edge 실행 파일
  --profile-dir <PATH>  로그인 전용 Chrome 프로필
`);
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(`\n실패: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
