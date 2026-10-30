import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '../../core/utils/platform';
import { APP_VERSION } from '../../core/constants/version';

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; currentVersion: string; newVersion: string; apkUrl: string; releaseNotes: string }
  | { status: 'updating'; newVersion: string; apkUrl: string }
  | { status: 'upToDate'; currentVersion: string }
  | { status: 'error'; message: string };

const GITHUB_REPO = 'barrientossjoel/Nout';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const clean2 = v2.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(clean1.length, clean2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = clean1[i] ?? 0;
    const num2 = clean2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function useAppUpdate() {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });

  const triggerUpdateDownload = useCallback(async (apkUrl: string, newVersion: string) => {
    setUpdateState({ status: 'updating', newVersion, apkUrl });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('trigger_app_update', { apkUrl });
    } catch (err) {
      setUpdateState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Error al iniciar la actualización automática',
      });
    }
  }, []);

  const checkForUpdates = useCallback(async (manual = false) => {
    if (!isTauri()) {
      return;
    }

    setUpdateState({ status: 'checking' });

    try {
      let currentVersion = APP_VERSION;
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        currentVersion = await getVersion();
      } catch {}

      const res = await fetch(GITHUB_RELEASES_API, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status} al consultar actualizaciones`);
      }

      const releaseData = await res.json();
      const latestTag = releaseData.tag_name || '';
      const releaseNotes = releaseData.body || '';

      // Buscar asset APK en la release
      const apkAsset = releaseData.assets?.find((asset: { name: string }) =>
        asset.name.endsWith('.apk')
      );

      const apkUrl = apkAsset?.browser_download_url ?? '';

      if (compareVersions(latestTag, currentVersion) > 0 && apkUrl) {
        setUpdateState({
          status: 'available',
          currentVersion,
          newVersion: latestTag,
          apkUrl,
          releaseNotes,
        });
      } else {
        setUpdateState({ status: 'upToDate', currentVersion });
      }
    } catch (err) {
      if (manual) {
        setUpdateState({
          status: 'error',
          message: err instanceof Error ? err.message : 'No se pudo verificar actualizaciones',
        });
      } else {
        setUpdateState({ status: 'idle' });
      }
    }
  }, [triggerUpdateDownload]);

  const applyUpdate = useCallback(async () => {
    if (updateState.status !== 'available') return;
    await triggerUpdateDownload(updateState.apkUrl, updateState.newVersion);
  }, [updateState, triggerUpdateDownload]);

  useEffect(() => {
    if (isTauri()) {
      // Chequeo y actualización automática en segundo plano al arrancar la app
      const timer = setTimeout(() => {
        checkForUpdates(false).catch(() => {});
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [checkForUpdates]);

  return {
    updateState,
    checkForUpdates,
    applyUpdate,
  };
}
