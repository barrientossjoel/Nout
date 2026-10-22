import type { Message } from '../types/notes';
import { getApiUrl, getAuthHeaders, ensureAuthToken } from '../../client/services/api';

export interface CreateMessageDto {
    content: string;
    type?: 'text' | 'audio';
    documentId?: string | null;
}

export interface UpdateMessageDto {
    content: string;
}

export interface IMessagesService {
    getMessages(documentId?: string | null): Promise<Message[]>;
    createMessage(dto: CreateMessageDto): Promise<Message>;
    updateMessage(id: string, dto: UpdateMessageDto): Promise<Message>;
    deleteMessage(id: string): Promise<void>;
}

export class MessagesService implements IMessagesService {
    async getMessages(documentId?: string | null): Promise<Message[]> {
        await ensureAuthToken();
        const query = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
        const res = await fetch(getApiUrl(`/api/messages${query}`), {
            headers: { ...getAuthHeaders() },
            credentials: 'include',
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch messages: ${res.statusText}`);
        }

        return (await res.json()) as Message[];
    }

    async createMessage(dto: CreateMessageDto): Promise<Message> {
        await ensureAuthToken();
        const res = await fetch(getApiUrl('/api/messages'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            credentials: 'include',
            body: JSON.stringify(dto),
        });

        if (!res.ok) {
            throw new Error(`Failed to create message: ${res.statusText}`);
        }

        return (await res.json()) as Message;
    }

    async updateMessage(id: string, dto: UpdateMessageDto): Promise<Message> {
        await ensureAuthToken();
        const res = await fetch(getApiUrl(`/api/messages/${encodeURIComponent(id)}`), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            credentials: 'include',
            body: JSON.stringify(dto),
        });

        if (!res.ok) {
            throw new Error(`Failed to update message: ${res.statusText}`);
        }

        return (await res.json()) as Message;
    }

    async deleteMessage(id: string): Promise<void> {
        await ensureAuthToken();
        const res = await fetch(getApiUrl(`/api/messages/${encodeURIComponent(id)}`), {
            method: 'DELETE',
            headers: { ...getAuthHeaders() },
            credentials: 'include',
        });

        if (!res.ok) {
            throw new Error(`Failed to delete message: ${res.statusText}`);
        }
    }
}

export const messagesService = new MessagesService();
