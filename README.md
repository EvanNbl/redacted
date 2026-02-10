Application de bureau Tauri + Next.js pour visualiser et gérer des contacts
sur un globe 3D et une carte plate, avec un Google Sheet comme base de
données légère.

---

## Objectif du projet

L’objectif est de disposer d’une application cross‑platform (Windows, macOS,
Linux) empaquetée avec **Tauri**, qui embarque une app **Next.js**.  
L’app affiche :

- **Un globe 3D** réalisé avec **Three.js** et une **texture de la Terre**.
- **Une carte plate interactive** sur laquelle on place des **points (contacts)**.
- Les données des contacts sont **lues depuis un Google Sheet** à chaque
  lancement de l’app (et sur demande via un bouton de rafraîchissement).
- Depuis l’interface, on peut **ajouter / modifier des contacts**, ce qui met
  à jour le même Google Sheet (lecture + écriture).

---

## Fonctionnalités prévues

- **Globe 3D (Three.js)**
  - Affichage d’un globe avec une texture réaliste de la Terre.
  - Projection de chaque contact en fonction de ses coordonnées (lat/lon).
  - Points cliquables pour afficher les informations détaillées du contact.

- **Carte plate**
  - Projection des mêmes données de contacts sur une carte 2D (vue monde).
  - Possibilité de zoom / pan (à définir selon la lib utilisée).
  - Affichage de tooltips ou d’un panneau latéral avec les détails du contact.

- **Intégration Google Sheets**
  - **Lecture** du Google Sheet au démarrage de l’application.
  - **Rafraîchissement manuel** via un bouton dans l’UI.
  - **Ajout / mise à jour** de lignes dans le Google Sheet lorsque
    l’utilisateur crée ou édite un contact dans l’app.

- **App Tauri**
  - Application de bureau embarquant l’UI Next.js.
  - Accès réseau pour communiquer avec l’API Google Sheets.

---

## Stack technique

