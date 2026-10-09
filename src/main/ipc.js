// Messages the interface can send to the main process (through the preload).
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson } from '../shared/storage.js';
import { isAppUrl } from './security.js';

// Files the interface may offer to save, and how the save dialog describes them.
const SAVE_TYPES = {
  ics: { name: 'Calendrier (.ics)', extensions: ['ics'] },
};
const MAX_SAVE_SIZE = 5 * 1024 * 1024; // 5 Mo
const SAFE_FILE_NAME = /^[a-z0-9-]+\.[a-z0-9]+$/i;

function assertTrustedSender(event) {
  const url = event.senderFrame?.url ?? '';
  if (!isAppUrl(url)) {
    throw new Error('Demande refusée : elle ne provient pas de Pandore.');
  }
}

// Shows the "Save as" window, then writes the text the user chose to save.
// Returns { saved: false } if the user cancels, { saved: true, filePath } otherwise.
async function saveTextFile(event, { defaultName, content }) {
  if (typeof defaultName !== 'string' || !SAFE_FILE_NAME.test(defaultName)) {
    throw new Error(`Nom de fichier proposé invalide : « ${defaultName} ».`);
  }
  const extension = path.extname(defaultName).slice(1).toLowerCase();
  const fileType = SAVE_TYPES[extension];
  if (!fileType) {
    throw new Error(`Type de fichier non autorisé : « .${extension} ».`);
  }
  if (typeof content !== 'string' || content.length > MAX_SAVE_SIZE) {
    throw new Error('Contenu du fichier invalide ou trop volumineux.');
  }

  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(window, {
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [fileType],
  });
  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  let filePath = result.filePath;
  if (path.extname(filePath).toLowerCase() !== `.${extension}`) {
    filePath += `.${extension}`;
  }
  await fs.writeFile(filePath, content, 'utf8');
  return { saved: true, filePath };
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

  ipcMain.handle('files:save-text', (event, options) => {
    assertTrustedSender(event);
    return saveTextFile(event, options ?? {});
  });
}
