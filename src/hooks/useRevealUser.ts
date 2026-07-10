import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { type RevealState } from '../components/admin/MaskedValue';

interface RevealedDetail {
  nom?: string;
  email?: string;
}

export function useRevealUser() {
  const [revealStates, setRevealStates] = useState<Record<string, RevealState>>({});
  const [revealedDetails, setRevealedDetails] = useState<Record<string, RevealedDetail>>({});

  const handleReveal = async (userId: string) => {
    if (revealStates[userId] === 'loading' || revealStates[userId] === 'revealed') return;
    
    setRevealStates(prev => ({ ...prev, [userId]: 'loading' }));
    try {
      const { data, error } = await supabase.rpc('reveal_user_details', { p_user_id: userId });
      if (error) throw error;
      
      const detail = Array.isArray(data) ? data[0] : data;
      const nom = detail?.nom || detail?.nom_complet || detail?.full_name || 'Inconnu';
      const email = detail?.email || detail?.email_complet || 'Inconnu';
      
      setRevealedDetails(prev => ({ ...prev, [userId]: { nom, email } }));
      setRevealStates(prev => ({ ...prev, [userId]: 'revealed' }));
    } catch (err: any) {
      console.error('Erreur lors de la révélation:', err);
      alert(err?.message || "Erreur lors de l'accès aux informations détaillées. Accès refusé.");
      setRevealStates(prev => ({ ...prev, [userId]: 'hidden' }));
    }
  };

  return {
    revealStates,
    revealedDetails,
    handleReveal
  };
}
