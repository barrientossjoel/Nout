import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import YPartyKitProvider from 'y-partykit/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollabProvider, CollabSession } from './types'

interface SessionRecord {
    ydoc: Y.Doc
    provider: CollabProvider
    idb: IndexeddbPersistence
    refCount: number
    timer?: ReturnType<typeof setTimeout>
}

const registry = new Map<string, SessionRecord>()

const createProvider = (room: string, ydoc: Y.Doc): CollabProvider => {
    const pkHost = import.meta.env.VITE_PARTYKIT_HOST
    if (pkHost) {
        const host = pkHost.replace(/^https?:\/\//, '')
        return new YPartyKitProvider(host, room, ydoc)
    }
    if (import.meta.env.DEV) {
        return new WebsocketProvider(`ws://${window.location.host}/ws`, room, ydoc)
    }
    return new YPartyKitProvider(window.location.hostname, room, ydoc)
}

/**
 * Acquires a shared collaborative session for the given room identifier.
 * Uses reference counting to safely share connections and tear down when all consumers unmount.
 */
export const acquireCollabSession = (room: string): CollabSession => {
    let session = registry.get(room)

    if (!session) {
        const ydoc = new Y.Doc()
        const provider = createProvider(room, ydoc)
        const idb = new IndexeddbPersistence(room, ydoc)
        session = { ydoc, provider, idb, refCount: 0 }
        registry.set(room, session)
    }

    session.refCount++
    if (session.timer) {
        clearTimeout(session.timer)
        session.timer = undefined
    }

    const current = session

    const release = () => {
        current.refCount--
        if (current.refCount <= 0) {
            current.timer = setTimeout(() => {
                if (current.refCount <= 0) {
                    current.provider.destroy()
                    current.idb.destroy()
                    current.ydoc.destroy()
                    registry.delete(room)
                }
            }, 250)
        }
    }

    return {
        ydoc: current.ydoc,
        provider: current.provider,
        idb: current.idb,
        release,
    }
}
