# Statut projet — honnête

## Phases 1–8 — socle opérationnel

### Phase 1 — OK
Auth, permissions, CRM, devis→commande→mission→PDF, dashboard, portail minimal.

### Phase 2 — OK et cliquable
- `/app/transport` : lieux, calendriers, courses, services, itinéraires  
- `/app/rosters` : roulements, appliquer 7j, préaffectations  
- `/app/planning` : jour / semaine / quatorzaine, publier, remplacement  
- `/app/unavailabilities` : absences / immobilisations  

### Phase 3 — OK et cliquable
- `/app/dressing` : scénarios, HLP, graphique à plat, verrouillage  
- Portail : retour billet `/portal/me/ticket-return`  

### Phase 4 — OK
- `/app/billing` : facture, complémentaire, avoir, paiement ventilé, trop-perçu  

### Phase 5 — OK
- `/app/prep-payroll` : règles, calcul planning/habillage, jour→semaine→mois, compteurs, export  

### Phase 6 — OK
- `/app/workshop` : alertes, réparations, OR, stocks, BC, carburant  

### Phase 7 — OK
- `/app/quality` : classification source→nature→précision, incidents, stats  
- `/app/analytics` : overview BI, budgets, comparaison, simulations  

### Phase 8 — OK (socle)
- `/app/security` : MFA TOTP setup/enable/disable  
- `/client` : demande devis publique → `/app/client-requests` conversion  
- API/Web respectent `PORT` (Infomaniak) — voir `DEPLOY_INFOMANIAK.md`  

## Non livré (connecteurs / avancé)
Studio PDF WYSIWYG, Chorus Pro, SMTP réel, tachygraphe, PSP — volontairement hors incrément.

## Accès
http://localhost:3100/login — `admin@horizon-demo.fr` / `Demo-Autocar-OS-2026!`  
Portails : `/conducteur` · `/client`
