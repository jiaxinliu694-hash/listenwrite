from pathlib import Path

app = Path('src/app.js')
text = app.read_text()

old = "import { allBooks, matchesBooks, ensureDailyPlan, configureSequentialPlan, convertPlanToMixed, currentSequentialSegment, segmentStatus, planStatus, todayListeningStats, createRetrySession, pickNext, finishCurrent, sessionProgress, dueForecast } from './queue.js';"
new = "import { allBooks, matchesBooks, ensureDailyPlan, configureSequentialPlan, convertPlanToMixed, currentSequentialSegment, segmentStatus, planStatus, todayListeningStats, createRetrySession, pickNext, finishCurrent, resyncRetryForWord, sessionProgress, dueForecast } from './queue.js';\nimport { typePresetIds, customTypeIdsFromEvents } from './typefilters.js';"
assert old in text
text = text.replace(old, new, 1)

old = "let statMonth = calendarDate(statDay);\n\nfunction currentDayKey"
new = "let statMonth = calendarDate(statDay);\nlet saveChain = Promise.resolve();\nlet saveFailureShown = false;\n\nfunction currentDayKey"
assert old in text
text = text.replace(old, new, 1)

old = "function persist() { void saveState(state); }"
new = "function persist() {\n  saveChain = saveChain\n    .then(() => saveState(state))\n    .then(() => { saveFailureShown = false; })\n    .catch((error) => {\n      console.error('Listenwrite save failed', error);\n      if (!saveFailureShown) { saveFailureShown = true; toast('保存失败，请先导出备份后再继续'); }\n    });\n  return saveChain;\n}"
assert old in text
text = text.replace(old, new, 1)

old = "    return `<div class=\"bookrow\" style=\"grid-template-columns:minmax(90px,1.4fr) 1fr 1fr\"><b>${i + 1}. ${esc(seg.book)}${currentSeg?.book === seg.book ? ' · 当前' : ''}</b><label class=\"small\">新词 <input data-seq-new=\"${i}\" type=\"number\" min=\"0\" value=\"${seg.newTarget}\" style=\"width:78px\"> <span>${nd}/${seg.newIds.length}</span></label><label class=\"small\">复习 <input data-seq-review=\"${i}\" type=\"number\" min=\"0\" value=\"${seg.reviewTarget}\" style=\"width:78px\"> <span>${rd}/${seg.reviewIds.length}</span></label></div>`;"
new = "    const newShort = seg.newIds.length < seg.newTarget ? ` · 可分配 ${seg.newIds.length}` : '';\n    const reviewShort = seg.reviewIds.length < seg.reviewTarget ? ` · 可分配 ${seg.reviewIds.length}` : '';\n    return `<div class=\"bookrow\" style=\"grid-template-columns:minmax(90px,1.4fr) 1fr 1fr\"><b>${i + 1}. ${esc(seg.book)}${currentSeg?.book === seg.book ? ' · 当前' : ''}</b><label class=\"small\">新词 <input data-seq-new=\"${i}\" type=\"number\" min=\"0\" value=\"${seg.newTarget}\" style=\"width:78px\"> <span>${nd}/${seg.newIds.length}${newShort}</span></label><label class=\"small\">复习 <input data-seq-review=\"${i}\" type=\"number\" min=\"0\" value=\"${seg.reviewTarget}\" style=\"width:78px\"> <span>${rd}/${seg.reviewIds.length}${reviewShort}</span></label></div>`;"
assert old in text
text = text.replace(old, new, 1)

old = "  const bookRows = (books.length ? books : allBooks(state)).map((b) => {\n    const x = todayListeningStats(state, [b], date);\n    return `<div class=\"bookrow\"><b>${esc(b)}</b><span>${x.newCount} 新</span><span>${x.reviewCount} 复习</span><span class=\"mobilehide good\">${x.firstGood} 熟悉</span><span class=\"mobilehide bad\">${x.firstBad} 不熟</span></div>`;\n  }).join('');"
new = "  const bookRows = plan.mode === 'sequential'\n    ? (plan.bookSegments || []).map((seg) => {\n        const x = segmentStatus(state, plan, seg);\n        return `<div class=\"bookrow\"><b>${esc(seg.book)}</b><span>${x.new.done}/${seg.newIds.length} 新</span><span>${x.review.done}/${seg.reviewIds.length} 复习</span><span class=\"mobilehide\">本轮实际归属</span><span class=\"mobilehide\">去重后统计</span></div>`;\n      }).join('')\n    : (books.length ? books : allBooks(state)).map((b) => {\n        const x = todayListeningStats(state, [b], date);\n        return `<div class=\"bookrow\"><b>${esc(b)}</b><span>${x.newCount} 新</span><span>${x.reviewCount} 复习</span><span class=\"mobilehide good\">${x.firstGood} 熟悉</span><span class=\"mobilehide bad\">${x.firstBad} 不熟</span></div>`;\n      }).join('');\n  const bookStatsNote = plan.mode === 'sequential'\n    ? '分本依次按今日任务的实际归属统计，共享词只算在前面第一本。'\n    : '混合模式按词书来源分别统计；同一个共享词可能同时出现在多本词书，因此各行不要直接相加。';"
assert old in text
text = text.replace(old, new, 1)

