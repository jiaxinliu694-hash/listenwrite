import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, exportState } from '../src/storage.js';
import { rebuildCard } from '../src/scheduler.js';

const DAY = 86400000;
const T0 = Date.UTC(2026, 7, 1, 4, 0, 0);

function legacyState() {
  return {
    version: 9,
    words: [{ id: 'w1', en: 'rural', zh: '农村的', sources: ['Book'], examples: [], retired: false, card: null }],
    events: [
      { id: 't1', wordId: 'w1', date: '2026-08-01', ts: T0 - 1000, mode: 'type', result: 'bad', cold: true, attempt: 1 },
      { id: 'l1', wordId: 'w1', date: '2026-08-01', ts: T0, mode: 'listen', result: 'good', cold: false, attempt: 1 },
      { id: 'l2', wordId: 'w1', date: '2026-08-02', ts: T0 + DAY, mode: 'listen', result: 'bad', cold: true, attempt: 1 },
      { id: 'l3', wordId: 'w1', date: '2026-08-02', ts: T0 + DAY + 1000, mode: 'listen', result: 'good', cold: false, attempt: 2 },
    ],
    texts: [], sentenceBooks: [], simpleWords: [], errorBooks: [], dailyPlans: {}, activities: [],
    settings: { defaultNewTarget: 30, defaultReviewTarget: 80, retention: 0.9, speechRate: 0.92, todayBooks: [], typeBooks: [], todayPlanMode: 'mixed' },
  };
}

test('v9 migration reindexes cold signals to first listening attempt only', () => {
  const state = normalizeState(legacyState());
  assert.equal(state.version, 10);
  assert.equal(state.events.find((e) => e.id === 't1').cold, false);
  assert.equal(state.events.find((e) => e.id === 'l1').cold, true);
  assert.equal(state.events.find((e) => e.id === 'l2').cold, true);
  assert.equal(state.events.find((e) => e.id === 'l3').cold, false);
  assert.equal(state.words[0].card.reps, 2);
});

test('same listening history rebuilds to exactly the same FSRS card', () => {
  const a = normalizeState(legacyState());
  const b = normalizeState(legacyState());
  assert.deepEqual(b.words[0].card, a.words[0].card);

  const cold = a.events.filter((e) => e.cold);
  assert.deepEqual(rebuildCard(cold, a.settings.retention), a.words[0].card);
});

test('v10 export-normalize is idempotent and preserves persisted card', () => {
  const first = normalizeState(legacyState());
  const exported = exportState(first);
  const second = normalizeState(JSON.parse(exported));
  assert.deepEqual(second.words[0].card, first.words[0].card);
  assert.deepEqual(second.events, first.events);
  assert.equal(exportState(second), exportState(first));
});

test('typing-only history does not create a scheduled review card', () => {
  const raw = legacyState();
  raw.events = raw.events.filter((e) => e.mode === 'type');
  const state = normalizeState(raw);
  assert.equal(state.events[0].cold, false);
  assert.equal(state.words[0].card.reps, 0);
});
