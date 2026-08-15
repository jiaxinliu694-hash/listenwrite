export const DATA_CHART_REQUIRED_GOOD_STREAK = 3;
export const DATA_CHART_RETRY_GAP = 3;

export function emptyDataChartState() {
  return {
    version: 1,
    contentVersionSeen: null,
    settings: {
      dailyLearnSections: 1,
      dailyReviewSections: 2,
      mixedLimit: 40,
    },
    items: {},
    sections: {},
    attempts: [],
    daily: {},
    session: null,
  };
}

function normalizeItemProgress(raw = {}) {
  const hadBad = Boolean(raw.hadBad) || Number(raw.badCount) > 0;
  const goodStreak = Math.max(0, Number(raw.goodStreak) || 0);
  let status = raw.status;
  if (!['unseen', 'mastered', 'reinforcing'].includes(status)) {
    if (!raw.lastResult && !raw.firstSeenAt && !raw.lastSeenAt && !Number(raw.goodCount) && !Number(raw.badCount)) status = 'unseen';
    else status = hadBad && goodStreak < DATA_CHART_REQUIRED_GOOD_STREAK ? 'reinforcing' : 'mastered';
  }
  if (status === 'reinforcing' && !hadBad) status = 'unseen';
  if (status === 'mastered' && hadBad && goodStreak < DATA_CHART_REQUIRED_GOOD_STREAK) status = 'reinforcing';
  return {
    status,
    hadBad,
    goodStreak,
    goodCount: Math.max(0, Number(raw.goodCount) || 0),
    badCount: Math.max(0, Number(raw.badCount) || 0),
    firstSeenAt: Number(raw.firstSeenAt) || null,
    lastSeenAt: Number(raw.lastSeenAt) || null,
    lastResult: raw.lastResult === 'bad' ? 'bad' : raw.lastResult === 'good' ? 'good' : null,
  };
}

function normalizeSectionProgress(raw = {}) {
  return {
    startedAt: Number(raw.startedAt) || null,
    completedAt: Number(raw.completedAt) || null,
    lastReviewedAt: Number(raw.lastReviewedAt) || null,
    reviewCount: Math.max(0, Number(raw.reviewCount) || 0),
  };
}

function normalizeDaily(raw = {}) {
  return {
    learnedSectionIds: [...new Set(Array.isArray(raw.learnedSectionIds) ? raw.learnedSectionIds.filter(Boolean) : [])],
    reviewedSectionIds: [...new Set(Array.isArray(raw.reviewedSectionIds) ? raw.reviewedSectionIds.filter(Boolean) : [])],
  };
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = ['learn', 'review', 'weak', 'mix'].includes(raw.mode) ? raw.mode : 'review';
  return {
    id: String(raw.id || `dc_session_${Date.now().toString(36)}`),
    mode,
    label: String(raw.label || ''),
    sectionIds: [...new Set(Array.isArray(raw.sectionIds) ? raw.sectionIds.filter(Boolean) : [])],
    itemIds: [...new Set(Array.isArray(raw.itemIds) ? raw.itemIds.filter(Boolean) : [])],
    queue: Array.isArray(raw.queue) ? raw.queue.filter(Boolean) : [],
    retry: Array.isArray(raw.retry) ? raw.retry.filter(x => x?.id).map(x => ({ id: x.id, dueTurn: Math.max(0, Number(x.dueTurn) || 0) })) : [],
    currentId: raw.currentId || null,
    turn: Math.max(0, Number(raw.turn) || 0),
    seenItemIds: [...new Set(Array.isArray(raw.seenItemIds) ? raw.seenItemIds.filter(Boolean) : [])],
    good: Math.max(0, Number(raw.good) || 0),
    bad: Math.max(0, Number(raw.bad) || 0),
    startedAt: Number(raw.startedAt) || Date.now(),
    completedAt: Number(raw.completedAt) || null,
    date: String(raw.date || ''),
    activityId: raw.activityId || null,
  };
}

