function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))];
}

export function updateWordFields(word, patch = {}) {
  if (!word) return null;
  if ('zh' in patch) word.zh = String(patch.zh || '').trim();
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
