import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInside } from '../dist/main/path-security.js';

test('accepts paths inside workspace', () => {
  assert.equal(resolveInside('/workspace', '/workspace/src/app.ts'), '/workspace/src/app.ts');
});

test('accepts workspace root', () => {
  assert.equal(resolveInside('/workspace', '/workspace'), '/workspace');
});

test('rejects traversal outside workspace', () => {
  assert.throws(() => resolveInside('/workspace', '/workspace/../secret.txt'), /fora do workspace/);
});

test('rejects unrelated absolute paths', () => {
  assert.throws(() => resolveInside('/workspace', '/tmp/secret.txt'), /fora do workspace/);
});
