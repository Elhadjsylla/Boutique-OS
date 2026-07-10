import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function usePaymentPolling(
  subscriptionId: string | undefined | null,
  onStatusChange: (status: 'active' | 'failed' | 'expired' | 'timeout' | string) => void
) {
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    if (!subscriptionId) return;

    let isMounted = true;
    let intervalId: any;
    let timeoutId: any;

    const checkStatus = async () => {
      if (!isMounted) return;
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('id', subscriptionId)
          .maybeSingle();
        
        if (error) {
          console.error("Polling error:", error);
          return;
        }
        
        // Les statuts finaux possibles : 'active', 'failed', 'expired', 'canceled'
        if (data && data.status && data.status !== 'pending') {
          if (isMounted) {
            onStatusChangeRef.current(data.status);
          }
        }
      } catch (err) {
        console.error("Polling check failed:", err);
      }
    };

    // Poll every 4 seconds
    intervalId = setInterval(checkStatus, 4000);
    
    // Timeout de sécurité après 15 minutes sans changement
    timeoutId = setTimeout(() => {
      if (isMounted) {
        onStatusChangeRef.current('timeout');
      }
    }, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [subscriptionId]);
}
