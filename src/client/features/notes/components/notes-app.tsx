import { useState, useCallback, useEffect } from 'react'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { Sidebar, SidebarView } from "../../../components/layout/sidebar"
import { DocumentView } from "../../documents/document-view"
import { SettingsDialog } from "../../../components/settings/settings-dialog"
import { useNotesData } from '../../../hooks/useNotesData'
import { ErrorBoundary } from '../../../components/error-boundary'
import { createDocument, deleteDocument, updateDocument, getDocuments } from '../../../actions/actions'
import type { Document, LayoutNode, WorkspaceState } from '../../../../core/types/notes'
import { Dashboard } from '../../dashboard/dashboard'
import { CalendarView } from '../../calendar/calendar-view'
import { TrashView } from '../../trash/trash-view'
import { Workspace } from '../../../components/layout/workspace'
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle
} from 'react-resizable-panels'
import { cn } from '../../../lib/utils/utils'
import { SearchCommand } from '../../../components/search/search-command'
import { splitNode, addTabToPane, updateTab, findLayoutNode, pinTab, closeTab, findFirstPaneId } from '../../../lib/utils/layout-utils'
import { CanvasView } from '../../canvas/canvas-view'
import { Button } from '../../../components/ui/button'
import { PanelLeft } from 'lucide-react'
import { useWorkspaces } from '../../../hooks/useWorkspaces'
import { MobileNav } from '../../../components/layout/mobile-nav'
import { KeyboardShortcutsProvider, useKeyboardShortcuts, matchesShortcut } from '../../../context/KeyboardShortcutsContext'

export default function NotesApp() {
  return (
    <KeyboardShortcutsProvider>
      <NotesAppInner />
    </KeyboardShortcutsProvider>
  )
}

