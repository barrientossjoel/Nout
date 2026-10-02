import type { Doc } from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import type YPartyKitProvider from 'y-partykit/provider'
import type { IndexeddbPersistence } from 'y-indexeddb'

export type CollabProvider = YPartyKitProvider | WebsocketProvider

export interface CollabSession {
    ydoc: Doc
    provider: CollabProvider
    idb: IndexeddbPersistence
    release: () => void
}

export interface CollaboratorUser {
    name: string
    color: string
    avatar?: string
}

export interface RemoteCursor {
    id: number
    x: number
    y: number
    user: CollaboratorUser
    lastActive: number
}

export interface CollaboratorPresence {
    id: number
    user: CollaboratorUser
    cursor?: { x: number; y: number } | null
}
