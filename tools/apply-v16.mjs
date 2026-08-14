import fs from 'node:fs';

function patch(path, from, to) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(from)) throw new Error(`Missing pattern in ${path}: ${from.slice(0,120)}`);
  s = s.replace(from, to);
  fs.writeFileSync(path, s);
}

patch('src/queue.js',
"import { addStudyDays, studyDayEnd, studyDayStart } from './studyday.js';",
"import { addStudyDays, studyDayEnd, studyDayStart } from './studyday.js';\nimport { reinforcementState, reinforcementDelayMs } from './reinforcement.js';");

patch('src/queue.js',
`function reviewCandidates(state, pool, assigned, date, books = [], nonce = 0) {
  const cutoff = studyDayEnd(date);
  const now = Date.now();
  const seed = drawSeed(date, books, nonce);
  return pool
    .filter((w) => {
      if (assigned.has(w.id)) return false;
      const formal = hasEventBefore(state, w.id, date);
      const hinted = !formal && reviewHinted(w);
      return hinted || (formal && (w.card?.reps || 0) > 0 && Number(w.card?.due || 0) <= cutoff);
    })
    .sort((a, b) => {
      const ah = !hasEventBefore(state, a.id, date) && reviewHinted(a);
      const bh = !hasEventBefore(state, b.id, date) && reviewHinted(b);
      if (ah !== bh) return ah ? -1 : 1;
      if (ah && bh) return randomRank(a.id, seed) - randomRank(b.id, seed);
      const ra = retrievability(a.card, now, state.settings.retention);
      const rb = retrievability(b.card, now, state.settings.retention);
      if (ra !== rb) return ra - rb;
      return Number(a.card?.due || 0) - Number(b.card?.due || 0);
    });
}`,
`function reviewCandidates(state, pool, assigned, date, books = [], nonce = 0) {
  const cutoff = studyDayEnd(date);
  const now = Date.now();
  const seed = drawSeed(date, books, nonce);
  return pool
    .filter((w) => !assigned.has(w.id) && reviewKnown(state, w, date))
    .sort((a, b) => {
      const ah = !hasEventBefore(state, a.id, date) && reviewHinted(a);
      const bh = !hasEventBefore(state, b.id, date) && reviewHinted(b);
      if (ah !== bh) return ah ? -1 : 1;
      const adue = hasEventBefore(state, a.id, date) && (a.card?.reps || 0) > 0 && Number(a.card?.due || 0) <= cutoff;
      const bdue = hasEventBefore(state, b.id, date) && (b.card?.reps || 0) > 0 && Number(b.card?.due || 0) <= cutoff;
      if (adue !== bdue) return adue ? -1 : 1;
      if (ah && bh) return randomRank(a.id, seed) - randomRank(b.id, seed);
      const ra = retrievability(a.card, now, state.settings.retention);
      const rb = retrievability(b.card, now, state.settings.retention);
      if (ra !== rb) return ra - rb;
      const da = Number(a.card?.due || Number.MAX_SAFE_INTEGER);
      const db = Number(b.card?.due || Number.MAX_SAFE_INTEGER);
      if (da !== db) return da - db;
      return randomRank(a.id, seed) - randomRank(b.id, seed);
    });
}`);

patch('src/queue.js',
`function statusForIds(state, ids, date) {
  const wordMap = new Map(state.words.map((w) => [w.id, w]));
  let done = 0, retry = 0, pending = 0;
  const doneIds = [], retryIds = [], pendingIds = [];
  for (const id of ids) {
    const word = wordMap.get(id);
    if (!word) continue;
    if (word.retired) { done++; doneIds.push(id); continue; }
    const last = latestListenResult(state, id, date);
    if (!last) { pending++; pendingIds.push(id); }
    else if (last.result === 'good') { done++; doneIds.push(id); }
    else { retry++; retryIds.push(id); }
  }
  return { done, retry, pending, doneIds, retryIds, pendingIds };
}`,
`function statusForIds(state, ids, date) {
  const wordMap = new Map(state.words.map((w) => [w.id, w]));
  let done = 0, retry = 0, pending = 0;
  const doneIds = [], retryIds = [], pendingIds = [];
  for (const id of ids) {
    const word = wordMap.get(id);
    if (!word) continue;
    if (word.retired) { done++; doneIds.push(id); continue; }
    const events = eventsOnDay(state, id, date, 'listen');
    const reinforce = reinforcementState(events);
    if (!reinforce.started) { pending++; pendingIds.push(id); }
    else if (reinforce.passed) { done++; doneIds.push(id); }
    else { retry++; retryIds.push(id); }
  }
  return { done, retry, pending, doneIds, retryIds, pendingIds };
}`);

