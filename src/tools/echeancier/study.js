// What a study looks like, and checks that do not depend on dates.
// A study never contains the client's name: only its proposal number.
import {
  CHANNELS,
  DEONTOLOGY_CONDITIONAL,
  DEONTOLOGY_FORBIDDEN,
  FIDELISATION_INTERVALS,
} from './rules.js';

// Proposal numbers look like "2026-014": year, dash, three digits.
const PROPALE_NUMBER = /^\d{4}-\d{3}$/;

export function isValidPropaleNumber(value) {
  return typeof value === 'string' && PROPALE_NUMBER.test(value);
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
    rdvChecklist: {},
    deontology: { forbidden: [], conditional: [], teachingLink: false },
    propaleChecks: {},
    propaleSentDate: '',

    // Pendant l'étude
    ceDate: '',
    clientAtRisk: false,
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

// Completes a study read from disk with any field added in a later version
// of Pandore, so older files keep working.
export function normalizeStudy(raw) {
  const defaults = createStudy({
    id: raw.id,
    propaleNumber: raw.propaleNumber,
    channel: CHANNELS.some((item) => item.id === raw.channel) ? raw.channel : undefined,
    now: raw.createdAt,
  });
  return {
    ...defaults,
    ...raw,
    deontology: { ...defaults.deontology, ...raw.deontology },
    phases: Array.isArray(raw.phases) ? raw.phases : [],
  };
}

export function createPhase(id) {
  return { id, start: '', end: '', pvri: false };
}

// Returns the messages to show for the deontology test.
// level "danger" = forbidden, "warning" = condition to respect or missing answer.
export function deontologyMessages(deontology) {
  const messages = [];

  for (const item of DEONTOLOGY_FORBIDDEN) {
    if (deontology.forbidden.includes(item.id)) {
      messages.push({
        level: 'danger',
        text: `Interdit : ${item.label.toLowerCase()}. AJC ne peut pas réaliser cette étude.`,
      });
    }
  }

  for (const item of DEONTOLOGY_CONDITIONAL) {
    if (deontology.conditional.includes(item.id)) {
      messages.push({ level: 'warning', text: `${item.label} : ${item.condition}` });
    }
  }

  if (!deontology.teachingLink) {
    messages.push({
      level: 'warning',
      text: "Obligatoire : l'étude doit avoir un lien avec un enseignement de l'école.",
    });
  }

  return messages;
}
