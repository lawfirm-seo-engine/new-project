const API_BASE = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "gnlaw-criminal.co.kr";
const SOURCE_HOST = "www.gnlaw-criminal.co.kr";
const TARGET_ORIGIN = "https://gnlaw-criminal.co.kr";
const RULE_REF = "redirect_www_gnlaw_criminal_to_apex";
const PHASE = "http_request_dynamic_redirect";

const token = process.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  throw new Error("CLOUDFLARE_API_TOKEN is required.");
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

function sanitizeRule(rule) {
  const allowed = {
    action: rule.action,
    action_parameters: rule.action_parameters,
    description: rule.description,
    enabled: rule.enabled !== false,
    expression: rule.expression,
  };
  if (rule.id) allowed.id = rule.id;
  if (rule.ref) allowed.ref = rule.ref;
  return allowed;
}

function redirectRule(existingRule) {
  return {
    ...(existingRule?.id ? { id: existingRule.id } : {}),
    ref: RULE_REF,
    description: "Redirect www.gnlaw-criminal.co.kr to apex",
    enabled: true,
    expression: `http.host eq "${SOURCE_HOST}"`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: {
          expression: `concat("${TARGET_ORIGIN}", http.request.uri.path)`,
        },
        preserve_query_string: true,
      },
    },
  };
}

async function main() {
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  const zone = Array.isArray(zones) ? zones.find((item) => item.name === ZONE_NAME) : null;
  if (!zone?.id) throw new Error(`Cloudflare zone not found: ${ZONE_NAME}`);

  let ruleset = null;
  try {
    ruleset = await cf(`/zones/${zone.id}/rulesets/phases/${PHASE}/entrypoint`);
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  if (!ruleset?.id) {
    const created = await cf(`/zones/${zone.id}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "default",
        description: "Zone redirect rules",
        kind: "zone",
        phase: PHASE,
        rules: [redirectRule()],
      }),
    });
    console.log(`Created redirect ruleset ${created.id} for ${SOURCE_HOST}.`);
    return;
  }

  const rules = Array.isArray(ruleset.rules) ? ruleset.rules.map(sanitizeRule) : [];
  const existingIndex = rules.findIndex((rule) =>
    rule.ref === RULE_REF || rule.expression === `http.host eq "${SOURCE_HOST}"`
  );
  const existingRule = existingIndex >= 0 ? rules[existingIndex] : null;
  const nextRule = redirectRule(existingRule);

  if (existingIndex >= 0) {
    rules[existingIndex] = nextRule;
  } else {
    rules.push(nextRule);
  }

  const updated = await cf(`/zones/${zone.id}/rulesets/${ruleset.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: ruleset.name || "default",
      description: ruleset.description || "Zone redirect rules",
      kind: "zone",
      phase: PHASE,
      rules,
    }),
  });

  console.log(`Configured ${SOURCE_HOST} -> ${TARGET_ORIGIN}/ as 301 redirect in ruleset ${updated.id}.`);
}

await main();
