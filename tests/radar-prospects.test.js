import { describe, expect, it } from 'vitest';
import { checkVocabulary } from '../src/shared/vocabulary.js';
import {
  buildProspectMail,
  mailProblems,
  mailtoUrl,
  missingPlaceholders,
} from '../src/tools/radar-prospects/mail.js';
import {
  addOpposition,
  createProspect,
  expiryDate,
  isOpposed,
  purgeExpired,
  reminderEvents,
  reminders,
  withStatus,
} from '../src/tools/radar-prospects/prospects.js';

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
  finances: { year: '2025', revenue: 100000, netResult: 5000 },
};
const SENDER = { name: 'Camille Martin', role: "chargée d'affaires", email: 'camille@example.org' };

describe('mail de premier contact', () => {
  const mail = buildProspectMail({ company: COMPANY, signals: ['creation-recente'], sender: SENDER });

  it('respecte les règles de vocabulaire', () => {
    expect(checkVocabulary(`${mail.subject}\n${mail.body}`)).toEqual([]);
  });

  it('contient les mentions RGPD : origine des données et moyen de ne plus être contacté', () => {
    expect(mail.body).toContain("l'annuaire public des entreprises (data.gouv.fr)");
    expect(mail.body).toContain('répondez simplement STOP');
  });

  it('est adapté au besoin et au secteur', () => {
    expect(mail.subject).toBe("Étude de marché, Business plan : l'appui d'Audencia Junior Conseil");
    expect(mail.body).toContain('créée récemment');
    expect(mail.body).toContain('du numérique et de la communication');
  });

  it('variante « PME qui se développe » et variante sans signal', () => {
    const growth = buildProspectMail({ company: COMPANY, signals: ['pme-developpement'], sender: SENDER });
    expect(growth.body).toContain('Votre entreprise se développe');
    const generic = buildProspectMail({ company: COMPANY, signals: [], sender: SENDER });
    expect(generic.subject).toBe("Études et conseil : l'appui d'Audencia Junior Conseil");
  });

  it('commence par « Madame, Monsieur » : aucun nom de dirigeant', () => {
    expect(mail.body.startsWith('Madame, Monsieur,')).toBe(true);
  });

  it('signe avec les réglages du membre', () => {
    expect(mail.body).toContain('Camille Martin\nchargée d\'affaires\nAudencia Junior Conseil (AJC)');
    expect(missingPlaceholders(mail.body)).toEqual([]);
  });

  it('laisse des champs à compléter si la signature n’est pas réglée', () => {
    const unsigned = buildProspectMail({ company: COMPANY, signals: [] });
    expect(missingPlaceholders(unsigned.body)).toContain('[Prénom Nom]');
  });
});

describe('contrôles avant envoi', () => {
  const mail = buildProspectMail({ company: COMPANY, signals: [], sender: SENDER });

  it('aucun problème sur le mail généré', () => {
    expect(mailProblems(mail)).toEqual([]);
  });

  it('bloque un mot interdit ajouté par le membre', () => {
    const problems = mailProblems({ ...mail, body: `${mail.body}\nNos consultants sont disponibles.` });
    expect(problems).toEqual([
      'Terme interdit « consultants » (consultant) : utilisez « intervenant ».',
    ]);
  });

  it('bloque si la mention STOP a été supprimée', () => {
    expect(mailProblems({ ...mail, body: 'Madame, Monsieur, bonjour.' })[0]).toContain('mention RGPD');
  });

  it('bloque les champs encore à compléter', () => {
    expect(mailProblems({ ...mail, subject: 'Bonjour [Fonction]' })).toContain(
      'À compléter : [Fonction].',
    );
  });
});

describe('lien vers la messagerie', () => {
  it('préremplit le destinataire, l’objet et le texte', () => {
    const { url, bodyIncluded } = mailtoUrl({ to: 'contact@example.org', subject: 'Objet', body: 'Ligne 1\nLigne 2' });
    expect(url).toBe('mailto:contact%40example.org?subject=Objet&body=Ligne%201%0ALigne%202');
    expect(bodyIncluded).toBe(true);
  });

  it('sans le texte s’il est trop long (il est alors copié)', () => {
    const { url, bodyIncluded } = mailtoUrl({ subject: 'Objet', body: 'x'.repeat(3000) });
    expect(url).toBe('mailto:?subject=Objet');
    expect(bodyIncluded).toBe(false);
  });
});

