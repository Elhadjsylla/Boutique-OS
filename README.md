# BoutikOS 🏪

PWA offline-first de gestion de boutique (Caisse, Stock, Ardoise) pour commerçants d'Afrique de l'Ouest.

---

## 📌 Context Pack (À copier/coller en tête de vos sessions Antigravity)

```text
[CONTEXT PACK — BoutikOS]

Projet : BoutikOS, PWA offline-first de gestion de boutique (Caisse, Stock, Ardoise) pour commerçants d'Afrique de l'Ouest. Interface FR uniquement. Cible : Android bas de gamme (2 Go RAM), souvent hors-ligne, utilisateurs à faible littératie numérique.

Stack : React 18 + Vite + Tailwind CSS ; React Query (server state) + Zustand (UI state local) ; Dexie.js (IndexedDB) pour l'offline ; Supabase (Auth, Postgres, RLS, Realtime) ; Zod (validation) ; Vercel (hosting) ; PWA Workbox.

RÈGLE D'OR sécurité : toute restriction d'accès vit dans les RLS Supabase, jamais dans le code React.

Offline-first : écrire d'abord en IndexedDB (optimistic), sync en arrière-plan. Conflits = last-write-wins sur timestamp SERVEUR (jamais client). UUID généré côté client pour chaque entité.

UX : max 2 taps par action critique ; icônes + couleurs avant le texte ; montants en FCFA avec séparateur de milliers et tabular-nums ; cibles tactiles >= 48px.

Design tokens (Stitch) :
  Polices : DM Sans (titres, données chiffrées) · Inter (corps, labels UI)
  Couleurs : primary #1A3C5E · secondary (succès/CTA) #27AE60 · tertiary-container (alerte) #E69200 · error #BA1A1A · fond #F5F7FA · carte #FFFFFF · texte #1A1A2E · texte-2 #43474E · bordure #E5E7EB
  Radius : boutons 10px · cartes 16px · badges pill (999px)
  Spacing base-4 : xs 4px · sm 8px · md 16px · lg 24px · xl 32px · gutter mobile 16px
  Élévation : Level 0 fond #F5F7FA · Level 1 carte blanche bordure 1px #E5E7EB · Level 2 shadow (0px 4px 12px rgba(26,60,94,0.08)) · Level 3 modales shadow (0px 8px 24px rgba(0,0,0,0.12))
  CTA height min 48px · champs height 48px

Rôles : caissier (Caisse) · gérant (Caisse+Stock+Ardoise+Dashboard) · super_admin (tout + multi-boutiques).

Schéma DB : boutiques(id,nom,adresse,gerant_id,created_at) · profils(id=auth.uid,role,boutique_id) · produits(id,boutique_id,nom,prix,quantite,seuil_alerte,archive) · ventes(id,boutique_id,caissier_id,total,created_at) · vente_items(id,vente_id,produit_id,quantite,prix_unitaire) · ardoises(id,boutique_id,client_nom,montant_total,statut,created_at) · ardoise_paiements(id,ardoise_id,montant,paid_at).

Conventions code : composants fonctionnels + hooks · TypeScript strict, pas de any · fichiers <= 200 lignes · nommage métier FR · commits type(scope): message.
```

---

## 👥 Répartition de l'Équipe & Rôles
- **Drix (Dev A - Lead)** : Fondations UI + cœur offline + écrans à forte complexité.
- **Le Big EL (Dev B - Backend)** : Données + sécurité + auth + stock.
- **Taph la hagra (Dev C - Compute limité)** : Module Ardoise + QA + onboarding.

---

## 🛠️ Ordre d'Exécution & Sprints

| Sprint | Drix (Dev A) | Le Big EL (Dev B) | Taph la hagra (Dev C) |
|---|---|---|---|
| **S0** | Setup repo + branches | Setup projet Supabase | Setup workspace Antigravity dédié |
| **S1** | A1 Design system | B1 Schéma + B2 RLS | Lecture docs · C2 plan QA |
| **S2** | A2 Couche offline/sync | B3 Auth | Scaffolding Ardoise (lecture code A2) |
| **S3** | A3 Caisse | B4 Stock | C1 Ardoise |
| **S4** | Intégration Caisse + offline | Finitions Stock + RLS | Finitions Ardoise + QA en continu |
| **S5** | A4 Dashboard | B5 PWA/Workbox | C3 Kit beta |
| **S6** | Durcissement PWA + sync | Durcissement PWA + sync | QA offline poussée |
| **S7** | Polish UI & Accessibilité | idem | idem |
| **S8** | Bugs beta | Bugs beta | Pilote onboarding terrain |

---

## 🌳 Règle Git
- `main` (prod, intouchable) ← `dev` (intégration) ← branches `feat/*`
- **Méthode :** Pull `dev` chaque matin → Travailler sur sa branche `feat/*` → PR vers `dev` → Review rapide → Merge. Jamais de push direct sur `main` ou `dev`.
