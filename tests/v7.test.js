import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, normalizeState } from '../src/storage.js';
import {
  addSentenceEntry,
  findSentenceProblemEntries,
  isSimpleLexeme,
  markSimpleLexeme,
  sentencePracticeIndexes,
  sentenceProblemTokens,
  sentenceSourceLabel,
  setSentenceTokenStatus,
} from '../src/sentencebooks.js';

function stateWithWords(words = []) {
  const state = defaultState();
  state.words = words;
  return state;
}

test('sentence entries preserve duplicate occurrences while unique practice can collapse them', () => {
  const state = stateWithWords();
  const { entry } = addSentenceEntry(state, {
    bookName: '重复词测试',
    text: 'Farmers and farmers work.',
    tokens: ['Farmers', 'and', 'farmers', 'work'],
  });
  assert.equal(entry.tokens.length, 4);
  assert.deepEqual(sentencePracticeIndexes(state, entry, { unique: false }), [0, 1, 2, 3]);
  assert.deepEqual(sentencePracticeIndexes(state, entry, { unique: true }), [0, 1, 3]);
  assert.equal(entry.tokens[0].normalized, entry.tokens[2].normalized);
  assert.notEqual(entry.tokens[0].id, entry.tokens[2].id);
});

test('words marked simple are skipped across all sentence occurrences and migrate from legacy retired words', () => {
  const state = stateWithWords([{ id: 'w1', en: 'the', retired: true, sources: [], examples: [], card: null }]);
  const { entry } = addSentenceEntry(state, {
    bookName: '简单词测试',
    text: 'The farmers and farmers.',
    tokens: ['The', 'farmers', 'and', 'farmers'],
  });
  assert.deepEqual(sentencePracticeIndexes(state, entry), [1, 2, 3]);
  markSimpleLexeme(state, 'farmers', true);
  assert.equal(isSimpleLexeme(state, 'Farmers'), true);
  assert.deepEqual(sentencePracticeIndexes(state, entry), [2]);
  markSimpleLexeme(state, 'farmers', false);
  assert.equal(isSimpleLexeme(state, 'farmers'), false);
  assert.deepEqual(sentencePracticeIndexes(state, entry), [1, 2, 3]);

  const migrated = normalizeState({ version: 6, words: state.words, events: [], texts: [], sentenceBooks: [], dailyPlans: {}, activities: [], settings: {} });
  assert.ok(migrated.simpleWords.includes('the'));
});

test('problem words retain article, sentence and occurrence provenance for precise lookup', () => {
  const state = stateWithWords();
  const { book, entry } = addSentenceEntry(state, {
    bookName: '剑18 · 句子',
    text: 'Rural areas can be rural.',
    tokens: ['Rural', 'areas', 'can', 'be', 'rural'],
    sourceTextId: 'text_18_t3p4',
    sourceTitle: 'Test 3 Part 4',
    sourceCollection: '剑18',
    sentenceIndex: 6,
  });
  setSentenceTokenStatus(entry, 0, 'unfamiliar');
  setSentenceTokenStatus(entry, 4, 'unknown');
  const problems = sentenceProblemTokens(entry);
  assert.equal(problems.length, 1, 'same lexeme is one export/review word');
  assert.equal(problems[0].occurrences.length, 2, 'both positions remain traceable');
  assert.equal(problems[0].occurrences[1].tokenIndex, 4);
  assert.equal(sentenceSourceLabel(entry), '剑18 · Test 3 Part 4 · 第 7 句');

  const byTitle = findSentenceProblemEntries(state, { query: 'Test 3 Part 4' });
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].book.id, book.id);
  const byWord = findSentenceProblemEntries(state, { query: 'rural' });
  assert.equal(byWord.length, 1);
  assert.equal(byWord[0].problems.length, 2);
});

test('sentence-only entries do not create formal vocabulary or FSRS cards', () => {
  const state = stateWithWords();
  addSentenceEntry(state, { bookName: '句子词库', text: 'A new phrase.', tokens: ['A', 'new', 'phrase'] });
  assert.equal(state.words.length, 0);
  assert.equal(state.events.length, 0);
  assert.equal(state.sentenceBooks[0].entries.length, 1);
});
