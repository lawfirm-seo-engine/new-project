#!/usr/bin/env node
/**
 * Cloudflare Pages 신규 도메인 자동 생성 스크립트
 * law-a ~ law-e Pages 프로젝트를 생성하고, 기존 프로젝트의
 *   - GitHub 레포 연결 (source 블록 전체 복사 — installation_id 포함)
 *   - env vars / KV / R2 / D1 바인딩
 * 을 그대로 복사합니다.
 *
 * 실행 방법 (PowerShell):
 *   $env:CF_ACCOUNT_ID="계정ID"
 *   $env:CF_API_TOKEN="API토큰"
 *   node scripts/setup-cloudflare-pages.js
 *
 * API Token 권한: Account > Cloudflare Pages > Edit
 */

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN  = process.env.CF_API_TOKEN;

if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error("[ERROR] CF_ACCOUNT_ID, CF_API_TOKEN 환경변수를 설정하세요.");
  console.error("");
  console.error("  PowerShell:");
  console.error('    $env:CF_ACCOUNT_ID="계정ID"');
  console.error('    $env:CF_API_TOKEN="API토큰"');
  console.error("    node scripts/setup-cloudflare-pages.js");
  process.exit(1);
}

// 설정 복사 원본 프로젝트 (기존 5개 중 하나)
const SOURCE_PROJECT = "new-project-9o2";

const NEW_PROJECTS = [
  { name: "law-a", destDir: "dist-law-a" },
  { name: "law-b", destDir: "dist-law-b" },
  { name: "law-c", destDir: "dist-law-c" },
  { name: "law-d", destDir: "dist-law-d" },
  { name: "law-e", destDir: "dist-law-e" },
];

// ─── Cloudflare API 헬퍼 ──────────────────────────────────────────────────────

async function cfApi(method, path, body = null) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!data.success) {
    const msgs = (data.errors || []).map((e) => `[${e.code}] ${e.message}`).join(" | ");
    throw new Error(msgs || `HTTP ${res.status}`);
  }

  return data.result;
}

// ─── 기존 프로젝트 전체 설정 조회 ─────────────────────────────────────────────

async function fetchSourceProject() {
  const project = await cfApi("GET", `/accounts/${CF_ACCOUNT_ID}/pages/projects/${SOURCE_PROJECT}`);

  // GitHub source 블록 전체 (installation_id 등 내부 필드 포함)
  const source = project.source ?? null;

  // 빌드 설정 (build_command 등 복사, destination_dir 는 프로젝트마다 덮어씀)
  const buildConfig = project.build_config ?? {};

  // 배포 환경 설정
  const prod = project.deployment_configs?.production ?? {};

  return {
    source,
    buildConfig,
    envVars:      prod.env_vars       ?? {},
    kvNamespaces: prod.kv_namespaces  ?? {},
    r2Buckets:    prod.r2_buckets     ?? {},
    d1Databases:  prod.d1_databases   ?? {},
  };
}

// ─── 프로젝트 생성 ─────────────────────────────────────────────────────────────

async function createProject({ name, destDir }, source, buildConfig) {
  try {
    await cfApi("POST", `/accounts/${CF_ACCOUNT_ID}/pages/projects`, {
      name,
      production_branch: source?.config?.production_branch ?? "main",
      // GitHub source 블록 그대로 사용 (installation_id 보존)
      source,
      build_config: {
        ...buildConfig,
        destination_dir: destDir, // 프로젝트별로 다른 출력 디렉터리
        build_caching: true,
      },
    });

    console.log(`  ✓ 생성 완료 → https://${name}.pages.dev`);
    return true;
  } catch (e) {
    if (/already exist/i.test(e.message)) {
      console.log(`  ○ 이미 존재함 — 설정만 업데이트합니다.`);
      return false; // created=false, 계속 진행
    }
    throw e;
  }
}

// ─── 빌드 설정 업데이트 (이미 존재하는 프로젝트에 destination_dir 적용) ──────────

async function updateBuildConfig({ name, destDir }, buildConfig) {
  await cfApi("PATCH", `/accounts/${CF_ACCOUNT_ID}/pages/projects/${name}`, {
    build_config: {
      ...buildConfig,
      destination_dir: destDir,
      build_caching: true,
    },
  });
  console.log(`  ✓ build_config 업데이트 (destination_dir: ${destDir})`);
}

// ─── env vars / 바인딩 적용 ────────────────────────────────────────────────────

