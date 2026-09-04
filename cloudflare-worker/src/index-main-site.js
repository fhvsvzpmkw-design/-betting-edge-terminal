import productionWorker from "./index.js";

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Stage 1 of the main-site cutover: expose the existing VIGscope LIVE/report
    // resolver at /vigscope while leaving the current bare-root behavior untouched.
    if (url.pathname === "/vigscope/") {
      return Response.redirect(canonicalVigscopeUrl(url).toString(), 308);
    }

    if (url.pathname === "/vigscope") {
      return productionWorker.fetch(rootEquivalentRequest(request), env, ctx);
    }

    return productionWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return productionWorker.scheduled(controller, env, ctx);
  },
};
