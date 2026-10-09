// "Mon suivi" tab: followed prospects, statuses, reminders and email preparation.
import { el, setChildren } from '../../../shared/dom.js';
import { formatDateFr, todayISO } from '../../../shared/dates.js';
import { buildCalendar } from '../../../shared/ics.js';
import { buildProspectMail, mailProblems, mailtoUrl } from '../mail.js';
import { reminderEvents, reminders } from '../prospects.js';
import { companyPageUrl, RETENTION_YEARS, STATUSES } from '../rules.js';
import { alertBox, inputField, selectField } from './fields.js';

// Electron prefixes errors coming from the main process: keep our message only.
const cleanError = (error) => error.message.split('Error: ').pop();

function nextReminder(prospect) {
  return reminders(prospect)[0] ?? null;
}

// Due reminders first, then upcoming ones, then the others.
function sortProspects(prospects) {
  const key = (prospect) =>
    nextReminder(prospect)?.date ??
    (prospect.status === 'a-contacter' ? '9998' : '9999');
  return [...prospects].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
  );
}

function reminderBadge(prospect, today) {
  const reminder = nextReminder(prospect);
  if (!reminder) return null;
  const late = reminder.date < today;
  const due = reminder.date === today;
  return el(
    'span',
    {
      className: `rad-pill ${late || due ? 'rad-pill-danger' : 'rad-pill-accent'}`,
    },
    `Relance ${reminder.number} : ${due ? "aujourd'hui" : formatDateFr(reminder.date)}${late ? ' (en retard)' : ''}`,
  );
}

function mailPanel(prospect, ctx, rerender) {
  const { store } = ctx;
  const draft = buildProspectMail({
    company: prospect,
    signals: prospect.signals,
    sender: store.sender(),
  });

  const subject = inputField('Objet', { value: draft.subject });
  subject.input.classList.add('rad-wide');
  const bodyId = `rad-body-${prospect.siren}`;
  const body = el('textarea', {
    id: bodyId,
    value: draft.body,
    rows: 18,
    className: 'rad-mail-body',
  });
  const problemsBox = el('div', { attrs: { 'aria-live': 'polite' } });
  const message = el('p', {
    className: 'rad-small',
    attrs: { role: 'status' },
  });

  const current = () => ({ subject: subject.input.value, body: body.value });

  function checkProblems() {
    const problems = mailProblems(current());
    problemsBox.replaceChildren(
      problems.length
        ? alertBox(
            'danger',
            el('strong', {}, 'À corriger avant l’envoi :'),
            el(
              'ul',
              {},
              problems.map((problem) => el('li', {}, problem)),
            ),
          )
        : alertBox('success', 'Vocabulaire et mentions RGPD conformes.'),
    );
    return problems;
  }
  subject.input.addEventListener('input', checkProblems);
  body.addEventListener('input', checkProblems);

  function blocked() {
    if (checkProblems().length === 0) return false;
    message.textContent =
      'Corrigez les points signalés avant de copier ou d’ouvrir le mail.';
    message.className = 'rad-small rad-error';
    return true;
  }

  async function copyMail() {
    if (blocked()) return;
    const { subject: s, body: b } = current();
    await window.pandore.copyText(`Objet : ${s}\n\n${b}`);
    message.className = 'rad-small';
    message.textContent =
      'Mail copié : collez-le dans votre messagerie, relisez-le, puis envoyez-le.';
  }

  async function openMail() {
    if (blocked()) return;
    const mail = current();
    const { url, bodyIncluded } = mailtoUrl({
      to: prospect.contactEmail,
      ...mail,
    });
    try {
      if (!bodyIncluded) await window.pandore.copyText(mail.body);
      await window.pandore.openExternal(url);
      message.className = 'rad-small';
      message.textContent = bodyIncluded
        ? 'Votre messagerie s’ouvre avec le mail prérempli. Relisez-le, puis envoyez-le vous-même.'
        : 'Votre messagerie s’ouvre avec l’objet. Le texte, trop long pour être prérempli, a été copié : collez-le.';
    } catch (error) {
      message.className = 'rad-small rad-error';
      message.textContent = cleanError(error);
    }
  }

  const actions = [
    el(
      'button',
      {
        type: 'button',
        className: 'rad-button-secondary',
        on: { click: copyMail },
      },
      'Copier le mail',
    ),
    el(
      'button',
      {
        type: 'button',
        className: 'rad-button-secondary',
        on: { click: openMail },
      },
      'Ouvrir dans ma messagerie',
    ),
  ];
  if (prospect.status === 'a-contacter') {
    actions.push(
      el(
        'button',
        {
          type: 'button',
          className: 'rad-button-primary',
          on: {
            click: async () => {
              await store.setStatus(prospect.siren, 'contacte', todayISO());
              rerender();
            },
          },
        },
        'Marquer comme contacté',
      ),
    );
  }

  const panel = el(
    'div',
    { className: 'rad-mail' },
    prospect.contactEmail
      ? null
      : alertBox(
          'warning',
          'Ajoutez une adresse de contact générique (ex. contact@…) pour préremplir le destinataire.',
        ),
    subject.field,
    el(
      'div',
      { className: 'rad-field' },
      el('label', { htmlFor: bodyId }, 'Texte du mail'),
      body,
    ),
    problemsBox,
    el('div', { className: 'rad-actions' }, actions),
    message,
  );
  checkProblems();
  return panel;
}

