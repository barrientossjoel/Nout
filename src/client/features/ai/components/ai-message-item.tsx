import React from 'react'
import { Bot, User, Copy, Check, FileText } from "lucide-react"
import { cn } from "../../../lib/utils/utils"
import type { Message } from "../types/ai-types"

interface AiMessageItemProps {
    message: Message
    copiedId: string | null
    onCopy: (text: string, id: string) => void
}

export const AiMessageItem: React.FC<AiMessageItemProps> = ({ message: msg, copiedId, onCopy }) => {
    const isUser = msg.role === 'user'

    return (
        <div className={cn("flex items-start gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs shrink-0 font-medium shadow-xs",
                isUser ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-foreground"
            )}>
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
            </div>

            <div className={cn("flex flex-col max-w-[85%]", isUser ? "items-end" : "items-start")}>
                {msg.sources && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                        <FileText className="h-3 w-3 text-primary" />
                        <span>Fuentes: {msg.sources.join(', ')}</span>
                    </div>
                )}
                
                <div className={cn(
                    "p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap relative shadow-xs",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-tr-xs"
                        : "bg-card border border-border/60 text-foreground rounded-tl-xs"
                )}>
                    {msg.content}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1">
                    <button
                        onClick={() => onCopy(msg.content, msg.id)}
                        className="p-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 rounded hover:bg-muted"
                    >
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        {copiedId === msg.id ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
