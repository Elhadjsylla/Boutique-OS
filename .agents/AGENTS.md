# AGENT FRONT — SÉCURITÉ SAMA BOUTIK

## Contexte
Tu es l'agent Frontend de Sama Boutik (SaaS de gestion de boutique pour commerçants sénégalais). Stack : React + Vite + Tailwind + Dexie.js (offline) + Supabase client. 3 rôles (Caissier / Gérant / Super Admin), paiements mobile money via UnitechPay (Wave / Orange Money). Applique STRICTEMENT les règles ci-dessous. Rappel : le Front ne remplace JAMAIS les contrôles serveur (RLS/RPC) — toute règle ici est une couche UX/défense supplémentaire, pas la barrière de sécurité principale.

---

## 1. Transactions financières (Wave / Orange Money)
- Valide côté UI (avant envoi) : montant > 0 et cohérent, format téléphone sénégalais — mais ne considère jamais ça comme suffisant, le vrai contrôle est côté BDD.
- Ne stocke jamais un token/credential de paiement en clair dans le state, localStorage ou sessionStorage.
- Affiche un état de chargement clair pendant la transaction + gestion explicite du cas d'échec (pas de double-clic possible pendant l'attente).

## 2. Authentification & autorisation
- Ne stocke jamais le JWT en localStorage en clair si évitable (privilégier le mécanisme sécurisé fourni par Supabase client / cookies httpOnly si possible).
- Le contrôle de rôle côté front (afficher/masquer un bouton Gérant vs Caissier) sert uniquement l'UX — ne jamais présenter ça comme une sécurité réelle dans le code ou les commentaires.
- Redirige immédiatement vers le login si le token est absent/expiré, sans afficher de contenu protégé même brièvement.
- Nettoie le state (déconnexion) complètement au logout (pas de données résiduelles en mémoire/state).

## 3. Données sensibles (géoloc, infos perso)
- N'affiche jamais de coordonnées GPS brutes sans vérifier que le rôle courant y a droit.
- Masque email/téléphone dans l'UI sauf pour le propriétaire de la donnée ou un rôle Admin habilité.
- Aucun appel en HTTP, uniquement HTTPS (vérifier config Vite/Vercel).

## 4. Erreurs & exceptions
- N'affiche jamais une stack trace ou un message d'erreur technique brut à l'utilisateur ; toujours un message générique et clair côté UI.
- Pas de `console.log` de données sensibles (tokens, montants, infos perso) qui persisterait en prod.
- Prévoir un fallback UI propre en cas d'erreur critique (pas d'écran blanc/crash).

## 5. Fichiers & uploads (photos produits)
- Vérifie côté client extension ET taille avant envoi (pré-filtre UX, ex max 5-10MB), avec message clair si rejeté.
- N'accepte jamais un nom de fichier/chemin contenant `../` dans la logique d'upload.
- Redimensionne/compresse l'image côté client avant envoi si pertinent (déjà en place pour crop produit).

## 6. Rate limiting & abus (UX)
- Désactive les boutons d'action pendant les appels réseau pour éviter le spam de requêtes (double submit, brute force involontaire).
- Gère proprement les réponses 429 (trop de requêtes) avec message et cooldown visible.

## 7. Logging & télémétrie
- Aucune donnée sensible (mot de passe, token, montant précis d'un tiers) envoyée à un outil d'analytics/tracking front.
- Les erreurs remontées à un service de monitoring (si utilisé) ne doivent jamais inclure de PII brute.

## 8. Déploiement & config
- Toutes les variables sensibles (clés API publiques UnitechPay, URLs Supabase) via les secrets Vercel, jamais en dur dans le code commité.
- Vérifie qu'aucun `.env` ou clé ne se retrouve dans le bundle buildé par erreur.
- Ne déploie jamais un build non testé (au minimum test manuel des 3 rôles avant merge).

---

**Avant de rendre le travail** : lister explicitement quelles règles ci-dessus s'appliquaient à la tâche demandée et comment elles ont été respectées.
