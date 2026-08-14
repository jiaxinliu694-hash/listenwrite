import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentTextSentences, reconcileTextSentences, alignSentenceInput } from '../src/textsentences.js';
import { addSentenceEntry, deriveSentencePracticeStatus, recordWholeSentenceAttempt, setSentencePracticeStatus } from '../src/sentencebooks.js';

test('text segmentation keeps real English abbreviations together', () => {
  const rows = segmentTextSentences('Mr. Smith lives in the U.S. He works there. Another sentence follows!');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].text, 'Mr. Smith lives in the U.S.');
  assert.equal(rows[1].text, 'He works there.');
  assert.equal(rows[2].text, 'Another sentence follows!');
});

test('stable sentence ids survive inserting an earlier sentence', () => {
  const text = { body: 'First sentence. Second sentence.', sentence: 1, currentSentenceId: null, sentences: [] };
  reconcileTextSentences(text);
  const firstId = text.sentences[0].id;
  const secondId = text.sentences[1].id;
  text.currentSentenceId = secondId;
  text.sentence = 1;
  text.body = 'New opening. First sentence. Second sentence.';
  reconcileTextSentences(text);
  assert.equal(text.sentences[1].id, firstId);
  assert.equal(text.sentences[2].id, secondId);
  assert.equal(text.currentSentenceId, secondId);
  assert.equal(text.sentence, 2);
});

test('whole sentence alignment identifies missing, replaced and extra words', () => {
  const a = alignSentenceInput('The farmers are working in rural areas.', 'The farmers work in rual areas today');
  assert.equal(a.correct, false);
  assert.ok(a.operations.some((op) => op.type === 'replace' || op.type === 'missing'));
  assert.ok(a.operations.some((op) => op.type === 'extra'));
  assert.ok(a.wrongExpectedIndexes.length >= 1);
  const b = alignSentenceInput('The farmers are working in rural areas.', 'the farmers are working in rural areas');
  assert.equal(b.correct, true);
});

test('sentence entries reuse stable source id and keep sentence-level practice state', () => {
  const state = { sentenceBooks: [], words: [], simpleWords: [] };
  const first = addSentenceEntry(state, {
    bookName: '剑18句子',
    text: 'Rural areas are quiet.',
    tokens: ['Rural', 'areas', 'are', 'quiet'],
    sourceTextId: 'text_1',
    sourceSentenceId: 'sentence_abc',
    sourceTitle: 'Test 1',
    sourceCollection: '剑18',
    sentenceIndex: 2,
  });
  const reused = addSentenceEntry(state, {
    bookName: '剑18句子',
    text: 'Rural areas are quiet.',
    tokens: ['Rural', 'areas', 'are', 'quiet'],
    sourceTextId: 'text_1',
    sourceSentenceId: 'sentence_abc',
    sourceTitle: 'Test 1',
    sourceCollection: '剑18',
    sentenceIndex: 5,
  });
  assert.equal(reused.reused, true);
  assert.equal(reused.entry.id, first.entry.id);
  assert.equal(reused.entry.sentenceIndex, 5);

  recordWholeSentenceAttempt(reused.entry, { input: 'Rural areas quiet', alignment: { correct: false, distance: 1, operations: [] } });
  assert.equal(deriveSentencePracticeStatus(reused.entry), 'repeat');
  recordWholeSentenceAttempt(reused.entry, { input: 'Rural areas are quiet', alignment: { correct: true, distance: 0, operations: [] } });
  assert.equal(deriveSentencePracticeStatus(reused.entry), 'done');
  setSentencePracticeStatus(reused.entry, 'ignored');
  assert.equal(deriveSentencePracticeStatus(reused.entry), 'ignored');
});
