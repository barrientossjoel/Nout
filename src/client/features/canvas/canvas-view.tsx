'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import {
    Trash2, Move, Image, Maximize, Minimize, X, Link, PanelLeft, PanelTop,
    MessageSquare, ArrowRight, Square, FolderDown, Upload, ZoomIn, ZoomOut,
    MoreVertical, Pencil, Share2, ChevronLeft, FolderInput
} from 'lucide-react'
import { cn } from '../../lib/utils/utils'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import type { Document } from '../../../core/types/notes'
import { ImportDocsDialog } from './import-docs-dialog'
import { MoveDocumentDialog } from '../documents/components/move-document-dialog'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu"
import { NotesPanel } from '../notes/components/notes-panel'
import { ShareDialog } from '../collaboration/share-dialog'

// New modular imports
import { CanvasNode, Camera, CanvasViewProps, CanvasEnv } from './types'
import { MemoizedCanvasNode } from './components/canvas-node-renderer'
import { CanvasToolbar } from './components/canvas-toolbar'
import { useCanvasSync } from './hooks/use-canvas-sync'
import { useCanvasCamera } from './hooks/use-canvas-camera'
import { useCanvasInteraction } from './hooks/use-canvas-interaction'
import { MultiplayerCursors, CollaboratorAvatarStack, useLocalCursorBroadcast } from '../collaboration'
import { useAuth } from '../../context/AuthContext'
import { calculateBezierControls, getArrowMidpoint, getBestDynamicEnd, shortenLineEnd, ARROW_STROKE_PAD, generateId } from './utils/canvas-geometry'
import { useKeyboardShortcuts, matchesShortcut } from '../../context/KeyboardShortcutsContext'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true when the event target is an editable input element. */
const isInputFocused = (target: HTMLElement): boolean =>
    ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;

/** Factory: creates a centered image CanvasNode at the current viewport centre. */
const createImageNode = (
    content: string,
    camera: Camera,
    containerRef: React.RefObject<HTMLDivElement>,
    width = 300,
    height = 200
): CanvasNode => ({
    id: generateId(),
    type: 'image',
    x: -camera.x / camera.zoom + (containerRef.current?.clientWidth  || window.innerWidth)  / 2 / camera.zoom - width / 2,
    y: -camera.y / camera.zoom + (containerRef.current?.clientHeight || window.innerHeight) / 2 / camera.zoom - height / 2,
    width,
    height,
    content,
});

