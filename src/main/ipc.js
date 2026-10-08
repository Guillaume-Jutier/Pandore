// Messages the interface can send to the main process (through the preload).
import { ipcMain } from 'electron';
import { readJson, writeJson } from '../shared/storage.js';
import { isAppUrl } from './security.js';

function assertTrustedSender(event) {
  const url = event.senderFrame?.url ?? '';
  if (!isAppUrl(url)) {
    throw new Error('Demande refusée : elle ne provient pas de Pandore.');
  }
}

export function registerIpcHandlers({ dataDir }) {
  ipcMain.handle('storage:read', (event, name, defaultValue) => {
    assertTrustedSender(event);
    return readJson(dataDir, name, defaultValue);
  });

  ipcMain.handle('storage:write', (event, name, data) => {
    assertTrustedSender(event);
    return writeJson(dataDir, name, data);
  });
}
