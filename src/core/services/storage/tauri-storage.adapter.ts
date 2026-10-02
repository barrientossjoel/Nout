import { invoke } from '@tauri-apps/api/core';
import { Document } from '../../types/notes';
import { IDocumentStorageService } from './types';

export class TauriStorageAdapter implements IDocumentStorageService {
  async getDocuments(status: 'active' | 'deleted' = 'active'): Promise<Document[]> {
    const raw = await invoke<any[]>('get_local_documents');
    return raw
      .filter((d) => (status === 'deleted' ? d.status === 'deleted' : d.status !== 'deleted'))
      .map(this.mapLocalDoc);
  }

  async getDocument(id: string): Promise<Document> {
    const raw = await invoke<any>('get_local_document', { id });
    return this.mapLocalDoc(raw);
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
    return this.mapLocalDoc(raw);
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
    return this.mapLocalDoc(raw);
  }

  async deleteDocument(id: string): Promise<void> {
    await invoke('delete_local_document', { id });
  }

  async restoreDocument(id: string): Promise<Document> {
    const raw = await invoke<any>('update_local_document', {
      input: {
        id,
        status: 'active',
      },
    });
    return this.mapLocalDoc(raw);
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

  private mapLocalDoc(raw: any): Document {
    return {
      id: raw.id,
      userId: raw.userId || 'local_guest',
      title: raw.title,
      content: raw.content,
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
  }
}
