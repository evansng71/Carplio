# Sécurité

## Authentification

- Mot de passe haché **Argon2id**  
- Jamais stocké ni renvoyé en clair  
- Invitation : token aléatoire, **hash SHA-256** en base, TTL configurable  
- Sessions : JWT + `UserSession.tokenJti` révocable  
- Anti-énumération : message login unique  

## Autorisation

- Refus par défaut (`PermissionEngine`)  
- Matrice Module×Resource×Action×Scope  
- Interdictions explicites prioritaires  
- Contrôle serveur sur chaque endpoint décoré `@RequirePermission`  
- Masquage UI ≠ sécurité (les APIs refusent aussi)  

## Protections incrément 1

- Dernier super-admin non désactivable  
- Suspension → révocation sessions immédiate  
- Données RH sensibles filtrées sans `hr:sensitive:read`  
- Portail : isolement conversation par `driverUserId`  
- Documents portail : missions publiées du conducteur uniquement  
- Audit : login, accès créé, suspension, changements permissions, view-as  

## RGPD / menaces (à durcir Phase 8)

Chiffrement au repos, MFA obligatoire admins, rétention, anonymisation, sauvegardes testées — documentés comme **à faire**, non déclarés acquis.
