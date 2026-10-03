import { Suspense, useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import NotesApp from '../features/notes/components/notes-app';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../components/auth/protected-route';
import { isTauri } from '../../core/utils/platform';
import { isVaultInitialized } from '../../core/services/vault';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Landing from '../pages/Landing';
import HomeWelcome from '../pages/HomeWelcome';
import SharedDocumentView from '../pages/SharedDocumentView';

const RESERVED_ROUTES = new Set([
  '',
  'login',
  'register',
  'welcome',
  'home',
  'landing',
  'api',
  'ws',
  'dashboard',
  'calendar',
  'trash',
  'graph',
  'ai',
  'settings',
]);

const extractSharedDocumentId = (pathname: string): string | null => {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return null;

  if (trimmed.startsWith('share/')) {
    return trimmed.slice(6) || null;
  }

  const [firstPart, ...rest] = trimmed.split('/');
  return rest.length === 0 && !RESERVED_ROUTES.has(firstPart.toLowerCase()) ? firstPart : null;
};

function AppShell() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <NotesApp />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}

export function MainRouter(): ReactElement {
  const [path, setPath] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const { user, isLoading } = useAuth();
  const [vaultReady, setVaultReady] = useState(isVaultInitialized);
  const isDesktop = useMemo(isTauri, []);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleVaultConfigured = useCallback(() => {
    setVaultReady(true);
    window.history.pushState({}, '', '/');
    setPath('/');
  }, []);

  const sharedDocId = useMemo(() => extractSharedDocumentId(path), [path]);

  if (isLoading) {
    return (
      <div className="flex bg-neutral-900 justify-center items-center h-screen w-full text-white">
        Loading...
      </div>
    );
  }

  if (sharedDocId) {
    return <SharedDocumentView documentId={sharedDocId} />;
  }

  switch (path) {
    case '/login':
      return <Login />;

    case '/register':
      return <Register />;

    case '/welcome':
    case '/home':
      return isDesktop
        ? <HomeWelcome onContinue={handleVaultConfigured} />
        : !user ? <Landing /> : <AppShell />;

    case '/':
      return isDesktop
        ? (!vaultReady ? <HomeWelcome onContinue={handleVaultConfigured} /> : <AppShell />)
        : (!user ? <Landing /> : <AppShell />);

    default:
      return <AppShell />;
  }
}
