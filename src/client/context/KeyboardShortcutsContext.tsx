'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShortcutConfig {
    /** Modifier keys that must be held */
    modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]
    /** The primary key (e.g. 'h', 'v', 'q', ' ') */
    key: string
}

export type ShortcutId =
    | 'splitHorizontal'
    | 'splitVertical'
    | 'closePane'
    | 'globalSearch'
    | 'canvasPan'
    | 'canvasDelete'

export type ShortcutsMap = Record<ShortcutId, ShortcutConfig>

// ─── Browser-reserved shortcuts ───────────────────────────────────────────────

/**
 * Common browser shortcuts that, if overridden, may cause UX issues.
 * Normalised to lowercase key.
 */
const BROWSER_RESERVED: ShortcutConfig[] = [
    // Navigation
    { modifiers: ['ctrl'], key: 'l' },
    { modifiers: ['ctrl'], key: 'r' },
    { modifiers: ['ctrl'], key: 't' },
    { modifiers: ['ctrl'], key: 'w' },
    { modifiers: ['ctrl'], key: 'n' },
    { modifiers: ['ctrl', 'shift'], key: 't' },
    { modifiers: ['ctrl', 'shift'], key: 'n' },
    // Zoom
    { modifiers: ['ctrl'], key: '+' },
    { modifiers: ['ctrl'], key: '-' },
    { modifiers: ['ctrl'], key: '0' },
    // Find
    { modifiers: ['ctrl'], key: 'f' },
    { modifiers: ['ctrl'], key: 'g' },
    { modifiers: ['ctrl', 'shift'], key: 'g' },
    // DevTools
    { modifiers: ['ctrl', 'shift'], key: 'i' },
    { modifiers: ['ctrl', 'shift'], key: 'j' },
    { modifiers: ['ctrl', 'shift'], key: 'c' },
    { modifiers: ['ctrl'], key: 'u' },
    // Print / Save / View source
    { modifiers: ['ctrl'], key: 'p' },
    { modifiers: ['ctrl'], key: 's' },
    // Bookmarks
    { modifiers: ['ctrl'], key: 'd' },
    { modifiers: ['ctrl', 'shift'], key: 'b' },
    // History
    { modifiers: ['alt'], key: 'arrowleft' },
    { modifiers: ['alt'], key: 'arrowright' },
    // Address bar
    { modifiers: ['ctrl', 'shift'], key: 'l' },
    // Misc
    { modifiers: ['ctrl'], key: 'a' },
    { modifiers: ['ctrl'], key: 'c' },
    { modifiers: ['ctrl'], key: 'v' },
    { modifiers: ['ctrl'], key: 'x' },
    { modifiers: ['ctrl'], key: 'z' },
    { modifiers: ['ctrl'], key: 'y' },
    { modifiers: ['ctrl'], key: 'k' },
    { modifiers: ['ctrl'], key: 'b' },
    { modifiers: ['ctrl'], key: 'i' },
    { modifiers: ['ctrl'], key: 'e' },
    // Function keys
    { modifiers: [], key: 'f5' },
    { modifiers: [], key: 'f11' },
    { modifiers: [], key: 'f12' },
]

export function isBrowserReserved(config: ShortcutConfig): boolean {
    const key = config.key.toLowerCase()
    const mods = new Set(config.modifiers)
    return BROWSER_RESERVED.some(reserved => {
        if (reserved.key !== key) return false
        const rMods = new Set(reserved.modifiers)
        return (
            mods.size === rMods.size &&
            Array.from(mods).every(m => rMods.has(m))
        )
    })
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SHORTCUTS: ShortcutsMap = {
    splitHorizontal: { modifiers: ['alt'], key: 'h' },
    splitVertical:   { modifiers: ['alt'], key: 'v' },
    closePane:       { modifiers: ['alt'], key: 'q' },
    globalSearch:    { modifiers: ['alt'], key: 'b' },
    canvasPan:       { modifiers: [], key: ' ' },
    canvasDelete:    { modifiers: [], key: 'delete' },
}

const STORAGE_KEY = 'app-keyboard-shortcuts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFromStorage(): ShortcutsMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_SHORTCUTS
        return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) }
    } catch {
        return DEFAULT_SHORTCUTS
    }
}

function saveToStorage(map: ShortcutsMap): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch { /* ignore */ }
}

/**
 * Returns true when a keyboard event matches the given shortcut config.
 */
export function matchesShortcut(e: KeyboardEvent, config: ShortcutConfig): boolean {
    const key = e.key.toLowerCase()
    if (key !== config.key.toLowerCase()) return false
    const hasCtrl  = config.modifiers.includes('ctrl')
    const hasAlt   = config.modifiers.includes('alt')
    const hasShift = config.modifiers.includes('shift')
    const hasMeta  = config.modifiers.includes('meta')
    return (
        e.ctrlKey  === hasCtrl  &&
        e.altKey   === hasAlt   &&
        e.shiftKey === hasShift &&
        e.metaKey  === hasMeta
    )
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface KeyboardShortcutsContextValue {
    shortcuts: ShortcutsMap
    setShortcut: (id: ShortcutId, config: ShortcutConfig) => void
    resetShortcut: (id: ShortcutId) => void
    resetAll: () => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | undefined>(undefined)

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
    const [shortcuts, setShortcuts] = useState<ShortcutsMap>(loadFromStorage)

    // Persist whenever shortcuts change
    useEffect(() => {
        saveToStorage(shortcuts)
    }, [shortcuts])

    const setShortcut = useCallback((id: ShortcutId, config: ShortcutConfig) => {
        setShortcuts(prev => ({ ...prev, [id]: config }))
    }, [])

    const resetShortcut = useCallback((id: ShortcutId) => {
        setShortcuts(prev => ({ ...prev, [id]: DEFAULT_SHORTCUTS[id] }))
    }, [])

    const resetAll = useCallback(() => {
        setShortcuts(DEFAULT_SHORTCUTS)
    }, [])

    return (
        <KeyboardShortcutsContext.Provider value={{ shortcuts, setShortcut, resetShortcut, resetAll }}>
            {children}
        </KeyboardShortcutsContext.Provider>
    )
}

const NOOP = () => {}

const DEFAULT_CONTEXT_VALUE: KeyboardShortcutsContextValue = {
    shortcuts: DEFAULT_SHORTCUTS,
    setShortcut: NOOP,
    resetShortcut: NOOP,
    resetAll: NOOP,
}

export function useKeyboardShortcuts(): KeyboardShortcutsContextValue {
    const ctx = useContext(KeyboardShortcutsContext)
    return ctx ?? DEFAULT_CONTEXT_VALUE
}
