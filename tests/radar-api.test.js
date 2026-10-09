import { describe, expect, it } from 'vitest';
import { createRateLimiter, searchCompanies } from '../src/main/entreprises-api.js';

const TODAY = '2026-10-10';

// Fictional answers (never real companies in this public repository)
function apiCompany(n, overrides = {}) {
  return {
    siren: String(100000000 + n),
    nom_complet: `EXEMPLE ${n}`,
    section_activite_principale: 'J',
    activite_principale: '62.01Z',
    categorie_entreprise: 'PME',
    date_creation: '2026-05-01',
    siege: { code_postal: '44000', libelle_commune: 'NANTES' },
    ...overrides,
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body,
  };
}

// Fake API: `pages` is a list of result arrays; records the URLs called.
function fakeApi(pages, { totalResults } = {}) {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const page = Number(new URL(url).searchParams.get('page'));
    return jsonResponse({
      results: pages[page - 1] ?? [],
      total_results: totalResults ?? pages.flat().length,
      total_pages: pages.length,
    });
  };
  return { fetchFn, calls };
}

const options = (fetchFn, extra = {}) => ({
  today: TODAY,
  fetchFn,
  sleep: async () => {},
  waitForSlot: async () => {},
  userAgent: 'Pandore/test',
  ...extra,
});

describe('searchCompanies', () => {
  it('interroge la bonne adresse avec les filtres et un User-Agent explicite', async () => {
    const { fetchFn, calls } = fakeApi([[apiCompany(1)]]);
    await searchCompanies({ departements: '44', section: 'J' }, options(fetchFn));
    const { url, options: request } = calls[0];
    expect(url.origin + url.pathname).toBe('https://recherche-entreprises.api.gouv.fr/search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      departement: '44',
      section_activite_principale: 'J',
      est_association: 'false',
      minimal: 'true',
      page: '1',
    });
    expect(request.headers['User-Agent']).toBe('Pandore/test');
  });

  it('lit les pages suivantes et ajoute les signaux', async () => {
    const { fetchFn, calls } = fakeApi([[apiCompany(1)], [apiCompany(2, { date_creation: '2010-01-01' })]]);
    const result = await searchCompanies({ departements: '44' }, options(fetchFn));
    expect(calls).toHaveLength(2);
    expect(result.analyzed).toBe(2);
    expect(result.companies.map((company) => company.signals)).toEqual([['creation-recente'], []]);
    expect(result.truncated).toBe(false);
  });

  it('s’arrête à 20 pages et indique que la recherche est partielle', async () => {
    const pages = Array.from({ length: 30 }, (_, i) => [apiCompany(i)]);
    const { fetchFn, calls } = fakeApi(pages, { totalResults: 2489 });
    const result = await searchCompanies({ departements: '44' }, options(fetchFn));
    expect(calls).toHaveLength(20);
    expect(result).toMatchObject({ analyzed: 20, totalResults: 2489, truncated: true });
  });

  it('applique le filtre local sur la date de création', async () => {
    const { fetchFn } = fakeApi([[apiCompany(1), apiCompany(2, { date_creation: '2015-01-01' })]]);
    const result = await searchCompanies({ departements: '44', createdLastYear: true }, options(fetchFn));
    expect(result.companies.map((company) => company.siren)).toEqual(['100000001']);
  });

  it('refuse un formulaire invalide sans appeler l’API', async () => {
    const { fetchFn, calls } = fakeApi([[]]);
    await expect(searchCompanies({}, options(fetchFn))).rejects.toThrow('au moins un département');
    expect(calls).toHaveLength(0);
  });

  it('erreur 429 : attend le délai demandé (Retry-After) puis réessaie', async () => {
    const waits = [];
    let count = 0;
    const fetchFn = async () => {
      count += 1;
      return count === 1
        ? jsonResponse({}, 429, { 'Retry-After': '2' })
        : jsonResponse({ results: [apiCompany(1)], total_results: 1, total_pages: 1 });
    };
    const result = await searchCompanies(
      { departements: '44' },
      options(fetchFn, { sleep: async (ms) => waits.push(ms) }),
    );
    expect(waits).toEqual([2000]);
    expect(result.analyzed).toBe(1);
  });

  it('erreur 429 répétée : message clair', async () => {
    const fetchFn = async () => jsonResponse({}, 429);
    await expect(searchCompanies({ departements: '44' }, options(fetchFn))).rejects.toThrow(
      'très sollicitée',
    );
  });

  it('pas de connexion : message clair', async () => {
    const fetchFn = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(searchCompanies({ departements: '44' }, options(fetchFn))).rejects.toThrow(
      'connexion Internet',
    );
  });

  it('erreur 400 : reprend le message de l’API', async () => {
    const fetchFn = async () => jsonResponse({ erreur: 'Paramètre inconnu' }, 400);
    await expect(searchCompanies({ departements: '44' }, options(fetchFn))).rejects.toThrow(
      'Paramètre inconnu',
    );
  });
});

describe('createRateLimiter', () => {
  it('espace les requêtes d’au moins 250 ms, même lancées en même temps', async () => {
    let clock = 1000;
    const waits = [];
    const waitForSlot = createRateLimiter({
      minIntervalMs: 250,
      now: () => clock,
      sleep: async (ms) => waits.push(ms),
    });
    await Promise.all([waitForSlot(), waitForSlot(), waitForSlot()]);
    expect(waits).toEqual([250, 500]);
    clock = 5000; // much later: no wait
    await waitForSlot();
    expect(waits).toEqual([250, 500]);
  });
});
