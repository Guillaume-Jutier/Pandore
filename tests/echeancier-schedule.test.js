import { describe, expect, it } from 'vitest';
import {
  computeSchedule,
  nextEvent,
  studyStage,
} from '../src/tools/echeancier/schedule.js';
import {
  createPhase,
  createStudy,
  deontologyMessages,
  isValidPropaleNumber,
} from '../src/tools/echeancier/study.js';

// Reference study used by most tests:
// RDV on Thursday 8 October 2026, CE on Tuesday 20 October,
// phase 1 from 26 Oct to 13 Nov (with PVRI), phase 2 from 16 Nov to 4 Dec.
function makeStudy(overrides = {}) {
  const study = createStudy({
    id: 'test',
    propaleNumber: '2026-014',
    rdvDate: '2026-10-08',
    now: '2026-10-01T00:00:00.000Z',
  });
  return { ...study, ...overrides };
}

function fullStudy(overrides = {}) {
  return makeStudy({
    ceDate: '2026-10-20',
    phases: [
      { ...createPhase('p1'), start: '2026-10-26', end: '2026-11-13', pvri: true },
      { ...createPhase('p2'), start: '2026-11-16', end: '2026-12-04' },
    ],
    studyEndDate: '2026-12-04',
    ...overrides,
  });
}

function eventById(study, id) {
  return computeSchedule(study).events.find((event) => event.id === id);
}

function dateOf(study, id) {
  return eventById(study, id)?.date;
}

describe('fiche étude', () => {
  it('valide le format du numéro de propale', () => {
    expect(isValidPropaleNumber('2026-014')).toBe(true);
    for (const value of ['2026-14', '26-014', '2026_014', 'Client X', '']) {
      expect(isValidPropaleNumber(value)).toBe(false);
    }
  });

  it('refuse de créer une étude sans numéro de propale valide', () => {
    expect(() => createStudy({ id: 'x', propaleNumber: 'Client X' })).toThrow('invalide');
  });

  it('ne contient aucun champ pour le nom du client', () => {
    const keys = Object.keys(makeStudy()).join(' ');
    expect(keys).not.toMatch(/client(Name)?\b|nom/i);
  });
});

describe('avant la signature', () => {
  it('propale à RDV + 48 h, décalée au lundi si elle tombe un samedi', () => {
    const event = eventById(makeStudy(), 'propale-envoi');
    expect(event.date).toBe('2026-10-12');
    expect(event.shifted).toBe(true);
    expect(event.originalDate).toBe('2026-10-10');
  });

  it('règle « avancer » : la propale passe au vendredi', () => {
    expect(dateOf(makeStudy({ nonWorkingDayRule: 'previous' }), 'propale-envoi')).toBe(
      '2026-10-09',
    );
  });

  it('règle « garder » : la propale reste le samedi', () => {
    expect(dateOf(makeStudy({ nonWorkingDayRule: 'keep' }), 'propale-envoi')).toBe(
      '2026-10-10',
    );
  });

  it('relances à envoi + 3 jours et envoi + 10 jours', () => {
    const study = makeStudy();
    expect(dateOf(study, 'propale-relance-1')).toBe('2026-10-15');
    expect(dateOf(study, 'propale-relance-2')).toBe('2026-10-22');
  });

  it('les relances partent de la date d’envoi réelle si elle est saisie', () => {
    const study = makeStudy({ propaleSentDate: '2026-10-13' });
    expect(dateOf(study, 'propale-envoi')).toBe('2026-10-13');
    expect(dateOf(study, 'propale-relance-1')).toBe('2026-10-16');
    expect(dateOf(study, 'propale-relance-2')).toBe('2026-10-23');
  });

  it('plus de relance après la signature de la CE', () => {
    const study = makeStudy({ ceDate: '2026-10-20' });
    expect(dateOf(study, 'propale-relance-1')).toBe('2026-10-15');
    expect(eventById(study, 'propale-relance-2')).toBeUndefined();
  });

  it('demande la date du RDV si elle manque', () => {
    const { missing, events } = computeSchedule(makeStudy({ rdvDate: '' }));
    expect(events.some((event) => event.group === 'avant')).toBe(false);
    expect(missing).toContainEqual({ group: 'avant', text: 'Saisir la date du RDV client' });
  });

  it('alerte « répondre vite » pour un appel d’offre CNJE', () => {
    const { warnings } = computeSchedule(makeStudy({ channel: 'appel-offre-cnje' }));
    expect(warnings[0]).toMatchObject({ level: 'danger' });
    expect(warnings[0].text).toContain('répondre vite');
  });

  it('signale une propale envoyée sans les 3 validations', () => {
    const study = makeStudy({
      propaleSentDate: '2026-10-12',
      propaleChecks: { budget: true, numero: true },
    });
    const texts = computeSchedule(study).warnings.map((w) => w.text);
    expect(texts.some((text) => text.includes('3 validations'))).toBe(true);
  });

  it('titres neutres, avec seulement le numéro de propale', () => {
    expect(eventById(makeStudy(), 'propale-relance-1').title).toBe(
      'Étude 2026-014 : relance propale 1',
    );
  });
});

