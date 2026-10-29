import React, { useState } from 'react'
import {
  Plus, Search, Calendar, Settings, Copy, X, FileText, Frame,
  Trash2, MoreVertical, Bot, ChevronDown, ChevronUp, ChevronLeft,
  ChevronRight, SlidersHorizontal, Check, FileDown,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "../ui/dropdown-menu"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils/utils"
import { triggerHaptic } from "../../lib/utils/haptics"
import type { Document } from '../../../core/types/notes'

export type NavPosition = 'bottom' | 'top' | 'left' | 'right'
export type NavItemId = 'dashboard' | 'search' | 'create' | 'tabs' | 'calendar' | 'settings'

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

const DEFAULT_BUTTONS: NavItemId[] = ['dashboard', 'search', 'tabs', 'settings']

const NAV_ITEMS_MAP: Record<NavItemId, { id: NavItemId; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { id: 'dashboard', label: 'Notas', icon: FileText },
  search: { id: 'search', label: 'Buscar', icon: Search },
  create: { id: 'create', label: 'Nueva', icon: Plus },
  tabs: { id: 'tabs', label: 'Pestañas', icon: Copy },
  calendar: { id: 'calendar', label: 'Agenda', icon: Calendar },
  settings: { id: 'settings', label: 'Ajustes', icon: Settings },
}

const ALL_NAV_ITEMS = Object.values(NAV_ITEMS_MAP)

const POSITION_LABELS: Record<NavPosition, string> = {
  bottom: 'Abajo',
  top: 'Arriba',
  left: 'Izquierda',
  right: 'Derecha',
}

const POSITION_CONTAINER_CLASSES: Record<NavPosition, string> = {
  bottom: "fixed bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-lg border-t border-border/80 flex-row h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] px-1 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
  top: "fixed top-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-lg border-b border-border/80 flex-row h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] px-1 shadow-[0_4px_24px_rgba(0,0,0,0.06)]",
  left: "fixed top-0 bottom-0 left-0 z-[1000] bg-background/95 backdrop-blur-lg border-r border-border/80 flex-col w-16 py-4 px-1 shadow-[4px_0_24px_rgba(0,0,0,0.06)]",
  right: "fixed top-0 bottom-0 right-0 z-[1000] bg-background/95 backdrop-blur-lg border-l border-border/80 flex-col w-16 py-4 px-1 shadow-[-4px_0_24px_rgba(0,0,0,0.06)]",
}

const EXPAND_TRIGGER_CLASSES: Record<NavPosition, string> = {
  bottom: "fixed bottom-2 left-1/2 -translate-x-1/2 z-[1000] rounded-full px-3 py-1 shadow-lg bg-card/95 border border-border/80 backdrop-blur-md flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground",
  top: "fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[1000] rounded-full px-3 py-1 shadow-lg bg-card/95 border border-border/80 backdrop-blur-md flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground",
  left: "fixed top-1/2 -translate-y-1/2 left-2 z-[1000] rounded-full p-2 shadow-lg bg-card/95 border border-border/80 backdrop-blur-md flex items-center text-muted-foreground hover:text-foreground",
  right: "fixed top-1/2 -translate-y-1/2 right-2 z-[1000] rounded-full p-2 shadow-lg bg-card/95 border border-border/80 backdrop-blur-md flex items-center text-muted-foreground hover:text-foreground",
}

const CHEVRON_MAP: Record<NavPosition, { collapse: React.ComponentType<{ className?: string }>; expand: React.ComponentType<{ className?: string }> }> = {
  bottom: { collapse: ChevronDown, expand: ChevronUp },
  top: { collapse: ChevronUp, expand: ChevronDown },
  left: { collapse: ChevronLeft, expand: ChevronRight },
  right: { collapse: ChevronRight, expand: ChevronLeft },
}

const SPECIAL_TAB_CONFIG: Record<string, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { title: 'Dashboard', icon: FileText },
  calendar: { title: 'Calendar', icon: Calendar },
  trash: { title: 'Trash', icon: Trash2 },
  ai: { title: 'AI Assistant', icon: Bot },
}

const DOC_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  canvas: Frame,
  pdf: FileDown,
  text: FileText,
}

