import cssUrl from './radar.css?url';
import { startRadar } from './ui/app.js';

// The stylesheet is loaded as a file (not injected inline), so the strict
// Content-Security-Policy of the app does not need to be relaxed.
function loadStylesheet() {
  if (document.getElementById('radar-css')) return;
  const link = document.createElement('link');
  link.id = 'radar-css';
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.append(link);
}

export default {
  id: 'radar-prospects',
  name: 'Radar Prospects',
  order: 10,
  mount(container) {
    loadStylesheet();
    startRadar(container);
  },
};
