import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { DetailDrawer } from './DetailDrawer';
import { callRpcWithRetry } from '../../../lib/supabase-rpc';

export const SignalementsTable: React.FC = () => {
  const [signalements, setSignalements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedSignalement, setSelectedSignalement] = useState<any>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replying, setReplying] = useState(false);

  const fetchSignalements = async () => {
    try {
      const { data, error } = await callRpcWithRetry('get_signalements', { 
        p_statut: statusFilter === 'all' ? null : statusFilter,
        p_period: 'all'
      });
      if (error) throw error;
      setSignalements(data || []);
    } catch (err) {
      console.error('Erreur fetch signalements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSignalements();

    const channel = supabase.channel('admin-signalements-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signalements' }, () => {
        fetchSignalements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const openThread = async (sig: any) => {
    setSelectedSignalement(sig);
    setLoadingThread(true);
    try {
      const { data, error } = await callRpcWithRetry('get_signalement_thread', { p_signalement_id: sig.id });
      if (error) throw error;
      setThread(data?.reponses || []);
    } catch (err) {
      console.error('Erreur fetch thread:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  const closeThread = () => {
    setSelectedSignalement(null);
    setThread([]);
    setReplyMessage('');
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedSignalement) return;
    setReplying(true);
    try {
      const { error } = await callRpcWithRetry('repondre_signalement', {
        p_signalement_id: selectedSignalement.id,
        p_message: replyMessage
      });
      if (error) throw error;
      
      setReplyMessage('');
      // Refresh thread
      const { data } = await callRpcWithRetry('get_signalement_thread', { p_signalement_id: selectedSignalement.id });
      setThread(data?.reponses || []);
      
      // Update local state for status if it was "nouveau" it becomes "en_cours" automatically
      if (selectedSignalement.statut === 'nouveau') {
        setSelectedSignalement({ ...selectedSignalement, statut: 'en_cours' });
      }
    } catch (err) {
      console.error('Erreur repondre_signalement:', err);
      alert("Erreur lors de l'envoi de la réponse.");
    } finally {
      setReplying(false);
    }
  };

  const markResolved = async () => {
    if (!selectedSignalement) return;
    setReplying(true);
    try {
      const { error } = await callRpcWithRetry('update_signalement_statut', {
        p_signalement_id: selectedSignalement.id,
        p_statut: 'resolu'
      });
      if (error) throw error;
      setSelectedSignalement({ ...selectedSignalement, statut: 'resolu' });
    } catch (err) {
      console.error('Erreur mark resolved:', err);
    } finally {
      setReplying(false);
    }
  };

  if (loading && signalements.length === 0) {
    return <div className="h-64 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  const getPriorityColor = (prio: string) => {
    if (prio === 'haute') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (prio === 'normale') return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  };

  const getStatusColor = (stat: string) => {
    if (stat === 'nouveau') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (stat === 'en_cours') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-green-500/10 text-green-500 border-green-500/20';
  };

  return (
    <>
      <div className="bg-admin-card rounded-xl border border-admin-border overflow-hidden">
        <div className="p-5 border-b border-admin-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-admin-surface">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Signalements Utilisateurs</h2>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-admin-card border border-admin-border text-admin-text text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-admin-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="nouveau">Nouveau</option>
            <option value="en_cours">En Cours</option>
            <option value="resolu">Résolu</option>
          </select>
        </div>
        
        {signalements.length === 0 ? (
          <div className="p-8 text-center text-admin-text-muted text-sm">
            Aucun signalement trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-admin-surface text-admin-text-muted text-[10px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3">Boutique / User</th>
                  <th className="px-5 py-3">Sujet</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Priorité</th>
                  <th className="px-5 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {signalements.map((sig) => (
                  <tr 
                    key={sig.id} 
                    className="hover:bg-admin-surface/50 transition-colors cursor-pointer"
                    onClick={() => openThread(sig)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-admin-text">{sig.nom_boutique}</span>
                        <span className="text-[10px] text-admin-text-muted">{sig.nom_user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-admin-text">{sig.sujet}</span>
                        <span className="text-[10px] text-admin-text-muted uppercase tracking-wider">{sig.type} • {sig.nb_reponses} réponses</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider ${getStatusColor(sig.statut)}`}>
                        {sig.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider ${getPriorityColor(sig.priorite)}`}>
                        {sig.priorite}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-admin-text-muted">
                      {new Date(sig.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetailDrawer
        isOpen={selectedSignalement !== null}
        onClose={closeThread}
        title="Détail du Signalement"
        width="lg"
      >
        {selectedSignalement && (
          <div className="flex flex-col h-full">
            {/* Header info */}
            <div className="bg-admin-card p-4 rounded-xl border border-admin-border flex flex-col gap-3 mb-6 shrink-0">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-black text-admin-text">{selectedSignalement.sujet}</h3>
                <span className={`px-2 py-1 rounded border text-[10px] uppercase font-bold tracking-wider ${getStatusColor(selectedSignalement.statut)}`}>
                  {selectedSignalement.statut}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-admin-text-muted">
                <span>Par: <strong className="text-admin-text">{selectedSignalement.nom_user}</strong> ({selectedSignalement.nom_boutique})</span>
                <span>Type: <strong className="text-admin-text capitalize">{selectedSignalement.type}</strong></span>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4">
              {loadingThread ? (
                <div className="animate-pulse flex flex-col gap-4">
                  <div className="h-20 bg-admin-card rounded-xl"></div>
                  <div className="h-20 bg-admin-card rounded-xl"></div>
                </div>
              ) : (
                <>
                  {/* First message is the signalement message */}
                  <div className="bg-admin-card p-4 rounded-xl border border-admin-border self-start max-w-[85%]">
                    <span className="text-[10px] font-bold uppercase text-admin-text-muted mb-2 block">
                      {selectedSignalement.nom_user} • {new Date(selectedSignalement.created_at).toLocaleString()}
                    </span>
                    <p className="text-sm text-admin-text whitespace-pre-wrap leading-relaxed">
                      {selectedSignalement.message || '(Le message originel n\'a pas été retourné par le résumé, on utilise juste les réponses si besoin, ou on fait un fetch détaillé si implémenté)'}
                    </p>
                  </div>
                  
                  {/* Replies */}
                  {thread.map((msg: any) => {
                    const isAdmin = msg.auteur_type === 'super_admin' || msg.auteur_type === 'admin';
                    return (
                      <div 
                        key={msg.id}
                        className={`p-4 rounded-xl border max-w-[85%] ${
                          isAdmin 
                            ? 'bg-admin-primary/10 border-admin-primary/20 self-end text-right' 
                            : 'bg-admin-card border-admin-border self-start'
                        }`}
                      >
                        <span className={`text-[10px] font-bold uppercase mb-2 block ${isAdmin ? 'text-admin-primary' : 'text-admin-text-muted'}`}>
                          {msg.nom_auteur} {isAdmin && '(Admin)'} • {new Date(msg.created_at).toLocaleString()}
                        </span>
                        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isAdmin ? 'text-admin-text' : 'text-admin-text'}`}>
                          {msg.message}
                        </p>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Reply Input */}
            {selectedSignalement.statut !== 'resolu' && (
              <div className="shrink-0 bg-admin-card p-4 rounded-xl border border-admin-border flex flex-col gap-3">
                <textarea 
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Écrire une réponse..."
                  className="w-full bg-admin-surface border border-admin-border rounded-xl p-3 text-sm text-admin-text focus:outline-none focus:border-admin-primary resize-none"
                  rows={3}
                  disabled={replying}
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={markResolved}
                    disabled={replying}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                  >
                    Marquer comme Résolu
                  </button>
                  <button
                    onClick={handleReply}
                    disabled={replying || !replyMessage.trim()}
                    className="px-6 py-2 bg-admin-primary text-white text-sm font-bold rounded-xl hover:bg-admin-primary-light transition-colors shadow-lg shadow-admin-primary/20 disabled:opacity-50"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </>
  );
};
