// Messages the interface can send to the main process (through the preload).
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { todayISO } from '../shared/dates.js';
import { readJson, writeJson } from '../shared/storage.js';
import { API } from '../tools/radar-prospects/rules.js';
import { createRateLimiter, searchCompanies } from './entreprises-api.js';
import { isAppUrl } from './security.js';

// Shared by every search, so the API rate limit is respected app-wide.
const waitForApiSlot = createRateLimiter({ minIntervalMs: API.minIntervalMs });

// Links the interface may open outside the app: a company page on the public
// directory, or a prepared email in the user's email app. Nothing else.
const COMPANY_PAGE =
  /^https:\/\/annuaire-entreprises\.data\.gouv\.fr\/entreprise\/\d{9}$/;
const MAILTO = /^mailto:[^\s]*$/;
const MAX_EXTERNAL_URL_LENGTH = 4000;

function openExternal(url) {
  if (
    typeof url !== 'string' ||
    url.length > MAX_EXTERNAL_URL_LENGTH ||
    !(COMPANY_PAGE.test(url) || MAILTO.test(url))
  ) {
    throw new Error(
      'Lien refusé : Pandore ne peut ouvrir que la fiche d’une entreprise ou un e-mail.',
    );
  }
  return shell.openExternal(url);
}

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

  ipcMain.handle('radar:search', async (event, filters) => {
    assertTrustedSender(event);
    try {
      return await searchCompanies(filters ?? {}, {
        today: todayISO(),
        waitForSlot: waitForApiSlot,
        userAgent: `Pandore/${app.getVersion()} (outil interne de la Junior-Entreprise AJC)`,
      });
    } catch (error) {
      // Only our own French messages reach the interface, never raw technical errors.
      throw new Error(
        error.userMessage ?? 'La recherche a échoué. Réessayez plus tard.',
      );
    }
  });

  ipcMain.handle('shell:open-external', (event, url) => {
    assertTrustedSender(event);
    return openExternal(url);
  });

  ipcMain.handle('clipboard:write-text', (event, text) => {
    assertTrustedSender(event);
    if (typeof text !== 'string' || text.length > 100000) {
      throw new Error('Texte à copier invalide.');
    }
    clipboard.writeText(text);
  });
}
