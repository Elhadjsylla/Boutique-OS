# FRONTEND_AGENT.md — Guide de l'agent front Sama Boutik

> Document destiné à tout agent (IA ou humain) qui intervient sur la couche frontend de ce projet.
> Lis ce fichier en entier avant de toucher au code.

---

## PROBLÈME ACTUEL À RÉSOUDRE EN PRIORITÉ

### Symptôme
L'utilisateur tente de se connecter sur `localhost:2000` avec ses vraies credentials Supabase.
La page affiche une erreur et il reste sur la LandingPage. **Il ne peut pas accéder à l'application.**

### Ce qui a déjà été fait (ne pas refaire)
1. ✅ `npm install` — les packages i18n manquants (`react-i18next`, `i18next`, `i18next-browser-languagedetector`) ont été installés. Sans ça, Vite plantait au démarrage avant même que Supabase se charge.
2. ✅ `VITE_DEV_BYPASS=false` dans `.env` — intentionnel, l'auth dev factice est désactivée. Ne pas changer ça.
3. ✅ `Login.tsx` — la détection d'erreur réseau est maintenant stricte (`err instanceof TypeError && err.message === 'Failed to fetch'`). Les vraies erreurs Supabase s'affichent maintenant dans le toast au lieu d'être cachées derrière "Vérifiez votre connexion Internet."
4. ✅ Le projet Supabase `utpgotetbzobsjnhbqkc` est `ACTIVE_HEALTHY` — pas de problème côté backend.
5. ✅ Les comptes `elhadjsylla667@gmail.com` et `cedricbenoitdieme@gmail.com` ont bien `role = super_admin` et `plan = annual` avec `expires_at = 2099-12-31` en base.

### Étape de diagnostic immédiate
Avant toute modification de code, **lire le vrai message d'erreur** :
1. Ouvrir `localhost:2000` dans Chrome
2. Appuyer sur `F12` → onglet **Console**
3. Tenter la connexion avec `elhadjsylla667@gmail.com`
4. Lire l'erreur exacte loggée par `console.error('[Login] Erreur Supabase:', err)` dans `src/components/Login.tsx:64`

Le message exact détermine quelle cause s'applique ci-dessous.

### Causes possibles et leurs fixes

#### Cas A — `"Email not confirmed"`
**Cause :** Supabase requiert la confirmation par email, et l'email du compte n'a pas été vérifié.
**Fix (Supabase Dashboard) :**
- Aller dans Authentication → Users → trouver `elhadjsylla667@gmail.com` → cliquer "Confirm email"
- OU désactiver la confirmation email : Authentication → Providers → Email → décocher "Confirm email"
**Fix (code) :** Ajouter `emailRedirectTo` et/ou désactiver `email_confirm` côté Supabase. Pas de modification frontend nécessaire.

#### Cas B — `"Invalid login credentials"`
**Cause :** Mauvais mot de passe, ou l'email n'existe pas dans Supabase Auth (il est peut-être dans `profils` mais pas dans `auth.users`).
**Fix :** Vérifier dans Supabase Dashboard → Authentication → Users que `elhadjsylla667@gmail.com` existe bien. Si oui, réinitialiser le mot de passe. Si non, créer le compte via "Add user".

#### Cas C — `TypeError: Failed to fetch` (vrai problème réseau)
**Cause :** Le navigateur ne peut pas joindre `utpgotetbzobsjnhbqkc.supabase.co`. Peut être un firewall Windows, un antivirus, ou un proxy réseau qui bloque `supabase.co`.
**Diagnostic :** Ouvrir PowerShell et tester :
```powershell
Invoke-WebRequest -Uri "https://utpgotetbzobsjnhbqkc.supabase.co/auth/v1/health" -UseBasicParsing
```
- Si `200` → réseau OK, chercher autre cause
- Si erreur → Windows Defender ou firewall local bloque Supabase
**Fix :** Ajouter une exception firewall pour `*.supabase.co`, ou tester sur un autre réseau (partage de connexion mobile).

#### Cas D — Erreur CORS (`"blocked by CORS policy"`)
**Cause :** Supabase rejette les requêtes depuis `localhost:2000` (port non autorisé dans les Settings).
**Fix (Supabase Dashboard) :**
- Authentication → URL Configuration
- Ajouter `http://localhost:2000` dans "Site URL" ET dans "Redirect URLs"
**Note :** Ce n'est généralement pas nécessaire pour `signInWithPassword` (Supabase autorise tous les origins par défaut), mais peut arriver si des restrictions custom ont été appliquées.

