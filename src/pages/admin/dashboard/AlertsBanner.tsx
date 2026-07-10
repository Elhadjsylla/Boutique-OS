import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Alert {
  id: string;
  type: string;
  message: string;
  severite: 'urgent' | 'attention' | 'info';
  cible_id: string | null;
  created_at: string;
  lue: boolean;
}

export const AlertsBanner: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase.rpc('get_alerts', { p_non_lues_only: true });
      if (error) throw error;
      setAlerts(data || []);
    } catch (err) {
      console.error('Erreur fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Listen to real-time alerts
    const channel = supabase.channel('admin-alerts-dashboard')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const newAlert = payload.new as Alert;
          if (!newAlert.lue) {
            setAlerts((prev) => [newAlert, ...prev].sort((a, b) => {
              // Sort by severity (urgent > attention > info) then date
              const sevOrder = { urgent: 0, attention: 1, info: 2 };
              if (sevOrder[a.severite] !== sevOrder[b.severite]) {
                return sevOrder[a.severite] - sevOrder[b.severite];
              }
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await supabase.rpc('mark_alert_read', { p_alert_id: id });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Erreur mark as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await supabase.rpc('mark_all_alerts_read');
      setAlerts([]);
    } catch (err) {
      console.error('Erreur mark all read:', err);
    }
  };

  if (loading) {
    return <div className="h-12 w-full bg-admin-card animate-pulse rounded-xl mb-6"></div>;
  }

  if (alerts.length === 0) {
    return null; // Don't show banner if no alerts
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs font-black uppercase text-admin-text-muted">
          Alertes système ({alerts.length})
        </h3>
        <button
          onClick={markAllRead}
          className="text-[10px] uppercase font-bold text-admin-primary hover:text-admin-primary-light transition-colors"
        >
          Tout marquer comme lu
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {alerts.map((alert) => {
          const colorConfig = {
            urgent: 'bg-red-500/10 border-red-500/30 text-red-500',
            attention: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
            info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
          }[alert.severite] || 'bg-admin-surface border-admin-border text-admin-text';

          const iconConfig = {
            urgent: 'error',
            attention: 'warning',
            info: 'info',
          }[alert.severite] || 'info';

          return (
            <div
              key={alert.id}
              className={`flex items-start justify-between p-3 rounded-xl border ${colorConfig} transition-all`}
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5">{iconConfig}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{alert.message}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70 mt-1">
                    {new Date(alert.created_at).toLocaleString('fr-FR')} • {alert.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {alert.cible_id && (
                  <button
                    className="p-1.5 bg-black/10 hover:bg-black/20 rounded-lg transition-colors"
                    title="Voir le détail"
                    onClick={() => {
                      // We will implement navigation/open drawer logic here
                      // E.g., emitting an event or calling a prop
                      console.log('Action for alert', alert);
                    }}
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  </button>
                )}
                <button
                  onClick={() => markAsRead(alert.id)}
                  className="p-1.5 bg-black/10 hover:bg-black/20 rounded-lg transition-colors"
                  title="Marquer comme lu"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