export function normalizeDataChartState(raw) {
  const base = emptyDataChartState();
  const src = raw && typeof raw === 'object' ? raw : {};
  const items = {};
  for (const [id, value] of Object.entries(src.items || {})) items[id] = normalizeItemProgress(value);
  const sections = {};
  for (const [id, value] of Object.entries(src.sections || {})) sections[id] = normalizeSectionProgress(value);
  const daily = {};
  for (const [date, value] of Object.entries(src.daily || {})) daily[date] = normalizeDaily(value);
  const attempts = (Array.isArray(src.attempts) ? src.attempts : []).filter(x => x?.itemId && x?.sectionId).map((x, index) => ({
    id: String(x.id || `dc_attempt_${index}`),
    itemId: x.itemId,
    sectionId: x.sectionId,
    date: String(x.date || ''),
    ts: Number(x.ts) || Date.now(),
    result: x.result === 'bad' ? 'bad' : 'good',
  })).sort((a, b) => a.ts - b.ts);
  return {
    version: 1,
    contentVersionSeen: src.contentVersionSeen || null,
    settings: {
      dailyLearnSections: Math.min(10, Math.max(0, Number(src.settings?.dailyLearnSections ?? base.settings.dailyLearnSections) || 0)),
      dailyReviewSections: Math.min(20, Math.max(0, Number(src.settings?.dailyReviewSections ?? base.settings.dailyReviewSections) || 0)),
      mixedLimit: [20, 40, 60, 0].includes(Number(src.settings?.mixedLimit)) ? Number(src.settings.mixedLimit) : base.settings.mixedLimit,
    },
    items,
    sections,
    attempts,
    daily,
    session: normalizeSession(src.session),
  };
}

export function dataChartSections(seed) {
  return (seed?.chapters || []).flatMap((chapter) => (chapter.sections || []).map((section) => ({
    ...section,
    chapterId: chapter.id,
    chapterNum: chapter.num,
    chapterTitle: chapter.title,
  })));
}

export function dataChartSectionById(seed, sectionId) {
  return dataChartSections(seed).find(section => section.id === sectionId) || null;
}

export function dataChartItemById(seed, itemId) {
  for (const section of dataChartSections(seed)) {
    const item = (section.items || []).find(row => row.id === itemId);
    if (item) return { section, item };
  }
  return null;
}

export function dataChartItemProgress(dataChart, itemId) {
  return normalizeItemProgress(dataChart?.items?.[itemId] || {});
}

export function dataChartItemLabel(dataChart, itemId) {
  const p = dataChartItemProgress(dataChart, itemId);
  if (p.status === 'unseen') return '未学';
  if (p.status === 'reinforcing') return `强化 ${p.goodStreak}/${DATA_CHART_REQUIRED_GOOD_STREAK}`;
  return '会';
}

export function dataChartSectionProgress(dataChart, section) {
  const rows = (section?.items || []).map(item => dataChartItemProgress(dataChart, item.id));
  const total = rows.length;
  const mastered = rows.filter(x => x.status === 'mastered').length;
  const reinforcing = rows.filter(x => x.status === 'reinforcing').length;
  const unseen = total - mastered - reinforcing;
  const meta = normalizeSectionProgress(dataChart?.sections?.[section?.id] || {});
  return { total, mastered, reinforcing, unseen, complete: total > 0 && mastered === total, ...meta };
}

export function dataChartWeakItemIds(dataChart, seed) {
  return dataChartSections(seed).flatMap(section => (section.items || []).filter(item => dataChartItemProgress(dataChart, item.id).status === 'reinforcing').map(item => item.id));
}

export function dataChartLearnedSectionIds(dataChart, seed) {
  return dataChartSections(seed).filter(section => Boolean(dataChartSectionProgress(dataChart, section).completedAt)).map(section => section.id);
}

export function nextDataChartLearningSection(dataChart, seed) {
  return dataChartSections(seed).find(section => {
    const p = dataChartSectionProgress(dataChart, section);
    return !p.completedAt || p.unseen > 0;
  }) || null;
}

function ensureSectionMeta(dataChart, sectionId) {
  if (!dataChart.sections[sectionId]) dataChart.sections[sectionId] = normalizeSectionProgress({});
  return dataChart.sections[sectionId];
}

function ensureDaily(dataChart, date) {
  if (!dataChart.daily[date]) dataChart.daily[date] = normalizeDaily({});
  return dataChart.daily[date];
}

export function markDataChartSectionStarted(dataChart, sectionId, ts = Date.now()) {
  const meta = ensureSectionMeta(dataChart, sectionId);
  if (!meta.startedAt) meta.startedAt = ts;
  return meta;
}

export function markDataChartSectionCompleted(dataChart, sectionId, date, ts = Date.now()) {
  const meta = ensureSectionMeta(dataChart, sectionId);
  if (!meta.startedAt) meta.startedAt = ts;
  const first = !meta.completedAt;
  if (first) {
    meta.completedAt = ts;
    const day = ensureDaily(dataChart, date);
    if (!day.learnedSectionIds.includes(sectionId)) day.learnedSectionIds.push(sectionId);
  }
  return first;
}