#### Cas E — `"AuthRetryableFetchError"` ou autre erreur de timeout
**Cause :** Réseau trop lent, ou Supabase momentanément indisponible (rare si `ACTIVE_HEALTHY`).
**Fix :** Réessayer plus tard. Ajouter un retry dans le fetch si ça se répète souvent.

### Après avoir identifié et corrigé la cause
1. Vérifier que la connexion fonctionne et que l'app monte correctement (top bar, onglets, console admin)
2. Vérifier que `subStatus` passe bien à `'active'` et `activePlan` à `'Plan MAX'` pour les comptes super admin (cf. `console.log('[App] ✅ ADMIN DETECTED')` dans `App.tsx:301`)
3. Mettre à jour ce document en marquant le problème comme ✅ résolu

---

## ÉTAT DU SYSTÈME DE PAIEMENT & FREE TRIAL

### Architecture globale

```
Utilisateur → Abonnement.tsx (paywall)
                └─ supabase.functions.invoke('create-payment')
                      └─ Edge Function create-payment/index.ts
                            └─ UnitechPay API (Wave / Orange Money)
                            └─ Crée subscription en DB avec status='pending'
                            └─ Renvoie payment_url ou qr_code

Après paiement → UnitechPay appelle le webhook
                └─ Edge Function webhook-unitech/index.ts
                      └─ Met à jour subscription status='active' en DB

Utilisateur clique "J'ai payé" → handleConfirmPayment()
                └─ Vérifie en DB que subscription status='active'
                └─ Si oui → setSubStatus('active') → accès accordé
                └─ Si non → message d'attente, réessayer
```

### Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `src/pages/Abonnement.tsx` | Paywall (affiché quand subStatus === 'paywall') |
| `src/pages/Subscription.tsx` | Page upgrade in-app (depuis Settings) |
| `src/hooks/useSubscription.ts` | Types + PLAN_CONFIG + hook useSubscription |
| `src/components/ui/TrialBanner.tsx` | Bandeau essai gratuit |
| `supabase/functions/create-payment/index.ts` | Edge Function paiement |
| `supabase/functions/webhook-unitech/index.ts` | Webhook confirmation paiement |
| `supabase/migrations/0019_free_trial.sql` | RPCs trial (start/cancel/get_status) |

### Edge Functions — status

| Fonction | Existe dans code | Déployée ? | Notes |
|----------|-----------------|------------|-------|
| `create-payment` | ✅ | ❓ À vérifier | Appelée par Abonnement.tsx ET Subscription.tsx |
| `webhook-unitech` | ✅ | ❓ À vérifier | Appelée par UnitechPay pour confirmer |
| `notify-expiring` | ✅ | ❓ À vérifier | Cron de notification |
| `export-data` | ✅ | ❓ À vérifier | Export PDF/Excel (UI présente, non fonctionnel) |
| `invite-user` | ✅ | ❓ À vérifier | Invitation caissier |
| `create-boutique` | ✅ | ❓ À vérifier | Création boutique |
| `reset-password` | ✅ | ❓ À vérifier | Reset password |
| ~~`initiate-payment`~~ | ❌ N'existe pas | — | Nom incorrect, ancienne version |

**Pour déployer les Edge Functions :**
```bash
supabase functions deploy create-payment
supabase functions deploy webhook-unitech
```

### Secrets requis dans Supabase (Edge Functions → Secrets)

| Secret | Requis par | Description |
|--------|-----------|-------------|
| `UNITECH_WAVE_API_KEY` | `create-payment` | Clé API UnitechPay pour Wave |
| `UNITECH_OM_API_KEY` | `create-payment` | Clé API UnitechPay pour Orange Money |
| `APP_URL` | `create-payment` | URL de l'app (ex: `https://boutikos.app`) pour les callbacks |
| `SUPABASE_SERVICE_ROLE_KEY` | `create-payment`, `webhook-unitech` | Auto-injectée par Supabase |

### Bugs corrigés (ne pas revert)

#### ✅ Fix 1 — TrialBanner interface complète
`TrialBanner` attend maintenant `trialStatus: TrialStatus` (requis) + `onTrialExpired?: () => void` (optionnel).
- `App.tsx` stocke le résultat du RPC `get_trial_status` dans `trialStatus` state
- `App.tsx` passe `trialStatus={trialStatus}` ET `onTrialExpired={() => setSubStatus('paywall')}` à `TrialBanner`
- Le banner ne rend rien si `trialStatus` est null (guard ajouté : `subStatus === 'trial' && trialStatus &&`)

