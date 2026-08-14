import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const replaceOnce = (src, from, to, label) => {
  if (!src.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return src.replace(from, to);
};

write('src/studyidentity.js', `import { eventsOnDay, hasEventBefore } from './engine.js';
import { reinforcementState } from './reinforcement.js';

export function isReviewHinted(word) {
  return Boolean(word?.reviewHint) || (word?.sources || []).some((source) => /错题|错词|error/i.test(source));
}

export function wordStudyKind(state, wordOrId, date) {
  const word = typeof wordOrId === 'string'
    ? state.words.find((w) => w.id === wordOrId)
    : wordOrId;
  if (!word) return 'new';
  return hasEventBefore(state, word.id, date) || isReviewHinted(word) ? 'review' : 'new';
}

export function wordPassedOnDay(state, wordOrId, date) {
  const wordId = typeof wordOrId === 'string' ? wordOrId : wordOrId?.id;
  if (!wordId) return false;
  return reinforcementState(eventsOnDay(state, wordId, date, 'listen')).passed;
}
`);

let q = read('src/queue.js');
q = replaceOnce(q,
  "import { reinforcementState, reinforcementDelayMs } from './reinforcement.js';\n",
  "import { reinforcementState, reinforcementDelayMs } from './reinforcement.js';\nimport { isReviewHinted, wordPassedOnDay, wordStudyKind } from './studyidentity.js';\n",
  'queue identity import');
q = replaceOnce(q,
`function reviewHinted(word) {
  return Boolean(word?.reviewHint) || (word?.sources || []).some((source) => /错题|错词|error/i.test(source));
}

function reviewKnown(state, word, date) {
  return Boolean(word) && (hasEventBefore(state, word.id, date) || reviewHinted(word));
}
`,
`function reviewHinted(word) {
  return isReviewHinted(word);
}

function reviewKnown(state, word, date) {
  return Boolean(word) && wordStudyKind(state, word, date) === 'review';
}
`, 'queue review identity');
q = replaceOnce(q,
  ".filter((w) => !assigned.has(w.id) && reviewKnown(state, w, date))",
  ".filter((w) => !assigned.has(w.id) && !wordPassedOnDay(state, w.id, date) && reviewKnown(state, w, date))",
  'review candidates passed guard');
q = replaceOnce(q,
  ".filter((w) => !assigned.has(w.id) && !reviewKnown(state, w, date))",
  ".filter((w) => !assigned.has(w.id) && !wordPassedOnDay(state, w.id, date) && !reviewKnown(state, w, date))",
  'fresh candidates passed guard');
q = replaceOnce(q,
`function seedTodayFromListenHistory(state, plan) {
  if (plan.mode === 'sequential') return;
  const seen = new Set([...plan.newIds, ...plan.reviewIds]);
  const listenedIds = [...new Set(state.events.filter((e) => e.date === plan.date && e.mode === 'listen').map((e) => e.wordId))];
  for (const id of listenedIds) {
    if (seen.has(id)) continue;
    const word = state.words.find((w) => w.id === id);
    if (!word || !matchesBooks(word, plan.books)) continue;
    if (reviewKnown(state, word, plan.date)) plan.reviewIds.push(id);
    else plan.newIds.push(id);
    seen.add(id);
  }
}

function moveHintedNewWordsToReview(state, plan) {
  const moved = [];
  plan.newIds = plan.newIds.filter((id) => {
    const word = state.words.find((w) => w.id === id);
    if (!word || !reviewHinted(word)) return true;
    moved.push(id);
    return false;
  });
  for (const id of moved) if (!plan.reviewIds.includes(id)) plan.reviewIds.push(id);
  if (moved.length) plan.reviewTarget = Math.max(Number(plan.reviewTarget) || 0, plan.reviewIds.length);
}

function reconcileScope(state, plan, books) {
  if (sameBooks(plan.books, books)) return;
  const previousBooks = [...(plan.books || [])];
  // Changing today's book scope redraws untouched tasks. Events/history stay intact.
  // Touched words survive only when they belong to the newly selected scope.
  const keepTouchedInScope = (id) => {
    const word = state.words.find((w) => w.id === id);
    return Boolean(word) && listenedToday(state, id, plan.date) && matchesBooks(word, books);
  };
  const survivingNew = plan.newIds.filter(keepTouchedInScope);
  const survivingReview = plan.reviewIds.filter(keepTouchedInScope);
  // If a word was first encountered under another scope and only re-enters through a
  // different selected book, it is no longer a fresh word for this scope. Keep the
  // same word/history, but classify it as review. A scope expansion that still shares
  // one of the word's previously selected books keeps its original new-word identity.
  const movedToReview = [];
  plan.newIds = survivingNew.filter((id) => {
    const word = state.words.find((w) => w.id === id);
    const hasContinuousSelectedSource = Boolean(word) && (word.sources || []).some(
      (source) => previousBooks.includes(source) && books.includes(source),
    );
    if (hasContinuousSelectedSource) return true;
    movedToReview.push(id);
    return false;
  });
  plan.reviewIds = [...new Set([...survivingReview, ...movedToReview])];
  plan.resumeWordId = keepTouchedInScope(plan.resumeWordId) ? plan.resumeWordId : null;
  plan.books = [...books];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
}
`,
`function seedTodayFromListenHistory(state, plan) {
  if (plan.mode === 'sequential') return;
  const seen = new Set([...plan.newIds, ...plan.reviewIds]);
  const listenedIds = [...new Set(state.events.filter((e) => e.date === plan.date && e.mode === 'listen').map((e) => e.wordId))];
  for (const id of listenedIds) {
    if (seen.has(id) || wordPassedOnDay(state, id, plan.date)) continue;
    const word = state.words.find((w) => w.id === id);
    if (!word || !matchesBooks(word, plan.books)) continue;
    if (wordStudyKind(state, word, plan.date) === 'review') plan.reviewIds.push(id);
    else plan.newIds.push(id);
    seen.add(id);
  }
}

function normalizeMixedPlanIdentity(state, plan) {
  const ids = [...new Set([...(plan.newIds || []), ...(plan.reviewIds || [])])];
  plan.newIds = [];
  plan.reviewIds = [];
  for (const id of ids) {
    const word = state.words.find((w) => w.id === id);
    if (!word) continue;
    if (wordStudyKind(state, word, plan.date) === 'review') plan.reviewIds.push(id);
    else plan.newIds.push(id);
  }
}

function reconcileScope(state, plan, books) {
  if (sameBooks(plan.books, books)) return;
  // Scope controls visibility. Today's events are preserved, but only unfinished
  // touched words that also belong to the new scope carry into the new queue.
  const carry = [...new Set([...(plan.newIds || []), ...(plan.reviewIds || [])])].filter((id) => {
    const word = state.words.find((w) => w.id === id);
    return Boolean(word)
      && !word.retired
      && listenedToday(state, id, plan.date)
      && !wordPassedOnDay(state, id, plan.date)
      && matchesBooks(word, books);
  });
  plan.newIds = [];
  plan.reviewIds = [];
  for (const id of carry) {
    const word = state.words.find((w) => w.id === id);
    if (wordStudyKind(state, word, plan.date) === 'review') plan.reviewIds.push(id);
    else plan.newIds.push(id);
  }
  plan.resumeWordId = carry.includes(plan.resumeWordId) ? plan.resumeWordId : null;
  plan.books = [...books];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
}
`, 'scope reconciliation');
q = replaceOnce(q,
`  seedTodayFromListenHistory(state, plan);
  moveHintedNewWordsToReview(state, plan);
`,
`  seedTodayFromListenHistory(state, plan);
  normalizeMixedPlanIdentity(state, plan);
`, 'normalize mixed identity');
q = replaceOnce(q,
`export function fillSequentialPlan(state, plan) {
  const assigned = new Set();
  for (const segment of plan.bookSegments || []) {
    const pool = state.words.filter((w) => !w.retired && (w.sources || []).includes(segment.book));
    const valid = new Set(pool.map((w) => w.id));
    segment.newIds = segment.newIds.filter((id) => valid.has(id) && !assigned.has(id));
    segment.reviewIds = segment.reviewIds.filter((id) => valid.has(id) && !assigned.has(id));

    const minNew = attemptedCount(state, segment.newIds, plan.date);
`,
`export function fillSequentialPlan(state, plan) {
  const assigned = new Set();
  const listenedIds = [...new Set(state.events.filter((e) => e.date === plan.date && e.mode === 'listen').map((e) => e.wordId))];
  for (const segment of plan.bookSegments || []) {
    const pool = state.words.filter((w) => !w.retired && (w.sources || []).includes(segment.book));
    const valid = new Set(pool.map((w) => w.id));
    const existing = [...new Set([...(segment.newIds || []), ...(segment.reviewIds || [])])]
      .filter((id) => valid.has(id) && !assigned.has(id));
    segment.newIds = [];
    segment.reviewIds = [];
    for (const id of existing) {
      const word = state.words.find((w) => w.id === id);
      if (wordStudyKind(state, word, plan.date) === 'review') segment.reviewIds.push(id);
      else segment.newIds.push(id);
    }
    const present = new Set([...segment.newIds, ...segment.reviewIds]);
    for (const id of listenedIds) {
      if (present.has(id) || assigned.has(id) || !valid.has(id) || wordPassedOnDay(state, id, plan.date)) continue;
      const word = state.words.find((w) => w.id === id);
      if (wordStudyKind(state, word, plan.date) === 'review') segment.reviewIds.push(id);
      else segment.newIds.push(id);
      present.add(id);
    }

    const minNew = attemptedCount(state, segment.newIds, plan.date);
`, 'sequential history carry');
q = replaceOnce(q,
`export function convertPlanToMixed(state, plan, books = []) {
  const attemptedNew = plan.newIds.filter((id) => listenedToday(state, id, plan.date));
  const attemptedReview = plan.reviewIds.filter((id) => listenedToday(state, id, plan.date));
  plan.mode = 'mixed';
`,
`export function convertPlanToMixed(state, plan, books = []) {
  const attempted = [...new Set([...(plan.newIds || []), ...(plan.reviewIds || [])])]
    .filter((id) => listenedToday(state, id, plan.date));
  const attemptedNew = attempted.filter((id) => wordStudyKind(state, id, plan.date) === 'new');
  const attemptedReview = attempted.filter((id) => wordStudyKind(state, id, plan.date) === 'review');
  plan.mode = 'mixed';
`, 'mixed conversion identity');
q = replaceOnce(q,
  "    if (reviewKnown(state, word, date)) reviewCount++;\n    else newCount++;",
  "    if (wordStudyKind(state, word, date) === 'review') reviewCount++;\n    else newCount++;",
  'today stats identity');
write('src/queue.js', q);

let tf = read('src/typefilters.js');
tf = replaceOnce(tf,
  "import { addStudyDays } from './studyday.js';\n",
  "import { addStudyDays } from './studyday.js';\nimport { wordStudyKind } from './studyidentity.js';\n",
  'typefilters identity import');
tf = replaceOnce(tf,
`  const heard = (ids) => unique((ids || []).filter((id) => allowed.has(id) && state.events.some((e) => e.wordId === id && e.date === today && e.mode === 'listen')));
  if (kind === 'todayNew') return heard(plan?.newIds || []);
  if (kind === 'todayReview') return heard(plan?.reviewIds || []);
`,
`  const heard = (ids) => unique((ids || []).filter((id) => allowed.has(id) && state.events.some((e) => e.wordId === id && e.date === today && e.mode === 'listen')));
  const heardPlanIds = heard([...(plan?.newIds || []), ...(plan?.reviewIds || [])]);
  if (kind === 'todayNew') return heardPlanIds.filter((id) => wordStudyKind(state, id, today) === 'new');
  if (kind === 'todayReview') return heardPlanIds.filter((id) => wordStudyKind(state, id, today) === 'review');
`, 'type preset identity');
write('src/typefilters.js', tf);

let app = read('src/app.js');
app = replaceOnce(app,
  "import { typePresetIds, customTypeIdsFromEvents } from './typefilters.js';\n",
  "import { typePresetIds, customTypeIdsFromEvents } from './typefilters.js';\nimport { wordStudyKind } from './studyidentity.js';\n",
  'app identity import');
app = replaceOnce(app,
  "function planWordKind(plan,id){return plan?.newIds?.includes(id)?'新词':plan?.reviewIds?.includes(id)?'复习':'其他';}",
  "function planWordKind(plan,id){return wordStudyKind(state,id,plan?.date||currentDayKey())==='review'?'复习':'新词';}",
  'plan word label');
app = replaceOnce(app,
  "function typeWordKind(id,date=currentDayKey()){const plan=state.dailyPlans?.[date];if(plan?.newIds?.includes(id))return'新词';if(plan?.reviewIds?.includes(id))return'复习词';return state.events.some(e=>e.wordId===id&&e.date<date)?'复习词':'新词';}",
  "function typeWordKind(id,date=currentDayKey()){return wordStudyKind(state,id,date)==='review'?'复习词':'新词';}",
  'type word label');
write('src/app.js', app);

write('tests/v18.test.js', `import test from 'node:test';
import assert from 'node:assert/strict';
import { configureSequentialPlan, ensureDailyPlan } from '../src/queue.js';
import { defaultState } from '../src/storage.js';
import { reinforcementState } from '../src/reinforcement.js';
import { typePresetIds } from '../src/typefilters.js';
import { wordStudyKind } from '../src/studyidentity.js';

function base() {
  const s = defaultState();
  s.settings.defaultNewTarget = 2;
  s.settings.defaultReviewTarget = 2;
  s.words = [
    { id:'shared', en:'shared', sources:['示例词库','爱听写'], retired:false, card:null },
    { id:'sampleOnly', en:'sampleonly', sources:['示例词库'], retired:false, card:null },
    { id:'loveOnly', en:'loveonly', sources:['爱听写'], retired:false, card:null },
    { id:'loveOnly2', en:'loveonly2', sources:['爱听写'], retired:false, card:null },
  ];
  return s;
}

let seq = 0;
function hear(s, id, result='bad', date='2026-08-14') {
  seq += 1;
  s.events.push({ id:\`ev-\${seq}\`, wordId:id, date, ts:seq * 1000, mode:'listen', result, cold:!s.events.some(e=>e.wordId===id&&e.date===date&&e.mode==='listen'), attempt:s.events.filter(e=>e.wordId===id&&e.date===date&&e.mode==='listen').length+1 });
}

function passAfterMiss(s, id) {
  hear(s,id,'bad'); hear(s,id,'good'); hear(s,id,'good'); hear(s,id,'good');
}

test('study identity depends on pre-day formal listening, not same-day cross-book exposure', () => {
  const s = base();
  hear(s,'shared','bad');
  assert.equal(wordStudyKind(s,'shared','2026-08-14'),'new');
  hear(s,'loveOnly','good','2026-08-13');
  assert.equal(wordStudyKind(s,'loveOnly','2026-08-14'),'review');
});

test('deselected exclusive-book pending word cannot leak into the new scope', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['sampleOnly','shared'];
  hear(s, 'sampleOnly', 'bad');
  hear(s, 'shared', 'bad');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(!p.newIds.includes('sampleOnly'));
  assert.ok(!p.reviewIds.includes('sampleOnly'));
  assert.equal(s.events.some(e => e.wordId === 'sampleOnly'), true, 'history is preserved');
});

test('same-day shared pending word remains new and keeps its reinforcement state after switching books', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['shared','sampleOnly'];
  hear(s, 'shared', 'bad');
  hear(s, 'shared', 'good');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:2 });
  assert.ok(p.newIds.includes('shared'));
  assert.ok(!p.reviewIds.includes('shared'));
  const r = reinforcementState(s.events.filter(e=>e.wordId==='shared'&&e.date==='2026-08-14'&&e.mode==='listen'));
  assert.equal(r.passed,false);
  assert.equal(r.goodStreak,1);
});

test('same-day shared word already passed 3/3 does not re-enter after switching books or consume a slot', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  p.newIds = ['shared','sampleOnly'];
  passAfterMiss(s,'shared');
  p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:2, reviewTarget:0 });
  assert.ok(!p.newIds.includes('shared'));
  assert.ok(!p.reviewIds.includes('shared'));
  assert.equal(p.newIds.length,2);
  assert.ok(p.newIds.every(id=>['loveOnly','loveOnly2'].includes(id)));
});

test('shared word heard before today enters the newly selected book as review', () => {
  const s = base();
  hear(s,'shared','good','2026-08-13');
  const p = ensureDailyPlan(s, { date:'2026-08-14', books:['爱听写'], newTarget:0, reviewTarget:2 });
  assert.ok(p.reviewIds.includes('shared'));
  assert.ok(!p.newIds.includes('shared'));
});

test('sequential mode carries unfinished shared words into the selected book without relabeling them', () => {
  const s = base();
  let p = ensureDailyPlan(s, { date:'2026-08-14', books:['示例词库'], newTarget:2, reviewTarget:0 });
  configureSequentialPlan(s,p,[{book:'示例词库',newTarget:2,reviewTarget:0}]);
  hear(s,'shared','bad');
  configureSequentialPlan(s,p,[{book:'爱听写',newTarget:2,reviewTarget:0}]);
  const seg = p.bookSegments[0];
  assert.ok(seg.newIds.includes('shared'));
  assert.ok(!seg.reviewIds.includes('shared'));
  assert.ok(!seg.newIds.includes('sampleOnly'));
});

test('typing today-new/today-review presets use the same cross-day identity rule', () => {
  const s = base();
  hear(s,'shared','bad');
  hear(s,'loveOnly','good','2026-08-13');
  hear(s,'loveOnly','bad','2026-08-14');
  const candidates = s.words.filter(w=>w.sources.includes('爱听写'));
  const deliberatelyStalePlan = { newIds:['loveOnly'], reviewIds:['shared'] };
  assert.deepEqual(typePresetIds(s,candidates,'todayNew','2026-08-14',deliberatelyStalePlan),['shared']);
  assert.deepEqual(typePresetIds(s,candidates,'todayReview','2026-08-14',deliberatelyStalePlan),['loveOnly']);
});
`);
