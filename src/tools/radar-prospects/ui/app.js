// Entry point of the Radar interface: three tabs (search, follow-up, settings).
import { el } from '../../../shared/dom.js';
import { todayISO } from '../../../shared/dates.js';
import { createRadarStore } from '../store.js';
import { renderSearch } from './search.js';
import { renderSettings } from './settings.js';
import { renderTracking } from './tracking.js';

let storePromise = null;
let unloadHandlerAdded = false;
let currentTab = 'search';
// Last search, kept while the app is open so switching tabs does not lose it.
const session = { filters: null, result: null };

export async function startRadar(container) {
  container.replaceChildren(el('p', { className: 'rad-muted' }, 'Chargement…'));

  storePromise ??= createRadarStore(window.pandore.storage, {
    today: todayISO(),
  });
  let store;
  try {
    store = await storePromise;
  } catch (error) {
    storePromise = null;
    container.replaceChildren(
      el('h1', {}, 'Radar Prospects'),
      el(
        'div',
        { className: 'rad-alert rad-alert-danger' },
        "Impossible de lire les données du Radar. Le fichier n'a pas été modifié.",
        el('br'),
        `Détail : ${error.message}`,
      ),
    );
    return;
  }

  if (!unloadHandlerAdded) {
    window.addEventListener('beforeunload', () => store.flush());
    unloadHandlerAdded = true;
  }

  const tabsBar = el('div', {
    className: 'rad-tabs',
    attrs: { role: 'tablist' },
  });
  const panel = el('div', { className: 'rad-panel-area' });

  const tabs = {
    search: {
      label: () => 'Rechercher',
      render: () => renderSearch(panel, ctx),
    },
    tracking: {
      label: () => `Mon suivi (${store.prospects().length})`,
      render: () => renderTracking(panel, ctx),
    },
    settings: {
      label: () => 'Réglages',
      render: () => renderSettings(panel, ctx),
    },
  };

  function renderTabsBar() {
    const id = currentTab;
    tabsBar.replaceChildren(
      ...Object.entries(tabs).map(([tabId, tab]) =>
        el(
          'button',
          {
            type: 'button',
            className: `rad-tab${tabId === id ? ' rad-tab-active' : ''}`,
            attrs: { role: 'tab', 'aria-selected': String(tabId === id) },
            on: { click: () => showTab(tabId) },
          },
          tab.label(),
        ),
      ),
    );
  }

  function showTab(id) {
    currentTab = id;
    renderTabsBar();
    tabs[id].render();
  }

  // Shared with the tabs: store, last search, navigation, and a way to update
  // the tab titles (e.g. the number of followed prospects) without redrawing.
  const ctx = { store, session, showTab, updateTabTitles: renderTabsBar };

  container.replaceChildren(
    el('h1', {}, 'Radar Prospects'),
    el(
      'p',
      { className: 'tool-description' },
      "Trouvez des entreprises qui ont probablement besoin d'une étude, et préparez un premier contact conforme. L'outil prépare, vous envoyez.",
    ),
    tabsBar,
    panel,
  );
  showTab(currentTab);
}