#### ✅ Fix 2 — Nom de l'Edge Function dans Abonnement.tsx
`Abonnement.tsx` appelait `/functions/v1/initiate-payment` (inexistant) via raw `fetch`.
Corrigé en `supabase.functions.invoke('create-payment', ...)` avec le bon paramètre `customer_number` (au lieu de `phone`).

#### ✅ Fix 4 — Prix des plans dérivés de PLAN_CONFIG
`Subscription.tsx` avait ses propres prix hardcodés (risque de désynchronisation). Maintenant tous les prix sont dérivés de `PLAN_CONFIG` dans `useSubscription.ts` — une seule source de vérité.

#### ✅ Fix 5 — QR Code Orange Money affiché
`Subscription.tsx` recevait le QR code d'UnitechPay mais ne l'affichait pas (juste un toast). Maintenant le QR code est stocké en state et affiché dans le modal avec les instructions de scan.

#### ✅ Fix 3 — Vérification paiement avant accès
`handleConfirmPayment` dans `Abonnement.tsx` vérifiait maintenant en DB si `status='active'` avant d'appeler `onSuccess()`. Un utilisateur ne peut plus cliquer "J'ai payé" sans que le webhook n'ait confirmé le paiement.

### Bugs restants à corriger

#### 🟠 Majeur — Numéro WhatsApp à renseigner
`Subscription.tsx` ligne 8 : `const WHATSAPP_SUPPORT = '221700000000'` → remplacer par le vrai numéro de support Sama Boutik.

#### 🟠 Majeur — Webhook UnitechPay URL non configurée
L'URL de callback dans `create-payment/index.ts` utilise `APP_URL` avec fallback `https://boutikos.app`. Cette URL doit pointer vers l'Edge Function `webhook-unitech` pour que les paiements soient confirmés automatiquement. À configurer dans le dashboard UnitechPay et en secret Supabase.

#### 🟡 Mineur — FOMO hardcodé dans Subscription.tsx
"Plus que 12 places au tarif de lancement" est une chaîne hardcodée dans le plan `annuel`. À rendre dynamique ou à supprimer si la campagne de lancement est terminée.

### RPCs Free Trial (toutes dans migration 0019)

| RPC | Signature | Ce qu'elle fait |
|-----|-----------|-----------------|
| `start_free_trial(p_plan)` | `p_plan TEXT DEFAULT 'starter'` | Crée 30j trial, annulable 7j |
| `cancel_free_trial()` | — | Annule si dans les 7 premiers jours |
| `get_trial_status()` | — | Retourne le statut complet du trial |

Retour de `get_trial_status()` :
```json
{
  "has_trial": true,
  "status": "trial",
  "plan": "starter",
  "trial_ends_at": "...",
  "cancellation_deadline": "...",
  "can_cancel": true,
  "is_committed": false,
  "is_expired": false,
  "days_left": 28,
  "cancel_days_left": 5
}
```

### Plans disponibles

| Plan | Montant | Durée | Défini dans |
|------|---------|-------|-------------|
| `starter` | 2 900 XOF | 1 mois | `useSubscription.ts` PLAN_CONFIG |
| `pro` | 5 900 XOF | 1 mois | `useSubscription.ts` PLAN_CONFIG |
| `annual` | 52 900 XOF | 12 mois | `useSubscription.ts` PLAN_CONFIG |

**Note :** `Subscription.tsx` a sa propre liste de plans hardcodée (avec des features différentes de `PLAN_CONFIG`). Les deux devraient utiliser la même source de vérité (`PLAN_CONFIG` dans `useSubscription.ts`).

---

## 1. Identité du projet

| Champ | Valeur |
|-------|--------|
| Nom produit | **Sama Boutik** (interne : BoutikOS) |
| Type | SaaS POS offline-first pour commerçants en Afrique de l'Ouest |
| Dépôt | `c:\Users\LENOVO T480S\OneDrive\Bureau\Boutique OS` |
| Branche active | `feat/pwa` |
| Branche principale | `main` |
| Port dev | `localhost:2000` |

---

## 2. Stack technique

