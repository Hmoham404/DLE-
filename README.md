# MYC Smart Factory

Application Next.js pour la saisie de production, les réunions et le parc machines MYC. Le site local utilise désormais Supabase comme stockage actif.

## Saisie rapide et référentiel produits

La saisie utilise un seul tableau horaire. Renseigner directement la colonne **TOTAL** pour saisir les pièces conformes, les rebuts, l’effectif réel, le temps planifié et les arrêts de toute l’équipe. La durée proposée provient de l’équipe sélectionnée (8 ou 10 heures) ; les arrêts sont proposés à zéro. Ces valeurs sont ajustables dans les cellules de la colonne **TOTAL**. L’effectif proposé par une fiche produit est un point de départ à vérifier selon les personnes réellement présentes. Une donnée inconnue reste vide.

Choisir une référence produit reprend le cycle machine, les empreintes, le temps standard de main-d’œuvre et les objectifs TRS/DLE. Le bouton **Référentiel produits** permet de consulter, créer et modifier ces paramètres, enregistrés sous `product:<identifiant>` dans le même JSON privé Supabase, avec versions et export de sauvegarde. Les 12 références initiales comprennent les 9 lignes des captures MYC et les 3 références d’injection du référentiel QOS déjà présent dans le projet. Aucun rapprochement automatique avec les noms de presses QOS n’est effectué. La soudure est une opération de l’atelier Assemblage.

Pour les nouvelles saisies, **DLE = (pièces bonnes × temps standard en secondes) ÷ (effectif réel × durée travaillée en heures × 3 600) × 100**. Les arrêts machine ne retirent pas des heures de présence. Sans effectif ou temps standard, le DLE reste indisponible. Les objectifs de 70 % et 80 % fournis sont conservés sur les fiches concernées ; aucun objectif n’est inventé pour les références d’injection.

Les paramètres sont copiés dans chaque rapport. Une modification ultérieure du référentiel ne change pas les anciens rapports. Les rapports existants conservent leur convention DLE historique ; un regroupement mélangeant les deux conventions affiche un DLE indisponible. Modifier une cellule horaire active le calcul à partir des heures ; modifier une cellule TOTAL active les totaux directs. Le tableau reste le même. Les deux ensembles de valeurs sont conservés séparément et ne s’additionnent pas.

Fichiers : `lib/product-standards.ts`, `components/production-entry.tsx`, `app/production-entry.css`. Contrôles : `node scripts/test-production-entry.mjs`, `npm run test:ui`, `node scripts/test-excel-autofill.mjs` et `npm run build`. Les tests d’interface utilisent des API simulées. `node scripts/seed-product-standards.mjs` ajoute uniquement les références initiales absentes via le serveur local actif, sauvegarde le JSON avant ajout et vérifie que les enregistrements préexistants restent identiques.

## Ouvrir le site

Double-cliquer sur `DEMARRER-LOCAL.cmd`, ou exécuter dans ce dossier :

```powershell
npm run dev
```

Ouvrir http://localhost:3000 : l’accès à Saisie, Réunion et Machines est direct, sans code. MYC_LOCAL_AUTO_LOGIN active ce comportement uniquement sur localhost en développement. Le bandeau SUPABASE confirme le stockage distant.

## Données et sauvegardes

Les données et leur historique sont enregistrés dans le JSON privé :

```text
Bucket : myc-smart-factory-private
Espace : myc-json-20261026-7943ca67
Fichier : workspace.json
```

Les boutons Enregistrer et Valider de Saisie, ainsi que les modifications des fiches, décisions et du plan, utilisent ce stockage. Les écritures sont protégées par un verrou pour ne pas perdre les modifications simultanées d’enregistrements différents. Les saisies de production utilisent en plus leur date de version pour refuser une correction devenue obsolète.

Le fichier distant est chiffré. Le bouton JSON de Saisie télécharge tous les enregistrements et leur historique sous forme lisible. Une erreur d’enregistrement reste visible et ne provoque pas un basculement silencieux vers le stockage local.

