'use client'

import React, { useState, useMemo } from 'react'
import { useKeyboardShortcuts, matchesShortcut } from '../../context/KeyboardShortcutsContext'
import {
    Group as PanelGroup,
    Panel,
    Separator as PanelResizeHandle,
    PanelImperativeHandle
} from 'react-resizable-panels'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { DocumentView } from '../../features/documents/document-view'
import { Dashboard } from '../../features/dashboard/dashboard'
import { CalendarView } from '../../features/calendar/calendar-view'
import { GraphView } from '../../features/graph/graph-view'
import { TrashView } from '../../features/trash/trash-view'
import type { Document as NoteDocument, LayoutNode } from '../../../core/types/notes'
import { cn } from '../../lib/utils/utils'
import { TabBar } from './tab-bar'
import { updateTab, splitNode, addTabToPane, findLayoutNode, swapPaneTabs, replaceTabInPane, pinTab } from '../../lib/utils/layout-utils'
import { CanvasView } from '../../features/canvas/canvas-view'
import { NotesPanel } from '../../features/notes/components/notes-panel'
import { PdfView } from '../../features/pdf/pdf-view'
import { Button } from '../../components/ui/button'
import { PanelRight, Menu, Plus, Copy, Search, Calendar, Settings } from 'lucide-react'
import { MobileNav } from './mobile-nav'
import { selectTabInPane, removeTabFromPane, getGlobalTabs, closeTab, removeNode, findFirstPaneId } from '../../lib/utils/layout-utils'
import { ErrorBoundary } from '../../components/error-boundary'
import { AiPanel } from '../../features/ai/components/ai-panel'

interface WorkspaceProps {
    layout: LayoutNode
    documents: NoteDocument[]
    onUpdateDocument: (doc: NoteDocument) => void
    onUpdateLayout: (layout: LayoutNode) => void
    onNavigate: (id: string) => void
    activePaneId: string
    setActivePaneId: (id: string) => void
    currentView?: string
    showResizeHandles?: boolean
    showSidebar?: boolean
    onToggleSidebar?: () => void
    refreshDocuments?: () => void
}

