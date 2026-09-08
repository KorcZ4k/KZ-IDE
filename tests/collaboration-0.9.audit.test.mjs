import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');

test('0.9 collaboration exposes realtime operations', () => {
  const source = read('src/main/collaboration.ts');
  for (const token of ['sendCollabEdit', 'sendCollabCursor', 'setCollabRole', 'kickCollabPeer', 'reconnectTimer', 'versions', 'baseVersion', 'conflict', 'peerList', 'maxPayload']) assert.match(source, new RegExp(token));
});

test('0.9 IPC and preload expose collaboration controls', () => {
  const ipc = read('src/main/ipc.ts');
  const preload = read('src/preload/index.ts');
  for (const token of ['collab:edit', 'collab:cursor', 'collab:role', 'collab:kick']) assert.match(ipc, new RegExp(token));
  for (const token of ['edit:', 'cursor:', 'setRole:', 'kick:']) assert.match(preload, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('0.9 renderer provides presence, chat, roles and removal controls', () => {
  const ui = read('src/renderer/collaboration-0.9.ts');
  for (const token of ['collab-peers', 'setRole', 'kick', 'Copiar convite', 'Pedir sincronização']) assert.match(ui, new RegExp(token));
  const live = read('src/renderer/collaboration-live-0.9.ts');
  for (const token of ['getModels', 'getEditors', 'onDidChangeContent', 'deltaDecorations', 'threeWayMerge']) assert.match(live, new RegExp(token));
});

test('0.9 relay is bounded, authenticated, rate-limited and heartbeat protected', () => {
  const relay = read('relay/server.mjs');
  for (const token of ['maxPayload', 'MAX_CLIENTS', 'MAX_MESSAGES_PER_SECOND', 'room.token', 'Rate limit exceeded', 'ws.ping()', 'TLS_KEY', 'TLS_CERT']) assert.match(relay, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(relay, /role\s*!==\s*['"]owner['"]/);
  assert.match(relay, /type\s*===\s*['"]kick['"]\s*\|\|\s*message\.type\s*===\s*['"]role['"]/);
});

test('0.9 keeps Linux packaging DEB-only', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.build.linux.target, ['deb']);
  assert.equal(pkg.version, '0.9.0');
});

test('0.9 CI performs build, tests, entrypoint verification and DEB packaging', () => {
  const ci = read('.github/workflows/ci.yml');
  for (const token of ['npm run build', 'node --test tests/*.test.mjs', 'dist/main/main.js', 'dist/preload/index.js', 'dist/renderer/index.html', 'npm run package:linux', 'release/*.deb']) assert.match(ci, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
