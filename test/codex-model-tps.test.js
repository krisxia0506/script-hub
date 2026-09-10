import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const latest = new URL('../public/scripts/codex-model-tps.sh', import.meta.url);
const pinned = new URL('../public/scripts/codex-model-tps/1.0.0.sh', import.meta.url);

function record(timestamp, type, payload) {
  return JSON.stringify({ timestamp, type, payload });
}

function writeSession(home, directory, name, records) {
  const target = join(home, directory, '2026', '09', '10');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, name), `${records.join('\n')}\n`);
}

function runScript(home, args = [], extraEnv = {}) {
  return execFileSync('sh', [latest.pathname, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CODEX_HOME: home, ...extraEnv },
  });
}

test('latest and pinned Codex TPS scripts are byte-identical', () => {
  assert.equal(readFileSync(latest, 'utf8'), readFileSync(pinned, 'utf8'));
});

test('calculates weighted TPS per model from a custom CODEX_HOME and deduplicates archived turns', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    const firstTurn = [
      record('2026-09-10T00:00:00Z', 'session_meta', { id: 'session-a' }),
      record('2026-09-10T00:00:00Z', 'event_msg', { type: 'task_started', turn_id: 'turn-1' }),
      record('2026-09-10T00:00:01Z', 'turn_context', { model: 'gpt-alpha' }),
      record('2026-09-10T00:00:09Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 100 },
          last_token_usage: { output_tokens: 100 },
        },
      }),
      record('2026-09-10T00:00:10Z', 'event_msg', { type: 'task_complete', turn_id: 'turn-1' }),
    ];
    writeSession(home, 'sessions', 'session-a.jsonl', [
      ...firstTurn,
      record('2026-09-10T00:01:00Z', 'event_msg', { type: 'task_started', turn_id: 'turn-2' }),
      record('2026-09-10T00:01:00Z', 'turn_context', { model: 'gpt-alpha' }),
      record('2026-09-10T00:01:09Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 150 },
          last_token_usage: { output_tokens: 50 },
        },
      }),
      record('2026-09-10T00:01:10Z', 'event_msg', { type: 'task_complete', turn_id: 'turn-2' }),
      record('2026-09-10T00:02:00Z', 'event_msg', { type: 'task_started', turn_id: 'turn-3' }),
      record('2026-09-10T00:02:00Z', 'turn_context', { model: 'gpt-beta' }),
      record('2026-09-10T00:02:29Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 240 },
          last_token_usage: { output_tokens: 90 },
        },
      }),
      record('2026-09-10T00:02:30Z', 'event_msg', { type: 'task_complete', turn_id: 'turn-3' }),
    ]);
    writeSession(home, 'archived_sessions', 'duplicate.jsonl', firstTurn);

    const output = runScript('/not/the/requested/home', [
      '--codex-home', home,
      '--since', '2026-09-10T00:00:00Z',
      '--until', '2026-09-10T01:00:00Z',
    ]);

    assert.match(output, /日志目录  : .*script-hub-codex-tps-/);
    assert.match(output, /有效轮次  : 3/);
    assert.match(output, /gpt-alpha\s+1\s+2\s+7\.50/);
    assert.match(output, /gpt-beta\s+1\s+1\s+3\.00/);
    assert.match(output, /重复轮次=1/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('supports turn grouping, exact model filtering, and details', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'models.jsonl', [
      record('2026-09-10T00:00:00+08:00', 'event_msg', { type: 'task_started', turn_id: 'turn-a' }),
      record('2026-09-10T00:00:00+08:00', 'turn_context', { model: 'gpt-alpha' }),
      record('2026-09-10T00:00:04+08:00', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 20 },
          last_token_usage: { output_tokens: 20 },
        },
      }),
      record('2026-09-10T00:00:05+08:00', 'event_msg', { type: 'task_complete', turn_id: 'turn-a' }),
      record('2026-09-10T00:01:00+08:00', 'event_msg', { type: 'task_started', turn_id: 'turn-b' }),
      record('2026-09-10T00:01:00+08:00', 'turn_context', { model: 'gpt-beta' }),
      record('2026-09-10T00:01:04+08:00', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 40 },
          last_token_usage: { output_tokens: 20 },
        },
      }),
      record('2026-09-10T00:01:05+08:00', 'event_msg', { type: 'task_complete', turn_id: 'turn-b' }),
    ]);

    const output = runScript(home, [
      '--since', '2026-09-09T15:00:00Z',
      '--until', '2026-09-09T17:00:00Z',
      '--group', 'turn',
      '--model', 'gpt-beta',
      '--details',
    ]);

    assert.match(output, /模型筛选  : gpt-beta/);
    assert.match(output, /样本单位  : 轮次/);
    assert.match(output, /gpt-beta\s+1\s+1\s+4\.00/);
    assert.match(output, /models\.jsonl\/turn-b/);
    assert.doesNotMatch(output, /^gpt-alpha\s/m);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
