# Checklist de Validation QA Manuelle — BoutikOS 🏪

Ce document contient la suite de tests manuels systématiques permettant de valider les fonctionnalités et la sécurité de **BoutikOS** avant chaque livraison.

---

## 📋 1. Authentification & Rôles (Sécurité)

| ID | Module | Scénario de Test | Étapes de Test | Résultat Attendu | Statut |
|---|---|---|---|---|---|
| **AUTH-01** | Auth | Connexion standard | 1. Saisir des identifiants valides.<br>2. Valider. | Connexion réussie, redirection vers l'écran d'accueil de la boutique. | - [ ] |
| **AUTH-02** | Auth | Connexion erronée | 1. Entrer un e-mail/mot de passe incorrect.<br>2. Tenter de se connecter. | Message d'erreur clair et sécurisé. Accès refusé. | - [ ] |
| **AUTH-03** | Rôles | Restriction Caissier | 1. Se connecter avec le rôle `caissier`. | L'onglet Caisse est accessible. Les onglets Stock, Ardoise et Dashboard ne sont ni visibles ni accessibles. | - [ ] |
| **AUTH-04** | Rôles | Accès Gérant | 1. Se connecter avec le rôle `gerant`. | Accès complet aux onglets Caisse, Stock, Ardoise et Dashboard. | - [ ] |
| **AUTH-05** | Rôles | Accès Super Admin | 1. Se connecter avec le rôle `super_admin`. | Accès complet + option de sélection multi-boutiques visible. | - [ ] |

---

## 🛒 2. Caisse & Ventes

