import { Hono } from 'hono';
import { getDb } from '../db/index.js';
import { documentShares, vaultShares, documents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireAuth, type Env } from '../middleware/auth.js';

export const sharesRouter = new Hono<Env>();

const shareSchema = z.object({
    email: z.string().email(),
    permission: z.enum(['view', 'edit']).default('view'),
});

// DOCUMENT SHARES

// Get public document for shared links (no auth required)
sharesRouter.get('/public/:id', async (c) => {
    const id = c.req.param('id');
    const db = getDb();

    const doc = await db
        .select({
            id: documents.id,
            userId: documents.userId,
            title: documents.title,
            content: documents.content,
            type: documents.type,
            status: documents.status,
            tags: documents.tags,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(
            and(
                eq(documents.id, id),
                eq(documents.status, 'active')
            )
        )
        .get();

    if (!doc) {
        return c.json({ error: 'Document not found' }, 404);
    }

    return c.json(doc);
});

// Get all shares for a document
sharesRouter.get('/document/:id', requireAuth, async (c) => {
    const documentId = c.req.param('id');
    const user = c.get('user');
    const db = getDb();

    // Verify ownership
    const doc = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, user.id))).get();
    if (!doc) {
        return c.json({ error: 'Document not found or unauthorized' }, 404);
    }

    const shares = await db.select().from(documentShares).where(eq(documentShares.documentId, documentId)).all();
    return c.json(shares);
});

// Create a new share for a document
sharesRouter.post('/document/:id', requireAuth, zValidator('json', shareSchema), async (c) => {
    const documentId = c.req.param('id');
    const { email, permission } = c.req.valid('json');
    const user = c.get('user');
    const db = getDb();

    // Verify ownership
    const doc = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, user.id))).get();
    if (!doc) {
        return c.json({ error: 'Document not found or unauthorized' }, 404);
    }

    const [newShare] = await db.insert(documentShares).values({
        documentId,
        sharedWithEmail: email,
        permission,
    }).returning();

    return c.json(newShare, 201);
});

// Delete a document share
sharesRouter.delete('/document/:shareId', requireAuth, async (c) => {
    const shareId = c.req.param('shareId');
    const user = c.get('user');
    const db = getDb();

    // Verify the share exists and the user owns the document
    const share = await db.select({
        share: documentShares,
        doc: documents
    })
    .from(documentShares)
    .innerJoin(documents, eq(documentShares.documentId, documents.id))
    .where(and(eq(documentShares.id, shareId), eq(documents.userId, user.id)))
    .get();

    if (!share) {
        return c.json({ error: 'Share not found or unauthorized' }, 404);
    }

    await db.delete(documentShares).where(eq(documentShares.id, shareId));
    return c.json({ message: 'Share removed' });
});

// VAULT SHARES

// Get all vault shares
sharesRouter.get('/vault', requireAuth, async (c) => {
    const user = c.get('user');
    const db = getDb();

    const shares = await db.select().from(vaultShares).where(eq(vaultShares.ownerId, user.id)).all();
    return c.json(shares);
});

// Create a new vault share
sharesRouter.post('/vault', requireAuth, zValidator('json', shareSchema), async (c) => {
    const { email, permission } = c.req.valid('json');
    const user = c.get('user');
    const db = getDb();

    const [newShare] = await db.insert(vaultShares).values({
        ownerId: user.id,
        sharedWithEmail: email,
        permission,
    }).returning();

    return c.json(newShare, 201);
});

// Delete a vault share
sharesRouter.delete('/vault/:shareId', requireAuth, async (c) => {
    const shareId = c.req.param('shareId');
    const user = c.get('user');
    const db = getDb();

    const result = await db.delete(vaultShares).where(and(eq(vaultShares.id, shareId), eq(vaultShares.ownerId, user.id))).returning();

    if (result.length === 0) {
        return c.json({ error: 'Vault share not found' }, 404);
    }

    return c.json({ message: 'Vault share removed' });
});
