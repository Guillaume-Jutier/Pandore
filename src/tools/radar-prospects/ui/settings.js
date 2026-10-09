// "Réglages" tab: the member's signature and the opposition list.
import { el } from '../../../shared/dom.js';
import { formatDateFr } from '../../../shared/dates.js';
import { RETENTION_YEARS } from '../rules.js';
import { inputField } from './fields.js';

export function renderSettings(container, ctx) {
  const { store } = ctx;
  const sender = store.sender();

  const fields = [
    ['name', 'Prénom et nom', 'Camille Martin'],
    ['role', 'Fonction', "chargée d'affaires"],
    ['email', 'Adresse e-mail AJC', 'prenom.nom@…'],
    ['phone', 'Téléphone (facultatif)', ''],
  ].map(([key, label, placeholder]) => {
    const { field, input } = inputField(label, {
      value: sender[key] ?? '',
      placeholder,
    });
    input.addEventListener('input', () =>
      store.setSender({ [key]: input.value }),
    );
    return field;
  });

  const oppositions = store.oppositions();

  container.replaceChildren(
    el(
      'section',
      { className: 'rad-box' },
      el('h2', {}, 'Ma signature'),
      el(
        'p',
        { className: 'rad-hint' },
        'Utilisée pour signer les mails préparés. Elle reste sur votre ordinateur.',
      ),
      el('div', { className: 'rad-grid' }, fields),
    ),
    el(
      'section',
      { className: 'rad-box' },
      el('h2', {}, `Liste d'opposition (${oppositions.length})`),
      el(
        'p',
        { className: 'rad-hint' },
        "Entreprises qui ont refusé d'être contactées : elles n'apparaissent plus jamais dans les résultats. Seuls le SIREN et la date sont conservés.",
      ),
      oppositions.length === 0
        ? el(
            'p',
            { className: 'rad-muted' },
            'Aucune entreprise pour l’instant.',
          )
        : el(
            'ul',
            { className: 'rad-oppositions' },
            oppositions.map((item) =>
              el(
                'li',
                {},
                `SIREN ${item.siren} · depuis le ${formatDateFr(item.date)}`,
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'rad-button-link',
                    on: {
                      click: async () => {
                        const confirmed = window.confirm(
                          `Retirer le SIREN ${item.siren} de la liste d'opposition ?\n\nÀ faire uniquement en cas d'erreur : une entreprise qui a refusé ne doit plus être contactée.`,
                        );
                        if (!confirmed) return;
                        await store.removeOpposition(item.siren);
                        renderSettings(container, ctx);
                      },
                    },
                  },
                  'Retirer (erreur)',
                ),
              ),
            ),
          ),
    ),
    el(
      'section',
      { className: 'rad-box' },
      el('h2', {}, 'Données personnelles'),
      el(
        'ul',
        { className: 'rad-hint rad-list' },
        el(
          'li',
          {},
          'Les noms et dates de naissance des dirigeants ne sont jamais récupérés.',
        ),
        el(
          'li',
          {},
          `Un prospect est supprimé automatiquement ${RETENTION_YEARS} ans après le dernier contact (recommandation CNIL).`,
        ),
        el(
          'li',
          {},
          'Aucun mail n’est envoyé par Pandore : vous relisez et envoyez vous-même.',
        ),
        el(
          'li',
          {},
          'Démarchage téléphonique et scraping de sites (LinkedIn…) : interdits.',
        ),
      ),
    ),
  );
}
