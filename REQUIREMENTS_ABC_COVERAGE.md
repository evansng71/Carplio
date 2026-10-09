# Matrice de couverture brochure AbcCar (besoins fonctionnels)

Statuts : `non commencé` · `spécifié` · `implémenté` · `testé` · `validé métier`

> Brochure = liste de besoins. Aucune copie d’interfaces/code ABC.  
> « validé métier » nécessite atelier avec l’entreprise — jamais auto-déclaré ici.

## Page 2 — Gestion commerciale

| Item | Statut | Preuve |
|---|---|---|
| Clients / contacts | implémenté | API `/customers`, UI `/app/customers` |
| Dossier simple | implémenté | `caseType=simple` devis |
| Transfert A/R | spécifié | enum `transfer` — assistant incomplet |
| Répétitif | partiel | seed scolaire + enum |
| Projet complexe | spécifié | enum `complex` |
| Préférences client | implémenté | champs preferred* |
| Relance devis | non commencé | — |
| Acomptes | non commencé | — |
| Suivi devis → billet | implémenté | parcours vertical |
| Estimation moyens | implémenté | `availabilityNote` heuristique |
| Choix conducteur/véhicule | implémenté | affectation mission |
| Planning occasionnel | partiel | planning unifié |
| Billet collectif | implémenté | PDF + snapshot |
| Attestation de repos | non commencé | — |
| Retour billet | implémenté | `ticket-return` API |
| Stats client/activité/commercial | non commencé | — |

## Page 3 — Facturation

| Item | Statut |
|---|---|
| Paramétrage comptable | non commencé |
| Retour billet → facture | spécifié |
| Facturation occasionnelle/répétitive/régulière/autres | non commencé |
| Avoir / facture complémentaire | non commencé |
| Règlement 1 / N factures | non commencé |
| Trop-perçus | non commencé |
| Relance impayés | non commencé |
| Écritures comptables | non commencé |

## Page 4 — Planning Données

| Item | Statut | Preuve |
|---|---|---|
| Fiches conducteurs / véhicules | implémenté | CRUD |
| Calendriers scolaires/réguliers | partiel | calendrier seed + exceptions JSON |
| Courses, opérations, segments | partiel | Course + Segment (pas opérations riches) |
| Lieux / itinéraires | partiel | lieux ; pas bibliothèque itinéraires versionnée |
| Groupages / enchaînements | partiel | ServiceCourseLink |
| Préaffectations | non commencé | — |
| Roulements | non commencé | — |

## Page 5 — Planning Exploitation

| Item | Statut | Preuve |
|---|---|---|
| Absences / indisponibilités | partiel | congés + repos ; pas pose planning véhicule |
| Affecter/désaffecter | implémenté | API planning |
| Jour / semaine / **quatorzaine** | partiel | quatorzaine OK |
| RSE / temps de travail | non commencé | — |
| Documents individuels | partiel | billet PDF |
| Attestations d’activités | non commencé | — |
| Planning général | partiel | Gantt |
| Prises de service chef de parc | non commencé | — |
| Stats conducteur/véhicule/activité | non commencé | — |

## Page 6 — HLP

| Item | Statut |
|---|---|
| Lieux géolocalisés prise/fin | spécifié (lieux existent) |
| Temps annexes / caisse | non commencé |
| Scénarios accords entreprise | non commencé |
| Génération HLP / retours dépôt | non commencé |
| Graphique à plat | non commencé |
| Réhabillage | non commencé |

## Page 7 — Parc / Atelier

| Item | Statut |
|---|---|
| Alertes périodiques/km | non commencé |
| Signalements | non commencé |
| OR multi-sources | non commencé |
| Stocks / BC / BL | non commencé |
| Carburant import/validation | non commencé |
| Stats atelier | non commencé |
| Véhicules + statut immobilisé | partiel (fiche + statut seed) |

## Page 8 — Prépaye

Tous items : **non commencé** (spécifié dans PRODUCT_SPEC / prompt maître).

## Page 9 — Expert / BI

Tous items : **non commencé** (budgets, simulations, rapports AO).

## Page 10 — Qualité / Main courante

| Item | Statut | Preuve |
|---|---|---|
| Taxonomie source/cause/nature/précision/sur-précision | partiel | champs QualityEvent |
| Lien portail | implémenté | incident mobile |
| Lien atelier | non commencé | — |
| Exports Excel / Qualibox… | non commencé | — |
| Stats | non commencé | — |

## Page 11 — Portail conducteur / exploitant

| Item | Statut | Preuve |
|---|---|---|
| Visibilité planning/docs | implémenté | published only |
| Planning vu | implémenté | ack |
| Prise/fin de service | implémenté | service-event |
| Retour billet | partiel | côté admin mission |
| Événement qualité | implémenté | incident |
| Demande atelier | non commencé | — |
| Absence / congé | implémenté | leave request |
| Messages exploitation | implémenté | threads |
| Documents / infos perso | partiel | docs publiés |
| Vue exploitant = vue conducteur | implémenté | as-driver + audit |

## Page 12 — Formation avancée

| Item | Statut |
|---|---|
| Simulations | non commencé |
| Paramétrage prépaye | non commencé |
| Maîtrise opérationnelle produit | spécifié (docs + seed parcours) |

## IAM transversal (priorité V3)

| Item | Statut | Preuve |
|---|---|---|
| Comptes nominatifs | testé | auth tests |
| Invitation depuis fiche conducteur/RH | implémenté | AccessTab + API |
| Groupes & matrice | testé | engine + UI admin |
| Suspension / sessions | testé | integration |
| Dernier super-admin protégé | implémenté | AuthService |
| Voir comme conducteur | implémenté | portal ops |
