# Pandore

Application de bureau open source qui regroupe les outils internes créés pour **AJC**, la Junior-Entreprise d'Audencia (Nantes). Elle est publiée sur GitHub et chacun peut la télécharger depuis la page *Releases*.

Outils de la v1 :
1. **Radar Prospects** : trouver des entreprises qui ont probablement besoin d'une étude, et préparer un premier contact conforme.
2. **Échéancier d'études** : calculer toutes les échéances d'une étude, du premier RDV à la fidélisation, et les exporter vers un agenda (.ics).

## Le développeur

Guillaume, étudiant en école de commerce. **C'est sa première application.** Il connaît les règles métier de la JE mieux que le code.
- Explique en français, simplement, ce que tu fais et pourquoi, sans jargon non défini.
- Avance par petites étapes testables. Après chaque étape, dis comment vérifier que ça marche (`npm start`, puis quoi regarder).
- Avant une décision technique importante (nouvelle dépendance, changement d'architecture), propose-la et attends son accord.
- Quand une règle métier ci-dessous est ambiguë ou manquante, demande plutôt que d'inventer.

## Stack technique

- **Electron**, packagé avec **Electron Forge** (template Vite).
- **JavaScript simple** : HTML, CSS et JS sans framework (pas de React, pas de TypeScript) pour que le code reste lisible par un débutant.
- **Stockage local** : fichiers JSON dans `app.getPath('userData')`. Pas de base de données, pas de dépendance native.
- **Tests** : Vitest, pour les fonctions de calcul (dates, filtres, vérification du vocabulaire).
- Minimum de dépendances. Chaque nouvelle dépendance doit être justifiée.

## Commandes

- `npm start` : lance l'app en développement
- `npm test` : lance les tests
- `npm run make` : construit l'installateur pour le système courant
- Publication : pousser un tag `vX.Y.Z` déclenche le workflow GitHub Actions qui construit Windows, macOS et Linux et crée la Release.

## Architecture

```
src/
  main/          processus principal (fenêtre, fichiers, appels réseau)
  preload/       pont sécurisé entre main et l'interface (contextBridge)
  renderer/      interface : coquille avec un menu latéral listant les outils
  shared/        code commun : stockage JSON, export .ics, dates, vocabulaire
  tools/
    radar-prospects/
    echeancier/
tests/
```

- Chaque outil vit dans son propre dossier `src/tools/<outil>/` et s'enregistre dans le menu latéral. **Ajouter un outil ne doit pas demander de modifier les autres.**
- La logique métier (calculs de dates, règles) est dans des fonctions pures, séparées de l'interface, et testée.
- Sécurité Electron : `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. L'interface ne parle au système que via le preload.
- Les appels réseau passent par le processus principal.

### Ajouter un outil

Créer `src/tools/<outil>/index.js` qui exporte par défaut :

```js
export default {
  id: 'mon-outil',          // identifiant unique (minuscules, tirets)
  name: 'Mon outil',        // nom affiché dans le menu
  order: 30,                // position dans le menu (10, 20, 30…)
  mount(container) { … },   // dessine la page de l'outil dans `container`
};
```

`src/renderer/renderer.js` découvre les outils avec `import.meta.glob` et `src/renderer/tool-registry.js` les valide et les trie : aucun autre fichier à modifier.

### Stockage et pont sécurisé

- L'interface n'accède au système que via `window.pandore`, défini dans `src/preload/preload.js` : `version`, `storage.read(name, defaultValue)` et `storage.write(name, data)`.
- Les données sont stockées dans `userData/data/<name>.json` par `src/shared/storage.js`. Le nom ne peut contenir que des minuscules, des chiffres et des tirets, et l'écriture est atomique (fichier temporaire puis renommage).
- Chaque nouveau canal IPC est déclaré dans `src/main/ipc.js` et vérifie l'expéditeur (`assertTrustedSender`).
- Content-Security-Policy stricte dans `src/renderer/index.html` ; nouvelles fenêtres et navigation externe bloquées dans `src/main/security.js`.

### Notes Windows

- Si PowerShell bloque `npm` (« exécution de scripts désactivée »), utiliser `npm.cmd`.
- Le script d'installation d'`electron-winstaller` (installateur Windows) est autorisé dans `package.json` (`allowScripts`).

### Publication

- `.github/workflows/tests.yml` : tests à chaque envoi sur `main`. `.github/workflows/release.yml` : une étiquette `vX.Y.Z` construit Windows (Squirrel `.exe`), macOS arm64 et x64 (`.zip`) et Linux (`.deb`, `.rpm`), puis crée la Release avec `gh`. L'étiquette doit correspondre à `version` dans `package.json`, sinon la construction s'arrête.
- Les apps ne sont pas signées (certificats payants) : avertissements SmartScreen et Gatekeeper documentés dans le README. Pas de mise à jour automatique pour l'instant (à décider : `update-electron-app`, macOS exige la signature).
- Les commits utilisent l'adresse masquée GitHub, jamais l'adresse personnelle (dépôt public).

## Règles non négociables (légal et RGPD)

- **Aucune donnée client ou personnelle dans le dépôt Git.** Le dépôt est public. Les données de l'utilisateur restent sur son ordinateur, dans `userData`.
- **Aucune donnée envoyée à un serveur externe**, sauf les requêtes de recherche vers l'API publique de l'État.
- Les études sont identifiées par leur **numéro de propale** (ex. `2026-014`), jamais par le nom du client. Les événements exportés en .ics ont des titres neutres : « Étude 2026-014 : relance propale ».
- Licence **MIT**.

### Vocabulaire (statut non-employeur de la JE)

Dans tout texte généré par l'app (mails, libellés), interdire et signaler :
- « rémunération », « salaire », « salarié », « employé », « recrutement », « consultant », « contrat de travail »
- « cabinet de conseil », toute comparaison avec un concurrent, « X fois moins cher »

Termes à utiliser : « rétribution », « intervenant », « sélection », « association pédagogique de conseil », « tarifs attractifs ».

## Outil 1 : Radar Prospects

**API** : Recherche d'entreprises (data.gouv.fr), gratuite, sans clé.
- Base : `https://recherche-entreprises.api.gouv.fr/search`, documentation : `https://recherche-entreprises.api.gouv.fr/docs/`. Vérifie les paramètres exacts dans la doc avant de coder.
- Limite : **7 requêtes par seconde**. Espacer les appels et gérer les erreurs 429.
- L'API ne fournit ni e-mail ni téléphone : afficher le lien vers l'entreprise, le membre cherche lui-même un contact professionnel générique.

**Fonctionnalités**
- Filtres : zone (code postal, département), secteur (code NAF), tranche d'effectif, date de création, entreprises actives uniquement.
- Signaux d'achat associés à une prestation type d'AJC :
  - créée depuis moins d'un an : étude de marché, business plan, stratégie marketing ;
  - PME en croissance : stratégie commerciale, étude de satisfaction, analyse financière.
- Génération d'un premier mail adapté au secteur et au besoin, vérifié avec les règles de vocabulaire, avec les mentions RGPD : origine des données et moyen simple de ne plus être contacté.
- Suivi : statuts `à contacter`, `contacté`, `relancé`, `RDV obtenu`, `refus`. Relances exportables en .ics.
- Liste d'opposition : une entreprise qui a refusé n'apparaît plus jamais dans les résultats.
- Suppression automatique d'un prospect **3 ans après le dernier contact** (recommandation CNIL).
- Ne conserver que le strict nécessaire sur les dirigeants (données personnelles).

**Interdits** : particuliers, démarchage téléphonique (interdit depuis août 2026), scraping de LinkedIn ou d'autres sites, envoi automatique de mails. L'outil prépare, l'humain envoie.

### Décisions prises (octobre 2026, avec Guillaume)

- **Constats sur l'API** (testée le 10 octobre 2026) : pas de filtre sur la date de création (filtrée localement), une seule année de finances, résultats classés par pertinence (pas par date), 25 résultats par page, 10 000 au plus. Le filtre de zone porte sur les établissements, pas sur le siège.
- **Recherche** : 20 pages au plus (500 entreprises analysées), 4 requêtes par seconde au plus, attente `Retry-After` sur une erreur 429, User-Agent explicite. Une recherche partielle est signalée. Option « siège dans la zone uniquement », cochée par défaut. Les entreprises avec un signal d'achat sont affichées en premier.
- **Exclusions** : associations exclues (`est_association=false`). Entrepreneurs individuels et administrations conservés.
- **Dirigeants** : ni récupérés (`minimal=true`, sans `dirigeants`), ni affichés, ni stockés. Le mail commence par « Madame, Monsieur ».
- **Signaux** : « créée il y a moins d'un an » ; « PME qui se développe (indice) » = PME créée il y a 1 à 7 ans, au résultat net positif au dernier exercice publié.
- **Mail** : adapté au secteur (section NAF) et au signal, signé avec les réglages du membre. Il est bloqué (copie et ouverture) tant qu'il contient un terme interdit, un champ `[à compléter]`, ou s'il manque la mention STOP. Envoi : « Copier le mail » ou « Ouvrir dans ma messagerie » (`mailto:`). L'humain envoie toujours lui-même.
- **Opposition** : le prospect répond STOP, le membre le passe en « refus ». Il quitte alors le suivi et seuls son SIREN et la date restent dans la liste d'opposition. Il est masqué de toute recherche.
- **Relances** : J+7 et J+21 après le premier contact (jour ouvré suivant), exportées en .ics avec des titres neutres (SIREN, jamais le nom).
- **Conservation** : purge au démarrage des prospects sans contact depuis 3 ans (ou ajoutés il y a 3 ans sans contact).
- **Liens externes** : seuls la fiche `annuaire-entreprises.data.gouv.fr/entreprise/<SIREN>` et `mailto:` peuvent être ouverts (`src/main/ipc.js`).

### Code de l'outil

- `src/shared/vocabulary.js` : vérificateur de vocabulaire (statut non-employeur).
- `src/main/entreprises-api.js` : appels réseau (processus principal), avec limiteur de débit.
- `src/tools/radar-prospects/rules.js` (constantes), `search.js` (filtres, nettoyage des réponses, signaux), `mail.js`, `prospects.js` (statuts, relances, opposition, purge), `store.js` (fichier `userData/data/radar-prospects.json`), `ui/` (onglets Rechercher, Mon suivi, Réglages).
- `src/shared/dom.js` : `el()` et `setChildren()`. Ne pas passer `null` à `replaceChildren()` : il l'affiche en texte.
- Les tests n'utilisent que des données fictives (« EXEMPLE SAS », SIREN 123456789) : le dépôt est public.

## Outil 2 : Échéancier d'études

Le chef de projet saisit les dates clés, l'outil calcule les échéances et les exporte en `.ics` (compatible Outlook, Google Agenda, iPhone).

**Avant la signature**
- Canal d'arrivée : prospection, fidélisation, contact spontané, appel d'offre CNJE (alerte « répondre vite » : la première Junior qui répond récupère l'étude).
- Propale : envoi **RDV + 48 h**, après trois cases cochées (budget validé par le Vice-trésorier, numéro demandé au Secrétaire général, relecture qualité). Relances à **envoi + 3 jours** et **envoi + 10 jours**.

**Pendant l'étude**
- Acompte : **60 %** par défaut, taux modifiable pour chaque étude (1 à 99 %), jamais 100 %.
- RDM du chef de projet (s'il est rétribué) : signé au plus tôt le jour de la CE.
- RDM des intervenants : signé au plus tard au début de la phase, ne dépasse pas la fin de scolarité.
- Pour chaque phase : alerte « avenant à signer avant le [fin de phase] ». Après la fin de phase, l'étude passe Hors-Qualité.

**Fin d'étude**
- Présentation au client au moins **1 semaine avant la fin**.
- PVRF signé après l'envoi des livrables.
- Solde payable sous **30 jours**.
- Garantie après le PVRF : **1 mois** pour un rapport, **3 mois** pour les autres livrables.

**Après l'étude**
- Rappel de fidélisation tous les 2 à 3 mois, rappel de témoignage, rappel de passation.

Les dates calculées doivent être couvertes par des tests.

### Décisions prises (octobre 2026, avec Guillaume)

Sources : ce fichier et la formation AJC « Suivi de projet » (septembre 2026).
- **Week-ends et jours fériés** : la règle se choisit pour chaque étude (décaler au jour ouvré suivant par défaut, avancer au jour ouvré précédent, ou garder la date exacte). Elle s'applique aux actions de suivi (propale, relances, témoignage, fidélisation, passation). Les dates « au plus tard » (présentation client) sont toujours avancées. Les dates contractuelles saisies (CE, phases, PVRF) et les délais légaux (solde, garanties, garantie PVRI) ne sont jamais décalés. Les 11 jours fériés de métropole comptent, lundi de Pentecôte compris.
- **Relances propale** : J+3 et J+10. Aucune relance après la signature de la CE.
- **Retirés de l'outil (10 octobre 2026, à la demande de Guillaume)** : le test de déontologie et la checklist de préparation du RDV. Ne pas les réintroduire sans son accord.
- **RDV client** : le chef de projet ajoute autant de RDV qu'il veut (date, heure facultative, objet neutre de 80 caractères maximum). Ils ne sont jamais décalés, se rangent dans l'étape correspondant à leur date et sont exportés : avec heure, événement d'1 h, rappel 1 h avant ; sans heure, journée entière.
- **PVRI** (facultatif, case par phase) : PVRI et facture intermédiaire à la fin de la phase, puis fin de garantie à J+7.
- **Fin** : PVRF à la date saisie (sinon à la fin d'étude), avec les questionnaires de satisfaction le même jour. Solde à PVRF + 30 j.
- **Après** : témoignage à PVRF + 14 j ; fidélisation tous les 2 ou 3 mois (choix dans la fiche, 2 par défaut) pendant 1 an ; passation 1 mois avant la fin de mandat (champ facultatif). Pas de point hebdomadaire client.
- **Alertes de cohérence** : CE avant le RDV, phase avant la CE ou après la fin d'étude, phase dont la fin précède le début, propale envoyée sans les 3 validations.
- **Suppression** d'un échéancier : définitive, après confirmation.

### Code de l'outil

- `src/shared/dates.js` (jours ouvrés, fériés, décalages), `src/shared/ics.js` (export agenda sans dépendance), `src/shared/dom.js` (`el()` pour construire les pages sans `innerHTML`).
- `src/tools/echeancier/rules.js` : toutes les constantes métier. `schedule.js` : `computeSchedule(study)` (fonction pure). `study.js`, `store.js` (fichier `userData/data/echeancier.json`), `export.js`, `ui/` (accueil, fiche, aperçu).
- La feuille de style d'un outil se charge avec `import cssUrl from './x.css?url'` et une balise `<link>` : la Content-Security-Policy reste stricte.

## Conventions

- Code, noms de variables et commentaires en anglais ; interface et messages en français.
- Commits petits et clairs, en français.
- Mets à jour ce fichier quand une décision importante est prise.
