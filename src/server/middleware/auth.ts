import { getCookie } from 'hono/cookie';
import { getDb } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';

// Define the type of our Hono context to include the user object
export type Env = {
    Variables: {
        user: typeof users.$inferSelect;
    }
}

export async function requireAuth(c: Context<Env>, next: Next) {
    const authHeader = c.req.header('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const sessionId = bearerToken || getCookie(c, 'auth_session');

    if (!sessionId) {
        return c.json({ error: 'Unauthorized', message: 'No active session found' }, 401);
    }

    const db = getDb();
    const result = await db.select({ user: users, session: sessions })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId))
        .get();

    if (!result || result.session.expiresAt.getTime() < Date.now()) {
        return c.json({ error: 'Unauthorized', message: 'Session expired or invalid' }, 401);
    }

    // Pass the safe user info downstream
    c.set('user', result.user);

    await next();
}