| ID | Module | Scénario de Test | Étapes de Test | Résultat Attendu | Statut |
|---|---|---|---|---|---|
| **CAIS-01** | Caisse | Recherche produit | 1. Saisir le nom d'un produit existant.<br>2. Saisir un nom inexistant. | 1. Filtre instantané dans la grille.<br>2. Grille vide avec un message "Aucun produit". | - [ ] |
| **CAIS-02** | Caisse | Ajout au panier | 1. Cliquer sur un produit en stock. | Le panier s'incrémente de 1 et s'affiche dans la barre de validation flottante. | - [ ] |
| **CAIS-03** | Caisse | Produit en rupture | 1. Repérer un produit avec quantité = 0. | Le produit est grisé, porte un badge "Rupture", et n'est pas cliquable. | - [ ] |
| **CAIS-04** | Caisse | Quantité max panier | 1. Ajouter un produit à répétition jusqu'à la limite du stock local. | Un Toast affiche "Quantité max en stock atteinte" et bloque l'ajout. | - [ ] |
| **CAIS-05** | Caisse | Rendu de monnaie | 1. Ouvrir le panier.<br>2. Saisir un montant reçu supérieur au total. | Le rendu de monnaie est calculé en temps réel et s'affiche en vert (#27AE60). | - [ ] |
| **CAIS-06** | Caisse | Montant insuffisant | 1. Ouvrir le panier.<br>2. Saisir un montant reçu inférieur au total. | La différence manquante s'affiche en rouge (#BA1A1A) et le bouton "Valider" est désactivé. | - [ ] |
| **CAIS-07** | Caisse | Validation vente | 1. Saisir un montant reçu valide.<br>2. Valider la vente. | La vente est enregistrée en IndexedDB (décrémentation stock local, vidage panier, Toast de succès et ajout à l'historique du jour). | - [ ] |

---

## 📦 3. Gestion de Stock & Inventaire

| ID | Module | Scénario de Test | Étapes de Test | Résultat Attendu | Statut |
|---|---|---|---|---|---|
| **STOK-01** | Stock | Badge stock bas | 1. Repérer un produit dont la quantité est <= seuil_alerte (et > 0). | Le produit affiche un badge orange "Stock bas" (ou "Bas") dans la grille. | - [ ] |
| **STOK-02** | Stock | Mise à jour quantité | 1. Aller sur la gestion du stock.<br>2. Modifier la quantité d'un produit. | La quantité locale s'actualise immédiatement et le produit est marqué pour synchronisation. | - [ ] |
| **STOK-03** | Stock | Ajout produit | 1. Cliquer sur "Ajouter un produit".<br>2. Remplir le nom (obligatoire) et le prix (> 0). | Le produit apparaît dans la liste locale avec un UUID client. | - [ ] |

---

## 📔 4. Registre des Ardoises (Crédits)

| ID | Module | Scénario de Test | Étapes de Test | Résultat Attendu | Statut |
|---|---|---|---|---|---|
| **ARD-01** | Ardoise | Création ardoise | 1. Ouvrir le formulaire de création d'ardoise.<br>2. Soumettre avec nom client vide ou montant <= 0. | Le formulaire bloque avec une erreur de validation Zod explicite. | - [ ] |
| **ARD-02** | Ardoise | Création valide | 1. Saisir un nom de client et un montant initial (> 0).<br>2. Valider. | L'ardoise est créée avec succès, le statut passe en "en cours". | - [ ] |
| **ARD-03** | Ardoise | Tri et Filtres | 1. Alterner les filtres : Toutes / En cours / Soldées.<br>2. Changer le tri : Montant / Date / Nom. | La liste se réorganise instantanément selon les critères appliqués. | - [ ] |
| **ARD-04** | Ardoise | Couleur d'avatar | 1. Vérifier les avatars de plusieurs clients. | L'avatar affiche les initiales avec une couleur déterministe (ochre/teal/tertiary, jamais rouge). | - [ ] |
| **ARD-05** | Ardoise | Paiement partiel | 1. Cliquer sur une ardoise active.<br>2. Enregistrer un remboursement partiel. | Le paiement apparaît dans l'historique de l'ardoise, le solde restant diminue. | - [ ] |
| **ARD-06** | Ardoise | Solde à zéro | 1. Enregistrer un paiement égal au solde restant. | L'ardoise passe automatiquement au statut "soldée" et affiche le badge vert. | - [ ] |

---

## 📶 5. Mode Hors-ligne (Offline-First) & Synchronisation

| ID | Module | Scénario de Test | Étapes de Test | Résultat Attendu | Statut |
|---|---|---|---|---|---|
| **OFF-01** | Offline | Indicateur de connexion | 1. Couper le réseau internet (mode avion). | L'indicateur de statut connexion affiche immédiatement "HORS LIGNE" en rouge. | - [ ] |
| **OFF-02** | Offline | Vente hors-ligne | 1. Être hors-ligne.<br>2. Effectuer une vente complète. | La vente réussit localement, le stock diminue, et l'opération s'ajoute à la table `outbox` (`synced: 0`). | - [ ] |
| **OFF-03** | Offline | Persistance à chaud | 1. Effectuer des actions hors-ligne.<br>2. Recharger l'application (F5). | Toutes les données locales (ventes du jour, ardoises créées) sont conservées intactes (lu depuis Dexie). | - [ ] |
| **OFF-04** | Sync | Reconnexion (Push) | 1. Rétablir internet.<br>2. Attendre le déclenchement de la synchro. | Les mutations en attente dans la table `outbox` sont poussées vers Supabase. Les entrées passent à `synced: 1`. | - [ ] |
| **OFF-05** | Sync | Récupération (Pull) | 1. Être en ligne.<br>2. Ajouter ou modifier un produit directement sur Supabase. | Les modifications serveur sont rapatriées localement en tâche de fond dans Dexie. | - [ ] |
| **OFF-06** | Conflit | Résolution de conflit | 1. Modifier la quantité d'un produit localement en offline.<br>2. Modifier le même produit en ligne sur le serveur.<br>3. Rétablir le réseau. | Moteur de résolution *Last-Write-Wins* : le timestamp du serveur (Supabase) l'emporte pour écraser ou conserver la valeur. | - [ ] |
| **OFF-07** | Offline | Endurance longue durée | 1. Simuler une déconnexion prolongée (actions réparties sur 72h fictives en changeant la date système). | Pas de plantage de base locale, la file d'attente outbox s'incrémente normalement dans l'ordre chronologique. | - [ ] |
