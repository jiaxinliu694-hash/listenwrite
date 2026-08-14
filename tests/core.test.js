import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard, advanceCard } from '../src/scheduler.js';
import { recordAttempt, editAttempt, dayKey } from '../src/engine.js';
import { ensureDailyPlan, createRetrySession, pickNext, finishCurrent, planStatus } from '../src/queue.js';

function word(id, en = id, source = 'Book') {
  return { id, en, zh: '义', pos: '', def: '', sources: [source], examples: [], retired: false, card: emptyCard() };
}
function state(words, settings = {}) {
  return { version: 10, words, events: [], texts: [], dailyPlans: {}, activities: [], settings: { defaultNewTarget: 2, defaultReviewTarget: 1, retention: 0.9, speechRate: 0.92, todayBooks: [], typeBooks: [], ...settings } };
}
function dateOffset(n) { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d.getTime()); }

test('FSRS updates only from the first cold listening signal', () => {
  const w = word('w'); const S = state([w]);
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
  const oldTs = Date.now() - 86400000;
  review.card = advanceCard(review.card, { ts: oldTs, result: 'good' }, 0.9);
  review.card.due = Date.now() - 1000;
  const n1 = word('n1'), n2 = word('n2');
  const S = state([review, n1, n2]);
  S.events.push({ id: 'old-r', wordId: 'r', date: dateOffset(-1), ts: oldTs, mode: 'listen', result: 'good', originalResult: 'good', cold: true, attempt: 1 });
  const plan = ensureDailyPlan(S);
  assert.equal(plan.newIds.length, 2);
  assert.equal(plan.reviewIds.length, 1);
  const session = createRetrySession(S, plan);
  assert.equal(session.fixedIds.length, 3);
  const firstId = pickNext(session);
  assert.equal(firstId, 'r');
  recordAttempt(S, review, 'listen', 'bad');
  finishCurrent(session, 'bad');
  assert.equal(session.fixedIds.length, 3);
  assert.equal(plan.newIds.length, 2);
  assert.equal(plan.reviewIds.length, 1);
});

function wordBy(S,id){return S.words.find(w=>w.id===id);}

test('hand-writing does not complete Today listening task or schedule an unseen word', () => {
  const w = word('w'); const S = state([w], { defaultNewTarget: 1, defaultReviewTarget: 0 }); const plan = ensureDailyPlan(S);
  const ev = recordAttempt(S, w, 'type', 'good'); const status = planStatus(S, plan);
  assert.equal(status.new.done, 0); assert.equal(status.new.pending, 1);
  assert.equal(ev.cold, false, 'typing is reinforcement, not the daily scheduling signal');
  assert.equal(w.card.reps, 0, 'typing alone must not turn an unseen word into a review card');
});

test('typing before listening does not steal the cold listening signal', () => {
  const w = word('w'); const S = state([w]);
  recordAttempt(S, w, 'type', 'bad');
  const listen = recordAttempt(S, w, 'listen', 'good', { ts: Date.now() + 1000 });
  assert.equal(listen.cold, true);
  assert.equal(w.card.reps, 1);
});

test('editing the cold judgment rebuilds the FSRS card', () => {
  const w = word('w'); const S = state([w]); const ev = recordAttempt(S, w, 'listen', 'bad'); const badDue = w.card.due;
  editAttempt(S, ev.id, 'good'); assert.equal(S.events[0].result, 'good'); assert.notEqual(w.card.due, badDue);
});

test('one date has exactly one Today plan even if book scope changes', () => {
  const S = state([word('a', 'a', 'A'), word('b', 'b', 'B')], { defaultNewTarget: 1, defaultReviewTarget: 0 });
  const p1 = ensureDailyPlan(S, { books: ['A'] }); const p2 = ensureDailyPlan(S, { books: ['B'] });
  assert.equal(p1, p2); assert.equal(Object.keys(S.dailyPlans).length, 1); assert.equal(Object.keys(S.dailyPlans)[0], dayKey());
  assert.equal(p2.newIds.length, 1); assert.equal(wordBy(S,p2.newIds[0]).sources[0], 'B', 'unattempted assignment should follow the newly selected wordbook');
});
