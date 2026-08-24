const HISTORY_URL = "https://raw.githubusercontent.com/fhvsvzpmkw-design/-betting-edge-terminal/main/run-history.json";
const GITHUB_PAGES_ORIGIN = "https://fhvsvzpmkw-design.github.io/-betting-edge-terminal";
const CANONICAL_HOST = "vigwirelabs.com";
const PRIVATE_LEDGER_API = "https://api.github.com/repos/fhvsvzpmkw-design/betting-edge-private/contents/data/betting-ledger.json?ref=main";
const SCHEDULE_CONFIG_URL = `${GITHUB_PAGES_ORIGIN}/data/schedule-profiles.json`;
const SCHEDULE_STATE_URL = `${GITHUB_PAGES_ORIGIN}/data/schedule-state.json`;
const ODDS_WORKFLOW_DISPATCH_URL = "https://api.github.com/repos/fhvsvzpmkw-design/-betting-edge-terminal/actions/workflows/odds-refresh.yml/dispatches";
const SCHEDULER_CRON = "* * * * *";

const SLOT_CODES = {
  open: "o",
  main: "m",
  final_morning: "f",
  evening: "e",
  late: "l",
};

const SHORT_ID_RE = /^[0-9]{6}[omfel][0-9]{6}$/;

function shortId(entry) {
  const ts = String(entry?.ts || "");
  const slot = String(entry?.slot || "");
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  const code = SLOT_CODES[slot];

  if (!match || !code) return "";
  return `${match[1].slice(2)}${match[2]}${match[3]}${code}${match[4]}${match[5]}${match[6]}`;
}

function newestValidRun(runs) {
  return [...(Array.isArray(runs) ? runs : [])]
    .filter((run) => shortId(run) && run?.path)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .at(-1);
}

async function loadLatestRun() {
  const response = await fetch(HISTORY_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "VigWire-Labs-Worker",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`run-history fetch failed: ${response.status}`);
  }

  const history = await response.json();
  const latest = newestValidRun(history?.runs);
  const id = shortId(latest);

  if (!latest || !id) {
    throw new Error("no valid issued report found");
  }

  return { latest, id, updatedAt: history?.updated_at || null };
}

function schedulerToken(env) {
  return String(env?.GITHUB_ACTIONS_TOKEN || env?.GITHUB_PRIVATE_TOKEN || "").trim();
}

function vancouverClock(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = values.hour === "24" ? "00" : values.hour;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${hour}:${values.minute}`,
  };
}

async function loadSchedulerDocuments(scheduledTime) {
  const query = `scheduler=${encodeURIComponent(String(scheduledTime))}`;
  const headers = {
    Accept: "application/json",
    "User-Agent": "VigWire-Labs-Scheduler",
  };
  const [configResponse, stateResponse] = await Promise.all([
    fetch(`${SCHEDULE_CONFIG_URL}?${query}`, { headers, cache: "no-store" }),
    fetch(`${SCHEDULE_STATE_URL}?${query}`, { headers, cache: "no-store" }),
  ]);

  if (!configResponse.ok || !stateResponse.ok) {
    throw new Error(`scheduler config fetch failed: profiles=${configResponse.status} state=${stateResponse.status}`);
  }

  const [config, state] = await Promise.all([configResponse.json(), stateResponse.json()]);
  if (config?.schema !== 1 || config?.timezone !== "America/Vancouver" || Number(config?.maxDailyPrimaryPulls) !== 5) {
    throw new Error("scheduler profile configuration failed validation");
  }
  if (state?.schema !== 1 || typeof state?.defaultProfileId !== "string") {
    throw new Error("scheduler state failed validation");
  }
  return { config, state };
}

function resolveScheduledSlot(scheduledTime, config, state) {
  const instant = new Date(Number(scheduledTime));
  if (!Number.isFinite(instant.getTime())) throw new Error("invalid Cloudflare scheduledTime");
  const clock = vancouverClock(instant);

  let profileId = state.defaultProfileId || config.legacyProfileId;
  const selections = (Array.isArray(state.selections) ? state.selections : [])
    .filter((item) => item && typeof item.effectiveOperatingDate === "string" && typeof item.profileId === "string")
    .slice()
    .sort(
      (a, b) =>
        String(a.effectiveOperatingDate).localeCompare(String(b.effectiveOperatingDate)) ||
        String(a.selectedAt || "").localeCompare(String(b.selectedAt || "")),
    );

  for (const selection of selections) {
    if (selection.effectiveOperatingDate <= clock.date) profileId = selection.profileId;
  }

  const profile = config?.profiles?.[profileId];
  if (!profile || !Array.isArray(profile.slots) || profile.slots.length !== 5) {
    throw new Error(`scheduler resolved invalid profile: ${profileId}`);
  }

  const slot = profile.slots.find((candidate) => String(candidate?.pulseTime || "") === clock.time);
  if (!slot) return null;

  return {
    operatingDate: clock.date,
    profileId,
    profileLabel: profile.name || profileId,
    canonicalSlot: Number(slot.canonicalSlot),
    slot: String(slot.slot || ""),
    plannedPulseTime: String(slot.pulseTime || ""),
    plannedReportTime: String(slot.reportTime || ""),
    scheduledAt: instant.toISOString(),
  };
}

async function dispatchScheduledOdds(scheduledTime, env) {
  const { config, state } = await loadSchedulerDocuments(scheduledTime);
  const slot = resolveScheduledSlot(scheduledTime, config, state);
  if (!slot) return { dispatched: false, reason: "not-a-pulse-minute" };

  const token = schedulerToken(env);
  if (!token) throw new Error("GitHub Actions scheduler token unavailable");

  const response = await fetch(ODDS_WORKFLOW_DISPATCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "VigWire-Labs-Scheduler",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        trigger_mode: "cloudflare_scheduled",
        scheduled_at: slot.scheduledAt,
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GitHub odds workflow dispatch failed: ${response.status} ${detail}`);
  }

  return { dispatched: true, ...slot };
}

