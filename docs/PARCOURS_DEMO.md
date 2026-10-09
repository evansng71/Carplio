# Parcours DEMO testés

## 1. Chaîne commerciale

1. Login `commercial@horizon-demo.fr`  
2. `/app/quotes` — créer un devis avec date  
3. Accepter → commande + mission créées  
4. `/app/missions/:id` — affecter conducteur/véhicule & publier  
5. Générer billet collectif PDF (`generated-pdfs/`)  

## 2. Accès depuis fiche conducteur

1. Login `rh@horizon-demo.fr` ou admin  
2. `/app/drivers` → Sophie Bernard (sans compte)  
3. Onglet Accès → Créer un accès → token invitation  
4. `/activate?token=…` — mot de passe choisi par l’utilisateur  
5. Suspendre → sessions refusées  

## 3. Portail mobile

1. `/conducteur` — `conducteur@horizon-demo.fr`  
2. Planning : services publiés visibles ; « Occasionnel NON PUBLIÉ » absent  
3. Repos affiché séparément des congés  
4. Message + incident + demande congé  
5. `/app/portal-ops` — répondre / valider  

## 4. Permissions

1. Admin → Sécurité → Tester `exploitant` + `hr:sensitive:read` → REFUSÉ  
2. Exploitant ouvre fiche salarié C-1001 → `sensitiveNotes` masquées  
