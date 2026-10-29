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
type FilterCategory = 'all' | 'favorites' | 'text' | 'canvas' | 'pdf';

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
  const [slot, setSlot] = useState<HeaderSlot>(() =>
    (localStorage.getItem('nout_mobile_header_slot') as HeaderSlot) || 'profile'
  );

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

  const handleHomeClick = () => {
    triggerHaptic('light');
    setSearchQuery('');
    setFilter('all');
    setIsSearching(false);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

  const renderSlotTrigger = () => {
    if (slot === 'profile') {
      return (
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
      );
    }
    const SlotIcon = SLOT_CONFIG[slot].icon;
    return (
      <button
        type="button"
        aria-label={SLOT_CONFIG[slot].label}
        className="p-2 rounded-full hover:bg-secondary active:scale-95 transition-all text-muted-foreground hover:text-foreground"
      >
        <SlotIcon className="w-5 h-5" />
      </button>
    );
  };

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

      {/* Lista de Notas */}
      <main className="px-4 mt-3 space-y-3 flex-1">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-secondary/70 flex items-center justify-center text-muted-foreground/60 mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <p className="font-semibold text-foreground text-sm">{q ? 'No se encontraron notas' : 'No tenés notas en esta sección'}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{q ? 'Probá con otras palabras clave.' : 'Tocá el botón + para crear tu primera nota.'}</p>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const Icon = doc.type === 'canvas' ? Frame : doc.type === 'pdf' ? FileDown : FileText;
            const snippet = typeof doc.content === 'string'
              ? doc.content.replace(/<[^>]+>/g, ' ').replace(/[#*_`]/g, '').trim().slice(0, 110) || 'Sin contenido'
              : doc.type === 'canvas' ? 'Lienzo visual' : 'Documento';

            const dateStr = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

            return (
              <article
                key={doc.id}
                onClick={() => { triggerHaptic('selection'); onOpenDocument(doc.id); }}
                className="p-4 rounded-2xl border border-border/70 bg-card hover:bg-card/80 active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <h2 className="font-semibold text-sm text-foreground truncate">{doc.title || 'Nota sin título'}</h2>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.isFavorite && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); }}
                          className="p-1 rounded-full text-muted-foreground/60 hover:text-foreground active:scale-90"
                        >
                          <MoreVertical className="w-4 h-4" />
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
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">{snippet}</p>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 mt-3 pt-2 border-t border-border/30">
                  <span>{dateStr}</span>
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
                    {doc.type === 'canvas' ? 'Lienzo' : doc.type === 'pdf' ? 'PDF' : 'Nota'}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </main>

      <MoveDocumentDialog
        document={movingDoc}
        documents={documents}
        isOpen={Boolean(movingDoc)}
        onClose={() => setMovingDoc(null)}
        onMove={(docId, newParentId) => {
          const target = documents.find((d) => d.id === docId);
          if (target) {
            onUpdateDocument?.({ ...target, parentId: newParentId });
            updateDocument(docId, { parentId: newParentId });
          }
        }}
      />
    </div>
  );
}
