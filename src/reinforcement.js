export const REQUIRED_GOOD_STREAK = 3;

export function reinforcementState(events = []) {
  const list = [...events].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  if (!list.length) return { started: false, hadBad: false, goodStreak: 0, required: 1, passed: false, last: null };
  let hadBad = false;
  let goodStreak = 0;
  for (const event of list) {
    if (event.result === 'bad') {
      hadBad = true;
      goodStreak = 0;
    } else if (event.result === 'good') {
      if (hadBad) goodStreak += 1;
      else goodStreak = 1;
    }
  }
  const required = hadBad ? REQUIRED_GOOD_STREAK : 1;
  return {
    started: true,
    hadBad,
    goodStreak,
    required,
    passed: hadBad ? goodStreak >= REQUIRED_GOOD_STREAK : list.at(-1)?.result === 'good',
    last: list.at(-1) || null,
  };
}

export const REINFORCEMENT_GAPS = [5, 8, 12];

export function reinforcementGapWords(events = []) {
  const state = reinforcementState(events);
  if (!state.started || state.passed || !state.hadBad) return 0;
  if (state.last?.result === 'bad') return REINFORCEMENT_GAPS[0];
  if (state.goodStreak === 1) return REINFORCEMENT_GAPS[1];
  if (state.goodStreak === 2) return REINFORCEMENT_GAPS[2];
  return 0;
}

export function reinforcementLabel(events = []) {
  const state = reinforcementState(events);
  if (!state.started) return '未开始';
  if (state.passed) return '已熟悉';
  if (state.hadBad) return `巩固 ${state.goodStreak}/${REQUIRED_GOOD_STREAK}`;
  return state.last?.result === 'bad' ? '待巩固' : '未开始';
}
