'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Search, Star, FileText, Frame, FileDown, Trash2, Menu,
  Settings, LayoutGrid, MoreVertical, FolderInput, X,
  SlidersHorizontal, Plus, LogOut, User as UserIcon,
} from 'lucide-react';
import type { Document } from '../../../core/types/notes';
import { triggerHaptic } from '../../lib/utils/haptics';
import { cn } from '../../lib/utils/utils';
import { useAuth } from '../../context/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '../../components/ui/dropdown-menu';
import { MoveDocumentDialog } from '../documents/components/move-document-dialog';
import { updateDocument } from '../../actions/actions';

export type HeaderSlot = 'profile' | 'search' | 'settings' | 'new-note' | 'sidebar';
export type LayoutMode = 'masonry' | 'grid';
type FilterCategory = 'all' | 'favorites' | 'text' | 'canvas' | 'pdf';

export interface MobileGridConfig {
  mode: LayoutMode;
  columns: number;
}

const FILTER_PREDICATES: Record<FilterCategory, (d: Document) => boolean> = {
  all: () => true,
  favorites: (d) => Boolean(d.isFavorite),
  text: (d) => d.type === 'text',
  canvas: (d) => d.type === 'canvas',
  pdf: (d) => d.type === 'pdf',
};

const FILTER_CHIPS = [
  { id: 'all', label: 'Todas', icon: LayoutGrid },
  { id: 'favorites', label: 'Favoritas', icon: Star },
  { id: 'text', label: 'Notas', icon: FileText },
  { id: 'canvas', label: 'Lienzos', icon: Frame },
  { id: 'pdf', label: 'PDFs', icon: FileDown },
] as const;

const DOC_TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; snippetFallback: string }> = {
  text: { icon: FileText, label: 'Nota', snippetFallback: 'Sin contenido' },
  canvas: { icon: Frame, label: 'Lienzo', snippetFallback: 'Lienzo visual' },
  pdf: { icon: FileDown, label: 'PDF', snippetFallback: 'Documento PDF' },
};

const SLOT_CONFIG: Record<HeaderSlot, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  profile: { label: 'Perfil (Avatar)', icon: UserIcon },
  search: { label: 'Búsqueda (Lupa)', icon: Search },
  'new-note': { label: 'Nueva Nota (+)', icon: Plus },
  settings: { label: 'Ajustes', icon: Settings },
  sidebar: { label: 'Carpetas (Menú)', icon: Menu },
};

interface MobileNotesHomeProps {
  documents: Document[];
  onOpenDocument: (id: string) => void;
  onCreateDocument: (type: 'text' | 'canvas') => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenSearch?: () => void;
  onUpdateDocument?: (doc: Document) => void;
  onDeleteDocument?: (id: string) => void;
}

