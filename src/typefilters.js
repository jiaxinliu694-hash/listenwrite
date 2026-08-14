import { retrievability } from './scheduler.js';
import { addStudyDays } from './studyday.js';
import { wordStudyKind } from './studyidentity.js';

function unique(ids) { return [...new Set(ids)]; }

export function typePresetIds(state, candidates, kind, today, plan = null) {
  const allowed = new Set(candidates.map((w) => w.id));
  const heard = (ids) => unique((ids || []).filter((id) => allowed.has(id) && state.events.some((e) => e.wordId === id && e.date === today && e.mode === 'listen')));
  const heardPlanIds = heard([...(plan?.newIds || []), ...(plan?.reviewIds || [])]);
  if (kind === 'todayNew') return heardPlanIds.filter((id) => wordStudyKind(state, id, today) === 'new');
  if (kind === 'todayReview') return heardPlanIds.filter((id) => wordStudyKind(state, id, today) === 'review');
  if (kind === 'todayListen') return unique(state.events.filter((e) => e.date === today && e.mode === 'listen' && e.result === 'bad' && allowed.has(e.wordId)).map((e) => e.wordId));
  if (kind === 'todayType') return unique(state.events.filter((e) => e.date === today && e.mode === 'type' && e.result === 'bad' && allowed.has(e.wordId)).map((e) => e.wordId));

  const sevenDayStart = addStudyDays(today, -6);
  const recentEvents = state.events.filter((e) => e.date >= sevenDayStart);
  if (kind === 'repeat7') {
    const bad = recentEvents.filter((e) => e.result === 'bad' && allowed.has(e.wordId));
    return candidates
      .map((w) => ({ id: w.id, ev: bad.filter((e) => e.wordId === w.id) }))
      .filter((x) => x.ev.length >= 2 || new Set(x.ev.map((e) => e.date)).size >= 2)
      .sort((a, b) => b.ev.length - a.ev.length)
      .map((x) => x.id);
  }

  return candidates
    .map((w) => {
      const ev = state.events.filter((e) => e.wordId === w.id);
      const coldBad = ev.filter((e) => e.mode === 'listen' && e.cold && e.result === 'bad').length;
      const bad = ev.filter((e) => e.result === 'bad').length;
      const recent = recentEvents.filter((e) => e.wordId === w.id && e.result === 'bad').length;
      const r = retrievability(w.card, Date.now(), state.settings.retention);
      return { id: w.id, score: coldBad * 5 + bad + recent * 1.5 + (w.card?.reps ? (1 - r) * 2 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

export function customTypeIdsFromEvents(events, allowedIds, { date, mode = 'all', min = 1 } = {}) {
  const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds || []);
  const groups = new Map();
  for (const e of events || []) {
    if (e.date !== date || e.result !== 'bad' || !allowed.has(e.wordId) || (mode !== 'all' && e.mode !== mode)) continue;
    groups.set(e.wordId, (groups.get(e.wordId) || 0) + 1);
  }
  return [...groups.entries()]
    .filter(([, n]) => n >= Math.max(1, Number(min) || 1))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
