'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useAutoSave } from '../../hooks/useAutoSave'
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { ChevronLeft, Loader2, Eye, Pencil, Star, Tag, Columns, Rows, MoreVertical, Check, Plus, PanelLeft, PanelTop, MessageSquare, Link2, ChevronDown, ChevronRight, Frame, FileText, Share2, FolderInput } from 'lucide-react'
import type { Document } from '../../../core/types/notes'
import { MoveDocumentDialog } from './components/move-document-dialog'
import { cn } from '../../lib/utils/utils'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../../components/ui/breadcrumb"
import { triggerHaptic } from '../../lib/utils/haptics'
import { CommandMenu } from '../../components/editor/command-menu'
import { Badge } from '../../components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { Editor, EditorRef } from '../../components/editor/editor'
import { NotesPanel } from '../notes/components/notes-panel'
import { useLanguage } from '../../context/LanguageContext'
import { ShareDialog } from '../collaboration/share-dialog'


interface DocumentViewProps {
    document: Document
    documents: Document[]
    onUpdateDocument: (doc: Document) => void
    onOpenDocument?: (docId: string) => void
    onClose?: () => void
    onSplit?: (direction: 'horizontal' | 'vertical') => void
    showSidebar?: boolean
    onToggleSidebar?: () => void
    showTabs?: boolean
    onToggleTabs?: () => void
    onReplaceDocument?: (docId: string) => void
    forwardPath?: string[]
    onNavigate?: (id: string) => void
    hideBorder?: boolean
}

import React from 'react'

import { buildChildrenMap, getLongestTitle, tryParseTags, type SnapPosition, SNAP_STORAGE_KEY } from './lib/subdocs-utils'
import { SubdocsPanel } from './components/subdocs-panel'





