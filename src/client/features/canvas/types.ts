import type { Document } from '../../../core/types/notes'

export interface CanvasNode {
    id: string
    x: number
    y: number
    width: number
    height: number
    type: 'note' | 'image' | 'document' | 'arrow' | 'shape' | 'table' | 'pencil'
    content: string
    shapeType?: 'rectangle' | 'circle'
    path?: { x: number, y: number }[]
    strokeColor?: string
    strokeWidth?: number
    startNodeId?: string
    endNodeId?: string
    isDynamicEnd?: boolean
    startSide?: string
    startOffset?: { x: number, y: number }
    endOffset?: { x: number, y: number }
    points?: {
        start: { x: number, y: number }
        end: { x: number, y: number }
        control?: { x: number, y: number } // treated as cp1
        control2?: { x: number, y: number } // new cp2
    }
    groupId?: string
}

export interface Camera {
    x: number
    y: number
    zoom: number
}

export interface RemoteCursor {
    clientId: number
    x: number
    y: number
    user: {
        name: string
        color: string
        avatar?: string
    }
    lastActive: number
}

export interface CanvasViewProps {
    document: Document
    documents?: Document[]
    onUpdateDocument: (doc: Document) => void
    showSidebar?: boolean
    onToggleSidebar?: () => void
    showTabs?: boolean
    onToggleTabs?: () => void
    onOpenDocument?: (docId: string) => void
    readOnly?: boolean
}

export interface CanvasTableNodeProps {
    node: CanvasNode
    isEditing: boolean
    draggedNodeId: string | null
    updateNodeContent: (id: string, content: string) => void
    setEditingId: (id: string | null) => void
    handleNodeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
}

export interface CanvasEnv {
    camera: Camera
    selection: Set<string>
    selectionCandidates: Set<string>
    snapTargetId: string | null
    draggedNodeId: string | null
    editingId: string | null
    documents: Document[]
    containerRef: React.RefObject<HTMLDivElement>
    dragStartPosition: React.MutableRefObject<{ x: number, y: number } | null>
    fileInputRef: React.RefObject<HTMLInputElement>
    handleNodeMouseDown: (e: React.MouseEvent, node: CanvasNode) => void
    handleNodeTouchStart: (e: React.TouchEvent, node: CanvasNode) => void
    setSelection: React.Dispatch<React.SetStateAction<Set<string>>>
    setEditingId: (id: string | null) => void
    setFocusTarget: (target: 'title' | 'content' | null) => void
    setDoubleClickPos: (pos: { x: number, y: number } | null) => void
    setEditingCaretOffset: (offset: number) => void
    updateNodeContent: (id: string, content: string) => void
    setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>
    onOpenDocument?: (docId: string) => void
    onUpdateDocument: (doc: Document) => void
    setDraggedHandle: (handle: any) => void
    initiateEditImage: (id: string, currentUrl: string) => void
    setResizingNodeId: (id: string | null) => void
    setArrowStart: (start: { x: number, y: number } | null) => void
    setArrowStartNodeId: (id: string | null) => void
    setArrowStartSide: (side: string | null) => void
    setIsCreatingArrow: (creating: boolean) => void
    setArrowEndPreview: (preview: { x: number, y: number } | null) => void
    setIsDrawingMode: (drawing: boolean) => void
    setIsEraserMode: (erasing: boolean) => void
    setPencilColor: (color: string) => void
    setPencilWidth: (width: number) => void
    handleImageUpload: (file: File) => void
    isPanning: boolean
    isSpacePressed: boolean
    isCreatingArrow: boolean
    isDrawingMode: boolean
    isEraserMode: boolean
    pencilColor: string
    pencilWidth: number
    currentPath: { x: number, y: number }[] | null
    arrowStart: { x: number, y: number } | null
    arrowStartNodeId: string | null
    arrowStartSide: string | null
    calculateBezierControls: (start: { x: number, y: number }, end: { x: number, y: number }, startSide?: string | null, endSide?: string | null) => { cp1: { x: number, y: number }, cp2: { x: number, y: number } }
    resizingNodeId: string | null
    nodes: CanvasNode[]
    hasMoved: boolean
    getBestDynamicEnd: (start: { x: number, y: number }, startSide: string, endNode: CanvasNode, allNodes: CanvasNode[]) => { endSide: string }
    shapeDrawingMode: 'rectangle' | 'circle' | null
    getArrowMidpoint: (node: CanvasNode) => { x: number, y: number }
    completeArrowConnection: (targetNode: CanvasNode) => void
    activeTool: 'select' | 'pencil' | 'eraser' | 'arrow' | 'shape-rectangle' | 'shape-circle'
    setActiveTool: (tool: 'select' | 'pencil' | 'eraser' | 'arrow' | 'shape-rectangle' | 'shape-circle') => void
}
