// Keeps the list of studies in memory and saves it to disk.
// `storage` is window.pandore.storage in the app, or a fake one in tests.
// Saving is delayed a little (`saveDelay`) so typing does not write on every key.
import { createStudy, isValidPropaleNumber, normalizeStudy } from './study.js';

const FILE_NAME = 'echeancier';
const EMPTY_FILE = { version: 1, studies: [] };

export async function createStore(storage, { saveDelay = 500, newId, now } = {}) {
  const makeId = newId ?? (() => crypto.randomUUID());
  const nowISO = now ?? (() => new Date().toISOString());

  // If the file cannot be read, we stop there: never overwrite data we could not load.
  const data = await storage.read(FILE_NAME, EMPTY_FILE);
  if (!data || !Array.isArray(data.studies)) {
    throw new Error("Le fichier des échéanciers n'a pas le format attendu.");
  }
  let studies = data.studies.map(normalizeStudy);

  let timer = null;
  let pendingSave = null;
  const listeners = new Set();

  function notify(status) {
    for (const listener of listeners) listener(status);
  }

  async function writeNow() {
    clearTimeout(timer);
    timer = null;
    notify('saving');
    try {
      await storage.write(FILE_NAME, { version: 1, studies });
      notify('saved');
    } catch (error) {
      notify('error');
      throw error;
    }
  }

  function scheduleSave() {
    clearTimeout(timer);
    notify('pending');
    pendingSave = new Promise((resolve, reject) => {
      timer = setTimeout(() => writeNow().then(resolve, reject), saveDelay);
    });
    pendingSave.catch(() => {}); // errors are reported through notify('error')
  }

  return {
    // Called with 'pending' | 'saving' | 'saved' | 'error'
    onStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    list() {
      return [...studies].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    get(id) {
      return studies.find((study) => study.id === id) ?? null;
    },

    findByPropale(propaleNumber) {
      return studies.find((study) => study.propaleNumber === propaleNumber) ?? null;
    },

    async create(fields) {
      if (!isValidPropaleNumber(fields.propaleNumber)) {
        throw new Error('Le numéro de propale doit avoir la forme 2026-014.');
      }
      if (this.findByPropale(fields.propaleNumber)) {
        throw new Error(`Un échéancier existe déjà pour la propale ${fields.propaleNumber}.`);
      }
      const study = createStudy({ ...fields, id: makeId(), now: nowISO() });
      studies.push(study);
      await writeNow();
      return study;
    },

    // Call after changing a study object returned by get(): saves a moment later.
    touch(study) {
      study.updatedAt = nowISO();
      scheduleSave();
    },

    async remove(id) {
      studies = studies.filter((study) => study.id !== id);
      await writeNow();
    },

    // Writes any change still waiting (e.g. before leaving the page).
    async flush() {
      if (timer) await writeNow();
    },
  };
}
