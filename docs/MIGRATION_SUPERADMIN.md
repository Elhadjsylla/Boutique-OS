# Guide de Migration & Passation : Module Super Admin

Ce document résume les changements apportés à l'application **Boutique OS** et décrit les étapes pour appliquer la migration sur votre instance Supabase.

---

## 🛠️ Modifications du Code Source Frontend

Plusieurs composants admin ont été implémentés dans l'application avec un **mécanisme de repli automatique (fallback)**. 
- Si les tables et RPCs correspondantes ne sont pas encore présentes sur la base de données, l'interface bascule en **Mode Démo** avec des données fictives et un indicateur visuel jaune `[Mode Démo]`.
- Dès que la migration SQL ci-dessous aura été appliquée, les composants commenceront automatiquement à interroger le vrai backend.

Les fichiers concernés par ces changements sont :
1. **[AdminDashboard.tsx](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/src/pages/admin/AdminDashboard.tsx)** : KPIs de la plateforme et chiffre d'affaires global.
2. **[AdminBoutiques.tsx](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/src/pages/admin/AdminBoutiques.tsx)** : Gestion, détails et suspension des boutiques.
3. **[AdminUsers.tsx](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/src/pages/admin/AdminUsers.tsx)** : Visualisation de tous les profils utilisateurs.
4. **[AdminSubscriptions.tsx](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/src/pages/admin/AdminSubscriptions.tsx)** : Gestion des plans de souscription.
5. **[AdminLogs.tsx](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/src/pages/admin/AdminLogs.tsx)** : Journaux d'audit de la plateforme.

---

## 💾 Script de Migration Supabase

Le script SQL complet est situé dans le dépôt local ici :
👉 **[0017_superadmin_platform.sql](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/supabase/migrations/0017_superadmin_platform.sql)**

### Ce que fait ce script :
1. **Suspension des Boutiques** :
   - Ajoute les colonnes `suspended` (boolean), `suspended_at` (timestamptz) et `suspended_reason` (text) sur la table `public.boutiques`.
2. **Journaux d'Audit** :
   - Crée la table `public.admin_audit_log` avec des politiques RLS restrictives (lecture réservée aux utilisateurs ayant le rôle `super_admin`).
3. **Accès RLS pour Super Admin** :
   - Ajoute des politiques de lecture globale sur les tables `subscriptions` et `payment_logs` pour les utilisateurs ayant le rôle `super_admin`.
4. **Fonctions stockées (RPCs) de Sécurité** :
   - `public.admin_platform_stats()` : statistiques de vente, de boutiques et d'abonnements.
   - `public.admin_boutique_details(boutique_uuid)` : fiche d'identité détaillée d'une boutique avec stats.
   - `public.admin_toggle_boutique_suspend(boutique_uuid, suspend, reason)` : active/désactive le statut suspendu et log l'action.
   - `public.admin_update_subscription(target_user, new_plan, new_expires_at)` : modifie manuellement l'abonnement d'un utilisateur et log l'action.
5. **Policies Restrictives de Blocage** :
   - Crée des politiques de type `RESTRICTIVE` sur les tables critiques (`produits`, `ventes`, `vente_items`, `ardoises`, `ardoise_paiements`). Si une boutique est marquée `suspended = true`, tous les accès en écriture et lecture sont instantanément verrouillés pour ses employés, tandis que le `super_admin` conserve un accès en lecture seule.

---

## 🚀 Étapes pour Appliquer la Migration

Pour migrer votre base de données Supabase, utilisez l'une des méthodes suivantes :

### Option A : Via Supabase CLI (Recommandé en local/staging)
Si vous utilisez la CLI Supabase pour gérer vos environnements :
```bash
# Vérifier le statut de l'instance locale
supabase status

# Appliquer les migrations locales en attente
supabase db push
```

### Option B : Via l'Éditeur SQL de la Console Supabase (Directement en production)
1. Ouvrez votre tableau de bord **Supabase**.
2. Allez dans l'**Éditeur SQL** (SQL Editor).
3. Ouvrez un nouvel onglet de requête (New query).
4. Ouvrez le fichier **[0017_superadmin_platform.sql](file:///c:/Users/LENOVO%20T480S/OneDrive/Bureau/Boutique%20OS/supabase/migrations/0017_superadmin_platform.sql)** dans votre éditeur de code.
5. Copiez l'intégralité du script SQL et collez-le dans l'Éditeur SQL de Supabase.
6. Cliquez sur **Run** (Exécuter).

---

## 🔐 Attribution du Rôle Super Admin

Les RPCs et certaines politiques RLS se basent sur le rôle `super_admin` lu dans les métadonnées JWT de l'utilisateur (`auth.jwt() ->> 'role'`). 

Pour qu'un utilisateur ait accès à cette interface, il doit avoir son rôle défini sur `super_admin` dans la table `auth.users` (champ `role`).

### SQL pour nommer un Super Admin :
Exécutez la commande suivante dans l'éditeur SQL de Supabase en remplaçant `'EMAIL_DE_L_ADMIN'` par le vrai email du compte administrateur :

```sql
UPDATE auth.users
SET role = 'super_admin'
WHERE email = 'EMAIL_DE_L_ADMIN';
```
*(Après exécution, l'utilisateur devra se déconnecter puis se reconnecter pour rafraîchir son jeton JWT avec le rôle `super_admin`).*