async function loadPrivateLedger(env) {
  const token = String(env?.GITHUB_PRIVATE_TOKEN || "").trim();
  if (!token) throw new Error("private ledger token unavailable");

  const response = await fetch(PRIVATE_LEDGER_API, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "VigWire-Labs-Worker",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`private ledger fetch failed: ${response.status}`);
  }

  const raw = await response.json();
  if (!raw || !Array.isArray(raw.wagers) || !raw.validation) {
    throw new Error("invalid private ledger schema");
  }
  return raw;
}

function buildPublicBetHistory(raw) {
  const wagers = raw.wagers.map((r, index) => [
    index + 1,
    r[1] || "",
    null,
    r[3] || null,
    r[4] || null,
    r[5] || "",
    r[6] || "",
    r[7] || "",
    r[8] ?? 0,
    r[9] ?? 0,
    r[10] || "",
    r[11] ?? 0,
    r[12] || "UNKNOWN",
    r[13] ?? null,
    Boolean(r[14]),
    Array.isArray(r[15]) ? r[15] : [],
    Array.isArray(r[16]) ? r[16] : [],
    r[17] || "",
  ]);

  return {
    schema: 2,
    publicProjection: true,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    timezone: raw.timezone || "America/Vancouver",
    bankrollCad: Number(raw.bankrollCad || 0),
    validation: {
      uniqueWagers: wagers.length,
      pagesAt10Rows: Math.ceil(wagers.length / 10),
      status: raw.validation.status === "PASS" ? "PASS" : "CHECK",
    },
    summary: raw.summary || {},
    wagers,
  };
}

function privateBetHistoryResponse(request, raw) {
  const body = JSON.stringify(buildPublicBetHistory(raw));
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-VigWire-Source": "private-ledger",
  };
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}

function redirectToCanonical(requestUrl) {
  const target = new URL(requestUrl);
  target.protocol = "https:";
  target.hostname = CANONICAL_HOST;
  target.port = "";
  return new Response(null, {
    status: 308,
    headers: {
      Location: target.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function redirectToReport(url, id) {
  const target = new URL(url.origin);
  target.pathname = "/";
  target.searchParams.set("id", id);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function copyRequestHeaders(request) {
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "if-none-match", "if-modified-since", "range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("User-Agent", "VigWire-Labs-Worker");
  return headers;
}

function isMutableAppFile(pathname) {
  return pathname === "/" || /\.(?:html|js|json|css)$/i.test(pathname);
}

function rewriteUpstreamLocation(location, requestUrl) {
  if (!location) return location;

  try {
    const upstreamBase = new URL(`${GITHUB_PAGES_ORIGIN}/`);
    const target = new URL(location, upstreamBase);
    if (target.origin !== upstreamBase.origin) return location;

    const prefix = "/-betting-edge-terminal";
    if (!target.pathname.startsWith(prefix)) return location;

    const publicUrl = new URL(requestUrl);
    publicUrl.pathname = target.pathname.slice(prefix.length) || "/";
    publicUrl.search = target.search;
    publicUrl.hash = target.hash;
    return publicUrl.toString();
  } catch {
    return location;
  }
}

async function proxyGitHubPages(request, pathOverride = null) {
  const publicUrl = new URL(request.url);
  const upstreamPath = pathOverride ?? publicUrl.pathname;
  const upstreamUrl = new URL(`${GITHUB_PAGES_ORIGIN}${upstreamPath}${publicUrl.search}`);
  const mutable = isMutableAppFile(upstreamPath);
  const requestHeaders = copyRequestHeaders(request);

  // Mutable terminal files must come back as a full fresh body. Do not allow
  // Safari or another browser to validate against an older local copy via 304.
  if (mutable) {
    requestHeaders.delete("if-none-match");
    requestHeaders.delete("if-modified-since");
  }

  const upstream = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers: requestHeaders,
    redirect: "manual",
    cache: "no-store",
  });

  const headers = new Headers(upstream.headers);
  const location = headers.get("Location");
  if (location) {
    headers.set("Location", rewriteUpstreamLocation(location, request.url));
  }

  headers.set("X-VigWire-Origin", "github-pages");

  if (mutable) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.delete("ETag");
    headers.delete("Last-Modified");
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function errorResponse(message, status = 503) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(status === 503 ? { "Retry-After": "30" } : {}),
    },
  });
}

