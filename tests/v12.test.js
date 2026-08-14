import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeEnglish } from '../src/tokenizer.js';
import { buildImportDraft, recordsFromDraft } from '../src/importwords.js';
import { deleteWordEverywhere, updateWordFields } from '../src/wordadmin.js';

test('tokenizer keeps IELTS numeric, time, currency, percent and alphanumeric tokens', () => {
  const tokens = tokenizeEnglish('Room 3B costs £25.50 at 8:30 on July 6th, a 20% discount, code A12.');
  assert.deepEqual(tokens, ['Room', '3B', 'costs', '£25.50', 'at', '8:30', 'on', 'July', '6th', 'a', '20%', 'discount', 'code', 'A12']);
});

test('CSV parser preserves commas inside quoted definitions and examples', () => {
  const csv = 'English,中文,词性,英文释义,词书,例句\n"rural","乡村的","adj.","connected with villages, farms or countryside","剑18","People live in rural areas, far from cities."';
  const draft = buildImportDraft(csv, 'words.csv');
  const [row] = recordsFromDraft(draft);
  assert.equal(row.en, 'rural');
  assert.equal(row.def, 'connected with villages, farms or countryside');
  assert.equal(row.example, 'People live in rural areas, far from cities.');
  assert.equal(row.source, '剑18');
});

test('TSV import infers standard columns and source fallback', () => {
  const draft = buildImportDraft('word\tmeaning\tpos\ndefine\t定义\tv.\n', '自建词.tsv');
  const rows = recordsFromDraft(draft);
  assert.equal(rows[0].en, 'define');
  assert.equal(rows[0].zh, '定义');
  assert.equal(rows[0].pos, 'v.');
  assert.equal(rows[0].source, '自建词');
});

test('word editor replaces mutable fields without changing identity', () => {
  const word = { id: 'w1', en: 'rural', zh: '旧', pos: '', def: '', sources: ['A'], examples: [] };
  updateWordFields(word, { zh: '乡村的', pos: 'adj.', sources: ['A', 'B', 'B'], examples: ['one', 'one', 'two'] });
  assert.equal(word.id, 'w1');
  assert.equal(word.en, 'rural');
  assert.deepEqual(word.sources, ['A', 'B']);
  assert.deepEqual(word.examples, ['one', 'two']);
});

test('deleting a word cleans events and all today-plan references but leaves sentence text alone', () => {
  const state = {
    words: [{ id: 'w1', en: 'rural' }, { id: 'w2', en: 'farm' }],
    events: [{ wordId: 'w1' }, { wordId: 'w2' }],
    simpleWords: ['rural'],
    dailyPlans: {
      '2026-08-14': {
        newIds: ['w1'], reviewIds: ['w2'], resumeWordId: 'w1',
        bookSegments: [{ newIds: ['w1'], reviewIds: ['w2'] }],
      },
    },
    sentenceBooks: [{ entries: [{ text: 'rural areas', tokens: [{ surface: 'rural' }] }] }],
  };
  assert.equal(deleteWordEverywhere(state, 'w1'), true);
  assert.deepEqual(state.words.map((w) => w.id), ['w2']);
  assert.deepEqual(state.events.map((e) => e.wordId), ['w2']);
  assert.deepEqual(state.dailyPlans['2026-08-14'].newIds, []);
  assert.equal(state.dailyPlans['2026-08-14'].resumeWordId, null);
  assert.equal(state.sentenceBooks[0].entries[0].text, 'rural areas');
});
