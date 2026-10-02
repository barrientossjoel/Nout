import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { isTauri } from '../../../core/utils/platform';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex bg-neutral-900 justify-center items-center h-screen w-full text-white">
        Loading...
      </div>
    );
  }

  // En Tauri nunca redirigir a /login por defecto
  if (!user && !isTauri()) {
    window.location.href = '/login';
    return null;
  }

  return <>{children}</>;
}
