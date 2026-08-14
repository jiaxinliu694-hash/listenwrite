export function freeListenCandidates(state, book, { scope = 'all', limit = 0 } = {}) {
  const listened = new Set((state.events || []).filter((e) => e.mode === 'listen').map((e) => e.wordId));
  let ids = (state.words || [])
    .filter((w) => !w.retired && (w.sources || []).includes(book))
    .filter((w) => scope !== 'unheard' || !listened.has(w.id))
    .map((w) => w.id);
  if (Number(limit) > 0) ids = ids.slice(0, Number(limit));
  return ids;
}

export function linkedSentenceSourceState(state, entry) {
  if (!entry?.sourceTextId) return 'standalone';
  const text = (state.texts || []).find((t) => t.id === entry.sourceTextId);
  if (!text) return 'source-deleted';
  if (!entry.sourceSentenceId) return 'legacy-link';
  const exists = (text.sentences || []).some((row) => row.id === entry.sourceSentenceId);
  return exists ? 'linked' : 'source-changed';
}

export function staleLinkedSentenceCount(state) {
  let count = 0;
  for (const book of state.sentenceBooks || []) {
    for (const entry of book.entries || []) {
      const status = linkedSentenceSourceState(state, entry);
      if (status === 'source-deleted' || status === 'source-changed') count += 1;
    }
  }
  return count;
}

export function removeStaleLinkedSentences(state) {
  let removed = 0;
  state.sentenceBooks = (state.sentenceBooks || []).map((book) => {
    const entries = (book.entries || []).filter((entry) => {
      const status = linkedSentenceSourceState(state, entry);
      const stale = status === 'source-deleted' || status === 'source-changed';
      if (stale) removed += 1;
      return !stale;
    });
    return { ...book, entries };
  }).filter((book) => (book.entries || []).length > 0);
  return removed;
}
