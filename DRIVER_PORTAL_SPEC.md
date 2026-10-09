# Portail conducteur — spécification écrans

URL : `/conducteur` · PWA installable (`manifest.webmanifest`)

## Auth

Connexion nominative (même `UserAccount` que le back-office), liée via `EmployeeAccountLink`.

## Onglets

| Onglet | Contenu |
|---|---|
| Aujourd’hui | Prochain service publié, ack « vu », prise/fin service, incident |
| Planning | 14 jours publiés + repos + congés (distincts) |
| Messages | Threads conducteur ↔ exploitation |
| Docs | Documents des missions publiées |
| Espace | Demande congé, déconnexion |

## Règles

- Non publié = invisible  
- Pas d’accès aux conversations des collègues  
- Événements historisés (`PortalReadReceipt`, `DriverServiceEvent`)  
- Rappel : ne pas utiliser en conduisant  

## Côté exploitation

`/app/portal-ops` : messages, congés, incidents, accusés, prévisualisation « voir comme » (auditée).
