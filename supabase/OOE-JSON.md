# Installation OOE avec un document JSON

Copier tout `ooe-installation-json.sql` dans Supabase > SQL Editor > New query, puis Run. Ce fichier remplace, pour une nouvelle installation OOE, le choix de creer huit tables MYC. Il ne supprime pas d'anciennes tables et peut etre rejoue sans vider les donnees.

Une seule table `public.ooe_myc_workspace` contient une seule ligne, identifiee par `myc-smart-factory`. La colonne `donnees` contient un objet JSONB avec une cle `records`. Machines, produits, production, actions, parametres, etiquettes et audits 5S y partagent le meme format de document que le projet actuel. Chaque enregistrement garde ses propres valeurs, sa date de version, son historique et, le cas echeant, sa suppression logique.

Le prefixe `ooe_myc_` concerne aussi la fonction d'enregistrement. Le script ne cree aucun index JSON general, aucune table par module et aucune copie complete automatique a chaque modification. Le JSON utilise de l'espace ; conserver moins de tables ne garantit pas une reduction du volume. L'historique continuera de grandir avec les modifications. Les copies de sauvegarde doivent rester externes a cette table. PDF, images et modeles Excel n'ont pas vocation a etre inseres en base64 dans ce JSON.

RLS est active. Les roles `anon` et `authenticated` ne peuvent ni lire ni ecrire la table ou executer la fonction. Le serveur disposant de `service_role` peut lire le document et appeler `ooe_myc_sauvegarder` avec la revision lue. Une revision obsolete est refusee, sans ecraser une sauvegarde concurrente. Le prefixe evite les collisions de noms ; il ne limite pas les droits d'un autre serveur possedant la cle `service_role` de cette meme base.

## Etat du site actuel

Le site reste branche sur le fichier chiffre `workspace.json` dans le bucket prive `myc-smart-factory-private`. Aucun script SQL OOE n'a ete execute sur la base distante et aucun enregistrement n'a ete deplace. Executer ce script cree une table vide : cela ne raccorde pas automatiquement les API et n'y copie pas les 12 references ou les enregistrements existants.

Un passage a cette table demande un adaptateur serveur pour lire la ligne et appeler la fonction, puis un import et une comparaison de tous les enregistrements et historiques avant bascule. Ne pas changer `MYC_STORAGE_FORMAT` ou effacer le fichier Storage actuel simplement apres avoir execute le SQL. L'export lisible du bouton JSON fournit les enregistrements a reprendre ; il faut importer son objet `records` et non ajouter l'enveloppe chiffree Storage comme donnees metier.

Le format attendu pour une installation vide est `{"records":{}}`. Le script ne contient ni mots de passe ni cles API.
