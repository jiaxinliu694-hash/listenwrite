const MAX_ACTIVE_GAP_MS = 90_000;

function activityById(state, id) {
  return (state?.activities || []).find((activity) => activity.id === id) || null;
}

export function startStudyActivity(state, mode, label, books = [], now = Date.now()) {
  if (!Array.isArray(state.activities)) state.activities = [];
  const activity = {
    id: `act_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    mode,
    label,
    books: [...books],
    date: null,
    start: now,
    lastTouch: now,
    activeMs: 0,
    active: true,
    end: null,
  };
  state.activities.push(activity);
  return activity.id;
}

export function setStudyActivityDate(state, id, date) {
  const activity = activityById(state, id);
  if (activity) activity.date = date;
  return activity;
}

export function flushStudyActivity(state, id, now = Date.now(), { maxGapMs = MAX_ACTIVE_GAP_MS } = {}) {
  const activity = activityById(state, id);
  if (!activity || !activity.active) return activity;
  const last = Number(activity.lastTouch) || Number(activity.start) || now;
  const delta = Math.max(0, Math.min(now - last, maxGapMs));
  activity.activeMs = Math.max(0, Number(activity.activeMs) || 0) + delta;
  activity.lastTouch = now;
  return activity;
}

export function pauseStudyActivity(state, id, now = Date.now()) {
  const activity = flushStudyActivity(state, id, now);
  if (!activity) return null;
  activity.active = false;
  activity.lastTouch = now;
  return activity;
}

export function resumeStudyActivity(state, id, now = Date.now()) {
  const activity = activityById(state, id);
  if (!activity || activity.end) return null;
  activity.active = true;
  activity.lastTouch = now;
  return activity;
}

export function finishStudyActivity(state, id, now = Date.now()) {
  const activity = flushStudyActivity(state, id, now);
  if (!activity) return null;
  activity.active = false;
  activity.end = now;
  activity.lastTouch = now;
  return activity;
}

export function studyActivityElapsedMs(state, id, now = Date.now(), visible = true) {
  const activity = activityById(state, id);
  if (!activity) return 0;
  let elapsed = Math.max(0, Number(activity.activeMs) || 0);
  if (visible && activity.active && !activity.end) {
    const last = Number(activity.lastTouch) || Number(activity.start) || now;
    elapsed += Math.max(0, Math.min(now - last, MAX_ACTIVE_GAP_MS));
  }
  return elapsed;
}

export function activityTotalMs(state, { mode = null, date = null } = {}) {
  return (state?.activities || []).reduce((sum, activity) => {
    if (mode && activity.mode !== mode) return sum;
    if (date && activity.date !== date) return sum;
    return sum + Math.max(0, Number(activity.activeMs) || 0);
  }, 0);
}

export function activityMinutes(state, mode = null, date = null) {
  const ms = activityTotalMs(state, { mode, date });
  return ms ? Math.max(1, Math.round(ms / 60_000)) : 0;
}

export function formatStudyTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeActivities(value, preserveDate, dayKey) {
  const now = Date.now();
  return (Array.isArray(value) ? value : []).map((activity) => ({
    ...activity,
    date: preserveDate && activity.date ? activity.date : dayKey(Number(activity.start) || Number(activity.lastTouch) || now),
    start: Number(activity.start) || now,
    lastTouch: Number(activity.lastTouch) || Number(activity.start) || now,
    activeMs: Math.max(0, Number(activity.activeMs) || 0),
    active: false,
    end: activity.end ? Number(activity.end) : null,
  }));
}
