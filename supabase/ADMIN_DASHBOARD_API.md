# Sama Boutik — API Dashboard Super Admin

> **Migrations** : 0031 → 0035  
> **Sécurité** : toutes les fonctions admin vérifient `role = 'super_admin'` via `_assert_super_admin()`. En cas d'échec : exception explicite avec `HINT = '403'`.

---

## Périodes acceptées (`p_period`)

| Valeur | Description |
|--------|-------------|
| `24h` | Dernières 24 heures |
| `48h` | Dernières 48 heures |
| `72h` | Dernières 72 heures |
| `7d`  | 7 derniers jours |
| `14d` | 14 derniers jours |
| `1m`  | 1 mois |
| `3m`  | 3 mois |
| `6m`  | 6 mois |
| `12m` | 12 mois |
| `all` | Depuis le début |

---

## A — Validation des comptes

### `get_users_pending_validation()`
**Params :** aucun  
**Retourne :** `JSONB` — tableau de comptes `status='pending'`  
```json
[{ "id", "nom", "prenom", "email_masque", "telephone_masque", "created_at", "role_demande", "boutique_nom" }]
```
**Exemple :**
```js
const { data } = await supabase.rpc('get_users_pending_validation')
```

---

### `get_user_full_details(p_user_id UUID)`
**Params :** `p_user_id` — UUID de l'utilisateur  
**Retourne :** `JSONB` — toutes les infos en clair + abonnements + nb_ventes  
**Exemple :**
```js
const { data } = await supabase.rpc('get_user_full_details', { p_user_id: '...' })
```

---

### `approve_user(p_user_id UUID)`
**Params :** `p_user_id`  
**Retourne :** `{ success: true, user_id }` — log audit + notification user  
**Exemple :**
```js
await supabase.rpc('approve_user', { p_user_id: '...' })
```

---

### `reject_user(p_user_id UUID, p_raison TEXT)`
**Params :** `p_user_id`, `p_raison` (optionnel)  
**Retourne :** `{ success, user_id, raison }` — log audit + notification user  
**Exemple :**
```js
await supabase.rpc('reject_user', { p_user_id: '...', p_raison: 'Informations incorrectes' })
```

---

## B — Revenus

### `get_revenue_by_period(p_period TEXT)`
**Retourne :** `{ period, total_revenu, nb_transactions, revenu_par_plan, revenu_par_methode, evolution_pct, revenu_periode_prec }`  
**Exemple :**
```js
await supabase.rpc('get_revenue_by_period', { p_period: '30d' })
```

---

### `get_revenue_breakdown(p_period TEXT)`
**Retourne :** tableau de transactions `[{ subscription_id, user_id, nom_boutique, montant, plan, methode_paiement, date, statut }]`  
**Exemple :**
```js
await supabase.rpc('get_revenue_breakdown', { p_period: '7d' })
```

---

### `get_mrr_arr()`
**Retourne :** `{ mrr, arr, historique_6_mois: [{ mois, mrr }] }`  
- MRR = somme des abonnements actifs normalisés en mensuel (`annual / 12`, autres × 1)  
- ARR = MRR × 12  
**Exemple :**
```js
await supabase.rpc('get_mrr_arr')
```

---

### `get_ltv_by_plan()`
**Retourne :** objet par plan `{ starter: { nb_utilisateurs, revenu_moyen, duree_moyenne_mois, ltv }, pro: {...}, annual: {...} }`  
**Exemple :**
```js
await supabase.rpc('get_ltv_by_plan')
```

---

## C — Churn

### `get_churn_rate(p_period TEXT)`
**Retourne :** `{ period, churn_rate_pct, nb_churned, nb_actifs_debut, churn_rate_prec_pct, evolution_pts }`  
**Exemple :**
```js
await supabase.rpc('get_churn_rate', { p_period: '30d' })
```

---

### `get_churned_users_detail(p_period TEXT)`
**Retourne :** `[{ user_id, nom, prenom, email, boutique_nom, plan, date_annulation, montant_paye }]`  
**Exemple :**
```js
await supabase.rpc('get_churned_users_detail', { p_period: '7d' })
```

---

## D — Trafic / Nouveaux utilisateurs

