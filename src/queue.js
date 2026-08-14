import { activeStudyDayKey, dayKey, eventsOnDay, hasEventBefore, latestEventOnDay } from './engine.js';
import { retrievability } from './scheduler.js';
import { addStudyDays, studyDayEnd, studyDayStart } from './studyday.js';

export function allBooks(state) {
  const set = new Set();
  for (const word of state.words) for (const source of word.sources || []) set.add(source);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function matchesBooks(word, books = []) {
  return !books.length || (word.sources || []).some((source) => books.includes(source));
}

export function planForDate(state, date = activeStudyDayKey(state)) {
  return state.dailyPlans[date] || null;
}

function sameBooks(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function listenedToday(state, id, date) {
  return state.events.some((e) => e.wordId === id && e.date === date && e.mode === 'listen');
}

function attemptedCount(state, ids, date) {
  return ids.filter((id) => listenedToday(state, id, date)).length;
}

function reviewHinted(word) {
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
  return `${date}|${scope}|${Number(nonce) || 0}`;
}

function randomRank(wordId, seed) {
  return hash32(`${seed}|${wordId}`);
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
}

function trimIdsToTarget(state, ids, date, target) {
  const attempted = ids.filter((id) => listenedToday(state, id, date));
  const untouched = ids.filter((id) => !listenedToday(state, id, date));
  const keepUntouched = Math.max(0, target - attempted.length);
  return [...attempted, ...untouched.slice(0, keepUntouched)];
}

function syncSequentialTotals(plan) {
  plan.newIds = [];
  plan.reviewIds = [];
  for (const segment of plan.bookSegments || []) {
    plan.newIds.push(...segment.newIds);
    plan.reviewIds.push(...segment.reviewIds);
  }
  plan.newIds = [...new Set(plan.newIds)];
  plan.reviewIds = [...new Set(plan.reviewIds.filter((id) => !plan.newIds.includes(id)))];
  plan.newTarget = (plan.bookSegments || []).reduce((sum, x) => sum + x.newTarget, 0);
  plan.reviewTarget = (plan.bookSegments || []).reduce((sum, x) => sum + x.reviewTarget, 0);
  plan.books = (plan.bookSegments || []).map((x) => x.book).filter(Boolean);
}

export function ensureDailyPlan(state, options = {}) {
  const date = options.date || activeStudyDayKey(state);
  let plan = state.dailyPlans[date];
  if (!plan) {
    plan = state.dailyPlans[date] = {
      date,
      mode: state.settings.todayPlanMode === 'sequential' ? 'sequential' : 'mixed',
      books: [...(options.books ?? state.settings.todayBooks ?? [])],
      newTarget: Math.max(0, Number(state.settings.defaultNewTarget) || 0),
      reviewTarget: Math.max(0, Number(state.settings.defaultReviewTarget) || 0),
      newIds: [],
      reviewIds: [],
      bookSegments: [],
      resumeWordId: null,
      drawNonce: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (options.mode === 'mixed' && plan.mode !== 'mixed') {
    convertPlanToMixed(state, plan, options.books ?? plan.books);
  }
  if (plan.mode === 'sequential') {
    plan.updatedAt = Date.now();
    syncSequentialTotals(plan);
    return plan;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'books')) reconcileScope(state, plan, options.books || []);
  seedTodayFromListenHistory(state, plan);
  moveHintedNewWordsToReview(state, plan);
  const minNew = attemptedCount(state, plan.newIds, plan.date);
  const minReview = attemptedCount(state, plan.reviewIds, plan.date);
  if (options.newTarget != null) plan.newTarget = Math.max(minNew, Math.max(0, Number(options.newTarget) || 0));
  else plan.newTarget = Math.max(minNew, Number(plan.newTarget) || 0);
  if (options.reviewTarget != null) plan.reviewTarget = Math.max(minReview, Math.max(0, Number(options.reviewTarget) || 0));
  else plan.reviewTarget = Math.max(minReview, Number(plan.reviewTarget) || 0);
  plan.newIds = restoreUntouchedNewRandomOrder(state, plan.newIds, plan.date, plan.books, plan.drawNonce);
  plan.newIds = trimIdsToTarget(state, plan.newIds, plan.date, plan.newTarget);
  plan.reviewIds = trimIdsToTarget(state, plan.reviewIds, plan.date, plan.reviewTarget);
  fillDailyPlan(state, plan);
  plan.updatedAt = Date.now();
  return plan;
}

export function fillDailyPlan(state, plan) {
  if (plan.mode === 'sequential') return fillSequentialPlan(state, plan);
  const assigned = new Set([...plan.newIds, ...plan.reviewIds]);
  const pool = state.words.filter((w) => !w.retired && matchesBooks(w, plan.books));
  const review = reviewCandidates(state, pool, assigned, plan.date, plan.books, plan.drawNonce);
  const fresh = freshCandidates(state, pool, assigned, plan.date, plan.books, plan.drawNonce);
  const needReview = Math.max(0, plan.reviewTarget - plan.reviewIds.length);
  const needNew = Math.max(0, plan.newTarget - plan.newIds.length);
  for (const w of review.slice(0, needReview)) { plan.reviewIds.push(w.id); assigned.add(w.id); }
  for (const w of fresh.slice(0, needNew)) { plan.newIds.push(w.id); assigned.add(w.id); }
  return plan;
}

export function configureSequentialPlan(state, plan, configs = []) {
  const clean = [];
  const seenBooks = new Set();
  for (const row of configs) {
    const book = String(row.book || '').trim();
    if (!book || seenBooks.has(book)) continue;
    seenBooks.add(book);
    const prior = (plan.bookSegments || []).find((x) => x.book === book);
    clean.push({
      id: prior?.id || `seg_${Math.random().toString(36).slice(2, 9)}`,
      book,
      newTarget: Math.max(0, Number(row.newTarget ?? prior?.newTarget) || 0),
      reviewTarget: Math.max(0, Number(row.reviewTarget ?? prior?.reviewTarget) || 0),
      newIds: prior?.newIds ? [...prior.newIds] : [],
      reviewIds: prior?.reviewIds ? [...prior.reviewIds] : [],
    });
  }
  plan.mode = 'sequential';
  plan.bookSegments = clean;
  fillSequentialPlan(state, plan);
  plan.updatedAt = Date.now();
  return plan;
}

export function fillSequentialPlan(state, plan) {
  const assigned = new Set();
  for (const segment of plan.bookSegments || []) {
    const pool = state.words.filter((w) => !w.retired && (w.sources || []).includes(segment.book));
    const valid = new Set(pool.map((w) => w.id));
    segment.newIds = segment.newIds.filter((id) => valid.has(id) && !assigned.has(id));
    segment.reviewIds = segment.reviewIds.filter((id) => valid.has(id) && !assigned.has(id));

    const minNew = attemptedCount(state, segment.newIds, plan.date);
    const minReview = attemptedCount(state, segment.reviewIds, plan.date);
    segment.newTarget = Math.max(minNew, Math.max(0, Number(segment.newTarget) || 0));
    segment.reviewTarget = Math.max(minReview, Math.max(0, Number(segment.reviewTarget) || 0));
    segment.newIds = restoreUntouchedNewRandomOrder(state, segment.newIds, plan.date, [segment.book], plan.drawNonce);
    segment.newIds = trimIdsToTarget(state, segment.newIds, plan.date, segment.newTarget);
    segment.reviewIds = trimIdsToTarget(state, segment.reviewIds, plan.date, segment.reviewTarget);
    segment.newIds.forEach((id) => assigned.add(id));
    segment.reviewIds.forEach((id) => assigned.add(id));

    const review = reviewCandidates(state, pool, assigned, plan.date, [segment.book], plan.drawNonce);
    for (const w of review.slice(0, Math.max(0, segment.reviewTarget - segment.reviewIds.length))) {
      segment.reviewIds.push(w.id);
      assigned.add(w.id);
    }
    const fresh = freshCandidates(state, pool, assigned, plan.date, [segment.book], plan.drawNonce);
    for (const w of fresh.slice(0, Math.max(0, segment.newTarget - segment.newIds.length))) {
      segment.newIds.push(w.id);
      assigned.add(w.id);
    }
  }
  syncSequentialTotals(plan);
  return plan;
}

export function convertPlanToMixed(state, plan, books = []) {
  const attemptedNew = plan.newIds.filter((id) => listenedToday(state, id, plan.date));
  const attemptedReview = plan.reviewIds.filter((id) => listenedToday(state, id, plan.date));
  plan.mode = 'mixed';
  plan.bookSegments = [];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
  plan.books = [...books];
  plan.newTarget = Math.max(attemptedNew.length, Number(state.settings.defaultNewTarget) || 0);
  plan.reviewTarget = Math.max(attemptedReview.length, Number(state.settings.defaultReviewTarget) || 0);
  plan.newIds = attemptedNew;
  plan.reviewIds = attemptedReview;
  fillDailyPlan(state, plan);
  plan.updatedAt = Date.now();
  return plan;
}

export function latestListenResult(state, wordId, date = activeStudyDayKey(state)) {
  return latestEventOnDay(state, wordId, date, 'listen');
}

function statusForIds(state, ids, date) {
  const wordMap = new Map(state.words.map((w) => [w.id, w]));
  let done = 0, retry = 0, pending = 0;
  const doneIds = [], retryIds = [], pendingIds = [];
  for (const id of ids) {
    const word = wordMap.get(id);
    if (!word) continue;
    if (word.retired) { done++; doneIds.push(id); continue; }
    const last = latestListenResult(state, id, date);
    if (!last) { pending++; pendingIds.push(id); }
    else if (last.result === 'good') { done++; doneIds.push(id); }
    else { retry++; retryIds.push(id); }
  }
  return { done, retry, pending, doneIds, retryIds, pendingIds };
}

export function planStatus(state, plan) {
  return {
    new: statusForIds(state, plan.newIds, plan.date),
    review: statusForIds(state, plan.reviewIds, plan.date),
  };
}

export function segmentStatus(state, plan, segment) {
  return {
    new: statusForIds(state, segment.newIds, plan.date),
    review: statusForIds(state, segment.reviewIds, plan.date),
  };
}

export function currentSequentialSegment(state, plan) {
  if (plan.mode !== 'sequential') return null;
  for (const segment of plan.bookSegments || []) {
    const s = segmentStatus(state, plan, segment);
    if (s.new.pending + s.new.retry + s.review.pending + s.review.retry > 0) return segment;
  }
  return null;
}

export function todayListeningStats(state, books = [], date = activeStudyDayKey(state)) {
  const allowed = new Set(state.words.filter((w) => matchesBooks(w, books)).map((w) => w.id));
  const events = state.events.filter((e) => e.date === date && e.mode === 'listen' && allowed.has(e.wordId));
  const ids = [...new Set(events.map((e) => e.wordId))];
  let newCount = 0, reviewCount = 0, firstGood = 0, firstBad = 0;
  for (const id of ids) {
    const word = state.words.find((w) => w.id === id);
    if (reviewKnown(state, word, date)) reviewCount++;
    else newCount++;
    const first = eventsOnDay(state, id, date, 'listen')[0];
    if (first?.result === 'good') firstGood++;
    else if (first) firstBad++;
  }
  return { events, ids, newCount, reviewCount, firstGood, firstBad };
}

export function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {
  const planIds = explicitIds || [...plan.reviewIds, ...plan.newIds];
  const wordMap = new Map(state.words.map((w) => [w.id, w]));
  const pendingBase = [];
  const retry = [];
  if (explicitIds) {
    for (const id of [...new Set(planIds)]) {
      const word = wordMap.get(id);
      if (word && !word.retired) pendingBase.push(id);
    }
  } else {
    for (const id of planIds) {
      const word = wordMap.get(id);
      if (!word || word.retired) continue;
      const last = latestEventOnDay(state, id, plan.date, mode);
      if (!last) pendingBase.push(id);
      else if (last.result === 'bad') retry.push({ wordId: id, attempt: eventsOnDay(state, id, plan.date, mode).length, eligibleTurn: 0, addedAt: last.ts });
    }
    if (plan.resumeWordId) {
      const i = pendingBase.indexOf(plan.resumeWordId);
      if (i > 0) pendingBase.unshift(pendingBase.splice(i, 1)[0]);
    }
  }
  return { mode, date: plan.date, fixedIds: [...new Set(planIds)], pendingBase, retry, turn: 0, current: null, history: [] };
}

function retryGap(attempt) {
  if (attempt <= 1) return 4;
  if (attempt === 2) return 6;
  return 8;
}

export function pickNext(session) {
  if (session.current) return session.current.wordId;
  const due = session.retry.filter((x) => x.eligibleTurn <= session.turn).sort((a, b) => a.eligibleTurn - b.eligibleTurn || a.addedAt - b.addedAt)[0];
  if (due) {
    session.retry = session.retry.filter((x) => x !== due);
    session.current = { wordId: due.wordId, source: 'retry', attempt: due.attempt + 1 };
    return due.wordId;
  }
  const baseId = session.pendingBase.shift();
  if (baseId) {
    session.current = { wordId: baseId, source: 'base', attempt: 1 };
    return baseId;
  }
  const nextRetry = session.retry.sort((a, b) => a.eligibleTurn - b.eligibleTurn || a.addedAt - b.addedAt).shift();
  if (nextRetry) {
    session.current = { wordId: nextRetry.wordId, source: 'retry', attempt: nextRetry.attempt + 1 };
    return nextRetry.wordId;
  }
  return null;
}

export function finishCurrent(session, result) {
  if (!session.current) return;
  const current = session.current;
  session.history.push({ ...current, result, turn: session.turn });
  session.turn += 1;
  session.retry = session.retry.filter((x) => x.wordId !== current.wordId);
  if (result === 'bad') session.retry.push({ wordId: current.wordId, attempt: current.attempt, eligibleTurn: session.turn + retryGap(current.attempt), addedAt: Date.now() });
  session.current = null;
}

export function resyncRetryForWord(session, state, wordId, date = session?.date, mode = session?.mode || 'listen') {
  if (!session || !wordId) return;
  session.retry = (session.retry || []).filter((x) => x.wordId !== wordId);
  const last = latestEventOnDay(state, wordId, date, mode);
  if (!last || last.result !== 'bad') return;
  if (session.current?.wordId === wordId || (session.pendingBase || []).includes(wordId)) return;
  session.retry.push({
    wordId,
    attempt: eventsOnDay(state, wordId, date, mode).length,
    eligibleTurn: session.turn,
    addedAt: last.ts,
  });
}

export function sessionProgress(state, plan, session) {
  const status = planStatus(state, plan);
  return {
    newDone: status.new.done,
    newTotal: plan.newIds.length,
    reviewDone: status.review.done,
    reviewTotal: plan.reviewIds.length,
    retry: status.new.retry + status.review.retry,
    remaining: status.new.pending + status.review.pending + status.new.retry + status.review.retry,
    turn: session?.turn || 0,
  };
}

export function dueForecast(state, days = 7) {
  const today = activeStudyDayKey(state);
  const out = Array.from({ length: days }, (_, i) => ({ date: addStudyDays(today, i), count: 0 }));
  const start = studyDayStart(today);
  for (const word of state.words) {
    if (word.retired || !(word.card?.reps || 0)) continue;
    const due = Number(word.card.due);
    const key = dayKey(due);
    const row = out.find((x) => x.date === key);
    if (row) row.count++;
    else if (due < start) out[0].count++;
  }
  return out;
}
