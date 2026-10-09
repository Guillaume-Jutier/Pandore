// Search filters, API answers and buying signals. Pure functions: they are
// used by the main process (network) and covered by tests/radar-search.test.js.
import { addMonths, isValidISODate } from '../../shared/dates.js';
import {
  API,
  CATEGORIES,
  DEVELOPMENT_SIGNAL,
  SECTIONS,
  SIGNALS,
  WORKFORCE_GROUPS,
} from './rules.js';

const DEPARTEMENT = /^(\d{2}|2A|2B|97\d)$/;
const POSTAL_CODE = /^\d{5}$/;
const NAF_CODE = /^\d{2}\.\d{2}[A-Z]$/;

// "44, 85 ;49" -> ["44", "85", "49"]
function splitList(value) {
  return String(value ?? '')
    .split(/[\s,;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

// Checks the search form and turns it into API parameters.
// Returns { params, local, errors }: `params` go to the API, `local` filters are
// applied to the answers (the API cannot filter on the creation date).
export function buildSearch(filters, today) {
  const errors = [];
  const params = {
    etat_administratif: filters.activeOnly === false ? undefined : 'A',
    est_association: 'false', // decision: associations are excluded
    minimal: 'true', // no executives' personal data (names, birth dates)
    include: 'siege,finances',
    per_page: String(API.perPage),
  };

  const departements = splitList(filters.departements);
  const postalCodes = splitList(filters.postalCodes);
  const wrongDepartements = departements.filter((code) => !DEPARTEMENT.test(code));
  const wrongPostalCodes = postalCodes.filter((code) => !POSTAL_CODE.test(code));
  if (wrongDepartements.length) {
    errors.push(`Département invalide : ${wrongDepartements.join(', ')} (ex. 44).`);
  }
  if (wrongPostalCodes.length) {
    errors.push(`Code postal invalide : ${wrongPostalCodes.join(', ')} (ex. 44000).`);
  }
  if (departements.length === 0 && postalCodes.length === 0) {
    errors.push('Indiquez au moins un département ou un code postal.');
  }
  if (departements.length) params.departement = departements.join(',');
  if (postalCodes.length) params.code_postal = postalCodes.join(',');

  if (filters.section) {
    if (!SECTIONS[filters.section]) errors.push('Secteur inconnu.');
    else params.section_activite_principale = filters.section;
  }

  const nafCodes = splitList(filters.naf);
  const wrongNaf = nafCodes.filter((code) => !NAF_CODE.test(code));
  if (wrongNaf.length) errors.push(`Code NAF invalide : ${wrongNaf.join(', ')} (ex. 62.01Z).`);
  else if (nafCodes.length) params.activite_principale = nafCodes.join(',');

  const categories = (filters.categories ?? []).filter((category) => CATEGORIES[category]);
  if (categories.length) params.categorie_entreprise = categories.join(',');

  if (filters.workforce) {
    const group = WORKFORCE_GROUPS[filters.workforce];
    if (!group) errors.push("Tranche d'effectif inconnue.");
    else params.tranche_effectif_salarie = group.codes.join(',');
  }

  // Creation date: filtered locally on the answers
  let createdAfter = filters.createdLastYear ? addMonths(today, -12) : filters.createdAfter || '';
  const createdBefore = filters.createdBefore || '';
  for (const [label, value] of [
    ['Créée après le', createdAfter],
    ['Créée avant le', createdBefore],
  ]) {
    if (value && !isValidISODate(value)) errors.push(`${label} : date invalide.`);
  }
  if (createdAfter && createdBefore && createdAfter > createdBefore) {
    errors.push('La date « créée après » est postérieure à la date « créée avant ».');
  }
  if (!isValidISODate(createdAfter)) createdAfter = '';

  for (const key of Object.keys(params)) {
    if (params[key] === undefined) delete params[key];
  }

  return {
    params,
    local: {
      createdAfter,
      createdBefore: isValidISODate(createdBefore) ? createdBefore : '',
      onlyWithSignal: Boolean(filters.onlyWithSignal),
    },
    errors,
  };
}

// Keeps only what the Radar needs from an API answer (data minimisation).
// Executives are never requested, and never copied here.
export function toCompany(raw) {
  const finances = raw.finances ?? {};
  const lastYear = Object.keys(finances).sort().at(-1);
  return {
    siren: String(raw.siren),
    name: raw.nom_complet ?? raw.nom_raison_sociale ?? 'Nom non diffusé',
    postalCode: raw.siege?.code_postal ?? '',
    city: raw.siege?.libelle_commune ?? '',
    naf: raw.activite_principale ?? '',
    section: raw.section_activite_principale ?? '',
    category: raw.categorie_entreprise ?? '',
    workforceCode: raw.tranche_effectif_salarie ?? 'NN',
    creationDate: raw.date_creation ?? '',
    finances: lastYear
      ? {
          year: lastYear,
          revenue: finances[lastYear]?.ca ?? null,
          netResult: finances[lastYear]?.resultat_net ?? null,
        }
      : null,
  };
}

// Buying signals of a company, as of `today`.
export function detectSignals(company, today) {
  const signals = [];
  const created = company.creationDate;
  if (!isValidISODate(created)) return signals;

  if (created > addMonths(today, -12) && created <= today) {
    signals.push('creation-recente');
  }

  const youngest = addMonths(today, -12 * DEVELOPMENT_SIGNAL.minAgeYears);
  const oldest = addMonths(today, -12 * DEVELOPMENT_SIGNAL.maxAgeYears);
  if (
    company.category === 'PME' &&
    created <= youngest &&
    created >= oldest &&
    company.finances?.netResult > 0
  ) {
    signals.push('pme-developpement');
  }
  return signals;
}

export function matchesLocalFilters(company, signals, local) {
  if (local.createdAfter && !(company.creationDate >= local.createdAfter)) return false;
  if (local.createdBefore && !(company.creationDate <= local.createdBefore)) return false;
  if (local.onlyWithSignal && signals.length === 0) return false;
  return true;
}

export function signalServices(signalIds) {
  return [...new Set(signalIds.flatMap((id) => SIGNALS[id]?.services ?? []))];
}
