import cssUrl from './echeancier.css?url';
import { startEcheancier } from './ui/app.js';

// The stylesheet is loaded as a file (not injected inline), so the strict
// Content-Security-Policy of the app does not need to be relaxed.
function loadStylesheet() {
  if (document.getElementById('echeancier-css')) return;
  const link = document.createElement('link');
  link.id = 'echeancier-css';
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.append(link);
}

export default {
  id: 'echeancier',
  name: "Échéancier d'études",
  order: 20,
  mount(container) {
    loadStylesheet();
    startEcheancier(container);
  },
};
