import { hc } from 'hono/client';
import type { AppType } from '../../server';
import { isTauri } from '../../core/utils/platform';

export const API_BASE_URL = isTauri() ? 'https://nout.vercel.app' : '';

export function getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
}

export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nout_auth_token');
}

export function setAuthToken(token: string | null): void {
    if (typeof window === 'undefined') return;
    if (token) {
        localStorage.setItem('nout_auth_token', token);
    } else {
        localStorage.removeItem('nout_auth_token');
    }
}

export function getAuthHeaders(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export type GoogleAuthCallbacks = {
    onStart?: () => void;
    onSuccess: (user: any) => void;
    onError?: (message: string) => void;
    lang?: string;
};

export async function initiateGoogleOAuth({ onStart, onSuccess, onError, lang = 'es' }: GoogleAuthCallbacks): Promise<(() => void) | undefined> {
    if (!isTauri()) {
        window.location.href = '/api/auth/google';
        return;
    }

    onStart?.();

    const flowId = crypto.randomUUID();
    const googleAuthUrl = getApiUrl(`/api/auth/google?flowId=${flowId}&platform=mobile`);

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_external_url', { url: googleAuthUrl });
    } catch {
        window.open(googleAuthUrl, '_blank');
    }

    let attempts = 0;
    const maxAttempts = 80; // 2 minutes (80 * 1.5s)
    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            onError?.(lang === 'es' ? 'El tiempo de inicio de sesión expiró. Inténtalo de nuevo.' : 'Login session timed out. Please try again.');
            return;
        }

        try {
            const res = await fetch(getApiUrl(`/api/auth/mobile-session?flowId=${flowId}`));
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    clearInterval(interval);
                    if (data.token) {
                        setAuthToken(data.token);
                    }
                    onSuccess(data.user);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('nout:sync_notes'));
                    }
                }
            }
        } catch {
            // Continúa reintentando ante intermitencias de red
        }
    }, 1500);

    return () => clearInterval(interval);
}

const client = hc<AppType>(API_BASE_URL || '/', {
    headers: () => getAuthHeaders(),
});

export { client };

