import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Aurora update button checks GitHub Releases and downloads available updates', () => {
  const ui = read('src/renderer/update-button.ts');
  const updater = read('src/main/updater.ts');
  const pkg = JSON.parse(read('package.json'));
  assert.match(ui, /Buscar atualização no GitHub Releases/);
  assert.match(ui, /window\.kz\.update\.check\(\)/);
  assert.match(ui, /window\.kz\.update\.download\(\)/);
  assert.match(ui, /window\.kz\.update\.install\(\)/);
  assert.match(updater, /autoUpdater\.checkForUpdates\(\)/);
  assert.match(updater, /autoUpdater\.downloadUpdate\(\)/);
  assert.match(updater, /autoUpdater\.quitAndInstall/);
  assert.equal(pkg.build.publish[0].provider, 'github');
  assert.equal(pkg.build.publish[0].owner, 'KorcZ4k');
  assert.equal(pkg.build.publish[0].repo, 'KZ-IDE');
  assert.deepEqual(pkg.build.linux.target, ['deb']);
});
