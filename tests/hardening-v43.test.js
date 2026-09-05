import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCloudStates } from '../src/cloudmerge.js';
import { canonicalizeCloudState, defaultState } from '../src/storage.js';
import { rebuildCard } from '../src/scheduler.js';
import {
  configureSequentialPlan,
  currentSequentialSegment,
  ensureDailyPlan,
} from '../src/queue.js';
import { deleteWordEverywhere, deleteWordbook } from '../src/wordadmin.js';
import { numericCanonicals, spellingMatches, tokenizeEnglish } from '../src/tokenizer.js';

function word(id, source = 'A') {
  return {
    id,
    en: id,
    zh: '',
    pos: '',
    def: '',
    sources: [source],
    examples: [],
    retired: false,
    card: null,
  };
}
function event(id, wordId, date, result = 'good', offset = 0) {
  return {
    id,
    wordId,
    date,
    ts: Date.parse(`${date}T08:00:00Z`) + offset,
    mode: 'listen',
    result,
    originalResult: result,
    cold: true,
    attempt: 1,
    source: null,
    sentence: null,
    editedAt: null,
  };
}

test('cloud merge treats event indexes and FSRS cards as derived, then rebuilds from the complete history', () => {
  const base = defaultState();
  base.words = [word('storm')];
  base.events = [event('e1', 'storm', '2026-08-20', 'good')];
  const canonicalBase = canonicalizeCloudState(base);

  const local = structuredClone(canonicalBase);
  local.events.push(event('e2', 'storm', '2026-08-21', 'bad'));
  local.words[0].card.reps = 99;

  const cloud = structuredClone(canonicalBase);
  cloud.events.push(event('e3', 'storm', '2026-08-22', 'good'));
  cloud.words[0].card.reps = 77;

  const merged = mergeCloudStates(canonicalBase, local, cloud);
  assert.deepEqual(merged.state.events.map((item) => item.id).sort(), ['e1', 'e2', 'e3']);
  assert.equal(merged.conflicts.some((path) => /\.card(?:\.|$)|\.(?:cold|attempt)$/.test(path)), false);

  const canonical = canonicalizeCloudState(merged.state);
  assert.equal(canonical.words[0].card.reps, 3);
  assert.deepEqual(
    canonical.words[0].card,
    rebuildCard(canonical.events, canonical.settings.retention),
  );
});

test('same-day events from two devices are reindexed to one cold signal and ordered attempts', () => {
  const base = defaultState();
  base.words = [word('stone')];
  const local = structuredClone(base);
  local.events = [event('left', 'stone', '2026-08-23', 'bad')];
  const cloud = structuredClone(base);
  cloud.events = [event('right', 'stone', '2026-08-23', 'good', 1_000)];

  const canonical = canonicalizeCloudState(mergeCloudStates(base, local, cloud).state);
  assert.equal(canonical.events.filter((item) => item.cold).length, 1);
  assert.deepEqual(canonical.events.map((item) => item.attempt), [1, 2]);
  assert.equal(canonical.words[0].card.reps, 1);
});

test('fresh cards canonicalize to a deterministic eventless baseline', () => {
  const left = defaultState();
  left.words = [word('fresh')];
  const right = structuredClone(left);
  const a = canonicalizeCloudState(left);
  const b = canonicalizeCloudState(right);
  assert.deepEqual(a.words[0].card, b.words[0].card);
  assert.equal(a.words[0].card.reps, 0);
  assert.equal(a.words[0].card.due, 0);
});

test('sequential scope changes retain every word already formally heard today', () => {
  const state = defaultState();
  state.settings.todayPlanMode = 'sequential';
  state.words = [word('a1', 'A'), word('b1', 'B')];
  const date = '2026-08-24';
  const plan = ensureDailyPlan(state, { date });
  configureSequentialPlan(state, plan, [{ book: 'A', newTarget: 1, reviewTarget: 0 }]);
  assert.deepEqual(plan.bookSegments[0].newIds, ['a1']);

  state.events.push(event('a1-bad', 'a1', date, 'bad'));
  configureSequentialPlan(state, plan, [{ book: 'B', newTarget: 1, reviewTarget: 0 }]);

  assert.deepEqual(plan.carryNewIds, ['a1']);
  assert.ok(plan.newIds.includes('a1'));
  assert.ok(plan.newIds.includes('b1'));
  assert.equal(currentSequentialSegment(state, plan)?.id, '__carry__');

  plan.updatedAt = 123;
  configureSequentialPlan(state, plan, [{ book: 'B', newTarget: 1, reviewTarget: 0 }]);
  assert.equal(plan.updatedAt, 123, 'an identical render/configuration must not create a synthetic edit');
});

test('mixed plan regeneration leaves updatedAt unchanged when content is unchanged', () => {
  const state = defaultState();
  state.settings.defaultNewTarget = 1;
  state.settings.defaultReviewTarget = 0;
  state.words = [word('fan')];
  const plan = ensureDailyPlan(state, { date: '2026-08-24', books: ['A'] });
  plan.updatedAt = 456;
  ensureDailyPlan(state, { date: '2026-08-24', books: ['A'] });
  assert.equal(plan.updatedAt, 456);
});

test('deleting a word normalizes simple-word identity', () => {
  const state = defaultState();
  state.words = [word('fan')];
  state.simpleWords = ['FAN'];
  assert.equal(deleteWordEverywhere(state, 'fan'), true);
  assert.deepEqual(state.simpleWords, []);
});

test('deleting a sequential wordbook moves started work into carry lists', () => {
  const state = defaultState();
  state.words = [word('a1', 'A'), word('b1', 'B')];
  const date = '2026-08-24';
  state.events = [event('a1-start', 'a1', date, 'bad')];
  state.dailyPlans[date] = {
    date,
    mode: 'sequential',
    books: ['A', 'B'],
    newTarget: 2,
    reviewTarget: 0,
    newIds: ['a1', 'b1'],
    reviewIds: [],
    carryNewIds: [],
    carryReviewIds: [],
    bookSegments: [
      { id: 'sa', book: 'A', newTarget: 1, reviewTarget: 0, newIds: ['a1'], reviewIds: [] },
      { id: 'sb', book: 'B', newTarget: 1, reviewTarget: 0, newIds: ['b1'], reviewIds: [] },
    ],
    resumeWordId: 'a1',
    drawNonce: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  deleteWordbook(state, 'A');
  const plan = state.dailyPlans[date];
  assert.deepEqual(plan.carryNewIds, ['a1']);
  assert.ok(plan.newIds.includes('a1'));
  assert.equal(plan.resumeWordId, 'a1');
});

test('numeric tokenizer keeps grouped values intact and accepts common IELTS forms', () => {
  assert.deepEqual(
    tokenizeEnglish('It cost $1,250.50 and reached 1,500,000 users.'),
    ['It', 'cost', '$1,250.50', 'and', 'reached', '1,500,000', 'users'],
  );
  assert.equal(spellingMatches('two million', '2,000,000'), true);
  assert.equal(spellingMatches('one hundred and fifty thousand', '150,000'), true);
  assert.equal(spellingMatches('twenty-first', '21st'), true);
  assert.equal(spellingMatches('9.30', '9:30'), true);
  assert.equal(spellingMatches('€1,250.50', '1250.5 euros'), true);
  assert.equal(spellingMatches('nine thirty', '39'), false);
  assert.equal(spellingMatches('twenty one', '20:01'), false);
  assert.ok(numericCanonicals('9.30').includes('time:9:30'));
});
