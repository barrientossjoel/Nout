import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Calendar, Trash2, LayoutDashboard, FileText, BookOpen, Upload, Loader2, X, MoreVertical, Pencil, Link2, ChevronDown, ChevronRight, Network, Bot } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { ScrollArea } from "../../components/ui/scroll-area"
import { cn } from "../../lib/utils/utils"
import { SidebarTree } from "./sidebar-tree"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu"
import { WorkspaceSwitcher } from './workspace-switcher'
import { RenameDialog } from '../../components/ui/rename-dialog'
import type { Document, WorkspaceRecord } from "../../../core/types/notes"
import { useLanguage } from '../../context/LanguageContext'
import { createDocument } from '../../actions/actions'

export type SidebarView = "search" | "calendar" | "trash" | "graph" | "ai" | string // string = documentId

interface SidebarProps {
  currentView: SidebarView
  setCurrentView: (view: SidebarView) => void
  documents: Document[]
  onCreateDocument: (parentId?: string | null, type?: 'text' | 'canvas') => void
  onDeleteDocument: (id: string) => void
  onMoveDocument: (id: string, newParentId: string | null) => void
  showResizeHandles: boolean
  onShowResizeHandlesChange: (show: boolean) => void
  onUpdateDocument: (doc: Document) => void
  workspaces: WorkspaceRecord[]
  activeWorkspaceId: string
  onCreateWorkspace: (name: string) => void
  onDeleteWorkspace: (id: string) => void
  onRenameWorkspace: (id: string, newName: string) => void
  onSwitchWorkspace: (id: string) => void
  onUploadedPdf: (docId: string) => void
  onCloseMobile?: () => void
  onOpenSettings?: () => void
  onDoubleClickDocument?: (id: string) => void
}

