import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization requise' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Vérifier l'utilisateur appelant
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Token invalide' }, 401);

    // Vérifier l'abonnement de l'appelant
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

    const { type, scope, boutique_id } = await req.json() as {
      type: 'pdf' | 'excel';
      scope: 'ventes' | 'stock' | 'ardoises';
      boutique_id: string;
    };

    if (!boutique_id) return json({ error: 'ID de boutique requis' }, 400);

    if (type === 'excel') {
      let csvContent = '\ufeff'; // UTF-8 BOM for Excel compatibility
      let filename = `${scope}_export.csv`;

      if (scope === 'stock') {
        const { data: produits } = await supabase
          .from('produits')
          .select('nom, prix, quantite, seuil_alerte')
          .eq('boutique_id', boutique_id)
          .eq('archive', false);

        csvContent += 'Nom Produit;Prix (FCFA);Quantité;Seuil d Alerte\n';
        produits?.forEach(p => {
          csvContent += `"${p.nom.replace(/"/g, '""')}";${p.prix};${p.quantite};${p.seuil_alerte}\n`;
        });
      } else if (scope === 'ardoises') {
        const { data: ardoises } = await supabase
          .from('ardoises')
          .select('client_nom, montant_total, statut')
          .eq('boutique_id', boutique_id);

        csvContent += 'Client;Montant Total (FCFA);Statut\n';
        ardoises?.forEach(a => {
          csvContent += `"${a.client_nom.replace(/"/g, '""')}";${a.montant_total};${a.statut}\n`;
        });
      } else { // ventes
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

    } else { // pdf (returns HTML print-ready page)
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
            <p>Généré le : ${new Date().toLocaleString('fr-FR')}</p>
            <table>
              <thead>
                <tr><th>Produit</th><th>Prix (FCFA)</th><th>Quantité en Stock</th></tr>
              </thead>
              <tbody>
                ${produits?.map(p => `<tr><td>${p.nom}</td><td>${new Intl.NumberFormat('fr-FR').format(p.prix)}</td><td>${p.quantite}</td></tr>`).join('')}
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
            <h1>Rapport des Crédits & Ardoises Clients</h1>
            <p>Généré le : ${new Date().toLocaleString('fr-FR')}</p>
            <table>
              <thead>
                <tr><th>Nom Client</th><th>Crédit Total (FCFA)</th><th>Statut</th></tr>
              </thead>
              <tbody>
                ${ardoises?.map(a => `<tr><td>${a.client_nom}</td><td>${new Intl.NumberFormat('fr-FR').format(a.montant_total)}</td><td>${a.statut === 'soldee' ? 'Soldée' : 'En cours'}</td></tr>`).join('')}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); }</script>
          </body>
          </html>
        `;
      } else { // ventes
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
            <p>Généré le : ${new Date().toLocaleString('fr-FR')}</p>
            <table>
              <thead>
                <tr><th>Date</th><th>Montant (FCFA)</th><th>ID Caissier</th></tr>
              </thead>
              <tbody>
                ${ventes?.map(v => `<tr><td>${new Date(v.created_at).toLocaleString('fr-FR')}</td><td>${new Intl.NumberFormat('fr-FR').format(v.total)}</td><td>${v.caissier_id.slice(0, 8)}</td></tr>`).join('')}
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
    return json({ error: String(err) }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
