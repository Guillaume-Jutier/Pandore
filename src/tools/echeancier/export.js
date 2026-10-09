// Turns a study's deadlines into an .ics file.
import { buildCalendar } from '../../shared/ics.js';
import { computeSchedule } from './schedule.js';

export function icsFileName(study) {
  return `etude-${study.propaleNumber}.ics`;
}

export function studyToIcs(study, now = new Date()) {
  const { events } = computeSchedule(study);
  return buildCalendar({
    name: `Étude ${study.propaleNumber}`,
    now,
    // A stable identifier per deadline: re-importing the file updates the
    // existing events instead of creating duplicates.
    events: events.map((event) => ({
      uid: `${study.id}-${event.id}@pandore`,
      date: event.date,
      summary: event.title,
      description: event.note,
    })),
  });
}