function prospectRow(prospect, ctx, rerender, openMails) {
  const { store } = ctx;
  const today = todayISO();

  const status = selectField(
    'Statut',
    Object.entries(STATUSES),
    prospect.status,
  );
  status.select.addEventListener('change', async () => {
    const value = status.select.value;
    if (value === 'refus') {
      const confirmed = window.confirm(
        `${prospect.name} a refusé ?\n\nL'entreprise sera retirée de votre suivi et ajoutée à la liste d'opposition : elle n'apparaîtra plus jamais dans les résultats.`,
      );
      if (!confirmed) {
        status.select.value = prospect.status;
        return;
      }
    }
    await store.setStatus(prospect.siren, value, today);
    ctx.updateTabTitles();
    rerender();
  });

  const contact = inputField(
    'Adresse de contact générique',
    {
      type: 'email',
      value: prospect.contactEmail,
      placeholder: 'contact@entreprise.fr',
    },
    'Une adresse générique trouvée sur le site de l’entreprise, jamais une adresse nominative.',
  );
  contact.input.addEventListener('input', () =>
    store.setContactEmail(prospect.siren, contact.input.value.trim()),
  );

  const mailOpen = openMails.has(prospect.siren);
  const mailArea = el('div', {});
  if (mailOpen)
    mailArea.append(mailPanel(store.find(prospect.siren), ctx, rerender));

  return el(
    'article',
    { className: 'rad-card rad-card-column' },
    el(
      'div',
      { className: 'rad-row-head' },
      el(
        'div',
        {},
        el('h3', {}, prospect.name),
        el(
          'p',
          { className: 'rad-muted rad-small' },
          `${prospect.postalCode} ${prospect.city} · SIREN ${prospect.siren}` +
            (prospect.lastContactDate
              ? ` · dernier contact le ${formatDateFr(prospect.lastContactDate)}`
              : ''),
        ),
        reminderBadge(prospect, today),
      ),
      status.field,
    ),
    el('div', { className: 'rad-grid' }, contact.field),
    el(
      'div',
      { className: 'rad-actions' },
      el(
        'button',
        {
          type: 'button',
          className: mailOpen ? 'rad-button-secondary' : 'rad-button-primary',
          on: {
            click: () => {
              if (mailOpen) openMails.delete(prospect.siren);
              else openMails.add(prospect.siren);
              rerender();
            },
          },
        },
        mailOpen ? 'Fermer le mail' : 'Préparer le mail',
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'rad-button-link',
          on: {
            click: () =>
              window.pandore.openExternal(companyPageUrl(prospect.siren)),
          },
        },
        'Fiche publique ↗',
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'rad-button-danger',
          on: {
            click: async () => {
              if (!window.confirm(`Retirer ${prospect.name} de votre suivi ?`))
                return;
              await store.remove(prospect.siren);
              ctx.updateTabTitles();
              rerender();
            },
          },
        },
        'Retirer du suivi',
      ),
    ),
    mailArea,
  );
}

const openMailsBySession = new Set();

export function renderTracking(container, ctx) {
  const { store } = ctx;
  const rerender = () => renderTracking(container, ctx);
  const prospects = sortProspects(store.prospects());
  const exportMessage = el('p', {
    className: 'rad-small',
    attrs: { role: 'status' },
  });

  async function exportReminders() {
    const events = reminderEvents(store.prospects());
    if (events.length === 0) {
      exportMessage.className = 'rad-small rad-error';
      exportMessage.textContent =
        'Aucune relance prévue : passez un prospect au statut « Contacté ».';
      return;
    }
    try {
      const result = await window.pandore.files.saveText({
        defaultName: 'relances-prospection.ics',
        content: buildCalendar({ name: 'Relances de prospection AJC', events }),
      });
      exportMessage.className = 'rad-small';
      exportMessage.textContent = result.saved
        ? `Fichier enregistré : ${result.filePath}`
        : '';
    } catch (error) {
      exportMessage.className = 'rad-small rad-error';
      exportMessage.textContent = `L'export a échoué : ${cleanError(error)}`;
    }
  }

  setChildren(
    container,
    store.purgedAtStart
      ? alertBox(
          'info',
          `${store.purgedAtStart} prospect(s) supprimé(s) automatiquement : aucun contact depuis ${RETENTION_YEARS} ans (recommandation CNIL).`,
        )
      : null,
    el(
      'div',
      { className: 'rad-toolbar' },
      el(
        'p',
        { className: 'rad-muted rad-small' },
        'Relances prévues à J+7 et J+21 après le premier contact. Un refus ajoute l’entreprise à la liste d’opposition.',
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'rad-button-secondary',
          on: { click: exportReminders },
        },
        'Exporter les relances (.ics)',
      ),
    ),
    exportMessage,
    prospects.length === 0
      ? el(
          'p',
          { className: 'rad-muted' },
          'Aucun prospect suivi. Lancez une recherche et cliquez sur « Ajouter au suivi ».',
        )
      : el(
          'div',
          { className: 'rad-results' },
          prospects.map((prospect) =>
            prospectRow(prospect, ctx, rerender, openMailsBySession),
          ),
        ),
  );
}
