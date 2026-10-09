// Form of one study (left) with the live preview of its deadlines (right).
import { el } from '../../../shared/dom.js';
import { NON_WORKING_DAY_RULES, todayISO } from '../../../shared/dates.js';
import { icsFileName, studyToIcs } from '../export.js';
import {
  CHANNELS,
  DEONTOLOGY_CONDITIONAL,
  DEONTOLOGY_FORBIDDEN,
  DELIVERABLE_TYPES,
  FIDELISATION_INTERVALS,
  PROPALE_CHECKS,
  RDV_CHECKLIST,
  RDV_REMINDER,
} from '../rules.js';
import { computeSchedule } from '../schedule.js';
import { createPhase, deontologyMessages } from '../study.js';
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
  const deontologyBox = el('div', { className: 'ech-inline-alerts' });

  function refresh() {
    renderTimeline(preview, study, today);
    deontologyBox.replaceChildren(
      ...deontologyMessages(study.deontology).map((message) =>
        el(
          'div',
          { className: `ech-alert ech-alert-${message.level}` },
          message.text,
        ),
      ),
    );
  }

  function changed() {
    store.touch(study);
    refresh();
  }

  // ---------- Field helpers ----------
  let fieldCount = 0;
  const nextId = () => `ech-field-${++fieldCount}`;

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

  // Checkbox bound to "is this id in that list?"
  function listCheckbox(label, list, id) {
    return checkbox(
      label,
      () => list.includes(id),
      (checked) => {
        const index = list.indexOf(id);
        if (checked && index === -1) list.push(id);
        if (!checked && index !== -1) list.splice(index, 1);
      },
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
  const deontology = study.deontology;

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
      '1. Avant la signature',
      dateField(
        'Date du RDV client',
        () => study.rdvDate,
        (value) => (study.rdvDate = value),
      ),
      subsection(
        'Préparation du RDV',
        el(
          'div',
          { className: 'ech-checks-inline' },
          RDV_CHECKLIST.map((item) =>
            checkbox(
              item.label,
              () => study.rdvChecklist[item.id],
              (value) => (study.rdvChecklist[item.id] = value),
            ),
          ),
        ),
        el('p', { className: 'ech-hint' }, `Rappel : ${RDV_REMINDER}`),
      ),
      subsection(
        'Test de déontologie',
        el('p', { className: 'ech-hint' }, "L'étude comporte :"),
        DEONTOLOGY_FORBIDDEN.map((item) =>
          listCheckbox(item.label, deontology.forbidden, item.id),
        ),
        DEONTOLOGY_CONDITIONAL.map((item) =>
          listCheckbox(item.label, deontology.conditional, item.id),
        ),
        checkbox(
          "Lien avec un enseignement de l'école (obligatoire)",
          () => deontology.teachingLink,
          (value) => (deontology.teachingLink = value),
        ),
        deontologyBox,
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
      checkbox(
        'Client à risque (acompte de 50 %)',
        () => study.clientAtRisk,
        (value) => (study.clientAtRisk = value),
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
  refresh();
  container.replaceChildren(
    header,
    exportMessage,
    el('div', { className: 'ech-editor' }, form, preview),
  );
}
