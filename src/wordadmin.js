function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))];
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
  state.words = state.words.filter((w) => w.id !== wordId);
  state.events = (state.events || []).filter((event) => event.wordId !== wordId);
  state.simpleWords = (state.simpleWords || []).filter((lexeme) => lexeme !== word.en);
  for (const plan of Object.values(state.dailyPlans || {})) {
    plan.newIds = removeId(plan.newIds, wordId);
    plan.reviewIds = removeId(plan.reviewIds, wordId);
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
  for (const plan of Object.values(state.dailyPlans || {})) {
    plan.books = (plan.books || []).filter((x) => x !== name);
    if (plan.mode === 'sequential') {
      plan.bookSegments = (plan.bookSegments || []).filter((segment) => segment.book !== name);
      plan.newIds = [...new Set((plan.bookSegments || []).flatMap((segment) => segment.newIds || []))];
      plan.reviewIds = [...new Set((plan.bookSegments || []).flatMap((segment) => segment.reviewIds || []))];
    }
  }
  return { affected: matched.length, removedWords, sharedWords };
}