export function markDataChartSectionReviewed(dataChart, sectionId, date, ts = Date.now()) {
  const meta = ensureSectionMeta(dataChart, sectionId);
  meta.lastReviewedAt = ts;
  meta.reviewCount = Math.max(0, Number(meta.reviewCount) || 0) + 1;
  const day = ensureDaily(dataChart, date);
  if (!day.reviewedSectionIds.includes(sectionId)) day.reviewedSectionIds.push(sectionId);
  return meta;
}

export function dataChartDailySummary(dataChart, date) {
  const day = normalizeDaily(dataChart?.daily?.[date] || {});
  return {
    learned: day.learnedSectionIds.length,
    reviewed: day.reviewedSectionIds.length,
    learnedSectionIds: day.learnedSectionIds,
    reviewedSectionIds: day.reviewedSectionIds,
  };
}

export function gradeDataChartItem(dataChart, { itemId, sectionId, result, date, ts = Date.now() }) {
  if (!dataChart.items) dataChart.items = {};
  if (!Array.isArray(dataChart.attempts)) dataChart.attempts = [];
  let p = dataChartItemProgress(dataChart, itemId);
  if (!p.firstSeenAt) p.firstSeenAt = ts;
  p.lastSeenAt = ts;
  p.lastResult = result === 'bad' ? 'bad' : 'good';
  if (result === 'bad') {
    p.hadBad = true;
    p.badCount += 1;
    p.goodStreak = 0;
    p.status = 'reinforcing';
  } else {
    p.goodCount += 1;
    if (p.hadBad) {
      p.goodStreak += 1;
      p.status = p.goodStreak >= DATA_CHART_REQUIRED_GOOD_STREAK ? 'mastered' : 'reinforcing';
    } else {
      p.goodStreak = 1;
      p.status = 'mastered';
    }
  }
  dataChart.items[itemId] = p;
  markDataChartSectionStarted(dataChart, sectionId, ts);
  dataChart.attempts.push({
    id: `dc_${ts.toString(36)}_${dataChart.attempts.length.toString(36)}`,
    itemId,
    sectionId,
    date,
    ts,
    result: result === 'bad' ? 'bad' : 'good',
  });
  return p;
}

