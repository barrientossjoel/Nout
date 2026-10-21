'use client'

import React, { useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Plus, MoreVertical, Trash, Folder, LayoutDashboard, Frame } from 'lucide-react'
import { cn } from '../../lib/utils/utils'
import { Button } from '../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '../../components/ui/context-menu'
import type { Document } from '../../../core/types/notes'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

import { RenameDialog } from '../../components/ui/rename-dialog'
import { Pencil, Link2 } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

interface SidebarTreeProps {
    documents: Document[]
    activeDocumentId?: string
    onSelectDocument: (id: string) => void
    onCreateDocument: (parentId?: string | null, type?: 'text' | 'canvas') => void
    onDeleteDocument: (id: string) => void
    onMoveDocument?: (id: string, newParentId: string | null, newIndex?: number) => void
    onUpdateDocument: (doc: Document) => void
    onDoubleClickDocument?: (id: string) => void
}

interface TreeNodeProps extends Omit<SidebarTreeProps, 'documents' | 'activeDocumentId'> {
    node: Document & { children?: Document[] }
    level: number
    index: number
    isActive: boolean
    activeDocumentId?: string // keep it to pass down recursion, but don't use it directly for active state
    onInitiateRename: (node: Document) => void
    onDoubleClickDocument?: (id: string) => void
}

const MemoizedTreeNode = React.memo(function TreeNode({
    node, level, index, isActive, activeDocumentId,
    onSelectDocument, onCreateDocument, onDeleteDocument,
    onMoveDocument, onUpdateDocument, onInitiateRename, onDoubleClickDocument
}: TreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(node.isExpanded ?? false)
    const hasChildren = node.children && node.children.length > 0

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsExpanded(!isExpanded)
    }

    return (
        <Draggable draggableId={node.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="w-full overflow-hidden"
                >
                    <ContextMenu>
                        <ContextMenuTrigger asChild>
                            <div
                                className={cn(
                                    "group relative flex items-center gap-1 py-0.5 pl-2 pr-12 rounded-none hover:bg-muted/30 cursor-pointer transition-colors min-h-[28px] w-full overflow-hidden",
                                    isActive && "bg-muted text-foreground font-medium",
                                    snapshot.isDragging && "opacity-50"
                                )}
                                style={{ paddingLeft: `${level * 12 + 8}px` }}
                                onClick={() => onSelectDocument(node.id)}
                                onDoubleClick={() => onDoubleClickDocument?.(node.id)}
                            >
                                <div
                                    role="button"
                                    onClick={handleExpand}
                                    className={cn(
                                        "h-5 w-5 rounded-sm flex items-center justify-center hover:bg-accent transition-colors",
                                        !hasChildren && "opacity-0 hover:opacity-100"
                                    )}
                                >
                                    {hasChildren || node.children ? (
                                        isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                                    ) : (
                                        <div className="w-3.5 h-3.5" />
                                    )}
                                </div>

                                {hasChildren ? (
                                    <Folder className="h-4 w-4 text-muted-foreground mr-1" />
                                ) : node.type === 'canvas' ? (
                                    <Frame className="h-4 w-4 text-muted-foreground mr-1" />
                                ) : (
                                    <FileText className="h-4 w-4 text-muted-foreground mr-1" />
                                )}

                                <span className="truncate flex-1 text-sm min-w-0" title={node.title || "Untitled"}>
                                    {node.title || "Untitled"}
                                    {hasChildren && node.children && (
                                        <span className="text-[11px] text-muted-foreground/60 font-mono ml-1.5 tabular-nums">
                                            ({node.children.length})
                                        </span>
                                    )}
                                </span>

                                <div className="absolute right-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center shrink-0 pr-1">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-accent text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                                <MoreVertical className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateDocument(node.id, 'text'); }}>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Add Child Page
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateDocument(node.id, 'canvas'); }}>
                                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                                Add Child Canvas
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInitiateRename(node); }}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteDocument(node.id); }} className="text-destructive">
                                                <Trash className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Button
                                        variant="ghost"
                                        className="h-6 w-6 p-0 hover:bg-accent text-muted-foreground hover:text-foreground ml-0.5"
                                        onClick={(e) => { e.stopPropagation(); onCreateDocument(node.id); }}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCreateDocument(node.id, 'text'); }}>
                                <FileText className="mr-2 h-4 w-4" />
                                Add Child Page
                            </ContextMenuItem>
                            <ContextMenuItem onClick={(e) => { e.stopPropagation(); onCreateDocument(node.id, 'canvas'); }}>
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Add Child Canvas
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={(e) => { e.stopPropagation(); onInitiateRename(node); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={(e) => { e.stopPropagation(); onDeleteDocument(node.id); }} className="text-destructive">
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>

                    {isExpanded && (
                        <Droppable droppableId={node.id} type="DOCUMENT" isCombineEnabled>
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="flex flex-col w-full"
                                >
                                    {node.children && node.children.map((child, childIndex) => (
                                        <MemoizedTreeNode
                                            key={child.id}
                                            node={child as Document & { children?: Document[] }}
                                            level={level + 1}
                                            index={childIndex}
                                            isActive={activeDocumentId === child.id}
                                            activeDocumentId={activeDocumentId}
                                            onSelectDocument={onSelectDocument}
                                            onCreateDocument={onCreateDocument}
                                            onDeleteDocument={onDeleteDocument}
                                            onMoveDocument={onMoveDocument}
                                            onUpdateDocument={onUpdateDocument}
                                            onInitiateRename={onInitiateRename}
                                            onDoubleClickDocument={onDoubleClickDocument}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    )}
                </div>
            )}
        </Draggable>
    )
})

