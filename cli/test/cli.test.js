import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { expect, test } from 'bun:test';

const cli = new URL('../hydrozoa.js', import.meta.url);

async function execute(args, env = {}) {
  const child = spawn(process.execPath, [cli.pathname, ...args], {
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [code] = await once(child, 'close');
  return { code, stdout, stderr };
}

test('prints help', async () => {
  const result = await execute(['--help']);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/sync --matrix/);
});

test('reports health as JSON without authentication', async () => {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ status: 'UP', database: 'connected', git: 'git version test' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();
  const result = await execute(['health', '--json', '--url', `http://127.0.0.1:${port}`]);
  server.close();
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).status).toBe('UP');
});

test('resolves a repository name before starting a manual sync', async () => {
  const paths = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    response.setHeader('content-type', 'application/json');
    if (request.url === '/api/v1/system/sync-matrix') {
      response.end(JSON.stringify({
        sync_matrix: [{ id: 'matrix-1', source_repo: 'production', targets: [] }],
      }));
      return;
    }
    response.end(JSON.stringify({
      message: 'Manual sync initiated',
      item: { source_repo: 'production' },
    }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();
  const result = await execute([
    'sync', '--matrix', 'production', '--url', `http://127.0.0.1:${port}`, '--token', 'test',
  ]);
  server.close();
  expect(result.code).toBe(0);
  expect(paths).toEqual(['/api/v1/system/sync-matrix', '/api/v1/sync/manual/matrix-1']);
});
