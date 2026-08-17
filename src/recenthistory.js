import { addStudyDays } from './studyday.js';
import { reinforcementState, reinforcementLabel } from './reinforcement.js';

export function recentStudyDates(today, count = 3) {
  const n = Math.max(1, Number(count) || 1);
  return Array.from({ length: n }, (_, index) => addStudyDays(today, -index));
}
export function recentListeningRows(state, date) {
  const events = (state?.events || []).filter((event) => event?.mode === 'listen' && event.date === date).sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
  const groups = new Map();
  for (const event of events) { if (!groups.has(event.wordId)) groups.set(event.wordId, []); groups.get(event.wordId).push(event); }
  return [...groups.entries()].map(([wordId,wordEvents])=>({word:(state.words||[]).find(word=>word.id===wordId),events:wordEvents})).filter(row=>row.word).sort((a,b)=>Number(b.events.at(-1)?.ts||0)-Number(a.events.at(-1)?.ts||0));
}
export function recentListeningStatus(word, events = []) {
  if (word?.retired) return { label: '简单', cls: 'mark-simple', passed: true };
  const status = reinforcementState(events);
  if (!status.started) return { label: '未开始', cls: 'mark-pending', passed: false };
  if (status.passed) return { label: '已熟悉', cls: 'mark-good', passed: true };
  return { label: reinforcementLabel(events), cls: 'mark-bad', passed: false };
}
