import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export const AdminActionsLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
              <table className="w-full text-left text-sm">
                <thead className="bg-admin-surface text-admin-text-muted text-[10px] uppercase tracking-wider font-bold sticky top-0">
                  <tr>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Détails</th>
                    <th className="px-5 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-admin-surface/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-bold text-admin-text capitalize text-xs">
                          {log.action.replace(/[_.]/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-admin-text-muted">
                        <pre className="text-[10px] font-mono bg-admin-surface p-1 rounded whitespace-pre-wrap max-w-xs overflow-hidden">
                          {JSON.stringify(log.details)}
                        </pre>
                      </td>
                      <td className="px-5 py-3 text-right text-[10px] text-admin-text-muted uppercase tracking-wider">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Logs */}
            <div className="md:hidden flex flex-col divide-y divide-admin-border">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col gap-2.5 text-left">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-admin-text capitalize text-xs">
                      {log.action.replace(/[_.]/g, ' ')}
                    </span>
                    <span className="text-[9px] text-admin-text-muted font-mono uppercase tracking-wider flex-shrink-0">
                      {new Date(log.created_at).toLocaleDateString('fr-FR')} {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs text-admin-text-muted">
                    <pre className="text-[9px] font-mono bg-admin-surface/40 p-2.5 rounded-xl whitespace-pre-wrap max-w-full overflow-hidden border border-admin-border/50">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
