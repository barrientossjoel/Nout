import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '../../core/types/notes';
import { getMessages, createMessage, updateMessage, deleteMessage } from '../actions/actions';

export function useMessages(documentId?: string | null, onMessageSent?: () => void) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getMessages(documentId);
            setMessages(prev => [...data, ...prev.filter(m => m.id.startsWith('temp-'))]);
            onMessageSent?.();
        } finally {
            setIsLoading(false);
        }
    }, [documentId, onMessageSent]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const send = useCallback(async (content: string, type: 'text' | 'audio' = 'text') => {
        const text = content.trim();
        if (!text) return;

        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, { id: tempId, content: text, type, documentId, createdAt: new Date().toISOString() }]);
        onMessageSent?.();

        try {
            const saved = await createMessage({ content: text, type, documentId });
            setMessages(prev => prev.map(m => (m.id === tempId ? saved : m)));
        } catch {
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    }, [documentId, onMessageSent]);

    const edit = useCallback(async (id: string, content: string) => {
        const text = content.trim();
        if (!text) return;
        setMessages(prev => prev.map(m => (m.id === id ? { ...m, content: text } : m)));
        await updateMessage(id, text).catch(() => refresh());
    }, [refresh]);

    const remove = useCallback(async (id: string) => {
        setMessages(prev => prev.filter(m => m.id !== id));
        await deleteMessage(id).catch(() => refresh());
    }, [refresh]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => send(reader.result as string, 'audio');
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            recorderRef.current = mediaRecorder;
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch (e) {
            console.error('Recording error', e);
        }
    }, [send]);

    const stopRecording = useCallback(() => {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    return {
        messages,
        isLoading,
        sendMessage: send,
        editMessage: edit,
        deleteMessage: remove,
        isRecording,
        recordingTime,
        startRecording,
        stopRecording,
    };
}