| Couche | Tech |
|--------|------|
| UI | React 19 + TypeScript 6 |
| Build | Vite 8 |
| CSS | Tailwind CSS v4 (PostCSS) |
| Etat global | Zustand 5 |
| Requêtes serveur | TanStack React Query 5 |
| BDD locale (offline) | Dexie 4 (IndexedDB) |
| BDD distante | Supabase (Postgres + Auth + Edge Functions) |
| PWA | vite-plugin-pwa |
| i18n | i18next 26 + react-i18next 17 + i18next-browser-languagedetector 8 |
| Icônes | Material Symbols (font CDN) + Lucide React |
| Validation | Zod 4 |

---

## 3. Structure `src/`

```
src/
├── App.tsx                     ← routeur principal, session, paywall, layout
├── main.tsx                    ← point d'entrée, monte <App />
├── index.css                   ← variables CSS Tailwind v4 (tokens design)
│
├── components/
│   ├── Login.tsx               ← formulaire connexion/inscription
│   └── ui/                     ← composants atomiques réutilisables
│       ├── Badge.tsx
│       ├── BottomNav.tsx       ← navigation onglets du bas
│       ├── BottomSheet.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── ImagePicker.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── MoneyText.tsx
│       ├── Toast.tsx
│       └── TrialBanner.tsx     ← bandeau d'essai gratuit (prop: onTrialExpired)
│
├── pages/
│   ├── LandingPage.tsx         ← page d'accueil / marketing (non connecté)
│   ├── Caisse.tsx              ← POS / caisse enregistreuse
│   ├── Stock.tsx               ← gestion des produits
│   ├── Ardoise.tsx             ← dettes clients (ardoises)
│   ├── Dashboard.tsx           ← tableau de bord stats
│   ├── Settings.tsx            ← paramètres utilisateur
│   ├── Reglages.tsx            ← réglages boutique
│   ├── Subscription.tsx        ← page choix de plan
│   ├── Abonnement.tsx          ← paywall (affiché si subStatus === 'paywall')
│   ├── PortalClient.tsx        ← portail public client (lien ardoise)
│   ├── MonEspace.tsx           ← espace client connecté
│   ├── StockModal.tsx
│   ├── _StyleGuide.tsx         ← guide de style interne (ne pas supprimer)
│   └── admin/
│       ├── AdminLayout.tsx     ← console super admin (remplace toute l'UI)
│       ├── AdminDashboard.tsx
│       ├── AdminUsers.tsx
│       ├── AdminBoutiques.tsx
│       ├── AdminSubscriptions.tsx
│       └── AdminLogs.tsx
│
├── hooks/
│   ├── useAuth.ts              ← listener Supabase auth → charge profil + boutique
│   ├── useOnline.ts            ← détecte connexion réseau
│   ├── useSubscription.ts      ← fetch abonnement actif (PLAN_CONFIG, types)
│   └── useSyncEngine.ts        ← sync outbox Dexie → Supabase
│
├── store/
│   └── useAuthStore.ts         ← Zustand: user, profile, boutique, isLoading
│
├── db/
│   ├── dexie.ts                ← schéma IndexedDB + helper queueMutation()
│   └── sync.ts                 ← logique de synchronisation outbox
│
├── features/
│   ├── caisse/
│   │   ├── types.ts
│   │   └── useCart.ts
│   ├── stock/
│   │   └── useStock.ts
│   ├── ardoise/
│   │   ├── types.ts
│   │   └── useArdoise.ts
│   └── dashboard/
│       └── useDashboardData.ts
│
├── lib/
│   ├── supabase.ts             ← client Supabase (singleton)
│   ├── queryClient.ts          ← instance TanStack Query
│   └── productHelper.ts
│
├── i18n/
│   ├── index.ts                ← config i18next (fr + wo)
│   └── locales/
│       ├── fr.json             ← traductions françaises
│       └── wo.json             ← traductions wolof (à compléter)
│
└── pwa/
    ├── PwaPrompt.tsx
    └── SyncIndicator.tsx
```

---

## 4. Variables d'environnement (`.env`)

```env
VITE_SUPABASE_URL=https://utpgotetbzobsjnhbqkc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # clé publique anon, safe à exposer
VITE_DEV_BYPASS=false           # CRITIQUE — voir section 6
```

**Ne jamais commettre de Service Role Key.** La `ANON_KEY` est publique par design.

---

## 5. Supabase (backend)

| Champ | Valeur |
|-------|--------|
| Project ID | `utpgotetbzobsjnhbqkc` |
| Région | `eu-central-1` |
| Statut | `ACTIVE_HEALTHY` |
| DB host | `db.utpgotetbzobsjnhbqkc.supabase.co` |

