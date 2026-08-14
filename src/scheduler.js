import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

export const FSRS_VERSION = 'ts-fsrs@5.4.1';

export function createScheduler(retention = 0.9) {
  return fsrs({
    request_retention: Math.min(0.97, Math.max(0.75, Number(retention) || 0.9)),
    maximum_interval: 36500,
    enable_fuzz: true,
    enable_short_term: false,
    learning_steps: [],
    relearning_steps: [],
  });
}

export function emptyCard(now = Date.now()) {
  return serializeCard(createEmptyCard(new Date(now)));
}

export function serializeCard(card) {
  return {
    due: new Date(card.due).getTime(),
    stability: Number(card.stability) || 0,
    difficulty: Number(card.difficulty) || 0,
    elapsed_days: Number(card.elapsed_days) || 0,
    scheduled_days: Number(card.scheduled_days) || 0,
    reps: Number(card.reps) || 0,
    lapses: Number(card.lapses) || 0,
    learning_steps: Number(card.learning_steps) || 0,
    state: Number(card.state) || 0,
    last_review: card.last_review ? new Date(card.last_review).getTime() : null,
  };
}

export function hydrateCard(card, now = Date.now()) {
  if (!card) return createEmptyCard(new Date(now));
  return {
    due: new Date(Number(card.due) || now),
    stability: Number(card.stability) || 0,
    difficulty: Number(card.difficulty) || 0,
    elapsed_days: Number(card.elapsed_days) || 0,
    scheduled_days: Number(card.scheduled_days) || 0,
    reps: Number(card.reps) || 0,
    lapses: Number(card.lapses) || 0,
    learning_steps: Number(card.learning_steps) || 0,
    state: Number(card.state) || 0,
    last_review: card.last_review ? new Date(Number(card.last_review)) : undefined,
  };
}

export function gradeFromResult(result) {
  return result === 'bad' ? Rating.Again : Rating.Good;
}

export function advanceCard(card, event, retention = 0.9) {
  const scheduler = createScheduler(retention);
  const result = scheduler.next(
    hydrateCard(card, event.ts),
    new Date(event.ts),
    gradeFromResult(event.result),
  );
  return serializeCard(result.card);
}

export function rebuildCard(events, retention = 0.9) {
  const cold = [...events]
    .filter((event) => event.cold && (event.result === 'good' || event.result === 'bad'))
    .sort((a, b) => a.ts - b.ts);
  let card = emptyCard(cold[0]?.ts || Date.now());
  for (const event of cold) card = advanceCard(card, event, retention);
  return card;
}

export function retrievability(card, now = Date.now(), retention = 0.9) {
  if (!card || !card.reps) return 0;
  try {
    return createScheduler(retention).get_retrievability(hydrateCard(card, now), new Date(now), false);
  } catch {
    return 0;
  }
}

export function dueToday(card, now = Date.now()) {
  if (!card || !card.reps) return false;
  const d = new Date(now);
  const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return Number(card.due) < tomorrow;
}
