import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordVocabularyPractice, editVocabularyPractice, normalizePracticeEvents, buildMistakeIndex,
  filterMistakeRows, groupMistakeRows, mistakeSummary, latestMistakeDay, selectedMistakeWords, mistakesToCSV,
} from '../src/mistakes.js';
import { mergeCloudStates } from '../src/cloudmerge.js';

const ts = date => Date.parse(`${date}T04:00:00Z`);
const word = (id = 'w1', en = 'leader', sources = ['Book A','Green']) => ({ id, en, zh:'领导者', sources, card:{ reps:5, due:'unchanged' } });
const attempt = (id,date,result='bad',mode='listen',wordId='w1') => ({id,wordId,date,ts:ts(date),mode,result});

test('v45 historical daily lists persist after later correct responses and beyond three days', () => {
  const state = {words:[word()],events:[attempt('e1','2026-08-01'),attempt('e2','2026-08-02'),attempt('e3','2026-09-05','good')]};
  const snapshot=structuredClone(state), {rows}=buildMistakeIndex(state);
  assert.deepEqual(rows.map(r=>r.date),['2026-08-02','2026-08-01']);
  assert.ok(rows.every(r=>r.resolved));
  assert.equal(mistakeSummary(rows).words,1); assert.equal(mistakeSummary(rows).errors,2);
  assert.equal(groupMistakeRows(rows,'book').length,2);
  assert.equal(groupMistakeRows(rows,'book')[0].words,1);
  assert.equal(latestMistakeDay(rows,'2026-08-02',true),'2026-08-01');
  assert.deepEqual(state,snapshot);
});

test('v45 source snapshots survive book membership changes; old records explicitly use current membership', () => {
  const w=word(), state={words:[w],events:[attempt('legacy','2026-09-01')],vocabPracticeEvents:[]};
  recordVocabularyPractice(state,w,'free','bad',{date:'2026-09-02',ts:ts('2026-09-02'),studyBooks:['Book A']});
  w.sources=['Renamed'];
  const {rows}=buildMistakeIndex(state);
  assert.deepEqual(rows[0].books,['Book A','Green']); assert.equal(rows[0].inferredBooks,false);
  assert.deepEqual(rows[0].studyBooks,['Book A']);
  assert.deepEqual(rows[1].books,['Renamed']); assert.equal(rows[1].inferredBooks,true);
  assert.equal(filterMistakeRows(rows,{book:'Book A'}).length,1);
});

test('v45 free/review log never writes formal events, cards, dates or daily quotas and deduplicates submissions', () => {
  const w=word(), state={words:[w],events:[attempt('e1','2026-09-01')],dailyPlans:{a:{newIds:['w1']}}};
  const before=structuredClone(state);
  const context={id:'same',ts:ts('2026-09-02'),date:'2026-09-01',input:'lader',sourceDates:['2026-09-01']};
  recordVocabularyPractice(state,w,'review-spelling','bad',context);
  recordVocabularyPractice(state,w,'review-spelling','bad',context);
  assert.equal(state.vocabPracticeEvents.length,1);
  assert.equal(state.vocabPracticeEvents[0].date,'2026-09-01'); // active study-day context is respected
  const {vocabPracticeEvents,...rest}=state; assert.deepEqual(rest,before);
  editVocabularyPractice(state,'same','good');
  assert.equal(state.vocabPracticeEvents.length,1); assert.equal(state.vocabPracticeEvents[0].originalResult,'bad');
  assert.deepEqual(state.events,before.events); assert.deepEqual(state.words,before.words);
});

test('v45 mode filtering counts only that mode, and listening success cannot clear spelling or Chinese typing errors', () => {
  const w=word(), day='2026-09-03', state={words:[w],events:[attempt('formal',day),attempt('typed',day,'bad','type')]};
  recordVocabularyPractice(state,w,'review-spelling','bad',{id:'sp',ts:ts(day)+1,date:day,input:'lader'});
  recordVocabularyPractice(state,w,'review-listen','good',{id:'li',ts:ts(day)+2,date:day});
  const {rows}=buildMistakeIndex(state);
  assert.equal(rows[0].badCount,3); assert.equal(rows[0].resolved,false);
  const listening=filterMistakeRows(rows,{mode:'listen'});
  assert.equal(listening[0].badCount,1); assert.equal(listening[0].resolved,true);
  assert.equal(filterMistakeRows(rows,{mode:'review'})[0].resolved,false);
  assert.equal(filterMistakeRows(rows,{mode:'type'})[0].badCount,1);
});

test('v45 explicit empty snapshot is unassigned, not guessed; missing words remain read-only', () => {
  const state={words:[],events:[{...attempt('x','2026-09-01'),booksSnapshot:[],enSnapshot:'leader',zhSnapshot:'领导者'}]};
  const {rows}=buildMistakeIndex(state);
  assert.equal(rows[0].selectable,false);assert.equal(rows[0].en,'leader');assert.equal(rows[0].inferredBooks,false);
  assert.deepEqual(rows[0].books,['（未归属词书）']);
  assert.deepEqual(selectedMistakeWords(state,['w1']),[]);
});

test('v45 selected IDs deduplicate across dates without changing retired status or identities', () => {
  const w=word();w.retired=true; const state={words:[w]};
  assert.deepEqual(selectedMistakeWords(state,['w1','w1','deleted']),[w]); assert.equal(w.retired,true);
});

test('v45 practice log normalization is repeatable and concurrent devices merge by immutable event ID', () => {
  const base={words:[word()],events:[],vocabPracticeEvents:[]}, local=structuredClone(base),remote=structuredClone(base);
  recordVocabularyPractice(local,local.words[0],'free','bad',{id:'local',ts:ts('2026-09-01')});
  recordVocabularyPractice(remote,remote.words[0],'review-listen','bad',{id:'remote',ts:ts('2026-09-02')});
  const merged=mergeCloudStates(base,local,remote);
  assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.state.vocabPracticeEvents.map(e=>e.id),['local','remote']);
  const normalized=normalizePracticeEvents(merged.state.vocabPracticeEvents);
  assert.deepEqual(normalizePracticeEvents(normalized),normalized);
  assert.equal(normalizePracticeEvents([{},null,...normalized,...normalized]).length,2);
});

test('v45 CSV escapes quotes, linebreaks and spreadsheet formulas and does not change records', () => {
  const w=word('w1','=SUM(A1)','A');w.sources=['Book "A"\nSection'];
  const {rows}=buildMistakeIndex({words:[w],events:[attempt('x','2026-09-01')]});
  const csv=mistakesToCSV(rows);
  assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/'=SUM\(A1\)/);assert.match(csv,/Book ""A""\nSection/);
  assert.equal(rows[0].en,'=SUM(A1)');
});

test('v45 corrected historical misclick is excluded while an actual later success never erases a prior bad event', () => {
  const first=attempt('e1','2026-09-01');first.originalResult='bad';first.result='good';first.editedAt=ts('2026-09-02');
  const state={words:[word()],events:[first,attempt('e2','2026-09-02'),attempt('e3','2026-09-03','good')]};
  const {rows}=buildMistakeIndex(state);assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-09-02');assert.equal(rows[0].resolved,true);
});