export function Sidebar({
  currentView,
  setCurrentView,
  documents,
  onCreateDocument,
  onDeleteDocument,
  onMoveDocument,
  showResizeHandles,
  onShowResizeHandlesChange,
  onUpdateDocument,
  workspaces,
  activeWorkspaceId,
  onCreateWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace,
  onSwitchWorkspace,
  onUploadedPdf,
  onCloseMobile,
  onOpenSettings,
  onDoubleClickDocument
}: SidebarProps) {
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true)
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [renameNode, setRenameNode] = useState<Document | null>(null)

  // F2 Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        const activeDoc = documents.find(d => d.id === currentView)
        if (activeDoc) {
          setRenameNode(activeDoc)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, documents])

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
    onUpdateDocument(updatedDoc)
    setRenameNode(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    e.target.value = ''

    setIsUploading(true)
    try {
      if (file.name.endsWith('.txt')) {
        const text = await file.text()
        const title = file.name.replace(/\.[^/.]+$/, '')
        const newDoc = await createDocument({ title, type: 'text', content: text })
        onUploadedPdf(newDoc.id)
        setIsUploading(false)
        return
      }

      let documentUrl = '';

      // 1. Upload file
      if (file.size > 4 * 1024 * 1024) {
        // Large file: Client-Side Upload to Vercel Blob
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/uploads/blob-token',
        })
        documentUrl = blob.url
      } else {
        // Small file: Server-Side Upload to Cloudinary/Blob
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch('/api/uploads', { method: 'POST', body: formData })
        if (!uploadRes.ok) throw new Error('Upload failed')
        const { url } = await uploadRes.json()
        documentUrl = url
      }

      // 2. Create document of type 'pdf'
      const title = file.name.replace(/\.[^/.]+$/, '') // strip extension
      const newDoc = await createDocument({ title, type: 'pdf', content: documentUrl })

      // 3. Navigate to it (parent handles adding to docs list)
      onUploadedPdf(newDoc.id)
    } catch (err) {
      console.error('PDF upload error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.type !== 'pdf' && (
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  )



  return (
    <div className="flex flex-col h-full bg-background w-full">

      {/* Header - Aligned with TabBar */}
      <div className="h-10 flex items-center px-2 gap-2 bg-background z-10 sticky top-0">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-7 bg-transparent border border-border/30 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", (currentView === "" || currentView === "dashboard") && "text-primary")}
          onClick={() => setCurrentView("dashboard")}
          title="Home"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", currentView === "calendar" && "text-primary")}
          onClick={() => setCurrentView("calendar")}
          title="Calendar"
        >
          <Calendar className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", currentView === "graph" && "text-primary")}
          onClick={() => setCurrentView("graph")}
          title="Graph View"
        >
          <Network className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", currentView === "ai" && "text-primary")}
          onClick={() => setCurrentView("ai")}
          title="AI Assistant"
        >
          <Bot className="h-3.5 w-3.5" />
        </Button>
        {onCloseMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:hidden"
            onClick={onCloseMobile}
            title="Close Menu"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>


      {/* Library — PDFs & Ebooks */}
      {(() => {
        const pdfDocs = documents.filter(d => d.type === 'pdf')
        return (
          <div className="px-2 pt-3 pb-1">
            <div
              className="flex items-center justify-between px-2 mb-1 cursor-pointer hover:bg-muted/30 rounded py-1 transition-colors"
              onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
            >
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
                <div className="h-5 w-5 flex items-center justify-center mr-1">
                  {isLibraryExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                {t('library')}
              </h2>
              <button
                className={cn(
                  'h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors',
                  isUploading && 'opacity-50 cursor-not-allowed'
                )}
                title="Attach PDF or Ebook"
                onClick={() => !isUploading && fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  : <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.epub,.mobi,.azw,.azw3"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {isLibraryExpanded && (
              pdfDocs.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 px-2 py-1">
                  {t('noFilesYet')}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {pdfDocs.map(doc => (
                    <ContextMenu key={doc.id}>
                      <ContextMenuTrigger asChild>
                        <div className="group relative flex items-center w-full">
                          <Button
                            variant={currentView === doc.id ? 'secondary' : 'ghost'}
                            size="sm"
                            className="w-full justify-start px-2 h-8 font-normal pr-8"
                            onClick={() => setCurrentView(doc.id)}
                            onDoubleClick={() => onDoubleClickDocument?.(doc.id)}
                          >
                            <BookOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1 text-left text-xs min-w-0" title={doc.title || t('untitledDocument')}>{doc.title || t('untitledDocument')}</span>
                          </Button>
                          <div className="absolute right-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-accent text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameNode(doc); }}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t('rename')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('deleteOption')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={(e) => { e.stopPropagation(); setRenameNode(doc); }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('rename')}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('deleteOption')}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )
            )}
          </div>
        )
      })()}

      <div
        className="flex items-center justify-between px-2 mt-0 mb-2 cursor-pointer hover:bg-muted/30 rounded py-1 transition-colors mx-2"
        onClick={() => setIsDocumentsExpanded(!isDocumentsExpanded)}
      >
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
          <div className="h-5 w-5 flex items-center justify-center mr-1">
            {isDocumentsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
          {t('documentsHeader')}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-6 w-6 p-0 flex items-center justify-center hover:bg-muted" title="Create New">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onCreateDocument(null, 'text')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>{t('newPage')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateDocument(null, 'canvas')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t('newCanvas')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 pt-0 flex flex-col min-h-full">
          {isDocumentsExpanded && (
            <SidebarTree
              documents={filteredDocuments}
              activeDocumentId={currentView}
              onSelectDocument={setCurrentView}
              onCreateDocument={onCreateDocument}
              onDeleteDocument={onDeleteDocument}
              onMoveDocument={onMoveDocument}
              onUpdateDocument={onUpdateDocument}
              onDoubleClickDocument={onDoubleClickDocument}
            />
          )}


          {documents.some(d => d.isFavorite) && (
            <div className="mt-4 mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider flex items-center gap-1">
                {t('favorites')}
              </h2>
              <div className="space-y-0.5">
                {documents.filter(d => d.isFavorite).map(doc => (
                  <ContextMenu key={doc.id}>
                    <ContextMenuTrigger asChild>
                      <div className="group relative flex items-center w-full">
                        <Button
                          variant={currentView === doc.id ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start px-2 h-8 font-normal pr-8"
                          onClick={() => setCurrentView(doc.id)}
                        >
                          <span className="truncate flex-1 text-left min-w-0" title={doc.title || t('untitledDocument')}>{doc.title || t('untitledDocument')}</span>
                        </Button>
                        <div className="absolute right-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-accent text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameNode(doc); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {t('rename')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('deleteOption')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={(e) => { e.stopPropagation(); setRenameNode(doc); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('rename')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('deleteOption')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4">
            <Button
              variant={currentView === "trash" ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start px-2 h-8 font-normal text-muted-foreground hover:text-foreground"
              onClick={() => setCurrentView("trash")}
              title="Trash"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span className="text-xs">{t('trash')}</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSwitch={onSwitchWorkspace}
        onCreate={onCreateWorkspace}
        onRename={onRenameWorkspace}
        onDelete={onDeleteWorkspace}
        onOpenSettings={onOpenSettings}
      />

      <RenameDialog
        isOpen={!!renameNode}
        onClose={() => setRenameNode(null)}
        onRename={handleRename}
        initialValue={renameNode?.title || ''}
        title={renameNode?.type === 'canvas' ? t('renameCanvas') : t('renamePage')}
      />

    </div>
  )
}
