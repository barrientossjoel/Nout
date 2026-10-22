'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Maximize2, MoreHorizontal, Copy, Trash2, Pencil, Check, X, Mic, Square, ChevronRight, Highlighter } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils/utils';
import type { Message, Document } from '../../../../core/types/notes';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { FileText } from 'lucide-react';
import { useMessages } from '../../../hooks/useMessages';

interface NotesPanelProps {
    documentId?: string | null;
    title?: string;
    className?: string;
    onOpenAsTab?: () => void;
    onClose?: () => void;
    documents?: Document[];
    onNavigate?: (id: string) => void;
    onHighlightClick?: (ref: string) => void;
}

interface AddNoteContentDetail {
    documentId?: string;
    content: string;
    autoSend?: boolean;
}

export function NotesPanel({ documentId, title, className, onOpenAsTab, onClose, documents = [], onNavigate, onHighlightClick }: NotesPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = React.useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    const {
        messages,
        isLoading,
        sendMessage,
        editMessage,
        deleteMessage,
        isRecording,
        recordingTime,
        startRecording,
        stopRecording,
    } = useMessages({
        documentId,
        onMessageSent: scrollToBottom,
    });

    const [newMessage, setNewMessage] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    // Mention state
    const [mentionFilter, setMentionFilter] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        const handleAddContent = (e: Event) => {
            const customEvent = e as CustomEvent<AddNoteContentDetail>;
            const { documentId: msgDocId, content, autoSend } = customEvent.detail ?? {};

            // Only process if the event is for THIS document
            if (msgDocId && msgDocId !== documentId) return;

            if (autoSend) {
                void sendMessage(content);
            } else {
                setNewMessage(content);
            }
        };

        window.addEventListener('add-note-content', handleAddContent);
        return () => window.removeEventListener('add-note-content', handleAddContent);
    }, [documentId, sendMessage]);

    const handleSendMessage = React.useCallback(async (e?: React.FormEvent, content?: string, type: 'text' | 'audio' = 'text') => {
        if (e) e.preventDefault();
        const msgContent = content || newMessage;
        if (!msgContent.trim()) return;

        if (!content) setNewMessage('');
        await sendMessage(msgContent, type);
    }, [newMessage, sendMessage]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCopy = React.useCallback((content: string) => {
        navigator.clipboard.writeText(content);
    }, []);

    const handleStartEdit = React.useCallback((msg: Message) => {
        setEditingId(msg.id);
        setEditContent(msg.content);
    }, []);

    const handleSaveEdit = React.useCallback(async (msg: Message) => {
        if (!editContent.trim() || editContent === msg.content) {
            setEditingId(null);
            return;
        }

        const nextContent = editContent;
        setEditingId(null);
        await editMessage(msg.id, nextContent);
    }, [editContent, editMessage]);

    const handleDelete = React.useCallback(async (id: string) => {
        await deleteMessage(id);
    }, [deleteMessage]);

    const filteredDocs = React.useMemo(() => {
        return documents.filter(doc =>
            doc.title?.toLowerCase().includes(mentionFilter?.toLowerCase() || '')
        ).slice(0, 5);
    }, [documents, mentionFilter]);

    const handleSelectMention = React.useCallback((doc: Document) => {
        const input = inputRef.current;
        if (!input) return;

        const cursor = input.selectionStart ?? newMessage.length;
        const textUpToCursor = newMessage.substring(0, cursor);
        const lastAtIndex = textUpToCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const before = newMessage.substring(0, lastAtIndex);
            const after = newMessage.substring(cursor);
            const mention = `[@${doc.title}](${doc.id})`;
            const next = before + mention + after;
            setNewMessage(next);
            setMentionFilter(null);
            setTimeout(() => {
                input.focus();
                const newPos = lastAtIndex + mention.length;
                input.setSelectionRange(newPos, newPos);
            }, 0);
        }
    }, [newMessage]);

    const renderContent = (content: string) => {
        // Regex to find [@DocName](docId)
        const regex = /\[@([^\]]+)\]\(([^)]+)\)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Push text before match
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }
            // Push link
            const docTitle = match[1];
            const id = match[2];
            parts.push(
                <span
                    key={match.index}
                    className="text-primary hover:underline cursor-pointer font-medium"
                    onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.(id);
                    }}
                >
                    {docTitle}
                </span>
            );
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        // Handle [Highlight: "text"](@ref)
        const highlightRegex = /\[Highlight: "([^"]+)"\]\(([^)]+)\)/g;
        const renderedParts: React.ReactNode[] = [];
        lastIndex = 0;

        // We need to process parts again or differently. 
        // Simplest: if it's a string part, check for highlights.
        return parts.map((part, i) => {
            if (typeof part !== 'string') return part;

            const subParts: React.ReactNode[] = [];
            let subLastIndex = 0;
            let subMatch;

            while ((subMatch = highlightRegex.exec(part)) !== null) {
                if (subMatch.index > subLastIndex) {
                    subParts.push(part.substring(subLastIndex, subMatch.index));
                }
                const text = subMatch[1];
                const ref = subMatch[2].startsWith('@') ? subMatch[2].substring(1) : subMatch[2];
                subParts.push(
                    <div
                        key={subMatch.index}
                        className="my-1 p-2 bg-primary/5 border-l-2 border-primary cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => onHighlightClick?.(ref)}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                            <Highlighter className="h-3 w-3" />
                            {ref.startsWith('page:') ? `Page ${ref.split(':')[1]}` :
                                ref.startsWith('chapter:') ? `Chapter ${parseInt(ref.split(':')[1]) + 1}` : 'Ref'}
                        </div>
                        <div className="italic text-foreground/90 font-medium">"{text}"</div>
                    </div>
                );
                subLastIndex = highlightRegex.lastIndex;
            }
            if (subLastIndex < part.length) {
                subParts.push(part.substring(subLastIndex));
            }
            return subParts.length > 0 ? <React.Fragment key={i}>{subParts}</React.Fragment> : part;
        });
    };

    return (
        <div className={cn("flex flex-col h-full bg-black/10 backdrop-blur-md border-l border-border/30", className)}>
            <div className="flex items-center justify-between p-4 bg-muted/5 border-t border-border/40">
                <div className="flex items-center gap-2">
                    {onClose && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Minimize">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                    <h2 className="font-semibold text-sm truncate max-w-[150px]">
                        {title || (documentId ? 'Document Notes' : 'Global Notes')}
                    </h2>
                </div>
                {onOpenAsTab && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenAsTab} title="Open as Tab">
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-muted-foreground text-sm mt-10">
                        No notes yet. Start typing...
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-1 items-start group relative">
                        <div className="flex items-start gap-2 w-full max-w-[95%]">
                            <div className={cn(
                                "bg-secondary/50 text-secondary-foreground rounded-lg px-3 py-2 text-sm break-words flex-1 min-w-0",
                                (msg as any).type === 'audio' && "bg-primary/10 border border-primary/20"
                            )}>
                                {editingId === msg.id ? (
                                    <div className="flex flex-col gap-2">
                                        <Input
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="bg-background/50 h-8 text-sm"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit(msg);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => handleSaveEdit(msg)}>
                                                <Check className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (msg as any).type === 'audio' ? (
                                    <div className="flex flex-col gap-2 py-1">
                                        <audio src={msg.content} controls className="h-8 w-full max-w-[200px]" />
                                    </div>
                                ) : (
                                    renderContent(msg.content)
                                )}
                            </div>
                            {editingId !== msg.id && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {(msg as any).type !== 'audio' && (
                                                <DropdownMenuItem onClick={() => handleCopy(msg.content)}>
                                                    <Copy className="h-3.5 w-3.5 mr-2" />
                                                    Copy
                                                </DropdownMenuItem>
                                            )}
                                            {(msg as any).type !== 'audio' && (
                                                <DropdownMenuItem onClick={() => handleStartEdit(msg)}>
                                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(msg.id)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
            </div>

            <div className="p-3 bg-transparent border-t border-muted/5">
                {isRecording ? (
                    <div className="flex items-center gap-3 bg-muted/20 rounded-md px-3 py-2 animate-pulse">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm font-medium flex-1">Recording... {formatTime(recordingTime)}</span>
                        <Button
                            onClick={stopRecording}
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                        >
                            <Square className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                        {/* Mention dropdown — inside form so `absolute bottom-full` works correctly */}
                        {mentionFilter !== null && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover text-popover-foreground border border-border rounded-md shadow-lg p-1 z-[60]">
                                {filteredDocs.length > 0 ? (
                                    filteredDocs.map((doc, idx) => (
                                        <div
                                            key={doc.id}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                                                idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                            )}
                                            // Use onMouseDown so it fires BEFORE the input's onBlur hides the dropdown
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectMention(doc);
                                            }}
                                        >
                                            <FileText className="h-4 w-4 opacity-70" />
                                            <span className="truncate">{doc.title}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground italic">No documents found</div>
                                )}
                            </div>
                        )}
                        <div className="flex-1 border border-border/30 rounded-md px-1 flex items-center bg-muted/5">
                            <Input
                                value={newMessage}
                                ref={inputRef}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const cursor = e.target.selectionStart ?? value.length;
                                    setNewMessage(value);

                                    // Detect @ trigger: find the last '@' at or before cursor, no space after it
                                    const textUpToCursor = value.substring(0, cursor);
                                    const lastAtIndex = textUpToCursor.lastIndexOf('@');
                                    if (lastAtIndex !== -1) {
                                        const textAfterAt = textUpToCursor.substring(lastAtIndex + 1);
                                        if (!textAfterAt.includes(' ')) {
                                            setMentionFilter(textAfterAt);
                                            setSelectedIndex(0);
                                            return;
                                        }
                                    }
                                    setMentionFilter(null);
                                }}
                                onKeyDown={(e) => {
                                    if (mentionFilter !== null && filteredDocs.length > 0) {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setSelectedIndex(prev => (prev + 1) % filteredDocs.length);
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setSelectedIndex(prev => (prev - 1 + filteredDocs.length) % filteredDocs.length);
                                        } else if (e.key === 'Enter' || e.key === 'Tab') {
                                            e.preventDefault();
                                            if (filteredDocs[selectedIndex]) {
                                                handleSelectMention(filteredDocs[selectedIndex]);
                                            }
                                        } else if (e.key === 'Escape') {
                                            setMentionFilter(null);
                                        }
                                    }
                                }}
                                placeholder="Type a note..."
                                className="border-0 focus-visible:ring-0 bg-transparent h-9"
                            />
                        </div>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={startRecording}
                                className="shrink-0 h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                title="Record Audio"
                            >
                                <Mic className="h-4 w-4" />
                            </Button>
                            <Button type="submit" size="icon" disabled={!newMessage.trim()} className="shrink-0 h-9 w-9">
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
