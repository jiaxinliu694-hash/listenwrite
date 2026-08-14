import fs from 'node:fs';

function patch(path, from, to) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(from)) throw new Error(`Missing pattern in ${path}`);
  s = s.replace(from, to);
  fs.writeFileSync(path, s);
}

patch('src/queue.js',
`function reconcileScope(state, plan, books) {
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
}`,
`function reconcileScope(state, plan, books) {
  if (sameBooks(plan.books, books)) return;
  const previousBooks = [...(plan.books || [])];
  // Changing today's book scope redraws untouched tasks. Events/history stay intact.
  // Touched words survive only when they belong to the newly selected scope.
  const keepTouchedInScope = (id) => {
    const word = state.words.find((w) => w.id === id);
    return Boolean(word) && listenedToday(state, id, plan.date) && matchesBooks(word, books);
  };
  const survivingNew = plan.newIds.filter(keepTouchedInScope);
  const survivingReview = plan.reviewIds.filter(keepTouchedInScope);
  // If a word was first encountered under another scope and only re-enters through a
  // different selected book, it is no longer a fresh word for this scope. Keep the
  // same word/history, but classify it as review. A scope expansion that still shares
  // one of the word's previously selected books keeps its original new-word identity.
  const movedToReview = [];
  plan.newIds = survivingNew.filter((id) => {
    const word = state.words.find((w) => w.id === id);
    const hasContinuousSelectedSource = Boolean(word) && (word.sources || []).some(
      (source) => previousBooks.includes(source) && books.includes(source),
    );
    if (hasContinuousSelectedSource) return true;
    movedToReview.push(id);
    return false;
  });
  plan.reviewIds = [...new Set([...survivingReview, ...movedToReview])];
  plan.resumeWordId = keepTouchedInScope(plan.resumeWordId) ? plan.resumeWordId : null;
  plan.books = [...books];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
}`);

console.log('v18 patches applied');
