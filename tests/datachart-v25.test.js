import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CHART_SEED } from '../src/datachart-seed.js';
import {
  emptyDataChartState,
  normalizeDataChartState,
  dataChartSections,
  dataChartSectionProgress,
  dataChartItemProgress,
  gradeDataChartItem,
  createDataChartSession,
  gradeDataChartSession,
  dataChartSessionProgress,
  dataChartWeakItemIds,
  dataChartDailySummary,
  chooseDataChartReviewSections,
  nextDataChartLearningSection,
  reconcileDataChartContent,
} from '../src/datachart.js';

test('seed structure remains 8 chapters / 30 sections / 323 items', () => {
  const sections = dataChartSections(DATA_CHART_SEED);
  assert.equal(DATA_CHART_SEED.chapters.length, 8);
  assert.equal(sections.length, 30);
  assert.equal(sections.reduce((n, s) => n + s.items.length, 0), 323);
  assert.equal(new Set(sections.flatMap(s => s.items.map(i => i.id))).size, 323);
});

test('intro uses grouped interchangeable chart verbs while provide/give stays separate', () => {
  const intro = dataChartSections(DATA_CHART_SEED).find(s => s.code === '01.00');
  const generic = intro.items.find(i => i.id === 'w_1a115ea983');
  const info = intro.items.find(i => i.id === 'w_42575f89ce');
  const share = intro.items.find(i => i.id === 'w_f436c79206');
  assert.equal(generic.answer, 'show / illustrate / present / depict + OBJECT');
  assert.equal(info.answer, 'provide / give information on/about + OBJECT');
  assert.match(share.answer, /show \/ illustrate \/ present \/ depict/);
});

test('first good passes immediately, one bad requires 3 consecutive good and bad resets it', () => {
  const dc = emptyDataChartState();
  gradeDataChartItem(dc, { itemId: 'a', sectionId: 's', result: 'good', date: '2026-08-15', ts: 1 });
  assert.equal(dataChartItemProgress(dc, 'a').status, 'mastered');
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'bad', date: '2026-08-15', ts: 2 });
  assert.deepEqual(dataChartItemProgress(dc, 'b'), {
    status: 'reinforcing', hadBad: true, goodStreak: 0, goodCount: 0, badCount: 1,
    firstSeenAt: 2, lastSeenAt: 2, lastResult: 'bad',
  });
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'good', date: '2026-08-15', ts: 3 });
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'good', date: '2026-08-15', ts: 4 });
  assert.equal(dataChartItemProgress(dc, 'b').goodStreak, 2);
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'bad', date: '2026-08-15', ts: 5 });
  assert.equal(dataChartItemProgress(dc, 'b').goodStreak, 0);
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'good', date: '2026-08-15', ts: 6 });
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'good', date: '2026-08-15', ts: 7 });
  gradeDataChartItem(dc, { itemId: 'b', sectionId: 's', result: 'good', date: '2026-08-15', ts: 8 });
  assert.equal(dataChartItemProgress(dc, 'b').status, 'mastered');
});

test('learn session retries only weak items and marks section learned when all pass', () => {
  const dc = emptyDataChartState();
  const section = dataChartSections(DATA_CHART_SEED)[0];
  const tinySeed = { ...DATA_CHART_SEED, chapters: [{ ...DATA_CHART_SEED.chapters[0], sections: [{ ...section, items: section.items.slice(0, 2) }] }] };
  let r = 0;
  createDataChartSession(dc, tinySeed, { mode: 'learn', sectionIds: [section.id], date: '2026-08-15', now: 100, random: () => (r++ ? 0.9 : 0.1) });
  const first = dc.session.currentId;
  gradeDataChartSession(dc, tinySeed, 'bad', { date: '2026-08-15', ts: 101 });
  const second = dc.session.currentId;
  assert.notEqual(first, second);
  gradeDataChartSession(dc, tinySeed, 'good', { date: '2026-08-15', ts: 102 });
  // Queue is exhausted; weak item is allowed back even before ideal gap instead of blocking the session.
  assert.equal(dc.session.currentId, first);
  gradeDataChartSession(dc, tinySeed, 'good', { date: '2026-08-15', ts: 103 });
  gradeDataChartSession(dc, tinySeed, 'good', { date: '2026-08-15', ts: 104 });
  gradeDataChartSession(dc, tinySeed, 'good', { date: '2026-08-15', ts: 105 });
  assert.equal(dataChartSessionProgress(dc).done, true);
  assert.equal(dataChartSectionProgress(dc, tinySeed.chapters[0].sections[0]).complete, true);
  assert.deepEqual(dataChartDailySummary(dc, '2026-08-15').learnedSectionIds, [section.id]);
});