### Tables utilisées par le front

| Table | Rôle |
|-------|------|
| `profils` | Rôle utilisateur (`super_admin`, `admin`, `gerant`, `caissier`) |
| `boutiques` | Infos boutique (nom, adresse, gérant) |
| `subscriptions` | Abonnement actif (`plan`, `status`, `expires_at`) |
| `produits` | Catalogue produits (miroir de Dexie) |
| `ventes` | Ventes (miroir de Dexie) |
| `vente_items` | Lignes de vente |
| `ardoises` | Dettes clients |
| `ardoise_paiements` | Paiements partiels |

### Enums DB importants

```
subscription_status : pending | active | expired | cancelled | trial | trial_cancelled
plan_type           : starter | pro | annual
role                : super_admin | admin | gerant | caissier
```

### RPC Supabase utilisées

- `get_trial_status()` → `{ has_trial, status, is_expired }` — vérifie l'essai gratuit

---

## 6. Flux d'authentification

### 6.1 Variable clé : `devBypassEnabled`

```ts
const devBypassEnabled = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false'
```

- `VITE_DEV_BYPASS=false` → `devBypassEnabled = false` même en dev
- Quand `false` : l'app exige une vraie session Supabase
- Quand `true` : une fausse session `admin@samaboutik.dev` est injectée sans credentials

**Ne jamais confondre `import.meta.env.DEV` (toujours vrai en dev) avec `devBypassEnabled` (dépend du flag).**

### 6.2 Séquence au démarrage (App.tsx)

```
App mount
  └─ useAuth() (hook) → écoute onAuthStateChange → charge profil + boutique dans Zustand
  └─ getInitialSession()
       ├─ session en localStorage (sb-*-auth-token) → utilise la vraie session
       ├─ devBypassEnabled && !dev_signed_out → injecte getDevSession()
       └─ sinon → null → affiche LandingPage
  └─ supabase.auth.getSession() (async) → met à jour la session si token valide
  └─ checkSubscription() → détermine subStatus
```

### 6.3 Détermination du `subStatus`

```
session présente ?
  └─ effectiveRole = storeProfile.role || JWT metadata || query DB
  └─ super_admin ou admin ou email admin connu ?
       → subStatus = 'active', activePlan = 'Plan MAX'  ← BYPASS PAYWALL
  └─ dev fake session (id === 'dev-admin-id') ?
       → subStatus = 'active'
  └─ trial actif (get_trial_status RPC) ?
       → subStatus = 'trial'  ← affiche TrialBanner
  └─ subscription active en DB ?
       → subStatus = 'active' ou 'paywall'
```

### 6.4 Transitions de subStatus

```
'checking' → (vérification en cours, affiche spinner)
'active'   → affiche l'application complète
'trial'    → affiche l'application + TrialBanner
'paywall'  → affiche <Abonnement /> uniquement
```

---

## 7. Système de rôles

| Rôle DB | Badge affiché | Icône | Accès |
|---------|---------------|-------|-------|
| `super_admin` | SUPER ADMIN | `military_tech` | Tout + AdminLayout |
| `admin` | SUPER ADMIN | `military_tech` | Tout + AdminLayout |
| `gerant` | Gérant | `manage_accounts` | App complète |
| `caissier` | Caissier | `point_of_sale` | App complète |

### Comptes super admin connus

| Email | Rôle DB | Plan |
|-------|---------|------|
| `elhadjsylla667@gmail.com` | `super_admin` | `annual`, expire `2099-12-31` |
| `cedricbenoitdieme@gmail.com` | `super_admin` | `annual`, expire `2099-12-31` |

Ces deux comptes ont le paywall bypassé **à la fois** par rôle DB ET par email hardcodé dans `App.tsx:258` et `App.tsx:297`.

### Console Admin

Quand `isAdmin === true`, l'app monte `<AdminLayout />` à la place de l'UI normale. L'admin peut en sortir via `onExit`. Un bouton "Retour admin" est disponible dans Settings et Reglages.

---

## 8. Base de données locale (Dexie / IndexedDB)

Nom de la base : `boutikos`

| Table Dexie | Index |
|-------------|-------|
| `produits` | `id, boutique_id, archive, updated_at` |
| `ventes` | `id, boutique_id, created_at, updated_at` |
| `vente_items` | `id, vente_id, produit_id, updated_at` |
| `ardoises` | `id, boutique_id, statut, created_at, updated_at` |
| `ardoise_paiements` | `id, ardoise_id, paid_at, updated_at` |
| `outbox` | `id, table, synced, updatedAt` |