function NotesAppInner() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { documents, setDocuments, isLoading, error, refresh } = useNotesData();
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspaceState,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    switchWorkspace,
    saveWorkspaceState
  } = useWorkspaces()

  const {
    layout,
    currentView,
    activePaneId,
    showSidebar,
    showResizeHandles
  } = activeWorkspaceState

  const setCurrentView = (view: SidebarView) => saveWorkspaceState({ currentView: view })
  const setLayout = (newLayout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => {
    saveWorkspaceState((prev: WorkspaceState) => ({
      layout: typeof newLayout === 'function' ? newLayout(prev.layout) : newLayout
    }))
  }
  const setActivePaneId = (id: string) => saveWorkspaceState({ activePaneId: id })
  const setShowSidebar = (showOrFn: boolean | ((prev: boolean) => boolean)) => {
    saveWorkspaceState((prev: WorkspaceState) => ({
      showSidebar: typeof showOrFn === 'function' ? showOrFn(prev.showSidebar) : showOrFn
    }))
  }
  const setShowResizeHandles = (show: boolean) => saveWorkspaceState({ showResizeHandles: show })

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Global search shortcut (configurable)
  const { shortcuts } = useKeyboardShortcuts()
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (matchesShortcut(e, shortcuts.globalSearch)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [shortcuts.globalSearch])

  // Validate currentView against documents when loaded
  useEffect(() => {
    if (!isLoading && currentView !== 'dashboard' && currentView !== 'calendar' && currentView !== 'trash' && currentView !== 'graph' && currentView !== 'ai') {
      const exists = documents.some(d => d.id === currentView)
      if (!exists) {
        // If the document doesn't exist (e.g. deleted on another device), fallback to dashboard
        setCurrentView('dashboard')
      }
    }
  }, [isLoading, documents, currentView])

  // Find active document (for sidebar highlights, maybe not enough for layout)
  // const activeDocument = documents.find(d => d.id === currentView)

  // Actions
  useEffect(() => {
    const handleCreateSub = (e: any) => {
      const { parentId } = (e as CustomEvent).detail
      handleCreateDocument(parentId, 'text')
    }
    window.addEventListener('create-sub-document', handleCreateSub)
    return () => window.removeEventListener('create-sub-document', handleCreateSub)
  }, [layout])

  const handleCreateDocument = async (parentId?: string | null, type: 'text' | 'canvas' = 'text') => {
    try {
      const newDoc = await createDocument({ parentId, type });
      setDocuments((prev: Document[]) => [...prev, newDoc]);
      handleNavigate(newDoc.id); // Open new doc
    } catch (e) {
      console.error("Failed to create doc", e);
    }
  }

  const handleUploadedPdf = async (docId: string) => {
    // Re-fetch documents so the new PDF doc appears in the sidebar
    try {
      const docs = await getDocuments('active')
      setDocuments(docs)
    } catch (e) {
      console.error('Failed to refresh docs after upload', e)
    }
    handleNavigate(docId)
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);

      // Calculate new layout first to find the next active tab
      // effectively forecasting the state after deletion
      const newLayout = cleanupLayoutAfterDelete(layout, id);
      setLayout(newLayout);

      if (currentView === id) {
        // We are deleting the currently viewed document.
        const activePane = findLayoutNode(newLayout, activePaneId);

        if (activePane && activePane.type === 'pane' && activePane.activeTabId) {
          // Switch to the new active tab of the active pane
          setCurrentView(activePane.activeTabId);
        } else {
          setCurrentView('dashboard');
        }
      }

      setDocuments((prev: Document[]) => {
        // Also remove any children of the deleted document to avoid raising them to root
        const removeRecursive = (docs: Document[], targetId: string): Document[] => {
          const toRemove = new Set<string>([targetId]);
          let added = true;
          while (added) {
            added = false;
            for (const doc of docs) {
              if (doc.parentId && toRemove.has(doc.parentId) && !toRemove.has(doc.id)) {
                toRemove.add(doc.id);
                added = true;
              }
            }
          }
          return docs.filter(d => !toRemove.has(d.id));
        };
        return removeRecursive(prev, id);
      });
    } catch (e) {
      console.error("Failed to delete doc", e);
    }
  }

  function cleanupLayoutAfterDelete(node: LayoutNode, id: string): LayoutNode {
    if (node.tabs) {
      const newTabs = node.tabs.filter(t => t !== id)
      if (newTabs.length === 0) {
        // If it was the only tab, we keep the pane but empty or with dashboard?
        // Let's keep it as is for now.
        return { ...node, tabs: [], activeTabId: null }
      }

      let newActiveId = node.activeTabId
      if (node.activeTabId === id) {
        newActiveId = newTabs[newTabs.length - 1]
      }
      return { ...node, tabs: newTabs, activeTabId: newActiveId }
    }
    if (node.children) {
      return { ...node, children: node.children.map(c => cleanupLayoutAfterDelete(c, id)) }
    }
    return node
  }

  const handleUpdateDocument = async (updatedDoc: Document) => {
    // Optimistic update
    setDocuments((prev: Document[]) => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));

    try {
      await updateDocument(updatedDoc.id, {
        title: updatedDoc.title,
        content: updatedDoc.content
      });
    } catch (e) {
      console.error("Failed to update document", e);
      // Revert if needed, but for now we just log
    }
  }

  const handleMoveDocument = async (id: string, newParentId: string | null, newIndex?: number) => {
    if (id === newParentId) return; // Prevent moving into itself

    // Prevent moving into a descendant (circular dependency)
    let current = newParentId;
    while (current) {
      if (current === id) return; // Cycle detected
      const parent = documents.find(d => d.id === current);
      current = parent ? parent.parentId : null;
    }

    // Calculate new order
    const siblings = documents
      .filter(d => d.parentId === newParentId && d.id !== id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    let newOrder = 0;
    if (newIndex !== undefined && siblings.length > 0) {
      if (newIndex === 0) {
        newOrder = (siblings[0].order || 0) - 1024;
      } else if (newIndex >= siblings.length) {
        newOrder = (siblings[siblings.length - 1].order || 0) + 1024;
      } else {
        const prevOrder = siblings[newIndex - 1].order || 0;
        const nextOrder = siblings[newIndex].order || 0;
        newOrder = Math.floor((prevOrder + nextOrder) / 2);
        if (newOrder === prevOrder || newOrder === nextOrder) {
            newOrder = prevOrder + 1; // Basic fallback
        }
      }
    } else if (siblings.length > 0) {
      newOrder = (siblings[siblings.length - 1].order || 0) + 1024;
    }

    // Optimistic update
    const previousDocuments = [...documents];
    setDocuments((prev: Document[]) => prev.map(d => d.id === id ? { ...d, parentId: newParentId, order: newOrder } : d));

    try {
      await updateDocument(id, { parentId: newParentId, order: newOrder });
    } catch (e) {
      console.error("Failed to move document", e);
      // Revert on error
      setDocuments(previousDocuments);
    }
  }

  const handleNavigate = (view: SidebarView, inPane?: boolean, isPreview: boolean = true) => {
    setCurrentView(view)

    if (inPane && view !== "dashboard" && view !== "calendar" && view !== "trash" && view !== "graph" && view !== "ai") {
      setLayout(prev => splitNode(prev, activePaneId, 'horizontal', view))
    } else {
      updateLayoutWithDoc(view, isPreview)
    }

    // Update the layout with the view (could be docId, 'dashboard', 'calendar', or 'trash')
    if (isMobile) {
      setShowSidebar(false)
    }
  }

  const updateLayoutWithDoc = (docId: string, isPreview: boolean = true) => {
    setLayout(prev => {
      if (prev.type === 'dashboard') {
        return {
          ...prev,
          type: 'pane',
          tabs: [docId],
          activeTabId: docId,
          previewTabId: isPreview ? docId : undefined
        }
      }

      const paneIdToUpdate = activePaneId || findLayoutNode(prev, '')?.id || '';
      return addTabToPane(prev, paneIdToUpdate, docId, true, isPreview);
    })
  }



  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading workspace...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-destructive">Error: {error.message}</div>
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* If sidebar is hidden, we might want a way to open it. 
             But the button will be in Workspace headers. 
             So we just conditionally render Sidebar. 
         */}
          {/* Sidebar */}
          {/* Mobile Overlay Backdrop */}
          {isMobile && showSidebar && (
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity"
              onClick={() => setShowSidebar(false)}
            />
          )}

          <div className={cn(
            "flex flex-col bg-background transition-all duration-300 ease-in-out z-[100] flex-shrink-0 pointer-events-auto overflow-hidden",
            isMobile
              ? "fixed top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 border-r border-border shadow-2xl"
              : "relative h-full border-r border-border",
            isMobile
              ? (showSidebar ? "w-[85vw] max-w-[300px] translate-x-0" : "w-[85vw] max-w-[300px] -translate-x-full")
              : (showSidebar ? "w-[250px]" : "w-0 border-none opacity-0")
          )}>
            <Sidebar
              currentView={currentView}
              setCurrentView={handleNavigate}
              documents={documents}
              onCreateDocument={handleCreateDocument}
              onDeleteDocument={handleDeleteDocument}
              onMoveDocument={handleMoveDocument}
              showResizeHandles={showResizeHandles}
              onShowResizeHandlesChange={setShowResizeHandles}
              onUpdateDocument={handleUpdateDocument}
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onCreateWorkspace={createWorkspace}
              onDeleteWorkspace={deleteWorkspace}
              onRenameWorkspace={renameWorkspace}
              onSwitchWorkspace={switchWorkspace}
              onUploadedPdf={handleUploadedPdf}
              onCloseMobile={() => setShowSidebar(false)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onDoubleClickDocument={(id) => {
                const paneId = activePaneId || findFirstPaneId(layout) || '';
                if (paneId) {
                  setLayout(prev => pinTab(prev, paneId, id, true));
                }
              }}
            />
          </div>
          <main className="flex-1 overflow-hidden bg-background flex flex-col relative">
            {(() => {
              const activeDoc = documents.find(d => d.id === currentView)

              return (
                <Workspace
                  layout={layout}
                  documents={documents}
                  onUpdateDocument={handleUpdateDocument}
                  onUpdateLayout={setLayout}
                  onNavigate={handleNavigate}
                  activePaneId={activePaneId}
                  setActivePaneId={setActivePaneId}
                  currentView={currentView}
                  showResizeHandles={showResizeHandles}
                  showSidebar={showSidebar}
                  onToggleSidebar={() => setShowSidebar(prev => !prev)}
                  refreshDocuments={refresh}
                />
              )
            })()}

            {/* Mobile Navigation */}
            {isMobile && (() => {
              const activePane = findLayoutNode(layout, activePaneId) || findLayoutNode(layout, findFirstPaneId(layout) || '')
              const activeTabs = activePane?.type === 'pane' ? (activePane.tabs || []) : []

              return (
                <MobileNav
                  currentView={currentView}
                  documents={documents}
                  tabs={activeTabs}
                  onSelectTab={(id) => handleNavigate(id)}
                  onCloseTab={(id) => {
                    if (activePane?.id) {
                      const newLayout = closeTab(layout, activePane.id, id)
                      setLayout(newLayout)
                    }
                  }}
                  onNavigate={(view) => {
                    if (view === 'search') {
                      setIsSearchOpen(true)
                      if (isMobile) setShowSidebar(false)
                    } else {
                      handleNavigate(view, false, true)
                    }
                  }}
                  onToggleSidebar={() => setShowSidebar(prev => !prev)}
                  onCreateDocument={(type) => handleCreateDocument(null, type)}
                  onOpenSettings={() => {
                    setIsSettingsOpen(true)
                    if (isMobile) setShowSidebar(false)
                  }}
                  onPinTab={(id: string, pinned: boolean) => {
                    if (activePane?.id) {
                      const newLayout = pinTab(layout, activePane.id, id, pinned)
                      setLayout(newLayout)
                    }
                  }}
                  previewTabId={activePane?.type === 'pane' ? activePane.previewTabId : null}
                />
              )
            })()}
          </main>
        </div>
      </div>
      <SearchCommand
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        documents={documents}
        onSelect={handleNavigate}
      />
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        showResizeHandles={showResizeHandles}
        onShowResizeHandlesChange={setShowResizeHandles}
      />
    </ErrorBoundary>
  )
}
