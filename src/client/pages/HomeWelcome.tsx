import { useState, useEffect } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { VaultSelector } from './welcome/VaultSelector';
import { CloudSyncSection } from './welcome/CloudSyncSection';
import {
  getDefaultVaultPath,
  pickVaultFolder,
  saveVaultPath,
  getSavedVaultPath,
} from '../../core/services/vault';

const I18N = {
  es: {
    version: 'Versión 1.0.0',
    vaultTitle: 'Carpeta de la bóveda (Vault)',
    vaultDesc: 'Ubicación en tu equipo donde se guardarán tus notas y lienzos.',
    browse: 'Examinar',
    syncTitle: 'Iniciar sesión para sincronizar',
    syncDesc: 'Sincroniza tus notas entre dispositivos mediante tu cuenta Nout (opcional).',
    signIn: 'Iniciar sesión',
    connectedAs: 'Conectado como',
    cancel: 'Cancelar',
    logOut: 'Cerrar sesión',
    continueWithoutLogin: 'Continuar sin loguearse',
    continueButton: 'Continuar',
  },
  en: {
    version: 'Version 1.0.0',
    vaultTitle: 'Vault folder location',
    vaultDesc: 'Location on your device where notes and canvas files will be saved.',
    browse: 'Browse',
    syncTitle: 'Log in to sync',
    syncDesc: 'Sync your notes across devices with your Nout account (optional).',
    signIn: 'Log in',
    connectedAs: 'Connected as',
    cancel: 'Cancel',
    logOut: 'Log out',
    continueWithoutLogin: 'Continue without logging in',
    continueButton: 'Continue',
  },
} as const;

export default function HomeWelcome({ onContinue }: { onContinue: () => void }) {
  const { user, logout } = useAuth();
  const [vaultPath, setVaultPath] = useState('');
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [animStage, setAnimStage] = useState<'starting' | 'ready'>('starting');
  const [lang, setLang] = useState<'es' | 'en'>(
    () => (typeof window !== 'undefined' && (localStorage.getItem('closure_lang') as 'es' | 'en')) || 'es'
  );

  const t = I18N[lang];

  useEffect(() => {
    const timer = setTimeout(() => setAnimStage('ready'), 50);
    getDefaultVaultPath().then((def) => setVaultPath(getSavedVaultPath() || def));
    try {
      const rec = localStorage.getItem('nout_recent_vaults');
      if (rec) setRecentPaths(JSON.parse(rec));
    } catch {}
    return () => clearTimeout(timer);
  }, []);

  const handleBrowse = async () => {
    const selected = await pickVaultFolder();
    if (selected) setVaultPath(selected);
  };

  const handleContinue = () => {
    const path = vaultPath || 'Documentos/Nout Vault';
    saveVaultPath(path);
    const updated = [path, ...recentPaths.filter((p) => p !== path)].slice(0, 3);
    localStorage.setItem('nout_recent_vaults', JSON.stringify(updated));
    onContinue();
  };

  const changeLang = (code: 'es' | 'en') => {
    setLang(code);
    localStorage.setItem('closure_lang', code);
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#dedcd7] flex items-center justify-center p-4 sm:p-6 relative selection:bg-neutral-700 overflow-hidden dark">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-neutral-600/[0.03] rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-neutral-600/[0.03] rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl bg-[#141416] border border-[#2b2b2f] rounded-none shadow-2xl overflow-hidden flex flex-col relative z-10">
        {/* Header con logo y versión */}
        <div className="pt-10 pb-6 px-8 flex flex-col items-center justify-center text-center">
          <div
            className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              animStage === 'ready' ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-28 scale-75 opacity-0'
            }`}
          >
            <img src="/icon_cropped.png" alt="Nout Logo" className="w-16 h-16 object-contain mb-3" />
          </div>
          <div className={`transition-all duration-500 delay-150 ${animStage === 'ready' ? 'opacity-100' : 'opacity-0 translate-y-3'}`}>
            <span
              className="text-3xl font-semibold tracking-tight text-[#e6e4df] lowercase block"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              nout
            </span>
            <p className="text-xs text-[#9e9b94] font-mono mt-1">{t.version}</p>
          </div>
        </div>

        {/* Contenido animado */}
        <div
          className={`px-6 sm:px-8 pb-7 transition-all duration-500 delay-200 ${
            animStage === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <div className="divide-y divide-[#27272c] border-t border-b border-[#27272c]">
            <VaultSelector
              path={vaultPath}
              onPathChange={setVaultPath}
              recentPaths={recentPaths}
              onBrowse={handleBrowse}
              title={t.vaultTitle}
              desc={t.vaultDesc}
              browseLabel={t.browse}
            />
            <CloudSyncSection user={user} onLogout={logout} labels={t} />
          </div>

          {/* Footer: Idioma + Botón Continuar */}
          <div className="pt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[#9e9b94]">
              <Globe className="w-3.5 h-3.5 text-[#85827c]" />
              <div className="flex rounded-none bg-[#202025] border border-[#323238] p-0.5 font-mono">
                {(['es', 'en'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => changeLang(code)}
                    className={`px-2 py-0.5 uppercase transition-colors ${
                      lang === code ? 'bg-[#32323a] text-[#dedcd7] font-medium' : 'text-[#85827c] hover:text-[#dedcd7]'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <Button
              id="btn-continue-welcome"
              onClick={handleContinue}
              className="bg-[#dedcd7] text-[#141416] hover:bg-[#eae8e3] rounded-none font-medium px-5 h-10 text-xs flex items-center gap-2 shadow-md shrink-0"
            >
              <span>{user ? t.continueButton : t.continueWithoutLogin}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#141416]" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