function seededShuffle(values, random = Math.random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function chooseDataChartReviewSections(dataChart, seed, count, date) {
  const today = new Set(dataChartDailySummary(dataChart, date).reviewedSectionIds);
  const candidates = dataChartSections(seed).map((section, index) => {
    const p = dataChartSectionProgress(dataChart, section);
    if (!p.completedAt) return null;
    const weak = p.reinforcing;
    const last = p.lastReviewedAt || p.completedAt || p.startedAt || 0;
    return { section, index, weak, last };
  }).filter(Boolean).filter(row => !today.has(row.section.id));
  candidates.sort((a, b) => b.weak - a.weak || a.last - b.last || a.index - b.index);
  return candidates.slice(0, Math.max(0, Number(count) || 0)).map(row => row.section.id);
}

function sessionItemIds(seed, sectionIds) {
  const wanted = new Set(sectionIds || []);
  return dataChartSections(seed).filter(section => wanted.has(section.id)).flatMap(section => (section.items || []).map(item => item.id));
}

function trimSessionToSeed(session, seed) {
  const allowed = new Set(dataChartSections(seed).flatMap(section => (section.items || []).map(item => item.id)));
  session.itemIds = session.itemIds.filter(id => allowed.has(id));
  session.queue = session.queue.filter(id => allowed.has(id));
  session.retry = session.retry.filter(x => allowed.has(x.id));
  if (session.currentId && !allowed.has(session.currentId)) session.currentId = null;
  return session;
}

export function reconcileDataChartContent(dataChart, seed) {
  dataChart.contentVersionSeen = seed?.contentVersion || null;
  if (dataChart.session) {
    trimSessionToSeed(dataChart.session, seed);
    if (!dataChart.session.currentId) advanceDataChartSession(dataChart);
  }
  return dataChart;
}

export function createDataChartSession(dataChart, seed, { mode = 'review', sectionIds = [], itemIds = null, limit = 0, label = '', date = '', now = Date.now(), random = Math.random } = {}) {
  const sections = [...new Set(sectionIds.filter(Boolean))];
  let ids = itemIds ? [...new Set(itemIds.filter(Boolean))] : sessionItemIds(seed, sections);
  if (mode === 'learn') {
    ids = ids.filter(id => dataChartItemProgress(dataChart, id).status !== 'mastered');
    for (const sectionId of sections) markDataChartSectionStarted(dataChart, sectionId, now);
  }
  if (mode === 'weak') ids = ids.filter(id => dataChartItemProgress(dataChart, id).status === 'reinforcing');
  if (limit > 0 && ids.length > limit) ids = seededShuffle(ids, random).slice(0, limit);
  const session = {
    id: `dc_session_${now.toString(36)}`,
    mode,
    label,
    sectionIds: sections,
    itemIds: [...ids],
    queue: seededShuffle(ids, random),
    retry: [],
    currentId: null,
    turn: 0,
    seenItemIds: [],
    good: 0,
    bad: 0,
    startedAt: now,
    completedAt: null,
    date,
    activityId: null,
  };
  dataChart.session = session;
  advanceDataChartSession(dataChart);
  return session;
}

function removeRetry(session, itemId) {
  session.retry = session.retry.filter(x => x.id !== itemId);
}

export function advanceDataChartSession(dataChart) {
  const session = dataChart.session;
  if (!session || session.completedAt || session.currentId) return session?.currentId || null;
  let next = null;
  const dueIndex = session.retry.findIndex(x => x.dueTurn <= session.turn);
  if (dueIndex >= 0) next = session.retry.splice(dueIndex, 1)[0].id;
  else if (session.queue.length) next = session.queue.shift();
  else if (session.retry.length) {
    session.retry.sort((a, b) => a.dueTurn - b.dueTurn);
    next = session.retry.shift().id;
  }
  session.currentId = next || null;
  return session.currentId;
}

export function gradeDataChartSession(dataChart, seed, result, { ts = Date.now(), date = null } = {}) {
  const session = dataChart.session;
  if (!session?.currentId) return null;
  const ref = dataChartItemById(seed, session.currentId);
  if (!ref) {
    session.currentId = null;
    advanceDataChartSession(dataChart);
    return null;
  }
  const day = date || session.date;
  const itemId = session.currentId;
  const p = gradeDataChartItem(dataChart, { itemId, sectionId: ref.section.id, result, date: day, ts });
  if (!session.seenItemIds.includes(itemId)) session.seenItemIds.push(itemId);
  if (result === 'bad') session.bad += 1; else session.good += 1;
  removeRetry(session, itemId);
  if (p.status === 'reinforcing') session.retry.push({ id: itemId, dueTurn: session.turn + DATA_CHART_RETRY_GAP + 1 });
  session.currentId = null;
  session.turn += 1;
  const next = advanceDataChartSession(dataChart);
  if (!next) finishDataChartSession(dataChart, seed, { date: day, ts });
  return p;
}

export function finishDataChartSession(dataChart, seed, { date = null, ts = Date.now() } = {}) {
  const session = dataChart.session;
  if (!session || session.completedAt) return session;
  const day = date || session.date;
  if (session.mode === 'learn') {
    for (const sectionId of session.sectionIds) {
      const section = dataChartSectionById(seed, sectionId);
      if (section && dataChartSectionProgress(dataChart, section).complete) markDataChartSectionCompleted(dataChart, sectionId, day, ts);
    }
  }
  if (session.mode === 'review') {
    for (const sectionId of session.sectionIds) markDataChartSectionReviewed(dataChart, sectionId, day, ts);
  }
  session.completedAt = ts;
  session.currentId = null;
  return session;
}

export function clearDataChartSession(dataChart) {
  dataChart.session = null;
}

export function dataChartSessionProgress(dataChart) {
  const session = dataChart?.session;
  if (!session) return { total: 0, seen: 0, reinforcing: 0, good: 0, bad: 0, done: true };
  return {
    total: session.itemIds.length,
    seen: session.seenItemIds.length,
    reinforcing: new Set(session.retry.map(x => x.id).concat(session.currentId && dataChartItemProgress(dataChart, session.currentId).status === 'reinforcing' ? [session.currentId] : [])).size,
    good: session.good,
    bad: session.bad,
    done: Boolean(session.completedAt),
  };
}

export function dataChartAttemptsOnDay(dataChart, date) {
  return (dataChart?.attempts || []).filter(row => row.date === date);
}
