import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  adjustForNonWorkingDay,
  dayOfWeek,
  easterSunday,
  formatDateFr,
  frenchHolidays,
  isFrenchHoliday,
  isValidISODate,
  isWeekend,
  isWorkingDay,
  todayISO,
} from '../src/shared/dates.js';

describe('isValidISODate', () => {
  it('accepte une vraie date', () => {
    expect(isValidISODate('2026-10-09')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
  });

  it('refuse une date impossible ou mal écrite', () => {
    for (const value of ['2026-02-30', '2026-13-01', '09/10/2026', '2026-1-9', '', null]) {
      expect(isValidISODate(value)).toBe(false);
    }
  });
});

describe('todayISO', () => {
  it('donne la date locale au format AAAA-MM-JJ', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('ajoute ou retire des jours', () => {
    expect(addDays('2026-10-09', 2)).toBe('2026-10-11');
    expect(addDays('2026-10-09', -7)).toBe('2026-10-02');
  });

  it('change de mois et d’année', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('ne se trompe pas au passage à l’heure d’hiver', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('refuse une date invalide', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Date invalide');
  });
});

describe('addMonths', () => {
  it('ajoute des mois', () => {
    expect(addMonths('2026-10-09', 1)).toBe('2026-11-09');
    expect(addMonths('2026-10-09', 3)).toBe('2027-01-09');
  });

  it('prend le dernier jour du mois si le jour n’existe pas', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // année bissextile
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('retire des mois', () => {
    expect(addMonths('2027-03-31', -1)).toBe('2027-02-28');
    expect(addMonths('2027-01-15', -1)).toBe('2026-12-15');
  });
});

describe('week-ends', () => {
  it('reconnaît le jour de la semaine', () => {
    expect(dayOfWeek('2026-10-09')).toBe(5); // vendredi
  });

  it('reconnaît samedi et dimanche', () => {
    expect(isWeekend('2026-10-10')).toBe(true);
    expect(isWeekend('2026-10-11')).toBe(true);
    expect(isWeekend('2026-10-12')).toBe(false);
  });
});

describe('jours fériés', () => {
  it('calcule le dimanche de Pâques', () => {
    expect(easterSunday(2024)).toBe('2024-03-31');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('liste les 11 jours fériés de 2026', () => {
    expect(frenchHolidays(2026)).toEqual([
      '2026-01-01',
      '2026-04-06', // lundi de Pâques
      '2026-05-01',
      '2026-05-08',
      '2026-05-14', // Ascension
      '2026-05-25', // lundi de Pentecôte
      '2026-07-14',
      '2026-08-15',
      '2026-11-01',
      '2026-11-11',
      '2026-12-25',
    ]);
  });

  it('reconnaît un jour férié', () => {
    expect(isFrenchHoliday('2027-03-29')).toBe(true); // lundi de Pâques 2027
    expect(isFrenchHoliday('2026-11-11')).toBe(true);
    expect(isFrenchHoliday('2026-11-12')).toBe(false);
  });

  it('un jour ouvré n’est ni un week-end ni un férié', () => {
    expect(isWorkingDay('2026-10-09')).toBe(true);
    expect(isWorkingDay('2026-10-10')).toBe(false);
    expect(isWorkingDay('2026-11-11')).toBe(false);
  });
});

describe('adjustForNonWorkingDay', () => {
  it('ne touche pas un jour ouvré', () => {
    expect(adjustForNonWorkingDay('2026-10-09', 'next')).toEqual({
      date: '2026-10-09',
      shifted: false,
    });
  });

  it('« suivant » : samedi → lundi', () => {
    expect(adjustForNonWorkingDay('2026-10-10', 'next')).toEqual({
      date: '2026-10-12',
      shifted: true,
    });
  });

  it('« précédent » : dimanche → vendredi', () => {
    expect(adjustForNonWorkingDay('2026-10-11', 'previous')).toEqual({
      date: '2026-10-09',
      shifted: true,
    });
  });

  it('« garder » : la date ne bouge jamais', () => {
    expect(adjustForNonWorkingDay('2026-10-10', 'keep')).toEqual({
      date: '2026-10-10',
      shifted: false,
    });
  });

  it('saute un week-end suivi d’un férié', () => {
    // Samedi 4 avril 2026, puis dimanche de Pâques, puis lundi de Pâques férié
    expect(adjustForNonWorkingDay('2026-04-04', 'next').date).toBe('2026-04-07');
  });

  it('enchaîne férié et week-end en reculant', () => {
    // Lundi 11 novembre 2030 est férié : on remonte au vendredi 8
    expect(adjustForNonWorkingDay('2030-11-11', 'previous').date).toBe('2030-11-08');
  });

  it('refuse une règle inconnue', () => {
    expect(() => adjustForNonWorkingDay('2026-10-10', 'plus-tard')).toThrow('inconnue');
  });
});

describe('formatDateFr', () => {
  it('formate en français', () => {
    expect(formatDateFr('2026-10-09')).toBe('ven. 9 oct. 2026');
    expect(formatDateFr('2026-10-09', { long: true })).toBe('vendredi 9 octobre 2026');
  });
});
