// Builds an iCalendar (.ics) file, the format read by Outlook, Google Calendar
// and iPhone. Specification: RFC 5545. No dependency needed for our use:
// all-day events with a reminder.
import { addDays } from './dates.js';

const CRLF = '\r\n';

// Characters with a special meaning in .ics text must be escaped.
export function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 bytes must be split; continuation lines start with a space.
// We count bytes (UTF-8), not characters, and never split an accented letter.
export function foldLine(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let current = '';
  let currentBytes = 0;
  let limit = 75;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      limit = 74; // the leading space of continuation lines counts too
    }
    current += char;
    currentBytes += charBytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

// "2026-10-12" -> "20261012"
function icsDate(isoDate) {
  return isoDate.replaceAll('-', '');
}

// Date object -> "20261009T143000Z" (UTC)
function icsTimestamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// "2026-11-14" + "10:30" -> "20261114T103000" (local time of the calendar app)
function icsLocalDateTime(isoDate, time) {
  return `${icsDate(isoDate)}T${time.replace(':', '')}00`;
}

// events: [{ uid, date: 'YYYY-MM-DD', time?: 'HH:MM', durationHours?, summary, description? }]
// Without a time, the event lasts the whole day, with a reminder the day before at 9:00.
// With a time, it lasts `durationHours` (1 by default), with a reminder 1 hour before.
export function buildCalendar({ name, events, now = new Date() }) {
  const stamp = icsTimestamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AJC//Pandore//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp}`);
    if (event.time) {
      lines.push(
        `DTSTART:${icsLocalDateTime(event.date, event.time)}`,
        `DURATION:PT${event.durationHours ?? 1}H`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
        // For all-day events, the end date is the day after (excluded).
        `DTEND;VALUE=DATE:${icsDate(addDays(event.date, 1))}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push(
      // Deadlines are shown as "free"; a meeting with a time blocks the agenda.
      event.time ? 'TRANSP:OPAQUE' : 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.summary)}`,
      // All day: 15 h before midnight = 9:00 the day before. Timed: 1 hour before.
      event.time ? 'TRIGGER:-PT1H' : 'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
