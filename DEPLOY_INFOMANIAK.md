# Déployer AUTOCAR OS sur Infomaniak (+ mises à jour)

AUTOCAR OS = **2 apps Node** (API Nest + Web Next) + **base Postgres**.  
L’hébergement web **PHP classique** Infomaniak ne suffit pas.

## Ce qu’il te faut chez Infomaniak

1. **Hébergement Node.js** (ou Cloud / VPS qui permet Node ≥ 20) — **2 applications** recommandées :
   - `api` → sous-domaine `api.tondomaine.fr`
   - `web` → `app.tondomaine.fr` (ou le domaine principal)
2. **Base PostgreSQL** Infomaniak (créer une DB + user + mot de passe).
3. Un **dépôt Git** (GitHub / GitLab / Infomaniak Git) pour pouvoir mettre à jour facilement.

> En local on utilise SQLite. En prod Infomaniak : **Postgres uniquement**.

---

## Étape A — Préparer le code (une fois)

### 1. Mettre le projet sur Git

Sur ta machine :

```bash
cd "/Users/evansangoy/Desktop/LOGICIEL CAR V2"
git remote add origin https://github.com/TON_COMPTE/autocar-os.git   # ou GitLab / Infomaniak
git push -u origin main
```

À chaque modification faite avec Cursor, on commit + `git push` → puis on redéploie (Étape C).

### 2. Passer Prisma en PostgreSQL pour la prod

Dans `apps/api/prisma/schema.prisma` (version déployée / branche prod) :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Garder SQLite seulement en local (branche `main` locale ou fichier `.env` local).  
Sur Infomaniak, `DATABASE_URL` pointera vers Postgres.

---

## Étape B — Premier déploiement Infomaniak

### B1. Créer Postgres

Manager Infomaniak → **Bases de données** → PostgreSQL → noter :

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
```

(adapter selon l’écran Infomaniak : host, port, SSL).

### B2. Application API

Créer une app Node.js, dossier racine idéalement le monorepo ou `apps/api`.

**Variables d’environnement API :**

| Variable | Valeur |
|---|---|
| `PORT` | *laissé à Infomaniak* (ne pas forcer) |
| `DATABASE_URL` | URL Postgres ci-dessus |
| `JWT_SECRET` | longue chaîne aléatoire (ex. 48+ caractères) |
| `WEB_ORIGIN` | `https://app.tondomaine.fr` |
| `JWT_EXPIRES_IN` | `8h` |
| `NODE_ENV` | `production` |

**Commandes build / start** (selon l’UI Infomaniak) :

```bash
# Build
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @autocar/shared build
pnpm --filter @autocar/api exec prisma generate
pnpm --filter @autocar/api exec prisma db push
pnpm --filter @autocar/api build

# Start
pnpm --filter @autocar/api start
# (= node apps/api/dist/main.js qui lit process.env.PORT)
```

Premier seed DEMO (optionnel, seulement pour tests) :

```bash
pnpm --filter @autocar/api db:seed
```

Puis **désactive / change** les mots de passe DEMO avant usage réel.

### B3. Application Web

Deuxième app Node.js, même dépôt Git.

**Variables Web :**

| Variable | Valeur |
|---|---|
| `PORT` | *Infomaniak* |
| `NEXT_PUBLIC_API_URL` | `https://api.tondomaine.fr/api` |
| `API_PROXY_TARGET` | `https://api.tondomaine.fr` *(si tu gardes le rewrite Next)* |
| `NODE_ENV` | `production` |

```bash
# Build
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @autocar/web build

# Start
pnpm --filter @autocar/web start
```

### B4. DNS / domaines

- `api.tondomaine.fr` → app API  
- `app.tondomaine.fr` → app Web  
HTTPS activé (Let’s Encrypt Infomaniak).

Test : ouvrir `https://app.tondomaine.fr/login`.

---

## Étape C — Workflow « je demande des modifs → ça se met à jour »

C’est le flux recommandé :

```
Toi → Cursor (modifs) → git commit + push → Infomaniak redéploie
```

### Option 1 — Déploiement Git (idéal)

Dans chaque app Infomaniak Node :

1. Brancher le dépôt Git (`main` ou `production`)
2. Activer **déploiement automatique** au push (si proposé)
3. Sinon : bouton **Redéployer** après chaque push

Après une session Cursor :

```bash
git add -A
git commit -m "feat: description courte"
git push
```

Puis sur Infomaniak : **Redeploy** (API + Web si les deux ont changé).

### Option 2 — SSH / console (manuel)

```bash
cd ~/autocar-os   # chemin Infomaniak
git pull
pnpm install
pnpm --filter @autocar/shared build
pnpm --filter @autocar/api exec prisma generate
pnpm --filter @autocar/api exec prisma db push   # si schéma modifié
pnpm --filter @autocar/api build
pnpm --filter @autocar/web build
# redémarrer les 2 apps dans le Manager
```

### Qui fait quoi

| Action | Qui |
|---|---|
| Demander une évolution | Toi (dans Cursor) |
| Modifier le code | Cursor / agent |
| Commit + push Git | Toi (ou demander « commit et push ») |
| Rebuild Infomaniak | Auto Git **ou** bouton Redeploy |

---

## Déploiement mono-app (carplio.evansng.fr)

Si une seule app Node écoute sur `PORT` avec reverse-proxy interne :

| Champ Infomaniak | Commande |
|---|---|
| **Build** | `npm run build:hosting` |
| **Start** | `npm run start:hosting` |

**Important** : Infomaniak redémarre le Start ~toutes les 45 s. Il ne faut **pas** compiler dans Start.  
Procédure première mise en ligne :

1. **Arrêter** le site  
2. Lancer **uniquement le Build** (`npm run build:hosting`) et attendre la fin complète  
3. Puis **Start** (`npm run start:hosting`)

---

## Pièges fréquents

1. **Hébergement PHP seul** → Node ne tourne pas. Il faut l’offre Node/Cloud.
2. **SQLite en prod** → fichiers éphémères / pertes de données. Utiliser Postgres.
3. **`NEXT_PUBLIC_API_URL`** doit être l’URL **publique** HTTPS de l’API (pas `localhost`).
4. **CORS** : `WEB_ORIGIN` = URL exacte du front (`https://app…` sans slash final).
5. **Deux apps** : après un push, redéployer **API et Web** si les deux ont bougé.
6. Ne jamais committer `.env` / secrets.

---

## Checklist première mise en ligne

- [ ] Offre Node.js (×2) + Postgres créés  
- [ ] Dépôt Git distant configuré  
- [ ] Prisma `postgresql` + `DATABASE_URL`  
- [ ] Variables API + Web renseignées  
- [ ] Build OK, apps « Running »  
- [ ] Login test sur `https://app…/login`  
- [ ] Backups Postgres activés  
- [ ] Comptes DEMO changés ou désactivés  

---

## Ensuite avec Cursor

Exemple de message après le premier déploiement :

> « Branche `main` poussée sur GitHub, apps Infomaniak branchées. Ajoute telle fonctionnalité puis commit + push pour que je redéploie. »

Je modifierai le code localement ; toi (ou moi sur demande) `git push` ; Infomaniak reconstruit.
