// Date helpers shared by all tools.
//
// Dates are plain strings "YYYY-MM-DD" (ISO format): easy to store in JSON,
// to compare ("2026-10-09" < "2026-10-12") and to show in <input type="date">.
// All calculations use UTC so that daylight saving time never shifts a day.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return toISODate(date) === value;
}

function parseISODate(value) {
  if (!isValidISODate(value)) {
    throw new Error(`Date invalide : « ${value} » (format attendu AAAA-MM-JJ).`);
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// Today's date on the user's computer (local time), as "YYYY-MM-DD".
export function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(value, days) {
  return toISODate(new Date(parseISODate(value).getTime() + days * DAY_MS));
}

// Adds whole months. If the day does not exist in the target month,
// the last day of that month is used: 2026-01-31 + 1 month = 2026-02-28.
export function addMonths(value, months) {
  const date = parseISODate(value);
  const targetMonth = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(
    Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0),
  ).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTarget);
  return toISODate(new Date(Date.UTC(date.getUTCFullYear(), targetMonth, day)));
}

// 0 = Sunday, 1 = Monday, … 6 = Saturday
export function dayOfWeek(value) {
  return parseISODate(value).getUTCDay();
}

export function isWeekend(value) {
  const day = dayOfWeek(value);
  return day === 0 || day === 6;
}

// Easter Sunday (Gregorian calendar), "anonymous" algorithm (Meeus/Jones/Butcher).
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISODate(new Date(Date.UTC(year, month - 1, day)));
}

// The 11 public holidays of metropolitan France, sorted by date.
export function frenchHolidays(year) {
  const easter = easterSunday(year);
  return [
    `${year}-01-01`, // Jour de l'an
    addDays(easter, 1), // Lundi de Pâques
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    addDays(easter, 39), // Ascension
    addDays(easter, 50), // Lundi de Pentecôte
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ].sort();
}

export function isFrenchHoliday(value) {
  const year = Number(value.slice(0, 4));
  return frenchHolidays(year).includes(value);
}

export function isWorkingDay(value) {
  return !isWeekend(value) && !isFrenchHoliday(value);
}

// What to do when a date falls on a weekend or a public holiday.
export const NON_WORKING_DAY_RULES = {
  next: 'Décaler au jour ouvré suivant',
  previous: 'Avancer au jour ouvré précédent',
  keep: 'Garder la date exacte',
};

// Returns { date, shifted }: the adjusted date and whether it moved.
export function adjustForNonWorkingDay(value, rule) {
  if (!(rule in NON_WORKING_DAY_RULES)) {
    throw new Error(`Règle de décalage inconnue : « ${rule} ».`);
  }
  if (rule === 'keep' || isWorkingDay(value)) {
    return { date: value, shifted: false };
  }
  const step = rule === 'next' ? 1 : -1;
  let date = value;
  do {
    date = addDays(date, step);
  } while (!isWorkingDay(date));
  return { date, shifted: true };
}

// "ven. 9 oct. 2026" (short) or "vendredi 9 octobre 2026" (long)
export function formatDateFr(value, { long = false } = {}) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseISODate(value));
}
