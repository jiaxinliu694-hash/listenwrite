import test from 'node:test';
import assert from 'node:assert/strict';
import { stateFingerprint, hasCloudUserData } from '../src/cloudsync.js';

test('cloud state fingerprint is deterministic and changes with state', () => {
  const a = { words: [{ id: 'sample_1' }], texts: [] };
  assert.equal(stateFingerprint(a), stateFingerprint(structuredClone(a)));
  const b = structuredClone(a);
  b.texts.push({ id: 't1', body: 'hello' });
  assert.notEqual(stateFingerprint(a), stateFingerprint(b));
});

test('sample-only empty state is not treated as user data', () => {
  const state = {
    words: [{ id: 'sample_1' }], events: [], texts: [], activities: [],
    simpleWords: [], errorBooks: [], dailyPlans: {}, sentenceBooks: [],
    dataChart: { items: {}, sections: {}, attempts: [], daily: {}, session: null },
  };
  assert.equal(hasCloudUserData(state), false);
});

test('learning records are detected as cloud-worthy user data', () => {
  const base = {
    words: [{ id: 'sample_1' }], events: [], texts: [], activities: [],
    simpleWords: [], errorBooks: [], dailyPlans: {}, sentenceBooks: [],
    dataChart: { items: {}, sections: {}, attempts: [], daily: {}, session: null },
  };
  const cases = [
    { texts: [{ id: 't1' }] },
    { events: [{ id: 'e1' }] },
    { sentenceBooks: [{ entries: [{ id: 's1' }] }] },
    { words: [{ id: 'w_real' }] },
    { dataChart: { items: { x: { status: 'mastered' } }, sections: {}, attempts: [{ id: 'a1' }], daily: {}, session: null } },
  ];
  for (const patch of cases) assert.equal(hasCloudUserData({ ...structuredClone(base), ...patch }), true);
});
