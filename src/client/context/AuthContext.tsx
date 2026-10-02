import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isTauri } from '../../core/utils/platform';

export type User = {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
};


type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    isGuest: boolean;
    setUser: (user: User | null) => void;
    enableGuestMode: () => void;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // En entorno nativo Tauri (Windows, Linux, Android), operar en modo local por defecto
        if (isTauri()) {
            const savedCloudUser = localStorage.getItem('nout_cloud_user');
            if (savedCloudUser) {
                try {
                    setUser(JSON.parse(savedCloudUser));
                } catch {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setIsLoading(false);
            return;
        }

        fetch('/api/auth/me')
            .then(res => {
                if (!res.ok) throw new Error('Not authenticated');
                return res.json();
            })
            .then(data => {
                if (data.user) {
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            })
            .catch(() => {
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const enableGuestMode = () => {
        localStorage.setItem('nout_guest_mode', 'true');
        setUser(null);
    };

    const logout = async () => {
        try {
            if (user && !isTauri()) {
                await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
            }
            localStorage.removeItem('nout_cloud_user');
            localStorage.removeItem('nout_guest_mode');
            setUser(null);
            if (!isTauri()) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const updateUser = (newUser: User | null) => {
        setUser(newUser);
        if (newUser) {
            localStorage.setItem('nout_cloud_user', JSON.stringify(newUser));
            localStorage.removeItem('nout_guest_mode');
        } else {
            localStorage.removeItem('nout_cloud_user');
        }
    };

    const isGuest = !user;

    return (
        <AuthContext.Provider value={{ user, isLoading, isGuest, setUser: updateUser, enableGuestMode, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
