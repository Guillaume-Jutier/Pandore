// First contact email, adapted to the sector and to the buying signals.
// The tool only prepares it: the member re-reads it and sends it himself.
import { checkVocabulary } from '../../shared/vocabulary.js';
import { OPT_OUT_NOTICE, SECTIONS } from './rules.js';
import { signalServices } from './search.js';

function joinFrench(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ou ${items.at(-1)}`;
}

function needParagraph(signals, sectorPhrase) {
  if (signals.includes('creation-recente')) {
    return (
      'Votre entreprise a été créée récemment. Dans les premiers mois, une étude de marché, ' +
      'un business plan ou une stratégie marketing permettent souvent de sécuriser les prochaines décisions. ' +
      `C'est le type de mission que nous menons pour des entreprises ${sectorPhrase}.`
    );
  }
  if (signals.includes('pme-developpement')) {
    return (
      'Votre entreprise se développe. À ce stade, une stratégie commerciale, une étude de satisfaction ' +
      'de vos clients ou une analyse financière peuvent aider à structurer cette croissance. ' +
      `C'est le type de mission que nous menons pour des entreprises ${sectorPhrase}.`
    );
  }
  return (
    `Nous accompagnons des entreprises ${sectorPhrase} sur des missions comme l'étude de marché, ` +
    "la stratégie commerciale ou l'analyse financière."
  );
}

function subjectFor(signals) {
  const services = signalServices(signals).slice(0, 2);
  const topic = services.length
    ? services.map((service) => service[0].toUpperCase() + service.slice(1)).join(', ')
    : 'Études et conseil';
  return `${topic} : l'appui d'Audencia Junior Conseil`;
}

// sender: { name, role, email, phone } from the Radar settings (all optional)
export function buildProspectMail({ company, signals, sender = {} }) {
  const sectorPhrase = SECTIONS[company.section]?.phrase ?? 'de votre secteur';
  const introName = sender.name?.trim() || '[votre prénom et nom]';
  const introRole = sender.role?.trim() || '[votre fonction]';

  const signature = [
    sender.name?.trim() || '[Prénom Nom]',
    sender.role?.trim() || '[Fonction]',
    'Audencia Junior Conseil (AJC)',
    sender.email?.trim(),
    sender.phone?.trim(),
    'junior-conseil.audencia.com',
  ].filter(Boolean);

  const body = [
    'Madame, Monsieur,',
    '',
    `Je suis ${introName}, ${introRole} chez Audencia Junior Conseil (AJC), la Junior-Entreprise d'Audencia à Nantes. ` +
      "AJC est une association pédagogique de conseil : des étudiants d'Audencia réalisent des études pour les entreprises, " +
      'encadrés par un chef de projet et suivis par une démarche qualité.',
    '',
    needParagraph(signals, sectorPhrase),
    '',
    `Seriez-vous disponible pour un échange de 20 minutes afin de mieux comprendre les enjeux de ${company.name} ? ` +
      'Chaque mission est construite sur mesure, avec des tarifs attractifs.',
    '',
    'Bien cordialement,',
    '',
    ...signature,
    '',
    '--',
    OPT_OUT_NOTICE,
  ].join('\n');

  return { subject: subjectFor(signals), body };
}

// Placeholders like "[Fonction]" left in the text: the member must fill them in.
export function missingPlaceholders(text) {
  return [...String(text).matchAll(/\[[^\]\n]{2,40}\]/g)].map((match) => match[0]);
}

// Everything that prevents sending: forbidden words, placeholders, missing opt-out notice.
export function mailProblems({ subject, body }) {
  const problems = [];
  for (const issue of checkVocabulary(`${subject}\n${body}`)) {
    problems.push(
      `Terme interdit « ${issue.excerpt} » (${issue.term}) : utilisez « ${issue.suggestion} ».`,
    );
  }
  for (const placeholder of missingPlaceholders(`${subject}\n${body}`)) {
    problems.push(`À compléter : ${placeholder}.`);
  }
  if (!body.includes('STOP')) {
    problems.push('La mention RGPD (origine des données et réponse STOP) a été retirée : remettez-la.');
  }
  return problems;
}

// mailto: link for the member's email app. Some apps cut long links:
// above `maxLength` characters, the body is left out (it is copied instead).
export function mailtoUrl({ to = '', subject, body }, maxLength = 1800) {
  const encode = encodeURIComponent;
  const full = `mailto:${encode(to)}?subject=${encode(subject)}&body=${encode(body)}`;
  if (full.length <= maxLength) return { url: full, bodyIncluded: true };
  return { url: `mailto:${encode(to)}?subject=${encode(subject)}`, bodyIncluded: false };
}
