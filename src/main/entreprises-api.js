// Calls the public API "Recherche d'entreprises" (data.gouv.fr).
// The only network access of Pandore (see CLAUDE.md). Runs in the main process.
// `fetchFn`, `sleep` and `now` can be replaced in tests.
import { API } from '../tools/radar-prospects/rules.js';
import {
  buildSearch,
  detectSignals,
  matchesLocalFilters,
  toCompany,
} from '../tools/radar-prospects/search.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Spaces out requests: at most one every `minIntervalMs`, even if several
// searches run at the same time.
export function createRateLimiter({
  minIntervalMs,
  now = Date.now,
  sleep = defaultSleep,
}) {
  let nextSlot = 0;
  return async function waitForSlot() {
    const current = now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + minIntervalMs;
    if (slot > current) await sleep(slot - current);
  };
}

function apiError(message) {
  const error = new Error(message);
  error.userMessage = message;
  return error;
}

async function fetchPage(url, { fetchFn, sleep, waitForSlot, userAgent }) {
  for (let attempt = 0; ; attempt += 1) {
    await waitForSlot();
    let response;
    try {
      response = await fetchFn(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(API.timeoutMs),
      });
    } catch {
      throw apiError(
        "Impossible de joindre l'API Recherche d'entreprises. Vérifiez votre connexion Internet.",
      );
    }

    if (response.status === 429 && attempt < API.maxRetries) {
      // "Too many requests": wait as long as the API asks (Retry-After, in seconds)
      const retryAfter = Number(response.headers.get('Retry-After'));
      const waitMs = Math.min(
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1,
        10,
      );
      await sleep(waitMs * 1000);
      continue;
    }
    if (response.status === 429) {
      throw apiError(
        "L'API est très sollicitée en ce moment. Réessayez dans une minute.",
      );
    }
    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      throw apiError(
        `Recherche refusée par l'API : ${body.erreur ?? 'paramètres invalides'}.`,
      );
    }
    if (!response.ok) {
      throw apiError(
        `L'API a répondu par une erreur (${response.status}). Réessayez plus tard.`,
      );
    }
    return response.json();
  }
}

// Searches companies matching the filters of the Radar form.
// Returns { companies, totalResults, analyzed, truncated }.
export async function searchCompanies(
  filters,
  {
    today,
    fetchFn = fetch,
    sleep = defaultSleep,
    waitForSlot,
    userAgent = 'Pandore',
  },
) {
  const { params, local, errors } = buildSearch(filters, today);
  if (errors.length) throw apiError(errors.join(' '));

  const companies = [];
  let totalResults = 0;
  let analyzed = 0;

  for (let page = 1; page <= API.maxPages; page += 1) {
    const query = new URLSearchParams({ ...params, page: String(page) });
    const data = await fetchPage(`${API.baseUrl}?${query}`, {
      fetchFn,
      sleep,
      waitForSlot,
      userAgent,
    });

    totalResults = data.total_results ?? 0;
    for (const raw of data.results ?? []) {
      analyzed += 1;
      const company = toCompany(raw);
      const signals = detectSignals(company, today);
      if (matchesLocalFilters(company, signals, local)) {
        companies.push({ ...company, signals });
      }
    }
    if (page >= (data.total_pages ?? 0) || (data.results ?? []).length === 0)
      break;
  }

  return {
    companies,
    totalResults,
    analyzed,
    truncated: analyzed < totalResults,
  };
}
