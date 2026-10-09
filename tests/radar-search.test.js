import { describe, expect, it } from 'vitest';
import {
  buildSearch,
  detectSignals,
  matchesLocalFilters,
  signalServices,
  toCompany,
} from '../src/tools/radar-prospects/search.js';

const TODAY = '2026-10-10';

// Fictional API answer (never real companies or people in this public repository)
function rawCompany(overrides = {}) {
  return {
    siren: '123456789',
    nom_complet: 'EXEMPLE SAS',
    nom_raison_sociale: 'EXEMPLE',
    activite_principale: '62.01Z',
    section_activite_principale: 'J',
    categorie_entreprise: 'PME',
    tranche_effectif_salarie: '11',
    date_creation: '2022-03-01',
    siege: { code_postal: '44000', libelle_commune: 'NANTES', adresse: '1 RUE FICTIVE 44000 NANTES' },
    finances: { 2023: { ca: 900000, resultat_net: -1000 }, 2024: { ca: 1200000, resultat_net: 50000 } },
    dirigeants: [{ nom: 'DUPONT', prenoms: 'JEAN', date_de_naissance: '1980-01' }],
    ...overrides,
  };
}

describe('buildSearch : filtres envoyés à l’API', () => {
  it('construit les paramètres à partir du formulaire', () => {
    const { params, errors } = buildSearch(
      {
        departements: '44, 85',
        section: 'J',
        naf: '62.01z',
        categories: ['PME'],
        workforce: '10-49',
        activeOnly: true,
      },
      TODAY,
    );
    expect(errors).toEqual([]);
    expect(params).toEqual({
      etat_administratif: 'A',
      est_association: 'false',
      minimal: 'true',
      include: 'siege,finances',
      per_page: '25',
      departement: '44,85',
      section_activite_principale: 'J',
      activite_principale: '62.01Z',
      categorie_entreprise: 'PME',
      tranche_effectif_salarie: '11,12',
    });
  });

  it('exclut toujours les associations et ne demande jamais les dirigeants', () => {
    const { params } = buildSearch({ postalCodes: '44000' }, TODAY);
    expect(params.est_association).toBe('false');
    expect(params.minimal).toBe('true');
    expect(params.include).not.toContain('dirigeants');
  });

  it('exige une zone (département ou code postal)', () => {
    expect(buildSearch({}, TODAY).errors).toContain(
      'Indiquez au moins un département ou un code postal.',
    );
  });

  it('refuse les valeurs mal formées', () => {
    const { errors } = buildSearch({ departements: '4', postalCodes: '440', naf: '6201' }, TODAY);
    expect(errors).toHaveLength(3);
  });

  it('accepte la Corse et les outre-mer', () => {
    expect(buildSearch({ departements: '2A 2B 974' }, TODAY).errors).toEqual([]);
  });

  it('« actives uniquement » décoché : pas de filtre sur l’état', () => {
    expect(buildSearch({ departements: '44', activeOnly: false }, TODAY).params).not.toHaveProperty(
      'etat_administratif',
    );
  });

  it('la date de création est filtrée localement', () => {
    const { local } = buildSearch(
      { departements: '44', createdAfter: '2025-01-01', createdBefore: '2025-12-31' },
      TODAY,
    );
    expect(local).toEqual({ createdAfter: '2025-01-01', createdBefore: '2025-12-31', onlyWithSignal: false });
  });

  it('« créée depuis moins d’un an » remplace la date de début', () => {
    expect(buildSearch({ departements: '44', createdLastYear: true }, TODAY).local.createdAfter).toBe(
      '2025-10-10',
    );
  });

  it('signale des dates de création incohérentes', () => {
    const { errors } = buildSearch(
      { departements: '44', createdAfter: '2026-01-01', createdBefore: '2025-01-01' },
      TODAY,
    );
    expect(errors).toContain('La date « créée après » est postérieure à la date « créée avant ».');
  });
});

describe('toCompany : on ne garde que le nécessaire', () => {
  it('extrait les informations utiles et le dernier exercice publié', () => {
    expect(toCompany(rawCompany())).toEqual({
      siren: '123456789',
      name: 'EXEMPLE SAS',
      postalCode: '44000',
      city: 'NANTES',
      naf: '62.01Z',
      section: 'J',
      category: 'PME',
      workforceCode: '11',
      creationDate: '2022-03-01',
      finances: { year: '2024', revenue: 1200000, netResult: 50000 },
    });
  });

  it('ne recopie jamais les dirigeants ni l’adresse complète', () => {
    const text = JSON.stringify(toCompany(rawCompany()));
    expect(text).not.toContain('DUPONT');
    expect(text).not.toContain('1980');
    expect(text).not.toContain('RUE FICTIVE');
  });

  it('supporte une entreprise sans finances', () => {
    expect(toCompany(rawCompany({ finances: undefined })).finances).toBeNull();
  });
});

describe('detectSignals : signaux d’achat', () => {
  const company = (overrides) => toCompany(rawCompany(overrides));

  it('créée il y a moins d’un an', () => {
    expect(detectSignals(company({ date_creation: '2026-03-15' }), TODAY)).toEqual(['creation-recente']);
    expect(detectSignals(company({ date_creation: '2025-10-01' }), TODAY)).not.toContain(
      'creation-recente',
    );
  });

  it('PME de 1 à 7 ans avec un résultat net positif', () => {
    expect(detectSignals(company(), TODAY)).toEqual(['pme-developpement']);
  });

  it('pas de signal « développement » si résultat négatif, trop jeune, trop ancienne ou pas PME', () => {
    expect(detectSignals(company({ finances: { 2024: { resultat_net: -5 } } }), TODAY)).toEqual([]);
    expect(detectSignals(company({ finances: undefined }), TODAY)).toEqual([]);
    expect(detectSignals(company({ date_creation: '2018-01-01' }), TODAY)).toEqual([]);
    expect(detectSignals(company({ categorie_entreprise: 'GE' }), TODAY)).toEqual([]);
  });

  it('une entreprise de moins d’un an ne peut pas être « en développement »', () => {
    expect(detectSignals(company({ date_creation: '2026-01-01' }), TODAY)).toEqual(['creation-recente']);
  });

  it('associe les prestations types d’AJC', () => {
    expect(signalServices(['creation-recente'])).toEqual([
      'étude de marché',
      'business plan',
      'stratégie marketing',
    ]);
  });
});

describe('matchesLocalFilters', () => {
  const company = toCompany(rawCompany());

  it('filtre sur la date de création', () => {
    expect(matchesLocalFilters(company, [], { createdAfter: '2022-01-01', createdBefore: '' })).toBe(true);
    expect(matchesLocalFilters(company, [], { createdAfter: '2023-01-01', createdBefore: '' })).toBe(false);
    expect(matchesLocalFilters(company, [], { createdAfter: '', createdBefore: '2021-12-31' })).toBe(false);
  });

  it('« uniquement avec un signal »', () => {
    expect(matchesLocalFilters(company, [], { onlyWithSignal: true })).toBe(false);
    expect(matchesLocalFilters(company, ['pme-developpement'], { onlyWithSignal: true })).toBe(true);
  });
});
