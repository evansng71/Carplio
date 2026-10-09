# Matrice des permissions

Catalogue code : `packages/shared/src/permissions.ts`  
Seed groupes : `apps/api/prisma/seed.ts`

## Règle de calcul

```
autorisé = union(permissions groupes) ∩ périmètre
puis appliquer denied
si super_admin et status=active → autoriser
sinon refus par défaut
```

## Groupes initiaux DEMO

| Groupe | Périmètre typique |
|---|---|
| `super_admin` | Tout |
| `company_admin` | Tout société |
| `direction` | Pilotage lecture/écriture large |
| `dispatcher` | Planning/missions dépôt ; **deny** RH sensible & export factures |
| `sales` | CRM / devis / commandes |
| `hr_manager` | RH + accès portail + sensible |
| `driver` | Self : docs, messages, incidents |
| `mechanic` | Flotte ; deny factures/RH |

## Exemples de refus (testés)

1. Exploitant + `hr:sensitive:read` → refusé (notes masquées)  
2. Affectation dépôt B hors membership → refusé (scope depot)  
3. Conducteur + mission non publiée → absente de `/portal/me/planning`  
4. Session après suspension → 401  

UI Admin → Sécurité → Tester les permissions.
