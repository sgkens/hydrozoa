#!/usr/bin/env bun

import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';

const VERSION = createRequire(import.meta.url)('./package.json').version;
const CONFIG_PATH = process.env.HYDROZOA_CONFIG
  ?? join(homedir(), '.config', 'hydrozoa', 'config.json');

const commandDefinitions = {
  login: {
    options: {
      email: { type: 'string', short: 'e' },
      password: { type: 'string', short: 'p' },
    },
  },
  health: { options: {} },
  status: { options: {} },
  matrix: { options: {} },
  sync: {
    options: {
      matrix: { type: 'string', short: 'm' },
    },
  },
  providers: { options: {} },
  dlq: {
    options: {
      replay: { type: 'string', short: 'r' },
    },
  },
  logs: {
    options: {
      limit: { type: 'string', short: 'l', default: '25' },
      verbosity: { type: 'string', short: 'v', default: 'human' },
    },
  },
};

const globalOptions = {
  url: { type: 'string', short: 'u' },
  token: { type: 'string', short: 't' },
  json: { type: 'boolean', short: 'j', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', default: false },
  'no-color': { type: 'boolean', default: false },
};

const colorEnabled = process.stdout.isTTY && !process.argv.includes('--no-color')
  && !process.env.NO_COLOR;
const paint = (code, value) => colorEnabled ? `\u001b[${code}m${value}\u001b[0m` : value;
const cyan = value => paint('36', value);
const green = value => paint('32', value);
const yellow = value => paint('33', value);
const dim = value => paint('2', value);

function help() {
  return `${cyan('Hydrozoa CLI')} ${dim(`v${VERSION}`)}

Operate a Hydrozoa instance through its REST API.

Usage:
  bunx @skgens/hydrozoa <command> [options]

Commands:
  login       Authenticate and store a session
  health      Check application and database health
  status      Summarize health, mirrors, and failures
  matrix      List the synchronization matrix
  sync        Start a mirror: sync --matrix <id|repository>
  providers   List configured Git providers
  dlq         List failures or replay one: dlq --replay <id>
  logs        Read recent logs

Global options:
  -u, --url <url>       Hydrozoa base URL (or HYDROZOA_URL)
  -t, --token <token>   JWT (or HYDROZOA_TOKEN)
  -j, --json            Emit machine-readable JSON
  -h, --help            Show help
      --version         Show the CLI version
      --no-color        Disable ANSI colors

Examples:
  bunx @skgens/hydrozoa login --url http://localhost:3000 --email admin@hydrozoa.io
  bunx @skgens/hydrozoa status
  bunx @skgens/hydrozoa sync --matrix production
`;
}

async function readConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${CONFIG_PATH}: ${error.message}`);
  }
}

async function saveConfig(config) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600);
}

function parseCommand(argv) {
  const command = argv[0]?.startsWith('-') ? undefined : argv[0];
  const definition = commandDefinitions[command];
  const options = { ...globalOptions, ...(definition?.options ?? {}) };
  const parsed = parseArgs({
    args: command ? argv.slice(1) : argv,
    options,
    allowPositionals: true,
    strict: true,
  });
  return { command, ...parsed };
}

function baseUrl(value) {
  return value.replace(/\/+$/, '');
}

async function request(config, path, init = {}, authenticated = true) {
  if (!config.url) {
    throw new Error('Hydrozoa URL is not configured. Pass --url or set HYDROZOA_URL.');
  }
  if (authenticated && !config.token) {
    throw new Error('Not authenticated. Run `hydrozoa login` or set HYDROZOA_TOKEN.');
  }

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (authenticated) headers.set('authorization', `Bearer ${config.token}`);

  let response;
  try {
    response = await fetch(`${baseUrl(config.url)}${path}`, { ...init, headers });
  } catch (error) {
    throw new Error(`Cannot reach ${config.url}: ${error.message}`);
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok) {
    throw new Error(body.error ?? body.message ?? `HTTP ${response.status}`);
  }
  return body;
}

function table(rows, columns) {
  if (!rows.length) return dim('No records.');
  const widths = columns.map(column => Math.max(
    column.label.length,
    ...rows.map(row => String(column.value(row) ?? '').length),
  ));
  const line = row => columns.map((column, index) =>
    String(column.value(row) ?? '').padEnd(widths[index])).join('  ');
  const heading = columns.map((column, index) =>
    column.label.padEnd(widths[index])).join('  ');
  return `${cyan(heading)}\n${rows.map(line).join('\n')}`;
}

function output(value, json, formatter = null) {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${formatter ? formatter(value) : value}\n`);
}

function targetSummary(item) {
  const targets = Array.isArray(item.targets) ? item.targets : [];
  const healthy = targets.filter(target => target.status === 'synced').length;
  return `${healthy}/${targets.length}`;
}

