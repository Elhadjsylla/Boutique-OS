# Plan de Validation QA — BoutikOS 🏪

Ce document définit la stratégie d'assurance qualité et les cas de test de BoutikOS, conformément à la cible d'utilisateurs (Afrique de l'Ouest, Android bas de gamme 2 Go RAM, connexion intermittente) et aux exigences techniques (offline-first, Supabase RLS, performance).

---

## 1. Cadre Général & Contraintes Cibles
- **Cible Matérielle :** Android Go / Téléphones low-end (2 Go RAM).
- **Réseau :** Souvent offline ou 2G/3G instable.
- **Accessibilité :** Utilisateurs à faible littératie numérique. Priorité absolue aux icônes et couleurs sur le texte textuel.

---

## 2. Stratégie de Test & Niveaux de Validation

### A. Tests Unitaires & Intégration
- **Schémas Zod :** Validation stricte des données locales et synchronisées.
- **Dexie.js (IndexedDB) :** Validation des opérations CRUD locales hors-ligne.
- **UUIDs :** Vérification que chaque entité a un UUID généré côté client dès sa création.

### B. Validation du Mode Offline & Synchro (Critique 🔴)
- **Scénario d'écriture hors-ligne :**
  1. Passage en mode avion / simuler une déconnexion.
  2. Enregistrement d'une vente ou modification de stock.
  3. Vérification de l'écriture immédiate et optimiste dans IndexedDB.
  4. Rétablissement de la connexion.
  5. Vérification du déclenchement de la synchronisation en arrière-plan.
- **Résolution des conflits :**
  - Scénario *Last-Write-Wins* basé sur le timestamp du SERVEUR (jamais client).

### C. Validation UX & Ergonomie
- **Cibles Tactiles :** Taille de chaque bouton ou zone cliquable >= 48px.
- **Règle des 2 Taps :** L'enregistrement d'une vente ou le paiement d'une ardoise doit se faire en maximum 2 taps depuis l'écran principal.
- **Formatage des Prix :**
  - Symbole ou suffixe `FCFA`.
  - Séparateur de milliers (ex: `15 000 FCFA` au lieu de `15000FCFA`).
  - Alignement des chiffres via `tabular-nums` (font-variant-numeric).

### D. Sécurité & Rôles
- Validation des routes d'accès selon les rôles :
  - **Caissier :** Accès Caisse uniquement.
  - **Gérant :** Accès Caisse, Stock, Ardoise, Dashboard.
  - **Super Admin :** Accès total + gestion multi-boutiques.
- **Contrôle Supabase RLS :** Aucun accès direct ou contournement dans le code React. Tous les filtres de données doivent être appliqués via Supabase.

---

## 3. Matrice de Cas de Test (Spécifiques)

| ID | Module | Description du Test | Comportement Attendu |
|---|---|---|---|
| **QA-001** | Offline | Vente en mode déconnecté | Enregistrement instantané en local avec statut "en attente de sync". |
| **QA-002** | Sync | Reconnexion et synchronisation | La vente QA-001 est poussée vers Supabase ; le statut passe à "synchronisé". |
| **QA-003** | Conflit | Conflit de modification (Stock) | En cas de modification double, le timestamp serveur le plus récent l'emporte. |
| **QA-004** | UX | Lisibilité des montants | Les prix s'affichent sous la forme `X XXX FCFA` avec une police à espacement fixe (`tabular-nums`). |
| **QA-005** | Auth | Permissions Caissier | Un utilisateur connecté en tant que Caissier est bloqué s'il tente d'accéder à `/ardoise` ou `/dashboard`. |
| **QA-006** | Ardoise | Création d'une ardoise client | Association obligatoire d'un client, d'un montant total et génération d'un UUID client. |
| **QA-007** | Performance | Limite mémoire (2 Go RAM) | L'application doit rester fluide (< 60 FPS) sans fuite de mémoire lors d'un défilement de 500+ produits. |
