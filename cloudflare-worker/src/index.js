const HISTORY_URL = "https://raw.githubusercontent.com/fhvsvzpmkw-design/-betting-edge-terminal/main/run-history.json";
const REPORT_URL = "https://fhvsvzpmkw-design.github.io/-betting-edge-terminal/r.html";

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
      "Cache-Control": "no-cache",
    },
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

function reportRedirect(id) {
  const location = `${REPORT_URL}?id=${encodeURIComponent(id)}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    const requestedId = String(url.searchParams.get("id") || url.pathname.slice(1)).toLowerCase();
    if (SHORT_ID_RE.test(requestedId)) {
      return reportRedirect(requestedId);
    }

    try {
      const { latest, id, updatedAt } = await loadLatestRun();

      if (url.pathname === "/health") {
        return Response.json(
          {
            ok: true,
            latestShortId: id,
            latestRun: latest.id,
            historyUpdatedAt: updatedAt,
          },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      }

      return reportRedirect(id);
    } catch (error) {
      return new Response("VigWire Labs report link is temporarily unavailable.", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "30",
        },
      });
    }
  },
};
