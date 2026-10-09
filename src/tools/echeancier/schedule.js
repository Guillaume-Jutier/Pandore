// Computes every deadline of a study from the dates entered in its form.
// Pure function: same study in, same deadlines out. Covered by
// tests/echeancier-schedule.test.js.
import {
  addDays,
  addMonths,
  adjustForNonWorkingDay,
  isValidISODate,
} from '../../shared/dates.js';
import { isValidDepositRate, isValidTime } from './study.js';
import {
  DELAYS,
  DELIVERABLE_TYPES,
  DEPOSIT_RATE,
  GROUPS,
  MEETING_SUBJECT_MAX_LENGTH,
  PROPALE_CHECKS,
} from './rules.js';

const has = (date) => isValidISODate(date);

// Three kinds of dates:
// - "action": a follow-up task, moved according to the user's weekend rule;
// - "deadline": an "at the latest" date, only ever moved earlier;
// - "fixed": a contractual or legal date, never moved.
function placeDate(rawDate, kind, rule) {
  if (kind === 'fixed' || rule === 'keep') {
    return { date: rawDate, shifted: false };
  }
  return adjustForNonWorkingDay(
    rawDate,
    kind === 'deadline' ? 'previous' : rule,
  );
}

export function computeSchedule(study) {
  const events = [];
  const missing = [];
  const warnings = [];
  const rule = study.nonWorkingDayRule ?? 'next';

  function add(id, group, label, rawDate, kind, note = '', time = '') {
    const { date, shifted } = placeDate(rawDate, kind, rule);
    events.push({
      id,
      group,
      label,
      title: `Étude ${study.propaleNumber} : ${label}`,
      date,
      time, // "" = all day, otherwise "HH:MM"
      originalDate: rawDate,
      shifted,
      note,
    });
  }

  // ---------- Avant la signature ----------
  if (study.channel === 'appel-offre-cnje') {
    warnings.push({
      level: 'danger',
      text: "Appel d'offre CNJE : répondre vite, la première Junior qui répond récupère l'étude.",
    });
  }

  if (has(study.rdvDate)) {
    let sendDate;
    if (has(study.propaleSentDate)) {
      sendDate = study.propaleSentDate;
      add('propale-envoi', 'avant', 'propale envoyée', sendDate, 'fixed');
    } else {
      const planned = placeDate(
        addDays(study.rdvDate, DELAYS.propaleAfterRdv),
        'action',
        rule,
      );
      sendDate = planned.date;
      add(
        'propale-envoi',
        'avant',
        'envoi de la propale',
        addDays(study.rdvDate, DELAYS.propaleAfterRdv),
        'action',
        'RDV + 48 h, après les 3 validations : budget (Vice-trésorier), numéro (Secrétaire général), relecture qualité.',
      );
    }

    // Once the CE is signed, the proposal was accepted: no more reminders after that.
    const reminders = [
      ['propale-relance-1', 'relance propale 1', DELAYS.firstReminder],
      ['propale-relance-2', 'relance propale 2', DELAYS.secondReminder],
    ];
    for (const [id, label, delay] of reminders) {
      const rawDate = addDays(sendDate, delay);
      if (
        has(study.ceDate) &&
        placeDate(rawDate, 'action', rule).date >= study.ceDate
      ) {
        continue;
      }
      add(
        id,
        'avant',
        label,
        rawDate,
        'action',
        'Si la propale n’est pas encore acceptée.',
      );
    }
  } else {
    missing.push({ group: 'avant', text: 'Saisir la date du RDV client' });
  }

  const allPropaleChecks = PROPALE_CHECKS.every(
    (check) => study.propaleChecks?.[check.id],
  );
  if (has(study.propaleSentDate) && !allPropaleChecks) {
    warnings.push({
      level: 'warning',
      text: 'La propale est marquée envoyée alors que les 3 validations ne sont pas toutes cochées.',
    });
  }

  // ---------- Pendant l'étude ----------
  if (has(study.ceDate)) {
    if (has(study.rdvDate) && study.ceDate < study.rdvDate) {
      warnings.push({
        level: 'warning',
        text: 'La CE est datée avant le RDV client.',
      });
    }
    let rate = study.depositRate;
    if (!isValidDepositRate(rate)) {
      warnings.push({
        level: 'warning',
        text: `Taux d'acompte invalide : saisir un pourcentage entre ${DEPOSIT_RATE.min} et ${DEPOSIT_RATE.max}. ${DEPOSIT_RATE.default} % utilisé en attendant.`,
      });
      rate = DEPOSIT_RATE.default;
    }
    add(
      'acompte',
      'pendant',
      `facture d'acompte (${rate} %)`,
      study.ceDate,
      'fixed',
      `${DEPOSIT_RATE.default} % en général, jamais 100 %.`,
    );
    if (study.projectManagerPaid) {
      add(
        'rdm-cdp',
        'pendant',
        'RDM du chef de projet (au plus tôt ce jour)',
        study.ceDate,
        'fixed',
        'Seulement si le chef de projet est rétribué.',
      );
    }
  } else {
    missing.push({
      group: 'pendant',
      text: 'Saisir la date de signature de la CE',
    });
  }

  const phases = study.phases ?? [];
  if (phases.length === 0) {
    missing.push({ group: 'pendant', text: 'Ajouter au moins une phase' });
  }
  phases.forEach((phase, index) => {
    const n = index + 1;
    if (!has(phase.start) || !has(phase.end)) {
      missing.push({
        group: 'pendant',
        text: `Phase ${n} : saisir le début et la fin`,
      });
      return;
    }
    if (phase.end < phase.start) {
      warnings.push({
        level: 'warning',
        text: `Phase ${n} : la fin est avant le début.`,
      });
      return;
    }
    if (has(study.ceDate) && phase.start < study.ceDate) {
      warnings.push({
        level: 'warning',
        text: `Phase ${n} : elle commence avant la signature de la CE.`,
      });
    }
    add(
      `phase-${n}-rdm`,
      'pendant',
      `RDM intervenants phase ${n} : date limite de signature`,
      phase.start,
      'fixed',
      "Signé au plus tard au début de la phase ; il ne dépasse pas la fin de scolarité de l'intervenant.",
    );
    add(
      `phase-${n}-avenant`,
      'pendant',
      `phase ${n} : dernier jour pour signer un avenant`,
      phase.end,
      'fixed',
      "Après la fin de la phase sans avenant, l'étude passe Hors-Qualité.",
    );
    if (phase.pvri) {
      add(
        `phase-${n}-pvri`,
        'pendant',
        `PVRI et facture intermédiaire phase ${n}`,
        phase.end,
        'fixed',
        'Jamais de facture intermédiaire sans PVRI.',
      );
      add(
        `phase-${n}-pvri-garantie`,
        'pendant',
        `fin de garantie PVRI phase ${n}`,
        addDays(phase.end, DELAYS.pvriWarranty),
        'fixed',
      );
    }
  });

  // ---------- Fin d'étude ----------
  if (has(study.studyEndDate)) {
    const lastPhaseEnd = phases
      .map((phase) => phase.end)
      .filter(has)
      .sort()
      .at(-1);
    if (lastPhaseEnd && lastPhaseEnd > study.studyEndDate) {
      warnings.push({
        level: 'warning',
        text: "Une phase se termine après la date de fin d'étude.",
      });
    }
    add(
      'presentation',
      'fin',
      'présentation au client (au plus tard)',
      addDays(study.studyEndDate, -DELAYS.presentationBeforeEnd),
      'deadline',
      "Au moins 1 semaine avant la fin de l'étude.",
    );
  }

  const pvrf = has(study.pvrfDate) ? study.pvrfDate : study.studyEndDate;
  if (has(pvrf)) {
    const planned = !has(study.pvrfDate);
    add(
      'pvrf',
      'fin',
      planned
        ? "signature du PVRF (prévue à la fin d'étude)"
        : 'signature du PVRF',
      pvrf,
      'fixed',
      'Après la remise des livrables. Émettre la facture de solde.',
    );
    add(
      'questionnaires',
      'fin',
      'questionnaires de satisfaction (client et intervenants)',
      pvrf,
      'fixed',
    );
    add(
      'solde',
      'fin',
      'échéance du paiement du solde',
      addDays(pvrf, DELAYS.balancePayment),
      'fixed',
      'Solde payable sous 30 jours. AJC reste propriétaire des travaux jusqu’au paiement complet.',
    );
    const deliverable =
      DELIVERABLE_TYPES[study.deliverableType] ?? DELIVERABLE_TYPES.rapport;
    add(
      'garantie',
      'fin',
      `fin de la garantie (${deliverable.warrantyMonths} mois)`,
      addMonths(pvrf, deliverable.warrantyMonths),
      'fixed',
    );

    // ---------- Après l'étude ----------
    add(
      'temoignage',
      'apres',
      'proposer un témoignage au client',
      addDays(pvrf, DELAYS.testimonialAfterPvrf),
      'action',
      "S'il est satisfait.",
    );
    const interval = study.fidelisationMonths === 3 ? 3 : 2;
    const count = Math.floor(DELAYS.fidelisationDurationMonths / interval);
    for (let k = 1; k <= count; k += 1) {
      add(
        `fidelisation-${k}`,
        'apres',
        'fidélisation : prendre des nouvelles du client',
        addMonths(pvrf, k * interval),
        'action',
        'Nouvelles du projet, invitation aux événements AJC, détection d’un nouveau besoin.',
      );
    }
  } else {
    missing.push({ group: 'fin', text: "Saisir la date de fin d'étude" });
  }

  if (has(study.mandateEndDate)) {
    add(
      'passation',
      'apres',
      'passation du suivi client au filleul',
      addMonths(study.mandateEndDate, -DELAYS.handoverBeforeMandateEndMonths),
      'action',
    );
  }

  // ---------- RDV client ----------
  // Placed in the stage matching their date. Never moved: the date was agreed with the client.
  (study.meetings ?? []).forEach((meeting, index) => {
    const n = index + 1;
    if (!has(meeting.date)) {
      missing.push({
        group: meetingGroup(study, ''),
        text: `RDV client ${n} : saisir la date`,
      });
      return;
    }
    const subject = String(meeting.subject ?? '')
      .trim()
      .slice(0, MEETING_SUBJECT_MAX_LENGTH);
    const time = isValidTime(meeting.time) ? meeting.time : '';
    add(
      `rdv-${meeting.id}`,
      meetingGroup(study, meeting.date),
      subject ? `RDV client : ${subject}` : 'RDV client',
      meeting.date,
      'fixed',
      '',
      time,
    );
  });

  // Sort by date, then by time (all-day first); otherwise keep the insertion order.
  const sortKey = (event) => `${event.date} ${event.time}`;
  events.sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0,
  );
  return { events, missing, warnings };
}

// Stage of a client meeting, from its date: before the CE, during the study,
// or after the PVRF.
function meetingGroup(study, date) {
  if (!has(date) || !has(study.ceDate) || date < study.ceDate) return 'avant';
  const pvrf = has(study.pvrfDate) ? study.pvrfDate : study.studyEndDate;
  if (has(pvrf) && date > pvrf) return 'apres';
  return 'pendant';
}

// Where the study stands today, for the list of studies.
export function studyStage(study, today) {
  if (!has(study.ceDate) || study.ceDate > today) return 'avant';
  const pvrf = has(study.pvrfDate) ? study.pvrfDate : study.studyEndDate;
  if (!has(pvrf) || pvrf > today) return 'pendant';
  return 'terminee';
}

export function nextEvent(events, today) {
  return events.find((event) => event.date >= today) ?? null;
}

export function groupLabel(groupId) {
  return GROUPS.find((group) => group.id === groupId)?.label ?? groupId;
}
