import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { CollabProvider } from './types'
import { getCollaboratorColor } from './cursor-palette'

interface UseLocalCursorBroadcastOptions {
    provider?: CollabProvider | null
    user?: { id?: string; name?: string; email?: string; avatarUrl?: string } | null
    camera?: { x: number; y: number; zoom: number }
    containerRef?: React.RefObject<HTMLElement>
}

/**
 * Ultra-high-performance zero-rerender cursor broadcaster.
 * Captures mouse/pointer events, transforms coordinates relative to canvas/camera,
 * and throttles network broadcast via requestAnimationFrame (~40-60Hz network transmission).
 * Returns static callbacks that NEVER trigger React re-renders in the host component.
 */
export function useLocalCursorBroadcast({
    provider,
    user,
    camera,
    containerRef,
}: UseLocalCursorBroadcastOptions) {
    const localColor = useMemo(
        () => getCollaboratorColor(user?.id ?? user?.email ?? 'anon'),
        [user?.id, user?.email]
    )
    const localName = useMemo(
        () => user?.name ?? user?.email?.split('@')[0] ?? 'Anonymous',
        [user?.name, user?.email]
    )

    // Broadcast local identity once or on auth change
    useEffect(() => {
        const awareness = provider?.awareness
        if (!awareness) return

        awareness.setLocalStateField('user', {
            name: localName,
            color: localColor,
            avatar: user?.avatarUrl,
        })
    }, [provider, localName, localColor, user?.avatarUrl])

    const rafId = useRef<number | null>(null)
    const pendingPos = useRef<{ x: number; y: number } | null>(null)

    // Cache camera in ref to avoid recreation of onPointerMove
    const cameraRef = useRef(camera)
    cameraRef.current = camera

    const updateCursor = useCallback(
        (pos: { x: number; y: number } | null) => {
            const awareness = provider?.awareness
            if (!awareness) return

            pendingPos.current = pos
            if (rafId.current !== null) return

            rafId.current = requestAnimationFrame(() => {
                rafId.current = null
                awareness.setLocalStateField('cursor', pendingPos.current)
            })
        },
        [provider]
    )

    const cachedRectRef = useRef<DOMRect | null>(null)

    // Invalidate cached rect on window resize or scroll
    useEffect(() => {
        const invalidate = () => {
            cachedRectRef.current = null
        }
        window.addEventListener('resize', invalidate, { passive: true })
        window.addEventListener('scroll', invalidate, { passive: true })
        return () => {
            window.removeEventListener('resize', invalidate)
            window.removeEventListener('scroll', invalidate)
        }
    }, [])

    const onPointerMove = useCallback(
        (e: React.MouseEvent | React.PointerEvent) => {
            const el = containerRef?.current
            if (!el) return

            // Zero-layout-thrashing: reuse cached rect during continuous pointer movements
            if (!cachedRectRef.current) {
                cachedRectRef.current = el.getBoundingClientRect()
            }
            const rect = cachedRectRef.current
            const rawX = e.clientX - rect.left
            const rawY = e.clientY - rect.top
            const cam = cameraRef.current

            const x = cam ? (rawX - cam.x) / cam.zoom : rawX
            const y = cam ? (rawY - cam.y) / cam.zoom : rawY

            updateCursor({ x, y })
        },
        [containerRef, updateCursor]
    )

    const onPointerLeave = useCallback(() => {
        cachedRectRef.current = null
        updateCursor(null)
    }, [updateCursor])

    return {
        onPointerMove,
        onPointerLeave,
        localColor,
        localName,
    }
}

/** Backward-compatible & ergonomic alias */
export const usePartyCursors = useLocalCursorBroadcast
