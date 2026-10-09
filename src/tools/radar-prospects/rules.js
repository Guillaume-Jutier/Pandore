// Business rules of the Radar Prospects (sources: CLAUDE.md and decisions
// taken with Guillaume in October 2026). Labels are shown to the user.

export const API = {
  baseUrl: 'https://recherche-entreprises.api.gouv.fr/search',
  perPage: 25, // maximum allowed by the API
  maxPages: 20, // at most 500 companies analysed per search
  minIntervalMs: 250, // at most 4 requests per second (API limit: 7)
  timeoutMs: 15000,
  maxRetries: 2, // after an HTTP 429 "too many requests"
};

// Public company page, to let the member look for a generic contact himself.
export function companyPageUrl(siren) {
  return `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`;
}

// NAF sections (INSEE). `phrase` completes "les entreprises …" in emails.
export const SECTIONS = {
  A: {
    label: 'Agriculture, sylviculture et pêche',
    phrase: 'du secteur agricole',
  },
  B: { label: 'Industries extractives', phrase: 'des industries extractives' },
  C: { label: 'Industrie manufacturière', phrase: 'du secteur industriel' },
  D: {
    label: "Production et distribution d'énergie",
    phrase: "du secteur de l'énergie",
  },
  E: {
    label: 'Eau, assainissement, gestion des déchets',
    phrase: "de l'eau et de l'environnement",
  },
  F: { label: 'Construction', phrase: 'du bâtiment et de la construction' },
  G: { label: 'Commerce ; réparation automobile', phrase: 'du commerce' },
  H: {
    label: 'Transports et entreposage',
    phrase: 'du transport et de la logistique',
  },
  I: {
    label: 'Hébergement et restauration',
    phrase: "de l'hôtellerie et de la restauration",
  },
  J: {
    label: 'Information et communication',
    phrase: 'du numérique et de la communication',
  },
  K: {
    label: "Activités financières et d'assurance",
    phrase: 'de la finance et de l’assurance',
  },
  L: { label: 'Activités immobilières', phrase: "de l'immobilier" },
  M: {
    label: 'Activités spécialisées, scientifiques et techniques',
    phrase: 'des services spécialisés et techniques',
  },
  N: {
    label: 'Services administratifs et de soutien',
    phrase: 'des services aux entreprises',
  },
  O: { label: 'Administration publique', phrase: 'du secteur public' },
  P: { label: 'Enseignement', phrase: "de l'enseignement et de la formation" },
  Q: {
    label: 'Santé humaine et action sociale',
    phrase: 'de la santé et de l’action sociale',
  },
  R: {
    label: 'Arts, spectacles et activités récréatives',
    phrase: 'de la culture et des loisirs',
  },
  S: { label: 'Autres activités de services', phrase: 'des services' },
  T: {
    label: 'Activités des ménages employeurs',
    phrase: 'des services aux ménages',
  },
  U: {
    label: 'Activités extra-territoriales',
    phrase: 'des organisations internationales',
  },
};

// Workforce bands (INSEE codes) grouped for the search form.
export const WORKFORCE_GROUPS = {
  0: { label: 'Sans salarié', codes: ['00'] },
  '1-9': { label: '1 à 9 salariés', codes: ['01', '02', '03'] },
  '10-49': { label: '10 à 49 salariés', codes: ['11', '12'] },
  '50-249': { label: '50 à 249 salariés', codes: ['21', '22', '31'] },
  '250+': {
    label: '250 salariés ou plus',
    codes: ['32', '41', '42', '51', '52', '53'],
  },
};

export const WORKFORCE_LABELS = {
  NN: 'Effectif non renseigné',
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  11: '10 à 19 salariés',
  12: '20 à 49 salariés',
  21: '50 à 99 salariés',
  22: '100 à 199 salariés',
  31: '200 à 249 salariés',
  32: '250 à 499 salariés',
  41: '500 à 999 salariés',
  42: '1 000 à 1 999 salariés',
  51: '2 000 à 4 999 salariés',
  52: '5 000 à 9 999 salariés',
  53: '10 000 salariés ou plus',
};

export const CATEGORIES = {
  PME: 'PME',
  ETI: 'ETI (taille intermédiaire)',
  GE: 'Grande entreprise',
};

// Buying signals and the typical AJC services that go with them.
export const SIGNALS = {
  'creation-recente': {
    label: 'Créée il y a moins d’un an',
    services: ['étude de marché', 'business plan', 'stratégie marketing'],
  },
  'pme-developpement': {
    label: 'PME qui se développe (indice)',
    services: [
      'stratégie commerciale',
      'étude de satisfaction',
      'analyse financière',
    ],
  },
};

// "PME qui se développe": PME, created 1 to 7 years ago, positive net result
// in the last published accounts. A hint, not proof (the API gives one year only).
export const DEVELOPMENT_SIGNAL = { minAgeYears: 1, maxAgeYears: 7 };

export const STATUSES = {
  'a-contacter': 'À contacter',
  contacte: 'Contacté',
  relance: 'Relancé',
  rdv: 'RDV obtenu',
  refus: 'Refus',
};

// Reminders after the first contact, in days (moved to the next working day).
export const REMINDER_DELAYS = [7, 21];

// CNIL recommendation: delete a prospect 3 years after the last contact.
export const RETENTION_YEARS = 3;

export const OPT_OUT_NOTICE =
  "Vos coordonnées professionnelles proviennent de l'annuaire public des entreprises (data.gouv.fr). Pour ne plus être contacté par AJC, répondez simplement STOP à ce message.";
