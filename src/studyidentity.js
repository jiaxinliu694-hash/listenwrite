import { eventsOnDay, hasEventBefore } from './engine.js';
import { reinforcementState } from './reinforcement.js';

export function isReviewHinted(word) {
  return Boolean(word?.reviewHint) || (word?.sources || []).some((source) => /错题|错词|error/i.test(source));
}

export function wordStudyKind(state, wordOrId, date) {
  const word = typeof wordOrId === 'string'
    ? state.words.find((w) => w.id === wordOrId)
    : wordOrId;
  if (!word) return 'new';
  return hasEventBefore(state, word.id, date) || isReviewHinted(word) ? 'review' : 'new';
}

export function wordPassedOnDay(state, wordOrId, date) {
  const wordId = typeof wordOrId === 'string' ? wordOrId : wordOrId?.id;
  if (!wordId) return false;
  return reinforcementState(eventsOnDay(state, wordId, date, 'listen')).passed;
}
