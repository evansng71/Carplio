# Modèle de données — concepts métier

Voir `apps/api/prisma/schema.prisma` pour le schéma Prisma.

## Identités (séparation stricte)

| Entité | Rôle |
|---|---|
| `Employee` | Fiche RH |
| `Driver` | Habilitation conducteur (1–1 Employee) |
| `UserAccount` | Identité de connexion |
| `EmployeeAccountLink` | Lien fiche ↔ compte |
| `Group` / `GroupPermission` | Postes et matrice |
| `AccountInvitation` | Invitation hashée, TTL |

Les données `Employee.sensitiveNotes` ne sont jamais exposées sans `hr:sensitive:read`.

## Chaîne commerciale

`Customer` → `Quote` → `Order` → `Mission` → `Assignment` → `GeneratedDocument`

## Transport théorique

`Location`, `OperatingCalendar`, `Course` + `CourseSegment`, `Service` + `ServiceCourseLink`

## Portail

`PortalReadReceipt`, `DriverServiceEvent`, `MessageThread`/`Message`, `LeaveRequest`, `PlannedRest`, `QualityEvent`

## Statuts compte

`not_created` · `invited` · `invitation_expired` · `active` · `suspended` · `disabled` · `archived`
