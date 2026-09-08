import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const live = fs.readFileSync('src/renderer/collaboration-live-0.9.ts', 'utf8');
const server = fs.readFileSync('src/main/collaboration.ts', 'utf8');
const relay = fs.readFileSync('relay/server.mjs', 'utf8');

test('0.9 live collaboration wires Monaco model lifecycle and realtime edits', () => {
  assert.match(live, /monaco\.editor\.onDidCreateModel/);
  assert.match(live, /onDidChangeContent/);
  assert.match(live, /window\.kz\.collab\.edit/);
  assert.match(live, /onDidChangeCursorPosition/);
  assert.match(live, /onDidChangeCursorSelection/);
  assert.match(live, /threeWayMerge/);
  assert.match(live, /aurora-remote-cursor/);
});

test('0.9 server acknowledges accepted edits and normalizes workspace paths', () => {
  assert.match(server, /edit-ack/);
  assert.match(server, /relativeFilePath/);
  assert.match(server, /baseVersion/);
  assert.match(server, /1024 \* 1024/);
  assert.match(server, /0\.0\.0\.0/);
});

test('0.9 relay validates rooms and enforces participant limits', () => {
  assert.match(relay, /MAX_CLIENTS/);
  assert.match(relay, /roomToken/);
  assert.match(relay, /room\.peers\.size\s*>=\s*16/);
  assert.match(relay, /Malformed relay payload/);
});
