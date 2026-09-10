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

test('resolves latest Fenno Codex setup script', () => {
  assert.deepEqual(resolveScriptPath('/setup-fenno-codex'), {
    kind: 'latest',
    assetPath: '/scripts/setup-fenno-codex.sh',
  });
});

test('resolves pinned Fenno Codex setup script version', () => {
  assert.deepEqual(resolveScriptPath('/setup-fenno-codex@1.0.0'), {
    kind: 'versioned',
    assetPath: '/scripts/setup-fenno-codex/1.0.0.sh',
  });
});

test('resolves the latest pinned Fenno Codex setup script version', () => {
  assert.deepEqual(resolveScriptPath('/setup-fenno-codex@1.0.1'), {
    kind: 'versioned',
    assetPath: '/scripts/setup-fenno-codex/1.0.1.sh',
  });
});

test('does not resolve the removed setup-fenno-models alias', () => {
  assert.equal(resolveScriptPath('/setup-fenno-models'), null);
  assert.equal(resolveScriptPath('/setup-fenno-models@1.0.0'), null);
});
