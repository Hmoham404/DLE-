# MYC Smart Factory — Production & Meeting System

Application française pour MYC Beauty Innovation Tunisia. Deux codes distincts remplacent la connexion Supabase Auth : **saisie** et **réunion**. Les codes ne figurent pas dans le dépôt. Le site hébergé reste privé au niveau Sites ; les codes définissent les droits à l’intérieur de l’application.

## Fonctionnalités livrées

- Centre de pilotage industriel sombre / clair, responsive, avec aperçu isométrique cliquable des ateliers.
- Grilles des quatre classeurs fournis : Injection, Métallisation, Sérigraphie et Assemblage. Toutes leurs colonnes de saisie sont accessibles.
- Brouillons, validation serveur, objectif de planning complémentaire, historique des rapports et versions des corrections.
- Réunion : KPI, comparaison des départements, planning, Pareto, pertes, décisions, responsables, échéances, priorités et clôture.
- Présentation plein écran, six sections et navigation au clavier. Compte rendu par impression PDF du navigateur.
- Plan d’usine personnalisable PNG/JPG/WebP (2 Mo), placement des machines par glissement en 2D, vue en perspective, états et fiches machines.
- Import XLSX à vérifier en brouillon ; export à partir des fichiers originaux ; téléchargement des modèles sources.
- Démonstration indépendante en mémoire, jamais écrite dans la production.

## Architecture et données

React / TypeScript avec App Router compatible Next.js via Vinext, Vite et Cloudflare Workers (hébergement Sites). Interface CSS, Lucide et Recharts. La vue isométrique est un schéma SVG et le plan utilise une perspective CSS : ce n’est pas un jumeau 3D mesuré de l’usine.

Les nouvelles données sont dans le **bucket Supabase Storage privé `myc-smart-factory-private`**, séparé des applications déjà présentes. Les vérifications ont confirmé que les accès anonymes en lecture et écriture sont refusés. Les fichiers JSON sont en plus chiffrés en AES-GCM côté serveur. Les données brutes, indicateurs dérivés et versions sont distincts dans chaque document.

Cette livraison n’installe pas les 17 tables PostgreSQL proposées dans le cahier des charges : l’API REST fournie ne permet pas d’exécuter une migration SQL. Le stockage privé permet de fonctionner sans modifier les tables existantes, dont une table de snapshots s’est avérée accessible anonymement. Aucun droit existant n’a été modifié. Pour un déploiement à gros volume, migrer les documents vers des tables PostgreSQL privées et des requêtes filtrées avant de dépasser quelques centaines de rapports.

Les indicateurs se synchronisent par interrogation toutes les **30 secondes**, et à la demande. Ce n’est pas un abonnement Supabase Realtime. Les états machines sont saisis manuellement ; aucun capteur ni automate industriel n’est connecté.

## Droits

- **Code saisie** : consulter les vues ; créer/corriger les rapports ; importer ; gérer machines, plan et seuils.
- **Code réunion** : consulter les rapports et indicateurs ; exporter ; créer/corriger/clôturer les décisions. Écriture production et administration refusée côté serveur.
- Sessions HttpOnly de 8 heures ; signature HMAC ; contrôle d’origine pour les mutations ; ralentissement des tentatives de code incorrectes. La limitation des tentatives est locale à chaque instance Worker.
- Les codes partagés identifient un espace dans l’audit, pas un utilisateur individuel.

## Configuration serveur

