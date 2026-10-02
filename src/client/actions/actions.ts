import { client } from '../services/api';
import { getDocumentStorage } from '../../core/services/storage';

// @ts-ignore
const api = client.api;

const mapItem = (item: any) => ({
    ...item,
    date: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
});

export async function getDocuments(status: 'active' | 'deleted' = 'active') {
    return getDocumentStorage().getDocuments(status);
}

export async function getDocument(id: string) {
    return getDocumentStorage().getDocument(id);
}

export async function getPublicDocument(id: string) {
    try {
        const res = await fetch(`/api/documents/public/${id}`);
        if (res.ok) {
            const data = await res.json();
            return mapItem(data);
        }
    } catch {
        // Try fallback
    }

    const resShares = await fetch(`/api/shares/public/${id}`);
    if (resShares.ok) {
        const data = await resShares.json();
        return mapItem(data);
    }

    throw new Error('Failed to fetch public document');
}

export async function createDocument(data: any) {
    return getDocumentStorage().createDocument(data);
}

export async function updateDocument(id: string, data: any) {
    return getDocumentStorage().updateDocument(id, data);
}

export async function restoreDocument(id: string) {
    return getDocumentStorage().restoreDocument(id);
}

export async function deleteDocument(id: string) {
    await getDocumentStorage().deleteDocument(id);
    return { success: true };
}

export async function permanentDeleteDocument(id: string) {
    const res = await api.documents[':id'].permanent.$delete({ param: { id } });
    if (!res.ok) throw new Error('Failed to permanently delete document');
    return await res.json();
}

export async function emptyTrash() {
    const res = await api.documents.trash.empty.$delete();
    if (!res.ok) throw new Error('Failed to empty trash');
    return await res.json();
}

export async function getTrashItems() {
    const docs = await getDocuments('deleted');
    return {
        documents: docs,
    };
}

// SHARES

export async function getDocumentShares(id: string) {
    const res = await api.shares.document[':id'].$get({ param: { id } });
    if (!res.ok) throw new Error('Failed to fetch document shares');
    return await res.json();
}

export async function createDocumentShare(id: string, data: { email: string, permission: 'view' | 'edit' }) {
    const res = await api.shares.document[':id'].$post({ param: { id }, json: data });
    if (!res.ok) throw new Error('Failed to share document');
    return await res.json();
}

export async function deleteDocumentShare(shareId: string) {
    const res = await api.shares.document[':shareId'].$delete({ param: { shareId } });
    if (!res.ok) throw new Error('Failed to remove share');
    return await res.json();
}

export async function getVaultShares() {
    const res = await api.shares.vault.$get();
    if (!res.ok) throw new Error('Failed to fetch vault shares');
    return await res.json();
}

export async function createVaultShare(data: { email: string, permission: 'view' | 'edit' }) {
    const res = await api.shares.vault.$post({ json: data });
    if (!res.ok) throw new Error('Failed to share vault');
    return await res.json();
}

export async function deleteVaultShare(shareId: string) {
    const res = await api.shares.vault[':shareId'].$delete({ param: { shareId } });
    if (!res.ok) throw new Error('Failed to remove vault share');
    return await res.json();
}
