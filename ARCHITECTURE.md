# Architecture — AUTOCAR OS

## Style

**Monolithe modulaire** (pas de microservices prématurés).

```
apps/api          NestJS + Prisma — domaines métier
apps/web          Next.js App Router — back-office + PWA /conducteur
packages/shared   Catalogue permissions, constantes
```

## Domaines API (incrément 1)

| Module | Responsabilité |
|---|---|
| `iam` | Auth Argon2id, sessions JWT révocables, invitations, PermissionEngine |
| `org` | Société, dépôts |
| `crm` | Clients, contacts |
| `hr` | Salariés, conducteurs, congés, onglet accès |
| `fleet` | Véhicules |
| `transport` | Lieux, calendriers, courses/segments, services |
| `planning` | Affectations, quatorzaine, collisions, publication |
| `commercial` | Devis → commande → mission, estimation dispo |
| `documents` | PDF billet collectif + snapshot |
| `portal` | API mobile conducteur + centre exploitant |
| `dashboard` | Widgets agrégés DB |

## AuthZ

Modèle `Module × Resource × Action × Scope` :

1. Refus par défaut  
2. Union des permissions des groupes dans le périmètre  
3. Interdictions explicites prioritaires  
4. Super-admin court-circuite (sauf compte non actif)  
5. Réévaluation à chaque requête (JWT + session DB)

## Persistance

- Dev local : SQLite (`file:./dev.db`)  
- Prod cible : PostgreSQL (`docker-compose.yml`)  
- Multi-tenant : `companyId` sur les entités métier  
- Fichiers PDF : `apps/api/generated-pdfs/`

## Front

- Design system tokens (nuit / crème / action)  
- Shell sidebar + recherche  
- Portail `/conducteur` mobile-first + manifest PWA
