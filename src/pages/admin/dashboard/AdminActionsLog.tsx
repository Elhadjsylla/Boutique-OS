import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Tooltip } from '../../../components/ui/Tooltip';

export const AdminActionsLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogJson, setSelectedLogJson] = useState<any | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('sys_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setLogs(data || []);
      } catch (err) {
        console.error('Erreur fetch logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const formatLogDetails = (action: string, details: Record<string, any>): string => {
    if (!details) return 'Aucun détail';
    try {
      switch (action) {
        case 'user.reveal_details':
        case 'user.reveal':
        case 'user.reveal_masked':
          return `Email ou Nom révélé pour l'utilisateur ID: ${details.target_user_id || details.user_id || 'Inconnu'}`;
        case 'user.invite':
        case 'user.invited':
          return `Invitation envoyée à : ${details.email || 'inconnu'}`;
        case 'user.role_changed':
          return `Rôle de ${details.target_user_id?.slice(0, 8) || 'l\'utilisateur'} changé de "${details.old_role || 'aucun'}" à "${details.new_role || 'nouveau'}"`;
        case 'user.password_reset':
          return `Réinitialisation de mot de passe demandée pour ID: ${details.target_user_id?.slice(0, 8) || 'l\'utilisateur'}`;
        case 'user.moderated':
        case 'user.status_changed':
          return `Compte ${details.target_user_id?.slice(0, 8) || 'l\'utilisateur'} : statut "${details.new_status || details.status || 'inconnu'}" ${details.reason ? `(Raison: ${details.reason})` : ''}`;
        case 'user.deleted':
          return `Compte anonymisé/supprimé ID: ${details.target_user_id?.slice(0, 8) || 'l\'utilisateur'}`;
        case 'boutique.created':
          return `Boutique "${details.nom || details.boutique_nom || 'inconnue'}" créée pour le gérant ${details.gerant_email || ''}`;
        case 'boutique.suspended':
          return `Boutique "${details.boutique_nom || 'inconnue'}" suspendue ${details.reason ? `(Raison: ${details.reason})` : ''}`;
        case 'boutique.reactivated':
          return `Boutique "${details.boutique_nom || 'inconnue'}" réactivée`;
        case 'subscription.updated':
        case 'subscription.adjusted':
          return `Abonnement modifié pour le marchand : formule ${details.new_state?.plan || 'inconnue'} ${details.reason ? `(Raison: ${details.reason})` : ''}`;
        case 'subscription.cancelled':
          return `Abonnement annulé (Fin de période) ${details.reason ? `(Raison: ${details.reason})` : ''}`;
        case 'subscription.reactivated':
          return `Abonnement réactivé pour le marchand`;
        default:
          // Fallback parsing heuristics
          if (details.reason) {
            return `Action effectuée. Motif : ${details.reason}`;
          }
          if (details.email) {
            return `Action sur ${details.email}`;
          }
          return Object.entries(details)
            .filter(([_, v]) => typeof v !== 'object')
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
      }
    } catch (e) {
      return 'Détails non disponibles';
    }
  };

  if (loading) {
    return <div className="h-64 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  return (
    <div className="bg-admin-card rounded-xl border border-admin-border overflow-hidden flex flex-col h-full max-h-[500px]">
      <div className="p-5 border-b border-admin-border bg-admin-surface">
        <h2 className="text-lg font-black tracking-tight text-admin-text">Journal d'Actions Admin (Récent)</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-admin-text-muted text-sm">
            Aucun log récent.
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm table-fixed">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[50%]" />
                  <col className="w-[17%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-admin-surface text-admin-text-muted text-[10px] uppercase tracking-wider font-bold sticky top-0">
                  <tr>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Inspecter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-admin-surface/50 transition-colors">
                      <td className="px-5 py-3 truncate">
                        <span className="font-bold text-admin-text capitalize text-xs">
                          {log.action.replace(/[_.]/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-admin-text-muted truncate">
                        <Tooltip content={formatLogDetails(log.action, log.details)} position="top">
                          <span className="truncate block max-w-full">{formatLogDetails(log.action, log.details)}</span>
                        </Tooltip>
                      </td>
                      <td className="px-5 py-3 text-[10px] text-admin-text-muted uppercase tracking-wider truncate">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Tooltip content="Voir le JSON complet" position="left">
                          <button
                            onClick={() => setSelectedLogJson(log)}
                            className="p-1 hover:bg-admin-surface rounded text-admin-primary-light transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Logs */}
            <div className="md:hidden flex flex-col divide-y divide-admin-border">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-admin-text capitalize text-xs">
                      {log.action.replace(/[_.]/g, ' ')}
                    </span>
                    <span className="text-[9px] text-admin-text-muted font-mono uppercase tracking-wider flex-shrink-0">
                      {new Date(log.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="text-xs text-admin-text-muted flex justify-between items-center gap-4">
                    <span className="truncate flex-1">{formatLogDetails(log.action, log.details)}</span>
                    <button
                      onClick={() => setSelectedLogJson(log)}
                      className="p-1 bg-admin-surface hover:bg-admin-border border border-admin-border/50 rounded flex-shrink-0 text-admin-primary-light text-[10px] font-bold uppercase tracking-wider px-2"
                    >
                      Détails
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* JSON Viewer Modal */}
      {selectedLogJson && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" 
            onClick={() => setSelectedLogJson(null)} 
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-admin-card border border-admin-border rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl z-50 p-5 overflow-hidden text-left">
            <div className="flex justify-between items-center border-b border-admin-border pb-3 mb-4 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-sm font-black uppercase text-admin-primary-light">Inspection de Log</h3>
                <span className="text-[10px] text-admin-text-muted mt-0.5 capitalize font-bold">
                  Action : {selectedLogJson.action.replace(/[_.]/g, ' ')}
                </span>
              </div>
              <button 
                onClick={() => setSelectedLogJson(null)}
                className="w-8 h-8 rounded-xl bg-admin-surface hover:bg-admin-border text-admin-text flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-admin-text-muted uppercase font-bold">Résumé d'événement</span>
                <p className="p-3 bg-admin-surface rounded-xl border border-admin-border/60 text-admin-text font-semibold">
                  {formatLogDetails(selectedLogJson.action, selectedLogJson.details)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-h-[150px]">
                <span className="text-[10px] text-admin-text-muted uppercase font-bold font-mono">Payload JSON (Brut)</span>
                <pre className="p-3.5 bg-admin-surface text-[10px] text-emerald-400 font-mono rounded-xl border border-admin-border/60 overflow-x-auto select-all max-h-64 whitespace-pre">
                  {JSON.stringify(selectedLogJson.details, null, 2)}
                </pre>
              </div>
              <div className="flex justify-between items-center text-[9px] text-admin-text-muted pt-2 border-t border-admin-border/40 font-mono">
                <span>Actor ID: {selectedLogJson.actor_id}</span>
                <span>Date: {new Date(selectedLogJson.created_at).toLocaleString('fr-FR')}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
