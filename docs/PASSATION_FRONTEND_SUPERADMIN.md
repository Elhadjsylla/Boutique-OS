# 🤝 Passation Backend → Frontend — Super Admin BoutikOS

> **Pour le développeur Frontend.**  
> Ce document décrit **exactement** ce que le backend fournit. Tu n'as pas besoin de toucher au SQL.  
> Code tes hooks React Query en te basant sur les signatures et retours JSON ci-dessous.

---

## 📋 Ce qui est disponible côté backend

| # | Élément backend | Type | Statut |
|---|----------------|------|--------|
| 1 | Colonne `suspended` / `suspended_at` / `suspended_reason` sur `boutiques` | Table SQL | ✅ Prêt |
| 2 | Table `admin_audit_log` | Table SQL | ✅ Prêt |
| 3 | RPC `admin_platform_stats()` | Supabase RPC | ✅ Prêt |
| 4 | RPC `admin_boutique_details(boutique_uuid)` | Supabase RPC | ✅ Prêt |
| 5 | RPC `admin_toggle_boutique_suspend(boutique_uuid, suspend, reason)` | Supabase RPC | ✅ Prêt |
| 6 | RPC `admin_update_subscription(target_user, new_plan, new_expires_at)` | Supabase RPC | ✅ Prêt |
| 7 | Policy super_admin sur `subscriptions` | RLS | ✅ Prêt |
| 8 | Edge Function `reset-password` | Edge Function | 🔵 V2 (SMTP requis) |

---

## Architecture du Super Admin

```
super_admin se connecte
        │
        ▼
   App.tsx détecte role === 'super_admin'
        │
        ▼
   AdminLayout (sidebar desktop / bottom nav mobile)
        │
        ├── AdminDashboard    → RPC admin_platform_stats()
        ├── AdminBoutiques    → SELECT boutiques + RPC toggle_suspend
        ├── AdminUsers        → SELECT profils + RPC assign_staff
        ├── AdminSubscriptions→ SELECT subscriptions + RPC admin_update_subscription
        └── AdminLogs         → SELECT admin_audit_log
```

---

## 1. Données lues directement (SELECT Supabase)

Le super_admin a accès à **toutes les données** via les policies RLS existantes. Voici les requêtes à utiliser :

### Boutiques
```typescript
const { data } = await supabase
  .from('boutiques')
  .select('id, nom, adresse, suspended, suspended_at, suspended_reason, created_at, gerant_id')
  .order('created_at', { ascending: false });
```

### Profils (tous les utilisateurs)
```typescript
const { data } = await supabase
  .from('profils')
  .select('id, role, boutique_id, created_at, boutiques(nom)')
  .order('created_at', { ascending: false });
```

> **Note** : pour récupérer l'email, il faut joindre `auth.users` — mais ce n'est pas possible directement côté client. L'email est dans `user.email` du hook `useAuth`. Pour la liste complète, utilise une RPC ou affiche seulement le rôle et la boutique.

### Abonnements
```typescript
const { data } = await supabase
  .from('subscriptions')
  .select('id, user_id, plan, status, payment_method, amount, starts_at, expires_at, created_at')
  .order('created_at', { ascending: false });
```

### Logs d'audit
```typescript
const { data } = await supabase
  .from('admin_audit_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
```

---

## 2. RPCs — Comment les appeler

### 2.1 `admin_platform_stats()`

```typescript
const { data, error } = await supabase.rpc('admin_platform_stats');
```

**Retour JSON :**
```json
{
  "total_boutiques": 42,
  "active_boutiques": 38,
  "suspended_boutiques": 4,
  "total_users": 156,
  "total_sales_today": 234,
  "total_sales_week": 1580,
  "total_sales_month": 6720,
  "ca_today": 1250000,
  "ca_week": 8750000,
  "ca_month": 35000000,
  "active_subscriptions": 35,
  "expired_subscriptions": 7
}
```

> **Montants** : en unité monétaire de base. Formater avec `toLocaleString('fr-FR')` + " F CFA".

---

### 2.2 `admin_boutique_details(boutique_uuid)`

```typescript
const { data, error } = await supabase.rpc('admin_boutique_details', {
  boutique_uuid: 'uuid-de-la-boutique'
});
```

**Retour JSON :**
```json
{
  "id": "uuid",
  "nom": "Boutique Chez Moussa",
  "adresse": "Dakar, Médina",
  "suspended": false,
  "suspended_at": null,
  "suspended_reason": null,
  "created_at": "2025-01-15T10:30:00Z",
  "gerant": {
    "id": "uuid",
    "email": "moussa@email.com",
    "role": "gerant"
  },
  "stats": {
    "total_users": 3,
    "total_products": 145,
    "total_sales": 892,
    "ca_total": 12500000,
    "ca_month": 3200000,
    "open_ardoises": 5,
    "ardoises_amount": 75000
  }
}
```

> `gerant` peut être `null` si aucun gérant n'est assigné.

---

### 2.3 `admin_toggle_boutique_suspend(boutique_uuid, suspend, reason)`

```typescript
// Suspendre
const { data, error } = await supabase.rpc('admin_toggle_boutique_suspend', {
  boutique_uuid: 'uuid',
  suspend: true,
  reason: 'Impayé abonnement'
});

// Réactiver
const { data, error } = await supabase.rpc('admin_toggle_boutique_suspend', {
  boutique_uuid: 'uuid',
  suspend: false,
  reason: null
});
```

