import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

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

  const DEMO_LOGS: AuditLogEntry[] = [
    { id: 'log-001', actor_id: 'usr-004-dddd', action: 'boutique.created', target_type: 'boutique', target_id: 'demo-1', details: { nom: 'Boutique Medina' }, created_at: '2025-06-20T14:30:00Z' },
    { id: 'log-002', actor_id: 'usr-004-dddd', action: 'boutique.suspended', target_type: 'boutique', target_id: 'demo-3', details: { reason: 'Facture impayée', suspended: true }, created_at: '2025-06-18T09:15:00Z' },
    { id: 'log-003', actor_id: 'usr-004-dddd', action: 'subscription.updated', target_type: 'subscription', target_id: 'sub-001', details: { user_id: 'usr-001-aaaa', old_plan: 'starter', new_plan: 'pro' }, created_at: '2025-06-15T11:00:00Z' },
  ];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs(data || []);
      setIsDemo(false);
    } catch (e) {
      console.warn("[AdminLogs] Erreur fetch audit logs, utilisation données démo.", e);
      setLogs(DEMO_LOGS);
      setIsDemo(true);
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
            <span className="text-[10px] text-amber-400/80">Données fictives. La table admin_audit_log n'est pas encore déployée.</span>
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
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Icon Indicator */}
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                  </div>
                  
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-black text-admin-text">{meta.label}</span>
                    <span className="text-[10px] text-admin-text-muted mt-0.5 leading-relaxed truncate">
                      Par : <span className="font-mono">{log.actor_id}</span>
                      {log.target_id && <> • Cible : <span className="font-mono">{log.target_id}</span></>}
                    </span>

                    {/* Details tags */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(log.details).map(([key, val]) => (
                          <span 
                            key={key} 
                            className="px-2 py-0.5 bg-admin-surface border border-admin-border/60 text-admin-text-muted rounded text-[8px] font-mono"
                          >
                            {key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-left md:text-right flex-shrink-0 flex flex-col items-start md:items-end justify-center">
                  <span className="text-[10px] font-black text-admin-text-muted">
                    {new Date(log.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-[9px] font-mono text-admin-text-muted mt-0.5">
                    {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
