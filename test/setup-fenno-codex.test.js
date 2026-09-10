import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const latest = new URL('../public/scripts/setup-fenno-codex.sh', import.meta.url);
const pinned = new URL('../public/scripts/setup-fenno-codex/1.0.0.sh', import.meta.url);

test('latest and pinned Fenno setup scripts are byte-identical', () => {
  assert.equal(readFileSync(latest, 'utf8'), readFileSync(pinned, 'utf8'));
});

test('Fenno setup is idempotent and preserves the existing token', () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'script-hub-fenno-'));
  try {
    writeFileSync(
      join(codexHome, 'config.toml'),
      '[model_providers.fenno]\nexperimental_bearer_token = "keep-me"\n[projects."/tmp/demo"]\ntrust_level = "trusted"',
    );
    const env = {
      ...process.env,
      CODEX_HOME: codexHome,
      FENNO_API_KEY: '',
      CODEX_FENNO_TOKEN: '',
    };
    const script = readFileSync(latest);

    execFileSync('sh', [], { env, input: script });
    execFileSync('sh', [], { env, input: script });

    const config = readFileSync(join(codexHome, 'config.toml'), 'utf8');
    const catalog = JSON.parse(readFileSync(join(codexHome, 'model-catalogs/fenno.json'), 'utf8'));
    assert.equal((config.match(/\[model_providers\.fenno\]/g) ?? []).length, 1);
    assert.equal((config.match(/^model =/gm) ?? []).length, 1);
    assert.match(config, /experimental_bearer_token = "keep-me"/);
    assert.match(config, /\[projects\."\/tmp\/demo"\]\ntrust_level = "trusted"/);
    assert.equal(catalog.models.length, 9);
    assert.equal(catalog.models.find(({ slug }) => slug === 'codex-auto-review').visibility, 'none');
  } finally {
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('generated catalog includes fields required by Codex 0.153.4', () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'script-hub-fenno-'));
  try {
    const env = {
      ...process.env,
      CODEX_HOME: codexHome,
      FENNO_API_KEY: 'catalog-test-key',
      CODEX_FENNO_TOKEN: '',
    };

    execFileSync('sh', [], { env, input: readFileSync(latest) });

    const catalog = JSON.parse(readFileSync(join(codexHome, 'model-catalogs/fenno.json'), 'utf8'));
    for (const model of catalog.models) {
      assert.equal(model.support_verbosity, false);
      assert.deepEqual(model.truncation_policy, { mode: 'tokens', limit: 10000 });
      assert.deepEqual(model.experimental_supported_tools, []);
      assert.match(model.base_instructions, /You are Codex/);
    }
  } finally {
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('Fenno setup reports a Chinese error when no token or interactive terminal is available', () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'script-hub-fenno-'));
  try {
    const result = spawnSync('sh', [], {
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        FENNO_API_KEY: '',
        CODEX_FENNO_TOKEN: '',
      },
      input: readFileSync(latest),
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /未检测到 Fenno API Key/);
  } finally {
    rmSync(codexHome, { recursive: true, force: true });
  }
});
