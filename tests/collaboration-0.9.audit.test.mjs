import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');

test('0.9 collaboration exposes realtime operations', () => {
  const source = read('src/main/collaboration.ts');
  for (const token of ['sendCollabEdit', 'sendCollabCursor', 'setCollabRole', 'kickCollabPeer', 'reconnectTimer', 'versions', 'baseVersion', 'conflict', 'peerList']) assert.match(source, new RegExp(token));
});

test('0.9 IPC and preload expose collaboration controls', () => {
  const ipc = read('src/main/ipc.ts');
  const preload = read('src/preload/index.ts');
  for (const token of ['collab:edit', 'collab:cursor', 'collab:role', 'collab:kick']) assert.match(ipc, new RegExp(token));
  for (const token of ['edit:', 'cursor:', 'setRole:', 'kick:']) assert.match(preload, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('standalone relay is bounded and permission-aware', () => {
  const relay = read('relay/server.mjs');
  assert.match(relay, /maxPayload/);
  assert.match(relay, /MAX_CLIENTS/);
  assert.match(relay, /room\.token/);
  assert.match(relay, /peer\.role !== 'owner'/);
  assert.match(relay, /type === 'kick' \|\| message\.type === 'role'/);
});

test('0.9 keeps Linux packaging DEB-only', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.build.linux.target, ['deb']);
  assert.equal(pkg.version, '0.9.0');
});
