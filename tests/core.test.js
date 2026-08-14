import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard, advanceCard } from '../src/scheduler.js';
import { recordAttempt, editAttempt, dayKey } from '../src/engine.js';
import { ensureDailyPlan, createRetrySession, pickNext, finishCurrent, planStatus } from '../src/queue.js';

function word(id, en = id, source = 'Book') {
  return { id, en, zh: '义', pos: '', def: '', sources: [source], examples: [], retired: false, card: emptyCard() };
}

function state(words, settings = {}) {
  return {
    version: 3,
    words,
    events: [],
    texts: [],
    dailyPlans: {},
    activities: [],
    settings: { newTarget: 2, reviewTarget: 1, retention: 0.9, speechRate: 0.92, todayBooks: [], typeBooks: [], ...settings },
  };
}

test('FSRS updates only from the cold daily signal', () => {
  const w = word('w');
  const S = state([w]);
  const first = recordAttempt(S, w, 'listen', 'bad', { ts: Date.now() });
  assert.equal(first.cold, true);
  const afterCold = JSON.stringify(w.card);
  const second = recordAttempt(S, w, 'listen', 'good', { ts: Date.now() + 1000 });
  assert.equal(second.cold, false);
  assert.equal(JSON.stringify(w.card), afterCold, 'same-day retry must not reschedule cross-day FSRS');
  assert.equal(w.card.reps, 1);
});

test('fixed new/review denominators never grow with retries', () => {
  const review = word('r', 'review');
  review.card = advanceCard(review.card, { ts: Date.now() - 86400000, result: 'good' }, 0.9);
  review.card.due = Date.now() - 1000;
  const n1 = word('n1'), n2 = word('n2');
  const S = state([review, n1, n2]);
  const plan = ensureDailyPlan(S);
  assert.equal(plan.newIds.length, 2);
  assert.equal(plan.reviewIds.length, 1);
  const session = createRetrySession(S, plan);
  assert.equal(session.fixedIds.length, 3);
  const firstId = pickNext(session);
  const w = S.words.find((x) => x.id === firstId);
  recordAttempt(S, w, 'listen', 'bad');
  finishCurrent(session, 'bad');
  assert.equal(session.fixedIds.length, 3);
  assert.equal(plan.newIds.length, 2);
  assert.equal(plan.reviewIds.length, 1);
});

test('retry reappears after other cards, not only at the end', () => {
  const words = Array.from({ length: 7 }, (_, i) => word(`w${i + 1}`));
  const S = state(words, { newTarget: 7, reviewTarget: 0 });
  const plan = ensureDailyPlan(S);
  const session = createRetrySession(S, plan);
  const firstId = pickNext(session);
  recordAttempt(S, S.words.find((w) => w.id === firstId), 'listen', 'bad');
  finishCurrent(session, 'bad');
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const id = pickNext(session); seen.push(id);
    recordAttempt(S, S.words.find((w) => w.id === id), 'listen', 'good');
    finishCurrent(session, 'good');
  }
  assert.equal(pickNext(session), firstId, 'failed word should return after four intervening cards');
});

test('hand-writing does not complete Today listening task', () => {
  const w = word('w');
  const S = state([w], { newTarget: 1, reviewTarget: 0 });
  const plan = ensureDailyPlan(S);
  recordAttempt(S, w, 'type', 'good');
  const status = planStatus(S, plan);
  assert.equal(status.new.done, 0);
  assert.equal(status.new.pending, 1);
  assert.equal(w.card.reps, 1, 'first cold event in either mode still updates shared memory state');
});

test('editing the cold judgment rebuilds the FSRS card', () => {
  const w = word('w');
  const S = state([w]);
  const ev = recordAttempt(S, w, 'listen', 'bad');
  const badDue = w.card.due;
  editAttempt(S, ev.id, 'good');
  assert.equal(S.events[0].result, 'good');
  assert.notEqual(w.card.due, badDue);
});

test('one date has exactly one Today plan even if book scope changes', () => {
  const S = state([word('a', 'a', 'A'), word('b', 'b', 'B')], { newTarget: 1, reviewTarget: 0 });
  const p1 = ensureDailyPlan(S, { books: ['A'] });
  const p2 = ensureDailyPlan(S, { books: ['B'] });
  assert.equal(p1, p2);
  assert.equal(Object.keys(S.dailyPlans).length, 1);
  assert.equal(Object.keys(S.dailyPlans)[0], dayKey());
});