Le transfert initial a conservé 382 fiches et 398 versions. Les copies locales d’avant migration sont conservées dans `.local-data/factory.json` et `.local-data/backups/`. Le compte rendu est dans `.local-data/supabase-migration.json`. Une copie initiale distante se trouve sous `backups/` ; les anciennes copies intermédiaires sous `records/` et `audit/` sont conservées, mais le fichier actif est exclusivement `workspace.json`.

## Espaces

Les départements Injection, Métallisation, Sérigraphie et Assemblage sont ouverts dans Saisie, Réunion et Machines. Les enregistrements de chaque atelier sont conservés dans Supabase et dans l’export JSON. La disponibilité se configure dans `lib/department-availability.ts`.

- Saisie : date, équipe, machine ou ligne, heures de production, rebuts, effectif, arrêts, causes et validation.
- Réunion : OEE, DLE, planning, Pareto, comparaison par atelier / ligne / machine et décisions.
- Machines : inventaires des deux fichiers Excel, matricules, séries, fiches modifiables, plan 2D et volumes 3D indicatifs.

La métallisation comporte Ligne 1 et Ligne 2. L’assemblage comporte Automatique et Manuelle. Les affectations physiques non indiquées dans les sources restent à compléter dans les fiches.

Le parc comprend les 16 presses d’injection, les 6 machines de sérigraphie, les machines de marquage et les auxiliaires et moules recensés. Les cellules fusionnées ont été prises en compte. Les doublons de codes restent associés à leurs lignes source respectives ; les anomalies sont consultables dans Analyse des fichiers. Les quatre tables sans matricules sont conservées comme fiche groupée. Aucune correspondance arbitraire entre B02 / B23 et un code interne n’est imposée.

## Calculs

- OEE = disponibilité × performance × qualité ; OEE global pondéré par les quantités produites.
- DLE des nouvelles saisies = pièces bonnes × temps standard ÷ heures-personnes dépensées, avec conversion des secondes et résultat en pourcentage. Les anciens rapports conservent leur formule historique.
- Planning = production conforme ÷ quantité planifiée × 100.
- Couleurs : rouge sous 85 %, jaune de 85 à 95 %, vert au-dessus de 95 %.
- Une donnée nécessaire manquante reste indisponible ; les anciennes importations Excel ne créent pas de détail horaire fictif.

## Excel

Les quatre originaux sont conservés dans `private/templates/`. La saisie remplit automatiquement les champs disponibles du rapport : machine, référence, équipe, production, rebuts, temps, causes et indicateurs. « Aperçu Excel automatique » montre ces valeurs sans ressaisie ; les champs complémentaires restent modifiables. Le numéro d’OF se renseigne une seule fois dans la saisie.

Enregistrer ou Valider sauvegarde les données et les champs Excel dans le JSON Supabase. Le bouton Excel télécharge les rapports validés du département et de la date sélectionnés, sans téléchargement automatique après validation. Les cumuls utilisent les saisies validées du même OF (ou de la même référence si l’OF est vide), jusqu’à la date et l’équipe concernées.

Les rapports issus de la saisie utilisent les durées réellement renseignées, y compris les équipes de 8 ou 10 heures. Les nouveaux rapports utilisent le DLE basé sur les pièces bonnes et les heures dépensées ; les anciens rapports conservent leur convention. Les bases produit inconnues restent indisponibles. Les anciennes importations gardent les formules de leur modèle. L’export conserve les feuilles, styles, fusions, graphiques et paramètres d’impression ; les résultats calculés sont fournis avec les formules. Un contrôle des valeurs et formules exportées est effectué par les tests, sans contrôle dans Microsoft Excel natif.

## Configuration serveur

Voir `supabase/ACTIVER-SUPABASE.md`. La configuration active est dans `.env.local`, ignoré par Git et exclu du déploiement. Conserver les mêmes valeurs, en particulier DATA_ENCRYPTION_KEY, pour continuer à relire les données :

