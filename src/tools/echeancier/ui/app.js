// Entry point of the Échéancier interface: loads the studies, then switches
// between the home screen and the form of one study.
import { el } from '../../../shared/dom.js';
import { createStore } from '../store.js';
import { renderEditor } from './editor.js';
import { renderHome } from './home.js';

let storePromise = null;
let unloadHandlerAdded = false;

export async function startEcheancier(container) {
  container.replaceChildren(el('p', { className: 'ech-muted' }, 'Chargement…'));

  // The store is created once and kept while the app is open.
  storePromise ??= createStore(window.pandore.storage);
  let store;
  try {
    store = await storePromise;
  } catch (error) {
    storePromise = null;
    container.replaceChildren(
      el('h1', {}, "Échéancier d'études"),
      el(
        'div',
        { className: 'ech-alert ech-alert-danger' },
        "Impossible de lire vos échéanciers. Le fichier n'a pas été modifié. ",
        el('br'),
        `Détail : ${error.message}`,
      ),
    );
    return;
  }

  // Best effort: write pending changes if the window is closed.
  if (!unloadHandlerAdded) {
    window.addEventListener('beforeunload', () => store.flush());
    unloadHandlerAdded = true;
  }

  const navigation = {
    showHome: async () => {
      await store.flush();
      renderHome(container, { store, navigation });
    },
    showEditor: (studyId) => renderEditor(container, { store, navigation, studyId }),
  };
  navigation.showHome();
}
