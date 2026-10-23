'use client';

import React, { useState, useMemo } from 'react';
import { Folder, FolderRoot, ChevronRight, Search, FileText, Check } from 'lucide-react';
import type { Document } from '../../../../core/types/notes';
import { triggerHaptic } from '../../../lib/utils/haptics';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils/utils';

interface MoveDocumentDialogProps {
  document: Document | null;
  documents: Document[];
  isOpen: boolean;
  onClose: () => void;
  onMove: (docId: string, newParentId: string | null) => void;
}

export function MoveDocumentDialog({
  document: activeDoc,
  documents,
  isOpen,
  onClose,
  onMove,
}: MoveDocumentDialogProps) {
  const [search, setSearch] = useState('');

  // Collect all descendant IDs of the active document to prevent cyclic nesting
  const invalidTargetIds = useMemo(() => {
    if (!activeDoc) return new Set<string>();
    const ids = new Set<string>([activeDoc.id]);
    const addDescendants = (parentId: string) => {
      documents
        .filter((d) => d.parentId === parentId)
        .forEach((child) => {
          ids.add(child.id);
          addDescendants(child.id);
        });
    };
    addDescendants(activeDoc.id);
    return ids;
  }, [activeDoc, documents]);

  // Filter available candidate targets
  const candidateDocs = useMemo(() => {
    return documents.filter((d) => {
      if (invalidTargetIds.has(d.id)) return false;
      if (d.type === 'pdf') return false; // PDFs shouldn't be parent containers
      if (search.trim()) {
        return d.title?.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [documents, invalidTargetIds, search]);

  if (!activeDoc) return null;

  const handleSelectTarget = (newParentId: string | null) => {
    triggerHaptic('selection');
    onMove(activeDoc.id, newParentId);
    onClose();
  };

  const isCurrentParent = (id: string | null) => {
    if (id === null) return !activeDoc.parentId;
    return activeDoc.parentId === id;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full rounded-2xl p-5 bg-card border-border/80 shadow-2xl">
        <DialogHeader className="text-left pb-2">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Mover nota
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            Elegí la ubicación de destino para &ldquo;{activeDoc.title || 'Sin título'}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-1 mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar carpeta o nota..."
            className="w-full h-10 pl-9 pr-3 text-sm rounded-xl bg-secondary/60 border border-border/50 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>

        {/* Destinations list */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
          {/* Option: Root (Raíz) */}
          <button
            type="button"
            onClick={() => handleSelectTarget(null)}
            className={cn(
              'w-full flex items-center justify-between p-3 rounded-xl text-left text-sm transition-all duration-150',
              isCurrentParent(null)
                ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                : 'hover:bg-secondary/70 text-foreground active:scale-[0.99]'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderRoot className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <span className="truncate block font-medium">Raíz de Documentos</span>
                <span className="text-[11px] text-muted-foreground block">Nivel principal</span>
              </div>
            </div>
            {isCurrentParent(null) && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>

          {/* List of valid notes/folders */}
          {candidateDocs.map((doc) => {
            const isSelected = isCurrentParent(doc.id);
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => handleSelectTarget(doc.id)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-xl text-left text-sm transition-all duration-150',
                  isSelected
                    ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                    : 'hover:bg-secondary/70 text-foreground active:scale-[0.99]'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate block">{doc.title || 'Sin título'}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}

          {candidateDocs.length === 0 && search.trim() && (
            <p className="text-center py-6 text-xs text-muted-foreground">
              No se encontraron carpetas o notas con ese nombre
            </p>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-border/40 mt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl px-4">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
