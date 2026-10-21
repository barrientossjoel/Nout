import { invoke } from '@tauri-apps/api/core';
import { Document } from '../../types/notes';
import { IDocumentStorageService } from './types';
import { getApiUrl, getAuthHeaders, getAuthToken, ensureAuthToken } from '../../../client/services/api';

interface RawLocalDoc {
  id: string;
  userId?: string;
  title: string;
  content?: string | null;
  parentId?: string | null;
  status?: 'active' | 'deleted' | 'archived';
  isExpanded?: boolean;
  isFavorite?: boolean;
  tags?: string | null;
  order?: number;
  docType?: 'text' | 'canvas' | 'pdf' | 'epub';
  createdAt?: number | string;
  updatedAt?: number | string;
}

export class TauriStorageAdapter implements IDocumentStorageService {
  private syncPromise: Promise<Document[]> | null = null;

  async getDocuments(status: 'active' | 'deleted' = 'active'): Promise<Document[]> {
    let localDocs: Document[] = [];
    try {
      const raw = await invoke<RawLocalDoc[]>('get_local_documents');
      localDocs = raw
        .filter((d) => (status === 'deleted' ? d.status === 'deleted' : d.status !== 'deleted'))
        .map(this.mapLocalDoc);
    } catch (err) {
      console.warn('[TauriStorage] Error reading local documents:', err);
    }

    const token = await ensureAuthToken();
    const hasSavedUser = typeof window !== 'undefined' && Boolean(localStorage.getItem('nout_cloud_user'));
    const isAuthenticated = Boolean(token || hasSavedUser);

    if (isAuthenticated) {
      if (localDocs.length === 0) {
        // Initial load: await cloud sync so notes appear immediately
        try {
          const syncedDocs = await this.syncWithCloud(status);
          if (syncedDocs.length > 0) {
            return syncedDocs;
          }
        } catch (err) {
          console.warn('[TauriStorage] Cloud sync failed on initial fetch:', err);
        }
      } else {
        // Background sync to ensure offline availability stays fresh
        this.syncWithCloud(status).catch((err) => {
          console.warn('[TauriStorage] Background cloud sync error:', err);
        });
      }
    }

    return localDocs;
  }

  async getDocument(id: string): Promise<Document> {
    try {
      const raw = await invoke<RawLocalDoc>('get_local_document', { id });
      const doc = this.mapLocalDoc(raw);
      if (doc.content !== undefined && doc.content !== null) {
        return doc;
      }
    } catch {
      // Document might not be stored locally yet
    }

    const token = getAuthToken();
    const headers = getAuthHeaders();

    try {
      const res = await fetch(getApiUrl(`/api/documents/${id}`), {
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const remoteDoc = await res.json();
        await invoke('upsert_local_documents', {
          documents: [{
            id: remoteDoc.id,
            userId: remoteDoc.userId,
            parentId: remoteDoc.parentId ?? null,
            title: remoteDoc.title,
            content: remoteDoc.content ?? '',
            docType: remoteDoc.type ?? 'text',
            status: remoteDoc.status ?? 'active',
            isExpanded: Boolean(remoteDoc.isExpanded),
            isFavorite: Boolean(remoteDoc.isFavorite),
            tags: remoteDoc.tags ?? null,
            order: remoteDoc.order ?? 0,
            createdAt: remoteDoc.createdAt ? new Date(remoteDoc.createdAt).getTime() : Date.now(),
            updatedAt: remoteDoc.updatedAt ? new Date(remoteDoc.updatedAt).getTime() : Date.now(),
          }],
        });

        return this.mapLocalDoc({
          ...remoteDoc,
          docType: remoteDoc.type,
        });
      }
    } catch (err) {
      console.warn(`[TauriStorage] Failed to fetch remote document ${id}:`, err);
    }

    throw new Error(`Failed to fetch document ${id}`);
  }

  async createDocument(data: Partial<Document>): Promise<Document> {
    const raw = await invoke<RawLocalDoc>('create_local_document', {
      input: {
        id: data.id || null,
        parentId: data.parentId || null,
        title: data.title || 'Sin título',
        docType: data.type || 'text',
        content: data.content || null,
      },
    });

    const localDoc = this.mapLocalDoc(raw);

    const token = getAuthToken();
    if (token) {
      fetch(getApiUrl('/api/documents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          id: localDoc.id,
          title: localDoc.title,
          content: localDoc.content,
          parentId: localDoc.parentId,
          type: localDoc.type,
          status: localDoc.status,
        }),
      }).catch((err) => console.warn('[TauriStorage] Failed to sync created document to cloud:', err));
    }

    return localDoc;
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    const raw = await invoke<RawLocalDoc>('update_local_document', {
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

    const localDoc = this.mapLocalDoc(raw);

    const token = getAuthToken();
    if (token) {
      fetch(getApiUrl(`/api/documents/${id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(data),
      }).catch((err) => console.warn(`[TauriStorage] Failed to sync updated document ${id} to cloud:`, err));
    }

    return localDoc;
  }

  async deleteDocument(id: string): Promise<void> {
    await invoke('delete_local_document', { id });

    const token = getAuthToken();
    if (token) {
      fetch(getApiUrl(`/api/documents/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch((err) => console.warn(`[TauriStorage] Failed to sync deleted document ${id} to cloud:`, err));
    }
  }

  async restoreDocument(id: string): Promise<Document> {
    const raw = await invoke<RawLocalDoc>('update_local_document', {
      input: {
        id,
        status: 'active',
      },
    });

    const localDoc = this.mapLocalDoc(raw);

    const token = getAuthToken();
    if (token) {
      fetch(getApiUrl(`/api/documents/${id}/restore`), {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      }).catch((err) => console.warn(`[TauriStorage] Failed to sync restored document ${id} to cloud:`, err));
    }

    return localDoc;
  }

  async syncWithCloud(status: 'active' | 'deleted' = 'active'): Promise<Document[]> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      try {
        await ensureAuthToken();
        const headers = {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        };

        const res = await fetch(getApiUrl(`/api/documents?status=${status}`), {
          headers,
          credentials: 'include',
        });

        if (!res.ok) {
          console.warn(`[TauriStorage] Cloud sync fetch failed with status ${res.status}`);
          return [];
        }

        const remoteDocs = await res.json();
        if (!Array.isArray(remoteDocs) || remoteDocs.length === 0) {
          return [];
        }

        const upsertInputs = remoteDocs.map((doc: any) => ({
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
        }));

        const rawUpdated = await invoke<RawLocalDoc[]>('upsert_local_documents', {
          documents: upsertInputs,
        });

        const mapped = rawUpdated
          .filter((d) => (status === 'deleted' ? d.status === 'deleted' : d.status !== 'deleted'))
          .map(this.mapLocalDoc);

        if (typeof window !== 'undefined' && mapped.length > 0) {
          window.dispatchEvent(new CustomEvent('nout:cloud_synced', { detail: mapped }));
        }

        return mapped;
      } catch (err) {
        console.warn('[TauriStorage] Cloud sync error:', err);
        return [];
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  async saveCrdtDelta(documentId: string, delta: Uint8Array): Promise<void> {
    await invoke('save_crdt_delta', {
      documentId,
      delta: Array.from(delta),
    });
  }

  async getCrdtDeltas(documentId: string): Promise<Uint8Array[]> {
    const raw = await invoke<number[][]>('get_crdt_deltas', { documentId });
    return raw.map((bytes) => new Uint8Array(bytes));
  }

  private mapLocalDoc = (raw: RawLocalDoc): Document => {
    return {
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
    };
  };
}

