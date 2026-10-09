# Pandore

Pandore est une application de bureau qui regroupe les outils internes d'**AJC**, la Junior-Entreprise d'Audencia (Nantes). Elle est gratuite et open source, et fonctionne sur Windows, macOS et Linux.

## Les outils

| Outil | À quoi il sert | État |
|---|---|---|
| **Radar Prospects** | Trouver des entreprises qui ont probablement besoin d'une étude (signaux d'achat), suivre la prospection et préparer un premier mail conforme au RGPD. L'outil prépare, vous envoyez. | Disponible |
| **Échéancier d'études** | Calculer toutes les échéances d'une étude, du premier RDV à la fidélisation, avec un aperçu en direct, et les exporter dans un agenda (Outlook, Google Agenda, iPhone). | Disponible |

## Vos données restent sur votre ordinateur

- Pandore n'a pas de compte et pas de serveur : tout est enregistré dans des fichiers sur votre ordinateur.
  - Windows : `%APPDATA%\Pandore\data`
  - macOS : `~/Library/Application Support/Pandore/data`
  - Linux : `~/.config/Pandore/data`
- La seule connexion à Internet est la recherche d'entreprises du Radar Prospects. Elle passe par l'API publique et gratuite de l'État ([recherche-entreprises.api.gouv.fr](https://recherche-entreprises.api.gouv.fr/docs/)).
- Les études sont désignées par leur numéro de propale (ex. `2026-014`), jamais par le nom du client.

## Installation

1. Ouvrez la page **Releases** de ce dépôt GitHub, colonne de droite.
2. Téléchargez le fichier correspondant à votre ordinateur :
   - **Windows** : `Pandore-x.y.z Setup.exe`
   - **macOS** : `Pandore-darwin-….zip`, à décompresser, puis glissez `Pandore.app` dans le dossier Applications
   - **Linux** : `.deb` (Ubuntu, Debian) ou `.rpm` (Fedora)
3. Lancez le fichier.

### ⚠️ Avertissement au premier lancement (Windows et macOS)

Pandore est un projet étudiant. Il n'a pas de **certificat de signature** : ce certificat est payant, et c'est lui qui permet à Windows et macOS de reconnaître un éditeur. Au premier lancement, votre système affiche donc un avertissement. C'est normal, et il n'apparaît qu'une fois. Le code source est entièrement visible sur ce dépôt.

**Windows** : un écran bleu « Windows a protégé votre ordinateur » s'affiche.
1. Cliquez sur **Informations complémentaires**.
2. Cliquez sur **Exécuter quand même**.

**macOS** : un message indique que l'app « ne peut pas être ouverte » car le développeur n'est pas identifié.
1. Fermez le message.
2. Ouvrez **Réglages Système › Confidentialité et sécurité**.
3. En bas de la page, cliquez sur **Ouvrir quand même** à côté de Pandore, puis confirmez.

Sur les anciennes versions de macOS, vous pouvez aussi faire un clic droit (ou Ctrl + clic) sur l'app, choisir **Ouvrir**, puis confirmer.

## Pour les développeurs

Prérequis : [Node.js](https://nodejs.org/) version 22.12 ou plus récente, et Git.

```bash
npm install      # installe les dépendances
npm start        # lance l'app en mode développement
npm test         # lance les tests automatiques
npm run make     # construit l'installateur pour votre système
```

> **Windows / PowerShell** : si `npm` affiche « l'exécution de scripts est désactivée sur ce système », utilisez `npm.cmd` à la place de `npm` (par exemple `npm.cmd start`).

Organisation du code :

```
src/
  main/       processus principal : fenêtre, sécurité, accès aux fichiers
  preload/    pont sécurisé entre l'interface et le système
  renderer/   interface : menu latéral et affichage des outils
  shared/     code commun (stockage JSON, dates, export .ics, …)
  tools/      un dossier par outil
tests/        tests automatiques (Vitest)
```

Pour ajouter un outil, créez un dossier dans `src/tools/` : il apparaît automatiquement dans le menu. Les détails sont dans [CLAUDE.md](CLAUDE.md).

## Licence

[MIT](LICENSE) © 2026 Guillaume Jutier
