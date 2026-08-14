import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard } from '../src/scheduler.js';
import { resyncRetryForWord } from '../src/queue.js';
import { typePresetIds, customTypeIdsFromEvents } from '../src/typefilters.js';

function word(id) { return { id, en: id, zh: '', sources: ['Book'], retired: false, card: emptyCard(1) }; }
function baseState(words) { return { words, events: [], settings: { retention: 0.9 } }; }

test('history edit to bad is immediately returned to retry pool', () => {
  const w = word('w1');
  const state = baseState([w]);
  state.events.push({ id: 'e1', wordId: 'w1', date: '2026-08-14', ts: 1000, mode: 'listen', result: 'bad', cold: true, attempt: 1 });
  const session = { mode: 'listen', date: '2026-08-14', retry: [], pendingBase: [], current: { wordId: 'w2' }, turn: 3 };
  resyncRetryForWord(session, state, 'w1', '2026-08-14', 'listen');
  assert.equal(session.retry.length, 1);
  assert.equal(session.retry[0].wordId, 'w1');
  assert.equal(session.retry[0].eligibleTurn, 3);
});

test('history edit back to good removes stale retry entry', () => {
  const w = word('w1');
  const state = baseState([w]);
  state.events.push({ id: 'e1', wordId: 'w1', date: '2026-08-14', ts: 1000, mode: 'listen', result: 'good', cold: true, attempt: 1 });
  const session = { mode: 'listen', date: '2026-08-14', retry: [{ wordId: 'w1', attempt: 1, eligibleTurn: 0, addedAt: 1 }], pendingBase: [], current: { wordId: 'w2' }, turn: 3 };
  resyncRetryForWord(session, state, 'w1', '2026-08-14', 'listen');
  assert.equal(session.retry.length, 0);
});

test('typing presets keep today new/review limited to words already heard', () => {
  const a = word('a'), b = word('b');
  const state = baseState([a, b]);
  state.events.push({ wordId: 'a', date: '2026-08-14', ts: 1, mode: 'listen', result: 'good', cold: true });
  const plan = { newIds: ['a', 'b'], reviewIds: [] };
  assert.deepEqual(typePresetIds(state, [a, b], 'todayNew', '2026-08-14', plan), ['a']);
});

test('custom typing filter respects date, mode and minimum failures', () => {
  const events = [
    { wordId: 'a', date: '2026-08-14', mode: 'listen', result: 'bad' },
    { wordId: 'a', date: '2026-08-14', mode: 'listen', result: 'bad' },
    { wordId: 'b', date: '2026-08-14', mode: 'type', result: 'bad' },
    { wordId: 'a', date: '2026-08-13', mode: 'listen', result: 'bad' },
  ];
  assert.deepEqual(customTypeIdsFromEvents(events, new Set(['a', 'b']), { date: '2026-08-14', mode: 'listen', min: 2 }), ['a']);
});
