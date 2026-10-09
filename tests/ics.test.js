import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine } from '../src/shared/ics.js';
import { icsFileName, studyToIcs } from '../src/tools/echeancier/export.js';
import { createPhase, createStudy } from '../src/tools/echeancier/study.js';

const NOW = new Date('2026-10-09T14:30:00.000Z');

function calendar(events) {
  return buildCalendar({ name: 'Étude 2026-014', events, now: NOW });
}

// Unfolds continuation lines, as calendar apps do when reading the file.
function unfold(ics) {
  return ics.replace(/\r\n /g, '');
}

describe('escapeText', () => {
  it('échappe les caractères spéciaux du format .ics', () => {
    expect(escapeText('a; b, c\\d')).toBe('a\\; b\\, c\\\\d');
    expect(escapeText('ligne 1\nligne 2')).toBe('ligne 1\\nligne 2');
  });
});

describe('foldLine', () => {
  const bytes = (text) => new TextEncoder().encode(text).length;

  it('ne touche pas une ligne courte', () => {
    expect(foldLine('SUMMARY:Court')).toBe('SUMMARY:Court');
  });

  it('coupe à 75 octets, et la suite commence par un espace', () => {
    const folded = foldLine(`DESCRIPTION:${'a'.repeat(200)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(bytes(line)).toBeLessThanOrEqual(75);
    for (const line of lines.slice(1)) expect(line.startsWith(' ')).toBe(true);
  });

  it('ne coupe jamais une lettre accentuée en deux', () => {
    const line = `SUMMARY:${'é'.repeat(100)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(bytes(part)).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(line);
  });
});

describe('buildCalendar', () => {
  const ics = calendar([
    { uid: 'a@pandore', date: '2026-10-12', summary: 'Étude 2026-014 : relance', description: 'Note' },
    { uid: 'b@pandore', date: '2026-12-31', summary: 'Fin, d’année' },
  ]);

  it('utilise des fins de ligne CRLF', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it("contient l'en-tête et un bloc par échéance", () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('X-WR-CALNAME:Étude 2026-014');
  });

  it('crée des événements « journée entière » (fin = lendemain)', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20261012\r\nDTEND;VALUE=DATE:20261013');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101');
  });

  it('ajoute un rappel la veille à 9 h', () => {
    expect(ics.match(/TRIGGER:-PT15H/g)).toHaveLength(2);
  });

  it("garde l'identifiant fourni et horodate en UTC", () => {
    expect(ics).toContain('UID:a@pandore');
    expect(ics).toContain('DTSTAMP:20261009T143000Z');
  });

  it('échappe le texte et omet une description vide', () => {
    expect(ics).toContain('SUMMARY:Fin\\, d’année');
    expect(ics.match(/^DESCRIPTION:Note$/m)).not.toBeNull();
  });
});

describe("export d'une étude", () => {
  const study = {
    ...createStudy({ id: 'abc', propaleNumber: '2026-014', rdvDate: '2026-10-08' }),
    ceDate: '2026-10-20',
    phases: [{ ...createPhase('p1'), start: '2026-10-26', end: '2026-12-04', pvri: true }],
    studyEndDate: '2026-12-04',
  };
  const ics = unfold(studyToIcs(study, NOW));

  it('nomme le fichier avec le numéro de propale', () => {
    expect(icsFileName(study)).toBe('etude-2026-014.ics');
  });

  it('exporte toutes les échéances, avec des titres neutres', () => {
    const summaries = [...ics.matchAll(/^SUMMARY:(.*)$/gm)].map((match) => match[1]);
    expect(summaries.length).toBeGreaterThan(10);
    for (const summary of summaries) expect(summary.startsWith('Étude 2026-014 : ')).toBe(true);
    expect(summaries).toContain('Étude 2026-014 : relance propale 1');
  });

  it("donne un identifiant stable par échéance (réimport sans doublon)", () => {
    expect(ics).toContain('UID:abc-propale-relance-1@pandore');
    expect(unfold(studyToIcs(study, new Date()))).toContain('UID:abc-propale-relance-1@pandore');
  });
});