patch('src/queue.js',
`export function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {
  const planIds = explicitIds || [...plan.reviewIds, ...plan.newIds];
  const wordMap = new Map(state.words.map((w) => [w.id, w]));
  const pendingBase = [];
  const retry = [];
  if (explicitIds) {
    for (const id of [...new Set(planIds)]) {
      const word = wordMap.get(id);
      if (word && !word.retired) pendingBase.push(id);
    }
  } else {
    for (const id of planIds) {
      const word = wordMap.get(id);
      if (!word || word.retired) continue;
      const last = latestEventOnDay(state, id, plan.date, mode);
      if (!last) pendingBase.push(id);
      else if (last.result === 'bad') retry.push({ wordId: id, attempt: eventsOnDay(state, id, plan.date, mode).length, eligibleTurn: 0, addedAt: last.ts });
    }
    if (plan.resumeWordId) {
      const i = pendingBase.indexOf(plan.resumeWordId);
      if (i > 0) pendingBase.unshift(pendingBase.splice(i, 1)[0]);
    }
  }
  return { mode, date: plan.date, fixedIds: [...new Set(planIds)], pendingBase, retry, turn: 0, current: null, history: [] };
}

function retryGap(attempt) {
  if (attempt <= 1) return 4;
  if (attempt === 2) return 6;
  return 8;
}`,
`export function createRetrySession(state, plan, mode = 'listen', explicitIds = null) {
  const planIds = explicitIds || [...plan.reviewIds, ...plan.newIds];
  const wordMap = new Map(state.words.map((w) => [w.id, w]));
  const pendingBase = [];
  const retry = [];
  if (explicitIds) {
    for (const id of [...new Set(planIds)]) {
      const word = wordMap.get(id);
      if (word && !word.retired) pendingBase.push(id);
    }
  } else {
    for (const id of planIds) {
      const word = wordMap.get(id);
      if (!word || word.retired) continue;
      const events = eventsOnDay(state, id, plan.date, mode);
      const reinforce = reinforcementState(events);
      if (!reinforce.started) pendingBase.push(id);
      else if (!reinforce.passed) {
        retry.push({
          wordId: id,
          attempt: events.length,
          eligibleAt: Number(reinforce.last?.ts || 0) + reinforcementDelayMs(events),
          addedAt: reinforce.last?.ts || 0,
        });
      }
    }
    if (plan.resumeWordId) {
      const i = pendingBase.indexOf(plan.resumeWordId);
      if (i > 0) pendingBase.unshift(pendingBase.splice(i, 1)[0]);
    }
  }
  return { mode, date: plan.date, fixedIds: [...new Set(planIds)], pendingBase, retry, turn: 0, current: null, history: [] };
}`);

patch('src/queue.js',
`export function pickNext(session) {
  if (session.current) return session.current.wordId;
  const due = session.retry.filter((x) => x.eligibleTurn <= session.turn).sort((a, b) => a.eligibleTurn - b.eligibleTurn || a.addedAt - b.addedAt)[0];
  if (due) {
    session.retry = session.retry.filter((x) => x !== due);
    session.current = { wordId: due.wordId, source: 'retry', attempt: due.attempt + 1 };
    return due.wordId;
  }
  const baseId = session.pendingBase.shift();
  if (baseId) {
    session.current = { wordId: baseId, source: 'base', attempt: 1 };
    return baseId;
  }
  const nextRetry = session.retry.sort((a, b) => a.eligibleTurn - b.eligibleTurn || a.addedAt - b.addedAt).shift();
  if (nextRetry) {
    session.current = { wordId: nextRetry.wordId, source: 'retry', attempt: nextRetry.attempt + 1 };
    return nextRetry.wordId;
  }
  return null;
}`,
`export function pickNext(session, now = Date.now()) {
  if (session.current) return session.current.wordId;
  const due = session.retry
    .filter((x) => Number(x.eligibleAt || 0) <= now)
    .sort((a, b) => Number(a.eligibleAt || 0) - Number(b.eligibleAt || 0) || a.addedAt - b.addedAt)[0];
  if (due) {
    session.retry = session.retry.filter((x) => x !== due);
    session.current = { wordId: due.wordId, source: 'retry', attempt: due.attempt + 1 };
    return due.wordId;
  }
  const baseId = session.pendingBase.shift();
  if (baseId) {
    session.current = { wordId: baseId, source: 'base', attempt: 1 };
    return baseId;
  }
  return null;
}

export function nextRetryDelayMs(session, now = Date.now()) {
  if (!session?.retry?.length) return 0;
  return Math.max(0, Math.min(...session.retry.map((x) => Number(x.eligibleAt || 0))) - now);
}`);