export function CanvasView({
    document: doc,
    documents = [],
    onUpdateDocument,
    showSidebar: _showSidebar,
    onToggleSidebar,
    showTabs,
    onToggleTabs,
    onOpenDocument,
    readOnly = false,
}: CanvasViewProps) {
    // 1. Core State & Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const envRef = useRef<CanvasEnv>({} as CanvasEnv)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const isMobile = useMediaQuery('(max-width: 768px)')

    // 2. Modular Hooks
    const initialNodes = useMemo(() => {
        try {
            const parsed = doc.content ? JSON.parse(doc.content) : []
            return Array.isArray(parsed) ? parsed : (parsed.nodes || [])
        } catch { return [] }
    }, [doc.id]); // Only re-parse if doc id changes to avoid reset

    const { nodes, setNodes, provider } = useCanvasSync(doc.id, initialNodes);
    const { user } = useAuth();

    const initialCamera = useMemo(() => {
        try {
            const parsed = doc.content ? JSON.parse(doc.content) : null
            if (parsed && !Array.isArray(parsed) && parsed.camera) return parsed.camera
            return { x: 0, y: 0, zoom: 1 }
        } catch { return { x: 0, y: 0, zoom: 1 } }
    }, [doc.id]);

    const {
        camera, setCamera, isPanning, setIsPanning, handleWheel: rawHandleWheel, zoomIn, zoomOut
    } = useCanvasCamera(initialCamera);

    const {
        draggedNodeId, setDraggedNodeId, resizingNodeId, setResizingNodeId,
        dragOffset, setDragOffset, selection, setSelection, isSpacePressed, setIsSpacePressed,
        hasMoved, setHasMoved, selectionBox, setSelectionBox, selectionCandidates, setSelectionCandidates,
        preDragOrder, setPreDragOrder, isCreatingArrow, setIsCreatingArrow, arrowStart, setArrowStart,
        isDrawingMode, setIsDrawingMode, isEraserMode, setIsEraserMode, pencilColor, setPencilColor,
        pencilWidth, setPencilWidth, currentPath,
        arrowStartNodeId, setArrowStartNodeId, arrowStartSide, setArrowStartSide,
        arrowEndPreview, setArrowEndPreview, draggedHandle, setDraggedHandle, snapTargetId, setSnapTargetId,
        editingId, setEditingId, dragStartPosition,
        handleNodeMouseDown, handleMouseDown: rawHandleMouseDown, handleMouseMove: rawHandleMouseMove, handleMouseUp: rawHandleMouseUp,
        handleTouchStart: rawHandleTouchStart, handleTouchMove: rawHandleTouchMove, handleTouchEnd: rawHandleTouchEnd,
        moveToFront, getGroupNodes, addNote, addTable, addShape, updateNodeContent, completeArrowConnection, deleteSelection,
        shapeDrawingMode, setShapeDrawingMode, activeTool, setActiveTool
    } = useCanvasInteraction({ nodes, setNodes, camera, containerRef, wrapperRef, onOpenDocument });

    const documentsMap = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents]);

    const {
        onPointerMove: handleCursorPointerMove,
        onPointerLeave: handleCursorPointerLeave,
    } = useLocalCursorBroadcast({
        provider,
        user,
        camera,
        containerRef,
    });

    const handleWheel = (e: React.WheelEvent) => rawHandleWheel(e, containerRef)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (readOnly) {
            setIsPanning(true)
            return
        }
        rawHandleMouseDown(e, isPanning, setIsPanning)
    }
    const handleMouseMove = (e: React.MouseEvent) => {
        if (readOnly) {
            if (isPanning) {
                setCamera(prev => ({
                    ...prev,
                    x: prev.x + e.movementX,
                    y: prev.y + e.movementY
                }))
            }
            handleCursorPointerMove(e)
            return
        }
        rawHandleMouseMove(e, isPanning, camera, setCamera)
        handleCursorPointerMove(e)
    }
    const handleMouseUp = (e: React.MouseEvent) => {
        if (readOnly) {
            setIsPanning(false)
            return
        }
        rawHandleMouseUp(e, setIsPanning)
    }
    const handleMouseLeave = (e: React.MouseEvent) => {
        if (readOnly) {
            setIsPanning(false)
        }
        rawHandleMouseUp(e, setIsPanning)
        handleCursorPointerLeave()
    }
    const handleTouchStart = (e: React.TouchEvent) => rawHandleTouchStart(e, isPanning, setIsPanning)
    const handleTouchMove = (e: React.TouchEvent) => rawHandleTouchMove(e, isPanning, camera, setCamera)
    const handleTouchEnd = () => rawHandleTouchEnd(setIsPanning)
    // 3. UI State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [pendingNodeId, setPendingNodeId] = useState<string | null>(null)
    const [imageUrlInput, setImageUrlInput] = useState('')
    const [doubleClickPos, setDoubleClickPos] = useState<{ x: number, y: number } | null>(null)
    const [editingCaretOffset, setEditingCaretOffset] = useState<number>(0)
    const [focusTarget, setFocusTarget] = useState<'title' | 'content' | null>(null)
    const [localShowNotes, setLocalShowNotes] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [shareOpen, setShareOpen] = useState(false)
    const [isMoveOpen, setIsMoveOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const lastPasteTimeRef = useRef<number>(0)

    const handleImageUpload = useCallback((file: File) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            if (!dataUrl) return

            const img = new window.Image()
            img.onload = () => {
                const maxDim = 400
                let w = img.naturalWidth || 300
                let h = img.naturalHeight || 200
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w)
                        w = maxDim
                    } else {
                        w = Math.round((w * maxDim) / h)
                        h = maxDim
                    }
                }
                const node = createImageNode(dataUrl, camera, containerRef, w, h)
                setNodes(prev => [...prev, node])
                setSelection(new Set([node.id]))
            }
            img.onerror = () => {
                const node = createImageNode(dataUrl, camera, containerRef)
                setNodes(prev => [...prev, node])
                setSelection(new Set([node.id]))
            }
            img.src = dataUrl
        }
        reader.readAsDataURL(file)
    }, [camera, containerRef, setNodes, setSelection])

    const addImageNodeFromUrl = useCallback((url: string) => {
        const img = new window.Image()
        img.onload = () => {
            const maxDim = 400
            let w = img.naturalWidth || 300
            let h = img.naturalHeight || 200
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w)
                    w = maxDim
                } else {
                    w = Math.round((w * maxDim) / h)
                    h = maxDim
                }
            }
            const node = createImageNode(url, camera, containerRef, w, h)
            setNodes(prev => [...prev, node])
            setSelection(new Set([node.id]))
        }
        img.onerror = () => {
            const node = createImageNode(url, camera, containerRef)
            setNodes(prev => [...prev, node])
            setSelection(new Set([node.id]))
        }
        img.src = url
    }, [camera, containerRef, setNodes, setSelection])

    const triggerFileUpload = () => fileInputRef.current?.click()

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type.startsWith('image/')) handleImageUpload(file)
    }

    const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
        const now = Date.now()
        if (now - lastPasteTimeRef.current < 300) return

        const items = Array.from(e.clipboardData?.items || [])
        const imageItem = items.find(item => item.type.startsWith('image/'))
        if (imageItem) {
            const file = imageItem.getAsFile()
            if (file) {
                lastPasteTimeRef.current = now
                e.preventDefault()
                handleImageUpload(file)
                return
            }
        }

        const files = Array.from(e.clipboardData?.files || [])
        const imageFile = files.find(file => file.type.startsWith('image/'))
        if (imageFile) {
            lastPasteTimeRef.current = now
            e.preventDefault()
            handleImageUpload(imageFile)
            return
        }

        const htmlData = e.clipboardData?.getData('text/html') || ''
        if (htmlData) {
            const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i)
            if (match?.[1]) {
                const src = match[1]
                lastPasteTimeRef.current = now
                e.preventDefault()
                if (src.startsWith('http://') || src.startsWith('https://')) {
                    addImageNodeFromUrl(src)
                } else if (src.startsWith('data:image/')) {
                    fetch(src)
                        .then(r => r.blob())
                        .then(blob => {
                            const type = src.split(';')[0].split(':')[1]
                            const ext = type.split('/')[1]?.replace('x-', '') || 'png'
                            handleImageUpload(new File([blob], `pasted-image.${ext}`, { type }))
                        })
                        .catch(err => console.error('Canvas data URL paste failed:', err))
                }
                return
            }
        }

        const plainText = e.clipboardData?.getData('text/plain')?.trim() || ''
        if (/^https?:\/\/.*\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(plainText) || plainText.startsWith('data:image/')) {
            lastPasteTimeRef.current = now
            e.preventDefault()
            addImageNodeFromUrl(plainText)
        }
    }, [handleImageUpload, addImageNodeFromUrl])

    const handleImportDocument = (importedDoc: Document) => {
        const newNode: CanvasNode = {
            id: generateId(),
            type: 'document',
            x: -camera.x / camera.zoom + (containerRef.current?.clientWidth || window.innerWidth) / 2 / camera.zoom - 150,
            y: -camera.y / camera.zoom + (containerRef.current?.clientHeight || window.innerHeight) / 2 / camera.zoom - 100,
            width: 320,
            height: 400,
            content: importedDoc.id
        }
        setNodes(prev => [...prev, newNode])
    }

    const handleGroup = () => {
        const groupId = generateId()
        setNodes(prev => prev.map(n => selection.has(n.id) ? { ...n, groupId } : n))
        setContextMenu(null)
    }

    const handleUngroup = () => {
        setNodes(prev => prev.map(n => selection.has(n.id) ? { ...n, groupId: undefined } : n))
        setContextMenu(null)
    }

    const getSelectionBounds = () => {
        if (selection.size === 0) return null
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        nodes.forEach(node => {
            if (selection.has(node.id)) {
                minX = Math.min(minX, node.x)
                minY = Math.min(minY, node.y)
                maxX = Math.max(maxX, node.x + (node.width || 0))
                maxY = Math.max(maxY, node.y + (node.height || 0))
            }
        })
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }

    // 4. Interaction Helpers
    const handleZoom = (delta: number) => {
        if (delta > 0) zoomIn()
        else zoomOut()
    }

    const toggleFullscreen = () => {
        if (!wrapperRef.current) return
        if (!document.fullscreenElement) {
            wrapperRef.current.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`))
        } else {
            document.exitFullscreen()
        }
    }

    const handleNodeTouchStart = (e: React.TouchEvent, node: CanvasNode) => {
        if (e.touches.length !== 1 || node.type === 'arrow') return
        const touch = e.touches[0]
        const pseudoEvent = { clientX: touch.clientX, clientY: touch.clientY, button: 0, shiftKey: false, stopPropagation: () => { }, preventDefault: () => { } } as any
        handleNodeMouseDown(pseudoEvent, node)
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
    }
    const initiateAddImage = () => {
        setModalMode('create')
        setImageUrlInput('')
        setIsModalOpen(true)
    }

    const initiateEditImage = (id: string, currentUrl: string) => {
        setModalMode('edit')
        setPendingNodeId(id)
        setImageUrlInput(currentUrl)
        setIsModalOpen(true)
    }

    const confirmImageModal = () => {
        if (!imageUrlInput) return
        if (modalMode === 'create') {
            const node = createImageNode(imageUrlInput, camera, containerRef)
            setNodes(prev => [...prev, node])
            setSelection(new Set([node.id]))
        } else if (modalMode === 'edit' && pendingNodeId) {
            updateNodeContent(pendingNodeId, imageUrlInput)
        }
        setIsModalOpen(false)
        setImageUrlInput('')
        setPendingNodeId(null)
    }

    // 5. Lifecycle Effects
    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    useEffect(() => {
        if (editingId && doubleClickPos && focusTarget) {
            const timer = setTimeout(() => {
                const targetId = focusTarget === 'title' ? `edit-title-${editingId}` : `edit-content-${editingId}`
                const el = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null
                if (el) {
                    el.focus()
                    if (editingCaretOffset > 0) el.setSelectionRange(editingCaretOffset, editingCaretOffset)
                }
                setDoubleClickPos(null); setFocusTarget(null); setEditingCaretOffset(0)
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [editingId, doubleClickPos, editingCaretOffset, focusTarget])

    useEffect(() => {
        if (readOnly) return
        const timer = setTimeout(() => {
            const contentObj = { nodes, camera }
            const contentString = JSON.stringify(contentObj)
            if (contentString !== doc.content) {
                onUpdateDocument({ ...doc, content: contentString })
            }
        }, 1000)
        return () => clearTimeout(timer)
    }, [nodes, camera, doc, onUpdateDocument, readOnly])

    const { shortcuts } = useKeyboardShortcuts()
    const shortcutsRef = useRef(shortcuts)
    useEffect(() => { shortcutsRef.current = shortcuts }, [shortcuts])

    useEffect(() => {
        if (readOnly) return
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (matchesShortcut(e, shortcutsRef.current.canvasPan) && !isInputFocused(target)) setIsSpacePressed(true)
            if (matchesShortcut(e, shortcutsRef.current.canvasDelete) && selection.size > 0 && !isModalOpen && !isInputFocused(target)) deleteSelection()
            if (e.code === 'Escape') {
                if (shapeDrawingMode) setShapeDrawingMode(null)
                else if (isCreatingArrow) setIsCreatingArrow(false)
                else if (isDrawingMode) setIsDrawingMode(false)
                else if (isEraserMode) setIsEraserMode(false)
                else if (isModalOpen) setIsModalOpen(false)
                else if (editingId) setEditingId(null)
                else if (selection.size > 0) setSelection(new Set())
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (matchesShortcut(e, shortcutsRef.current.canvasPan)) setIsSpacePressed(false)
        }
        const handleWindowPaste = (e: ClipboardEvent) => {
            if (readOnly || isModalOpen || editingId) return
            if (!isInputFocused(e.target as HTMLElement)) handlePaste(e)
        }
        const handleClick = () => setContextMenu(null)

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        window.addEventListener('paste', handleWindowPaste)
        window.addEventListener('click', handleClick)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            window.removeEventListener('paste', handleWindowPaste)
            window.removeEventListener('click', handleClick)
        }
    }, [selection, isModalOpen, editingId, handlePaste, deleteSelection, shapeDrawingMode, isCreatingArrow, isDrawingMode, isEraserMode, setIsCreatingArrow, setIsDrawingMode, setIsEraserMode])

    // Environment for memoized nodes
    Object.assign(envRef.current, {
        camera, selection, selectionCandidates, snapTargetId, draggedNodeId, editingId, documents,
        containerRef, dragStartPosition, fileInputRef, handleNodeMouseDown, handleNodeTouchStart,
        setSelection, setEditingId, setFocusTarget, setDoubleClickPos,
        setEditingCaretOffset, updateNodeContent, setNodes, onOpenDocument, onUpdateDocument,
        setDraggedHandle, initiateEditImage, setResizingNodeId, setArrowStart,
        setArrowStartNodeId, setArrowStartSide, setIsCreatingArrow, setArrowEndPreview,
        setIsDrawingMode, setIsEraserMode, setPencilColor, setPencilWidth,
        handleImageUpload, isPanning, isSpacePressed, isCreatingArrow, isDrawingMode, isEraserMode, pencilColor, pencilWidth, currentPath, arrowStart, arrowStartNodeId,
        arrowStartSide, calculateBezierControls, resizingNodeId, nodes, hasMoved, getBestDynamicEnd,
        shapeDrawingMode, getArrowMidpoint, completeArrowConnection, handleContextMenu
    })

    return (
        <div ref={wrapperRef} className="flex flex-col w-full h-full relative overflow-hidden bg-muted/50 select-none touch-none group/canvas">
            {/* Header / Top bar */}
            {isMobile ? (
                <div className="absolute top-3 left-3 z-50 flex items-center gap-2 pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (onOpenDocument) onOpenDocument('dashboard');
                            else if (onToggleSidebar) onToggleSidebar();
                        }}
                        className="h-9 px-2.5 text-foreground font-medium flex items-center gap-1 bg-card/90 backdrop-blur-md rounded-full shadow-sm border border-border/60 hover:bg-card active:scale-95 transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-xs font-semibold">Notas</span>
                    </Button>
                    <span className="text-xs font-semibold text-foreground/90 truncate max-w-[150px] px-2.5 py-1 bg-card/80 backdrop-blur-xs rounded-full border border-border/40">
                        {doc.title || "Lienzo"}
                    </span>
                </div>
            ) : (
                <div className="absolute top-3 left-4 z-50 flex items-center h-10 gap-2 pointer-events-none">
                    <div className="flex items-center gap-2 p-1 rounded-md pointer-events-auto">
                        {onToggleSidebar && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggleSidebar}
                                className="bg-transparent h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                                <PanelLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="flex items-center gap-2 text-sm text-foreground/80 pr-2 pointer-events-auto">
                            <span
                                className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => onOpenDocument?.('dashboard')}
                            >
                                Documents
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-medium">{doc.title}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid Pattern */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: `radial-gradient(var(--foreground) 1px, transparent 1px)`,
                    backgroundSize: `${20 * camera.zoom}px ${20 * camera.zoom}px`,
                    backgroundPosition: `${camera.x}px ${camera.y}px`
                }}
            />

            {/* Canvas Layers */}
            <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden bg-background select-none touch-none"
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onContextMenu={handleContextMenu}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const file = e.dataTransfer.files?.[0]
                    if (file && file.type.startsWith('image/')) {
                        handleImageUpload(file)
                    }
                }}
                tabIndex={0}
                style={{ cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : (isCreatingArrow || isDrawingMode || isEraserMode || shapeDrawingMode) ? 'crosshair' : 'default' }}
            >
                <div
                    style={{
                        transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
                        transformOrigin: '0 0',
                        willChange: isPanning ? 'transform' : 'auto',
                    }}
                >

                    {nodes.map(node => {
                        let portalDoc = undefined;
                        if (node.type === 'document') {
                            let docId = node.content;
                            if (node.content.startsWith('{')) {
                                try { docId = JSON.parse(node.content).id; } catch (e) { }
                            }
                            portalDoc = documentsMap.get(docId);
                        }

                        return (
                            <MemoizedCanvasNode
                                key={node.id}
                                node={node}
                                envRef={envRef}
                                triggers={{
                                    isSelected: selection.has(node.id),
                                    isOnlySelection: selection.has(node.id) && selection.size === 1,
                                    isSelectionCandidate: selectionCandidates.has(node.id) && !selection.has(node.id),
                                    isSnapTarget: snapTargetId === node.id,
                                    isDragged: draggedNodeId === node.id,
                                    isEditing: editingId === node.id,
                                    isResizing: resizingNodeId === node.id,
                                    portalDoc,
                                    isCreatingArrow
                                }}
                            />
                        );
                    })}

                    {/* Multi-selection Bounding Box */}
                    {(() => { const b = getSelectionBounds(); return b && selection.size > 1 && !draggedNodeId && (
                        <div
                            className="absolute border-2 border-primary/30 border-dashed pointer-events-none rounded-lg z-[145]"
                            style={{ left: b.x - 4, top: b.y - 4, width: b.width + 8, height: b.height + 8 }}
                        >
                            <div className="absolute -top-6 left-0 bg-primary/10 text-primary text-[10px] px-1 rounded backdrop-blur-sm shadow-sm border border-primary/20">
                                {selection.size} items selected
                            </div>
                        </div>
                    ); })()}
                    {/* Rubber Band Selection Box */}
                    {selectionBox && (
                        <div
                            className="absolute border border-primary bg-primary/10 pointer-events-none z-[200]"
                            style={{
                                left: Math.min(selectionBox.start.x, selectionBox.end.x),
                                top: Math.min(selectionBox.start.y, selectionBox.end.y),
                                width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                                height: Math.abs(selectionBox.end.y - selectionBox.start.y)
                            }}
                        />
                    )}
                </div>

                {/* Multiplayer Cursors (Figma-style) */}
                <MultiplayerCursors provider={provider} camera={camera} />
            </div>

            {/* Arrow Preview Layer */}
            {isCreatingArrow && arrowStart && arrowEndPreview && (() => {
                const end = shortenLineEnd(arrowStart.x, arrowStart.y, arrowEndPreview.x, arrowEndPreview.y, ARROW_STROKE_PAD);
                return (
                    <div className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, transformOrigin: '0 0' }}>
                        <svg className="absolute inset-0 w-full h-full overflow-visible">
                            <defs>
                                <marker id="arrowhead-preview" markerWidth="10" markerHeight="7" refX="7" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-foreground" />
                                </marker>
                            </defs>
                            <line
                                x1={arrowStart.x} y1={arrowStart.y}
                                x2={end.x} y2={end.y}
                                stroke="currentColor" strokeWidth="2" strokeLinecap="butt"
                                markerEnd="url(#arrowhead-preview)"
                                className="text-foreground/50"
                                strokeDasharray="5,5"
                            />
                        </svg>
                    </div>
                );
            })()}
            {/* Pencil Path Preview */}
            {
                isDrawingMode && currentPath && currentPath.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`, transformOrigin: '0 0' }}>
                        <svg className="absolute inset-0 w-full h-full overflow-visible">
                            <path
                                d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                                stroke={pencilColor}
                                strokeWidth={pencilWidth}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="opacity-70"
                            />
                        </svg>
                    </div>
                )
            }

            {!readOnly && (
                <CanvasToolbar
                    isMobile={isMobile}
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    pencilColor={pencilColor}
                    setPencilColor={setPencilColor}
                    pencilWidth={pencilWidth}
                    setPencilWidth={setPencilWidth}
                    selectionSize={selection.size}
                    onAddNote={() => { addNote(); setActiveTool('select'); }}
                    onAddTable={() => { addTable(); setActiveTool('select'); }}
                    onAddShape={(shape) => addShape(shape)}
                    onInitiateAddImage={() => { initiateAddImage(); setActiveTool('select'); }}
                    onImportDocument={() => setIsImportOpen(true)}
                    onDeleteSelection={() => {
                        if (selection.size > 0) {
                            setNodes(prev => prev.filter(n => !selection.has(n.id)))
                            setSelection(new Set())
                        }
                    }}
                />
            )}
            {/* Toolbar (Top Right) */}
            <div className="absolute top-0 right-4 z-50 pointer-events-auto flex items-center gap-1.5 h-16">
                {/* Active Collaborators Presence (Figma-style avatars - isolated render boundary) */}
                <CollaboratorAvatarStack provider={provider} />
                {!readOnly && !isMobile && (
                    <>
                        {onToggleTabs && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggleTabs}
                                className={cn(
                                    "h-9 w-9 text-muted-foreground hover:text-foreground bg-transparent",
                                    !showTabs && "text-muted-foreground/50"
                                )}
                                title={showTabs ? "Hide Tabs" : "Show Tabs"}
                            >
                                <PanelTop className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocalShowNotes(!localShowNotes)}
                            title={localShowNotes ? "Close Notes" : "Open Notes"}
                            className={cn(
                                "h-9 w-9 text-muted-foreground hover:text-foreground bg-transparent",
                                localShowNotes && "text-primary bg-primary/10"
                            )}
                        >
                            <MessageSquare className="h-4 w-4" />
                        </Button>
                    </>
                )}

                {!readOnly && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {isMobile && (
                                <div className="p-2 border-b border-border/50">
                                    <DropdownMenuItem onClick={() => setLocalShowNotes(!localShowNotes)} className="cursor-pointer">
                                        <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span>{localShowNotes ? "Close Notes" : "Open Notes"}</span>
                                    </DropdownMenuItem>
                                </div>
                            )}
                            <div className="p-2">
                                <DropdownMenuItem onClick={() => setShareOpen(true)} className="cursor-pointer">
                                    <Share2 className="mr-2 h-4 w-4" />
                                    <span>Compartir</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsMoveOpen(true)} className="cursor-pointer">
                                    <FolderInput className="mr-2 h-4 w-4" />
                                    <span>Mover lienzo...</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={toggleFullscreen} className="cursor-pointer">
                                    {isFullscreen ? (
                                        <>
                                            <Minimize className="h-4 w-4 mr-2" />
                                            <span>Salir de pantalla completa</span>
                                        </>
                                    ) : (
                                        <>
                                            <Maximize className="h-4 w-4 mr-2" />
                                            <span>Pantalla completa</span>
                                        </>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })} className="cursor-pointer">
                                    <Move className="h-4 w-4 mr-2" />
                                    <span>Restablecer vista</span>
                                </DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {!readOnly && (
                <>
                    <ShareDialog
                        elementId={doc.id}
                        elementType="canvas"
                        open={shareOpen}
                        onOpenChange={setShareOpen}
                    />
                    <MoveDocumentDialog
                        document={doc}
                        documents={documents}
                        isOpen={isMoveOpen}
                        onClose={() => setIsMoveOpen(false)}
                        onMove={(id, targetParentId) => {
                            onUpdateDocument?.({ ...doc, parentId: targetParentId });
                            setIsMoveOpen(false);
                        }}
                    />
                </>
            )}

            <div className={cn(
                "absolute flex flex-col items-end gap-2 z-40 pointer-events-auto",
                isMobile ? "bottom-20 right-4" : "bottom-6 right-6"
            )}>
                {isMobile ? (
                    <div className="text-[10px] text-muted-foreground opacity-50 hover:opacity-100 transition-opacity">
                        <div className="flex gap-2">
                            <span>Two fingers to Pan</span>
                            <span>•</span>
                            <span>Pinch to Zoom</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-[10px] text-muted-foreground opacity-50 hover:opacity-100 transition-opacity">
                        <div className="flex gap-2">
                            <span>Space + Drag to Pan</span>
                            <span>•</span>
                            <span>Ctrl + Scroll to Zoom</span>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary rounded-full p-1 shadow-lg">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-background/50"
                            onClick={() => handleZoom(-0.25)}
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-[10px] w-8 text-center font-mono opacity-50 select-none">
                            {Math.round(camera.zoom * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-background/50"
                            onClick={() => handleZoom(0.25)}
                            title="Zoom In"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full bg-secondary hover:bg-background/50 opacity-50 hover:opacity-100 transition-opacity shadow-lg"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Context Menu */}
            {
                contextMenu && (() => {
                    const selectedImageNode = selection.size === 1
                        ? nodes.find(n => selection.has(n.id) && n.type === 'image')
                        : null;
                    return (
                        <div
                            className="absolute z-[60] min-w-[210px] overflow-hidden rounded-xl border border-white/15 bg-neutral-950/90 backdrop-blur-xl p-1.5 text-white shadow-2xl animate-in fade-in-0 zoom-in-95 select-none"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                        >
                            <div className="px-2.5 py-1.5 text-xs font-semibold text-white/50 hidden sm:block">Canvas Actions</div>
                            <div role="separator" className="h-px bg-white/10 my-1" />

                            {selectedImageNode && (
                                <>
                                    <button
                                        onClick={() => {
                                            initiateEditImage(selectedImageNode.id, selectedImageNode.content);
                                            setContextMenu(null);
                                        }}
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/95 outline-none hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        <Pencil className="mr-2 h-4 w-4 text-primary" />
                                        <span>Editar URL de imagen</span>
                                    </button>
                                    <div role="separator" className="h-px bg-white/10 my-1" />
                                </>
                            )}

                            <button onClick={() => { triggerFileUpload(); setContextMenu(null) }} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                <Upload className="mr-2 h-4 w-4" />
                                <span>Upload Image</span>
                            </button>
                            <button onClick={() => { initiateAddImage(); setContextMenu(null) }} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                <Image className="mr-2 h-4 w-4" />
                                <span>Add Image URL</span>
                            </button>
                            <button onClick={() => { setIsCreatingArrow(true); setContextMenu(null) }} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                <ArrowRight className="mr-2 h-4 w-4" />
                                <span>Add Arrow</span>
                            </button>
                            <div role="separator" className="h-px bg-white/10 my-1" />
                            <button onClick={() => { setIsImportOpen(true); setContextMenu(null) }} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                <FolderDown className="mr-2 h-4 w-4" />
                                <span>Import Document</span>
                            </button>
                            <div role="separator" className="h-px bg-white/10 my-1" />
                            <button onClick={() => { setCamera({ x: 0, y: 0, zoom: 1 }); setContextMenu(null) }} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                <Move className="mr-2 h-4 w-4" />
                                <span>Reset View</span>
                            </button>
                            {selection && selection.size > 0 && (
                                <>
                                    <div role="separator" className="h-px bg-white/10 my-1" />
                                    <button onClick={() => { setNodes(prev => prev.filter(n => !selection.has(n.id))); setSelection(new Set()); setContextMenu(null) }} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-red-400 outline-none hover:bg-red-500/20 hover:text-red-300 transition-colors">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete Node</span>
                                    </button>
                                    {selection.size > 1 && (
                                        <>
                                            <div role="separator" className="h-px bg-white/10 my-1" />
                                            <button onClick={handleGroup} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                                <FolderDown className="mr-2 h-4 w-4" />
                                                <span>Group Selection</span>
                                            </button>
                                        </>
                                    )}
                                    {Array.from(selection).some(id => nodes.find(n => n.id === id)?.groupId) && (
                                        <>
                                            <div role="separator" className="h-px bg-white/10 my-1" />
                                            <button onClick={handleUngroup} className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-sm text-white/90 outline-none hover:bg-white/10 hover:text-white transition-colors">
                                                <FolderDown className="mr-2 h-4 w-4" />
                                                <span>Ungroup</span>
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })()
            }

            {/* Hidden File Input for Image Upload */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileUpload}
            />

            {/* Custom Modal for Image URL */}
            {
                isModalOpen && (
                    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-[400px] bg-card border border-border rounded-lg shadow-lg p-6 space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium leading-none tracking-tight">
                                    {modalMode === 'create' ? 'Add Image' : 'Edit Image URL'}
                                </h3>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsModalOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            {modalMode === 'create' && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full gap-2 text-xs h-9"
                                        onClick={() => {
                                            setIsModalOpen(false)
                                            triggerFileUpload()
                                        }}
                                    >
                                        <Upload className="h-4 w-4" />
                                        <span>Subir desde este equipo</span>
                                    </Button>
                                    <div className="relative flex py-0.5 items-center">
                                        <div className="flex-grow border-t border-border/40" />
                                        <span className="flex-shrink mx-2 text-[11px] text-muted-foreground">o mediante enlace</span>
                                        <div className="flex-grow border-t border-border/40" />
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm text-muted-foreground">Image URL</label>
                                <div className="flex items-center gap-2">
                                    <Link className="h-4 w-4 text-muted-foreground opacity-50" />
                                    <Input
                                        value={imageUrlInput}
                                        onChange={(e) => setImageUrlInput(e.target.value)}
                                        placeholder="https://example.com/image.png"
                                        className="flex-1"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmImageModal()
                                            if (e.key === 'Escape') setIsModalOpen(false)
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={confirmImageModal}>
                                    {modalMode === 'create' ? 'Add Image' : 'Update'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Import Dialog */}
            <ImportDocsDialog
                open={isImportOpen}
                onOpenChange={setIsImportOpen}
                onSelect={handleImportDocument}
            />


            {/* Local Notes Panel */}
            {
                localShowNotes && (
                    <div className="absolute top-4 right-4 bottom-4 w-[300px] z-[60] animate-in slide-in-from-right duration-300 pointer-events-auto">
                        <NotesPanel
                            documentId={doc.id}
                            title={doc.title}
                            className="h-full rounded-lg border border-border/50 shadow-2xl"
                            onClose={() => setLocalShowNotes(false)}
                        />
                    </div>
                )
            }
        </div >
    )
}
