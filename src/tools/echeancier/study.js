// What a study looks like, and checks that do not depend on dates.
// A study never contains the client's name: only its proposal number.
import { CHANNELS, DEPOSIT_RATE, FIDELISATION_INTERVALS } from './rules.js';

// Proposal numbers look like "2026-014": year, dash, three digits.
const PROPALE_NUMBER = /^\d{4}-\d{3}$/;

// Meeting times look like "09:30" (what <input type="time"> returns).
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidPropaleNumber(value) {
  return typeof value === 'string' && PROPALE_NUMBER.test(value);
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME.test(value);
}

export function isValidDepositRate(value) {
  return (
    Number.isInteger(value) &&
    value >= DEPOSIT_RATE.min &&
    value <= DEPOSIT_RATE.max
  );
}

// Dates the user has not filled in yet are empty strings,
// which is also what an empty <input type="date"> returns.
export function createStudy({
  id,
  propaleNumber,
  channel = 'prospection',
  rdvDate = '',
  nonWorkingDayRule = 'next',
  now = new Date().toISOString(),
}) {
  if (!isValidPropaleNumber(propaleNumber)) {
    throw new Error(
      `Numéro de propale invalide : « ${propaleNumber} » (format attendu : 2026-014).`,
    );
  }
  if (!CHANNELS.some((item) => item.id === channel)) {
    throw new Error(`Canal d'arrivée inconnu : « ${channel} ».`);
  }
  return {
    id,
    propaleNumber,
    channel,
    nonWorkingDayRule,
    createdAt: now,
    updatedAt: now,

    // Avant la signature
    rdvDate,
    propaleChecks: {},
    propaleSentDate: '',

    // RDV client planned during the whole study
    meetings: [],

    // Pendant l'étude
    ceDate: '',
    depositRate: DEPOSIT_RATE.default,
    projectManagerPaid: false,
    phases: [],

    // Fin d'étude
    studyEndDate: '',
    pvrfDate: '',
    deliverableType: 'rapport',

    // Après l'étude
    fidelisationMonths: FIDELISATION_INTERVALS[0],
    mandateEndDate: '',
  };
}

// Fields removed in October 2026 (deontology test, RDV checklist, client at risk).
const REMOVED_FIELDS = ['deontology', 'rdvChecklist', 'clientAtRisk'];

// Completes a study read from disk with any field added in a later version
// of Pandore, and drops fields that no longer exist, so older files keep working.
export function normalizeStudy(raw) {
  const defaults = createStudy({
    id: raw.id,
    propaleNumber: raw.propaleNumber,
    channel: CHANNELS.some((item) => item.id === raw.channel)
      ? raw.channel
      : undefined,
    now: raw.createdAt,
  });
  const study = {
    ...defaults,
    ...raw,
    phases: Array.isArray(raw.phases) ? raw.phases : [],
    meetings: Array.isArray(raw.meetings) ? raw.meetings : [],
  };
  for (const field of REMOVED_FIELDS) delete study[field];
  return study;
}

export function createPhase(id) {
  return { id, start: '', end: '', pvri: false };
}

export function createMeeting(id) {
  return { id, date: '', time: '', subject: '' };
}
