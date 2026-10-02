import { useState } from 'react';
import { Cloud, CheckCircle2, LogOut } from 'lucide-react';
import { Button } from '../../components/ui/button';
import Login from '../Login';

interface CloudSyncSectionProps {
  user: { email?: string | null } | null;
  onLogout: () => void;
  labels: {
    syncTitle: string;
    syncDesc: string;
    signIn: string;
    connectedAs: string;
    cancel: string;
    logOut: string;
  };
}

export function CloudSyncSection({ user, onLogout, labels }: CloudSyncSectionProps) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="py-4">
      {user ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#dedcd7]">Sincronización activa</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xs text-[#9e9b94] mt-0.5">
              {labels.connectedAs} <span className="font-medium text-[#dedcd7]">{user.email}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-xs text-[#9e9b94] hover:text-red-400 hover:bg-red-500/10 h-8 px-3 rounded-none flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {labels.logOut}
          </Button>
        </div>
      ) : showLogin ? (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#dedcd7]">{labels.syncTitle}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogin(false)}
              className="text-xs text-[#9e9b94] hover:text-[#dedcd7] h-7 px-2 rounded-none"
            >
              {labels.cancel}
            </Button>
          </div>
          <div className="p-4 rounded-none bg-[#202025] border border-[#35353d]">
            <Login embedded className="p-0 border-0 bg-transparent shadow-none max-w-none" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-[#dedcd7]">{labels.syncTitle}</h3>
            <p className="text-xs text-[#9e9b94] mt-0.5 leading-relaxed">{labels.syncDesc}</p>
          </div>
          <Button
            id="btn-open-sync-login"
            variant="outline"
            size="sm"
            onClick={() => setShowLogin(true)}
            className="rounded-none h-9 px-4 font-medium bg-[#25252b] hover:bg-[#303037] text-[#dedcd7] hover:text-[#f0eee9] border border-[#383840] shrink-0 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Cloud className="w-3.5 h-3.5 text-[#9e9b94]" />
            {labels.signIn}
          </Button>
        </div>
      )}
    </div>
  );
}