describe('suivi des prospects', () => {
  const prospect = createProspect(COMPANY, ['creation-recente'], '2026-10-01');

  it('commence au statut « à contacter », sans donnée sur les dirigeants', () => {
    expect(prospect.status).toBe('a-contacter');
    expect(Object.keys(prospect)).not.toContain('dirigeants');
    expect(prospect).not.toHaveProperty('finances');
  });

  it('« contacté » fixe la date du premier et du dernier contact', () => {
    const contacted = withStatus(prospect, 'contacte', '2026-10-05');
    expect(contacted).toMatchObject({ firstContactDate: '2026-10-05', lastContactDate: '2026-10-05' });
    expect(contacted.statusHistory.map((entry) => entry.status)).toEqual(['a-contacter', 'contacte']);
    expect(prospect.status).toBe('a-contacter'); // the original is unchanged
  });

  it('refuse un statut inconnu', () => {
    expect(() => withStatus(prospect, 'gagne', '2026-10-05')).toThrow('Statut inconnu');
  });

  it('relances à J+7 et J+21, décalées au jour ouvré suivant', () => {
    // Lundi 5 oct. 2026 : +7 = lundi 12, +21 = lundi 26
    expect(reminders(withStatus(prospect, 'contacte', '2026-10-05'))).toEqual([
      { number: 1, date: '2026-10-12' },
      { number: 2, date: '2026-10-26' },
    ]);
    // Samedi 7 nov. 2026 -> +7 = samedi 14 -> lundi 16 ; +21 = samedi 28 -> lundi 30
    expect(reminders(withStatus(prospect, 'contacte', '2026-11-07')).map((r) => r.date)).toEqual([
      '2026-11-16',
      '2026-11-30',
    ]);
  });

  it('après la première relance, il ne reste que la seconde', () => {
    const relanced = withStatus(withStatus(prospect, 'contacte', '2026-10-05'), 'relance', '2026-10-12');
    expect(reminders(relanced)).toEqual([{ number: 2, date: '2026-10-26' }]);
  });

  it('plus de relance après un RDV, un refus, ou avant le premier contact', () => {
    const contacted = withStatus(prospect, 'contacte', '2026-10-05');
    expect(reminders(withStatus(contacted, 'rdv', '2026-10-08'))).toEqual([]);
    expect(reminders(withStatus(contacted, 'refus', '2026-10-08'))).toEqual([]);
    expect(reminders(prospect)).toEqual([]);
  });

  it('export agenda : titres neutres, avec le SIREN et sans le nom', () => {
    const [event] = reminderEvents([withStatus(prospect, 'contacte', '2026-10-05')]);
    expect(event).toMatchObject({
      uid: 'radar-123456789-relance-1@pandore',
      date: '2026-10-12',
      summary: 'Prospection AJC : relance 1 (SIREN 123456789)',
    });
    expect(JSON.stringify(event)).not.toContain('EXEMPLE');
  });
});

describe('conservation et opposition (RGPD)', () => {
  const prospect = createProspect(COMPANY, [], '2023-01-15');

  it('suppression 3 ans après le dernier contact', () => {
    const contacted = withStatus(prospect, 'contacte', '2023-06-01');
    expect(expiryDate(contacted)).toBe('2026-06-01');
    expect(purgeExpired([contacted], '2026-05-31').removedCount).toBe(0);
    expect(purgeExpired([contacted], '2026-06-01').removedCount).toBe(1);
  });

  it('jamais contacté : 3 ans après l’ajout', () => {
    expect(expiryDate(prospect)).toBe('2026-01-15');
    expect(purgeExpired([prospect], '2026-10-10')).toEqual({ kept: [], removedCount: 1 });
  });

  it('la liste d’opposition ne garde que le SIREN et la date, sans doublon', () => {
    let oppositions = addOpposition([], '123456789', '2026-10-10');
    oppositions = addOpposition(oppositions, '123456789', '2026-10-11');
    expect(oppositions).toEqual([{ siren: '123456789', date: '2026-10-10' }]);
    expect(isOpposed(oppositions, '123456789')).toBe(true);
    expect(isOpposed(oppositions, '987654321')).toBe(false);
  });
});
