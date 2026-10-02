/**
 * Detecta si la aplicación se está ejecutando dentro del entorno nativo de Tauri v2
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__
  );
}

/**
 * Obtiene la plataforma actual de ejecución
 */
export function getPlatformType(): 'desktop' | 'mobile' | 'web' {
  if (!isTauri()) return 'web';

  const userAgent = navigator.userAgent.toLowerCase();
  if (/android/.test(userAgent)) {
    return 'mobile';
  }

  return 'desktop';
}
