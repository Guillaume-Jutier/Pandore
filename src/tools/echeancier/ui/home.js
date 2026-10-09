// Home screen: "Mes échéanciers" on one side, "Nouvel échéancier" on the other.
import { capitalize, el } from '../../../shared/dom.js';
import { formatDateFr, NON_WORKING_DAY_RULES, todayISO } from '../../../shared/dates.js';
import { CHANNELS } from '../rules.js';
import { computeSchedule, nextEvent, studyStage } from '../schedule.js';
import { isValidPropaleNumber } from '../study.js';

const STAGES = {
  avant: { label: 'Avant signature', className: 'ech-pill-warning' },
  pendant: { label: 'En cours', className: 'ech-pill-accent' },
  terminee: { label: 'Terminée', className: 'ech-pill-success' },
};

export const CNJE_ALERT =
  "Appel d'offre CNJE : répondre vite, la première Junior qui répond récupère l'étude.";

function studyCard(study, today, navigation) {
  const { events } = computeSchedule(study);
  const next = nextEvent(events, today);
  const stage = STAGES[studyStage(study, today)];

  return el(
    'button',
    {
      type: 'button',
      className: 'ech-study-card',
      on: { click: () => navigation.showEditor(study.id) },
    },
    el(
      'span',
      { className: 'ech-study-card-main' },
      el('span', { className: 'ech-study-title' }, `Étude ${study.propaleNumber}`),
      el(
        'span',
        { className: 'ech-muted ech-small' },
        next
          ? `Prochaine : ${next.label}, ${formatDateFr(next.date)}`
          : 'Aucune échéance à venir',
      ),
    ),
    el('span', { className: `ech-pill ${stage.className}` }, stage.label),
  );
}

function studyList(store, navigation) {
  const studies = store.list();
  const today = todayISO();

  return el(
    'section',
    { className: 'ech-panel' },
    el('h2', {}, 'Mes échéanciers'),
    studies.length === 0
      ? el(
          'p',
          { className: 'ech-muted' },
          'Aucun échéancier pour l’instant. Créez le premier avec la fiche « Nouvel échéancier ».',
        )
      : el(
          'div',
          { className: 'ech-study-list' },
          studies.map((study) => studyCard(study, today, navigation)),
        ),
  );
}

function selectField(id, label, options, value) {
  return el(
    'div',
    { className: 'ech-field' },
    el('label', { htmlFor: id }, label),
    el(
      'select',
      { id },
      options.map(([optionValue, optionLabel]) =>
        el('option', { value: optionValue, selected: optionValue === value }, optionLabel),
      ),
    ),
  );
}

function newStudyForm(store, navigation) {
  const year = new Date().getFullYear();
  const error = el('p', { className: 'ech-error', attrs: { role: 'alert' } });
  const cnjeAlert = el('div', { className: 'ech-alert ech-alert-danger', hidden: true }, CNJE_ALERT);

  const form = el(
    'form',
    { className: 'ech-panel', attrs: { novalidate: '' } },
    el('h2', {}, 'Nouvel échéancier'),
    el(
      'div',
      { className: 'ech-field' },
      el('label', { htmlFor: 'new-propale' }, 'N° de propale'),
      el('input', {
        id: 'new-propale',
        type: 'text',
        placeholder: `${year}-015`,
        autocomplete: 'off',
      }),
      el('span', { className: 'ech-hint' }, 'Jamais le nom du client : uniquement le numéro.'),
    ),
    selectField(
      'new-channel',
      "Canal d'arrivée",
      CHANNELS.map((channel) => [channel.id, channel.label]),
      'prospection',
    ),
    cnjeAlert,
    el(
      'div',
      { className: 'ech-field' },
      el('label', { htmlFor: 'new-rdv' }, 'Date du RDV client'),
      el('input', { id: 'new-rdv', type: 'date' }),
    ),
    selectField(
      'new-rule',
      'Échéance un week-end ou un jour férié',
      Object.entries(NON_WORKING_DAY_RULES),
      'next',
    ),
    error,
    el('button', { type: 'submit', className: 'ech-button-primary' }, 'Créer l’échéancier'),
  );

  const propaleInput = form.querySelector('#new-propale');
  const channelSelect = form.querySelector('#new-channel');

  channelSelect.addEventListener('change', () => {
    cnjeAlert.hidden = channelSelect.value !== 'appel-offre-cnje';
  });
  propaleInput.addEventListener('input', () => {
    error.textContent = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const propaleNumber = propaleInput.value.trim();
    if (!isValidPropaleNumber(propaleNumber)) {
      error.textContent = `Saisissez le numéro sous la forme ${year}-015.`;
      propaleInput.focus();
      return;
    }
    try {
      const study = await store.create({
        propaleNumber,
        channel: channelSelect.value,
        rdvDate: form.querySelector('#new-rdv').value,
        nonWorkingDayRule: form.querySelector('#new-rule').value,
      });
      navigation.showEditor(study.id);
    } catch (createError) {
      error.textContent = capitalize(createError.message);
    }
  });

  return form;
}

export function renderHome(container, { store, navigation }) {
  container.replaceChildren(
    el('h1', {}, "Échéancier d'études"),
    el(
      'p',
      { className: 'tool-description' },
      "Calculez toutes les échéances d'une étude, du premier RDV à la fidélisation, et exportez-les vers votre agenda.",
    ),
    el(
      'div',
      { className: 'ech-home' },
      studyList(store, navigation),
      newStudyForm(store, navigation),
    ),
  );
}
