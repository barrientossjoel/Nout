'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  FileText,
  Frame,
  FileDown,
  Trash2,
  Menu,
  Settings,
  LayoutGrid,
  MoreVertical,
  FolderInput,
} from 'lucide-react';
import type { Document } from '../../../core/types/notes';
import { triggerHaptic } from '../../lib/utils/haptics';
import { cn } from '../../lib/utils/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { MoveDocumentDialog } from '../documents/components/move-document-dialog';

interface MobileNotesHomeProps {
  documents: Document[];
  onOpenDocument: (id: string) => void;
  onCreateDocument: (type: 'text' | 'canvas') => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
  onOpenSearch?: () => void;
  onUpdateDocument?: (doc: Document) => void;
  onDeleteDocument?: (id: string) => void;
}

type FilterCategory = 'all' | 'favorites' | 'text' | 'canvas' | 'pdf';

const FILTER_CHIPS = [
  { id: 'all', label: 'Todas', icon: LayoutGrid },
  { id: 'favorites', label: 'Favoritas', icon: Star },
  { id: 'text', label: 'Notas', icon: FileText },
  { id: 'canvas', label: 'Lienzos', icon: Frame },
  { id: 'pdf', label: 'PDFs', icon: FileDown },
] as const;

export function MobileNotesHome({
  documents,
  onOpenDocument,
  onCreateDocument,
  onToggleSidebar,
  onOpenSettings,
  onOpenSearch,
  onUpdateDocument,
  onDeleteDocument,
}: MobileNotesHomeProps) {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [movingDoc, setMovingDoc] = useState<Document | null>(null);

  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        // Category filter
        if (filter === 'favorites' && !doc.isFavorite) return false;
        if (filter === 'text' && doc.type !== 'text') return false;
        if (filter === 'canvas' && doc.type !== 'canvas') return false;
        if (filter === 'pdf' && doc.type !== 'pdf') return false;

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const titleMatch = doc.title?.toLowerCase().includes(q);
          const contentMatch = typeof doc.content === 'string' && doc.content.toLowerCase().includes(q);
          return titleMatch || contentMatch;
        }

        return true;
      })
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [documents, filter, searchQuery]);

  const formatDate = (dateStr?: string | Date | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getPlainTextSnippet = (doc: Document) => {
    if (doc.type === 'canvas') {
      try {
        const parsed = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
        const count = Array.isArray(parsed) ? parsed.length : (parsed?.nodes?.length || 0);
        return count > 0 ? `Lienzo con ${count} ${count === 1 ? 'elemento' : 'elementos'}` : 'Lienzo visual vacío';
      } catch {
        return 'Lienzo visual';
      }
    }
    if (doc.type === 'pdf') {
      return 'Documento PDF adjunto';
    }
    if (!doc.content) return 'Sin contenido adicional';
    if (typeof doc.content === 'string') {
      const clean = doc.content.replace(/<[^>]+>/g, ' ').replace(/[#*_`]/g, '').trim();
      return clean.slice(0, 110) || 'Sin contenido adicional';
    }
    return 'Documento';
  };

  const handleToggleFavorite = (doc: Document) => {
    triggerHaptic('selection');
    const updated = { ...doc, isFavorite: !doc.isFavorite };
    onUpdateDocument?.(updated);
    import('../../actions/actions').then(({ updateDocument }) => {
      updateDocument(doc.id, { isFavorite: updated.isFavorite });
    });
  };

  const handleMove = (docId: string, newParentId: string | null) => {
    const target = documents.find((d) => d.id === docId);
    if (target) {
      const updated = { ...target, parentId: newParentId };
      onUpdateDocument?.(updated);
      import('../../actions/actions').then(({ updateDocument }) => {
        updateDocument(docId, { parentId: newParentId });
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto pb-28 pt-2 select-none">
      {/* M3 Large Top App Bar */}
      <header className="px-5 pt-3 pb-2 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/30">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {documents.length} {documents.length === 1 ? 'nota guardada' : 'notas guardadas'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onToggleSidebar();
              }}
              className="p-2.5 rounded-full hover:bg-secondary active:scale-95 transition-all text-muted-foreground"
              aria-label="Abrir carpetas"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onOpenSettings();
              }}
              className="p-2.5 rounded-full hover:bg-secondary active:scale-95 transition-all text-muted-foreground"
              aria-label="Ajustes"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* M3 Pill Search Bar */}
      <div className="px-4 mt-3">
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en tus notas..."
            className="w-full h-11 pl-10 pr-4 rounded-full bg-secondary/70 border border-border/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all"
          />
        </div>
      </div>

      {/* M3 Horizontal Filter Chips (Vector Icons, No Emojis) */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 mt-3 py-1 no-scrollbar shrink-0">
        {FILTER_CHIPS.map((chip) => {
          const isActive = filter === chip.id;
          const ChipIcon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setFilter(chip.id);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-95 border',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground'
              )}
            >
              <ChipIcon className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notes List / M3 Elevated Cards */}
      <main className="px-4 mt-4 space-y-3 flex-1">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-secondary/70 flex items-center justify-center text-muted-foreground/60 mb-3">
              <FileText className="w-8 h-8" />
            </div>
            <p className="font-semibold text-foreground text-sm">
              {searchQuery ? 'No se encontraron notas' : 'No tenés notas en esta sección'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchQuery
                ? 'Probá buscando con otras palabras clave.'
                : 'Tocá el botón + para crear tu primera nota o lienzo visual.'}
            </p>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const Icon = doc.type === 'canvas' ? Frame : doc.type === 'pdf' ? FileDown : FileText;

            return (
              <article
                key={doc.id}
                onClick={() => {
                  triggerHaptic('selection');
                  onOpenDocument(doc.id);
                }}
                className="p-4 rounded-2xl border border-border/70 bg-card hover:bg-card/80 active:scale-[0.98] transition-all duration-150 shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <h2 className="font-semibold text-sm text-foreground truncate">
                      {doc.title || 'Nota sin título'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {doc.isFavorite && (
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    )}

                    {/* Card Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('light');
                          }}
                          className="p-1 rounded-full text-muted-foreground/60 hover:text-foreground active:scale-90 transition-all"
                          aria-label="Opciones de nota"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl">
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(doc);
                          }}
                        >
                          <Star className={cn('w-4 h-4', doc.isFavorite && 'text-amber-400 fill-amber-400')} />
                          <span>{doc.isFavorite ? 'Quitar favorita' : 'Marcar favorita'}</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer gap-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMovingDoc(doc);
                          }}
                        >
                          <FolderInput className="w-4 h-4 text-muted-foreground" />
                          <span>Mover a...</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {onDeleteDocument && (
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onDeleteDocument(doc.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                  {getPlainTextSnippet(doc)}
                </p>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 mt-3 pt-2 border-t border-border/30">
                  <span>{formatDate(doc.updatedAt)}</span>
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
                    {doc.type === 'canvas' ? 'Lienzo' : doc.type === 'pdf' ? 'PDF' : 'Nota'}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </main>

      {/* Move Document Dialog */}
      <MoveDocumentDialog
        document={movingDoc}
        documents={documents}
        isOpen={Boolean(movingDoc)}
        onClose={() => setMovingDoc(null)}
        onMove={handleMove}
      />
    </div>
  );
}
