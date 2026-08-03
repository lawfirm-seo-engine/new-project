const API_BASE = "https://api.cloudflare.com/client/v4";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = "new-project";
const SOURCE_HOST = "www.gnlaw-criminal.co.kr";

const token = process.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  throw new Error("CLOUDFLARE_API_TOKEN is required.");
}

if (!ACCOUNT_ID) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
}

async function cf(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const message = (data.errors || [])
      .map((error) => `${error.code || "error"} ${error.message || ""}`.trim())
      .join("; ");
    const err = new Error(message || `Cloudflare API failed: ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data.result;
}

async function main() {
  const encodedProject = encodeURIComponent(PROJECT_NAME);
  const domains = await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${encodedProject}/domains`);
  const existing = Array.isArray(domains)
    ? domains.find((domain) => domain.name === SOURCE_HOST)
    : null;

  if (existing) {
    console.log(`${SOURCE_HOST} is already attached to Cloudflare Pages project ${PROJECT_NAME}.`);
    return;
  }

  const created = await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${encodedProject}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: SOURCE_HOST }),
  });

  console.log(`Attached ${created.name || SOURCE_HOST} to Cloudflare Pages project ${PROJECT_NAME}.`);
}

await main();