export function MobileNav({
  currentView,
  documents,
  tabs,
  onSelectTab,
  onCloseTab,
  onNavigate,
  onCreateDocument,
  onOpenSettings,
  onPinTab,
  previewTabId,
}: MobileNavProps) {
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false)

  const [position, setPosition] = useState<NavPosition>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('nout_mobile_nav_pos') as NavPosition) : null
    return saved && saved in POSITION_CONTAINER_CLASSES ? saved : 'bottom'
  })

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('nout_mobile_nav_collapsed') === 'true'
  )

  const [activeButtons, setActiveButtons] = useState<NavItemId[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('nout_mobile_nav_buttons') : null
      return saved ? JSON.parse(saved) : DEFAULT_BUTTONS
    } catch {
      return DEFAULT_BUTTONS
    }
  })

  const currentDoc = documents.find((d) => d.id === currentView)
  const hideFab = currentDoc && (currentDoc.type === 'canvas' || currentDoc.type === 'pdf' || (currentDoc as any).type === 'ebook')

  const handleAction = (cb: () => void, haptic: 'selection' | 'light' = 'selection') => {
    triggerHaptic(haptic)
    cb()
  }

  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem('nout_mobile_nav_collapsed', String(collapsed))
    triggerHaptic('light')
    window.dispatchEvent(new CustomEvent('nout:mobile_nav_change', { detail: { position, isCollapsed: collapsed } }))
  }

  const handlePositionChange = (pos: NavPosition) => {
    setPosition(pos)
    localStorage.setItem('nout_mobile_nav_pos', pos)
    triggerHaptic('selection')
    window.dispatchEvent(new CustomEvent('nout:mobile_nav_change', { detail: { position: pos, isCollapsed } }))
  }

  const handleToggleButton = (id: NavItemId) => {
    setActiveButtons((prev) => {
      const updated = prev.includes(id)
        ? (prev.length > 2 ? prev.filter((b) => b !== id) : prev)
        : [...prev, id]
      localStorage.setItem('nout_mobile_nav_buttons', JSON.stringify(updated))
      triggerHaptic('selection')
      return updated
    })
  }

  const isVertical = position === 'left' || position === 'right'

  const buttonActionMap: Record<NavItemId, () => void> = {
    dashboard: () => onNavigate('dashboard'),
    search: () => onNavigate('search'),
    create: () => onCreateDocument('text'),
    tabs: () => setIsMobileModalOpen(true),
    calendar: () => onNavigate('calendar'),
    settings: onOpenSettings,
  }

  const CollapseIcon = CHEVRON_MAP[position].collapse
  const ExpandIcon = CHEVRON_MAP[position].expand

  return isCollapsed ? (
    <button
      type="button"
      onClick={() => handleToggleCollapse(false)}
      className={EXPAND_TRIGGER_CLASSES[position]}
      aria-label="Mostrar barra de navegación"
    >
      <ExpandIcon className="w-4 h-4 text-primary" />
      {!isVertical && <span className="font-semibold text-[10px]">Menú</span>}
    </button>
  ) : (
    <>
      <nav
        aria-label="Mobile Navigation"
        className={cn(
          POSITION_CONTAINER_CLASSES[position],
          "flex items-center justify-around pointer-events-auto transition-all duration-200"
        )}
      >
        {activeButtons.map((btnId) => {
          const item = NAV_ITEMS_MAP[btnId]
          const Icon = item.icon
          const isActive = currentView === btnId || (btnId === 'tabs' && isMobileModalOpen)

          return (
            <button
              key={btnId}
              type="button"
              aria-label={item.label}
              onClick={() => handleAction(buttonActionMap[btnId], btnId === 'tabs' ? 'light' : 'selection')}
              className={cn(
                "flex items-center justify-center min-h-[44px] text-xs group cursor-pointer focus-visible:outline-none select-none transition-transform active:scale-95",
                isVertical ? "flex-col w-full py-2" : "flex-col flex-1 py-1"
              )}
            >
              <div
                className={cn(
                  "rounded-full transition-all duration-200 flex items-center justify-center relative",
                  isVertical ? "p-2" : "px-4 py-1",
                  isActive
                    ? "bg-secondary text-foreground shadow-xs ring-1 ring-border/50"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {btnId === 'tabs' && (
                  <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[9px] font-bold text-white flex items-center justify-center shadow-xs">
                    {tabs.length}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] font-medium tracking-tight mt-0.5 transition-colors truncate max-w-full",
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}

        {/* Spatial & Visibility Control Popover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Opciones de barra móvil"
              className={cn(
                "p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground active:scale-90 transition-all",
                isVertical ? "my-1" : "mx-1"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isVertical ? (position === 'left' ? 'start' : 'end') : 'center'}
            side={position === 'bottom' ? 'top' : position === 'top' ? 'bottom' : 'right'}
            className="w-56 p-2 rounded-2xl border-border/80 shadow-2xl"
          >
            <DropdownMenuLabel className="text-xs font-semibold">Ubicación de la Barra</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/50 rounded-xl my-1 text-xs">
              {(['bottom', 'top', 'left', 'right'] as NavPosition[]).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handlePositionChange(pos)}
                  className={cn(
                    "py-1 rounded-lg capitalize font-medium transition-all text-center",
                    position === pos ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground"
                  )}
                >
                  {POSITION_LABELS[pos]}
                </button>
              ))}
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold">Botones visibles</DropdownMenuLabel>
            <div className="space-y-0.5 mt-1">
              {ALL_NAV_ITEMS.map((item) => {
                const checked = activeButtons.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleButton(item.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{item.label}</span>
                    </div>
                    {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                )
              })}
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 py-1.5 text-xs rounded-xl"
              onClick={() => handleToggleCollapse(true)}
            >
              <CollapseIcon className="w-4 h-4 text-muted-foreground" />
              <span>Ocultar barra (dejar flecha)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Collapse Chevron Button */}
        <button
          type="button"
          onClick={() => handleToggleCollapse(true)}
          aria-label="Ocultar barra móvil"
          title="Ocultar barra"
          className="p-1 rounded-full text-muted-foreground/40 hover:text-foreground active:scale-90"
        >
          <CollapseIcon className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Material Design 3 Floating Action Button (FAB) */}
      {!hideFab && !activeButtons.includes('create') && position === 'bottom' && (
        <div className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[120]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                aria-label="Crear nota o lienzo"
                onClick={() => triggerHaptic('selection')}
                className="h-14 w-14 rounded-[18px] shadow-[0_8px_24px_rgba(37,99,235,0.4),0_4px_12px_rgba(0,0,0,0.35)] bg-blue-600 hover:bg-blue-500 text-white transition-all duration-200 active:scale-95 border-0 ring-4 ring-background/60 flex items-center justify-center"
              >
                <Plus className="h-6 w-6 stroke-[2.5]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="w-56 p-2 rounded-2xl border border-border/80 shadow-2xl bg-card/95 backdrop-blur-md">
              <DropdownMenuItem
                className="py-3 px-4 rounded-xl cursor-pointer min-h-[48px]"
                onClick={() => handleAction(() => onCreateDocument('text'), 'selection')}
              >
                <FileText className="mr-3 h-5 w-5 text-blue-500" />
                <span className="font-medium text-sm">Nueva nota</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="py-3 px-4 rounded-xl cursor-pointer min-h-[48px]"
                onClick={() => handleAction(() => onCreateDocument('canvas'), 'selection')}
              >
                <Frame className="mr-3 h-5 w-5 text-indigo-500" />
                <span className="font-medium text-sm">Nuevo lienzo</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Mobile Tabs Bottom Sheet */}
      {isMobileModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tabs Switcher"
          className="fixed inset-0 z-[1100] flex flex-col justify-end"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => handleAction(() => setIsMobileModalOpen(false), 'light')}
          />

          <div className="relative z-10 w-full max-h-[85vh] bg-card border-t border-border rounded-t-[28px] shadow-2xl flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))] animate-in slide-in-from-bottom duration-250">
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-3 mb-1 shrink-0" />

            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base text-foreground">Pestañas</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                  {tabs.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsMobileModalOpen(false)
                    onCreateDocument('text')
                  }}
                  className="h-8 px-3 rounded-full text-xs font-medium gap-1.5 bg-blue-600/10 border-blue-600/20 text-blue-500 hover:bg-blue-600/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nueva pestaña</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar selector de pestañas"
                  onClick={() => handleAction(() => setIsMobileModalOpen(false), 'light')}
                  className="h-8 w-8 rounded-full bg-secondary/60 hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start bg-muted/20">
              {tabs.map((tabId) => {
                const doc = documents.find((d) => d.id === tabId)
                const isActive = tabId === currentView
                const special = SPECIAL_TAB_CONFIG[tabId]
                const title = special?.title ?? (doc?.title?.trim() || 'Sin título')
                const Icon = special?.icon ?? DOC_TAB_ICONS[doc?.type ?? 'text'] ?? FileText

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
                      <div
                        className={cn(
                          "p-2 rounded-xl transition-colors",
                          isActive ? "bg-primary/15 text-primary" : "bg-muted text-foreground/70"
                        )}
                      >
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
                                tabs.length === 1 && setIsMobileModalOpen(false)
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
