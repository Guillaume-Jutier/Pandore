// Local JSON storage, used by the main process only.
// Each "name" is one file: <baseDir>/<name>.json
// In the app, baseDir is a folder inside app.getPath('userData'),
// so user data never leaves the computer and never enters the Git repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Lowercase letters, digits and dashes only: "prospects", "etudes-2026".
// This makes it impossible to read or write outside baseDir (e.g. "../../x").
const VALID_NAME = /^[a-z0-9-]+$/;

export function isValidStorageName(name) {
  return typeof name === 'string' && VALID_NAME.test(name);
}

function filePathFor(baseDir, name) {
  if (!isValidStorageName(name)) {
    throw new Error(
      `Nom de fichier de données invalide : « ${name} ». ` +
        'Utilisez uniquement des minuscules, des chiffres et des tirets.',
    );
  }
  return path.join(baseDir, `${name}.json`);
}

// Returns the stored data, or `defaultValue` if nothing was saved yet.
export async function readJson(baseDir, name, defaultValue = null) {
  const filePath = filePathFor(baseDir, name);

  let text;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    // Never overwrite a damaged file silently: the user may want to recover it.
    throw new Error(
      `Le fichier de données « ${name}.json » est illisible (JSON invalide). ` +
        `Il se trouve dans : ${baseDir}`,
    );
  }
}

// Saves `data` as JSON. The write is atomic: we write a temporary file first,
// then rename it. If the app crashes mid-write, the previous file stays intact.
export async function writeJson(baseDir, name, data) {
  const filePath = filePathFor(baseDir, name);
  const text = JSON.stringify(data, null, 2);
  if (text === undefined) {
    throw new Error(`Impossible d'enregistrer « ${name} » : aucune donnée.`);
  }

  await fs.mkdir(baseDir, { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, text, 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}