### Outbox pattern

Toute mutation locale passe par `queueMutation(table, op, id, payload)` qui l'écrit dans `outbox` avec `synced: 0`. `useSyncEngine` draine la file quand online.

---

## 9. i18n

- Config : `src/i18n/index.ts`
- Langues : `fr` (défaut) et `wo` (Wolof)
- Détection : `localStorage` (`boutikos_lang`) → `navigator`
- Les packages (`i18next`, `react-i18next`, `i18next-browser-languagedetector`) doivent être installés avant que Vite puisse démarrer

**État actuel :** les fichiers `fr.json` / `wo.json` existent mais aucune string de l'UI n'est encore wrappée en `t()`. C'est du tech debt.

**Ordre d'implémentation recommandé :** nav → abonnement/trial → ventes/stock → ardoises/rapports → réglages

---

## 10. Composants UI — règles importantes

### `TrialBanner`
```tsx
// Interface acceptée :
interface TrialBannerProps {
  onTrialExpired?: () => void;
}

// Usage correct (dans App.tsx) :
{subStatus === 'trial' && (
  <TrialBanner onTrialExpired={() => setSubStatus('paywall')} />
)}

// NE PAS passer trialStatus={...} — prop inexistante, erreur TypeScript
```

### `Login.tsx` — gestion d'erreur

La détection d'erreur réseau utilise un check strict :
```ts
const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
```
Ne pas élargir ce check avec `includes('fetch')` — cela masquerait les vraies erreurs Supabase.

---

## 11. Flux de navigation (onglets)

La navigation est gérée par `activeTab` (state dans `App.tsx`) et `<BottomNav>`.

| TabType | Page |
|---------|------|
| `caisse` | `<Caisse />` |
| `stock` | `<Stock />` |
| `ardoise` | `<Ardoise />` |
| `dashboard` | `<Dashboard />` |
| `settings` | `<Settings />` |
| `subscription` | `<Subscription />` |
| `portal_client` | `<PortalClient />` |

`activeTab` est persisté dans `localStorage('active_tab')`.

---

## 12. Routes spéciales (query params)

| Param URL | Comportement |
|-----------|-------------|
| `?token=<uuid>` | Affiche `<PortalClient token={...} />` (vue publique ardoise client) |
| `?espace=client` | Affiche `<MonEspace />` (espace client connecté) |
| `?role=super_admin` | (dev bypass actif seulement) Override du rôle dev, persisté en localStorage |

---

## 13. Tâches en attente (tech debt)

- **i18n strings** : aucune string UI n'est encore wrappée en `t()`
- **Traductions Wolof** : `wo.json` existe mais vide — nécessite un locuteur wolof
- **Export PDF/Excel** : UI présente dans Dashboard, backend (Edge Function) pas implémenté
- **Limite caissier par plan** : non enforced côté backend
- **Différenciation dashboard par plan** : non implémentée
- **Pub dans PortalClient.tsx** : placeholder — remplacer par une vraie régie quand le domaine est prêt

---

## 14. Commandes utiles

```bash
# Démarrer en dev (port 2000)
npm run dev

# Build de prod
npm run build

# Preview du build
npm run preview

# Installer les dépendances (après git pull ou ajout de packages)
npm install
```

**Toujours relancer `npm run dev` après un `npm install`.** Vite ne recharge pas les nouveaux packages à chaud.

---

## 15. Invariants à ne jamais casser

1. `devBypassEnabled` doit être calculé de la même façon partout (`App.tsx`, `Login.tsx`, `useAuth.ts`) — toujours `import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS !== 'false'`
2. Le paywall bypass pour `super_admin` / `admin` doit rester en place — ces rôles ne doivent jamais voir `<Abonnement />`
3. `TrialBanner` n'accepte que `onTrialExpired` comme prop — ne pas en ajouter sans modifier l'interface du composant
4. La détection d'erreur réseau dans `Login.tsx` doit être `err instanceof TypeError && err.message === 'Failed to fetch'` — toute condition plus large masque les vrais messages d'erreur Supabase
5. Ne jamais supprimer `storageKey: 'boutikos-session'` dans `src/lib/supabase.ts` — les sessions existantes en localStorage seraient cassées
6. `queueMutation()` est la seule porte d'entrée pour les mutations Dexie — ne pas écrire directement dans les tables sans passer par l'outbox