Configurer ces variables comme **secrets** dans l’hébergeur, jamais dans le frontend :

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
ENTRY_ACCESS_CODE
MEETING_ACCESS_CODE
SESSION_SECRET
DATA_ENCRYPTION_KEY
```

`DATA_ENCRYPTION_KEY` est une clé durable distincte de la signature des sessions. La sauvegarder avec les sauvegardes du bucket et ne pas la changer sans rechiffrer les documents existants. Les anciennes versions chiffrées sont dans `audit/`. Les verrous d’écriture sont dans `locks/` : si un Worker est interrompu avant nettoyage, un administrateur doit vérifier puis retirer le verrou orphelin concerné.

La clé publishable n’est pas utilisée : le navigateur appelle exclusivement les API du serveur. La clé secrète Supabase ne quitte jamais le serveur.

## Développement

Node.js ≥ 22.13, Python 3.11 pour le service Excel optionnel et ses tests.

```powershell
npm ci
npm run dev
```

L’aperçu démarre en démonstration sans secret. Pour tester les données réelles localement, fournir les variables via les bindings Wrangler locaux non suivis par Git. Les valeurs de production sont déjà configurées dans les secrets du site Sites.

```powershell
node node_modules/typescript/lib/tsc.js --noEmit
node scripts/test-core.mjs
python services/test_excel_service.py
npm run build
```

`private/templates/` contient les modèles originaux. `data/templates.json` contient les champs, adresses de colonne, formules et diagnostics. `scripts/extract-templates.py` reconstruit cette cartographie depuis les fichiers placés dans le dossier parent.

## Excel : fidélité et limites connues

Les tests vérifient les membres ZIP, les parties non modifiées, les styles, fusions, dimensions et paramètres d’impression, les formules d’origine et la réimportation des valeurs. Les cellules numériques restent numériques, les chaînes sont échappées et les champs de référence restent du texte. Les valeurs en cache des formules de la feuille modifiée sont supprimées pour demander un recalcul à Excel.

Les modèles fournis comportent **3 références cassées en Injection, 1 en Métallisation et 345 en Assemblage**, ainsi que des plages formatées sur plus d’un million de lignes pour Sérigraphie et Assemblage. Certaines formules contiennent des cumuls historiques codés en dur, des liens externes ou des formules partagées. Ces éléments ne sont pas corrigés silencieusement. Les champs issus de recherches dans des fichiers externes peuvent recevoir une valeur manuelle explicite ; cette valeur remplace alors cette recherche à l’export.

Le recalcul et la vérification visuelle dans Microsoft Excel n’ont pas été effectués. **Ne pas considérer la fidélité métier comme validée avant ce contrôle.** Limites par export : 80 lignes Injection, 8 Métallisation, 200 Sérigraphie ou Assemblage. Les modèles sources sont téléchargés tels quels et peuvent donc contenir les exemples historiques d’origine.

La production réalisée est traitée comme la production conforme, suivant les formules de qualité fournies : `conforme / (conforme + rebuts)`. Les conventions OEE / DLE restent provisoires tant que MYC ne les a pas approuvées. Les cumuls ne sont pas inventés ; une formule externe ou non prise en charge s’affiche indisponible. L’Injection n’a pas d’objectif de planning explicite dans son modèle : utiliser la colonne complémentaire « Objectif planning » ; ce champ est stocké dans l’application et ne remplace pas une cellule du classeur.

## Service Excel Python dédié

`services/excel_service.py` fournit un service HTTP Python autonome, sans dépendance supplémentaire. Il copie les parties du modèle avec `zipfile` et modifie uniquement les entrées cartographiées. Le protéger par HTTPS et configurer `EXCEL_SERVICE_TOKEN`, puis lancer :

```powershell
python services/excel_service.py
```

Le processus écoute sur `127.0.0.1:8090`. Pour l’utiliser depuis le site, configurer les secrets `EXCEL_SERVICE_URL` (origine HTTPS du service) et `EXCEL_SERVICE_TOKEN`. Sans cette configuration, l’export hébergé utilise le moteur ZIP TypeScript testé. Le service Python n’est pas déployé automatiquement sur Workers.

## Vérifications réalisées

24 contrôles du moteur TypeScript ; deux tests Python couvrant les quatre modèles et les entrées invalides ; vérification TypeScript ; compilation de production ; réponses HTTP de l’application et des routes protégées. Aucun navigateur n’est connecté à cet environnement : la vérification visuelle interactive reste à effectuer sur le site publié.
