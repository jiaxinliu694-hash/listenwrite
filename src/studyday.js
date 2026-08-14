export const STUDY_TIME_ZONE = 'Asia/Shanghai';
export const STUDY_UTC_OFFSET_HOURS = 8;
export const STUDY_DAY_GRACE_END_HOUR = 2;

const OFFSET_MS = STUDY_UTC_OFFSET_HOURS * 3600000;

function pad2(n) { return String(n).padStart(2, '0'); }

/** Calendar date in fixed UTC+8. Normal day boundary is 24:00. */
export function calendarDayKey(ts = Date.now()) {
  const local = new Date(Number(ts) + OFFSET_MS);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
}

/** Shanghai clock parts, independent of the device timezone. */
export function shanghaiClock(ts = Date.now()) {
  const local = new Date(Number(ts) + OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

export function isGraceWindow(ts = Date.now()) {
  const { hour } = shanghaiClock(ts);
  return hour >= 0 && hour < STUDY_DAY_GRACE_END_HOUR;
}

export function studyDayParts(key = calendarDayKey()) {
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

/** Absolute UTC timestamp for 00:00 Asia/Shanghai at the start of a calendar day. */
export function studyDayStart(key = calendarDayKey()) {
  const { year, month, day } = studyDayParts(key);
  return Date.UTC(year, month - 1, day, -STUDY_UTC_OFFSET_HOURS, 0, 0, 0);
}

export function studyDayEnd(key = calendarDayKey()) {
  return studyDayStart(addStudyDays(key, 1)) - 1;
}

/** Noon-UTC Date used only for stable month/calendar arithmetic. */
export function calendarDate(key = calendarDayKey()) {
  const { year, month, day } = studyDayParts(key);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function calendarKey(date) {
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function studyMonth(key = calendarDayKey()) {
  const { year, month } = studyDayParts(key);
  return { year, month };
}

export function studyDayLabel() {
  return '东八区 · 24:00 正常换日；未完成可延续到 02:00';
}
