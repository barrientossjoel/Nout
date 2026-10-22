import React from 'react'
import { Plus, Menu, LayoutDashboard, Search, Calendar, Settings, Copy, X, FileText, Frame, Trash2, MoreVertical, Bot } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils/utils"
import { triggerHaptic } from "../../lib/utils/haptics"
import type { Document } from '../../../core/types/notes'

interface MobileNavProps {
    currentView: string
    documents: Document[]
    tabs: string[]
    onSelectTab: (id: string) => void
    onCloseTab: (id: string) => void
    onNavigate: (view: string) => void
    onToggleSidebar: () => void
    onCreateDocument: (type: 'text' | 'canvas') => void
    onOpenSettings: () => void
    onPinTab: (id: string, pinned: boolean) => void
    previewTabId?: string | null
}

export function MobileNav({
    currentView,
    documents,
    tabs,
    onSelectTab,
    onCloseTab,
    onNavigate,
    onToggleSidebar,
    onCreateDocument,
    onOpenSettings,
    onPinTab,
    previewTabId
}: MobileNavProps) {
    const [isMobileModalOpen, setIsMobileModalOpen] = React.useState(false)

    const currentDoc = documents.find(d => d.id === currentView)
    const hideFab = currentDoc && (currentDoc.type === 'canvas' || currentDoc.type === 'pdf' || (currentDoc as any).type === 'ebook')

    const handleAction = (cb: () => void, haptic: 'selection' | 'light' = 'selection') => {
        triggerHaptic(haptic)
        cb()
    }

    return (
        <>
            {/* Material Design 3 Navigation Bar (80dp height + safe area inset bottom) */}
            <nav 
                aria-label="Mobile Navigation"
                className="fixed bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-lg border-t border-border/80 flex items-center justify-around h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] px-1 pointer-events-auto shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
            >
                {/* NOTAS / DASHBOARD */}
                <button
                    type="button"
                    aria-label="Notas"
                    className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-xs group cursor-pointer focus-visible:outline-none select-none"
                    onClick={() => handleAction(() => onNavigate('dashboard'))}
                >
                    <div className={cn(
                        "px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center",
                        currentView === 'dashboard'
                            ? "bg-secondary text-foreground shadow-xs ring-1 ring-border/50"
                            : "text-muted-foreground group-active:scale-95 group-hover:text-foreground"
                    )}>
                        <FileText className="h-5 w-5" />
                    </div>
                    <span className={cn(
                        "text-[10px] font-medium tracking-tight mt-0.5 transition-colors",
                        currentView === 'dashboard' ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}>
                        Notas
                    </span>
                </button>

                {/* SEARCH */}
                <button
                    type="button"
                    aria-label="Buscar"
                    className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-xs group cursor-pointer focus-visible:outline-none select-none"
                    onClick={() => handleAction(() => onNavigate('search'))}
                >
                    <div className={cn(
                        "px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center",
                        currentView === 'search'
                            ? "bg-secondary text-foreground shadow-xs ring-1 ring-border/50"
                            : "text-muted-foreground group-active:scale-95 group-hover:text-foreground"
                    )}>
                        <Search className="h-5 w-5" />
                    </div>
                    <span className={cn(
                        "text-[10px] font-medium tracking-tight mt-0.5 transition-colors",
                        currentView === 'search' ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}>
                        Buscar
                    </span>
                </button>

                {/* TABS BUTTON WITH BADGE */}
                <button
                    type="button"
                    aria-label={`Pestañas abiertas (${tabs.length})`}
                    className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-xs group cursor-pointer focus-visible:outline-none select-none"
                    onClick={() => handleAction(() => setIsMobileModalOpen(true), 'light')}
                >
                    <div className={cn(
                        "px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center relative",
                        isMobileModalOpen
                            ? "bg-secondary text-foreground shadow-xs"
                            : "text-muted-foreground group-active:scale-95 group-hover:text-foreground"
                    )}>
                        <Copy className="h-5 w-5" />
                        <span className="absolute -top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center shadow-xs">
                            {tabs.length}
                        </span>
                    </div>
                    <span className="text-[10px] font-medium tracking-tight mt-0.5 text-muted-foreground group-hover:text-foreground">
                        Pestañas
                    </span>
                </button>

                {/* CARPETAS / MENU DRAWER */}
                <button
                    type="button"
                    aria-label="Abrir carpetas"
                    className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-xs group cursor-pointer focus-visible:outline-none select-none"
                    onClick={() => handleAction(onToggleSidebar, 'light')}
                >
                    <div className="px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center text-muted-foreground group-active:scale-95 group-hover:text-foreground">
                        <Menu className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium tracking-tight mt-0.5 text-muted-foreground group-hover:text-foreground">
                        Carpetas
                    </span>
                </button>

                {/* SETTINGS */}
                <button
                    type="button"
                    aria-label="Ajustes"
                    className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 text-xs group cursor-pointer focus-visible:outline-none select-none"
                    onClick={() => handleAction(onOpenSettings, 'light')}
                >
                    <div className="px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center text-muted-foreground group-active:scale-95 group-hover:text-foreground">
                        <Settings className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium tracking-tight mt-0.5 text-muted-foreground group-hover:text-foreground">
                        Ajustes
                    </span>
                </button>
            </nav>

            {/* Material Design 3 Floating Action Button (FAB - 56x56dp Squircle / rounded-2xl) */}
            {!hideFab && (
                <div className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[120]">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                aria-label="Create note or canvas"
                                onClick={() => triggerHaptic('selection')}
                                className="h-14 w-14 rounded-2xl shadow-xl bg-primary hover:bg-primary/95 transition-all duration-200 active:scale-95 border border-primary/20 flex items-center justify-center"
                            >
                                <Plus className="h-6 w-6 text-primary-foreground stroke-[2.5]" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={12} className="w-56 p-2 rounded-2xl border border-border/80 shadow-2xl bg-card/95 backdrop-blur-md">
                            <DropdownMenuItem 
                                className="py-3 px-4 rounded-xl cursor-pointer min-h-[48px]" 
                                onClick={() => handleAction(() => onCreateDocument('text'), 'selection')}
                            >
                                <FileText className="mr-3 h-5 w-5 opacity-70" />
                                <span className="font-medium text-sm">Nuevo documento</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="py-3 px-4 rounded-xl cursor-pointer min-h-[48px]" 
                                onClick={() => handleAction(() => onCreateDocument('canvas'), 'selection')}
                            >
                                <Frame className="mr-3 h-5 w-5 opacity-70" />
                                <span className="font-medium text-sm">Nuevo canvas</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            {/* Mobile Tabs Bottom Sheet (Apple HIG & Material 3 Modal Sheet) */}
            {isMobileModalOpen && (
                <div 
                    role="dialog" 
                    aria-modal="true" 
                    aria-label="Tabs Switcher"
                    className="fixed inset-0 z-[1100] flex flex-col justify-end"
                >
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                        onClick={() => handleAction(() => setIsMobileModalOpen(false), 'light')} 
                    />

                    {/* Bottom Sheet Modal */}
                    <div className="relative z-10 w-full max-h-[85vh] bg-card border-t border-border rounded-t-[28px] shadow-2xl flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-250">
                        {/* Pull grabber handle */}
                        <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-3 mb-1 shrink-0" />

                        {/* Sheet Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold text-base text-foreground">Pestañas</h2>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                                    {tabs.length}
                                </span>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                aria-label="Close tabs switcher"
                                onClick={() => handleAction(() => setIsMobileModalOpen(false), 'light')} 
                                className="h-8 w-8 rounded-full bg-secondary/60 hover:bg-secondary"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Tabs Grid */}
                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start bg-muted/20">
                            {tabs.map((tabId) => {
                                const doc = documents.find(d => d.id === tabId)
                                const isActive = tabId === currentView
                                let title = doc?.title?.trim() || ""
                                if (!title) title = "Untitled"

                                let Icon = FileText
                                if (doc?.type === 'canvas') Icon = Frame
                                if (tabId === 'dashboard') { title = "Dashboard"; Icon = LayoutDashboard }
                                else if (tabId === 'calendar') { title = "Calendar"; Icon = Calendar }
                                else if (tabId === 'trash') { title = "Trash"; Icon = Trash2 }
                                else if (tabId === 'ai') { title = "AI Assistant"; Icon = Bot }

                                return (
                                    <div
                                        key={tabId}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            handleAction(() => {
                                                onSelectTab(tabId)
                                                setIsMobileModalOpen(false)
                                            }, 'selection')
                                        }}
                                        className={cn(
                                            "relative flex flex-col rounded-2xl border cursor-pointer transition-all aspect-[4/5] overflow-hidden bg-background shadow-xs hover:shadow-md select-none",
                                            isActive
                                                ? "border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                                                : "border-border/80 hover:border-foreground/20"
                                        )}
                                    >
                                        <div className="flex-1 flex flex-col items-start justify-start gap-2 p-3.5 pr-10">
                                            <div className={cn(
                                                "p-2 rounded-xl transition-colors",
                                                isActive ? "bg-primary/15 text-primary" : "bg-muted text-foreground/70"
                                            )}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <span className="text-xs font-medium text-left line-clamp-3 w-full text-foreground/90 leading-tight">
                                                {title}
                                            </span>
                                        </div>

                                        <div className="absolute top-2 right-2 z-20">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        aria-label="Tab options"
                                                        className="h-7 w-7 rounded-full bg-background/90 backdrop-blur-xs border border-border/60 shadow-xs p-0 min-h-[28px] min-w-[28px]"
                                                    >
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-xl">
                                                    <DropdownMenuItem 
                                                        className="min-h-[44px] cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleAction(() => onPinTab(tabId, tabId !== previewTabId), 'selection')
                                                        }}
                                                    >
                                                        {tabId === previewTabId ? 'Fijar pestaña' : 'Desfijar pestaña'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        className="min-h-[44px] cursor-pointer text-destructive focus:text-destructive" 
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleAction(() => {
                                                                onCloseTab(tabId)
                                                                if (tabs.length === 1) setIsMobileModalOpen(false)
                                                            }, 'light')
                                                        }}
                                                    >
                                                        Cerrar pestaña
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
