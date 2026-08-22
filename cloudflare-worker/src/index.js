const HISTORY_URL = "https://raw.githubusercontent.com/fhvsvzpmkw-design/-betting-edge-terminal/main/run-history.json";
const GITHUB_PAGES_ORIGIN = "https://fhvsvzpmkw-design.github.io/-betting-edge-terminal";
const CANONICAL_HOST = "vigwirelabs.com";

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

  const upstream = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers: copyRequestHeaders(request),
    redirect: "manual",
  });

  const headers = new Headers(upstream.headers);
  const location = headers.get("Location");
  if (location) {
    headers.set("Location", rewriteUpstreamLocation(location, request.url));
  }

  headers.set("X-VigWire-Origin", "github-pages");

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

export default {
  async fetch(request) {
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

    // The public root is the report resolver. With an ID present, internally serve r.html.
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
        return redirectToReport(url, id);
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
};