export function MobileNotesHome({
  documents,
  onOpenDocument,
  onCreateDocument,
  onToggleSidebar,
  onOpenSettings,
  onUpdateDocument,
  onDeleteDocument,
}: MobileNotesHomeProps) {
  const { user, logout } = useAuth();
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [movingDoc, setMovingDoc] = useState<Document | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);

  const [slot, setSlot] = useState<HeaderSlot>(() =>
    (localStorage.getItem('nout_mobile_header_slot') as HeaderSlot) || 'profile'
  );

  const [gridConfig, setGridConfig] = useState<MobileGridConfig>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('nout_mobile_grid') : null;
      return saved ? JSON.parse(saved) : { mode: 'masonry', columns: 2 };
    } catch {
      return { mode: 'masonry', columns: 2 };
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const openSettings = (tab = 'account') => {
    triggerHaptic('selection');
    onOpenSettings?.(tab);
    window.dispatchEvent(new CustomEvent('nout:open_settings', { detail: { tab } }));
  };

  const handleSlotChange = (newSlot: HeaderSlot) => {
    setSlot(newSlot);
    localStorage.setItem('nout_mobile_header_slot', newSlot);
    triggerHaptic('selection');
  };

  const handleUpdateGrid = (partial: Partial<MobileGridConfig>) => {
    setGridConfig((prev) => {
      const updated = { ...prev, ...partial };
      localStorage.setItem('nout_mobile_grid', JSON.stringify(updated));
      triggerHaptic('selection');
      return updated;
    });
  };

  const handleHomeClick = () => {
    triggerHaptic('light');
    setSearchQuery('');
    setFilter('all');
    setIsSearching(false);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenNote = (id: string) => {
    triggerHaptic('selection');
    setExpandingId(id);
    setTimeout(() => {
      onOpenDocument(id);
      setExpandingId(null);
    }, 150);
  };

  const toggleFavorite = (doc: Document) => {
    triggerHaptic('selection');
    const updated = { ...doc, isFavorite: !doc.isFavorite };
    onUpdateDocument?.(updated);
    updateDocument(doc.id, { isFavorite: updated.isFavorite });
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredDocs = useMemo(() => documents
    .filter((d) => FILTER_PREDICATES[filter](d) && (!q || d.title?.toLowerCase().includes(q) || (typeof d.content === 'string' && d.content.toLowerCase().includes(q))))
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()),
    [documents, filter, q]
  );

  const handleSlotPrimaryClick = () => {
    triggerHaptic('light');
    const actions: Record<HeaderSlot, () => void> = {
      profile: () => {},
      search: () => { setIsSearching(true); searchInputRef.current?.focus(); },
      'new-note': () => onCreateDocument('text'),
      settings: () => openSettings('general'),
      sidebar: () => onToggleSidebar?.(),
    };
    actions[slot]();
  };

  const renderSlotTrigger = () => slot === 'profile' ? (
    <button
      type="button"
      aria-label="Perfil y opciones"
      className="h-9 w-9 rounded-full border border-border/70 hover:border-primary/50 transition-transform active:scale-95 flex items-center justify-center overflow-hidden shrink-0 bg-secondary/70 shadow-xs focus-visible:outline-none"
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name || 'Perfil'} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-foreground">
          {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4 text-muted-foreground" />}
        </span>
      )}
    </button>
  ) : (
    <button
      type="button"
      aria-label={SLOT_CONFIG[slot].label}
      className="p-2 rounded-full hover:bg-secondary active:scale-95 transition-all text-muted-foreground hover:text-foreground"
    >
      {React.createElement(SLOT_CONFIG[slot].icon, { className: 'w-5 h-5' })}
    </button>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background text-foreground overflow-y-auto pb-28 pt-1 select-none">
      {/* Header Bar */}
      <header className="px-4 py-2 sticky top-0 bg-background/95 backdrop-blur-md z-20 border-b border-border/40 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Logo nOut (Home) */}
          <button
            type="button"
            onClick={handleHomeClick}
            className="flex items-center gap-1 focus:outline-none active:scale-95 transition-transform shrink-0"
            aria-label="Ir a Inicio"
          >
            <span className="font-extrabold tracking-tight text-xl select-none">
              n<span className="text-primary">Out</span>
            </span>
          </button>

          {/* Buscador */}
          <div className="flex-1 relative flex items-center min-w-0 max-w-sm mx-1">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => { setIsSearching(true); triggerHaptic('light'); }}
              onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(true); }}
              placeholder="Buscar notas..."
              className="w-full h-9 pl-9 pr-8 rounded-full bg-secondary/80 border border-border/50 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); triggerHaptic('light'); }}
                className="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground active:scale-90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Grid & Masonry View Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-secondary active:scale-95 transition-all text-muted-foreground hover:text-foreground"
                  aria-label="Configurar grilla"
                  title="Configurar grilla"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-2.5 rounded-2xl shadow-xl border-border/80">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-foreground">Distribución</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-semibold">
                    {gridConfig.columns}x{gridConfig.columns} {gridConfig.mode === 'masonry' ? 'Pinterest' : 'Grilla'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary/60 rounded-xl mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateGrid({ mode: 'masonry' })}
                    className={cn(
                      "text-xs py-1.5 rounded-lg font-medium transition-all text-center",
                      gridConfig.mode === 'masonry' ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                    )}
                  >
                    Pinterest
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateGrid({ mode: 'grid' })}
                    className={cn(
                      "text-xs py-1.5 rounded-lg font-medium transition-all text-center",
                      gridConfig.mode === 'grid' ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                    )}
                  >
                    Grilla
                  </button>
                </div>
                <div className="px-1">
                  <span className="text-[11px] text-muted-foreground block mb-1.5">Columnas (1 a 7)</span>
                  <div className="grid grid-cols-7 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleUpdateGrid({ columns: num })}
                        className={cn(
                          "h-7 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center justify-center",
                          gridConfig.columns === num 
                            ? "bg-primary text-primary-foreground shadow-xs" 
                            : "bg-secondary/70 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Slot de Acción Configurable */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={slot !== 'profile' ? handleSlotPrimaryClick : undefined}>
                {renderSlotTrigger()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl shadow-xl border-border/80">
                <div className="px-3 py-1.5 border-b border-border/40 mb-1">
                  <p className="text-xs font-semibold text-foreground truncate">{user?.name || 'Perfil Local'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email || 'Modo local'}</p>
                </div>
                <DropdownMenuItem className="cursor-pointer gap-2.5 py-1.5 rounded-xl text-xs" onClick={() => openSettings('account')}>
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  <span>Mi Cuenta (Foto y Perfil)</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2.5 py-1.5 rounded-xl text-xs" onClick={() => openSettings('general')}>
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span>Ajustes</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer gap-2.5 py-2 rounded-xl text-xs">
                    <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                    <span>Cambiar este botón</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 p-1 rounded-xl">
                    <DropdownMenuRadioGroup value={slot} onValueChange={(v) => handleSlotChange(v as HeaderSlot)}>
                      {Object.entries(SLOT_CONFIG).map(([k, { label }]) => (
                        <DropdownMenuRadioItem key={k} value={k} className="text-xs py-1.5">{label}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2.5 py-1.5 rounded-xl text-xs text-destructive focus:text-destructive"
                      onClick={() => { triggerHaptic('light'); logout(); }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filtros dinámicos (sin scroll horizontal, wrap fluido) */}
        {(isSearching || q) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {FILTER_CHIPS.map((chip) => {
              const active = filter === chip.id;
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => { triggerHaptic('selection'); setFilter(chip.id); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 border',
                    active ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-secondary/70 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setIsSearching(false); setSearchQuery(''); setFilter('all'); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground bg-secondary/40 border border-border/40 ml-auto"
            >
              <X className="w-3 h-3" />
              <span>Listo</span>
            </button>
          </div>
        )}
      </header>

      {/* Lista de Notas (Masonry Pinterest vs Grilla Matriz) */}
      <main className="px-3.5 mt-3 flex-1">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-secondary/70 flex items-center justify-center text-muted-foreground/60 mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <p className="font-semibold text-foreground text-sm">{q ? 'No se encontraron notas' : 'No tenés notas en esta sección'}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{q ? 'Probá con otras palabras clave.' : 'Tocá el botón + para crear tu primera nota.'}</p>
          </div>
        ) : (
          <div
            style={
              gridConfig.mode === 'masonry'
                ? {
                    columnCount: gridConfig.columns,
                    columnGap: '0.625rem',
                  }
                : {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridConfig.columns}, minmax(0, 1fr))`,
                    gap: '0.625rem',
                  }
            }
          >
            {filteredDocs.map((doc) => {
              const meta = (doc.type && DOC_TYPE_META[doc.type]) ?? DOC_TYPE_META.text;
              const Icon = meta.icon;
              const isDense = gridConfig.columns >= 3;
              const isVeryDense = gridConfig.columns >= 5;

              const snippet = typeof doc.content === 'string'
                ? doc.content.replace(/<[^>]+>/g, ' ').replace(/[#*_`]/g, '').trim().slice(0, isDense ? 45 : 120) || meta.snippetFallback
                : meta.snippetFallback;

              const dateStr = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
              const isExpanding = expandingId === doc.id;

              return (
                <article
                  key={doc.id}
                  onClick={() => handleOpenNote(doc.id)}
                  className={cn(
                    "rounded-2xl border border-border/70 bg-card hover:bg-card/90 cursor-pointer flex flex-col justify-between transition-all duration-200 shadow-xs",
                    gridConfig.mode === 'masonry' && "break-inside-avoid mb-2.5",
                    isDense ? "p-2.5" : "p-3.5",
                    isExpanding && "scale-[1.04] opacity-90 shadow-2xl z-30 ring-2 ring-primary/40 duration-150"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className={cn("text-muted-foreground shrink-0", isDense ? "w-3.5 h-3.5" : "w-4 h-4")} />
                      <h2 className={cn("font-semibold text-foreground truncate", isDense ? "text-xs" : "text-sm")}>
                        {doc.title || 'Nota sin título'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {doc.isFavorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                      {!isVeryDense && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); }}
                              className="p-1 rounded-full text-muted-foreground/60 hover:text-foreground active:scale-90"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl">
                            <DropdownMenuItem className="cursor-pointer gap-2 py-2" onClick={(e) => { e.stopPropagation(); toggleFavorite(doc); }}>
                              <Star className={cn('w-4 h-4', doc.isFavorite && 'text-amber-400 fill-amber-400')} />
                              <span>{doc.isFavorite ? 'Quitar favorita' : 'Marcar favorita'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer gap-2 py-2" onClick={(e) => { e.stopPropagation(); setMovingDoc(doc); }}>
                              <FolderInput className="w-4 h-4 text-muted-foreground" />
                              <span>Mover a...</span>
                            </DropdownMenuItem>
                            {onDeleteDocument && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); onDeleteDocument(doc.id); }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Eliminar</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {!isVeryDense && (
                    <p className={cn("text-muted-foreground mt-2 leading-relaxed", isDense ? "text-[11px] line-clamp-1" : "text-xs line-clamp-3")}>
                      {snippet}
                    </p>
                  )}

                  <div className={cn("flex items-center justify-between text-muted-foreground/70 mt-2.5 pt-1.5 border-t border-border/30", isDense ? "text-[10px]" : "text-[11px]")}>
                    <span>{dateStr}</span>
                    <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium">
                      {meta.label}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <MoveDocumentDialog
        document={movingDoc}
        documents={documents}
        isOpen={Boolean(movingDoc)}
        onClose={() => setMovingDoc(null)}
        onMove={(docId, newParentId) => {
          const target = documents.find((d) => d.id === docId);
          target && (onUpdateDocument?.({ ...target, parentId: newParentId }), updateDocument(docId, { parentId: newParentId }));
        }}
      />
    </div>
  );
}
