import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import bcrypt from 'bcryptjs';

export const SESSION_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 30;

export class AuthService {
    static generateSessionId() {
        return crypto.randomUUID();
    }

    static async createSession(userId: string) {
        const sessionId = this.generateSessionId();
        const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);
        await getDb().insert(sessions).values({
            id: sessionId,
            userId,
            expiresAt
        });
        return { sessionId, expiresAt };
    }

    static async createSessionWithId(sessionId: string, userId: string) {
        const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);
        await getDb().insert(sessions).values({
            id: sessionId,
            userId,
            expiresAt
        }).onConflictDoUpdate({
            target: sessions.id,
            set: { userId, expiresAt }
        });
        return { sessionId, expiresAt };
    }

    static async deleteSession(sessionId: string) {
        await getDb().delete(sessions).where(eq(sessions.id, sessionId));
    }

    static async validateSession(sessionId: string) {
        const result = await getDb().select({ user: users, session: sessions })
            .from(sessions)
            .innerJoin(users, eq(sessions.userId, users.id))
            .where(eq(sessions.id, sessionId))
            .get();

        if (!result || result.session.expiresAt.getTime() < Date.now()) {
            return null;
        }

        const { passwordHash, googleId, ...safeUser } = result.user;
        return safeUser;
    }

    static async registerUser(email: string, passwordPlain: string, name: string) {
        const passwordHash = await bcrypt.hash(passwordPlain, 10);
        const [newUser] = await getDb().insert(users).values({
            email,
            passwordHash,
            name
        }).returning();
        return newUser;
    }

    static async getUserByEmail(email: string) {
        return await getDb().select().from(users).where(eq(users.email, email)).get();
    }
    
    static async getUserByGoogleId(googleId: string) {
        return await getDb().select().from(users).where(eq(users.googleId, googleId)).get();
    }

    static async linkGoogleAccount(userId: string, googleId: string, avatarUrl: string) {
        await getDb().update(users).set({ googleId, avatarUrl }).where(eq(users.id, userId));
    }

    static async createGoogleUser(email: string, name: string, googleId: string, avatarUrl: string) {
        const [newUser] = await getDb().insert(users).values({
            email,
            name,
            googleId,
            avatarUrl
        }).returning();
        return newUser;
    }
}
