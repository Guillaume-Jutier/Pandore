// Follow-up of prospects: statuses, reminders, opposition list, retention.
// Pure functions, covered by tests/radar-prospects.test.js.
import {
  addDays,
  addMonths,
  adjustForNonWorkingDay,
  isValidISODate,
} from '../../shared/dates.js';
import { REMINDER_DELAYS, RETENTION_YEARS, STATUSES } from './rules.js';

// Only what is needed to follow up a company (data minimisation).
export function createProspect(company, signals, today) {
  return {
    siren: company.siren,
    name: company.name,
    postalCode: company.postalCode,
    city: company.city,
    departement: company.departement,
    naf: company.naf,
    section: company.section,
    category: company.category,
    workforceCode: company.workforceCode,
    creationDate: company.creationDate,
    signals: [...signals],
    contactEmail: '', // generic address found by the member (contact@…)
    status: 'a-contacter',
    statusHistory: [{ status: 'a-contacter', date: today }],
    addedAt: today,
    firstContactDate: '',
    lastContactDate: '',
  };
}

const CONTACT_STATUSES = ['contacte', 'relance', 'rdv', 'refus'];

// Returns a new prospect with the new status. "Contacté" sets the first contact
// date; every contact-type status updates the last contact date.
export function withStatus(prospect, status, today) {
  if (!STATUSES[status]) throw new Error(`Statut inconnu : « ${status} ».`);
  const updated = {
    ...prospect,
    status,
    statusHistory: [...prospect.statusHistory, { status, date: today }],
  };
  if (CONTACT_STATUSES.includes(status)) {
    updated.lastContactDate = today;
    if (!updated.firstContactDate) updated.firstContactDate = today;
  }
  return updated;
}

// Planned reminders: first contact + 7 and + 21 days, on working days.
// Only while waiting for an answer (status "contacté" or "relancé"),
// and only those still ahead of the last contact.
export function reminders(prospect) {
  if (!['contacte', 'relance'].includes(prospect.status)) return [];
  if (!isValidISODate(prospect.firstContactDate)) return [];
  return REMINDER_DELAYS.map((delay, index) => ({
    number: index + 1,
    date: adjustForNonWorkingDay(
      addDays(prospect.firstContactDate, delay),
      'next',
    ).date,
  })).filter((reminder) => reminder.date > prospect.lastContactDate);
}

// CNIL: a prospect is deleted 3 years after the last contact
// (or after being added, if never contacted).
export function expiryDate(prospect) {
  const reference = prospect.lastContactDate || prospect.addedAt;
  return addMonths(reference, 12 * RETENTION_YEARS);
}

export function purgeExpired(prospects, today) {
  const kept = prospects.filter((prospect) => expiryDate(prospect) > today);
  return { kept, removedCount: prospects.length - kept.length };
}

// The opposition list keeps only the SIREN and the date: never anything else.
export function addOpposition(oppositions, siren, today) {
  if (oppositions.some((item) => item.siren === siren)) return oppositions;
  return [...oppositions, { siren, date: today }];
}

export function isOpposed(oppositions, siren) {
  return oppositions.some((item) => item.siren === siren);
}

// Calendar events for the reminders. Neutral titles: SIREN only, never a name
// (a sole trader's company name is often a person's name).
export function reminderEvents(prospects) {
  return prospects.flatMap((prospect) =>
    reminders(prospect).map((reminder) => ({
      uid: `radar-${prospect.siren}-relance-${reminder.number}@pandore`,
      date: reminder.date,
      summary: `Prospection AJC : relance ${reminder.number} (SIREN ${prospect.siren})`,
      description: 'Retrouvez le prospect dans Pandore, onglet « Mon suivi ».',
    })),
  );
}
