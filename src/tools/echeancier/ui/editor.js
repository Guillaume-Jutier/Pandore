// Form of one study (left) with the live preview of its deadlines (right).
import { el } from '../../../shared/dom.js';
import { NON_WORKING_DAY_RULES, todayISO } from '../../../shared/dates.js';
import { icsFileName, studyToIcs } from '../export.js';
import {
  CHANNELS,
  DELIVERABLE_TYPES,
  DEPOSIT_RATE,
  FIDELISATION_INTERVALS,
  MEETING_SUBJECT_MAX_LENGTH,
  PROPALE_CHECKS,
} from '../rules.js';
import { computeSchedule } from '../schedule.js';
import { createMeeting, createPhase } from '../study.js';
import { renderTimeline } from './timeline.js';

const SAVE_STATUS = {
  pending: 'Modifications en cours…',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: "Erreur d'enregistrement",
};

export function renderEditor(container, { store, navigation, studyId }) {
  const study = store.get(studyId);
  if (!study) {
    navigation.showHome();
    return;
  }
  const today = todayISO();

  // ---------- Live update ----------
  const preview = el('aside', { className: 'ech-preview' });

  function refresh() {
    renderTimeline(preview, study, today);
  }

  function changed() {
    store.touch(study);
    refresh();
  }

  // ---------- Field helpers ----------
  let fieldCount = 0;
  const nextId = () => `ech-field-${++fieldCount}`;

  function inputField(label, props, get, set, hint) {
    const id = nextId();
    return el(
      'div',
      { className: 'ech-field' },
      el('label', { htmlFor: id }, label),
      el('input', {
        id,
        ...props,
        value: get(),
        on: {
          input: (event) => {
            set(event.target.value);
            changed();
          },
        },
      }),
      hint ? el('span', { className: 'ech-hint' }, hint) : null,
    );
  }

  function dateField(label, get, set, hint) {
    const id = nextId();
    return el(
      'div',
      { className: 'ech-field' },
      el('label', { htmlFor: id }, label),
      el('input', {
        id,
        type: 'date',
        value: get(),
        on: {
          input: (event) => {
            set(event.target.value);
            changed();
          },
        },
      }),
      hint ? el('span', { className: 'ech-hint' }, hint) : null,
    );
  }

  function selectField(label, options, get, set) {
    const id = nextId();
    return el(
      'div',
      { className: 'ech-field' },
      el('label', { htmlFor: id }, label),
      el(
        'select',
        {
          id,
          on: {
            change: (event) => {
              set(event.target.value);
              changed();
            },
          },
        },
        options.map(([value, optionLabel]) =>
          el(
            'option',
            { value, selected: String(value) === String(get()) },
            optionLabel,
          ),
        ),
      ),
    );
  }

  function checkbox(label, get, set) {
    return el(
      'label',
      { className: 'ech-check' },
      el('input', {
        type: 'checkbox',
        checked: Boolean(get()),
        on: {
          change: (event) => {
            set(event.target.checked);
            changed();
          },
        },
      }),
      label,
    );
  }

  function section(title, ...children) {
    return el(
      'section',
      { className: 'ech-form-section' },
      el('h2', {}, title),
      children,
    );
  }

  function subsection(title, ...children) {
    return el(
      'div',
      { className: 'ech-subsection' },
      el('h3', {}, title),
      children,
    );
  }

  // ---------- Phases ----------
  const phasesList = el('div', { className: 'ech-phases' });

  function renderPhases() {
    phasesList.replaceChildren(
      ...study.phases.map((phase, index) =>
        el(
          'div',
          { className: 'ech-phase' },
          el(
            'div',
            { className: 'ech-phase-head' },
            el('span', { className: 'ech-phase-title' }, `Phase ${index + 1}`),
            checkbox(
              'PVRI à la fin de la phase',
              () => phase.pvri,
              (value) => (phase.pvri = value),
            ),
            el(
              'button',
              {
                type: 'button',
                className: 'ech-button-ghost',
                title: `Retirer la phase ${index + 1}`,
                attrs: { 'aria-label': `Retirer la phase ${index + 1}` },
                on: {
                  click: () => {
                    study.phases.splice(index, 1);
                    renderPhases();
                    changed();
                  },
                },
              },
              '✕',
            ),
          ),
          el(
            'div',
            { className: 'ech-phase-dates' },
            dateField(
              'Début',
              () => phase.start,
              (value) => (phase.start = value),
            ),
            dateField(
              'Fin',
              () => phase.end,
              (value) => (phase.end = value),
            ),
          ),
        ),
      ),
    );
  }

  const addPhaseButton = el(
    'button',
    {
      type: 'button',
      className: 'ech-button-link',
      on: {
        click: () => {
          study.phases.push(createPhase(crypto.randomUUID()));
          renderPhases();
          changed();
        },
      },
    },
    '+ Ajouter une phase',
  );

  // ---------- RDV client ----------
  const meetingsList = el('div', { className: 'ech-phases' });

  function renderMeetings() {
    meetingsList.replaceChildren(
      ...study.meetings.map((meeting, index) =>
        el(
          'div',
          { className: 'ech-phase' },
          el(
            'div',
            { className: 'ech-phase-head' },
            el('span', { className: 'ech-phase-title' }, `RDV ${index + 1}`),
            el(
              'button',
              {
                type: 'button',
                className: 'ech-button-ghost',
                title: `Retirer le RDV ${index + 1}`,
                attrs: { 'aria-label': `Retirer le RDV ${index + 1}` },
                on: {
                  click: () => {
                    study.meetings.splice(index, 1);
                    renderMeetings();
                    changed();
                  },
                },
              },
              '✕',
            ),
          ),
          el(
            'div',
            { className: 'ech-meeting-fields' },
            dateField(
              'Date',
              () => meeting.date,
              (value) => (meeting.date = value),
            ),
            inputField(
              'Heure (facultative)',
              { type: 'time' },
              () => meeting.time,
              (value) => (meeting.time = value),
            ),
            inputField(
              'Objet',
              {
                type: 'text',
                maxLength: MEETING_SUBJECT_MAX_LENGTH,
                placeholder: "point d'avancement",
              },
              () => meeting.subject,
              (value) => (meeting.subject = value),
            ),
          ),
        ),
      ),
    );
  }

  const addMeetingButton = el(
    'button',
    {
      type: 'button',
      className: 'ech-button-link',
      on: {
        click: () => {
          study.meetings.push(createMeeting(crypto.randomUUID()));
          renderMeetings();
          changed();
        },
      },
    },
    '+ Ajouter un RDV client',
  );

  // ---------- Header ----------
  const saveStatus = el(
    'span',
    { className: 'ech-muted ech-small' },
    SAVE_STATUS.saved,
  );
  const unsubscribe = store.onStatus((status) => {
    saveStatus.textContent = SAVE_STATUS[status];
    saveStatus.classList.toggle('ech-error', status === 'error');
  });
  const exportMessage = el('p', {
    className: 'ech-small',
    attrs: { role: 'status' },
  });

  async function exportIcs() {
    exportMessage.className = 'ech-small';
    if (computeSchedule(study).events.length === 0) {
      exportMessage.className = 'ech-small ech-error';
      exportMessage.textContent =
        'Aucune échéance à exporter : saisissez au moins la date du RDV client.';
      return;
    }
    try {
      const result = await window.pandore.files.saveText({
        defaultName: icsFileName(study),
        content: studyToIcs(study),
      });
      exportMessage.textContent = result.saved
        ? `Fichier enregistré : ${result.filePath}. Importez-le dans votre agenda.`
        : '';
    } catch (error) {
      exportMessage.className = 'ech-small ech-error';
      exportMessage.textContent = `L'export a échoué : ${error.message}`;
    }
  }

  async function deleteStudy() {
    const confirmed = window.confirm(
      `Supprimer définitivement l'échéancier de l'étude ${study.propaleNumber} ?\n\n` +
        'Les événements déjà exportés resteront dans votre agenda.',
    );
    if (!confirmed) return;
    unsubscribe();
    await store.remove(study.id);
    navigation.showHome();
  }

  const header = el(
    'div',
    { className: 'ech-editor-header' },
    el(
      'div',
      { className: 'ech-editor-title' },
      el(
        'button',
        {
          type: 'button',
          className: 'ech-button-link',
          on: {
            click: () => {
              unsubscribe();
              navigation.showHome();
            },
          },
        },
        '← Mes échéanciers',
      ),
      el('h1', {}, `Étude ${study.propaleNumber}`),
      saveStatus,
    ),
    el(
      'div',
      { className: 'ech-editor-actions' },
      el(
        'button',
        {
          type: 'button',
          className: 'ech-button-danger',
          on: { click: deleteStudy },
        },
        'Supprimer',
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'ech-button-primary',
          on: { click: exportIcs },
        },
        'Exporter .ics',
      ),
    ),
  );

  // ---------- Form ----------
  const form = el(
    'div',
    { className: 'ech-form' },
    section(
      'Réglages',
      selectField(
        "Canal d'arrivée",
        CHANNELS.map((channel) => [channel.id, channel.label]),
        () => study.channel,
        (value) => (study.channel = value),
      ),
      selectField(
        'Échéance un week-end ou un jour férié',
        Object.entries(NON_WORKING_DAY_RULES),
        () => study.nonWorkingDayRule,
        (value) => (study.nonWorkingDayRule = value),
      ),
      el(
        'p',
        { className: 'ech-hint' },
        'S’applique aux actions de suivi (propale, relances, rappels). Les dates de contrat et les délais légaux ne sont jamais décalés.',
      ),
    ),

    section(
      'RDV client',
      el(
        'p',
        { className: 'ech-hint' },
        "Vos rendez-vous avec le client (point d'avancement, présentation…). Ils apparaissent dans l'aperçu et dans l'export. Objet neutre : jamais le nom du client.",
      ),
      meetingsList,
      addMeetingButton,
    ),

    section(
      '1. Avant la signature',
      dateField(
        'Date du premier RDV client',
        () => study.rdvDate,
        (value) => (study.rdvDate = value),
      ),
      subsection(
        'Propale',
        PROPALE_CHECKS.map((item) =>
          checkbox(
            item.label,
            () => study.propaleChecks[item.id],
            (value) => (study.propaleChecks[item.id] = value),
          ),
        ),
        dateField(
          "Date d'envoi réelle",
          () => study.propaleSentDate,
          (value) => (study.propaleSentDate = value),
          'À remplir une fois la propale envoyée : les relances partiront de cette date.',
        ),
      ),
    ),

    section(
      "2. Pendant l'étude",
      dateField(
        'Date de signature de la CE',
        () => study.ceDate,
        (value) => (study.ceDate = value),
      ),
      inputField(
        "Taux d'acompte (%)",
        {
          type: 'number',
          min: DEPOSIT_RATE.min,
          max: DEPOSIT_RATE.max,
          step: 1,
        },
        () => study.depositRate ?? '',
        (value) => (study.depositRate = value === '' ? null : Number(value)),
        `${DEPOSIT_RATE.default} % en général, jamais 100 %.`,
      ),
      checkbox(
        'Chef de projet rétribué (RDM du chef de projet)',
        () => study.projectManagerPaid,
        (value) => (study.projectManagerPaid = value),
      ),
      subsection('Phases', phasesList, addPhaseButton),
    ),

    section(
      "3. Fin d'étude",
      dateField(
        "Date de fin d'étude prévue",
        () => study.studyEndDate,
        (value) => (study.studyEndDate = value),
      ),
      dateField(
        'Date de signature du PVRF',
        () => study.pvrfDate,
        (value) => (study.pvrfDate = value),
        "Si elle est vide, le PVRF est prévu à la date de fin d'étude.",
      ),
      selectField(
        'Type de livrable',
        Object.entries(DELIVERABLE_TYPES).map(([id, type]) => [
          id,
          `${type.label} (garantie ${type.warrantyMonths} mois)`,
        ]),
        () => study.deliverableType,
        (value) => (study.deliverableType = value),
      ),
    ),

    section(
      "4. Après l'étude",
      selectField(
        'Rappels de fidélisation',
        FIDELISATION_INTERVALS.map((months) => [
          months,
          `Tous les ${months} mois pendant 1 an`,
        ]),
        () => study.fidelisationMonths,
        (value) => (study.fidelisationMonths = Number(value)),
      ),
      dateField(
        'Fin de mandat du chef de projet',
        () => study.mandateEndDate,
        (value) => (study.mandateEndDate = value),
        'Facultatif : un rappel de passation au filleul est prévu 1 mois avant.',
      ),
    ),
  );

  renderPhases();
  renderMeetings();
  refresh();
  container.replaceChildren(
    header,
    exportMessage,
    el('div', { className: 'ech-editor' }, form, preview),
  );
}
