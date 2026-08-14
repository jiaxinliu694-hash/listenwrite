import { advanceCard, emptyCard, rebuildCard } from './scheduler.js';
import { addStudyDays, calendarDayKey, isGraceWindow } from './studyday.js';

/** Pure calendar date in UTC+8. Use activeStudyDayKey() for live study state. */
export const dayKey = calendarDayKey;

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

/** Historical formal exposure used for new/review classification. */
export function hasEventBefore(state, wordId, date = dayKey()) {
  return state.events.some((e) => e.wordId === wordId && e.mode === 'listen' && e.date < date);
}

/** Any historical event, regardless of mode, for analytics-only callers. */
export function hasAnyEventBefore(state, wordId, date = dayKey()) {
  return state.events.some((e) => e.wordId === wordId && e.date < date);
}

/**
 * Whether the listening plan for a date has actually finished by a timestamp.
 * A failed final state remains unfinished. Retired words count as finished.
 */
export function isDailyPlanComplete(state, date, ts = Date.now()) {
  const plan = state.dailyPlans?.[date];
  if (!plan) return true;
  const ids = [...new Set([...(plan.newIds || []), ...(plan.reviewIds || [])])]
    .filter((id) => state.words.some((w) => w.id === id));
  if (!ids.length) return true;
  for (const id of ids) {
    const word = state.words.find((w) => w.id === id);
    if (word?.retired) continue;
    const latest = state.events
      .filter((e) => e.wordId === id && e.date === date && e.mode === 'listen' && e.ts <= ts)
      .sort((a, b) => a.ts - b.ts)
      .at(-1);
    if (!latest || latest.result !== 'good') return false;
  }
  return true;
}

/**
 * Live study-day state:
 * - normally switches at 24:00 Asia/Shanghai;
 * - from 00:00-01:59, an unfinished previous listening plan stays active;
 * - once that plan is completed, the very next action belongs to the new date;
 * - at 02:00, rollover is forced even if the previous plan is unfinished.
 */
export function activeStudyDayKey(state, ts = Date.now()) {
  const calendar = calendarDayKey(ts);
  if (!isGraceWindow(ts)) return calendar;
  const previous = addStudyDays(calendar, -1);
  const previousPlan = state?.dailyPlans?.[previous];
  if (!previousPlan) return calendar;
  return isDailyPlanComplete(state, previous, ts) ? calendar : previous;
}

export function recordAttempt(state, word, mode, result, context = {}) {
  const ts = context.ts || Date.now();
  const date = context.date || activeStudyDayKey(state, ts);
  // Cross-day scheduling is intentionally driven only by the first cold
  // listening judgment of the study day. Typing remains reinforcement/analytics.
  const cold = mode === 'listen' && !state.events.some((e) => e.wordId === word.id && e.date === date && e.mode === 'listen');
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
    word.card = events.some((e) => e.cold && e.mode === 'listen')
      ? rebuildCard(events, state.settings.retention)
      : (word.card || emptyCard());
  }
}

export function firstColdEventOnDay(state, wordId, date = dayKey()) {
  return state.events
    .filter((e) => e.wordId === wordId && e.date === date && e.mode === 'listen' && e.cold)
    .sort((a, b) => a.ts - b.ts)[0] || null;
}
