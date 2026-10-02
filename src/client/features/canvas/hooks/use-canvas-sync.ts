import { useState, useEffect, useMemo, useRef } from 'react'
import type { CanvasNode } from '../types'
import { acquireCollabSession, type CollabSession } from '../../collaboration'

export function useCanvasSync(docId: string | undefined, initialNodes: CanvasNode[]) {
    const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes)
    const sessionRef = useRef<CollabSession | null>(null)

    const session = useMemo(() => {
        if (!docId) return null
        return acquireCollabSession(`board-${docId}`)
    }, [docId])

    sessionRef.current = session
    const ydoc = session?.ydoc
    const provider = session?.provider
    const ymap = useMemo(() => ydoc?.getMap<CanvasNode>('nodes'), [ydoc])

    // Session reference-count teardown
    useEffect(() => {
        return () => {
            sessionRef.current?.release()
        }
    }, [docId])

    // Initial sync flag to prevent local empty array from clearing remote data
    const hasSyncedRef = useRef(false)

    // Sync local changes to Yjs map
    useEffect(() => {
        if (!ydoc || !ymap) return
        if (!hasSyncedRef.current && nodes.length === 0) return

        ydoc.transact(() => {
            const currentIds = new Set(nodes.map(n => n.id))
            nodes.forEach(n => {
                const existing = ymap.get(n.id)
                if (JSON.stringify(existing) !== JSON.stringify(n)) {
                    ymap.set(n.id, n)
                }
            })
            for (const key of Array.from(ymap.keys())) {
                if (!currentIds.has(key)) {
                    ymap.delete(key)
                }
            }
        }, 'local')
    }, [nodes, ydoc, ymap])

    // Observe incoming remote Yjs mutations
    useEffect(() => {
        if (!ymap || !provider) return

        const observer = (event: any, tr: any) => {
            if (tr.origin === 'local') return

            setNodes(prev => {
                const map = new Map(prev.map(n => [n.id, n]))
                event.changes.keys.forEach((change: any, key: string) => {
                    if (change.action === 'delete') {
                        map.delete(key)
                    } else {
                        const val = ymap.get(key)
                        if (val) map.set(key, val)
                    }
                })
                return Array.from(map.values())
            })
        }

        ymap.observe(observer)

        const handleSync = (isSynced: boolean) => {
            if (isSynced) {
                hasSyncedRef.current = true
                if (ymap.size > 0) setNodes(Array.from(ymap.values()))
            }
        }

        if (provider.synced) {
            handleSync(true)
        } else {
            provider.on('sync', handleSync)
        }

        return () => {
            ymap.unobserve(observer)
            provider.off('sync', handleSync)
        }
    }, [ymap, provider])

    return { nodes, setNodes, ydoc, provider, ymap }
}
