'use client'

import React from 'react'
import { ScrollArea } from "../../../components/ui/scroll-area"
import { Bot } from "lucide-react"
import type { Document as NoteDocument } from "../../../../core/types/notes"
import { useAiAgent } from "../hooks/use-ai-agent"
import { AiHeader } from "./ai-header"
import { AiMessageItem } from "./ai-message-item"
import { AiInputBox } from "./ai-input-box"

interface AiPanelProps {
    documents: NoteDocument[]
    showSidebar?: boolean
    onToggleSidebar?: () => void
    showTabs?: boolean
    onToggleTabs?: () => void
}

export function AiPanel({ documents, showSidebar, onToggleSidebar }: AiPanelProps) {
    const {
        provider,
        setProvider,
        usageData,
        messages,
        input,
        setInput,
        isLoading,
        copiedId,
        scrollEndRef,
        handleSend,
        copyToClipboard,
        clearChat
    } = useAiAgent(documents)

    return (
        <div className="flex flex-col h-full w-full bg-background border-l border-border/50 select-text">
            <AiHeader
                provider={provider}
                onSelectProvider={setProvider}
                usageData={usageData}
                onClearChat={clearChat}
                showSidebar={showSidebar}
                onToggleSidebar={onToggleSidebar}
            />

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.map((msg) => (
                        <AiMessageItem
                            key={msg.id}
                            message={msg}
                            copiedId={copiedId}
                            onCopy={copyToClipboard}
                        />
                    ))}

                    {isLoading && (
                        <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center">
                                <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
                            </div>
                            <div className="p-3 rounded-2xl bg-card border border-border/60 text-xs text-muted-foreground animate-pulse">
                                Escribiendo respuesta...
                            </div>
                        </div>
                    )}

                    <div ref={scrollEndRef} />
                </div>
            </ScrollArea>

            <AiInputBox
                input={input}
                onChangeInput={setInput}
                onSend={handleSend}
                isLoading={isLoading}
                provider={provider}
            />
        </div>
    )
}
