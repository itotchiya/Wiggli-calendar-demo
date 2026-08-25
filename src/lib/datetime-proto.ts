export function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")} : ${String(minute).padStart(2, "0")}`;
}

export function formatCompactTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  return addDays(date, -date.getUTCDay());
}

export function getTodayUtcPlusTwo() {
  const utcPlusTwo = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return new Date(Date.UTC(utcPlusTwo.getUTCFullYear(), utcPlusTwo.getUTCMonth(), utcPlusTwo.getUTCDate()));
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(weekStart);
  const endMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(weekEnd);
  if (weekStart.getUTCFullYear() === weekEnd.getUTCFullYear() && weekStart.getUTCMonth() === weekEnd.getUTCMonth()) {
    return `${weekStart.getUTCDate()} – ${weekEnd.getUTCDate()} ${endMonth} ${weekEnd.getUTCFullYear()}`;
  }
  if (weekStart.getUTCFullYear() === weekEnd.getUTCFullYear()) {
    return `${weekStart.getUTCDate()} ${startMonth} – ${weekEnd.getUTCDate()} ${endMonth} ${weekEnd.getUTCFullYear()}`;
  }
  return `${weekStart.getUTCDate()} ${startMonth} ${weekStart.getUTCFullYear()} – ${weekEnd.getUTCDate()} ${endMonth} ${weekEnd.getUTCFullYear()}`;
}

export function formatPickerLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function getUtcPlusTwoCalendarTime() {
  const utcPlusTwo = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return {
    date: dateKey(new Date(Date.UTC(utcPlusTwo.getUTCFullYear(), utcPlusTwo.getUTCMonth(), utcPlusTwo.getUTCDate()))),
    hour: utcPlusTwo.getUTCHours(),
    minute: utcPlusTwo.getUTCMinutes(),
  };
}

export function getNextQuarterSlot() {
  const now = getUtcPlusTwoCalendarTime();
  const nextTotal = (Math.floor((now.hour * 60 + now.minute) / 15) + 1) * 15;
  const rollsToTomorrow = nextTotal >= 24 * 60;
  return {
    date: rollsToTomorrow ? dateKey(addDays(parseDateKey(now.date), 1)) : now.date,
    hour: rollsToTomorrow ? 0 : Math.floor(nextTotal / 60),
    minute: nextTotal % 60,
  };
}
