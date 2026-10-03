'use client'

import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../../components/ui/dialog"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Search, Sun, Moon, Monitor, ChevronLeft, RotateCcw, Folder } from "lucide-react"
import { cn } from "../../lib/utils/utils"
import { useTheme } from "../theme-provider"
import { useMediaQuery } from "../../hooks/useMediaQuery"
import { useAuth } from "../../context/AuthContext"
import { useLanguage } from "../../context/LanguageContext"
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar"
import { CollaborationSettings } from "./collaboration-settings"
import { ShortcutEditorRow } from "./shortcut-editor"
import { useKeyboardShortcuts, type ShortcutId } from "../../context/KeyboardShortcutsContext"
import { AiSettings } from "./ai-settings"
import { pickVaultFolder, saveVaultPath } from "../../../core/services/vault"
import { isTauri } from "../../../core/utils/platform"
import Login from "../../pages/Login"

interface ShortcutItem {
    label: string
    keys: string[]
}

interface ShortcutCategory {
    name: string
    items: ShortcutItem[]
}

const SHORTCUTS = [
    {
        name: "shortcutWorkspace",
        items: [
            { label: "labelResizePane", keys: ["keyAlt", "+", "keyDrag"] },
            { label: "labelCloseTab", keys: ["keyMiddleClick"] },
        ]
    },
    {
        name: "shortcutCanvas",
        items: [
            { label: "labelPanCamera", keys: ["keySpace", "+", "keyDrag"] },
            { label: "labelOpenNewTab", keys: ["keyMiddleClick"] },
            { label: "labelDeleteNodes", keys: ["keyDelete"] },
        ]
    },
    {
        name: "shortcutEditorNotes",
        items: [
            { label: "labelCommandMenu", keys: ["/"] },
            { label: "labelMentionDoc", keys: ["@"] },
        ]
    }
] as const;

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    showResizeHandles: boolean
    onShowResizeHandlesChange: (show: boolean) => void
}

