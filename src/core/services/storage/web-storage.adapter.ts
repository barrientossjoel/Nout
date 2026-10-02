import { client } from '../../../client/services/api';
import { Document } from '../../types/notes';
import { IDocumentStorageService } from './types';

// @ts-ignore
const api = client.api;

const mapItem = (item: any): Document => ({
  ...item,
  date: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
});

export class WebStorageAdapter implements IDocumentStorageService {
  async getDocuments(status: 'active' | 'deleted' = 'active'): Promise<Document[]> {
    const res = await api.documents.$get({ query: { status } });
    if (!res.ok) {
      throw new Error(`Failed to fetch documents: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data.map(mapItem) : [];
  }

  async getDocument(id: string): Promise<Document> {
    try {
      const res = await api.documents[':id'].$get({ param: { id } });
      if (res.ok) {
        return mapItem(await res.json());
      }
    } catch {
      // Proceed to fallback
    }

    // Fallback to public document endpoint
    try {
      const resPublic = await fetch(`/api/documents/public/${id}`);
      if (resPublic.ok) {
        return mapItem(await resPublic.json());
      }
    } catch {
      // ignore
    }

    throw new Error('Failed to fetch document');
  }

  async createDocument(data: Partial<Document>): Promise<Document> {
    const res = await api.documents.$post({ json: data });
    if (!res.ok) throw new Error('Failed to create document');
    return mapItem(await res.json());
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    const res = await api.documents[':id'].$patch({ param: { id }, json: data });
    if (!res.ok) throw new Error('Failed to update document');
    return mapItem(await res.json());
  }

  async deleteDocument(id: string): Promise<void> {
    const res = await api.documents[':id'].$delete({ param: { id } });
    if (!res.ok) throw new Error('Failed to delete document');
  }

  async restoreDocument(id: string): Promise<Document> {
    const res = await api.documents[':id'].restore.$patch({ param: { id } });
    if (!res.ok) throw new Error('Failed to restore document');
    return mapItem(await res.json());
  }

  async saveCrdtDelta(_documentId: string, _delta: Uint8Array): Promise<void> {
    // En la versión web tradicional, PartyKit/Yjs gestiona el streaming en memoria
  }

  async getCrdtDeltas(_documentId: string): Promise<Uint8Array[]> {
    return [];
  }
}
