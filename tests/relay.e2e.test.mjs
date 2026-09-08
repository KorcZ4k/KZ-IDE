import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { WebSocket } from 'ws';

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(() => resolve(port));
  });
});

const open = (url) => new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  const timer = setTimeout(() => { ws.terminate(); reject(new Error('WebSocket open timeout')); }, 5000);
  ws.once('open', () => { clearTimeout(timer); resolve(ws); });
  ws.once('error', error => { clearTimeout(timer); reject(error); });
});
const nextMessage = (ws, predicate = () => true, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { ws.off('message', onMessage); reject(new Error('WebSocket message timeout')); }, timeout);
  const onMessage = raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (!predicate(message)) return;
    clearTimeout(timer); ws.off('message', onMessage); resolve(message);
  };
  ws.on('message', onMessage);
});

const close = ws => { if (ws && ws.readyState < WebSocket.CLOSING) ws.close(); };

test('0.9 relay E2E: authentication, presence, roles and viewer write protection', { timeout: 15000 }, async () => {
  const port = await freePort();
  const relay = spawn(process.execPath, ['relay/server.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), MAX_CLIENTS: '4', MAX_MESSAGES_PER_SECOND: '20' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Relay startup timeout')), 5000);
      const onData = chunk => { if (chunk.toString().includes('Aurora collaboration relay listening')) { clearTimeout(timer); relay.stdout.off('data', onData); resolve(); } };
      relay.stdout.on('data', onData);
      relay.once('exit', code => { clearTimeout(timer); reject(new Error(`Relay exited early: ${code}`)); });
    });
    const room = `e2e_${Date.now().toString(36)}`;
    const token = `token_${Date.now().toString(36)}`;
    const base = `ws://127.0.0.1:${port}?room=${room}&token=${token}`;
    const owner = await open(`${base}&name=Owner`);
    const ownerHello = await nextMessage(owner, message => message.type === 'hello');
    assert.equal(ownerHello.role, 'owner');
    const editor = await open(`${base}&name=Editor`);
    const editorHello = await nextMessage(editor, message => message.type === 'hello');
    assert.equal(editorHello.role, 'editor');
    await nextMessage(owner, message => message.type === 'presence' && Array.isArray(message.payload) && message.payload.length === 2);

    owner.send(JSON.stringify({ type: 'role', peerId: editorHello.clientId, role: 'viewer' }));
    const role = await nextMessage(editor, message => message.type === 'role');
    assert.equal(role.role, 'viewer');
    await nextMessage(owner, message => message.type === 'presence' && message.payload.some(peer => peer.id === editorHello.clientId && peer.role === 'viewer'));

    let unexpectedEdit = false;
    const onOwnerMessage = raw => { try { const message = JSON.parse(raw.toString()); if (message.type === 'edit') unexpectedEdit = true; } catch {} };
    owner.on('message', onOwnerMessage);
    editor.send(JSON.stringify({ type: 'edit', path: 'README.md', content: 'viewer must not write', baseVersion: 0 }));
    await new Promise(resolve => setTimeout(resolve, 250));
    owner.off('message', onOwnerMessage);
    assert.equal(unexpectedEdit, false);

    editor.close();
    await nextMessage(owner, message => message.type === 'presence' && !message.payload.some(peer => peer.id === editorHello.clientId));
    close(owner);
  } finally {
    relay.kill('SIGTERM');
    await new Promise(resolve => relay.once('exit', resolve));
  }
});

test('0.9 relay E2E: invalid token is rejected', { timeout: 10000 }, async () => {
  const port = await freePort();
  const relay = spawn(process.execPath, ['relay/server.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Relay startup timeout')), 5000);
      const onData = chunk => { if (chunk.toString().includes('Aurora collaboration relay listening')) { clearTimeout(timer); relay.stdout.off('data', onData); resolve(); } };
      relay.stdout.on('data', onData);
      relay.once('exit', code => { clearTimeout(timer); reject(new Error(`Relay exited early: ${code}`)); });
    });
    const room = `auth_${Date.now().toString(36)}`;
    const valid = await open(`ws://127.0.0.1:${port}?room=${room}&token=valid_${Date.now().toString(36)}`);
    close(valid);
    const invalid = new WebSocket(`ws://127.0.0.1:${port}?room=${room}&token=wrong_${Date.now().toString(36)}`);
    const code = await new Promise(resolve => { invalid.once('close', closeCode => resolve(closeCode)); invalid.once('error', () => {}); });
    assert.equal(code, 1008);
  } finally {
    relay.kill('SIGTERM');
    await new Promise(resolve => relay.once('exit', resolve));
  }
});
