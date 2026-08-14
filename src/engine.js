import { advanceCard, emptyCard, rebuildCard } from './scheduler.js';
import { studyDayKey } from './studyday.js';

export const dayKey = studyDayKey;

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function wordEvents(state, wordId) {
  return state.events.filter((e) => e.wordId === wordId).sort((a, b) => a.ts - b.ts);
}

export function eventsOnDay(state, wordId, date = dayKey(), mode = null) {
  return state.events
    .filter((e) => e.wordId === wordId && e.date === date && (!mode || e.mode === mode))
    .sort((a, b) => a.ts - b.ts);
}

export function latestEventOnDay(state, wordId, date = dayKey(), mode = null) {
  const list = eventsOnDay(state, wordId, date, mode);
  return list[list.length - 1] || null;
}

export function hasEventBefore(state, wordId, date = dayKey()) {
  return state.events.some((e) => e.wordId === wordId && e.date < date);
}

export function recordAttempt(state, word, mode, result, context = {}) {
  const ts = context.ts || Date.now();
  const date = dayKey(ts);
  const cold = !state.events.some((e) => e.wordId === word.id && e.date === date);
  const attempt = eventsOnDay(state, word.id, date, mode).length + 1;
  const event = {
    id: uid('ev'),
    wordId: word.id,
    date,
    ts,
    mode,
    result,
    originalResult: result,
    cold,
    attempt,
    source: context.source || null,
    sentence: context.sentence || null,
    editedAt: null,
  };
  state.events.push(event);
  if (!word.card) word.card = emptyCard(ts);
  if (cold) word.card = advanceCard(word.card, event, state.settings.retention);
  return event;
}

export function editAttempt(state, eventId, result) {
  const event = state.events.find((e) => e.id === eventId);
  if (!event || event.result === result) return event || null;
  event.result = result;
  event.editedAt = Date.now();
  const word = state.words.find((w) => w.id === event.wordId);
  if (word && event.cold) word.card = rebuildCard(wordEvents(state, word.id), state.settings.retention);
  return event;
}

export function rebuildAllCards(state) {
  for (const word of state.words) {
    const events = wordEvents(state, word.id);
    word.card = events.some((e) => e.cold)
      ? rebuildCard(events, state.settings.retention)
      : (word.card || emptyCard());
  }
}

export function firstColdEventOnDay(state, wordId, date = dayKey()) {
  return state.events
    .filter((e) => e.wordId === wordId && e.date === date && e.cold)
    .sort((a, b) => a.ts - b.ts)[0] || null;
}
