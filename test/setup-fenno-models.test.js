import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const latest = new URL('../public/scripts/setup-fenno-models.py', import.meta.url);
const pinned = new URL('../public/scripts/setup-fenno-models/1.0.0.py', import.meta.url);

test('latest and pinned Fenno setup scripts are byte-identical', () => {
  assert.equal(readFileSync(latest, 'utf8'), readFileSync(pinned, 'utf8'));
});

test('Fenno setup is idempotent and preserves the existing token', () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'script-hub-fenno-'));
  try {
    writeFileSync(
      join(codexHome, 'config.toml'),
      '[model_providers.fenno]\nexperimental_bearer_token = "keep-me"\n',
    );
    const env = { ...process.env, CODEX_HOME: codexHome };

    execFileSync('python3', [latest.pathname], { env });
    execFileSync('python3', [latest.pathname], { env });

    const config = readFileSync(join(codexHome, 'config.toml'), 'utf8');
    const catalog = JSON.parse(readFileSync(join(codexHome, 'model-catalogs/fenno.json'), 'utf8'));
    assert.equal((config.match(/\[model_providers\.fenno\]/g) ?? []).length, 1);
    assert.match(config, /experimental_bearer_token = "keep-me"/);
    assert.equal(catalog.models.length, 9);
    assert.equal(catalog.models.find(({ slug }) => slug === 'codex-auto-review').visibility, 'none');
  } finally {
    rmSync(codexHome, { recursive: true, force: true });
  }
});
