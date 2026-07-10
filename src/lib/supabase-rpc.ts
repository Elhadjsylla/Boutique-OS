import { supabase } from './supabase';

/**
 * Wrapper for supabase.rpc that catches "JWT expired" errors,
 * forces a synchronous token refresh, and retries the request once.
 */
export async function callRpcWithRetry<T = any>(
  fnName: string,
  args?: Record<string, any>,
  options?: any
): Promise<{ data: T | null; error: any }> {
  // First attempt
  let response = await supabase.rpc(fnName, args, options);

  // If error indicates JWT expiration, attempt to refresh and retry
  if (
    response.error && 
    (
      response.error.message?.toLowerCase().includes('jwt expired') ||
      response.error.code === 'PGRST301' || // PostgREST code for JWT expired/invalid
      response.error.message?.toLowerCase().includes('token is expired')
    )
  ) {
    console.warn(`[Supabase RPC] JWT Expired detected on ${fnName}. Attempting refresh...`);
    
    // Force a synchronous token refresh
    const { error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error(`[Supabase RPC] Session refresh failed:`, refreshError);
      // We return the original error so the UI can handle the disconnection
      return response;
    }

    console.log(`[Supabase RPC] Session refreshed successfully. Retrying ${fnName}...`);
    // Retry the RPC call with the new token
    response = await supabase.rpc(fnName, args, options);
  }

  return response;
}
