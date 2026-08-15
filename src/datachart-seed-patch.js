import { DATA_CHART_SEED } from './datachart-seed.js';

function itemById(id) {
  for (const chapter of DATA_CHART_SEED.chapters || []) {
    for (const section of chapter.sections || []) {
      const item = (section.items || []).find((row) => row.id === id);
      if (item) return item;
    }
  }
  return null;
}

function setItem(id, answer, heads) {
  const item = itemById(id);
  if (!item) return;
  item.answer = answer;
  item.heads = heads;
}

// Restore Introduction wording to the original source except for the two
// explicitly approved expansions: proportion/percentage and future forecasts.
setItem('w_1a115ea983', 'show / illustrate / present + OBJECT', ['show', 'illustrate', 'present']);
setItem('w_399111d7fa', 'show / illustrate changes in + OBJECT', ['show', 'illustrate changes in']);
setItem('w_8789a79fea', 'show / illustrate how + OBJECT + changed', ['show', 'illustrate how']);
setItem('w_6e90f3ced8', 'depict / show the distribution of + OBJECT', ['depict', 'show the distribution of']);
setItem('w_f436c79206', 'show / illustrate + the proportion / percentage of + OBJECT', ['show', 'illustrate']);
setItem('w_9470d64edd', 'depict / show trends in + OBJECT + over + PERIOD / over time', ['depict', 'show trends in']);
setItem(
  'w_0b003d1a8e',
  'with + projections / forecasts / projected figures / forecast figures + for + FUTURE YEARS',
  ['with projections', 'with forecasts', 'with projected figures', 'with forecast figures'],
);

// The same Introduction forecast cue is repeated in the prediction section;
// keep both copies consistent.
setItem(
  'w_a3abb9fdee',
  'with + projections / forecasts / projected figures / forecast figures + for + YEARS',
  ['with projections', 'with forecasts', 'with projected figures', 'with forecast figures'],
);

DATA_CHART_SEED.contentVersion = '2026-08-15-v2';

export { DATA_CHART_SEED };
export default DATA_CHART_SEED;
