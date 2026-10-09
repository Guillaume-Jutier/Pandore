// "Rechercher" tab: filters, then the companies found with their buying signals.
import { el, setChildren } from '../../../shared/dom.js';
import { formatDateFr } from '../../../shared/dates.js';
import {
  CATEGORIES,
  companyPageUrl,
  SECTIONS,
  SIGNALS,
  WORKFORCE_GROUPS,
  WORKFORCE_LABELS,
} from '../rules.js';
import { alertBox, checkboxField, inputField, selectField } from './fields.js';

const DEFAULT_FILTERS = {
  departements: '44',
  postalCodes: '',
  section: '',
  naf: '',
  categories: [],
  workforce: '',
  createdLastYear: false,
  createdAfter: '',
  createdBefore: '',
  activeOnly: true,
  onlyWithSignal: false,
  headOfficeInZone: true,
};

const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(value);

function companyCard(company, ctx, onChange) {
  const { store } = ctx;
  const followed = Boolean(store.find(company.siren));
  const sector = SECTIONS[company.section]?.label ?? 'Secteur non renseigné';

  const addButton = el(
    'button',
    {
      type: 'button',
      className: followed ? 'rad-button-secondary' : 'rad-button-primary',
      disabled: followed,
      on: {
        click: async () => {
          await store.add(company);
          ctx.updateTabTitles();
          onChange();
        },
      },
    },
    followed ? 'Déjà dans mon suivi' : 'Ajouter au suivi',
  );

  return el(
    'article',
    { className: 'rad-card' },
    el(
      'div',
      { className: 'rad-card-main' },
      el('h3', {}, company.name),
      el(
        'p',
        { className: 'rad-muted rad-small' },
        [
          `${company.postalCode} ${company.city}`.trim(),
          `${company.naf} · ${sector}`,
          WORKFORCE_LABELS[company.workforceCode] ?? 'Effectif non renseigné',
          company.creationDate
            ? `créée le ${formatDateFr(company.creationDate)}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      company.signals.length
        ? el(
            'div',
            { className: 'rad-signals' },
            company.signals.map((id) =>
              el(
                'span',
                { className: 'rad-signal' },
                el('strong', {}, SIGNALS[id].label),
                ` : ${SIGNALS[id].services.join(', ')}`,
              ),
            ),
          )
        : null,
    ),
    el(
      'div',
      { className: 'rad-card-actions' },
      addButton,
      el(
        'button',
        {
          type: 'button',
          className: 'rad-button-link',
          on: {
            click: () =>
              window.pandore.openExternal(companyPageUrl(company.siren)),
          },
        },
        'Fiche publique ↗',
      ),
    ),
  );
}

function renderResults(container, ctx) {
  const { result } = ctx.session;
  if (!result) {
    container.replaceChildren();
    return;
  }
  // Companies with a buying signal first (stable sort: API order otherwise).
  const visible = result.companies
    .filter((company) => !ctx.store.isOpposed(company.siren))
    .sort((a, b) => b.signals.length - a.signals.length);
  const hidden = result.companies.length - visible.length;

  const summary = [
    `${formatNumber(result.analyzed)} entreprise${result.analyzed > 1 ? 's' : ''} analysée${result.analyzed > 1 ? 's' : ''} sur ${formatNumber(result.totalResults)} correspondant à vos filtres`,
    `${visible.length} affichée${visible.length > 1 ? 's' : ''}`,
    hidden
      ? `${hidden} masquée${hidden > 1 ? 's' : ''} (liste d'opposition)`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  setChildren(
    container,
    el('p', { className: 'rad-summary' }, summary),
    result.truncated
      ? alertBox(
          'warning',
          "Recherche partielle : l'API classe les entreprises par pertinence, pas par date de création. " +
            "Précisez les filtres (code postal, code NAF, tranche d'effectif) pour couvrir tout le périmètre.",
        )
      : null,
    visible.length === 0
      ? el(
          'p',
          { className: 'rad-muted' },
          'Aucune entreprise ne correspond. Élargissez les filtres.',
        )
      : el(
          'div',
          { className: 'rad-results' },
          visible.map((company) =>
            companyCard(company, ctx, () => renderResults(container, ctx)),
          ),
        ),
  );
}

export function renderSearch(container, ctx) {
  const filters = { ...DEFAULT_FILTERS, ...ctx.session.filters };

  const departements = inputField(
    'Départements',
    { value: filters.departements, placeholder: '44, 85' },
    'Un ou plusieurs, séparés par des virgules.',
  );
  const postalCodes = inputField('Codes postaux', {
    value: filters.postalCodes,
    placeholder: '44000, 44300',
  });
  const section = selectField(
    'Secteur',
    [
      ['', 'Tous les secteurs'],
      ...Object.entries(SECTIONS).map(([id, s]) => [id, `${id} · ${s.label}`]),
    ],
    filters.section,
  );
  const naf = inputField(
    'Code NAF (facultatif)',
    { value: filters.naf, placeholder: '62.01Z' },
    'Plus précis que le secteur. Liste sur insee.fr.',
  );
  const workforce = selectField(
    "Tranche d'effectif",
    [
      ['', 'Toutes'],
      ...Object.entries(WORKFORCE_GROUPS).map(([id, group]) => [
        id,
        group.label,
      ]),
    ],
    filters.workforce,
  );
  const categoryBoxes = Object.entries(CATEGORIES).map(([id, label]) => ({
    id,
    ...checkboxField(label, filters.categories.includes(id)),
  }));
  const createdLastYear = checkboxField(
    "Créée depuis moins d'un an",
    filters.createdLastYear,
  );
  const createdAfter = inputField('Créée après le', {
    type: 'date',
    value: filters.createdAfter,
  });
  const createdBefore = inputField('Créée avant le', {
    type: 'date',
    value: filters.createdBefore,
  });
  const activeOnly = checkboxField(
    'Entreprises actives uniquement',
    filters.activeOnly,
  );
  const onlyWithSignal = checkboxField(
    "Uniquement avec un signal d'achat",
    filters.onlyWithSignal,
  );
  const headOfficeInZone = checkboxField(
    'Siège dans la zone uniquement',
    filters.headOfficeInZone,
  );

  const syncCreatedAfter = () => {
    createdAfter.input.disabled = createdLastYear.input.checked;
  };
  createdLastYear.input.addEventListener('change', syncCreatedAfter);
  syncCreatedAfter();

  const error = el('div', { attrs: { role: 'alert' } });
  const results = el('div', { className: 'rad-results-area' });
  const submit = el(
    'button',
    { type: 'submit', className: 'rad-button-primary' },
    'Rechercher',
  );

  const form = el(
    'form',
    { className: 'rad-box rad-search-form', attrs: { novalidate: '' } },
    el(
      'fieldset',
      {},
      el('legend', {}, 'Zone'),
      el(
        'div',
        { className: 'rad-grid' },
        departements.field,
        postalCodes.field,
      ),
      headOfficeInZone.field,
      el(
        'p',
        { className: 'rad-hint' },
        'Décochez pour voir aussi les entreprises basées ailleurs qui ont un établissement dans la zone.',
      ),
    ),
    el(
      'fieldset',
      {},
      el('legend', {}, 'Secteur et taille'),
      el(
        'div',
        { className: 'rad-grid' },
        section.field,
        naf.field,
        workforce.field,
      ),
      el(
        'div',
        { className: 'rad-checks-inline' },
        categoryBoxes.map((box) => box.field),
      ),
    ),
    el(
      'fieldset',
      {},
      el('legend', {}, 'Création et état'),
      createdLastYear.field,
      el(
        'div',
        { className: 'rad-grid' },
        createdAfter.field,
        createdBefore.field,
      ),
      activeOnly.field,
      onlyWithSignal.field,
    ),
    el(
      'p',
      { className: 'rad-hint' },
      "Les associations sont exclues. Les dirigeants ne sont jamais récupérés. L'API ne fournit ni e-mail ni téléphone : vous chercherez vous-même un contact générique sur la fiche publique.",
    ),
    error,
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newFilters = {
      departements: departements.input.value,
      postalCodes: postalCodes.input.value,
      section: section.select.value,
      naf: naf.input.value,
      categories: categoryBoxes
        .filter((box) => box.input.checked)
        .map((box) => box.id),
      workforce: workforce.select.value,
      createdLastYear: createdLastYear.input.checked,
      createdAfter: createdAfter.input.value,
      createdBefore: createdBefore.input.value,
      activeOnly: activeOnly.input.checked,
      onlyWithSignal: onlyWithSignal.input.checked,
      headOfficeInZone: headOfficeInZone.input.checked,
    };
    ctx.session.filters = newFilters;
    error.replaceChildren();
    submit.disabled = true;
    submit.textContent = 'Recherche en cours… (jusqu’à 10 secondes)';
    try {
      ctx.session.result = await window.pandore.radar.search(newFilters);
      renderResults(results, ctx);
    } catch (searchError) {
      // Electron prefixes errors coming from the main process: keep our message only.
      error.replaceChildren(
        alertBox('danger', searchError.message.split('Error: ').pop()),
      );
    } finally {
      submit.disabled = false;
      submit.textContent = 'Rechercher';
    }
  });

  container.replaceChildren(form, results);
  renderResults(results, ctx);
}