async function applyBindings(name, { envVars, kvNamespaces, r2Buckets, d1Databases }) {
  const prod = {};
  if (Object.keys(envVars).length)      prod.env_vars      = envVars;
  if (Object.keys(kvNamespaces).length) prod.kv_namespaces = kvNamespaces;
  if (Object.keys(r2Buckets).length)    prod.r2_buckets    = r2Buckets;
  if (Object.keys(d1Databases).length)  prod.d1_databases  = d1Databases;

  if (Object.keys(prod).length === 0) {
    console.log(`  ○ 복사할 바인딩/env 없음`);
    return;
  }

  await cfApi("PATCH", `/accounts/${CF_ACCOUNT_ID}/pages/projects/${name}`, {
    deployment_configs: {
      production: prod,
      preview:    prod,
    },
  });

  const summary = [
    Object.keys(envVars).length      ? `env(${Object.keys(envVars).length})` : null,
    Object.keys(kvNamespaces).length ? `KV(${Object.keys(kvNamespaces).join(", ")})` : null,
    Object.keys(r2Buckets).length    ? `R2(${Object.keys(r2Buckets).length})` : null,
    Object.keys(d1Databases).length  ? `D1(${Object.keys(d1Databases).length})` : null,
  ].filter(Boolean).join(", ");

  console.log(`  ✓ 바인딩 적용: ${summary}`);
}

// ─── 최초 배포 트리거 ──────────────────────────────────────────────────────────

async function triggerDeployment(name, branch = "main") {
  try {
    await cfApi("POST", `/accounts/${CF_ACCOUNT_ID}/pages/projects/${name}/deployments`, {
      branch,
    });
    console.log(`  ✓ 배포 트리거 완료`);
  } catch (e) {
    // GitHub 연동 완료 즉시 Cloudflare가 자동으로 배포를 시작하는 경우 트리거 불필요
    console.log(`  ○ 배포 트리거 건너뜀 (${e.message})`);
  }
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━ Cloudflare Pages 신규 도메인 자동 생성 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Account ID : ${CF_ACCOUNT_ID}`);
  console.log(`복사 원본  : ${SOURCE_PROJECT}`);

  // 1. 기존 프로젝트 설정 전체 조회
  console.log(`\n[1/3] ${SOURCE_PROJECT} 설정 조회 중...`);
  let sourceConfig;
  try {
    sourceConfig = await fetchSourceProject();
  } catch (e) {
    console.error(`[ERROR] 원본 프로젝트 조회 실패: ${e.message}`);
    process.exit(1);
  }

  const { source, buildConfig, envVars, kvNamespaces } = sourceConfig;

  // GitHub source 요약 출력
  if (source?.config) {
    const cfg = source.config;
    console.log(`  GitHub     : ${cfg.owner}/${cfg.repo_name} (${cfg.production_branch})`);
    if (cfg.github_installation_id ?? cfg.installation_id) {
      console.log(`  Install ID : ${cfg.github_installation_id ?? cfg.installation_id}`);
    }
  } else {
    console.warn("  ⚠ GitHub source 정보 없음 — 생성 후 대시보드에서 수동 연결 필요");
  }
  console.log(`  env vars   : ${Object.keys(envVars).length}개`);
  console.log(`  KV 바인딩  : ${Object.keys(kvNamespaces).length}개`);
  console.log(`  build cmd  : ${buildConfig.build_command ?? "(없음)"}`);

  // 2. 프로젝트 생성 + 설정 적용
  console.log("\n[2/3] 프로젝트 생성 및 설정 적용...");
  const results = [];

  for (const project of NEW_PROJECTS) {
    console.log(`\n  ▸ ${project.name}  (→ ${project.destDir})`);
    try {
      const created = await createProject(project, source, buildConfig);

      // 이미 존재하던 프로젝트는 build_config 만 업데이트
      if (!created) {
        await updateBuildConfig(project, buildConfig);
      }

      await applyBindings(project.name, sourceConfig);
      await triggerDeployment(project.name, source?.config?.production_branch ?? "main");

      results.push({ name: project.name, ok: true });
    } catch (e) {
      console.error(`  ✗ 실패: ${e.message}`);
      results.push({ name: project.name, ok: false, error: e.message });
    }
  }

  // 3. 결과 요약
  console.log("\n[3/3] 결과 요약");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const detail = r.ok ? ` → https://${r.name}.pages.dev` : ` (${r.error})`;
    console.log(`  ${icon} ${r.name}${detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log("\n✓ 완료! 배포 상황은 아래에서 확인하세요.");
    console.log("  https://dash.cloudflare.com/pages");
  } else {
    console.log(`\n⚠ ${failed.length}개 실패. 위 오류 메시지를 확인하세요.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n[FATAL]", e.message);
  process.exit(1);
});
