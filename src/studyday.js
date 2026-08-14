export const STUDY_TIME_ZONE = 'Asia/Shanghai';
export const STUDY_UTC_OFFSET_HOURS = 8;
export const STUDY_DAY_CUTOFF_HOUR = 2;

const DAY_MS = 86400000;
const SHIFT_MS = (STUDY_UTC_OFFSET_HOURS - STUDY_DAY_CUTOFF_HOUR) * 3600000;

function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * Study-day key in fixed UTC+8, with the day rolling over at 02:00.
 * Example: 2026-08-15 01:59 +08 => 2026-08-14.
 */
export function studyDayKey(ts = Date.now()) {
  const shifted = new Date(Number(ts) + SHIFT_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function studyDayParts(key = studyDayKey()) {
  const [year, month, day] = String(key).split('-').map(Number);
  return { year, month, day };
}

export function formatDayKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function addStudyDays(key, amount) {
  const { year, month, day } = studyDayParts(key);
  const d = new Date(Date.UTC(year, month - 1, day + Number(amount || 0), 12));
  return formatDayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Absolute UTC timestamp for 02:00 Asia/Shanghai at the start of a study day. */
export function studyDayStart(key = studyDayKey()) {
  const { year, month, day } = studyDayParts(key);
  return Date.UTC(year, month - 1, day, STUDY_DAY_CUTOFF_HOUR - STUDY_UTC_OFFSET_HOURS, 0, 0, 0);
}

export function studyDayEnd(key = studyDayKey()) {
  return studyDayStart(addStudyDays(key, 1)) - 1;
}

/** Noon-UTC Date used only for stable month/calendar arithmetic. */
export function calendarDate(key = studyDayKey()) {
  const { year, month, day } = studyDayParts(key);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function calendarKey(date) {
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function studyMonth(key = studyDayKey()) {
  const { year, month } = studyDayParts(key);
  return { year, month };
}

export function studyDayLabel() {
  return `东八区 · 凌晨 ${pad2(STUDY_DAY_CUTOFF_HOUR)}:00 换日`;
}
