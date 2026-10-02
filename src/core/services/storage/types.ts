import { Document } from '../../types/notes';

export interface IDocumentStorageService {
  getDocuments(status?: 'active' | 'deleted'): Promise<Document[]>;
  getDocument(id: string): Promise<Document>;
  createDocument(data: Partial<Document>): Promise<Document>;
  updateDocument(id: string, data: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<Document>;
  saveCrdtDelta(documentId: string, delta: Uint8Array): Promise<void>;
  getCrdtDeltas(documentId: string): Promise<Uint8Array[]>;
}
