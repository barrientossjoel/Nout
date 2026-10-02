import { Suspense, useEffect, useState } from 'react';
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

function extractSharedDocumentId(pathname: string): string | null {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return null;

  if (trimmed.startsWith('share/')) {
    const id = trimmed.replace(/^share\//, '');
    return id || null;
  }

  const parts = trimmed.split('/');
  if (parts.length === 1) {
    const potentialId = parts[0];
    if (!RESERVED_ROUTES.has(potentialId.toLowerCase())) {
      return potentialId;
    }
  }

  return null;
}

export function MainRouter() {
  const [path, setPath] = useState(window.location.pathname);
  const { user, isLoading } = useAuth();
  const [vaultReady, setVaultReady] = useState(() => isVaultInitialized());

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isLoading) {
    return (
      <div className="flex bg-neutral-900 justify-center items-center h-screen w-full text-white">
        Loading...
      </div>
    );
  }

  // Handle explicit routes
  if (path === '/login') return <Login />;
  if (path === '/register') return <Register />;
  if (path === '/welcome' || path === '/home') {
    return (
      <HomeWelcome
        onContinue={() => {
          setVaultReady(true);
          window.history.pushState({}, '', '/');
          setPath('/');
        }}
      />
    );
  }

  // Handle shared document links (anyone with the link can view without login)
  const sharedDocId = extractSharedDocumentId(path);
  if (sharedDocId) {
    return <SharedDocumentView documentId={sharedDocId} />;
  }

  // Public marketing landing page only on Web when not logged in and vault uninitialized
  if (!user && path === '/' && !isTauri() && !vaultReady) {
    return <Landing />;
  }

  // Pantalla de Bienvenida (Bóveda local arriba y Login/Sync opcional abajo)
  // Se muestra por defecto en el primer inicio de la app o si aún no se inicializó la bóveda
  if (!vaultReady && path === '/') {
    return (
      <HomeWelcome
        onContinue={() => {
          setVaultReady(true);
          window.history.pushState({}, '', '/');
          setPath('/');
        }}
      />
    );
  }

  // Cuando la bóveda está lista: renderizar NotesApp
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
