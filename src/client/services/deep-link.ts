import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../core/utils/platform';
import { getApiUrl, setAuthToken } from './api';
import type { User } from '../context/AuthContext';

/**
 * Checks for any pending deep link from MainActivity on Android (or other native platforms)
 * and processes authentication parameters if present.
 */
export async function checkAndProcessPendingDeepLink(
  onUserAuthenticated?: (user: User) => void
): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const rawUri = await invoke<string | null>('get_pending_deep_link');
    if (!rawUri || !rawUri.startsWith('nout://')) return false;

    console.info('[DeepLink] Processing incoming URI:', rawUri);
    const parsed = new URL(rawUri.replace('nout://', 'https://nout.local/'));
    const flowId = parsed.searchParams.get('flowId');
    const token = parsed.searchParams.get('token');
    const userId = parsed.searchParams.get('userId');

    if (token) {
      setAuthToken(token);
    }

    if (flowId) {
      const res = await fetch(getApiUrl(`/api/auth/mobile-session?flowId=${flowId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          if (data.token) setAuthToken(data.token);
          onUserAuthenticated?.(data.user);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nout:sync_notes'));
          }
          return true;
        }
      }
    }

    if (userId) {
      const res = await fetch(getApiUrl('/api/auth/recover-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          if (data.token) setAuthToken(data.token);
          onUserAuthenticated?.(data.user);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nout:sync_notes'));
          }
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[DeepLink] Failed to process pending deep link:', err);
  }

  return false;
}
