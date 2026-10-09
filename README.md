# AUTOCAR OS

ERP de transport de voyageurs (occasionnel, scolaire, régulier, tourisme) — incrément 1 opérationnel.

Société de démonstration : **Autocars Horizon SAS** (données clairement marquées DEMO).

## Prérequis

- Node.js ≥ 20
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

PostgreSQL via Docker est prévu (`docker-compose.yml`). **En local sans Docker**, l’API utilise **SQLite** (`apps/api/prisma/dev.db`) pour démarrer immédiatement. Le schéma reste multi-tenant et prêt pour PostgreSQL.

## Démarrage rapide

```bash
pnpm install
pnpm --filter @autocar/shared build
pnpm db:generate
pnpm db:reset          # crée la DB + seed DEMO
pnpm dev               # API :4000 + Web :3100
```

- Back-office : http://localhost:3100/login  
- Portail conducteur (PWA) : http://localhost:3100/conducteur  
- Portail client : http://localhost:3100/client  
- API : http://localhost:4000/api  
> Le front utilise le port **3100** pour coexister avec d’autres projets sur `:3000`.

## Hébergement Infomaniak

Compatible Node.js Managed : l’API et le front lisent `PORT`. Postgres + variables : voir `DEPLOY_INFOMANIAK.md`.

## Comptes DEMO

Mot de passe unique : `Demo-Autocar-OS-2026!`

| Email | Rôle |
|---|---|
| `admin@horizon-demo.fr` | Super-administrateur |
| `exploitant@horizon-demo.fr` | Exploitant (dépôt Lyon) |
| `rh@horizon-demo.fr` | Responsable RH |
| `commercial@horizon-demo.fr` | Commercial |
| `conducteur@horizon-demo.fr` | Conducteur (portail) |

## Commandes utiles

```bash
pnpm test              # tests API (IAM)
pnpm db:reset          # réinitialise le jeu DEMO
pnpm --filter @autocar/api build
pnpm --filter @autocar/web build
```

## Parcours à tester

1. **Commercial** : Clients → Devis → Accepter → Mission → Affecter & publier → PDF  
2. **Planning / Habillage** : `/app/planning`, `/app/dressing`, `/app/rosters`  
3. **Facturation** : `/app/billing`  
4. **Prépaye** : `/app/prep-payroll` → Calculer → Export mois  
5. **Atelier** : `/app/workshop` → OR, stocks, carburant  
6. **Qualité / BI** : `/app/quality`, `/app/analytics`  
7. **MFA** : `/app/security` puis reconnexion avec code  
8. **Portail client** : `/client` → demande → `/app/client-requests` → Convertir  
9. **Portail conducteur** : `/conducteur`

## Documentation

Voir `ARCHITECTURE.md`, `DATA_MODEL.md`, `PRODUCT_SPEC.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`, `PERMISSIONS_MATRIX.md`, `DRIVER_PORTAL_SPEC.md`, `REQUIREMENTS_ABC_COVERAGE.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `TESTING.md`, `LEGAL_VALIDATION.md`, `INTEGRATIONS.md`.

Logiciel original — **ne copie ni code, ni interfaces, ni éléments protégés d’ABC Informatique**. La brochure « AbcCar – Les Formations » sert uniquement de liste de besoins fonctionnels.