async function run() {
  const parsed = parseCommand(process.argv.slice(2));
  if (parsed.values.version) return output(VERSION, false);
  if (!parsed.command || parsed.values.help || !commandDefinitions[parsed.command]) {
    process.stdout.write(help());
    process.exitCode = parsed.command && !commandDefinitions[parsed.command] ? 1 : 0;
    return;
  }

  const stored = await readConfig();
  const config = {
    url: parsed.values.url ?? process.env.HYDROZOA_URL ?? stored.url,
    token: parsed.values.token ?? process.env.HYDROZOA_TOKEN ?? stored.token,
  };
  const json = parsed.values.json;

  if (parsed.command === 'login') {
    const email = parsed.values.email ?? process.env.HYDROZOA_EMAIL;
    const password = parsed.values.password ?? process.env.HYDROZOA_PASSWORD;
    if (!email || !password) {
      throw new Error('Login requires --email and --password, or HYDROZOA_EMAIL and HYDROZOA_PASSWORD.');
    }
    const result = await request(config, '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);
    await saveConfig({ url: baseUrl(config.url), token: result.token });
    output(result, json, body => `${green('Authenticated')} as ${body.user?.email ?? email}\n${dim(`Saved ${CONFIG_PATH}`)}`);
    return;
  }

  if (parsed.command === 'health') {
    const health = await request(config, '/health', {}, false);
    output(health, json, body => `${green('◆')} Hydrozoa ${body.status}\n${dim(`database ${body.database} · git ${body.git}`)}`);
    return;
  }

  if (parsed.command === 'matrix') {
    const result = await request(config, '/api/v1/system/sync-matrix');
    output(result, json, body => table(body.sync_matrix ?? [], [
      { label: 'ID', value: row => row.id },
      { label: 'REPOSITORY', value: row => row.source_repo },
      { label: 'PROVIDER', value: row => row.source_provider },
      { label: 'TARGETS', value: targetSummary },
    ]));
    return;
  }

  if (parsed.command === 'sync') {
    const selector = parsed.values.matrix ?? parsed.positionals[0];
    if (!selector) throw new Error('Sync requires --matrix <id|repository>.');
    const matrix = await request(config, '/api/v1/system/sync-matrix');
    const matches = (matrix.sync_matrix ?? []).filter(item =>
      String(item.id) === selector || item.source_repo === selector);
    if (!matches.length) throw new Error(`No matrix item matches '${selector}'.`);
    if (matches.length > 1) throw new Error(`'${selector}' matches multiple matrix items; use an ID.`);
    const result = await request(config, `/api/v1/sync/manual/${encodeURIComponent(matches[0].id)}`, {
      method: 'POST',
    });
    output(result, json, body => `${green('✓')} ${body.message}: ${body.item.source_repo}`);
    return;
  }

  if (parsed.command === 'providers') {
    const result = await request(config, '/api/v1/auth/providers');
    const providers = Array.isArray(result) ? result : result.providers ?? [];
    output(result, json, () => table(providers, [
      { label: 'ID', value: row => row.id },
      { label: 'NAME', value: row => row.name },
      { label: 'TYPE', value: row => row.type },
      { label: 'SOURCE', value: row => row.isSource ? 'yes' : 'no' },
    ]));
    return;
  }

  if (parsed.command === 'dlq') {
    if (parsed.values.replay) {
      const result = await request(config, `/api/v1/system/dlq/${encodeURIComponent(parsed.values.replay)}/replay`, {
        method: 'POST',
      });
      output(result, json, body => `${green('✓')} ${body.message}`);
      return;
    }
    const result = await request(config, '/api/v1/system/dlq');
    output(result, json, body => table(body.dlq_items ?? [], [
      { label: 'ID', value: row => row.id },
      { label: 'REPOSITORY', value: row => row.repository_id },
      { label: 'TARGET', value: row => row.target_provider },
      { label: 'REASON', value: row => row.failure_reason },
    ]));
    return;
  }

  if (parsed.command === 'logs') {
    const query = new URLSearchParams({
      limit: parsed.values.limit,
      verbosity: parsed.values.verbosity,
    });
    const result = await request(config, `/api/v1/logs/translated?${query}`);
    const logs = Array.isArray(result) ? result : result.logs ?? [];
    output(result, json, () => table(logs, [
      { label: 'TIME', value: row => row.timestamp },
      { label: 'LEVEL', value: row => row.level },
      { label: 'MESSAGE', value: row => row.ui_message ?? row.message },
    ]));
    return;
  }

  if (parsed.command === 'status') {
    const [health, matrix, dlq] = await Promise.all([
      request(config, '/health', {}, false),
      request(config, '/api/v1/system/sync-matrix'),
      request(config, '/api/v1/system/dlq'),
    ]);
    const items = matrix.sync_matrix ?? [];
    const failures = dlq.dlq_items ?? [];
    const result = { health, mirrors: items, failures };
    output(result, json, () => [
      `${green('◆')} Hydrozoa ${health.status}`,
      `${cyan(String(items.length))} mirror${items.length === 1 ? '' : 's'} configured`,
      failures.length ? yellow(`${failures.length} item${failures.length === 1 ? '' : 's'} in the DLQ`) : green('DLQ clear'),
    ].join('\n'));
  }
}

run().catch(error => {
  process.stderr.write(`${paint('31', 'Error:')} ${error.message}\n`);
  process.exitCode = 1;
});
