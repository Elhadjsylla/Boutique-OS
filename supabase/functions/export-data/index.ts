import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ExportDataSchema = z.object({
  type: z.enum(['pdf', 'excel']),
  scope: z.enum(['ventes', 'stock', 'ardoises']),
  boutique_id: z.string().uuid('ID de boutique invalide'),
});

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization requise' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Token invalide' }, 401);

    // Vérifier l'abonnement (Pro/Annuel uniquement)
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('plan, status, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !sub || !['pro', 'annual'].includes(sub.plan)) {
      return json({ error: 'Fonctionnalité réservée aux abonnés Pro ou Annuel' }, 403);
    }

    const payload = await req.json();
    const parseResult = ExportDataSchema.safeParse(payload);
    if (!parseResult.success) {
      return json({ error: parseResult.error.errors[0].message }, 400);
    }
    const { type, scope, boutique_id } = parseResult.data;

    // Vérifier que l'appelant est bien gérant/admin de cette boutique
    const { data: callerProfil } = await supabase
      .from('profils')
      .select('role, boutique_id')
      .eq('id', user.id)
      .single();

    if (!callerProfil) return json({ error: 'Profil introuvable' }, 403);
    if (callerProfil.role !== 'super_admin' && callerProfil.boutique_id !== boutique_id) {
      return json({ error: 'Accès refusé à cette boutique' }, 403);
    }

    // 20 exports max par heure par utilisateur
    const { allowed } = await checkRateLimit(`export-data:${user.id}`, 20, 3600);
    if (!allowed) return json({ error: 'Trop de requêtes, réessayez dans une heure' }, 429);

    if (type === 'excel') {
      let csvContent = '﻿'; // UTF-8 BOM for Excel compatibility
      const filename = `${scope}_export.csv`;

      if (scope === 'stock') {
        const { data: produits } = await supabase
          .from('produits')
          .select('nom, prix, quantite, seuil_alerte')
          .eq('boutique_id', boutique_id)
          .eq('archive', false);

        csvContent += 'Nom Produit;Prix (FCFA);Quantité;Seuil d Alerte\n';
        produits?.forEach(p => {
          csvContent += `"${String(p.nom ?? '').replace(/"/g, '""')}";${p.prix};${p.quantite};${p.seuil_alerte}\n`;
        });
      } else if (scope === 'ardoises') {
        const { data: ardoises } = await supabase
          .from('ardoises')
          .select('client_nom, montant_total, statut')
          .eq('boutique_id', boutique_id);

        csvContent += 'Client;Montant Total (FCFA);Statut\n';
        ardoises?.forEach(a => {
          csvContent += `"${String(a.client_nom ?? '').replace(/"/g, '""')}";${a.montant_total};${a.statut}\n`;
        });
      } else {
        const { data: ventes } = await supabase
          .from('ventes')
          .select('total, created_at, caissier_id')
          .eq('boutique_id', boutique_id);

        csvContent += 'Date;Montant Total (FCFA);ID Caissier\n';
        ventes?.forEach(v => {
          csvContent += `${new Date(v.created_at).toLocaleString('fr-FR')};${v.total};${v.caissier_id}\n`;
        });
      }

      return new Response(csvContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });

    } else { // pdf (HTML print-ready)
      let htmlContent = '';

      if (scope === 'stock') {
        const { data: produits } = await supabase
          .from('produits')
          .select('nom, prix, quantite')
          .eq('boutique_id', boutique_id)
          .eq('archive', false);

        htmlContent = `
          <html>
          <head>
            <title>Rapport de Stock — Sama Boutik</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #333; }
              h1 { color: #1a3c5e; border-bottom: 2px solid #1a3c5e; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Rapport d'Inventaire des Stocks</h1>
            <p>Généré le : ${escHtml(new Date().toLocaleString('fr-FR'))}</p>
            <table>
              <thead>
                <tr><th>Produit</th><th>Prix (FCFA)</th><th>Quantité en Stock</th></tr>
              </thead>
              <tbody>
                ${produits?.map(p => `<tr><td>${escHtml(p.nom)}</td><td>${new Intl.NumberFormat('fr-FR').format(p.prix)}</td><td>${p.quantite}</td></tr>`).join('') ?? ''}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); }</script>
          </body>
          </html>
        `;
      } else if (scope === 'ardoises') {
        const { data: ardoises } = await supabase
          .from('ardoises')
          .select('client_nom, montant_total, statut')
          .eq('boutique_id', boutique_id);

        htmlContent = `
          <html>
          <head>
            <title>Rapport des Ardoises — Sama Boutik</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #333; }
              h1 { color: #ba1a1a; border-bottom: 2px solid #ba1a1a; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Rapport des Crédits &amp; Ardoises Clients</h1>
            <p>Généré le : ${escHtml(new Date().toLocaleString('fr-FR'))}</p>
            <table>
              <thead>
                <tr><th>Nom Client</th><th>Crédit Total (FCFA)</th><th>Statut</th></tr>
              </thead>
              <tbody>
                ${ardoises?.map(a => `<tr><td>${escHtml(a.client_nom)}</td><td>${new Intl.NumberFormat('fr-FR').format(a.montant_total)}</td><td>${a.statut === 'soldee' ? 'Soldée' : 'En cours'}</td></tr>`).join('') ?? ''}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); }</script>
          </body>
          </html>
        `;
      } else {
        const { data: ventes } = await supabase
          .from('ventes')
          .select('total, created_at, caissier_id')
          .eq('boutique_id', boutique_id);

        htmlContent = `
          <html>
          <head>
            <title>Rapport des Ventes — Sama Boutik</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #333; }
              h1 { color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Rapport Général des Ventes</h1>
            <p>Généré le : ${escHtml(new Date().toLocaleString('fr-FR'))}</p>
            <table>
              <thead>
                <tr><th>Date</th><th>Montant (FCFA)</th><th>ID Caissier</th></tr>
              </thead>
              <tbody>
                ${ventes?.map(v => `<tr><td>${escHtml(new Date(v.created_at).toLocaleString('fr-FR'))}</td><td>${new Intl.NumberFormat('fr-FR').format(v.total)}</td><td>${escHtml(v.caissier_id?.slice(0, 8))}</td></tr>`).join('') ?? ''}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); }</script>
          </body>
          </html>
        `;
      }

      return new Response(htmlContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html;charset=utf-8'
        }
      });
    }

  } catch (err) {
    console.error('export-data error:', err);
    return json({ error: 'Une erreur interne est survenue' }, 500);
  }
});

function escHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