```text
MYC_STORAGE=supabase
MYC_STORAGE_FORMAT=workspace-json-v1
MYC_STORAGE_NAMESPACE=myc-json-20261026-7943ca67
SUPABASE_URL
SUPABASE_SECRET_KEY
ENTRY_ACCESS_CODE
MEETING_ACCESS_CODE
SESSION_SECRET
DATA_ENCRYPTION_KEY
```

Ne pas publier les clés côté navigateur. Les secrets restent sur le serveur. La connexion à Supabase ne déploie pas le site ; aucun nouveau déploiement Vercel ou Sites n’a été effectué.

## Code et vérification

- `lib/cloud-workspace.ts` : JSON actif, versions et écritures sérialisées.
- `lib/cloud-store.ts` : accès privé Supabase, chiffrement et reprise des requêtes temporaires.
- `lib/server.ts` : autorisations et validation.
- `lib/workshop.ts` : calculs horaires.
- `app/api/backup/route.ts` : téléchargement JSON complet.
- `scripts/migrate-local-to-supabase.mjs` : transfert avec sauvegarde et comparaison intégrale ; refuse d’écraser un JSON distant différent.

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-workshop.mjs
node scripts/test-core.mjs
node scripts/test-shifts.mjs
node scripts/test-excel-autofill.mjs
```

Les contrôles Supabase ont vérifié l’enregistrement d’un brouillon, sa validation, sa lecture en réunion, l’historique, l’export JSON, les droits et le refus d’une version obsolète. Les limites de connexion et les écritures concurrentes ont également fait l’objet de contrôles ciblés.

## Équipes et suppression des saisies

Les équipes disponibles sont Jour (06h–14h), Après-midi (14h–22h), Nuit (22h–06h) et Journée (07h30–17h30). Les grilles comportent respectivement 8, 8, 8 et 10 créneaux. La date d’une équipe de nuit est celle du début à 22h. Les anciennes appellations matin / soir restent reconnues et les anciennes données hors des nouveaux horaires sont conservées.

La réunion filtre par équipe et regroupe les valeurs par leur créneau réel, pas par la position des colonnes. Les créneaux à 07h30 restent distincts ; aucune quantité n’est répartie artificiellement sur deux heures.

Supprimer la saisie est disponible sur une saisie enregistrée et via la corbeille de l’historique. Une confirmation affiche la machine, la date, l’équipe et l’OF. La suppression retire le rapport des écrans de production et de réunion mais conserve ses valeurs et son historique dans le JSON, avec deleted_at et deleted_by. Une version obsolète ne peut pas supprimer une saisie plus récente, et une ancienne sauvegarde ne réactive pas un rapport supprimé.

Contrôles : `node scripts/test-shifts.mjs` (horaires, agrégation, conservation des historiques). Les essais Supabase ont également vérifié la suppression d’un rapport temporaire et la conservation des autres enregistrements.

## Espace 5S de toute l’usine

Le titre « Usine intelligente » et l’onglet « 5S usine » ouvrent le même espace. L’interface est en français ; les quatre départements de production sont disponibles.

Le module 5S couvre les quatre départements, les espaces communs, les zones, les postes et les machines de l’inventaire. Les deux plans fournis sont inclus dans `private/plans/`, avec les PDF d’origine et les aperçus utilisés pour le repérage. Ils sont servis par une route authentifiée ; les documents d’origine conservent leurs langues et leur mise en page.

Les étiquettes utilisent quatre couleurs : rouge (matériel inutile), jaune (à examiner), vert (matériel nécessaire), bleu (à déplacer). La destination est obligatoire pour une étiquette bleue. Une étiquette contient son emplacement, son responsable, son échéance, sa décision et son statut. Un repère peut être placé ou repositionné sur l’un des plans ; une étiquette sans repère reste explicitement « À positionner ».

Les étiquettes et leurs versions sont enregistrées sous `five_s_tag:<identifiant>` dans le même JSON Supabase privé que la production. L’export JSON complet inclut cet historique. Les mises à jour obsolètes sont refusées. La clôture conserve l’étiquette et sa date de clôture.

Le guide des quatre couleurs cite Six Sigma Manufacturing.

Vérification : `node scripts/test-five-s.mjs`. Les tests locaux vérifient aussi les deux plans privés, la sauvegarde et la clôture dans Supabase, l’historique, les droits, le placement après zoom et l’interface mobile.

## Saisie des totaux sans suivi horaire

Dans Saisie, renseigner directement la colonne TOTAL du tableau, sans changer de surface. Renseigner la production conforme, les rebuts, l’effectif maximum, le temps planifié et les arrêts (en minutes pour l’ensemble de l’équipe). Par exemple, 8 heures correspondent à 480 minutes.

Enregistrer ou Valider conserve le mode et les totaux. Les indicateurs et l’export Excel utilisent le mode sélectionné. Les valeurs horaires sont conservées lors du changement de mode, mais ne s’ajoutent pas aux totaux manuels. La réunion signale les saisies sans détail horaire et ne les répartit pas sur les créneaux. Les nouvelles saisies calculent les heures-personnes à partir de l’effectif réel et de la durée travaillée.

## Dicter les causes sans clé API

Dans les Pareto des défauts et des arrêts, cliquer sur Ajouter une cause, puis sur le micro de la ligne. Autoriser le microphone, dicter la cause en français puis corriger le texte au clavier si besoin. La dictée sépare automatiquement une quantité explicite et sa cause : « 30 minutes panne » remplit panne et 30 min ; « 20 pièces rayures » remplit rayures et 20 pcs. Les heures sont converties en minutes. Sans quantité reconnue, la valeur numérique existante est conservée. Les phrases contenant plusieurs quantités restent en texte à corriger. Les deux champs restent modifiables au clavier. Les causes sont sauvegardées avec le brouillon ou la validation.

La dictée utilise la reconnaissance vocale du navigateur, sans clé API. Selon le navigateur, elle peut nécessiter Internet et transmettre l’audio au service vocal du navigateur ; aucun fichier audio n’est sauvegardé par l’application. Si la dictée est indisponible ou refusée, la saisie au clavier reste disponible. Le microphone fonctionne sur localhost ou sur un site HTTPS compatible.

Contrôle de l’extraction vocale : `node scripts/test-cause-dictation.mjs`.

## Interface industrielle MYC

La saisie quotidienne utilise un mode clair. L’espace Réunion ouvre un mode sombre ; le bouton soleil/lune dans l’en-tête permet de choisir un mode clair pour cette vue. Le logo original MYC est conservé. Les quatre ateliers sont disponibles.

La navigation et les cartes utilisent Framer Motion, avec prise en compte de `prefers-reduced-motion`. Les cartes TRS/OEE, DLE et planning affichent directement les valeurs calculées, sans chiffres de démonstration. Les graphiques Recharts gardent les sources de données existantes et les taux manquants restent indisponibles. Le compte rendu imprimé conserve une présentation claire.

La couche visuelle est dans `app/industrial.css` et `components/industrial-motion.tsx`. Elle n’ajoute ni table ni fonction Supabase. Les champs de formulaire, totaux manuels, dictée, historique, confirmations et exports conservent leurs traitements.

Contrôles : `npm run build`, vérification TypeScript et `npm run test:ui`. Ce dernier exécute React dans un DOM isolé avec API simulées : aucun enregistrement de test n’est envoyé à Supabase. Les tests métier documentés plus haut restent applicables.

## Vue 3D de supervision

L’espace Machines propose une scène sombre avec sol quadrillé, volumes indicatifs des machines, étiquettes, mini-plan et compteurs issus des fiches de la sélection. Les états non renseignés restent « État à renseigner ». Aucun taux de production ou état automate n’est simulé.

Les commandes permettent de passer en perspective ou vue du dessus, zoomer, centrer sur la sélection, réinitialiser la caméra et ouvrir le plein écran. La sélection fonctionne aussi depuis le mini-plan ou la liste déroulante. Les boutons Saisir et Fiche conservent leurs traitements existants. Le plan 2D, les positions enregistrées et l’import de plan restent disponibles.

Le rendu WebGL fonctionne à la demande, sans rotation automatique, avec résolution adaptée et ombres limitées. Une grande sélection affiche au maximum 80 volumes ; le panneau indique le nombre affiché. Les autres unités restent accessibles dans le mini-plan et les fiches ; sélectionner une unité l’inclut dans la scène. Au-delà de 32 volumes, seule l’étiquette de la sélection est montrée pour limiter l’encombrement.

Contrôles : `node scripts/test-scene-presentation.mjs`, `npm run test:ui` et `npm run build`. Le test UI ne rend pas WebGL : le rendu GPU doit aussi être vérifié dans un navigateur compatible.

## Maquette des sites et repérage 5S

L’espace 5S ouvre une reconstruction interactive des deux plans : 15 zones sur le site injection et 18 sur le site métallisation. Les zones ont été repérées visuellement sur les documents MYC ; les contours, hauteurs et volumes sont indicatifs. Les machines et lignes cliquables proviennent de l’inventaire réel. Leur disposition est schématique, classée par référence dans leur atelier : elle ne confirme pas leur position physique sur le terrain et ne modifie pas les coordonnées de l’espace Machines.

Choisir un site, puis cliquer sur une machine numérotée dans la carte 3D, le plan 2D ou la liste. La machine est surlignée, sa référence apparaît et le bouton « Planifier l’audit » ouvre le formulaire avec cette machine déjà liée. La sélection est conservée entre la 2D et la 3D. Le bouton « Ajouter une étiquette » préremplit aussi son matricule. L’onglet Zones conserve le repérage par atelier ; « Étiqueter dans cette zone » préremplit le site, le département et l’emplacement. La liste et le plan 2D sont utilisables au clavier. La vue 3D propose rotation, zoom, vue du dessus et agrandissement ; le plan 2D reste disponible sans WebGL.

La projection conserve les coordonnées en pourcentage des documents d’origine : aucune migration des étiquettes existantes n’est nécessaire. Les fichiers source se chargent à l’ouverture de « Consulter les plans d’origine ». La création, le suivi, la clôture et la protection contre les versions obsolètes utilisent toujours l’API 5S et le stockage Supabase existants.

Le modèle est dans `lib/five-s-layout.ts`, l’explorateur dans `components/five-s-facility.tsx` et le rendu WebGL dans `components/five-s-facility-scene.tsx`. Contrôles : TypeScript, ESLint ciblé, `node scripts/test-five-s.mjs` et `npm run test:ui`. Les tests d’interface simulent les écritures ; ils ne créent aucune étiquette dans Supabase.

## Audits 5S des machines

Dans « Planifier l’audit », renseigner la date et le responsable ; l’heure est facultative. L’audit apparaît dans le registre et sur la fiche de la machine sélectionnée. Il peut passer de Planifié à En cours, puis Terminé. La grille propose Trier, Ranger, Nettoyer, Standardiser et Maintenir, notés 0 (non conforme), 1 (partiel), 2 (conforme). Le résultat reste indisponible jusqu’à l’évaluation des cinq points. Terminer l’audit exige cinq réponses ; observations et actions restent facultatives.

Les audits sont stockés avec leur historique sous `five_s_audit:<identifiant>` dans le même JSON privé que les étiquettes et sont inclus dans l’export de sauvegarde. L’API `/api/five-s/audits` vérifie la machine, le site et la version ; elle refuse une mise à jour obsolète ou un changement de machine d’un audit existant. Aucune table Supabase supplémentaire n’est nécessaire. La planification enregistre un rendez-vous dans l’application ; elle n’envoie pas de notification ni d’invitation à un calendrier externe.

Contrôles : `node scripts/test-five-s-audits.mjs` et `npm run test:ui`. Les parcours de navigateur utilisent des écritures simulées ; aucun audit de démonstration n’est ajouté aux données de travail.
