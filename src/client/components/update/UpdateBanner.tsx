import React, { useState } from 'react';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import { Button } from '../ui/button';
import { Sparkles, Download, X, Loader2 } from 'lucide-react';

export function UpdateBanner() {
  const { updateState, applyUpdate } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (updateState.status === 'available') {
    return (
      <aside
        aria-label="Notificación de actualización disponible"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 rounded-xl border border-blue-500/30 bg-neutral-900/95 backdrop-blur-md shadow-2xl shadow-blue-950/40 text-neutral-100 animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Nueva versión disponible: {updateState.newVersion}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Versión instalada: {updateState.currentVersion}. Toca para actualizar directamente.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 mt-3.5 pt-2 border-t border-neutral-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="text-xs text-neutral-400 hover:text-neutral-200 h-8 px-3"
          >
            Más tarde
          </Button>
          <Button
            size="sm"
            onClick={applyUpdate}
            className="text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white gap-1.5 h-8 px-3.5 shadow-md shadow-blue-700/20"
          >
            <Download className="w-3.5 h-3.5" />
            Actualizar ahora
          </Button>
        </div>
      </aside>
    );
  }

  if (updateState.status === 'updating') {
    return (
      <aside
        aria-label="Notificación de actualización en curso"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 rounded-xl border border-blue-500/40 bg-neutral-900/95 backdrop-blur-md shadow-2xl text-neutral-100 animate-in fade-in duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Descargando actualización ({updateState.newVersion})...
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                En breve se abrirá el instalador.
              </p>
              {updateState.apkUrl && (
                <a
                  href={updateState.apkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline mt-2 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descarga directa en navegador
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  if (updateState.status === 'error') {
    return (
      <aside
        aria-label="Error en la actualización"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 rounded-xl border border-red-500/40 bg-neutral-900/95 backdrop-blur-md shadow-2xl text-neutral-100 animate-in fade-in duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-red-400">
              Error al actualizar
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {updateState.message}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return null;
}