describe('test de déontologie', () => {
  it('interdit : alerte rouge', () => {
    const messages = deontologyMessages({
      forbidden: ['vente-produit'],
      conditional: [],
      teachingLink: true,
    });
    expect(messages).toEqual([
      expect.objectContaining({ level: 'danger', text: expect.stringContaining('vente de produit') }),
    ]);
  });

  it('sous conditions : simple avertissement avec la condition', () => {
    const messages = deontologyMessages({
      forbidden: [],
      conditional: ['traduction'],
      teachingLink: true,
    });
    expect(messages).toEqual([
      { level: 'warning', text: "Traduction : Possible uniquement si l'école enseigne la langue." },
    ]);
  });

  it('rappelle que le lien avec un enseignement est obligatoire', () => {
    const messages = deontologyMessages({ forbidden: [], conditional: [], teachingLink: false });
    expect(messages[0].text).toContain('enseignement');
  });

  it('aucun message si tout est conforme', () => {
    expect(deontologyMessages({ forbidden: [], conditional: [], teachingLink: true })).toEqual([]);
  });
});

describe("pendant l'étude", () => {
  it("facture d'acompte de 30 % le jour de la CE", () => {
    const event = eventById(fullStudy(), 'acompte');
    expect(event.date).toBe('2026-10-20');
    expect(event.label).toContain('30 %');
  });

  it("acompte de 50 % si le client est à risque", () => {
    expect(eventById(fullStudy({ clientAtRisk: true }), 'acompte').label).toContain('50 %');
  });

  it('RDM du chef de projet le jour de la CE, seulement s’il est rétribué', () => {
    expect(eventById(fullStudy(), 'rdm-cdp')).toBeUndefined();
    expect(dateOf(fullStudy({ projectManagerPaid: true }), 'rdm-cdp')).toBe('2026-10-20');
  });

  it('RDM des intervenants au plus tard au début de chaque phase', () => {
    const study = fullStudy();
    expect(dateOf(study, 'phase-1-rdm')).toBe('2026-10-26');
    expect(dateOf(study, 'phase-2-rdm')).toBe('2026-11-16');
  });

  it('avenant à signer avant la fin de chaque phase', () => {
    const study = fullStudy();
    expect(dateOf(study, 'phase-1-avenant')).toBe('2026-11-13');
    expect(dateOf(study, 'phase-2-avenant')).toBe('2026-12-04');
    expect(eventById(study, 'phase-1-avenant').note).toContain('Hors-Qualité');
  });

  it('PVRI à la fin de la phase cochée, puis garantie de 7 jours', () => {
    const study = fullStudy();
    expect(dateOf(study, 'phase-1-pvri')).toBe('2026-11-13');
    expect(dateOf(study, 'phase-1-pvri-garantie')).toBe('2026-11-20');
    expect(eventById(study, 'phase-2-pvri')).toBeUndefined();
  });

  it('les dates contractuelles ne sont jamais décalées', () => {
    // Phase finishing on a Saturday: the amendment deadline stays on Saturday.
    const study = fullStudy({
      phases: [{ ...createPhase('p1'), start: '2026-10-26', end: '2026-11-14' }],
    });
    expect(eventById(study, 'phase-1-avenant')).toMatchObject({
      date: '2026-11-14',
      shifted: false,
    });
  });

  it('signale une phase incomplète ou incohérente', () => {
    const study = fullStudy({
      phases: [
        { ...createPhase('p1'), start: '2026-10-26' },
        { ...createPhase('p2'), start: '2026-12-01', end: '2026-11-01' },
      ],
    });
    const { missing, warnings } = computeSchedule(study);
    expect(missing).toContainEqual({ group: 'pendant', text: 'Phase 1 : saisir le début et la fin' });
    expect(warnings.map((w) => w.text)).toContain('Phase 2 : la fin est avant le début.');
  });

  it('signale une phase qui commence avant la CE', () => {
    const study = fullStudy({ ceDate: '2026-10-28' });
    const texts = computeSchedule(study).warnings.map((w) => w.text);
    expect(texts).toContain('Phase 1 : elle commence avant la signature de la CE.');
  });

  it('demande la CE et au moins une phase', () => {
    const { missing } = computeSchedule(makeStudy());
    expect(missing.map((m) => m.text)).toEqual(
      expect.arrayContaining(['Saisir la date de signature de la CE', 'Ajouter au moins une phase']),
    );
  });
});

