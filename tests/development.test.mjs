import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectProject, diagnostics } from '../dist/main/development.js';

test('detects a Node project and package manager', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kzide-node-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { start: 'vite', test: 'node --test' } }));
  const info = await detectProject(root);
  assert.equal(info.kind, 'node');
  assert.equal(info.packageManager, 'npm');
  assert.equal(info.testCommand, 'npm test');
  assert.equal(info.runCommand, 'npm start');
});

test('uses .kzide launch/task configuration when present', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kzide-config-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
  await fs.mkdir(path.join(root, '.kzide'));
  await fs.writeFile(path.join(root, '.kzide', 'launch.json'), JSON.stringify({ configurations: [{ command: 'node', args: ['server.js'] }] }));
  await fs.writeFile(path.join(root, '.kzide', 'tasks.json'), JSON.stringify({ command: 'npm', args: ['run', 'dev'] }));
  const info = await detectProject(root);
  assert.equal(info.runCommand, 'npm run dev');
  assert.equal(info.debugCommand, 'node server.js');
});

test('reports invalid package.json diagnostics', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kzide-diagnostics-'));
  await fs.writeFile(path.join(root, 'package.json'), '{ invalid');
  const result = await diagnostics(root);
  assert.ok(result.some(d => d.source === 'json' && d.severity === 'error'));
});
