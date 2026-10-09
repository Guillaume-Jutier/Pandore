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
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// events: [{ uid, date: 'YYYY-MM-DD', summary, description? }]
// Each event lasts the whole day, with a reminder the day before at 9:00.
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
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
      // For all-day events, the end date is the day after (excluded).
      `DTEND;VALUE=DATE:${icsDate(addDays(event.date, 1))}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push(
      'TRANSP:TRANSPARENT', // shown as "free", does not block the agenda
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.summary)}`,
      'TRIGGER:-PT15H', // 15 h before midnight = 9:00 the day before
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
