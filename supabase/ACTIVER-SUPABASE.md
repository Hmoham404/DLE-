# Sauvegarde Supabase active

## Variante OOE : une seule table JSONB

Pour la demande de stockage JSON dans une base partagee, utiliser `ooe-installation-json.sql`, accompagne de `OOE-JSON.md`. Il prepare uniquement `ooe_myc_workspace` et sa fonction de sauvegarde avec controle de revision. Ce choix evite les huit tables de l'ancien script ci-dessous. Le site actuel reste sur Storage tant qu'un adaptateur et une migration controles n'ont pas ete realises ; executer du SQL seul ne le fait pas basculer.

## Premiere installation SQL dans une base partagee

Le script `MYC-USINE-IA-premiere-installation.sql` prepare huit tables portant toutes le prefixe exact `MYC-USINE-IA_` : machines, production, etiquettes_5s, audits_5s, actions, parametres, historique et sauvegardes. Copier tout le fichier dans SQL Editor puis executer Run. Il a ete verifie dans PostgreSQL local de test, y compris une seconde execution et la conservation d'une table d'un autre projet.

Les documents metier complets sont conserves en JSONB. L'historique des insertions, modifications et suppressions est genere par des triggers. RLS est active et les roles navigateur anon/authenticated n'ont aucun droit ; seul le serveur utilise service_role. Le prefixe organise les objets d'une base partagee : il n'isole pas les donnees des administrateurs ni des autres serveurs possedant une cle service_role de la meme base.

Ce script n'a pas ete execute sur la base distante. Le site utilise toujours le fichier Storage decrit ci-dessous. Creer les tables ne raccorde pas les API, ne copie pas les enregistrements existants et ne programme pas de sauvegardes. Pour basculer vers les tables, adapter les API puis importer et comparer les donnees et historiques avant de modifier la configuration active. Les PDF, modeles Excel et fichiers du projet doivent etre conserves separement.

L’application locale utilise désormais Supabase. Les 382 fiches d’équipement et leurs 398 versions ont été transférées et comparées intégralement à la source locale.

## Emplacement

Dans Supabase, ouvrir Storage puis le bucket privé `myc-smart-factory-private`.

- Espace de données : `myc-json-20261026-7943ca67`.
- Fichier actif : `workspace.json`.
- Format : `workspace-json-v1`.
- Copie initiale distante : sous `backups/`.
- Compte rendu du transfert : `migration.json`.

Le JSON stocké est chiffré. Pour récupérer un JSON lisible comprenant tous les enregistrements et leur historique, utiliser le bouton JSON dans l’espace Saisie.

## Utilisation

Les boutons Enregistrer et Valider enregistrent les saisies dans Supabase. Les modifications des machines, lignes, décisions et du plan utilisent le même stockage. Une erreur de connexion conserve les modifications à l’écran ; elle ne déclenche pas une sauvegarde locale silencieuse.

Les deux codes d’accès existants sont conservés. Le bandeau indique SUPABASE.

## Configuration serveur

Les valeurs actives sont dans `.env.local`, ignoré par Git. Pour déployer plus tard sur Vercel, reprendre les mêmes valeurs en variables serveur :

```text
MYC_STORAGE=supabase
MYC_STORAGE_FORMAT=workspace-json-v1
MYC_STORAGE_NAMESPACE=myc-json-20261026-7943ca67
SUPABASE_URL=https://ztabtbqtscjfvrautczj.supabase.co
SUPABASE_SECRET_KEY
ENTRY_ACCESS_CODE
MEETING_ACCESS_CODE
SESSION_SECRET
DATA_ENCRYPTION_KEY
```

Conserver la même DATA_ENCRYPTION_KEY pour relire les données. Garder une copie privée de la configuration serveur. Aucune de ces clés ne doit être ajoutée dans le code du navigateur.

## Copies locales

`.local-data/factory.json` et `.local-data/backups/` conservent les données d’avant le transfert. Le fichier local n’est plus la source active.

Le compte rendu du transfert est également conservé dans `.local-data/supabase-migration.json`. Aucun déploiement Vercel ou Sites n’a été effectué lors de cette connexion.
