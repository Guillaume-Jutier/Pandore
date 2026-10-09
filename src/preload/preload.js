// The secure bridge between the interface and the main process.
// The interface cannot touch files or Node.js: it only sees `window.pandore`,
// and each function below forwards one specific, controlled request.
import { contextBridge, ipcRenderer } from 'electron';

const versionArg = process.argv.find((arg) => arg.startsWith('--pandore-version='));

contextBridge.exposeInMainWorld('pandore', {
  version: versionArg ? versionArg.split('=')[1] : 'inconnue',

  storage: {
    read: (name, defaultValue = null) =>
      ipcRenderer.invoke('storage:read', name, defaultValue),
    write: (name, data) => ipcRenderer.invoke('storage:write', name, data),
  },

  files: {
    // Opens the "Save as" window. Resolves to { saved, filePath }.
    saveText: ({ defaultName, content }) =>
      ipcRenderer.invoke('files:save-text', { defaultName, content }),
  },
});
