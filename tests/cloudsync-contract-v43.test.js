import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('cloud reconciliation never applies a cached remote snapshot directly', () => {
  const source = fs.readFileSync(new URL('../src/cloudsync.js', import.meta.url), 'utf8');
  assert.equal(source.includes('return applyCloudState(pendingRemote, { force: true })'), false);
  assert.match(source, /if \(pendingRemote && !busyWithStudy\(\)\) \{\s*pendingRemote = null;\s*force = true;/);
  assert.match(source, /async function localStateForSync\(\) \{\s*await flushStateWrites\(\);/);
  assert.match(source, /applyCloudState\(row, \{ force = false, expectedLocalHash = null \} = \{\}\)/);
  assert.match(source, /async function commitMergedStateIfCurrent\(/);
});

test('all destructive/manual cloud actions use the same synchronization lock and latest reads', () => {
  const source = fs.readFileSync(new URL('../src/cloudsync.js', import.meta.url), 'utf8');
  assert.match(source, /async function withSyncLock\(task\)/);
  assert.match(source, /async function useLatestCloudState\(\) \{\s*return withSyncLock/);
  assert.match(source, /async function overwriteCloudWithLocalState\(\) \{\s*return withSyncLock/);
  assert.match(source, /await applySyncedState\(state\)/);
});

test('Today rendering does not unconditionally write state', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.equal(source.includes('let saveChain = Promise.resolve();'), false);
  assert.match(source, /const planBefore = JSON\.stringify\(state\.dailyPlans\[date\] \|\| null\);/);
  assert.match(source, /if \(JSON\.stringify\(plan\) !== planBefore\) persist\(\);/);
});
