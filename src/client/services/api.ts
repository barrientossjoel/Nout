import { hc } from 'hono/client';
import type { AppType } from '../../server';
import { isTauri } from '../../core/utils/platform';

export function getApiBaseUrl(): string {
    if (typeof window === 'undefined') return 'https://nout.vercel.app';
    if (
        isTauri() ||
        window.location.protocol === 'tauri:' ||
        window.location.protocol === 'asset:' ||
        window.location.hostname === 'tauri.localhost' ||
        (window.location.hostname === 'localhost' && window.location.port !== '5173')
    ) {
        return 'https://nout.vercel.app';
    }
    return '';
}

export const API_BASE_URL = getApiBaseUrl();

export function getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${getApiBaseUrl()}${cleanPath}`;
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

export async function ensureAuthToken(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh) {
        const existingToken = getAuthToken();
        if (existingToken) return existingToken;
    }

    if (typeof window === 'undefined') return null;
    const savedUserStr = localStorage.getItem('nout_cloud_user');
    if (!savedUserStr) return null;

    try {
        const user = JSON.parse(savedUserStr);
        if (!user?.id) return null;

        const res = await fetch(getApiUrl('/api/auth/recover-session'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
        });

        if (res.ok) {
            const data = await res.json();
            if (data.token) {
                setAuthToken(data.token);
                return data.token;
            }
        }
    } catch (e) {
        console.warn('Failed to recover session token:', e);
    }

    return null;
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
    let isCompleted = false;

    const checkSession = async () => {
        if (isCompleted) return;
        try {
            const res = await fetch(getApiUrl(`/api/auth/mobile-session?flowId=${flowId}`));
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    isCompleted = true;
                    clearInterval(interval);
                    window.removeEventListener('focus', onFocus);
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
    };

    const onFocus = () => {
        checkSession();
    };
    window.addEventListener('focus', onFocus);

    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            if (!isCompleted) {
                onError?.(lang === 'es' ? 'El tiempo de inicio de sesión expiró. Inténtalo de nuevo.' : 'Login session timed out. Please try again.');
            }
            return;
        }
        await checkSession();
    }, 1500);

    return () => {
        isCompleted = true;
        clearInterval(interval);
        window.removeEventListener('focus', onFocus);
    };
}

const client = hc<AppType>(getApiBaseUrl() || '/', {
    headers: () => getAuthHeaders(),
});

export { client };

