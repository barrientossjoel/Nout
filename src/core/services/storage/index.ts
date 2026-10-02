import { isTauri } from '../../utils/platform';
import { TauriStorageAdapter } from './tauri-storage.adapter';
import { WebStorageAdapter } from './web-storage.adapter';
import { IDocumentStorageService } from './types';

let storageInstance: IDocumentStorageService | null = null;

export function getDocumentStorage(): IDocumentStorageService {
  if (!storageInstance) {
    if (isTauri()) {
      storageInstance = new TauriStorageAdapter();
    } else {
      storageInstance = new WebStorageAdapter();
    }
  }
  return storageInstance;
}

export const documentStorage = getDocumentStorage();
export * from './types';
