import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMistakeIndex, groupMistakeRows, filterMistakeRows } from '../src/mistakes.js';

test('v45 book subtotals count only errors attributed to each book after same-day membership changes', () => {
  const state = { words: [{ id: 'w', en: 'leader', zh: '领导者', sources: ['B'] }], events: [
    { id: 'e1', wordId: 'w', date: '2026-09-01', ts: 1000, mode: 'listen', result: 'bad', booksSnapshot: ['A', 'Green'] },
    { id: 'e2', wordId: 'w', date: '2026-09-01', ts: 2000, mode: 'type', result: 'bad', booksSnapshot: ['B', 'Green'] },
  ] };
  const { rows } = buildMistakeIndex(state);
  const groups = new Map(groupMistakeRows(rows, 'book').map(group => [group.key, group]));
  assert.equal(groups.get('A').errors, 1);
  assert.equal(groups.get('B').errors, 1);
  assert.equal(groups.get('Green').errors, 2);
  assert.equal(groups.get('Green').words, 1);
  for (const [book, group] of groups) {
    const filtered = filterMistakeRows(rows, { book });
    assert.equal(group.errors, filtered.reduce((sum, row) => sum + row.badCount, 0));
  }
});
