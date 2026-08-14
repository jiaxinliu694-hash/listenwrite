import test from 'node:test';
import assert from 'node:assert/strict';
import { freeListenCandidates, linkedSentenceSourceState, staleLinkedSentenceCount, removeStaleLinkedSentences } from '../src/usepolish.js';

test('free listening can target an imported book without touching scheduling', () => {
  const state = {
    words: [
      { id: 'a', retired: false, sources: ['Book A'] },
      { id: 'b', retired: false, sources: ['Book A'] },
      { id: 'c', retired: false, sources: ['Book B'] },
    ],
    events: [{ wordId: 'a', mode: 'listen' }],
  };
  assert.deepEqual(freeListenCandidates(state, 'Book A'), ['a', 'b']);
  assert.deepEqual(freeListenCandidates(state, 'Book A', { scope: 'unheard' }), ['b']);
  assert.deepEqual(freeListenCandidates(state, 'Book A', { limit: 1 }), ['a']);
});

test('stale sentence links are detectable and removable without touching standalone entries', () => {
  const state = {
    texts: [{ id: 't1', sentences: [{ id: 's1', text: 'Keep me.' }] }],
    sentenceBooks: [{ id: 'b1', entries: [
      { id: 'e1', sourceTextId: 't1', sourceSentenceId: 's1' },
      { id: 'e2', sourceTextId: 't1', sourceSentenceId: 'old' },
      { id: 'e3', sourceTextId: 'gone', sourceSentenceId: 's9' },
      { id: 'e4', sourceTextId: null, sourceSentenceId: null },
    ] }],
  };
  assert.equal(linkedSentenceSourceState(state, state.sentenceBooks[0].entries[0]), 'linked');
  assert.equal(linkedSentenceSourceState(state, state.sentenceBooks[0].entries[1]), 'source-changed');
  assert.equal(linkedSentenceSourceState(state, state.sentenceBooks[0].entries[2]), 'source-deleted');
  assert.equal(staleLinkedSentenceCount(state), 2);
  assert.equal(removeStaleLinkedSentences(state), 2);
  assert.deepEqual(state.sentenceBooks[0].entries.map((e) => e.id), ['e1', 'e4']);
});