- **Frontend / UI**
  - [Next.js 16](https://nextjs.org/) (App Router)
  - [React 19](https://react.dev/)
  - [Tailwind CSS 4](https://tailwindcss.com/) (via `@tailwindcss/postcss`)
  - [Three.js](https://threejs.org/) (prévu)

- **Desktop**
  - [Tauri](https://tauri.app/) (prévu)

- **Données**
  - [Google Sheets](https://www.google.com/sheets/about/) comme base de
    données simple (lecture/écriture des contacts).

---

## État actuel du projet

- Base **Next.js** initialisée (dossier `app/`).
- Page d’accueil (`app/page.tsx`) nettoyée du template Vercel et remplacée
  par une maquette simple qui décrit :
  - le bloc **Globe 3D**,
  - le bloc **Carte & liste des contacts**,
  - un bouton de **rafraîchissement** (placeholder).
- Métadonnées (`app/layout.tsx`) adaptées au projet **Terra Contacts** et
  langue du document passée en `fr`.
- L’intégration réelle de **Three.js**, **Tauri** et **Google Sheets** reste
  à implémenter.

---

## Prérequis

- **Node.js** (version recommandée : LTS récente)
- **npm** (ou `pnpm`, `yarn`, `bun` selon préférence)
- Pour Tauri (une fois intégré) :
  - Rust toolchain
  - C++ build tools / toolchain adaptés à ton OS
  - Voir la doc Tauri pour les prérequis détaillés.

---

## Installation & lancement en développement

Installation des dépendances :

```bash
npm install
```

Lancement du serveur de développement Next.js :

```bash
npm run dev
```

Par défaut, l’application est accessible sur `http://localhost:3000`.

Lorsque Tauri sera configuré, un script du type suivant pourra être ajouté
pour lancer l’app bureau :

```bash
npm run tauri dev
```

*(à configurer une fois `src-tauri` en place)*.

---

## Architecture (prévue)

- `app/`
  - `layout.tsx` – Layout racine + métadonnées.
  - `page.tsx` – Page principale avec le globe 3D (placeholder) et la carte
    des contacts (placeholder).
  - `globals.css` – Styles globaux + intégration Tailwind 4.
- `public/`
  - Assets statiques (dont textures du globe, icônes, etc. à venir).
- `src-tauri/` (à créer)
  - Configuration Tauri et code Rust.
  - Gestion de la fenêtre, permissions réseau, packaging.

---

## Flux de données Google Sheets (concept)

1. **Au lancement de l’app**
   - Tauri/Next.js appelle l’API Google Sheets.
   - Les lignes du Sheet sont converties en objets `Contact` et chargées
     dans l’état de l’application.

2. **Affichage**
   - Les contacts sont projetés sur le **globe 3D** et la **carte 2D**.

3. **Ajout / modification d’un contact**
   - L’utilisateur remplit un formulaire dans l’UI.
   - L’app envoie une requête pour **ajouter ou mettre à jour** une ligne
     dans le Google Sheet.

4. **Rafraîchissement manuel**
   - Un bouton déclenche une nouvelle lecture complète du Google Sheet
     pour resynchroniser l’UI.

---

## Scripts npm

- **`npm run dev`** : lance Next.js en mode développement.
- **`npm run build`** : build de production Next.js.
- **`npm run start`** : démarre le serveur Next.js en mode production.
- **`npm run lint`** : lance ESLint sur le projet.

Des scripts supplémentaires seront ajoutés pour Tauri (`tauri dev`,
`tauri build`, etc.) une fois la partie desktop branchée.

---

## Mises à jour via GitHub (repo privé)

L’app intègre les mises à jour automatiques via **Tauri Updater** et les **GitHub Releases** (dépôt privé ou public). Le **token d’accès est intégré dans l’app** au moment du build, donc les utilisateurs n’ont rien à configurer sur leur machine.

### Build automatique (GitHub Actions)

À chaque **push sur `master`**, un workflow construit l’app pour Windows, Linux et macOS et crée une release brouillon sur GitHub avec les artefacts.

**Secrets à configurer** (Settings → Secrets and variables → Actions) :

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenu (ou chemin) de la clé privée de signature. Générer avec : `npm run tauri signer generate -- -w $env:USERPROFILE\.tauri\monapp.key` (Windows) puis copier le contenu du fichier `.key` généré. |
| `TAURI_UPDATE_TOKEN` | Personal Access Token GitHub avec le scope `repo` (pour accéder aux releases d’un dépôt privé). Ce token est **injecté dans le binaire** au build pour que l’app puisse vérifier les mises à jour sans configuration côté utilisateur. |

**Permissions du workflow** : dans Settings → Actions → General → Workflow permissions, choisir **“Read and write permissions”** pour que le workflow puisse créer les releases.

### Configuration locale (`tauri.conf.json`)

- **`plugins.updater.pubkey`** : clé publique (générée en même temps que la clé privée ci‑dessus).
- **`plugins.updater.endpoints`** : URL du `latest.json` des releases, ex.  
  `https://github.com/VOTRE_ORG/VOTRE_REPO/releases/latest/download/latest.json`

Le fichier `latest.json` est généré automatiquement par [tauri-action](https://github.com/tauri-apps/tauri-action) lors du build.

### Note de sécurité

Le token `TAURI_UPDATE_TOKEN` est présent dans le binaire compilé. Toute personne disposant de l’exécutable pourrait en théorie l’extraire. Pour limiter les risques : utiliser un token avec le scope minimal (`repo`), ou un token dédié à un dépôt unique ; en cas de fuite du binaire, révoquer le token et en créer un nouveau.

### Côté utilisateur

Le menu **Actions → Vérifier les mises à jour** lance la vérification, le téléchargement et l’installation, puis redémarre l’application si une mise à jour a été installée. Aucune variable d’environnement n’est requise sur la machine de l’utilisateur.

---

## Roadmap rapide

- [ ] Créer la structure Tauri (`src-tauri/`) et scripts associés.
- [ ] Ajouter les dépendances Three.js (et éventuellement React Three Fiber).
- [ ] Intégrer le globe 3D avec texture de la Terre.
- [ ] Mettre en place la carte plate et la gestion des points.
- [ ] Connecter l’app à un Google Sheet (lecture).
- [ ] Gérer l’écriture dans le Google Sheet (ajout / mise à jour de contacts).
- [ ] Affiner le design et l’UX (transitions, thèmes, etc.).
