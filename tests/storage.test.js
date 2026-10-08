import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isValidStorageName, readJson, writeJson } from '../src/shared/storage.js';

// Each test works in its own temporary folder, never in the real user data.
let baseDir;

beforeEach(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandore-test-'));
});

afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe('isValidStorageName', () => {
  it('accepte les minuscules, chiffres et tirets', () => {
    expect(isValidStorageName('prospects')).toBe(true);
    expect(isValidStorageName('etudes-2026')).toBe(true);
  });

  it('refuse les noms dangereux ou mal formés', () => {
    for (const name of ['../x', 'a/b', 'a\\b', 'Prospects', 'a.json', '', ' ', null, 42]) {
      expect(isValidStorageName(name)).toBe(false);
    }
  });
});

describe('readJson / writeJson', () => {
  it('relit exactement ce qui a été enregistré', async () => {
    const data = { propale: '2026-014', echeances: ['2026-10-10'], ok: true };
    await writeJson(baseDir, 'etudes', data);
    expect(await readJson(baseDir, 'etudes')).toEqual(data);
  });

  it('écrase la version précédente', async () => {
    await writeJson(baseDir, 'etudes', { version: 1 });
    await writeJson(baseDir, 'etudes', { version: 2 });
    expect(await readJson(baseDir, 'etudes')).toEqual({ version: 2 });
  });

  it('renvoie la valeur par défaut si le fichier est absent', async () => {
    expect(await readJson(baseDir, 'absent', [])).toEqual([]);
    expect(await readJson(baseDir, 'absent')).toBeNull();
  });

  it('crée le dossier de données s’il n’existe pas encore', async () => {
    const nestedDir = path.join(baseDir, 'data');
    await writeJson(nestedDir, 'etudes', []);
    expect(await readJson(nestedDir, 'etudes')).toEqual([]);
  });

  it('ne laisse aucun fichier temporaire après l’écriture', async () => {
    await writeJson(baseDir, 'etudes', { ok: true });
    expect(await fs.readdir(baseDir)).toEqual(['etudes.json']);
  });

  it('refuse un nom de fichier qui sortirait du dossier', async () => {
    await expect(readJson(baseDir, '../x')).rejects.toThrow('invalide');
    await expect(writeJson(baseDir, '../x', {})).rejects.toThrow('invalide');
  });

  it('signale un fichier abîmé sans l’écraser', async () => {
    const filePath = path.join(baseDir, 'etudes.json');
    await fs.writeFile(filePath, '{ pas du JSON', 'utf8');
    await expect(readJson(baseDir, 'etudes')).rejects.toThrow('illisible');
    expect(await fs.readFile(filePath, 'utf8')).toBe('{ pas du JSON');
  });
});
