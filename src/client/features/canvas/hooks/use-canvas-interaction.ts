import { useState, useRef, useCallback, useEffect } from 'react'
import { CanvasNode, Camera } from '../types'
import { calculateBezierControls, getBestDynamicEnd, generateId, toCanvasCoords, sideToPoint, offsetToSide, arrowBounds, shouldEraseNode, updateConnectedArrow, rotateControlPoints } from '../utils/canvas-geometry'
import { useDragInertia } from '../../../hooks/useDragInertia'

interface InteractionProps {
    nodes: CanvasNode[];
    setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
    camera: Camera;
    containerRef: React.RefObject<HTMLDivElement>;
    wrapperRef: React.RefObject<HTMLDivElement>;
    onOpenDocument?: (id: string) => void;
}

export function useCanvasInteraction({
    nodes,
    setNodes,
    camera,
    containerRef,
    wrapperRef,
    onOpenDocument
}: InteractionProps) {
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
    const [resizingNodeId, setResizingNodeId] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const lastMousePosRef = useRef({ x: 0, y: 0 })
    const cachedRectRef = useRef<DOMRect | null>(null)

    const getContainerRect = useCallback(() => {
        if (!cachedRectRef.current && containerRef.current) {
            cachedRectRef.current = containerRef.current.getBoundingClientRect()
        }
        return cachedRectRef.current
    }, [containerRef])

    useEffect(() => {
        const invalidate = () => { cachedRectRef.current = null }
        window.addEventListener('resize', invalidate, { passive: true })
        window.addEventListener('scroll', invalidate, { passive: true })
        return () => {
            window.removeEventListener('resize', invalidate)
            window.removeEventListener('scroll', invalidate)
        }
    }, [])

    const [selection, setSelection] = useState<Set<string>>(new Set())
    const [isSpacePressed, setIsSpacePressed] = useState(false)
    const [hasMoved, setHasMoved] = useState(false)
    const [selectionBox, setSelectionBox] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null)
    const [selectionCandidates, setSelectionCandidates] = useState<Set<string>>(new Set())
    const [preDragOrder, setPreDragOrder] = useState<string[] | null>(null)
    const [activeTool, setActiveTool] = useState<'select' | 'pencil' | 'eraser' | 'arrow' | 'shape-rectangle' | 'shape-circle'>('select')

    const isCreatingArrow = activeTool === 'arrow'
    const setIsCreatingArrow = useCallback((val: boolean) => {
        setActiveTool(val ? 'arrow' : 'select')
    }, [])

    const [arrowStart, setArrowStart] = useState<{ x: number, y: number } | null>(null)
    const [arrowStartNodeId, setArrowStartNodeId] = useState<string | null>(null)
    const [arrowStartSide, setArrowStartSide] = useState<string | null>(null)
    const [arrowEndPreview, setArrowEndPreview] = useState<{ x: number, y: number } | null>(null)
    const [draggedHandle, setDraggedHandle] = useState<{
        nodeId: string,
        type: 'start' | 'control' | 'control2' | 'end',
        offsetX: number,
        offsetY: number,
        initialPoints?: {
            start: { x: number, y: number },
            end: { x: number, y: number },
            control?: { x: number, y: number },
            control2?: { x: number, y: number }
        }
    } | null>(null)
    const [snapTargetId, setSnapTargetId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)

    const isDrawingMode = activeTool === 'pencil'
    const setIsDrawingMode = useCallback((val: boolean) => {
        setActiveTool(val ? 'pencil' : 'select')
    }, [])

    const isEraserMode = activeTool === 'eraser'
    const setIsEraserMode = useCallback((val: boolean) => {
        setActiveTool(val ? 'eraser' : 'select')
    }, [])

    const [pencilColor, setPencilColor] = useState('#3b82f6') // default blue
    const [pencilWidth, setPencilWidth] = useState(3)
    const [currentPath, setCurrentPath] = useState<{ x: number, y: number }[] | null>(null)

    const shapeDrawingMode = activeTool === 'shape-rectangle' ? 'rectangle' : activeTool === 'shape-circle' ? 'circle' : null
    const setShapeDrawingMode = useCallback((val: 'rectangle' | 'circle' | null) => {
        setActiveTool(val === 'rectangle' ? 'shape-rectangle' : val === 'circle' ? 'shape-circle' : 'select')
    }, [])

    const dragStartPosition = useRef<{ x: number, y: number } | null>(null)
    const resizeAnchor = useRef<{ x: number, y: number } | null>(null)

    const { applyMovement: applyInertiaMovement } = useDragInertia(!!draggedNodeId, wrapperRef as React.RefObject<HTMLElement>)

    const getGroupNodes = useCallback((nodeId: string, currentNodes: CanvasNode[] = nodes) => {
        const node = currentNodes.find(n => n.id === nodeId)
        if (!node || !node.groupId) return [nodeId]
        return currentNodes.filter(n => n.groupId === node.groupId).map(n => n.id)
    }, [nodes]);

    const moveToFront = useCallback((nodeIds: Set<string>) => {
        setNodes(prev => {
            const nodesToMove = prev.filter(n => nodeIds.has(n.id))
            const otherNodes = prev.filter(n => !nodeIds.has(n.id))
            return [...otherNodes, ...nodesToMove]
        })
    }, [setNodes]);

    const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: CanvasNode) => {
        e.stopPropagation()
        if (e.button === 1 && node.type === 'document') {
            e.preventDefault()
            onOpenDocument?.(node.content)
            return
        }
        if (e.button !== 0) return

        let newSelection = new Set(selection)
        const groupIds = getGroupNodes(node.id)

        if (e.shiftKey) {
            const allSelected = groupIds.every(id => newSelection.has(id))
            if (allSelected) {
                groupIds.forEach(id => newSelection.delete(id))
            } else {
                groupIds.forEach(id => newSelection.add(id))
            }
            setSelection(newSelection)
            if (!groupIds.some(id => newSelection.has(id))) return
        } else {
            if (!newSelection.has(node.id)) {
                newSelection = new Set(groupIds)
                setSelection(newSelection)
            }
        }

        const wasAlreadySelected = selection.has(node.id)

        if (newSelection.size === 1 && !wasAlreadySelected) {
            moveToFront(newSelection)
            setPreDragOrder(null)
        } else if (newSelection.size > 1) {
            setPreDragOrder(prev => prev ?? nodes.map(n => n.id))
        } else {
            setPreDragOrder(null)
        }

        if (e.altKey && newSelection.size === 1) {
            setResizingNodeId(node.id)
            setHasMoved(false)
            return
        }

        setDraggedNodeId(node.id)
        setHasMoved(false)

        const rect = getContainerRect()
        if (!rect) return
        const { x: mouseCanvasX, y: mouseCanvasY } = toCanvasCoords(e.clientX, e.clientY, rect, camera)

        setDragOffset({
            x: mouseCanvasX - node.x,
            y: mouseCanvasY - node.y
        })
        dragStartPosition.current = { x: e.clientX, y: e.clientY }
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    }, [selection, nodes, camera, getContainerRect, getGroupNodes, moveToFront, onOpenDocument]);

    const handlePanningMode = useCallback((e: React.MouseEvent, setCamera: (c: any) => void) => {
        const dx = e.clientX - lastMousePosRef.current.x
        const dy = e.clientY - lastMousePosRef.current.y
        setCamera((prev: any) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    }, []);

    const handleSelectionBoxMode = useCallback((e: React.MouseEvent) => {
        const rect = getContainerRect()
        if (!rect || !selectionBox) return
        const x = (e.clientX - rect.left - camera.x) / camera.zoom
        const y = (e.clientY - rect.top - camera.y) / camera.zoom
        setSelectionBox(prev => prev ? { ...prev, end: { x, y } } : null)

        const x1 = Math.min(selectionBox.start.x, x)
        const y1 = Math.min(selectionBox.start.y, y)
        const x2 = Math.max(selectionBox.start.x, x)
        const y2 = Math.max(selectionBox.start.y, y)

        const candidates = new Set<string>()
        nodes.forEach(node => {
            const nodeWidth = node.width || 0
            const nodeHeight = node.height || 0
            if (
                node.x < x2 &&
                node.x + nodeWidth > x1 &&
                node.y < y2 &&
                node.y + nodeHeight > y1
            ) {
                candidates.add(node.id)
            }
        })
        setSelectionCandidates(candidates)
    }, [camera, getContainerRect, nodes, selectionBox]);

    const handleEraserModeMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = getContainerRect()
        if (!rect) return
        const { x, y } = toCanvasCoords(e.clientX, e.clientY, rect, camera)

        setNodes(prev => {
            const newNodes = prev.filter(n => !shouldEraseNode(n, x, y));
            if (newNodes.length !== prev.length) setSelection(new Set());
            return newNodes;
        });
    }, [camera, getContainerRect, setNodes]);

    const handleDrawingModeMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = getContainerRect()
        if (!rect) return
        const pt = toCanvasCoords(e.clientX, e.clientY, rect, camera)
        setCurrentPath(prev => prev ? [...prev, pt] : null)
    }, [camera, getContainerRect]);

    const handleDraggedHandleMode = useCallback((e: React.MouseEvent) => {
        if (!draggedHandle) return
        const rect = getContainerRect()
        if (!rect) return
        const { x: mouseX, y: mouseY } = toCanvasCoords(e.clientX, e.clientY, rect, camera)

        let currentSnapNodeId: string | null = null
        let snapPoint: { x: number, y: number } | null = null

        if (draggedHandle.type === 'start' || draggedHandle.type === 'end') {
            const targetX = mouseX - draggedHandle.offsetX
            const targetY = mouseY - draggedHandle.offsetY
            const SNAP_THRESHOLD = 20 / camera.zoom
            const HOVER_THRESHOLD = 100 / camera.zoom

            nodes.forEach(other => {
                if (other.id === draggedHandle.nodeId || other.type === 'arrow') return

                const centerX = other.x + (other.width || 0) / 2
                const centerY = other.y + (other.height || 0) / 2

                const isInside =
                    targetX >= other.x - HOVER_THRESHOLD &&
                    targetX <= other.x + (other.width || 0) + HOVER_THRESHOLD &&
                    targetY >= other.y - HOVER_THRESHOLD &&
                    targetY <= other.y + (other.height || 0) + HOVER_THRESHOLD

                if (isInside) {
                    currentSnapNodeId = other.id
                    let bestPoint = { x: centerX, y: centerY }
                    let minD = Infinity

                    if (other.shapeType === 'circle') {
                        const vx = targetX - centerX
                        const vy = targetY - centerY
                        const mag = Math.sqrt(vx * vx + vy * vy)
                        const radius = (other.width || 0) / 2
                        if (mag > 0) {
                            bestPoint = {
                                x: centerX + (vx / mag) * radius,
                                y: centerY + (vy / mag) * radius
                            }
                            minD = Math.abs(mag - radius)
                        }
                    } else {
                        const edges = [
                            { x: Math.max(other.x, Math.min(other.x + (other.width || 0), targetX)), y: other.y },
                            { x: Math.max(other.x, Math.min(other.x + (other.width || 0), targetX)), y: other.y + (other.height || 0) },
                            { x: other.x, y: Math.max(other.y, Math.min(other.y + (other.height || 0), targetY)) },
                            { x: other.x + (other.width || 0), y: Math.max(other.y, Math.min(other.y + (other.height || 0), targetY)) }
                        ]
                        edges.forEach(edge => {
                            const d = Math.sqrt(Math.pow(targetX - edge.x, 2) + Math.pow(targetY - edge.y, 2))
                            if (d < minD) {
                                minD = d
                                bestPoint = edge
                            }
                        })
                    }
                    if (minD < SNAP_THRESHOLD) snapPoint = bestPoint
                }
            })
        }
        setSnapTargetId(currentSnapNodeId)

        setNodes(prev => prev.map(n => {
            if (n.id !== draggedHandle.nodeId || !n.points) return n
            const newPoints = { ...n.points }
            const targetX = mouseX - draggedHandle.offsetX
            const targetY = mouseY - draggedHandle.offsetY

            if (!newPoints.control) {
                newPoints.control = {
                    x: (newPoints.start.x + newPoints.end.x) / 2,
                    y: (newPoints.start.y + newPoints.end.y) / 2
                }
            }

            const targetNode = nodes.find(other => other.id === currentSnapNodeId)
            const targetCenterX = targetNode ? targetNode.x + (targetNode.width || 0) / 2 : 0
            const targetCenterY = targetNode ? targetNode.y + (targetNode.height || 0) / 2 : 0

            if (draggedHandle.type === 'start') {
                if (!draggedHandle.initialPoints) return n
                const initial = draggedHandle.initialPoints
                const finalX = snapPoint ? snapPoint.x : targetX
                const finalY = snapPoint ? snapPoint.y : targetY
                const startOffset = snapPoint ? { x: snapPoint.x - targetCenterX, y: snapPoint.y - targetCenterY } : undefined

                const rotated = rotateControlPoints(initial, { x: finalX, y: finalY }, initial.end)
                newPoints.start = { x: finalX, y: finalY }
                newPoints.control = rotated.control
                newPoints.control2 = rotated.control2
                return { ...n, startNodeId: currentSnapNodeId || undefined, startOffset, points: newPoints }
            } else if (draggedHandle.type === 'end') {
                if (!draggedHandle.initialPoints) return n
                const initial = draggedHandle.initialPoints
                const finalX = snapPoint ? snapPoint.x : targetX
                const finalY = snapPoint ? snapPoint.y : targetY
                const endOffset = snapPoint ? { x: snapPoint.x - targetCenterX, y: snapPoint.y - targetCenterY } : undefined

                const rotated = rotateControlPoints(initial, initial.start, { x: finalX, y: finalY })
                newPoints.end = { x: finalX, y: finalY }
                newPoints.control = rotated.control
                newPoints.control2 = rotated.control2
                return { ...n, endNodeId: currentSnapNodeId || undefined, endOffset, points: newPoints }
            } else if (draggedHandle.type === 'control') {
                newPoints.control = { x: targetX, y: targetY }
            } else if (draggedHandle.type === 'control2') {
                newPoints.control2 = { x: targetX, y: targetY }
            }

            return { ...n, ...arrowBounds(newPoints), points: newPoints }
        }))
    }, [camera, containerRef, draggedHandle, nodes, setNodes]);

    const handleDraggedNodeMode = useCallback((e: React.MouseEvent) => {
        if (!draggedNodeId) return
        setHasMoved(true)
        applyInertiaMovement(e.movementX)

        const dx = (e.clientX - lastMousePosRef.current.x) / camera.zoom
        const dy = (e.clientY - lastMousePosRef.current.y) / camera.zoom
        if (dx === 0 && dy === 0) return

        setNodes(prev => {
            const mainNode = prev.find(n => n.id === draggedNodeId)
            if (!mainNode) return prev
            return prev.map(n => {
                if (selection.has(n.id)) {
                    const newX = n.x + dx
                    const newY = n.y + dy
                    if (n.type === 'arrow' && n.points) {
                        const shouldMoveStart = !n.startNodeId || selection.has(n.startNodeId)
                        const shouldMoveEnd = !n.endNodeId || selection.has(n.endNodeId)
                        const newPoints = {
                            ...n.points,
                            start: shouldMoveStart ? { x: n.points.start.x + dx, y: n.points.start.y + dy } : n.points.start,
                            end: shouldMoveEnd ? { x: n.points.end.x + dx, y: n.points.end.y + dy } : n.points.end,
                            control: n.points.control ? { x: n.points.control.x + dx, y: n.points.control.y + dy } : undefined,
                            control2: n.points.control2 ? { x: n.points.control2.x + dx, y: n.points.control2.y + dy } : undefined
                        }
                        const recalculated = updateConnectedArrow(n, prev, selection, dx, dy);
                        if (recalculated) Object.assign(newPoints, recalculated);
                        return { ...n, ...arrowBounds(newPoints), points: newPoints as any }
                    }
                    if (n.type === 'pencil' && n.path) {
                        return { ...n, x: newX, y: newY, path: n.path.map(p => ({ x: p.x + dx, y: p.y + dy })) }
                    }
                    return { ...n, x: newX, y: newY }
                }
                if (n.type === 'arrow' && n.points) {
                    let updated = false; const newPoints = { ...n.points }
                    if (n.startNodeId && selection.has(n.startNodeId)) { newPoints.start = { x: newPoints.start.x + dx, y: newPoints.start.y + dy }; updated = true }
                    if (n.endNodeId && selection.has(n.endNodeId)) { newPoints.end = { x: newPoints.end.x + dx, y: newPoints.end.y + dy }; updated = true }
                    if (updated) {
                        const recalculated = updateConnectedArrow(n, prev, selection, dx, dy);
                        if (recalculated) Object.assign(newPoints, recalculated);
                        return { ...n, ...arrowBounds(newPoints), points: newPoints }
                    }
                }
                return n
            })
        })
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
    }, [camera, draggedNodeId, selection, setNodes]);

    const handleResizingNodeMode = useCallback((e: React.MouseEvent) => {
        if (!resizingNodeId) return
        const rect = getContainerRect()
        if (!rect) return
        const node = nodes.find(n => n.id === resizingNodeId)
        if (!node) return
        const { x: mouseX, y: mouseY } = toCanvasCoords(e.clientX, e.clientY, rect, camera)

        const anchor = resizeAnchor.current
        const isDrawingShape = anchor !== null

        const newX = isDrawingShape ? Math.min(anchor.x, mouseX) : node.x
        const newY = isDrawingShape ? Math.min(anchor.y, mouseY) : node.y
        const newWidth = isDrawingShape
            ? Math.max(20, Math.abs(mouseX - anchor.x))
            : Math.max(20, mouseX - node.x)
        const newHeight = isDrawingShape
            ? Math.max(20, Math.abs(mouseY - anchor.y))
            : Math.max(20, mouseY - node.y)

        setNodes(prev => {
            const node = prev.find(n => n.id === resizingNodeId)
            if (!node) return prev

            const oldCx = node.x + (node.width || 0) / 2
            const oldCy = node.y + (node.height || 0) / 2
            const newCx = newX + newWidth / 2
            const newCy = newY + newHeight / 2
            const dx = newCx - oldCx
            const dy = newCy - oldCy

            return prev.map(n => {
                if (n.id === resizingNodeId) return { ...n, x: newX, y: newY, width: newWidth, height: newHeight }

                if (!isDrawingShape && n.type === 'arrow' && n.points) {
                    let updated = false
                    const newPoints = { ...n.points }
                    if (n.startNodeId === resizingNodeId) { newPoints.start = { x: n.points.start.x + dx, y: n.points.start.y + dy }; updated = true }
                    if (n.endNodeId === resizingNodeId) { newPoints.end = { x: n.points.end.x + dx, y: n.points.end.y + dy }; updated = true }
                    if (updated) {
                        if (n.startNodeId && n.endNodeId) {
                            const startSide = offsetToSide(n.startOffset)
                            const endSide = offsetToSide(n.endOffset)
                            const { cp1, cp2 } = calculateBezierControls(newPoints.start, newPoints.end, startSide, endSide)
                            newPoints.control = cp1
                            newPoints.control2 = cp2
                        }
                        return { ...n, ...arrowBounds(newPoints), points: newPoints }
                    }
                }
                return n
            })
        })
    }, [camera, getContainerRect, nodes, resizingNodeId, setNodes]);

    const handleMouseMove = useCallback((e: React.MouseEvent, isPanning: boolean, camera: Camera, setCamera: (c: any) => void) => {
        if (isPanning) {
            handlePanningMode(e, setCamera)
        } else if (selectionBox) {
            handleSelectionBoxMode(e)
        } else if (isEraserMode && e.buttons === 1) {
            handleEraserModeMouseMove(e)
        } else if (isDrawingMode && currentPath) {
            handleDrawingModeMouseMove(e)
        } else if (draggedHandle) {
            handleDraggedHandleMode(e)
        } else if (isCreatingArrow && arrowStart) {
            const rect = getContainerRect()
            if (rect) setArrowEndPreview(toCanvasCoords(e.clientX, e.clientY, rect, camera))
        } else if (draggedNodeId) {
            handleDraggedNodeMode(e)
        } else if (resizingNodeId) {
            handleResizingNodeMode(e)
        }
    }, [
        selectionBox, isEraserMode, isDrawingMode, currentPath, draggedHandle,
        isCreatingArrow, arrowStart, draggedNodeId, resizingNodeId, camera, getContainerRect,
        handlePanningMode, handleSelectionBoxMode, handleEraserModeMouseMove,
        handleDrawingModeMouseMove, handleDraggedHandleMode, handleDraggedNodeMode,
        handleResizingNodeMode
    ]);

    const handleMouseUp = useCallback((e: React.MouseEvent, setIsPanning: (p: boolean) => void) => {
        setIsPanning(false)
        if (isDrawingMode && currentPath && currentPath.length > 1) {
            const minX = Math.min(...currentPath.map(p => p.x))
            const minY = Math.min(...currentPath.map(p => p.y))
            const maxX = Math.max(...currentPath.map(p => p.x))
            const maxY = Math.max(...currentPath.map(p => p.y))

            const newNode: CanvasNode = {
                id: generateId(),
                type: 'pencil',
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                content: '',
                path: currentPath,
                strokeColor: pencilColor,
                strokeWidth: pencilWidth
            }
            setNodes((prev: CanvasNode[]) => [...prev, newNode])
            setSelection(new Set([newNode.id]))
            setCurrentPath(null)
            return
        }

        if (isCreatingArrow && arrowStart && arrowStartNodeId) {
            const rect = getContainerRect()
            if (rect) {
                const { x: mouseX, y: mouseY } = toCanvasCoords(e.clientX, e.clientY, rect, camera)
                const dist = Math.hypot(mouseX - arrowStart.x, mouseY - arrowStart.y)
                if (dist > 10) {
                    const end = { x: mouseX, y: mouseY };
                    const controls = calculateBezierControls(arrowStart, end, arrowStartSide)
                    const newNode: CanvasNode = {
                        id: generateId(),
                        type: 'arrow',
                        x: Math.min(arrowStart.x, mouseX),
                        y: Math.min(arrowStart.y, mouseY),
                        width: Math.abs(mouseX - arrowStart.x),
                        height: Math.abs(mouseY - arrowStart.y),
                        content: '',
                        startNodeId: arrowStartNodeId,
                        points: {
                            start: arrowStart,
                            end,
                            control: controls.cp1,
                            control2: controls.cp2
                        }
                    }
                    setNodes((prev: CanvasNode[]) => [...prev, newNode])
                    setSelection(new Set([newNode.id]))
                }
            }
            setArrowStart(null); setArrowStartNodeId(null); setArrowStartSide(null); setArrowEndPreview(null); setIsCreatingArrow(false)
            return
        }

        if (hasMoved) {
            if (preDragOrder && selection.size > 1) {
                setNodes(prev => {
                    const posMap = new Map(prev.map(n => [n.id, n]))
                    const ordered = preDragOrder.map(id => posMap.get(id)).filter(Boolean) as typeof prev
                    const oldIds = new Set(preDragOrder); const extra = prev.filter(n => !oldIds.has(n.id))
                    return [...ordered, ...extra]
                })
            }
            setPreDragOrder(null)
        } else if (selectionBox) {
            const x1 = Math.min(selectionBox.start.x, selectionBox.end.x)
            const y1 = Math.min(selectionBox.start.y, selectionBox.end.y)
            const x2 = Math.max(selectionBox.start.x, selectionBox.end.x)
            const y2 = Math.max(selectionBox.start.y, selectionBox.end.y)
            const newSelection = new Set(e.shiftKey ? selection : [])
            nodes.forEach(node => {
                if (node.x < x2 && node.x + (node.width || 0) > x1 && node.y < y2 && node.y + (node.height || 0) > y1) newSelection.add(node.id)
            })
            setSelection(newSelection); setSelectionCandidates(new Set())
        }
        setDraggedNodeId(null); setResizingNodeId(null); setDraggedHandle(null); setSnapTargetId(null); setHasMoved(false); setSelectionBox(null);
        resizeAnchor.current = null;
    }, [isCreatingArrow, arrowStart, arrowStartNodeId, arrowStartSide, camera, containerRef, hasMoved, preDragOrder, selection, selectionBox, nodes, setNodes]);

    const addNote = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect()
        const newNode: CanvasNode = {
            id: generateId(),
            type: 'note',
            x: ((rect?.width || window.innerWidth) / 2 - camera.x) / camera.zoom - 100,
            y: ((rect?.height || window.innerHeight) / 2 - camera.y) / camera.zoom - 75,
            width: 150,
            height: 40,
            content: ''
        }
        setNodes((prev: CanvasNode[]) => [...prev, newNode])
        setSelection(new Set([newNode.id]))
        setTimeout(() => {
            const el = document.getElementById(`textarea-${newNode.id}`) as HTMLTextAreaElement;
            if (el) el.focus();
        }, 50);
    }, [camera, containerRef, setNodes]);

    const addTable = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect()
        const newNode: CanvasNode = {
            id: generateId(),
            type: 'table',
            x: ((rect?.width || window.innerWidth) / 2 - camera.x) / camera.zoom - 150,
            y: ((rect?.height || window.innerHeight) / 2 - camera.y) / camera.zoom - 100,
            width: 300,
            height: 200,
            content: '| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n| Cell 7 | Cell 8 | Cell 9 |'
        }
        setNodes(prev => [...prev, newNode])
        setSelection(new Set([newNode.id]))
    }, [camera, containerRef, setNodes]);

    const addShape = useCallback((shapeType: 'rectangle' | 'circle') => {
        setShapeDrawingMode(shapeType)
    }, [setShapeDrawingMode]);

    const updateNodeContent = useCallback((id: string, content: string) => {
        setNodes((prev: CanvasNode[]) => prev.map((n: CanvasNode) => n.id === id ? { ...n, content } : n))
    }, [setNodes]);

    const handleMouseDown = useCallback((e: React.MouseEvent, isPanning: boolean, setIsPanning: (p: boolean) => void) => {
        if (isSpacePressed || e.button === 1) {
            setIsPanning(true)
            lastMousePosRef.current = { x: e.clientX, y: e.clientY }
            return
        }
        if (e.button === 0) {
            const rect = containerRef.current?.getBoundingClientRect()
            const { x, y } = rect ? toCanvasCoords(e.clientX, e.clientY, rect, camera) : { x: 0, y: 0 }

            if (shapeDrawingMode) {
                const id = generateId();
                const newNode: CanvasNode = {
                    id,
                    type: 'shape',
                    shapeType: shapeDrawingMode,
                    x,
                    y,
                    width: 0,
                    height: 0,
                    content: ''
                };
                setNodes(prev => [...prev, newNode]);
                setSelection(new Set([id]));
                resizeAnchor.current = { x, y };
                setResizingNodeId(id);
                setShapeDrawingMode(null);
                return;
            }

            if (isDrawingMode) {
                setCurrentPath([{ x, y }])
                return
            }

            if (isEraserMode) {
                setNodes(prev => {
                    const newNodes = prev.filter(n => !shouldEraseNode(n, x, y));
                    if (newNodes.length !== prev.length) setSelection(new Set());
                    return newNodes;
                });
                return;
            }

            if (e.target === containerRef.current) {
                if (!e.shiftKey) setSelection(new Set())
                setEditingId(null)
                setSelectionBox({ start: { x, y }, end: { x, y } })
            }
        }
    }, [isSpacePressed, camera, containerRef, isDrawingMode, isEraserMode, setNodes, shapeDrawingMode]);

    const handleTouchStart = useCallback((e: React.TouchEvent, isPanning: boolean, setIsPanning: (p: boolean) => void) => {
        if (e.touches.length === 2) {
            setIsPanning(true)
            const touch1 = e.touches[0]; const touch2 = e.touches[1]
            lastMousePosRef.current = { x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2 }
        } else if (e.touches.length === 1 && e.target === containerRef.current) {
            const touch = e.touches[0]
            if (!e.shiftKey) setSelection(new Set())
            setEditingId(null)
            const rect = getContainerRect()
            if (!rect) return
            const { x, y } = toCanvasCoords(touch.clientX, touch.clientY, rect, camera)
            setSelectionBox({ start: { x, y }, end: { x, y } })
        }
    }, [camera, containerRef, getContainerRect]);

    const handleTouchMove = useCallback((e: React.TouchEvent, isPanning: boolean, camera: Camera, setCamera: (c: any) => void) => {
        if (isPanning && e.touches.length === 2) {
            const touch1 = e.touches[0]; const touch2 = e.touches[1]
            const currentPos = { x: (touch1.clientX + touch2.clientX) / 2, y: (touch1.clientY + touch2.clientY) / 2 }
            const dx = currentPos.x - lastMousePosRef.current.x
            const dy = currentPos.y - lastMousePosRef.current.y
            setCamera((prev: any) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
            lastMousePosRef.current = currentPos
        } else if (selectionBox && e.touches.length === 1) {
            const touch = e.touches[0]
            const rect = getContainerRect()
            if (!rect) return
            const x = (touch.clientX - rect.left - camera.x) / camera.zoom
            const y = (touch.clientY - rect.top - camera.y) / camera.zoom
            setSelectionBox(prev => prev ? { ...prev, end: { x, y } } : null)
        }
    }, [selectionBox, getContainerRect]);

    const handleTouchEnd = useCallback((setIsPanning: (p: boolean) => void) => {
        setIsPanning(false)
        setSelectionBox(null)
    }, []);

    const completeArrowConnection = useCallback((targetNode: CanvasNode) => {
        if (!arrowStart || !arrowStartNodeId) return;

        const bestEnd = getBestDynamicEnd(arrowStart, arrowStartSide || 'right', targetNode, nodes);
        const endPos = {
            x: targetNode.x + (bestEnd.endSide === 'left' ? 0 : bestEnd.endSide === 'right' ? targetNode.width : targetNode.width / 2),
            y: targetNode.y + (bestEnd.endSide === 'top' ? 0 : bestEnd.endSide === 'bottom' ? targetNode.height : targetNode.height / 2)
        };
        const controls = calculateBezierControls(arrowStart, endPos, arrowStartSide, bestEnd.endSide);
        const startNode = nodes.find(n => n.id === arrowStartNodeId);

        const newNode: CanvasNode = {
            id: generateId(),
            type: 'arrow',
            x: Math.min(arrowStart.x, endPos.x),
            y: Math.min(arrowStart.y, endPos.y),
            width: Math.max(1, Math.abs(endPos.x - arrowStart.x)),
            height: Math.max(1, Math.abs(endPos.y - arrowStart.y)),
            content: '',
            startNodeId: arrowStartNodeId,
            startSide: arrowStartSide || undefined,
            endNodeId: targetNode.id,
            isDynamicEnd: true,
            startOffset: startNode ? { x: arrowStart.x - startNode.x, y: arrowStart.y - startNode.y } : undefined,
            endOffset: { x: endPos.x - targetNode.x, y: endPos.y - targetNode.y },
            points: {
                start: arrowStart,
                end: endPos,
                control: controls.cp1,
                control2: controls.cp2
            }
        };

        setNodes(prev => [...prev, newNode]);
        setSelection(new Set([newNode.id]));
        setArrowStart(null);
        setArrowStartNodeId(null);
        setArrowStartSide(null);
        setArrowEndPreview(null);
        setIsCreatingArrow(false);
    }, [arrowStart, arrowStartNodeId, arrowStartSide, nodes, setNodes]);

    const deleteSelection = useCallback(() => {
        if (selection.size > 0) {
            setNodes(prev => prev.filter(n => !selection.has(n.id)))
            setSelection(new Set())
        }
    }, [selection, setNodes]);

    return {
        draggedNodeId, setDraggedNodeId,
        resizingNodeId, setResizingNodeId,
        dragOffset, setDragOffset,
        lastMousePosRef,
        selection, setSelection,
        isSpacePressed, setIsSpacePressed,
        hasMoved, setHasMoved,
        selectionBox, setSelectionBox,
        selectionCandidates, setSelectionCandidates,
        preDragOrder, setPreDragOrder,
        isCreatingArrow, setIsCreatingArrow,
        isDrawingMode, setIsDrawingMode,
        isEraserMode, setIsEraserMode,
        pencilColor, setPencilColor,
        pencilWidth, setPencilWidth,
        currentPath,
        shapeDrawingMode, setShapeDrawingMode,
        arrowStart, setArrowStart,
        arrowStartNodeId, setArrowStartNodeId,
        arrowStartSide, setArrowStartSide,
        arrowEndPreview, setArrowEndPreview,
        draggedHandle, setDraggedHandle,
        snapTargetId, setSnapTargetId,
        editingId, setEditingId,
        dragStartPosition,
        handleNodeMouseDown,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        moveToFront,
        getGroupNodes,
        addNote,
        addTable,
        addShape,
        updateNodeContent,
        completeArrowConnection,
        deleteSelection,
        activeTool,
        setActiveTool
    }
}
