/** Attendance maths. Pure functions — unit tested. */
export function ymd(d, timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}
export function minutesOf(d, timeZone = 'Asia/Kolkata') {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d)).split(':').map(Number);
  return (h % 24) * 60 + m;
}
const hm = (s = '09:30') => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

export function computeDay(att, hr = {}, timeZone = 'Asia/Kolkata') {
  const settings = { shiftStart: '09:30', shiftEnd: '18:30', graceMinutes: 15, fullDayHours: 8, halfDayHours: 4, ...hr };
  if (!att.checkIn) return { workMinutes: 0, breakMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status: att.status || 'absent' };
  const end = att.checkOut ? new Date(att.checkOut) : new Date();
  const breakMinutes = Math.round((att.breaks || []).reduce((t, b) => t + ((b.end ? new Date(b.end) : end) - new Date(b.start)) / 60000, 0));
  const workMinutes = Math.max(0, Math.round((end - new Date(att.checkIn)) / 60000) - breakMinutes);
  const inMin = minutesOf(att.checkIn, timeZone);
  const lateMinutes = Math.max(0, inMin - hm(settings.shiftStart) - settings.graceMinutes);
  const earlyLeaveMinutes = att.checkOut ? Math.max(0, hm(settings.shiftEnd) - minutesOf(att.checkOut, timeZone)) : 0;
  const overtimeMinutes = Math.max(0, workMinutes - settings.fullDayHours * 60);
  let status = 'present';
  if (att.checkOut) status = workMinutes >= settings.fullDayHours * 60 - settings.graceMinutes ? 'present' : workMinutes >= settings.halfDayHours * 60 ? 'half_day' : 'absent';
  return { workMinutes, breakMinutes, overtimeMinutes, lateMinutes, earlyLeaveMinutes, status };
}

/** Working days between two dates (inclusive), excluding weekly offs and holidays (YYYY-MM-DD list). */
export function countLeaveDays(from, to, weeklyOffs = [0], holidays = []) {
  let n = 0;
  const d = new Date(Date.UTC(new Date(from).getUTCFullYear(), new Date(from).getUTCMonth(), new Date(from).getUTCDate()));
  const end = new Date(Date.UTC(new Date(to).getUTCFullYear(), new Date(to).getUTCMonth(), new Date(to).getUTCDate()));
  const hol = new Set(holidays);
  while (d <= end) {
    if (!weeklyOffs.includes(d.getUTCDay()) && !hol.has(d.toISOString().slice(0, 10))) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}
