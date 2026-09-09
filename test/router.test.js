import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScriptPath } from '../src/router.js';

test('resolves latest alias', () => {
  assert.deepEqual(resolveScriptPath('/hello'), { kind: 'latest', assetPath: '/scripts/hello.sh' });
});

test('resolves pinned version alias', () => {
  assert.deepEqual(resolveScriptPath('/hello@1.0.0'), {
    kind: 'versioned',
    assetPath: '/scripts/hello/1.0.0.sh',
  });
});

test('does not treat direct static paths as short aliases', () => {
  assert.equal(resolveScriptPath('/scripts/hello.sh'), null);
});

test('returns null for unknown short alias', () => {
  assert.equal(resolveScriptPath('/missing'), null);
});

test('resolves latest Python script with its content type', () => {
  assert.deepEqual(resolveScriptPath('/setup-fenno-models'), {
    kind: 'latest',
    assetPath: '/scripts/setup-fenno-models.py',
    contentType: 'text/x-python; charset=utf-8',
  });
});

test('resolves pinned Python script version', () => {
  assert.deepEqual(resolveScriptPath('/setup-fenno-models@1.0.0'), {
    kind: 'versioned',
    assetPath: '/scripts/setup-fenno-models/1.0.0.py',
    contentType: 'text/x-python; charset=utf-8',
  });
});
