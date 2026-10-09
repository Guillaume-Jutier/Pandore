// Live preview of a study's deadlines, grouped by stage.
import { capitalize, el } from '../../../shared/dom.js';
import { formatDateFr } from '../../../shared/dates.js';
import { GROUPS } from '../rules.js';
import { computeSchedule } from '../schedule.js';

function eventRow(event, today) {
  const isPast = event.date < today;
  const isToday = event.date === today;

  return el(
    'li',
    { className: `ech-event${isPast ? ' ech-event-past' : ''}` },
    el(
      'span',
      { className: 'ech-event-date' },
      formatDateFr(event.date),
      event.time
        ? el('span', { className: 'ech-event-time' }, event.time.replace(':', ' h '))
        : null,
    ),
    el(
      'span',
      { className: 'ech-event-body' },
      el(
        'span',
        { className: 'ech-event-label' },
        capitalize(event.label),
        isToday ? el('span', { className: 'ech-pill ech-pill-accent' }, "aujourd'hui") : null,
        isPast ? el('span', { className: 'ech-pill ech-pill-muted' }, 'passée') : null,
        event.shifted
          ? el(
              'span',
              {
                className: 'ech-pill ech-pill-warning',
                title: `Initialement le ${formatDateFr(event.originalDate)} (week-end ou jour férié)`,
              },
              'décalé',
            )
          : null,
      ),
      event.note ? el('span', { className: 'ech-event-note' }, event.note) : null,
    ),
  );
}

export function renderTimeline(container, study, today) {
  const { events, missing, warnings } = computeSchedule(study);

  const alerts = warnings.map((warning) =>
    el('div', { className: `ech-alert ech-alert-${warning.level}` }, warning.text),
  );

  const groups = GROUPS.map((group) => {
    const groupEvents = events.filter((event) => event.group === group.id);
    const groupMissing = missing.filter((item) => item.group === group.id);
    if (groupEvents.length === 0 && groupMissing.length === 0) return null;

    return el(
      'section',
      { className: 'ech-timeline-group' },
      el('h3', {}, group.label),
      el(
        'ul',
        { className: 'ech-events' },
        groupEvents.map((event) => eventRow(event, today)),
        groupMissing.map((item) =>
          el(
            'li',
            { className: 'ech-event ech-event-missing' },
            el('span', { className: 'ech-event-date' }, 'à compléter'),
            el('span', { className: 'ech-event-body' }, item.text),
          ),
        ),
      ),
    );
  });

  container.replaceChildren(
    el(
      'div',
      { className: 'ech-timeline-header' },
      el('h2', {}, 'Aperçu des échéances'),
      el(
        'span',
        { className: 'ech-muted ech-small' },
        events.length === 1 ? '1 échéance' : `${events.length} échéances`,
      ),
    ),
    ...alerts,
    ...groups.filter(Boolean),
  );
}