### `get_new_users_by_period(p_period TEXT)`
**Retourne :** `{ period, total, par_role, par_statut, total_prec, evolution_pct }`  
**Exemple :**
```js
await supabase.rpc('get_new_users_by_period', { p_period: '7d' })
```

---

### `get_new_users_detail(p_period TEXT)`
**Retourne :** `[{ user_id, nom, prenom, email, phone, role, status, boutique_nom, created_at }]`  
**Exemple :**
```js
await supabase.rpc('get_new_users_detail', { p_period: '7d' })
```

---

## E — Funnel de conversion

### `get_conversion_funnel()`
**Retourne :**
```json
{
  "distribution": [{ "plan": "free", "nb_users": 150 }, ...],
  "transitions": [{ "from_plan": "free", "to_plan": "starter", "total": 45, "upgrades": 45, "downgrades": 0 }],
  "conversion_free_30j": { "total_free": 150, "convertis": 45, "taux_pct": 30.0 }
}
```
**Exemple :**
```js
await supabase.rpc('get_conversion_funnel')
```

---

## F — Boutiques actives / dormantes / top

### `get_active_vs_dormant(p_seuil_jours INT = 30)`
**Retourne :** `{ seuil_jours, nb_actives, nb_dormantes, nb_suspendues, total, detail: [...] }`  
- **Dormante** = aucune vente depuis `seuil_jours` jours  
**Exemple :**
```js
await supabase.rpc('get_active_vs_dormant', { p_seuil_jours: 30 })
```

---

### `get_top_boutiques(p_period TEXT = '30d', p_limit INT = 10)`
**Retourne :** `[{ boutique_id, nom, quartier, adresse, revenu, nb_transactions, plan, suspended }]` trié par revenu desc  
**Exemple :**
```js
await supabase.rpc('get_top_boutiques', { p_period: '1m', p_limit: 10 })
```

---

## G — Géolocalisation

### `get_boutiques_geo()`
**Retourne :** `{ total_boutiques, boutiques_localisees, boutiques: [{ boutique_id, nom, quartier, latitude, longitude, revenu_total, nb_ventes, statut }] }`  
- N'inclut que les boutiques avec un `quartier` correspondant à un enregistrement dans `quartiers_dakar`  
- Le frontend peut afficher : "X boutiques sur Y localisées"  
**Exemple :**
```js
await supabase.rpc('get_boutiques_geo')
```

**Permettre à un gérant de renseigner son quartier :**
```js
// Depuis le profil gérant :
await supabase.from('boutiques').update({ quartier: 'Parcelles Assainies' }).eq('id', boutiqueId)

// Lister les quartiers disponibles :
await supabase.from('quartiers_dakar').select('nom, latitude, longitude').order('nom')
```

---

## H — Signalements

### `create_signalement(p_boutique_id, p_type, p_sujet, p_message)` *(côté user)*
**Types :** `bug | suggestion | plainte | autre`  
**Retourne :** `{ success, signalement_id }`  
**Exemple :**
```js
await supabase.rpc('create_signalement', {
  p_boutique_id: '...',
  p_type: 'bug',
  p_sujet: 'Problème de caisse',
  p_message: 'Impossible de créer une vente depuis ce matin...'
})
```

---

### `get_signalements(p_statut TEXT = null, p_period TEXT = 'all')` *(admin)*
**Filtres :** `p_statut` = `nouveau | en_cours | resolu | null` (tous)  
**Retourne :** `[{ id, type, sujet, statut, priorite, created_at, nom_user, email_user, nom_boutique, nb_reponses, dernier_message_at }]`  
**Exemple :**
```js
await supabase.rpc('get_signalements', { p_statut: 'nouveau', p_period: '7d' })
```

---

### `get_signalement_thread(p_signalement_id UUID)`
**Accessible par :** super_admin OU l'utilisateur propriétaire  
**Retourne :** `{ signalement: {...}, reponses: [{ id, auteur_type, nom_auteur, message, created_at }] }`  
**Exemple :**
```js
await supabase.rpc('get_signalement_thread', { p_signalement_id: '...' })
```

---

