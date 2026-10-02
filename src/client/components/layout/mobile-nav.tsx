import React from 'react'
import { Plus, Menu, LayoutDashboard, Search, Calendar, Settings, Copy, X, FileText, Frame, Trash2, MoreVertical, Bot } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils/utils"
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

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around h-16 px-2 pb-safe pointer-events-auto shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
                <Button
                    variant="ghost"
                    size="icon"
                    className="flex flex-col items-center gap-1 min-w-[64px] text-muted-foreground transition-colors"
                    onClick={onToggleSidebar}
                >
                    <Menu className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">Menu</span>
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                        currentView === 'search' ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => onNavigate('search')}
                >
                    <Search className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">Search</span>
                </Button>

                {/* TABS BUTTON */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="flex flex-col items-center gap-1 min-w-[64px] text-muted-foreground transition-colors"
                    onClick={() => setIsMobileModalOpen(true)}
                >
                    <div className="relative flex items-center justify-center">
                        <Copy className="h-5 w-5" />
                        <span className="absolute text-[8px] font-bold mt-0.5 text-foreground">{tabs.length}</span>
                    </div>
                    <span className="text-[10px] font-semibold">Tabs</span>
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                        currentView === 'calendar' ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => onNavigate('calendar')}
                >
                    <Calendar className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">Events</span>
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="flex flex-col items-center gap-1 min-w-[64px] text-muted-foreground transition-colors"
                    onClick={onOpenSettings}
                >
                    <Settings className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">Settings</span>
                </Button>
            </div>

            {/* Floating Action Button (FAB) */}
            {!hideFab && (
                <div className="fixed right-4 bottom-20 z-[120]">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-transform active:scale-95 border-2 border-primary/20"
                            >
                                <Plus className="h-6 w-6 text-primary-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={12} className="w-56 p-2 rounded-xl border border-border/50 shadow-2xl bg-card/95 backdrop-blur-md">
                            <DropdownMenuItem className="py-3 px-4 rounded-lg cursor-pointer" onClick={() => onCreateDocument('text')}>
                                <FileText className="mr-3 h-5 w-5 opacity-70" />
                                <span className="font-medium text-base">Nuevo documento</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 px-4 rounded-lg cursor-pointer" onClick={() => onCreateDocument('canvas')}>
                                <Frame className="mr-3 h-5 w-5 opacity-70" />
                                <span className="font-medium text-base">Nuevo canvas</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            {/* Mobile Tabs Modal */}
            {isMobileModalOpen && (
                <div className="fixed inset-0 z-[200] bg-background flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <h2 className="font-semibold text-lg">Tabs</h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileModalOpen(false)} className="rounded-full bg-secondary/50">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start bg-muted/10">
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
                                    onClick={() => {
                                        onSelectTab(tabId);
                                        setIsMobileModalOpen(false);
                                    }}
                                    className={cn(
                                        "relative flex flex-col rounded-xl border-2 cursor-pointer transition-all aspect-[3/4] overflow-hidden bg-card shadow-sm hover:shadow-md",
                                        isActive ? "border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background" : "border-border hover:border-foreground/30"
                                    )}
                                >
                                    <div className="flex-1 flex flex-col items-start justify-start gap-2 p-3 pr-10">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Icon className="h-5 w-5 text-foreground/80" />
                                        </div>
                                        <span className="text-sm font-medium text-left line-clamp-2 w-full text-foreground/90">{title}</span>
                                    </div>
                                    <div className="absolute top-2 right-2 z-20">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation()
                                                    onPinTab(tabId, tabId !== previewTabId)
                                                }}>
                                                    {tabId === previewTabId ? 'Pin Tab' : 'Unpin Tab'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCloseTab(tabId);
                                                    if (tabs.length === 1) setIsMobileModalOpen(false);
                                                }}>
                                                    Close Tab
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </>
    )
}
