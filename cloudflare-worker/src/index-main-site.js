import productionWorker from "./index.js";

const MAIN_SITE_ORIGIN = "https://fhvsvzpmkw-design.github.io/vigwire-labs-main";

function canonicalVigscopeUrl(url) {
  const target = new URL(url);
  target.pathname = "/vigscope";
  return target;
}

function rootEquivalentRequest(request) {
  const target = new URL(request.url);
  target.pathname = "/";
  return new Request(target.toString(), request);
}

function mainSiteRequestHeaders(request) {
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("User-Agent", "VigWire-Labs-Main-Site");
  return headers;
}

async function proxyMainSite(request, upstreamPath) {
  const publicUrl = new URL(request.url);
  const upstreamUrl = new URL(`${MAIN_SITE_ORIGIN}${upstreamPath}${publicUrl.search}`);
  const upstream = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers: mainSiteRequestHeaders(request),
    redirect: "manual",
    cache: "no-store",
  });

  const headers = new Headers(upstream.headers);
  headers.set("X-VigWire-Origin", "main-site-github-pages");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function mainSiteRootResponse(request) {
  const upstream = await proxyMainSite(request, "/index.html");
  if (request.method === "HEAD" || !upstream.ok) return upstream;

  const html = await upstream.text();
  const rewritten = html
    .replaceAll('src="assets/', 'src="/site-assets/')
    .replaceAll("src='assets/", "src='/site-assets/")
    .replaceAll('href="assets/', 'href="/site-assets/')
    .replaceAll("href='assets/", "href='/site-assets/");

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  headers.delete("Last-Modified");

  return new Response(rewritten, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Keep VIGscope on its dedicated route. /vigscope is intentionally mapped
    // onto the original production root resolver so all existing report logic,
    // query-string IDs and relative VIGscope assets continue to behave exactly
    // as they did before the corporate homepage cutover.
    if (url.pathname === "/vigscope/") {
      return Response.redirect(canonicalVigscopeUrl(url).toString(), 308);
    }

    if (url.pathname === "/vigscope") {
      return productionWorker.fetch(rootEquivalentRequest(request), env, ctx);
    }

    // Corporate homepage assets use their own namespace so VIGscope's existing
    // /assets/* routes remain untouched.
    if (url.pathname.startsWith("/site-assets/")) {
      const upstreamPath = url.pathname.replace(/^\/site-assets\//, "/assets/");
      return proxyMainSite(request, upstreamPath);
    }

    // Preserve permanent report links and compact-link redirects that resolve to
    // /?id=<short-id>. Only a truly bare root becomes the corporate homepage.
    if (url.pathname === "/" && !url.searchParams.has("id")) {
      try {
        return await mainSiteRootResponse(request);
      } catch (error) {
        console.error("VigWire Labs main-site proxy failed", error);
        return new Response("VigWire Labs main site is temporarily unavailable.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    }

    // Every existing API route, compact report link, VIGscope asset, health check
    // and other production path remains delegated to the original Worker.
    return productionWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return productionWorker.scheduled(controller, env, ctx);
  },
};
