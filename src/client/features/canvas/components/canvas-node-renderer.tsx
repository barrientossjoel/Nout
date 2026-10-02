import React from 'react'
import { Frame, ExternalLink } from 'lucide-react'
import { cn } from '../../../lib/utils/utils'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Editor } from '../../../components/editor/editor'
import { CanvasTableNode } from './canvas-table-node'
import { MemoizedMarkdownPreview } from './markdown-preview'
import { CanvasNode, CanvasEnv } from '../types'
import { getArrowPaths, generateId } from '../utils/canvas-geometry'

interface CanvasNodeRendererProps {
    node: CanvasNode
    envRef: React.RefObject<CanvasEnv>
    triggers: {
        isSelected: boolean
        isOnlySelection: boolean
        isSelectionCandidate: boolean
        isSnapTarget: boolean
        isDragged: boolean
        isEditing: boolean
        isResizing: boolean
        portalDoc?: any
        isCreatingArrow: boolean
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the drag distance from the recorded drag start position to (cx, cy). */
const dragDistancePx = (envRef: React.RefObject<CanvasEnv>, cx: number, cy: number): number => {
    const env = envRef.current;
    if (!env) return 0;
    const origin = env.dragStartPosition?.current;
    if (!origin) return 0;
    return Math.hypot(cx - origin.x, cy - origin.y);
};

/** Arrow color class based on selection state. */
const arrowColor = (envRef: React.RefObject<CanvasEnv>, nodeId: string): string => {
    const env = envRef.current;
    if (!env) return 'text-muted-foreground';
    return env.selection.has(nodeId)
        ? 'text-primary'
        : env.selectionCandidates.has(nodeId)
            ? 'text-primary/40'
            : 'text-muted-foreground';
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const ArrowNodeContent = ({ node, envRef }: { node: CanvasNode; envRef: React.RefObject<CanvasEnv> }) => {
    const env = envRef.current!;
    const { x, y } = env.getArrowMidpoint(node);
    const { hitPath, visiblePath } = getArrowPaths(node);
    const colorClass = cn('transition-colors', arrowColor(envRef, node.id));
    const isEditing = env.editingId === node.id;

    return (
        <>
            <svg className="w-full h-full overflow-visible">
                <defs>
                    <marker
                        id={`arrowhead-${node.id}`}
                        markerWidth="10" markerHeight="7"
                        refX="7" refY="3.5" orient="auto"
                    >
                        <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className={colorClass} />
                    </marker>
                </defs>

                {/* Wide transparent stroke for hit-testing */}
                <path
                    d={hitPath}
                    stroke="transparent" strokeWidth="12" fill="none"
                    className="cursor-pointer pointer-events-auto"
                    onMouseDown={(e) => env.handleNodeMouseDown(e, node)}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        env.setEditingId(node.id);
                        setTimeout(() => document.getElementById(`arrow-input-${node.id}`)?.focus(), 0);
                    }}
                />

                {/* Visible stroke — shortened so it ends cleanly behind the arrowhead */}
                <path
                    d={visiblePath}
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="butt" strokeLinejoin="round" fill="none"
                    markerEnd={`url(#arrowhead-${node.id})`}
                    className={cn('pointer-events-none', colorClass)}
                />

                {/* Label */}
                {node.content && !isEditing && (
                    <foreignObject x={x - 50} y={y - 12} width="100" height="24" className="overflow-visible pointer-events-none">
                        <div className="flex items-center justify-center w-full h-full">
                            <span className="bg-background/80 backdrop-blur-sm px-1 rounded text-xs text-foreground/80 whitespace-nowrap border border-border/50 shadow-sm">
                                {node.content}
                            </span>
                        </div>
                    </foreignObject>
                )}

                {isEditing && (
                    <foreignObject x={x - 50} y={y - 12} width="100" height="24" className="overflow-visible pointer-events-auto">
                        <div className="flex items-center justify-center w-full h-full" onMouseDown={(e) => e.stopPropagation()}>
                            <input
                                id={`arrow-input-${node.id}`}
                                className="bg-background border border-primary rounded px-1 text-xs text-foreground w-full outline-none text-center shadow-lg"
                                value={node.content}
                                onChange={(e) => env.updateNodeContent(node.id, e.target.value)}
                                onBlur={() => env.setEditingId(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter') env.setEditingId(null); }}
                                autoFocus
                            />
                        </div>
                    </foreignObject>
                )}
            </svg>
        </>
    );
};

/** Precise equality comparison for 200+ FPS rendering: skips diffing nodes that have not changed */
const areNodesEqual = (prev: CanvasNodeRendererProps, next: CanvasNodeRendererProps): boolean => {
    const pt = prev.triggers;
    const nt = next.triggers;
    if (
        pt.isSelected !== nt.isSelected ||
        pt.isOnlySelection !== nt.isOnlySelection ||
        pt.isSelectionCandidate !== nt.isSelectionCandidate ||
        pt.isSnapTarget !== nt.isSnapTarget ||
        pt.isDragged !== nt.isDragged ||
        pt.isEditing !== nt.isEditing ||
        pt.isResizing !== nt.isResizing ||
        pt.isCreatingArrow !== nt.isCreatingArrow ||
        pt.portalDoc !== nt.portalDoc
    ) {
        return false;
    }

    const pn = prev.node;
    const nn = next.node;
    if (pn === nn) return true;

    if (
        pn.id !== nn.id ||
        pn.type !== nn.type ||
        pn.x !== nn.x ||
        pn.y !== nn.y ||
        pn.width !== nn.width ||
        pn.height !== nn.height ||
        pn.content !== nn.content ||
        pn.shapeType !== nn.shapeType ||
        pn.strokeColor !== nn.strokeColor ||
        pn.strokeWidth !== nn.strokeWidth ||
        pn.startNodeId !== nn.startNodeId ||
        pn.endNodeId !== nn.endNodeId ||
        pn.startOffset?.x !== nn.startOffset?.x ||
        pn.startOffset?.y !== nn.startOffset?.y ||
        pn.endOffset?.x !== nn.endOffset?.x ||
        pn.endOffset?.y !== nn.endOffset?.y
    ) {
        return false;
    }

    if (pn.points !== nn.points) {
        if (!pn.points || !nn.points) return false;
        if (
            pn.points.start?.x !== nn.points.start?.x ||
            pn.points.start?.y !== nn.points.start?.y ||
            pn.points.end?.x !== nn.points.end?.x ||
            pn.points.end?.y !== nn.points.end?.y ||
            pn.points.control?.x !== nn.points.control?.x ||
            pn.points.control?.y !== nn.points.control?.y ||
            pn.points.control2?.x !== nn.points.control2?.x ||
            pn.points.control2?.y !== nn.points.control2?.y
        ) {
            return false;
        }
    }

    if (pn.path !== nn.path) {
        if (!pn.path || !nn.path) return false;
        if (pn.path.length !== nn.path.length) return false;
    }

    return true;
};

const CanvasNodeRenderer = ({ node, envRef, triggers }: CanvasNodeRendererProps) => {
    const env = envRef.current!;

    return (
        <div
            key={node.id}
            className={cn(
                "absolute flex flex-col group",
                node.type === 'arrow' ? "z-20" : "z-10",
                env.selection.has(node.id) && env.selection.size === 1 && "z-[150]",
                env.selection.has(node.id) && node.type !== 'arrow' && node.type !== 'note' && "ring-2 ring-primary",
                env.selectionCandidates.has(node.id) && !env.selection.has(node.id) && node.type !== 'arrow' && "z-[140] ring-2 ring-primary/40 shadow-lg",
                env.snapTargetId === node.id && "z-[100] ring-4 ring-primary/60 scale-[1.02] shadow-2xl",

                (node.type === 'arrow' || node.type === 'shape' || node.type === 'note')
                    ? "overflow-visible bg-transparent border-none shadow-none"
                    : "rounded-lg shadow-sm overflow-visible bg-muted/50 backdrop-blur-sm border border-foreground/20",
                node.type === 'table' && "overflow-visible",

                "transition-shadow origin-[50%_-50px]",
                (!env.draggedNodeId || env.draggedNodeId !== node.id) ? "scale-100" : "",
                (env.isDrawingMode || env.isEraserMode) && "pointer-events-none"
            )}
            style={{
                transform: (env.draggedNodeId === node.id && env.hasMoved && node.type !== 'arrow')
                    ? `translate3d(${node.x}px, ${node.y}px, 0) rotate(calc(var(--drag-vx, 0) * 0.2deg))`
                    : `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.width,
                height: node.height,
                transition: env.draggedNodeId === node.id ? 'transform 0.05s ease-out' : 'transform 0.15s ease-out',
                cursor: (node.type === 'note' || node.type === 'document' || node.type === 'shape' || node.type === 'image')
                    ? (env.draggedNodeId === node.id ? 'grabbing' : 'grab')
                    : 'default'
            } as React.CSSProperties}
            onMouseDown={(e) => {
                if (node.type !== 'arrow') {
                    env.handleNodeMouseDown(e, node)
                }
            }}
            onTouchStart={(e) => {
                if (node.type !== 'arrow') {
                    env.handleNodeTouchStart(e, node)
                }
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (!e.shiftKey && env.selection.size <= 1) {
                    env.setSelection(new Set([node.id]))
                }
            }}
            onMouseUp={(e) => {
                if (env.isCreatingArrow && env.arrowStart && env.arrowStartNodeId && node.type !== 'arrow') {
                    e.stopPropagation()
                    e.preventDefault()
                    env.completeArrowConnection(node)
                }
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                const dist = dragDistancePx(envRef, e.clientX, e.clientY);

                if (env.selection.has(node.id) && env.selection.size === 1 && dist < 5 && env.editingId !== node.id && node.type === 'document') {
                    const target = e.target as HTMLElement;
                    const field = target.closest('[data-field]')?.getAttribute('data-field') as 'title' | 'content' | null;

                    if (field) {
                        let offset = 0
                        if ((document as any).caretRangeFromPoint) {
                            const range = (document as any).caretRangeFromPoint(e.clientX, e.clientY)
                            if (range) offset = range.startOffset
                        }

                        env.setEditingId(node.id)
                        env.setFocusTarget(field)
                        env.setDoubleClickPos({ x: e.clientX, y: e.clientY })
                        env.setEditingCaretOffset(offset)
                    } else {
                        env.setEditingId(node.id)
                        env.setFocusTarget('content')
                        env.setDoubleClickPos({ x: e.clientX, y: e.clientY })
                        env.setEditingCaretOffset(0)
                    }
                }
            }}
        >
            {node.type === 'note' ? (
                <textarea
                    id={`textarea-${node.id}`}
                    className={cn(
                        "flex-1 bg-transparent p-3 text-sm outline-none resize-none text-foreground placeholder:text-muted-foreground",
                        env.draggedNodeId === node.id ? "cursor-grabbing" : "cursor-grab",
                        "focus:cursor-text"
                    )}
                    onWheel={(e) => e.stopPropagation()}
                    value={node.content}
                    onChange={(e) => {
                        env.updateNodeContent(node.id, e.target.value);
                        const el = e.target;
                        
                        el.style.height = 'auto';
                        const newHeight = Math.max(node.height, el.scrollHeight);
                        if (newHeight > node.height) {
                            env.setNodes((prev: any[]) => prev.map((n: any) => n.id === node.id ? { ...n, height: newHeight } : n));
                        }
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation()
                        if (e.button !== 0) return
                        if (document.activeElement === e.currentTarget) return
                        e.preventDefault()
                        env.handleNodeMouseDown(e, node)
                    }}
                    onDoubleClick={(e) => {
                        if (dragDistancePx(envRef, e.clientX, e.clientY) < 5 && document.activeElement !== e.currentTarget) {
                            (e.currentTarget as HTMLTextAreaElement).focus();
                        }
                    }}
                    placeholder="Type something..."
                />
            ) : node.type === 'table' ? (
                <CanvasTableNode
                    node={node}
                    isEditing={env.editingId === node.id}
                    draggedNodeId={env.draggedNodeId}
                    updateNodeContent={env.updateNodeContent}
                    setEditingId={env.setEditingId}
                    handleNodeMouseDown={env.handleNodeMouseDown}
                />
            ) : node.type === 'document' ? (
                (() => {
                    let docId = node.content;
                    if (node.content.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(node.content);
                            docId = parsed.id;
                        } catch (e) { }
                    }

                    const portalDoc = env.documents.find((d: any) => d.id === docId);

                    if (!portalDoc) {
                        return (
                            <div className="flex-1 flex items-center justify-center p-4 bg-muted/10">
                                <div className="text-center text-muted-foreground text-sm">
                                    Document not found
                                </div>
                            </div>
                        )
                    }

                    if (portalDoc.type === 'canvas') {
                        let nodeCount = 0;
                        try {
                            const parsed = portalDoc.content ? JSON.parse(portalDoc.content) : [];
                            const nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || []);
                            nodeCount = nodes.length;
                        } catch (e) { }

                        return (
                            <div
                                className={cn(
                                    "flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-muted/50 group/doc h-full overflow-hidden border border-border/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer",
                                    env.draggedNodeId === node.id ? "cursor-grabbing" : "cursor-grab"
                                )}
                                onMouseDown={(e) => {
                                    e.stopPropagation()
                                    env.handleNodeMouseDown(e, node)
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (env.onOpenDocument) env.onOpenDocument(portalDoc.id);
                                }}
                             >
                                <div className="p-3 bg-primary/10 rounded-xl mb-4 text-primary group-hover/doc:scale-110 transition-transform">
                                    <Frame className="w-8 h-8" />
                                </div>
                                <div className="text-lg font-semibold text-foreground text-center mb-1">
                                    {portalDoc.title || "Untitled Canvas"}
                                </div>
                                <div className="text-xs text-muted-foreground text-center">
                                    {nodeCount} item{nodeCount !== 1 ? 's' : ''}
                                </div>
                                {env.onOpenDocument && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover/doc:opacity-100 transition-opacity hover:bg-primary/20 hover:text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            env.onOpenDocument?.(portalDoc.id)
                                        }}
                                        title="Open in new tab"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        )
                    }

                    return (
                        <div
                            className={cn(
                                "flex-1 flex flex-col p-4 bg-transparent group/doc h-full overflow-y-auto",
                                env.draggedNodeId === node.id ? "cursor-grabbing" : "cursor-grab"
                            )}
                            onWheel={(e) => e.stopPropagation()}
                            onMouseDown={(e) => {
                                if (env.editingId === node.id) return;
                                e.stopPropagation()
                                env.handleNodeMouseDown(e, node)
                            }}
                        >
                            {env.editingId === node.id ? (
                                <>
                                    <Input
                                        id={`edit-title-${node.id}`}
                                        value={portalDoc.title}
                                        onChange={(e) => env.onUpdateDocument({ ...portalDoc, title: e.target.value })}
                                        className={cn(
                                            "text-2xl font-serif mb-2 border-none bg-transparent px-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 ring-0 focus:ring-0 outline-none shadow-none placeholder:text-muted-foreground/50",
                                            "focus:cursor-text"
                                        )}
                                        placeholder="Untitled"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex-1 w-full bg-transparent overflow-y-auto" onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                                        {(() => {
                                            let cleanContent = portalDoc.content || '';
                                            const title = portalDoc.title?.trim();
                                            if (title && cleanContent) {
                                                const lines = cleanContent.split('\n');
                                                const firstLine = lines[0].trim();
                                                const headerMatch = firstLine.match(/^#+\s*(.*)$/);
                                                const firstLineText = headerMatch ? headerMatch[1].trim() : firstLine;
                                                if (firstLineText.toLowerCase() === title.toLowerCase()) {
                                                    cleanContent = lines.slice(1).join('\n').trim();
                                                }
                                            }
                                            return (
                                                <Editor
                                                    content={cleanContent}
                                                    onChange={(newContent) => env.onUpdateDocument({ ...portalDoc, content: newContent })}
                                                    placeholder="Type something..."
                                                    className="min-h-[auto] !py-0 [&>.tiptap]:!mt-0 prose-p:my-1 prose-ul:my-1 prose-h1:text-lg prose-h2:text-base font-sans"
                                                    onLinkClick={(href: string) => env.onOpenDocument?.(href)}
                                                />
                                            );
                                        })()}
                                    </div>
                                    {env.onOpenDocument && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-8 w-8 hover:bg-muted text-muted-foreground"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                env.onOpenDocument?.(portalDoc.id)
                                            }}
                                            title="Open in new tab"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div
                                        data-field="title"
                                        className="text-2xl font-serif mb-4 line-clamp-2 min-h-[1.5em]"
                                    >
                                        {portalDoc.title || "Untitled"}
                                    </div>
                                    <div
                                        data-field="content"
                                        className={cn(
                                            "flex-1 text-sm leading-relaxed text-muted-foreground font-sans",
                                            "prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-h1:text-lg prose-h2:text-base pointer-events-none",
                                            "[&>ul.contains-task-list]:list-none [&>ul.contains-task-list]:pl-0",
                                            "[&>ul.contains-task-list>li]:flex [&>ul.contains-task-list>li]:items-start [&>ul.contains-task-list>li]:gap-2 [&>ul.contains-task-list>li]:mb-0.5",
                                            "[&>ul.contains-task-list>li]:before:hidden [&>ul.contains-task-list>li]:after:hidden",
                                            "[&_input[type=checkbox]]:mt-0.5 [&_input[type=checkbox]]:w-3.5 [&_input[type=checkbox]]:h-3.5 [&_input[type=checkbox]]:m-0 [&_input[type=checkbox]]:appearance-auto"
                                        )}
                                    >
                                        {(() => {
                                            if (!portalDoc.content) return "Empty document";
                                            return <MemoizedMarkdownPreview title={portalDoc.title} content={portalDoc.content} />;
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })()
        ) : node.type === 'arrow' ? (
            <ArrowNodeContent node={node} envRef={envRef} />
        ) : node.type === 'shape' ? (
            <div
                className="w-full h-full"
                style={{
                    borderRadius: node.shapeType === 'circle' ? '50%' : '8px',
                    border: '2px solid hsl(var(--foreground) / 0.25)',
                    boxSizing: 'border-box',
                }}
            />
        ) : node.type === 'pencil' ? (
            <svg className="w-full h-full overflow-visible pointer-events-none">
                <path
                    d={node.path ? `M ${node.path.map(p => `${p.x - node.x} ${p.y - node.y}`).join(' L ')}` : ''}
                    stroke={node.strokeColor || 'currentColor'}
                    strokeWidth={node.strokeWidth || 2}
                    strokeLinecap="round" strokeLinejoin="round" fill="none"
                />
            </svg>
        ) : null}

            {/* Resize handle */}
            {node.type !== 'arrow' && node.type !== 'pencil' && node.type !== 'note' && env.selection.has(node.id) && env.selection.size === 1 && (
                <div
                    className="absolute bottom-[-2px] right-[-2px] cursor-nwse-resize z-[200] opacity-0 group-hover:opacity-100 transition-opacity text-primary/70 hover:text-primary hover:scale-110"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); env.setResizingNodeId(node.id); }}
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 11 18 18 11 18" />
                    </svg>
                </div>
            )}

            {/* Connection handles — appear on hover for non-arrow nodes */}
            {node.type !== 'arrow' && node.type !== 'pencil' && node.type !== 'note' && ([
                { side: 'top',    style: { top: '-6px',    left: '50%', transform: 'translateX(-50%)' } },
                { side: 'bottom', style: { bottom: '-6px', left: '50%', transform: 'translateX(-50%)' } },
                { side: 'left',   style: { left: '-6px',   top: '50%',  transform: 'translateY(-50%)' } },
                { side: 'right',  style: { right: '-6px',  top: '50%',  transform: 'translateY(-50%)' } },
            ] as const).map(({ side, style }) => (
                <div
                    key={side}
                    className="absolute w-3 h-3 rounded-full bg-primary border-2 border-background shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-crosshair z-[200] hover:scale-125"
                    style={style}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const offsets = { top: { x: node.width / 2, y: 0 }, bottom: { x: node.width / 2, y: node.height }, left: { x: 0, y: node.height / 2 }, right: { x: node.width, y: node.height / 2 } };
                        const { x: ox, y: oy } = offsets[side];
                        env.setArrowStart({ x: node.x + ox, y: node.y + oy });
                        env.setArrowStartNodeId(node.id);
                        env.setArrowStartSide(side);
                        env.setIsCreatingArrow(true);
                    }}
                />
            ))}
        </div>
    )
}

export const MemoizedCanvasNode = React.memo(CanvasNodeRenderer, areNodesEqual);
MemoizedCanvasNode.displayName = 'MemoizedCanvasNode';
