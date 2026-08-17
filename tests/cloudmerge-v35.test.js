import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCloudStates } from '../src/cloudmerge.js';

test('three-way merge keeps independent learning events from both devices', () => {
  const base = { events: [{ id: 'e1', result: 'good' }], settings: { speechRate: .9, retention: .9 } };
  const local = structuredClone(base);
  local.events.push({ id: 'e2', result: 'bad' });
  local.settings.speechRate = .85;
  const cloud = structuredClone(base);
  cloud.events.push({ id: 'e3', result: 'good' });
  cloud.settings.retention = .92;

  const merged = mergeCloudStates(base, local, cloud);
  assert.deepEqual(merged.state.events.map(e => e.id).sort(), ['e1', 'e2', 'e3']);
  assert.equal(merged.state.settings.speechRate, .85);
  assert.equal(merged.state.settings.retention, .92);
  assert.deepEqual(merged.conflicts, []);
});

test('same scalar edited differently is reported instead of silently pretending it is safe', () => {
  const base = { settings: { speechRate: .9 } };
  const local = { settings: { speechRate: .8 } };
  const cloud = { settings: { speechRate: 1.0 } };
  const merged = mergeCloudStates(base, local, cloud);
  assert.equal(merged.state.settings.speechRate, .8);
  assert.ok(merged.conflicts.includes('settings.speechRate'));
});

test('simple-word set merges independent changes', () => {
  const base = { simpleWords: ['a'] };
  const local = { simpleWords: ['a', 'b'] };
  const cloud = { simpleWords: ['a', 'c'] };
  const merged = mergeCloudStates(base, local, cloud);
  assert.deepEqual(new Set(merged.state.simpleWords), new Set(['a', 'b', 'c']));
  assert.deepEqual(merged.conflicts, []);
});