async function liveRootResponse(request, id) {
  const upstream = await proxyGitHubPages(request, "/r.html");
  if (request.method === "HEAD" || !upstream.ok) return upstream;

  const html = await upstream.text();
  const marker = "const id=String(new URLSearchParams(location.search).get('id')||'').trim().toLowerCase();";
  if (!html.includes(marker)) {
    return errorResponse("VigWire Labs live resolver is temporarily unavailable.");
  }

  const bound = html.replace(
    marker,
    `const id=String(new URLSearchParams(location.search).get('id')||'${id}').trim().toLowerCase();`,
  );
  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  headers.delete("Last-Modified");

  return new Response(bound, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    // The .com is the single public/canonical address. The .ca remains a clean alias.
    if (hostname === "vigwirelabs.ca") {
      return redirectToCanonical(request.url);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(`Method ${request.method} not allowed.`, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    if (url.pathname === "/api/bet-history") {
      try {
        const raw = await loadPrivateLedger(env);
        return privateBetHistoryResponse(request, raw);
      } catch (error) {
        console.error("Private ledger API failed", error);
        return errorResponse("Bet history is temporarily unavailable.");
      }
    }

    if (url.pathname === "/health") {
      try {
        const { latest, id, updatedAt } = await loadLatestRun();
        return Response.json(
          {
            ok: true,
            canonicalHost: CANONICAL_HOST,
            latestShortId: id,
            latestRun: latest.id,
            historyUpdatedAt: updatedAt,
            scheduler: {
              mode: "cloudflare-minute-dispatch",
              cron: SCHEDULER_CRON,
              tokenConfigured: Boolean(schedulerToken(env)),
              source: "public schedule profile + state",
              cutover: "parallel-with-github-cron-fallback",
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return errorResponse("VigWire Labs report link is temporarily unavailable.");
      }
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // Preserve compact report links while keeping the VigWire hostname visible.
    const pathId = url.pathname.length > 1 ? url.pathname.slice(1).toLowerCase() : "";
    if (SHORT_ID_RE.test(pathId)) {
      return redirectToReport(url, pathId);
    }

    // Explicit IDs are permanent report links. Bare vigwirelabs.com stays in LIVE mode.
    if (url.pathname === "/") {
      const suppliedId = String(url.searchParams.get("id") || "").trim().toLowerCase();

      if (suppliedId) {
        if (!SHORT_ID_RE.test(suppliedId)) {
          return errorResponse("INVALID SHORT RUN ID", 400);
        }

        try {
          return await proxyGitHubPages(request, "/r.html");
        } catch {
          return errorResponse("VigWire Labs report is temporarily unavailable.");
        }
      }

      try {
        const { id } = await loadLatestRun();
        return await liveRootResponse(request, id);
      } catch {
        return errorResponse("VigWire Labs report link is temporarily unavailable.");
      }
    }

    // All runner HTML, JSON, images and other relative assets are served through the Worker.
    // GitHub Pages remains the backend, while the browser stays on the VigWire domain.
    try {
      return await proxyGitHubPages(request);
    } catch {
      return errorResponse("VigWire Labs content is temporarily unavailable.");
    }
  },

  async scheduled(controller, env) {
    try {
      const result = await dispatchScheduledOdds(controller.scheduledTime, env);
      if (result.dispatched) {
        console.log(
          `CLOUDFLARE ODDS SCHEDULER DISPATCH // ${result.operatingDate} ${result.plannedPulseTime} PT // ${result.profileId} // SLOT ${result.canonicalSlot}`,
        );
      }
    } catch (error) {
      console.error("Cloudflare odds scheduler failed", error);
      throw error;
    }
  },
};
