import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
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

test('latest and pinned Codex throughput scripts are byte-identical', () => {
  assert.equal(readFileSync(latest, 'utf8'), readFileSync(pinned, 'utf8'));
});

test('calculates weighted end-to-end throughput per model from a custom CODEX_HOME and deduplicates archived turns', () => {
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
      record('2026-09-10T00:00:09Z', 'event_msg', { type: 'task_complete', turn_id: 'nested-turn' }),
      record('2026-09-10T00:00:10Z', 'event_msg', { type: 'task_complete', turn_id: 'turn-1' }),
    ];
    writeSession(home, 'sessions', 'session-a.jsonl', [
      ...firstTurn,
      record('2026-09-10T00:01:00Z', 'event_msg', { type: 'task_started', turn_id: 'turn-2' }),
      record('2026-09-10T00:01:00Z', 'turn_context', { model: 'gpt-alpha' }),
      record('2026-09-10T00:01:09Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 25 },
          last_token_usage: { output_tokens: 25 },
        },
      }),
      record('2026-09-10T00:01:10Z', 'event_msg', { type: 'task_complete', turn_id: 'turn-2' }),
      record('2026-09-10T00:02:00Z', 'event_msg', { type: 'task_started', turn_id: 'turn-3' }),
      record('2026-09-10T00:02:00Z', 'turn_context', { model: 'gpt-beta' }),
      record('2026-09-10T00:02:29Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 115 },
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
    assert.match(output, /统计口径  : 输出 token \/ 完整轮次端到端耗时（含模型思考、工具执行和等待）/);
    assert.match(output, /整体加权端到端吞吐量: 4\.30 token\/s/);
    assert.match(output, /模型对比汇总（端到端输出吞吐量，单位：token\/s）/);
    assert.doesNotMatch(output, /整体加权 TPS|模型对比汇总（TPS/);
    assert.match(output, /有效轮次  : 3/);
    assert.match(output, /gpt-alpha\s+1\s+2\s+6\.25/);
    assert.match(output, /gpt-beta\s+1\s+1\s+3\.00/);
    assert.match(output, /重复轮次=1/);
    assert.match(output, /计数回退=1/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('preserves fractional timestamp precision and bounds token lookup to its usage object', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'fractions.jsonl', [
      record('2026-09-10T00:00:00.100Z', 'event_msg', { type: 'task_started', turn_id: 'fractional' }),
      record('2026-09-10T00:00:00.100Z', 'turn_context', { model: 'gpt-fast' }),
      record('2026-09-10T00:00:00.500Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 10 },
          last_token_usage: { output_tokens: 10 },
        },
      }),
      record('2026-09-10T00:00:00.600Z', 'event_msg', { type: 'task_complete', turn_id: 'fractional' }),
      record('2026-09-10T00:01:00Z', 'event_msg', { type: 'task_started', turn_id: 'malformed-usage' }),
      record('2026-09-10T00:01:00Z', 'turn_context', { model: 'gpt-fast' }),
      record('2026-09-10T00:01:01Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: {},
          last_token_usage: { output_tokens: 999 },
        },
      }),
      record('2026-09-10T00:01:02Z', 'event_msg', { type: 'task_complete', turn_id: 'malformed-usage' }),
    ]);

    const output = runScript(home, [
      '--since', '2026-09-10T00:00:00Z',
      '--until', '2026-09-10T01:00:00Z',
      '--hours', 'ignored-value',
    ]);

    assert.match(output, /gpt-fast\s+1\s+1\s+20\.00/);
    assert.match(output, /窗口内无效轮次=1/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('returns a nonzero status instead of publishing partial results after a read failure', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'readable.jsonl', [
      record('2026-09-10T00:00:00Z', 'event_msg', { type: 'task_started', turn_id: 'turn-ok' }),
      record('2026-09-10T00:00:00Z', 'turn_context', { model: 'gpt-ok' }),
      record('2026-09-10T00:00:01Z', 'event_msg', { type: 'token_count', info: { total_token_usage: { output_tokens: 1 }, last_token_usage: { output_tokens: 1 } } }),
      record('2026-09-10T00:00:02Z', 'event_msg', { type: 'task_complete', turn_id: 'turn-ok' }),
    ]);
    mkdirSync(join(home, 'archived_sessions'), { recursive: true });
    writeFileSync(join(home, 'archived_sessions', 'unreadable.jsonl'), '{}\n', { mode: 0o000 });

    const result = spawnSync('sh', [latest.pathname,
      '--codex-home', home,
      '--since', '2026-09-10T00:00:00Z',
      '--until', '2026-09-10T01:00:00Z',
    ], { encoding: 'utf8' });

    if (process.getuid?.() === 0) {
      assert.equal(result.status, 0);
    } else {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /读取失败/);
    }
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
    assert.match(output, /E2E tok\/s\s+Tokens\s+Seconds\s+Turns/);
    assert.doesNotMatch(output, /^\s+TPS\s+Tokens/m);
    assert.match(output, /gpt-beta\s+1\s+1\s+4\.00/);
    assert.match(output, /models\.jsonl\/turn-b/);
    assert.doesNotMatch(output, /^gpt-alpha\s/m);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('does not omit in-window turns when the session file has an old mtime', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    const end = new Date(Date.now() - 2000);
    const start = new Date(end.getTime() - 1000);
    writeSession(home, 'sessions', 'restored.jsonl', [
      record(start.toISOString(), 'event_msg', { type: 'task_started', turn_id: 'restored-turn' }),
      record(start.toISOString(), 'turn_context', { model: 'gpt-restored' }),
      record(end.toISOString(), 'event_msg', { type: 'token_count', info: { total_token_usage: { output_tokens: 10 }, last_token_usage: { output_tokens: 10 } } }),
      record(end.toISOString(), 'event_msg', { type: 'task_complete', turn_id: 'restored-turn' }),
    ]);
    const path = join(home, 'sessions', '2026', '09', '10', 'restored.jsonl');
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    utimesSync(path, old, old);

    const output = runScript(home, ['--hours', '1']);

    assert.match(output, /gpt-restored\s+1\s+1\s+10\.00/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('runs without regexp escape warnings under strict POSIX awk mode', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'strict-posix.jsonl', [
      record('2026-09-10T00:00:00Z', 'event_msg', { type: 'task_started', turn_id: 'strict-turn' }),
      record('2026-09-10T00:00:00Z', 'turn_context', { model: 'gpt-strict' }),
      record('2026-09-10T00:00:01Z', 'event_msg', { type: 'token_count', info: { total_token_usage: { output_tokens: 2 }, last_token_usage: { output_tokens: 2 } } }),
      record('2026-09-10T00:00:02Z', 'event_msg', { type: 'task_complete', turn_id: 'strict-turn' }),
    ]);

    const result = spawnSync('sh', [latest.pathname,
      '--codex-home', home,
      '--since', '2026-09-10T00:00:00Z',
      '--until', '2026-09-10T01:00:00Z',
    ], {
      encoding: 'utf8',
      env: { ...process.env, POSIXLY_CORRECT: '1' },
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /gpt-strict\s+1\s+1\s+1\.00/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('prints the calculated UTC start time when the window comes from --hours', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'window.jsonl', [
      record('2026-09-10T02:00:00Z', 'event_msg', { type: 'task_started', turn_id: 'window-turn' }),
      record('2026-09-10T02:00:00Z', 'turn_context', { model: 'gpt-window' }),
      record('2026-09-10T02:00:01Z', 'event_msg', { type: 'token_count', info: { total_token_usage: { output_tokens: 2 }, last_token_usage: { output_tokens: 2 } } }),
      record('2026-09-10T02:00:02Z', 'event_msg', { type: 'task_complete', turn_id: 'window-turn' }),
    ]);

    const output = runScript(home, [
      '--hours', '24',
      '--until', '2026-09-10T03:36:53Z',
    ]);

    assert.match(output, /窗口 UTC  : 2026-09-09T03:36:53Z ~ 2026-09-10T03:36:53Z/);
    assert.doesNotMatch(output, /按 --hours 计算/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('normalizes timezone offsets and fractional-second rollover in UTC window labels', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'leap.jsonl', [
      record('2000-03-01T08:00:00Z', 'event_msg', { type: 'task_started', turn_id: 'leap-turn' }),
      record('2000-03-01T08:00:00Z', 'turn_context', { model: 'gpt-leap' }),
      record('2000-03-01T08:00:01Z', 'event_msg', { type: 'token_count', info: { total_token_usage: { output_tokens: 1 }, last_token_usage: { output_tokens: 1 } } }),
      record('2000-03-01T08:00:01Z', 'event_msg', { type: 'task_complete', turn_id: 'leap-turn' }),
    ]);

    const output = runScript(home, [
      '--since', '2000-02-29T23:59:59.9999-08:00',
      '--until', '2000-03-01T08:00:01.0004Z',
    ]);

    assert.match(output, /窗口 UTC  : 2000-03-01T08:00:00Z ~ 2000-03-01T08:00:01Z/);
    assert.doesNotMatch(output, /:60Z/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('rejects a calculated window start before the supported Unix epoch', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'epoch.jsonl', [
      record('1970-01-01T00:00:00Z', 'session_meta', { id: 'epoch' }),
    ]);

    const result = spawnSync('sh', [latest.pathname,
      '--codex-home', home,
      '--hours', '2',
      '--until', '1970-01-01T01:00:00Z',
    ], { encoding: 'utf8' });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /窗口起点不能早于 1970-01-01T00:00:00Z/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('uses payload lifecycle times for replayed turns instead of compressed outer timestamps', () => {
  const home = mkdtempSync(join(tmpdir(), 'script-hub-codex-tps-'));
  try {
    writeSession(home, 'sessions', 'replayed.jsonl', [
      record('2026-09-08T13:05:08.409Z', 'event_msg', {
        type: 'task_started',
        turn_id: 'replayed-turn',
        started_at: 1787360944,
      }),
      record('2026-09-08T13:05:08.410Z', 'turn_context', { model: 'gpt-replayed' }),
      record('2026-09-08T13:05:08.410Z', 'event_msg', {
        type: 'token_count',
        info: {
          total_token_usage: { output_tokens: 65 },
          last_token_usage: { output_tokens: 65 },
        },
      }),
      record('2026-09-08T13:05:08.411Z', 'event_msg', {
        type: 'task_complete',
        turn_id: 'replayed-turn',
        started_at: 1787360944,
        completed_at: 1787360999,
        duration_ms: 54835,
      }),
    ]);

    const historicalOutput = runScript(home, [
      '--since', '2026-08-22T01:00:00Z',
      '--until', '2026-08-22T01:20:00Z',
    ]);
    assert.match(historicalOutput, /gpt-replayed\s+1\s+1\s+1\.19/);
    assert.match(historicalOutput, /执行耗时和: 54\.84 秒/);

    const replayWindow = spawnSync('sh', [latest.pathname,
      '--codex-home', home,
      '--since', '2026-09-07T00:00:00Z',
      '--until', '2026-09-10T00:00:00Z',
    ], { encoding: 'utf8' });
    assert.equal(replayWindow.status, 2);
    assert.match(replayWindow.stdout, /没有找到符合条件的完整轮次/);
    assert.match(replayWindow.stdout, /窗口外轮次=1/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
