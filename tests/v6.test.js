import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard } from '../src/scheduler.js';
import { recordAttempt } from '../src/engine.js';
import { ensureDailyPlan, configureSequentialPlan, currentSequentialSegment, createRetrySession, pickNext } from '../src/queue.js';
import { addSentenceEntry, recordSentenceToken, sentenceProblemTokens, problemTokensToTSV } from '../src/sentencebooks.js';

function word(id, sources) {
  return { id, en: id, zh: '', pos: '', def: '', sources, examples: [], retired: false, card: emptyCard() };
}
function state(words) {
  return {
    version: 6,
    words,
    events: [], texts: [], sentenceBooks: [], dailyPlans: {}, activities: [],
    settings: { defaultNewTarget: 30, defaultReviewTarget: 80, retention: .9, speechRate: .92, todayBooks: [], typeBooks: [], todayPlanMode: 'mixed' },
  };
}

test('sentence dictation persists status and exports only problem words', () => {
  const S = state([]);
  const { entry } = addSentenceEntry(S, { bookName: '剑18句子', text: 'Rural areas decline.', tokens: ['Rural', 'areas', 'decline'] });
  recordSentenceToken(entry, 0, { input: 'rural', spellingResult: 'good', status: 'familiar' });
  recordSentenceToken(entry, 1, { input: 'area', spellingResult: 'bad', status: 'unfamiliar' });
  recordSentenceToken(entry, 2, { input: '', spellingResult: 'bad', status: 'unknown' });
  const bad = sentenceProblemTokens(entry);
  assert.deepEqual(bad.map(x => x.normalized), ['areas', 'decline']);
  const tsv = problemTokensToTSV(bad, { source: '句子错题本', sentence: entry.text });
  assert.match(tsv, /areas\t\t\t\t句子错题本\tRural areas decline\./);
  assert.match(tsv, /decline\t\t\t\t句子错题本\tRural areas decline\./);
});

test('sequential book quotas are independent and duplicate words count only once', () => {
  const S = state([
    word('a1', ['A']), word('a2', ['A']), word('shared', ['A', 'B']),
    word('b1', ['B']), word('b2', ['B']), word('c1', ['C']), word('c2', ['C']),
  ]);
  const plan = ensureDailyPlan(S, { books: ['A', 'B', 'C'] });
  configureSequentialPlan(S, plan, [
    { book: 'A', newTarget: 3, reviewTarget: 0 },
    { book: 'B', newTarget: 2, reviewTarget: 0 },
    { book: 'C', newTarget: 2, reviewTarget: 0 },
  ]);
  assert.equal(plan.mode, 'sequential');
  assert.equal(plan.bookSegments[0].newIds.length, 3);
  assert.equal(plan.bookSegments[1].newIds.includes('shared'), false, 'shared word belongs to the first eligible segment only');
  assert.equal(new Set(plan.newIds).size, plan.newIds.length);
  assert.equal(plan.newTarget, 7);
});

test('sequential learning advances to the next unfinished book', () => {
  const S = state([word('a1', ['A']), word('b1', ['B'])]);
  const plan = ensureDailyPlan(S, { books: ['A', 'B'] });
  configureSequentialPlan(S, plan, [
    { book: 'A', newTarget: 1, reviewTarget: 0 },
    { book: 'B', newTarget: 1, reviewTarget: 0 },
  ]);
  assert.equal(currentSequentialSegment(S, plan).book, 'A');
  recordAttempt(S, S.words.find(w => w.id === plan.bookSegments[0].newIds[0]), 'listen', 'good', { date: plan.date });
  assert.equal(currentSequentialSegment(S, plan).book, 'B');
});

test('resume hint prioritizes the last unjudged word but not over a due retry', () => {
  const S = state([word('a', ['A']), word('b', ['A']), word('c', ['A'])]);
  const plan = ensureDailyPlan(S, { books: ['A'], newTarget: 3, reviewTarget: 0 });
  plan.resumeWordId = plan.newIds[2];
  let session = createRetrySession(S, plan, 'listen');
  assert.equal(pickNext(session), plan.resumeWordId);

  const retryWord = S.words.find(w => w.id === plan.newIds[0]);
  recordAttempt(S, retryWord, 'listen', 'bad', { date: plan.date });
  session = createRetrySession(S, plan, 'listen');
  assert.equal(pickNext(session), retryWord.id, 'due retry remains higher priority than resume hint');
});
