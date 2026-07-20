import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Tooltip } from '../../components/ui/Tooltip';

interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedLogJson, setSelectedLogJson] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sys_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs(data || []);
      setIsDemo(false);
    } catch (e: any) {
      console.error("[AdminLogs] Erreur fetch audit logs:", e?.message ?? e);
      setLogs([]);
      setIsDemo(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLogMeta = (action: string) => {
    const meta: Record<string, { label: string; icon: string; color: string }> = {
      'boutique.created': { label: 'Boutique créée', icon: 'store', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      'boutique.suspended': { label: 'Boutique suspendue', icon: 'lock', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
      'boutique.reactivated': { label: 'Boutique réactivée', icon: 'lock_open', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      'boutique.deleted': { label: 'Boutique supprimée', icon: 'delete', color: 'text-red-500 bg-red-600/10 border-red-600/20' },
      'user.role_changed': { label: 'Rôle modifié', icon: 'person', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
      'user.password_reset': { label: 'MDP réinitialisé', icon: 'key', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      'subscription.updated': { label: 'Abonnement modifié', icon: 'credit_card', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
      'subscription.cancelled': { label: 'Abonnement annulé', icon: 'cancel', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
    };
    return meta[action] || { label: action, icon: 'info', color: 'text-admin-text-muted bg-admin-border/30 border-admin-border/50' };
  };

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

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-admin-text uppercase tracking-wider">Logs d'Activité</h1>
          <p className="text-xs text-admin-text-muted">Historique des actions critiques d'administration système.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="h-10 w-10 bg-admin-card hover:bg-admin-surface border border-admin-border text-admin-text rounded-xl active:scale-95 transition-all flex items-center justify-center shadow-sm cursor-pointer"
          title="Rafraîchir les logs"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
      </div>

      {isDemo && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400 text-lg">science</span>
          <div className="flex flex-col">
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Mode Démo</span>
            <span className="text-[10px] text-amber-400/80">Données fictives. La table sys_audit_log n'est pas encore déployée.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 text-admin-text-muted">
          <div className="w-10 h-10 border-4 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 bg-admin-card border border-admin-border rounded-2xl text-center text-admin-text-muted">
          Aucun log d'activité enregistré.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {logs.map(log => {
            const meta = getLogMeta(log.action);
            return (
              <div 
                key={log.id} 
                className="p-4 bg-admin-card border border-admin-border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Icon Indicator */}
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                  </div>
                  
                  <div className="flex flex-col text-left min-w-0 flex-1">
                    <span className="text-xs font-black text-admin-text">{meta.label}</span>
                    <span className="text-[10px] text-admin-text-muted mt-0.5 leading-relaxed truncate">
                      Par : <span className="font-mono">{log.actor_id}</span>
                      {log.target_id && <> • Cible : <span className="font-mono">{log.target_id}</span></>}
                    </span>
                    <Tooltip content={formatLogDetails(log.action, log.details)} position="top">
                      <p className="text-[11px] font-semibold text-admin-text mt-1.5 truncate max-w-lg">
                        {formatLogDetails(log.action, log.details)}
                      </p>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                  <div className="text-left md:text-right flex flex-col items-start md:items-end justify-center font-mono">
                    <span className="text-[10px] font-black text-admin-text-muted">
                      {new Date(log.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-[9px] text-admin-text-muted mt-0.5">
                      {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <Tooltip content="Voir le JSON complet" position="left">
                    <button
                      onClick={() => setSelectedLogJson(log)}
                      className="h-8 px-3 bg-admin-surface hover:bg-admin-border border border-admin-border text-admin-text text-[9px] font-black uppercase tracking-wider rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Détails
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
