import { resolveScriptPath } from './router.js';

const LATEST_CACHE = 'public, max-age=60';
const VERSIONED_CACHE = 'public, max-age=31536000, immutable';

function textResponse(body, status, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  });
}

async function serveScript(request, env, resolved) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return textResponse('Method not allowed\n', 405, { allow: 'GET, HEAD' });
  }

  const assetUrl = new URL(resolved.assetPath, request.url);
  const assetRequest = new Request(assetUrl, request);
  const assetResponse = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(assetResponse.headers);

  headers.set('content-type', 'text/x-shellscript; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', resolved.kind === 'versioned' ? VERSIONED_CACHE : LATEST_CACHE);

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const resolved = resolveScriptPath(url.pathname);

    if (resolved) return serveScript(request, env, resolved);
    if (/^\/[^/]+$/.test(url.pathname)) return textResponse('Script not found\n', 404);
    return env.ASSETS.fetch(request);
  },
};
