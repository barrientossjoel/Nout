import { hc } from 'hono/client';
import type { AppType } from '../../server';
import { isTauri } from '../../core/utils/platform';

export const API_BASE_URL = isTauri() ? 'https://nout.vercel.app' : '';

export function getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
}

const client = hc<AppType>(API_BASE_URL || '/');

export { client };
