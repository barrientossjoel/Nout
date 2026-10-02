import React from 'react'
import { Button } from "../../../components/ui/button"
import { Textarea } from "../../../components/ui/textarea"
import { Send } from "lucide-react"
import type { ModelProvider } from "../types/ai-types"

interface AiInputBoxProps {
    input: string
    onChangeInput: (val: string) => void
    onSend: () => void
    isLoading: boolean
    provider: ModelProvider
}

export const AiInputBox: React.FC<AiInputBoxProps> = ({
    input,
    onChangeInput,
    onSend,
    isLoading,
    provider
}) => {
    return (
        <div className="p-3 border-t border-border bg-background">
            <div className="max-w-3xl mx-auto flex items-end gap-2 bg-card border border-border/60 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/40 shadow-xs">
                <Textarea
                    value={input}
                    onChange={(e) => onChangeInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            onSend()
                        }
                    }}
                    placeholder={`Pregunta a ${provider}... (Shift+Enter para nueva línea)`}
                    className="flex-1 min-h-[38px] max-h-[120px] text-xs bg-transparent border-0 focus-visible:ring-0 resize-none p-1 shadow-none"
                />
                <Button
                    size="icon"
                    onClick={onSend}
                    disabled={!input.trim() || isLoading}
                    className="h-8 w-8 shrink-0 rounded-lg"
                >
                    <Send className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}
