// Business rules of the Échéancier (sources: CLAUDE.md and AJC's
// "Suivi de projet" training, September 2026). Labels are shown to the user.

export const CHANNELS = [
  { id: 'prospection', label: 'Prospection' },
  { id: 'fidelisation', label: 'Fidélisation' },
  { id: 'spontane', label: 'Contact spontané' },
  { id: 'appel-offre-cnje', label: "Appel d'offre CNJE" },
];

export const RDV_CHECKLIST = [
  { id: 'besoins', label: 'Besoins' },
  { id: 'enjeux', label: 'Enjeux' },
  { id: 'budget', label: 'Budget' },
  { id: 'echeancier', label: 'Échéancier' },
  { id: 'risques', label: 'Risques' },
];

export const RDV_REMINDER = 'Pas de budget précis au RDV.';

export const DEONTOLOGY_FORBIDDEN = [
  { id: 'vente-produit', label: 'Vente de produit' },
  { id: 'maintenance', label: 'Contrat de maintenance' },
  { id: 'base-prospects', label: "Constitution d'une base de prospects" },
  {
    id: 'domaine-reglemente',
    label: 'Domaine réglementé (juridique, comptable, médical)',
  },
];

export const DEONTOLOGY_CONDITIONAL = [
  {
    id: 'traduction',
    label: 'Traduction',
    condition: "Possible uniquement si l'école enseigne la langue.",
  },
  {
    id: 'prospection',
    label: 'Prospection',
    condition: 'Possible uniquement si elle est intégrée à une étude plus complète.',
  },
  {
    id: 'apport-partenaire',
    label: 'Apport par un partenaire',
    condition:
      'Possible avec une clause de communication et un cahier des charges rédigé par AJC.',
  },
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

export const DEPOSIT_RATE = { normal: 30, risk: 50 };

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