patch('src/queue.js',
`export function finishCurrent(session, result) {
  if (!session.current) return;
  const current = session.current;
  session.history.push({ ...current, result, turn: session.turn });
  session.turn += 1;
  session.retry = session.retry.filter((x) => x.wordId !== current.wordId);
  if (result === 'bad') session.retry.push({ wordId: current.wordId, attempt: current.attempt, eligibleTurn: session.turn + retryGap(current.attempt), addedAt: Date.now() });
  session.current = null;
}`,
`export function finishCurrent(session, result, state = null) {
  if (!session.current) return;
  const current = session.current;
  session.history.push({ ...current, result, turn: session.turn });
  session.turn += 1;
  session.retry = session.retry.filter((x) => x.wordId !== current.wordId);
  if (state) {
    const events = eventsOnDay(state, current.wordId, session.date, session.mode);
    const reinforce = reinforcementState(events);
    if (!reinforce.passed) {
      session.retry.push({
        wordId: current.wordId,
        attempt: events.length,
        eligibleAt: Number(reinforce.last?.ts || Date.now()) + reinforcementDelayMs(events),
        addedAt: reinforce.last?.ts || Date.now(),
      });
    }
  } else if (result === 'bad') {
    session.retry.push({ wordId: current.wordId, attempt: current.attempt, eligibleAt: Date.now() + 30_000, addedAt: Date.now() });
  }
  session.current = null;
}`);

patch('src/queue.js',
`export function resyncRetryForWord(session, state, wordId, date = session?.date, mode = session?.mode || 'listen') {
  if (!session || !wordId) return;
  session.retry = (session.retry || []).filter((x) => x.wordId !== wordId);
  const last = latestEventOnDay(state, wordId, date, mode);
  if (!last || last.result !== 'bad') return;
  if (session.current?.wordId === wordId || (session.pendingBase || []).includes(wordId)) return;
  session.retry.push({
    wordId,
    attempt: eventsOnDay(state, wordId, date, mode).length,
    eligibleTurn: session.turn,
    addedAt: last.ts,
  });
}`,
`export function resyncRetryForWord(session, state, wordId, date = session?.date, mode = session?.mode || 'listen') {
  if (!session || !wordId) return;
  session.retry = (session.retry || []).filter((x) => x.wordId !== wordId);
  if (session.current?.wordId === wordId || (session.pendingBase || []).includes(wordId)) return;
  const events = eventsOnDay(state, wordId, date, mode);
  const reinforce = reinforcementState(events);
  if (!reinforce.started || reinforce.passed) return;
  session.retry.push({
    wordId,
    attempt: events.length,
    eligibleAt: Number(reinforce.last?.ts || 0) + reinforcementDelayMs(events),
    addedAt: reinforce.last?.ts || 0,
  });
}`);

patch('src/engine.js',
"import { addStudyDays, calendarDayKey, isGraceWindow } from './studyday.js';",
"import { addStudyDays, calendarDayKey, isGraceWindow } from './studyday.js';\nimport { reinforcementState } from './reinforcement.js';");

patch('src/engine.js',
`    const latest = state.events
      .filter((e) => e.wordId === id && e.date === date && e.mode === 'listen' && e.ts <= ts)
      .sort((a, b) => a.ts - b.ts)
      .at(-1);
    if (!latest || latest.result !== 'good') return false;`,
`    const events = state.events
      .filter((e) => e.wordId === id && e.date === date && e.mode === 'listen' && e.ts <= ts)
      .sort((a, b) => a.ts - b.ts);
    if (!reinforcementState(events).passed) return false;`);

patch('src/app.js',
"import { allBooks, matchesBooks, ensureDailyPlan, configureSequentialPlan, convertPlanToMixed, currentSequentialSegment, segmentStatus, planStatus, todayListeningStats, createRetrySession, pickNext, finishCurrent, resyncRetryForWord, sessionProgress, dueForecast } from './queue.js';",
"import { allBooks, matchesBooks, ensureDailyPlan, configureSequentialPlan, convertPlanToMixed, currentSequentialSegment, segmentStatus, planStatus, todayListeningStats, createRetrySession, pickNext, finishCurrent, resyncRetryForWord, sessionProgress, dueForecast, nextRetryDelayMs } from './queue.js';\nimport { reinforcementState, reinforcementLabel } from './reinforcement.js';");

