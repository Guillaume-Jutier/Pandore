import { describe, expect, it } from 'vitest';
import { createRadarStore } from '../src/tools/radar-prospects/store.js';

function fakeStorage(initial = {}) {
  const files = structuredClone(initial);
  return {
    files,
    async read(name, defaultValue) {
      return name in files ? structuredClone(files[name]) : defaultValue;
    },
    async write(name, data) {
      files[name] = structuredClone(data);
    },
  };
}

// Fictional company (never real data in this public repository)
const COMPANY = {
  siren: '123456789',
  name: 'EXEMPLE SAS',
  postalCode: '44000',
  city: 'NANTES',
  naf: '62.01Z',
  section: 'J',
  category: 'PME',
  workforceCode: '11',
  creationDate: '2026-03-01',
  signals: ['creation-recente'],
};
const options = { today: '2026-10-10', saveDelay: 5 };

describe('magasin du Radar', () => {
  it('ajoute un prospect une seule fois', async () => {
    const storage = fakeStorage();
    const store = await createRadarStore(storage, options);
    await store.add(COMPANY);
    await store.add(COMPANY);
    expect(store.prospects()).toHaveLength(1);
    expect(storage.files['radar-prospects'].prospects[0].signals).toEqual(['creation-recente']);
  });

  it('un refus retire le prospect et ajoute son SIREN à la liste d’opposition', async () => {
    const storage = fakeStorage();
    const store = await createRadarStore(storage, options);
    await store.add(COMPANY);
    await store.setStatus('123456789', 'refus');
    expect(store.prospects()).toEqual([]);
    expect(store.oppositions()).toEqual([{ siren: '123456789', date: '2026-10-10' }]);
    expect(JSON.stringify(storage.files['radar-prospects'])).not.toContain('EXEMPLE');
  });

  it('refuse d’ajouter une entreprise de la liste d’opposition', async () => {
    const store = await createRadarStore(fakeStorage(), options);
    await store.oppose('123456789');
    await expect(store.add(COMPANY)).rejects.toThrow("liste d'opposition");
  });

  it('supprime au démarrage les prospects sans contact depuis 3 ans', async () => {
    const old = { ...COMPANY, status: 'contacte', addedAt: '2023-01-01', lastContactDate: '2023-06-01', statusHistory: [] };
    const recent = { ...old, siren: '987654321', lastContactDate: '2025-06-01' };
    const storage = fakeStorage({
      'radar-prospects': { version: 1, prospects: [old, recent], oppositions: [], sender: {} },
    });
    const store = await createRadarStore(storage, options);
    expect(store.purgedAtStart).toBe(1);
    expect(store.prospects().map((p) => p.siren)).toEqual(['987654321']);
    expect(storage.files['radar-prospects'].prospects).toHaveLength(1);
  });

  it('enregistre la signature et l’adresse de contact un peu plus tard', async () => {
    const storage = fakeStorage();
    const store = await createRadarStore(storage, options);
    await store.add(COMPANY);
    store.setSender({ name: 'Camille Martin' });
    store.setContactEmail('123456789', 'contact@example.org');
    await store.flush();
    const saved = storage.files['radar-prospects'];
    expect(saved.sender.name).toBe('Camille Martin');
    expect(saved.prospects[0].contactEmail).toBe('contact@example.org');
  });

  it('refuse un fichier abîmé au lieu de l’écraser', async () => {
    const storage = fakeStorage({ 'radar-prospects': { prospects: 'oops' } });
    await expect(createRadarStore(storage, options)).rejects.toThrow('format attendu');
    expect(storage.files['radar-prospects']).toEqual({ prospects: 'oops' });
  });
});