export function DocumentView({
    document,
    documents,
    onUpdateDocument,
    onOpenDocument,
    onClose,
    onSplit,
    showSidebar,
    onToggleSidebar,
    showTabs,
    onToggleTabs,
    onReplaceDocument,
    forwardPath,
    onNavigate,
    hideBorder,
}: DocumentViewProps) {
    const { t } = useLanguage()
    // State for local changes
    const [title, setTitle] = useState(document.title || '')
    // null = content not yet loaded from API (prevents autosave from firing with '')
    const [content, setContent] = useState<string | null>(document.content ?? null)
    const [isEditing, setIsEditing] = useState(true)
    const [localShowNotes, setLocalShowNotes] = useState(false)
    const [tags, setTags] = useState<string[]>(tryParseTags(document.tags))
    const [tagInput, setTagInput] = useState('')
    const isMobile = useMediaQuery('(max-width: 768px)')
    const [shareOpen, setShareOpen] = useState(false)
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)

    // Command Menu State
    const [commandMenu, setCommandMenu] = useState<{
        isOpen: boolean
        type: 'slash' | 'mention'
        query: string
        position: { top: number; left: number }
        triggerIndex: number
    }>({
        isOpen: false,
        type: 'slash',
        query: '',
        position: { top: 0, left: 0 },
        triggerIndex: -1
    })

    const editorRef = useRef<EditorRef>(null)

    // Subdocuments panel state (lifted here so it controls layout)
    const [subdocsSnap, setSubdocsSnap] = useState<SnapPosition>(() => {
        try { return (localStorage.getItem(SNAP_STORAGE_KEY) as SnapPosition) || 'right' } catch { return 'right' }
    })
    const [subdocsCollapsed, setSubdocsCollapsed] = useState(false)
    const persistSubdocsSnap = React.useCallback((s: SnapPosition) => {
        setSubdocsSnap(s)
        try { localStorage.setItem(SNAP_STORAGE_KEY, s) } catch { }
    }, [])

    const subdocsChildrenMap = useMemo(() => buildChildrenMap(documents), [documents])
    const hasSubdocs = (subdocsChildrenMap.get(document.id) || []).length > 0
    const subdocsPanelWidth = useMemo(() => {
        const longest = getLongestTitle(subdocsChildrenMap, document.id)
        return Math.max(160, longest + 20)
    }, [subdocsChildrenMap, document.id])

    const renderSubdocs = (targetSnap: SnapPosition) => {
        if (!hasSubdocs) return null
        const activeSnap = isMobile ? 'center' : subdocsSnap
        if (activeSnap !== targetSnap) return null
        return (
            <SubdocsPanel
                documents={documents}
                parentId={document.id}
                onOpenDocument={onOpenDocument}
                snap={activeSnap}
                onSnapChange={persistSubdocsSnap}
                panelWidth={subdocsPanelWidth}
                collapsed={subdocsCollapsed}
                onCollapsedChange={setSubdocsCollapsed}
            />
        )
    }

    // Helper tryParseTags is now imported/declared globally.

    const { isSaving, lastSaved } = useAutoSave(document.id, content, title);

    // Sync changes to parent state when auto-save completes
    useEffect(() => {
        if (lastSaved) {
            onUpdateDocument({
                ...document,
                title: title,
                content: content,
                updatedAt: new Date() // Optimistic update
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastSaved])
    // Sync state when document prop changes (e.g. user opens a different document).
    // content is set to null first so useAutoSave does not fire during the load window.
    useEffect(() => {
        setTitle(document.title || '')
        setTags(tryParseTags(document.tags))

        if (document.content !== undefined && document.content !== null) {
            // Content already available (e.g. from cache / prefetch)
            setContent(document.content || '');
        } else {
            // Reset to null while we fetch — prevents autosave from saving ''
            setContent(null);
            if (document.id) {
                import('../../actions/actions').then(({ getDocument }) => {
                    getDocument(document.id).then(fullDoc => {
                        setContent(fullDoc.content || '');
                        onUpdateDocument({ ...document, content: fullDoc.content || '' });
                    }).catch(console.error);
                });
            }
        }
    }, [document.id, document.title, document.content, document.tags])

    // Calculate breadcrumbs
    const breadcrumbs = useMemo(() => {
        const path: Document[] = [];
        let current: Document | undefined = document;
        while (current) {
            path.unshift(current);
            if (current.parentId) {
                current = documents.find(d => d.id === current?.parentId);
            } else {
                current = undefined;
            }
        }
        return path;
    }, [document, documents]);

    // Calculate breadcrumb items including forward path
    const breadcrumbItems = useMemo(() => {
        const items: Array<{ id: string, title?: string, isForward: boolean, isRoot?: boolean }> = [
            { id: 'dashboard', title: 'Documents', isForward: false, isRoot: true },
            ...breadcrumbs.map(doc => ({ id: doc.id, title: doc.title, isForward: false }))
        ];

        if (forwardPath && forwardPath.length > 0) {
            // Find the documents for the forward path, filtering those already in parent path
            const parentIds = new Set(breadcrumbs.map(d => d.id));
            forwardPath.forEach(id => {
                if (!parentIds.has(id)) {
                    const doc = documents.find(d => d.id === id);
                    if (doc) {
                        items.push({ ...doc, isForward: true });
                    }
                }
            });
        }
        return items;
    }, [breadcrumbs, forwardPath, documents]);


    const updateTags = React.useCallback((newTags: string[]) => {
        const tagsString = JSON.stringify(newTags);
        onUpdateDocument({ ...document, tags: tagsString });
        import('../../actions/actions').then(({ updateDocument: updateDocApi }) => {
            updateDocApi(document.id, { tags: tagsString });
        });
    }, [document, onUpdateDocument])

    const toggleFavorite = React.useCallback(() => {
        const newStatus = !document.isFavorite;
        onUpdateDocument({ ...document, isFavorite: newStatus });
        import('../../actions/actions').then(({ updateDocument: updateDocApi }) => {
            updateDocApi(document.id, { isFavorite: newStatus });
        });
    }, [document, onUpdateDocument]);

    const handleAddTag = React.useCallback(() => {
        if (!tagInput.trim()) return;
        if (tags.includes(tagInput.trim())) {
            setTagInput('');
            return;
        }
        const newTags = [...tags, tagInput.trim()];
        setTags(newTags);
        setTagInput('');
        updateTags(newTags);
    }, [tagInput, tags, updateTags]);

    const removeTag = React.useCallback((tagToRemove: string) => {
        const newTags = tags.filter(t => t !== tagToRemove);
        setTags(newTags);
        updateTags(newTags);
    }, [tags, updateTags]);

    const handleCommandSelect = React.useCallback((value: string) => {
        if (!editorRef.current?.editor) return
        const editor = editorRef.current.editor

        // Calculate range to delete (trigger + query)
        const range = {
            from: commandMenu.triggerIndex,
            to: commandMenu.triggerIndex + 1 + (commandMenu.query?.length || 0)
        }

        // Base command chain (shared across all actions)
        const chain = editor.chain().focus().deleteRange(range)

        // Action Dispatch Map (Strategy Pattern)
        const actions: Record<string, () => void> = {
            '# ': () => chain.setHeading({ level: 1 }).run(),
            '## ': () => chain.setHeading({ level: 2 }).run(),
            '### ': () => chain.setHeading({ level: 3 }).run(),
            '- ': () => chain.toggleBulletList().run(),
            '1. ': () => chain.toggleOrderedList().run(),
            '- [ ] ': () => chain.toggleTaskList().run(),
            '> ': () => chain.toggleBlockquote().run(),
            'image': () => {
                const url = window.prompt('Enter image URL')
                url ? chain.setImage({ src: url }).run() : chain.run()
            },
            'audio': () => {
                const url = window.prompt('Enter audio URL')
                // @ts-ignore
                url ? chain.insertContent({ type: 'audio', attrs: { src: url } }).run() : chain.run()
            },
            'table': () => {
                // @ts-ignore
                chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
        }

        // Execute action based on matched value or fallback to dynamic ones
        if (value in actions) {
            actions[value]()
        } else if (value.startsWith('```')) {
            chain.toggleCodeBlock().run()
        } else {
            // Mentions, links, or plain content
            chain.insertContent(value).run()
        }

        setCommandMenu(prev => ({ ...prev, isOpen: false }))
    }, [commandMenu.query?.length, commandMenu.triggerIndex])



    return (
        <div className={cn("flex flex-col h-full animate-in fade-in duration-300", hideBorder ? "bg-muted/50" : "bg-background")}>
            {/* Header / Toolbar */}
            <div className="h-16 flex items-center justify-between px-3 md:px-4 bg-transparent sticky top-0 z-10">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isMobile ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                triggerHaptic('light');
                                if (onNavigate) {
                                    onNavigate('dashboard');
                                } else if (onClose) {
                                    onClose();
                                }
                            }}
                            className="flex items-center gap-1 px-2 -ml-1 text-primary font-medium hover:bg-secondary/50 rounded-xl active:scale-95 transition-all min-h-[44px]"
                            aria-label="Volver a Notas"
                        >
                            <ChevronLeft className="h-5 w-5" />
                            <span className="text-sm font-semibold">Notas</span>
                        </Button>
                    ) : onToggleSidebar && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleSidebar}
                            title={showSidebar ? "Close Sidebar" : "Open Sidebar"}
                            className="bg-transparent"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                    )}

                    {!isMobile && (
                        <div className="flex-1 min-w-0" style={{ containerType: 'inline-size' }}>
                            <style>{`
                                .breadcrumb-ellipsis { display: none; }
                                @container (max-width: 350px) {
                                    .breadcrumb-old { display: none !important; }
                                    .breadcrumb-ellipsis { display: flex !important; }
                                }
                            `}</style>
                            <Breadcrumb className="min-w-0">
                                <BreadcrumbList className="flex-nowrap overflow-hidden">
                                    <li className="breadcrumb-ellipsis items-center shrink-0 text-muted-foreground/50">
                                        ...
                                        <ChevronRight className="h-3.5 w-3.5 ml-1.5 text-muted-foreground/50 translate-y-[0.5px]" />
                                    </li>
                                    {breadcrumbItems.map((item, index) => {
                                        const isCurrent = item.id === document.id;
                                        const isLast = index === breadcrumbItems.length - 1;
                                        const isOld = index < breadcrumbItems.length - 2;

                                        return (
                                            <React.Fragment key={item.id}>
                                                <BreadcrumbItem className={cn("min-w-0 truncate", isOld && "breadcrumb-old")}>
                                                    {isCurrent ? (
                                                        <BreadcrumbPage className="font-bold truncate max-w-[150px] leading-none flex items-center">{item.title || t('untitledDocument')}</BreadcrumbPage>
                                                    ) : (
                                                        <BreadcrumbLink asChild className="truncate min-w-0 flex items-center">
                                                            <button
                                                                className={cn(
                                                                    "cursor-pointer hover:text-foreground transition-colors truncate max-w-[120px] leading-none",
                                                                    item.isForward ? "text-muted-foreground/40 italic" : "text-muted-foreground"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    if (item.id !== document.id) {
                                                                        onReplaceDocument?.(item.id);
                                                                    }
                                                                }}
                                                            >
                                                                {item.title || t('untitledDocument')}
                                                            </button>
                                                        </BreadcrumbLink>
                                                    )}
                                                </BreadcrumbItem>
                                                {!isLast && (
                                                    <BreadcrumbSeparator className={cn("shrink-0 mx-1.5 flex items-center justify-center [&>svg]:translate-y-[0.5px]", isOld && "breadcrumb-old")} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {isMobile ? (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
                            {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : lastSaved ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : null}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 transition-opacity duration-300 min-w-[100px] justify-end mr-2">
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {t('saving')}
                                </>
                            ) : lastSaved ? (
                                t('saved')
                            ) : null}
                        </span>
                    )}

                    {!isMobile && (
                        <>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)} title={isEditing ? t('viewMode') : t('editMode')}>
                                {isEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                            </Button>

                            {onToggleTabs && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onToggleTabs}
                                    title={showTabs ? t('hideTabs') : t('showTabs')}
                                    className={cn(!showTabs && "text-muted-foreground/50")}
                                >
                                    <PanelTop className="h-4 w-4" />
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setLocalShowNotes(!localShowNotes)}
                                title={localShowNotes ? t('closeNotes') : t('openNotes')}
                                className={cn(localShowNotes && "bg-accent text-accent-foreground")}
                            >
                                <MessageSquare className="h-4 w-4" />
                            </Button>
                        </>
                    )}


                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <div className="p-2">
                                {isMobile && (
                                    <>
                                        <DropdownMenuItem className="cursor-pointer" onClick={() => setIsEditing(!isEditing)}>
                                            <div className="flex items-center gap-2">
                                                {isEditing ? <Eye className="h-4 w-4 text-muted-foreground" /> : <Pencil className="h-4 w-4 text-muted-foreground" />}
                                                <span>{isEditing ? t('viewMode') : t('editMode')}</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer" onClick={() => setLocalShowNotes(!localShowNotes)}>
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                <span>{localShowNotes ? t('closeNotes') : t('openNotes')}</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <div className="flex items-center justify-between px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer" onClick={toggleFavorite}>
                                    <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-muted-foreground" />
                                        <span>{t('favorite')}</span>
                                    </div>
                                    {document.isFavorite && <Check className="h-4 w-4 ml-auto" />}
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer" onClick={() => setMoveDialogOpen(true)}>
                                    <FolderInput className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>Mover a...</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer" onClick={() => setShareOpen(true)}>
                                    <Share2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <span>{t('share')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />


                                {onSplit && !isMobile && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onSplit('horizontal')}>
                                            <Columns className="h-4 w-4 mr-2" />
                                            <span>{t('splitRight')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onSplit('vertical')}>
                                            <Rows className="h-4 w-4 mr-2" />
                                            <span>{t('splitDown')}</span>
                                        </DropdownMenuItem>
                                    </>
                                )}

                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Tag className="h-4 w-4" />
                                        <span className="text-sm font-medium">{t('tags')}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {tags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-destructive/10 text-[10px] px-1 py-0" onClick={(e) => {
                                                e.stopPropagation();
                                                removeTag(tag);
                                            }}>
                                                {tag} &times;
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex gap-1">
                                        <Input
                                            value={tagInput}
                                            onChange={e => setTagInput(e.target.value)}
                                            placeholder={t('addTag')}
                                            className="h-7 text-xs bg-white/5 border-white/10 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleAddTag();
                                                }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleAddTag();
                                        }}>
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ShareDialog open={shareOpen} onOpenChange={setShareOpen} elementId={document.id} elementType={document.type === 'canvas' ? 'canvas' : 'document'} />
                    <MoveDocumentDialog
                        document={document}
                        documents={documents}
                        isOpen={moveDialogOpen}
                        onClose={() => setMoveDialogOpen(false)}
                        onMove={(docId, newParentId) => {
                            onUpdateDocument({ ...document, parentId: newParentId });
                            import('../../actions/actions').then(({ updateDocument }) => {
                                updateDocument(docId, { parentId: newParentId });
                            });
                        }}
                    />
                </div>
            </div>

            {/* Tags Display */}
            {tags.length > 0 && (
                <div className="px-4 lg:px-8 pt-4 pb-0 max-w-3xl mx-auto w-full">
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs text-muted-foreground border-transparent bg-secondary/50">
                                #{tag}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Area — flex row: [left panel?] [scroll area] [right panel?] [notes?] */}
            <div id="document-content-area" className="flex-1 flex overflow-hidden relative">
                {/* Unified Subdocs Renderer */}
                {renderSubdocs('left')}

                {/* Main scrollable content */}
                <div className="flex-1 overflow-auto relative">
                    <div className="max-w-3xl mx-auto py-8 px-4 lg:px-8 min-h-full pb-[50vh]">
                        <div className="space-y-6">
                            {isEditing ? (
                                <textarea
                                    value={title}
                                    rows={1}
                                    ref={(el) => {
                                        if (el) {
                                            el.style.height = 'auto';
                                            el.style.height = `${el.scrollHeight}px`;
                                        }
                                    }}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                        onUpdateDocument({ ...document, title: e.target.value });
                                    }}
                                    className="text-2xl sm:text-3xl md:text-4xl font-bold border-none bg-transparent px-0 focus:outline-none focus:ring-0 ring-0 shadow-none placeholder:text-muted-foreground/30 w-full resize-none overflow-hidden leading-tight break-words"
                                    placeholder={t('untitledDocument')}
                                />
                            ) : (
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold min-h-[1.2em] leading-tight break-words">{title || t('untitledDocument')}</h1>
                            )}

                            {renderSubdocs('center')}

                            {content === null ? (
                                <div className="text-muted-foreground animate-pulse py-4 text-sm font-medium">{t('loading')}...</div>
                            ) : (
                                <Editor
                                    key={document.id}
                                    ref={editorRef}
                                    documentId={document.id}
                                    content={content}
                                    placeholder={t('startWriting')}
                                    onChange={setContent}
                                    editable={isEditing}
                                    onLinkClick={(href) => onOpenDocument?.(href)}
                                    onCommandTrigger={(position, query, triggerIndex, type) => {
                                        setCommandMenu({ isOpen: true, position, query, triggerIndex, type })
                                    }}
                                    onCommandUpdate={(query) => {
                                        setCommandMenu(prev => ({ ...prev, query }))
                                    }}
                                    onCommandClose={() => {
                                        setCommandMenu(prev => ({ ...prev, isOpen: false }))
                                    }}
                                    onKeyDown={(e) => {
                                        if (commandMenu.isOpen && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape')) {
                                            return true
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <CommandMenu
                        isOpen={commandMenu.isOpen}
                        position={commandMenu.position}
                        query={commandMenu.query}
                        type={commandMenu.type}
                        documents={documents}
                        onSelect={handleCommandSelect}
                        onClose={() => setCommandMenu(prev => ({ ...prev, isOpen: false }))}
                    />
                </div>

                {renderSubdocs('right')}

                {/* Local Notes Panel */}
                {localShowNotes && (
                    <div className="w-[300px] border-l border-border/50 bg-background shrink-0 flex flex-col animate-in slide-in-from-right duration-300">
                        <NotesPanel
                            documentId={document.id}
                            title={document.title}
                            documents={documents}
                            onNavigate={onOpenDocument}
                            className="h-full border-l-0"
                            onClose={() => setLocalShowNotes(false)}
                        />
                    </div>
                )}
            </div>


        </div>
    )
}
