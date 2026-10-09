import { describe, expect, it } from 'vitest';
import { createStore } from '../src/tools/echeancier/store.js';
import { normalizeStudy } from '../src/tools/echeancier/study.js';

// Fake storage that keeps files in memory, like window.pandore.storage.
function fakeStorage(initial = {}) {
  const files = structuredClone(initial);
  return {
    files,
    writes: 0,
    async read(name, defaultValue) {
      return name in files ? structuredClone(files[name]) : defaultValue;
    },
    async write(name, data) {
      this.writes += 1;
      files[name] = structuredClone(data);
    },
  };
}

let counter = 0;
const options = { saveDelay: 10, newId: () => `id-${++counter}`, now: () => '2026-10-09T10:00:00.000Z' };

describe('magasin des échéanciers', () => {
  it('démarre vide si aucun fichier n’existe', async () => {
    const store = await createStore(fakeStorage(), options);
    expect(store.list()).toEqual([]);
  });

  it('crée une étude et l’enregistre aussitôt', async () => {
    const storage = fakeStorage();
    const store = await createStore(storage, options);
    const study = await store.create({ propaleNumber: '2026-015', rdvDate: '2026-10-08' });
    expect(store.get(study.id).propaleNumber).toBe('2026-015');
    expect(storage.files.echeancier.studies).toHaveLength(1);
  });

  it('refuse un numéro de propale mal formé ou déjà utilisé', async () => {
    const store = await createStore(fakeStorage(), options);
    await store.create({ propaleNumber: '2026-015' });
    await expect(store.create({ propaleNumber: '2026-15' })).rejects.toThrow('2026-014');
    await expect(store.create({ propaleNumber: '2026-015' })).rejects.toThrow('existe déjà');
  });

  it('enregistre les modifications un peu plus tard, en une seule écriture', async () => {
    const storage = fakeStorage();
    const store = await createStore(storage, options);
    const study = await store.create({ propaleNumber: '2026-015' });
    const writesAfterCreate = storage.writes;

    study.ceDate = '2026-10-20';
    store.touch(study);
    study.studyEndDate = '2026-12-04';
    store.touch(study);
    expect(storage.writes).toBe(writesAfterCreate);

    await store.flush();
    expect(storage.writes).toBe(writesAfterCreate + 1);
    expect(storage.files.echeancier.studies[0].studyEndDate).toBe('2026-12-04');
  });

  it('supprime définitivement une étude', async () => {
    const storage = fakeStorage();
    const store = await createStore(storage, options);
    const study = await store.create({ propaleNumber: '2026-015' });
    await store.remove(study.id);
    expect(store.list()).toEqual([]);
    expect(storage.files.echeancier.studies).toEqual([]);
  });

  it('retrouve les études enregistrées au redémarrage', async () => {
    const storage = fakeStorage();
    const first = await createStore(storage, options);
    await first.create({ propaleNumber: '2026-015' });
    const second = await createStore(storage, options);
    expect(second.findByPropale('2026-015')).not.toBeNull();
  });

  it('refuse un fichier abîmé au lieu de l’écraser', async () => {
    const storage = fakeStorage({ echeancier: { oops: true } });
    await expect(createStore(storage, options)).rejects.toThrow('format attendu');
    expect(storage.writes).toBe(0);
  });

  it('prévient de l’état de l’enregistrement', async () => {
    const store = await createStore(fakeStorage(), options);
    const study = await store.create({ propaleNumber: '2026-015' });
    const statuses = [];
    store.onStatus((status) => statuses.push(status));
    store.touch(study);
    await store.flush();
    expect(statuses).toEqual(['pending', 'saving', 'saved']);
  });
});

describe('normalizeStudy', () => {
  it('complète une étude enregistrée par une ancienne version', () => {
    const old = { id: 'a', propaleNumber: '2026-001', createdAt: '2026-01-01T00:00:00.000Z', ceDate: '2026-02-01' };
    const study = normalizeStudy(old);
    expect(study.ceDate).toBe('2026-02-01');
    expect(study.phases).toEqual([]);
    expect(study.deontology).toEqual({ forbidden: [], conditional: [], teachingLink: false });
    expect(study.fidelisationMonths).toBe(2);
  });
});
