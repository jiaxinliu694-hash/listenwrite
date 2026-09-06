import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWordText, normalizeWordLexeme, repairWordTextState, hasWordTextRepairs, wordTextDuplicateGroups, wordTextReviewRows } from '../src/wordtext.js';
import { buildImportDraft, recordsFromDraft } from '../src/importwords.js';

const clean = value => inspectWordText(value).text;

test('v44 removes stray vocabulary markers and paste artefacts, including the reported &leader', () => {
  const cases = new Map([
    ['&leader', 'leader'], ['=leader', 'leader'], [' &=leader ', 'leader'],
    ['• =leader', 'leader'], ['＝Ｌｅａｄｅｒ', 'Leader'], ['\uFEFF&leader\u200B', 'leader'],
    ['&amp;leader', 'leader'], ['&amp;amp;leader', 'leader'], ['&#38;leader', 'leader'],
    ['&#x26;leader', 'leader'], ['&nbsp;=leader', 'leader'], ['**leader**', 'leader'],
    ['leader&', 'leader'], ['• leader', 'leader'], ['— leader', 'leader'], ['17. leader', 'leader'],
    ['(17) leader', 'leader'], ['="leader"', 'leader'], ['“leader”', 'leader'],
    ['leader\u00a0', 'leader'], ['co\u200boperate', 'cooperate'],
  ]);
  for (const [raw, expected] of cases) {
    assert.equal(clean(raw), expected, raw);
    assert.equal(inspectWordText(raw).valid, true, raw);
    assert.equal(clean(expected), expected, `idempotent ${raw}`);
  }
});

test('v44 preserves meaningful internal symbols, contractions, suffixes, numbers and currencies', () => {
  for (const word of ["can't", "o'clock", "'tis", "'em", 'well-being', 'AT&T', 'R&D', 'C++', 'C#',
    'B&B', 'A/B', 'Ph.D.', '3D', '21st', '24-hour', '1,500,000', '9:30', '9.30',
    '$1,250.50', '£20', '€20', '¥20', '-5', '+5', '10%', '-ing', 'eco-', 'café']) {
    assert.equal(clean(word), word, word);
    assert.equal(inspectWordText(word).valid, true, word);
  }
  assert.equal(clean('AT&amp;T'), 'AT&T');
  assert.equal(normalizeWordLexeme('Can’t'), "can't");
  assert.equal(normalizeWordLexeme('well‑being'), 'well-being');
});

test('v44 does not import symbol-only rows, unknown entities, HTML or executable-looking formulas', () => {
  for (const value of ['', '  ', '&', '=', '※', '***', '&mystery;leader',
    '=HYPERLINK("https://example.test", "leader")', '=SUM(A1:A3)',
    '<script>throw 1</script>', '<b>leader</b>', 'leader\nmanager']) {
    assert.equal(inspectWordText(value).valid, false, value);
  }
  assert.equal(normalizeWordLexeme('***'), '***', 'existing invalid data is not deleted');
});

test('v44 only changes the English column and missing headers do not reuse other columns', () => {
  const draft = buildImportDraft('en,zh,example\n&leader,领导者 & 负责人,AT&T is an example.\n=manager,经理,=unchanged\n&,符号,ignored', '词书.csv');
  const rows = recordsFromDraft(draft);
  assert.equal(rows[0].en, 'leader');
  assert.equal(rows[0].originalEn, '&leader');
  assert.equal(rows[0].cleaned, true);
  assert.equal(rows[0].zh, '领导者 & 负责人');
  assert.equal(rows[0].example, 'AT&T is an example.');
  assert.equal(rows[0].pos, '');
  assert.equal(rows[0].def, '');
  assert.equal(rows[1].example, '=unchanged');
  assert.equal(rows[2].valid, false);
});

test('v44 accepts Excel quoted text fields without evaluating any formula', () => {
  const rows = recordsFromDraft(buildImportDraft('en,zh\n"=""leader""",领导者\n"=""R&D""",研发'));
  assert.equal(rows[0].en, 'leader');
  assert.equal(rows[1].en, 'R&D');
});

test('v44 repairs old records immutably, keeps IDs/order/history/card and records reversible spellings', () => {
  const state = {
    words: [
      { id: 'dirty', en: '&leader', zh: '领导者', sources: ['Sherry'], examples: ['Our leader spoke.'], card: { due: 123, reps: 9 } },
      { id: 'clean', en: 'leader', zh: '负责人', sources: ['Other'], card: { due: 456, reps: 3 } },
      { id: 'invalid', en: '***', zh: '需检查' },
    ],
    simpleWords: ['=simple'], events: [{ id: 'e1', wordId: 'dirty', result: 'bad' }],
    dailyPlans: { day: { newIds: ['dirty'], reviewIds: ['clean'], resumeWordId: 'dirty' } },
    settings: { retention: .9 }, texts: [{ body: '&leader = manager' }],
  };
  const before = structuredClone(state);
  const repaired = repairWordTextState(state);
  assert.deepEqual(state, before, 'input not mutated');
  assert.equal(repaired.words[0].en, 'leader');
  assert.deepEqual(repaired.words.map(w => w.id), ['dirty', 'clean', 'invalid']);
  for (let i = 0; i < state.words.length; i++) {
    const { en: a, ...original } = state.words[i];
    const { en: b, ...fixed } = repaired.words[i];
    assert.deepEqual(fixed, original);
  }
  assert.deepEqual(repaired.events, state.events);
  assert.deepEqual(repaired.dailyPlans, state.dailyPlans);
  assert.deepEqual(repaired.texts, state.texts);
  assert.deepEqual(repaired.settings, state.settings);
  assert.deepEqual(repaired.simpleWords, ['simple']);
  assert.deepEqual(Object.values(repaired.wordTextRepairs), [{ wordId: 'dirty', before: '&leader', after: 'leader' }]);
  assert.deepEqual(wordTextDuplicateGroups(repaired), [{ en: 'leader', ids: ['dirty', 'clean'] }]);
  assert.equal(wordTextReviewRows(repaired)[0].word.id, 'invalid');
  assert.equal(hasWordTextRepairs(repaired), false);
  assert.equal(repairWordTextState(repaired), repaired, 'repeat load is a no-op');
});
