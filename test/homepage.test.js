import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homepage = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('homepage shows Fenno setup commands for the default Codex home', () => {
  assert.match(homepage, /fennoLatest: `curl -fsSL \$\{location\.origin\}\/setup-fenno-codex \| sh`/);
  assert.match(homepage, /fennoPinned: `curl -fsSL \$\{location\.origin\}\/setup-fenno-codex@1\.0\.2 \| sh`/);
  assert.doesNotMatch(homepage, /CODEX_HOME|codex-fenno/);
});
