import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('0.9 collaboration backend uses token-authenticated WebSocket sessions', () => {
  const source = read('src/main/collaboration.ts');
  assert.match(source, /WebSocketServer/);
  assert.match(source, /randomBytes/);
  assert.match(source, /Invalid collaboration token/);
  assert.match(source, /wss:\/\//);
});

test('0.9 collaboration bridge is exposed through preload and IPC', () => {
  const preload = read('src/preload/index.ts');
  const ipc = read('src/main/ipc.ts');
  for (const name of ['status','host','join','sync','chat','leave','onEvent']) assert.match(preload, new RegExp(`collab:[^}]*${name}`));
  for (const channel of ['collab:status','collab:host','collab:join','collab:sync','collab:chat','collab:leave']) assert.match(ipc, new RegExp(channel.replace(':','\\:')));
});

test('0.9 UI provides host, join, sync, chat and leave controls', () => {
  const ui = read('src/renderer/collaboration-0.9.ts');
  const css = read('src/renderer/styles-0.9.css');
  for (const term of ['Hospedar','Entrar','Sincronizar workspace','Pedir sincronização','Enviar','Encerrar sessão']) assert.match(ui, new RegExp(term));
  assert.match(css, /collab-panel/);
  assert.match(css, /collab-message/);
});

test('0.9 renderer loads the collaboration layer', () => {
  const html = read('index.html');
  assert.match(html, /styles-0\.9\.css/);
  assert.match(html, /collaboration-0\.9\.ts/);
});

test('0.9 keeps DEB packaging as the Linux target', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.9.1');
  assert.deepEqual(pkg.build.linux.target, ['deb']);
  assert.equal(pkg.build.productName, 'Aurora - Korczak IDE');
});