test('content wording changes do not touch progress because progress is keyed by immutable item id', () => {
  const dc = emptyDataChartState();
  const section = dataChartSections(DATA_CHART_SEED)[0];
  const item = section.items[0];
  gradeDataChartItem(dc, { itemId: item.id, sectionId: section.id, result: 'bad', date: '2026-08-15', ts: 1 });
  const before = structuredClone(dc.items[item.id]);
  const altered = structuredClone(DATA_CHART_SEED);
  altered.contentVersion = 'later';
  altered.chapters[0].sections[0].items[0].answer = 'some revised wording';
  reconcileDataChartContent(dc, altered);
  assert.deepEqual(dc.items[item.id], before);
  assert.equal(dc.contentVersionSeen, 'later');
});

test('normalization keeps orphaned progress instead of deleting it during curriculum updates', () => {
  const raw = { items: { old_item: { status: 'reinforcing', hadBad: true, goodStreak: 2, badCount: 1 } }, sections: {}, attempts: [] };
  const dc = normalizeDataChartState(raw);
  reconcileDataChartContent(dc, DATA_CHART_SEED);
  assert.equal(dc.items.old_item.status, 'reinforcing');
  assert.equal(dc.items.old_item.goodStreak, 2);
});

test('daily review selection prioritizes sections with unresolved weak items', () => {
  const dc = emptyDataChartState();
  const [a, b] = dataChartSections(DATA_CHART_SEED);
  dc.sections[a.id] = { startedAt: 10, completedAt: 20, lastReviewedAt: 30, reviewCount: 1 };
  dc.sections[b.id] = { startedAt: 10, completedAt: 20, lastReviewedAt: 30, reviewCount: 1 };
  gradeDataChartItem(dc, { itemId: a.items[0].id, sectionId: a.id, result: 'good', date: '2026-08-14', ts: 100 });
  gradeDataChartItem(dc, { itemId: b.items[0].id, sectionId: b.id, result: 'bad', date: '2026-08-14', ts: 200 });
  const chosen = chooseDataChartReviewSections(dc, DATA_CHART_SEED, 1, '2026-08-15');
  assert.deepEqual(chosen, [b.id]);
  assert.deepEqual(dataChartWeakItemIds(dc, DATA_CHART_SEED), [b.items[0].id]);
});


test('a previously completed section stays learned even if a later review makes an item weak', () => {
  const dc = emptyDataChartState();
  const [first, second] = dataChartSections(DATA_CHART_SEED);
  dc.sections[first.id] = { startedAt: 1, completedAt: 2, lastReviewedAt: null, reviewCount: 0 };
  for (const item of first.items) dc.items[item.id] = { status: 'mastered', hadBad: false, goodStreak: 1, goodCount: 1, badCount: 0, firstSeenAt: 1, lastSeenAt: 1, lastResult: 'good' };
  gradeDataChartItem(dc, { itemId: first.items[0].id, sectionId: first.id, result: 'bad', date: '2026-08-15', ts: 3 });
  assert.equal(dataChartSectionProgress(dc, first).complete, false);
  assert.equal(nextDataChartLearningSection(dc, DATA_CHART_SEED).id, second.id);
});


test('new items added later to a completed section become supplement learning without losing old progress', () => {
  const dc = emptyDataChartState();
  const first = dataChartSections(DATA_CHART_SEED)[0];
  dc.sections[first.id] = { startedAt: 1, completedAt: 2, lastReviewedAt: null, reviewCount: 0 };
  for (const item of first.items) dc.items[item.id] = { status: 'mastered', hadBad: false, goodStreak: 1, goodCount: 1, badCount: 0, firstSeenAt: 1, lastSeenAt: 1, lastResult: 'good' };
  const altered = structuredClone(DATA_CHART_SEED);
  altered.chapters[0].sections[0].items.push({ id: 'future_new_item', kind: 'family', cue: '新增触发', answer: 'new expression', tag: '通', example: '' });
  reconcileDataChartContent(dc, altered);
  const next = nextDataChartLearningSection(dc, altered);
  assert.equal(next.id, first.id);
  assert.equal(dataChartSectionProgress(dc, next).unseen, 1);
  assert.equal(dataChartItemProgress(dc, first.items[0].id).status, 'mastered');
});
