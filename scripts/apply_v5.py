from pathlib import Path

p = Path('src/app.js')
s = p.read_text()

s = s.replace(
    "import { dayKey, uid, recordAttempt, editAttempt, eventsOnDay, latestEventOnDay, rebuildAllCards } from './engine.js';",
    "import { activeStudyDayKey, dayKey, uid, recordAttempt, editAttempt, eventsOnDay, latestEventOnDay, rebuildAllCards } from './engine.js';"
)

needle = "let statDay = dayKey();\nlet statMonth = calendarDate(statDay);"
replacement = "let statDay = dayKey();\nlet statMonth = calendarDate(statDay);\n\nfunction currentDayKey(ts = Date.now()) { return state ? activeStudyDayKey(state, ts) : dayKey(ts); }"
if needle not in s:
    raise SystemExit('stat day anchor not found')
s = s.replace(needle, replacement, 1)

# Every zero-argument dayKey() in app.js represents the live/current study day.
s = s.replace('dayKey()', 'currentDayKey()')
# Restore helper initialization to avoid recursion introduced by the broad replacement.
s = s.replace('function currentDayKey(ts = Date.now()) { return state ? activeStudyDayKey(state, ts) : dayKey(ts); }',
              'function currentDayKey(ts = Date.now()) { return state ? activeStudyDayKey(state, ts) : dayKey(ts); }')

old = "function eventsSince(days) { const d = new Date(); d.setDate(d.getDate() - days + 1); const key = dayKey(d.getTime()); return state.events.filter(e => e.date >= key); }"
new = "function eventsSince(days) { const key = addStudyDays(currentDayKey(), -days + 1); return state.events.filter(e => e.date >= key); }"
if old in s:
    s = s.replace(old, new, 1)

old = "function filteredEvents(){if(!statRange)return state.events;const d=new Date();d.setDate(d.getDate()-statRange+1);const key=dayKey(d.getTime());return state.events.filter(e=>e.date>=key);}"
new = "function filteredEvents(){if(!statRange)return state.events;const key=addStudyDays(currentDayKey(),-statRange+1);return state.events.filter(e=>e.date>=key);}"
if old in s:
    s = s.replace(old, new, 1)

old = "(async function init(){state=await loadState();render();})();"
new = "(async function init(){state=await loadState();statDay=currentDayKey();statMonth=calendarDate(statDay);render();})();"
if old not in s:
    raise SystemExit('init anchor not found')
s = s.replace(old, new, 1)

# Clearer wording: midnight is normal rollover; 2am is only a grace deadline.
s = s.replace('从下一个学习日开始使用。', '从下一轮学习日开始使用。')

p.write_text(s)
print('applied v5 app changes')
