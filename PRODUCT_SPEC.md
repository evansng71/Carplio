# Spécification produit — Incrément 1

## Décisions provisoires (à confirmer en atelier)

1. Identifiant = email pro, unicité par société  
2. Estimation de disponibilité = théorique, jamais réservation  
3. Retour de billet collectif = workflow `ticketReturnedAt` + notes + passagers réels (détail métier à valider avec l’entreprise)  
4. MFA : flag prêt, enforcement admin plus tard  
5. Mentions légales PDF : modèle v1 DEMO — validation expert requise avant production  

## Parcours livrés

### P-commercial (vertical)

Client → devis (+ dispo) → acceptation → commande + mission → affectation/publication → PDF billet → retour billet

### P-accès (2 BIS)

Fiche conducteur → onglet Accès → créer accès + invitation → activation mot de passe utilisateur → connexion → suspension révoque sessions

### P-portail

Conducteur voit uniquement affectations `published=true` ; repos ≠ congés ; message / incident / congé ; exploitant répond et valide

## Hors scope assumé (incrément 1)

HLP/habillage complet, prépaye experte, studio PDF WYSIWYG, atelier/stocks, BI/budgets, Chorus Pro, connecteurs tachy/carburant, portail client.
