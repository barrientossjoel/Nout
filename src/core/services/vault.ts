import { isTauri } from '../utils/platform';

export interface VaultConfig {
  path: string;
  name: string;
  isDefault: boolean;
}

const VAULT_PATH_KEY = 'nout_vault_path';
const VAULT_INIT_KEY = 'nout_vault_initialized';

/**
 * Obtiene la ruta de la bóveda almacenada localmente
 */
export function getSavedVaultPath(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VAULT_PATH_KEY);
}

/**
 * Guarda la ruta de la bóveda seleccionada
 */
export function saveVaultPath(path: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VAULT_PATH_KEY, path);
  localStorage.setItem(VAULT_INIT_KEY, 'true');
}

/**
 * Comprueba si el usuario ya completó el setup inicial de la bóveda
 */
export function isVaultInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(VAULT_INIT_KEY) === 'true';
}

/**
 * Obtiene la ruta predeterminada de la bóveda según el entorno
 */
export async function getDefaultVaultPath(): Promise<string> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const defaultPath = await invoke<string>('get_default_vault_folder');
      return defaultPath;
    } catch (e) {
      console.warn('Failed to get default vault from Tauri IPC', e);
    }
  }
  return 'Documentos/Nout Vault';
}

/**
 * Abre el diálogo nativo de selección de carpetas del sistema
 */
export async function pickVaultFolder(): Promise<string | null> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const selected = await invoke<string | null>('pick_vault_folder');
      return selected;
    } catch (e) {
      console.error('Error invoking pick_vault_folder', e);
      return null;
    }
  }

  // Fallback para navegador web (File System Access API)
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      return dirHandle.name ? `[Navegador] /${dirHandle.name}` : null;
    } catch {
      return null; // Usuario canceló
    }
  }

  return null;
}