**Retour JSON :**
```json
{
  "success": true,
  "boutique_id": "uuid",
  "suspended": true,
  "suspended_at": "2025-06-23T14:00:00Z"
}
```

> Un log est automatiquement écrit dans `admin_audit_log`.

---

### 2.4 `admin_update_subscription(target_user, new_plan, new_expires_at)`

```typescript
const { data, error } = await supabase.rpc('admin_update_subscription', {
  target_user: 'uuid-du-user',
  new_plan: 'pro',                         // 'starter' | 'pro' | 'annual'
  new_expires_at: '2027-12-31T23:59:59Z'
});
```

**Retour JSON :**
```json
{
  "success": true,
  "subscription_id": "uuid",
  "plan": "pro",
  "expires_at": "2027-12-31T23:59:59Z"
}
```

> Si le user n'a aucun abonnement, un nouveau est créé automatiquement.

---

### 2.5 `assign_staff(target_user, new_role, new_boutique)` (existant)

Déjà disponible depuis la migration `0003` :

```typescript
const { error } = await supabase.rpc('assign_staff', {
  target_user: 'uuid',
  new_role: 'gerant',          // 'caissier' | 'gerant' | 'super_admin'
  new_boutique: 'uuid-boutique'
});
```

---

### 2.6 Edge Function `create-boutique` (existante)

```typescript
const { data } = await supabase.functions.invoke('create-boutique', {
  body: {
    nom: 'Nouvelle Boutique',
    adresse: 'Dakar, Plateau',
    gerant_email: 'gerant@email.com'  // optionnel — envoie une invitation
  }
});
```

---

### 2.7 Edge Function `reset-password` (V2)

```typescript
const { data } = await supabase.functions.invoke('reset-password', {
  body: { user_id: 'uuid-du-user-cible' }
});
```

> En attendant que le SMTP soit configuré, **griser le bouton** avec un tooltip "Bientôt disponible".

---

## 3. Convention des actions audit log

Le champ `action` dans `admin_audit_log` utilise ces valeurs. Affiche des icônes en fonction :

| `action` | `target_type` | Icône suggérée | Libellé |
|----------|--------------|----------------|---------|
| `boutique.created` | `boutique` | 🏪 | Boutique créée |
| `boutique.suspended` | `boutique` | 🔒 | Boutique suspendue |
| `boutique.reactivated` | `boutique` | 🔓 | Boutique réactivée |
| `boutique.deleted` | `boutique` | 🗑️ | Boutique supprimée |
| `user.role_changed` | `user` | 👤 | Rôle modifié |
| `user.password_reset` | `user` | 🔑 | MDP réinitialisé |
| `subscription.updated` | `subscription` | 💳 | Abonnement modifié |
| `subscription.cancelled` | `subscription` | ❌ | Abonnement annulé |

Le champ `details` (JSONB) peut contenir : `reason`, `old_role`, `new_role`, `plan`, `email`, `suspended`, etc.

---

## 4. Routing conditionnel dans App.tsx

```typescript
// Dans App.tsx, après le loading et l'auth :
const userRole = profile?.role || 'caissier';

if (userRole === 'super_admin') {
  return <AdminLayout />;
}

// ... reste de l'interface boutique normale
```

---

## 5. Pages à créer

| Page | Fichier | Source de données |
|------|---------|-------------------|
| Dashboard Admin | `src/pages/admin/AdminDashboard.tsx` | RPC `admin_platform_stats()` |
| Gestion Boutiques | `src/pages/admin/AdminBoutiques.tsx` | SELECT `boutiques` + RPC `admin_toggle_boutique_suspend` + Edge Function `create-boutique` |
| Gestion Utilisateurs | `src/pages/admin/AdminUsers.tsx` | SELECT `profils` + RPC `assign_staff` |
| Gestion Abonnements | `src/pages/admin/AdminSubscriptions.tsx` | SELECT `subscriptions` + RPC `admin_update_subscription` |
| Logs d'activité | `src/pages/admin/AdminLogs.tsx` | SELECT `admin_audit_log` |
| Layout Admin | `src/pages/admin/AdminLayout.tsx` | Navigation + header + sidebar |

---

## 6. Design System — Thème Admin

Ajouter dans `index.css` des tokens spécifiques au panneau admin pour le distinguer visuellement de l'interface boutique :

```css
/* Tokens admin — fond sombre, accents violet */
--color-admin-primary: #7C3AED;
--color-admin-primary-light: #A78BFA;
--color-admin-surface: #0F172A;
--color-admin-card: #1E293B;
--color-admin-border: #334155;
--color-admin-text: #F1F5F9;
--color-admin-text-muted: #94A3B8;
```

---

## 7. TypeScript — Types utiles

```typescript
interface PlatformStats {
  total_boutiques: number;
  active_boutiques: number;
  suspended_boutiques: number;
  total_users: number;
  total_sales_today: number;
  total_sales_week: number;
  total_sales_month: number;
  ca_today: number;
  ca_week: number;
  ca_month: number;
  active_subscriptions: number;
  expired_subscriptions: number;
}

interface BoutiqueDetails {
  id: string;
  nom: string;
  adresse: string | null;
  suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  gerant: { id: string; email: string; role: string } | null;
  stats: {
    total_users: number;
    total_products: number;
    total_sales: number;
    ca_total: number;
    ca_month: number;
    open_ardoises: number;
    ardoises_amount: number;
  };
}

interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
```
