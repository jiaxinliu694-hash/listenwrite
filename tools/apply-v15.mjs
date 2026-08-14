import fs from 'node:fs';

function replaceOnce(text, oldText, newText, label) {
  if (!text.includes(oldText)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(oldText, newText);
}

let q = fs.readFileSync('src/queue.js', 'utf8');
const oldCandidateBlock = `function reviewCandidates(state, pool, assigned, date) {
  const cutoff = studyDayEnd(date);
  const now = Date.now();
  return pool
    .filter((w) => !assigned.has(w.id) && hasEventBefore(state, w.id, date) && (w.card?.reps || 0) > 0 && Number(w.card?.due || 0) <= cutoff)
    .sort((a, b) => {
      const ra = retrievability(a.card, now, state.settings.retention);
      const rb = retrievability(b.card, now, state.settings.retention);
      if (ra !== rb) return ra - rb;
      return Number(a.card?.due || 0) - Number(b.card?.due || 0);
    });
}

function freshCandidates(state, pool, assigned, date) {
  // state.words preserves the order in which a word first entered the library.
  // For new words, respect that source/import order instead of alphabetizing.
  return pool.filter((w) => !assigned.has(w.id) && !hasEventBefore(state, w.id, date));
}

function restoreUntouchedNewOrder(state, ids, date) {
  const wordOrder = new Map(state.words.map((w, index) => [w.id, index]));
  const attempted = ids.filter((id) => listenedToday(state, id, date));
  const untouched = ids
    .filter((id) => !listenedToday(state, id, date))
    .sort((a, b) => (wordOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (wordOrder.get(b) ?? Number.MAX_SAFE_INTEGER));
  return [...attempted, ...untouched];
}

function seedTodayFromListenHistory(state, plan) {
  if (plan.mode === 'sequential') return;
  const seen = new Set([...plan.newIds, ...plan.reviewIds]);
  const listenedIds = [...new Set(state.events.filter((e) => e.date === plan.date && e.mode === 'listen').map((e) => e.wordId))];
  for (const id of listenedIds) {
    if (seen.has(id)) continue;
    if (hasEventBefore(state, id, plan.date)) plan.reviewIds.push(id);
    else plan.newIds.push(id);
    seen.add(id);
  }
}

function reconcileScope(state, plan, books) {
  if (sameBooks(plan.books, books)) return;
  const keep = (id) => listenedToday(state, id, plan.date) || matchesBooks(state.words.find((w) => w.id === id) || {}, books);
  plan.newIds = plan.newIds.filter(keep);
  plan.reviewIds = plan.reviewIds.filter(keep);
  plan.books = [...books];
}`;
const newCandidateBlock = `function reviewHinted(word) {
  return Boolean(word?.reviewHint) || (word?.sources || []).some((source) => /错题|错词|error/i.test(source));
}

function reviewKnown(state, word, date) {
  return Boolean(word) && (hasEventBefore(state, word.id, date) || reviewHinted(word));
}

function hash32(value) {
  let h = 2166136261;
  for (const ch of String(value || '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawSeed(date, books = [], nonce = 0) {
  const scope = books.length ? [...books].sort().join('|') : '__all__';
  return \\`${'${date}'}|${'${scope}'}|${'${Number(nonce) || 0}'}\\`;
}

function randomRank(wordId, seed) {
  return hash32(\\`${'${seed}'}|${'${wordId}'}\\`);
}

function reviewCandidates(state, pool, assigned, date, books = [], nonce = 0) {
  const cutoff = studyDayEnd(date);
  const now = Date.now();
  const seed = drawSeed(date, books, nonce);
  return pool
    .filter((w) => {
      if (assigned.has(w.id)) return false;
      const formal = hasEventBefore(state, w.id, date);
      const hinted = !formal && reviewHinted(w);
      return hinted || (formal && (w.card?.reps || 0) > 0 && Number(w.card?.due || 0) <= cutoff);
    })
    .sort((a, b) => {
      const ah = !hasEventBefore(state, a.id, date) && reviewHinted(a);
      const bh = !hasEventBefore(state, b.id, date) && reviewHinted(b);
      if (ah !== bh) return ah ? -1 : 1;
      if (ah && bh) return randomRank(a.id, seed) - randomRank(b.id, seed);
      const ra = retrievability(a.card, now, state.settings.retention);
      const rb = retrievability(b.card, now, state.settings.retention);
      if (ra !== rb) return ra - rb;
      return Number(a.card?.due || 0) - Number(b.card?.due || 0);
    });
}

function freshCandidates(state, pool, assigned, date, books = [], nonce = 0) {
  const seed = drawSeed(date, books, nonce);
  return pool
    .filter((w) => !assigned.has(w.id) && !reviewKnown(state, w, date))
    .sort((a, b) => randomRank(a.id, seed) - randomRank(b.id, seed));
}

function restoreUntouchedNewRandomOrder(state, ids, date, books = [], nonce = 0) {
  const seed = drawSeed(date, books, nonce);
  const attempted = ids.filter((id) => listenedToday(state, id, date));
  const untouched = ids
    .filter((id) => !listenedToday(state, id, date))
    .sort((a, b) => randomRank(a, seed) - randomRank(b, seed));
  return [...attempted, ...untouched];
}

function seedTodayFromListenHistory(state, plan) {
  if (plan.mode === 'sequential') return;
  const seen = new Set([...plan.newIds, ...plan.reviewIds]);
  const listenedIds = [...new Set(state.events.filter((e) => e.date === plan.date && e.mode === 'listen').map((e) => e.wordId))];
  for (const id of listenedIds) {
    if (seen.has(id)) continue;
    const word = state.words.find((w) => w.id === id);
    if (!word || !matchesBooks(word, plan.books)) continue;
    if (reviewKnown(state, word, plan.date)) plan.reviewIds.push(id);
    else plan.newIds.push(id);
    seen.add(id);
  }
}

function moveHintedNewWordsToReview(state, plan) {
  const moved = [];
  plan.newIds = plan.newIds.filter((id) => {
    const word = state.words.find((w) => w.id === id);
    if (!word || !reviewHinted(word)) return true;
    moved.push(id);
    return false;
  });
  for (const id of moved) if (!plan.reviewIds.includes(id)) plan.reviewIds.push(id);
  if (moved.length) plan.reviewTarget = Math.max(Number(plan.reviewTarget) || 0, plan.reviewIds.length);
}

function reconcileScope(state, plan, books) {
  if (sameBooks(plan.books, books)) return;
  // Changing today's book scope redraws untouched tasks. Events/history stay intact.
  // Touched words are kept only when they still belong to the newly selected scope.
  const keepTouchedInScope = (id) => {
    const word = state.words.find((w) => w.id === id);
    return Boolean(word) && listenedToday(state, id, plan.date) && matchesBooks(word, books);
  };
  plan.newIds = plan.newIds.filter(keepTouchedInScope);
  plan.reviewIds = plan.reviewIds.filter(keepTouchedInScope);
  plan.resumeWordId = keepTouchedInScope(plan.resumeWordId) ? plan.resumeWordId : null;
  plan.books = [...books];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
}`;
q = replaceOnce(q, oldCandidateBlock, newCandidateBlock, 'candidate block');
q = replaceOnce(q,
`      resumeWordId: null,\n      createdAt: Date.now(),`,
`      resumeWordId: null,\n      drawNonce: 0,\n      createdAt: Date.now(),`,
'plan draw nonce');
q = replaceOnce(q,
`  seedTodayFromListenHistory(state, plan);\n  const minNew = attemptedCount(state, plan.newIds, plan.date);`,
`  seedTodayFromListenHistory(state, plan);\n  moveHintedNewWordsToReview(state, plan);\n  const minNew = attemptedCount(state, plan.newIds, plan.date);`,
'repair hinted plan kind');
q = q.replaceAll('restoreUntouchedNewOrder(state, plan.newIds, plan.date)', 'restoreUntouchedNewRandomOrder(state, plan.newIds, plan.date, plan.books, plan.drawNonce)');
q = q.replaceAll('restoreUntouchedNewOrder(state, segment.newIds, plan.date)', 'restoreUntouchedNewRandomOrder(state, segment.newIds, plan.date, [segment.book], plan.drawNonce)');
q = replaceOnce(q,
`  const review = reviewCandidates(state, pool, assigned, plan.date);\n  const fresh = freshCandidates(state, pool, assigned, plan.date);`,
`  const review = reviewCandidates(state, pool, assigned, plan.date, plan.books, plan.drawNonce);\n  const fresh = freshCandidates(state, pool, assigned, plan.date, plan.books, plan.drawNonce);`,
'mixed candidates');
q = replaceOnce(q,
`    const review = reviewCandidates(state, pool, assigned, plan.date);`,
`    const review = reviewCandidates(state, pool, assigned, plan.date, [segment.book], plan.drawNonce);`,
'sequential review candidates');
q = replaceOnce(q,
`    const fresh = freshCandidates(state, pool, assigned, plan.date);`,
`    const fresh = freshCandidates(state, pool, assigned, plan.date, [segment.book], plan.drawNonce);`,
'sequential fresh candidates');
q = replaceOnce(q,
`  plan.mode = 'mixed';\n  plan.bookSegments = [];`,
`  plan.mode = 'mixed';\n  plan.bookSegments = [];\n  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;`,
'mixed redraw nonce');
q = replaceOnce(q,
`  for (const id of ids) {\n    if (hasEventBefore(state, id, date)) reviewCount++;\n    else newCount++;`,
`  for (const id of ids) {\n    const word = state.words.find((w) => w.id === id);\n    if (reviewKnown(state, word, date)) reviewCount++;\n    else newCount++;`,
'stats hinted review');
fs.writeFileSync('src/queue.js', q);

let s = fs.readFileSync('src/storage.js', 'utf8');
s = replaceOnce(s,
`    retired: Boolean(word.retired ?? word.ret),\n    card: word.card || null,`,
`    retired: Boolean(word.retired ?? word.ret),\n    reviewHint: Boolean(word.reviewHint ?? word.priorExposure),\n    card: word.card || null,`,
'normalize reviewHint');
s = replaceOnce(s,
`    resumeWordId: plan.resumeWordId || null,\n    createdAt: Number(plan.createdAt) || Date.now(),`,
`    resumeWordId: plan.resumeWordId || null,\n    drawNonce: Math.max(0, Number(plan.drawNonce) || 0),\n    createdAt: Number(plan.createdAt) || Date.now(),`,
'normalize draw nonce');
fs.writeFileSync('src/storage.js', s);

let a = fs.readFileSync('src/app.js', 'utf8');
a = replaceOnce(a,
`function upsertWord({en,zh='',pos='',def='',source='',example='',overwrite=false}){en=String(en||'').trim().toLowerCase();if(!en)return null;let w=state.words.find(x=>x.en===en);if(!w){w={id:uid('w'),en,zh,pos,def,sources:[],examples:[],retired:isSimpleLexeme(state,en),card:null};state.words.push(w);}if(isSimpleLexeme(state,en))w.retired=true;if(zh&&(overwrite||!w.zh))w.zh=zh;if(pos&&(overwrite||!w.pos))w.pos=pos;if(def&&(overwrite||!w.def))w.def=def;if(source&&!w.sources.includes(source))w.sources.push(source);if(example&&!w.examples.includes(example))w.examples.push(example);return w;}`,
`function upsertWord({en,zh='',pos='',def='',source='',example='',overwrite=false,reviewHint=false}){en=String(en||'').trim().toLowerCase();if(!en)return null;let w=state.words.find(x=>x.en===en);if(!w){w={id:uid('w'),en,zh,pos,def,sources:[],examples:[],retired:isSimpleLexeme(state,en),reviewHint:Boolean(reviewHint),card:null};state.words.push(w);}if(reviewHint)w.reviewHint=true;if(isSimpleLexeme(state,en))w.retired=true;if(zh&&(overwrite||!w.zh))w.zh=zh;if(pos&&(overwrite||!w.pos))w.pos=pos;if(def&&(overwrite||!w.def))w.def=def;if(source&&!w.sources.includes(source))w.sources.push(source);if(example&&!w.examples.includes(example))w.examples.push(example);return w;}`,
'upsert review hint');
a = replaceOnce(a,
`upsertWord({en,zh,source:target,example:token.sentence||sentence});`,
`upsertWord({en,zh,source:target,example:token.sentence||sentence,reviewHint:true});`,
'sentence problem review hint');
a = replaceOnce(a,
`function addFreeBadToToday(ids){const date=currentDayKey();const books=state.settings.todayBooks||[];const plan=ensureDailyPlan(state,planForTodayOptions(date,books));if(plan.mode==='sequential')return toast('当前是分本依次计划，请在今日页调整后再加入');let added=0;for(const id of ids){if(plan.newIds.includes(id)||plan.reviewIds.includes(id))continue;(hasEventBefore(state,id,date)?plan.reviewIds:plan.newIds).push(id);added++;}plan.newTarget=Math.max(plan.newTarget,plan.newIds.length);plan.reviewTarget=Math.max(plan.reviewTarget,plan.reviewIds.length);plan.updatedAt=Date.now();persist();toast(\\`已加入今日计划 ${'${added}'} 个\\`);}`,
`function addFreeBadToToday(ids){const date=currentDayKey();const books=state.settings.todayBooks||[];let plan=ensureDailyPlan(state,planForTodayOptions(date,books));if(plan.mode==='sequential')return toast('当前是分本依次计划，请在今日页调整后再加入');let marked=0;for(const id of ids){const w=wordById(id);if(!w||!matchesBooks(w,books))continue;w.reviewHint=true;marked++;}plan=ensureDailyPlan(state,{date,books});let added=0;for(const id of ids){const w=wordById(id);if(!w||!matchesBooks(w,books))continue;plan.newIds=plan.newIds.filter(x=>x!==id);if(!plan.reviewIds.includes(id)){plan.reviewIds.push(id);added++;}}plan.reviewTarget=Math.max(plan.reviewTarget,plan.reviewIds.length);plan.updatedAt=Date.now();persist();toast(marked?\\`已作为复习词加入今日计划 ${'${added}'} 个\\`:'这些不熟词不在当前今日词书范围');}`,
'free bad review classification');
a = replaceOnce(a,
`hint.textContent=saved&&Number(saved.index)>0?\\`上次停在第 ${'${Number(saved.index)+1}'} 个；勾选“继续”即可接着听。\\`:'按词库顺序播放；自由听结果只保留本轮不熟列表。';`,
`hint.textContent=saved&&Number(saved.index)>0?\\`上次停在第 ${'${Number(saved.index)+1}'} 个；勾选“继续”即可接着听。\\`:'自由听按当前词库候选顺序播放；本轮不熟可加入今日复习。';`,
'free listen hint copy');
fs.writeFileSync('src/app.js', a);

const test = `import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDailyPlan } from '../src/queue.js';
import { defaultState, normalizeState } from '../src/storage.js';

function stateWithWords() {
  const s = defaultState();
  s.settings.defaultNewTarget = 3;
  s.settings.defaultReviewTarget = 2;
  s.words = [
    { id:'a', en:'alpha', sources:['A'], retired:false, card:null },
    { id:'b', en:'bravo', sources:['A'], retired:false, card:null },
    { id:'c', en:'charlie', sources:['A'], retired:false, card:null },
    { id:'d', en:'delta', sources:['A'], retired:false, card:null },
    { id:'e', en:'echo', sources:['B'], retired:false, card:null },
    { id:'f', en:'foxtrot', sources:['B'], retired:false, card:null },
    { id:'g', en:'golf', sources:['B'], retired:false, card:null },
    { id:'h', en:'hotel', sources:['B'], retired:false, card:null },
  ];
  return s;
}

test('new-word draw is stable within one scope but redraws when book scope changes', () => {
  const s = stateWithWords();
  const date = '2026-08-14';
  let p = ensureDailyPlan(s, { date, books:['A'] });
  const first = [...p.newIds];
  assert.equal(first.length, 3);
  assert.ok(first.every(id => ['a','b','c','d'].includes(id)));
  p = ensureDailyPlan(s, { date, books:['A'] });
  assert.deepEqual(p.newIds, first);
  p = ensureDailyPlan(s, { date, books:['B'] });
  assert.equal(p.newIds.length, 3);
  assert.ok(p.newIds.every(id => ['e','f','g','h'].includes(id)));
  const bDraw = [...p.newIds];
  p = ensureDailyPlan(s, { date, books:['A'] });
  assert.equal(p.newIds.length, 3);
  assert.ok(p.newIds.every(id => ['a','b','c','d'].includes(id)));
  assert.notDeepEqual(p.newIds, bDraw);
});

test('deselected book disappears from today plan while its learning event remains', () => {
  const s = stateWithWords();
  const date = '2026-08-14';
  let p = ensureDailyPlan(s, { date, books:['A'] });
  const heard = p.newIds[0];
  s.events.push({ id:'ev1', wordId:heard, date, ts:1, mode:'listen', result:'good', cold:true, attempt:1 });
  p = ensureDailyPlan(s, { date, books:['B'] });
  assert.ok(!p.newIds.includes(heard) && !p.reviewIds.includes(heard));
  assert.equal(s.events.some(e => e.wordId === heard), true);
  p = ensureDailyPlan(s, { date, books:['A'] });
  assert.ok(p.newIds.includes(heard));
});

test('promoted wrong words are review candidates, not new words, without inventing FSRS history', () => {
  const s = stateWithWords();
  s.words[0].reviewHint = true;
  const p = ensureDailyPlan(s, { date:'2026-08-14', books:['A'], newTarget:2, reviewTarget:2 });
  assert.ok(p.reviewIds.includes('a'));
  assert.ok(!p.newIds.includes('a'));
  assert.equal(s.events.length, 0);
});

test('reviewHint and drawNonce survive normalization', () => {
  const s = stateWithWords();
  s.words[0].reviewHint = true;
  s.dailyPlans['2026-08-14'] = { date:'2026-08-14', mode:'mixed', books:['A'], newTarget:2, reviewTarget:1, newIds:[], reviewIds:['a'], drawNonce:4 };
  const n = normalizeState(s);
  assert.equal(n.words[0].reviewHint, true);
  assert.equal(n.dailyPlans['2026-08-14'].drawNonce, 4);
});
`;
fs.writeFileSync('tests/v15.test.js', test);

console.log('v15 patches applied');
