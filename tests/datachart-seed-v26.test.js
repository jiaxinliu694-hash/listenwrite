import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CHART_SEED } from '../src/datachart-seed-patch.js';
import { dataChartSections } from '../src/datachart.js';

test('Introduction keeps original verb scope except approved expansions', () => {
  const intro = dataChartSections(DATA_CHART_SEED).find((section) => section.code === '01.00');
  const byId = Object.fromEntries(intro.items.map((item) => [item.id, item]));

  assert.equal(byId.w_1a115ea983.answer, 'show / illustrate / present + OBJECT');
  assert.equal(byId.w_399111d7fa.answer, 'show / illustrate changes in + OBJECT');
  assert.equal(byId.w_8789a79fea.answer, 'show / illustrate how + OBJECT + changed');
  assert.equal(byId.w_6e90f3ced8.answer, 'depict / show the distribution of + OBJECT');
  assert.equal(byId.w_9470d64edd.answer, 'depict / show trends in + OBJECT + over + PERIOD / over time');

  assert.equal(
    byId.w_f436c79206.answer,
    'show / illustrate + the proportion / percentage of + OBJECT',
  );
  assert.deepEqual(byId.w_f436c79206.heads, ['show', 'illustrate']);

  assert.equal(
    byId.w_0b003d1a8e.answer,
    'with + projections / forecasts / projected figures / forecast figures + for + FUTURE YEARS',
  );
  assert.deepEqual(byId.w_0b003d1a8e.heads, [
    'with projections',
    'with forecasts',
    'with projected figures',
    'with forecast figures',
  ]);
});

test('duplicate Introduction forecast cue stays consistent in prediction section', () => {
  const prediction = dataChartSections(DATA_CHART_SEED).find((section) => section.code === '03.15');
  const item = prediction.items.find((row) => row.id === 'w_a3abb9fdee');
  assert.equal(
    item.answer,
    'with + projections / forecasts / projected figures / forecast figures + for + YEARS',
  );
});
