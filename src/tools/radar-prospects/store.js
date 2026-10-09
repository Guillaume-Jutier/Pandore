// Keeps the Radar data in memory and saves it to disk (file "radar-prospects").
// `storage` is window.pandore.storage in the app, or a fake one in tests.
import {
  addOpposition,
  createProspect,
  isOpposed,
  purgeExpired,
  withStatus,
} from './prospects.js';

const FILE_NAME = 'radar-prospects';
const EMPTY_FILE = { version: 1, prospects: [], oppositions: [], sender: {} };

export async function createRadarStore(storage, { today, saveDelay = 500 }) {
  // If the file cannot be read, stop: never overwrite data we could not load.
  const data = await storage.read(FILE_NAME, EMPTY_FILE);
  if (
    !data ||
    !Array.isArray(data.prospects) ||
    !Array.isArray(data.oppositions)
  ) {
    throw new Error("Le fichier du Radar n'a pas le format attendu.");
  }

  // CNIL: prospects without contact for 3 years are deleted at start-up.
  const { kept, removedCount } = purgeExpired(data.prospects, today);
  let prospects = kept;
  let oppositions = data.oppositions;
  let sender = { ...data.sender };

  let timer = null;
  const listeners = new Set();
  const notify = (status) => listeners.forEach((listener) => listener(status));

  async function writeNow() {
    clearTimeout(timer);
    timer = null;
    notify('saving');
    try {
      await storage.write(FILE_NAME, {
        version: 1,
        prospects,
        oppositions,
        sender,
      });
      notify('saved');
    } catch (error) {
      notify('error');
      throw error;
    }
  }

  function saveLater() {
    clearTimeout(timer);
    notify('pending');
    timer = setTimeout(() => writeNow().catch(() => {}), saveDelay);
  }

  if (removedCount > 0) await writeNow();

  return {
    purgedAtStart: removedCount,

    onStatus(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    prospects: () => [...prospects],
    oppositions: () => [...oppositions],
    sender: () => ({ ...sender }),
    find: (siren) =>
      prospects.find((prospect) => prospect.siren === siren) ?? null,
    isOpposed: (siren) => isOpposed(oppositions, siren),

    async add(company) {
      if (isOpposed(oppositions, company.siren)) {
        throw new Error(
          "Cette entreprise est dans la liste d'opposition : elle ne peut pas être ajoutée.",
        );
      }
      if (this.find(company.siren)) return;
      prospects = [
        ...prospects,
        createProspect(company, company.signals ?? [], today),
      ];
      await writeNow();
    },

    // A refusal removes the prospect and adds its SIREN to the opposition list.
    async setStatus(siren, status, date = today) {
      const prospect = this.find(siren);
      if (!prospect) return;
      if (status === 'refus') {
        await this.oppose(siren, date);
        return;
      }
      prospects = prospects.map((item) =>
        item.siren === siren ? withStatus(item, status, date) : item,
      );
      await writeNow();
    },

    // For text fields (contact address): saved a moment later.
    setContactEmail(siren, contactEmail) {
      prospects = prospects.map((item) =>
        item.siren === siren ? { ...item, contactEmail } : item,
      );
      saveLater();
    },

    async remove(siren) {
      prospects = prospects.filter((item) => item.siren !== siren);
      await writeNow();
    },

    async oppose(siren, date = today) {
      prospects = prospects.filter((item) => item.siren !== siren);
      oppositions = addOpposition(oppositions, siren, date);
      await writeNow();
    },

    async removeOpposition(siren) {
      oppositions = oppositions.filter((item) => item.siren !== siren);
      await writeNow();
    },

    setSender(fields) {
      sender = { ...sender, ...fields };
      saveLater();
    },

    async flush() {
      if (timer) await writeNow();
    },
  };
}
