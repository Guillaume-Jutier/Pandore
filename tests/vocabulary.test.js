import { describe, expect, it } from 'vitest';
import { checkVocabulary } from '../src/shared/vocabulary.js';

const terms = (text) => checkVocabulary(text).map((issue) => issue.term);

describe('checkVocabulary', () => {
  it('ne signale rien dans un texte conforme', () => {
    expect(
      checkVocabulary(
        'AJC est une association pédagogique de conseil. Nos intervenants sont choisis après une sélection, avec une rétribution et des tarifs attractifs.',
      ),
    ).toEqual([]);
  });

  it('repère chaque mot interdit du CLAUDE.md', () => {
    expect(terms('la rémunération')).toEqual(['rémunération']);
    expect(terms('un salaire')).toEqual(['salaire']);
    expect(terms('nos salariés')).toEqual(['salarié']);
    expect(terms('une employée')).toEqual(['employé']);
    expect(terms('le recrutement')).toEqual(['recrutement']);
    expect(terms('nos consultants')).toEqual(['consultant']);
    expect(terms('un contrat de travail')).toEqual(['contrat de travail']);
    expect(terms('un cabinet de conseil')).toEqual(['cabinet de conseil']);
  });

  it('repère les comparaisons avec la concurrence', () => {
    expect(terms('3 fois moins cher')).toEqual(['« X fois moins cher »']);
    expect(terms('2,5 fois moins chers')).toEqual(['« X fois moins cher »']);
    expect(terms('moins cher que les autres')).toEqual(['comparaison de prix']);
    expect(terms('face à vos concurrents')).toEqual(['comparaison avec un concurrent']);
  });

  it('ignore les accents et les majuscules', () => {
    expect(terms('REMUNERATION et Rémunérations')).toEqual(['rémunération', 'rémunération']);
    expect(terms('Nous recrutons')).toEqual(['recrutement']);
  });

  it('ne se trompe pas sur des mots proches', () => {
    expect(checkVocabulary('Le salon des salaisons, une consultation, un emploi du temps')).toEqual(
      [],
    );
  });

  it('donne la position exacte et le terme à utiliser', () => {
    const [issue] = checkVocabulary('Votre équipe de salariés');
    expect(issue).toMatchObject({
      start: 16,
      end: 24,
      excerpt: 'salariés',
      suggestion: 'intervenant',
    });
  });

  it('classe les problèmes dans l’ordre du texte', () => {
    expect(terms('Un consultant, pas de salaire')).toEqual(['consultant', 'salaire']);
  });
});
