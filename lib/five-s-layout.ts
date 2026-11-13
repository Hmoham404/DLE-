import type {FiveSTag} from './five-s';

export type PlanId=FiveSTag['plan_id'];
export type PlanPoint={x:number;y:number};
export type PlanRect=PlanPoint&{w:number;h:number};
export type FacilityZone={
 id:string;name:string;short:string;department:FiveSTag['department'];
 category:'production'|'stockage'|'support'|'commun';rect:PlanRect;
 description:string;focus:string;furniture?:'presses'|'racks'|'benches'|'line';
};
export type FacilityLayout={id:PlanId;name:string;bounds:PlanRect;zones:FacilityZone[];aisles:PlanRect[]};
// Coordinates refer to the entire original 3000 × 2121 plan, including its margins.
// This preserves existing 5S positions. Footprints are visually traced, never metric surveys.
const zone=(id:string,name:string,short:string,department:FacilityZone['department'],category:FacilityZone['category'],rect:PlanRect,description:string,focus:string,furniture?:FacilityZone['furniture']):FacilityZone=>({id,name,short,department,category,rect,description,focus,furniture});
export const facilityLayouts:Record<PlanId,FacilityLayout>={
 injection:{id:'injection',name:'Site injection',bounds:{x:13.4,y:27.2,w:73.8,h:48.4},zones:[
  zone('inj-atelier','Atelier d’injection plastique','Injection','injection','production',{x:28.6,y:32.3,w:44.3,h:22.2},'Atelier central du plan. Les presses cliquables sont liées à l’inventaire ; leur disposition reste schématique.','Dégager les abords des presses et identifier les outils de chaque poste.','presses'),
  zone('inj-moules','Stockage du support de moule','Moules','injection','stockage',{x:20,y:30.5,w:6.5,h:24.1},'Rayonnages à gauche de l’atelier, avec tables d’ajusteur en partie basse.','Identifier les emplacements et séparer les supports utiles des supports à examiner.','racks'),
  zone('inj-mat-nord','Salle 2 pour additionner les matériaux','Matières · nord','injection','support',{x:30.6,y:28.2,w:40.5,h:3.8},'Bande supérieure de l’atelier, identifiée « Salle 2 » sur le document.','Identifier les matières et maintenir les passages libres.'),
  zone('inj-mat-sud','Salle 1 pour additionner les matériaux','Matières · sud','injection','support',{x:30.6,y:54.8,w:40.5,h:3.8},'Bande inférieure de l’atelier, identifiée « Salle 1 » sur le document.','Ranger les contenants et identifier les matières en cours.'),
  zone('inj-usinage','Atelier d’usinage','Usinage','injection','support',{x:18.6,y:59.4,w:8,h:14.9},'Zone de découpe de fil, CNC et machines d’usinage, en bas à gauche.','Ranger les outils, les gabarits et les pièces en attente.','benches'),
  zone('inj-preparation','Préparation M.P. pour production','Préparation M.P.','injection','production',{x:29.6,y:59.4,w:6.7,h:7.3},'Préparation des matières premières à côté du dépôt.','Identifier les lots et retirer les contenants vides.','benches'),
  zone('inj-broyage','Salle de concassage et de mélange','Broyage','injection','support',{x:29.6,y:67.3,w:6.7,h:7},'Salle de broyage sous la préparation des matières premières.','Séparer les matières, nettoyer et ranger les accessoires.','benches'),
  zone('inj-depot','Dépôt matières brutes','Matières brutes','injection','stockage',{x:36.7,y:59.4,w:30.8,h:14.9},'Grand dépôt de rayonnages dans la partie basse du plan.','Identifier les travées, les lots et le surstock.','racks'),
  zone('inj-quai','Plateforme de déchargement des matériaux','Déchargement','commun','stockage',{x:67.9,y:59.4,w:9,h:14.9},'Plateforme à droite du dépôt des matières brutes.','Dégager les flux et délimiter le matériel en attente.'),
  zone('inj-maintenance','Bureau mécanicien','Maintenance','commun','support',{x:13.8,y:44.9,w:4.5,h:7.5},'Bureau mécanicien à gauche des rayonnages de moules.','Ranger les outils et identifier les pièces de rechange.','benches'),
  zone('inj-chef','Bureau chef atelier','Chef atelier','commun','commun',{x:13.8,y:35.8,w:4.5,h:8.7},'Bureau à gauche de l’atelier, au-dessus du bureau mécanicien.','Retirer les documents et objets obsolètes.'),
  zone('inj-qualite','Salle d’inspection de la qualité','Inspection','commun','support',{x:77.3,y:28.2,w:4.1,h:4.7},'Salle de contrôle dans l’angle supérieur droit de l’atelier.','Identifier les moyens de contrôle et isoler les non-conformes.'),
  zone('inj-labo','Laboratoire','Laboratoire','commun','support',{x:77.3,y:36.1,w:4.1,h:6.5},'Laboratoire dans le bloc de locaux à droite de l’atelier.','Définir une place pour les échantillons et instruments.','benches'),
  zone('inj-bureau','Bureau production','Production · bureau','commun','commun',{x:77.3,y:43,w:4.1,h:6.6},'Bureau production sous le laboratoire.','Classer et actualiser les documents de production.'),
  zone('inj-accueil','Hall d’accueil','Accueil','commun','commun',{x:77.4,y:52.8,w:8.6,h:7.3},'Hall d’accueil en bas du bloc administratif.','Maintenir l’accueil et les accès dégagés.'),
 ],aisles:[{x:27,y:42.3,w:47.4,h:2},{x:27,y:30,w:47.4,h:2},{x:27,y:54.7,w:47.4,h:2},{x:27,y:31.5,w:1.5,h:24},{x:49.8,y:31.5,w:1.4,h:24},{x:73,y:31.5,w:1.5,h:28}]},
 metalisation:{id:'metalisation',name:'Site métallisation',bounds:{x:27.5,y:21.5,w:61.2,h:73.8},zones:[
  zone('met-finis','Dépôt de stockage produits finis','Produits finis','commun','stockage',{x:28.1,y:35.7,w:18.5,h:21.6},'Grand dépôt à gauche, dans la moitié supérieure du bâtiment.','Identifier les palettes et séparer les produits en attente.','racks'),
  zone('met-semis','Dépôt de stockage produits semi-finis','Semi-finis','commun','stockage',{x:28.1,y:57.7,w:18.5,h:10.5},'Dépôt sous le stockage des produits finis.','Identifier les lots et les zones d’attente.','racks'),
  zone('met-reserve','Emplacement des machines automatisées','Zone réservée','assemblage','production',{x:49.4,y:45.2,w:5.8,h:20.7},'Zone explicitement réservée aux machines automatisées sur le document.','Éviter le stockage non affecté dans la zone réservée.'),
  zone('met-assemblage','Atelier d’assemblage','Assemblage','assemblage','production',{x:56.5,y:45.2,w:12.6,h:22.7},'Atelier central avec postes et allées longitudinales.','Définir les emplacements des outils et les encours.','benches'),
  zone('met-impression','Salle d’impression','Impression','serigraphie','production',{x:75.9,y:43.5,w:11.9,h:24.4},'Salle à droite du bâtiment, au-dessus des lignes de pulvérisation.','Ranger les outillages et séparer les encours par référence.','line'),
  zone('met-controle-assemblage','Contrôle des produits finis assemblés','Contrôle assemblé','assemblage','support',{x:57.8,y:37,w:11.2,h:6.4},'Salle de contrôle au-dessus de l’atelier d’assemblage.','Séparer les pièces contrôlées des pièces en attente.','benches'),
  zone('met-controle-impression','Contrôle des produits finis imprimés','Contrôle imprimé','serigraphie','support',{x:69.3,y:37,w:6.3,h:6.4},'Salle voisine du contrôle des produits assemblés.','Identifier les échantillons et les critères de contrôle.'),
  zone('met-pulverisation-1','Salle de pulvérisation 1','Pulvérisation 1','metalisation','production',{x:28.1,y:77.2,w:15.6,h:13.3},'Première salle de pulvérisation, en bas à gauche.','Retirer les accessoires inutiles et ranger l’outillage.','line'),
  zone('met-chargement-1','Chargement / déchargement 1','Chargement 1','metalisation','support',{x:31.1,y:71.7,w:12.7,h:5.3},'Zone de chargement au-dessus de la salle de pulvérisation 1.','Délimiter les supports et les encours.'),
  zone('met-chargement-2','Chargement / déchargement 2','Chargement 2','metalisation','support',{x:47.6,y:77.2,w:8.2,h:13.3},'Deuxième zone de chargement, entre les salles de pulvérisation.','Séparer les flux entrants et sortants.'),
  zone('met-pulverisation-2','Salle de pulvérisation 2','Pulvérisation 2','metalisation','production',{x:56.2,y:73.2,w:17.8,h:17.3},'Grande salle de pulvérisation au centre de la partie basse.','Identifier les outillages et maintenir les abords dégagés.','line'),
  zone('met-pulverisation-3','Salle de pulvérisation 3','Pulvérisation 3','metalisation','production',{x:74.4,y:73.2,w:7.4,h:17.3},'Troisième salle de pulvérisation à droite.','Ranger les supports et les équipements de nettoyage.','line'),
  zone('met-preparation','Zone de préparation','Préparation','metalisation','support',{x:82.1,y:73.2,w:5.7,h:17.3},'Zone en bord droit des salles de pulvérisation.','Identifier les contenants et les emplacements dédiés.'),
  zone('met-chimique','Local de stockage produits chimiques','Stockage chimique','metalisation','stockage',{x:43.5,y:91,w:12.3,h:3.7},'Local technique en bas du plan.','Vérifier le rangement et l’identification des contenants.'),
  zone('met-compresseurs','Local compresseurs','Compresseurs','commun','support',{x:58.2,y:91,w:21.2,h:3.7},'Bande technique au-dessous des salles de pulvérisation.','Dégager les accès de maintenance.'),
  zone('met-accueil','Accueil et hall d’entrée','Accueil','commun','commun',{x:51.6,y:22.1,w:12.4,h:7.2},'Entrée principale au centre du bloc supérieur.','Maintenir les accès et l’accueil dégagés.'),
  zone('met-labo','Laboratoire','Laboratoire','commun','support',{x:41.1,y:27.5,w:5.3,h:5.2},'Laboratoire à gauche du hall d’entrée.','Ranger et identifier les échantillons.','benches'),
  zone('met-refectoire','Réfectoire','Réfectoire','commun','commun',{x:64.5,y:27.5,w:5.4,h:5.2},'Réfectoire à droite du hall d’entrée.','Définir les emplacements et maintenir la propreté.'),
 ],aisles:[{x:29.1,y:34.3,w:58.3,h:1.2},{x:28.2,y:69.2,w:59.7,h:1.2},{x:47.1,y:35,w:1.2,h:34.5},{x:49.2,y:43.6,w:29.8,h:1.1},{x:56.2,y:66.7,w:31.3,h:1.2},{x:28.2,y:89.9,w:59.6,h:1.1}]},
};
export const zoneColors={production:'#67b3a0',stockage:'#be9a58',support:'#7699b5',commun:'#9b9fa9'};
export const zoneCategories={production:'Production',stockage:'Stockage',support:'Support',commun:'Espaces communs'};
export const tagColors={rouge:'#f06c67',jaune:'#ebc45a',vert:'#73d5a5',bleu:'#77b9ef'};
export const zoneCenter=(zone:FacilityZone):PlanPoint=>({x:zone.rect.x+zone.rect.w/2,y:zone.rect.y+zone.rect.h/2});
export const contains=(rect:PlanRect,point:PlanPoint)=>point.x>=rect.x&&point.x<=rect.x+rect.w&&point.y>=rect.y&&point.y<=rect.y+rect.h;
export function zoneAt(plan:PlanId,point:PlanPoint|null){return point?facilityLayouts[plan].zones.find(zone=>contains(zone.rect,point)):undefined;}
// Uniform scaling preserves the source plan's aspect ratio; units are schematic.
export function planToWorld(plan:PlanId,point:PlanPoint):[number,number,number]{const b=facilityLayouts[plan].bounds;return [(point.x-b.x-b.w/2)*.5,0,(point.y-b.y-b.h/2)*.3535];}
export function worldToPlan(plan:PlanId,x:number,z:number):PlanPoint{const b=facilityLayouts[plan].bounds;return {x:x/.5+b.x+b.w/2,y:z/.3535+b.y+b.h/2};}
export function tagsInZone(tags:FiveSTag[],plan:PlanId,zone:FacilityZone){return tags.filter(tag=>tag.plan_id===plan&&zoneAt(plan,tag.position)?.id===zone.id);}
export function tagForZone(zone:FacilityZone,plan:PlanId,tag:FiveSTag):FiveSTag{return {...tag,plan_id:plan,position:zoneCenter(zone),...(tag.kind==='zone'?{location:zone.name,department:zone.department}:{} )};}
