import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '../../core/types/notes';
import { messagesService, type IMessagesService } from '../../core/services/messages.service';

export interface UseMessagesOptions {
    documentId?: string | null;
    service?: IMessagesService;
    onMessageSent?: () => void;
}

export interface UseMessagesReturn {
    messages: Message[];
    isLoading: boolean;
    error: Error | null;
    refreshMessages: () => Promise<void>;
    sendMessage: (content: string, type?: 'text' | 'audio') => Promise<void>;
    editMessage: (id: string, content: string) => Promise<void>;
    deleteMessage: (id: string) => Promise<void>;
    isRecording: boolean;
    recordingTime: number;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
}

export function useMessages({
    documentId,
    service = messagesService,
    onMessageSent,
}: UseMessagesOptions = {}): UseMessagesReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refreshMessages = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await service.getMessages(documentId);
            setMessages(prev => {
                const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
                return [...data, ...tempMessages];
            });
            onMessageSent?.();
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error('Failed to load messages');
            setError(errorObj);
            console.error('Failed to fetch messages:', errorObj);
        } finally {
            setIsLoading(false);
        }
    }, [documentId, service, onMessageSent]);

    useEffect(() => {
        refreshMessages();
    }, [refreshMessages]);

    const sendMessage = useCallback(
        async (content: string, type: 'text' | 'audio' = 'text') => {
            const trimmed = content.trim();
            if (!trimmed) return;

            const tempId = `temp-${Date.now()}`;
            const optimisticMessage: Message = {
                id: tempId,
                content: trimmed,
                type,
                documentId: documentId ?? null,
                createdAt: new Date().toISOString(),
            };

            setMessages(prev => [...prev, optimisticMessage]);
            onMessageSent?.();

            try {
                const saved = await service.createMessage({
                    content: trimmed,
                    type,
                    documentId,
                });
                setMessages(prev => prev.map(m => (m.id === tempId ? saved : m)));
            } catch (err) {
                console.error('Error creating message:', err);
                // Rollback optimistic message on failure
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        },
        [documentId, service, onMessageSent]
    );

    const editMessage = useCallback(
        async (id: string, content: string) => {
            const trimmed = content.trim();
            if (!trimmed) return;

            const previousMessages = [...messages];
            setMessages(prev => prev.map(m => (m.id === id ? { ...m, content: trimmed } : m)));

            try {
                await service.updateMessage(id, { content: trimmed });
            } catch (err) {
                console.error('Error editing message:', err);
                setMessages(previousMessages);
            }
        },
        [messages, service]
    );

    const deleteMessage = useCallback(
        async (id: string) => {
            const previousMessages = [...messages];
            setMessages(prev => prev.filter(m => m.id !== id));

            try {
                await service.deleteMessage(id);
            } catch (err) {
                console.error('Error deleting message:', err);
                setMessages(previousMessages);
            }
        },
        [messages, service]
    );

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];

            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    sendMessage(base64data, 'audio');
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            recorderRef.current = mediaRecorder;
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start audio recording:', err);
        }
    }, [sendMessage]);

    const stopRecording = useCallback(() => {
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current = null;
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    return {
        messages,
        isLoading,
        error,
        refreshMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        isRecording,
        recordingTime,
        startRecording,
        stopRecording,
    };
}
