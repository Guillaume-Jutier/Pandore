// Security rules applied to every window of the app.
import { app } from 'electron';

// The interface is either served by Vite (development) or loaded from a local
// file (packaged app). Anything else is not part of Pandore.
export function isAppUrl(url) {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }
  return url.startsWith('file://');
}

export function applySecurityRules() {
  app.on('web-contents-created', (_event, contents) => {
    // No new windows (window.open, target="_blank" links).
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // No navigation away from the app.
    contents.on('will-navigate', (event, url) => {
      if (!isAppUrl(url)) {
        event.preventDefault();
      }
    });
  });
}
