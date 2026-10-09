# Tests

## Automatiques

```bash
pnpm test
```

| Suite | Couverture |
|---|---|
| `permission.engine.spec.ts` | Refus défaut, deny, scope dépôt, super-admin, compte inactif |
| `auth.integration.spec.ts` | Login, anti-énumération, RH sensible, suspension→401, portail publié seul |

**Résultat incrément 1 : 11/11 passés.**

## Recette manuelle (rôles)

1. Admin : login, matrice, audit  
2. Commercial : créer devis, accepter  
3. Exploitant : affecter, publier, planning 14j, répondre message — **ne voit pas** notes RH sensibles  
4. RH : valider congé, onglet accès  
5. Conducteur mobile : planning sans « NON PUBLIÉ », ack, incident, congé  

Pour chaque cas : préconditions seed DEMO, opérations UI/API, résultat attendu, capture optionnelle dans `docs/`.
