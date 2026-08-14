import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyPlan } from '../src/queue.js';

function makeState() {
  return {
    words: [
      { id: 'z', en: 'zebra', retired: false, sources: ['Freq'] },
      { id: 'm', en: 'middle', retired: false, sources: ['Freq'] },
      { id: 'a', en: 'apple', retired: false, sources: ['Freq'] },
    ],
    events: [],
    dailyPlans: {},
    settings: {
      defaultNewTarget: 2,
      defaultReviewTarget: 0,
      retention: 0.9,
      todayBooks: ['Freq'],
      todayPlanMode: 'mixed',
    },
  };
}

test('new words follow source/import order instead of alphabetic order', () => {
  const state = makeState();
  const plan = ensureDailyPlan(state, { date: '2026-08-14', books: ['Freq'] });
  assert.deepEqual(plan.newIds, ['z', 'm']);
});

test('an existing untouched alphabetized plan is restored to source order', () => {
  const state = makeState();
  state.dailyPlans['2026-08-14'] = {
    date: '2026-08-14', mode: 'mixed', books: ['Freq'],
    newTarget: 3, reviewTarget: 0,
    newIds: ['a', 'm', 'z'], reviewIds: [], bookSegments: [],
    resumeWordId: null, createdAt: 1, updatedAt: 1,
  };
  const plan = ensureDailyPlan(state, { date: '2026-08-14', books: ['Freq'] });
  assert.deepEqual(plan.newIds, ['z', 'm', 'a']);
});

test('already-listened new words stay fixed while untouched words return to source order', () => {
  const state = makeState();
  state.events.push({ id: 'e1', wordId: 'a', date: '2026-08-14', ts: 1, mode: 'listen', result: 'good', cold: true, attempt: 1 });
  state.dailyPlans['2026-08-14'] = {
    date: '2026-08-14', mode: 'mixed', books: ['Freq'],
    newTarget: 3, reviewTarget: 0,
    newIds: ['a', 'm', 'z'], reviewIds: [], bookSegments: [],
    resumeWordId: null, createdAt: 1, updatedAt: 1,
  };
  const plan = ensureDailyPlan(state, { date: '2026-08-14', books: ['Freq'] });
  assert.deepEqual(plan.newIds, ['a', 'z', 'm']);
});
