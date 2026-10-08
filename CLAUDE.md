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

## Outil 2 : Échéancier d'études

Le chef de projet saisit les dates clés, l'outil calcule les échéances et les exporte en `.ics` (compatible Outlook, Google Agenda, iPhone).

**Avant la signature**
- Canal d'arrivée : prospection, fidélisation, contact spontané, appel d'offre CNJE (alerte « répondre vite » : la première Junior qui répond récupère l'étude).
- Checklist de préparation du RDV : besoins, enjeux, budget, échéancier, risques. Rappel : pas de budget précis au RDV.
- Test de déontologie après le RDV :
  - interdit : vente de produit, contrat de maintenance, constitution d'une base de prospects, domaine réglementé (juridique, comptable, médical) ;
  - sous conditions : traduction (si l'école enseigne la langue), prospection (si intégrée à une étude plus complète), apport par un partenaire (clause de communication et CdC rédigé par AJC) ;
  - obligatoire : lien avec un enseignement de l'école.
- Propale : envoi **RDV + 48 h**, après trois cases cochées (budget validé par le Vice-trésorier, numéro demandé au Secrétaire général, relecture qualité). Relances à **envoi + 3 jours** et **envoi + 10 jours**.

**Pendant l'étude**
- Acompte : 30 % en général, 50 % si client à risque, jamais 100 %.
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

## Conventions

- Code, noms de variables et commentaires en anglais ; interface et messages en français.
- Commits petits et clairs, en français.
- Mets à jour ce fichier quand une décision importante est prise.