describe("fin d'étude", () => {
  it('présentation au client 1 semaine avant la fin', () => {
    expect(dateOf(fullStudy(), 'presentation')).toBe('2026-11-27');
  });

  it('la présentation est toujours avancée, même avec la règle « décaler après »', () => {
    // Fin le dimanche 13 décembre : J-7 = dimanche 6 → vendredi 4
    const event = eventById(fullStudy({ studyEndDate: '2026-12-13' }), 'presentation');
    expect(event).toMatchObject({ date: '2026-12-04', shifted: true });
  });

  it('PVRF prévu à la fin d’étude si sa date n’est pas saisie', () => {
    const event = eventById(fullStudy(), 'pvrf');
    expect(event.date).toBe('2026-12-04');
    expect(event.label).toContain('prévue');
  });

  it('PVRF à la date saisie, avec les questionnaires de satisfaction', () => {
    const study = fullStudy({ pvrfDate: '2026-12-08' });
    expect(dateOf(study, 'pvrf')).toBe('2026-12-08');
    expect(dateOf(study, 'questionnaires')).toBe('2026-12-08');
  });

  it('solde sous 30 jours, sans décalage (délai légal)', () => {
    // 4 déc. + 30 = dimanche 3 janvier 2027 : on ne bouge pas
    expect(eventById(fullStudy(), 'solde')).toMatchObject({
      date: '2027-01-03',
      shifted: false,
    });
  });

  it('garantie : 1 mois pour un rapport, 3 mois pour les autres livrables', () => {
    expect(dateOf(fullStudy(), 'garantie')).toBe('2027-01-04');
    expect(dateOf(fullStudy({ deliverableType: 'autre' }), 'garantie')).toBe('2027-03-04');
  });

  it("demande la date de fin d'étude si elle manque", () => {
    const { missing } = computeSchedule(makeStudy());
    expect(missing).toContainEqual({ group: 'fin', text: "Saisir la date de fin d'étude" });
  });

  it("signale une phase qui finit après la fin d'étude", () => {
    const texts = computeSchedule(fullStudy({ studyEndDate: '2026-12-01' })).warnings.map(
      (w) => w.text,
    );
    expect(texts).toContain("Une phase se termine après la date de fin d'étude.");
  });
});

describe("après l'étude", () => {
  it('témoignage à PVRF + 2 semaines', () => {
    expect(dateOf(fullStudy(), 'temoignage')).toBe('2026-12-18');
  });

  it('fidélisation tous les 2 mois pendant 1 an : 6 rappels', () => {
    const dates = computeSchedule(fullStudy())
      .events.filter((event) => event.id.startsWith('fidelisation-'))
      .map((event) => event.date);
    expect(dates).toEqual([
      '2027-02-04',
      '2027-04-05', // dimanche 4 avril → lundi 5
      '2027-06-04',
      '2027-08-04',
      '2027-10-04',
      '2027-12-06', // samedi 4 décembre → lundi 6
    ]);
  });

  it('fidélisation tous les 3 mois pendant 1 an : 4 rappels', () => {
    const dates = computeSchedule(fullStudy({ fidelisationMonths: 3 }))
      .events.filter((event) => event.id.startsWith('fidelisation-'))
      .map((event) => event.date);
    expect(dates).toEqual(['2027-03-04', '2027-06-04', '2027-09-06', '2027-12-06']);
  });

  it('passation 1 mois avant la fin de mandat, seulement si elle est saisie', () => {
    expect(eventById(fullStudy(), 'passation')).toBeUndefined();
    expect(dateOf(fullStudy({ mandateEndDate: '2027-01-31' }), 'passation')).toBe('2026-12-31');
  });
});

describe('vue d’ensemble', () => {
  it('les échéances sont triées par date', () => {
    const dates = computeSchedule(fullStudy()).events.map((event) => event.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('chaque échéance a un identifiant unique (pour l’export agenda)', () => {
    const ids = computeSchedule(fullStudy({ projectManagerPaid: true, mandateEndDate: '2027-06-30' }))
      .events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("étape de l'étude selon la date du jour", () => {
    expect(studyStage(fullStudy(), '2026-10-15')).toBe('avant');
    expect(studyStage(fullStudy(), '2026-11-01')).toBe('pendant');
    expect(studyStage(fullStudy(), '2026-12-10')).toBe('terminee');
  });

  it('prochaine échéance à partir de la date du jour', () => {
    const { events } = computeSchedule(fullStudy());
    expect(nextEvent(events, '2026-11-14')).toMatchObject({ id: 'phase-2-rdm' });
    expect(nextEvent(events, '2030-01-01')).toBeNull();
  });
});
