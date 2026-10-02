import React, { memo, useState, useEffect, useRef } from 'react'
import type { CollabProvider, RemoteCursor, CollaboratorUser } from './types'
import { getCollaboratorColor } from './cursor-palette'

interface MultiplayerCursorsProps {
    provider?: CollabProvider | null
    camera?: { x: number; y: number; zoom: number }
    cursors?: RemoteCursor[]
}

/**
 * Isolated, zero-overhead multiplayer cursors layer.
 * Subscribes directly to PartyKit / Yjs Awareness events so parent components
 * (like CanvasView) NEVER re-render when remote cursors move.
 * Leverages GPU-accelerated CSS translate3d with cubic-bezier interpolation for 200+ FPS fluid motion.
 */
export const MultiplayerCursors = memo<MultiplayerCursorsProps>(({ provider, camera, cursors: externalCursors }) => {
    const [internalCursors, setInternalCursors] = useState<RemoteCursor[]>([])

    useEffect(() => {
        if (externalCursors) return // If controlled externally, skip awareness listener
        const awareness = provider?.awareness
        if (!awareness) return

        let animFrameId: number | null = null

        const handleAwareness = () => {
            if (animFrameId !== null) return

            animFrameId = requestAnimationFrame(() => {
                animFrameId = null
                const states = awareness.getStates()
                const nextCursors: RemoteCursor[] = []

                states.forEach((state: any, clientId: number) => {
                    if (clientId === awareness.clientID) return

                    if (state?.cursor && typeof state.cursor.x === 'number' && typeof state.cursor.y === 'number') {
                        nextCursors.push({
                            id: clientId,
                            x: state.cursor.x,
                            y: state.cursor.y,
                            user: {
                                name: state.user?.name ?? `Guest ${clientId.toString().slice(-4)}`,
                                color: state.user?.color ?? getCollaboratorColor(clientId),
                                avatar: state.user?.avatar,
                            },
                            lastActive: Date.now(),
                        })
                    }
                })

                setInternalCursors(nextCursors)
            })
        }

        awareness.on('change', handleAwareness)
        handleAwareness()

        return () => {
            awareness.off('change', handleAwareness)
            if (animFrameId !== null) cancelAnimationFrame(animFrameId)
        }
    }, [provider, externalCursors])

    const activeCursors = externalCursors ?? internalCursors
    if (activeCursors.length === 0) return null

    const camX = camera?.x ?? 0
    const camY = camera?.y ?? 0
    const zoom = camera?.zoom ?? 1

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-hidden z-40 select-none"
            style={{
                transform: `translate3d(${camX}px, ${camY}px, 0)`,
                contain: 'layout paint style',
            }}
        >
            {activeCursors.map(({ id, x, y, user }) => {
                const screenX = x * zoom
                const screenY = y * zoom

                return (
                    <div
                        key={id}
                        className="absolute top-0 left-0 pointer-events-none will-change-transform"
                        style={{
                            transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
                            transition: 'transform 60ms cubic-bezier(0.16, 1, 0.3, 1)',
                            backfaceVisibility: 'hidden',
                        }}
                    >
                        {/* Figma SVG Arrow Pointer */}
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
                        >
                            <path
                                d="M3.5 2.5L13.5 12.5L8.5 13.5L5.5 19.5L3.5 18.5L6.5 12.5L2.5 12.5L3.5 2.5Z"
                                fill={user.color}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>

                        {/* Figma Pill Name Badge */}
                        <div
                            className="absolute left-[14px] top-[12px] px-2 py-0.5 rounded-full rounded-tl-[2px] text-white text-[11px] font-semibold tracking-tight shadow-[0_2px_6px_rgba(0,0,0,0.25)] flex items-center gap-1.5 whitespace-nowrap select-none"
                            style={{ backgroundColor: user.color }}
                        >
                            {user.avatar ? (
                                <img
                                    src={user.avatar}
                                    alt=""
                                    className="w-3.5 h-3.5 rounded-full object-cover border border-white/70"
                                />
                            ) : null}
                            <span>{user.name}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
})

MultiplayerCursors.displayName = 'MultiplayerCursors'

interface CollaboratorAvatarStackProps {
    provider?: CollabProvider | null
}

/**
 * Isolated active collaborator avatar stack for headers.
 * Only re-renders when connected users change (join/leave/profile change),
 * never re-rendering on mouse cursor coordinate updates!
 */
export const CollaboratorAvatarStack = memo<CollaboratorAvatarStackProps>(({ provider }) => {
    const [collaborators, setCollaborators] = useState<CollaboratorUser[]>([])
    const prevKeyRef = useRef<string>('')

    useEffect(() => {
        const awareness = provider?.awareness
        if (!awareness) return

        const handleAwareness = () => {
            const states = awareness.getStates()
            const users: CollaboratorUser[] = []

            states.forEach((state: any, clientId: number) => {
                if (clientId === awareness.clientID) return
                users.push({
                    name: state?.user?.name ?? `Guest ${clientId.toString().slice(-4)}`,
                    color: state?.user?.color ?? getCollaboratorColor(clientId),
                    avatar: state?.user?.avatar,
                })
            })

            // Only update state if member keys or names actually changed
            const key = users.map(u => `${u.name}:${u.color}`).sort().join('|')
            if (key !== prevKeyRef.current) {
                prevKeyRef.current = key
                setCollaborators(users)
            }
        }

        awareness.on('change', handleAwareness)
        handleAwareness()

        return () => {
            awareness.off('change', handleAwareness)
        }
    }, [provider])

    if (collaborators.length === 0) return null

    return (
        <div className="flex items-center -space-x-1.5 mr-2">
            {collaborators.slice(0, 4).map((collab, index) => (
                <div
                    key={index}
                    title={`${collab.name} (Live)`}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-background shadow-sm select-none uppercase overflow-hidden ring-1 ring-border/50"
                    style={{ backgroundColor: collab.color }}
                >
                    {collab.avatar ? (
                        <img src={collab.avatar} alt={collab.name} className="w-full h-full object-cover" />
                    ) : (
                        collab.name.slice(0, 2)
                    )}
                </div>
            ))}
            {collaborators.length > 4 && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground border-2 border-background shadow-sm select-none">
                    +{collaborators.length - 4}
                </div>
            )}
        </div>
    )
})

CollaboratorAvatarStack.displayName = 'CollaboratorAvatarStack'
