import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSentenceBooks, recordSentenceToken, sentenceProblemTokens, setSentenceTokenStatus } from '../src/sentencebooks.js';

test('legacy unknown sentence-token state collapses to unfamiliar without losing problem status', () => {
  const state = { sentenceBooks: [{ id: 'b', entries: [{ id: 'e', tokens: [{ surface: 'rural', normalized: 'rural', status: 'unknown', attempts: [] }] }] }], words: [] };
  ensureSentenceBooks(state);
  const token = state.sentenceBooks[0].entries[0].tokens[0];
  assert.equal(token.status, 'unfamiliar');
  assert.equal(sentenceProblemTokens(state.sentenceBooks[0].entries[0]).length, 1);
});

test('new sentence judgments keep only familiar and unfamiliar active states', () => {
  const entry = { tokens: [{ surface: 'areas', normalized: 'areas', status: null, attempts: [] }] };
  recordSentenceToken(entry, 0, { input: '', spellingResult: 'bad' });
  assert.equal(entry.tokens[0].status, null);
  setSentenceTokenStatus(entry, 0, 'unknown');
  assert.equal(entry.tokens[0].status, 'unfamiliar');
  setSentenceTokenStatus(entry, 0, 'familiar');
  assert.equal(entry.tokens[0].status, 'familiar');
});