export function SettingsDialog({
    open,
    onOpenChange,
    showResizeHandles,
    onShowResizeHandlesChange
}: SettingsDialogProps) {
    const { t, language, setLanguage } = useLanguage()
    const [searchQuery, setSearchQuery] = React.useState("")
    const [activeTab, setActiveTab] = React.useState("account")

    // UI State for mobile navigation
    const [showMobileDetail, setShowMobileDetail] = React.useState(false)

    const { theme, setTheme } = useTheme()
    const { user, logout } = useAuth()
    const isMobile = useMediaQuery('(max-width: 768px)')
    const { shortcuts, setShortcut, resetShortcut, resetAll } = useKeyboardShortcuts()

    const [showLogin, setShowLogin] = React.useState(false);
    const [vaultPath, setVaultPath] = React.useState(() => {
        return localStorage.getItem('nout_vault_path') || 'Documentos/Nout Vault';
    });

    const handleBrowseVault = async () => {
        const selected = await pickVaultFolder();
        if (selected) {
            setVaultPath(selected);
            saveVaultPath(selected);
        }
    };

    const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setVaultPath(val);
        saveVaultPath(val);
    };

    const normalizedShortcuts = React.useMemo(() => {
        return SHORTCUTS.map(category => ({
            name: t(category.name as any),
            items: category.items.map(item => ({
                label: t(item.label as any),
                keys: item.keys.map(key => t(key as any))
            }))
        }))
    }, [t]);

    const filteredShortcuts = React.useMemo(() => {
        return normalizedShortcuts.map(category => ({
            ...category,
            items: category.items.filter(item =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.keys.some(key => key.toLowerCase().includes(searchQuery.toLowerCase())) ||
                category.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })).filter(category => category.items.length > 0)
    }, [normalizedShortcuts, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    const navCategories = [
        {
            name: t('general'),
            items: [
                { id: "account", label: t('account') },
                { id: "appearance", label: t('appearance') },
                { id: "ai", label: "AI Agents" },
                { id: "shortcuts", label: t('shortcuts') },
                { id: "collaboration", label: t('collaboration') as string },
            ]
        }
    ];

    const hasSearchResults = filteredShortcuts.length > 0 ||
        t('appearance').toLowerCase().includes(searchQuery.toLowerCase()) ||
        t('account').toLowerCase().includes(searchQuery.toLowerCase());

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (e.target.value.trim().length > 0) {
            setShowMobileDetail(true);
        }
    }

    const handleTabSelect = (id: string) => {
        setActiveTab(id);
        setSearchQuery("");
        setShowMobileDetail(true);
    };

    const handleBack = () => {
        setShowMobileDetail(false);
        if (isSearching) {
            setSearchQuery("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) setShowMobileDetail(false); // Reset on close
        }}>
            <DialogContent
                className="w-[clamp(320px,95vw,900px)] h-[clamp(400px,85vh,800px)] max-w-none p-0 gap-0 overflow-hidden flex flex-col sm:flex-row rounded-xl border border-foreground/10 shadow-2xl bg-background"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* Visual hidden header for accessibility */}
                <DialogHeader className="sr-only">
                    <DialogTitle>{t('settings')}</DialogTitle>
                    <DialogDescription>{t('managePreferences')}</DialogDescription>
                </DialogHeader>

                {/* Sidebar (Master View) */}
                <div className={cn(
                    "w-full sm:w-[clamp(240px,25vw,280px)] bg-muted/20 sm:border-r border-border shrink-0 flex-col",
                    showMobileDetail ? "hidden sm:flex" : "flex flex-1 sm:flex-none"
                )}>
                    <div className="p-[clamp(1rem,3vw,1.5rem)] pb-2 flex-shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('searchSettings')}
                                className="pl-9 bg-background/50 border-input focus-visible:ring-primary/20 rounded-md text-[clamp(13px,1.5vw,14px)] h-9"
                                value={searchQuery}
                                onChange={handleSearch}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto py-2 px-[clamp(0.75rem,2vw,1rem)] space-y-[clamp(1rem,3vw,1.5rem)]">
                        {navCategories.map(cat => (
                            <div key={cat.name} className="space-y-[clamp(0.25rem,1vw,0.5rem)]">
                                <h4 className="px-2 text-[clamp(10px,1.2vw,11px)] font-semibold text-muted-foreground mb-2 uppercase tracking-widest">{cat.name}</h4>
                                {cat.items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleTabSelect(item.id)}
                                        className={cn(
                                            "w-full flex items-center h-8 sm:h-9 px-2 text-[clamp(13px,1.5vw,14px)] rounded-md transition-colors",
                                            activeTab === item.id && !isSearching
                                                ? "bg-muted text-foreground font-medium"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area (Detail View) */}
                <div className={cn(
                    "flex-1 flex-col bg-background relative overflow-hidden",
                    showMobileDetail ? "flex" : "hidden sm:flex"
                )}>
                    <div className="h-14 border-b border-border flex items-center px-[clamp(1rem,4vw,2rem)] shrink-0 gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="sm:hidden h-8 w-8 -ml-2"
                            onClick={handleBack}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <span className="text-[clamp(11px,1.5vw,12px)] font-medium text-muted-foreground truncate">
                            {t('settings')} <span className="mx-1 sm:mx-2">&gt;</span> <span className="text-foreground capitalize">{isSearching ? t('matchingResults') : (activeTab === 'ai' ? 'AI Agents' : t(activeTab as any))}</span>
                        </span>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <div className="p-[clamp(1.25rem,5vw,2.5rem)] max-w-3xl mx-auto space-y-[clamp(1.5rem,4vw,2.5rem)]">

                            {/* Account Tab Content */}
                            {(!isSearching && activeTab === 'account') && (
                                <div className="space-y-[clamp(1.5rem,4vw,2.5rem)] animate-in fade-in duration-300">
                                    {/* Sección Mi Perfil / Cuenta */}
                                    <div>
                                        <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground mb-[clamp(0.75rem,2vw,1rem)]">{t('myProfile')}</h3>
                                        {user ? (
                                            <div className="flex items-center justify-between p-[clamp(0.75rem,2vw,1rem)] rounded-lg border border-border bg-card gap-4">
                                                <div className="flex flex-row items-center gap-[clamp(0.75rem,2vw,1rem)] min-w-0">
                                                    <Avatar className="h-[clamp(2.5rem,5vw,3rem)] w-[clamp(2.5rem,5vw,3rem)] rounded-md border border-border shrink-0">
                                                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                                                        <AvatarFallback className="rounded-md bg-muted text-muted-foreground">{user.name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-semibold text-[clamp(13px,1.5vw,15px)] text-foreground truncate">{user.name}</span>
                                                        <span className="text-[clamp(11px,1.2vw,13px)] text-muted-foreground truncate">{user.email}</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-md shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                                                    onClick={logout}
                                                >
                                                    {t('logOut')}
                                                </Button>
                                            </div>
                                        ) : showLogin ? (
                                            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium text-foreground">
                                                        {language === 'es' ? 'Iniciar sesión para sincronizar' : 'Log in to sync'}
                                                    </h4>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                                                        onClick={() => setShowLogin(false)}
                                                    >
                                                        {language === 'es' ? 'Cancelar' : 'Cancel'}
                                                    </Button>
                                                </div>
                                                <Login embedded className="p-0 border-0 bg-transparent shadow-none max-w-none" />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="text-sm font-medium text-foreground">
                                                        {language === 'es' ? 'Iniciar sesión para sincronizar' : 'Log in to sync'}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {language === 'es' 
                                                            ? 'Sincroniza tus notas en la nube entre tus dispositivos (opcional).' 
                                                            : 'Sync your notes across devices (optional).'}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0 text-xs px-4"
                                                    onClick={() => setShowLogin(true)}
                                                >
                                                    {language === 'es' ? 'Iniciar sesión' : 'Log in'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Vault / Bóveda Local: Input + botón Cambiar (Solo en la app nativa Tauri) */}
                                    {isTauri() && (
                                        <div>
                                            <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground mb-[clamp(0.75rem,2vw,1rem)]">
                                                {language === 'es' ? 'Bóveda Local' : 'Local Vault'}
                                            </h3>
                                            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground block">
                                                    {language === 'es' ? 'Carpeta de la Bóveda (Vault)' : 'Vault Folder'}
                                                </label>
                                                <div className="flex gap-2 items-center">
                                                    <Input
                                                        value={vaultPath}
                                                        onChange={handlePathChange}
                                                        placeholder="Ruta a la carpeta del vault..."
                                                        className="font-mono text-xs bg-background border-border"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="shrink-0 text-xs px-4 h-9"
                                                        onClick={handleBrowseVault}
                                                    >
                                                        {language === 'es' ? 'Cambiar' : 'Change'}
                                                    </Button>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {language === 'es' 
                                                            ? 'Tus notas y datos locales se guardan en esta carpeta.' 
                                                            : 'Your notes and local data are stored in this folder.'}
                                                    </p>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 shrink-0"
                                                        onClick={() => {
                                                            onOpenChange(false);
                                                            window.history.pushState({}, '', '/welcome');
                                                            window.dispatchEvent(new PopStateEvent('popstate'));
                                                        }}
                                                    >
                                                        {language === 'es' ? 'Ver pantalla de inicio' : 'Open welcome screen'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Appearance Tab Content */}
                            {(!isSearching && activeTab === 'appearance') && (
                                <div className="space-y-[clamp(1.5rem,4vw,2.5rem)] animate-in fade-in duration-300">
                                    <div>
                                        <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground mb-[clamp(0.75rem,2vw,1rem)]">{t('appearance')}</h3>
                                        <div className="rounded-lg border border-border overflow-hidden bg-card divide-y divide-border">
                                            {/* Language switch */}
                                            <div className="flex items-center justify-between p-[clamp(0.75rem,2vw,1rem)] gap-4">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[clamp(13px,1.5vw,14px)] font-medium text-foreground">{t('switchLanguage')}</span>
                                                    <span className="text-[clamp(11px,1.2vw,12px)] text-muted-foreground mt-1 hidden sm:block">{t('switchLanguageDesc')}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-muted/50 border border-border p-0.5 rounded-md shrink-0">
                                                    <Button variant={language === "en" ? "secondary" : "ghost"} size="sm" className="h-[clamp(1.5rem,3vw,1.75rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] text-xs" onClick={() => setLanguage("en")}>
                                                        <span className="hidden sm:inline">{t('english')}</span><span className="inline sm:hidden">EN</span>
                                                    </Button>
                                                    <Button variant={language === "es" ? "secondary" : "ghost"} size="sm" className="h-[clamp(1.5rem,3vw,1.75rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] text-xs" onClick={() => setLanguage("es")}>
                                                        <span className="hidden sm:inline">{t('spanish')}</span><span className="inline sm:hidden">ES</span>
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between p-[clamp(0.75rem,2vw,1rem)] gap-4">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[clamp(13px,1.5vw,14px)] font-medium text-foreground">{t('switchTheme')}</span>
                                                    <span className="text-[clamp(11px,1.2vw,12px)] text-muted-foreground mt-1 hidden sm:block">{t('switchThemeDesc')}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-muted/50 border border-border p-0.5 rounded-md shrink-0">
                                                    <Button variant={theme === "light" ? "secondary" : "ghost"} size="sm" className="h-[clamp(1.5rem,3vw,1.75rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] text-xs" onClick={() => setTheme("light")}>
                                                        <Sun className="h-3 w-3 sm:mr-1.5" /> <span className="hidden sm:inline">{t('light')}</span>
                                                    </Button>
                                                    <Button variant={theme === "dark" ? "secondary" : "ghost"} size="sm" className="h-[clamp(1.5rem,3vw,1.75rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] text-xs" onClick={() => setTheme("dark")}>
                                                        <Moon className="h-3 w-3 sm:mr-1.5" /> <span className="hidden sm:inline">{t('dark')}</span>
                                                    </Button>
                                                    <Button variant={theme === "system" ? "secondary" : "ghost"} size="sm" className="h-[clamp(1.5rem,3vw,1.75rem)] px-[clamp(0.5rem,1.5vw,0.75rem)] text-xs" onClick={() => setTheme("system")}>
                                                        <Monitor className="h-3 w-3 sm:mr-1.5" /> <span className="hidden sm:inline">{t('system')}</span>
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Resize handles */}
                                            <div className="flex items-center justify-between p-[clamp(0.75rem,2vw,1rem)] gap-4">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[clamp(13px,1.5vw,14px)] font-medium text-foreground">{t('windowResizeHandles')}</span>
                                                    <span className="text-[clamp(11px,1.2vw,12px)] text-muted-foreground mt-1 hidden sm:block">{t('windowResizeHandlesDesc')}</span>
                                                </div>
                                                <Button
                                                    variant={showResizeHandles ? "default" : "outline"}
                                                    size="sm"
                                                    className="rounded-md shrink-0"
                                                    onClick={() => onShowResizeHandlesChange(!showResizeHandles)}
                                                >
                                                    {showResizeHandles ? t('enabled') : t('disabled')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Agent Tab Content */}
                            {(!isSearching && activeTab === 'ai') && (
                                <AiSettings />
                            )}

                            {/* Shortcuts Content */}
                            {(!isSearching && activeTab === 'shortcuts') && (
                                <ShortcutsTab
                                    shortcuts={shortcuts}
                                    onSave={setShortcut}
                                    onReset={resetShortcut}
                                    onResetAll={resetAll}
                                />
                            )}

                            {/* Collaboration Content */}
                            {(!isSearching && activeTab === 'collaboration') && (
                                <CollaborationSettings />
                            )}

                            {/* Search Results */}
                            {isSearching && hasSearchResults && (
                                <div className="space-y-[clamp(1.25rem,3vw,1.5rem)] animate-in fade-in duration-300">
                                    <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground mb-[clamp(0.75rem,2vw,1rem)]">{t('matchingResults')}</h3>
                                    {/* Show a simplified list of results if searching */}
                                    <p className="text-[clamp(12px,1.5vw,14px)] text-muted-foreground">{t('resultsFiltered')}</p>

                                    <div className="grid gap-[clamp(0.75rem,1.5vw,1rem)]">
                                        {filteredShortcuts.map((category, idx) => (
                                            <div key={category.name} className={cn("space-y-[clamp(0.5rem,1.5vw,0.75rem)]", idx > 0 && "pt-3 border-t border-border")}>
                                                <h5 className="text-[clamp(10px,1.2vw,11px)] font-bold text-muted-foreground uppercase tracking-widest">{category.name}</h5>
                                                <div className="grid gap-2.5">
                                                    {category.items.map((item) => (
                                                        <div key={item.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-2 bg-muted/20 rounded border border-border/50">
                                                            <span className="text-[clamp(13px,1.5vw,14px)] text-foreground/80">{item.label}</span>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {item.keys.map((key, kIdx) => (
                                                                    <React.Fragment key={kIdx}>
                                                                        {key === "+" ? (
                                                                            <span className="text-muted-foreground/50 text-[clamp(10px,1.2vw,12px)] font-bold">+</span>
                                                                        ) : (
                                                                            <Badge variant="outline" className="h-6 px-1.5 font-mono text-[clamp(9px,1vw,10px)] border-border bg-muted/30">
                                                                                {key}
                                                                            </Badge>
                                                                        )}
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isSearching && !hasSearchResults && (
                                <div className="flex flex-col items-center justify-center py-[clamp(2rem,8vw,4rem)] text-center animate-in fade-in duration-300">
                                    <div className="rounded-full bg-muted p-[clamp(0.75rem,2vw,1rem)] mb-[clamp(0.75rem,2vw,1rem)] border border-border">
                                        <Search className="h-6 w-6 text-muted-foreground/50" />
                                    </div>
                                    <p className="text-[clamp(14px,1.5vw,16px)] font-medium text-foreground">{t('noMatchingSettings')}</p>
                                    <p className="text-[clamp(12px,1.5vw,14px)] text-muted-foreground mt-1">{t('tryDifferentKeyword')}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4 rounded-md"
                                        onClick={handleBack}
                                    >
                                        {t('clearSearch')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── ShortcutsTab ─────────────────────────────────────────────────────────────

interface ShortcutsTabProps {
    shortcuts: import('../../context/KeyboardShortcutsContext').ShortcutsMap
    onSave: (id: import('../../context/KeyboardShortcutsContext').ShortcutId, cfg: import('../../context/KeyboardShortcutsContext').ShortcutConfig) => void
    onReset: (id: import('../../context/KeyboardShortcutsContext').ShortcutId) => void
    onResetAll: () => void
}

function ShortcutsTab({ shortcuts, onSave, onReset, onResetAll }: ShortcutsTabProps) {
    const { t } = useLanguage()

    const CONFIGURABLE_SHORTCUTS: Array<{ id: ShortcutId; label: string; group: string }> = [
        { id: 'splitHorizontal', label: t('labelSplitHorizontal'), group: t('shortcutWorkspace') },
        { id: 'splitVertical',   label: t('labelSplitVertical'),   group: t('shortcutWorkspace') },
        { id: 'closePane',       label: t('labelClosePaneShortcut'), group: t('shortcutWorkspace') },
        { id: 'globalSearch',    label: t('labelGlobalSearch'),    group: t('shortcutWorkspace') },
        { id: 'canvasPan',       label: t('labelCanvasPan'),       group: t('shortcutCanvas') },
        { id: 'canvasDelete',    label: t('labelCanvasDelete'),    group: t('shortcutCanvas') },
    ]

    // Group shortcuts by category
    const groups = CONFIGURABLE_SHORTCUTS.reduce<Record<string, typeof CONFIGURABLE_SHORTCUTS>>((acc, s) => {
        if (!acc[s.group]) acc[s.group] = []
        acc[s.group].push(s)
        return acc
    }, {})

    return (
        <div className="space-y-[clamp(1.5rem,4vw,2.5rem)] animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground">{t('shortcuts')}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">{t('shortcutHelp')}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[12px] text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
                    onClick={onResetAll}
                    title={t('shortcutResetAll')}
                >
                    <RotateCcw className="h-3 w-3" />
                    {t('shortcutResetAll')}
                </Button>
            </div>

            {Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                    <h5 className="text-[clamp(10px,1.2vw,11px)] font-bold text-muted-foreground uppercase tracking-widest mb-3">{group}</h5>
                    <div className="rounded-lg border border-border overflow-visible divide-y divide-border bg-card">
                        {items.map(({ id, label }) => (
                            <ShortcutEditorRow
                                key={id}
                                id={id}
                                label={label}
                                config={shortcuts[id]}
                                shortcuts={shortcuts}
                                onSave={(cfg) => onSave(id, cfg)}
                                onReset={() => onReset(id)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
