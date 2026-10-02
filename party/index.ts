import { onConnect } from 'y-partykit';
import type * as Party from 'partykit/server';

export default class NoteAppServer implements Party.Server {
    constructor(readonly room: Party.Room) { }

    onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
        // Use official y-partykit server to manage YDoc state in memory and broadcast awareness (multiplayer cursors).
        // persist: false keeps real-time state in-memory to prevent storage conflict with canonical Turso DB.
        return onConnect(connection, this.room, {
            persist: false
        });
    }

    // Handle HTTP requests / webhooks / health checks
    onRequest(req: Party.Request) {
        return new Response(JSON.stringify({
            status: 'ok',
            room: this.room.id,
            connections: Array.from(this.room.getConnections()).length,
            timestamp: new Date().toISOString()
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
}
