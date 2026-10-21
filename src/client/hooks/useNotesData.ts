import { useState, useEffect, useCallback, useRef } from 'react';
import { getDocuments, getTrashItems, getDocument } from '../actions/actions';
import { getDocumentStorage } from '../../core/services/storage';
import { type Document } from '../../core/types/notes';
import { useAuth } from '../context/AuthContext';

export function useNotesData() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [trashItems, setTrashItems] = useState<{ documents: Document[] }>({ documents: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const fetchedDocuments = await getDocuments();

      setDocuments(prevDocs => {
        return fetchedDocuments.map((fetchedDoc: Document) => {
          const existingDoc = prevDocs.find(d => d.id === fetchedDoc.id);
          if (existingDoc && existingDoc.content !== undefined) {
            return { ...fetchedDoc, content: existingDoc.content };
          }
          return fetchedDoc;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (user) {
      const storage = getDocumentStorage();
      if ('syncWithCloud' in storage && typeof (storage as any).syncWithCloud === 'function') {
        (storage as any).syncWithCloud('active').then(() => {
          fetchData();
        }).catch((e: unknown) => {
          console.warn('Silent auto-sync note:', e);
        });
      }
    }
  }, [user, fetchData]);

  useEffect(() => {
    // Auto-refresh when window regains focus, app becomes visible, or notes sync event fires
    const handleSync = async () => {
      try {
        const storage = getDocumentStorage();
        if ('syncWithCloud' in storage && typeof (storage as any).syncWithCloud === 'function') {
          await (storage as any).syncWithCloud('active');
        }
      } catch (e) {
        console.warn('Sync trigger failed:', e);
      }
      fetchData();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleSync();
      }
    };
    const handleCloudSynced = (e: Event) => {
      const customEvent = e as CustomEvent<Document[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setDocuments(prevDocs => {
          return customEvent.detail.map((incomingDoc: Document) => {
            const existingDoc = prevDocs.find(d => d.id === incomingDoc.id);
            if (existingDoc && existingDoc.content !== undefined) {
              return { ...incomingDoc, content: existingDoc.content };
            }
            return incomingDoc;
          });
        });
      } else {
        fetchData();
      }
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('nout:sync_notes', handleSync);
    window.addEventListener('nout:cloud_synced', handleCloudSynced);
    
    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('nout:sync_notes', handleSync);
      window.removeEventListener('nout:cloud_synced', handleCloudSynced);
    };
  }, [fetchData]);

  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  // Background Prefetcher
  useEffect(() => {
    if (isLoading || documents.length === 0) return;

    let isCancelled = false;

    const fetchNext = async () => {
      if (isCancelled) return;

      // Look for a document that doesn't have content loaded yet
      const docToFetch = documentsRef.current.find(d => d.content === undefined);
      if (!docToFetch) {
        return; // All documents hold content payload now
      }

      try {
        const fullDoc = await getDocument(docToFetch.id);
        if (!isCancelled) {
          setDocuments(prev => prev.map(d => d.id === docToFetch.id ? { ...d, content: fullDoc.content || '' } : d));
        }
      } catch (err) {
        console.error("Background prefetch failed for", docToFetch.id, err);
      }

      // Queue next
      if (!isCancelled) {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(fetchNext, { timeout: 2000 });
        } else {
          setTimeout(fetchNext, 1000);
        }
      }
    };

    // Initially start the loop
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(fetchNext, { timeout: 2000 });
    } else {
      setTimeout(fetchNext, 1000);
    }

    return () => {
      isCancelled = true;
    };
  }, [isLoading, documents.length]);

  return {
    documents,
    setDocuments,
    trashItems,
    setTrashItems,
    isLoading,
    error,
    refresh: fetchData
  };
}