export function Workspace({
    layout,
    documents,
    onUpdateDocument,
    onUpdateLayout,
    onNavigate,
    activePaneId,
    setActivePaneId,
    currentView,
    showResizeHandles = true,
    showSidebar,
    onToggleSidebar,
    refreshDocuments
}: WorkspaceProps) {
    const isMobile = useMediaQuery('(max-width: 768px)')
    const firstPaneId = React.useMemo(() => findFirstPaneId(layout), [layout])

    const [dragPreview, setDragPreview] = React.useState<{ paneId: string, direction: 'right' } | null>(null)
    const panelRefs = React.useRef<Record<string, PanelImperativeHandle | null>>({})
    const domRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

    // Refs to always have the latest layout and callback inside event listeners with [] deps
    const layoutRef = React.useRef(layout)
    const onUpdateLayoutRef = React.useRef(onUpdateLayout)
    React.useEffect(() => { layoutRef.current = layout }, [layout])
    React.useEffect(() => { onUpdateLayoutRef.current = onUpdateLayout }, [onUpdateLayout])

    const resizeState = React.useRef<{
        active: boolean
        paneId: string
        startX: number
        startY: number
        targets: {
            h?: { id: string, sign: number, initialSize: number, initialPixels: number }
            v?: { id: string, sign: number, initialSize: number, initialPixels: number }
        }
    } | null>(null)

    const moveState = React.useRef<{
        active: boolean
        sourcePaneId: string
        width?: number
        height?: number
    } | null>(null)
    const didMoveRef = React.useRef(false)

    const [moveDragOver, setMoveDragOver] = React.useState<string | null>(null)
    const [movingSourceId, setMovingSourceId] = React.useState<string | null>(null)
    const [moveMousePos, setMoveMousePos] = React.useState<{ x: number, y: number } | null>(null)
    const [forwardPaths, setForwardPaths] = React.useState<Record<string, string[]>>({}) // paneId:tabId -> docIds


    const [isDragging, setIsDragging] = React.useState(false)
    const [dragOverPanel, setDragOverPanel] = React.useState<string | null>(null)

    const [isAltPressed, setIsAltPressed] = React.useState(false)

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Resize handler
            if (resizeState.current?.active) {
                if (!isDragging) setIsDragging(true)
                e.preventDefault()
                const state = resizeState.current
                const deltaX = e.clientX - state.startX
                const deltaY = e.clientY - state.startY

                if (state.targets.h) {
                    const { id, sign, initialSize, initialPixels } = state.targets.h
                    const panel = panelRefs.current[id]
                    if (panel && initialPixels > 0) {
                        const targetChange = (deltaX / initialPixels) * initialSize * sign
                        const newSize = Math.max(5, Math.min(95, initialSize + targetChange))
                        panel.resize(`${newSize}%`)
                    }
                }

                if (state.targets.v) {
                    const { id, sign, initialSize, initialPixels } = state.targets.v
                    const panel = panelRefs.current[id]
                    if (panel && initialPixels > 0) {
                        const targetChange = (deltaY / initialPixels) * initialSize * sign
                        const newSize = Math.max(5, Math.min(95, initialSize + targetChange))
                        panel.resize(`${newSize}%`)
                    }
                }
            }

            // Move handler: find which pane the cursor is over
            if (moveState.current?.active) {
                if (!isDragging) setIsDragging(true)
                setMoveMousePos({ x: e.clientX, y: e.clientY })
                const el = document.elementFromPoint(e.clientX, e.clientY)
                // Walk up to find a pane div (they have data-pane-id)
                let target: Element | null = el
                let targetPaneId: string | null = null
                while (target) {
                    const pid = target.getAttribute('data-pane-id')
                    if (pid && pid !== moveState.current.sourcePaneId) {
                        targetPaneId = pid
                        break
                    }
                    target = target.parentElement
                }
                setMoveDragOver(targetPaneId)
            }
        }

        const handleMouseUp = (e: MouseEvent) => {
            if (resizeState.current?.active) {
                resizeState.current = null
                document.body.style.cursor = ''
                setIsDragging(false)

                // Persist final panel sizes so they survive page refresh.
                // Collect asPercentage from every imperative panel ref, then
                // write them into the layout tree via onUpdateLayout (which
                // the parent already saves to localStorage).
                const sizeMap: Record<string, number> = {}
                Object.entries(panelRefs.current).forEach(([id, ref]) => {
                    const pct = ref?.getSize()?.asPercentage
                    if (typeof pct === 'number') sizeMap[id] = pct
                })
                if (Object.keys(sizeMap).length > 0) {
                    onUpdateLayoutRef.current(updateNodeSizes(layoutRef.current, sizeMap))
                }
            }
            if (moveState.current?.active) {
                const sourcePaneId = moveState.current.sourcePaneId
                moveState.current = null
                document.body.style.cursor = ''
                setIsDragging(false)

                // Determine target pane under cursor
                const el = document.elementFromPoint(e.clientX, e.clientY)
                let target: Element | null = el
                while (target) {
                    const pid = target.getAttribute('data-pane-id')
                    if (pid && pid !== sourcePaneId) {
                        const sourceRef = panelRefs.current[sourcePaneId]
                        const targetRef = panelRefs.current[pid]

                        const sRaw = sourceRef?.getSize()
                        const tRaw = targetRef?.getSize()
                        const sourceSize = typeof sRaw === 'number' ? sRaw : (sRaw?.asPercentage ?? 50)
                        const targetSize = typeof tRaw === 'number' ? tRaw : (tRaw?.asPercentage ?? 50)

                        if (sourceRef && targetRef) {
                            sourceRef.resize(targetSize)
                            targetRef.resize(sourceSize)
                        }

                        // Swap pane contents using the CURRENT layout and their actual sizes
                        onUpdateLayoutRef.current(swapPaneTabs(layoutRef.current, sourcePaneId, pid, sourceSize, targetSize))
                        break
                    }
                    target = target.parentElement
                }
                setMoveDragOver(null)

                // Block the spurious click that fires after mouseup
                didMoveRef.current = true
                window.addEventListener('click', (ev) => {
                    ev.stopPropagation()
                    ev.preventDefault()
                    didMoveRef.current = false
                }, { once: true, capture: true })

                setMovingSourceId(null)
                setMoveMousePos(null)
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setIsAltPressed(true)
                document.body.classList.add('workspace-alt-pressed')
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setIsAltPressed(false)
                document.body.classList.remove('workspace-alt-pressed')
            }
        }
        const handleWorkspaceAltDown = () => {
            setIsAltPressed(true)
            document.body.classList.add('workspace-alt-pressed')
        }
        const handleWorkspaceAltUp = () => {
            setIsAltPressed(false)
            document.body.classList.remove('workspace-alt-pressed')
        }
        const handleBlur = () => {
            if (document.activeElement?.tagName === 'IFRAME') return;
            setIsAltPressed(false)
            document.body.classList.remove('workspace-alt-pressed')
        }

        const handleContextMenu = (e: MouseEvent) => {
            if (e.altKey || isAltPressed) {
                e.preventDefault()
            }
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        window.addEventListener('workspace-alt-keydown', handleWorkspaceAltDown)
        window.addEventListener('workspace-alt-keyup', handleWorkspaceAltUp)
        window.addEventListener('blur', handleBlur)
        window.addEventListener('contextmenu', handleContextMenu)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('workspace-alt-keydown', handleWorkspaceAltDown)
            window.removeEventListener('workspace-alt-keyup', handleWorkspaceAltUp)
            window.removeEventListener('blur', handleBlur)
            window.removeEventListener('contextmenu', handleContextMenu)
        }
    }, [isDragging, isAltPressed])

    const startResize = (paneId: string, x: number, y: number) => {
        const targets = findResizeTargets(layout, paneId)
        if (!targets.h && !targets.v) return

        const hTarget = targets.h ? {
            ...targets.h,
            initialSize: panelRefs.current[targets.h.id]?.getSize().asPercentage || 50,
            initialPixels: domRefs.current[targets.h.id]?.getBoundingClientRect().width || 0
        } : undefined

        const vTarget = targets.v ? {
            ...targets.v,
            initialSize: panelRefs.current[targets.v.id]?.getSize().asPercentage || 50,
            initialPixels: domRefs.current[targets.v.id]?.getBoundingClientRect().height || 0
        } : undefined

        resizeState.current = {
            active: true,
            paneId,
            startX: x,
            startY: y,
            targets: { h: hTarget, v: vTarget }
        }
        setIsDragging(true)
        document.body.style.cursor = 'move'
    }

    // Keyboard shortcuts - using capture phase so nothing (e.g. react-pdf, iframes) can swallow them
    const { shortcuts } = useKeyboardShortcuts()
    const shortcutsRef = React.useRef(shortcuts)
    React.useEffect(() => { shortcutsRef.current = shortcuts }, [shortcuts])

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const s = shortcutsRef.current
            if (matchesShortcut(e, s.splitHorizontal)) {
                e.preventDefault()
                e.stopPropagation()
                handleSplitPane(activePaneId, 'horizontal')
            } else if (matchesShortcut(e, s.splitVertical)) {
                e.preventDefault()
                e.stopPropagation()
                handleSplitPane(activePaneId, 'vertical')
            } else if (matchesShortcut(e, s.closePane)) {
                e.preventDefault()
                e.stopPropagation()
                handleClosePane(activePaneId)
            }
        }

        const handleCustomShortcut = (e: any) => {
            const action = e.detail?.action
            const sourcePaneId = e.detail?.sourcePaneId
            const targetPaneId = sourcePaneId || activePaneId

            if (action === 'horizontal') handleSplitPane(targetPaneId, 'horizontal')
            if (action === 'vertical') handleSplitPane(targetPaneId, 'vertical')
            if (action === 'close') handleClosePane(targetPaneId)
        }

        const handleFocus = (e: any) => {
            const paneId = e.detail?.paneId
            if (paneId) {
                setActivePaneId(paneId)
            }
        }

        window.addEventListener('keydown', handleKeyDown, true)
        window.addEventListener('workspace-shortcut', handleCustomShortcut)
        window.addEventListener('workspace-focus', handleFocus)
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            window.removeEventListener('workspace-shortcut', handleCustomShortcut)
            window.removeEventListener('workspace-focus', handleFocus)
        }
    }, [activePaneId, layout, documents])

    const handleMoveTab = (tabId: string, fromPaneId: string, toPaneId: string, index?: number) => {
        if (fromPaneId === toPaneId) {
            onUpdateLayout(reorderTab(layout, toPaneId, tabId, index))
        } else {
            onUpdateLayout(moveTabBetweenPanes(layout, fromPaneId, toPaneId, tabId, index))
        }
        setActivePaneId(toPaneId)
    }

    const handleMoveTabToSplit = (tabId: string, fromPaneId: string, toPaneId: string, direction: 'right', sourceSize?: number) => {
        onUpdateLayout(moveTabToNewSplit(layout, fromPaneId, toPaneId, tabId, direction, sourceSize))
        // New pane ID will be generated, but for now we focus the target group or wait for re-render
    }

    const handlePaneDragOver = (e: React.DragEvent, paneId: string) => {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.width

        // If near right edge (within 80px or 20%)
        if (x > width - 100) {
            setDragPreview({ paneId, direction: 'right' })
            e.dataTransfer.dropEffect = 'move'
        } else {
            setDragPreview(null)
        }
    }

    const handlePaneDrop = (e: React.DragEvent, paneId: string) => {
        const tabId = e.dataTransfer.getData('tabId')
        const fromPaneId = e.dataTransfer.getData('sourcePaneId')

        if (dragPreview && tabId && fromPaneId) {
            const rawSize = panelRefs.current[fromPaneId]?.getSize()
            const sourceSize = typeof rawSize === 'number' ? rawSize : (rawSize?.asPercentage ?? 50)
            handleMoveTabToSplit(tabId, fromPaneId, paneId, 'right', sourceSize)
        }
        setDragPreview(null)
    }

    const handleToggleTabs = (paneId: string) => {
        onUpdateLayout(toggleNodeTabs(layout, paneId))
    }

    const isOnlyPane = useMemo(() => {
        // A single pane means the layout root is a pane, or a group with only 1 child which is a pane (unlikely but possible).
        const checkSinglePane = (n: LayoutNode): boolean => {
            if (n.type === 'pane' || n.type === 'dashboard') return true;
            if (n.type === 'group' && n.children) {
                const activeChildren = n.children.filter(c => c.type !== 'group' || (c.children && c.children.length > 0));
                if (activeChildren.length === 1) return checkSinglePane(activeChildren[0]);
                return false;
            }
            return false;
        };
        return checkSinglePane(layout);
    }, [layout]);

    const renderNode = (node: LayoutNode) => {
        if (node.type === 'pane') {
            const activeTabId = node.activeTabId
            const doc = documents.find(d => d.id === activeTabId)
            const isActive = node.id === activePaneId
            const isFirstPane = node.id === firstPaneId
            const toggleSidebar = isFirstPane ? onToggleSidebar : undefined

            return (
                <div
                    className={cn("h-full overflow-hidden flex flex-col relative", isActive && "z-10")}
                    data-pane-id={node.id}
                    onClick={(e) => {
                        if (!e.altKey && !didMoveRef.current) setActivePaneId(node.id)
                    }}
                    onContextMenu={(e) => {
                        // Suppress browser context menu when Alt is held (used for resize)
                        if (e.altKey) {
                            e.preventDefault()
                            e.stopPropagation()
                        }
                    }}
                    onMouseDown={(e) => {
                        if (e.altKey && e.button === 2) {
                            // Alt + right click → resize
                            e.preventDefault()
                            e.stopPropagation()
                            startResize(node.id, e.clientX, e.clientY)
                        } else if (e.altKey && e.button === 0) {
                            // Alt + left drag → move pane (Wayland style)
                            e.preventDefault()
                            e.stopPropagation()
                            const rect = domRefs.current[node.id]?.getBoundingClientRect()
                            moveState.current = {
                                active: true,
                                sourcePaneId: node.id,
                                width: rect?.width || 200,
                                height: rect?.height || 150
                            }
                            setMovingSourceId(node.id)
                            setIsDragging(true)
                            document.body.style.cursor = 'grabbing'
                        }
                    }}
                    onDragOver={(e) => handlePaneDragOver(e, node.id)}
                    onDragLeave={() => setDragPreview(null)}
                    onDrop={(e) => handlePaneDrop(e, node.id)}
                >
                    {isActive && !isOnlyPane && (
                        <div className="absolute inset-0 border border-primary pointer-events-none z-[100]" />
                    )}
                    {/* Move-drag: source pane feedback — dimmed "lifted" look */}
                    {movingSourceId === node.id && (
                        <div className="absolute inset-0 z-50 pointer-events-none bg-background/60 backdrop-blur-[2px] ring-1 ring-secondary/60 ring-inset" />
                    )}

                    {/* Move-drag drop target highlight */}
                    {moveDragOver === node.id && (
                        <div className="absolute inset-0 z-50 pointer-events-none ring-1 ring-secondary ring-inset bg-secondary/10" />
                    )}

                    {node.tabs && node.tabs.length > 0 && node.showTabs !== false && (
                        <TabBar
                            paneId={node.id}
                            tabs={node.tabs}
                            activeTabId={activeTabId || null}
                            previewTabId={node.previewTabId}
                            documents={documents}
                            onSelectTab={(id) => handleSelectTab(node.id, id)}
                            onPinTab={(id: string) => onUpdateLayout(pinTab(layout, node.id, id, true))}
                            onCloseTab={(id) => handleCloseTab(node.id, id)}
                            onMoveTab={handleMoveTab}
                        />
                    )}

                    <div className="flex-1 min-h-0 relative">
                        {activeTabId === 'calendar' ? (
                            <CalendarView
                                documents={documents}
                                onOpenDocument={(docId) => onUpdateLayout(addTabToPane(layout, node.id, docId, false, true))}
                                showSidebar={showSidebar}
                                onToggleSidebar={toggleSidebar}
                                showTabs={node.showTabs !== false}
                                onToggleTabs={() => handleToggleTabs(node.id)}
                            />
                        ) : activeTabId === 'graph' ? (
                            <GraphView
                                documents={documents}
                                onNavigate={(docId) => onUpdateLayout(addTabToPane(layout, node.id, docId, true, true))}
                                showSidebar={showSidebar}
                                onToggleSidebar={toggleSidebar}
                                showTabs={node.showTabs !== false}
                                onToggleTabs={() => handleToggleTabs(node.id)}
                            />
                        ) : activeTabId === 'trash' ? (
                            <TrashView
                                showSidebar={showSidebar}
                                onToggleSidebar={toggleSidebar}
                                showTabs={node.showTabs !== false}
                                onToggleTabs={() => handleToggleTabs(node.id)}
                                refreshDocuments={refreshDocuments}
                            />
                        ) : activeTabId === 'notes' ? (
                            <div className="h-full w-full bg-background">
                                <NotesPanel documentId={null} className="h-full border-0" />
                            </div>
                        ) : activeTabId === 'ai' ? (
                            <AiPanel 
                                documents={documents}
                                showSidebar={showSidebar}
                                onToggleSidebar={toggleSidebar}
                                showTabs={node.showTabs !== false}
                                onToggleTabs={() => handleToggleTabs(node.id)}
                            />
                        ) : activeTabId === 'dashboard' || !doc ? (
                            <Dashboard
                                documents={documents}
                                onNavigate={onNavigate}
                                showSidebar={showSidebar}
                                onToggleSidebar={toggleSidebar}
                                showTabs={node.showTabs !== false}
                                onToggleTabs={() => handleToggleTabs(node.id)}
                            />
                        ) : (
                            <ErrorBoundary resetKey={activeTabId ?? undefined}>
                                {doc?.type === 'canvas' ? (
                                    <CanvasView
                                        key={doc.id}
                                        document={doc}
                                        documents={documents}
                                        onUpdateDocument={onUpdateDocument}
                                        showSidebar={showSidebar}
                                        onToggleSidebar={toggleSidebar}
                                        showTabs={node.showTabs !== false}
                                        onToggleTabs={() => handleToggleTabs(node.id)}
                                        onOpenDocument={(docId) => onUpdateLayout(addTabToPane(layout, node.id, docId, true, true))}
                                    />
                                ) : doc?.type === 'pdf' ? (
                                    <PdfView
                                        key={doc.id}
                                        document={doc}
                                        documents={documents}
                                        showSidebar={showSidebar}
                                        onToggleSidebar={toggleSidebar}
                                        showTabs={node.showTabs !== false}
                                        onToggleTabs={() => handleToggleTabs(node.id)}
                                        isActivePane={isActive}
                                        onOpenDocument={(docId) => {
                                            onUpdateLayout(addTabToPane(layoutRef.current, node.id, docId, true, true))
                                        }}
                                    />
                                ) : (
                                    <DocumentView
                                        key={doc.id}
                                        document={doc}
                                        documents={documents}
                                        onUpdateDocument={onUpdateDocument}
                                        onOpenDocument={(docId) => {
                                            onUpdateLayout(addTabToPane(layoutRef.current, node.id, docId, true, true))
                                        }}
                                        onReplaceDocument={(newDocId) => {
                                            const oldDocId = node.activeTabId
                                            if (oldDocId && oldDocId !== newDocId) {
                                                const currentForwardKey = `${node.id}:${oldDocId}`
                                                const currentForward = forwardPaths[currentForwardKey] || []
                                                const newForwardKey = `${node.id}:${newDocId}`

                                                setForwardPaths(prev => {
                                                    // Is this a forward move? (clicking something in the forward path)
                                                    if (currentForward.includes(newDocId)) {
                                                        // Take everything AFTER newDocId in the forward path
                                                        const idx = currentForward.indexOf(newDocId)
                                                        return {
                                                            ...prev,
                                                            [newForwardKey]: currentForward.slice(idx + 1)
                                                        }
                                                    } else {
                                                        // Backward move: add oldDocId to forward path of newDocId
                                                        return {
                                                            ...prev,
                                                            [newForwardKey]: [oldDocId, ...currentForward]
                                                        }
                                                    }
                                                })
                                                onUpdateLayout(replaceTabInPane(layout, node.id, oldDocId, newDocId))
                                            }
                                        }}
                                        forwardPath={forwardPaths[`${node.id}:${node.activeTabId}`]}
                                        onClose={() => handleClosePane(node.id)}
                                        onSplit={(direction) => handleSplitPane(node.id, direction)}
                                        showSidebar={showSidebar}
                                        onToggleSidebar={toggleSidebar}
                                        showTabs={node.showTabs !== false} // default true
                                        onToggleTabs={() => handleToggleTabs(node.id)}
                                        hideBorder={isOnlyPane}
                                    />
                                )}
                            </ErrorBoundary>
                        )}
                    </div>
                </div>
            )
        }

        if (node.type === 'dashboard') {
            const isFirstPane = node.id === firstPaneId
            return <Dashboard
                documents={documents}
                onNavigate={onNavigate}
                showSidebar={showSidebar}
                onToggleSidebar={isFirstPane ? onToggleSidebar : undefined}
            />
        }

        if (node.type === 'group' && node.children) {
            const isVertical = node.direction === 'vertical' || isMobile
            return (
                <PanelGroup orientation={isVertical ? 'vertical' : 'horizontal'}>
                    {node.children.map((child, index) => (
                        <React.Fragment key={child.id}>
                            <Panel
                                panelRef={(el) => { panelRefs.current[child.id] = el }}
                                defaultSize={child.size || 100 / node.children!.length}
                            >
                                <div
                                    ref={(el) => { domRefs.current[child.id] = el }}
                                    className={cn("h-full w-full", isDragging && "select-none")}
                                >
                                    {renderNode(child)}
                                </div>
                            </Panel>
                            {index < node.children!.length - 1 && (
                                <PanelResizeHandle
                                    disabled={!showResizeHandles}
                                    onPointerDown={() => setIsDragging(true)}
                                    className={cn(
                                        "bg-border hover:bg-primary/50 transition-colors z-50",
                                        isVertical
                                            ? cn("h-px w-full", showResizeHandles && "cursor-row-resize")
                                            : cn("w-px h-full", showResizeHandles && "cursor-col-resize")
                                    )}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </PanelGroup>
            )
        }

        return null
    }

    const handleSelectTab = (paneId: string, tabId: string) => {
        onUpdateLayout(updateTab(layout, paneId, tabId))
    }

    const handleCloseTab = (paneId: string, tabId: string) => {
        const node = findLayoutNode(layout, paneId)
        if (node && node.tabs && node.tabs.length === 1 && node.tabs[0] === tabId) {
            handleClosePane(paneId)
        } else {
            onUpdateLayout(closeTab(layout, paneId, tabId))
        }
    }

    const handleClosePane = (paneId: string) => {
        const newLayout = removeNode(layout, paneId)
        if (!newLayout || (newLayout.type === 'group' && (!newLayout.children || newLayout.children.length === 0))) {
            onUpdateLayout({ id: 'root', type: 'dashboard' })
        } else {
            onUpdateLayout(newLayout)
        }
    }

    const handleSplitPane = (paneId: string, direction: 'horizontal' | 'vertical') => {
        const newLayout = splitNode(layout, paneId, direction)
        onUpdateLayout(newLayout)
    }

    // Find active document ID
    const activePane = findLayoutNode(layout, activePaneId)
    const activeTabId = activePane?.activeTabId
    const activeDoc = documents.find(d => d.id === activeTabId)

    const movingPane = movingSourceId ? findLayoutNode(layout, movingSourceId) : null
    const movingTabId = movingPane?.activeTabId
    const movingDoc = documents.find(d => d.id === movingTabId)
    const movingLabel = movingDoc?.title || movingTabId || 'Panel'

    return (
        <div className="flex-1 h-full overflow-hidden flex flex-row relative">
            <style>{`
                body.workspace-alt-pressed iframe, 
                body.workspace-alt-pressed canvas, 
                body.workspace-alt-pressed [data-page-number] { 
                    pointer-events: none !important; 
                }
            `}</style>
            {(isAltPressed || isDragging) && (
                <style>{`
                    iframe, canvas, [data-page-number] { pointer-events: none !important; }
                `}</style>
            )}
            <div className={cn("flex-1 h-full overflow-hidden flex flex-col", isMobile && "pb-16")}>
                {renderNode(layout)}
            </div>

            {/* Wayland-style floating ghost: follows cursor during Alt+drag */}
            {moveMousePos && movingSourceId && (
                <div
                    className="fixed z-[9999] pointer-events-none select-none"
                    style={{
                        left: moveMousePos.x + 14,
                        top: moveMousePos.y - 16,
                    }}
                >
                    <div className="bg-background/90 backdrop-blur-md border border-primary/50 shadow-2xl rounded-lg overflow-hidden flex flex-col"
                        style={{
                            width: moveState.current?.width || 200,
                            height: moveState.current?.height || 150
                        }}>
                        {/* Ghost title bar */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-primary/20">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs font-medium text-foreground truncate">{movingLabel}</span>
                        </div>
                        {/* Ghost content hint */}
                        <div className="px-3 py-2 space-y-1.5">
                            <div className="h-1.5 rounded-full bg-muted-foreground/20 w-full" />
                            <div className="h-1.5 rounded-full bg-muted-foreground/15 w-3/4" />
                            <div className="h-1.5 rounded-full bg-muted-foreground/10 w-5/6" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}



function findActiveTabId(node: LayoutNode, paneId: string): string | null | undefined {
    if (node.id === paneId) return node.activeTabId
    if (node.children) {
        for (const child of node.children) {
            const found = findActiveTabId(child, paneId)
            if (found !== undefined) return found
        }
    }
    return undefined
}

function reorderTab(node: LayoutNode, paneId: string, tabId: string, targetIndex?: number): LayoutNode {
    if (node.id === paneId && node.tabs) {
        const newTabs = node.tabs.filter(t => t !== tabId)
        const index = targetIndex ?? newTabs.length
        newTabs.splice(index, 0, tabId)
        return { ...node, tabs: newTabs, activeTabId: tabId }
    }
    if (node.children) {
        return { ...node, children: node.children.map(c => reorderTab(c, paneId, tabId, targetIndex)) }
    }
    return node
}

function moveTabBetweenPanes(node: LayoutNode, fromId: string, toId: string, tabId: string, index?: number): LayoutNode {
    // 1. Remove from source
    const remove = (n: LayoutNode): LayoutNode => {
        if (n.id === fromId && n.tabs) {
            const newTabs = n.tabs.filter(t => t !== tabId)
            let newActiveId = n.activeTabId
            if (newActiveId === tabId) {
                newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null
            }
            return { ...n, tabs: newTabs, activeTabId: newActiveId }
        }
        if (n.children) {
            return { ...n, children: n.children.map(remove) }
        }
        return n
    }

    // 2. Add to target
    const add = (n: LayoutNode): LayoutNode => {
        if (n.id === toId && n.tabs) {
            const newTabs = n.tabs.filter(t => t !== tabId)
            const targetIndex = index ?? newTabs.length
            newTabs.splice(targetIndex, 0, tabId)
            return { ...n, tabs: newTabs, activeTabId: tabId }
        }
        if (n.children) {
            return { ...n, children: n.children.map(add) }
        }
        return n
    }

    return add(remove(node))
}

function moveTabToNewSplit(node: LayoutNode, fromId: string, toId: string, tabId: string, direction: 'right', sourceSize: number = 50): LayoutNode {
    const newNodeId = Math.random().toString(36).substring(7)

    // 1. Remove from source
    const remove = (n: LayoutNode): LayoutNode => {
        if (n.id === fromId && n.tabs) {
            const newTabs = n.tabs.filter(t => t !== tabId)
            let newActiveId = n.activeTabId
            if (newActiveId === tabId) {
                newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null
            }
            return { ...n, tabs: newTabs, activeTabId: newActiveId }
        }
        if (n.children) {
            return { ...n, children: n.children.map(remove) }
        }
        return n
    }

    // 2. Split target and add tab
    const splitAndAdd = (n: LayoutNode): LayoutNode => {
        if (n.id === toId) {
            return {
                id: `group-${n.id}`,
                type: 'group',
                direction: 'horizontal',
                children: [
                    { ...n, size: 100 - sourceSize },
                    {
                        id: newNodeId,
                        type: 'pane',
                        tabs: [tabId],
                        activeTabId: tabId,
                        size: sourceSize
                    }
                ]
            }
        }
        if (n.children) {
            return { ...n, children: n.children.map(splitAndAdd) }
        }
        return n
    }

    return splitAndAdd(remove(node))
}

function findResizeTargets(layout: LayoutNode, paneId: string) {
    let h: { id: string, sign: number } | undefined
    let v: { id: string, sign: number } | undefined

    const traverse = (node: LayoutNode): boolean => {
        if (node.id === paneId) return true
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i]
                if (traverse(child)) {
                    // sign: +1 if this child is first (left/top side of divider)
                    //       -1 if this child is last (right/bottom side — moving outward shrinks)
                    const isLast = i === node.children.length - 1
                    const sign = isLast ? -1 : 1
                    if (node.type === 'group' && node.direction === 'horizontal') {
                        if (!h) h = { id: child.id, sign }
                    }
                    if (node.type === 'group' && node.direction === 'vertical') {
                        if (!v) v = { id: child.id, sign }
                    }
                    return true
                }
            }
        }
        return false
    }

    traverse(layout)
    return { h, v }
}

function toggleNodeTabs(node: LayoutNode, paneId: string): LayoutNode {
    if (node.id === paneId) {
        return { ...node, showTabs: node.showTabs === false ? true : false }
    }
    if (node.children) {
        return { ...node, children: node.children.map(c => toggleNodeTabs(c, paneId)) }
    }
    return node
}



/**
 * Deep-updates the `size` field on any layout node whose id appears in sizeMap.
 * Called after a drag-resize to persist the final panel percentages.
 */
function updateNodeSizes(node: LayoutNode, sizeMap: Record<string, number>): LayoutNode {
    const withSize = node.id in sizeMap ? { ...node, size: sizeMap[node.id] } : node
    if (withSize.children) {
        return { ...withSize, children: withSize.children.map(c => updateNodeSizes(c, sizeMap)) }
    }
    return withSize
}
