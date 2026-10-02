import { Hono } from 'hono';
import { db, getDb } from '../db/index.js';
import { documents, documentShares, vaultShares } from '../db/schema.js';
import { eq, and, or, isNull, asc, desc } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireAuth, type Env } from '../middleware/auth.js';

export const documentsRouter = new Hono<Env>();

const documentSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    parentId: z.string().nullable().optional(),
    isExpanded: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    tags: z.string().optional(),
    order: z.number().int().optional(),
    status: z.enum(['active', 'deleted', 'archived']).optional(),
    type: z.enum(['text', 'canvas', 'pdf']).optional(),
    scrollPosition: z.string().optional(),
});

// Get documents filtered by status
documentsRouter.get('/', requireAuth, async (c) => {
    const status = c.req.query('status') || 'active';
    const user = c.get('user');
    const db = getDb();

    // Documents owned by user OR shared with user's email
    const allDocs = await db
        .select({
            id: documents.id,
            userId: documents.userId,
            title: documents.title,
            parentId: documents.parentId,
            status: documents.status,
            isExpanded: documents.isExpanded,
            isFavorite: documents.isFavorite,
            tags: documents.tags,
            order: documents.order,
            type: documents.type,
            scrollPosition: documents.scrollPosition,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
        })
        .from(documents)
        .leftJoin(documentShares, eq(documents.id, documentShares.documentId))
        .leftJoin(vaultShares, eq(documents.userId, vaultShares.ownerId))
        .where(
            and(
                eq(documents.status, status as any),
                or(
                    eq(documents.userId, user.id),
                    eq(documentShares.sharedWithEmail, user.email),
                    eq(vaultShares.sharedWithEmail, user.email)
                )
            )
        )
        .groupBy(documents.id) // Avoid duplicates if shared multiple ways
        .orderBy(asc(documents.order), desc(documents.updatedAt));

    return c.json(allDocs);
});

// Create a new document
documentsRouter.post('/', requireAuth, zValidator('json', documentSchema), async (c) => {
    const data = c.req.valid('json');
    const user = c.get('user');

    const [newDoc] = await db.insert(documents).values({
        userId: user.id,
        title: data.title || 'Untitled',
        content: data.content || '',
        parentId: data.parentId ?? null,
        status: 'active',
        isExpanded: true,
        type: data.type || 'text',
    }).returning();

    return c.json(newDoc, 201);
});

// Update a document
documentsRouter.patch('/:id', requireAuth, zValidator('json', documentSchema), async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const user = c.get('user');

    const [updatedDoc] = await db
        .update(documents)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
        .returning();

    if (!updatedDoc) {
        return c.json({ error: 'Document not found' }, 404);
    }

    return c.json(updatedDoc);
});

// Restore a deleted document
documentsRouter.patch('/:id/restore', requireAuth, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    const [restoredDoc] = await db
        .update(documents)
        .set({
            status: 'active',
            updatedAt: new Date(),
        })
        .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
        .returning();

    if (!restoredDoc) {
        return c.json({ error: 'Document not found' }, 404);
    }

    return c.json(restoredDoc);
});

// Soft delete a document
documentsRouter.delete('/:id', requireAuth, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    const deleteRecursive = async (docId: string) => {
        const children = await db.select({ id: documents.id }).from(documents).where(eq(documents.parentId, docId));
        await db.update(documents).set({ status: 'deleted', updatedAt: new Date() }).where(and(eq(documents.id, docId), eq(documents.userId, user.id)));
        for (const child of children) {
            await deleteRecursive(child.id);
        }
    };

    try {
        const [doc] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, id), eq(documents.userId, user.id)));
        if (!doc) {
            return c.json({ error: 'Document not found' }, 404);
        }
        await deleteRecursive(id);
        return c.json({ message: 'Document moved to trash', id });
    } catch (e) {
        return c.json({ error: 'Failed to delete' }, 500);
    }
});

// Permanently delete a document
documentsRouter.delete('/:id/permanent', requireAuth, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');

    const result = await db
        .delete(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
        .returning();

    if (result.length === 0) {
        return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({ message: 'Document permanently deleted', id });
});

// Empty trash
documentsRouter.delete('/trash/empty', requireAuth, async (c) => {
    const user = c.get('user');
    const result = await db
        .delete(documents)
        .where(
            and(
                eq(documents.userId, user.id),
                eq(documents.status, 'deleted')
            )
        )
        .returning();

    return c.json({ message: `Trash emptied, ${result.length} items removed` });
});

// Get public document for shared links (no auth required)
documentsRouter.get('/public/:id', async (c) => {
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

// Get specific document
documentsRouter.get('/:id', requireAuth, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const db = getDb();
    
    const doc = await db
        .select({
            doc: documents,
            docShare: documentShares,
            vaultShare: vaultShares
        })
        .from(documents)
        .leftJoin(documentShares, eq(documents.id, documentShares.documentId))
        .leftJoin(vaultShares, eq(documents.userId, vaultShares.ownerId))
        .where(
            and(
                eq(documents.id, id),
                or(
                    eq(documents.userId, user.id),
                    eq(documentShares.sharedWithEmail, user.email),
                    eq(vaultShares.sharedWithEmail, user.email)
                )
            )
        )
        .get();

    if (doc) return c.json(doc.doc);

    // If not directly owned or emailed, check if the active document exists for shared link viewing
    const publicDoc = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.status, 'active')))
        .get();

    if (publicDoc) {
        return c.json(publicDoc);
    }

    return c.json({ error: 'Not found' }, 404);
});