### `repondre_signalement(p_signalement_id UUID, p_message TEXT)` *(admin)*
**Effets :** ajoute réponse + passe statut à `en_cours` si `nouveau` + notifie le user  
**Retourne :** `{ success, reponse_id }`  
**Exemple :**
```js
await supabase.rpc('repondre_signalement', {
  p_signalement_id: '...',
  p_message: 'Nous avons identifié le problème...'
})
```

---

### `update_signalement_statut(p_signalement_id UUID, p_statut TEXT)` *(admin)*
**Statuts :** `nouveau | en_cours | resolu`  
**Retourne :** `{ success, statut }`  
**Exemple :**
```js
await supabase.rpc('update_signalement_statut', { p_signalement_id: '...', p_statut: 'resolu' })
```

---

### `get_my_signalements()` *(côté user)*
**Retourne :** `{ signalements: [{ id, type, sujet, statut, priorite, created_at, nb_reponses, non_lu }] }`  
**Exemple :**
```js
await supabase.rpc('get_my_signalements')
```

---

## I — Alertes automatiques

### `get_alerts(p_non_lues_only BOOLEAN = true)` *(admin)*
**Retourne :** `[{ id, type, message, severite, cible_id, created_at, lue }]` trié par sévérité puis date  
**Sévérités :** `urgent` (rouge) | `attention` (orange) | `info` (bleu)  
**Exemple :**
```js
await supabase.rpc('get_alerts', { p_non_lues_only: true })
```

---

### `mark_alert_read(p_alert_id UUID)` / `mark_all_alerts_read()`
**Exemple :**
```js
await supabase.rpc('mark_alert_read', { p_alert_id: '...' })
await supabase.rpc('mark_all_alerts_read')
```

---

### `detect_and_insert_alerts()` *(cron, toutes les heures)*
Détecte automatiquement :
1. Comptes en attente depuis +48h (`attention`)
2. Signalement haute priorité non traité +12h (`urgent`)
3. Pic de churn anormal >15% sur 7j (`urgent`)
4. 3+ échecs de paiement pour un même user en 24h (`attention`)

---

## K — Stats globales (cache)

### `get_platform_stats_cached()`
**Retourne :** snapshot depuis la vue matérialisée `mv_platform_stats` (rafraîchie toutes les heures)  
```json
{ "total_users", "total_gerants", "total_caissiers", "pending_validation",
  "total_boutiques", "boutiques_actives", "revenu_total", "nb_transactions_total",
  "mrr", "paying_users", "nb_ventes_total", "ca_ventes_total", "refreshed_at" }
```
**Exemple :**
```js
await supabase.rpc('get_platform_stats_cached')
```

---

## Realtime (Supabase JS)

```js
// File de validation — nouveau compte à valider
supabase.channel('admin-pending')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'profils',
    filter: 'status=eq.pending'
  }, (payload) => { /* refresh file */ })
  .subscribe()

// Alertes admin en temps réel
supabase.channel('admin-alerts')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'alerts'
  }, (payload) => { /* afficher badge */ })
  .subscribe()

// Signalements — côté admin (nouveau signalement)
supabase.channel('admin-signalements')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'signalements'
  }, (payload) => { /* refresh liste */ })
  .subscribe()

// Réponse admin — côté user (badge non-lu)
supabase.channel('user-signalement-reponses')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'signalement_reponses',
    filter: `signalement_id=eq.${signalementId}`
  }, (payload) => { /* update thread */ })
  .subscribe()
```

---

## Schéma des nouvelles tables

| Table | Colonnes clés |
|-------|---------------|
| `profils` | + `status` (pending/active/rejected), `nom`, `prenom`, `rejected_at`, `rejected_reason` |
| `subscriptions` | + `cancelled_at` (rempli automatiquement via trigger) |
| `boutiques` | + `quartier` TEXT |
| `quartiers_dakar` | `id`, `nom` UNIQUE, `latitude`, `longitude` |
| `signalements` | `id`, `user_id`, `boutique_id`, `type`, `sujet`, `message`, `statut`, `priorite` |
| `signalement_reponses` | `id`, `signalement_id`, `auteur_id`, `auteur_type`, `message` |
| `alerts` | `id`, `type`, `message`, `severite`, `cible_id`, `lue` |
| `mv_platform_stats` | vue matérialisée, 1 ligne, rafraîchie `:30` chaque heure |
