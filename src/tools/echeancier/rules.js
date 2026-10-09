// Business rules of the Échéancier (sources: CLAUDE.md and AJC's
// "Suivi de projet" training, September 2026). Labels are shown to the user.

export const CHANNELS = [
  { id: 'prospection', label: 'Prospection' },
  { id: 'fidelisation', label: 'Fidélisation' },
  { id: 'spontane', label: 'Contact spontané' },
  { id: 'appel-offre-cnje', label: "Appel d'offre CNJE" },
];

export const PROPALE_CHECKS = [
  { id: 'budget', label: 'Budget validé par le Vice-trésorier' },
  { id: 'numero', label: 'Numéro demandé au Secrétaire général' },
  { id: 'relecture', label: 'Relecture qualité' },
];

export const DELIVERABLE_TYPES = {
  rapport: { label: 'Rapport', warrantyMonths: 1 },
  autre: { label: 'Autres livrables', warrantyMonths: 3 },
};

// Deposit (acompte): 60 % by default, adjustable per study, never 100 %.
export const DEPOSIT_RATE = { default: 60, min: 1, max: 99 };

// Client meetings added by the project manager
export const MEETING_SUBJECT_MAX_LENGTH = 80;
export const MEETING_DURATION_HOURS = 1;

// Delays, in days unless stated otherwise
export const DELAYS = {
  propaleAfterRdv: 2, // RDV + 48 h
  firstReminder: 3, // envoi + 3 jours
  secondReminder: 10, // envoi + 10 jours
  pvriWarranty: 7, // garantie préconisée après un PVRI
  presentationBeforeEnd: 7, // au moins 1 semaine avant la fin
  balancePayment: 30, // solde payable sous 30 jours
  testimonialAfterPvrf: 14,
  fidelisationDurationMonths: 12,
  handoverBeforeMandateEndMonths: 1,
};

export const FIDELISATION_INTERVALS = [2, 3]; // months

export const GROUPS = [
  { id: 'avant', label: 'Avant la signature' },
  { id: 'pendant', label: "Pendant l'étude" },
  { id: 'fin', label: "Fin d'étude" },
  { id: 'apres', label: "Après l'étude" },
];