patch('src/app.js',
`function planWordMark(plan,id){const w=wordById(id);if(!w)return{label:'已移除',cls:'mark-pending'};if(w.retired||isSimpleLexeme(state,w.en))return{label:'简单',cls:'mark-simple'};const last=latestEventOnDay(state,id,plan.date,'listen');if(!last)return{label:'未开始',cls:'mark-pending'};return last.result==='good'?{label:'已熟悉',cls:'mark-good'}:{label:'待巩固',cls:'mark-bad'};}`,
`function planWordMark(plan,id){const w=wordById(id);if(!w)return{label:'已移除',cls:'mark-pending'};if(w.retired||isSimpleLexeme(state,w.en))return{label:'简单',cls:'mark-simple'};const events=eventsOnDay(state,id,plan.date,'listen');const r=reinforcementState(events);if(!r.started)return{label:'未开始',cls:'mark-pending'};if(r.passed)return{label:'已熟悉',cls:'mark-good'};return{label:reinforcementLabel(events),cls:'mark-bad'};}`);

patch('src/app.js',
`if (!reviewing) document.getElementById('retireWord').onclick = () => { markSimpleLexeme(state, w.en, true); persist(); finishCurrent(listen.session, 'good'); listen.currentEventId = null; listen.result = null; listen.answer = false; advanceListen(); };`,
`if (!reviewing) document.getElementById('retireWord').onclick = () => { markSimpleLexeme(state, w.en, true); persist(); finishCurrent(listen.session, 'good', state); listen.currentEventId = null; listen.result = null; listen.answer = false; advanceListen(); };`);

patch('src/app.js',
`  finishCurrent(listen.session, listen.result); listen.currentEventId = null; listen.result = null; listen.answer = false; touchActivity(listen.activityId); advanceListen();`,
`  finishCurrent(listen.session, listen.result, state); listen.currentEventId = null; listen.result = null; listen.answer = false; touchActivity(listen.activityId); advanceListen();`);

patch('src/app.js',
`  let id = pickNext(listen.session);
  if (id) { listen.plan.resumeWordId = id; persist(); renderListen(); speak(wordById(id).en); return; }
  if (listen.plan.mode === 'sequential' && currentSequentialSegment(state, listen.plan)) {`,
`  let id = pickNext(listen.session);
  if (id) { listen.plan.resumeWordId = id; persist(); renderListen(); speak(wordById(id).en); return; }
  const waitMs = nextRetryDelayMs(listen.session);
  if (waitMs > 0) {
    listen.plan.resumeWordId = null; persist();
    const seconds = Math.max(1, Math.ceil(waitMs / 1000));
    root.innerHTML = \`<main class="immersive"><div class="studybody"><div class="finish"><div class="small">还有待巩固词，但最小间隔还没到</div><h2>先隔一会儿再听</h2><div class="statbox" style="margin:18px auto;max-width:240px"><b>\${seconds} 秒</b><span>最早再次出现</span></div><div class="small">一次不熟后需要连续 3 次熟悉；任何一次再次不熟都会重新从 0/3 开始。后两次巩固间隔会逐级拉长。</div><div class="row" style="justify-content:center;margin-top:16px"><button id="retryLater" class="primary">回到今日</button></div></div></div></main>\`;
    document.getElementById('retryLater').onclick=()=>{listen=null;view='today';renderToday();};
    return;
  }
  if (listen.plan.mode === 'sequential' && currentSequentialSegment(state, listen.plan)) {`);

patch('src/app.js',
`<div class="statusline">${reviewing ? '修改历史判断后会重新计算当天队列和 FSRS 状态。' : '只播放但没判断的词不产生学习记录；退出后会尽量从它继续。'}</div>`,
`<div class="statusline">${reviewing ? '修改历史判断后会重新计算当天队列和 FSRS 状态。' : (()=>{const r=reinforcementState(eventsOnDay(state,w.id,listen.plan.date,'listen'));return r.hadBad&&!r.passed?\`当天巩固进度：\${r.goodStreak}/3。再次点“不熟悉”会清零重来。\`:'只播放但没判断的词不产生学习记录；退出后会尽量从它继续。';})()}</div>`);

// Type mode keeps its old one-good completion semantics. Pass no state there intentionally.

console.log('v16 patches applied');
