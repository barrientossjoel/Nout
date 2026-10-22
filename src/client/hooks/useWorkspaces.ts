import { useState, useCallback, useEffect } from 'react';
import type { WorkspaceRecord, WorkspaceState, LayoutNode } from '../../core/types/notes';
import { isNativeMobile } from '../../core/utils/platform';

const STORAGE_KEYS = {
    WORKSPACES: 'notes-workspaces',
    ACTIVE_ID: 'notes-active-workspace',
    WS_STATE: (id: string) => `notes-ws-state-${id}`
};

const DEFAULT_LAYOUT: LayoutNode = { id: 'root', type: 'dashboard' };

const getDefaultState = (): WorkspaceState => ({
    layout: DEFAULT_LAYOUT,
    currentView: 'dashboard',
    activePaneId: 'root',
    showSidebar: !isNativeMobile(),
    showResizeHandles: !isNativeMobile(),
});

export function useWorkspaces() {
    const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem(STORAGE_KEYS.WORKSPACES);
        if (!saved) return [{ id: 'default', name: 'Default Workspace', createdAt: new Date().toISOString() }];
        return JSON.parse(saved);
    });

    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
        if (typeof window === 'undefined') return 'default';
        const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
        return saved || 'default';
    });

    const [activeWorkspaceState, setActiveWorkspaceState] = useState<WorkspaceState>(() => {
        if (typeof window === 'undefined') return getDefaultState();
        const saved = localStorage.getItem(STORAGE_KEYS.WS_STATE(activeWorkspaceId));
        if (!saved) return getDefaultState();
        try {
            const parsed = JSON.parse(saved);
            if (isNativeMobile()) {
                parsed.showSidebar = false;
            }
            return parsed;
        } catch (e) {
            console.error("Failed to parse workspace state", e);
            return getDefaultState();
        }
    });

    // Save workspaces list whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(workspaces));
    }, [workspaces]);

    // Save activeWorkspaceId whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeWorkspaceId);
    }, [activeWorkspaceId]);

    // Load new workspace state when activeWorkspaceId changes
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.WS_STATE(activeWorkspaceId));
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (isNativeMobile()) parsed.showSidebar = false;
                setActiveWorkspaceState(parsed);
            } catch (e) {
                console.error("Failed to parse workspace state", e);
                setActiveWorkspaceState(getDefaultState());
            }
        } else {
            setActiveWorkspaceState(getDefaultState());
        }
    }, [activeWorkspaceId]);

    const saveWorkspaceState = useCallback((stateOrFn: Partial<WorkspaceState> | ((prev: WorkspaceState) => Partial<WorkspaceState>)) => {
        setActiveWorkspaceState(prev => {
            const updates = typeof stateOrFn === 'function' ? stateOrFn(prev) : stateOrFn;
            const newState = { ...prev, ...updates };
            localStorage.setItem(STORAGE_KEYS.WS_STATE(activeWorkspaceId), JSON.stringify(newState));
            return newState;
        });
    }, [activeWorkspaceId]);

    const createWorkspace = useCallback((name: string) => {
        const newWs: WorkspaceRecord = {
            id: Math.random().toString(36).substring(7),
            name,
            createdAt: new Date().toISOString(),
        };
        setWorkspaces(prev => [...prev, newWs]);
        setActiveWorkspaceId(newWs.id);
    }, []);

    const deleteWorkspace = useCallback((id: string) => {
        setWorkspaces(prev => {
            if (prev.length <= 1) return prev; // Don't delete last workspace
            const newWorkspaces = prev.filter(ws => ws.id !== id);
            if (activeWorkspaceId === id) {
                setActiveWorkspaceId(newWorkspaces[newWorkspaces.length - 1].id);
            }
            localStorage.removeItem(STORAGE_KEYS.WS_STATE(id));
            return newWorkspaces;
        });
    }, [activeWorkspaceId]);

    const renameWorkspace = useCallback((id: string, newName: string) => {
        setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name: newName } : ws));
    }, []);

    const switchWorkspace = useCallback((id: string) => {
        setActiveWorkspaceId(id);
    }, []);

    return {
        workspaces,
        activeWorkspaceId,
        activeWorkspaceState,
        createWorkspace,
        deleteWorkspace,
        renameWorkspace,
        switchWorkspace,
        saveWorkspaceState
    };
}