export function SidebarTree({ documents, activeDocumentId, onSelectDocument, onCreateDocument, onDeleteDocument, onMoveDocument, onUpdateDocument, onDoubleClickDocument }: SidebarTreeProps) {
    const { t } = useLanguage()

    // Build tree
    const tree = React.useMemo(() => {
        const docMap = new Map<string, Document & { children: Document[] }>()
        const roots: Document[] = []
        documents.forEach(doc => docMap.set(doc.id, { ...doc, children: [] }))
        documents.forEach(doc => {
            const node = docMap.get(doc.id)!
            if (doc.parentId && docMap.has(doc.parentId)) {
                docMap.get(doc.parentId)!.children.push(node)
            } else {
                roots.push(node)
            }
        })
        // Sort logically
        roots.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.title || '').localeCompare(b.title || ''))
        roots.forEach(doc => {
            if (doc.children && doc.children.length > 0) doc.children.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.title || '').localeCompare(b.title || ''))
        })
        return roots
    }, [documents])

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId, combine } = result;

        // Handle combine (dropping ONTO another item)
        if (combine) {
            console.log("Combined", draggableId, "into", combine.draggableId);
            if (onMoveDocument) {
                onMoveDocument(draggableId, combine.draggableId);
            }
            return;
        }

        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) return;

        console.log("Moved", draggableId, "from", source.droppableId, "to", destination.droppableId);

        let newParentId: string | null = destination.droppableId;
        if (newParentId === 'root') {
            newParentId = null;
        }

        if (onMoveDocument) {
            onMoveDocument(draggableId, newParentId, destination.index);
        }
    };

    // Rename Logic
    const [renameNode, setRenameNode] = useState<Document | null>(null)

    const handleRename = (newName: string) => {
        if (!renameNode) return

        let updatedDoc = { ...renameNode, title: newName }

        if (renameNode.type === 'text' || !renameNode.type) {
            const content = renameNode.content || ''
            const lines = content.split('\n')
            if (lines.length > 0 && lines[0].startsWith('# ')) {
                lines[0] = `# ${newName}`
            } else {
                lines.unshift(`# ${newName}`)
            }
            updatedDoc.content = lines.join('\n')
        }
        // For canvas, we just update title (already done above), and content stays as JSON

        onUpdateDocument(updatedDoc)
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="root" type="DOCUMENT" isCombineEnabled>
                {(provided) => (
                    <div
                        className="flex flex-col gap-0.5 py-2 w-full overflow-hidden"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                    >
                        {tree.map((node, index) => (
                            <MemoizedTreeNode
                                key={node.id}
                                node={node}
                                level={0}
                                index={index}
                                isActive={activeDocumentId === node.id}
                                activeDocumentId={activeDocumentId}
                                onSelectDocument={onSelectDocument}
                                onCreateDocument={onCreateDocument}
                                onDeleteDocument={onDeleteDocument}
                                onMoveDocument={onMoveDocument}
                                onUpdateDocument={onUpdateDocument}
                                onInitiateRename={setRenameNode}
                                onDoubleClickDocument={onDoubleClickDocument}
                            />
                        ))}
                        {provided.placeholder}

                        {documents.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {t('noDocumentsYet') || 'No documents yet.'}
                            </div>
                        )}
                    </div>
                )}
            </Droppable>

            <RenameDialog
                isOpen={!!renameNode}
                onClose={() => setRenameNode(null)}
                onRename={handleRename}
                initialValue={renameNode?.title || ''}
                title={`Rename ${renameNode?.type === 'canvas' ? 'Canvas' : 'Page'}`}
            />
        </DragDropContext>
    )
}
