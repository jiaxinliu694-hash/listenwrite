import { normalizeLexeme } from './sentencebooks.js';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))];
}
function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}
export function updateWordFields(word, patch = {}) {
  if (!word) return null;
  if ('zh' in patch) { word.zh = String(patch.zh || '').trim(); if (word.zh) word.needsMeaning = false; }
  if ('pos' in patch) word.pos = String(patch.pos || '').trim();
  if ('def' in patch) word.def = String(patch.def || '').trim();
  if ('sources' in patch) word.sources = unique(patch.sources);
  if ('examples' in patch) word.examples = unique(patch.examples);
  return word;
}
function removeId(list, wordId) {
  return (Array.isArray(list) ? list : []).filter((id) => id !== wordId);
}
export function deleteWordEverywhere(state, wordId) {
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return false;
  const lexeme = normalizeLexeme(word.en);
  state.words = state.words.filter((w) => w.id !== wordId);
  state.events = (state.events || []).filter((event) => event.wordId !== wordId);
  state.simpleWords = (state.simpleWords || []).filter((value) => normalizeLexeme(value) !== lexeme);
  for (const plan of Object.values(state.dailyPlans || {})) {
    plan.newIds = removeId(plan.newIds, wordId);
    plan.reviewIds = removeId(plan.reviewIds, wordId);
    plan.carryNewIds = removeId(plan.carryNewIds, wordId);
    plan.carryReviewIds = removeId(plan.carryReviewIds, wordId);
    if (plan.resumeWordId === wordId) plan.resumeWordId = null;
    for (const segment of plan.bookSegments || []) {
      segment.newIds = removeId(segment.newIds, wordId);
      segment.reviewIds = removeId(segment.reviewIds, wordId);
    }
  }
  return true;
}
export function replaceWordSources(word, sources) {
  if (!word) return null;
  word.sources = unique(sources);
  return word.sources;
}
export function deleteWordbook(state, book, { purgeExclusive = false } = {}) {
  const name = String(book || '').trim();
  if (!name) return { affected: 0, removedWords: 0, sharedWords: 0 };
  const matched = state.words.filter((w) => (w.sources || []).includes(name));
  let removedWords = 0;
  let sharedWords = 0;
  for (const word of [...matched]) {
    const otherSources = (word.sources || []).filter((source) => source !== name);
    if (purgeExclusive && otherSources.length === 0) {
      deleteWordEverywhere(state, word.id);
      removedWords += 1;
    } else {
      word.sources = otherSources;
      if (otherSources.length) sharedWords += 1;
    }
  }

  state.settings = state.settings || {};
  state.settings.todayBooks = (state.settings.todayBooks || []).filter((x) => x !== name);
  state.settings.typeBooks = (state.settings.typeBooks || []).filter((x) => x !== name);
  if (state.settings.freeListenProgress && typeof state.settings.freeListenProgress === 'object') delete state.settings.freeListenProgress[name];
  state.errorBooks = (state.errorBooks || []).filter((x) => x !== name);

  const events = state.events || [];
  for (const plan of Object.values(state.dailyPlans || {})) {
    const before = JSON.stringify(plan);
    plan.books = (plan.books || []).filter((x) => x !== name);
    if (plan.mode === 'sequential') {
      const removed = (plan.bookSegments || []).filter((segment) => segment.book === name);
      plan.bookSegments = (plan.bookSegments || []).filter((segment) => segment.book !== name);

      const heardOnPlanDay = (id) => Boolean(plan.date) && events.some((event) =>
        event.wordId === id && event.date === plan.date && event.mode === 'listen'
      );
      const removedNew = removed.flatMap((segment) => segment.newIds || []).filter(heardOnPlanDay);
      const removedReview = removed.flatMap((segment) => segment.reviewIds || []).filter(heardOnPlanDay);
      const segmentNew = uniqueIds(plan.bookSegments.flatMap((segment) => segment.newIds || []));
      const segmentReview = uniqueIds(plan.bookSegments.flatMap((segment) => segment.reviewIds || []))
        .filter((id) => !segmentNew.includes(id));
      const segmentIds = new Set([...segmentNew, ...segmentReview]);

      plan.carryNewIds = uniqueIds([...(plan.carryNewIds || []), ...removedNew])
        .filter((id) => !segmentIds.has(id) && state.words.some((word) => word.id === id));
      plan.carryReviewIds = uniqueIds([...(plan.carryReviewIds || []), ...removedReview])
        .filter((id) => !segmentIds.has(id) && !plan.carryNewIds.includes(id) && state.words.some((word) => word.id === id));
      plan.newIds = uniqueIds([...plan.carryNewIds, ...segmentNew]);
      plan.reviewIds = uniqueIds([...plan.carryReviewIds, ...segmentReview])
        .filter((id) => !plan.newIds.includes(id));
      plan.newTarget = plan.carryNewIds.length
        + plan.bookSegments.reduce((sum, segment) => sum + Math.max(0, Number(segment.newTarget) || 0), 0);
      plan.reviewTarget = plan.carryReviewIds.length
        + plan.bookSegments.reduce((sum, segment) => sum + Math.max(0, Number(segment.reviewTarget) || 0), 0);
      plan.books = plan.bookSegments.map((segment) => segment.book).filter(Boolean);
      if (plan.resumeWordId && !plan.newIds.includes(plan.resumeWordId) && !plan.reviewIds.includes(plan.resumeWordId)) plan.resumeWordId = null;
    }
    if (JSON.stringify(plan) !== before) plan.updatedAt = Date.now();
  }
  return { affected: matched.length, removedWords, sharedWords };
}