old = "<section class=\"card\"><h2 class=\"section-title\">各词书今天的情况</h2><div class=\"small\">只统计听音，不混入手打。</div><div style=\"margin-top:8px\">${bookRows || '<div class=\"empty\">还没有词书。</div>'}</div></section>"
new = "<section class=\"card\"><h2 class=\"section-title\">各词书今天的情况</h2><div class=\"small\">只统计听音，不混入手打。${bookStatsNote}</div><div style=\"margin-top:8px\">${bookRows || '<div class=\"empty\">还没有词书。</div>'}</div></section>"
assert old in text
text = text.replace(old, new, 1)

old = "  const w = listenCurrentWord(); if (listen.historyView) { editAttempt(state, listen.historyView.eventId, result); listen.historyView.result = result; persist(); renderListen(); return; }"
new = "  const w = listenCurrentWord(); if (listen.historyView) { editAttempt(state, listen.historyView.eventId, result); listen.historyView.result = result; resyncRetryForWord(listen.session, state, w.id, listen.plan.date, 'listen'); persist(); renderListen(); return; }"
assert old in text
text = text.replace(old, new, 1)

old = "function returnFromHistory() { const plan = ensureDailyPlan(state, { date: listen.plan.date }); const activityId = listen.activityId; listen = null; startListen(plan, activityId); }"
new = "function returnFromHistory() { listen.historyView = null; renderListen(); }"
assert old in text
text = text.replace(old, new, 1)

start = text.index("function typeCandidates()")
end = text.index("function renderType()", start)
replacement = "function typeCandidates() { const books = state.settings.typeBooks || []; return state.words.filter(w => !w.retired && matchesBooks(w, books)); }\nfunction typePreset(kind) { const candidates = typeCandidates(); const today = currentDayKey(); return typePresetIds(state, candidates, kind, today, state.dailyPlans?.[today] || null); }\n"
text = text[:start] + replacement + text[end:]

old = "function customTypeIds() { const date = document.getElementById('typeDate')?.value || currentDayKey(); const mode = document.getElementById('typeMode')?.value || 'all'; const min = Number(document.getElementById('typeMin')?.value || 1); const allowed = new Set(typeCandidates().map(w=>w.id)); const groups = new Map(); for (const e of state.events) { if (e.date !== date || e.result !== 'bad' || !allowed.has(e.wordId) || (mode !== 'all' && e.mode !== mode)) continue; groups.set(e.wordId, (groups.get(e.wordId)||0)+1); } return [...groups.entries()].filter(([,n])=>n>=min).sort((a,b)=>b[1]-a[1]).map(([id])=>id); }"
new = "function customTypeIds() { const date = document.getElementById('typeDate')?.value || currentDayKey(); const mode = document.getElementById('typeMode')?.value || 'all'; const min = Number(document.getElementById('typeMin')?.value || 1); const allowed = new Set(typeCandidates().map(w=>w.id)); return customTypeIdsFromEvents(state.events, allowed, { date, mode, min }); }"
assert old in text
text = text.replace(old, new, 1)

app.write_text(text)

queue = Path('src/queue.js')
q = queue.read_text()
needle = "export function sessionProgress(state, plan, session) {"
insert = """export function resyncRetryForWord(session, state, wordId, date = session?.date, mode = session?.mode || 'listen') {\n  if (!session || !wordId) return;\n  session.retry = (session.retry || []).filter((x) => x.wordId !== wordId);\n  const last = latestEventOnDay(state, wordId, date, mode);\n  if (!last || last.result !== 'bad') return;\n  if (session.current?.wordId === wordId || (session.pendingBase || []).includes(wordId)) return;\n  session.retry.push({\n    wordId,\n    attempt: eventsOnDay(state, wordId, date, mode).length,\n    eligibleTurn: session.turn,\n    addedAt: last.ts,\n  });\n}\n\n"""
assert needle in q
q = q.replace(needle, insert + needle, 1)
queue.write_text(q)
