import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../../types/notes';
import type { IDocumentStorageService } from './types';
import { client, getAuthToken } from '../../../client/services/api';

// @ts-ignore - Hono RPC client
const api = client.api;

const toUpsertInput = (doc: any) => ({
  id: doc.id,
  userId: doc.userId,
  parentId: doc.parentId ?? null,
  title: doc.title || 'Sin título',
  content: doc.content ?? null,
  docType: doc.type ?? 'text',
  status: doc.status ?? 'active',
  isExpanded: Boolean(doc.isExpanded),
  isFavorite: Boolean(doc.isFavorite),
  tags: typeof doc.tags === 'string' ? doc.tags : doc.tags ? JSON.stringify(doc.tags) : null,
  order: doc.order ?? 0,
  createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
});

const mapLocalDoc = (raw: any): Document => ({
  id: raw.id,
  userId: raw.userId || 'local_guest',
  title: raw.title,
  content: raw.content ?? null,
  parentId: raw.parentId || null,
  status: raw.status || 'active',
  isExpanded: Boolean(raw.isExpanded),
  isFavorite: Boolean(raw.isFavorite),
  tags: raw.tags || null,
  order: raw.order ?? 0,
  type: raw.docType || 'text',
  createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
  updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
  date: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
});

export class TauriStorageAdapter implements IDocumentStorageService {
  private syncPromise: Promise<Document[]> | null = null;

  async getDocuments(status: 'active' | 'deleted' = 'active'): Promise<Document[]> {
    const raw = await invoke<any[]>('get_local_documents').catch(() => []);
    const local = raw
      .filter((d) => (status === 'deleted' ? d.status === 'deleted' : d.status !== 'deleted'))
      .map(mapLocalDoc);

    if (getAuthToken()) {
      if (local.length === 0) {
        const synced = await this.syncWithCloud(status).catch(() => []);
        if (synced.length > 0) return synced;
      } else {
        this.syncWithCloud(status).catch(() => {});
      }
    }
    return local;
  }

  async getDocument(id: string): Promise<Document> {
    const raw = await invoke<any>('get_local_document', { id }).catch(() => null);
    if (raw?.content !== undefined && raw?.content !== null) return mapLocalDoc(raw);

    const res = await api.documents[':id'].$get({ param: { id } }).catch(() => null);
    if (res?.ok) {
      const remote = await res.json();
      await invoke('upsert_local_documents', { documents: [toUpsertInput(remote)] });
      return mapLocalDoc({ ...remote, docType: remote.type });
    }
    if (raw) return mapLocalDoc(raw);
    throw new Error(`Failed to fetch document ${id}`);
  }

  async createDocument(data: Partial<Document>): Promise<Document> {
    const raw = await invoke<any>('create_local_document', {
      input: {
        id: data.id || null,
        parentId: data.parentId || null,
        title: data.title || 'Sin título',
        docType: data.type || 'text',
        content: data.content || null,
      },
    });
    const local = mapLocalDoc(raw);
    if (getAuthToken()) {
      api.documents.$post({ json: local }).catch(() => {});
    }
    return local;
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    const raw = await invoke<any>('update_local_document', {
      input: {
        id,
        title: data.title,
        content: data.content,
        parentId: data.parentId,
        isFavorite: data.isFavorite,
        isExpanded: data.isExpanded,
        status: data.status,
      },
    });
    const local = mapLocalDoc(raw);
    if (getAuthToken()) {
      api.documents[':id'].$patch({ param: { id }, json: data }).catch(() => {});
    }
    return local;
  }

  async deleteDocument(id: string): Promise<void> {
    await invoke('delete_local_document', { id });
    if (getAuthToken()) {
      api.documents[':id'].$delete({ param: { id } }).catch(() => {});
    }
  }

  async restoreDocument(id: string): Promise<Document> {
    const raw = await invoke<any>('update_local_document', { input: { id, status: 'active' } });
    const local = mapLocalDoc(raw);
    if (getAuthToken()) {
      api.documents[':id'].restore.$patch({ param: { id } }).catch(() => {});
    }
    return local;
  }

  async syncWithCloud(status: 'active' | 'deleted' = 'active'): Promise<Document[]> {
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = (async () => {
      try {
        const res = await api.documents.$get({ query: { status } });
        if (!res.ok) return [];

        const remoteDocs = await res.json();
        if (!Array.isArray(remoteDocs) || remoteDocs.length === 0) return [];

        const updated = await invoke<any[]>('upsert_local_documents', {
          documents: remoteDocs.map(toUpsertInput),
        });

        const mapped = updated
          .filter((d) => (status === 'deleted' ? d.status === 'deleted' : d.status !== 'deleted'))
          .map(mapLocalDoc);

        if (typeof window !== 'undefined' && mapped.length > 0) {
          window.dispatchEvent(new CustomEvent('nout:cloud_synced', { detail: mapped }));
        }
        return mapped;
      } catch (err) {
        console.warn('[TauriStorage] Sync error:', err);
        return [];
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  async saveCrdtDelta(documentId: string, delta: Uint8Array): Promise<void> {
    await invoke('save_crdt_delta', { documentId, delta: Array.from(delta) });
  }

  async getCrdtDeltas(documentId: string): Promise<Uint8Array[]> {
    const raw = await invoke<number[][]>('get_crdt_deltas', { documentId });
    return raw.map((b) => new Uint8Array(b));
  }
}
