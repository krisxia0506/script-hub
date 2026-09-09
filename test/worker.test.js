import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const assets = new Map([
  ['/scripts/hello.sh', '#!/bin/sh\necho latest\n'],
  ['/scripts/hello/1.0.0.sh', '#!/bin/sh\necho 1.0.0\n'],
  ['/scripts/setup-fenno-models.sh', '#!/bin/sh\necho fenno\n'],
  ['/', '<!doctype html><title>Script Hub</title>'],
]);

function makeEnv() {
  return {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        const body = assets.get(url.pathname);
        if (body === undefined) return new Response('Not found', { status: 404 });
        return new Response(request.method === 'HEAD' ? null : body, {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        });
      },
    },
  };
}

test('GET latest alias returns shell script with short cache policy', async () => {
  const response = await worker.fetch(new Request('https://example.test/hello'), makeEnv());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '#!/bin/sh\necho latest\n');
  assert.equal(response.headers.get('content-type'), 'text/x-shellscript; charset=utf-8');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
});

test('GET pinned alias returns immutable cache policy', async () => {
  const response = await worker.fetch(new Request('https://example.test/hello@1.0.0'), makeEnv());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '#!/bin/sh\necho 1.0.0\n');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('HEAD latest alias returns headers without a body', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/hello', { method: 'HEAD' }),
    makeEnv(),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('content-type'), 'text/x-shellscript; charset=utf-8');
});

test('unknown one-segment alias returns 404', async () => {
  const response = await worker.fetch(new Request('https://example.test/missing'), makeEnv());
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Script not found\n');
});

test('unsupported method on a known alias returns 405', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/hello', { method: 'POST' }),
    makeEnv(),
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});

test('root request delegates to static assets', async () => {
  const response = await worker.fetch(new Request('https://example.test/'), makeEnv());
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Script Hub/);
});

test('GET Fenno alias returns shell content type', async () => {
  const response = await worker.fetch(
    new Request('https://example.test/setup-fenno-models'),
    makeEnv(),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/x-shellscript; charset=utf-8');
  assert.equal(await response.text(), '#!/bin/sh\necho fenno\n');
});
